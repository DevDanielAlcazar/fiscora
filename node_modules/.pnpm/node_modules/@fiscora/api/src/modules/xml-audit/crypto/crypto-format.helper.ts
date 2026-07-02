export function looksLikeBase64(value: unknown): boolean {
  if (typeof value !== "string") return false;
  if (!value || value.length < 20) return false;
  const cleaned = value.replace(/\s/g, "").replace(/-----(BEGIN|END) CERTIFICATE-----/g, "");
  if (cleaned.length < 20) return false;
  const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
  return base64Regex.test(cleaned);
}

export function looksLikeUuid(value: unknown): boolean {
  if (typeof value !== "string") return false;
  if (!value) return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value.trim());
}

export function looksLikeCertificateSerial(value: unknown): boolean {
  if (typeof value !== "string") return false;
  if (!value) return false;
  const cleaned = value.trim();
  if (cleaned.length < 10) return false;
  return /^\d+$/.test(cleaned);
}

export function looksLikeRfc(value: unknown): boolean {
  if (typeof value !== "string") return false;
  if (!value) return false;
  const cleaned = value.trim().toUpperCase();
  if (cleaned.length < 10 || cleaned.length > 13) return false;
  return /^[A-ZÑ&]{3,4}\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])[A-Z0-9]{2,3}[0-9A-Z]$/.test(cleaned);
}

export function parseSafeDate(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  if (!value) return null;
  try {
    const d = new Date(value);
    if (isNaN(d.getTime())) return null;
    return d;
  } catch {
    return null;
  }
}

const FUTURE_TOLERANCE_MINUTES = 5;

export function isFutureDateReview(date: Date, now?: Date): boolean {
  const reference = now ?? new Date();
  const toleranceMs = FUTURE_TOLERANCE_MINUTES * 60 * 1000;
  return date.getTime() > reference.getTime() + toleranceMs;
}

export function isBeforeDateReview(date: Date, beforeDate: Date | null): boolean {
  if (!beforeDate) return false;
  return date.getTime() < beforeDate.getTime();
}