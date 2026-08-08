import type {
  CurrencyCode,
  Decimal,
  IsoInstant,
  LocalDate,
  Period,
  RequestId,
  Ruc,
} from "./value-objects.js";

export interface Provenance {
  readonly source: string;
  readonly fetchedAt: IsoInstant;
  readonly isOfficial: boolean;
  readonly datasetVersion?: string;
  readonly validAt?: LocalDate;
}

export interface QueryWarning {
  readonly code: string;
  readonly message: string;
}

export interface ProviderResult<T> {
  readonly data: T;
  readonly provenance: Provenance;
  readonly warnings: readonly QueryWarning[];
}

export interface QueryResult<T> extends ProviderResult<T> {
  readonly requestId: RequestId;
}

export interface QueryContext {
  readonly requestId: RequestId;
}

export type TaxpayerStatus = "active" | "suspended" | "cancelled" | "unknown";
export type TaxpayerCondition = "habido" | "no_habido" | "pending" | "unknown";

export interface TaxpayerRecord {
  readonly ruc: Ruc;
  readonly legalName?: string;
  readonly status: TaxpayerStatus;
  readonly condition: TaxpayerCondition;
}

export interface TaxpayerLookupInput {
  readonly ruc: Ruc;
}

export type TaxpayerLookupData =
  | { readonly found: true; readonly taxpayer: TaxpayerRecord }
  | { readonly found: false };

export interface VoucherReference {
  readonly issuerRuc: Ruc;
  readonly documentType: string;
  readonly series: string;
  readonly number: string;
  readonly issueDate: LocalDate;
  readonly total: Decimal;
  readonly currency: CurrencyCode;
}

export type VoucherValidationData =
  | { readonly status: "valid"; readonly externalCode?: string }
  | { readonly status: "invalid"; readonly externalCode?: string; readonly reason?: string }
  | { readonly status: "not_found" };

export interface RegistryLookupInput {
  readonly registry: string;
  readonly ruc: Ruc;
}

export interface RegistryLookupData {
  readonly included: boolean;
  readonly registry: string;
  readonly datasetVersion: string;
}

export interface ExchangeRateInput {
  readonly date: LocalDate;
  readonly currency: CurrencyCode;
}

export interface ExchangeRateData {
  readonly date: LocalDate;
  readonly currency: CurrencyCode;
  readonly purchase: Decimal;
  readonly sale: Decimal;
}

export interface SirePeriodInput {
  readonly ruc: Ruc;
  readonly period: Period;
}
