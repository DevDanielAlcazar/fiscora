import type { XmlAuditHistorySummary, XmlAuditHistorySummaryQuery } from "../../api/xml-audit";

function descargarBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function escCsv(val: string | number | boolean | null | undefined): string {
  const s = val === null || val === undefined ? "" : String(val);
  const v = s.replace(/"/g, '""');
  return /[",\n\r]/.test(v) ? `"${v}"` : v;
}

export function exportXmlAuditDashboardCsv(
  summary: XmlAuditHistorySummary,
  currentFilters: XmlAuditHistorySummaryQuery,
) {
  const bom = "\uFEFF";
  const lines: string[] = [];

  function section(title: string) {
    lines.push("");
    lines.push(`"${title}"`);
    lines.push("");
  }
  function row(...vals: (string | number | boolean | null | undefined)[]) {
    lines.push(vals.map((v) => escCsv(v)).join(","));
  }

  // A) METADATA
  section("METADATA");
  row("Campo", "Valor");
  row("Fecha generación del reporte", new Date().toLocaleString("es-MX"));
  row("Fecha generación summary", new Date(summary.generatedAt).toLocaleString("es-MX"));
  row("Retención horas", summary.retentionHours);
  row("Filtro desde", currentFilters.from || "—");
  row("Filtro hasta", currentFilters.to || "—");
  row("Source type", currentFilters.sourceType || "Todas");
  row("Estado análisis", currentFilters.analysisStatus || "Todos");
  row("Nota seguridad", "No incluye XML fuente, analysisJson completo ni contenido normalizado.");

  // B) TOTALES
  section("TOTALES");
  row("Métrica", "Valor");
  row("Total análisis", summary.totals.records);
  row("Analizados", summary.totals.analyzed);
  row("Fallidos", summary.totals.failed);
  row("Individuales", summary.totals.individual);
  row("ZIP", summary.totals.zip);
  row("Lotes ZIP", summary.totals.batches);
  row("OK", summary.totals.ok);
  row("Warning", summary.totals.warning);
  row("Critical", summary.totals.critical);
  row("Findings info", summary.totals.infoFindings);
  row("Findings warning", summary.totals.warningFindings);
  row("Findings critical", summary.totals.criticalFindings);
  row("Registros con BOM", summary.totals.recordsWithBom);
  row("Registros con normalización técnica", summary.totals.recordsWithTechnicalNormalization);
  row("Registros con XML normalizado disponible", summary.totals.recordsWithNormalizedXml);

  // C) PRIORIDADES
  section("PRIORIDADES");
  row("Prioridad", "Hallazgos", "Registros afectados");
  for (const p of summary.priorities) {
    row(p.priority, p.findings, p.recordsAffected);
  }

  // D) TIPOS DE DOCUMENTO
  section("TIPOS DE DOCUMENTO");
  row("Tipo documento", "Cantidad");
  for (const dk of summary.documentKinds) {
    row(dk.documentKind, dk.count);
  }

  // E) GRUPOS ACCIONABLES
  section("GRUPOS ACCIONABLES");
  row("Grupo accionable", "Hallazgos", "Registros afectados");
  for (const ag of summary.actionGroups) {
    row(ag.actionGroup, ag.findings, ag.recordsAffected);
  }

  // F) TOP HALLAZGOS
  section("TOP HALLAZGOS");
  row(
    "Código",
    "Título",
    "Severidad máxima",
    "Prioridad máxima",
    "Apariciones",
    "Registros afectados",
  );
  for (const fc of summary.topFindingCodes) {
    row(fc.code, fc.title, fc.severityMax, fc.priorityMax, fc.count, fc.recordsAffected);
  }

  // G) ACTIVIDAD RECIENTE
  section("ACTIVIDAD RECIENTE");
  row(
    "ID",
    "Fecha",
    "Source type",
    "Archivo fuente",
    "ZIP",
    "Entrada ZIP",
    "Estado",
    "Tipo documento",
    "UUID",
    "RFC emisor",
    "RFC receptor",
    "Total",
    "Moneda",
    "Riesgo",
    "Hallazgos",
    "Críticos",
    "Advertencias",
    "Info",
    "Prioridad máxima",
    "Grupo accionable principal",
  );
  for (const r of summary.recentRecords) {
    row(
      r.id,
      r.createdAt,
      r.sourceType,
      r.sourceFilename,
      r.zipFilename,
      r.zipEntryName,
      r.analysisStatus,
      r.documentKind,
      r.uuid,
      r.rfcEmisor,
      r.rfcReceptor,
      r.total,
      r.moneda,
      r.riskLevel,
      r.findingsCount,
      r.criticalCount,
      r.warningCount,
      r.infoCount,
      r.priorityMax,
      r.actionGroupTop,
    );
  }

  // H) LOTES ZIP RECIENTES
  section("LOTES ZIP RECIENTES");
  row(
    "Batch ID",
    "ZIP",
    "Fecha inicio",
    "Fecha fin",
    "Total XML",
    "Analizados",
    "Fallidos",
    "Críticos",
    "Advertencias",
    "OK",
    "Prioridad máxima",
    "Grupo accionable principal",
    "Hallazgo principal",
  );
  for (const b of summary.recentBatches) {
    row(
      b.batchId,
      b.zipFilename,
      b.createdAtFirst,
      b.createdAtLast,
      b.totalRecords,
      b.analyzedCount,
      b.failedCount,
      b.criticalCount,
      b.warningCount,
      b.okCount,
      b.priorityMax,
      b.topActionGroup,
      b.topFindingCode,
    );
  }

  const csv = bom + lines.join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;header=present" });
  descargarBlob(blob, "fiscora-dashboard-xml.csv");
}
