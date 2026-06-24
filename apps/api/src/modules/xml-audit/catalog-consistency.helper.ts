import type {
  ConceptInfo,
  CfdiRelations,
  PaymentComplement,
  NominaInfo,
  CartaPorteInfo,
} from "./xml-audit.service.js";
import {
  isKnownTipoComprobante,
  isKnownCurrencyBasic,
  isKnownExportacion,
  isKnownMetodoPago,
  isKnownFormaPago,
  isKnownObjetoImp,
  isKnownImpuesto,
  isKnownTipoFactor,
  isKnownTipoRelacion,
  isKnownRetencionesNacionalidad,
  isKnownCveRetenc,
  isKnownImpuestoRet,
  isKnownRetencionesTipoPago,
  isKnownNominaTipoNomina,
  isKnownNominaTipoRegimen,
  isKnownCartaPorteTranspInternac,
} from "./xml-audit.catalogs.js";

function isNonEmptyString(val: unknown): val is string {
  return typeof val === "string" && val.trim().length > 0;
}

type Severity = "WARNING" | "INFO";

type FindingAdder = (
  code: string,
  severity: Severity,
  title: string,
  message: string,
  recommendedAction: string,
  evidence: { label: string; value?: string }[],
) => void;

export interface CatalogConsistencyContext {
  addFinding: FindingAdder;

  // CFDI
  tipoComprobante?: string | null;
  moneda?: string | null;
  exportacion?: string | null;
  metodoPago?: string | null;
  formaPago?: string | null;
  concepts?: ConceptInfo[];
  cfdiRelations?: CfdiRelations | null;
  paymentComplement?: PaymentComplement | null;
  nomina?: NominaInfo | null;
  cartaPorte?: CartaPorteInfo | null;

  // Retenciones
  retencionesNacionalidad?: string | null;
  retencionesCveRetenc?: string | null;
  retencionesImpuestos?: Array<{ impuesto?: string | null; tipoPagoRet?: string | null }>;
}

function addEvidence(
  field: string,
  value: string,
  allowedValues?: string,
  index?: number,
  extra?: { label: string; value: string },
): { label: string; value?: string }[] {
  const ev: { label: string; value?: string }[] = [{ label: field, value }];
  if (allowedValues) ev.push({ label: "Valores permitidos (ejemplo)", value: allowedValues });
  if (index !== undefined) ev.push({ label: "Índice", value: String(index) });
  if (extra) ev.push(extra);
  return ev;
}

