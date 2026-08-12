export type JsonSchemaDocument = Readonly<Record<string, unknown>>;

const SCHEMA_DIALECT = "https://json-schema.org/draft/2020-12/schema";
const SCHEMA_PREFIX = "urn:nyro:agent-nyro-sunat:schema:v1";
const RUC_PATTERN = "^[0-9]{11}$";
const LOCAL_DATE_PATTERN = "^[0-9]{4}-[0-9]{2}-[0-9]{2}$";
const ISO_INSTANT_PATTERN = "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\\.[0-9]{3}Z$";
const DECIMAL_PATTERN = "^(?:0|[1-9][0-9]*)(?:\\.[0-9]+)?$";

const provenanceSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    source: { type: "string", minLength: 1, maxLength: 128 },
    fetchedAt: { type: "string", pattern: ISO_INSTANT_PATTERN },
    isOfficial: { type: "boolean" },
    datasetVersion: { type: "string", minLength: 1, maxLength: 128 },
    validAt: { type: "string", pattern: LOCAL_DATE_PATTERN },
  },
  required: ["source", "fetchedAt", "isOfficial"],
};

const warningSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    code: { type: "string", pattern: "^[A-Z][A-Z0-9_]{0,127}$" },
    message: { type: "string", minLength: 1, maxLength: 512 },
  },
  required: ["code", "message"],
};

const taxpayerDataSchema = {
  oneOf: [
    {
      type: "object",
      additionalProperties: false,
      properties: { found: { const: false } },
      required: ["found"],
    },
    {
      type: "object",
      additionalProperties: false,
      properties: {
        found: { const: true },
        taxpayer: {
          type: "object",
          additionalProperties: false,
          properties: {
            ruc: { type: "string", pattern: RUC_PATTERN },
            legalName: { type: "string", minLength: 1, maxLength: 512 },
            status: {
              enum: ["active", "suspended", "cancelled", "unknown"],
            },
            condition: {
              enum: ["habido", "no_habido", "pending", "unknown"],
            },
          },
          required: ["ruc", "status", "condition"],
        },
      },
      required: ["found", "taxpayer"],
    },
  ],
};

const voucherDataSchema = {
  oneOf: [
    {
      type: "object",
      additionalProperties: false,
      properties: { status: { const: "not_found" } },
      required: ["status"],
    },
    {
      type: "object",
      additionalProperties: false,
      properties: {
        status: { const: "valid" },
        externalCode: { type: "string", minLength: 1, maxLength: 64 },
      },
      required: ["status"],
    },
    {
      type: "object",
      additionalProperties: false,
      properties: {
        status: { const: "invalid" },
        externalCode: { type: "string", minLength: 1, maxLength: 64 },
        reason: { type: "string", minLength: 1, maxLength: 128 },
      },
      required: ["status"],
    },
  ],
};

const registryDataSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    included: { type: "boolean" },
    registry: { type: "string", minLength: 1, maxLength: 64 },
    datasetVersion: { type: "string", minLength: 1, maxLength: 128 },
  },
  required: ["included", "registry", "datasetVersion"],
};

const exchangeRateDataSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    date: { type: "string", pattern: LOCAL_DATE_PATTERN },
    currency: { type: "string", pattern: "^[A-Z]{3}$" },
    purchase: { type: "string", pattern: DECIMAL_PATTERN },
    sale: { type: "string", pattern: DECIMAL_PATTERN },
  },
  required: ["date", "currency", "purchase", "sale"],
};

function inputSchema(
  name: string,
  properties: Readonly<Record<string, unknown>>,
  required: readonly string[],
): JsonSchemaDocument {
  return Object.freeze({
    $schema: SCHEMA_DIALECT,
    $id: `${SCHEMA_PREFIX}:${name}:input`,
    type: "object",
    additionalProperties: false,
    properties,
    required,
  });
}

function outputSchema(name: string, dataSchema: unknown): JsonSchemaDocument {
  return Object.freeze({
    $schema: SCHEMA_DIALECT,
    $id: `${SCHEMA_PREFIX}:${name}:output`,
    type: "object",
    additionalProperties: false,
    properties: {
      schemaVersion: { const: "1" },
      data: dataSchema,
      provenance: { $ref: "#/$defs/provenance" },
      warnings: {
        type: "array",
        maxItems: 128,
        items: { $ref: "#/$defs/warning" },
      },
      requestId: {
        type: "string",
        pattern: "^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$",
      },
    },
    required: ["schemaVersion", "data", "provenance", "warnings", "requestId"],
    $defs: {
      provenance: provenanceSchema,
      warning: warningSchema,
    },
  });
}

export const consultarRucInputSchema: JsonSchemaDocument = inputSchema(
  "consultar-ruc",
  { ruc: { type: "string", pattern: RUC_PATTERN } },
  ["ruc"],
);

export const consultarRucOutputSchema: JsonSchemaDocument = outputSchema(
  "consultar-ruc",
  taxpayerDataSchema,
);

export const validarComprobanteInputSchema: JsonSchemaDocument = inputSchema(
  "validar-comprobante",
  {
    profileId: { type: "string", pattern: "^[a-z][a-z0-9_-]{0,63}$" },
    issuerRuc: { type: "string", pattern: RUC_PATTERN },
    documentType: { type: "string", pattern: "^[A-Z0-9]{2}$" },
    series: { type: "string", pattern: "^[A-Z0-9-]{1,4}$" },
    number: { type: "string", pattern: "^[0-9]{1,8}$" },
    issueDate: { type: "string", pattern: LOCAL_DATE_PATTERN },
    total: { type: "string", pattern: DECIMAL_PATTERN },
    currency: { type: "string", pattern: "^[A-Z]{3}$" },
  },
  ["profileId", "issuerRuc", "documentType", "series", "number", "issueDate", "total", "currency"],
);

export const validarComprobanteOutputSchema: JsonSchemaDocument = outputSchema(
  "validar-comprobante",
  voucherDataSchema,
);

export const consultarPadronInputSchema: JsonSchemaDocument = inputSchema(
  "consultar-padron",
  {
    registry: { type: "string", minLength: 1, maxLength: 64 },
    ruc: { type: "string", pattern: RUC_PATTERN },
  },
  ["registry", "ruc"],
);

export const consultarPadronOutputSchema: JsonSchemaDocument = outputSchema(
  "consultar-padron",
  registryDataSchema,
);

export const tipoCambioInputSchema: JsonSchemaDocument = inputSchema(
  "tipo-cambio",
  {
    date: { type: "string", pattern: LOCAL_DATE_PATTERN },
    currency: { type: "string", pattern: "^[A-Z]{3}$" },
  },
  ["date", "currency"],
);

export const tipoCambioOutputSchema: JsonSchemaDocument = outputSchema(
  "tipo-cambio",
  exchangeRateDataSchema,
);
