import type { ZipFullAnalysisFileResult } from "../../api/xml-audit";
import { priorityOrder, groupFindingsByActionGroup, severityOrder } from "./findingPriority";

export interface MassiveTotals {
  analyzed: number;
  failed: number;
  total: number;
  withCritical: number;
  withWarning: number;
  ok: number;
  withBom: number;
  withTechNorm: number;
  withNormXml: number;
}

export interface PriorityCounts {
  BLOCKER: number;
  HIGH: number;
  MEDIUM: number;
  LOW: number;
  filesWithBlocker: number;
  filesWithHigh: number;
}

export interface ActionGroupAgg {
  group: string;
  totalFindings: number;
  affectedFiles: string[];
  criticalCount: number;
  warningCount: number;
  infoCount: number;
}

export interface TopFindingRow {
  code: string;
  title: string;
  maxSeverity: string;
  maxPriority: string;
  totalAppearances: number;
  affectedFiles: string[];
  recommendedAction: string;
}

export interface DocKindCounts {
  CFDI: number;
  RETENCIONES: number;
  UNKNOWN: number;
}

export interface ModuleAgg {
  moduleKey: string;
  moduleLabel: string;
  detectedIn: number;
  analyzedIn: number;
  totalFindings: number;
  filesWithFindings: number;
  skippedReasons: string[];
}

export interface PerformanceAgg {
  totalMs: number;
  avgMs: number;
  maxMs: number;
  maxMsFile: string;
  minMs: number;
  minMsFile: string;
  totalKb: number;
  avgKb: number;
  totalFindingsOriginal: number;
  totalFindingsReturned: number;
  filesTruncated: number;
}

export interface AffectedFileRow {
  file: ZipFullAnalysisFileResult;
  totalFindings: number;
  criticals: number;
  warnings: number;
  maxPriority: string;
  topActionGroup: string;
}

export function aggregateMassiveTotals(files: ZipFullAnalysisFileResult[]): MassiveTotals {
  let analyzed = 0,
    failed = 0,
    withCritical = 0,
    withWarning = 0,
    ok = 0;
  let withBom = 0,
    withTechNorm = 0,
    withNormXml = 0;
  for (const f of files) {
    if (f.status === "ANALYZED") {
      analyzed++;
      const a = f.analysis;
      if (a) {
        const fnd = a.findings ?? [];
        const hasC = fnd.some((x) => x.severity === "CRITICAL");
        const hasW = fnd.some((x) => x.severity === "WARNING");
        const hasI = fnd.length > 0 && !hasC && !hasW;
        if (hasC) withCritical++;
        else if (hasW) withWarning++;
        else if (hasI || fnd.length === 0) ok++;
        if (a.technicalDiagnostics?.bomDetected) withBom++;
        if (a.technicalDiagnostics?.safeNormalizationApplied) withTechNorm++;
        if (a.normalizedXml?.available) withNormXml++;
      }
    } else {
      failed++;
    }
  }
  return {
    analyzed,
    failed,
    total: files.length,
    withCritical,
    withWarning,
    ok,
    withBom,
    withTechNorm,
    withNormXml,
  };
}

export function aggregateMassivePriorities(files: ZipFullAnalysisFileResult[]): PriorityCounts {
  let BLOCKER = 0,
    HIGH = 0,
    MEDIUM = 0,
    LOW = 0;
  let filesWithBlocker = 0,
    filesWithHigh = 0;
  for (const f of files) {
    if (f.status !== "ANALYZED" || !f.analysis) continue;
    const fnd = f.analysis.findings ?? [];
    let hasBlocker = false,
      hasHigh = false;
    for (const x of fnd) {
      const p = x.priority ?? "LOW";
      if (p === "BLOCKER") {
        BLOCKER++;
        hasBlocker = true;
      } else if (p === "HIGH") {
        HIGH++;
        hasHigh = true;
      } else if (p === "MEDIUM") MEDIUM++;
      else LOW++;
    }
    if (hasBlocker) filesWithBlocker++;
    if (hasHigh) filesWithHigh++;
  }
  return { BLOCKER, HIGH, MEDIUM, LOW, filesWithBlocker, filesWithHigh };
}

export function aggregateMassiveActionGroups(files: ZipFullAnalysisFileResult[]): ActionGroupAgg[] {
  const map = new Map<string, ActionGroupAgg>();
  for (const f of files) {
    if (f.status !== "ANALYZED" || !f.analysis) continue;
    const fnd = f.analysis.findings ?? [];
    for (const x of fnd) {
      const g = x.actionGroup ?? "Informativo";
      let agg = map.get(g);
      if (!agg) {
        agg = {
          group: g,
          totalFindings: 0,
          affectedFiles: [],
          criticalCount: 0,
          warningCount: 0,
          infoCount: 0,
        };
        map.set(g, agg);
      }
      agg.totalFindings++;
      if (!agg.affectedFiles.includes(f.name)) agg.affectedFiles.push(f.name);
      if (x.severity === "CRITICAL") agg.criticalCount++;
      else if (x.severity === "WARNING") agg.warningCount++;
      else agg.infoCount++;
    }
  }
  return [...map.values()].sort((a, b) => b.totalFindings - a.totalFindings);
}

