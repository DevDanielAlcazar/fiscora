# Trazabilidad Forense de Catálogos SAT

## Qué es el Manifest de Catálogo

El **Manifest de Catálogo** es una estructura de metadata que describe de forma segura el estado de los catálogos SAT usados durante un análisis XML. No contiene contenido real del catálogo ni valores raw.

Ubicación: `apps/api/src/modules/xml-audit/sat-catalogs/importer/sat-catalog-manifest.types.ts`

## Hash SHA-256

Se usa `crypto.createHash("sha256")` para calcular el hash del archivo fuente CSV local. Esto permite:

- Verificar integridad del archivo
- Detectar cambios en el catálogo
- Auditoría forense sin exponer contenido

El hash se incluye como `fileSha256` en `SatCatalogFileManifest` y como `fileSha256` abreviado (primeros 12 caracteres) en la UI.

## Status de Source

| Status | Significado |
|--------|-------------|
| `FISCORA_CURATED` | Catálogo curado parcialmente por Fiscora (mínimo viable) |
| `LOCAL_IMPORTED` | Catálogo cargado desde archivo CSV local |
| `PARTIAL` | Catálogo parcial / incompleto |
| `OFFICIAL_PENDING` | Esperando carga del catálogo oficial SAT |

## Qué se incluye

- `catalogKey`: Identificador del catálogo (ej: `c_UsoCFDI`)
- `displayName`: Nombre legible
- `coverageStatus`: Status de cobertura
- `loadStatus`: Estado de carga
- `sourceFormat`: CSV o JSON
- `relativePath`: Ruta relativa (nunca absoluta)
- `fileSha256`: Hash del archivo
- `fileSizeBytes`: Tamaño en bytes
- `totalRows`, `validRows`, `invalidRows`: Conteos
- `duplicateKeys`: Número de claves duplicadas
- `columnsDetected`: Columnas encontradas
- `missingRequiredColumns`: Columnas faltantes
- `warningsCount`, `errorsCount`: Conteos de errores

## Qué NO se incluye

- Contenido completo del CSV/JSON
- Filas completas del catálogo
- Valores raw de claves
- Path absoluto del archivo
- XML raw, Addenda, sellos, certificados

## Runtime Usage Tracker

El tracker registra cada lookup de catálogo durante un análisis:

- `lookupCount`: Total de búsquedas
- `knownCount`: Búsquedas exitosas (conocidas)
- `unknownCount`: Búsquedas fallidas (desconocidas)
- `fallbackCount`: Usos de fallback (no LOCAL_IMPORTED)
- `importedHitCount`: Hits desde catálogo importado
- `curatedHitCount`: Hits desde catálogo curado
- `staticFallbackHitCount`: Hits desde fallback estático

El tracker se crea por análisis (`createCatalogRuntimeUsageTracker()`) y se limpia al finalizar. No hay estado mutable compartido entre análisis concurrentes.

## Verificar uso de catálogo

En `analysisMeta.catalogRuntime`:

```ts
{
  catalogsUsedInAnalysis: [
    {
      catalogKey: "c_UsoCFDI",
      lookupCount: 1,
      knownCount: 1,
      unknownCount: 0,
      importedHitCount: 1,
      curatedHitCount: 0,
      staticFallbackHitCount: 0,
    }
  ]
}
```

## Limitaciones actuales

- Los catálogos son parciales/curados, no el catálogo SAT oficial completo
- No hay descarga automática de catálogos SAT
- Versionado manual requerido al cargar catálogos oficiales

## Próximos pasos

1. Carga manual de catálogos oficiales SAT
2. Versionado por release (fecha de publicación SAT)
3. Cobertura completa de vigencias (validFrom/validTo)
4. Endpoint admin para inspeccionar manifest