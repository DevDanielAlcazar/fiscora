import type {
  NominaInfo,
  NominaPercepcionInfo,
  NominaDeduccionInfo,
  NominaOtroPagoInfo,
} from "./xml-audit.service.js";

function isNonEmptyString(val: unknown): val is string {
  return typeof val === "string" && val.trim().length > 0;
}

function toMoneyNumber(val: string | null | undefined): number {
  if (!val) return 0;
  const n = parseFloat(val);
  return isNaN(n) ? 0 : n;
}

function moneyDiff(a: number, b: number): number {
  return Math.abs(Math.round(a * 100) - Math.round(b * 100)) / 100;
}

function formatMoney(val: number): string {
  return val.toFixed(2);
}

function parseCfdiDate(val: string | null | undefined): Date | null {
  if (!val) return null;
  const cleaned = val.replace(/[T ]/, "T").trim();
  const d = new Date(cleaned);
  return isNaN(d.getTime()) ? null : d;
}

function isDateBeforeOrEqual(a: Date, b: Date): boolean {
  return a.getTime() <= b.getTime();
}

function isDateAfter(a: Date, b: Date): boolean {
  return a.getTime() > b.getTime();
}

type Severity = "CRITICAL" | "WARNING" | "INFO";

type FindingAdder = (
  code: string,
  severity: Severity,
  title: string,
  message: string,
  recommendedAction: string,
  evidence: { label: string; value?: string }[],
) => void;

export interface NominaAdvancedContext {
  tipoComprobante?: string | null;
  total?: string | null;
  subTotal?: string | null;
  nomina: NominaInfo | null;
  addFinding: FindingAdder;
}

