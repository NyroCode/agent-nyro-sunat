import { createIsoInstant, createRequestId, createRuc, type QueryContext } from "@nyro-sunat/core";
import { describe, expect, it } from "vitest";
import {
  ApiPeruTaxpayerAdapter,
  DecolectaTaxpayerAdapter,
  type ProviderHttpRequest,
  type ProviderHttpResponse,
  type ProviderHttpTransport,
} from "../src/index.js";

describe("adaptadores RUC privados", () => {
  it("normaliza la respuesta de API Perú sin marcarla como oficial", async () => {
    const http = new RecordingTransport({
      status: 200,
      headers: {},
      body: JSON.stringify({
        success: true,
        data: {
          ruc: "20000000000",
          nombre_o_razon_social: "EMPRESA SINTETICA SAC",
          estado: "ACTIVO",
          condicion: "HABIDO",
        },
      }),
    });
    const adapter = new ApiPeruTaxpayerAdapter({
      tokenProvider: { load: async () => "synthetic-token" },
      http,
      now: () => createIsoInstant("2026-08-08T12:00:00.000Z"),
    });

    const result = await adapter.lookup({ ruc: createRuc("20000000000") }, context());

    expect(result).toMatchObject({
      data: { found: true, taxpayer: { status: "active", condition: "habido" } },
      provenance: { source: "apiperu-ruc", isOfficial: false },
    });
    expect(http.request?.url.href).toBe("https://api.apiperu.dev/ruc");
    expect(http.request?.body).toBe('{"ruc":"20000000000"}');
    expect(http.request?.headers.authorization).toBe("Bearer synthetic-token");
  });

  it("normaliza la respuesta de Decolecta y limita el RUC a query", async () => {
    const http = new RecordingTransport({
      status: 200,
      headers: {},
      body: JSON.stringify({
        numero_documento: "20000000000",
        razon_social: "EMPRESA SINTETICA SAC",
        estado: "BAJA DE OFICIO",
        condicion: "NO HABIDO",
      }),
    });
    const adapter = new DecolectaTaxpayerAdapter({
      tokenProvider: { load: async () => "synthetic-token" },
      http,
    });

    const result = await adapter.lookup({ ruc: createRuc("20000000000") }, context());

    expect(result.data).toMatchObject({
      found: true,
      taxpayer: { status: "cancelled", condition: "no_habido" },
    });
    expect(http.request?.url.href).toBe(
      "https://api.decolecta.com/v1/sunat/ruc?numero=20000000000",
    );
  });
});

class RecordingTransport implements ProviderHttpTransport {
  public request: ProviderHttpRequest | undefined;
  readonly #response: ProviderHttpResponse;

  public constructor(response: ProviderHttpResponse) {
    this.#response = response;
  }

  public async send(request: ProviderHttpRequest): Promise<ProviderHttpResponse> {
    this.request = request;
    return this.#response;
  }
}

function context(): QueryContext {
  return { requestId: createRequestId("synthetic-provider-test") };
}
