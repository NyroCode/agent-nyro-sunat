import { describe, expect, it } from "vitest";
import {
  ValidationError,
  createCurrencyCode,
  createDecimal,
  createIsoInstant,
  createLocalDate,
  createPeriod,
  createRequestId,
  createRuc,
} from "../src/index.js";

describe("RUC", () => {
  it("acepta exactamente once dígitos sin afirmar que el contribuyente existe", () => {
    expect(createRuc("20123456789")).toBe("20123456789");
  });

  it.each(["2012345678", "201234567890", "20A23456789", " 20123456789"])(
    "rechaza el formato %s",
    (value) => {
      expect(() => createRuc(value)).toThrow(ValidationError);
    },
  );
});

describe("fechas y periodos", () => {
  it("valida fechas reales sin convertirlas a zona horaria", () => {
    expect(createLocalDate("2024-02-29")).toBe("2024-02-29");
    expect(() => createLocalDate("2023-02-29")).toThrow(ValidationError);
    expect(() => createLocalDate("2026-13-01")).toThrow(ValidationError);
  });

  it("valida periodos mensuales", () => {
    expect(createPeriod("2026-08")).toBe("2026-08");
    expect(() => createPeriod("2026-00")).toThrow(ValidationError);
  });
});

describe("decimales", () => {
  it.each([
    ["123.4500", "123.45"],
    ["-0.00", "0"],
    ["0.0010", "0.001"],
    ["42", "42"],
  ])("normaliza %s sin usar number", (input, expected) => {
    expect(createDecimal(input)).toBe(expected);
  });

  it.each(["01.2", "1e3", "+1", "1,20", "NaN", ""])("rechaza %s", (value) => {
    expect(() => createDecimal(value)).toThrow(ValidationError);
  });
});

describe("instantes y monedas", () => {
  it("exige timestamps UTC canónicos", () => {
    expect(createIsoInstant("2026-08-08T12:30:45.000Z")).toBe("2026-08-08T12:30:45.000Z");
    expect(() => createIsoInstant("2026-08-08T12:30:45-05:00")).toThrow(ValidationError);
    expect(() => createIsoInstant("2026-02-30T12:30:45.000Z")).toThrow(ValidationError);
  });

  it("acepta códigos de moneda ISO en mayúsculas", () => {
    expect(createCurrencyCode("PEN")).toBe("PEN");
    expect(() => createCurrencyCode("pen")).toThrow(ValidationError);
  });
});

describe("request ID", () => {
  it("acepta identificadores seguros para trazabilidad", () => {
    expect(createRequestId("request:local-123")).toBe("request:local-123");
  });

  it.each(["", "request con espacios", "request\nforjado"])("rechaza %s", (value) => {
    expect(() => createRequestId(value)).toThrow(ValidationError);
  });
});
