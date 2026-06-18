export interface ComprobanteConsistencyContext {
  tipoComprobante: string | null;
  metodoPago: string | null;
  formaPago: string | null;
  moneda: string | null;
  exportacion: string | null;
  usoCfdi: string | null;
  receptorRegimenFiscal: string | null;
  receptorRfc: string | null;
  concepts: unknown[];
  paymentComplement: unknown;
  cfdiRelations: unknown;
  globalTaxes: unknown;
  subtotal: string | null;
  total: string | null;
  hasComercioExterior: boolean;
  addFinding: (
    code: string,
    severity: "CRITICAL" | "WARNING" | "INFO",
    title: string,
    message: string,
    recommendedAction: string,
    evidence: { label: string; value?: string }[],
  ) => void;
}

function toStr(val: unknown): string | null {
  if (val === null || val === undefined) return null;
  return String(val).trim();
}

function toNum(val: string | null | undefined): number | null {
  if (val === null || val === undefined) return null;
  const n = parseFloat(val);
  return isNaN(n) ? null : n;
}

export function validateComprobanteConsistency(ctx: ComprobanteConsistencyContext): void {
  const {
    tipoComprobante,
    metodoPago,
    formaPago,
    moneda,
    exportacion,
    usoCfdi,
    concepts,
    subtotal,
    total,
    hasComercioExterior,
    addFinding,
  } = ctx;

  const tc = toStr(tipoComprobante)?.toUpperCase() ?? "";
  const mp = toStr(metodoPago)?.toUpperCase() ?? "";
  const fp = toStr(formaPago)?.toUpperCase() ?? "";
  const mn = toStr(moneda)?.toUpperCase() ?? "";
  const exp = toStr(exportacion) ?? "";
  const uso = toStr(usoCfdi)?.toUpperCase() ?? "";

  const subtotalNum = toNum(subtotal);
  const totalNum = toNum(total);

  function baseEvidence(): { label: string; value?: string }[] {
    return [
      { label: "TipoDeComprobante", value: tc || "—" },
      { label: "MetodoPago", value: mp || "—" },
      { label: "FormaPago", value: fp || "—" },
      { label: "Moneda", value: mn || "—" },
      { label: "Exportacion", value: exp || "—" },
      { label: "UsoCFDI", value: uso || "—" },
      { label: "SubTotal", value: subtotal ?? "—" },
      { label: "Total", value: total ?? "—" },
    ];
  }

  // A) Tipo P / Pago - solo reglas SIN duplicado en servicio
  if (tc === "P") {
    if (mp) {
      addFinding(
        "PAYMENT_SHOULD_NOT_HAVE_METODO_PAGO",
        "INFO",
        "MetodoPago no requerido en comprobante de pago",
        "Los comprobantes de tipo P no deben incluir MetodoPago.",
        "Remover MetodoPago si está presente.",
        baseEvidence(),
      );
    }
  }

  // B) Tipo N / Nómina
  if (tc === "N") {
    if (mn && mn !== "MXN") {
      addFinding(
        "NOMINA_SHOULD_HAVE_MONEDA_MXN",
        "WARNING",
        "Moneda inválida en nómina",
        "Los comprobantes de tipo N deben utilizar moneda MXN.",
        "Ajustar la moneda del CFDI de nómina a MXN.",
        baseEvidence(),
      );
    }
    if (mp) {
      addFinding(
        "NOMINA_SHOULD_NOT_HAVE_METODO_PAGO_REVIEW",
        "INFO",
        "MetodoPago no esperado en nómina",
        "Los comprobantes de tipo N generalmente no requieren MetodoPago.",
        "Revisar si MetodoPago es necesario.",
        baseEvidence(),
      );
    }
    if (fp) {
      addFinding(
        "NOMINA_SHOULD_NOT_HAVE_FORMA_PAGO_REVIEW",
        "INFO",
        "FormaPago no esperada en nómina",
        "Los comprobantes de tipo N generalmente no requieren FormaPago.",
        "Revisar si FormaPago es necesaria.",
        baseEvidence(),
      );
    }
  }

  // C) Tipo T / Traslado
  if (tc === "T") {
    if (totalNum !== null && Math.abs(totalNum) > 0.01) {
      addFinding(
        "TRASLADO_SHOULD_HAVE_TOTAL_ZERO",
        "WARNING",
        "Total distinto de cero en traslado",
        "Los comprobantes de tipo T normalmente deben tener Total igual a cero.",
        "Verificar que el total sea correcto para un CFDI de traslado.",
        baseEvidence(),
      );
    }
    if (subtotalNum !== null && subtotalNum > 0) {
      addFinding(
        "TRASLADO_SHOULD_HAVE_SUBTOTAL_ZERO_OR_REVIEW",
        "INFO",
        "Subtotal mayor a cero en traslado",
        "Los comprobantes de tipo T pueden tener SubTotal mayor a cero, pero se recomienda revisar.",
        "Verificar que el subtotal sea correcto para el tipo de operación.",
        baseEvidence(),
      );
    }
  }

  // D) Tipo I / Ingreso
  if (tc === "I") {
    if (mp === "PUE" && fp === "99") {
      addFinding(
        "INGRESO_PUE_WITH_FORMA_PAGO_99_REVIEW",
        "WARNING",
        "FormaPago inconsistente con PUE",
        "Para MetodoPago PUE, la FormaPago no debe ser 99.",
        "Ajustar FormaPago a un valor específico.",
        baseEvidence(),
      );
    }
  }

  // F) Exportación / Comercio Exterior
  if (exp === "02" && !hasComercioExterior) {
    addFinding(
      "EXPORTACION_02_WITHOUT_COMERCIO_EXTERIOR_REVIEW",
      "WARNING",
      "Exportación 02 sin complemento Comercio Exterior",
      "El CFDI declara Exportacion 02 (Definitiva) pero no incluye el complemento de Comercio Exterior.",
      "Agregar el complemento de Comercio Exterior si corresponde.",
      [...baseEvidence(), { label: "hasComercioExterior", value: "No" }],
    );
  }

  if (hasComercioExterior && exp === "01") {
    addFinding(
      "COMERCIO_EXTERIOR_WITH_EXPORTACION_01_REVIEW",
      "WARNING",
      "Complemento Comercio Exterior con Exportacion 01",
      "El CFDI incluye el complemento de Comercio Exterior pero declara Exportacion 01 (No aplica).",
      "Revisar la consistencia entre el complemento y la exportación declarada.",
      [...baseEvidence(), { label: "hasComercioExterior", value: "Sí" }],
    );
  }

  // G) ObjetoImp
  if (concepts && Array.isArray(concepts)) {
    for (let i = 0; i < concepts.length; i++) {
      const c = concepts[i] as Record<string, unknown>;
      const objImp = toStr(c?.objetoImp) ?? "";
      const impuestos = c?.impuestos as Record<string, unknown> | undefined;
      const traslados = (impuestos?.traslados as unknown[]) ?? [];
      const retenciones = (impuestos?.retenciones as unknown[]) ?? [];

      if (objImp === "03") {
        const hasAmount = [...traslados, ...retenciones].some((t) => {
          const importe = toNum((t as Record<string, unknown>)?.importe as string);
          return importe !== null && importe > 0;
        });
        if (hasAmount) {
          addFinding(
            "OBJETOIMP_03_WITH_TAX_AMOUNT_REVIEW",
            "WARNING",
            "ObjetoImp 03 con impuestos con importe",
            "Un concepto con ObjetoImp 03 (Sí objeto de impuesto y no obligado al desglose) no debe tener impuestos con importe.",
            "Revisar el tipo de objeto de impuesto.",
            [
              ...baseEvidence(),
              { label: "ConceptoIndex", value: String(i) },
              { label: "ObjetoImp", value: objImp },
            ],
          );
        }
      }
    }
  }

  // H) UsoCFDI / TipoComprobante
  if (uso === "G02" && tc !== "E") {
    addFinding(
      "USOCFDI_G02_WITHOUT_EGRESO_REVIEW",
      "INFO",
      "UsoCFDI G02 sin tipo Egreso",
      "El UsoCFDI G02 (Devoluciones, descuentos o bonificaciones) generalmente corresponde a CFDI de tipo Egreso.",
      "Revisar el tipo de comprobante.",
      baseEvidence(),
    );
  }

  if (uso === "CP01" && tc !== "P") {
    addFinding(
      "USOCFDI_CP01_WITHOUT_PAYMENT_REVIEW",
      "WARNING",
      "UsoCFDI CP01 sin tipo Pago",
      "El UsoCFDI CP01 (Pagos) debe utilizarse solo en comprobantes de tipo Pago.",
      "Revisar el UsoCFDI o cambiar el tipo de comprobante.",
      baseEvidence(),
    );
  }

  if (uso === "CN01" && tc !== "N") {
    addFinding(
      "USOCFDI_CN01_WITHOUT_NOMINA_REVIEW",
      "WARNING",
      "UsoCFDI CN01 sin tipo Nómina",
      "El UsoCFDI CN01 (Nómina) debe utilizarse solo en comprobantes de tipo Nómina.",
      "Revisar el UsoCFDI o cambiar el tipo de comprobante.",
      baseEvidence(),
    );
  }
}
