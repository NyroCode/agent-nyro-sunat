import type {
  ExchangeRateData,
  ProviderResult,
  QueryContext,
  QueryResult,
  RegistryLookupData,
  TaxpayerLookupData,
  VoucherValidationData,
} from "./contracts.js";
import { ValidationError } from "./errors.js";
import type {
  ExchangeRatePort,
  RegistryPort,
  TaxpayerLookupPort,
  VoucherValidationPort,
} from "./ports.js";
import {
  createCurrencyCode,
  createDecimal,
  createLocalDate,
  createRequestId,
  createRuc,
  type RequestId,
} from "./value-objects.js";

export interface LookupTaxpayerCommand {
  readonly requestId: string;
  readonly ruc: string;
}

export interface ValidateVoucherCommand {
  readonly requestId: string;
  readonly issuerRuc: string;
  readonly documentType: string;
  readonly series: string;
  readonly number: string;
  readonly issueDate: string;
  readonly total: string;
  readonly currency: string;
}

export interface LookupRegistryCommand {
  readonly requestId: string;
  readonly registry: string;
  readonly ruc: string;
}

export interface GetExchangeRateCommand {
  readonly requestId: string;
  readonly date: string;
  readonly currency: string;
}

export class LookupTaxpayerUseCase {
  readonly #port: TaxpayerLookupPort;

  public constructor(port: TaxpayerLookupPort) {
    this.#port = port;
  }

  public async execute(command: LookupTaxpayerCommand): Promise<QueryResult<TaxpayerLookupData>> {
    const context = createQueryContext(command.requestId);
    const providerResult = await this.#port.lookup({ ruc: createRuc(command.ruc) }, context);

    return completeQuery(context.requestId, providerResult);
  }
}

export class ValidateVoucherUseCase {
  readonly #port: VoucherValidationPort;

  public constructor(port: VoucherValidationPort) {
    this.#port = port;
  }

  public async execute(
    command: ValidateVoucherCommand,
  ): Promise<QueryResult<VoucherValidationData>> {
    const context = createQueryContext(command.requestId);
    const total = createDecimal(command.total);

    if (total.startsWith("-")) {
      throw new ValidationError("El total del comprobante no puede ser negativo.", "total");
    }

    const providerResult = await this.#port.validate(
      {
        issuerRuc: createRuc(command.issuerRuc),
        documentType: validateAlphaNumeric(command.documentType, "document_type", 2),
        series: validateAlphaNumeric(command.series, "series", 4),
        number: validateDigits(command.number, "number", 8),
        issueDate: createLocalDate(command.issueDate),
        total,
        currency: createCurrencyCode(command.currency),
      },
      context,
    );

    return completeQuery(context.requestId, providerResult);
  }
}

export class LookupRegistryUseCase {
  readonly #port: RegistryPort;

  public constructor(port: RegistryPort) {
    this.#port = port;
  }

  public async execute(command: LookupRegistryCommand): Promise<QueryResult<RegistryLookupData>> {
    const context = createQueryContext(command.requestId);
    const registry = validateToken(command.registry, "registry", 64);
    const providerResult = await this.#port.lookup(
      { registry, ruc: createRuc(command.ruc) },
      context,
    );

    return completeQuery(context.requestId, providerResult);
  }
}

export class GetExchangeRateUseCase {
  readonly #port: ExchangeRatePort;

  public constructor(port: ExchangeRatePort) {
    this.#port = port;
  }

  public async execute(command: GetExchangeRateCommand): Promise<QueryResult<ExchangeRateData>> {
    const context = createQueryContext(command.requestId);
    const providerResult = await this.#port.getRate(
      {
        date: createLocalDate(command.date),
        currency: createCurrencyCode(command.currency),
      },
      context,
    );

    return completeQuery(context.requestId, providerResult);
  }
}

function createQueryContext(requestId: string): QueryContext {
  return Object.freeze({ requestId: createRequestId(requestId) });
}

function completeQuery<T>(requestId: RequestId, result: ProviderResult<T>): QueryResult<T> {
  return Object.freeze({
    data: result.data,
    provenance: result.provenance,
    requestId,
    warnings: Object.freeze([...result.warnings]),
  });
}

function validateToken(value: string, field: string, maximumLength: number): string {
  if (
    value.length === 0 ||
    value.length > maximumLength ||
    value.trim() !== value ||
    containsControlCharacter(value)
  ) {
    throw new ValidationError(
      `El campo ${field} debe tener entre 1 y ${maximumLength} caracteres seguros.`,
      field,
    );
  }

  return value;
}

function validateAlphaNumeric(value: string, field: string, maximumLength: number): string {
  const token = validateToken(value, field, maximumLength);
  if (!/^[A-Z0-9-]+$/u.test(token)) {
    throw new ValidationError(`El campo ${field} solo admite letras, números y guion.`, field);
  }

  return token;
}

function validateDigits(value: string, field: string, maximumLength: number): string {
  const token = validateToken(value, field, maximumLength);
  if (!/^\d+$/u.test(token)) {
    throw new ValidationError(`El campo ${field} solo admite dígitos.`, field);
  }

  return token;
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
