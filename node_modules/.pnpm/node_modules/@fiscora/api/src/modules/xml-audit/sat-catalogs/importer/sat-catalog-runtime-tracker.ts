import type { SatCatalogKey } from "../sat-catalog.types.js";
import type { RuntimeCatalogLookupResult } from "../sat-catalog-runtime.adapter.js";

export interface CatalogRuntimeUsageTracker {
  recordLookup(catalogKey: SatCatalogKey, result: RuntimeCatalogLookupResult): void;
  getUsageManifest(): { catalogKey: SatCatalogKey; lookupCount: number; knownCount: number; unknownCount: number; fallbackCount: number; importedHitCount: number; curatedHitCount: number; staticFallbackHitCount: number }[];
  reset(): void;
}

class CatalogRuntimeUsageTrackerImpl implements CatalogRuntimeUsageTracker {
  private usageMap = new Map<SatCatalogKey, { count: number; known: number; unknown: number; fallback: number; imported: number; curated: number; static: number }>();

  recordLookup(catalogKey: SatCatalogKey, result: RuntimeCatalogLookupResult): void {
    const current = this.usageMap.get(catalogKey) ?? { count: 0, known: 0, unknown: 0, fallback: 0, imported: 0, curated: 0, static: 0 };
    current.count += 1;
    if (result.known) {
      current.known += 1;
    } else {
      current.unknown += 1;
    }
    if (result.source === "LOCAL_IMPORTED") {
      current.imported += 1;
    } else if (result.source === "FISCORA_CURATED") {
      current.curated += 1;
    } else if (result.source === "STATIC_FALLBACK") {
      current.static += 1;
    }
    if (result.source !== "LOCAL_IMPORTED") {
      current.fallback += 1;
    }
    this.usageMap.set(catalogKey, current);
  }

  getUsageManifest(): { catalogKey: SatCatalogKey; lookupCount: number; knownCount: number; unknownCount: number; fallbackCount: number; importedHitCount: number; curatedHitCount: number; staticFallbackHitCount: number }[] {
    const result: { catalogKey: SatCatalogKey; lookupCount: number; knownCount: number; unknownCount: number; fallbackCount: number; importedHitCount: number; curatedHitCount: number; staticFallbackHitCount: number }[] = [];
    for (const [key, stats] of this.usageMap) {
      result.push({
        catalogKey: key,
        lookupCount: stats.count,
        knownCount: stats.known,
        unknownCount: stats.unknown,
        fallbackCount: stats.fallback,
        importedHitCount: stats.imported,
        curatedHitCount: stats.curated,
        staticFallbackHitCount: stats.static,
      });
    }
    return result;
  }

  reset(): void {
    this.usageMap.clear();
  }
}

export function createCatalogRuntimeUsageTracker(): CatalogRuntimeUsageTracker {
  return new CatalogRuntimeUsageTrackerImpl();
}

// Singleton for current request context (avoid cross-contamination in tests)
let currentTracker: CatalogRuntimeUsageTracker | null = null;

export function setCurrentCatalogTracker(tracker: CatalogRuntimeUsageTracker | null): void {
  currentTracker = tracker;
}

export function getCurrentCatalogTracker(): CatalogRuntimeUsageTracker | null {
  return currentTracker;
}