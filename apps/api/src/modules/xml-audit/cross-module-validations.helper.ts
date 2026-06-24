export interface CrossModuleConsistencyContext {
  tipoComprobante: string | null;
  version: string | null;
  exportacion: string | null;
  moneda: string | null;
  hasPaymentComplement: boolean;
  hasNomina: boolean;
  hasCartaPorte: boolean;
  cartaPorteTranspInternac: string | null;
  hasComercioExterior: boolean;
  hasCfdiRelations: boolean;
  hasDonatarias: boolean;
  hasLeyendasFiscales: boolean;
  hasImpuestosLocales: boolean;
  hasAddenda: boolean;
  hasConceptTaxes: boolean;
  hasGlobalTaxes: boolean;
  conceptsCount: number;
  paymentDocumentsCount: number;
  relationGroupsCount: number;
  knownComplements: string[];
  unknownComplements: string[];
  concepts: Array<{ objetoImp?: string | null }> | null;
  cartaPorteMercancias: Array<{ bienesTransp?: string | null }> | null;
  comercioExteriorMercancias: Array<{ noIdentificacion?: string | null }> | null;
  hasCriticalFindings: boolean;
  addFinding: (
    code: string,
    severity: "INFO" | "WARNING" | "CRITICAL",
    title: string,
    message: string,
    recommendedAction?: string,
    evidence?: { label: string; value?: string }[],
  ) => void;
}

function isTipo(tipo: string | null | undefined, expected: string): boolean {
  if (!tipo) return false;
  return tipo.trim().toUpperCase() === expected;
}

function ev(
  label: string,
  value?: string | null | number | boolean,
): { label: string; value?: string } {
  return { label, value: value != null ? String(value) : "—" };
}

function buildEvidence(ctx: CrossModuleConsistencyContext): { label: string; value?: string }[] {
  return [
    ev("Tipo comprobante", ctx.tipoComprobante),
    ev("Exportacion", ctx.exportacion),
    ev("Moneda", ctx.moneda),
    ev("Complemento Pago", ctx.hasPaymentComplement ? "Sí" : "No"),
    ev("Complemento Nómina", ctx.hasNomina ? "Sí" : "No"),
    ev("Complemento Carta Porte", ctx.hasCartaPorte ? "Sí" : "No"),
    ev("TranspInternac", ctx.cartaPorteTranspInternac),
    ev("Complemento Comercio Exterior", ctx.hasComercioExterior ? "Sí" : "No"),
    ev("CfdiRelacionados", ctx.hasCfdiRelations ? "Sí" : "No"),
    ev("Impuestos por concepto", ctx.hasConceptTaxes ? "Sí" : "No"),
    ev("Impuestos globales", ctx.hasGlobalTaxes ? "Sí" : "No"),
    ev("Conceptos", ctx.conceptsCount),
    ev("Documentos relacionados en Pagos", ctx.paymentDocumentsCount),
    ev("Grupos de relación", ctx.relationGroupsCount),
    ev(
      "Complementos conocidos",
      ctx.knownComplements.length > 0 ? ctx.knownComplements.join(", ") : "—",
    ),
    ev(
      "Complementos no clasificados",
      ctx.unknownComplements.length > 0 ? String(ctx.unknownComplements.length) : "—",
    ),
    ev("Hallazgos CRITICAL", ctx.hasCriticalFindings ? "Sí" : "No"),
  ];
}

