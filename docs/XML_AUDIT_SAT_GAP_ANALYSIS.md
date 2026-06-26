# Matriz SAT vs Motor Fiscora — Gap Analysis

**Fecha:** Fri Jun 25 2026  
**Motor:** Auditoría XML v1.0 + arquitectura XSD + arquitectura cripto + matriz complementos + fixtures sintéticos (13G)  
**Regresión:** 308/308 tests pasados

---

## 1. Resumen ejecutivo

| Aspecto | Estado |
|---------|--------|
| Total findings implementados | ~85 códigos únicos |
| Validaciones SAT directas | ~45 códigos |
| Validaciones forenses/heurísticas Fiscora | ~40 códigos |
| Cobertura por módulo | Variable (ver tabla 3) |
| XSD formal implementado | Arquitectura preparada (13D) |
| Cadena original/sello criptográfico | Arquitectura preparada (13E) |
| Matriz complementos SAT | Implementada (13F) |

**Conclusión:** El motor está **listo funcionalmente** pero **pendiente cobertura SAT exhaustiva** y **validación forense avanzada**.

---

## 2. Fuentes oficiales a contrastar manualmente

| Fuente | Tipo | Estado |
|--------|------|--------|
| Matriz de errores CFDI 4.0 | PDF/XLS | Pendiente mapear |
| Anexo 20 Guía de llenado CFDI 4.0 | PDF | Pendiente |
| Guía complemento de pagos 2.0 | PDF | Pendiente |
| Guía recibo de nómina | PDF | Pendiente |
| Guía Carta Porte 3.0 | PDF | Pendiente |
| Guía Comercio Exterior 1.3 | PDF | Pendiente |
| Matriz Retenciones 2.0 | PDF | Pendiente |
| Catálogos CFDI vigentes | XML | Pendiente |
| Esquemas XSD oficiales | XSD | Pendiente |

---

## 3. Cobertura actual por módulo

| Módulo | Cobertura | Códigos Fiscora | Tests | Nivel |
|--------|-----------|-----------------|-------|------|
| CFDI Base | ✅ Completo | 25+ | Sí | Alto |
| Versiones CFDI | ✅ | 3+ | Sí | Alto |
| Emisor/Receptor | ✅ | 15+ | Sí | Alto |
| RFC genéricos/extranjeros | ✅ | 5+ | Sí | Alto |
| Uso CFDI | ✅ Parcial regex | 2+ | Sí | Medio |
| Régimen fiscal | ✅ Parcial regex | 2+ | Sí | Medio |
| Domicilio fiscal | ✅ Básico | 1+ | Sí | Básico |
| Conceptos | ✅ | 12+ | Sí | Alto |
| Impuestos por concepto | ✅ | 7+ | Sí | Alto |
| Impuestos globales | ✅ | 3+ | Sí | Alto |
| Totales | ✅ | 5+ | Sí | Alto |
| Timbre Fiscal Digital | ✅ | 12+ | Sí | Alto |
| Sellos/certificados | ✅ Metadata | 4+ | Sí | Medio |
| CFDI relacionados | ✅ | 5+ | Sí | Alto |
| Complemento de pagos | ✅ | 20+ | Sí | Alto |
| Nómina | ✅ | 8+ | Sí | Alto |
| Carta Porte | ✅ | 15+ | Sí | Alto |
| Comercio Exterior | ✅ | 10+ | Sí | Alto |
| Retenciones | ✅ | 15+ | Sí | Alto |
| Impuestos Locales | ⚠️ Básico | 2+ | Sí | Básico |
| Leyendas Fiscales | ⚠️ Básico | 2+ | Sí | Básico |
| Donatarias | ⚠️ Básico | 2+ | Sí | Básico |
| Addenda | ✅ Metadata | 3+ | Sí | Básico |
| Catálogos | ⚠️ Heurístico | 5+ | Sí | Medio |
| Coherencia transversal | ✅ | 5+ | Sí | Alto |

---

## 4. Findings inventariados

### 4.1 Tax Advanced Validations (13 códigos)

