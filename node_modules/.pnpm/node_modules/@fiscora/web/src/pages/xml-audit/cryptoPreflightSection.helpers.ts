import type { CryptoPreflightSummary } from "../../api/xml-audit";

interface CryptoPreflightDisplay {
  status: string;
  statusLabel: string;
  statusColor: string;
  fieldsDetected: number;
  fieldsTotal: number;
  formatValidations: {
    selloBase64: boolean | null;
    certificadoBase64: boolean | null;
    selloCfdBase64: boolean | null;
    selloSatBase64: boolean | null;
    uuidFormat: boolean | null;
    noCertificadoFormat: boolean | null;
    rfcProvCertifFormat: boolean | null;
  };
  certificate: {
    parseStatus: string;
    subject?: string;
    issuer?: string;
    validFrom?: string;
    validTo?: string;
    expired: boolean;
  } | null;
  formalValidationPending: boolean;
  warnings: string[];
  errors: string[];
}

export function buildCryptoPreflightDisplay(summary?: CryptoPreflightSummary): CryptoPreflightDisplay | null {
  if (!summary) return null;

  const fieldsTotal = 9;
  const fieldsDetected = Object.values(summary.fieldPresence).filter(Boolean).length;

  const statusColors: Record<string, string> = {
    NOT_APPLICABLE: "text-muted-foreground",
    PRESENT: "text-blue-700",
    MISSING_REQUIRED_FIELDS: "text-yellow-700",
    FORMAT_REVIEW: "text-orange-700",
    CERTIFICATE_REVIEW: "text-red-700",
    PENDING_FORMAL_VALIDATION: "text-blue-700",
  };

  const statusLabels: Record<string, string> = {
    NOT_APPLICABLE: "No aplica",
    PRESENT: "Campos presentes",
    MISSING_REQUIRED_FIELDS: "Faltan campos requeridos",
    FORMAT_REVIEW: "Revisión de formato",
    CERTIFICATE_REVIEW: "Revisión de certificado",
    PENDING_FORMAL_VALIDATION: "Pendiente validación formal",
  };

  const certificateInfo = summary.certificado
    ? {
        parseStatus: summary.certificado.parseStatus,
        subject: summary.certificado.subject,
        issuer: summary.certificado.issuer,
        validFrom: summary.certificado.validFrom,
        validTo: summary.certificado.validTo,
        expired: summary.certificado.expiredReview ?? false,
      }
    : null;

  return {
    status: summary.status,
    statusLabel: statusLabels[summary.status] ?? summary.status,
    statusColor: statusColors[summary.status] ?? "text-muted-foreground",
    fieldsDetected,
    fieldsTotal,
    formatValidations: {
      selloBase64: summary.selloLooksBase64,
      certificadoBase64: summary.certificadoLooksBase64,
      selloCfdBase64: summary.selloCfdLooksBase64,
      selloSatBase64: summary.selloSatLooksBase64,
      uuidFormat: summary.uuidFormatValid ?? null,
      noCertificadoFormat: summary.noCertificadoFormatValid ?? null,
      rfcProvCertifFormat: summary.rfcProvCertifFormatValid ?? null,
    },
    certificate: certificateInfo,
    formalValidationPending: !summary.formalSealValidationExecuted,
    warnings: summary.warnings,
    errors: summary.errors,
  };
}