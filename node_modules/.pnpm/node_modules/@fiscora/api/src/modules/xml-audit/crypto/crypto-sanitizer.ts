import type { CryptoPreflightSummary, CryptoCertificateSummary } from "./crypto-preflight.types.js";

const MAX_SUBJECT_LENGTH = 200;
const MAX_LIST_ITEMS = 20;

export function maskLongCryptoValue(value: unknown, visibleStart = 8, visibleEnd = 8): string | undefined {
  if (typeof value !== "string") return undefined;
  if (!value) return undefined;
  const cleaned = value.replace(/\s/g, "").replace(/-----(BEGIN|END) CERTIFICATE-----/g, "");
  if (cleaned.length <= visibleStart + visibleEnd + 4) return cleaned;
  return cleaned.slice(0, visibleStart) + "..." + cleaned.slice(-visibleEnd);
}

export function sanitizeCertificateText(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  if (!value) return undefined;
  const cleaned = value.trim();
  if (cleaned.length <= MAX_SUBJECT_LENGTH) return cleaned;
  return cleaned.slice(0, MAX_SUBJECT_LENGTH) + "...";
}

export function sanitizeCryptoPreflightSummary(summary: CryptoPreflightSummary): CryptoPreflightSummary {
  const sanitizeCert = (cert: CryptoCertificateSummary | undefined): CryptoCertificateSummary | undefined => {
    if (!cert) return cert;
    return {
      ...cert,
      subject: sanitizeCertificateText(cert.subject) ?? cert.subject,
      issuer: sanitizeCertificateText(cert.issuer) ?? cert.issuer,
    };
  };

  const warnings = summary.warnings.slice(0, MAX_LIST_ITEMS);
  const errors = summary.errors.slice(0, MAX_LIST_ITEMS);

  return {
    ...summary,
    certificado: sanitizeCert(summary.certificado),
    warnings,
    errors,
  };
}