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

import type { CryptoCertificateSummary } from "./crypto-preflight.types.js";
import { looksLikeCertificateSerial } from "./crypto-format.helper.js";

interface InspectEmbeddedCertificateParams {
  certificadoBase64?: string;
  noCertificado?: string;
}

export function inspectEmbeddedCertificate(params: InspectEmbeddedCertificateParams): CryptoCertificateSummary {
  const { certificadoBase64, noCertificado } = params;

  if (!certificadoBase64) {
    return { parseStatus: "NOT_PRESENT" };
  }

  const cleanedBase64 = normalizeBase64Certificate(certificadoBase64);
  if (cleanedBase64.length < 100 || !/^[A-Za-z0-9+/=]+$/.test(cleanedBase64)) {
    return { parseStatus: "PARSE_FAILED" };
  }

  try {
    const der = Buffer.from(cleanedBase64, "base64");
    const cert = new X509Certificate(der);

    const now = new Date();
    const validFrom = cert.validFrom ? new Date(cert.validFrom) : null;
    const validTo = cert.validTo ? new Date(cert.validTo) : null;

    const fingerprint = createHash("sha256").update(der).digest("hex").toLowerCase();

    const notBeforeReview = validFrom ? validFrom > now : undefined;
    const expiredReview = validTo ? validTo < now : undefined;

    const noCertificadoComparison: "MATCH" | "MISMATCH" | "NOT_COMPARABLE" | "NOT_AVAILABLE" = (() => {
      if (!noCertificado || !cert.serialNumber) return "NOT_AVAILABLE";
      if (!looksLikeCertificateSerial(cert.serialNumber)) return "NOT_COMPARABLE";
      const cleanedNoCert = noCertificado.trim();
      try {
        const serialNum = BigInt(cert.serialNumber);
        const noCertNum = BigInt(cleanedNoCert);
        return serialNum === noCertNum ? "MATCH" : "MISMATCH";
      } catch {
        return "NOT_COMPARABLE";
      }
    })();

    return {
      parseStatus: "PARSED",
      subject: maskCertificateSubject(cert.subject),
      issuer: maskCertificateSubject(cert.issuer),
      validFrom: cert.validFrom,
      validTo: cert.validTo,
      serialNumber: cert.serialNumber,
      fingerprint256: fingerprint.slice(0, 32) + "...",
      publicKeyAlgorithm: cert.publicKey ? "RSA" : undefined,
      notBeforeReview,
      expiredReview,
      noCertificadoComparison,
    };
  } catch {
    return { parseStatus: "PARSE_FAILED" };
  }
}