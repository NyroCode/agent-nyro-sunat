import { createWriteStream } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { createRequestId, createRuc } from "@nyro-sunat/core";
import { ZipFile } from "yazl";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  LocalRucRegistryAdapter,
  RucRegistryImporter,
  RucRegistryUpdater,
  SUNAT_RUC_REGISTRY_ARCHIVE_URL,
  SUNAT_RUC_REGISTRY_SOURCE_PAGE,
} from "../src/index.js";

const temporaryDirectories: string[] = [];
const HEADER =
  "RUC|NOMBRE O RAZÓN SOCIAL|ESTADO DEL CONTRIBUYENTE|CONDICIÓN DE DOMICILIO|UBIGEO|TIPO DE VÍA|NOMBRE DE VÍA|CÓDIGO DE ZONA|TIPO DE ZONA|NÚMERO|INTERIOR|LOTE|DEPARTAMENTO|MANZANA|KILÓMETRO|";

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })),
  );
});

describe("padrón RUC local", () => {
  it("importa el ZIP sintético y consulta SQLite con trazabilidad oficial", async () => {
    const directory = await syntheticDirectory();
    const archivePath = join(directory, "padron.zip");
    const databasePath = join(directory, "data", "padron.sqlite");
    await writeSyntheticZip(
      archivePath,
      `${HEADER}\r\n` +
        "20000000000|EMPRESA SINTETICA SAC|ACTIVO|HABIDO||||||||||||\r\n" +
        "2000000000X|FILA SINTETICA INVALIDA|ACTIVO|HABIDO||||||||||||\r\n" +
        "20000000001|EMPRESA SINTETICA DOS|ACTIVO|HABIDO|||||||||||||\r\n",
    );

    const imported = await new RucRegistryImporter().importArchive(
      archivePath,
      databasePath,
      "2026-08-08",
    );
    const result = await new LocalRucRegistryAdapter({ databasePath }).lookup(
      { ruc: createRuc("20000000000") },
      { requestId: createRequestId("synthetic-local-test") },
    );

    expect(imported).toMatchObject({
      datasetVersion: "2026-08-08",
      rowCount: 2,
      skippedRowCount: 1,
    });
    expect(imported.archiveSha256).toMatch(/^[a-f0-9]{64}$/u);
    expect(result).toMatchObject({
      data: {
        found: true,
        taxpayer: {
          legalName: "EMPRESA SINTETICA SAC",
          status: "active",
          condition: "habido",
        },
      },
      provenance: {
        source: "sunat-padron-reducido-ruc",
        isOfficial: true,
        datasetVersion: "2026-08-08",
        validAt: "2026-08-08",
      },
      warnings: [{ code: "DATASET_NOT_REAL_TIME" }, { code: "DATASET_ROWS_SKIPPED" }],
    });
  });

  it("rechaza un nombre de entrada inesperado", async () => {
    const directory = await syntheticDirectory();
    const archivePath = join(directory, "invalid.zip");
    await writeSyntheticZip(archivePath, `${HEADER}\r\n`, "otro.txt");

    await expect(
      new RucRegistryImporter().importArchive(
        archivePath,
        join(directory, "padron.sqlite"),
        "2026-08-08",
      ),
    ).rejects.toMatchObject({ code: "CONTRACT_DRIFT" });
  });

  it("descarga e instala atómicamente en un directorio nuevo", async () => {
    const directory = await syntheticDirectory();
    const sourceArchive = join(directory, "source.zip");
    await writeSyntheticZip(
      sourceArchive,
      `${HEADER}\r\n20000000000|EMPRESA SINTETICA SAC|ACTIVO|HABIDO||||||||||||\r\n`,
    );
    const archive = await readFile(sourceArchive);
    const fetchImplementation = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      const response =
        url === SUNAT_RUC_REGISTRY_SOURCE_PAGE
          ? new Response("<a href='padron_reducido_ruc.zip'>Padrón</a> Actualizado al 08/08/2026")
          : new Response(archive);
      Object.defineProperty(response, "url", { value: url });
      return response;
    }) as unknown as typeof fetch;
    const databasePath = join(directory, "fresh", "nested", "padron.sqlite");

    const result = await new RucRegistryUpdater({ fetchImplementation }).update(databasePath);

    expect(result).toMatchObject({
      databasePath,
      datasetVersion: "2026-08-08",
      rowCount: 1,
      skippedRowCount: 0,
      sourcePage: SUNAT_RUC_REGISTRY_SOURCE_PAGE,
      archiveUrl: SUNAT_RUC_REGISTRY_ARCHIVE_URL,
    });
    expect(fetchImplementation).toHaveBeenCalledTimes(2);
  });
});

async function syntheticDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "nyro-synthetic-padron-"));
  temporaryDirectories.push(directory);
  return directory;
}

async function writeSyntheticZip(
  path: string,
  content: string,
  entryName = "padron_reducido_ruc.txt",
): Promise<void> {
  const zip = new ZipFile();
  zip.addBuffer(Buffer.from(content, "latin1"), entryName, { compress: false });
  zip.end();
  await pipeline(zip.outputStream, createWriteStream(path));
}
