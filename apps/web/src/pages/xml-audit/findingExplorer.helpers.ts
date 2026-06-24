import type { Finding } from "../../api/xml-audit";

const MODULE_LABELS: Record<string, string> = {
  "cfdi-base": "CFDI Base",
  parties: "Emisor/Receptor",
  concepts: "Conceptos",
  "concept-taxes": "Impuestos por concepto",
  "global-taxes": "Impuestos globales",
  tfd: "Timbre Fiscal Digital",
  "cfdi-relations": "CFDI relacionados",
  payment: "Complemento de pago",
  nomina: "Nómina",
  "carta-porte": "Carta Porte",
  "comercio-exterior": "Comercio Exterior",
  retenciones: "Retenciones",
  "impuestos-locales": "Impuestos locales",
  "leyendas-fiscales": "Leyendas fiscales",
  donatarias: "Donatarias",
  addenda: "Addenda",
  "cross-module": "Coherencia transversal",
  version: "Versión CFDI",
  catalogs: "Catálogos",
  unknown: "Sin clasificar",
};

export function getFindingModuleLabel(module: string): string {
  return MODULE_LABELS[module] ?? module;
}

export function getFindingLocationText(finding: Finding): string | null {
  const loc = finding.location;
  if (!loc) return null;
  const parts: string[] = [];
  const label = getFindingModuleLabel(loc.module);
  if (label) parts.push(label);
  if (loc.section && loc.index !== undefined) {
    parts.push(`${loc.section} #${loc.index + 1}`);
  } else if (loc.section) {
    parts.push(loc.section);
  }
  if (loc.parentIndex !== undefined) {
    const parentLabel = loc.section === "DoctoRelacionado" ? "Pago" : "Padre";
    parts.push(`${parentLabel} #${loc.parentIndex + 1}`);
  }
  if (loc.field) parts.push(loc.field);
  if (loc.logicalPath) parts.push(loc.logicalPath);
  return parts.length > 0 ? parts.join(" › ") : null;
}

export function getFindingValueTraceText(finding: Finding): string | null {
  const vt = finding.valueTrace;
  if (!vt) return null;
  const parts: string[] = [];
  if (vt.observed !== undefined && vt.observed !== null) parts.push(`Observado: ${vt.observed}`);
  if (vt.expected !== undefined && vt.expected !== null) parts.push(`Esperado: ${vt.expected}`);
  if (vt.calculated !== undefined && vt.calculated !== null)
    parts.push(`Calculado: ${vt.calculated}`);
  if (vt.difference !== undefined && vt.difference !== null)
    parts.push(`Diferencia: ${vt.difference}`);
  if (vt.tolerance !== undefined && vt.tolerance !== null)
    parts.push(`Tolerancia: ${vt.tolerance}`);
  return parts.length > 0 ? parts.join(" | ") : null;
}

export function getFindingSortWeight(finding: Finding): number {
  const p = finding.priority;
  const s = finding.severity;
  if (p === "BLOCKER") return 1;
  if (p === "HIGH") return 2;
  if (s === "CRITICAL") return 3;
  if (s === "WARNING") return 4;
  if (p === "MEDIUM") return 5;
  if (s === "INFO") return 6;
  if (p === "LOW") return 7;
  return 8;
}

export function sortFindings(fs: Finding[]): Finding[] {
  return [...fs].sort((a, b) => {
    const wa = getFindingSortWeight(a);
    const wb = getFindingSortWeight(b);
    if (wa !== wb) return wa - wb;
    if (a.code < b.code) return -1;
    if (a.code > b.code) return 1;
    return 0;
  });
}

export interface ModuleAggregate {
  module: string;
  label: string;
  total: number;
  critical: number;
  warning: number;
  info: number;
  blocker: number;
  high: number;
  medium: number;
  low: number;
  actionGroups: string[];
  topCodes: string[];
}

export function aggregateFindingsByModule(findings: Finding[]): ModuleAggregate[] {
  const map = new Map<string, ModuleAggregate>();
  for (const f of findings) {
    const mod = f.location?.module ?? "unknown";
    const label = getFindingModuleLabel(mod);
    let agg = map.get(mod);
    if (!agg) {
      agg = {
        module: mod,
        label,
        total: 0,
        critical: 0,
        warning: 0,
        info: 0,
        blocker: 0,
        high: 0,
        medium: 0,
        low: 0,
        actionGroups: [],
        topCodes: [],
      };
      map.set(mod, agg);
    }
    agg.total++;
    if (f.severity === "CRITICAL") agg.critical++;
    if (f.severity === "WARNING") agg.warning++;
    if (f.severity === "INFO") agg.info++;
    if (f.priority === "BLOCKER") agg.blocker++;
    if (f.priority === "HIGH") agg.high++;
    if (f.priority === "MEDIUM") agg.medium++;
    if (f.priority === "LOW") agg.low++;
    if (f.actionGroup && !agg.actionGroups.includes(f.actionGroup))
      agg.actionGroups.push(f.actionGroup);
    if (!agg.topCodes.includes(f.code)) agg.topCodes.push(f.code);
  }
  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}

