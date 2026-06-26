# Matrices por complemento SAT vs Fiscora

## Objetivo

Medir cobertura por complemento. Preparar cierre forense por módulo.

## Alcance

Complementos:
- Pagos 2.0 (20 reglas)
- Nómina 1.2 (20 reglas)
- Carta Porte (20 reglas)
- Comercio Exterior (20 reglas)
- Retenciones 2.0 (20 reglas)

## Advertencia

Matriz interna baseline. No sustituye documentos oficiales SAT. Requiere contraste oficial antes de declarar cobertura completa.

## Resumen general

| Complemento | Total reglas | Directas | Requiere catálogo | Requiere XSD | Requiere cripto |
|-------------|--------------|----------|-------------------|---------------|-----------------|
| PAGOS_20 | 20 | 20 | 2 | 0 | 0 |
| NOMINA_12 | 20 | 20 | 0 | 0 | 0 |
| CARTA_PORTE | 20 | 20 | 1 | 0 | 0 |
| COMERCIO_EXTERIOR | 20 | 20 | 0 | 0 | 0 |
| RETENCIONES_20 | 20 | 20 | 2 | 0 | 1 |

## Gaps comunes

- Catálogos oficiales completos (CLAVE_UNIDAD, IMPUESTOS_RETENCION, etc.)
- XSD local real para validación estructural
- Validación cripto real con XSLT/trust
- Casos especiales no cubiertos (IEPS complejo, retenciones de divisas)
- Estado SAT online no incluido

## Recomendación por complemento

- **Pagos**: alto nivel de cobertura funcional, requiere catálogos oficiales para códigos de impuestos.
- **Nómina**: requiere catálogos oficiales completos para códigos de percepciones/deducciones.
- **Carta Porte**: requiere catálogos extensos (BienesTransp) y XSD.
- **Comercio Exterior**: requiere catálogas aduaneras y XSD.
- **Retenciones**: requiere XSD y catálogos.

## Fixtures sintéticos 13G

Ver `docs/XML_AUDIT_SYNTHETIC_FIXTURES.md` para el banco de XMLs sintéticos que validan estos escenarios.