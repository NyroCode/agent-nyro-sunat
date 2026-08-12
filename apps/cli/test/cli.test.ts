import { describe, expect, it, vi } from "vitest";
import {
  AuthenticationError,
  ExternalServiceError,
  createIsoInstant,
  createRequestId,
  createRuc,
  type QueryResult,
  type TaxpayerLookupData,
  type VoucherValidationData,
} from "../../../packages/core/src/index.js";
import { runCli, type CliIo } from "../src/cli.js";
import type { CliServices } from "../src/services.js";

describe("CLI local", () => {
  it("configura un perfil sin recibir secretos", async () => {
    const configureProfile = vi.fn(async () => "/tmp/synthetic/profiles.json");
    const services = createServices({ configureProfile });
    const output = captureOutput();

    const code = await runCli(
      [
        "perfil-configurar",
        "--profile",
        "empresa_demo",
        "--ruc-consultante",
        "20000000000",
        "--credenciales",
        "secret-service",
      ],
      services,
      output.io,
    );

    expect(code).toBe(0);
    expect(configureProfile).toHaveBeenCalledWith({
      profileId: "empresa_demo",
      queryingRuc: "20000000000",
      credentialSource: "secret-service",
    });
    expect(output.stdout.join("\n")).toContain("No se guardaron secretos");
  });

  it("ejecuta la consulta y entrega JSON estable", async () => {
    const validateVoucher = vi.fn(async () => syntheticResult());
    const services = createServices({ validateVoucher });
    const output = captureOutput();

    const code = await runCli(
      [
        "validar-comprobante",
        "--profile",
        "empresa_demo",
        "--ruc-emisor",
        "20000000000",
        "--tipo",
        "01",
        "--serie",
        "F001",
        "--numero",
        "1",
        "--fecha",
        "2026-08-08",
        "--monto",
        "118.00",
        "--moneda",
        "PEN",
        "--json",
      ],
      services,
      output.io,
    );

    expect(code).toBe(0);
    expect(validateVoucher).toHaveBeenCalledWith("empresa_demo", {
      issuerRuc: "20000000000",
      documentType: "01",
      series: "F001",
      number: "1",
      issueDate: "2026-08-08",
      total: "118.00",
      currency: "PEN",
    });
    expect(JSON.parse(output.stdout[0] ?? "{}")).toMatchObject({
      schemaVersion: "1",
      data: { status: "valid" },
      requestId: "cli-test-1",
    });
  });

  it("verifica OAuth sin exponer ni reutilizar el token", async () => {
    const verifyProfile = vi.fn(async () => ({
      profileId: "empresa_real",
      authenticated: true as const,
      capability: "cpe-validation-read-only" as const,
      verifiedAt: createIsoInstant("2026-08-08T12:00:00.000Z"),
      requestId: createRequestId("verify-test-1"),
    }));
    const output = captureOutput();

    const code = await runCli(
      ["perfil-verificar", "--profile", "empresa_real", "--json"],
      createServices({ verifyProfile }),
      output.io,
    );

    expect(code).toBe(0);
    expect(verifyProfile).toHaveBeenCalledWith("empresa_real");
    expect(JSON.parse(output.stdout[0] ?? "{}")).toMatchObject({
      profileId: "empresa_real",
      authenticated: true,
      capability: "cpe-validation-read-only",
      requestId: "verify-test-1",
    });
    expect(output.stdout.join("\n")).not.toMatch(/access.?token|client.?secret|clave/iu);
  });

  it("rechaza flags de secretos y no los repite en la salida", async () => {
    const validateVoucher = vi.fn(async () => syntheticResult());
    const output = captureOutput();

    const code = await runCli(
      ["validar-comprobante", "--client-secret", "must-not-leak"],
      createServices({ validateVoucher }),
      output.io,
    );

    expect(code).toBe(2);
    expect(validateVoucher).not.toHaveBeenCalled();
    expect(output.stderr.join("\n")).not.toContain("must-not-leak");
  });

  it("presenta errores de autenticación sanitizados", async () => {
    const services = createServices({
      validateVoucher: vi.fn(async () => {
        throw new AuthenticationError();
      }),
    });
    const output = captureOutput();

    const code = await runCli(
      [
        "validar-comprobante",
        "--profile",
        "empresa_demo",
        "--ruc-emisor",
        "20000000000",
        "--tipo",
        "01",
        "--serie",
        "F001",
        "--numero",
        "1",
        "--fecha",
        "2026-08-08",
        "--monto",
        "118",
        "--moneda",
        "PEN",
        "--json",
      ],
      services,
      output.io,
    );

    expect(code).toBe(3);
    expect(JSON.parse(output.stderr[0] ?? "{}")).toEqual({
      error: {
        code: "AUTHENTICATION_ERROR",
        message: "No se pudo autenticar con el servicio externo.",
      },
    });
  });

  it("incluye códigos externos controlados para diagnosticar rechazos", async () => {
    const services = createServices({
      validateVoucher: vi.fn(async () => {
        throw new ExternalServiceError("sunat-cpe-integrated-query", "SYNTHETIC_CODE");
      }),
    });
    const output = captureOutput();

    const code = await runCli(validVoucherArguments(), services, output.io);

    expect(code).toBe(2);
    expect(JSON.parse(output.stderr[0] ?? "{}")).toEqual({
      error: {
        code: "EXTERNAL_SERVICE_ERROR",
        message: "El servicio externo rechazó la consulta.",
        details: {
          provider: "sunat-cpe-integrated-query",
          external_code: "SYNTHETIC_CODE",
        },
      },
    });
  });

  it("consulta RUC con proveedor y credenciales explícitos", async () => {
    const lookupTaxpayer = vi.fn(async () => syntheticTaxpayerResult());
    const output = captureOutput();

    const code = await runCli(
      [
        "consultar-ruc",
        "--ruc",
        "20000000000",
        "--provider",
        "apiperu",
        "--credenciales",
        "environment",
        "--json",
      ],
      createServices({ lookupTaxpayer }),
      output.io,
    );

    expect(code).toBe(0);
    expect(lookupTaxpayer).toHaveBeenCalledWith({
      ruc: "20000000000",
      provider: "apiperu",
      credentialSource: "environment",
    });
    expect(JSON.parse(output.stdout[0] ?? "{}")).toMatchObject({
      schemaVersion: "1",
      data: { found: true },
      requestId: "ruc-test-1",
    });
  });

  it("actualiza el padrón sin recibir secretos", async () => {
    const updateRucRegistry = vi.fn(async () => ({
      databasePath: "/tmp/synthetic/padron.sqlite",
      datasetVersion: "2026-08-08",
      rowCount: 1,
      skippedRowCount: 0,
      archiveSha256: "a".repeat(64),
      sourcePage: "https://www.sunat.gob.pe/synthetic",
      archiveUrl: "https://www2.sunat.gob.pe/synthetic.zip",
    }));
    const output = captureOutput();

    const code = await runCli(
      ["padron-ruc-actualizar", "--json"],
      createServices({ updateRucRegistry }),
      output.io,
    );

    expect(code).toBe(0);
    expect(updateRucRegistry).toHaveBeenCalledOnce();
    expect(JSON.parse(output.stdout[0] ?? "{}")).toMatchObject({
      datasetVersion: "2026-08-08",
      rowCount: 1,
      skippedRowCount: 0,
    });
  });
});

