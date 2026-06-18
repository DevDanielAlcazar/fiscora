import type { AnalysisResult } from "../../api/xml-audit";
import type { XmlAuditHistoryDetail } from "../../api/xml-audit";
import {
  buildRemediationPlan,
  type AggregateRemediationPlanResult,
} from "./remediationPlan.helpers";
import { buildFindingGlossary } from "./findingGlossary.helpers";

export function copyTextToClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text);
}

function truncateText(text: string, limit: number): string {
  if (text.length <= limit) return text;
  return text.slice(0, limit) + "\n... contenido resumido por longitud.";
}

export function buildIndividualExecutiveText(r: AnalysisResult): string {
  const findings = r.findings || [];
  const glossary = buildFindingGlossary(findings);
  const plan = buildRemediationPlan(findings);

  let text = `Resumen de auditoría XML - Fiscora\n`;
  text += `Fecha de análisis: ${r.fecha || "—"}\n`;
  text += `Tipo documento: ${r.documentKind || "—"}\n`;
  text += `UUID: ${r.uuid || "—"}\n`;
  text += `RFC Emisor: ${r.rfcEmisor || "—"} | RFC Receptor: ${r.rfcReceptor || "—"}\n`;
  text += `Total: $${r.total || "0"} ${r.moneda || ""}\n`;
  text += `Riesgo: ${r.executiveSummary?.riskLevel || "—"}\n\n`;

  text += `Conteo de hallazgos:\n`;
  text += `- Críticos: ${findings.filter((f) => f.severity === "CRITICAL").length}\n- Advertencias: ${findings.filter((f) => f.severity === "WARNING").length}\n- Informativos: ${findings.filter((f) => f.severity === "INFO").length}\n\n`;

  if (glossary.length > 0) {
    text += `Top hallazgos:\n`;
    glossary.slice(0, 5).forEach((g) => {
      text += `- [${g.code}] ${g.title} (${g.severity}) - Acción: ${g.recommendedAction}\n`;
    });
    text += `\n`;
  }

  if (plan.items.length > 0) {
    text += `Top acciones de remediación:\n`;
    plan.items.slice(0, 5).forEach((p) => {
      text += `- [${p.code}] ${p.ownerSuggestion} - Urgencia: ${p.urgency} - Acción: ${p.recommendedAction}\n`;
    });
    text += `\n`;
  }

  text += `Nota: No se incluye XML fuente ni contenido sensible.`;
  return truncateText(text, 6000);
}

export function buildSupportMessageFromAnalysis(r: AnalysisResult): string {
  let text = `Buen día,\n\n`;
  text += `Comparto el resultado de la auditoría XML realizada en Fiscora.\n\n`;
  text += `Datos clave:\n`;
  text += `- UUID: ${r.uuid || "—"}\n`;
  text += `- RFC Emisor: ${r.rfcEmisor || "—"}\n`;
  text += `- RFC Receptor: ${r.rfcReceptor || "—"}\n`;
  text += `- Total: $${r.total || "0"} ${r.moneda || ""}\n`;
  text += `- Riesgo: ${r.executiveSummary.riskLevel}\n\n`;

  const findings = r.findings || [];
  if (findings.some((f) => f.severity === "CRITICAL")) {
    text += `Problema detectado: Se detectaron hallazgos críticos/bloqueantes que requieren corrección antes de aceptar o contabilizar el XML.\n\n`;
  } else if (findings.some((f) => f.severity === "WARNING")) {
    text += `Problema detectado: Se detectaron advertencias que requieren revisión.\n\n`;
  } else {
    text += `Problema detectado: El XML pudo leerse y únicamente presenta observaciones informativas.\n\n`;
  }

  const glossary = buildFindingGlossary(findings);
  if (glossary.length > 0) {
    text += `Hallazgos principales:\n`;
    glossary.slice(0, 5).forEach((g) => {
      text += `- ${g.title} (${g.code})\n`;
    });
    text += `\n`;
  }

  const plan = buildRemediationPlan(findings);
  if (plan.items.length > 0) {
    text += `Acciones recomendadas:\n`;
    plan.items.slice(0, 5).forEach((p) => {
      text += `- ${p.recommendedAction}\n`;
    });
    text += `\n`;
  }

  text += `Favor de revisar los puntos anteriores y, si aplica, emitir/cargar el XML corregido o confirmar la justificación del caso.\n\n`;
  text += `Quedo atento/a a sus comentarios.`;
  return truncateText(text, 6000);
}

export function buildHistoryDetailSupportMessage(detail: XmlAuditHistoryDetail): string {
  // Uses same structure as individual, detail object matches relevant fields
  return buildSupportMessageFromAnalysis(detail.analysisJson);
}

export function buildZipExecutiveText(
  fullAnalysisResult: any,
  aggregatePlan: AggregateRemediationPlanResult,
): string {
  let text = `Resumen de auditoría XML masiva ZIP - Fiscora\n\n`;
  text += `ZIP: ${fullAnalysisResult.filename || "—"}\n`;
  text += `XMLs encontrados: ${fullAnalysisResult.totalEntries}\n`;
  text += `Analizados: ${fullAnalysisResult.analyzedCount}\n`;
  text += `Fallidos: ${fullAnalysisResult.failedCount}\n\n`;

  text += `Hallazgos agregados:\n`;
  text += `- Críticos: ${fullAnalysisResult.summary.criticalCount}\n- Warnings: ${fullAnalysisResult.summary.warningCount}\n- OK: ${fullAnalysisResult.summary.okCount}\n\n`;

  text += `Top acciones de remediación (Top 10):\n`;
  aggregatePlan.items.slice(0, 10).forEach((p) => {
    text += `- [${p.code}] ${p.title} - Archivos: ${p.affectedFiles} - Acción: ${p.recommendedAction}\n`;
  });

  text += `\nNota: No se incluye XML fuente ni contenido sensible.`;
  return truncateText(text, 8000);
}

export function buildZipSupportMessage(
  fullAnalysisResult: any,
  aggregatePlan: AggregateRemediationPlanResult,
): string {
  let text = `Buen día,\n\n`;
  text += `Comparto el resultado de la auditoría masiva del ZIP ${fullAnalysisResult.filename || ""} realizada en Fiscora.\n\n`;

  text += `Resumen del lote:\n`;
  text += `- XML analizados: ${fullAnalysisResult.analyzedCount}\n`;
  text += `- XML fallidos: ${fullAnalysisResult.failedCount}\n\n`;

  text += `Principales acciones de remediación:\n`;
  aggregatePlan.items.slice(0, 10).forEach((p) => {
    text += `- ${p.title} (${p.code}) en ${p.affectedFiles} archivos. ${p.recommendedAction}\n`;
  });

  text += `\nFavor de priorizar la revisión de los XML marcados como críticos o bloqueantes y atender las acciones indicadas.\n\n`;
  text += `Quedo atento/a a sus comentarios.`;
  return truncateText(text, 8000);
}
