export { ApiPeruTaxpayerAdapter, APIPERU_RUC_ENDPOINT } from "./api-peru.js";
export type { ApiPeruTaxpayerAdapterOptions } from "./api-peru.js";
export type { ApiTokenProvider } from "./api-token.js";
export { DecolectaTaxpayerAdapter, DECOLECTA_RUC_ORIGIN } from "./decolecta.js";
export type { DecolectaTaxpayerAdapterOptions } from "./decolecta.js";
export {
  FetchProviderHttpTransport,
  classifyProviderStatus,
} from "./http.js";
export type {
  ProviderEndpointPolicy,
  ProviderHttpRequest,
  ProviderHttpResponse,
  ProviderHttpTransport,
} from "./http.js";
export {
  LOCAL_RUC_REGISTRY_PROVIDER,
  LocalRucRegistryAdapter,
  defaultRucRegistryPath,
} from "./local-registry.js";
export type { LocalRucRegistryAdapterOptions } from "./local-registry.js";
export { normalizeTaxpayerState } from "./normalization.js";
export type { NormalizedTaxpayerState } from "./normalization.js";
export {
  RucRegistryImporter,
  RucRegistryUpdater,
  SUNAT_RUC_REGISTRY_ARCHIVE_URL,
  SUNAT_RUC_REGISTRY_SOURCE_PAGE,
} from "./registry-updater.js";
export type {
  RucRegistryImportResult,
  RucRegistryUpdateResult,
  RucRegistryUpdaterOptions,
} from "./registry-updater.js";
