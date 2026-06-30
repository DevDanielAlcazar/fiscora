import type { SatCatalogImportResult, SatCatalogImportedEntry, SatCatalogKey } from "./sat-catalog-import.types.js";
import { loadSatCatalogFile } from "./sat-catalog-file-loader.js";
import { normalizeCsvContent, parseCsvToEntries } from "./sat-catalog-normalizer.js";
import { validateRequiredColumns, validateEntries } from "./sat-catalog-validator.js";
import {
  getCatalogImportDefinition,
  getAllCatalogImportDefinitions,
  getCatalogImportCoverageStatus,
} from "./sat-catalog-import.registry.js";
import { registerCatalogIndex, lookupCatalogEntry } from "./sat-catalog-index.js";

export async function loadSatCatalog(
  catalogKey: string,
): Promise<SatCatalogImportResult> {
  const def = getCatalogImportDefinition(catalogKey);

  if (!def) {
    return {
      catalogKey: catalogKey as SatCatalogKey,
      displayName: catalogKey,
      status: "NOT_CONFIGURED",
      coverageStatus: "EMPTY",
      sourceFormat: "CSV",
      relativePath: "",
      totalRows: 0,
      validRows: 0,
      invalidRows: 0,
      duplicateKeys: 0,
      warnings: [],
      errors: ["Catálogo no configurado en registry"],
      loadedAt: new Date().toISOString(),
      entries: [],
    };
  }

  const { content, exists, error } = loadSatCatalogFile(def.relativePath, def.format);

  if (!exists) {
    return {
      catalogKey: def.catalogKey,
      displayName: def.displayName,
      status: "EMPTY",
      coverageStatus: def.coverageStatus,
      sourceFormat: def.format,
      relativePath: def.relativePath,
      totalRows: 0,
      validRows: 0,
      invalidRows: 0,
      duplicateKeys: 0,
      warnings: [error ?? "Archivo no encontrado"],
      errors: [],
      loadedAt: new Date().toISOString(),
      entries: [],
    };
  }

  const rows = normalizeCsvContent(content);
  const colValidation = validateRequiredColumns(rows[0] ?? [], def.requiredColumns);

  if (!colValidation.valid && rows.length > 0) {
    return {
      catalogKey: def.catalogKey,
      displayName: def.displayName,
      status: "INVALID",
      coverageStatus: def.coverageStatus,
      sourceFormat: def.format,
      relativePath: def.relativePath,
      totalRows: rows.length - 1,
      validRows: 0,
      invalidRows: rows.length - 1,
      duplicateKeys: 0,
      warnings: [],
      errors: [`Columnas faltantes: ${colValidation.missing.join(", ")}`],
      loadedAt: new Date().toISOString(),
      entries: [],
    };
  }

  const entries = parseCsvToEntries(
    rows,
    def.keyColumn,
    def.labelColumn,
    def.validFromColumn,
    def.validToColumn,
    def.trimValues,
    def.uppercaseKey,
  );

  const entryValidation = validateEntries(entries, def.requiredColumns);

  // Detect duplicate keys
  const keyCounts = new Map<string, number>();
  for (const entry of entryValidation.valid) {
    keyCounts.set(entry.key, (keyCounts.get(entry.key) ?? 0) + 1);
  }
  const duplicates = Array.from(keyCounts.values()).filter((c) => c > 1).length;

  // Register index for lookups
  if (entryValidation.valid.length > 0) {
    registerCatalogIndex(def.catalogKey, entryValidation.valid);
  }

  return {
    catalogKey: def.catalogKey,
    displayName: def.displayName,
    status: entryValidation.valid.length > 0 ? "LOADED" : "EMPTY",
    coverageStatus: def.coverageStatus,
    sourceFormat: def.format,
    relativePath: def.relativePath,
    totalRows: rows.length - 1,
    validRows: entryValidation.valid.length,
    invalidRows: entryValidation.invalid.length,
    duplicateKeys: duplicates,
    warnings: entryValidation.reasons,
    errors: [],
    loadedAt: new Date().toISOString(),
    entries: entryValidation.valid,
  };
}

export async function loadAllCatalogs(): Promise<SatCatalogImportResult[]> {
  const results: SatCatalogImportResult[] = [];
  for (const def of getAllCatalogImportDefinitions()) {
    const result = await loadSatCatalog(def.catalogKey);
    results.push(result);
  }
  return results;
}

export function getLoadedCatalogCoverage(): ReturnType<typeof getCatalogImportCoverageStatus> {
  return getCatalogImportCoverageStatus();
}

export function lookupImportedCatalogValue(catalogKey: string, key: string): string | undefined {
  const entry = lookupCatalogEntry(catalogKey as SatCatalogKey, key);
  return entry?.label;
}