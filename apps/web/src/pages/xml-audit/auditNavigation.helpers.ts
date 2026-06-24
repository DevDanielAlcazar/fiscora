import type { Finding, ZipFullAnalysisFileResult } from "../../api/xml-audit";
import { getFindingModuleLabel, getFindingLocationText } from "./findingExplorer.helpers";
import { calculateRiskScore } from "./riskScore.helpers";

export type SortMode =
  | "priority"
  | "severity"
  | "module"
  | "actionGroup"
  | "location"
  | "code"
  | "riskImpact"
  | "differenceDesc";

export interface SmartFilters {
  text?: string;
  severities: string[];
  priorities: string[];
  actionGroups: string[];
  modules: string[];
  fields: string[];
  hasLocation: boolean | null;
  hasValueTrace: boolean | null;
  onlyCriticalOrBlocker: boolean;
  onlyWithDifference: boolean;
  onlyTaxImpact: boolean;
  onlyTechnicalImpact: boolean;
  onlySupportMessageRelevant: boolean;
}

export interface FilterOptionSet {
  severities: string[];
  priorities: string[];
  actionGroups: string[];
  modules: string[];
  fields: string[];
  hasLocation: boolean;
  hasValueTrace: boolean;
}

export interface QuickFilterPreset {
  key: string;
  label: string;
  filter: (f: Finding) => boolean;
}

export function buildAuditFilterOptions(findings: Finding[]): FilterOptionSet {
  const severities = new Set<string>();
  const priorities = new Set<string>();
  const actionGroups = new Set<string>();
  const modules = new Set<string>();
  const fields = new Set<string>();
  let hasLocation = false;
  let hasValueTrace = false;

  for (const f of findings) {
    if (f.severity) severities.add(f.severity);
    if (f.priority) priorities.add(f.priority);
    if (f.actionGroup) actionGroups.add(f.actionGroup);
    if (f.location?.module) modules.add(f.location.module);
    if (f.location?.field) fields.add(f.location.field);
    if (f.location) hasLocation = true;
    if (f.valueTrace) hasValueTrace = true;
  }

  return {
    severities: Array.from(severities).sort(),
    priorities: Array.from(priorities).sort(),
    actionGroups: Array.from(actionGroups).sort(),
    modules: Array.from(modules).sort(),
    fields: Array.from(fields).sort(),
    hasLocation,
    hasValueTrace,
  };
}

export function buildQuickFilterPresets(compact = false): QuickFilterPreset[] {
  const all: QuickFilterPreset[] = [
    { key: "all", label: "Todos", filter: () => true },
    { key: "blocker", label: "Bloqueantes", filter: (f) => f.priority === "BLOCKER" },
    { key: "critical", label: "Críticos", filter: (f) => f.severity === "CRITICAL" },
    {
      key: "high-risk",
      label: "Alto riesgo",
      filter: (f) => f.severity === "CRITICAL" || f.priority === "BLOCKER" || f.priority === "HIGH",
    },
    { key: "with-diff", label: "Con diferencia", filter: (f) => !!f.valueTrace?.difference },
    { key: "no-location", label: "Sin ubicación", filter: (f) => !f.location },
    {
      key: "tax",
      label: "Impuestos",
      filter: (f) =>
        (f.actionGroup ?? "").toUpperCase().includes("TAX") ||
        (f.actionGroup ?? "").toUpperCase().includes("IMPUESTO"),
    },
    {
      key: "payment",
      label: "Pagos",
      filter: (f) =>
        f.location?.module === "payment" || (f.actionGroup ?? "").toUpperCase().includes("PAGO"),
    },
    {
      key: "tfd",
      label: "Timbre",
      filter: (f) =>
        f.location?.module === "tfd" || (f.actionGroup ?? "").toUpperCase().includes("TFD"),
    },
    {
      key: "complements",
      label: "Complementos",
      filter: (f) =>
        f.location?.module === "nomina" ||
        f.location?.module === "carta-porte" ||
        f.location?.module === "comercio-exterior",
    },
    { key: "parties", label: "Emisor/Receptor", filter: (f) => f.location?.module === "parties" },
    {
      key: "cfdi-relations",
      label: "CFDI relacionados",
      filter: (f) => f.location?.module === "cfdi-relations",
    },
    {
      key: "fiscal-action",
      label: "Requieren acción fiscal",
      filter: (f) =>
        (f.actionGroup ?? "").toUpperCase().includes("TAX") || f.severity === "CRITICAL",
    },
    {
      key: "technical-review",
      label: "Requieren revisión técnica",
      filter: (f) =>
        f.category === "TECHNICAL" || (f.actionGroup ?? "").toUpperCase().includes("STRUCTURE"),
    },
  ];

  if (compact) {
    return all.filter((p) =>
      ["all", "critical", "blocker", "high-risk", "with-diff"].includes(p.key),
    );
  }

  return all;
}

