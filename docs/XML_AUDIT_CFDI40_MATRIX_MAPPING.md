# Matriz CFDI 4.0 vs Fiscora — Mapeo de Cobertura

**Fecha:** Thu Jun 25 2026  
**Motor:** Auditoría XML v1.0 + infraestructura catálogos + arquitectura cripto (13E)  
**Regresión:** 291/291 tests pasados

---

## 1. Objetivo

- Medir cobertura SAT/Fiscora con matrices internas.
- Distinguir reglas oficiales, heurísticas y forenses.
- Identificar gaps antes de declarar calidad forense.

---

## 2. Advertencia de alcance

Esta matriz es **interna y representativa**, no copia oficial completa SAT.

- Debe contrastarse contra fuentes oficiales vigentes.
- No sustituye validación SAT ni XSD.
- Marcada como `NEEDS_OFFICIAL_CONFIRMATION` donde se requiera.

---

## 3. Resumen de cobertura

| Métrica | Valor |
|---------|-------|
| Total reglas mapeadas | 29 |
| Cubiertas directas | 11 |
| Cubiertas parciales | 6 |
| Cubiertas heurísticas | 4 |
| No cubiertas | 4 |
| Requieren confirmación oficial | 0 |
| Requieren catálogo completo | 7 |
| Requieren XSD | 1 |
| Requieren validación cripto | 1 |
| Requieren validación SAT online | 0 |

---

## 4. Cobertura por módulo

| Módulo | Total | Directa | Parcial | Heurística | No cubierta |
|--------|-------|---------|---------|------------|-------------|
| CFDI_BASE | 4 | 1 | 2 | 1 | 0 |
| EMISOR_RECEPTOR | 3 | 2 | 1 | 0 | 0 |
| CONCEPTOS | 3 | 1 | 1 | 1 | 0 |
| IMPUESTOS_CONCEPTO | 3 | 2 | 1 | 0 | 0 |
| TOTALES | 2 | 1 | 0 | 1 | 0 |
| TIMBRE_FISCAL_DIGITAL | 2 | 1 | 0 | 1 | 0 |
| SELLOS_CERTIFICADOS | 1 | 0 | 0 | 0 | 1 |
| CFDI_RELACIONADOS | 2 | 1 | 1 | 0 | 0 |
| COMPLEMENTO_PAGO | 2 | 1 | 1 | 0 | 0 |
| SEGURIDAD_PAYLOAD | 2 | 0 | 0 | 2 | 0 |

---

## 5. Mapeo por módulo

### A) CFDI Base
| ID | Regla | Fuente | Cobertura | Código Fiscora | Requiere | Notas |
|----|-------|--------|-----------|----------------|----------|-------|
| A1 | Versión 4.0 | Anexo 20 | COVERED_DIRECT | CFDI_VERSION_INCONSISTENT_REVIEW | - | Test: IS |
| A2 | TipoDeComprobante | Anexo 20 | COVERED_DIRECT | CATALOG_TIPO_COMPROBANTE_UNKNOWN_REVIEW | - | - |
| A3 | Moneda ISO | Anexo 20 | COVERED_PARTIAL | CATALOG_MONEDA_UNKNOWN_REVIEW | Catalog | Catálogo parcial |
| A4 | TipoCambio requerido | Guía | COVERED_DIRECT | IX) Moneda USD sin TipoCambio | - | - |
| A5 | Exportación | Anexo 20 | COVERED_DIRECT | CATALOG_EXPORTACION_UNKNOWN_REVIEW | - | - |
| A6 | Subtotal negativo | Guía | NOT_COVERED | - | - | Gap pendiente |
| A7 | Total vs cálculo | Anexo 20 | COVERED_DIRECT | TOT_VS_CONCEPT_MATCH_REVIEW, CFDI_TOTAL_WITH_CONCEPT_TAXES_RECALC_REVIEW | - | - |
| A8 | LugarExpedicion | Heurística | COVERED_HEURISTIC | - | Xsd | No implementado |

### B) Emisor/Receptor
| ID | Regla | Fuente | Cobertura | Código Fiscora | Requiere | Notas |
|----|-------|--------|-----------|----------------|----------|-------|
| B1 | RFC emisor faltante | Anexo 20 | COVERED_DIRECT | EMISOR_RFC_MISSING | - | - |
| B2 | RFC receptor faltante | Anexo 20 | COVERED_DIRECT | RECEPTOR_RFC_MISSING | - | - |
| B3 | UsoCFDI catálogo | Anexo 20 | COVERED_PARTIAL | RECEPTOR_USO_CFDI_FORMAT_REVIEW | Catalog | Catálogo parcial |
| B4 | Régimen receptor | Anexo 20 | COVERED_DIRECT | RECEPTOR_REGIMEN_FISCAL_FORMAT_REVIEW | - | - |

