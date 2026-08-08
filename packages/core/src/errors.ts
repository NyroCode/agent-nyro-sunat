export type DomainErrorCode =
  | "VALIDATION_ERROR"
  | "AUTHENTICATION_ERROR"
  | "AUTHORIZATION_ERROR"
  | "RATE_LIMIT_ERROR"
  | "PROVIDER_UNAVAILABLE"
  | "EXTERNAL_SERVICE_ERROR"
  | "BUSINESS_RULE_REJECTION"
  | "AMBIGUOUS_SUBMISSION"
  | "CONTRACT_DRIFT";

export type ErrorDetails = Readonly<Record<string, string>>;

export abstract class DomainError extends Error {
  public readonly code: DomainErrorCode;
  public readonly details: ErrorDetails;

  protected constructor(code: DomainErrorCode, message: string, details: ErrorDetails = {}) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

export class ValidationError extends DomainError {
  public constructor(message: string, field: string) {
    super("VALIDATION_ERROR", message, { field });
  }
}

export class AuthenticationError extends DomainError {
  public constructor(message = "No se pudo autenticar con el servicio externo.") {
    super("AUTHENTICATION_ERROR", message);
  }
}

export class AuthorizationError extends DomainError {
  public constructor(message = "La operación no está autorizada.") {
    super("AUTHORIZATION_ERROR", message);
  }
}

export class RateLimitError extends DomainError {
  public constructor(provider: string, retryAfter?: string) {
    super("RATE_LIMIT_ERROR", "El proveedor limitó temporalmente las consultas.", {
      provider,
      ...(retryAfter === undefined ? {} : { retry_after: retryAfter }),
    });
  }
}

export class ProviderUnavailableError extends DomainError {
  public constructor(provider: string) {
    super("PROVIDER_UNAVAILABLE", "El proveedor no está disponible temporalmente.", {
      provider,
    });
  }
}

export class ExternalServiceError extends DomainError {
  public constructor(provider: string, externalCode: string) {
    super("EXTERNAL_SERVICE_ERROR", "El servicio externo rechazó la consulta.", {
      provider,
      external_code: externalCode,
    });
  }
}

export class BusinessRuleRejection extends DomainError {
  public constructor(externalCode: string, message: string) {
    super("BUSINESS_RULE_REJECTION", message, { external_code: externalCode });
  }
}

export class AmbiguousSubmissionError extends DomainError {
  public constructor(operationId: string) {
    super(
      "AMBIGUOUS_SUBMISSION",
      "No se conoce el resultado final de la operación; debe reconciliarse antes de reintentar.",
      { operation_id: operationId },
    );
  }
}

export class ContractDriftError extends DomainError {
  public constructor(provider: string) {
    super("CONTRACT_DRIFT", "La respuesta externa no cumple el contrato esperado.", {
      provider,
    });
  }
}
