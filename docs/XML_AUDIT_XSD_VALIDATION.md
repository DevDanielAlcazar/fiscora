# XSD Validation — Auditoría XML

## Objetivo

Implementar infraestructura honesta de XSD: registry de schemas esperados, preflight de namespaces/schemaLocation, trazabilidad en analysisMeta, **sin afirmar validación formal si no se ejecutó**.

## Ubicación
`apps/api/src/modules/xml-audit/xsd/`

## Archivos
| Archivo | Función |
|--------|---------|
| `xsd-validation.types.ts` | Tipos: XsdValidationStatus, XsdSchemaPreflightEntry, XsdValidationSummary |
| `xsd-schema.registry.ts` | Registry de 11 schemas SAT esperados |
| `xsd-preflight.helper.ts` | Extracción de schemaLocation, detección de namespaces |
| `xsd-validation.service.ts` | API principal: validateXmlAgainstConfiguredXsd |
| `xsd-validation.sanitizer.ts` | Sanitización de metadata XSD |

## Status de XSD

| Status | Significado |
|--------|-------------|
| `NOT_CONFIGURED` | No hay schemas configurados |
| `PENDING_SCHEMA_ASSETS` | Assets XSD locales pendientes |
| `READY_NOT_EXECUTED` | Assets presentes, validación no ejecutada |
| `EXECUTED` | Validación XSD real ejecutada |
| `FAILED` | Error durante validación |

## Coverage Status

| Status | Significado |
|--------|-------------|
| `MISSING_LOCAL_ASSET` | Namespace detectado pero asset faltante |
| `LOCAL_ASSET_PRESENT` | Schema local disponible |
| `OPTIONAL` | Schema opcional, no detectado |
| `UNKNOWN_NAMESPACE` | Namespace desconocido |

## Schemas registrados
- CFDI 4.0
- TimbreFiscalDigital 1.1
- Pagos 2.0
- Nómina 1.2
- Carta Porte 3.0
- Carta Porte 3.1
- Comercio Exterior 2.0
- Retenciones 2.0
- Impuestos Locales
- Leyendas Fiscales
- Donatarias

## Qué sí hace

- Registry de schemas esperados con namespaces y paths
- Preflight: extrae schemaLocation pairs del XML
- Preflight: detecta namespaces usados
- Preflight: verifica si assets locales existen
- Metadata segura en `analysisMeta.xsdValidationSummary`

## Qué no hace todavía

- Validación formal XSD real (requiere assets oficiales)
- Descarga automática de XSDs SAT
- Consulta a SAT
- No crea findings críticos por XSD pendiente

## Cargar XSDs oficiales manualmente

1. Descargar XSDs oficiales SAT
2. Colocar en `xsd/assets/` siguiendo paths del registry
3. Reiniciar servidor - se detectará automáticamente

## Riesgos

- No confiar en xsdValidation sin `formalValidationExecuted: true`
- Los XML pueden tener namespaces correctos pero estructura inválida

## Roadmap

1. Cargar XSDs oficiales en `xsd/assets/`
2. Elegir librería/adaptador de validación controlada
3. Ejecutar validación XSD real
4. Versionar/hash de assets XSD
5. Integration tests con XSDs oficiales