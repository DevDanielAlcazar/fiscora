import type { SatCatalogIndex, SatCatalogImportedEntry, SatCatalogCoverageStatus, SatCatalogKey } from "./sat-catalog-import.types.js";

const loadedIndexes: Map<SatCatalogKey, SatCatalogIndex> = new Map();

type SimpleSummary = {
  catalogKey: string;
  entriesCount: number;
  coverageStatus: SatCatalogCoverageStatus;
};

export function registerCatalogIndex(catalogKey: SatCatalogKey, entries: SatCatalogImportedEntry[]): SatCatalogIndex {
  const entriesByKey: Record<string, SatCatalogImportedEntry> = {};
  for (const entry of entries) {
    entriesByKey[entry.key] = entry;
  }
  const index: SatCatalogIndex = { catalogKey, entriesByKey, entries };
  loadedIndexes.set(catalogKey, index);
  return index;
}

export function getCatalogIndex(catalogKey: SatCatalogKey): SatCatalogIndex | undefined {
  return loadedIndexes.get(catalogKey);
}

export function lookupCatalogEntry(catalogKey: SatCatalogKey, key: string): SatCatalogImportedEntry | undefined {
  const index = loadedIndexes.get(catalogKey);
  if (!index) return undefined;
  return index.entriesByKey[key.toUpperCase()] ?? index.entriesByKey[key];
}

export function getCatalogSummary(): SimpleSummary[] {
  const summary: SimpleSummary[] = [];
  for (const [key, index] of loadedIndexes) {
    summary.push({
      catalogKey: key,
      entriesCount: index.entries.length,
      coverageStatus: "LOCAL_IMPORTED",
    });
  }
  return summary;
}