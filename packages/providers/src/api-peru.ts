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

const PROVIDER = "apiperu-ruc";
const ENDPOINT = "https://api.apiperu.dev/ruc";

export interface ApiPeruTaxpayerAdapterOptions {
  readonly tokenProvider: ApiTokenProvider;
  readonly http?: ProviderHttpTransport;
  readonly now?: () => IsoInstant;
}

export class ApiPeruTaxpayerAdapter implements TaxpayerLookupPort {
  readonly #tokenProvider: ApiTokenProvider;
  readonly #http: ProviderHttpTransport;
  readonly #now: () => IsoInstant;

  public constructor(options: ApiPeruTaxpayerAdapterOptions) {
    this.#tokenProvider = options.tokenProvider;
    this.#http = options.http ?? new FetchProviderHttpTransport(assertApiPeruEndpoint);
    this.#now = options.now ?? (() => createIsoInstant(new Date().toISOString()));
  }

  public async lookup(
    input: TaxpayerLookupInput,
    context: QueryContext,
  ): Promise<ProviderResult<TaxpayerLookupData>> {
    const token = await this.#tokenProvider.load();
    const response = await this.#http.send({
      provider: PROVIDER,
      method: "POST",
      url: new URL(ENDPOINT),
      headers: Object.freeze({
        accept: "application/json",
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      }),
      body: JSON.stringify({ ruc: input.ruc }),
      requestId: context.requestId,
      timeoutMs: 10_000,
      maxResponseBytes: 1_048_576,
    });

    if (response.status === 404) {
      return providerResult({ found: false }, this.#now(), []);
    }
    classifyProviderStatus(PROVIDER, response);

    const value = parseJsonRecord(response.body);
    if (value.success !== true || !isRecord(value.data)) {
      throw new ContractDriftError(PROVIDER);
    }
    const ruc = requireString(value.data, "ruc");
    const legalName = requireString(value.data, "nombre_o_razon_social");
    const rawStatus = requireString(value.data, "estado");
    const rawCondition = requireString(value.data, "condicion");
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

function assertApiPeruEndpoint(request: ProviderHttpRequest): void {
  if (
    request.method !== "POST" ||
    request.url.href !== ENDPOINT ||
    request.url.username.length > 0 ||
    request.url.password.length > 0
  ) {
    throw new AuthorizationError("El endpoint externo no pertenece a la allowlist de API Perú.");
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
    if (isRecord(value)) {
      return value;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export const APIPERU_RUC_ENDPOINT: string = ENDPOINT;
