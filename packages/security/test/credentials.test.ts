import { describe, expect, it } from "vitest";
import { AuthenticationError } from "../../core/src/index.js";
import {
  EnvironmentSunatCredentialProvider,
  SecretServiceSunatCredentialProvider,
  type CommandRunner,
} from "../src/index.js";

describe("resolución de credenciales", () => {
  it("admite variables de entorno solamente mediante el provider explícito", async () => {
    const provider = new EnvironmentSunatCredentialProvider({
      SUNAT_CLIENT_ID: "synthetic-client-id",
      SUNAT_CLIENT_SECRET: "synthetic-client-secret",
    });

    await expect(provider.load()).resolves.toEqual({
      clientId: "synthetic-client-id",
      clientSecret: "synthetic-client-secret",
    });
  });

  it("falla sin revelar qué valor falta", async () => {
    const provider = new EnvironmentSunatCredentialProvider({});

    await expect(provider.load()).rejects.toBeInstanceOf(AuthenticationError);
  });

  it("consulta Secret Service sin pasar secretos como argumentos", async () => {
    const calls: Array<{ command: string; arguments_: readonly string[] }> = [];
    const runner: CommandRunner = {
      async run(command, arguments_) {
        calls.push({ command, arguments_ });
        return {
          stdout:
            arguments_.at(-1) === "client-id" ? "synthetic-client-id\n" : "synthetic-secret\n",
        };
      },
    };
    const provider = new SecretServiceSunatCredentialProvider("empresa_demo", runner);

    await expect(provider.load()).resolves.toEqual({
      clientId: "synthetic-client-id",
      clientSecret: "synthetic-secret",
    });
    expect(calls).toHaveLength(2);
    expect(JSON.stringify(calls)).not.toContain("synthetic-secret");
    expect(calls.every((call) => call.command === "secret-tool")).toBe(true);
  });
});
