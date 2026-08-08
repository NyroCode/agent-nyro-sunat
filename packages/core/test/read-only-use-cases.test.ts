import { describe, expect, it, vi } from "vitest";
import {
  GetExchangeRateUseCase,
  LookupRegistryUseCase,
  LookupTaxpayerUseCase,
  ValidateVoucherUseCase,
  ValidationError,
  createCurrencyCode,
  createDecimal,
  createLocalDate,
  createRuc,
} from "../src/index.js";
import {
  createSyntheticProvenance,
  stubExchangeRate,
  stubRegistry,
  stubTaxpayerLookup,
  stubVoucherValidation,
} from "../../testing/src/index.js";

describe("casos de uso read-only", () => {
  it("consulta un RUC y añade el request ID fuera del adapter", async () => {
    const handler = vi.fn().mockReturnValue({
      data: {
        found: true,
        taxpayer: {
          ruc: createRuc("20000000000"),
          legalName: "EMPRESA SINTETICA UNO SAC",
          status: "active",
          condition: "habido",
        },
      },
      provenance: createSyntheticProvenance(),
      warnings: [],
    });
    const useCase = new LookupTaxpayerUseCase(stubTaxpayerLookup(handler));

    const result = await useCase.execute({ requestId: "request-ruc-1", ruc: "20000000000" });

    expect(result.requestId).toBe("request-ruc-1");
    expect(result.data.found).toBe(true);
    expect(result.provenance.isOfficial).toBe(false);
    expect(handler).toHaveBeenCalledWith({ ruc: "20000000000" }, { requestId: "request-ruc-1" });
  });

  it("rechaza un RUC inválido antes de llamar al adapter", async () => {
    const handler = vi.fn();
    const useCase = new LookupTaxpayerUseCase(stubTaxpayerLookup(handler));

    await expect(useCase.execute({ requestId: "request-ruc-2", ruc: "123" })).rejects.toThrow(
      ValidationError,
    );
    expect(handler).not.toHaveBeenCalled();
  });

  it("valida un comprobante usando importes exactos", async () => {
    const handler = vi.fn().mockReturnValue({
      data: { status: "valid", externalCode: "SYNTHETIC_OK" },
      provenance: createSyntheticProvenance(),
      warnings: [],
    });
    const useCase = new ValidateVoucherUseCase(stubVoucherValidation(handler));

    const result = await useCase.execute({
      requestId: "request-cpe-1",
      issuerRuc: "20000000000",
      documentType: "01",
      series: "F001",
      number: "1",
      issueDate: "2026-08-08",
      total: "118.00",
      currency: "PEN",
    });

    expect(result.data).toEqual({ status: "valid", externalCode: "SYNTHETIC_OK" });
    expect(handler).toHaveBeenCalledWith(
      {
        issuerRuc: "20000000000",
        documentType: "01",
        series: "F001",
        number: "1",
        issueDate: "2026-08-08",
        total: "118",
        currency: "PEN",
      },
      { requestId: "request-cpe-1" },
    );
  });

  it("impide validar un comprobante con total negativo", async () => {
    const handler = vi.fn();
    const useCase = new ValidateVoucherUseCase(stubVoucherValidation(handler));

    await expect(
      useCase.execute({
        requestId: "request-cpe-2",
        issuerRuc: "20000000000",
        documentType: "01",
        series: "F001",
        number: "2",
        issueDate: "2026-08-08",
        total: "-1",
        currency: "PEN",
      }),
    ).rejects.toThrow(ValidationError);
    expect(handler).not.toHaveBeenCalled();
  });

  it("consulta un padrón sintético", async () => {
    const useCase = new LookupRegistryUseCase(
      stubRegistry((input) => ({
        data: {
          included: input.ruc === "20000000000",
          registry: input.registry,
          datasetVersion: "synthetic-v1",
        },
        provenance: createSyntheticProvenance("synthetic-registry"),
        warnings: [],
      })),
    );

    const result = await useCase.execute({
      requestId: "request-registry-1",
      registry: "sample_registry",
      ruc: "20000000000",
    });

    expect(result.data.included).toBe(true);
    expect(result.provenance.source).toBe("synthetic-registry");
  });

  it("consulta un tipo de cambio sintético sin convertirlo a number", async () => {
    const useCase = new GetExchangeRateUseCase(
      stubExchangeRate((input) => ({
        data: {
          date: input.date,
          currency: input.currency,
          purchase: createDecimal("3.710"),
          sale: createDecimal("3.725"),
        },
        provenance: createSyntheticProvenance("synthetic-exchange-rate"),
        warnings: [],
      })),
    );

    const result = await useCase.execute({
      requestId: "request-rate-1",
      date: "2026-08-08",
      currency: "USD",
    });

    expect(result.data).toEqual({
      date: createLocalDate("2026-08-08"),
      currency: createCurrencyCode("USD"),
      purchase: "3.71",
      sale: "3.725",
    });
  });
});
