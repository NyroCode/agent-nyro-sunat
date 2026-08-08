import {
  AuthenticationError,
  ContractDriftError,
  ExternalServiceError,
  ProviderUnavailableError,
  RateLimitError,
  type QueryContext,
} from "@nyro-sunat/core";
import { SUNAT_SECURITY_ORIGIN, type HttpResponse, type HttpTransport } from "./http.js";

const TOKEN_SCOPE = "https://api.sunat.gob.pe/v1/contribuyente/contribuyentes";
const CLIENT_ID_PATTERN: RegExp = /^[A-Za-z0-9._~-]{1,256}$/u;
const ACCEPTED_TOKEN_TYPES = new Set(["bearer", "jwt"]);

export interface SunatApiCredentials {
  readonly clientId: string;
  readonly clientSecret: string;
}

export interface SunatCredentialProvider {
  load(): Promise<SunatApiCredentials>;
}

export interface SunatAccessTokenProvider {
  getToken(context: QueryContext): Promise<string>;
  invalidate(): void;
}

export interface Clock {
  nowEpochMs(): number;
}

interface CachedToken {
  readonly value: string;
  readonly refreshAtMs: number;
}

export class SystemClock implements Clock {
  public nowEpochMs(): number {
    return Date.now();
  }
}

export class SunatOAuthTokenProvider implements SunatAccessTokenProvider {
  readonly #credentials: SunatCredentialProvider;
  readonly #http: HttpTransport;
  readonly #clock: Clock;
  #cached: CachedToken | undefined;
  #pending: Promise<CachedToken> | undefined;

  public constructor(
    credentials: SunatCredentialProvider,
    http: HttpTransport,
    clock: Clock = new SystemClock(),
  ) {
    this.#credentials = credentials;
    this.#http = http;
    this.#clock = clock;
  }

  public async getToken(context: QueryContext): Promise<string> {
    if (this.#cached !== undefined && this.#clock.nowEpochMs() < this.#cached.refreshAtMs) {
      return this.#cached.value;
    }

    if (this.#pending !== undefined) {
      return (await this.#pending).value;
    }

    const operation = this.#requestToken(context);
    this.#pending = operation;

    try {
      const token = await operation;
      this.#cached = token;
      return token.value;
    } finally {
      this.#pending = undefined;
    }
  }

  public invalidate(): void {
    this.#cached = undefined;
  }

  async #requestToken(context: QueryContext): Promise<CachedToken> {
    const credentials = await this.#credentials.load();
    validateCredentials(credentials);

    const form = new URLSearchParams({
      grant_type: "client_credentials",
      scope: TOKEN_SCOPE,
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
    });
    const response = await this.#http.send({
      method: "POST",
      url: new URL(
        `/v1/clientesextranet/${credentials.clientId}/oauth2/token/`,
        SUNAT_SECURITY_ORIGIN,
      ),
      headers: {
        accept: "application/json",
        "content-type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
      requestId: context.requestId,
      timeoutMs: 10_000,
      maxResponseBytes: 65_536,
    });

    assertSuccessfulResponse(response, "sunat-oauth");
    const payload = parseObject(response.body, "sunat-oauth");
    const accessToken = readNonEmptyString(payload, "access_token", "sunat-oauth");
    const tokenType = readNonEmptyString(payload, "token_type", "sunat-oauth");
    const expiresIn = readPositiveInteger(payload.expires_in, "sunat-oauth");

    if (!ACCEPTED_TOKEN_TYPES.has(tokenType.toLowerCase()) || !isSafeToken(accessToken)) {
      throw new ContractDriftError("sunat-oauth");
    }

    return {
      value: accessToken,
      refreshAtMs: this.#clock.nowEpochMs() + Math.max(0, expiresIn * 1_000 - 30_000),
    };
  }
}

export function assertSuccessfulResponse(response: HttpResponse, provider: string): void {
  if (response.status >= 200 && response.status < 300) {
    return;
  }

  if (response.status === 401 || response.status === 403) {
    throw new AuthenticationError();
  }

  if (response.status === 429) {
    throw new RateLimitError(provider, safeRetryAfter(response.headers["retry-after"]));
  }

  if (response.status >= 500) {
    throw new ProviderUnavailableError(provider);
  }

  throw new ExternalServiceError(provider, `HTTP_${response.status}`);
}

export function parseObject(body: string, provider: string): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(body);
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      throw new ContractDriftError(provider);
    }

    return value as Record<string, unknown>;
  } catch (error: unknown) {
    if (error instanceof ContractDriftError) {
      throw error;
    }

    throw new ContractDriftError(provider);
  }
}

function validateCredentials(credentials: SunatApiCredentials): void {
  if (!CLIENT_ID_PATTERN.test(credentials.clientId) || !isSecretValue(credentials.clientSecret)) {
    throw new AuthenticationError("Las credenciales configuradas para SUNAT no son válidas.");
  }
}

function isSecretValue(value: string): boolean {
  return value.length > 0 && value.length <= 4_096 && !containsControlCharacter(value);
}

function isSafeToken(value: string): boolean {
  return value.length > 0 && value.length <= 16_384 && !containsWhitespaceOrControl(value);
}

function containsControlCharacter(value: string): boolean {
  for (const character of value) {
    const code = character.charCodeAt(0);
    if (code <= 31 || code === 127) {
      return true;
    }
  }

  return false;
}

function containsWhitespaceOrControl(value: string): boolean {
  for (const character of value) {
    const code = character.charCodeAt(0);
    if (code <= 32 || code === 127) {
      return true;
    }
  }

  return false;
}

function readNonEmptyString(
  object: Record<string, unknown>,
  key: string,
  provider: string,
): string {
  const value = object[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new ContractDriftError(provider);
  }

  return value;
}

function readPositiveInteger(value: unknown, provider: string): number {
  const parsed = typeof value === "string" && /^\d+$/u.test(value) ? Number(value) : value;
  if (typeof parsed !== "number" || !Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new ContractDriftError(provider);
  }

  return parsed;
}

function safeRetryAfter(value: string | undefined): string | undefined {
  if (value === undefined || value.length > 128 || containsControlCharacter(value)) {
    return undefined;
  }

  return value;
}
