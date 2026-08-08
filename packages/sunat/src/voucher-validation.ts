import {
  AuthenticationError,
  ContractDriftError,
  ExternalServiceError,
  ValidationError,
  createIsoInstant,
  type ProviderResult,
  type QueryContext,
  type QueryWarning,
  type Ruc,
  type VoucherReference,
  type VoucherValidationData,
  type VoucherValidationPort,
} from "@nyro-sunat/core";
import { SUNAT_API_ORIGIN, type HttpResponse, type HttpTransport } from "./http.js";
import {
  SystemClock,
  assertSuccessfulResponse,
  parseObject,
  type Clock,
  type SunatAccessTokenProvider,
} from "./oauth.js";

const PROVIDER = "sunat-cpe-integrated-query";
const AMOUNT_PATTERN: RegExp = /^\d{1,8}(?:\.\d{1,2})?$/u;
const DOCUMENT_TYPE_PATTERN: RegExp = /^[A-Z0-9]{2}$/u;
const SERIES_PATTERN: RegExp = /^[A-Z0-9-]{1,4}$/u;
const NUMBER_PATTERN: RegExp = /^\d{1,8}$/u;

export interface SunatVoucherValidationOptions {
  readonly queryingRuc: Ruc;
  readonly tokenProvider: SunatAccessTokenProvider;
  readonly http: HttpTransport;
  readonly clock?: Clock;
}

export class SunatVoucherValidationAdapter implements VoucherValidationPort {
  readonly #queryingRuc: Ruc;
  readonly #tokenProvider: SunatAccessTokenProvider;
  readonly #http: HttpTransport;
  readonly #clock: Clock;

  public constructor(options: SunatVoucherValidationOptions) {
    this.#queryingRuc = options.queryingRuc;
    this.#tokenProvider = options.tokenProvider;
    this.#http = options.http;
    this.#clock = options.clock ?? new SystemClock();
  }

  public async validate(
    input: VoucherReference,
    context: QueryContext,
  ): Promise<ProviderResult<VoucherValidationData>> {
    validateOfficialInput(input);
    const token = await this.#tokenProvider.getToken(context);
    if (!isSafeBearerToken(token)) {
      this.#tokenProvider.invalidate();
      throw new AuthenticationError("El token configurado para SUNAT no es válido.");
    }
    const response = await this.#http.send({
      method: "POST",
      url: new URL(
        `/v1/contribuyente/contribuyentes/${this.#queryingRuc}/validarcomprobante`,
        SUNAT_API_ORIGIN,
      ),
      headers: {
        accept: "application/json",
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: serializeRequest(input),
      requestId: context.requestId,
      timeoutMs: 15_000,
      maxResponseBytes: 262_144,
    });

    try {
      assertSuccessfulResponse(response, PROVIDER);
    } catch (error: unknown) {
      if (error instanceof AuthenticationError) {
        this.#tokenProvider.invalidate();
      }
      throw error;
    }

    return this.#normalizeResponse(response);
  }

  #normalizeResponse(response: HttpResponse): ProviderResult<VoucherValidationData> {
    const payload = parseObject(response.body, PROVIDER);
    if (typeof payload.success !== "boolean") {
      throw new ContractDriftError(PROVIDER);
    }

    if (!payload.success) {
      const errorCode = typeof payload.errorCode === "string" ? payload.errorCode : "UNKNOWN";
      throw new ExternalServiceError(PROVIDER, errorCode);
    }

    if (typeof payload.data !== "object" || payload.data === null || Array.isArray(payload.data)) {
      throw new ContractDriftError(PROVIDER);
    }

    const data = payload.data as Record<string, unknown>;
    const voucherStatus = readVoucherCode(data.estadoCp);
    const taxpayerStatus = readTwoDigitCode(data.estadoRuc);
    const taxpayerCondition = readTwoDigitCode(data.condDomiRuc);
    const observations = readObservations(data.observaciones ?? data.Observaciones);
    const warnings = buildWarnings(taxpayerStatus, taxpayerCondition, observations);

    return Object.freeze({
      data: normalizeVoucherStatus(voucherStatus),
      provenance: Object.freeze({
        source: PROVIDER,
        fetchedAt: createIsoInstant(new Date(this.#clock.nowEpochMs()).toISOString()),
        isOfficial: true,
      }),
      warnings: Object.freeze(warnings),
    });
  }
}

