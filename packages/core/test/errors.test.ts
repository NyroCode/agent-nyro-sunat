import { describe, expect, it } from "vitest";
import { AmbiguousSubmissionError, AuthenticationError, RateLimitError } from "../src/index.js";

describe("errores de dominio", () => {
  it("expone códigos estables y detalles controlados", () => {
    const error = new RateLimitError("sunat", "30s");

    expect(error.code).toBe("RATE_LIMIT_ERROR");
    expect(error.details).toEqual({ provider: "sunat", retry_after: "30s" });
  });

  it("no requiere incluir secretos en errores de autenticación", () => {
    const error = new AuthenticationError();

    expect(error.details).toEqual({});
    expect(error.message).not.toMatch(/token|password|clave sol/iu);
  });

  it("obliga a reconciliar operaciones ambiguas", () => {
    const error = new AmbiguousSubmissionError("operation-123");

    expect(error.code).toBe("AMBIGUOUS_SUBMISSION");
    expect(error.message).toContain("reconciliarse");
  });
});
