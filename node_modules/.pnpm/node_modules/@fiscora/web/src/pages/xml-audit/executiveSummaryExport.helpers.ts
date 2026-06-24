import type { AnalysisResult, ZipFullAnalysisResult } from "../../api/xml-audit";
import { calculateRiskScore, getRiskBandLabel, getTopRiskDrivers, RiskBand } from "./riskScore.helpers";
import { getConfidenceBand, getConfidenceLabel, ConfidenceBand } from "./coverageConfidence.helpers";
import { buildRemediationPlan } from "./remediationPlan.helpers";

export interface ExecutiveSummaryIndividual {
  title: string;
  analysisDate: string;
  documentType: string;
  uuid: string | null;
  emisorRfc: string | null;
  receptorRfc: string | null;
  riskScore: number;
  riskBand: RiskBand;
  confidenceScore: number;
  confidenceBand: ConfidenceBand;
  statusLabel: string;
  totalFindings: number;
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  blockerCount: number;
  topRiskDrivers: Array<{ code: string; title: string; severity: string }>;
  topModules: Array<{ module: string; label: string; count: number }>;
  immediateActions: Array<{ code: string; action: string; owner: string }>;
  securityNote: string;
}

export interface ExecutiveSummaryZip {
  title: string;
  filename: string;
  totalXml: number;
  analyzed: number;
  failed: number;
  riskScore: number;
  riskBand: RiskBand;
  avgConfidence: number;
  highRiskFiles: number;
  criticalFiles: number;
  warningFiles: number;
  topRiskFiles: Array<{ index: number; name: string; score: number }>;
  topRiskDrivers: Array<{ code: string; title: string; severity: string; occurrences: number }>;
  topModules: Array<{ module: string; label: string; count: number }>;
  immediateActions: Array<{ code: string; action: string; owner: string; affectedFiles: number }>;
  securityNote: string;
}

const SECURITY_PATTERNS = [
  /<cfdi:/gi,
  /<tfd:/gi,
  /Sello\s*=/gi,
  /Certificado\s*=/gi,
  /BEGIN CERTIFICATE/gi,
  /BEGIN RSA PRIVATE KEY/gi,
  /authorization/gi,
  /token/gi,
  /cookie/gi,
  /password/gi,
  /secret/gi,
  /sessionId/gi,
  /session_id/gi,
  /api[_-]?key/gi,
];

export function sanitizeSummaryText(text: string, maxLength: number = 8000): string {
  let sanitized = text;
  for (const pattern of SECURITY_PATTERNS) {
    sanitized = sanitized.replace(pattern, "[REDACTED]");
  }
  if (sanitized.length > maxLength) {
    sanitized = sanitized.slice(0, maxLength) + "\n... contenido truncado por longitud.";
  }
  return sanitized;
}

