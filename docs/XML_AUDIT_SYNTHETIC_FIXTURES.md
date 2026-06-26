# Banco de XMLs sintéticos — Auditoría XML

## Objetivo

Fortalecer regresión. Probar escenarios representativos. Evitar uso de XMLs reales.

## Principios

- Sintéticos generados en memoria.
- No fiscales. No usarse en producción.
- Sin RFCs reales (usar AAA010101AAA, XAXX010101000, BBB010101BBB).
- Sin certificados/sellos reales (usar placeholders "sig", "MII...").

## Cobertura por complemento

| Complemento | Fixtures | Gaps |
|-------------|----------|------|
| PAGOS_20 | 5 | 0 |
| NOMINA_12 | 4 | 0 |
| CARTA_PORTE | 4 | 0 |
| COMERCIO_EXTERIOR | 4 | 0 |
| RETENCIONES_20 | 4 | 0 |

## Seguridad

Marcador: `<!-- SYNTHETIC_TEST_ONLY_DO_NOT_USE_AS_FISCAL_DOCUMENT -->`
No XML de clientes, sin certificados reales, sin sellos reales, no persisten en runtime.