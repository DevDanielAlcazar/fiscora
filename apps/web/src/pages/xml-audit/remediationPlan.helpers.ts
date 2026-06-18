import type { Finding } from "../../api/xml-audit";

export interface RemediationPlanItem {
  id: string;
  code: string;
  title: string;
  severity: string;
  priority: string;
  category: string;
  actionGroup: string;
  occurrences: number;
  ownerSuggestion: string;
  effort: "BAJO" | "MEDIO" | "ALTO";
  urgency: "INMEDIATA" | "ALTA" | "MEDIA" | "BAJA";
  recommendedAction: string;
  checklist: string[];
  evidenceSummary: string[];
  relatedCodes: string[];
}

export interface AggregateRemediationSource {
  fileId: string;
  filename: string;
  status?: string | null;
  riskLevel?: string | null;
  documentKind?: string | null;
  findings: Finding[];
}

export interface AggregateRemediationPlanItem extends RemediationPlanItem {
  affectedFiles: number;
  affectedFileNames: string[];
  criticalFiles: number;
  warningFiles: number;
  failedFiles: number;
  topExamples: Array<{
    fileId: string;
    filename: string;
    riskLevel?: string | null;
    documentKind?: string | null;
    occurrences: number;
  }>;
}

export interface RemediationPlanSummary {
  totalItems: number;
  immediate: number;
  high: number;
  medium: number;
  low: number;
  estimatedEffortHigh: number;
  byOwner: Array<{
    owner: string;
    items: number;
  }>;
}

export interface AggregateRemediationPlanSummary extends RemediationPlanSummary {
  affectedFiles: number;
  criticalFiles: number;
  warningFiles: number;
  failedFiles: number;
}

export interface RemediationPlanResult {
  summary: RemediationPlanSummary;
  items: RemediationPlanItem[];
}

export interface AggregateRemediationPlanResult {
  summary: AggregateRemediationPlanSummary;
  items: AggregateRemediationPlanItem[];
}

