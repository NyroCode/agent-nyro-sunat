import { describe, expect, it, vi } from "vitest";
import {
  EnvironmentApiTokenProvider,
  ProviderCredentialNotConfiguredError,
  SecretServiceApiTokenProvider,
  type CommandRunner,
} from "../src/index.js";

describe("tokens de proveedores RUC", () => {
  it("lee solo la variable autorizada del entorno", async () => {
    const provider = new EnvironmentApiTokenProvider("apiperu", {
      APIPERU_TOKEN: "synthetic-api-token",
      DECOLECTA_TOKEN: "unrelated-token",
    });

    await expect(provider.load()).resolves.toBe("synthetic-api-token");
    await expect(provider.isConfigured()).resolves.toBe(true);
  });

  it("distingue un proveedor no configurado de una autenticación rechazada", async () => {
    const provider = new EnvironmentApiTokenProvider("apiperu", {});

    await expect(provider.isConfigured()).resolves.toBe(false);
    await expect(provider.load()).rejects.toBeInstanceOf(ProviderCredentialNotConfiguredError);
  });

  it("consulta Secret Service con atributos fijos", async () => {
    const run = vi.fn(async () => ({ stdout: "synthetic-secret-service-token\n" }));
    const runner: CommandRunner = { run };
    const provider = new SecretServiceApiTokenProvider("decolecta", runner);

    await expect(provider.load()).resolves.toBe("synthetic-secret-service-token");
    await expect(provider.isConfigured()).resolves.toBe(true);
    expect(run).toHaveBeenCalledOnce();
    expect(run).toHaveBeenCalledWith("secret-tool", [
      "lookup",
      "application",
      "agent-nyro-sunat",
      "provider",
      "decolecta",
      "field",
      "token",
    ]);
  });

  it("omite un token ausente en Secret Service sin ocultar fallas operativas", async () => {
    const missingRunner: CommandRunner = {
      async run() {
        return { stdout: "" };
      },
    };
    const unavailableRunner: CommandRunner = {
      async run() {
        throw new Error("synthetic secret service failure");
      },
    };

    await expect(
      new SecretServiceApiTokenProvider("apiperu", missingRunner).isConfigured(),
    ).resolves.toBe(false);
    await expect(
      new SecretServiceApiTokenProvider("apiperu", unavailableRunner).isConfigured(),
    ).rejects.toMatchObject({ code: "AUTHENTICATION_ERROR" });
  });
});
