# 13G - Síntesis y Mínimos

## Goal
Completar banco de XMLs sintéticos (40 fixtures mínimo), arquitectura XSD/cripto preparada, matrices por complemento, validación wellformedness, y regresión 319/319.

## Constraints & Preferences
- No descargar XSDs ni hacer scraping SAT
- No agregar dependencias nuevas
- No tocar Prisma ni endpoints
- No exponer XML fuente, normalizedXml.content, sellos, certificados
- Mantener typecheck/lint/regresión verdes

## Progress
### Done
- ✅ XSD offline: tipos, registry (11 schemas), unavailable adapter, service integrado
- ✅ Cripto offline: tipos, registry (4 assets), unavailable adapter, inspector seguro
- ✅ Matrices complementos: 100 reglas baseline (Pagos, Nómina, Carta Porte, Comercio Exterior, Retenciones)
- ✅ Fixtures sintéticos: 42 fixtures totales (8+8+9+9+8)
- ✅ Tests regresión: 319/319 casos pasaron
- ✅ Well-formedness validation: helper creado, integrado en analyzeCfdi ANTES del parse
- ✅ Tests malformed: LQ-LX agregados (7 casos)

### In Progress
- (none)

### Blocked
- (none)

## Key Decisions
- Adapter `UnavailableXsdValidationAdapter` y `UnavailableCryptoValidationAdapter` por falta de assets locales
- Registry XSD marca schemas como `configured: false`, registry crypto `configured: false`
- Metadata segura de certificado con fingerprint SHA256 truncado, sin exponer PEM completo
- Fixtures sintéticos con marcador `SYNTHETIC_TEST_ONLY_DO_NOT_USE_AS_FISCAL_DOCUMENT`

## Next Steps
- (none - objetivo completado)

## Critical Context
- Regression 13G: 319/319 casos pasaron
- Cada fixture usa RFCs ficticios (AAA010101AAA, XAXX010101000, BBB010101BBB)
- Certificados como placeholder `MII...` no reales
- No hay validación XSD real sin schemas locales
- No hay validación cripto real sin XSLT/trust

## Relevant Files
- `apps/api/src/modules/xml-audit/xsd/*`: arquitectura XSD preparada
- `apps/api/src/modules/xml-audit/crypto/*`: arquitectura cripto preparada
- `apps/api/src/modules/xml-audit/xml-wellformedness.helper.ts`: validación wellformedness
- `apps/api/src/modules/xml-audit/sat-matrix/complementos/*`: 100 reglas por complemento
- `apps/api/src/modules/xml-audit/test-fixtures/*`: banco sintético de XMLs (42 fixtures)
- `docs/XML_AUDIT_XSD_VALIDATION.md`: documentación XSD
- `docs/XML_AUDIT_CRYPTO_VALIDATION.md`: documentación cripto
- `docs/XML_AUDIT_COMPLEMENT_MATRIX_MAPPING.md`: matrices complementos
- `docs/XML_AUDIT_SYNTHETIC_FIXTURES.md`: documentación fixtures
- `docs/XML_AUDIT_WELLFORMEDNESS.md`: documentación wellformedness