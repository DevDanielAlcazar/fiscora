import type { Finding, ZipFullAnalysisFileResult } from "../../api/xml-audit";
import { getFindingModuleLabel } from "./findingExplorer.helpers";

export interface RiskScoreResult {
  score: number;
  band: RiskBand;
  rawRisk: number;
  blockerCount: number;
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  findingsWithDifference: number;
}

export interface ZipRiskScore {
  score: number;
  band: RiskBand;
  analyzedCount: number;
  failedCount: number;
  criticalFiles: number;
  warningFiles: number;
  healthyFiles: number;
  topRiskFiles: Array<{ index: number; name: string; score: number; band: RiskBand }>;
}

export interface RiskDriver {
  code: string;
  title: string;
  severity: string;
  priority: string | undefined;
  moduleLabel: string;
  actionGroup: string | undefined;
  weight: number;
}

export interface ModuleRisk {
  module: string;
  label: string;
  totalRisk: number;
  count: number;
  critical: number;
  warning: number;
  info: number;
  scoreImpact: number;
}

export interface ActionGroupRisk {
  actionGroup: string;
  totalRisk: number;
  count: number;
  topCodes: string[];
}

export type RiskBand = "HEALTHY" | "REVIEW" | "HIGH_RISK" | "BLOCKED";

const SEVERITY_BASE: Record<string, number> = {
  CRITICAL: 25,
  WARNING: 8,
  INFO: 2,
};

const PRIORITY_BONUS: Record<string, number> = {
  BLOCKER: 25,
  HIGH: 12,
  MEDIUM: 5,
  LOW: 0,
};

function getActionGroupBonus(group: string | undefined): number {
  if (!group) return 0;
  const g = group.toUpperCase();
  if (["TAX", "IMPUESTOS", "IMPORTES", "TOTAL", "PAGO", "RETENCIONES"].some((k) => g.includes(k)))
    return 5;
  if (["CFDI_STRUCTURE", "TIMBRADO", "TFD", "CERTIFICADO"].some((k) => g.includes(k))) return 4;
  if (["CATALOGS", "REVIEW"].some((k) => g.includes(k))) return 1;
  return 0;
}

export function calculateFindingWeight(finding: Finding): number {
  const base = SEVERITY_BASE[finding.severity] ?? 2;
  const priority = PRIORITY_BONUS[finding.priority ?? "LOW"] ?? 0;
  const actionGroup = getActionGroupBonus(finding.actionGroup);
  let valueTrace = 0;
  if (finding.valueTrace?.difference !== undefined) {
    const diff = Number(finding.valueTrace.difference);
    if (!isNaN(diff) && diff > 0) valueTrace = 3;
  }
  return Math.min(base + priority + actionGroup + valueTrace, 50);
}

export function calculateRiskScore(findings: Finding[]): RiskScoreResult {
  if (!findings || findings.length === 0) {
    return {
      score: 100,
      band: "HEALTHY",
      rawRisk: 0,
      blockerCount: 0,
      criticalCount: 0,
      warningCount: 0,
      infoCount: 0,
      findingsWithDifference: 0,
    };
  }

  let rawRisk = 0;
  let blockerCount = 0;
  let criticalCount = 0;
  let warningCount = 0;
  let infoCount = 0;
  let findingsWithDifference = 0;

  for (const f of findings) {
    const w = calculateFindingWeight(f);
    rawRisk += w;
    if (f.priority === "BLOCKER") blockerCount++;
    if (f.severity === "CRITICAL") criticalCount++;
    else if (f.severity === "WARNING") warningCount++;
    else if (f.severity === "INFO") infoCount++;
    if (f.valueTrace?.difference !== undefined) {
      const diff = Number(f.valueTrace.difference);
      if (!isNaN(diff) && diff > 0) findingsWithDifference++;
    }
  }

  let score = Math.max(0, 100 - rawRisk);
  if (blockerCount > 0) score = Math.min(score, 45);
  if (criticalCount > 0) score = Math.min(score, 65);
  if (warningCount > 5) score = Math.min(score, 75);

  return {
    score,
    band: getRiskBand(score, { blockerCount, criticalCount, warningCount }),
    rawRisk,
    blockerCount,
    criticalCount,
    warningCount,
    infoCount,
    findingsWithDifference,
  };
}

