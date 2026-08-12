import { createHash, randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { chmod, mkdir, rename, rm, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { pipeline } from "node:stream/promises";
import { ContractDriftError, ProviderUnavailableError } from "@nyro-sunat/core";
import { openPromise, type Entry } from "yauzl";
import { normalizeTaxpayerState } from "./normalization.js";

const PROVIDER = "sunat-padron-reducido-ruc";
const SOURCE_PAGE = "https://www.sunat.gob.pe/descargaPRR/mrc137_padron_reducido.html";
const ARCHIVE_URL = "https://www2.sunat.gob.pe/padron_reducido_ruc.zip";
const ENTRY_NAME = "padron_reducido_ruc.txt";
const EXPECTED_HEADER = [
  "RUC",
  "NOMBRE O RAZÓN SOCIAL",
  "ESTADO DEL CONTRIBUYENTE",
  "CONDICIÓN DE DOMICILIO",
  "UBIGEO",
  "TIPO DE VÍA",
  "NOMBRE DE VÍA",
  "CÓDIGO DE ZONA",
  "TIPO DE ZONA",
  "NÚMERO",
  "INTERIOR",
  "LOTE",
  "DEPARTAMENTO",
  "MANZANA",
  "KILÓMETRO",
] as const;
const MAX_PAGE_BYTES = 1_048_576;
const MAX_ARCHIVE_BYTES = 1_073_741_824;
const MAX_ENTRY_BYTES = 3_221_225_472;
const MAX_LINE_CHARACTERS = 65_536;
const MAX_COMPRESSION_RATIO = 10;
const INSERT_BATCH_SIZE = 50_000;

export interface RucRegistryImportResult {
  readonly databasePath: string;
  readonly datasetVersion: string;
  readonly rowCount: number;
  readonly skippedRowCount: number;
  readonly archiveSha256: string;
}

export interface RucRegistryUpdateResult extends RucRegistryImportResult {
  readonly sourcePage: string;
  readonly archiveUrl: string;
}

export class RucRegistryImporter {
  public async importArchive(
    archivePath: string,
    databasePath: string,
    datasetVersion: string,
  ): Promise<RucRegistryImportResult> {
    const archiveStatistics = await stat(archivePath);
    if (!archiveStatistics.isFile() || archiveStatistics.size > MAX_ARCHIVE_BYTES) {
      throw new ContractDriftError(PROVIDER);
    }

    const archiveSha256 = await hashFile(archivePath);
    const temporaryDatabasePath = `${databasePath}.${randomUUID()}.tmp`;
    await mkdir(dirname(databasePath), { recursive: true, mode: 0o700 });
    let database: DatabaseSync | undefined;
    try {
      database = new DatabaseSync(temporaryDatabasePath);
      database.exec(
        "PRAGMA journal_mode=OFF; PRAGMA synchronous=OFF; PRAGMA temp_store=MEMORY;" +
          "CREATE TABLE metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL) WITHOUT ROWID;" +
          "CREATE TABLE taxpayers (ruc TEXT PRIMARY KEY, legal_name TEXT NOT NULL, status TEXT NOT NULL, condition TEXT NOT NULL) WITHOUT ROWID;",
      );
      const importStatistics = await importZipRows(archivePath, database);
      const metadata = database.prepare("INSERT INTO metadata (key, value) VALUES (?, ?)");
      metadata.run("dataset_version", datasetVersion);
      metadata.run("archive_sha256", archiveSha256);
      metadata.run("row_count", String(importStatistics.rowCount));
      metadata.run("skipped_row_count", String(importStatistics.skippedRowCount));
      database.exec("PRAGMA optimize;");
      database.close();
      database = undefined;
      await chmod(temporaryDatabasePath, 0o600);
      await rename(temporaryDatabasePath, databasePath);
      return Object.freeze({
        databasePath,
        datasetVersion,
        rowCount: importStatistics.rowCount,
        skippedRowCount: importStatistics.skippedRowCount,
        archiveSha256,
      });
    } catch (error: unknown) {
      database?.close();
      await rm(temporaryDatabasePath, { force: true });
      if (error instanceof ContractDriftError) {
        throw error;
      }
      throw new ProviderUnavailableError(PROVIDER);
    }
  }
}

export interface RucRegistryUpdaterOptions {
  readonly importer?: RucRegistryImporter;
  readonly fetchImplementation?: typeof fetch;
}

export class RucRegistryUpdater {
  readonly #importer: RucRegistryImporter;
  readonly #fetch: typeof fetch;

  public constructor(options: RucRegistryUpdaterOptions = {}) {
    this.#importer = options.importer ?? new RucRegistryImporter();
    this.#fetch = options.fetchImplementation ?? fetch;
  }

  public async update(databasePath: string): Promise<RucRegistryUpdateResult> {
    const dataDirectory = dirname(databasePath);
    const workDirectory = join(dataDirectory, `.update-${randomUUID()}`);
    const archivePath = join(workDirectory, "padron.zip");
    await mkdir(dataDirectory, { recursive: true, mode: 0o700 });
    await mkdir(workDirectory, { recursive: false, mode: 0o700 });
    try {
      const datasetVersion = await this.#readDatasetVersion();
      await this.#downloadArchive(archivePath);
      const imported = await this.#importer.importArchive(
        archivePath,
        databasePath,
        datasetVersion,
      );
      return Object.freeze({ ...imported, sourcePage: SOURCE_PAGE, archiveUrl: ARCHIVE_URL });
    } finally {
      await rm(workDirectory, { recursive: true, force: true });
    }
  }

  async #readDatasetVersion(): Promise<string> {
    const response = await safeFetch(this.#fetch, SOURCE_PAGE, 30_000);
    assertSuccessfulResponse(response, SOURCE_PAGE);
    const body = await readBoundedResponse(response, MAX_PAGE_BYTES);
    if (!body.includes("padron_reducido_ruc.zip")) {
      throw new ContractDriftError(PROVIDER);
    }
    const match = /Actualizado\s+al\s+(\d{2})\/(\d{2})\/(\d{4})/iu.exec(body);
    if (match?.[1] === undefined || match[2] === undefined || match[3] === undefined) {
      throw new ContractDriftError(PROVIDER);
    }
    const datasetVersion = `${match[3]}-${match[2]}-${match[1]}`;
    return datasetVersion;
  }

  async #downloadArchive(archivePath: string): Promise<void> {
    const response = await safeFetch(this.#fetch, ARCHIVE_URL, 600_000);
    assertSuccessfulResponse(response, ARCHIVE_URL);
    const declaredLength = response.headers.get("content-length");
    if (declaredLength !== null && Number(declaredLength) > MAX_ARCHIVE_BYTES) {
      throw new ContractDriftError(PROVIDER);
    }
    if (response.body === null) {
      throw new ContractDriftError(PROVIDER);
    }

    try {
      await pipeline(
        boundedBinaryBody(response.body, MAX_ARCHIVE_BYTES),
        createWriteStream(archivePath, { mode: 0o600 }),
      );
    } catch (error: unknown) {
      if (error instanceof ContractDriftError) {
        throw error;
      }
      throw new ProviderUnavailableError(PROVIDER);
    }
  }
}

interface ImportStatistics {
  readonly rowCount: number;
  readonly skippedRowCount: number;
}

async function importZipRows(
  archivePath: string,
  database: DatabaseSync,
): Promise<ImportStatistics> {
  const zip = await openPromise(archivePath, {
    lazyEntries: true,
    decodeStrings: true,
    validateEntrySizes: true,
    strictFileNames: true,
    autoClose: false,
  });
  try {
    if (zip.entryCount !== 1) {
      throw new ContractDriftError(PROVIDER);
    }
    let entry: Entry | undefined;
    for await (const candidate of zip.eachEntry()) {
      entry = candidate;
    }
    if (entry === undefined) {
      throw new ContractDriftError(PROVIDER);
    }
    assertSafeEntry(entry);
    const stream = await zip.openReadStreamPromise(entry);
    return await importTextStream(stream, database);
  } finally {
    zip.close();
  }
}

function assertSafeEntry(entry: Entry): void {
  const unixMode = (entry.externalFileAttributes >>> 16) & 0xffff;
  const isUnixSymlink = (unixMode & 0o170000) === 0o120000;
  if (
    entry.fileName !== ENTRY_NAME ||
    entry.fileName.includes("..") ||
    entry.fileName.startsWith("/") ||
    isUnixSymlink ||
    entry.isEncrypted() ||
    !entry.canDecodeFileData() ||
    entry.uncompressedSize > MAX_ENTRY_BYTES ||
    entry.compressedSize <= 0 ||
    entry.uncompressedSize / entry.compressedSize > MAX_COMPRESSION_RATIO
  ) {
    throw new ContractDriftError(PROVIDER);
  }
}

async function importTextStream(
  stream: NodeJS.ReadableStream,
  database: DatabaseSync,
): Promise<ImportStatistics> {
  const insert = database.prepare(
    "INSERT INTO taxpayers (ruc, legal_name, status, condition) VALUES (?, ?, ?, ?)",
  );
  const decoder = new TextDecoder("windows-1252", { fatal: true });
  let remainder = "";
  let lineNumber = 0;
  let rowCount = 0;
  let skippedRowCount = 0;
  database.exec("BEGIN IMMEDIATE;");
  try {
    for await (const rawChunk of stream) {
      const chunk = toUint8Array(rawChunk);
      remainder += decoder.decode(chunk, { stream: true });
      const lines = remainder.split(/\r?\n/u);
      remainder = lines.pop() ?? "";
      if (remainder.length > MAX_LINE_CHARACTERS) {
        throw new ContractDriftError(PROVIDER);
      }
      for (const line of lines) {
        lineNumber += 1;
        if (lineNumber === 1) {
          assertHeader(line);
          continue;
        }
        if (line.length === 0) {
          continue;
        }
        if (insertRow(line, insert)) {
          rowCount += 1;
        } else {
          skippedRowCount += 1;
        }
        if (rowCount % INSERT_BATCH_SIZE === 0) {
          database.exec("COMMIT; BEGIN IMMEDIATE;");
        }
      }
    }
    remainder += decoder.decode();
    if (remainder.length > 0) {
      lineNumber += 1;
      if (lineNumber === 1) {
        assertHeader(remainder);
      } else {
        if (insertRow(remainder, insert)) {
          rowCount += 1;
        } else {
          skippedRowCount += 1;
        }
      }
    }
    if (lineNumber < 2 || rowCount === 0) {
      throw new ContractDriftError(PROVIDER);
    }
    database.exec("COMMIT;");
    return Object.freeze({ rowCount, skippedRowCount });
  } catch (error: unknown) {
    database.exec("ROLLBACK;");
    throw error;
  }
}

function insertRow(line: string, insert: ReturnType<DatabaseSync["prepare"]>): boolean {
  const columns = line.split("|");
  if (
    (columns.length !== EXPECTED_HEADER.length + 1 &&
      columns.length !== EXPECTED_HEADER.length + 2) ||
    columns.at(-1) !== ""
  ) {
    throw new ContractDriftError(PROVIDER);
  }
  const ruc = columns[0];
  const legalName = columns[1];
  const rawStatus = columns[2];
  const rawCondition = columns[3];
  if (
    ruc === undefined ||
    legalName === undefined ||
    legalName.length === 0 ||
    rawStatus === undefined ||
    rawCondition === undefined
  ) {
    throw new ContractDriftError(PROVIDER);
  }
  if (!/^\d{11}$/u.test(ruc)) {
    return false;
  }
  const normalized = normalizeTaxpayerState(rawStatus, rawCondition);
  insert.run(ruc, legalName, normalized.status, normalized.condition);
  return true;
}

function assertHeader(line: string): void {
  const columns = line.replace(/^\uFEFF/u, "").split("|");
  if (columns.at(-1) === "") {
    columns.pop();
  }
  if (
    columns.length !== EXPECTED_HEADER.length ||
    columns.some((column, index) => column !== EXPECTED_HEADER[index])
  ) {
    throw new ContractDriftError(PROVIDER);
  }
}

async function hashFile(path: string): Promise<string> {
  const hash = createHash("sha256");
  const { createReadStream } = await import("node:fs");
  for await (const chunk of createReadStream(path)) {
    hash.update(toUint8Array(chunk));
  }
  return hash.digest("hex");
}

function toUint8Array(value: unknown): Uint8Array {
  if (value instanceof Uint8Array) {
    return value;
  }
  throw new ContractDriftError(PROVIDER);
}

async function* boundedBinaryBody(
  body: ReadableStream<Uint8Array>,
  maximumBytes: number,
): AsyncGenerator<Uint8Array, void, undefined> {
  const reader = body.getReader();
  let receivedBytes = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) {
        return;
      }
      receivedBytes += chunk.value.byteLength;
      if (receivedBytes > maximumBytes) {
        await reader.cancel();
        throw new ContractDriftError(PROVIDER);
      }
      yield chunk.value;
    }
  } finally {
    reader.releaseLock();
  }
}

