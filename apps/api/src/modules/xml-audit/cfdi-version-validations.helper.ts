export interface CfdiVersionConsistencyContext {
  version: string | null;
  tipoComprobante: string | null;
  exportacion: string | null;
  moneda: string | null;
  tipoCambio: string | null;
  formaPago: string | null;
  metodoPago: string | null;
  lugarExpedicion: string | null;
  confirmacion: string | null;
  total: string | null;
  emisor: { nombre: string | null };
  receptor: {
    nombre: string | null;
    regimenFiscalReceptor: string | null;
    domicilioFiscalReceptor: string | null;
    usoCfdi: string | null;
  };
  concepts: Array<{ objetoImp?: string | null }> | null;
  addFinding: (
    code: string,
    severity: "INFO" | "WARNING" | "CRITICAL",
    title: string,
    message: string,
    recommendedAction?: string,
    evidence?: { label: string; value?: string }[],
  ) => void;
}

function ev(label: string, value?: string | null | number | boolean): { label: string; value?: string } {
  return { label, value: value != null ? String(value) : "—" };
}

function buildEvidence(ctx: CfdiVersionConsistencyContext): { label: string; value?: string }[] {
  return [
    ev("Version", ctx.version),
    ev("Tipo comprobante", ctx.tipoComprobante),
    ev("Exportacion", ctx.exportacion),
    ev("Moneda", ctx.moneda),
    ev("TipoCambio", ctx.tipoCambio),
    ev("MetodoPago", ctx.metodoPago),
    ev("FormaPago", ctx.formaPago),
    ev("LugarExpedicion", ctx.lugarExpedicion),
    ev("Confirmacion presente", ctx.confirmacion ? "Sí" : "No"),
    ev("Receptor RegimenFiscal", ctx.receptor.regimenFiscalReceptor),
    ev("Receptor DomicilioFiscal", ctx.receptor.domicilioFiscalReceptor),
    ev("Receptor UsoCFDI", ctx.receptor.usoCfdi),
  ];
}

function isVersion(ver: string | null, expected: string): boolean {
  if (!ver) return false;
  return ver.trim() === expected;
}

function normalizeCurrency(curr: string | null): string {
  if (!curr) return "";
  const c = curr.trim().toUpperCase();
  return c;
}

function isNonEmptyString(s: string | null | undefined): s is string {
  return s != null && s.trim().length > 0;
}

function toNum(s: string | null): number {
  if (!s) return NaN;
  const n = parseFloat(s.replace(/,/g, ""));
  return isNaN(n) ? NaN : n;
}

