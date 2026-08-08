import { ValidationError } from "./errors.js";

declare const rucBrand: unique symbol;
declare const localDateBrand: unique symbol;
declare const periodBrand: unique symbol;
declare const decimalBrand: unique symbol;
declare const instantBrand: unique symbol;
declare const currencyBrand: unique symbol;
declare const requestIdBrand: unique symbol;

export type Ruc = string & { readonly [rucBrand]: "Ruc" };
export type LocalDate = string & { readonly [localDateBrand]: "LocalDate" };
export type Period = string & { readonly [periodBrand]: "Period" };
export type Decimal = string & { readonly [decimalBrand]: "Decimal" };
export type IsoInstant = string & { readonly [instantBrand]: "IsoInstant" };
export type CurrencyCode = string & { readonly [currencyBrand]: "CurrencyCode" };
export type RequestId = string & { readonly [requestIdBrand]: "RequestId" };

const RUC_PATTERN: RegExp = /^\d{11}$/u;
const LOCAL_DATE_PATTERN: RegExp = /^(\d{4})-(\d{2})-(\d{2})$/u;
const PERIOD_PATTERN: RegExp = /^(\d{4})-(\d{2})$/u;
const DECIMAL_PATTERN: RegExp = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/u;
const ISO_INSTANT_PATTERN: RegExp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const CURRENCY_PATTERN: RegExp = /^[A-Z]{3}$/u;
const REQUEST_ID_PATTERN: RegExp = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;

export function createRuc(value: string): Ruc {
  if (!RUC_PATTERN.test(value)) {
    throw new ValidationError("El RUC debe contener exactamente 11 dígitos.", "ruc");
  }

  return value as Ruc;
}

export function createLocalDate(value: string): LocalDate {
  const match: RegExpExecArray | null = LOCAL_DATE_PATTERN.exec(value);
  if (match === null) {
    throw new ValidationError("La fecha debe usar el formato YYYY-MM-DD.", "date");
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const maximumDay = daysInMonth(year, month);

  if (maximumDay === 0 || day < 1 || day > maximumDay) {
    throw new ValidationError("La fecha no existe en el calendario.", "date");
  }

  return value as LocalDate;
}

export function createPeriod(value: string): Period {
  const match: RegExpExecArray | null = PERIOD_PATTERN.exec(value);
  if (match === null) {
    throw new ValidationError("El periodo debe usar el formato YYYY-MM.", "period");
  }

  const month = Number(match[2]);
  if (month < 1 || month > 12) {
    throw new ValidationError("El mes del periodo debe estar entre 01 y 12.", "period");
  }

  return value as Period;
}

export function createDecimal(value: string): Decimal {
  if (!DECIMAL_PATTERN.test(value)) {
    throw new ValidationError(
      "El decimal debe ser una cadena simple, sin exponente ni separadores.",
      "decimal",
    );
  }

  const negative = value.startsWith("-");
  const unsigned = negative ? value.slice(1) : value;
  const [integer = "0", fraction = ""] = unsigned.split(".");
  const normalizedFraction = fraction.replace(/0+$/u, "");
  const isZero = integer === "0" && normalizedFraction.length === 0;
  const sign = negative && !isZero ? "-" : "";
  const normalized = `${sign}${integer}${
    normalizedFraction.length === 0 ? "" : `.${normalizedFraction}`
  }`;

  return normalized as Decimal;
}

export function createIsoInstant(value: string): IsoInstant {
  const timestamp = Date.parse(value);
  if (
    !ISO_INSTANT_PATTERN.test(value) ||
    Number.isNaN(timestamp) ||
    new Date(timestamp).toISOString() !== value
  ) {
    throw new ValidationError(
      "El instante debe ser UTC y usar el formato YYYY-MM-DDTHH:mm:ss.sssZ.",
      "instant",
    );
  }

  return value as IsoInstant;
}

export function createCurrencyCode(value: string): CurrencyCode {
  if (!CURRENCY_PATTERN.test(value)) {
    throw new ValidationError("La moneda debe usar un código ISO de tres letras.", "currency");
  }

  return value as CurrencyCode;
}

export function createRequestId(value: string): RequestId {
  if (!REQUEST_ID_PATTERN.test(value)) {
    throw new ValidationError(
      "El request ID debe ser seguro para logs y tener entre 1 y 128 caracteres.",
      "request_id",
    );
  }

  return value as RequestId;
}

function daysInMonth(year: number, month: number): number {
  if (month < 1 || month > 12) {
    return 0;
  }

  if (month === 2) {
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    return leap ? 29 : 28;
  }

  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}
