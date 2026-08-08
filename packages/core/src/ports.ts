import type {
  ExchangeRateData,
  ExchangeRateInput,
  ProviderResult,
  QueryContext,
  RegistryLookupData,
  RegistryLookupInput,
  TaxpayerLookupData,
  TaxpayerLookupInput,
  VoucherReference,
  VoucherValidationData,
} from "./contracts.js";

export interface TaxpayerLookupPort {
  lookup(
    input: TaxpayerLookupInput,
    context: QueryContext,
  ): Promise<ProviderResult<TaxpayerLookupData>>;
}

export interface VoucherValidationPort {
  validate(
    input: VoucherReference,
    context: QueryContext,
  ): Promise<ProviderResult<VoucherValidationData>>;
}

export interface RegistryPort {
  lookup(
    input: RegistryLookupInput,
    context: QueryContext,
  ): Promise<ProviderResult<RegistryLookupData>>;
}

export interface ExchangeRatePort {
  getRate(
    input: ExchangeRateInput,
    context: QueryContext,
  ): Promise<ProviderResult<ExchangeRateData>>;
}
