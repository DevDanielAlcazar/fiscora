import type {
  AnalysisResult,
  AnalysisMetaInfo,
  AnalysisCoverageModule,
  ZipFullAnalysisFileResult,
  Finding,
} from "../../api/xml-audit";

export const MODULE_LABEL_MAP: Record<string, string> = {
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

export interface CoverageModuleRow {
  module: string;
  label: string;
  detected: boolean;
  analyzed: boolean;
  skippedReason?: string | null;
  findingsCount: number;
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  confidenceImpact: number;
  notes?: string;
}

export interface CoverageSummary {
  totalModules: number;
  detectedModules: number;
  analyzedModules: number;
  skippedModules: number;
  modulesWithFindings: number;
  modulesWithoutFindings: number;
  unknownModules: number;
  totalFindings: number;
  findingsByModule: Record<string, number>;
  confidenceScore: number;
}

export interface PayloadPolicySummary {
  sanitized: boolean;
  findingsReturned: number;
  findingsOriginal: number;
  findingsTruncated: boolean;
  evidenceMaxLength: number;
  normalizedXmlContentExcluded: boolean;
  addendaRawExcluded: boolean;
  sourceXmlExcluded: boolean;
}

export interface ZipCoverageAggregate {
  avgConfidence: number;
  limitedCount: number;
  unknownComplementsCount: number;
}

export type ConfidenceBand = "high" | "good" | "partial" | "limited";

export function normalizeCoverageModule(module: AnalysisCoverageModule): CoverageModuleRow {
  const label = MODULE_LABEL_MAP[module.key] ?? module.label ?? module.key;
  let confidenceImpact = 0;
  let notes: string | undefined;

  if (module.key === "unknown") {
    confidenceImpact = -8;
    notes = "Módulo no reconocido por el motor";
  }

  return {
    module: module.key,
    label,
    detected: module.detected,
    analyzed: module.analyzed,
    skippedReason: module.skippedReason,
    findingsCount: module.findingsCount ?? 0,
    criticalCount: 0,
    warningCount: 0,
    infoCount: 0,
    confidenceImpact,
    notes,
  };
}

export function calculateConfidenceScore(
  hasAnalysisMeta: boolean,
  hasCoverage: boolean,
  findingsTruncated: boolean,
  hasUnknownModules: boolean,
  unknownComplementsCount: number,
  noStamp: boolean,
  failedAnalysis: boolean,
  payloadSanitized: boolean,
): number {
  let score = 100;
  if (!hasAnalysisMeta) score -= 15;
  if (!hasCoverage) score -= 10;
  if (findingsTruncated) score -= 10;
  if (payloadSanitized) score -= 10;
  if (hasUnknownModules) score -= 8;
  if (unknownComplementsCount > 0) score -= 5;
  if (noStamp) score -= 5;
  if (failedAnalysis) score -= 5;
  return Math.max(0, score);
}

export function getConfidenceBand(score: number): ConfidenceBand {
  if (score >= 90) return "high";
  if (score >= 70) return "good";
  if (score >= 50) return "partial";
  return "limited";
}

export function getConfidenceLabel(band: ConfidenceBand): string {
  const labels: Record<ConfidenceBand, string> = {
    high: "Alta confianza",
    good: "Buena cobertura",
    partial: "Cobertura parcial",
    limited: "Cobertura limitada",
  };
  return labels[band];
}

export function getConfidenceDescription(band: ConfidenceBand): string {
  const descriptions: Record<ConfidenceBand, string> = {
    high: "El motor pudo evaluar los módulos relevantes con evidencia suficiente.",
    good: "El análisis es útil, aunque existen módulos o datos que conviene revisar.",
    partial: "El análisis detectó información limitada o complementos no clasificados.",
    limited: "El XML pudo tener estructura incompleta, datos truncados o módulos no evaluables.",
  };
  return descriptions[band];
}

function resultsHaveValidStamp(findings: Finding[]): boolean {
  const hasTfdFindings = findings.some((f) => f.location?.module === "tfd");
  const hasStampError = findings.some(
    (f) => f.location?.module === "tfd" && f.severity === "CRITICAL",
  );
  return hasTfdFindings && !hasStampError;
}

export function buildCoverageSummary(
  meta: AnalysisMetaInfo | undefined,
  findings: Finding[],
  structureDiagnostics:
    | {
        knownComplements: string[];
        unknownComplements: string[];
        hasAddenda: boolean;
      }
    | undefined,
  payloadPolicy: { sanitized: boolean } | undefined,
  failed: boolean,
): CoverageSummary {
  const coverage = meta?.coverage;
  const totalModules = coverage?.modules.length ?? 0;
  const detectedModules = coverage?.modules.filter((m) => m.detected).length ?? 0;
  const analyzedModules = coverage?.modules.filter((m) => m.analyzed).length ?? 0;
  const skippedModules = coverage?.modules.filter((m) => !m.analyzed && m.detected).length ?? 0;

  const findingsByModule = findings.reduce(
    (acc, f) => {
      const mod = f.location?.module ?? "unknown";
      acc[mod] = (acc[mod] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const modulesWithFindings = Object.keys(findingsByModule).length;
  const modulesWithoutFindings = totalModules - modulesWithFindings;
  const unknownModules =
    coverage?.modules.filter((m) => m.key === "unknown").length ??
    (findings.some((f) => (f.location?.module ?? "unknown") === "unknown") ? 1 : 0);

  const confidenceScore = calculateConfidenceScore(
    !!meta,
    !!coverage,
    payloadPolicy?.sanitized ?? false,
    unknownModules > 0,
    structureDiagnostics?.unknownComplements.length ?? 0,
    !resultsHaveValidStamp(findings),
    failed,
    payloadPolicy?.sanitized ?? false,
  );

  return {
    totalModules,
    detectedModules,
    analyzedModules,
    skippedModules,
    modulesWithFindings,
    modulesWithoutFindings,
    unknownModules,
    totalFindings: findings.length,
    findingsByModule,
    confidenceScore,
  };
}

export function buildModuleCoverageRows(
  meta: AnalysisMetaInfo | undefined,
  findings: Finding[],
): CoverageModuleRow[] {
  if (!meta?.coverage) {
    return inferModulesFromFindings(findings);
  }

  const findingsByModule = findings.reduce(
    (acc, f) => {
      const mod = f.location?.module ?? "unknown";
      if (!acc[mod]) {
        acc[mod] = { total: 0, critical: 0, warning: 0, info: 0 };
      }
      acc[mod].total++;
      if (f.severity === "CRITICAL") acc[mod].critical++;
      if (f.severity === "WARNING") acc[mod].warning++;
      if (f.severity === "INFO") acc[mod].info++;
      return acc;
    },
    {} as Record<string, { total: number; critical: number; warning: number; info: number }>,
  );

  return meta.coverage.modules.map((m) => {
    const fc = findingsByModule[m.key] ?? { total: 0, critical: 0, warning: 0, info: 0 };
    const base: CoverageModuleRow = normalizeCoverageModule(m);
    return {
      ...base,
      findingsCount: fc.total,
      criticalCount: fc.critical,
      warningCount: fc.warning,
      infoCount: fc.info,
    };
  });
}

function inferModulesFromFindings(findings: Finding[]): CoverageModuleRow[] {
  const moduleMap = new Map<string, CoverageModuleRow>();

  for (const f of findings) {
    const mod = f.location?.module ?? "unknown";
    if (!moduleMap.has(mod)) {
      moduleMap.set(mod, {
        module: mod,
        label: MODULE_LABEL_MAP[mod] ?? mod,
        detected: true,
        analyzed: true,
        findingsCount: 0,
        criticalCount: 0,
        warningCount: 0,
        infoCount: 0,
        confidenceImpact: mod === "unknown" ? -8 : 0,
        notes: mod === "unknown" ? "No hay metadata de coverage; inferido de findings" : undefined,
      });
    }
    const row = moduleMap.get(mod)!;
    row.findingsCount++;
    if (f.severity === "CRITICAL") row.criticalCount++;
    if (f.severity === "WARNING") row.warningCount++;
    if (f.severity === "INFO") row.infoCount++;
  }

  return Array.from(moduleMap.values()).sort((a, b) => b.findingsCount - a.findingsCount);
}

export function buildPayloadPolicySummary(
  payloadPolicy:
    | {
        evidenceMaxStringLength: number;
        findingsMaxTotal: number;
        findingsMaxPerCode: number;
        sanitized: boolean;
      }
    | undefined,
  performance: { findingsOriginalCount: number; findingsReturnedCount: number } | undefined,
): PayloadPolicySummary | null {
  if (!payloadPolicy && !performance) return null;

  return {
    sanitized: payloadPolicy?.sanitized ?? false,
    findingsReturned: performance?.findingsReturnedCount ?? 0,
    findingsOriginal: performance?.findingsOriginalCount ?? 0,
    findingsTruncated:
      (performance?.findingsOriginalCount ?? 0) > (performance?.findingsReturnedCount ?? 0),
    evidenceMaxLength: payloadPolicy?.evidenceMaxStringLength ?? 0,
    normalizedXmlContentExcluded: true,
    addendaRawExcluded: true,
    sourceXmlExcluded: true,
  };
}

export function buildUnknownComplementsSummary(result: AnalysisResult) {
  const { structureDiagnostics } = result;
  if (!structureDiagnostics) return null;

  const { knownComplements, unknownComplements, hasAddenda } = structureDiagnostics;
  if (knownComplements.length === 0 && unknownComplements.length === 0 && !hasAddenda) {
    return null;
  }

  return {
    known: knownComplements,
    unknown: unknownComplements,
    hasAddenda,
  };
}

export function aggregateZipCoverage(files: ZipFullAnalysisFileResult[]): ZipCoverageAggregate {
  const analyzedFiles = files.filter((f) => f.status === "ANALYZED");

  const confidences = analyzedFiles.map((f) => {
    const meta = f.analysis?.analysisMeta;
    const findings = f.analysis?.findings ?? [];
    const sd = f.analysis?.structureDiagnostics;
    const isStamped = f.analysis?.technicalDiagnostics?.isStamped ?? false;

    const score = calculateConfidenceScore(
      !!meta,
      !!meta?.coverage,
      f.analysis?.payloadPolicy?.sanitized ?? false,
      findings.some((fi) => (fi.location?.module ?? "unknown") === "unknown"),
      sd?.unknownComplements.length ?? 0,
      !isStamped,
      f.status !== "ANALYZED",
      f.analysis?.payloadPolicy?.sanitized ?? false,
    );
    return score;
  });

  const avgConfidence =
    confidences.length > 0
      ? Math.round(confidences.reduce((a, b) => a + b, 0) / confidences.length)
      : 0;
  const limitedCount = confidences.filter((s) => s < 50).length;

  const unknownComplementsCount = analyzedFiles.reduce(
    (acc, f) => acc + (f.analysis?.structureDiagnostics?.unknownComplements.length ?? 0),
    0,
  );

  return {
    avgConfidence,
    limitedCount,
    unknownComplementsCount,
  };
}