const PRIORITY_RANKING: Record<string, number> = { BLOCKER: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
const SEVERITY_RANKING: Record<string, number> = { CRITICAL: 3, WARNING: 2, INFO: 1 };

function getUrgency(priority: string, severity: string): "INMEDIATA" | "ALTA" | "MEDIA" | "BAJA" {
  if (priority === "BLOCKER" || severity === "CRITICAL") return "INMEDIATA";
  if (priority === "HIGH") return "ALTA";
  if (priority === "MEDIUM") return "MEDIA";
  return "BAJA";
}

function getEffort(item: {
  actionGroup: string;
  category: string;
  severity: string;
}): "BAJO" | "MEDIO" | "ALTO" {
  const ag = item.actionGroup.toLowerCase();
  const cat = item.category.toLowerCase();

  if (
    ag.includes("importes") ||
    ag.includes("totales") ||
    ag.includes("impuestos") ||
    cat.includes("tax") ||
    cat.includes("totals") ||
    item.severity === "CRITICAL"
  ) {
    return "ALTO";
  }

  if (
    ag.includes("datos fiscales") ||
    ag.includes("timbrado") ||
    ag.includes("estructura") ||
    ag.includes("complemento") ||
    cat.includes("fiscal") ||
    cat.includes("technical") ||
    cat.includes("complement")
  ) {
    return "MEDIO";
  }

  return "BAJO";
}

function getOwnerSuggestion(actionGroup: string): string {
  const ag = actionGroup.toLowerCase();
  if (ag.includes("importes") || ag.includes("totales")) return "Facturación / Contabilidad";
  if (ag.includes("impuestos")) return "Fiscal / Contabilidad";
  if (ag.includes("complemento")) return "Fiscal / Operación";
  if (ag.includes("datos fiscales") || ag.includes("validar rfc"))
    return "Fiscal / Maestro de datos";
  if (ag.includes("timbrado") || ag.includes("estructura")) return "Proveedor / Sistemas";
  if (ag.includes("referencias operativas")) return "Compras / Cuentas por pagar";
  return "Usuario responsable del XML";
}

function getChecklist(actionGroup: string): string[] {
  const ag = actionGroup.toLowerCase();
  if (ag.includes("importes") || ag.includes("totales")) {
    return [
      "Revisar subtotal, descuentos, bases, impuestos y total en el XML.",
      "Comparar contra PDF/representación impresa y sistema origen.",
      "Confirmar si el error requiere refacturación o ajuste operativo.",
      "Validar nuevamente el XML corregido en Fiscora.",
    ];
  }
  if (ag.includes("impuestos")) {
    return [
      "Identificar el concepto o impuesto señalado en la evidencia.",
      "Revisar tasa, base, tipo factor e importe.",
      "Confirmar tratamiento fiscal con el área responsable.",
      "Solicitar corrección al emisor si el impuesto está mal calculado.",
    ];
  }
  if (ag.includes("complemento")) {
    return [
      "Confirmar que el complemento corresponde al tipo de operación.",
      "Revisar campos obligatorios y totales del complemento.",
      "Validar que el complemento no esté incompleto.",
      "Solicitar XML corregido si el complemento no es consistente.",
    ];
  }
  if (ag.includes("datos fiscales") || ag.includes("validar rfc")) {
    return [
      "Revisar RFC, nombre, régimen fiscal, domicilio fiscal y UsoCFDI.",
      "Comparar contra constancia fiscal o datos maestros.",
      "Corregir datos en el sistema origen o solicitar refacturación.",
      "Revalidar el XML corregido.",
    ];
  }
  if (ag.includes("timbrado") || ag.includes("estructura")) {
    return [
      "Confirmar que el archivo sea el XML original timbrado.",
      "Revisar sello, certificado, UUID y Timbre Fiscal Digital.",
      "Evitar editar manualmente el XML.",
      "Solicitar al emisor el XML original si falta timbrado o certificado.",
    ];
  }
  if (ag.includes("referencias operativas")) {
    return [
      "Identificar OC, recepción, proveedor o referencia detectada.",
      "Comparar contra ERP/portal/cuentas por pagar.",
      "Confirmar si la referencia es suficiente para conciliación.",
      "Complementar documentación operativa si falta.",
    ];
  }
  return [
    "Revisar el hallazgo y su evidencia.",
    "Confirmar si aplica al caso operativo/fiscal.",
    "Documentar decisión si no requiere corrección.",
    "Revalidar si se recibe XML corregido.",
  ];
}

export function buildRemediationPlan(findings: Finding[]): RemediationPlanResult {
  const planMap = new Map<string, RemediationPlanItem>();

  for (const f of findings) {
    const existing = planMap.get(f.code);
    if (!existing) {
      const ag = f.actionGroup || "Informativo";
      planMap.set(f.code, {
        id: f.id,
        code: f.code,
        title: f.title || "",
        severity: f.severity,
        priority: f.priority || "LOW",
        category: f.category,
        actionGroup: ag,
        occurrences: 1,
        ownerSuggestion: getOwnerSuggestion(ag),
        effort: getEffort({ actionGroup: ag, category: f.category, severity: f.severity }),
        urgency: getUrgency(f.priority || "LOW", f.severity),
        recommendedAction: f.recommendedAction || "Revisar el contexto y confirmar validez.",
        checklist: getChecklist(ag),
        evidenceSummary: f.evidence
          ? f.evidence.slice(0, 2).map((e) => `${e.label}: ${e.value ?? "—"}`)
          : [],
        relatedCodes: [],
      });
    } else {
      existing.occurrences++;
      // Upgrade priority/severity if needed
      if (PRIORITY_RANKING[f.priority || "LOW"] > PRIORITY_RANKING[existing.priority]) {
        existing.priority = f.priority || "LOW";
        existing.urgency = getUrgency(existing.priority, existing.severity);
      }
      if (SEVERITY_RANKING[f.severity] > SEVERITY_RANKING[existing.severity]) {
        existing.severity = f.severity;
        existing.urgency = getUrgency(existing.priority, existing.severity);
        existing.effort = getEffort({
          actionGroup: existing.actionGroup,
          category: existing.category,
          severity: existing.severity,
        });
      }
      if (existing.evidenceSummary.length < 6 && f.evidence) {
        const moreEv = f.evidence.slice(0, 2).map((e) => `${e.label}: ${e.value ?? "—"}`);
        existing.evidenceSummary = Array.from(
          new Set([...existing.evidenceSummary, ...moreEv]),
        ).slice(0, 6);
      }
    }
  }

  const items = Array.from(planMap.values()).sort((a, b) => {
    const pA = PRIORITY_RANKING[a.priority] || 0;
    const pB = PRIORITY_RANKING[b.priority] || 0;
    if (pA !== pB) return pB - pA;
    const sA = SEVERITY_RANKING[a.severity] || 0;
    const sB = SEVERITY_RANKING[b.severity] || 0;
    if (sA !== sB) return sB - sA;
    if (a.occurrences !== b.occurrences) return b.occurrences - a.occurrences;
    return a.code.localeCompare(b.code);
  });

  // Related codes
  for (const item of items) {
    item.relatedCodes = items
      .filter((i) => i.code !== item.code && i.actionGroup === item.actionGroup)
      .map((i) => i.code)
      .slice(0, 5);
  }

  const summary: RemediationPlanSummary = {
    totalItems: items.length,
    immediate: items.filter((i) => i.urgency === "INMEDIATA").length,
    high: items.filter((i) => i.urgency === "ALTA").length,
    medium: items.filter((i) => i.urgency === "MEDIA").length,
    low: items.filter((i) => i.urgency === "BAJA").length,
    estimatedEffortHigh: items.filter((i) => i.effort === "ALTO").length,
    byOwner: [],
  };

  const ownersMap = new Map<string, number>();
  for (const item of items) {
    ownersMap.set(item.ownerSuggestion, (ownersMap.get(item.ownerSuggestion) || 0) + 1);
  }
  summary.byOwner = Array.from(ownersMap.entries()).map(([owner, count]) => ({
    owner,
    items: count,
  }));

  return { summary, items };
}

export function buildAggregateRemediationPlan(
  sources: AggregateRemediationSource[],
): AggregateRemediationPlanResult {
  const codeMap = new Map<
    string,
    {
      item: AggregateRemediationPlanItem;
      files: Map<string, number>; // fileId -> occurrences
    }
  >();

  for (const source of sources) {
    for (const f of source.findings) {
      const existing = codeMap.get(f.code);
      const ag = f.actionGroup || "Informativo";

      if (!existing) {
        const item: AggregateRemediationPlanItem = {
          id: f.id,
          code: f.code,
          title: f.title || "",
          severity: f.severity,
          priority: f.priority || "LOW",
          category: f.category,
          actionGroup: ag,
          occurrences: 1,
          ownerSuggestion: getOwnerSuggestion(ag),
          effort: getEffort({ actionGroup: ag, category: f.category, severity: f.severity }),
          urgency: getUrgency(f.priority || "LOW", f.severity),
          recommendedAction: f.recommendedAction || "Revisar el contexto y confirmar validez.",
          checklist: getChecklist(ag),
          evidenceSummary: f.evidence
            ? f.evidence.slice(0, 2).map((e) => `${e.label}: ${e.value ?? "—"}`)
            : [],
          relatedCodes: [],
          affectedFiles: 1,
          affectedFileNames: [source.filename],
          criticalFiles: source.riskLevel === "CRITICAL" || f.severity === "CRITICAL" ? 1 : 0,
          warningFiles: source.riskLevel === "WARNING" || f.severity === "WARNING" ? 1 : 0,
          failedFiles: source.status === "FAILED" ? 1 : 0,
          topExamples: [
            {
              fileId: source.fileId,
              filename: source.filename,
              riskLevel: source.riskLevel,
              documentKind: source.documentKind,
              occurrences: 1,
            },
          ],
        };
        const filesMap = new Map<string, number>();
        filesMap.set(source.fileId, 1);
        codeMap.set(f.code, { item, files: filesMap });
      } else {
        const { item, files } = existing;
        item.occurrences++;
        files.set(source.fileId, (files.get(source.fileId) || 0) + 1);
        item.affectedFiles = files.size;
        item.affectedFileNames = Array.from(
          new Set([...item.affectedFileNames, source.filename]),
        ).slice(0, 10);

        if (source.riskLevel === "CRITICAL" || f.severity === "CRITICAL")
          existing.item.criticalFiles = 1; // Simplification: once critical, stays critical
        if (source.riskLevel === "WARNING" || f.severity === "WARNING")
          existing.item.warningFiles = 1;
        if (source.status === "FAILED") existing.item.failedFiles = 1;

        // Update topExamples
        const exampleIdx = item.topExamples.findIndex((e) => e.fileId === source.fileId);
        if (exampleIdx !== -1) {
          item.topExamples[exampleIdx].occurrences++;
        } else if (item.topExamples.length < 5) {
          item.topExamples.push({
            fileId: source.fileId,
            filename: source.filename,
            riskLevel: source.riskLevel,
            documentKind: source.documentKind,
            occurrences: 1,
          });
        }
      }
    }
  }

  const items = Array.from(codeMap.values())
    .map((v) => v.item)
    .sort((a, b) => {
      const pA = PRIORITY_RANKING[a.priority] || 0;
      const pB = PRIORITY_RANKING[b.priority] || 0;
      if (pA !== pB) return pB - pA;
      const sA = SEVERITY_RANKING[a.severity] || 0;
      const sB = SEVERITY_RANKING[b.severity] || 0;
      if (sA !== sB) return sB - sA;
      if (a.affectedFiles !== b.affectedFiles) return b.affectedFiles - a.affectedFiles;
      if (a.occurrences !== b.occurrences) return b.occurrences - a.occurrences;
      return a.code.localeCompare(b.code);
    });

  for (const item of items) {
    item.relatedCodes = items
      .filter((i) => i.code !== item.code && i.actionGroup === item.actionGroup)
      .map((i) => i.code)
      .slice(0, 5);
  }

  const summary: AggregateRemediationPlanSummary = {
    totalItems: items.length,
    immediate: items.filter((i) => i.urgency === "INMEDIATA").length,
    high: items.filter((i) => i.urgency === "ALTA").length,
    medium: items.filter((i) => i.urgency === "MEDIA").length,
    low: items.filter((i) => i.urgency === "BAJA").length,
    estimatedEffortHigh: items.filter((i) => i.effort === "ALTO").length,
    byOwner: [],
    affectedFiles: new Set(items.flatMap((i) => i.affectedFileNames)).size,
    criticalFiles: items.filter((i) => i.criticalFiles > 0).length,
    warningFiles: items.filter((i) => i.warningFiles > 0).length,
    failedFiles: items.filter((i) => i.failedFiles > 0).length,
  };

  const ownersMap = new Map<string, number>();
  for (const item of items) {
    ownersMap.set(item.ownerSuggestion, (ownersMap.get(item.ownerSuggestion) || 0) + 1);
  }
  summary.byOwner = Array.from(ownersMap.entries()).map(([owner, count]) => ({
    owner,
    items: count,
  }));

  return { summary, items };
}
