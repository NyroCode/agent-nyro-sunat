import { randomUUID } from "node:crypto";
import { lstat, mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join } from "node:path";
import {
  AuthorizationError,
  ContractDriftError,
  ValidationError,
  createRuc,
  type Ruc,
} from "@nyro-sunat/core";

const PROFILE_ID_PATTERN: RegExp = /^[a-z][a-z0-9_-]{0,63}$/u;
const PROFILE_PROVIDER = "local-profile";

export type CredentialSource = "secret-service" | "environment";
export type ProfileCapability = "cpe-validation-read-only";

export interface SunatProfile {
  readonly id: string;
  readonly queryingRuc: Ruc;
  readonly credentialSource: CredentialSource;
  readonly capability: ProfileCapability;
}

interface StoredProfile {
  readonly queryingRuc: string;
  readonly credentialSource: CredentialSource;
  readonly capability: ProfileCapability;
}

interface ProfileDocument {
  readonly version: 1;
  readonly profiles: Readonly<Record<string, StoredProfile>>;
}

export class JsonProfileRepository {
  readonly #path: string;

  public constructor(path: string) {
    if (!isAbsolute(path)) {
      throw new ValidationError("La ruta de perfiles debe ser absoluta.", "profile_path");
    }
    this.#path = path;
  }

  public get path(): string {
    return this.#path;
  }

  public async load(profileId: string): Promise<SunatProfile> {
    validateProfileId(profileId);
    const document = await this.#readDocument();
    const stored = document.profiles[profileId];

    if (stored === undefined) {
      throw new ValidationError("El perfil SUNAT solicitado no existe.", "profile");
    }

    return Object.freeze({
      id: profileId,
      queryingRuc: createRuc(stored.queryingRuc),
      credentialSource: stored.credentialSource,
      capability: stored.capability,
    });
  }

  public async save(profile: SunatProfile): Promise<void> {
    validateProfileId(profile.id);
    const current = await this.#readDocument();
    const document: ProfileDocument = {
      version: 1,
      profiles: {
        ...current.profiles,
        [profile.id]: {
          queryingRuc: createRuc(profile.queryingRuc),
          credentialSource: validateCredentialSource(profile.credentialSource),
          capability: validateCapability(profile.capability),
        },
      },
    };
    const directory = dirname(this.#path);
    const temporaryPath = join(directory, `.profiles-${randomUUID()}.tmp`);

    await mkdir(directory, { recursive: true, mode: 0o700 });
    try {
      await writeFile(temporaryPath, `${JSON.stringify(document, null, 2)}\n`, {
        encoding: "utf8",
        flag: "wx",
        mode: 0o600,
      });
      await rename(temporaryPath, this.#path);
    } catch (error: unknown) {
      await unlink(temporaryPath).catch(() => undefined);
      throw error;
    }
  }

  async #readDocument(): Promise<ProfileDocument> {
    try {
      const metadata = await lstat(this.#path);
      if (metadata.isSymbolicLink() || !metadata.isFile()) {
        throw new AuthorizationError("El archivo de perfiles no es un archivo regular seguro.");
      }
      const body = await readFile(this.#path, "utf8");
      return parseProfileDocument(body);
    } catch (error: unknown) {
      if (isMissingFile(error)) {
        return { version: 1, profiles: {} };
      }
      throw error;
    }
  }
}

export function defaultProfilePath(
  homeDirectory: string,
  environment: Readonly<Record<string, string | undefined>>,
): string {
  const xdgConfigHome = environment.XDG_CONFIG_HOME;
  const base =
    xdgConfigHome !== undefined && isAbsolute(xdgConfigHome)
      ? xdgConfigHome
      : join(homeDirectory, ".config");

  return join(base, "agent-nyro-sunat", "profiles.json");
}

export function createProfile(
  id: string,
  queryingRuc: string,
  credentialSource: CredentialSource,
): SunatProfile {
  validateProfileId(id);
  return Object.freeze({
    id,
    queryingRuc: createRuc(queryingRuc),
    credentialSource: validateCredentialSource(credentialSource),
    capability: "cpe-validation-read-only",
  });
}

function parseProfileDocument(body: string): ProfileDocument {
  let value: unknown;
  try {
    value = JSON.parse(body);
  } catch {
    throw new ContractDriftError(PROFILE_PROVIDER);
  }

  if (!isRecord(value) || !hasOnlyKeys(value, ["version", "profiles"]) || value.version !== 1) {
    throw new ContractDriftError(PROFILE_PROVIDER);
  }
  if (!isRecord(value.profiles)) {
    throw new ContractDriftError(PROFILE_PROVIDER);
  }

  const profiles: Record<string, StoredProfile> = {};
  for (const [id, stored] of Object.entries(value.profiles)) {
    validateProfileId(id);
    if (
      !isRecord(stored) ||
      !hasOnlyKeys(stored, ["queryingRuc", "credentialSource", "capability"]) ||
      typeof stored.queryingRuc !== "string" ||
      typeof stored.credentialSource !== "string" ||
      typeof stored.capability !== "string"
    ) {
      throw new ContractDriftError(PROFILE_PROVIDER);
    }

    profiles[id] = {
      queryingRuc: createRuc(stored.queryingRuc),
      credentialSource: validateCredentialSource(stored.credentialSource),
      capability: validateCapability(stored.capability),
    };
  }

  return { version: 1, profiles };
}

function validateProfileId(value: string): void {
  if (!PROFILE_ID_PATTERN.test(value)) {
    throw new ValidationError(
      "El perfil debe iniciar con una letra minúscula y usar solo letras, números, guion o guion bajo.",
      "profile",
    );
  }
}

function validateCredentialSource(value: string): CredentialSource {
  if (value !== "secret-service" && value !== "environment") {
    throw new ValidationError(
      "La fuente de credenciales debe ser secret-service o environment.",
      "credential_source",
    );
  }

  return value;
}

function validateCapability(value: string): ProfileCapability {
  if (value !== "cpe-validation-read-only") {
    throw new AuthorizationError("El perfil solicita una capacidad no permitida.");
  }

  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(object: Record<string, unknown>, allowed: readonly string[]): boolean {
  return Object.keys(object).every((key) => allowed.includes(key));
}

function isMissingFile(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { readonly code?: unknown }).code === "ENOENT"
  );
}
