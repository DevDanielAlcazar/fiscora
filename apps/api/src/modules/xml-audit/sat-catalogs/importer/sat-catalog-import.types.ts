import type { SatCatalogKey } from "../sat-catalog.types.js";

export type { SatCatalogKey };

export type SatCatalogSourceFormat = "CSV" | "JSON";

export type SatCatalogLoadStatus =
  | "NOT_CONFIGURED"
  | "EMPTY"
  | "LOADED"
  | "INVALID"
  | "PARTIAL";

export type SatCatalogCoverageStatus =
  | "EMPTY"
  | "PARTIAL"
  | "FISCORA_CURATED"
  | "LOCAL_IMPORTED"
  | "OFFICIAL_PENDING";

// Re-export for use in manifest types
export type { SatCatalogCoverageStatus as CatalogCoverageStatusExport } from "./sat-catalog-import.types.js";

export interface SatCatalogColumnDefinition {
  name: string;
  required: boolean;
  aliases?: string[];
}

export interface SatCatalogImportDefinition {
  catalogKey: SatCatalogKey;
  displayName: string;
  format: SatCatalogSourceFormat;
  relativePath: string;
  keyColumn: string;
  labelColumn?: string;
  requiredColumns: SatCatalogColumnDefinition[];
  optionalColumns?: SatCatalogColumnDefinition[];
  validFromColumn?: string;
  validToColumn?: string;
  trimValues?: boolean;
  uppercaseKey?: boolean;
  allowDuplicateKeys?: boolean;
  coverageStatus: SatCatalogCoverageStatus;
}

export interface SatCatalogImportedEntry {
  key: string;
  label?: string;
  raw: Record<string, string>;
  validFrom?: string;
  validTo?: string;
  isActive?: boolean;
}

export interface SatCatalogImportResult {
  catalogKey: SatCatalogKey;
  displayName: string;
  status: SatCatalogLoadStatus;
  coverageStatus: SatCatalogCoverageStatus;
  sourceFormat: SatCatalogSourceFormat;
  relativePath: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateKeys: number;
  warnings: string[];
  errors: string[];
  loadedAt: string;
  entries: SatCatalogImportedEntry[];
  columnsDetected: string[];
  missingRequiredColumns: string[];
}

export interface SatCatalogIndex {
  catalogKey: SatCatalogKey;
  entriesByKey: Record<string, SatCatalogImportedEntry>;
  entries: SatCatalogImportedEntry[];
}