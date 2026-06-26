import type {
  SatCatalogKey,
  CatalogLookupOptions,
  CatalogLookupResult,
  SatCatalogEntry,
} from "./sat-catalog.types.js";
import { getCatalogDefinition } from "./sat-catalog.registry.js";

function normalizeCatalogCode(value: string | null | undefined): string {
  if (!value) return "";
  return value.trim().toUpperCase();
}

function tryParseDate(v: string | null | undefined): Date | null {
  if (!v) return null;
  const d = new Date(v.trim());
  return isNaN(d.getTime()) ? null : d;
}

export function lookupCatalogEntry(
  key: SatCatalogKey,
  code: string | null | undefined,
  options?: CatalogLookupOptions,
): CatalogLookupResult {
  const def = getCatalogDefinition(key);
  const normalized = options?.normalize !== false ? normalizeCatalogCode(code) : (code ?? "").trim();

  if (!def) {
    return {
      known: false,
      activeOnDate: null,
      entry: undefined,
      label: undefined,
      reason: `Catálogo ${key} no está registrado`,
      completeness: "UNKNOWN",
      sourceType: "INTERNAL_HEURISTIC",
      sourceName: "Unknown",
    };
  }

  const entry = def.entries.find((e) => e.code === normalized || e.code.toUpperCase() === normalized);

  if (!entry) {
    return {
      known: false,
      activeOnDate: null,
      entry: undefined,
      label: undefined,
      reason: `Código ${code} no encontrado en catálogo parcial/curado`,
      completeness: def.completeness,
      sourceType: def.sourceType,
      sourceName: def.sourceName,
    };
  }

  let activeOnDate: boolean | null = null;
  if (options?.cfdiDate) {
    const cfdiDate = tryParseDate(options.cfdiDate);
    if (cfdiDate) {
      const validFrom = entry.validFrom ? tryParseDate(entry.validFrom) : null;
      const validTo = entry.validTo ? tryParseDate(entry.validTo) : null;

      if (validFrom && cfdiDate < validFrom) {
        activeOnDate = false;
      } else if (validTo && cfdiDate > validTo) {
        activeOnDate = false;
      } else {
        activeOnDate = true;
      }
    }
  }

  return {
    known: true,
    activeOnDate,
    entry,
    label: entry.label,
    completeness: def.completeness,
    sourceType: def.sourceType,
    sourceName: def.sourceName,
  };
}

export function isKnownCatalogCode(
  key: SatCatalogKey,
  code: string | null | undefined,
  options?: CatalogLookupOptions,
): boolean {
  const result = lookupCatalogEntry(key, code, options);
  return result.known;
}

export function getCatalogLabel(
  key: SatCatalogKey,
  code: string | null | undefined,
  fallback?: string,
): string | null {
  const result = lookupCatalogEntry(key, code, { normalize: true });
  if (result.label) return result.label;
  if (fallback !== undefined) return fallback;
  return null;
}

export function isCatalogCodeActiveOnDate(
  key: SatCatalogKey,
  code: string | null | undefined,
  cfdiDate: string,
): boolean | null {
  const result = lookupCatalogEntry(key, code, { cfdiDate });
  return result.activeOnDate;
}

export function buildCatalogEvidence(
  key: SatCatalogKey,
  code: string | null | undefined,
  options?: CatalogLookupOptions,
): {
  catalogKey: SatCatalogKey;
  code: string | null;
  label: string | null;
  known: boolean;
  activeOnDate: boolean | null;
  validFrom: string | null;
  validTo: string | null;
  completeness: string;
  sourceType: string;
  sourceName: string;
  note?: string;
} {
  const result = lookupCatalogEntry(key, code, options);
  return {
    catalogKey: key,
    code: code ?? null,
    label: result.entry?.label ?? null,
    known: result.known,
    activeOnDate: result.activeOnDate,
    validFrom: result.entry?.validFrom ?? null,
    validTo: result.entry?.validTo ?? null,
    completeness: result.completeness,
    sourceType: result.sourceType,
    sourceName: result.sourceName,
    note: result.activeOnDate === false ? "Código no vigente para fecha del CFDI" : undefined,
  };
}