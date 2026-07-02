import type { CryptoPreflightSummary, CryptoFieldPresence, CryptoCertificateSummary } from "./crypto-preflight.types.js";
import { looksLikeBase64, looksLikeUuid, looksLikeCertificateSerial, looksLikeRfc, parseSafeDate, isFutureDateReview, isBeforeDateReview } from "./crypto-format.helper.js";
import { inspectEmbeddedCertificate } from "./certificate-inspection.helper.js";
import { sanitizeCryptoPreflightSummary } from "./crypto-sanitizer.js";

interface BuildCryptoPreflightParams {
  cfdi: {
    fecha?: string;
    sello?: string;
    certificado?: string;
    noCertificado?: string;
  };
  tfd?: {
    uuid?: string;
    fechaTimbrado?: string;
    selloCfd?: string;
    selloSat?: string;
    noCertificadoSat?: string;
    rfcProvCertif?: string;
  };
  now?: Date;
}

export function buildCryptoPreflightSummary(params: BuildCryptoPreflightParams): CryptoPreflightSummary {
  const { cfdi, tfd, now } = params;

  const fieldPresence: CryptoFieldPresence = {
    sello: !!cfdi.sello,
    certificado: !!cfdi.certificado,
    noCertificado: !!cfdi.noCertificado,
    selloCfd: !!tfd?.selloCfd,
    selloSat: !!tfd?.selloSat,
    noCertificadoSat: !!tfd?.noCertificadoSat,
    rfcProvCertif: !!tfd?.rfcProvCertif,
    uuid: !!tfd?.uuid,
    fechaTimbrado: !!tfd?.fechaTimbrado,
  };

  const warnings: string[] = [];
  const errors: string[] = [];

  const selloLooksBase64 = looksLikeBase64(cfdi.sello);
  const certificadoLooksBase64 = looksLikeBase64(cfdi.certificado);
  const selloCfdLooksBase64 = looksLikeBase64(tfd?.selloCfd);
  const selloSatLooksBase64 = looksLikeBase64(tfd?.selloSat);

  const uuidFormatValid = tfd?.uuid ? looksLikeUuid(tfd.uuid) : undefined;
  const noCertificadoFormatValid = cfdi.noCertificado ? looksLikeCertificateSerial(cfdi.noCertificado) : undefined;
  const noCertificadoSatFormatValid = tfd?.noCertificadoSat ? looksLikeCertificateSerial(tfd.noCertificadoSat) : undefined;
  const rfcProvCertifFormatValid = tfd?.rfcProvCertif ? looksLikeRfc(tfd.rfcProvCertif) : undefined;

  const fechaTimbradoParsed = tfd?.fechaTimbrado ? parseSafeDate(tfd.fechaTimbrado) : null;
  const fechaCfdiParsed = cfdi.fecha ? parseSafeDate(cfdi.fecha) : null;

  const fechaTimbradoBeforeCfdiDateReview = fechaTimbradoParsed && fechaCfdiParsed && isBeforeDateReview(fechaTimbradoParsed, fechaCfdiParsed);
  const fechaTimbradoFutureReview = fechaTimbradoParsed ? isFutureDateReview(fechaTimbradoParsed, now) : undefined;

  const certificateSummary: CryptoCertificateSummary | undefined = inspectEmbeddedCertificate({
    certificadoBase64: cfdi.certificado,
    noCertificado: cfdi.noCertificado,
  });

  let status: CryptoPreflightSummary["status"] = "NOT_APPLICABLE";

  const hasAnyCryptoField = Object.values(fieldPresence).some(Boolean);
  if (hasAnyCryptoField) {
    status = "PRESENT";

    if (!fieldPresence.sello || !fieldPresence.certificado || !fieldPresence.noCertificado) {
      status = "MISSING_REQUIRED_FIELDS";
    } else if (!selloLooksBase64 || !certificadoLooksBase64) {
      status = "FORMAT_REVIEW";
    } else if (certificateSummary && certificateSummary.parseStatus === "PARSE_FAILED") {
      status = "CERTIFICATE_REVIEW";
    } else {
      status = "PENDING_FORMAL_VALIDATION";
    }
  }

  if (!selloLooksBase64 && cfdi.sello) {
    warnings.push("Sello no parece formato Base64 válido");
  }
  if (!certificadoLooksBase64 && cfdi.certificado) {
    warnings.push("Certificado no parece formato Base64 válido");
  }
  if (!uuidFormatValid && tfd?.uuid) {
    warnings.push("UUID no tiene formato estándar 8-4-4-4-12");
  }
  if (noCertificadoFormatValid === false) {
    warnings.push("NoCertificado no parece número de serie válido");
  }
  if (rfcProvCertifFormatValid === false && tfd?.rfcProvCertif) {
    warnings.push("RfcProvCertif no parece RFC plausible");
  }
  if (fechaTimbradoFutureReview) {
    warnings.push("FechaTimbrado parece futura más allá de tolerancia");
  }
  if (fechaTimbradoBeforeCfdiDateReview) {
    warnings.push("FechaTimbrado es anterior a la fecha del CFDI");
  }
  if (certificateSummary?.parseStatus === "PARSE_FAILED") {
    errors.push("No se pudo parsear el certificado embebido");
  }
  if (certificateSummary?.expiredReview) {
    warnings.push("Certificado está vencido");
  }
  if (certificateSummary?.noCertificadoComparison === "MISMATCH") {
    warnings.push("NoCertificado no coincide con serial del certificado");
  }

  const rawSummary: CryptoPreflightSummary = {
    status,
    fieldPresence,
    selloLooksBase64,
    certificadoLooksBase64,
    selloCfdLooksBase64,
    selloSatLooksBase64,
    uuidFormatValid,
    noCertificadoFormatValid,
    noCertificadoSatFormatValid,
    rfcProvCertifFormatValid,
    fechaTimbradoParseable: fechaTimbradoParsed !== null,
    fechaTimbradoBeforeCfdiDateReview: fechaTimbradoBeforeCfdiDateReview ?? undefined,
    fechaTimbradoFutureReview,
    certificado: certificateSummary,
    formalSealValidationExecuted: false,
    cadenaOriginalReconstructed: false,
    xsltAssetsAvailable: false,
    trustChainValidated: false,
    cryptographicSignatureVerified: false,
    warnings,
    errors,
  };

  return sanitizeCryptoPreflightSummary(rawSummary);
}