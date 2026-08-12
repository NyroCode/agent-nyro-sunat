import { Ajv2020 } from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";
import {
  consultarPadronInputSchema,
  consultarPadronOutputSchema,
  consultarRucInputSchema,
  consultarRucOutputSchema,
  tipoCambioInputSchema,
  tipoCambioOutputSchema,
  toPublicQueryResult,
  validarComprobanteInputSchema,
  validarComprobanteOutputSchema,
} from "../src/index.js";
import {
  createIsoInstant,
  createRequestId,
  createRuc,
  type QueryResult,
  type TaxpayerLookupData,
} from "../../core/src/index.js";

const ajv = new Ajv2020({ allErrors: true, strict: true });

describe("contratos públicos MCP", () => {
  it("compila los inputSchema y outputSchema con JSON Schema 2020-12", () => {
    for (const schema of [
      consultarRucInputSchema,
      consultarRucOutputSchema,
      validarComprobanteInputSchema,
      validarComprobanteOutputSchema,
      consultarPadronInputSchema,
      consultarPadronOutputSchema,
      tipoCambioInputSchema,
      tipoCambioOutputSchema,
    ]) {
      expect(() => ajv.compile(schema)).not.toThrow();
    }
  });

  it("convierte el resultado interno al envelope público versionado", () => {
    const internal: QueryResult<TaxpayerLookupData> = {
      data: {
        found: true,
        taxpayer: {
          ruc: createRuc("20000000000"),
          legalName: "EMPRESA SINTETICA SAC",
          status: "active",
          condition: "habido",
        },
      },
      provenance: {
        source: "synthetic-ruc",
        fetchedAt: createIsoInstant("2026-08-11T20:00:00.000Z"),
        isOfficial: false,
      },
      warnings: [],
      requestId: createRequestId("public-contract-test"),
    };
    const publicResult = toPublicQueryResult(internal);
    const validate = ajv.compile(consultarRucOutputSchema);

    expect(publicResult.schemaVersion).toBe("1");
    expect(validate(publicResult), JSON.stringify(validate.errors)).toBe(true);
  });

  it("rechaza casing alternativo y propiedades no declaradas", () => {
    const validate = ajv.compile(consultarRucOutputSchema);

    expect(
      validate({
        schema_version: "1",
        data: { found: false },
        provenance: {
          source: "synthetic-ruc",
          fetched_at: "2026-08-11T20:00:00.000Z",
          is_official: false,
        },
        warnings: [],
        request_id: "public-contract-test",
      }),
    ).toBe(false);
  });
});
