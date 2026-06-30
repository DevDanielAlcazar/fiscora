# 13G - Síntesis y Mínimos

## Goal
Completar infraestructura de importación de catálogos SAT/4.0, validación wellformedness, banco syntético, regresión 321/321.

## Constraints & Preferences
- No descargar catálogos de internet
- No consultar SAT
- No agregar dependencias
- No tocar Prisma ni endpoints
- No exponer contenido sensible
- Mantener regresión verde

## Progress
### Done
- ✅ XSD offline: arquitectura preparada (11 schemas, unavailable adapter)
- ✅ Cripto offline: arquitectura preparada (4 assets, unavailable adapter)
- ✅ Well-formedness validation: helper + integración en analyzeCfdi (LQ-LX: 7 casos)
- ✅ Fixtures sintéticos: 42 totales (8+8+9+9+8 por complemento)
- ✅ Importación catálogos: infraestructura CSV/JSON + 8 fixtures (LY-MQ: 11 casos)

### In Progress
- (none)

### Blocked
- (none)

## Key Decisions
- Adapter UnavailableXsd/Crypto por falta de assets locales
- Registry XSD/crypto marca `configured: false`
- Metadata certificado con fingerprint SHA256 truncado
- Fixtures marcados SYNTHETIC_TEST_ONLY
- Catálogos importables con status EMPTY/PARTIAL/CURATED/LOCAL_IMPORTED/OFFICIAL_PENDING

## Next Steps
- (none - infraestructura base completa)

## Critical Context
- Regression 13G: 321/321 casos pasaron

## Relevant Files
- `apps/api/src/modules/xml-audit/sat-catalogs/importer/*` - infraestructura importación
- `apps/api/src/modules/xml-audit/sat-catalogs/importer/fixtures/*` - samples CSV (8 archivos)
- `apps/api/src/modules/xml-audit/xml-wellformedness.helper.ts` - validación wellformedness
- `apps/api/src/modules/xml-audit/test-fixtures/*` - banco sintético (42 fixtures)
- `docs/XML_AUDIT_WELLFORMEDNESS.md` - documentación wellformedness
- `docs/XML_AUDIT_SAT_CATALOGS_STATUS.md` - documentación catálogos