export function validateCfdiVersionConsistency(ctx: CfdiVersionConsistencyContext): void {
  const { version, tipoComprobante, exportacion, moneda, tipoCambio, formaPago, metodoPago, lugarExpedicion, confirmacion, total, emisor, receptor, concepts, addFinding } = ctx;

  const tipo = tipoComprobante?.trim() ?? null;
  const is33 = isVersion(version, "3.3");
  const is40 = isVersion(version, "4.0");
  const hasMetodoPago = isNonEmptyString(metodoPago);
  const hasFormaPago = isNonEmptyString(formaPago);
  const hasExportacion = isNonEmptyString(exportacion);
  const hasTipoCambio = isNonEmptyString(tipoCambio);
  const totalNum = toNum(total);

  // ── A) Versión del CFDI ──

  // A1) CFDI_VERSION_MISSING
  if (!isNonEmptyString(version)) {
    addFinding(
      "CFDI_VERSION_MISSING",
      "WARNING",
      "Versión del CFDI no detectada",
      "No se encontró el atributo Version en el comprobante. Es necesario para determinar las reglas de validación aplicables.",
      "Revisa que el XML incluya el atributo Version en el nodo Comprobante.",
      buildEvidence(ctx),
    );
  }

  // A3) CFDI_VERSION_33_DETECTED_REVIEW
  if (is33) {
    addFinding(
      "CFDI_VERSION_33_DETECTED_REVIEW",
      "INFO",
      "CFDI 3.3 detectado — compatibilidad parcial",
      "El CFDI es versión 3.3. El motor lo analiza con compatibilidad, pero algunas reglas específicas de CFDI 4.0 (Exportacion, RegimenFiscalReceptor, ObjetoImp) no aplican.",
      "Si migraste a CFDI 4.0, asegúrate de que el XML esté actualizado.",
      buildEvidence(ctx),
    );
  }

  // ── B) Campos propios de CFDI 4.0 en versiones 3.3 ──

  // B2) CFDI33_EXPORTACION_PRESENT_REVIEW
  if (is33 && hasExportacion) {
    addFinding(
      "CFDI33_EXPORTACION_PRESENT_REVIEW",
      "INFO",
      "Exportacion presente en CFDI 3.3",
      "El campo Exportacion es propio de CFDI 4.0 pero se detectó en un comprobante 3.3. Puede indicar una mezcla de versiones.",
      "Revisa si el XML debería ser versión 4.0 o si Exportacion se incluyó por error.",
      buildEvidence(ctx),
    );
  }

  // B4) CFDI33_RECEPTOR_REGIMEN_PRESENT_REVIEW
  if (is33 && isNonEmptyString(receptor.regimenFiscalReceptor)) {
    addFinding(
      "CFDI33_RECEPTOR_REGIMEN_PRESENT_REVIEW",
      "INFO",
      "RegimenFiscalReceptor presente en CFDI 3.3",
      "El campo RegimenFiscalReceptor es propio de CFDI 4.0 pero se detectó en un comprobante 3.3. Puede indicar una mezcla de versiones.",
      "Revisa si el XML debería ser versión 4.0 o si RegimenFiscalReceptor se incluyó por error.",
      buildEvidence(ctx),
    );
  }

  // B6) CFDI33_RECEPTOR_DOMICILIO_PRESENT_REVIEW
  if (is33 && isNonEmptyString(receptor.domicilioFiscalReceptor)) {
    addFinding(
      "CFDI33_RECEPTOR_DOMICILIO_PRESENT_REVIEW",
      "INFO",
      "DomicilioFiscalReceptor presente en CFDI 3.3",
      "El campo DomicilioFiscalReceptor es propio de CFDI 4.0 pero se detectó en un comprobante 3.3. Puede indicar una mezcla de versiones.",
      "Revisa si el XML debería ser versión 4.0 o si DomicilioFiscalReceptor se incluyó por error.",
      buildEvidence(ctx),
    );
  }

  // B8) CFDI33_CONCEPT_OBJETOIMP_PRESENT_REVIEW
  if (is33 && concepts && concepts.length > 0) {
    const hasObjImp = concepts.some((c) => isNonEmptyString(c.objetoImp));
    if (hasObjImp) {
      addFinding(
        "CFDI33_CONCEPT_OBJETOIMP_PRESENT_REVIEW",
        "INFO",
        "ObjetoImp en conceptos presente en CFDI 3.3",
        "El campo ObjetoImp en conceptos es propio de CFDI 4.0 pero se detectó en un comprobante 3.3. Puede indicar una mezcla de versiones.",
        "Revisa si el XML debería ser versión 4.0 o si ObjetoImp se incluyó por error.",
        buildEvidence(ctx),
      );
    }
  }

  // ── C) FormaPago / MetodoPago por tipo ──

  // C1) CFDI_PAYMENT_METHOD_ON_PAYMENT_REVIEW
  if (isVersion(tipo, "P") && hasMetodoPago) {
    addFinding(
      "CFDI_PAYMENT_METHOD_ON_PAYMENT_REVIEW",
      "INFO",
      "MetodoPago en comprobante de pago",
      "El CFDI de tipo Pago incluye MetodoPago a nivel comprobante. En los pagos, el método de pago se define en el complemento Pagos, no en el comprobante.",
      "Revisa si MetodoPago es necesario en el comprobante de pago o puede omitirse.",
      buildEvidence(ctx),
    );
  }

  // C2) CFDI_PAYMENT_FORM_ON_PAYMENT_REVIEW
  if (isVersion(tipo, "P") && hasFormaPago) {
    addFinding(
      "CFDI_PAYMENT_FORM_ON_PAYMENT_REVIEW",
      "INFO",
      "FormaPago en comprobante de pago",
      "El CFDI de tipo Pago incluye FormaPago a nivel comprobante. En los pagos, la forma de pago se define en el complemento Pagos.",
      "Revisa si FormaPago es necesario en el comprobante de pago o puede omitirse.",
      buildEvidence(ctx),
    );
  }

  // ── D) Moneda / TipoCambio ──

  // D3) CFDI_XXX_WITH_EXCHANGE_RATE_REVIEW
  if (normalizeCurrency(moneda) === "XXX" && hasTipoCambio) {
    addFinding(
      "CFDI_XXX_WITH_EXCHANGE_RATE_REVIEW",
      "INFO",
      "Tipo de cambio presente con moneda XXX",
      "El comprobante tiene moneda XXX (sin moneda) pero incluye TipoCambio. No se espera tipo de cambio cuando no hay moneda definida.",
      "Revisa si TipoCambio debe estar presente para la moneda XXX.",
      buildEvidence(ctx),
    );
  }

  // D5) CFDI_EXCHANGE_RATE_TOO_HIGH_REVIEW
  if (hasTipoCambio) {
    const tc = toNum(tipoCambio);
    if (!isNaN(tc) && tc > 1000) {
      addFinding(
        "CFDI_EXCHANGE_RATE_TOO_HIGH_REVIEW",
        "INFO",
        "Tipo de cambio elevado",
        `El TipoCambio es ${tc}, un valor superior a 1000. Puede ser correcto para algunas monedas, pero requiere verificación.`,
        "Revisa que el tipo de cambio capturado sea correcto para la moneda y la fecha del comprobante.",
        buildEvidence(ctx),
      );
    }
  }

  // ── E) LugarExpedicion / Confirmacion ──

  // E3) CFDI_CONFIRMACION_FORMAT_REVIEW
  if (isNonEmptyString(confirmacion)) {
    const trimmed = confirmacion.trim();
    const hasSpaces = /\s/.test(trimmed);
    const len = trimmed.length;
    if (hasSpaces || len < 5 || len > 20) {
      addFinding(
        "CFDI_CONFIRMACION_FORMAT_REVIEW",
        "INFO",
        "Formato de Confirmación sospechoso",
        "El campo Confirmacion tiene un formato que no se ajusta a lo esperado (longitud entre 5 y 20 caracteres, sin espacios).",
        "Revisa que el folio de confirmación esté correctamente capturado.",
        buildEvidence(ctx),
      );
    }
  }

  // E4) CFDI_CONFIRMACION_WITH_LOW_AMOUNT_REVIEW
  if (isNonEmptyString(confirmacion) && !isNaN(totalNum) && totalNum < 1000000) {
    addFinding(
      "CFDI_CONFIRMACION_WITH_LOW_AMOUNT_REVIEW",
      "INFO",
      "Confirmación presente con importe bajo",
      `El CFDI tiene Confirmacion pero el total es ${totalNum} (menor a 1,000,000). La confirmación suele requerirse para montos mayores.`,
      "Revisa si realmente se necesita el folio de confirmación para este comprobante.",
      buildEvidence(ctx),
    );
  }

  // ── F) Reglas por tipo y versión ──

  // F1) CFDI40_PAYMENT_WITH_EXPORTACION_NOT_01_REVIEW
  if (is40 && isVersion(tipo, "P") && hasExportacion && exportacion!.trim() !== "01") {
    addFinding(
      "CFDI40_PAYMENT_WITH_EXPORTACION_NOT_01_REVIEW",
      "WARNING",
      "Pago con Exportacion distinto de 01",
      "El CFDI de tipo Pago (versión 4.0) tiene Exportacion distinto de 01. Los pagos generalmente usan Exportacion 01 (No aplica).",
      "Revisa que Exportacion sea correcto para un CFDI de pago.",
      buildEvidence(ctx),
    );
  }

  // F2) CFDI40_NOMINA_WITH_EXPORTACION_NOT_01_REVIEW
  if (is40 && isVersion(tipo, "N") && hasExportacion && exportacion!.trim() !== "01") {
    addFinding(
      "CFDI40_NOMINA_WITH_EXPORTACION_NOT_01_REVIEW",
      "WARNING",
      "Nómina con Exportacion distinto de 01",
      "El CFDI de nómina (versión 4.0) tiene Exportacion distinto de 01. Las nóminas generalmente usan Exportacion 01 (No aplica).",
      "Revisa que Exportacion sea correcto para un CFDI de nómina.",
      buildEvidence(ctx),
    );
  }

  // F3) CFDI40_TRASLADO_WITH_METODO_FORMA_PAGO_REVIEW
  if (isVersion(tipo, "T") && (hasMetodoPago || hasFormaPago)) {
    addFinding(
      "CFDI40_TRASLADO_WITH_METODO_FORMA_PAGO_REVIEW",
      "INFO",
      "Traslado con MetodoPago o FormaPago",
      "El CFDI de tipo Traslado incluye MetodoPago y/o FormaPago. Los traslados no suelen requerir estos campos.",
      "Revisa si MetodoPago y FormaPago son necesarios para el CFDI de traslado.",
      buildEvidence(ctx),
    );
  }

  // F5) CFDI33_WITH_CFDI40_ONLY_FIELDS_REVIEW
  if (is33) {
    let count = 0;
    if (hasExportacion) count++;
    if (isNonEmptyString(receptor.regimenFiscalReceptor)) count++;
    if (isNonEmptyString(receptor.domicilioFiscalReceptor)) count++;
    if (concepts && concepts.some((c) => isNonEmptyString(c.objetoImp))) count++;
    if (count >= 2) {
      addFinding(
        "CFDI33_WITH_CFDI40_ONLY_FIELDS_REVIEW",
        "WARNING",
        "CFDI 3.3 con múltiples campos de CFDI 4.0",
        `Se detectaron ${count} campos propios de CFDI 4.0 (Exportacion, RegimenFiscalReceptor, DomicilioFiscalReceptor, ObjetoImp) en un comprobante 3.3. El XML parece ser una mezcla entre ambas versiones.`,
        "Revisa si el comprobante debería ser versión 4.0 en lugar de 3.3, o corrige los campos sobrantes.",
        buildEvidence(ctx),
      );
    }
  }

  // F6) CFDI40_WITHOUT_CFDI40_CORE_FIELDS_REVIEW
  if (is40) {
    let missing = 0;
    if (!hasExportacion) missing++;
    if (!isNonEmptyString(receptor.regimenFiscalReceptor)) missing++;
    if (!isNonEmptyString(receptor.domicilioFiscalReceptor)) missing++;
    if (!concepts || !concepts.some((c) => isNonEmptyString(c.objetoImp))) missing++;
    if (missing >= 2) {
      addFinding(
        "CFDI40_WITHOUT_CFDI40_CORE_FIELDS_REVIEW",
        "WARNING",
        "CFDI 4.0 sin campos núcleo requeridos",
        `Faltan ${missing} campos núcleo de CFDI 4.0 (Exportacion, RegimenFiscalReceptor, DomicilioFiscalReceptor, ObjetoImp en conceptos). El CFDI puede estar incompleto o mal generado.`,
        "Revisa que el CFDI 4.0 incluya todos los campos obligatorios de la versión.",
        buildEvidence(ctx),
      );
    }
  }
}