export function calculateApproximateRiskScore(counts: {
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  priorityMax?: string | null;
}): RiskScoreResult {
  const { criticalCount, warningCount, infoCount, priorityMax } = counts;
  const rawRisk = criticalCount * 25 + warningCount * 8 + infoCount * 2;
  let score = Math.max(0, 100 - Math.min(rawRisk, 150));
  const blockerCount = priorityMax === "BLOCKER" ? 1 : 0;
  if (blockerCount > 0) score = Math.min(score, 45);
  if (criticalCount > 0) score = Math.min(score, 65);
  if (warningCount > 5) score = Math.min(score, 75);
  if (criticalCount === 0 && warningCount === 0 && infoCount === 0) score = 100;
  return {
    score,
    band: getRiskBand(score, { blockerCount, criticalCount, warningCount }),
    rawRisk,
    blockerCount,
    criticalCount,
    warningCount,
    infoCount,
    findingsWithDifference: 0,
  };
}

export function getRiskBand(
  score: number,
  flags?: { blockerCount?: number; criticalCount?: number; warningCount?: number },
): RiskBand {
  if (flags?.blockerCount && flags.blockerCount > 0) return "BLOCKED";
  if (score >= 90 && (!flags?.criticalCount || flags.criticalCount === 0)) return "HEALTHY";
  if (score < 40) return "BLOCKED";
  if (score < 70 || (flags?.criticalCount && flags.criticalCount > 0)) return "HIGH_RISK";
  if (score < 90) return "REVIEW";
  return "HEALTHY";
}

export function getRiskBandLabel(band: RiskBand): string {
  const labels: Record<RiskBand, string> = {
    HEALTHY: "Saludable",
    REVIEW: "Revisión recomendada",
    HIGH_RISK: "Alto riesgo",
    BLOCKED: "Bloqueante",
  };
  return labels[band];
}

export function getRiskBandDescription(band: RiskBand): string {
  const descriptions: Record<RiskBand, string> = {
    HEALTHY: "El XML puede leerse y no presenta hallazgos relevantes.",
    REVIEW: "El XML puede procesarse, pero conviene revisar advertencias.",
    HIGH_RISK:
      "El XML tiene inconsistencias relevantes que pueden impactar contabilización o cumplimiento.",
    BLOCKED: "El XML requiere corrección antes de continuar.",
  };
  return descriptions[band];
}

export function getRiskBandStyles(band: RiskBand): string {
  const styles: Record<RiskBand, string> = {
    HEALTHY: "text-emerald-700 bg-emerald-50 border-emerald-200",
    REVIEW: "text-yellow-700 bg-yellow-50 border-yellow-200",
    HIGH_RISK: "text-orange-700 bg-orange-50 border-orange-200",
    BLOCKED: "text-red-700 bg-red-50 border-red-200",
  };
  return styles[band];
}