async function safeFetch(
  fetchImplementation: typeof fetch,
  url: string,
  timeoutMs: number,
): Promise<Response> {
  try {
    return await fetchImplementation(url, {
      redirect: "error",
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        accept: "text/html,application/xhtml+xml,application/zip,*/*;q=0.8",
        "user-agent":
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/138.0 Safari/537.36 agent-nyro-sunat/0.0.0",
      },
    });
  } catch (error: unknown) {
    if (error instanceof ContractDriftError) {
      throw error;
    }
    throw new ProviderUnavailableError(PROVIDER);
  }
}

function assertSuccessfulResponse(response: Response, expectedUrl: string): void {
  if (!response.ok || response.url !== expectedUrl) {
    throw new ProviderUnavailableError(PROVIDER);
  }
}

async function readBoundedResponse(response: Response, maximumBytes: number): Promise<string> {
  const declaredLength = response.headers.get("content-length");
  if (declaredLength !== null && Number(declaredLength) > maximumBytes) {
    throw new ContractDriftError(PROVIDER);
  }
  if (response.body === null) {
    return "";
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let receivedBytes = 0;
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) {
      break;
    }
    receivedBytes += chunk.value.byteLength;
    if (receivedBytes > maximumBytes) {
      await reader.cancel();
      throw new ContractDriftError(PROVIDER);
    }
    chunks.push(chunk.value);
  }
  const buffer = new Uint8Array(receivedBytes);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return new TextDecoder("windows-1252", { fatal: true }).decode(buffer);
  } catch {
    throw new ContractDriftError(PROVIDER);
  }
}

export const SUNAT_RUC_REGISTRY_SOURCE_PAGE: string = SOURCE_PAGE;
export const SUNAT_RUC_REGISTRY_ARCHIVE_URL: string = ARCHIVE_URL;