export function validateCrossModuleConsistency(ctx: CrossModuleConsistencyContext): void {
  const {
    tipoComprobante,
    version,
    exportacion,
    hasPaymentComplement,
    hasNomina,
    hasCartaPorte,
    cartaPorteTranspInternac,
    hasComercioExterior,
    hasCfdiRelations,
    hasDonatarias,
    hasLeyendasFiscales,
    hasImpuestosLocales,
    hasAddenda,
    hasConceptTaxes,
    hasGlobalTaxes,
    conceptsCount,
    paymentDocumentsCount,
    relationGroupsCount,
    knownComplements,
    unknownComplements,
    concepts,
    cartaPorteMercancias,
    comercioExteriorMercancias,
    hasCriticalFindings,
    addFinding,
  } = ctx;

  const tipo = tipoComprobante?.trim() ?? null;

  // ── A) TipoComprobante vs complementos ──

  // A1) CROSS_PAYMENT_COMPLEMENT_ON_NON_PAYMENT_REVIEW
  if (hasPaymentComplement && !isTipo(tipo, "P")) {
    addFinding(
      "CROSS_PAYMENT_COMPLEMENT_ON_NON_PAYMENT_REVIEW",
      "WARNING",
      "Complemento de pago en comprobante que no es de pago",
      `El CFDI de tipo "${tipo}" incluye el complemento de Pagos. Esto es inusual porque el complemento Pagos corresponde a CFDIs de tipo Pago.`,
      "Revisa si el complemento Pagos es correcto para el tipo de comprobante.",
      buildEvidence(ctx),
    );
  }

  // A5) CROSS_DONATARIAS_ON_PAYMENT_OR_NOMINA_REVIEW
  if (hasDonatarias && (isTipo(tipo, "P") || isTipo(tipo, "N") || isTipo(tipo, "T"))) {
    addFinding(
      "CROSS_DONATARIAS_ON_PAYMENT_OR_NOMINA_REVIEW",
      "INFO",
      "Donatarias en comprobante de pago, nómina o traslado",
      `El CFDI de tipo "${tipo}" incluye el complemento Donatarias. Generalmente las donatarias se aplican en ingresos o egresos.`,
      "Revisa si el complemento Donatarias corresponde al tipo de comprobante.",
      buildEvidence(ctx),
    );
  }

  // A6) CROSS_LEYENDAS_ON_PAYMENT_REVIEW
  if (hasLeyendasFiscales && isTipo(tipo, "P")) {
    addFinding(
      "CROSS_LEYENDAS_ON_PAYMENT_REVIEW",
      "INFO",
      "Leyendas Fiscales en comprobante de pago",
      "El CFDI de tipo Pago incluye el complemento Leyendas Fiscales. No es común, puede ser válido en ciertos contextos.",
      "Revisa si las leyendas fiscales son necesarias en el comprobante de pago.",
      buildEvidence(ctx),
    );
  }

  // A7) CROSS_IMPUESTOS_LOCALES_ON_PAYMENT_REVIEW
  if (hasImpuestosLocales && isTipo(tipo, "P")) {
    addFinding(
      "CROSS_IMPUESTOS_LOCALES_ON_PAYMENT_REVIEW",
      "INFO",
      "Impuestos Locales en comprobante de pago",
      "El CFDI de tipo Pago incluye el complemento Impuestos Locales. No es común, puede ser válido en entidades que lo requieran.",
      "Revisa si los impuestos locales aplican al comprobante de pago.",
      buildEvidence(ctx),
    );
  }

  // ── B) Exportación / CCE / Carta Porte ──

  // B1) CROSS_EXPORTACION_02_WITHOUT_CCE_OR_CARTA_PORTE_REVIEW
  if (exportacion?.trim() === "02" && !hasComercioExterior && !hasCartaPorte) {
    addFinding(
      "CROSS_EXPORTACION_02_WITHOUT_CCE_OR_CARTA_PORTE_REVIEW",
      "WARNING",
      "Exportacion 02 sin Comercio Exterior ni Carta Porte",
      "El CFDI tiene Exportacion 02, pero no incluye complemento Comercio Exterior ni Carta Porte que respalden la operación de exportación.",
      "Revisa si se requiere complemento Comercio Exterior o Carta Porte según el tipo de operación.",
      buildEvidence(ctx),
    );
  }

  // B2) CROSS_CCE_WITH_CARTA_PORTE_NACIONAL_REVIEW
  if (hasComercioExterior && hasCartaPorte && cartaPorteTranspInternac?.trim() === "No") {
    addFinding(
      "CROSS_CCE_WITH_CARTA_PORTE_NACIONAL_REVIEW",
      "INFO",
      "Comercio Exterior con Carta Porte nacional",
      "Se detectó complemento Comercio Exterior y Carta Porte con transporte nacional. Puede ser válido para operaciones logísticas internas que involucren comercio exterior.",
      "Revisa si la combinación de complementos corresponde al escenario real de la operación.",
      buildEvidence(ctx),
    );
  }

  // B3) CROSS_CARTA_PORTE_INTERNACIONAL_WITHOUT_CCE_REVIEW
  if (hasCartaPorte && cartaPorteTranspInternac?.trim() === "Sí" && !hasComercioExterior) {
    addFinding(
      "CROSS_CARTA_PORTE_INTERNACIONAL_WITHOUT_CCE_REVIEW",
      "WARNING",
      "Carta Porte internacional sin Comercio Exterior",
      "La Carta Porte indica transporte internacional, pero no se detectó complemento Comercio Exterior que respalde la operación.",
      "Revisa si se requiere el complemento Comercio Exterior para la operación internacional.",
      buildEvidence(ctx),
    );
  }

  // B5) CROSS_CCE_TOTALUSD_WITH_NON_FOREIGN_CONTEXT_REVIEW
  if (hasComercioExterior && exportacion?.trim() === "01") {
    addFinding(
      "CROSS_CCE_TOTALUSD_WITH_NON_FOREIGN_CONTEXT_REVIEW",
      "INFO",
      "Comercio Exterior con Exportacion 01",
      "El CFDI tiene complemento Comercio Exterior pero Exportacion 01 (No aplica). Normalmente el comercio exterior requiere Exportacion 02 o superior.",
      "Revisa que Exportacion y el complemento Comercio Exterior sean consistentes.",
      buildEvidence(ctx),
    );
  }

  // ── C) Pago / CFDI Relacionados / conceptos ──

  // C1) CROSS_PAYMENT_WITH_CONCEPT_TAXES_REVIEW
  if (isTipo(tipo, "P") && hasConceptTaxes) {
    addFinding(
      "CROSS_PAYMENT_WITH_CONCEPT_TAXES_REVIEW",
      "WARNING",
      "Pago con impuestos en conceptos",
      "El CFDI de tipo Pago tiene impuestos calculados por concepto. En CFDIs de pago los impuestos deben ir en el complemento Pagos, no en los conceptos del CFDI.",
      "Revisa que los impuestos estén correctamente registrados en DoctoRelacionado del complemento Pagos.",
      buildEvidence(ctx),
    );
  }

  // C2) CROSS_PAYMENT_WITH_GLOBAL_TAXES_REVIEW
  if (isTipo(tipo, "P") && hasGlobalTaxes) {
    addFinding(
      "CROSS_PAYMENT_WITH_GLOBAL_TAXES_REVIEW",
      "WARNING",
      "Pago con impuestos globales",
      "El CFDI de tipo Pago tiene impuestos globales. En CFDIs de pago los impuestos deben ir en el complemento Pagos.",
      "Revisa que los impuestos globales no sean necesarios o estén correctamente registrados.",
      buildEvidence(ctx),
    );
  }

  // C3) CROSS_PAYMENT_WITH_CFDI_RELACIONADOS_AND_DOCTOS_REVIEW
  if (isTipo(tipo, "P") && hasCfdiRelations && paymentDocumentsCount > 0) {
    addFinding(
      "CROSS_PAYMENT_WITH_CFDI_RELACIONADOS_AND_DOCTOS_REVIEW",
      "INFO",
      "Pago con CfdiRelacionados y DoctoRelacionado simultáneamente",
      "El CFDI de tipo Pago incluye tanto CfdiRelacionados como documentos relacionados en el complemento Pagos. Puede ser redundante.",
      "Revisa si la relación es necesaria en ambos lugares o si puede eliminarse de CfdiRelacionados.",
      buildEvidence(ctx),
    );
  }

  // C5) CROSS_PAYMENT_CONCEPTS_COUNT_REVIEW
  if (isTipo(tipo, "P") && conceptsCount > 1) {
    addFinding(
      "CROSS_PAYMENT_CONCEPTS_COUNT_REVIEW",
      "INFO",
      "Pago con múltiples conceptos",
      `El CFDI de tipo Pago tiene ${conceptsCount} conceptos. Normalmente los CFDIs de pago tienen un solo concepto.`,
      "Revisa si los múltiples conceptos son correctos para el comprobante de pago.",
      buildEvidence(ctx),
    );
  }

  // ── D) Nómina / receptor / impuestos ──

  // D2) CROSS_NOMINA_WITH_GLOBAL_TAXES_REVIEW
  if (isTipo(tipo, "N") && hasGlobalTaxes) {
    addFinding(
      "CROSS_NOMINA_WITH_GLOBAL_TAXES_REVIEW",
      "INFO",
      "Nómina con impuestos globales",
      "El CFDI de nómina tiene impuestos globales. Normalmente los impuestos en nómina se manejan dentro del complemento Nómina.",
      "Revisa que los impuestos globales sean correctos para el CFDI de nómina.",
      buildEvidence(ctx),
    );
  }

  // D4) CROSS_NOMINA_WITH_COMERCIO_EXTERIOR_REVIEW
  if (isTipo(tipo, "N") && hasComercioExterior) {
    addFinding(
      "CROSS_NOMINA_WITH_COMERCIO_EXTERIOR_REVIEW",
      "WARNING",
      "Nómina con Comercio Exterior",
      "El CFDI de nómina incluye el complemento Comercio Exterior. Esto es inusual porque las nóminas no suelen involucrar operaciones de comercio exterior.",
      "Revisa si el complemento Comercio Exterior es correcto para el CFDI de nómina.",
      buildEvidence(ctx),
    );
  }

  // D5) CROSS_NOMINA_WITH_CARTA_PORTE_REVIEW
  if (isTipo(tipo, "N") && hasCartaPorte) {
    addFinding(
      "CROSS_NOMINA_WITH_CARTA_PORTE_REVIEW",
      "WARNING",
      "Nómina con Carta Porte",
      "El CFDI de nómina incluye el complemento Carta Porte. Esto es inusual porque las nóminas no suelen requerir Carta Porte.",
      "Revisa si el complemento Carta Porte es correcto para el CFDI de nómina.",
      buildEvidence(ctx),
    );
  }

  // ── E) Carta Porte / mercancías / conceptos / CCE ──

  // E2) CROSS_CARTA_PORTE_MERCANCIAS_WITHOUT_CONCEPTS_REVIEW
  if (
    hasCartaPorte &&
    cartaPorteMercancias &&
    cartaPorteMercancias.length > 0 &&
    (!concepts || concepts.length === 0)
  ) {
    addFinding(
      "CROSS_CARTA_PORTE_MERCANCIAS_WITHOUT_CONCEPTS_REVIEW",
      "WARNING",
      "Carta Porte con mercancías sin conceptos en el CFDI",
      "La Carta Porte tiene mercancías registradas, pero el CFDI no tiene conceptos. Esto puede ser inconsistente.",
      "Revisa que los conceptos del CFDI correspondan a las mercancías de la Carta Porte.",
      buildEvidence(ctx),
    );
  }

  // E3) CROSS_CARTA_PORTE_CCE_MERCANCIA_IDENTIFIER_MISMATCH_REVIEW
  if (
    hasCartaPorte &&
    hasComercioExterior &&
    cartaPorteMercancias &&
    cartaPorteMercancias.length > 0 &&
    comercioExteriorMercancias &&
    comercioExteriorMercancias.length > 0
  ) {
    const cpIds = cartaPorteMercancias
      .map((m) => m.bienesTransp?.trim().toUpperCase())
      .filter(Boolean);
    const cceIds = comercioExteriorMercancias
      .map((m) => m.noIdentificacion?.trim().toUpperCase())
      .filter(Boolean);
    if (cpIds.length > 0 && cceIds.length > 0 && !cpIds.some((id) => cceIds.includes(id))) {
      addFinding(
        "CROSS_CARTA_PORTE_CCE_MERCANCIA_IDENTIFIER_MISMATCH_REVIEW",
        "INFO",
        "Identificadores de mercancía entre Carta Porte y CCE no coinciden",
        "Los identificadores de las mercancías en Carta Porte y Comercio Exterior no tienen coincidencias. Pueden ser productos distintos o errores de captura.",
        "Revisa que las mercancías declaradas en ambos complementos correspondan a los mismos productos.",
        buildEvidence(ctx),
      );
    }
  }

  // ── F) Impuestos / conceptos / tipo comprobante ──

  // F1) CROSS_TIPO_T_WITH_TAXES_REVIEW
  if (isTipo(tipo, "T") && (hasConceptTaxes || hasGlobalTaxes)) {
    addFinding(
      "CROSS_TIPO_T_WITH_TAXES_REVIEW",
      "WARNING",
      "Traslado con impuestos",
      "El CFDI de tipo Traslado tiene impuestos. Los traslados normalmente no deben incluir impuestos porque no son operaciones de enajenación.",
      "Revisa si los impuestos son correctos para un CFDI de traslado.",
      buildEvidence(ctx),
    );
  }

  // F2) CROSS_TIPO_P_WITH_TAXES_REVIEW
  if (isTipo(tipo, "P") && (hasConceptTaxes || hasGlobalTaxes)) {
    addFinding(
      "CROSS_TIPO_P_WITH_TAXES_REVIEW",
      "WARNING",
      "Pago con impuestos en CFDI",
      "El CFDI de tipo Pago tiene impuestos a nivel CFDI. En los complementos de pago, los impuestos deben registrarse en DoctoRelacionado del complemento Pagos.",
      "Revisa que los impuestos estén correctamente registrados en el complemento Pagos y no a nivel CFDI.",
      buildEvidence(ctx),
    );
  }

  // F3) CROSS_TIPO_N_WITH_OBJETOIMP_NOT_01_REVIEW
  if (isTipo(tipo, "N") && concepts && concepts.length > 0) {
    const hasNon01 = concepts.some((c) => c.objetoImp && c.objetoImp.trim() !== "01");
    if (hasNon01) {
      addFinding(
        "CROSS_TIPO_N_WITH_OBJETOIMP_NOT_01_REVIEW",
        "INFO",
        "Nómina con ObjetoImp distinto de 01",
        "El CFDI de nómina tiene conceptos con ObjetoImp distinto de 01 (No objeto de impuesto). Los conceptos en nómina normalmente deben usar ObjetoImp 01.",
        "Revisa que el ObjetoImp de los conceptos sea correcto para un CFDI de nómina.",
        buildEvidence(ctx),
      );
    }
  }

  // ── G) Complementos múltiples / no clasificados ──

  // G1) CROSS_MULTIPLE_HIGH_COMPLEXITY_COMPLEMENTS_REVIEW
  const highComplexity = [
    "Pagos",
    "Nomina",
    "CartaPorte",
    "ComercioExterior",
    "ImpuestosLocales",
    "Donatarias",
  ];
  const detectedHigh = knownComplements.filter((c) => highComplexity.includes(c));
  if (detectedHigh.length >= 3) {
    addFinding(
      "CROSS_MULTIPLE_HIGH_COMPLEXITY_COMPLEMENTS_REVIEW",
      "INFO",
      "Múltiples complementos de alta complejidad",
      `Se detectaron ${detectedHigh.length} complementos de alta complejidad: ${detectedHigh.join(", ")}. Esto puede ser válido, pero requiere revisión operativa.`,
      "Revisa que todos los complementos sean necesarios y estén correctamente integrados.",
      buildEvidence(ctx),
    );
  }

  // G2) CROSS_UNKNOWN_COMPLEMENT_WITH_HIGH_RISK_REVIEW
  if (unknownComplements.length > 0 && hasCriticalFindings) {
    addFinding(
      "CROSS_UNKNOWN_COMPLEMENT_WITH_HIGH_RISK_REVIEW",
      "INFO",
      "Complementos no clasificados con hallazgos críticos",
      `Se encontraron ${unknownComplements.length} complemento(s) no clasificado(s) y existen hallazgos CRITICAL en el CFDI. Los complementos no clasificados podrían requerir validación adicional.`,
      "Revisa la procedencia y validez de los complementos no reconocidos por el motor.",
      buildEvidence(ctx),
    );
  }

  // G4) CROSS_ADDENDA_WITH_CRITICAL_FINDINGS_REVIEW
  if (hasAddenda && hasCriticalFindings) {
    addFinding(
      "CROSS_ADDENDA_WITH_CRITICAL_FINDINGS_REVIEW",
      "INFO",
      "Addenda presente con hallazgos críticos",
      "El CFDI incluye Addenda pero existen hallazgos CRITICAL. La Addenda podría requerir validación operativa adicional para asegurar que los datos comerciales sean correctos.",
      "Revisa que la Addenda y los datos del CFDI sean consistentes antes de su uso operativo.",
      buildEvidence(ctx),
    );
  }
}
