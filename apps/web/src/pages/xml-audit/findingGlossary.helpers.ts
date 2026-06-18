import type { Finding } from "../../api/xml-audit";

export interface FindingGlossaryEntry {
  code: string;
  title: string;
  severity: string;
  priority: string;
  category: string;
  actionGroup: string;
  message: string;
  recommendedAction: string;
  occurrences: number;
  sampleEvidence?: { label: string; value?: string }[];
}

export function buildFindingGlossary(findings: Finding[]): FindingGlossaryEntry[] {
  const glossaryMap = new Map<string, FindingGlossaryEntry>();

  const severityWeight = { CRITICAL: 3, WARNING: 2, INFO: 1 };
  const priorityWeight = { BLOCKER: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };

  for (const f of findings) {
    const existing = glossaryMap.get(f.code);
    if (!existing) {
      glossaryMap.set(f.code, {
        code: f.code,
        title: f.title || "",
        severity: f.severity,
        priority: f.priority || "LOW",
        category: f.category,
        actionGroup: f.actionGroup || "Informativo",
        message: f.message || "",
        recommendedAction: f.recommendedAction || "",
        occurrences: 1,
        sampleEvidence: f.evidence ? f.evidence.slice(0, 8) : undefined,
      });
    } else {
      existing.occurrences++;
      // Update severity if higher
      const currentSevWeight = severityWeight[f.severity] || 0;
      const existingSevWeight =
        severityWeight[existing.severity as keyof typeof severityWeight] || 0;
      if (currentSevWeight > existingSevWeight) {
        existing.severity = f.severity;
      }
      // Update priority if higher
      const currentPrioWeight = priorityWeight[f.priority as keyof typeof priorityWeight] || 0;
      const existingPrioWeight =
        priorityWeight[existing.priority as keyof typeof priorityWeight] || 0;
      if (currentPrioWeight > existingPrioWeight) {
        existing.priority = f.priority || "LOW";
      }
      // Prefer non-empty title/message/recommendedAction
      if (!existing.title && f.title) existing.title = f.title;
      if (!existing.message && f.message) existing.message = f.message;
      if (!existing.recommendedAction && f.recommendedAction)
        existing.recommendedAction = f.recommendedAction;
      if (existing.actionGroup === "Informativo" && f.actionGroup)
        existing.actionGroup = f.actionGroup;
    }
  }

  return Array.from(glossaryMap.values()).sort((a, b) => {
    const sA = severityWeight[a.severity as keyof typeof severityWeight] || 0;
    const sB = severityWeight[b.severity as keyof typeof severityWeight] || 0;
    if (sA !== sB) return sB - sA;
    const pA = priorityWeight[a.priority as keyof typeof priorityWeight] || 0;
    const pB = priorityWeight[b.priority as keyof typeof priorityWeight] || 0;
    return pB - pA;
  });
}

export function getFindingImpactLabel(severity: string): string {
  switch (severity) {
    case "CRITICAL":
      return "Puede bloquear uso operativo o requerir corrección antes de contabilizar/aceptar el XML.";
    case "WARNING":
      return "Requiere revisión antes de aceptar el XML como correcto.";
    case "INFO":
      return "Dato informativo o señal de revisión; normalmente no bloquea por sí solo.";
    default:
      return "Revisar el contexto del hallazgo y confirmar si aplica al caso.";
  }
}

export function getFindingRemediationHint(actionGroup: string): string {
  const ag = actionGroup.toLowerCase();
  if (ag.includes("corregir importes") || ag.includes("totales")) {
    return "Revisar importes, descuentos, bases, tasas y totales contra el XML original o solicitar refacturación.";
  }
  if (ag.includes("impuestos")) {
    return "Validar bases, tasas, tipo factor, impuestos trasladados/retenidos y consistencia con el tratamiento fiscal.";
  }
  if (ag.includes("complemento")) {
    return "Verificar que el complemento esté completo y corresponda al escenario fiscal/operativo.";
  }
  if (ag.includes("datos fiscales") || ag.includes("validar rfc")) {
    return "Confirmar RFC, nombre, régimen, uso CFDI, domicilio fiscal, exportación y datos emisor/receptor.";
  }
  if (ag.includes("timbrado") || ag.includes("estructura")) {
    return "Confirmar que el XML sea el original timbrado y no haya sido alterado.";
  }
  if (ag.includes("referencias operativas")) {
    return "Usar las referencias detectadas para conciliación con OC, recepción, proveedor o ERP.";
  }
  return "Revisar el contexto del hallazgo y confirmar si aplica al caso.";
}

export function getSeverityLabel(severity: string): string {
  switch (severity) {
    case "CRITICAL":
      return "Crítico";
    case "WARNING":
      return "Advertencia";
    case "INFO":
      return "Informativo";
    default:
      return severity;
  }
}

export function getCategoryLabel(category: string): string {
  switch (category) {
    case "TOTALS":
      return "Totales e importes";
    case "TAX":
      return "Impuestos";
    case "COMPLEMENT":
      return "Complementos";
    case "FISCAL":
      return "Datos fiscales";
    case "TECHNICAL":
      return "Técnico / timbrado";
    case "STRUCTURE":
      return "Estructura XML";
    default:
      return "General";
  }
}