function validVoucherArguments(): string[] {
  return [
    "validar-comprobante",
    "--profile",
    "empresa_demo",
    "--ruc-emisor",
    "20000000000",
    "--tipo",
    "01",
    "--serie",
    "F001",
    "--numero",
    "1",
    "--fecha",
    "2026-08-08",
    "--monto",
    "118",
    "--moneda",
    "PEN",
    "--json",
  ];
}

function createServices(overrides: Partial<CliServices> = {}): CliServices {
  return {
    configureProfile: async () => "/tmp/synthetic/profiles.json",
    verifyProfile: async () => ({
      profileId: "empresa_demo",
      authenticated: true,
      capability: "cpe-validation-read-only",
      verifiedAt: createIsoInstant("2026-08-08T12:00:00.000Z"),
      requestId: createRequestId("verify-test-default"),
    }),
    validateVoucher: async () => syntheticResult(),
    lookupTaxpayer: async () => syntheticTaxpayerResult(),
    updateRucRegistry: async () => ({
      databasePath: "/tmp/synthetic/padron.sqlite",
      datasetVersion: "2026-08-08",
      rowCount: 1,
      skippedRowCount: 0,
      archiveSha256: "a".repeat(64),
      sourcePage: "https://www.sunat.gob.pe/synthetic",
      archiveUrl: "https://www2.sunat.gob.pe/synthetic.zip",
    }),
    ...overrides,
  };
}

function syntheticTaxpayerResult(): QueryResult<TaxpayerLookupData> {
  return {
    data: {
      found: true,
      taxpayer: {
        ruc: createRuc("20000000000"),
        legalName: "EMPRESA SINTETICA SAC",
        status: "active",
        condition: "habido",
      },
    },
    provenance: {
      source: "synthetic-ruc",
      fetchedAt: createIsoInstant("2026-08-08T12:00:00.000Z"),
      isOfficial: false,
    },
    requestId: createRequestId("ruc-test-1"),
    warnings: [],
  };
}

function syntheticResult(): QueryResult<VoucherValidationData> {
  return {
    data: { status: "valid", externalCode: "1" },
    provenance: {
      source: "synthetic-cli",
      fetchedAt: createIsoInstant("2026-08-08T12:00:00.000Z"),
      isOfficial: false,
    },
    requestId: createRequestId("cli-test-1"),
    warnings: [],
  };
}

function captureOutput(): { io: CliIo; stdout: string[]; stderr: string[] } {
  const stdout: string[] = [];
  const stderr: string[] = [];
  return {
    stdout,
    stderr,
    io: {
      writeOut(message) {
        stdout.push(message);
      },
      writeError(message) {
        stderr.push(message);
      },
    },
  };
}
