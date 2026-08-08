import { parseArgs } from "node:util";
import { DomainError } from "@nyro-sunat/core";
import type { CliServices, VoucherCommandWithoutRequestId } from "./services.js";

export interface CliIo {
  writeOut(message: string): void;
  writeError(message: string): void;
}

export async function runCli(
  arguments_: readonly string[],
  services: CliServices,
  io: CliIo,
): Promise<number> {
  const [command, ...commandArguments] = arguments_;
  const jsonOutput = commandArguments.includes("--json");

  try {
    switch (command) {
      case undefined:
      case "help":
      case "--help":
      case "-h":
        io.writeOut(helpText());
        return 0;
      case "perfil-configurar":
        return await configureProfile(commandArguments, services, io);
      case "perfil-verificar":
        return await verifyProfile(commandArguments, services, io);
      case "validar-comprobante":
        return await validateVoucher(commandArguments, services, io);
      default:
        io.writeError(`Comando desconocido: ${command}`);
        return 2;
    }
  } catch (error: unknown) {
    if (error instanceof DomainError) {
      writeFailure(io, jsonOutput, error.code, error.message, error.details);
      return error.code === "AUTHENTICATION_ERROR" ? 3 : 2;
    }

    writeFailure(io, jsonOutput, "CLI_ERROR", "No se pudo procesar el comando solicitado.");
    return 2;
  }
}

async function verifyProfile(
  arguments_: readonly string[],
  services: CliServices,
  io: CliIo,
): Promise<number> {
  const parsed = parseArgs({
    args: [...arguments_],
    strict: true,
    options: {
      profile: { type: "string" },
      json: { type: "boolean", default: false },
    },
  });
  const profileId = requireOption(parsed.values.profile, "profile");
  const result = await services.verifyProfile(profileId);

  if (parsed.values.json) {
    io.writeOut(JSON.stringify(result));
  } else {
    io.writeOut(
      `Perfil ${result.profileId} autenticado para ${result.capability}. No se consultaron comprobantes.`,
    );
    io.writeOut(`Solicitud: ${result.requestId}`);
  }
  return 0;
}

async function configureProfile(
  arguments_: readonly string[],
  services: CliServices,
  io: CliIo,
): Promise<number> {
  const parsed = parseArgs({
    args: [...arguments_],
    strict: true,
    options: {
      profile: { type: "string" },
      "ruc-consultante": { type: "string" },
      credenciales: { type: "string" },
      json: { type: "boolean", default: false },
    },
  });
  const profileId = requireOption(parsed.values.profile, "profile");
  const queryingRuc = requireOption(parsed.values["ruc-consultante"], "ruc-consultante");
  const source = requireCredentialSource(parsed.values.credenciales);
  const path = await services.configureProfile({
    profileId,
    queryingRuc,
    credentialSource: source,
  });

  if (parsed.values.json) {
    io.writeOut(JSON.stringify({ configured: true, profile: profileId, path }));
  } else {
    io.writeOut(`Perfil ${profileId} configurado en ${path}. No se guardaron secretos.`);
  }
  return 0;
}

async function validateVoucher(
  arguments_: readonly string[],
  services: CliServices,
  io: CliIo,
): Promise<number> {
  const parsed = parseArgs({
    args: [...arguments_],
    strict: true,
    options: {
      profile: { type: "string" },
      "ruc-emisor": { type: "string" },
      tipo: { type: "string" },
      serie: { type: "string" },
      numero: { type: "string" },
      fecha: { type: "string" },
      monto: { type: "string" },
      moneda: { type: "string" },
      json: { type: "boolean", default: false },
    },
  });
  const profileId = requireOption(parsed.values.profile, "profile");
  const voucher: VoucherCommandWithoutRequestId = {
    issuerRuc: requireOption(parsed.values["ruc-emisor"], "ruc-emisor"),
    documentType: requireOption(parsed.values.tipo, "tipo"),
    series: requireOption(parsed.values.serie, "serie"),
    number: requireOption(parsed.values.numero, "numero"),
    issueDate: requireOption(parsed.values.fecha, "fecha"),
    total: requireOption(parsed.values.monto, "monto"),
    currency: requireOption(parsed.values.moneda, "moneda"),
  };
  const result = await services.validateVoucher(profileId, voucher);

  if (parsed.values.json) {
    io.writeOut(JSON.stringify(result));
  } else {
    io.writeOut(`Estado: ${result.data.status}`);
    io.writeOut(
      `Fuente: ${result.provenance.source} (oficial: ${String(result.provenance.isOfficial)})`,
    );
    io.writeOut(`Solicitud: ${result.requestId}`);
    if (result.warnings.length > 0) {
      io.writeOut(`Advertencias: ${result.warnings.length}`);
    }
  }
  return 0;
}

function requireOption(value: string | undefined, name: string): string {
  if (value === undefined) {
    throw new TypeError(`Missing option: ${name}`);
  }
  return value;
}

function requireCredentialSource(value: string | undefined): "secret-service" | "environment" {
  if (value !== "secret-service" && value !== "environment") {
    throw new TypeError("Invalid credential source");
  }
  return value;
}

function writeFailure(
  io: CliIo,
  json: boolean,
  code: string,
  message: string,
  details: Readonly<Record<string, string>> = {},
): void {
  if (json) {
    const error =
      Object.keys(details).length === 0 ? { code, message } : { code, message, details };
    io.writeError(JSON.stringify({ error }));
    return;
  }

  io.writeError(`Error [${code}]: ${message}`);
  if (Object.keys(details).length > 0) {
    io.writeError(
      `Detalles: ${Object.entries(details)
        .map(([key, value]) => `${key}=${value}`)
        .join(", ")}`,
    );
  }
}

function helpText(): string {
  return `Agent Nyro SUNAT

Comandos:
  perfil-configurar     Guarda configuración no secreta de un perfil
  perfil-verificar      Comprueba OAuth y descarta el token sin consultar CPE
  validar-comprobante   Consulta la validez de un CPE

Use --help en la documentación del repositorio para ejemplos. Las credenciales y certificados
no se aceptan como argumentos de esta CLI.`;
}
