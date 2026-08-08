import {
  AuthorizationError,
  ContractDriftError,
  DomainError,
  ProviderUnavailableError,
  type RequestId,
} from "@nyro-sunat/core";

const SECURITY_ORIGIN = "https://api-seguridad.sunat.gob.pe";
const API_ORIGIN = "https://api.sunat.gob.pe";
const TOKEN_PATH_PATTERN = /^\/v1\/clientesextranet\/[A-Za-z0-9._~-]+\/oauth2\/token\/$/u;
const VALIDATION_PATH_PATTERN =
  /^\/v1\/contribuyente\/contribuyentes\/\d{11}\/validarcomprobante$/u;

export interface HttpRequest {
  readonly method: "POST";
  readonly url: URL;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string;
  readonly requestId: RequestId;
  readonly timeoutMs: number;
  readonly maxResponseBytes: number;
}

export interface HttpResponse {
  readonly status: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string;
}

export interface HttpTransport {
  send(request: HttpRequest): Promise<HttpResponse>;
}

export class SunatEndpointPolicy {
  public assertAllowed(url: URL): void {
    if (
      url.username.length > 0 ||
      url.password.length > 0 ||
      url.search.length > 0 ||
      url.hash.length > 0
    ) {
      throw new AuthorizationError("El endpoint SUNAT contiene componentes no permitidos.");
    }

    const tokenEndpoint = url.origin === SECURITY_ORIGIN && TOKEN_PATH_PATTERN.test(url.pathname);
    const validationEndpoint =
      url.origin === API_ORIGIN && VALIDATION_PATH_PATTERN.test(url.pathname);

    if (!tokenEndpoint && !validationEndpoint) {
      throw new AuthorizationError("El endpoint externo no pertenece a la allowlist de SUNAT.");
    }
  }
}

export class FetchHttpTransport implements HttpTransport {
  readonly #policy: SunatEndpointPolicy;

  public constructor(policy: SunatEndpointPolicy = new SunatEndpointPolicy()) {
    this.#policy = policy;
  }

  public async send(request: HttpRequest): Promise<HttpResponse> {
    this.#policy.assertAllowed(request.url);

    try {
      const response = await fetch(request.url, {
        method: request.method,
        headers: request.headers,
        body: request.body,
        redirect: "error",
        signal: AbortSignal.timeout(request.timeoutMs),
      });
      const declaredLength = response.headers.get("content-length");

      if (
        declaredLength !== null &&
        Number.isFinite(Number(declaredLength)) &&
        Number(declaredLength) > request.maxResponseBytes
      ) {
        throw new ContractDriftError("sunat");
      }

      return {
        status: response.status,
        headers: Object.freeze(Object.fromEntries(response.headers.entries())),
        body: await readBoundedBody(response, request.maxResponseBytes),
      };
    } catch (error: unknown) {
      if (error instanceof DomainError) {
        throw error;
      }

      throw new ProviderUnavailableError("sunat");
    }
  }
}

export const SUNAT_SECURITY_ORIGIN: string = SECURITY_ORIGIN;
export const SUNAT_API_ORIGIN: string = API_ORIGIN;

async function readBoundedBody(response: Response, maximumBytes: number): Promise<string> {
  if (response.body === null) {
    return "";
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const chunk = await reader.read();
    if (chunk.done) {
      break;
    }

    totalBytes += chunk.value.byteLength;
    if (totalBytes > maximumBytes) {
      await reader.cancel();
      throw new ContractDriftError("sunat");
    }

    chunks.push(chunk.value);
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new TextDecoder("utf-8", { fatal: true }).decode(body);
}
