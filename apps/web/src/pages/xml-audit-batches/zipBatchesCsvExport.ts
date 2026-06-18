import type {
  XmlAuditZipBatchesResponse,
  XmlAuditZipBatchesQuery,
  XmlAuditZipBatchDetail,
} from "../../api/xml-audit";

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

export function exportXmlAuditZipBatchesCsv(
  response: XmlAuditZipBatchesResponse,
  filters: XmlAuditZipBatchesQuery,
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
  row("Fecha generación", new Date().toLocaleString("es-MX"));
  row("Filtro desde", filters.from || "—");
  row("Filtro hasta", filters.to || "—");
  row("Nombre ZIP", filters.zipFilename || "—");
  row("Batch ID", filters.batchId || "—");
  row("Búsqueda", filters.search || "—");
  row("Tiene fallidos", filters.hasFailed || "Todos");
  row("Tiene críticos", filters.hasCritical || "Todos");
  row("Tipo documento", filters.documentKind || "Todos");
  row("Página", response.pagination.page);
  row("Tamaño página", response.pagination.pageSize);
  row("Total filtrado", response.pagination.total);
  row("Total páginas", response.pagination.totalPages);
  row("Nota seguridad", "No incluye XML fuente, analysisJson completo ni contenido normalizado.");

  // B) LOTES ZIP
  section("LOTES ZIP");
  row(
    "Batch ID",
    "ZIP",
    "Fecha inicio",
    "Fecha fin",
    "Expira",
    "Total XML",
    "Analizados",
    "Fallidos",
    "Críticos",
    "Advertencias",
    "Info",
    "OK",
    "XMLs con BOM",
    "XMLs con normalización técnica",
    "XMLs normalizados disponibles",
    "Tiene fallidos",
    "Tiene críticos",
    "Prioridad máxima",
    "Grupo accionable principal",
    "Hallazgo principal",
    "Tipos de documento",
  );

  for (const item of response.items) {
    const docKinds = item.documentKinds.map((dk) => `${dk.documentKind} (${dk.count})`).join(" | ");
    row(
      item.batchId,
      item.zipFilename,
      item.createdAtFirst,
      item.createdAtLast,
      item.expiresAt,
      item.totalRecords,
      item.analyzedCount,
      item.failedCount,
      item.criticalCount,
      item.warningCount,
      item.infoCount,
      item.okCount,
      item.recordsWithBom,
      item.recordsWithTechnicalNormalization,
      item.recordsWithNormalizedXml,
      item.hasFailed,
      item.hasCritical,
      item.priorityMax,
      item.topActionGroup,
      item.topFindingCode,
      docKinds,
    );
  }

  const csv = bom + lines.join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;header=present" });
  descargarBlob(blob, "fiscora-lotes-zip-recientes.csv");
}

export function exportXmlAuditZipBatchDetailCsv(detail: XmlAuditZipBatchDetail) {
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

  // A) METADATA LOTE
  section("METADATA LOTE");
  row("Campo", "Valor");
  row("Fecha generación", new Date().toLocaleString("es-MX"));
  row("Batch ID", detail.batch.batchId);
  row("ZIP", detail.batch.zipFilename);
  row("Fecha inicio", detail.batch.createdAtFirst);
  row("Fecha fin", detail.batch.createdAtLast);
  row("Expira", detail.batch.expiresAt);
  row("Total XML", detail.batch.summary.totalRecords);
  row("Analizados", detail.batch.summary.analyzedCount);
  row("Fallidos", detail.batch.summary.failedCount);
  row("Críticos", detail.batch.summary.criticalCount);
  row("Advertencias", detail.batch.summary.warningCount);
  row("Info", detail.batch.summary.infoCount);
  row("OK", detail.batch.summary.okCount);
  row("Nota seguridad", "No incluye XML fuente ni contenido normalizado.");

  // B) REGISTROS DEL LOTE
  section("REGISTROS DEL LOTE");
  row(
    "ID",
    "Entrada ZIP",
    "Índice ZIP",
    "Fecha análisis",
    "Expira",
    "Estado análisis",
    "Código error",
    "Mensaje error",
    "Tipo documento",
    "UUID",
    "Tipo comprobante",
    "RFC emisor",
    "Nombre emisor",
    "RFC receptor",
    "Nombre receptor",
    "Fecha CFDI",
    "Total",
    "Moneda",
    "Riesgo",
    "Prioridad máxima",
    "Grupo accionable principal",
    "Hallazgos",
    "Críticos",
    "Advertencias",
    "Info",
    "BOM",
    "Normalización técnica",
    "XML normalizado disponible",
  );

  for (const item of detail.records) {
    row(
      item.id,
      item.zipEntryName,
      item.zipEntryIndex,
      item.createdAt,
      item.expiresAt,
      item.analysisStatus,
      item.errorCode,
      item.errorMessage,
      item.documentKind,
      item.uuid,
      item.tipoComprobante,
      item.rfcEmisor,
      item.nombreEmisor,
      item.rfcReceptor,
      item.nombreReceptor,
      item.fecha,
      item.total,
      item.moneda,
      item.riskLevel,
      item.priorityMax,
      item.actionGroupTop,
      item.findingsCount,
      item.criticalCount,
      item.warningCount,
      item.infoCount,
      item.hasBom,
      item.hasTechnicalNormalization,
      item.hasNormalizedXml,
    );
  }

  const csv = bom + lines.join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;header=present" });
  descargarBlob(blob, `fiscora-lote-zip-${detail.batch.batchId}.csv`);
}