| Código | Severidad | Categoría | Condición | SAT Directa | Forense |
|--------|-----------|-----------|-----------|-------------|---------|
| TAX_BASE_EXCEEDS_CONCEPT_AMOUNT_REVIEW | WARNING | TAX | base > importe concepto | ✅ | ✅ |
| TAX_AMOUNT_NEGATIVE_REVIEW | WARNING | TAX | importe negativo | ✅ | ✅ |
| TAX_RATE_NEGATIVE_REVIEW | WARNING | TAX | tasa negativa | ✅ | ✅ |
| TAX_RATE_TOO_HIGH_REVIEW | INFO | TAX | tasa > 100% | ✅ | ✅ |
| TAX_EXENTO_WITH_RATE_REVIEW | INFO | TAX | TipoFactor=Exento + tasa | ✅ | ✅ |
| TAX_TASA_ZERO_WITH_AMOUNT_REVIEW | WARNING | TAX | tasa 0 + importe > 0 | ✅ | ✅ |
| RETENTION_ISR_RATE_UNUSUAL_REVIEW | INFO | TAX | tasa ISR retención inusual | ✅ Heurística | ✅ |
| RETENTION_IVA_RATE_UNUSUAL_REVIEW | INFO | TAX | tasa IVA retención inusual | ✅ Heurística | ✅ |
| RETENTION_IEPS_REVIEW | INFO | TAX | IEPS retención detectada | ✅ | ✅ |
| GLOBAL_TAX_BASE_SUM_MISMATCH | WARNING | TAX | base conceptos != global | ✅ | ✅ |
| CFDI_TOTAL_WITH_CONCEPT_TAXES_RECALC_REVIEW | WARNING | TAX | total inconsistente | ✅ | ✅ |
| OBJETOIMP_01_WITH_GLOBAL_TAXES_REVIEW | WARNING | TAX | ObjetoImp 01 + global taxes | ✅ | ✅ |
| OBJETOIMP_MIXED_WITHOUT_CLEAR_TAXES_REVIEW | INFO | TAX | ObjetoImp mixto | ✅ Heurística | ✅ |

### 4.2 Concept Validations (12 códigos)

| Código | Severidad | Categoría | Condición | SAT Directa |
|--------|-----------|-----------|-----------|-------------|
| CONCEPT_MISSING_CLAVE_UNIDAD | WARNING | CONCEPTS | ClaveUnidad faltante | ✅ |
| CONCEPT_DESCRIPTION_TOO_SHORT_REVIEW | INFO | CONCEPTS | descripción < 3 chars | ✅ |
| CONCEPT_NO_IDENTIFICACION_DUPLICATED_REVIEW | INFO | CONCEPTS | NoIdentif duplicado | ✅ Heurística |
| CONCEPT_UNIT_VALUE_MISSING | WARNING | CONCEPTS | ValorUnitario faltante | ✅ |
| CONCEPT_UNIT_VALUE_NEGATIVE | WARNING | CONCEPTS | ValorUnitario negativo | ✅ |
| CONCEPT_IMPORT_MISSING | WARNING | CONCEPTS | Importe faltante | ✅ |
| CONCEPT_IMPORT_NEGATIVE | WARNING | CONCEPTS | Importe negativo | ✅ |
| CONCEPT_ZERO_IMPORT_REVIEW | INFO | CONCEPTS | Importe 0 | ✅ Heurística |
| CONCEPT_DISCOUNT_NEGATIVE | WARNING | CONCEPTS | descuento negativo | ✅ |
| CONCEPT_OBJETO_IMP_04_08_REVIEW | INFO | CONCEPTS | ObjetoImp 04-08 | ✅ Heurística |
| CONCEPT_CLAVE_PROD_SERV_FORMAT_REVIEW | INFO | CONCEPTS | CPS no 8 dígitos | ✅ Heurística |
| CONCEPT_DECIMALS_EXCESS_REVIEW | INFO | CONCEPTS | > 6 decimales | ✅ Heurística |

### 4.3 Stamp Validations (12 códigos)