function validateOfficialInput(input: VoucherReference): void {
  if (!DOCUMENT_TYPE_PATTERN.test(input.documentType)) {
    throw new ValidationError(
      "El tipo de comprobante no cumple el formato SUNAT.",
      "document_type",
    );
  }
  if (!SERIES_PATTERN.test(input.series)) {
    throw new ValidationError("La serie no cumple el formato SUNAT.", "series");
  }
  if (!NUMBER_PATTERN.test(input.number)) {
    throw new ValidationError("El número no cumple el formato SUNAT.", "number");
  }
  if (!AMOUNT_PATTERN.test(input.total)) {
    throw new ValidationError("El monto no cumple el formato admitido por SUNAT.", "total");
  }
}

function isSafeBearerToken(value: string): boolean {
  if (value.length === 0 || value.length > 16_384) {
    return false;
  }

  for (const character of value) {
    const code = character.charCodeAt(0);
    if (code <= 32 || code === 127) {
      return false;
    }
  }

  return true;
}

function serializeRequest(input: VoucherReference): string {
  const [year, month, day] = input.issueDate.split("-");
  const date = `${day}/${month}/${year}`;
  const number = input.number.replace(/^0+(?=\d)/u, "");

  return `{"numRuc":${JSON.stringify(input.issuerRuc)},"codComp":${JSON.stringify(
    input.documentType,
  )},"numeroSerie":${JSON.stringify(input.series)},"numero":${number},"fechaEmision":${JSON.stringify(
    date,
  )},"monto":${input.total}}`;
}

function readVoucherCode(value: unknown): string {
  if (typeof value === "string" && /^\d{1,2}$/u.test(value)) {
    return value;
  }
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= 99) {
    return String(value);
  }

  throw new ContractDriftError(PROVIDER);
}

function readTwoDigitCode(value: unknown): string {
  if (typeof value !== "string" || !/^\d{2}$/u.test(value)) {
    throw new ContractDriftError(PROVIDER);
  }

  return value;
}

function readObservations(value: unknown): readonly string[] {
  if (value === undefined || value === null) {
    return [];
  }
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new ContractDriftError(PROVIDER);
  }

  return value as string[];
}

function normalizeVoucherStatus(code: string): VoucherValidationData {
  switch (code) {
    case "0":
      return { status: "not_found" };
    case "1":
      return { status: "valid", externalCode: code };
    case "2":
      return { status: "invalid", externalCode: code, reason: "annulled" };
    case "3":
      return { status: "valid", externalCode: code };
    case "4":
      return { status: "invalid", externalCode: code, reason: "not_authorized" };
    default:
      throw new ContractDriftError(PROVIDER);
  }
}

function buildWarnings(
  taxpayerStatus: string,
  taxpayerCondition: string,
  observations: readonly string[],
): QueryWarning[] {
  const warnings: QueryWarning[] = [];

  if (taxpayerStatus !== "00") {
    warnings.push({
      code: `SUNAT_TAXPAYER_STATUS_${taxpayerStatus}`,
      message: "El emisor no figura como activo en la respuesta de SUNAT.",
    });
  }
  if (taxpayerCondition !== "00") {
    warnings.push({
      code: `SUNAT_TAXPAYER_CONDITION_${taxpayerCondition}`,
      message: "El emisor no figura como habido en la respuesta de SUNAT.",
    });
  }
  for (let index = 0; index < observations.length; index += 1) {
    warnings.push({
      code: `SUNAT_OBSERVATION_${index + 1}`,
      message: "SUNAT devolvió una observación; revise el detalle en la fuente oficial.",
    });
  }

  return warnings;
}