export function buildIndividualExecutiveSummary(result: AnalysisResult): ExecutiveSummaryIndividual {
  const findings = result.findings || [];
  const risk = calculateRiskScore(findings);
  const confidenceScore = result.analysisMeta?.coverage
    ? (() => {
        const hasMeta = !!result.analysisMeta;
        const hasCoverage = !!result.analysisMeta?.coverage;
        const findingsTruncated = (result.analysisMeta?.performance?.findingsOriginalCount ?? 0) >
          (result.analysisMeta?.performance?.findingsReturnedCount ?? 0);
        const payloadSanitized = result.analysisMeta?.performance?.sanitized ?? false;
        const hasUnknownModules = findings.some((f) => (f.location?.module ?? "unknown") === "unknown");
        const unknownComplementsCount = result.structureDiagnostics?.unknownComplements.length ?? 0;
        const noStamp = !(result.technicalDiagnostics?.isStamped ?? false);
        const failedAnalysis = false;
        
        let score = 100;
        if (!hasMeta) score -= 15;
        if (!hasCoverage) score -= 10;
        if (findingsTruncated) score -= 10;
        if (payloadSanitized) score -= 10;
        if (hasUnknownModules) score -= 8;
        if (unknownComplementsCount > 0) score -= 5;
        if (noStamp) score -= 5;
        if (failedAnalysis) score -= 5;
        return Math.max(0, score);
      })()
    : (() => {
        let score = 100;
        if (findings.some((f) => (f.location?.module ?? "unknown") === "unknown")) score -= 8;
        return score;
      })();

  const modulesByCount = findings.reduce(
    (acc, f) => {
      const mod = f.location?.module ?? "unknown";
      acc[mod] = (acc[mod] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );
  const topModules = Object.entries(modulesByCount)
    .map(([module, count]) => ({
      module,
      label: getModuleLabel(module),
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const plan = buildRemediationPlan(findings);
  const immediateActions = plan.items
    .filter((i) => i.urgency === "INMEDIATA")
    .slice(0, 5)
    .map((i) => ({
      code: i.code,
      action: i.recommendedAction,
      owner: i.ownerSuggestion,
    }));

  let statusLabel = "Saludable";
  if (risk.blockerCount > 0) statusLabel = "Bloqueante";
  else if (risk.criticalCount > 0) statusLabel = "Alto riesgo";
  else if (risk.warningCount > 0) statusLabel = "Revisión recomendada";

  return {
    title: "Resumen ejecutivo de auditoría XML",
    analysisDate: result.fecha || result.analysisMeta?.generatedAt || new Date().toISOString(),
    documentType: result.documentKind || "—",
    uuid: result.uuid,
    emisorRfc: result.rfcEmisor,
    receptorRfc: result.rfcReceptor,
    riskScore: risk.score,
    riskBand: risk.band,
    confidenceScore,
    confidenceBand: getConfidenceBand(confidenceScore),
    statusLabel,
    totalFindings: findings.length,
    criticalCount: risk.criticalCount,
    warningCount: risk.warningCount,
    infoCount: risk.infoCount,
    blockerCount: risk.blockerCount,
    topRiskDrivers: getTopRiskDrivers(findings, 5).map((d) => ({
      code: d.code,
      title: d.title,
      severity: d.severity,
    })),
    topModules,
    immediateActions,
    securityNote:
      "Nota: Este resumen no incluye XML fuente, sellos completos, certificados completos, addenda raw ni contenido sensible.",
  };
}

export function buildZipExecutiveSummary(zipResult: ZipFullAnalysisResult): ExecutiveSummaryZip {
  const files = zipResult.results || [];
  const analyzed = files.filter((f) => f.status === "ANALYZED");
  const failed = files.filter((f) => f.status === "FAILED");

  const allFindings = analyzed.flatMap((f) => f.analysis?.findings || []);
  const risk = calculateRiskScore(allFindings);
  
const totalScore = risk.score;
   const failPenalty = failed.length * 10;
   let finalScore = Math.max(0, totalScore - failPenalty);
  if (failed.length > 0) finalScore = Math.min(finalScore, 60);

  const confidences = analyzed.map((f) => {
    const isStamped = f.analysis?.technicalDiagnostics?.isStamped ?? false;
    const findings = f.analysis?.findings ?? [];
    let score = 100;
    const meta = f.analysis?.analysisMeta;
    if (!meta) score -= 15;
    if (!meta?.coverage) score -= 10;
    if (!isStamped) score -= 5;
    if (findings.some((fi) => (fi.location?.module ?? "unknown") === "unknown")) score -= 8;
    return Math.max(0, score);
  });
  const avgConfidence = confidences.length > 0 ? Math.round(confidences.reduce((a, b) => a + b, 0) / confidences.length) : 0;

  const criticalFiles = analyzed.filter((f) =>
    f.analysis?.findings?.some((fx) => fx.severity === "CRITICAL"),
  ).length;
  const warningFiles = analyzed.filter((f) =>
    !f.analysis?.findings?.some((fx) => fx.severity === "CRITICAL") &&
    f.analysis?.findings?.some((fx) => fx.severity === "WARNING"),
  ).length;
  const highRiskFiles = analyzed.filter((f) => {
    const s = calculateRiskScore(f.analysis?.findings || []);
    return s.score < 70;
  }).length;

  const topRiskFiles = analyzed
    .map((f) => ({
      index: f.index,
      name: f.name,
      score: calculateRiskScore(f.analysis?.findings || []).score,
    }))
    .sort((a, b) => a.score - b.score)
    .slice(0, 5);

  const modulesByCount = allFindings.reduce(
    (acc, f) => {
      const mod = f.location?.module ?? "unknown";
      acc[mod] = (acc[mod] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );
  const topModules = Object.entries(modulesByCount)
    .map(([module, count]) => ({
      module,
      label: getModuleLabel(module),
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    title: "Resumen ejecutivo de auditoría XML masiva",
    filename: zipResult.filename || "—",
    totalXml: zipResult.totalEntries,
    analyzed: zipResult.analyzedCount,
    failed: zipResult.failedCount,
    riskScore: finalScore,
    riskBand: risk.band,
    avgConfidence,
    highRiskFiles,
    criticalFiles,
    warningFiles,
    topRiskFiles,
    topRiskDrivers: getTopRiskDrivers(allFindings, 5).map((d) => ({
      code: d.code,
      title: d.title,
      severity: d.severity,
      occurrences: 1,
    })),
    topModules,
    immediateActions: [],
    securityNote:
      "Nota: Este resumen no incluye XML fuente, sellos completos, certificados completos, addenda raw ni contenido sensible.",
  };
}

export function buildSupportMessage(result: AnalysisResult, summary: ExecutiveSummaryIndividual): string {
  let text = `Buen día.\n\n`;
  text += `Al revisar el XML en Fiscora se detectaron inconsistencias que conviene corregir antes de continuar con el proceso.\n\n`;
  text += `Datos clave:\n`;
  text += `- UUID: ${result.uuid || "—"}\n`;
  text += `- RFC emisor: ${result.rfcEmisor || "—"}\n`;
  text += `- RFC receptor: ${result.rfcReceptor || "—"}\n`;
  text += `- Total: $${result.total || "0"} ${result.moneda || ""}\n\n`;

  if (summary.topRiskDrivers.length > 0) {
    text += `Principales hallazgos:\n`;
    summary.topRiskDrivers.slice(0, 3).forEach((d) => {
      text += `- ${d.title} (${d.code})\n`;
    });
    text += `\n`;
  }

  if (summary.immediateActions.length > 0) {
    text += `Acciones sugeridas:\n`;
    summary.immediateActions.slice(0, 3).forEach((a) => {
      text += `- ${a.action}\n`;
    });
  }

  text += `\nFavor de revisar los puntos anteriores y, si aplica, emitir el XML corregido o confirmar la justificación del caso.\n\n`;
  text += `Quedo atento/a a sus comentarios.`;

  return sanitizeSummaryText(text, 3000);
}

export function getModuleLabel(module: string): string {
  const labels: Record<string, string> = {
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
  return labels[module] || module;
}

export function formatIndividualExecutiveText(summary: ExecutiveSummaryIndividual): string {
  let text = `${summary.title}\n`;
  text += `================\n\n`;
  text += `Fecha de análisis: ${formatDate(summary.analysisDate)}\n`;
  text += `Tipo de comprobante: ${summary.documentType}\n`;
  if (summary.uuid) text += `UUID: ${summary.uuid}\n`;
  if (summary.emisorRfc) text += `RFC emisor: ${summary.emisorRfc}\n`;
  if (summary.receptorRfc) text += `RFC receptor: ${summary.receptorRfc}\n\n`;
  
  text += `---\n`;
  text += `Risk Score: ${summary.riskScore}/100 (${summary.riskBand})\n`;
  text += `Risk Band: ${getRiskBandLabel(summary.riskBand)}\n`;
  text += `Confidence Score: ${summary.confidenceScore}/100 (${summary.confidenceBand})\n`;
  text += `Confidence Band: ${getConfidenceLabel(summary.confidenceBand)}\n`;
  text += `Estado: ${summary.statusLabel}\n\n`;
  
  text += `---\n`;
  text += `Total de hallazgos: ${summary.totalFindings}\n`;
  text += `- Críticos: ${summary.criticalCount}\n`;
  text += `- Advertencias: ${summary.warningCount}\n`;
  text += `- Informativos: ${summary.infoCount}\n\n`;
  
  if (summary.topRiskDrivers.length > 0) {
    text += `---\n`;
    text += `Top causas principales:\n`;
    summary.topRiskDrivers.forEach((d) => {
      text += `- [${d.code}] ${d.title} (${d.severity})\n`;
    });
    text += `\n`;
  }
  
  if (summary.topModules.length > 0) {
    text += `---\n`;
    text += `Módulos más afectados:\n`;
    summary.topModules.forEach((m) => {
      text += `- ${m.label}: ${m.count} hallazgos\n`;
    });
    text += `\n`;
  }
  
  if (summary.immediateActions.length > 0) {
    text += `---\n`;
    text += `Plan de acción resumido (acciones inmediatas):\n`;
    summary.immediateActions.forEach((a) => {
      text += `- [${a.code}] ${a.action} (Responsable: ${a.owner})\n`;
    });
    text += `\n`;
  }
  
  text += `---\n`;
  text += `${summary.securityNote}\n`;

  return sanitizeSummaryText(text);
}

export function formatZipExecutiveText(summary: ExecutiveSummaryZip): string {
  let text = `${summary.title}\n`;
  text += `================\n\n`;
  text += `Nombre ZIP: ${summary.filename}\n`;
  text += `Total XML: ${summary.totalXml}\n`;
  text += `Analizados: ${summary.analyzed}\n`;
  text += `Fallidos: ${summary.failed}\n\n`;
  
  text += `---\n`;
  text += `Risk Score del lote: ${summary.riskScore}/100 (${summary.riskBand})\n`;
  text += `Confidence promedio: ${summary.avgConfidence}/100\n\n`;
  
  text += `---\n`;
  text += `Archivos de alto riesgo: ${summary.highRiskFiles}\n`;
  text += `Archivos críticos: ${summary.criticalFiles}\n`;
  text += `Archivos con advertencias: ${summary.warningFiles}\n\n`;
  
  if (summary.topRiskFiles.length > 0) {
    text += `---\n`;
    text += `Top 5 archivos de mayor riesgo:\n`;
    summary.topRiskFiles.forEach((f) => {
      text += `- #${f.index + 1} ${f.name} (Score: ${f.score})\n`;
    });
    text += `\n`;
  }
  
  if (summary.topRiskDrivers.length > 0) {
    text += `---\n`;
    text += `Top 5 causas recurrentes:\n`;
    summary.topRiskDrivers.forEach((d) => {
      text += `- [${d.code}] ${d.title} (${d.severity})\n`;
    });
    text += `\n`;
  }
  
  if (summary.topModules.length > 0) {
    text += `---\n`;
    text += `Módulos más afectados:\n`;
    summary.topModules.forEach((m) => {
      text += `- ${m.label}: ${m.count} hallazgos\n`;
    });
    text += `\n`;
  }
  
  text += `---\n`;
  text += `${summary.securityNote}\n`;

  return sanitizeSummaryText(text);
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("es-MX", { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return dateStr;
  }
}

export function downloadTextFile(filename: string, content: string, mimeType: string = "text/plain"): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}