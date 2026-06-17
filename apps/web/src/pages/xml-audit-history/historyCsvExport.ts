import type { XmlAuditHistoryResponse, XmlAuditHistoryQuery } from "../../api/xml-audit";

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

export function exportXmlAuditHistoryCsv(
  response: XmlAuditHistoryResponse,
  filters: XmlAuditHistoryQuery,
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
  row("Source type", filters.sourceType || "Todos");
  row("Estado", filters.analysisStatus || "Todos");
  row("Riesgo", filters.riskLevel || "Todos");
  row("Tipo documento", filters.documentKind || "Todos");
  row("Búsqueda", filters.search || "—");
  row("Página", response.pagination.page);
  row("Tamaño página", response.pagination.pageSize);
  row("Total filtrado", response.pagination.total);
  row("Total páginas", response.pagination.totalPages);
  row("Nota seguridad", "No incluye XML fuente ni contenido normalizado.");

  // B) HISTORIAL
  section("HISTORIAL");
  row(
    "ID",
    "Fecha análisis",
    "Expira",
    "Source type",
    "Archivo fuente",
    "Batch ID",
    "ZIP",
    "Entrada ZIP",
    "Índice ZIP",
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

  for (const item of response.items) {
    row(
      item.id,
      item.createdAt,
      item.expiresAt,
      item.sourceType,
      item.sourceFilename,
      item.batchId,
      item.zipFilename,
      item.zipEntryName,
      item.zipEntryIndex,
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
  descargarBlob(blob, "fiscora-historial-xml.csv");
}
