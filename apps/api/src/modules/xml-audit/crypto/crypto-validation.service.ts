import type {
  CryptoValidationSummary,
  CryptoValidationCheckKey,
  CryptoValidationStatus,
} from "./crypto-validation.types.js";
import { CRYPTO_ASSET_REGISTRY, getConfiguredAssetCount } from "./crypto-assets.registry.js";
import { CRYPTO_ADAPTER } from "./crypto-validation.adapter.js";

interface CryptoDetectionParams {
  hasSello: boolean;
  hasCertificado: boolean;
  hasNoCertificado: boolean;
  hasTimbreFiscalDigital: boolean;
  hasSelloSat: boolean;
}

export function buildCryptoValidationSummary(
  _certBase64: string | null | undefined,
  detection: CryptoDetectionParams,
  enableCryptoValidation = false,
): CryptoValidationSummary {
  const adapter = CRYPTO_ADAPTER;

  const requiredChecks: CryptoValidationCheckKey[] = [];
  if (detection.hasSello && detection.hasCertificado) {
    requiredChecks.push("CFDI_CERTIFICATE", "CFDI_CERTIFICATE_SERIAL", "CFDI_CERTIFICATE_VALIDITY", "CFDI_ORIGINAL_CHAIN", "CFDI_SELLO");
  }
  if (detection.hasTimbreFiscalDigital && detection.hasSelloSat) {
    requiredChecks.push("TFD_ORIGINAL_CHAIN", "TFD_SELLO_SAT", "TFD_CERTIFICATE_SAT");
  }

  const checks = requiredChecks.map((key) => ({
    key,
    status: "SKIPPED_MISSING_ASSET" as CryptoValidationStatus,
    configured: false,
    validated: false,
    message: getCheckMessage(key),
  }));

  const status: CryptoValidationStatus = "NOT_CONFIGURED";

  return {
    enabled: enableCryptoValidation,
    status,
    adapterName: adapter.name,
    configuredAssets: getConfiguredAssetCount(),
    requiredAssets: requiredChecks,
    checks,
    notes: ["Validación criptográfica no configurada: faltan XSLT y trust store."],
  };
}

function getCheckMessage(key: CryptoValidationCheckKey): string {
  switch (key) {
    case "CFDI_CERTIFICATE":
      return "Certificado presente, metadata inspeccionada sin validación de firma.";
    case "CFDI_CERTIFICATE_SERIAL":
      return "Serial no verificado: requiere XSLT para generar cadena original.";
    case "CFDI_CERTIFICATE_VALIDITY":
      return "Vigencia no verificada: faltan assets de validación.";
    case "CFDI_ORIGINAL_CHAIN":
      return "Cadena original no generada: falta XSLT oficial CFDI 4.0.";
    case "CFDI_SELLO":
      return "Sello no verificado: falta XSLT y adaptador de firma.";
    case "TFD_ORIGINAL_CHAIN":
      return "Cadena original TFD no generada: falta XSLT oficial TFD 1.1.";
    case "TFD_SELLO_SAT":
      return "Sello SAT no verificado: falta XSLT y trust store.";
    case "TFD_CERTIFICATE_SAT":
      return "Certificado SAT no verificado: falta trust store.";
    default:
      return "Check no configurado.";
  }
}