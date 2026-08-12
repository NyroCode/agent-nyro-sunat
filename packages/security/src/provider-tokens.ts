import { AuthenticationError } from "@nyro-sunat/core";
import type { ApiTokenProvider } from "@nyro-sunat/providers";
import { ExecFileCommandRunner, type CommandRunner } from "./credentials.js";

export type RucApiProvider = "apiperu" | "decolecta";

const TOKEN_VARIABLES: Readonly<Record<RucApiProvider, string>> = Object.freeze({
  apiperu: "APIPERU_TOKEN",
  decolecta: "DECOLECTA_TOKEN",
});

export class EnvironmentApiTokenProvider implements ApiTokenProvider {
  readonly #provider: RucApiProvider;
  readonly #environment: Readonly<Record<string, string | undefined>>;

  public constructor(
    provider: RucApiProvider,
    environment: Readonly<Record<string, string | undefined>>,
  ) {
    this.#provider = provider;
    this.#environment = environment;
  }

  public async load(): Promise<string> {
    const variableName = TOKEN_VARIABLES[this.#provider];
    const token = this.#environment[variableName];
    if (token === undefined || token.length === 0) {
      throw new AuthenticationError(
        `Falta la variable ${variableName} en el entorno de desarrollo.`,
      );
    }
    return token;
  }
}

export class SecretServiceApiTokenProvider implements ApiTokenProvider {
  readonly #provider: RucApiProvider;
  readonly #runner: CommandRunner;

  public constructor(
    provider: RucApiProvider,
    runner: CommandRunner = new ExecFileCommandRunner(),
  ) {
    this.#provider = provider;
    this.#runner = runner;
  }

  public async load(): Promise<string> {
    try {
      const result = await this.#runner.run("secret-tool", [
        "lookup",
        "application",
        "agent-nyro-sunat",
        "provider",
        this.#provider,
        "field",
        "token",
      ]);
      const token = result.stdout.replace(/\r?\n$/u, "");
      if (token.length === 0) {
        throw new AuthenticationError();
      }
      return token;
    } catch {
      throw new AuthenticationError(
        `No se pudo resolver el token de ${this.#provider} desde Secret Service.`,
      );
    }
  }
}
