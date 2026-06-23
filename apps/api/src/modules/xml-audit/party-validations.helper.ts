interface PartyEmisor {
  rfc: string | null;
  nombre: string | null;
  regimenFiscal: string | null;
}

interface PartyReceptor {
  rfc: string | null;
  nombre: string | null;
  regimenFiscalReceptor: string | null;
  domicilioFiscalReceptor: string | null;
  usoCfdi: string | null;
}

interface CceReceptorData {
  residenciaFiscal?: string | null;
  numRegIdTrib?: string | null;
}

export interface PartyValidationsAdvancedContext {
  tipoComprobante: string | null;
  version: string | null;
  emisor: PartyEmisor;
  receptor: PartyReceptor;
  comercioExteriorReceptor: CceReceptorData | null;
  hasComercioExterior: boolean;
  lugarExpedicion: string | null;
  exportacion: string | null;
  addFinding: (
    code: string,
    severity: "INFO" | "WARNING" | "CRITICAL",
    title: string,
    message: string,
    recommendedAction?: string,
    evidence?: { label: string; value?: string }[],
  ) => void;
}

const RFC_REGEX = /^[A-ZÑ&]{3,4}\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])[A-Z0-9]{2,3}[0-9A-Z]$/;
const USO_CFDI_REGEX = /^(G0[1-3]|I0[1-8]|D0[1-9]|D10|P01|CP01|CN01|S01)$/;
const REGIMEN_3DIGIT = /^\d{3}$/;

function isCfdi40(version: string | null): boolean {
  return version?.trim() === "4.0";
}

function isNonEmptyString(v: string | null | undefined): boolean {
  return typeof v === "string" && v.trim().length > 0;
}

function normalizeRfc(v: string | null | undefined): string | null {
  if (!v) return null;
  return v.toUpperCase().trim();
}

function isGenericRfc(rfc: string | null | undefined): boolean {
  const n = normalizeRfc(rfc);
  return n === "XAXX010101000" || n === "XEXX010101000";
}

function isGenericNationalRfc(rfc: string | null | undefined): boolean {
  return normalizeRfc(rfc) === "XAXX010101000";
}

function isGenericForeignRfc(rfc: string | null | undefined): boolean {
  return normalizeRfc(rfc) === "XEXX010101000";
}

function looksLikeRfc(value: string | null | undefined): boolean {
  if (!value) return false;
  return RFC_REGEX.test(value.trim().toUpperCase());
}

function ev(label: string, value?: string | null): { label: string; value?: string } {
  return { label, value: value ?? "—" };
}

function buildEvidence(ctx: PartyValidationsAdvancedContext): { label: string; value?: string }[] {
  return [
    ev("Tipo comprobante", ctx.tipoComprobante),
    ev("Versión", ctx.version),
    ev("RFC emisor", ctx.emisor.rfc),
    ev("Nombre emisor", ctx.emisor.nombre),
    ev("Régimen fiscal emisor", ctx.emisor.regimenFiscal),
    ev("RFC receptor", ctx.receptor.rfc),
    ev("Nombre receptor", ctx.receptor.nombre),
    ev("Régimen fiscal receptor", ctx.receptor.regimenFiscalReceptor),
    ev("Domicilio fiscal receptor", ctx.receptor.domicilioFiscalReceptor),
    ev("Residencia fiscal", ctx.comercioExteriorReceptor?.residenciaFiscal ?? null),
    ev("NumRegIdTrib", ctx.comercioExteriorReceptor?.numRegIdTrib ?? null),
    ev("UsoCFDI", ctx.receptor.usoCfdi),
    ev("Exportacion", ctx.exportacion),
    ev("Tiene Comercio Exterior", ctx.hasComercioExterior ? "Sí" : "No"),
    ev("Lugar expedición", ctx.lugarExpedicion),
  ];
}

