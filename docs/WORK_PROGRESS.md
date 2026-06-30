# 13G/13I - Síntesis, Wellformedness y Catalog Import

## Goal
Infraestructura completa de importación de catálogos SAT + validación wellformedness + banco sintético, regresión 332/332.

## Constraints
- No descargar SAT
- No scraping
- No endpoints
- No Prisma
- No dependencias
- No cambios fiscales nuevos
- Fallback preservado

## Progress
### Done
- ✅ Well-formedness: helper + integración en analyzeCfdi (LQ-LX: 7 casos)
- ✅ Fixtures sintéticos: 42 totales
- ✅ Importación catálogos: infraestructura CSV/JSON + 8 fixtures (LY-MQ: 9 casos)
- ✅ Runtime adapter: imported-first para 8 catálogos (MR-MW: 6 casos)

## Critical Context
- Regression: 332/332 casos pasaron
- RFCs ficticios en fixtures
- Certificados: MII... placeholders
- No hay validación XSD real sin schemas locales

## Relevant Files
- `apps/api/src/modules/xml-audit/sat-catalogs/importer/*` - infraestructura importación
- `apps/api/src/modules/xml-audit/sat-catalogs/importer/fixtures/*` - samples CSV (8 archivos)
- `apps/api/src/modules/xml-audit/xml-wellformedness.helper.ts` - validación wellformedness
- `apps/api/src/modules/xml-audit/test-fixtures/*` - banco sintético (42 fixtures)
- `docs/XML_AUDIT_WELLFORMEDNESS.md` - documentación wellformedness
- `docs/XML_AUDIT_SAT_CATALOGS_STATUS.md` - documentación catálogos