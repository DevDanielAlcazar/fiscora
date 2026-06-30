import type { SatCatalogFileManifest, SatCatalogRuntimeManifestSummary } from "./sat-catalog-manifest.types.js";
import type { SatCatalogImportResult } from "./sat-catalog-import.types.js";
import { createHash } from "node:crypto";

export function hashCatalogFileContent(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

export function buildSatCatalogFileManifest(importResult: SatCatalogImportResult, content?: string): SatCatalogFileManifest {
  const columnsDetected = importResult.entries.length > 0
    ? Object.keys(importResult.entries[0]?.raw ?? {})
    : [];

  return {
    catalogKey: importResult.catalogKey,
    displayName: importResult.displayName,
    coverageStatus: importResult.coverageStatus,
    loadStatus: importResult.status,
    sourceFormat: importResult.sourceFormat,
    relativePath: importResult.relativePath,
    fileSha256: content ? hashCatalogFileContent(content) : undefined,
    fileSizeBytes: content ? Buffer.byteLength(content, "utf8") : undefined,
    totalRows: importResult.totalRows,
    validRows: importResult.validRows,
    invalidRows: importResult.invalidRows,
    duplicateKeys: importResult.duplicateKeys,
    columnsDetected,
    missingRequiredColumns: [],
    warningsCount: importResult.warnings.length,
    errorsCount: importResult.errors.length,
    loadedAt: importResult.loadedAt,
  };
}

export function buildSatCatalogManifestSummary(importResults: SatCatalogImportResult[]): SatCatalogRuntimeManifestSummary {
  const loadedCatalogs = importResults.filter((r) => r.status === "LOADED").length;
  const invalidCatalogs = importResults.filter((r) => r.status === "INVALID").length;
  const partialCatalogs = importResults.filter((r) => r.status === "PARTIAL" || r.status === "EMPTY").length;

  return {
    totalCatalogsConfigured: importResults.length,
    loadedCatalogs,
    invalidCatalogs,
    partialCatalogs,
    totalRows: importResults.reduce((sum, r) => sum + r.totalRows, 0),
    catalogsWithErrors: importResults
      .filter((r) => r.errors.length > 0 || r.status === "NOT_CONFIGURED")
      .map((r) => r.catalogKey),
    catalogsUsedInAnalysis: [],
    catalogFiles: [],
  };
}

export function sanitizeCatalogManifestForOutput(
  manifest: SatCatalogRuntimeManifestSummary,
): SatCatalogRuntimeManifestSummary {
  return {
    ...manifest,
    catalogsWithErrors: [...manifest.catalogsWithErrors],
    catalogsUsedInAnalysis: manifest.catalogsUsedInAnalysis.map((u) => ({ ...u })),
    catalogFiles: manifest.catalogFiles.map((f) => ({ ...f })),
  };
}