export function filterFindingsSmart(findings: Finding[], filters: SmartFilters): Finding[] {
  return findings.filter((f) => {
    if (filters.text) {
      const q = filters.text.toLowerCase();
      const modLabel = f.location ? getFindingModuleLabel(f.location.module).toLowerCase() : "";
      const locField = f.location?.field?.toLowerCase() ?? "";
      const locText = getFindingLocationText(f)?.toLowerCase() ?? "";
      if (
        !f.code.toLowerCase().includes(q) &&
        !f.title.toLowerCase().includes(q) &&
        !f.message.toLowerCase().includes(q) &&
        !(f.recommendedAction ?? "").toLowerCase().includes(q) &&
        !modLabel.includes(q) &&
        !locField.includes(q) &&
        !locText.includes(q)
      ) {
        return false;
      }
    }
    if (filters.severities.length > 0 && !filters.severities.includes(f.severity)) return false;
    if (filters.priorities.length > 0 && (!f.priority || !filters.priorities.includes(f.priority)))
      return false;
    if (
      filters.actionGroups.length > 0 &&
      (!f.actionGroup || !filters.actionGroups.includes(f.actionGroup))
    )
      return false;
    if (
      filters.modules.length > 0 &&
      (!f.location?.module || !filters.modules.includes(f.location.module))
    )
      return false;
    if (
      filters.fields.length > 0 &&
      (!f.location?.field || !filters.fields.includes(f.location.field))
    )
      return false;
    if (filters.hasLocation === true && !f.location) return false;
    if (filters.hasLocation === false && f.location) return false;
    if (filters.hasValueTrace === true && !f.valueTrace) return false;
    if (filters.hasValueTrace === false && f.valueTrace) return false;
    if (filters.onlyCriticalOrBlocker && f.severity !== "CRITICAL" && f.priority !== "BLOCKER")
      return false;
    if (filters.onlyWithDifference && !f.valueTrace?.difference) return false;
    if (
      filters.onlyTaxImpact &&
      !(f.actionGroup ?? "").toUpperCase().includes("TAX") &&
      !(f.actionGroup ?? "").toUpperCase().includes("IMPUESTO")
    )
      return false;
    if (filters.onlyTechnicalImpact && f.category !== "TECHNICAL") return false;
    if (filters.onlySupportMessageRelevant && !f.recommendedAction) return false;
    return true;
  });
}

