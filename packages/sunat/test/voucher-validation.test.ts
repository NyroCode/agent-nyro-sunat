import { describe, expect, it, vi } from "vitest";
import {
  AuthenticationError,
  ContractDriftError,
  createCurrencyCode,
  createDecimal,
  createLocalDate,
  createRequestId,
  createRuc,
  type QueryContext,
  type VoucherReference,
} from "../../core/src/index.js";
import {
  SunatEndpointPolicy,
  SunatVoucherValidationAdapter,
  type Clock,
  type HttpRequest,
  type HttpResponse,
  type HttpTransport,
} from "../src/index.js";
import cpeFixtures from "./fixtures/cpe-validation-responses.json" with { type: "json" };

class CapturingHttpTransport implements HttpTransport {
  public readonly requests: HttpRequest[] = [];
  readonly #response: HttpResponse;

  public constructor(response: HttpResponse) {
    this.#response = response;
  }

  public async send(request: HttpRequest): Promise<HttpResponse> {
    this.requests.push(request);
    return this.#response;
  }
}

const fixedClock: Clock = {
  nowEpochMs: () => Date.parse("2026-08-08T12:00:00.000Z"),
};

const context: QueryContext = { requestId: createRequestId("cpe-adapter-test-1") };

const voucher: VoucherReference = {
  issuerRuc: createRuc("20000000000"),
  documentType: "01",
  series: "F001",
  number: "00000123",
  issueDate: createLocalDate("2026-08-08"),
  total: createDecimal("118.00"),
  currency: createCurrencyCode("PEN"),
};

describe("adaptador de validación CPE", () => {
  it("invoca el endpoint oficial y normaliza una respuesta aceptada", async () => {
    const http = new CapturingHttpTransport(jsonResponse(200, cpeFixtures.accepted));
    const tokenProvider = syntheticTokenProvider();
    const adapter = new SunatVoucherValidationAdapter({
      queryingRuc: createRuc("20000000002"),
      tokenProvider,
      http,
      clock: fixedClock,
    });

    const result = await adapter.validate(voucher, context);

    expect(result).toEqual({
      data: { status: "valid", externalCode: "1" },
      provenance: {
        source: "sunat-cpe-integrated-query",
        fetchedAt: "2026-08-08T12:00:00.000Z",
        isOfficial: true,
      },
      warnings: [],
    });
    expect(http.requests).toHaveLength(1);
    const request = http.requests[0];
    expect(request?.url.toString()).toBe(
      "https://api.sunat.gob.pe/v1/contribuyente/contribuyentes/20000000002/validarcomprobante",
    );
    expect(request?.headers.authorization).toBe("Bearer synthetic-access-token");
    expect(request?.body).toBe(
      '{"numRuc":"20000000000","codComp":"01","numeroSerie":"F001","numero":123,"fechaEmision":"08/08/2026","monto":118}',
    );
  });

  it.each([
    [cpeFixtures.notFound, { status: "not_found" }],
    [cpeFixtures.annulled, { status: "invalid", externalCode: "2", reason: "annulled" }],
    ["3", { status: "valid", externalCode: "3" }],
    ["4", { status: "invalid", externalCode: "4", reason: "not_authorized" }],
  ])("normaliza una respuesta contractual", async (fixture, expected) => {
    const payload =
      typeof fixture === "string"
        ? {
            success: true,
            data: {
              estadoCp: fixture,
              estadoRuc: "00",
              condDomiRuc: "00",
              observaciones: [],
            },
          }
        : fixture;
    const adapter = adapterFor(payload);

    await expect(adapter.validate(voucher, context)).resolves.toMatchObject({ data: expected });
  });

  it("advierte cuando el fixture contractual indica RUC no habido", async () => {
    const adapter = adapterFor(cpeFixtures.notHabido);

    const result = await adapter.validate(voucher, context);

    expect(result.warnings).toEqual([
      {
        code: "SUNAT_TAXPAYER_CONDITION_12",
        message: "El emisor no figura como habido en la respuesta de SUNAT.",
      },
    ]);
  });

  it("convierte estado RUC, condición y observaciones en warnings", async () => {
    const adapter = adapterFor({
      success: true,
      data: {
        estadoCp: "1",
        estadoRuc: "03",
        condDomiRuc: "12",
        observaciones: ["INSTRUCCIÓN EXTERNA SINTÉTICA QUE NO DEBE PROPAGARSE"],
      },
    });

    const result = await adapter.validate(voucher, context);

    expect(result.warnings.map((warning) => warning.code)).toEqual([
      "SUNAT_TAXPAYER_STATUS_03",
      "SUNAT_TAXPAYER_CONDITION_12",
      "SUNAT_OBSERVATION_1",
    ]);
    expect(JSON.stringify(result.warnings)).not.toContain("INSTRUCCIÓN EXTERNA");
  });

  it("rechaza códigos desconocidos en lugar de adivinar su significado", async () => {
    const adapter = adapterFor({
      success: true,
      data: {
        estadoCp: "99",
        estadoRuc: "00",
        condDomiRuc: "00",
        observaciones: [],
      },
    });

    await expect(adapter.validate(voucher, context)).rejects.toBeInstanceOf(ContractDriftError);
  });

  it("invalida el token si SUNAT responde 401", async () => {
    const http = new CapturingHttpTransport(jsonResponse(401, { message: "unauthorized" }));
    const tokenProvider = syntheticTokenProvider();
    const adapter = new SunatVoucherValidationAdapter({
      queryingRuc: createRuc("20000000002"),
      tokenProvider,
      http,
      clock: fixedClock,
    });

    await expect(adapter.validate(voucher, context)).rejects.toBeInstanceOf(AuthenticationError);
    expect(tokenProvider.invalidate).toHaveBeenCalledOnce();
  });

  it("rechaza un token con caracteres de control antes de enviarlo", async () => {
    const http = new CapturingHttpTransport(jsonResponse(200, {}));
    const tokenProvider = syntheticTokenProvider();
    tokenProvider.getToken.mockResolvedValue("synthetic\nforged");
    const adapter = new SunatVoucherValidationAdapter({
      queryingRuc: createRuc("20000000002"),
      tokenProvider,
      http,
      clock: fixedClock,
    });

    await expect(adapter.validate(voucher, context)).rejects.toBeInstanceOf(AuthenticationError);
    expect(http.requests).toHaveLength(0);
    expect(tokenProvider.invalidate).toHaveBeenCalledOnce();
  });
});

