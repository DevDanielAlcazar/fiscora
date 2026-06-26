# Estado de catálogos SAT — Auditoría XML

**Fecha:** Wed Jun 24 2026  
**Estado:** Infraestructura creada, catálogos parciales/curados

---

## 1. Objetivo

- Centralizar catálogos SAT/Fiscora en un registry tipado.
- Soportar vigencias y fechas de validez.
- Mejorar trazabilidad en findings.
- Preparar carga oficial completa.

---

## 2. Estado actual

| Catálogo | Entradas | Fuente | Completeness | Vigencias | Observaciones |
|----------|----------:|--------|--------------|-----------|---------------|
| c_TipoDeComprobante | 5 | FISCORA_CURATED | PARTIAL | No | CFDI 4.0: I, E, T, N, P |
| c_Moneda | 4 | FISCORA_CURATED | PARTIAL | No | MXN, USD, EUR, XXX |
| c_Exportacion | 4 | FISCORA_CURATED | PARTIAL | No | 01-04 |
| c_MetodoPago | 2 | FISCORA_CURATED | PARTIAL | No | PUE, PPD |
| c_FormaPago | 16 | FISCORA_CURATED | PARTIAL | No | 01-06, 08, 12-15, 17, 23-31, 99 |
| c_ObjetoImp | 8 | FISCORA_CURATED | PARTIAL | No | 01-08 |
| c_Impuesto | 3 | FISCORA_CURATED | PARTIAL | No | 001, 002, 003 |
| c_TipoFactor | 3 | FISCORA_CURATED | PARTIAL | No | Tasa, Cuota, Exento |
| c_TipoRelacion | 7 | FISCORA_CURATED | PARTIAL | No | 01-07 |
| c_UsoCFDI | 14 | FISCORA_CURATED | PARTIAL | No | G01-G03, I01-I08, D01-D10, S01, CP01, CN01 |
| c_RegimenFiscal | 14 | FISCORA_CURATED | PARTIAL | No | 601-626 |
| retenciones_CveRetenc | 26 | FISCORA_CURATED | PARTIAL | No | 01-26 |
| retenciones_ImpuestoRet | 3 | FISCORA_CURATED | PARTIAL | No | 001, 002, 003 |
| retenciones_TipoPagoRet | 2 | FISCORA_CURATED | PARTIAL | No | Pago definitivo/provisional |
| nomina_TipoNomina | 2 | FISCORA_CURATED | PARTIAL | No | O, E |
| nomina_TipoRegimen | 12 | FISCORA_CURATED | PARTIAL | No | 02-13, 99 |
| cartaPorte_TranspInternac | 6 | FISCORA_CURATED | PARTIAL | No | Sí/No/0/1/var. |

---

## 3. Catálogos cubiertos parcialmente

| Catálogo | Estado | Próximo paso |
|----------|--------|--------------|
| c_FormaPago | ✅ Parcial | Cargar catálogo oficial completo |
| c_MetodoPago | ✅ Parcial | Cargar catálogo oficial completo |
| c_UsoCFDI | ✅ Parcial | Cargar catálogo oficial completo |
| c_RegimenFiscal | ✅ Parcial | Cargar catálogo oficial completo |
| c_TipoDeComprobante | ✅ Parcial | Completo para CFDI 4.0 |
| c_Moneda | ✅ Parcial | Extensión ISO 4217 |
| c_ObjetoImp | ✅ Parcial | Completo para CFDI 4.0 |
| c_Impuesto | ✅ Parcial | Extensión IEPS codes |
| c_TipoFactor | ✅ Parcial | Completo |
| c_TasaOCuota | ❌ Pendiente | Catálogo oficial de tasas |
| c_TipoRelacion | ✅ Parcial | Completo |
| c_Exportacion | ✅ Parcial | Completo |
| Carta Porte | ✅ Parcial | Ver catálogos CP en sat-catalogs/ |
| Nómina | ✅ Parcial | Ver catálogos NOM en sat-catalogs/ |
| Comercio Exterior | ❌ Pendiente | Catálogo Incoterm/Fracción |
| Retenciones | ✅ Parcial | Ver retenciones/ en sat-catalogs/ |

---

## 4. Pendiente para cobertura oficial completa

1. **Importar catálogos oficiales SAT** desde fuentes controladas (archivos estáticos)
2. **Versionar fuente** con fecha de publicación SAT
3. **Registrar fechas de revisión** y actualización
4. **Cubrir vigencias completas** (validFrom/validTo)
5. **Catálogos grandes** por cargar:
   - c_ClaveProdServ (4+ digitos, 1000+ entradas)
   - c_ClaveUnidad (2-3 chars, 1000+ entradas)
   - c_CodigoPostal (5 dígitos, 10000+ entradas)
   - c_Pais (3 chars, 200+ entradas)
   - Carta Porte extensos
   - Comercio Exterior extensos
   - Nómina extensos

---

## 5. Decisión de producto

- **V1 beta:** Catálogos curados + evidence de parcialidad (actual)
- **Forense avanzado:** Cargar catálogos oficiales completos + vigencias

Los catálogos marcados como `PARTIAL`/`FISCORA_CURATED` NOTIFICAN en el evidence de findings que la cobertura es parcial y requiere contraste contra catálogo oficial.