export function validateNominaAdvanced(ctx: NominaAdvancedContext): void {
  const { nomina, total, subTotal, addFinding } = ctx;

  if (!nomina) return;

  const nominaEvidence = (
    extra?: { label: string; value?: string }[],
  ): { label: string; value?: string }[] => [
    { label: "tipoNomina", value: nomina.tipoNomina ?? "—" },
    { label: "fechaPago", value: nomina.fechaPago ?? "—" },
    { label: "fechaInicialPago", value: nomina.fechaInicialPago ?? "—" },
    { label: "fechaFinalPago", value: nomina.fechaFinalPago ?? "—" },
    { label: "numDiasPagados", value: nomina.numDiasPagados ?? "—" },
    { label: "totalPercepciones", value: nomina.totalPercepciones ?? "—" },
    { label: "totalDeducciones", value: nomina.totalDeducciones ?? "—" },
    { label: "totalOtrosPagos", value: nomina.totalOtrosPagos ?? "—" },
    ...(extra ?? []),
  ];

  const isOrdinaria = nomina.tipoNomina === "O";

  // ── A) Fechas y días pagados (only new codes, skip existing NOMINA_MISSING_FECHA_PAGO and NOMINA_NUM_DIAS_INVALID) ──

  // A2) NOMINA_FECHA_PAGO_INVALID
  if (isNonEmptyString(nomina.fechaPago)) {
    const d = parseCfdiDate(nomina.fechaPago);
    if (!d) {
      addFinding(
        "NOMINA_FECHA_PAGO_INVALID",
        "WARNING",
        "Fecha de pago inválida",
        "La FechaPago del complemento Nómina no tiene un formato de fecha válido.",
        "Revisa el formato de la fecha de pago en el complemento Nómina.",
        nominaEvidence([{ label: "FechaPago", value: nomina.fechaPago! }]),
      );
    }
  }

  // A3) NOMINA_FECHA_INICIAL_FINAL_MISSING
  if (!isNonEmptyString(nomina.fechaInicialPago) || !isNonEmptyString(nomina.fechaFinalPago)) {
    addFinding(
      "NOMINA_FECHA_INICIAL_FINAL_MISSING",
      "WARNING",
      "Fechas del período de pago faltantes",
      "El complemento Nómina no contiene FechaInicialPago o FechaFinalPago.",
      "Revisa las fechas del período de pago en el complemento Nómina.",
      nominaEvidence(),
    );
  }

  // A4) NOMINA_FECHA_INICIAL_AFTER_FINAL
  const fechaInicial = parseCfdiDate(nomina.fechaInicialPago);
  const fechaFinal = parseCfdiDate(nomina.fechaFinalPago);
  if (fechaInicial && fechaFinal && isDateAfter(fechaInicial, fechaFinal)) {
    addFinding(
      "NOMINA_FECHA_INICIAL_AFTER_FINAL",
      "WARNING",
      "Fecha inicial posterior a fecha final",
      "La FechaInicialPago es posterior a la FechaFinalPago en el complemento Nómina.",
      "Revisa las fechas del período de pago en el complemento Nómina.",
      nominaEvidence([
        { label: "fechaInicialPago", value: nomina.fechaInicialPago! },
        { label: "fechaFinalPago", value: nomina.fechaFinalPago! },
      ]),
    );
  }

  // A5) NOMINA_NUM_DIAS_PAGADOS_MISSING
  if (!isNonEmptyString(nomina.numDiasPagados)) {
    addFinding(
      "NOMINA_NUM_DIAS_PAGADOS_MISSING",
      "WARNING",
      "Número de días pagados faltante",
      "El complemento Nómina no contiene NumDiasPagados.",
      "Agrega el número de días pagados en el complemento Nómina.",
      nominaEvidence(),
    );
  }

  // A7) NOMINA_NUM_DIAS_PAGADOS_REVIEW
  const diasNum = toMoneyNumber(nomina.numDiasPagados);
  if (isNonEmptyString(nomina.numDiasPagados) && diasNum > 31 && isOrdinaria) {
    addFinding(
      "NOMINA_NUM_DIAS_PAGADOS_REVIEW",
      "INFO",
      "Número de días pagados alto",
      "El número de días pagados es mayor a 31 en nómina ordinaria.",
      "Verifica que el número de días pagados sea correcto para una nómina ordinaria.",
      nominaEvidence([{ label: "NumDiasPagados", value: nomina.numDiasPagados! }]),
    );
  }

  // ── B) Datos mínimos del receptor (only new codes) ──
  const receptor = nomina.receptor;

  if (receptor) {
    // B3) NOMINA_RECEPTOR_TIPO_REGIMEN_MISSING
    if (!isNonEmptyString(receptor.tipoRegimen)) {
      addFinding(
        "NOMINA_RECEPTOR_TIPO_REGIMEN_MISSING",
        "WARNING",
        "Tipo de régimen del receptor faltante",
        "No se detectó TipoRegimen en el receptor del complemento Nómina.",
        "Agrega el tipo de régimen del trabajador en el complemento Nómina.",
        nominaEvidence([
          { label: "CURP", value: receptor.curp ?? "—" },
          { label: "NumEmpleado", value: receptor.numEmpleado ?? "—" },
        ]),
      );
    }

    // B4) NOMINA_RECEPTOR_PERIODICIDAD_PAGO_MISSING
    if (!isNonEmptyString(receptor.periodicidadPago)) {
      addFinding(
        "NOMINA_RECEPTOR_PERIODICIDAD_PAGO_MISSING",
        "WARNING",
        "Periodicidad de pago del receptor faltante",
        "No se detectó PeriodicidadPago en el receptor del complemento Nómina.",
        "Agrega la periodicidad de pago del trabajador en el complemento Nómina.",
        nominaEvidence([
          { label: "CURP", value: receptor.curp ?? "—" },
          { label: "NumEmpleado", value: receptor.numEmpleado ?? "—" },
        ]),
      );
    }

    // B5) NOMINA_RECEPTOR_CLAVE_ENT_FED_MISSING
    if (!isNonEmptyString(receptor.claveEntFed)) {
      addFinding(
        "NOMINA_RECEPTOR_CLAVE_ENT_FED_MISSING",
        "WARNING",
        "Clave de entidad federativa del receptor faltante",
        "No se detectó ClaveEntFed en el receptor del complemento Nómina.",
        "Agrega la clave de la entidad federativa del trabajador en el complemento Nómina.",
        nominaEvidence([
          { label: "CURP", value: receptor.curp ?? "—" },
          { label: "NumEmpleado", value: receptor.numEmpleado ?? "—" },
        ]),
      );
    }

    // B6) NOMINA_RECEPTOR_NSS_MISSING_REVIEW
    if (!isNonEmptyString(receptor.numSeguridadSocial)) {
      addFinding(
        "NOMINA_RECEPTOR_NSS_MISSING_REVIEW",
        "INFO",
        "NSS del receptor faltante",
        "No se detectó NumSeguridadSocial en el receptor del complemento Nómina.",
        "Verifica si el trabajador cuenta con número de seguridad social.",
        nominaEvidence([
          { label: "CURP", value: receptor.curp ?? "—" },
          { label: "NumEmpleado", value: receptor.numEmpleado ?? "—" },
        ]),
      );
    }

    // B7) NOMINA_RECEPTOR_BANCO_WITHOUT_CUENTA_REVIEW
    if (isNonEmptyString(receptor.banco) && !isNonEmptyString(receptor.cuentaBancaria)) {
      addFinding(
        "NOMINA_RECEPTOR_BANCO_WITHOUT_CUENTA_REVIEW",
        "INFO",
        "Banco sin cuenta bancaria asociada",
        "El receptor tiene Banco pero no CuentaBancaria en el complemento Nómina.",
        "Verifica si se debe agregar la cuenta bancaria del trabajador.",
        nominaEvidence([
          { label: "Banco", value: receptor.banco! },
          { label: "CURP", value: receptor.curp ?? "—" },
        ]),
      );
    }

    // B8) NOMINA_RECEPTOR_CUENTA_WITHOUT_BANCO_REVIEW
    if (isNonEmptyString(receptor.cuentaBancaria) && !isNonEmptyString(receptor.banco)) {
      addFinding(
        "NOMINA_RECEPTOR_CUENTA_WITHOUT_BANCO_REVIEW",
        "INFO",
        "Cuenta bancaria sin banco asociado",
        "El receptor tiene CuentaBancaria pero no Banco en el complemento Nómina.",
        "Verifica si se debe agregar el banco del trabajador.",
        nominaEvidence([
          { label: "CuentaBancaria", value: receptor.cuentaBancaria! },
          { label: "CURP", value: receptor.curp ?? "—" },
        ]),
      );
    }
  }

  // ── C) Totales de percepciones ──

  // C2) NOMINA_PERCEPCIONES_TOTAL_GRAVADO_MISMATCH
  if (
    nomina.percepcionesHeader?.totalGravado &&
    isNonEmptyString(nomina.percepcionesHeader.totalGravado) &&
    nomina.percepciones.length > 0
  ) {
    const headerGravado = toMoneyNumber(nomina.percepcionesHeader.totalGravado);
    const sumGravado = nomina.percepciones.reduce(
      (acc, p) => acc + toMoneyNumber(p.importeGravado),
      0,
    );
    if (moneyDiff(headerGravado, sumGravado) > 0.01) {
      addFinding(
        "NOMINA_PERCEPCIONES_TOTAL_GRAVADO_MISMATCH",
        "CRITICAL",
        "Total gravado de percepciones no coincide",
        "El TotalGravado del nodo Percepciones no coincide con la suma de ImporteGravado de las percepciones individuales.",
        "Revisa los importes gravados de las percepciones.",
        nominaEvidence([
          {
            label: "TotalGravado (Percepciones)",
            value: nomina.percepcionesHeader.totalGravado ?? "—",
          },
          { label: "Suma ImporteGravado", value: formatMoney(sumGravado) },
          { label: "difference", value: formatMoney(moneyDiff(headerGravado, sumGravado)) },
        ]),
      );
    }
  }

  // C3) NOMINA_PERCEPCIONES_TOTAL_EXENTO_MISMATCH
  if (
    nomina.percepcionesHeader?.totalExento &&
    isNonEmptyString(nomina.percepcionesHeader.totalExento) &&
    nomina.percepciones.length > 0
  ) {
    const headerExento = toMoneyNumber(nomina.percepcionesHeader.totalExento);
    const sumExento = nomina.percepciones.reduce(
      (acc, p) => acc + toMoneyNumber(p.importeExento),
      0,
    );
    if (moneyDiff(headerExento, sumExento) > 0.01) {
      addFinding(
        "NOMINA_PERCEPCIONES_TOTAL_EXENTO_MISMATCH",
        "CRITICAL",
        "Total exento de percepciones no coincide",
        "El TotalExento del nodo Percepciones no coincide con la suma de ImporteExento de las percepciones individuales.",
        "Revisa los importes exentos de las percepciones.",
        nominaEvidence([
          {
            label: "TotalExento (Percepciones)",
            value: nomina.percepcionesHeader.totalExento ?? "—",
          },
          { label: "Suma ImporteExento", value: formatMoney(sumExento) },
          { label: "difference", value: formatMoney(moneyDiff(headerExento, sumExento)) },
        ]),
      );
    }
  }

  // C5) NOMINA_PERCEPCION_MISSING_CLAVE
  // C6) NOMINA_PERCEPCION_MISSING_CONCEPTO
  // C8) NOMINA_PERCEPCION_ZERO_TOTAL_REVIEW
  nomina.percepciones.forEach((p: NominaPercepcionInfo, idx: number) => {
    const percNum = idx + 1;
    const percEvidence = (
      extra?: { label: string; value?: string }[],
    ): { label: string; value?: string }[] => [
      ...nominaEvidence(),
      { label: "perceptionIndex", value: String(percNum) },
      { label: "tipoPercepcion", value: p.tipoPercepcion ?? "—" },
      { label: "clave", value: p.clave ?? "—" },
      { label: "concepto", value: p.concepto ?? "—" },
      { label: "importeGravado", value: p.importeGravado ?? "—" },
      { label: "importeExento", value: p.importeExento ?? "—" },
      ...(extra ?? []),
    ];

    if (!isNonEmptyString(p.clave)) {
      addFinding(
        "NOMINA_PERCEPCION_MISSING_CLAVE",
        "WARNING",
        "Percepción sin Clave",
        "Una percepción del complemento Nómina no contiene Clave.",
        "Revisa la clave de la percepción en el complemento.",
        percEvidence(),
      );
    }

    if (!isNonEmptyString(p.concepto)) {
      addFinding(
        "NOMINA_PERCEPCION_MISSING_CONCEPTO",
        "INFO",
        "Percepción sin Concepto",
        "Una percepción del complemento Nómina no contiene Concepto.",
        "Revisa el concepto de la percepción en el complemento.",
        percEvidence(),
      );
    }

    const gravado = toMoneyNumber(p.importeGravado);
    const exento = toMoneyNumber(p.importeExento);
    if (gravado + exento === 0) {
      addFinding(
        "NOMINA_PERCEPCION_ZERO_TOTAL_REVIEW",
        "INFO",
        "Percepción con importe total cero",
        "Una percepción tiene importe gravado e importe exento ambos igual a cero.",
        "Revisa si los importes de la percepción son correctos.",
        percEvidence(),
      );
    }
  });

  // ── D) Totales de deducciones ──

  // D2) NOMINA_DEDUCCIONES_TOTAL_OTRAS_MISMATCH
  if (
    nomina.deduccionesHeader?.totalOtrasDeducciones &&
    isNonEmptyString(nomina.deduccionesHeader.totalOtrasDeducciones) &&
    nomina.deducciones.length > 0
  ) {
    const headerOtras = toMoneyNumber(nomina.deduccionesHeader.totalOtrasDeducciones);
    const sumNonIsr = nomina.deducciones.reduce((acc, d) => {
      if (d.tipoDeduccion === "001") return acc;
      return acc + toMoneyNumber(d.importe);
    }, 0);
    if (moneyDiff(headerOtras, sumNonIsr) > 0.01) {
      addFinding(
        "NOMINA_DEDUCCIONES_TOTAL_OTRAS_MISMATCH",
        "WARNING",
        "Total otras deducciones no coincide",
        "El TotalOtrasDeducciones no coincide con la suma de deducciones que no son ISR.",
        "Revisa los importes de deducciones distintas de ISR.",
        nominaEvidence([
          {
            label: "TotalOtrasDeducciones (Deducciones)",
            value: nomina.deduccionesHeader.totalOtrasDeducciones ?? "—",
          },
          { label: "Suma deducciones no ISR", value: formatMoney(sumNonIsr) },
          { label: "difference", value: formatMoney(moneyDiff(headerOtras, sumNonIsr)) },
        ]),
      );
    }
  }

  // D3) NOMINA_DEDUCCIONES_TOTAL_ISR_MISMATCH
  if (
    nomina.deduccionesHeader?.totalImpuestosRetenidos &&
    isNonEmptyString(nomina.deduccionesHeader.totalImpuestosRetenidos) &&
    nomina.deducciones.length > 0
  ) {
    const headerIsr = toMoneyNumber(nomina.deduccionesHeader.totalImpuestosRetenidos);
    const sumIsr = nomina.deducciones.reduce((acc, d) => {
      if (d.tipoDeduccion === "001") return acc + toMoneyNumber(d.importe);
      return acc;
    }, 0);
    if (sumIsr > 0 && moneyDiff(headerIsr, sumIsr) > 0.01) {
      addFinding(
        "NOMINA_DEDUCCIONES_TOTAL_ISR_MISMATCH",
        "WARNING",
        "Total Impuestos Retenidos no coincide",
        "El TotalImpuestosRetenidos no coincide con la suma de deducciones ISR (tipo 001).",
        "Revisa los importes de retenciones de ISR.",
        nominaEvidence([
          {
            label: "TotalImpuestosRetenidos (Deducciones)",
            value: nomina.deduccionesHeader.totalImpuestosRetenidos ?? "—",
          },
          { label: "Suma deducciones ISR", value: formatMoney(sumIsr) },
          { label: "difference", value: formatMoney(moneyDiff(headerIsr, sumIsr)) },
        ]),
      );
    }
  }

  // D4) NOMINA_DEDUCCION_MISSING_TIPO
  // D5) NOMINA_DEDUCCION_MISSING_CLAVE
  // D7) NOMINA_ISR_WITHOUT_TOTAL_IMPUESTOS_RETENIDOS_REVIEW
  let hasIsrDeduccion = false;
  nomina.deducciones.forEach((d: NominaDeduccionInfo, idx: number) => {
    const dedNum = idx + 1;
    const dedEvidence = (
      extra?: { label: string; value?: string }[],
    ): { label: string; value?: string }[] => [
      ...nominaEvidence(),
      { label: "deductionIndex", value: String(dedNum) },
      { label: "tipoDeduccion", value: d.tipoDeduccion ?? "—" },
      { label: "clave", value: d.clave ?? "—" },
      { label: "concepto", value: d.concepto ?? "—" },
      { label: "importe", value: d.importe ?? "—" },
      ...(extra ?? []),
    ];

    if (!isNonEmptyString(d.tipoDeduccion)) {
      addFinding(
        "NOMINA_DEDUCCION_MISSING_TIPO",
        "WARNING",
        "Deducción sin TipoDeduccion",
        "Una deducción del complemento Nómina no contiene TipoDeduccion.",
        "Revisa el tipo de deducción en el complemento.",
        dedEvidence(),
      );
    }

    if (!isNonEmptyString(d.clave)) {
      addFinding(
        "NOMINA_DEDUCCION_MISSING_CLAVE",
        "WARNING",
        "Deducción sin Clave",
        "Una deducción del complemento Nómina no contiene Clave.",
        "Revisa la clave de la deducción en el complemento.",
        dedEvidence(),
      );
    }

    if (d.tipoDeduccion === "001") {
      hasIsrDeduccion = true;
    }
  });

  // D7) NOMINA_ISR_WITHOUT_TOTAL_IMPUESTOS_RETENIDOS_REVIEW
  if (hasIsrDeduccion && !isNonEmptyString(nomina.deduccionesHeader?.totalImpuestosRetenidos)) {
    addFinding(
      "NOMINA_ISR_WITHOUT_TOTAL_IMPUESTOS_RETENIDOS_REVIEW",
      "WARNING",
      "ISR sin TotalImpuestosRetenidos",
      "Se detectaron deducciones ISR pero no se encontró TotalImpuestosRetenidos en el nodo Deducciones.",
      "Agrega el TotalImpuestosRetenidos en el nodo Deducciones.",
      nominaEvidence([{ label: "deducciones ISR detectadas", value: "Sí" }]),
    );
  }

  // ── E) Otros pagos y subsidio ──

  // E2) NOMINA_OTRO_PAGO_MISSING_TIPO
  // E3) NOMINA_OTRO_PAGO_MISSING_CLAVE
  // E4) NOMINA_OTRO_PAGO_AMOUNT_NON_POSITIVE
  // E5) NOMINA_SUBSIDIO_CAUSADO_WITHOUT_OTRO_PAGO_002_REVIEW
  // E6) NOMINA_OTRO_PAGO_002_WITHOUT_SUBSIDIO_REVIEW
  nomina.otrosPagos.forEach((o: NominaOtroPagoInfo, idx: number) => {
    const opNum = idx + 1;
    const opEvidence = (
      extra?: { label: string; value?: string }[],
    ): { label: string; value?: string }[] => [
      ...nominaEvidence(),
      { label: "otroPagoIndex", value: String(opNum) },
      { label: "tipoOtroPago", value: o.tipoOtroPago ?? "—" },
      { label: "clave", value: o.clave ?? "—" },
      { label: "concepto", value: o.concepto ?? "—" },
      { label: "importe", value: o.importe ?? "—" },
      ...(extra ?? []),
    ];

    if (!isNonEmptyString(o.tipoOtroPago)) {
      addFinding(
        "NOMINA_OTRO_PAGO_MISSING_TIPO",
        "WARNING",
        "Otro pago sin TipoOtroPago",
        "Un otro pago del complemento Nómina no contiene TipoOtroPago.",
        "Revisa el tipo de otro pago en el complemento.",
        opEvidence(),
      );
    }

    if (!isNonEmptyString(o.clave)) {
      addFinding(
        "NOMINA_OTRO_PAGO_MISSING_CLAVE",
        "WARNING",
        "Otro pago sin Clave",
        "Un otro pago del complemento Nómina no contiene Clave.",
        "Revisa la clave del otro pago en el complemento.",
        opEvidence(),
      );
    }

    const importeNum = toMoneyNumber(o.importe);
    if (isNonEmptyString(o.importe) && importeNum <= 0) {
      addFinding(
        "NOMINA_OTRO_PAGO_AMOUNT_NON_POSITIVE",
        "WARNING",
        "Importe de otro pago no positivo",
        "El importe de un otro pago debe ser mayor a cero.",
        "Revisa el importe del otro pago.",
        opEvidence(),
      );
    }

    const tipoOp = o.tipoOtroPago ?? "";
    const hasSubsidio = !!(
      o.subsidioAlEmpleo && isNonEmptyString(o.subsidioAlEmpleo.subsidioCausado)
    );

    // E5) Subsidio presente pero TipoOtroPago != 002
    if (hasSubsidio && tipoOp !== "002") {
      addFinding(
        "NOMINA_SUBSIDIO_CAUSADO_WITHOUT_OTRO_PAGO_002_REVIEW",
        "WARNING",
        "Subsidio al empleo sin TipoOtroPago 002",
        "Se detectó SubsidioAlEmpleo en un otro pago que no es tipo 002.",
        "Verifica que el TipoOtroPago sea 002 para subsidio al empleo.",
        opEvidence(),
      );
    }

    // E6) TipoOtroPago 002 sin Subsidio
    if (tipoOp === "002" && !hasSubsidio) {
      addFinding(
        "NOMINA_OTRO_PAGO_002_WITHOUT_SUBSIDIO_REVIEW",
        "WARNING",
        "TipoOtroPago 002 sin subsidio al empleo",
        "Se detectó TipoOtroPago 002 pero no contiene SubsidioAlEmpleo.",
        "Verifica que el subsidio al empleo esté capturado correctamente.",
        opEvidence(),
      );
    }
  });

  // ── F) Consistencia CFDI/Nómina ──

  // F1) NOMINA_CFDI_TOTAL_MISMATCH
  const totalPercepcionesNum = toMoneyNumber(nomina.totalPercepciones);
  const totalDeduccionesNum = toMoneyNumber(nomina.totalDeducciones);
  const totalOtrosPagosNum = toMoneyNumber(nomina.totalOtrosPagos);
  const cfdiTotal = toMoneyNumber(total);

  if (
    isNonEmptyString(nomina.totalPercepciones) &&
    isNonEmptyString(total) &&
    cfdiTotal > 0 &&
    totalPercepcionesNum > 0
  ) {
    const expectedTotal = totalPercepcionesNum + totalOtrosPagosNum - totalDeduccionesNum;
    if (moneyDiff(cfdiTotal, expectedTotal) > 0.01) {
      addFinding(
        "NOMINA_CFDI_TOTAL_MISMATCH",
        "CRITICAL",
        "Total del CFDI no coincide con fórmula de nómina",
        "El Total del CFDI no coincide con TotalPercepciones + TotalOtrosPagos - TotalDeducciones.",
        "Revisa los totales de la nómina y del CFDI.",
        nominaEvidence([
          { label: "cfdiTotal", value: total ?? "—" },
          { label: "calculated", value: formatMoney(expectedTotal) },
          { label: "difference", value: formatMoney(moneyDiff(cfdiTotal, expectedTotal)) },
        ]),
      );
    }
  }

  // F2) NOMINA_CFDI_SUBTOTAL_MISMATCH_REVIEW
  const cfdiSubTotal = toMoneyNumber(subTotal);
  if (
    isNonEmptyString(nomina.totalPercepciones) &&
    isNonEmptyString(subTotal) &&
    cfdiSubTotal > 0 &&
    totalPercepcionesNum > 0
  ) {
    const expectedSubtotal = totalPercepcionesNum + totalOtrosPagosNum;
    if (moneyDiff(cfdiSubTotal, expectedSubtotal) > 0.01) {
      addFinding(
        "NOMINA_CFDI_SUBTOTAL_MISMATCH_REVIEW",
        "WARNING",
        "SubTotal del CFDI no coincide con fórmula de nómina",
        "El SubTotal del CFDI no coincide aproximadamente con TotalPercepciones + TotalOtrosPagos.",
        "Revisa los subtotales de la nómina y del CFDI.",
        nominaEvidence([
          { label: "cfdiSubtotal", value: subTotal ?? "—" },
          { label: "expected", value: formatMoney(expectedSubtotal) },
          { label: "difference", value: formatMoney(moneyDiff(cfdiSubTotal, expectedSubtotal)) },
        ]),
      );
    }
  }

  // F4) NOMINA_WITH_DEDUCCIONES_WITHOUT_TOTAL_DEDUCCIONES_REVIEW
  if (nomina.deducciones.length > 0 && !isNonEmptyString(nomina.totalDeducciones)) {
    addFinding(
      "NOMINA_WITH_DEDUCCIONES_WITHOUT_TOTAL_DEDUCCIONES_REVIEW",
      "WARNING",
      "Deducciones sin TotalDeducciones",
      "Se detectaron deducciones pero no se encontró TotalDeducciones en el complemento Nómina.",
      "Agrega el TotalDeducciones en el complemento Nómina.",
      nominaEvidence([{ label: "numDeducciones", value: String(nomina.deducciones.length) }]),
    );
  }
}
