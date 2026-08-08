import {
  createIsoInstant,
  type ExchangeRateData,
  type ExchangeRateInput,
  type ExchangeRatePort,
  type ProviderResult,
  type Provenance,
  type QueryContext,
  type RegistryLookupData,
  type RegistryLookupInput,
  type RegistryPort,
  type TaxpayerLookupData,
  type TaxpayerLookupInput,
  type TaxpayerLookupPort,
  type VoucherReference,
  type VoucherValidationData,
  type VoucherValidationPort,
} from "@nyro-sunat/core";

export type StubHandler<Input, Output> = (
  input: Input,
  context: QueryContext,
) => ProviderResult<Output> | Promise<ProviderResult<Output>>;

export function createSyntheticProvenance(source = "synthetic-fixture"): Provenance {
  return Object.freeze({
    source,
    fetchedAt: createIsoInstant("2026-01-01T00:00:00.000Z"),
    isOfficial: false,
    datasetVersion: "synthetic-v1",
  });
}

export function stubTaxpayerLookup(
  handler: StubHandler<TaxpayerLookupInput, TaxpayerLookupData>,
): TaxpayerLookupPort {
  return {
    async lookup(input, context): Promise<ProviderResult<TaxpayerLookupData>> {
      return handler(input, context);
    },
  };
}

export function stubVoucherValidation(
  handler: StubHandler<VoucherReference, VoucherValidationData>,
): VoucherValidationPort {
  return {
    async validate(input, context): Promise<ProviderResult<VoucherValidationData>> {
      return handler(input, context);
    },
  };
}

export function stubRegistry(
  handler: StubHandler<RegistryLookupInput, RegistryLookupData>,
): RegistryPort {
  return {
    async lookup(input, context): Promise<ProviderResult<RegistryLookupData>> {
      return handler(input, context);
    },
  };
}

export function stubExchangeRate(
  handler: StubHandler<ExchangeRateInput, ExchangeRateData>,
): ExchangeRatePort {
  return {
    async getRate(input, context): Promise<ProviderResult<ExchangeRateData>> {
      return handler(input, context);
    },
  };
}
