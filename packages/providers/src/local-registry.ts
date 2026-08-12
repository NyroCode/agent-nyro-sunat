import { lstat } from "node:fs/promises";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  ContractDriftError,
  ProviderUnavailableError,
  createIsoInstant,
  createLocalDate,
  createRuc,
  type IsoInstant,
  type ProviderResult,
  type QueryContext,
  type TaxpayerCondition,
  type TaxpayerLookupData,
  type TaxpayerLookupInput,
  type TaxpayerLookupPort,
  type TaxpayerStatus,
} from "@nyro-sunat/core";

const PROVIDER = "sunat-padron-reducido-ruc";
const DATABASE_FILE = "padron-ruc.sqlite";

export function defaultRucRegistryPath(
  homeDirectory: string,
  environment: Readonly<Record<string, string | undefined>>,
): string {
  const dataDirectory = environment.XDG_DATA_HOME ?? join(homeDirectory, ".local", "share");
  return join(dataDirectory, "agent-nyro-sunat", DATABASE_FILE);
}

export interface LocalRucRegistryAdapterOptions {
  readonly databasePath: string;
  readonly now?: () => IsoInstant;
}

export class LocalRucRegistryAdapter implements TaxpayerLookupPort {
  readonly #databasePath: string;
  readonly #now: () => IsoInstant;

  public constructor(options: LocalRucRegistryAdapterOptions) {
    this.#databasePath = options.databasePath;
    this.#now = options.now ?? (() => createIsoInstant(new Date().toISOString()));
  }

  public async lookup(
    input: TaxpayerLookupInput,
    _context: QueryContext,
  ): Promise<ProviderResult<TaxpayerLookupData>> {
    await assertSafeDatabaseFile(this.#databasePath);

    let database: DatabaseSync | undefined;
    try {
      database = new DatabaseSync(this.#databasePath, { readOnly: true });
      const datasetVersion = readDatasetVersion(database);
      const skippedRowCount = readSkippedRowCount(database);
      const row = database
        .prepare("SELECT ruc, legal_name, status, condition FROM taxpayers WHERE ruc = ? LIMIT 1")
        .get(input.ruc);
      const provenance = Object.freeze({
        source: PROVIDER,
        fetchedAt: this.#now(),
        isOfficial: true,
        datasetVersion,
        validAt: createLocalDate(datasetVersion),
      });
      const warnings = Object.freeze([
        {
          code: "DATASET_NOT_REAL_TIME",
          message: "El padrón local refleja la fecha indicada y no el estado en tiempo real.",
        },
        ...(skippedRowCount === 0
          ? []
          : [
              {
                code: "DATASET_ROWS_SKIPPED",
                message: `${skippedRowCount} fila(s) con identificador inválido fueron omitidas al importar.`,
              },
            ]),
      ]);

      if (row === undefined) {
        return Object.freeze({ data: Object.freeze({ found: false }), provenance, warnings });
      }

      const ruc = requireText(row.ruc);
      const legalName = requireText(row.legal_name);
      const status = requireStatus(row.status);
      const condition = requireCondition(row.condition);
      if (ruc !== input.ruc) {
        throw new ContractDriftError(PROVIDER);
      }

      return Object.freeze({
        data: Object.freeze({
          found: true,
          taxpayer: Object.freeze({
            ruc: createRuc(ruc),
            legalName,
            status,
            condition,
          }),
        }),
        provenance,
        warnings,
      });
    } catch (error: unknown) {
      if (error instanceof ContractDriftError) {
        throw error;
      }
      throw new ProviderUnavailableError(PROVIDER);
    } finally {
      database?.close();
    }
  }
}

async function assertSafeDatabaseFile(path: string): Promise<void> {
  try {
    const statistics = await lstat(path);
    if (!statistics.isFile() || statistics.isSymbolicLink()) {
      throw new ProviderUnavailableError(PROVIDER);
    }
  } catch {
    throw new ProviderUnavailableError(PROVIDER);
  }
}

function readDatasetVersion(database: DatabaseSync): string {
  const row = database
    .prepare("SELECT value FROM metadata WHERE key = 'dataset_version' LIMIT 1")
    .get();
  const value = row === undefined ? undefined : row.value;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) {
    throw new ContractDriftError(PROVIDER);
  }
  return value;
}

function readSkippedRowCount(database: DatabaseSync): number {
  const row = database
    .prepare("SELECT value FROM metadata WHERE key = 'skipped_row_count' LIMIT 1")
    .get();
  const value = row === undefined ? undefined : row.value;
  if (typeof value !== "string" || !/^\d+$/u.test(value)) {
    throw new ContractDriftError(PROVIDER);
  }
  const count = Number(value);
  if (!Number.isSafeInteger(count)) {
    throw new ContractDriftError(PROVIDER);
  }
  return count;
}

function requireText(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new ContractDriftError(PROVIDER);
  }
  return value;
}

function requireStatus(value: unknown): TaxpayerStatus {
  if (value === "active" || value === "suspended" || value === "cancelled" || value === "unknown") {
    return value;
  }
  throw new ContractDriftError(PROVIDER);
}

function requireCondition(value: unknown): TaxpayerCondition {
  if (value === "habido" || value === "no_habido" || value === "pending" || value === "unknown") {
    return value;
  }
  throw new ContractDriftError(PROVIDER);
}

export const LOCAL_RUC_REGISTRY_PROVIDER: string = PROVIDER;
