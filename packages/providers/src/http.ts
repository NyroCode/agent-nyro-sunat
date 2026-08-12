import {
  AuthenticationError,
  ContractDriftError,
  DomainError,
  ExternalServiceError,
  ProviderUnavailableError,
  RateLimitError,
  type RequestId,
} from "@nyro-sunat/core";

export interface ProviderHttpRequest {
  readonly provider: string;
  readonly method: "GET" | "POST";
  readonly url: URL;
  readonly headers: Readonly<Record<string, string>>;
  readonly body?: string;
  readonly requestId: RequestId;
  readonly timeoutMs: number;
  readonly maxResponseBytes: number;
}

export interface ProviderHttpResponse {
  readonly status: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string;
}

export interface ProviderHttpTransport {
  send(request: ProviderHttpRequest): Promise<ProviderHttpResponse>;
}

export type ProviderEndpointPolicy = (request: ProviderHttpRequest) => void;

export class FetchProviderHttpTransport implements ProviderHttpTransport {
  readonly #policy: ProviderEndpointPolicy;

  public constructor(policy: ProviderEndpointPolicy) {
    this.#policy = policy;
  }

  public async send(request: ProviderHttpRequest): Promise<ProviderHttpResponse> {
    this.#policy(request);

    try {
      const response = await fetch(request.url, {
        method: request.method,
        headers: request.headers,
        ...(request.body === undefined ? {} : { body: request.body }),
        redirect: "error",
        signal: AbortSignal.timeout(request.timeoutMs),
      });
      const declaredLength = response.headers.get("content-length");
      if (
        declaredLength !== null &&
        Number.isFinite(Number(declaredLength)) &&
        Number(declaredLength) > request.maxResponseBytes
      ) {
        throw new ContractDriftError(request.provider);
      }

      return Object.freeze({
        status: response.status,
        headers: Object.freeze(Object.fromEntries(response.headers.entries())),
        body: await readBoundedBody(response, request.maxResponseBytes, request.provider),
      });
    } catch (error: unknown) {
      if (error instanceof DomainError) {
        throw error;
      }
      throw new ProviderUnavailableError(request.provider);
    }
  }
}

export function classifyProviderStatus(provider: string, response: ProviderHttpResponse): void {
  if (response.status === 401 || response.status === 403) {
    throw new AuthenticationError();
  }
  if (response.status === 429) {
    throw new RateLimitError(provider, response.headers["retry-after"]);
  }
  if (response.status >= 500) {
    throw new ProviderUnavailableError(provider);
  }
  if (response.status < 200 || response.status >= 300) {
    throw new ExternalServiceError(provider, String(response.status));
  }
}

async function readBoundedBody(
  response: Response,
  maximumBytes: number,
  provider: string,
): Promise<string> {
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
      throw new ContractDriftError(provider);
    }
    chunks.push(chunk.value);
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(body);
  } catch {
    throw new ContractDriftError(provider);
  }
}