describe("allowlist SUNAT", () => {
  it("permite únicamente los endpoints oficiales previstos", () => {
    const policy = new SunatEndpointPolicy();

    expect(() =>
      policy.assertAllowed(
        new URL(
          "https://api.sunat.gob.pe/v1/contribuyente/contribuyentes/20000000002/validarcomprobante",
        ),
      ),
    ).not.toThrow();
    expect(() =>
      policy.assertAllowed(new URL("https://example.invalid/v1/contribuyente/validarcomprobante")),
    ).toThrow();
  });

  it.each([
    "https://e-factura.sunat.gob.pe/ol-ti-itcpfegem/billService",
    "https://e-beta.sunat.gob.pe/ol-ti-itcpfegem-beta/billService",
    "https://api.sunat.gob.pe/v1/contribuyente/contribuyentes/20000000002/emitir",
  ])("bloquea rutas de emisión o escritura: %s", (endpoint) => {
    const policy = new SunatEndpointPolicy();

    expect(() => policy.assertAllowed(new URL(endpoint))).toThrow();
  });
});

function adapterFor(payload: unknown): SunatVoucherValidationAdapter {
  return new SunatVoucherValidationAdapter({
    queryingRuc: createRuc("20000000002"),
    tokenProvider: syntheticTokenProvider(),
    http: new CapturingHttpTransport(jsonResponse(200, payload)),
    clock: fixedClock,
  });
}

function syntheticTokenProvider() {
  return {
    getToken: vi.fn().mockResolvedValue("synthetic-access-token"),
    invalidate: vi.fn(),
  };
}

function jsonResponse(status: number, body: unknown): HttpResponse {
  return {
    status,
    headers: {},
    body: JSON.stringify(body),
  };
}
