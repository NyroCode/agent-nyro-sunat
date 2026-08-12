import { AuthenticationError } from "@nyro-sunat/core";
import type { ApiTokenProvider } from "@nyro-sunat/providers";
import { ExecFileCommandRunner, type CommandRunner } from "./credentials.js";

export type RucApiProvider = "apiperu" | "decolecta";

export interface ConfigurableApiTokenProvider extends ApiTokenProvider {
  isConfigured(): Promise<boolean>;
}

export class ProviderCredentialNotConfiguredError extends AuthenticationError {
  public constructor(provider: RucApiProvider) {
    super(`No hay un token configurado para ${provider}.`);
    this.name = "ProviderCredentialNotConfiguredError";
  }
}

const TOKEN_VARIABLES: Readonly<Record<RucApiProvider, string>> = Object.freeze({
  apiperu: "APIPERU_TOKEN",
  decolecta: "DECOLECTA_TOKEN",
});

export class EnvironmentApiTokenProvider implements ConfigurableApiTokenProvider {
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
      throw new ProviderCredentialNotConfiguredError(this.#provider);
    }
    return token;
  }

  public async isConfigured(): Promise<boolean> {
    const token = this.#environment[TOKEN_VARIABLES[this.#provider]];
    return token !== undefined && token.length > 0;
  }
}

export class SecretServiceApiTokenProvider implements ConfigurableApiTokenProvider {
  readonly #provider: RucApiProvider;
  readonly #runner: CommandRunner;
  #cachedToken: string | undefined;

  public constructor(
    provider: RucApiProvider,
    runner: CommandRunner = new ExecFileCommandRunner(),
  ) {
    this.#provider = provider;
    this.#runner = runner;
  }

  public async load(): Promise<string> {
    if (this.#cachedToken !== undefined) {
      return this.#cachedToken;
    }

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
        throw new ProviderCredentialNotConfiguredError(this.#provider);
      }
      this.#cachedToken = token;
      return token;
    } catch (error: unknown) {
      if (error instanceof ProviderCredentialNotConfiguredError || isMissingSecretExit(error)) {
        throw new ProviderCredentialNotConfiguredError(this.#provider);
      }
      throw new AuthenticationError(
        `No se pudo resolver el token de ${this.#provider} desde Secret Service.`,
      );
    }
  }

  public async isConfigured(): Promise<boolean> {
    try {
      await this.load();
      return true;
    } catch (error: unknown) {
      if (error instanceof ProviderCredentialNotConfiguredError) {
        return false;
      }
      throw error;
    }
  }
}

function isMissingSecretExit(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return false;
  }

  return error.code === 1 || error.code === "1";
}
