import type { XmlAnalyticsSummary, XmlAnalyticsQuery } from "../../api/admin";

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

function escCsv(val: string | number | null | undefined): string {
  const s = val === null || val === undefined ? "" : String(val);
  const v = s.replace(/"/g, '""');
  return /[",\n\r]/.test(v) ? `"${v}"` : v;
}

export function exportAdminAnalyticsCsv(summary: XmlAnalyticsSummary, filters: XmlAnalyticsQuery) {
  const bom = "\uFEFF";
  const lines: string[] = [];

  function section(title: string) {
    lines.push("");
    lines.push(`"${title}"`);
    lines.push("");
  }
  function row(...vals: (string | number | null | undefined)[]) {
    lines.push(vals.map((v) => escCsv(v)).join(","));
  }

  // A) METADATA
  section("METADATA");
  row("Campo", "Valor");
  row("Fecha generación", new Date().toLocaleString("es-MX"));
  row("Filtro desde", filters.from || "—");
  row("Filtro hasta", filters.to || "—");
  row("Organización", filters.organizationId || "Todas");
  row("Usuario", filters.userId || "Todos");
  row("Source type", filters.sourceType || "Todos");
  row("Estado análisis", filters.analysisStatus || "Todos");
  row("Total análisis", summary.totals.records);
  row("Analizados", summary.totals.analyzed);
  row("Fallidos", summary.totals.failed);
  row("Individuales", summary.totals.individual);
  row("ZIP", summary.totals.zip);
  row("Lotes ZIP", summary.totals.uniqueBatches);
  row("Usuarios", summary.totals.uniqueUsers);
  row("Organizaciones", summary.totals.uniqueOrganizations);

  if (summary.analyticsV2) {
    const v2 = summary.analyticsV2;

    // B) DOCUMENTOS ANALIZADOS
    section("DOCUMENTOS ANALIZADOS");
    row("Tipo documento", "Cantidad");
    for (const dk of v2.documentKinds) {
      row(dk.documentKind, dk.count);
    }

    // C) PRIORIDADES GLOBALES
    section("PRIORIDADES GLOBALES");
    row("Prioridad", "Hallazgos", "Registros afectados");
    for (const p of v2.priorities) {
      row(p.priority, p.findings, p.recordsAffected);
    }

    // D) GRUPOS ACCIONABLES
    section("GRUPOS ACCIONABLES");
    row("Grupo accionable", "Hallazgos", "Registros afectados", "Críticos", "Advertencias", "Info");
    for (const ag of v2.actionGroups) {
      row(ag.actionGroup, ag.findings, ag.recordsAffected, ag.critical, ag.warning, ag.info);
    }

    // E) COBERTURA POR MODULO
    section("COBERTURA POR MODULO");
    row(
      "Módulo key",
      "Módulo",
      "Detectado en registros",
      "Analizado en registros",
      "Hallazgos",
      "Registros con hallazgos",
    );
    for (const m of v2.modulesCoverage) {
      row(m.key, m.label, m.detectedInRecords, m.analyzedInRecords, m.findings, m.recordsWithFindings);
    }

    // F) PERFORMANCE DEL MOTOR
    section("PERFORMANCE DEL MOTOR");
    row("Campo", "Valor");
    row("Registros con metadata", v2.performance.recordsWithMeta);
    row("Tiempo total ms", v2.performance.totalMs);
    row("Tiempo promedio ms", v2.performance.avgMs);
    row("Tiempo máximo ms", v2.performance.maxMs);
    row("Tiempo mínimo ms", v2.performance.minMs);
    row("KB totales entrada", v2.performance.totalInputKb);
    row("KB promedio entrada", v2.performance.avgInputKb);
    row("Hallazgos originales", v2.performance.totalFindingsOriginal);
    row("Hallazgos devueltos", v2.performance.totalFindingsReturned);
    row("Registros con hallazgos truncados", v2.performance.recordsWithTruncatedFindings);

    // G) TOP HALLAZGOS
    section("TOP HALLAZGOS");
    row(
      "Código",
      "Título",
      "Severidad máxima",
      "Prioridad máxima",
      "Grupo accionable",
      "Apariciones",
      "Registros afectados",
    );
    for (const fc of v2.topFindingCodes) {
      row(
        fc.code,
        fc.title,
        fc.severityMax,
        fc.priorityMax,
        fc.actionGroup || "—",
        fc.count,
        fc.recordsAffected,
      );
    }

    // H) TOP MODULOS
    section("TOP MODULOS");
    row("Módulo key", "Módulo", "Hallazgos", "Registros afectados");
    for (const tm of v2.topModulesByFindings) {
      row(tm.key, tm.label, tm.findings, tm.recordsAffected);
    }
  }

  const csv = bom + lines.join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;header=present" });
  descargarBlob(blob, "fiscora-admin-xml-analytics.csv");
}
