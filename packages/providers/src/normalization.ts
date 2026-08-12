import type { QueryWarning, TaxpayerCondition, TaxpayerStatus } from "@nyro-sunat/core";

export interface NormalizedTaxpayerState {
  readonly status: TaxpayerStatus;
  readonly condition: TaxpayerCondition;
  readonly warnings: readonly QueryWarning[];
}

export function normalizeTaxpayerState(
  rawStatus: string,
  rawCondition: string,
): NormalizedTaxpayerState {
  const status = normalizeStatus(rawStatus);
  const condition = normalizeCondition(rawCondition);
  const warnings: QueryWarning[] = [];

  if (status === "unknown") {
    warnings.push({
      code: "UNKNOWN_TAXPAYER_STATUS",
      message: "El proveedor devolvió un estado de contribuyente no reconocido.",
    });
  }
  if (condition === "unknown") {
    warnings.push({
      code: "UNKNOWN_TAXPAYER_CONDITION",
      message: "El proveedor devolvió una condición de domicilio no reconocida.",
    });
  }

  return Object.freeze({ status, condition, warnings: Object.freeze(warnings) });
}

function normalizeStatus(value: string): TaxpayerStatus {
  switch (normalizeExternalToken(value)) {
    case "ACTIVO":
      return "active";
    case "SUSPENSION TEMPORAL":
      return "suspended";
    case "BAJA DEFINITIVA":
    case "BAJA DE OFICIO":
    case "BAJA PROVISIONAL":
      return "cancelled";
    default:
      return "unknown";
  }
}

function normalizeCondition(value: string): TaxpayerCondition {
  switch (normalizeExternalToken(value)) {
    case "HABIDO":
      return "habido";
    case "NO HABIDO":
      return "no_habido";
    case "PENDIENTE":
    case "PENDIENTE DE VERIFICACION":
      return "pending";
    default:
      return "unknown";
  }
}

function normalizeExternalToken(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .trim()
    .replace(/\s+/gu, " ")
    .toUpperCase();
}
