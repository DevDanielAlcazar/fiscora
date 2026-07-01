import type { SatCatalogRuntimeManifestSummary } from "../../api/xml-audit";

export interface CatalogRuntimeSummary {
  totalCatalogsConfigured: number;
  loadedCatalogs: number;
  totalRows: number;
  catalogsUsedInAnalysis: {
    catalogKey: string;
    lookupCount: number;
    knownCount: number;
  }[];
  catalogsWithErrors: string[];
}

export function buildCatalogRuntimeSummary(
  catalogRuntime: SatCatalogRuntimeManifestSummary | undefined,
): CatalogRuntimeSummary | null {
  if (!catalogRuntime) return null;

  return {
    totalCatalogsConfigured: catalogRuntime.totalCatalogsConfigured ?? 0,
    loadedCatalogs: catalogRuntime.loadedCatalogs ?? 0,
    totalRows: catalogRuntime.totalRows ?? 0,
    catalogsUsedInAnalysis: (catalogRuntime.catalogsUsedInAnalysis ?? []).map((u) => ({
      catalogKey: u.catalogKey,
      lookupCount: u.lookupCount,
      knownCount: u.knownCount,
    })),
    catalogsWithErrors: catalogRuntime.catalogsWithErrors ?? [],
  };
}