| Código | Severidad | Categoría | Condición | SAT Directa |
|--------|-----------|-----------|-----------|-------------|
| TFD_UUID_MISSING | WARNING | TFD | UUID faltante | ✅ |
| TFD_VERSION_REVIEW | WARNING | TFD | versión != 1.0/1.1 | ✅ Heurística |
| TFD_UUID_LOWERCASE_REVIEW | INFO | TFD | UUID minúsculas | ✅ Heurística |
| TFD_FECHA_TIMBRADO_INVALID | WARNING | TFD | fecha inválida | ✅ |
| TFD_FECHA_TIMBRADO_FUTURE_REVIEW | INFO | TFD | fecha futura | ✅ Heurística |
| TFD_FECHA_TIMBRADO_TOO_FAR_AFTER_FECHA_CFDI_REVIEW | INFO | TFD | > 72h diferencia | ✅ Heurística |
| TFD_RFC_PROV_CERTIF_FORMAT_REVIEW | WARNING | TFD | RFC PAC formato | ✅ Heurística |
| TFD_RFC_PROV_CERTIF_GENERIC_REVIEW | WARNING | TFD | RFC PAC genérico | ✅ Heurística |
| TFD_SELLO_CFD_DIFFERS_FROM_COMPROBANTE_SELLO_REVIEW | WARNING | TFD | sellos diferentes | ✅ Forense |
| TFD_SELLO_CFD_TOO_SHORT_REVIEW | INFO | TFD | sello corto | ✅ Forense |
| COMPROBANTE_CERTIFICADO_TOO_SHORT_REVIEW | INFO | TFD | certificado corto | ✅ Forense |
| TFD_PRESENT_BUT_ISSTAMPED_FALSE_REVIEW | WARNING | TFD | TFD incompleto | ✅ Forense |

### 4.4 Party Validations (15 códigos)

| Código | Severidad | Categoría | Condición | SAT Directa |
|--------|-----------|-----------|-----------|-------------|
| EMISOR_RFC_MISSING | WARNING | PARTIES | RFC emisor faltante | ✅ |
| EMISOR_RFC_FORMAT_REVIEW | WARNING | PARTIES | RFC formato inválido | ✅ |
| EMISOR_NAME_TOO_SHORT_REVIEW | INFO | PARTIES | nombre corto | ✅ Heurística |
| EMISOR_REGIMEN_FISCAL_FORMAT_REVIEW | WARNING | PARTIES | régimen no 3 dígitos | ✅ |
| RECEPTOR_RFC_MISSING | WARNING | PARTIES | RFC receptor faltante | ✅ |
| RECEPTOR_RFC_FORMAT_REVIEW | WARNING | PARTIES | RFC formato inválido | ✅ |
| RECEPTOR_NAME_TOO_SHORT_REVIEW | INFO | PARTIES | nombre corto | ✅ Heurística |
| RECEPTOR_REGIMEN_FISCAL_FORMAT_REVIEW | WARNING | PARTIES | régimen no 3 dígitos | ✅ |
| RECEPTOR_USO_CFDI_FORMAT_REVIEW | INFO | PARTIES | UsoCFDI formato | ✅ Heurística |
| RECEPTOR_GENERIC_FOREIGN_WITHOUT_RESIDENCIA_FISCAL | WARNING | PARTIES | receptor extranjero sin residencia | ✅ |
| RECEPTOR_GENERIC_FOREIGN_WITHOUT_NUM_REG_ID_TRIB_REVIEW | WARNING | PARTIES | receptor extranjero sin numRegIdTrib | ✅ |
| RECEPTOR_RESIDENCIA_FISCAL_WITH_NATIONAL_RFC_REVIEW | INFO | PARTIES | México + RFC nacional | ✅ Heurística |
| EMISOR_RECEPTOR_SAME_NAME_DIFFERENT_RFC_REVIEW | INFO | PARTIES | mismo nombre RFC diferente | ✅ Heurística |
| NOMINA_RECEPTOR_RFC_GENERIC_REVIEW | WARNING | PARTIES | nómina RFC genérico | ✅ Heurística |
| TRASLADO_RECEPTOR_USO_CFDI_REVIEW | INFO | PARTIES | traslado UsoCFDI != S01 | ✅ Heurística |

---

## 5. Cobertura superior a SAT / forense (Fiscora)

