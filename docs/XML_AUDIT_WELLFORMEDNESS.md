# Wellformedness Validation

## Overview
Valida que los XML están bien formados antes del parse fiscal. No corrige el XML, solo detecta errores estructurales.

## Location
`apps/api/src/modules/xml-audit/xml-wellformedness.helper.ts`

## Detección

| Caso | Detección | ErrorCode |
|------|-----------|-----------|
| Complemento después del cierre de Comprobante | Regex + índice de cierre | `XML_MALFORMED_CONTENT_AFTER_ROOT` |
| Segundo cierre de Comprobante | Contar `</cfdi:Comprobante>` | `XML_DUPLICATE_COMPROBANTE_CLOSE` |
| Múltiples Complemento raíz | Regex en XML entero | `XML_MULTIPLE_ROOT_ELEMENTS` |
| Múltiples Retenciones raíz | Regex en XML entero | `XML_MULTIPLE_ROOT_ELEMENTS` |
| Content no whitespace después de Retenciones | Regex después del primer cierre | `XML_MALFORMED_CONTENT_AFTER_ROOT` |

## Resultado
```ts
interface XmlWellFormednessResult {
  isWellFormed: boolean;
  errorCode?: string;
  message?: string;
  evidence?: Record<string, unknown>;
  hasMultipleRootElements?: boolean;
  hasContentAfterRoot?: boolean;
  hasDuplicateComprobanteClose?: boolean;
  hasComplementAfterComprobanteClose?: boolean;
}
```

## Integración
`analyzeCfdi()` llama `validateXmlWellFormedness(xmlContent)` **antes** de `XMLParser.parse()`.

Si el XML no está bien formado, lanza error con `code: XML_MALFORMED` o código específico.