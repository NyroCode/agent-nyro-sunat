import { ProviderUnavailableError, RateLimitError } from "./errors.js";
import type { TaxpayerLookupPort } from "./ports.js";
import type {
  ProviderResult,
  QueryContext,
  TaxpayerLookupData,
  TaxpayerLookupInput,
} from "./contracts.js";

export type TaxpayerFallbackPolicy = (error: unknown, providerIndex: number) => boolean;

export interface TaxpayerLookupFallbackOptions {
  readonly shouldFallback?: TaxpayerFallbackPolicy;
}

export class FallbackTaxpayerLookup implements TaxpayerLookupPort {
  readonly #providers: readonly TaxpayerLookupPort[];
  readonly #shouldFallback: TaxpayerFallbackPolicy;

  public constructor(
    providers: readonly TaxpayerLookupPort[],
    options: TaxpayerLookupFallbackOptions = {},
  ) {
    if (providers.length === 0) {
      throw new TypeError("Taxpayer fallback requires at least one provider.");
    }

    this.#providers = Object.freeze([...providers]);
    this.#shouldFallback = options.shouldFallback ?? isTransientProviderFailure;
  }

  public async lookup(
    input: TaxpayerLookupInput,
    context: QueryContext,
  ): Promise<ProviderResult<TaxpayerLookupData>> {
    for (let index = 0; index < this.#providers.length; index += 1) {
      const provider = this.#providers[index];
      if (provider === undefined) {
        throw new TypeError("Taxpayer fallback provider is missing.");
      }

      try {
        return await provider.lookup(input, context);
      } catch (error: unknown) {
        const isLastProvider = index === this.#providers.length - 1;
        if (isLastProvider || !this.#shouldFallback(error, index)) {
          throw error;
        }
      }
    }

    throw new TypeError("Taxpayer fallback exhausted without a result.");
  }
}

function isTransientProviderFailure(error: unknown): boolean {
  return error instanceof ProviderUnavailableError || error instanceof RateLimitError;
}