function emisorShortEvidence(ctx: PartyValidationsAdvancedContext): { label: string; value?: string }[] {
  return [
    ev("RFC emisor", ctx.emisor.rfc),
    ev("Nombre emisor", ctx.emisor.nombre),
    ev("Régimen fiscal emisor", ctx.emisor.regimenFiscal),
    ev("Tipo comprobante", ctx.tipoComprobante),
    ev("Versión", ctx.version),
  ];
}

function receptorShortEvidence(ctx: PartyValidationsAdvancedContext): { label: string; value?: string }[] {
  return [
    ev("RFC receptor", ctx.receptor.rfc),
    ev("Nombre receptor", ctx.receptor.nombre),
    ev("Régimen fiscal receptor", ctx.receptor.regimenFiscalReceptor),
    ev("UsoCFDI", ctx.receptor.usoCfdi),
    ev("Tipo comprobante", ctx.tipoComprobante),
  ];
}

export function validatePartiesAdvanced(ctx: PartyValidationsAdvancedContext): void {
  const { tipoComprobante, version, emisor, receptor, comercioExteriorReceptor, hasComercioExterior, lugarExpedicion, exportacion, addFinding } = ctx;

  const tipo = tipoComprobante?.trim() ?? null;
  const v40 = isCfdi40(version);

  // ── A) Emisor ──

  // A1) EMISOR_RFC_MISSING
  if (v40 && !isNonEmptyString(emisor.rfc)) {
    addFinding(
      "EMISOR_RFC_MISSING",
      "WARNING",
      "RFC del emisor faltante",
      "No se detectó RFC en el nodo Emisor del CFDI.",
      "Revisa que el nodo Emisor incluya el RFC correspondiente.",
      emisorShortEvidence(ctx),
    );
  }

  // A2) EMISOR_RFC_FORMAT_REVIEW
  if (v40 && isNonEmptyString(emisor.rfc) && !isGenericRfc(emisor.rfc) && !looksLikeRfc(emisor.rfc)) {
    addFinding(
      "EMISOR_RFC_FORMAT_REVIEW",
      "WARNING",
      "Formato de RFC emisor requiere revisión",
      `El RFC del emisor "${emisor.rfc}" no cumple con el formato básico esperado.`,
      "Verifica que el RFC del emisor sea correcto.",
      emisorShortEvidence(ctx),
    );
  }

  // A5) EMISOR_NAME_TOO_SHORT_REVIEW
  if (v40 && isNonEmptyString(emisor.nombre) && emisor.nombre!.trim().length < 3) {
    addFinding(
      "EMISOR_NAME_TOO_SHORT_REVIEW",
      "INFO",
      "Nombre del emisor muy corto",
      `El nombre del emisor tiene solo ${emisor.nombre!.trim().length} caracter(es). Puede ser un placeholder.`,
      "Revisa que el nombre del emisor sea el legal del contribuyente.",
      emisorShortEvidence(ctx),
    );
  }

  // A7) EMISOR_REGIMEN_FISCAL_FORMAT_REVIEW
  if (v40 && isNonEmptyString(emisor.regimenFiscal) && !REGIMEN_3DIGIT.test(emisor.regimenFiscal!.trim())) {
    addFinding(
      "EMISOR_REGIMEN_FISCAL_FORMAT_REVIEW",
      "WARNING",
      "Formato de RégimenFiscal emisor inválido",
      `El RégimenFiscal del emisor "${emisor.regimenFiscal}" no tiene formato de 3 dígitos.`,
      "Revisa que el RégimenFiscal del emisor sea un código válido de 3 dígitos.",
      emisorShortEvidence(ctx),
    );
  }

  // ── B) Receptor ──

  // B1) RECEPTOR_RFC_MISSING
  if (v40 && !isNonEmptyString(receptor.rfc)) {
    addFinding(
      "RECEPTOR_RFC_MISSING",
      "WARNING",
      "RFC del receptor faltante",
      "No se detectó RFC en el nodo Receptor del CFDI.",
      "Revisa que el nodo Receptor incluya el RFC correspondiente.",
      receptorShortEvidence(ctx),
    );
  }

  // B2) RECEPTOR_RFC_FORMAT_REVIEW
  if (v40 && isNonEmptyString(receptor.rfc) && !isGenericRfc(receptor.rfc) && !looksLikeRfc(receptor.rfc)) {
    addFinding(
      "RECEPTOR_RFC_FORMAT_REVIEW",
      "WARNING",
      "Formato de RFC receptor requiere revisión",
      `El RFC del receptor "${receptor.rfc}" no cumple con el formato básico esperado.`,
      "Verifica que el RFC del receptor sea correcto.",
      receptorShortEvidence(ctx),
    );
  }

  // B4) RECEPTOR_NAME_TOO_SHORT_REVIEW
  if (v40 && isNonEmptyString(receptor.nombre) && receptor.nombre!.trim().length < 3) {
    addFinding(
      "RECEPTOR_NAME_TOO_SHORT_REVIEW",
      "INFO",
      "Nombre del receptor muy corto",
      `El nombre del receptor tiene solo ${receptor.nombre!.trim().length} caracter(es). Puede ser un placeholder.`,
      "Revisa que el nombre del receptor sea el legal del contribuyente.",
      receptorShortEvidence(ctx),
    );
  }

  // B6) RECEPTOR_REGIMEN_FISCAL_FORMAT_REVIEW
  if (v40 && isNonEmptyString(receptor.regimenFiscalReceptor) && !REGIMEN_3DIGIT.test(receptor.regimenFiscalReceptor!.trim())) {
    addFinding(
      "RECEPTOR_REGIMEN_FISCAL_FORMAT_REVIEW",
      "WARNING",
      "Formato de RégimenFiscalReceptor inválido",
      `El RégimenFiscalReceptor "${receptor.regimenFiscalReceptor}" no tiene formato de 3 dígitos.`,
      "Revisa que el RégimenFiscalReceptor sea un código válido de 3 dígitos.",
      receptorShortEvidence(ctx),
    );
  }

  // B10) RECEPTOR_USO_CFDI_FORMAT_REVIEW
  if (v40 && isNonEmptyString(receptor.usoCfdi) && !USO_CFDI_REGEX.test(receptor.usoCfdi!.trim())) {
    addFinding(
      "RECEPTOR_USO_CFDI_FORMAT_REVIEW",
      "INFO",
      "Formato de UsoCFDI no reconocido",
      `El UsoCFDI "${receptor.usoCfdi}" no coincide con ningún patrón conocido.`,
      "Revisa que el UsoCFDI corresponda a un valor válido según el catálogo del SAT.",
      receptorShortEvidence(ctx),
    );
  }

  // ── C) RFC genérico nacional / extranjero ──

  // C4) RECEPTOR_GENERIC_FOREIGN_WITHOUT_RESIDENCIA_FISCAL
  if (isGenericForeignRfc(receptor.rfc) && comercioExteriorReceptor && !isNonEmptyString(comercioExteriorReceptor.residenciaFiscal)) {
    addFinding(
      "RECEPTOR_GENERIC_FOREIGN_WITHOUT_RESIDENCIA_FISCAL",
      "WARNING",
      "Receptor genérico extranjero sin ResidenciaFiscal",
      "El receptor usa RFC genérico extranjero pero no se detectó ResidenciaFiscal en el complemento de comercio exterior.",
      "Revisa que el complemento ComercioExterior incluya ResidenciaFiscal para el receptor extranjero.",
      buildEvidence(ctx),
    );
  }

  // C5) RECEPTOR_GENERIC_FOREIGN_WITHOUT_NUM_REG_ID_TRIB_REVIEW
  if (isGenericForeignRfc(receptor.rfc) && comercioExteriorReceptor && !isNonEmptyString(comercioExteriorReceptor.numRegIdTrib)) {
    addFinding(
      "RECEPTOR_GENERIC_FOREIGN_WITHOUT_NUM_REG_ID_TRIB_REVIEW",
      "WARNING",
      "Receptor genérico extranjero sin NumRegIdTrib",
      "El receptor usa RFC genérico extranjero pero no se detectó NumRegIdTrib en el complemento de comercio exterior.",
      "Revisa que el complemento ComercioExterior incluya NumRegIdTrib para el receptor extranjero.",
      buildEvidence(ctx),
    );
  }

  // ── D) Receptor extranjero no genérico ──

  // D1) RECEPTOR_RESIDENCIA_FISCAL_WITH_NATIONAL_RFC_REVIEW
  if (
    comercioExteriorReceptor &&
    isNonEmptyString(comercioExteriorReceptor.residenciaFiscal) &&
    isNonEmptyString(receptor.rfc) &&
    !isGenericRfc(receptor.rfc) &&
    !isGenericForeignRfc(receptor.rfc)
  ) {
    addFinding(
      "RECEPTOR_RESIDENCIA_FISCAL_WITH_NATIONAL_RFC_REVIEW",
      "INFO",
      "ResidenciaFiscal presente con RFC nacional",
      "Se detectó ResidenciaFiscal en comercio exterior, pero el RFC del receptor parece nacional. Puede ser válido para operaciones internacionales.",
      "Revisa que el RFC y los datos de comercio exterior sean consistentes.",
      buildEvidence(ctx),
    );
  }

  // D2) RECEPTOR_NUM_REG_ID_TRIB_WITHOUT_RESIDENCIA_FISCAL_REVIEW
  if (
    comercioExteriorReceptor &&
    isNonEmptyString(comercioExteriorReceptor.numRegIdTrib) &&
    !isNonEmptyString(comercioExteriorReceptor.residenciaFiscal)
  ) {
    addFinding(
      "RECEPTOR_NUM_REG_ID_TRIB_WITHOUT_RESIDENCIA_FISCAL_REVIEW",
      "WARNING",
      "NumRegIdTrib presente sin ResidenciaFiscal",
      "Se detectó NumRegIdTrib en el receptor de comercio exterior, pero falta ResidenciaFiscal.",
      "Revisa que ambos campos estén capturados correctamente en el complemento ComercioExterior.",
      buildEvidence(ctx),
    );
  }

  // D3) RECEPTOR_RESIDENCIA_FISCAL_MEX_WITH_NUM_REG_ID_TRIB_REVIEW
  if (
    comercioExteriorReceptor &&
    isNonEmptyString(comercioExteriorReceptor.residenciaFiscal) &&
    isNonEmptyString(comercioExteriorReceptor.numRegIdTrib)
  ) {
    const rf = comercioExteriorReceptor.residenciaFiscal!.trim().toUpperCase();
    if (rf === "MEX" || rf === "MX") {
      addFinding(
        "RECEPTOR_RESIDENCIA_FISCAL_MEX_WITH_NUM_REG_ID_TRIB_REVIEW",
        "INFO",
        "ResidenciaFiscal MEX con NumRegIdTrib presente",
        "El receptor tiene ResidenciaFiscal MEX/MX pero también incluye NumRegIdTrib. Puede ser válido en ciertos contextos.",
        "Revisa si el NumRegIdTrib es necesario para un receptor con residencia fiscal en México.",
        buildEvidence(ctx),
      );
    }
  }

  // ── E) Emisor/Receptor relación ──

  // E2) EMISOR_RECEPTOR_SAME_NAME_DIFFERENT_RFC_REVIEW
  if (
    isNonEmptyString(emisor.nombre) &&
    isNonEmptyString(receptor.nombre) &&
    isNonEmptyString(emisor.rfc) &&
    isNonEmptyString(receptor.rfc) &&
    normalizeRfc(emisor.rfc) !== normalizeRfc(receptor.rfc) &&
    emisor.nombre!.trim().toUpperCase() === receptor.nombre!.trim().toUpperCase() &&
    emisor.nombre!.trim().length >= 3
  ) {
    addFinding(
      "EMISOR_RECEPTOR_SAME_NAME_DIFFERENT_RFC_REVIEW",
      "INFO",
      "Mismo nombre en emisor y receptor con RFC distinto",
      "El emisor y receptor tienen el mismo nombre normalizado pero RFC diferente. Puede ser un error de captura o una relación válida.",
      "Verifica que los RFC y nombres correspondan a los contribuyentes correctos.",
      buildEvidence(ctx),
    );
  }

  // E3) EMISOR_RECEPTOR_BOTH_GENERIC_REVIEW
  if (isGenericRfc(emisor.rfc) && isGenericRfc(receptor.rfc)) {
    addFinding(
      "EMISOR_RECEPTOR_BOTH_GENERIC_REVIEW",
      "WARNING",
      "Emisor y receptor usan RFC genérico",
      "Tanto el emisor como el receptor usan RFC genérico. Esto es inusual y puede indicar un XML de prueba o mal generado.",
      "Verifica que ambos RFC correspondan a contribuyentes reales.",
      buildEvidence(ctx),
    );
  }

  // ── F) Coherencia por TipoDeComprobante ──

  // F1) NOMINA_RECEPTOR_RFC_GENERIC_REVIEW
  if (tipo === "N" && isGenericRfc(receptor.rfc)) {
    addFinding(
      "NOMINA_RECEPTOR_RFC_GENERIC_REVIEW",
      "WARNING",
      "Nómina con RFC genérico en receptor",
      "El CFDI de nómina tiene un RFC genérico en el receptor. Las nóminas normalmente requieren un RFC real del empleado.",
      "Revisa que el receptor de la nómina tenga un RFC válido y no genérico.",
      receptorShortEvidence(ctx),
    );
  }

  // F4) TRASLADO_RECEPTOR_USO_CFDI_REVIEW
  if (tipo === "T" && isNonEmptyString(receptor.usoCfdi) && receptor.usoCfdi!.trim() !== "S01") {
    addFinding(
      "TRASLADO_RECEPTOR_USO_CFDI_REVIEW",
      "INFO",
      "Traslado con UsoCFDI distinto de S01",
      `El CFDI de traslado usa UsoCFDI "${receptor.usoCfdi}". Normalmente los traslados usan S01.`,
      "Revisa que el UsoCFDI sea correcto para un comprobante de traslado.",
      receptorShortEvidence(ctx),
    );
  }

  // ── G) Régimen/UsoCFDI heurística ──

  // G1) USOCFDI_D_SERIES_FOR_MORAL_PERSON_REVIEW
  if (
    isNonEmptyString(receptor.usoCfdi) &&
    /^D\d\d$/.test(receptor.usoCfdi!.trim()) &&
    isNonEmptyString(receptor.rfc) &&
    receptor.rfc!.trim().length === 12
  ) {
    addFinding(
      "USOCFDI_D_SERIES_FOR_MORAL_PERSON_REVIEW",
      "INFO",
      "UsoCFDI de deducción personal en persona moral",
      "El receptor tiene RFC de persona moral (12 caracteres) pero usa UsoCFDI de deducción personal. Las personas morales normalmente no realizan deducciones personales.",
      "Revisa que el UsoCFDI sea el correcto para el tipo de contribuyente.",
      receptorShortEvidence(ctx),
    );
  }

  // G3) REGIMEN_616_WITH_NON_GENERIC_RFC_REVIEW
  if (
    v40 &&
    isNonEmptyString(receptor.regimenFiscalReceptor) &&
    receptor.regimenFiscalReceptor!.trim() === "616" &&
    isNonEmptyString(receptor.rfc) &&
    !isGenericRfc(receptor.rfc)
  ) {
    addFinding(
      "REGIMEN_616_WITH_NON_GENERIC_RFC_REVIEW",
      "INFO",
      "Régimen 616 con RFC no genérico",
      "El receptor tiene RégimenFiscalReceptor 616 (Sin obligaciones) pero RFC no genérico. Esto puede ser válido en ciertos escenarios, pero requiere revisión.",
      "Verifica que el régimen fiscal del receptor sea correcto para su situación fiscal.",
      receptorShortEvidence(ctx),
    );
  }
}
