import type { SatCatalogKey } from "./sat-catalog.types.js";
import { lookupCatalogEntry } from "./importer/sat-catalog-index.js";
import { lookupImportedCatalogValue } from "./importer/sat-catalog-import.helpers.js";
import { getCurrentCatalogTracker } from "./importer/sat-catalog-runtime-tracker.js";

export interface RuntimeCatalogLookupResult {
  known: boolean;
  key: string;
  label?: string;
  source: "LOCAL_IMPORTED" | "FISCORA_CURATED" | "STATIC_FALLBACK" | "UNKNOWN";
  coverageStatus?: string;
  active?: boolean;
}

export type CatalogRuntimeLookupSource = "LOCAL_IMPORTED" | "FISCORA_CURATED" | "STATIC_FALLBACK" | "UNKNOWN";

const IMPORTED_CATALOG_KEYS: SatCatalogKey[] = [
  "c_UsoCFDI",
  "c_FormaPago",
  "c_Moneda",
  "c_RegimenFiscal",
  "c_ObjetoImp",
  "c_Impuesto",
  "c_TipoFactor",
  "c_TasaOCuota",
];

export function isImportedCatalogAvailable(catalogKey: SatCatalogKey): boolean {
  return IMPORTED_CATALOG_KEYS.includes(catalogKey);
}

export function lookupRuntimeCatalogValue(
  catalogKey: SatCatalogKey,
  key: string | undefined | null,
  _options?: { date?: string; normalizeUppercase?: boolean },
): RuntimeCatalogLookupResult {
  if (!key || key.trim() === "") {
    return { known: false, key: "", source: "UNKNOWN" };
  }

  const normalizedKey = key.trim().toUpperCase();

  // Try imported catalog first
  if (isImportedCatalogAvailable(catalogKey)) {
    const importedLabel = lookupImportedCatalogValue(catalogKey, normalizedKey);
    if (importedLabel !== undefined) {
      const result = {
        known: true,
        key: normalizedKey,
        label: importedLabel,
        source: "LOCAL_IMPORTED" as const,
        coverageStatus: "LOCAL_IMPORTED",
      };
      // Record usage if tracker available
      const tracker = getCurrentCatalogTracker();
      if (tracker) {
        tracker.recordLookup(catalogKey, { known: true, key: normalizedKey, source: "LOCAL_IMPORTED" });
      }
      return result;
    }
  }

  // Fallback to existing - we return UNKNOWN here and let callers use existing logic
  const result = { known: false, key: normalizedKey, source: "UNKNOWN" as const };
  // Record fallback usage
  const tracker = getCurrentCatalogTracker();
  if (tracker) {
    tracker.recordLookup(catalogKey, { known: false, key: normalizedKey, source: "UNKNOWN" });
  }
  return result;
}

export function lookupUsoCfdiRuntime(key: string | undefined | null): RuntimeCatalogLookupResult {
  return lookupRuntimeCatalogValue("c_UsoCFDI", key);
}

export function lookupFormaPagoRuntime(key: string | undefined | null): RuntimeCatalogLookupResult {
  return lookupRuntimeCatalogValue("c_FormaPago", key);
}

export function lookupMonedaRuntime(key: string | undefined | null): RuntimeCatalogLookupResult {
  return lookupRuntimeCatalogValue("c_Moneda", key);
}

export function lookupRegimenFiscalRuntime(key: string | undefined | null): RuntimeCatalogLookupResult {
  return lookupRuntimeCatalogValue("c_RegimenFiscal", key);
}

export function lookupObjetoImpRuntime(key: string | undefined | null): RuntimeCatalogLookupResult {
  return lookupRuntimeCatalogValue("c_ObjetoImp", key);
}

export function lookupImpuestoRuntime(key: string | undefined | null): RuntimeCatalogLookupResult {
  return lookupRuntimeCatalogValue("c_Impuesto", key);
}

export function lookupTipoFactorRuntime(key: string | undefined | null): RuntimeCatalogLookupResult {
  return lookupRuntimeCatalogValue("c_TipoFactor", key);
}

export function lookupTasaOCuotaRuntime(key: string | undefined | null): RuntimeCatalogLookupResult {
  return lookupRuntimeCatalogValue("c_TasaOCuota", key);
}