import type { CertificateSafeMetadata } from "./crypto-validation.types.js";

export function normalizeBase64Certificate(value: string): string {
  return value.replace(/\s/g, "").replace(/-----(BEGIN|END) CERTIFICATE-----/g, "");
}

import { createHash, X509Certificate } from "node:crypto";

export function safeHashBase64(value: string): string {
  const normalized = normalizeBase64Certificate(value);
  return createHash("sha256").update(normalized, "utf8").digest("hex").slice(0, 32) + "...";
}

export function maskCertificateSubject(value: string): string {
  if (!value) return "";
  const parts = value.split(",").filter((p) => !p.includes("CN=") && !p.includes("O="));
  return parts.length > 0 ? parts.join(", ") : value.slice(0, 30) + "...";
}

export function isCertificateLikelyBase64(value: string | null | undefined): boolean {
  if (!value || typeof value !== "string") return false;
  const cleaned = normalizeBase64Certificate(value);
  if (cleaned.length < 100) return false;
  return /^[A-Za-z0-9+/=]+$/.test(cleaned);
}

export function inspectCertificateSafe(certBase64: string): CertificateSafeMetadata {
  if (!certBase64) {
    return { present: false, parseable: false };
  }

  if (!isCertificateLikelyBase64(certBase64)) {
    return { present: true, parseable: false, error: "Formato no parece base64 válido." };
  }

  try {
    const normalized = normalizeBase64Certificate(certBase64);
    const der = Buffer.from(normalized, "base64");
    const cert = new X509Certificate(der);

    const fingerprint = createHash("sha256").update(der).digest("hex").toLowerCase();

    return {
      present: true,
      parseable: true,
      serialNumber: cert.serialNumber,
      subjectSummary: maskCertificateSubject(cert.subject),
      issuerSummary: maskCertificateSubject(cert.issuer),
      validFrom: cert.validFrom,
      validTo: cert.validTo,
      fingerprintSha256: fingerprint.slice(0, 32) + "...",
    };
  } catch (err) {
    return {
      present: true,
      parseable: false,
      error: err instanceof Error ? `Error parseando certificado: ${err.message.slice(0, 60)}` : "Error desconocido.",
    };
  }
}