### C) Conceptos
| ID | Regla | Fuente | Cobertura | Código Fiscora | Requiere | Notas |
|----|-------|--------|-----------|----------------|----------|-------|
| C1 | ClaveProdServ formato | Anexo 20 | COVERED_HEURISTIC | CONCEPT_CLAVE_PROD_SERV_FORMAT_REVIEW | Catalog | 8 dígitos |
| C2 | ClaveUnidad requerida | Anexo 20 | COVERED_DIRECT | CONCEPT_MISSING_CLAVE_UNIDAD, CONCEPT_UNIDAD_WITHOUT_CLAVE_UNIDAD_REVIEW | Catalog | - |
| C3 | Importe consistencia | Anexo 20 | COVERED_DIRECT | CONCEPT_ROUNDING_DIFFERENCE_REVIEW | - | - |
| C4 | ObjetoImp catálogo | Anexo 20 | COVERED_PARTIAL | CONCEPT_OBJETO_IMP_04_08_REVIEW | Catalog | - |

### D) Impuestos
| ID | Regla | Fuente | Cobertura | Código Fiscora | Requiere | Notas |
|----|-------|--------|-----------|----------------|----------|-------|
| D1 | Impuesto catálogo | Anexo 20 | COVERED_DIRECT | CATALOG_CONCEPT_TAX_IMPUESTO_UNKNOWN_REVIEW | - | - |
| D2 | TipoFactor catálogo | Anexo 20 | COVERED_DIRECT | CATALOG_CONCEPT_TAX_TIPO_FACTOR_UNKNOWN_REVIEW | - | - |
| D3 | TasaOCuota rango | Anexo 20 | COVERED_DIRECT | TAX_RATE_TOO_HIGH_REVIEW, TAX_TASA_ZERO_WITH_AMOUNT_REVIEW | - | - |

### E) TFD/Sellos
| ID | Regla | Fuente | Cobertura | Código Fiscora | Requiere | Notas |
|----|-------|--------|-----------|----------------|----------|-------|
| E1 | TFD estructura | Anexo 20 | COVERED_DIRECT | - | Xsd | XSD pendiente |
| E2 | UUID faltante | Anexo 20 | COVERED_DIRECT | TFD_UUID_MISSING | - | - |
| E3 | Fecha timbrado | Matriz | COVERED_HEURISTIC | TFD_FECHA_TIMBRADO_FUTURE_REVIEW | - | - |
| E4 | Validación cripto sello | Matriz | NOT_COVERED | - | Crypto | Gap crítico |

### F) Relacionados
| ID | Regla | Fuente | Cobertura | Código Fiscora | Requiere | Notas |
|----|-------|--------|-----------|----------------|----------|-------|
| F1 | TipoRelacion catálogo | Anexo 20 | COVERED_PARTIAL | CATALOG_TIPO_RELACION_UNKNOWN_REVIEW | Catalog | - |
| F2 | UUID relacionado | Anexo 20 | COVERED_DIRECT | CFDI_RELACION_UUID_FORMAT_REVIEW | - | - |

### G) Complemento Pago
| ID | Regla | Fuente | Cobertura | Código Fiscora | Requiere | Notas |
|----|-------|--------|-----------|----------------|----------|-------|
| G1 | Tipo P requiere Pago20 | Guía | COVERED_DIRECT | II) Complemento Pago en Tipo I | - | - |
| G2 | DoctoRelacionado UUID | Guía | COVERED_DIRECT | CFDI_RELACION_UUID_FORMAT_REVIEW | - | - |

### H) Seguridad/Forense
| ID | Regla | Fuente | Cobertura | Código Fiscora | Requiere | Notas |
|----|-------|--------|-----------|----------------|----------|-------|
| H1 | BOM detectado | Fiscora | COVERED_DIRECT | - | - | Forense técnico |
| H2 | Contenido previo | Fiscora | COVERED_DIRECT | - | - | Forense técnico |

---

## 6. Gaps críticos

| Gap | Impacto | Estado |
|-----|---------|--------|
| XSD formal | Alto | Pendiente 13D |
| Validación cripto sello/cadena/certificado | Alto | Pendiente 13E |
| Catálogos oficiales completos | Alto | Pendiente 13B |
| Matriz oficial complementos | Medio | Pendiente 13F |
| Estado SAT online cancelación | Bajo | Opcional 13H |

---

## 7. Recomendación

**El módulo sigue listo como V1 beta funcional.**

**No declarar cobertura SAT/forense completa hasta:**
1. 13D XSD offline implementado
2. 13E sello/cadena/certificado validado
3. 13F matrices complementos cargadas
4. Catálogos oficiales completos integrados

La matriz actual proporciona trazabilidad para decisiones posteriores.