| Capacidad | Implementación | Valor añadido |
|-----------|----------------|--------------|
| Risk Score | ✅ | Scoring 0-100 con bandas HEALTHY/REVIEW/HIGH_RISK |
| Coverage Confidence | ✅ | Cobertura por módulo con bands de confianza |
| Plan de acción | ✅ | Urgencia/responsable/esfuerzo sugerido |
| Glosario dinámico | ✅ | Agrupación por código/título/impacto |
| Evidence location/valueTrace | ✅ | Ubicación exacta del hallazgo + diferencias numéricas |
| Normalización técnica segura | ✅ | Detección/recuperación BOM, contenido previo |
| Detección BOM/contenido previo | ✅ | Diagnóstico técnico estructura |
| Coherencia transversal | ✅ | Validación entre módulos (impuestos/totals) |
| Resumen ejecutivo | ✅ | Title/message/action recomendado |
| Navegación ZIP por riesgo | ✅ | Score lote/archivo + drivers de riesgo |
| Seguridad de payload | ✅ | Sanitización sin normalizedXml.content |
| Hallazgos operativos soporte | ✅ | Action groups para soporte/proveedor |

---

## 6. Gaps potenciales

### A) Validación XSD formal
| Gap | Estado |
|-----|--------|
| CFDI 4.0 XSD | Pendiente |
| TFD XSD | Pendiente |
| Complementos XSD | Pendiente |
| Retenciones XSD | Pendiente |

### B) Catálogos oficiales completos
| Catálogo | Estado |
|----------|--------|
| c_FormaPago | Heurístico |
| c_MetodoPago | Heurístico |
| c_UsoCFDI | Regex parcial |
| c_RegimenFiscal | Heurístico |
| c_TipoDeComprobante | Heurístico |
| c_Moneda | Heurístico |
| c_ObjetoImp | Heurístico |
| c_Impuesto | Heurístico |
| c_TipoFactor | Heurístico |
| c_TasaOCuota | Heurístico (tasas ISR/IVA) |

### C) Sello/certificado/cadena original
| Validación | Estado |
|------------|--------|
| Validación criptográfica offline | Pendiente |
| Certificado emisor vs RFC | Pendiente |
| Vigencia certificado | Pendiente |
| Cadena original TFD | Pendiente |

### D) Estado SAT/cancelación
| Validación | Estado |
|------------|--------|
| Validación online cancelación | Pendiente (decisión producto) |

### E) Casos especiales
| Caso | Estado |
|------|--------|
| Público en general | Cubierto (RFC genérico) |
| Factura global | Cubierto (Tipo G) |
| Anticipos | Parcial (ObjetoImp 04-08) |
| Sustitución | Pendiente |
| Traslados/nota crédito | Parcial (Tipo T) |
| Pago con relación | Cubierto (complemento pago) |
| Complementos múltiples | Cubierto |

---

## 7. Matriz de prioridad para siguientes fases

| Gap | Impacto | Dificultad | Recomendación | Fase |
|-----|---------|------------|---------------|------|
| Catálogos oficiales SAT | Alto | Media | Descargar/validar catálogos | 13B |
| Matriz CFDI 4.0 oficial | Alto | Alta | Mapear códigos SAT a Fiscora | 13C |
| XSD offline parsing | Alto | Media | Integrar validación XSD | 13D |
| Cadena original offline | Alto | Alta | Implementar validación criptográfica | 13E |
| Matrices oficiales complementos | Medio | Media | Mapear pagos/nómina/carta porte/CE | 13F |
| Casos especiales fiscales | Medio | Baja | Validaciones específicas | 13G |
| Validación SAT online | Bajo | Alta | Opcional según roadmap | 13H |
| Banco XMLs sintéticos | Medio | Baja | Tests adicionales | 13I |

---

## 8. Decisión recomendada

**Opción B: No cerrar aún como forense; cerrar solo como funcional robusto y continuar con cobertura SAT avanzada.**

### Razonamiento:
1. **Funcional robusto:** El motor tiene 85+ findings, 270 tests, performance frontend, UX operativa
2. **Pendientes críticos:** No hay matriz SAT oficial mapeada ni XSD/cadena original implementados
3. **Calidad forense requiere:** Validación XSD + catálogos oficiales + cadena original antes de declarar "forense"

### Recomendación:
- ✅ Cerrar módulo XML como **funcional v1** (listo para beta funcional)
- 🔁 Continuar fases 13B-13E antes de declarar **cobertura SAT avanzada/forense**
- 📋 Documentar que es una herramienta de **diagnóstico técnico-fiscal** no un validador oficial SAT

---

## 9. Verificación

| Comando | Resultado |
|---------|-----------|
| pnpm typecheck frontend | ✅ Pasa |
| pnpm typecheck backend | ✅ Pasa |
| pnpm --filter @fiscora/api xml-audit:regression | ✅ 270/270 |