const SORT_PRIORITY_ORDER: Record<string, number> = { BLOCKER: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
const SORT_SEVERITY_ORDER: Record<string, number> = { CRITICAL: 0, WARNING: 1, INFO: 2 };

export function sortFindingsSmart(findings: Finding[], sortMode: SortMode): Finding[] {
  return [...findings].sort((a, b) => {
    switch (sortMode) {
      case "priority": {
        const pa = SORT_PRIORITY_ORDER[a.priority ?? "LOW"] ?? 4;
        const pb = SORT_PRIORITY_ORDER[b.priority ?? "LOW"] ?? 4;
        if (pa !== pb) return pa - pb;
        return a.code.localeCompare(b.code);
      }
      case "severity": {
        const sa = SORT_SEVERITY_ORDER[a.severity] ?? 3;
        const sb = SORT_SEVERITY_ORDER[b.severity] ?? 3;
        if (sa !== sb) return sa - sb;
        return a.code.localeCompare(b.code);
      }
      case "module": {
        const ma = a.location ? getFindingModuleLabel(a.location.module) : "";
        const mb = b.location ? getFindingModuleLabel(b.location.module) : "";
        if (ma !== mb) return ma.localeCompare(mb);
        return a.code.localeCompare(b.code);
      }
      case "actionGroup": {
        const aa = a.actionGroup ?? "";
        const ab = b.actionGroup ?? "";
        if (aa !== ab) return aa.localeCompare(ab);
        return a.code.localeCompare(b.code);
      }
      case "location": {
        const la = getFindingLocationText(a) ?? "";
        const lb = getFindingLocationText(b) ?? "";
        if (la !== lb) return la.localeCompare(lb);
        return a.code.localeCompare(b.code);
      }
      case "code": {
        return a.code.localeCompare(b.code);
      }
      case "riskImpact": {
        const sevA = SORT_SEVERITY_ORDER[a.severity] ?? 3;
        const sevB = SORT_SEVERITY_ORDER[b.severity] ?? 3;
        if (sevA !== sevB) return sevA - sevB;
        const priA = SORT_PRIORITY_ORDER[a.priority ?? "LOW"] ?? 4;
        const priB = SORT_PRIORITY_ORDER[b.priority ?? "LOW"] ?? 4;
        if (priA !== priB) return priA - priB;
        return a.code.localeCompare(b.code);
      }
      case "differenceDesc": {
        const diffA = a.valueTrace?.difference;
        const diffB = b.valueTrace?.difference;
        const numA = diffA !== undefined && diffA !== null ? Number(diffA) : NaN;
        const numB = diffB !== undefined && diffB !== null ? Number(diffB) : NaN;
        if (!isNaN(numA) && !isNaN(numB)) return numB - numA;
        if (!isNaN(numA)) return -1;
        if (!isNaN(numB)) return 1;
        return 0;
      }
      default:
        return 0;
    }
  });
}

export function getFindingNavigationAnchor(finding: Finding, index: number): string {
  return `finding-${finding.code}-${index}`;
}

export function summarizeActiveFilters(filters: SmartFilters): string | null {
  const parts: string[] = [];
  if (filters.severities.length > 0) parts.push(filters.severities.join(", "));
  if (filters.priorities.length > 0) parts.push(`Prioridad: ${filters.priorities.join(", ")}`);
  if (filters.modules.length > 0)
    parts.push(`Módulo: ${filters.modules.map(getFindingModuleLabel).join(", ")}`);
  if (filters.actionGroups.length > 0) parts.push(`Grupo: ${filters.actionGroups.join(", ")}`);
  if (filters.onlyCriticalOrBlocker) parts.push("Críticos/Bloqueantes");
  if (filters.onlyWithDifference) parts.push("Con diferencia");
  if (filters.hasLocation === true) parts.push("Con ubicación");
  if (filters.hasLocation === false) parts.push("Sin ubicación");
  if (parts.length === 0) return null;
  return `${parts.length} filtro${parts.length > 1 ? "s" : ""} activo${parts.length > 1 ? "s" : ""}: ${parts.join(", ")}`;
}

export type ZipSortMode =
  | "score-asc"
  | "score-desc"
  | "critical-desc"
  | "warning-desc"
  | "name"
  | "status";

export interface ZipFilters {
  text?: string;
  statusFilter: string;
  scoreMax: number | null;
  hasCritical: boolean;
  hasWarning: boolean;
  hasBom: boolean;
  hasNormalizedXml: boolean;
  hasTimbreError: boolean;
  hasTaxError: boolean;
  hasPaymentError: boolean;
  hasCartaPorteError: boolean;
  hasRetenciones: boolean;
  hasNomina: boolean;
}

export function buildZipQuickFilters(): Array<{ key: string; label: string }> {
  return [
    { key: "all", label: "Todos" },
    { key: "failed", label: "Fallidos" },
    { key: "score-low", label: "Score < 40" },
    { key: "score-mid", label: "Score < 70" },
    { key: "has-critical", label: "Con críticos" },
    { key: "has-warning", label: "Con advertencias" },
    { key: "has-bom", label: "Con BOM" },
    { key: "has-xml", label: "XML normalizado" },
    { key: "timbre-error", label: "Errores timbre" },
    { key: "tax-error", label: "Errores impuestos" },
    { key: "payment-error", label: "Errores pagos" },
    { key: "cp-error", label: "Carta Porte/CCE" },
    { key: "retenciones", label: "Retenciones" },
    { key: "nomina", label: "Nómina" },
  ];
}

export function filterZipFiles(
  files: ZipFullAnalysisFileResult[],
  filters: ZipFilters,
): ZipFullAnalysisFileResult[] {
  return files.filter((r) => {
    if (filters.text) {
      const q = filters.text.toLowerCase();
      if (!r.name.toLowerCase().includes(q)) return false;
    }
    if (filters.statusFilter === "failed" && r.status !== "FAILED") return false;
    if (r.status !== "ANALYZED" || !r.analysis) {
      return filters.statusFilter === "all" || filters.statusFilter === "failed";
    }
    const fnd = r.analysis.findings ?? [];
    if (filters.scoreMax !== null) {
      const sr = calculateRiskScore(fnd);
      if (sr.score >= filters.scoreMax) return false;
    }
    if (filters.hasCritical && !fnd.some((fx) => fx.severity === "CRITICAL")) return false;
    if (filters.hasWarning && !fnd.some((fx) => fx.severity === "WARNING")) return false;
    if (filters.hasBom && !r.analysis.technicalDiagnostics?.bomDetected) return false;
    if (filters.hasNormalizedXml && !r.analysis.normalizedXml?.available) return false;
    if (filters.hasTimbreError && !fnd.some((fx) => fx.location?.module === "tfd")) return false;
    if (
      filters.hasTaxError &&
      !fnd.some((fx) => (fx.actionGroup ?? "").toUpperCase().includes("TAX"))
    )
      return false;
    if (filters.hasPaymentError && !fnd.some((fx) => fx.location?.module === "payment"))
      return false;
    if (
      filters.hasCartaPorteError &&
      !fnd.some(
        (fx) =>
          fx.location?.module === "carta-porte" || fx.location?.module === "comercio-exterior",
      )
    )
      return false;
    if (filters.hasRetenciones && r.analysis.documentKind !== "RETENCIONES") return false;
    if (filters.hasNomina && !fnd.some((fx) => fx.location?.module === "nomina")) return false;
    return true;
  });
}

export function sortZipFiles(
  files: ZipFullAnalysisFileResult[],
  sortMode: ZipSortMode,
): ZipFullAnalysisFileResult[] {
  return [...files].sort((a, b) => {
    switch (sortMode) {
      case "score-asc": {
        const sa =
          a.status === "ANALYZED" && a.analysis?.findings
            ? calculateRiskScore(a.analysis.findings).score
            : 0;
        const sb =
          b.status === "ANALYZED" && b.analysis?.findings
            ? calculateRiskScore(b.analysis.findings).score
            : 0;
        return sa - sb;
      }
      case "score-desc": {
        const sa =
          a.status === "ANALYZED" && a.analysis?.findings
            ? calculateRiskScore(a.analysis.findings).score
            : 0;
        const sb =
          b.status === "ANALYZED" && b.analysis?.findings
            ? calculateRiskScore(b.analysis.findings).score
            : 0;
        return sb - sa;
      }
      case "critical-desc": {
        const ca =
          a.status === "ANALYZED" && a.analysis?.findings
            ? a.analysis.findings.filter((fx) => fx.severity === "CRITICAL").length
            : 0;
        const cb =
          b.status === "ANALYZED" && b.analysis?.findings
            ? b.analysis.findings.filter((fx) => fx.severity === "CRITICAL").length
            : 0;
        if (ca !== cb) return cb - ca;
        return (a.status === "FAILED" ? 1 : 0) - (b.status === "FAILED" ? 1 : 0);
      }
      case "warning-desc": {
        const wa =
          a.status === "ANALYZED" && a.analysis?.findings
            ? a.analysis.findings.filter((fx) => fx.severity === "WARNING").length
            : 0;
        const wb =
          b.status === "ANALYZED" && b.analysis?.findings
            ? b.analysis.findings.filter((fx) => fx.severity === "WARNING").length
            : 0;
        if (wa !== wb) return wb - wa;
        return (a.status === "FAILED" ? 1 : 0) - (b.status === "FAILED" ? 1 : 0);
      }
      case "name":
        return a.name.localeCompare(b.name);
      case "status":
        return a.status.localeCompare(b.status);
      default:
        return 0;
    }
  });
}

export function getZipFileTopModules(files: ZipFullAnalysisFileResult[]): string[] {
  const moduleCount = new Map<string, number>();
  for (const r of files) {
    if (r.status !== "ANALYZED" || !r.analysis?.findings) continue;
    const mods = new Set<string>();
    for (const f of r.analysis.findings) {
      if (f.location?.module) mods.add(getFindingModuleLabel(f.location.module));
    }
    for (const m of mods) {
      moduleCount.set(m, (moduleCount.get(m) ?? 0) + 1);
    }
  }
  return Array.from(moduleCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([m]) => m);
}

export function getZipFileActionGroupAggregates(files: ZipFullAnalysisFileResult[]): Array<{
  group: string;
  fileCount: number;
}> {
  const map = new Map<string, Set<string>>();
  for (const r of files) {
    if (r.status !== "ANALYZED" || !r.analysis?.findings) continue;
    for (const f of r.analysis.findings) {
      const g = f.actionGroup ?? "Informativo";
      if (!map.has(g)) map.set(g, new Set());
      map.get(g)!.add(r.name);
    }
  }
  return Array.from(map.entries())
    .map(([group, filesSet]) => ({ group, fileCount: filesSet.size }))
    .sort((a, b) => b.fileCount - a.fileCount);
}