export interface LocationAggregate {
  module: string;
  label: string;
  section: string;
  field: string;
  count: number;
  topCodes: string[];
}

export function aggregateFindingsByLocation(findings: Finding[]): LocationAggregate[] {
  const map = new Map<string, LocationAggregate>();
  for (const f of findings) {
    const loc = f.location;
    if (!loc) continue;
    const section = loc.section ?? "";
    const field = loc.field ?? "";
    const key = `${loc.module}|${section}|${field}`;
    let agg = map.get(key);
    if (!agg) {
      agg = {
        module: loc.module,
        label: getFindingModuleLabel(loc.module),
        section,
        field,
        count: 0,
        topCodes: [],
      };
      map.set(key, agg);
    }
    agg.count++;
    if (!agg.topCodes.includes(f.code)) agg.topCodes.push(f.code);
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}

export interface ActionGroupAggregate {
  group: string;
  total: number;
  critical: number;
  warning: number;
  info: number;
  blocker: number;
  high: number;
}

export function aggregateFindingsByActionGroup(findings: Finding[]): ActionGroupAggregate[] {
  const map = new Map<string, ActionGroupAggregate>();
  for (const f of findings) {
    const g = f.actionGroup ?? "Informativo";
    let agg = map.get(g);
    if (!agg) {
      agg = { group: g, total: 0, critical: 0, warning: 0, info: 0, blocker: 0, high: 0 };
      map.set(g, agg);
    }
    agg.total++;
    if (f.severity === "CRITICAL") agg.critical++;
    if (f.severity === "WARNING") agg.warning++;
    if (f.severity === "INFO") agg.info++;
    if (f.priority === "BLOCKER") agg.blocker++;
    if (f.priority === "HIGH") agg.high++;
  }
  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}

export interface FindingFilters {
  search?: string;
  severity?: string;
  priority?: string;
  actionGroup?: string;
  module?: string;
  hasValueTrace?: boolean;
  hasLocation?: boolean;
  onlyCriticalOrBlocker?: boolean;
}

export function filterFindings(findings: Finding[], filters: FindingFilters): Finding[] {
  return findings.filter((f) => {
    if (filters.severity && filters.severity !== "ALL" && f.severity !== filters.severity)
      return false;
    if (filters.priority && filters.priority !== "ALL" && f.priority !== filters.priority)
      return false;
    if (filters.actionGroup && f.actionGroup !== filters.actionGroup) return false;
    if (filters.module) {
      const fMod = f.location?.module ?? "unknown";
      if (fMod !== filters.module) return false;
    }
    if (filters.hasValueTrace && !f.valueTrace) return false;
    if (filters.hasLocation && !f.location) return false;
    if (filters.onlyCriticalOrBlocker && f.severity !== "CRITICAL" && f.priority !== "BLOCKER")
      return false;
    if (filters.search) {
      const q = filters.search.toLowerCase();
      const modLabel = f.location ? getFindingModuleLabel(f.location.module).toLowerCase() : "";
      const locField = f.location?.field?.toLowerCase() ?? "";
      const locPath = getFindingLocationText(f)?.toLowerCase() ?? "";
      if (
        !f.code.toLowerCase().includes(q) &&
        !f.title.toLowerCase().includes(q) &&
        !f.message.toLowerCase().includes(q) &&
        !(f.recommendedAction ?? "").toLowerCase().includes(q) &&
        !modLabel.includes(q) &&
        !locField.includes(q) &&
        !locPath.includes(q)
      ) {
        return false;
      }
    }
    return true;
  });
}

export function getUniqueModules(findings: Finding[]): string[] {
  const set = new Set<string>();
  for (const f of findings) {
    set.add(f.location?.module ?? "unknown");
  }
  return Array.from(set).sort();
}

export function getUniqueActionGroups(findings: Finding[]): string[] {
  const set = new Set<string>();
  for (const f of findings) {
    set.add(f.actionGroup ?? "Informativo");
  }
  return Array.from(set).sort();
}
