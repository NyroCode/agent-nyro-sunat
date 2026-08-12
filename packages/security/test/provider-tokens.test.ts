import { describe, expect, it, vi } from "vitest";
import {
  EnvironmentApiTokenProvider,
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
  });

  it("consulta Secret Service con atributos fijos", async () => {
    const run = vi.fn(async () => ({ stdout: "synthetic-secret-service-token\n" }));
    const runner: CommandRunner = { run };
    const provider = new SecretServiceApiTokenProvider("decolecta", runner);

    await expect(provider.load()).resolves.toBe("synthetic-secret-service-token");
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
});