export function getTopRiskDrivers(findings: Finding[], limit = 5): RiskDriver[] {
  return findings
    .map((f) => ({
      code: f.code,
      title: f.title,
      severity: f.severity,
      priority: f.priority,
      moduleLabel: f.location ? getFindingModuleLabel(f.location.module) : "Sin clasificar",
      actionGroup: f.actionGroup,
      weight: calculateFindingWeight(f),
    }))
    .sort((a, b) => {
      if (b.weight !== a.weight) return b.weight - a.weight;
      const severityOrder = { CRITICAL: 0, WARNING: 1, INFO: 2 };
      const aSeverity = severityOrder[a.severity as keyof typeof severityOrder] ?? 3;
      const bSeverity = severityOrder[b.severity as keyof typeof severityOrder] ?? 3;
      if (aSeverity !== bSeverity) return aSeverity - bSeverity;
      const priorityOrder = { BLOCKER: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
      const aPri = priorityOrder[a.priority as keyof typeof priorityOrder] ?? 4;
      const bPri = priorityOrder[b.priority as keyof typeof priorityOrder] ?? 4;
      return aPri - bPri;
    })
    .slice(0, limit);
}

export function aggregateRiskByModule(findings: Finding[]): ModuleRisk[] {
  const map = new Map<string, ModuleRisk>();
  for (const f of findings) {
    const moduleKey = f.location?.module ?? "unknown";
    const existing = map.get(moduleKey);
    const w = calculateFindingWeight(f);
    if (existing) {
      existing.totalRisk += w;
      existing.count++;
      if (f.severity === "CRITICAL") existing.critical++;
      else if (f.severity === "WARNING") existing.warning++;
      else existing.info++;
    } else {
      map.set(moduleKey, {
        module: moduleKey,
        label: getFindingModuleLabel(moduleKey),
        totalRisk: w,
        count: 1,
        critical: f.severity === "CRITICAL" ? 1 : 0,
        warning: f.severity === "WARNING" ? 1 : 0,
        info: f.severity === "INFO" ? 1 : 0,
        scoreImpact: 0,
      });
    }
  }
  const total = findings.length;
  const results = Array.from(map.values());
  for (const r of results) {
    r.scoreImpact = total > 0 ? Math.round((r.count / total) * 100) : 0;
  }
  return results.sort((a, b) => b.totalRisk - a.totalRisk);
}

export function aggregateRiskByActionGroup(findings: Finding[]): ActionGroupRisk[] {
  const map = new Map<string, ActionGroupRisk>();
  for (const f of findings) {
    const g = f.actionGroup ?? "SIN_GRUPO";
    const existing = map.get(g);
    if (existing) {
      existing.totalRisk += calculateFindingWeight(f);
      existing.count++;
      if (!existing.topCodes.includes(f.code)) existing.topCodes.push(f.code);
    } else {
      map.set(g, {
        actionGroup: g,
        totalRisk: calculateFindingWeight(f),
        count: 1,
        topCodes: [f.code],
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.totalRisk - a.totalRisk);
}

export function calculateZipRiskScore(files: ZipFullAnalysisFileResult[]): ZipRiskScore {
  const analyzed = files.filter((f) => f.status === "ANALYZED" && f.analysis?.findings);
  const failed = files.filter((f) => f.status === "FAILED");

  const blockerFiles = analyzed.filter((f) =>
    f.analysis!.findings!.some((fx) => fx.priority === "BLOCKER"),
  );
  const criticalFiles = analyzed.filter((f) =>
    f.analysis!.findings!.some((fx) => fx.severity === "CRITICAL"),
  );
  const warningFiles = analyzed.filter(
    (f) =>
      !f.analysis!.findings!.some((fx) => fx.severity === "CRITICAL") &&
      f.analysis!.findings!.some((fx) => fx.severity === "WARNING"),
  );
  const healthyFiles = analyzed.filter((f) =>
    f.analysis!.findings!.every((fx) => fx.severity !== "CRITICAL" && fx.severity !== "WARNING"),
  );

  let totalScore = 0;
  let scoreCount = 0;
  for (const f of analyzed) {
    const sr = calculateRiskScore(f.analysis!.findings!);
    totalScore += sr.score;
    scoreCount++;
  }
  const avgScore = scoreCount > 0 ? Math.round(totalScore / scoreCount) : 100;

  const failPenalty = failed.length * 10;
  let finalScore = Math.max(0, avgScore - failPenalty);

  if (blockerFiles.length > 0) finalScore = Math.min(finalScore, 60);
  const criticalPct = analyzed.length > 0 ? criticalFiles.length / analyzed.length : 0;
  if (criticalPct > 0.2) finalScore = Math.min(finalScore, 50);

  const topFiles = analyzed
    .map((f) => ({
      index: f.index,
      name: f.name,
      score: calculateRiskScore(f.analysis!.findings!).score,
      band: calculateRiskScore(f.analysis!.findings!).band,
    }))
    .sort((a, b) => a.score - b.score)
    .slice(0, 5);

  return {
    score: finalScore,
    band: getRiskBand(finalScore, {
      blockerCount: blockerFiles.length,
      criticalCount: criticalFiles.length,
      warningCount: warningFiles.length,
    }),
    analyzedCount: analyzed.length,
    failedCount: failed.length,
    criticalFiles: criticalFiles.length,
    warningFiles: warningFiles.length,
    healthyFiles: healthyFiles.length,
    topRiskFiles: topFiles,
  };
}
