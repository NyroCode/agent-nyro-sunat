import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { AuthenticationError } from "@nyro-sunat/core";
import type { SunatApiCredentials, SunatCredentialProvider } from "@nyro-sunat/sunat";

const executeFile = promisify(execFile);

export interface CommandResult {
  readonly stdout: string;
}

export interface CommandRunner {
  run(command: string, arguments_: readonly string[]): Promise<CommandResult>;
}

export class ExecFileCommandRunner implements CommandRunner {
  public async run(command: string, arguments_: readonly string[]): Promise<CommandResult> {
    const result = await executeFile(command, arguments_, {
      encoding: "utf8",
      timeout: 10_000,
      maxBuffer: 65_536,
      windowsHide: true,
    });

    return { stdout: result.stdout };
  }
}

export class EnvironmentSunatCredentialProvider implements SunatCredentialProvider {
  readonly #environment: Readonly<Record<string, string | undefined>>;

  public constructor(environment: Readonly<Record<string, string | undefined>>) {
    this.#environment = environment;
  }

  public async load(): Promise<SunatApiCredentials> {
    const clientId = this.#environment.SUNAT_CLIENT_ID;
    const clientSecret = this.#environment.SUNAT_CLIENT_SECRET;

    if (clientId === undefined || clientSecret === undefined) {
      throw new AuthenticationError(
        "Faltan las variables SUNAT_CLIENT_ID y SUNAT_CLIENT_SECRET del entorno de desarrollo.",
      );
    }

    return { clientId, clientSecret };
  }
}

export class SecretServiceSunatCredentialProvider implements SunatCredentialProvider {
  readonly #profileId: string;
  readonly #runner: CommandRunner;

  public constructor(profileId: string, runner: CommandRunner = new ExecFileCommandRunner()) {
    this.#profileId = profileId;
    this.#runner = runner;
  }

  public async load(): Promise<SunatApiCredentials> {
    try {
      const [clientId, clientSecret] = await Promise.all([
        this.#lookup("client-id"),
        this.#lookup("client-secret"),
      ]);

      return { clientId, clientSecret };
    } catch {
      throw new AuthenticationError(
        "No se pudieron resolver las credenciales del perfil desde Secret Service.",
      );
    }
  }

  async #lookup(field: "client-id" | "client-secret"): Promise<string> {
    const result = await this.#runner.run("secret-tool", [
      "lookup",
      "application",
      "agent-nyro-sunat",
      "profile",
      this.#profileId,
      "field",
      field,
    ]);
    const value = result.stdout.replace(/\r?\n$/u, "");
    if (value.length === 0) {
      throw new AuthenticationError();
    }

    return value;
  }
}