export function validateCatalogConsistency(ctx: CatalogConsistencyContext): void {
  const {
    addFinding,
    tipoComprobante,
    moneda,
    exportacion,
    metodoPago,
    formaPago,
    concepts,
    cfdiRelations,
    paymentComplement,
    nomina,
    cartaPorte,
    retencionesNacionalidad,
    retencionesCveRetenc,
    retencionesImpuestos,
  } = ctx;

  // ── A) CFDI base ──

  // A1) CATALOG_TIPO_COMPROBANTE_UNKNOWN_REVIEW
  if (isNonEmptyString(tipoComprobante) && !isKnownTipoComprobante(tipoComprobante)) {
    addFinding(
      "CATALOG_TIPO_COMPROBANTE_UNKNOWN_REVIEW",
      "WARNING",
      "Tipo de comprobante no reconocido",
      `El valor "${tipoComprobante}" en TipoDeComprobante no está en el catálogo básico.`,
      "Verifica que el tipo de comprobante corresponda a un valor del SAT.",
      addEvidence("TipoDeComprobante", tipoComprobante, "I, E, T, N, P"),
    );
  }

  // A2) CATALOG_MONEDA_UNKNOWN_REVIEW
  if (isNonEmptyString(moneda) && !isKnownCurrencyBasic(moneda)) {
    addFinding(
      "CATALOG_MONEDA_UNKNOWN_REVIEW",
      "INFO",
      "Moneda no reconocida",
      `El valor "${moneda}" en Moneda no está en el catálogo básico.`,
      "Revisa que la moneda sea un código ISO 4217 válido.",
      addEvidence("Moneda", moneda, "MXN, USD, EUR, XXX"),
    );
  }

  // A3) CATALOG_EXPORTACION_UNKNOWN_REVIEW
  if (isNonEmptyString(exportacion) && !isKnownExportacion(exportacion)) {
    addFinding(
      "CATALOG_EXPORTACION_UNKNOWN_REVIEW",
      "WARNING",
      "Clave de exportación no reconocida",
      `El valor "${exportacion}" en Exportacion no está en el catálogo básico.`,
      "Revisa que la clave de exportación sea un valor válido del SAT.",
      addEvidence("Exportacion", exportacion, "01, 02, 03, 04"),
    );
  }

  // A4) CATALOG_METODO_PAGO_UNKNOWN_REVIEW
  if (isNonEmptyString(metodoPago) && !isKnownMetodoPago(metodoPago)) {
    addFinding(
      "CATALOG_METODO_PAGO_UNKNOWN_REVIEW",
      "WARNING",
      "Método de pago no reconocido",
      `El valor "${metodoPago}" en MetodoPago no está en el catálogo básico.`,
      "Revisa que el método de pago sea PUE o PPD.",
      addEvidence("MetodoPago", metodoPago, "PUE, PPD"),
    );
  }

  // A5) CATALOG_FORMA_PAGO_UNKNOWN_REVIEW
  if (isNonEmptyString(formaPago) && !isKnownFormaPago(formaPago)) {
    addFinding(
      "CATALOG_FORMA_PAGO_UNKNOWN_REVIEW",
      "INFO",
      "Forma de pago no reconocida",
      `El valor "${formaPago}" en FormaPago no está en el catálogo básico.`,
      "Revisa que la forma de pago sea un valor del SAT.",
      addEvidence("FormaPago", formaPago, "01–06, 08, 12–15, 17, 23–31, 99"),
    );
  }

  // ── B) Concepto/impuestos ──
  if (concepts) {
    concepts.forEach((c, ci) => {
      // B1) CATALOG_OBJETO_IMP_UNKNOWN_REVIEW
      if (isNonEmptyString(c.objetoImp) && !isKnownObjetoImp(c.objetoImp)) {
        addFinding(
          "CATALOG_OBJETO_IMP_UNKNOWN_REVIEW",
          "WARNING",
          "Objeto de impuesto no reconocido en concepto",
          `El concepto #${ci + 1} tiene ObjetoImp "${c.objetoImp}" fuera del catálogo básico.`,
          "Revisa que el ObjetoImp corresponda al SAT.",
          addEvidence("ObjetoImp", c.objetoImp, "01–08", ci + 1),
        );
      }

      const taxEntries = [...(c.impuestos?.traslados ?? []), ...(c.impuestos?.retenciones ?? [])];
      taxEntries.forEach((t, ti) => {
        // B2) CATALOG_CONCEPT_TAX_IMPUESTO_UNKNOWN_REVIEW
        if (isNonEmptyString(t.impuesto) && !isKnownImpuesto(t.impuesto)) {
          addFinding(
            "CATALOG_CONCEPT_TAX_IMPUESTO_UNKNOWN_REVIEW",
            "WARNING",
            "Impuesto no reconocido en concepto",
            `El concepto #${ci + 1} tiene Impuesto "${t.impuesto}" fuera del catálogo básico.`,
            "Revisa que el impuesto sea 001, 002 o 003.",
            addEvidence("Impuesto", t.impuesto, "001, 002, 003", ci + 1, {
              label: "TaxIndex",
              value: String(ti + 1),
            }),
          );
        }

        // B3) CATALOG_CONCEPT_TAX_TIPO_FACTOR_UNKNOWN_REVIEW
        if (isNonEmptyString(t.tipoFactor) && !isKnownTipoFactor(t.tipoFactor)) {
          addFinding(
            "CATALOG_CONCEPT_TAX_TIPO_FACTOR_UNKNOWN_REVIEW",
            "WARNING",
            "Tipo de factor no reconocido en concepto",
            `El concepto #${ci + 1} tiene TipoFactor "${t.tipoFactor}" fuera del catálogo básico.`,
            "Revisa que el TipoFactor sea Tasa, Cuota o Exento.",
            addEvidence("TipoFactor", t.tipoFactor, "Tasa, Cuota, Exento", ci + 1, {
              label: "TaxIndex",
              value: String(ti + 1),
            }),
          );
        }
      });
    });

    // B4/B5) Global taxes (only from first concept's impuestos, no separate node here)
    // These are covered by the concept-level checks since global taxes are stored as
    // a virtual concept by the extraction logic. The finding codes are intentionally
    // NOT emitted because the concept-level checks already catch them.
  }

  // ── C) CFDI relacionados ──
  if (cfdiRelations?.groups) {
    cfdiRelations.groups.forEach((g, gi) => {
      // C1) CATALOG_TIPO_RELACION_UNKNOWN_REVIEW
      if (isNonEmptyString(g.tipoRelacion) && !isKnownTipoRelacion(g.tipoRelacion)) {
        addFinding(
          "CATALOG_TIPO_RELACION_UNKNOWN_REVIEW",
          "INFO",
          "Tipo de relación no reconocido",
          `El grupo #${gi + 1} tiene TipoRelacion "${g.tipoRelacion}" fuera del catálogo básico.`,
          "Revisa que el tipo de relación sea 01–07.",
          addEvidence("TipoRelacion", g.tipoRelacion, "01–07", gi + 1),
        );
      }
    });
  }

  // ── D) Pago 2.0 ──
  if (paymentComplement?.pagos) {
    paymentComplement.pagos.forEach((p, pi) => {
      // D1) CATALOG_PAYMENT_FORMA_PAGO_UNKNOWN_REVIEW
      if (isNonEmptyString(p.formaDePagoP) && !isKnownFormaPago(p.formaDePagoP)) {
        addFinding(
          "CATALOG_PAYMENT_FORMA_PAGO_UNKNOWN_REVIEW",
          "INFO",
          "Forma de pago no reconocida en complemento Pago",
          `El pago #${pi + 1} tiene FormaDePagoP "${p.formaDePagoP}" fuera del catálogo básico.`,
          "Revisa que la forma de pago sea un valor del SAT.",
          addEvidence("FormaDePagoP", p.formaDePagoP, "01–06, 08, 12–15, 17, 23–31, 99", pi + 1),
        );
      }

      // D2) CATALOG_PAYMENT_MONEDA_UNKNOWN_REVIEW
      if (isNonEmptyString(p.monedaP) && !isKnownCurrencyBasic(p.monedaP)) {
        addFinding(
          "CATALOG_PAYMENT_MONEDA_UNKNOWN_REVIEW",
          "INFO",
          "Moneda no reconocida en complemento Pago",
          `El pago #${pi + 1} tiene MonedaP "${p.monedaP}" fuera del catálogo básico.`,
          "Revisa que la moneda sea un código ISO 4217 válido.",
          addEvidence("MonedaP", p.monedaP, "MXN, USD, EUR, XXX", pi + 1),
        );
      }

      p.documentosRelacionados.forEach((d, di) => {
        // D3) CATALOG_RELATED_DOCUMENT_MONEDA_UNKNOWN_REVIEW
        if (isNonEmptyString(d.monedaDR) && !isKnownCurrencyBasic(d.monedaDR)) {
          addFinding(
            "CATALOG_RELATED_DOCUMENT_MONEDA_UNKNOWN_REVIEW",
            "INFO",
            "Moneda no reconocida en documento relacionado",
            `El documento #${di + 1} del pago #${pi + 1} tiene MonedaDR "${d.monedaDR}" fuera del catálogo básico.`,
            "Revisa que la moneda sea un código ISO 4217 válido.",
            addEvidence("MonedaDR", d.monedaDR, "MXN, USD, EUR, XXX", di + 1, {
              label: "PagoIndex",
              value: String(pi + 1),
            }),
          );
        }

        // D4) CATALOG_RELATED_DOCUMENT_OBJETO_IMP_UNKNOWN_REVIEW
        if (isNonEmptyString(d.objetoImpDR) && !isKnownObjetoImp(d.objetoImpDR)) {
          addFinding(
            "CATALOG_RELATED_DOCUMENT_OBJETO_IMP_UNKNOWN_REVIEW",
            "WARNING",
            "Objeto de impuesto no reconocido en documento relacionado",
            `El documento #${di + 1} del pago #${pi + 1} tiene ObjetoImpDR "${d.objetoImpDR}" fuera del catálogo básico.`,
            "Revisa que el ObjetoImpDR corresponda al SAT.",
            addEvidence("ObjetoImpDR", d.objetoImpDR, "01–08", di + 1, {
              label: "PagoIndex",
              value: String(pi + 1),
            }),
          );
        }

        // DR tax entries
        const drTxs = [
          ...(d.impuestosDR?.trasladosDR ?? []),
          ...(d.impuestosDR?.retencionesDR ?? []),
        ];
        drTxs.forEach((t, ti) => {
          // D5) CATALOG_PAYMENT_DR_TAX_IMPUESTO_UNKNOWN_REVIEW
          if (isNonEmptyString(t.impuestoDR) && !isKnownImpuesto(t.impuestoDR)) {
            addFinding(
              "CATALOG_PAYMENT_DR_TAX_IMPUESTO_UNKNOWN_REVIEW",
              "WARNING",
              "Impuesto no reconocido en documento relacionado",
              `El documento #${di + 1} del pago #${pi + 1} tiene ImpuestoDR "${t.impuestoDR}" fuera del catálogo básico.`,
              "Revisa que el impuesto sea 001, 002 o 003.",
              addEvidence("ImpuestoDR", t.impuestoDR, "001, 002, 003", di + 1, {
                label: "PagoIndex/DRTaxIndex",
                value: `${pi + 1}/${ti + 1}`,
              }),
            );
          }

          // D6) CATALOG_PAYMENT_DR_TAX_TIPO_FACTOR_UNKNOWN_REVIEW
          if (isNonEmptyString(t.tipoFactorDR) && !isKnownTipoFactor(t.tipoFactorDR)) {
            addFinding(
              "CATALOG_PAYMENT_DR_TAX_TIPO_FACTOR_UNKNOWN_REVIEW",
              "WARNING",
              "Tipo de factor no reconocido en documento relacionado",
              `El documento #${di + 1} del pago #${pi + 1} tiene TipoFactorDR "${t.tipoFactorDR}" fuera del catálogo básico.`,
              "Revisa que el TipoFactorDR sea Tasa, Cuota o Exento.",
              addEvidence("TipoFactorDR", t.tipoFactorDR, "Tasa, Cuota, Exento", di + 1, {
                label: "PagoIndex/DRTaxIndex",
                value: `${pi + 1}/${ti + 1}`,
              }),
            );
          }
        });
      });
    });
  }

  // ── E) Nómina ──
  if (nomina) {
    // E1) CATALOG_NOMINA_TIPO_NOMINA_UNKNOWN_REVIEW
    if (isNonEmptyString(nomina.tipoNomina) && !isKnownNominaTipoNomina(nomina.tipoNomina)) {
      addFinding(
        "CATALOG_NOMINA_TIPO_NOMINA_UNKNOWN_REVIEW",
        "WARNING",
        "Tipo de nómina no reconocido",
        `El valor "${nomina.tipoNomina}" en TipoNomina no está en el catálogo básico.`,
        "Revisa que el tipo de nómina sea O (Ordinaria) o E (Extraordinaria).",
        addEvidence("TipoNomina", nomina.tipoNomina, "O, E"),
      );
    }

    // E2) CATALOG_NOMINA_TIPO_REGIMEN_UNKNOWN_REVIEW
    const nominaTipoRegimen = nomina.receptor?.tipoRegimen;
    if (isNonEmptyString(nominaTipoRegimen) && !isKnownNominaTipoRegimen(nominaTipoRegimen)) {
      addFinding(
        "CATALOG_NOMINA_TIPO_REGIMEN_UNKNOWN_REVIEW",
        "INFO",
        "Régimen de nómina no reconocido",
        `El valor "${nominaTipoRegimen}" en TipoRegimen no está en el catálogo básico.`,
        "Revisa que el régimen corresponda al catálogo del SAT.",
        addEvidence("TipoRegimen", nominaTipoRegimen, "02–13, 99"),
      );
    }
  }

  // ── F) Carta Porte ──
  if (cartaPorte) {
    // F1) CATALOG_CARTA_PORTE_TRANSP_INTERNAC_UNKNOWN_REVIEW
    if (
      isNonEmptyString(cartaPorte.transpInternac) &&
      !isKnownCartaPorteTranspInternac(cartaPorte.transpInternac)
    ) {
      addFinding(
        "CATALOG_CARTA_PORTE_TRANSP_INTERNAC_UNKNOWN_REVIEW",
        "WARNING",
        "Transporte internacional no reconocido en Carta Porte",
        `El valor "${cartaPorte.transpInternac}" en TranspInternac no está en el catálogo básico.`,
        "Revisa que el valor sea Sí/No o 0/1.",
        addEvidence("TranspInternac", cartaPorte.transpInternac, "Sí, Si, SI, No, 0, 1"),
      );
    }
  }

  // ── G) Retenciones ──
  // G1) CATALOG_RETENCIONES_NACIONALIDAD_UNKNOWN_REVIEW
  if (
    isNonEmptyString(retencionesNacionalidad) &&
    !isKnownRetencionesNacionalidad(retencionesNacionalidad)
  ) {
    addFinding(
      "CATALOG_RETENCIONES_NACIONALIDAD_UNKNOWN_REVIEW",
      "WARNING",
      "Nacionalidad de Retenciones no reconocida",
      `El valor "${retencionesNacionalidad}" en Nacionalidad no está en el catálogo básico.`,
      "Revisa que la nacionalidad sea Nacional o Extranjero.",
      addEvidence("Nacionalidad", retencionesNacionalidad, "Nacional, Extranjero"),
    );
  }

  // G2) CATALOG_RETENCIONES_CVE_RETENC_UNKNOWN_REVIEW
  if (isNonEmptyString(retencionesCveRetenc) && !isKnownCveRetenc(retencionesCveRetenc)) {
    addFinding(
      "CATALOG_RETENCIONES_CVE_RETENC_UNKNOWN_REVIEW",
      "INFO",
      "Clave de retención no reconocida",
      `El valor "${retencionesCveRetenc}" en CveRetenc no está en el catálogo básico.`,
      "Revisa que la clave de retención corresponda al SAT.",
      addEvidence("CveRetenc", retencionesCveRetenc, "01–26"),
    );
  }

  if (retencionesImpuestos) {
    retencionesImpuestos.forEach((ir, idx) => {
      // G3) CATALOG_RETENCIONES_IMPUESTO_RET_UNKNOWN_REVIEW
      if (
        isNonEmptyString(ir.impuesto) &&
        !isKnownImpuestoRet(ir.impuesto) &&
        !isKnownImpuesto(ir.impuesto)
      ) {
        addFinding(
          "CATALOG_RETENCIONES_IMPUESTO_RET_UNKNOWN_REVIEW",
          "WARNING",
          "Impuesto retenido no reconocido",
          `El ImpRetenido #${idx + 1} tiene Impuesto "${ir.impuesto}" fuera del catálogo básico.`,
          "Revisa que el impuesto retenido sea 001, 002, 003 (o 01, 02, 03).",
          addEvidence("ImpuestoRet", ir.impuesto, "001, 002, 003", idx + 1),
        );
      }

      // G4) CATALOG_RETENCIONES_TIPO_PAGO_RET_UNKNOWN_REVIEW
      if (isNonEmptyString(ir.tipoPagoRet) && !isKnownRetencionesTipoPago(ir.tipoPagoRet)) {
        addFinding(
          "CATALOG_RETENCIONES_TIPO_PAGO_RET_UNKNOWN_REVIEW",
          "INFO",
          "Tipo de pago de retención no reconocido",
          `El ImpRetenido #${idx + 1} tiene TipoPagoRet "${ir.tipoPagoRet}" fuera del catálogo básico.`,
          "Revisa que el TipoPagoRet corresponda al SAT.",
          addEvidence("TipoPagoRet", ir.tipoPagoRet, "Pago definitivo, Pago provisional", idx + 1),
        );
      }
    });
  }
}
