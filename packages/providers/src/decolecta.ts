import {
  AuthorizationError,
  ContractDriftError,
  createIsoInstant,
  type IsoInstant,
  type ProviderResult,
  type QueryContext,
  type TaxpayerLookupData,
  type TaxpayerLookupInput,
  type TaxpayerLookupPort,
} from "@nyro-sunat/core";
import type { ApiTokenProvider } from "./api-token.js";
import {
  FetchProviderHttpTransport,
  classifyProviderStatus,
  type ProviderHttpRequest,
  type ProviderHttpTransport,
} from "./http.js";
import { normalizeTaxpayerState } from "./normalization.js";

const PROVIDER = "decolecta-ruc";
const ORIGIN = "https://api.decolecta.com";
const PATH = "/v1/sunat/ruc";

export interface DecolectaTaxpayerAdapterOptions {
  readonly tokenProvider: ApiTokenProvider;
  readonly http?: ProviderHttpTransport;
  readonly now?: () => IsoInstant;
}

export class DecolectaTaxpayerAdapter implements TaxpayerLookupPort {
  readonly #tokenProvider: ApiTokenProvider;
  readonly #http: ProviderHttpTransport;
  readonly #now: () => IsoInstant;

  public constructor(options: DecolectaTaxpayerAdapterOptions) {
    this.#tokenProvider = options.tokenProvider;
    this.#http = options.http ?? new FetchProviderHttpTransport(assertDecolectaEndpoint);
    this.#now = options.now ?? (() => createIsoInstant(new Date().toISOString()));
  }

  public async lookup(
    input: TaxpayerLookupInput,
    context: QueryContext,
  ): Promise<ProviderResult<TaxpayerLookupData>> {
    const token = await this.#tokenProvider.load();
    const url = new URL(PATH, ORIGIN);
    url.searchParams.set("numero", input.ruc);
    const response = await this.#http.send({
      provider: PROVIDER,
      method: "GET",
      url,
      headers: Object.freeze({
        accept: "application/json",
        authorization: `Bearer ${token}`,
      }),
      requestId: context.requestId,
      timeoutMs: 10_000,
      maxResponseBytes: 1_048_576,
    });

    if (response.status === 404) {
      return providerResult({ found: false }, this.#now(), []);
    }
    classifyProviderStatus(PROVIDER, response);

    const value = parseJsonRecord(response.body);
    const ruc = requireString(value, "numero_documento");
    const legalName = requireString(value, "razon_social");
    const rawStatus = requireString(value, "estado");
    const rawCondition = requireString(value, "condicion");
    if (ruc !== input.ruc) {
      throw new ContractDriftError(PROVIDER);
    }

    const normalized = normalizeTaxpayerState(rawStatus, rawCondition);
    return providerResult(
      {
        found: true,
        taxpayer: {
          ruc: input.ruc,
          legalName,
          status: normalized.status,
          condition: normalized.condition,
        },
      },
      this.#now(),
      normalized.warnings,
    );
  }
}

function assertDecolectaEndpoint(request: ProviderHttpRequest): void {
  const parameters = [...request.url.searchParams.keys()];
  if (
    request.method !== "GET" ||
    request.url.origin !== ORIGIN ||
    request.url.pathname !== PATH ||
    request.url.username.length > 0 ||
    request.url.password.length > 0 ||
    request.url.hash.length > 0 ||
    parameters.length !== 1 ||
    parameters[0] !== "numero" ||
    !/^\d{11}$/u.test(request.url.searchParams.get("numero") ?? "")
  ) {
    throw new AuthorizationError("El endpoint externo no pertenece a la allowlist de Decolecta.");
  }
}

function providerResult(
  data: TaxpayerLookupData,
  fetchedAt: IsoInstant,
  warnings: ProviderResult<TaxpayerLookupData>["warnings"],
): ProviderResult<TaxpayerLookupData> {
  return Object.freeze({
    data,
    provenance: Object.freeze({ source: PROVIDER, fetchedAt, isOfficial: false }),
    warnings: Object.freeze([...warnings]),
  });
}

function parseJsonRecord(body: string): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(body);
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
  } catch {
    // Converted to a typed contract error below.
  }
  throw new ContractDriftError(PROVIDER);
}

function requireString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new ContractDriftError(PROVIDER);
  }
  return value;
}

export const DECOLECTA_RUC_ORIGIN: string = ORIGIN;
