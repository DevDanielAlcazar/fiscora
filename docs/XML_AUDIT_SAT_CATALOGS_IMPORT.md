# SAT Catalog Importer

## Overview
Infraestructura para cargar catálogos SAT desde archivos locales CSV/JSON, sin descargar de internet ni consultar SAT.

## Location
`apps/api/src/modules/xml-audit/sat-catalogs/importer/`

## Componentes

| Archivo | Función |
|--------|---------|
| `sat-catalog-import.types.ts` | Tipos base (SatCatalogKey, SatCatalogLoadStatus, etc.) |
| `sat-catalog-import.registry.ts` | Registry de definiciones de catálogos importables |
| `sat-catalog-file-loader.ts` | Carga archivo local desde fixtures/ |
| `sat-catalog-normalizer.ts` | Parse CSV/JSON a entradas normalizadas |
| `sat-catalog-validator.ts` | Validación de columnas obligatorias |
| `sat-catalog-index.ts` | Índice en memoria para lookups |
| `sat-catalog-import.helpers.ts` | API principal: loadSatCatalog() |

## Formato fixtures

### CSV esperado
```csv
c_UsoCFDI,c_Descripcion
G01,Gastos en actividades de mantenimiento y reparación
G02,Gastos en actividades de construcción
```

### JSON esperado
```json
[
  {"c_UsoCFDI": "G01", "c_Descripcion": "Gastos..."},
  {"c_UsoCFDI": "G02", "c_Descripcion": "Gastos..."}
]
```

## Coverage Status
- `EMPTY` - Sin datos
- `PARTIAL` - Manejo curado parcial
- `FISCORA_CURATED` - Curado por Fiscora
- `LOCAL_IMPORTED` - Importado desde archivo local
- `OFFICIAL_PENDING` - Esperando carga oficial

## Uso futuro
1. Colocar archivo CSV oficial en `fixtures/`
2. Agregar definición en `sat-catalog-import.registry.ts`
3. Cambiar `coverageStatus` a `OFFICIAL_PENDING`
4. Ejecutar `loadSatCatalog()` en bootstrap

## Runtime Adapter

`apps/api/src/modules/xml-audit/sat-catalogs/sat-catalog-runtime.adapter.ts`

Funciones imported-first con fallback:

| Función | Catálogo |
|---------|----------|
| `lookupUsoCfdiRuntime(key)` | c_UsoCFDI |
| `lookupFormaPagoRuntime(key)` | c_FormaPago |
| `lookupMonedaRuntime(key)` | c_Moneda |
| `lookupRegimenFiscalRuntime(key)` | c_RegimenFiscal |
| `lookupObjetoImpRuntime(key)` | c_ObjetoImp |
| `lookupImpuestoRuntime(key)` | c_Impuesto |
| `lookupTipoFactorRuntime(key)` | c_TipoFactor |
| `lookupTasaOCuotaRuntime(key)` | c_TasaOCuota |

### RuntimeCatalogLookupResult
```ts
{
  known: boolean;
  key: string;
  label?: string;
  source: "LOCAL_IMPORTED" | "FISCORA_CURATED" | "STATIC_FALLBACK" | "UNKNOWN";
  coverageStatus?: string;
  active?: boolean;
}
```

## Manifest & Traceability

`apps/api/src/modules/xml-audit/sat-catalogs/importer/sat-catalog-manifest.types.ts`

`apps/api/src/modules/xml-audit/sat-catalogs/importer/sat-catalog-manifest.helpers.ts`

`apps/api/src/modules/xml-audit/sat-catalogs/importer/sat-catalog-runtime-tracker.ts`

### SatCatalogFileManifest
- `fileSha256`: hash SHA-256 del archivo CSV local
- `fileSizeBytes`: tamaño del archivo
- `columnsDetected`: columnas encontradas en headers
- `missingRequiredColumns`: columnas requeridas faltantes
- `warningsCount`, `errorsCount`: conteos de warnings/errors

### SatCatalogRuntimeUsageManifest
- `lookupCount`, `knownCount`, `unknownCount`
- `fallbackCount`, `importedHitCount`, `curatedHitCount`, `staticFallbackHitCount`

### Runtime Usage Tracker
- `createCatalogRuntimeUsageTracker()`: crea tracker por análisis
- Thread-safe: no shared mutable state entre análisis

## Integration Future
- `analysisMeta.catalogRuntime`: metadata segura de catálogos usados
- `loadSatCatalogs()` en bootstrap de servidor
- Versionado de catálogos por release