import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sourceDirectory = fileURLToPath(new URL("../src/", import.meta.url));

describe("pureza del core", () => {
  it("no importa I/O, entorno, red, logging ni SDKs externos", async () => {
    const filenames = (await readdir(sourceDirectory)).filter((filename) =>
      filename.endsWith(".ts"),
    );
    const sources = await Promise.all(
      filenames.map(async (filename) =>
        readFile(new URL(`../src/${filename}`, import.meta.url), "utf8"),
      ),
    );
    const productionSource = sources.join("\n");

    expect(productionSource).not.toMatch(/from\s+["']node:/u);
    expect(productionSource).not.toMatch(/from\s+["']@/u);
    expect(productionSource).not.toMatch(/\bprocess\.env\b/u);
    expect(productionSource).not.toMatch(/\bfetch\s*\(/u);
    expect(productionSource).not.toMatch(/\bconsole\s*\./u);
  });
});