export function getTopFindingCodes(
  files: ZipFullAnalysisFileResult[],
  limit = 10,
): TopFindingRow[] {
  const map = new Map<string, TopFindingRow>();
  for (const f of files) {
    if (f.status !== "ANALYZED" || !f.analysis) continue;
    for (const x of f.analysis.findings ?? []) {
      let row = map.get(x.code);
      if (!row) {
        row = {
          code: x.code,
          title: x.title,
          maxSeverity: x.severity,
          maxPriority: x.priority ?? "LOW",
          totalAppearances: 0,
          affectedFiles: [],
          recommendedAction: x.recommendedAction ?? "",
        };
        map.set(x.code, row);
      }
      row.totalAppearances++;
      if (!row.affectedFiles.includes(f.name)) row.affectedFiles.push(f.name);
      const svOrder = severityOrder[row.maxSeverity] ?? 2;
      const svNew = severityOrder[x.severity] ?? 2;
      if (svNew < svOrder) row.maxSeverity = x.severity;
      const prOrder = priorityOrder[row.maxPriority] ?? 3;
      const prNew = priorityOrder[x.priority ?? "LOW"] ?? 3;
      if (prNew < prOrder) row.maxPriority = x.priority ?? "LOW";
    }
  }
  return [...map.values()].sort((a, b) => b.totalAppearances - a.totalAppearances).slice(0, limit);
}

export function aggregateMassiveDocumentKinds(files: ZipFullAnalysisFileResult[]): DocKindCounts {
  let CFDI = 0,
    RETENCIONES = 0,
    UNKNOWN = 0;
  for (const f of files) {
    if (f.status !== "ANALYZED" || !f.analysis) continue;
    const dk = f.analysis.documentKind;
    if (dk === "CFDI") CFDI++;
    else if (dk === "RETENCIONES") RETENCIONES++;
    else UNKNOWN++;
  }
  return { CFDI, RETENCIONES, UNKNOWN };
}

export function aggregateMassiveModulesCoverage(files: ZipFullAnalysisFileResult[]): ModuleAgg[] {
  const map = new Map<string, ModuleAgg>();
  for (const f of files) {
    if (f.status !== "ANALYZED" || !f.analysis?.analysisMeta) continue;
    for (const m of f.analysis.analysisMeta.coverage.modules) {
      let agg = map.get(m.key);
      if (!agg) {
        agg = {
          moduleKey: m.key,
          moduleLabel: m.label,
          detectedIn: 0,
          analyzedIn: 0,
          totalFindings: 0,
          filesWithFindings: 0,
          skippedReasons: [],
        };
        map.set(m.key, agg);
      }
      if (m.detected) agg.detectedIn++;
      if (m.analyzed) agg.analyzedIn++;
      agg.totalFindings += m.findingsCount;
      if (m.findingsCount > 0) agg.filesWithFindings++;
      if (m.skippedReason) agg.skippedReasons.push(m.skippedReason);
    }
  }
  return [...map.values()].sort((a, b) => b.totalFindings - a.totalFindings);
}

export function aggregateMassivePerformance(
  files: ZipFullAnalysisFileResult[],
): PerformanceAgg | null {
  let totalMs = 0,
    count = 0,
    maxMs = 0,
    minMs = Infinity;
  let maxMsFile = "",
    minMsFile = "";
  let totalKb = 0;
  let totalFindingsOriginal = 0,
    totalFindingsReturned = 0,
    filesTruncated = 0;
  for (const f of files) {
    if (f.status !== "ANALYZED" || !f.analysis?.analysisMeta) continue;
    const p = f.analysis.analysisMeta.performance;
    const ms = p.totalMs;
    totalMs += ms;
    totalKb += p.inputKb;
    totalFindingsOriginal += p.findingsOriginalCount;
    totalFindingsReturned += p.findingsReturnedCount;
    if (p.findingsTruncated) filesTruncated++;
    count++;
    if (ms > maxMs) {
      maxMs = ms;
      maxMsFile = f.name;
    }
    if (ms < minMs) {
      minMs = ms;
      minMsFile = f.name;
    }
  }
  if (count === 0) return null;
  return {
    totalMs,
    avgMs: Math.round(totalMs / count),
    maxMs,
    maxMsFile,
    minMs: count > 0 ? minMs : 0,
    minMsFile,
    totalKb: Math.round(totalKb * 100) / 100,
    avgKb: Math.round((totalKb / count) * 100) / 100,
    totalFindingsOriginal,
    totalFindingsReturned,
    filesTruncated,
  };
}

export function getTopAffectedFiles(
  files: ZipFullAnalysisFileResult[],
  limit = 10,
): AffectedFileRow[] {
  const rows: AffectedFileRow[] = [];
  for (const f of files) {
    if (f.status !== "ANALYZED" || !f.analysis) continue;
    const fnd = f.analysis.findings ?? [];
    if (fnd.length === 0) continue;
    const criticals = fnd.filter((x) => x.severity === "CRITICAL").length;
    const warnings = fnd.filter((x) => x.severity === "WARNING").length;
    const maxP = fnd.reduce(
      (best, x) =>
        (priorityOrder[x.priority ?? "LOW"] ?? 3) < (priorityOrder[best] ?? 3)
          ? (x.priority ?? "LOW")
          : best,
      "LOW" as string,
    );
    const groups = groupFindingsByActionGroup(fnd);
    const topGroup =
      Object.entries(groups).sort((a, b) => b[1].length - a[1].length)[0]?.[0] ?? "—";
    rows.push({
      file: f,
      totalFindings: fnd.length,
      criticals,
      warnings,
      maxPriority: maxP,
      topActionGroup: topGroup,
    });
  }
  return rows.sort((a, b) => b.totalFindings - a.totalFindings).slice(0, limit);
}
