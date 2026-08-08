import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { AuthorizationError, ContractDriftError, ValidationError } from "../../core/src/index.js";
import { JsonProfileRepository, createProfile, defaultProfilePath } from "../src/index.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })),
  );
});

describe("perfiles locales", () => {
  it("guarda únicamente configuración no secreta con permisos restrictivos", async () => {
    const directory = await createTemporaryDirectory();
    const path = join(directory, "config", "profiles.json");
    const repository = new JsonProfileRepository(path);

    await repository.save(createProfile("empresa_demo", "20000000000", "secret-service"));

    await expect(repository.load("empresa_demo")).resolves.toEqual({
      id: "empresa_demo",
      queryingRuc: "20000000000",
      credentialSource: "secret-service",
      capability: "cpe-validation-read-only",
    });
    const body = await readFile(path, "utf8");
    expect(body).not.toMatch(/client.?secret|password|token|clave/iu);
    expect((await stat(path)).mode & 0o077).toBe(0);
  });

  it("rechaza campos adicionales que podrían intentar guardar secretos", async () => {
    const directory = await createTemporaryDirectory();
    const path = join(directory, "profiles.json");
    await writeFile(
      path,
      JSON.stringify({
        version: 1,
        profiles: {
          demo: {
            queryingRuc: "20000000000",
            credentialSource: "environment",
            capability: "cpe-validation-read-only",
            clientSecret: "synthetic-secret-that-must-not-be-accepted",
          },
        },
      }),
      { mode: 0o600 },
    );

    const repository = new JsonProfileRepository(path);

    await expect(repository.load("demo")).rejects.toBeInstanceOf(ContractDriftError);
  });

  it("valida identificadores y calcula una ruta XDG estable", () => {
    expect(
      defaultProfilePath("/home/synthetic", { XDG_CONFIG_HOME: "/tmp/synthetic-config" }),
    ).toBe("/tmp/synthetic-config/agent-nyro-sunat/profiles.json");
    expect(() => createProfile("../../escape", "20000000000", "environment")).toThrow(
      ValidationError,
    );
  });

  it("rechaza perfiles que intentan habilitar capacidades de escritura", async () => {
    const directory = await createTemporaryDirectory();
    const path = join(directory, "profiles.json");
    await writeFile(
      path,
      JSON.stringify({
        version: 1,
        profiles: {
          demo: {
            queryingRuc: "20000000000",
            credentialSource: "environment",
            capability: "cpe-emission",
          },
        },
      }),
      { mode: 0o600 },
    );

    await expect(new JsonProfileRepository(path).load("demo")).rejects.toBeInstanceOf(
      AuthorizationError,
    );
  });
});

async function createTemporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "agent-nyro-sunat-test-"));
  temporaryDirectories.push(directory);
  return directory;
}
