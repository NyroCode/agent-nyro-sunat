import { describe, expect, it, vi } from "vitest";
import { ContractDriftError, createRequestId } from "../../core/src/index.js";
import {
  SunatOAuthTokenProvider,
  type Clock,
  type HttpRequest,
  type HttpResponse,
  type HttpTransport,
} from "../src/index.js";

class QueueHttpTransport implements HttpTransport {
  public readonly requests: HttpRequest[] = [];
  readonly #responses: HttpResponse[];

  public constructor(responses: HttpResponse[]) {
    this.#responses = [...responses];
  }

  public async send(request: HttpRequest): Promise<HttpResponse> {
    this.requests.push(request);
    const response = this.#responses.shift();
    if (response === undefined) {
      throw new Error("No synthetic HTTP response configured.");
    }

    return response;
  }
}

const fixedClock: Clock = {
  nowEpochMs: () => Date.parse("2026-08-08T12:00:00.000Z"),
};

describe("SUNAT OAuth", () => {
  it("solicita y reutiliza un token sin colocar el secreto en la URL", async () => {
    const http = new QueueHttpTransport([
      jsonResponse(200, {
        access_token: "synthetic-access-token",
        token_type: "Bearer",
        expires_in: 3_600,
      }),
    ]);
    const load = vi.fn().mockResolvedValue({
      clientId: "synthetic-client-id",
      clientSecret: "synthetic-client-secret",
    });
    const provider = new SunatOAuthTokenProvider({ load }, http, fixedClock);
    const context = { requestId: createRequestId("oauth-test-1") };

    await expect(provider.getToken(context)).resolves.toBe("synthetic-access-token");
    await expect(provider.getToken(context)).resolves.toBe("synthetic-access-token");

    expect(load).toHaveBeenCalledTimes(1);
    expect(http.requests).toHaveLength(1);
    const request = http.requests[0];
    expect(request?.url.toString()).toBe(
      "https://api-seguridad.sunat.gob.pe/v1/clientesextranet/synthetic-client-id/oauth2/token/",
    );
    expect(request?.url.toString()).not.toContain("synthetic-client-secret");
    expect(JSON.stringify(request?.headers)).not.toContain("synthetic-client-secret");

    const form = new URLSearchParams(request?.body);
    expect(form.get("grant_type")).toBe("client_credentials");
    expect(form.get("scope")).toBe("https://api.sunat.gob.pe/v1/contribuyente/contribuyentes");
    expect(form.get("client_id")).toBe("synthetic-client-id");
    expect(form.get("client_secret")).toBe("synthetic-client-secret");
  });

  it("acepta el token_type JWT devuelto por SUNAT", async () => {
    const http = new QueueHttpTransport([
      jsonResponse(200, {
        access_token: "synthetic-jwt-token",
        token_type: "JWT",
        expires_in: 3_600,
      }),
    ]);
    const provider = new SunatOAuthTokenProvider(
      {
        load: async () => ({
          clientId: "synthetic-client-id",
          clientSecret: "synthetic-client-secret",
        }),
      },
      http,
      fixedClock,
    );

    await expect(provider.getToken({ requestId: createRequestId("oauth-test-jwt") })).resolves.toBe(
      "synthetic-jwt-token",
    );
  });

  it("renueva el token treinta segundos antes de expires_in", async () => {
    let nowEpochMs = Date.parse("2026-08-08T12:00:00.000Z");
    const clock: Clock = { nowEpochMs: () => nowEpochMs };
    const http = new QueueHttpTransport([
      jsonResponse(200, {
        access_token: "synthetic-access-token-1",
        token_type: "JWT",
        expires_in: 120,
      }),
      jsonResponse(200, {
        access_token: "synthetic-access-token-2",
        token_type: "JWT",
        expires_in: 120,
      }),
    ]);
    const load = vi.fn().mockResolvedValue({
      clientId: "synthetic-client-id",
      clientSecret: "synthetic-client-secret",
    });
    const provider = new SunatOAuthTokenProvider({ load }, http, clock);
    const context = { requestId: createRequestId("oauth-test-refresh") };

    await expect(provider.getToken(context)).resolves.toBe("synthetic-access-token-1");
    nowEpochMs += 89_000;
    await expect(provider.getToken(context)).resolves.toBe("synthetic-access-token-1");
    nowEpochMs += 1_000;
    await expect(provider.getToken(context)).resolves.toBe("synthetic-access-token-2");

    expect(load).toHaveBeenCalledTimes(2);
    expect(http.requests).toHaveLength(2);
  });

  it("rechaza una respuesta de token malformada sin copiarla al error", async () => {
    const http = new QueueHttpTransport([
      jsonResponse(200, {
        access_token: "synthetic-access-token",
        token_type: "unexpected",
        expires_in: 3_600,
        sensitive_debug: "must-not-leak",
      }),
    ]);
    const provider = new SunatOAuthTokenProvider(
      {
        load: async () => ({
          clientId: "synthetic-client-id",
          clientSecret: "synthetic-client-secret",
        }),
      },
      http,
      fixedClock,
    );

    const failure = provider.getToken({ requestId: createRequestId("oauth-test-2") });

    await expect(failure).rejects.toBeInstanceOf(ContractDriftError);
    await expect(failure).rejects.not.toThrow(/must-not-leak/u);
  });
});

function jsonResponse(status: number, body: unknown): HttpResponse {
  return {
    status,
    headers: {},
    body: JSON.stringify(body),
  };
}
