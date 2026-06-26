# Validación criptográfica offline — Auditoría XML

## Objetivo

Validar cadena original, sello CFDI, sello SAT y certificado de forma offline cuando existan assets oficiales locales (XSLT, trust store).

## Estado actual

- Arquitectura creada.
- Adapter `UnavailableCryptoValidationAdapter` por no haber XSLT/trust store.
- Metadata segura de certificado disponible vía `inspectCertificateSafe`.
- Validación real pendiente.

## Assets requeridos

| Asset | Uso | Ruta esperada | Configurado |
|-------|-----|---------------|-------------|
| XSLT CFDI 4.0 | Cadena original CFDI 4.0 | `xsd/assets/xslt/cfdi/4.0/cadenaoriginal_4_0.xslt` | No |
| XSLT TFD 1.1 | Cadena original TFD 1.1 | `xsd/assets/xslt/tfd/1.1/cadenaoriginal_TFD_1_1.xslt` | No |
| Trust SAT | Certificados SAT/PAC | `xsd/assets/trust/sat/` | No |
| Trust PAC | Certificados PAC | `xsd/assets/trust/pac/` | No |

## Qué sí valida ahora

- Presencia de certificado/sello vía reglas existentes.
- Formato básico.
- Metadata segura de certificado si se puede parsear.
- Estado de configuración en `analysisMeta.cryptoValidation`.

## Qué NO valida todavía

- Cadena original real.
- Sello CFDI real.
- Sello SAT real.
- Trust chain SAT/PAC.
- Estado SAT/cancelación.

## Seguridad

- No se expone certificado completo.
- No se expone sello completo.
- No se expone XML.
- Solo metadata segura/hashes.

## Requisitos para validación real

- XSLT oficiales locales.
- Transformador XSLT confiable.
- Verificador de firma compatible.
- Trust store SAT/PAC.
- Tests con XML válido/inválido.