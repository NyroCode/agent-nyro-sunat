import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@nyro-sunat/contracts": fileURLToPath(
        new URL("./packages/contracts/src/index.ts", import.meta.url),
      ),
      "@nyro-sunat/core": fileURLToPath(new URL("./packages/core/src/index.ts", import.meta.url)),
      "@nyro-sunat/providers": fileURLToPath(
        new URL("./packages/providers/src/index.ts", import.meta.url),
      ),
      "@nyro-sunat/security": fileURLToPath(
        new URL("./packages/security/src/index.ts", import.meta.url),
      ),
      "@nyro-sunat/sunat": fileURLToPath(new URL("./packages/sunat/src/index.ts", import.meta.url)),
      "@nyro-sunat/testing": fileURLToPath(
        new URL("./packages/testing/src/index.ts", import.meta.url),
      ),
    },
  },
  test: {
    testTimeout: 5_000,
  },
});
