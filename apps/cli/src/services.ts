import { randomUUID } from "node:crypto";
import { homedir } from "node:os";
import {
  AuthenticationError,
  ValidateVoucherUseCase,
  createIsoInstant,
  createRequestId,
  type IsoInstant,
  type QueryContext,
  type QueryResult,
  type RequestId,
  type ValidateVoucherCommand,
  type VoucherValidationData,
} from "@nyro-sunat/core";
import {
  EnvironmentSunatCredentialProvider,
  JsonProfileRepository,
  SecretServiceSunatCredentialProvider,
  createProfile,
  defaultProfilePath,
  type CredentialSource,
  type ProfileCapability,
  type SunatProfile,
} from "@nyro-sunat/security";
import {
  FetchHttpTransport,
  SunatOAuthTokenProvider,
  SunatVoucherValidationAdapter,
  type HttpTransport,
  type SunatAccessTokenProvider,
  type SunatCredentialProvider,
} from "@nyro-sunat/sunat";

export type VoucherCommandWithoutRequestId = Omit<ValidateVoucherCommand, "requestId">;

export interface ProfileConfiguration {
  readonly profileId: string;
  readonly queryingRuc: string;
  readonly credentialSource: CredentialSource;
}

export interface CliServices {
  configureProfile(configuration: ProfileConfiguration): Promise<string>;
  verifyProfile(profileId: string): Promise<ProfileVerification>;
  validateVoucher(
    profileId: string,
    command: VoucherCommandWithoutRequestId,
  ): Promise<QueryResult<VoucherValidationData>>;
}

export interface ProfileVerification {
  readonly profileId: string;
  readonly authenticated: true;
  readonly capability: ProfileCapability;
  readonly verifiedAt: IsoInstant;
  readonly requestId: RequestId;
}

export interface LocalCliServicesOptions {
  readonly profilePath?: string;
  readonly environment?: Readonly<Record<string, string | undefined>>;
  readonly platform?: NodeJS.Platform;
  readonly homeDirectory?: string;
}

export class LocalCliServices implements CliServices {
  readonly #profiles: JsonProfileRepository;
  readonly #environment: Readonly<Record<string, string | undefined>>;
  readonly #platform: NodeJS.Platform;

  public constructor(options: LocalCliServicesOptions = {}) {
    this.#environment = options.environment ?? process.env;
    this.#platform = options.platform ?? process.platform;
    const profilePath =
      options.profilePath ??
      defaultProfilePath(options.homeDirectory ?? homedir(), this.#environment);
    this.#profiles = new JsonProfileRepository(profilePath);
  }

  public async configureProfile(configuration: ProfileConfiguration): Promise<string> {
    await this.#profiles.save(
      createProfile(
        configuration.profileId,
        configuration.queryingRuc,
        configuration.credentialSource,
      ),
    );
    return this.#profiles.path;
  }

  public async validateVoucher(
    profileId: string,
    command: VoucherCommandWithoutRequestId,
  ): Promise<QueryResult<VoucherValidationData>> {
    const profile = await this.#profiles.load(profileId);
    const http = new FetchHttpTransport();
    const tokenProvider = this.#createTokenProvider(profile, http);
    const adapter = new SunatVoucherValidationAdapter({
      queryingRuc: profile.queryingRuc,
      tokenProvider,
      http,
    });
    const useCase = new ValidateVoucherUseCase(adapter);

    return useCase.execute({ ...command, requestId: randomUUID() });
  }

  public async verifyProfile(profileId: string): Promise<ProfileVerification> {
    const profile = await this.#profiles.load(profileId);
    const http = new FetchHttpTransport();
    const tokenProvider = this.#createTokenProvider(profile, http);
    const requestId = createRequestId(randomUUID());
    const context: QueryContext = { requestId };

    await tokenProvider.getToken(context);
    tokenProvider.invalidate();

    return Object.freeze({
      profileId: profile.id,
      authenticated: true,
      capability: profile.capability,
      verifiedAt: createIsoInstant(new Date().toISOString()),
      requestId,
    });
  }

  #createTokenProvider(profile: SunatProfile, http: HttpTransport): SunatAccessTokenProvider {
    return new SunatOAuthTokenProvider(this.#createCredentialProvider(profile), http);
  }

  #createCredentialProvider(profile: SunatProfile): SunatCredentialProvider {
    return profile.credentialSource === "environment"
      ? new EnvironmentSunatCredentialProvider(this.#environment)
      : this.#createSecretServiceProvider(profile.id);
  }

  #createSecretServiceProvider(profileId: string): SecretServiceSunatCredentialProvider {
    if (this.#platform !== "linux") {
      throw new AuthenticationError(
        "Secret Service está soportado inicialmente en Linux; use un provider compatible con su sistema.",
      );
    }

    return new SecretServiceSunatCredentialProvider(profileId);
  }
}
