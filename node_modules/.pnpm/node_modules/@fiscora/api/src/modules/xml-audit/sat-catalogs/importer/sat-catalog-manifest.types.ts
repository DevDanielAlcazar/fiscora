import type { SatCatalogKey } from "../sat-catalog.types.js";
import type { SatCatalogLoadStatus, SatCatalogCoverageStatus } from "./sat-catalog-import.types.js";

export interface SatCatalogFileManifest {
  catalogKey: SatCatalogKey;
  displayName: string;
  coverageStatus: SatCatalogCoverageStatus;
  loadStatus: SatCatalogLoadStatus;
  sourceFormat: string;
  relativePath: string;
  fileSha256?: string;
  fileSizeBytes?: number;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateKeys: number;
  columnsDetected: string[];
  missingRequiredColumns: string[];
  warningsCount: number;
  errorsCount: number;
  loadedAt: string;
}

export interface SatCatalogRuntimeUsageManifest {
  catalogKey: SatCatalogKey;
  lookupCount: number;
  knownCount: number;
  unknownCount: number;
  fallbackCount: number;
  importedHitCount: number;
  curatedHitCount: number;
  staticFallbackHitCount: number;
}

export interface SatCatalogRuntimeManifestSummary {
  totalCatalogsConfigured: number;
  loadedCatalogs: number;
  invalidCatalogs: number;
  partialCatalogs: number;
  totalRows: number;
  catalogsWithErrors: string[];
  catalogsUsedInAnalysis: SatCatalogRuntimeUsageManifest[];
  catalogFiles: SatCatalogFileManifest[];
}