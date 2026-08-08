import { describe, expect, it, vi } from "vitest";
import {
  AuthenticationError,
  FallbackTaxpayerLookup,
  ProviderUnavailableError,
  RateLimitError,
  createRequestId,
  createRuc,
} from "../src/index.js";
import { createSyntheticProvenance, stubTaxpayerLookup } from "../../testing/src/index.js";

const input = { ruc: createRuc("20000000000") };
const context = { requestId: createRequestId("taxpayer-fallback-test") };

describe("fallback de consulta RUC", () => {
  it.each([
    new ProviderUnavailableError("synthetic-primary"),
    new RateLimitError("synthetic-primary"),
  ])("usa el siguiente proveedor ante una falla transitoria", async (failure) => {
    const primary = vi.fn(async () => {
      throw failure;
    });
    const fallback = vi.fn(async () => syntheticFoundResult("synthetic-fallback"));
    const chain = new FallbackTaxpayerLookup([
      stubTaxpayerLookup(primary),
      stubTaxpayerLookup(fallback),
    ]);

    const result = await chain.lookup(input, context);

    expect(result.provenance.source).toBe("synthetic-fallback");
    expect(primary).toHaveBeenCalledOnce();
    expect(fallback).toHaveBeenCalledOnce();
  });

  it("no oculta errores no transitorios con el fallback predeterminado", async () => {
    const authenticationError = new AuthenticationError();
    const fallback = vi.fn(async () => syntheticFoundResult("must-not-run"));
    const chain = new FallbackTaxpayerLookup([
      stubTaxpayerLookup(async () => {
        throw authenticationError;
      }),
      stubTaxpayerLookup(fallback),
    ]);

    await expect(chain.lookup(input, context)).rejects.toBe(authenticationError);
    expect(fallback).not.toHaveBeenCalled();
  });

  it("permite configurar explícitamente la política de fallback", async () => {
    const shouldFallback = vi.fn(() => true);
    const chain = new FallbackTaxpayerLookup(
      [
        stubTaxpayerLookup(async () => {
          throw new AuthenticationError();
        }),
        stubTaxpayerLookup(async () => syntheticFoundResult("configured-fallback")),
      ],
      { shouldFallback },
    );

    const result = await chain.lookup(input, context);

    expect(result.provenance.source).toBe("configured-fallback");
    expect(shouldFallback).toHaveBeenCalledWith(expect.any(AuthenticationError), 0);
  });

  it("acepta no encontrado como resultado concluyente y conserva su procedencia", async () => {
    const fallback = vi.fn(async () => syntheticFoundResult("must-not-run"));
    const chain = new FallbackTaxpayerLookup([
      stubTaxpayerLookup(async () => ({
        data: { found: false },
        provenance: createSyntheticProvenance("synthetic-primary"),
        warnings: [],
      })),
      stubTaxpayerLookup(fallback),
    ]);

    const result = await chain.lookup(input, context);

    expect(result.data).toEqual({ found: false });
    expect(result.provenance.source).toBe("synthetic-primary");
    expect(fallback).not.toHaveBeenCalled();
  });

  it("rechaza una cadena vacía durante la configuración", () => {
    expect(() => new FallbackTaxpayerLookup([])).toThrow(TypeError);
  });
});

function syntheticFoundResult(source: string) {
  return {
    data: {
      found: true as const,
      taxpayer: {
        ruc: input.ruc,
        legalName: "EMPRESA SINTETICA FALLBACK SAC",
        status: "active" as const,
        condition: "habido" as const,
      },
    },
    provenance: createSyntheticProvenance(source),
    warnings: [],
  };
}
