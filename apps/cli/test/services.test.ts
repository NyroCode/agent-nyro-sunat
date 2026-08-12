import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { LocalCliServices } from "../src/services.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("composición local de proveedores RUC", () => {
  it("omite proveedores privados no configurados y llega al padrón local", async () => {
    const homeDirectory = await mkdtemp(join(tmpdir(), "nyro-sunat-services-"));
    temporaryDirectories.push(homeDirectory);
    const services = new LocalCliServices({
      environment: {},
      homeDirectory,
      platform: "linux",
    });

    await expect(
      services.lookupTaxpayer({
        ruc: "20000000000",
        provider: "auto",
        credentialSource: "environment",
      }),
    ).rejects.toMatchObject({
      code: "PROVIDER_UNAVAILABLE",
      details: { provider: "sunat-padron-reducido-ruc" },
    });
  });
});
