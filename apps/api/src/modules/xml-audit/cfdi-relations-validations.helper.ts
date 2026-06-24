interface RelatedCfdi {
  uuid?: string | null;
}

interface CfdiRelationGroup {
  tipoRelacion?: string | null;
  relatedCfdis: RelatedCfdi[];
}

interface CfdiRelations {
  totalRelationGroups: number;
  totalRelatedCfdis: number;
  groups: CfdiRelationGroup[];
}

interface PaymentDocument {
  idDocumento?: string;
}

interface PaymentInfo {
  documentosRelacionados: PaymentDocument[];
}

interface PaymentComplement {
  version?: string;
  pagos: PaymentInfo[];
}

export interface CfdiRelationsAdvancedContext {
  tipoComprobante: string | null;
  uuid: string | null;
  cfdiRelations: CfdiRelations | null;
  paymentComplement: PaymentComplement | null;
  addFinding: (
    code: string,
    severity: "INFO" | "WARNING" | "CRITICAL",
    title: string,
    message: string,
    recommendedAction?: string,
    evidence?: { label: string; value?: string }[],
  ) => void;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isStandardUuid(v: string | null | undefined): boolean {
  if (!v) return false;
  return UUID_REGEX.test(v.trim());
}

function normalizeUuid(v: string | null | undefined): string {
  if (!v) return "";
  return v.trim().toUpperCase();
}

function isTipoMatch(tipo: string | null | undefined, expected: string): boolean {
  if (!tipo) return false;
  const t = tipo.trim();
  return t === expected || t.toLowerCase() === expected.toLowerCase();
}

export function validateCfdiRelationsAdvanced(ctx: CfdiRelationsAdvancedContext): void {
  const { tipoComprobante, uuid, cfdiRelations, paymentComplement, addFinding } = ctx;

  const tipo = tipoComprobante?.trim() ?? null;

  function ev(label: string, value?: string | null): { label: string; value?: string } {
    return { label, value: value ?? "—" };
  }

  // B2) CFDI_RELATION_MULTIPLE_GROUPS_REVIEW
  if (cfdiRelations && cfdiRelations.groups.length > 1) {
    addFinding(
      "CFDI_RELATION_MULTIPLE_GROUPS_REVIEW",
      "INFO",
      "Múltiples grupos de CFDI relacionados",
      `Se detectaron ${cfdiRelations.groups.length} grupos de CfdiRelacionados. Puede ser válido, pero requiere revisión operativa.`,
      "Verifica que todos los grupos sean necesarios y correspondan a relaciones fiscales correctas.",
      [
        ev("Grupos detectados", String(cfdiRelations.groups.length)),
        ev("Total UUIDs relacionados", String(cfdiRelations.totalRelatedCfdis)),
        ev("UUID comprobante", uuid),
      ],
    );
  }

  if (!cfdiRelations || cfdiRelations.groups.length === 0) return;

  const allRelatedUuids: { uuid: string; tipoRelacion: string | null; groupIndex: number }[] = [];

  cfdiRelations.groups.forEach((group) => {
    group.relatedCfdis.forEach((rel) => {
      if (rel.uuid && isStandardUuid(rel.uuid)) {
        allRelatedUuids.push({
          uuid: normalizeUuid(rel.uuid),
          tipoRelacion: group.tipoRelacion?.trim() ?? null,
          groupIndex: cfdiRelations.groups.indexOf(group),
        });
      }
    });
  });

  const totalValidUuids = allRelatedUuids.length;
  const totalRelated = cfdiRelations.totalRelatedCfdis;

  // B3) CFDI_RELATION_SAME_UUID_DIFFERENT_TIPO_RELACION_REVIEW
  const uuidToTipos = new Map<string, Set<string>>();
  for (const entry of allRelatedUuids) {
    if (entry.tipoRelacion) {
      if (!uuidToTipos.has(entry.uuid)) uuidToTipos.set(entry.uuid, new Set());
      uuidToTipos.get(entry.uuid)!.add(entry.tipoRelacion);
    }
  }
  for (const [relatedUuid, tipos] of uuidToTipos.entries()) {
    if (tipos.size > 1) {
      addFinding(
        "CFDI_RELATION_SAME_UUID_DIFFERENT_TIPO_RELACION_REVIEW",
        "INFO",
        "Mismo UUID relacionado con distintos TipoRelacion",
        `El UUID "${relatedUuid}" aparece relacionado con diferentes TipoRelación (${Array.from(tipos).join(", ")}). Puede ser válido en escenarios específicos, pero requiere revisión.`,
        "Verifica que la misma relación no tenga inconsistencia de tipo entre grupos.",
        [
          ev("UUID relacionado", relatedUuid),
          ev("Tipos de relación", Array.from(tipos).join(", ")),
          ev("UUID comprobante", uuid),
        ],
      );
    }
  }

  // C3) INGRESO_WITH_TIPO_RELACION_01_REVIEW
  if (isTipoMatch(tipo, "I")) {
    const hasTipo01 = cfdiRelations.groups.some((g) => g.tipoRelacion?.trim() === "01");
    if (hasTipo01) {
      addFinding(
        "INGRESO_WITH_TIPO_RELACION_01_REVIEW",
        "INFO",
        "Ingreso con TipoRelacion 01 (Nota de crédito)",
        "El comprobante es de tipo Ingreso pero tiene TipoRelacion 01 (Nota de crédito). Esto es inusual porque las notas de crédito suelen asociarse a egresos.",
        "Revisa si el TipoRelacion es correcto para el escenario fiscal del comprobante.",
        [ev("Tipo comprobante", tipo), ev("TipoRelacion", "01"), ev("UUID comprobante", uuid)],
      );
    }
  }

  // C5) NOMINA_WITH_CFDI_RELACIONADOS_REVIEW
  if (isTipoMatch(tipo, "N") && totalRelated > 0) {
    addFinding(
      "NOMINA_WITH_CFDI_RELACIONADOS_REVIEW",
      "INFO",
      "Nómina con CFDI relacionados",
      "El comprobante de nómina incluye CfdiRelacionados. Esto no es común y puede requerir revisión.",
      "Verifica si la relación con otros CFDIs es necesaria para el comprobante de nómina.",
      [
        ev("Tipo comprobante", tipo),
        ev("Total relacionados", String(totalRelated)),
        ev("UUID comprobante", uuid),
      ],
    );
  }

  // C6) TRASLADO_WITH_TIPO_RELACION_01_REVIEW
  if (isTipoMatch(tipo, "T")) {
    const hasTipo01 = cfdiRelations.groups.some((g) => g.tipoRelacion?.trim() === "01");
    if (hasTipo01) {
      addFinding(
        "TRASLADO_WITH_TIPO_RELACION_01_REVIEW",
        "INFO",
        "Traslado con TipoRelacion 01 (Nota de crédito)",
        "El comprobante de traslado tiene TipoRelacion 01. Esto puede ser válido, pero el uso más común en traslados es 03, 05 o 06.",
        "Revisa que el TipoRelacion sea correcto según el escenario del traslado.",
        [ev("Tipo comprobante", tipo), ev("TipoRelacion", "01"), ev("UUID comprobante", uuid)],
      );
    }
  }

  // D1) PAYMENT_WITHOUT_RELATED_DOCUMENTS_BUT_CFDI_RELACIONADOS_REVIEW
  if (isTipoMatch(tipo, "P") && paymentComplement) {
    const hasAnyDoc = paymentComplement.pagos.some((p) => p.documentosRelacionados.length > 0);
    if (!hasAnyDoc && totalRelated > 0) {
      addFinding(
        "PAYMENT_WITHOUT_RELATED_DOCUMENTS_BUT_CFDI_RELACIONADOS_REVIEW",
        "WARNING",
        "Pago sin DoctoRelacionado pero con CfdiRelacionados",
        "El comprobante de pago no incluye DoctoRelacionado en el complemento Pagos, pero sí tiene CfdiRelacionados. Los documentos pagados deben registrarse dentro del complemento Pago.",
        "Revisa que los documentos pagados estén correctamente capturados como DoctoRelacionado en el complemento Pagos.",
        [
          ev("UUID comprobante", uuid),
          ev("CFDI relacionados", String(totalRelated)),
          ev("Complemento Pagos presente", "Sí"),
          ev("DoctoRelacionado en Pagos", "Ninguno"),
        ],
      );
    }
  }

  // D2) PAYMENT_DOC_RELATED_UUID_DUPLICATED_IN_CFDI_RELACIONADOS_REVIEW
  if (paymentComplement) {
    const paymentDocUuids = new Set<string>();
    for (const pago of paymentComplement.pagos) {
      for (const doc of pago.documentosRelacionados) {
        if (doc.idDocumento) {
          paymentDocUuids.add(normalizeUuid(doc.idDocumento));
        }
      }
    }
    if (paymentDocUuids.size > 0) {
      const seen = new Set<string>();
      for (const entry of allRelatedUuids) {
        if (paymentDocUuids.has(entry.uuid) && !seen.has(entry.uuid)) {
          seen.add(entry.uuid);
          addFinding(
            "PAYMENT_DOC_RELATED_UUID_DUPLICATED_IN_CFDI_RELACIONADOS_REVIEW",
            "INFO",
            "UUID de DoctoRelacionado duplicado en CfdiRelacionados",
            `El UUID "${entry.uuid}" aparece tanto en DoctoRelacionado del complemento Pago como en CfdiRelacionados. Puede ser redundante o un error operativo.`,
            "Revisa si la relación es necesaria en ambos lugares o si puede eliminarse de CfdiRelacionados.",
            [ev("UUID duplicado", entry.uuid), ev("UUID comprobante", uuid)],
          );
        }
      }
    }
  }

  // F1) CFDI_RELATION_WITH_ONLY_UNKNOWN_UUIDS_REVIEW
  if (totalRelated > 0 && totalValidUuids === 0) {
    addFinding(
      "CFDI_RELATION_WITH_ONLY_UNKNOWN_UUIDS_REVIEW",
      "WARNING",
      "Todos los UUIDs relacionados son inválidos o faltantes",
      `Se encontraron ${totalRelated} CFDI relacionados, pero ninguno tiene un UUID con formato válido. Esto puede indicar un problema de generación del XML.`,
      "Revisa que cada CFDI relacionado incluya un UUID con formato estándar.",
      [
        ev("Total relacionados", String(totalRelated)),
        ev("Total UUIDs válidos", "0"),
        ev("UUID comprobante", uuid),
      ],
    );
  }

  // F2) CFDI_RELATION_TOO_MANY_UUIDS_REVIEW
  for (let gi = 0; gi < cfdiRelations.groups.length; gi++) {
    const group = cfdiRelations.groups[gi];
    if (group.relatedCfdis.length > 20) {
      addFinding(
        "CFDI_RELATION_TOO_MANY_UUIDS_REVIEW",
        "INFO",
        "Grupo de relación con muchos UUIDs",
        `El grupo #${gi + 1} tiene ${group.relatedCfdis.length} UUIDs relacionados. Una cantidad tan alta puede ser válida, pero conviene revisarla.`,
        "Verifica que todos los UUIDs relacionados sean correctos y necesarios.",
        [
          ev("Grupo #", String(gi + 1)),
          ev("Cantidad UUIDs", String(group.relatedCfdis.length)),
          ev("TipoRelacion", group.tipoRelacion ?? "—"),
          ev("UUID comprobante", uuid),
        ],
      );
    }
  }

  // F3) CFDI_RELATION_TOTAL_UUID_COUNT_REVIEW
  if (totalRelated > 50) {
    addFinding(
      "CFDI_RELATION_TOTAL_UUID_COUNT_REVIEW",
      "INFO",
      "Demasiados UUIDs relacionados en total",
      `El CFDI tiene ${totalRelated} UUIDs relacionados en total. Una cantidad excesiva puede indicar un problema de generación o agrupación incorrecta.`,
      "Revisa la totalidad de los UUIDs relacionados y confirma que sean necesarios.",
      [ev("Total UUIDs relacionados", String(totalRelated)), ev("UUID comprobante", uuid)],
    );
  }
}
