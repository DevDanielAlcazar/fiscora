import type { XmlAuditZipBatchDetail } from "../../api/xml-audit";

interface Props {
  detail: XmlAuditZipBatchDetail;
}

export default function PrintableZipBatchReport({ detail }: Props) {
  const { batch, records } = detail;

  function formatDate(dateStr: string | null) {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleString("es-MX", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const tableHeaderClass = "bg-gray-100 text-gray-700 font-bold p-2 text-left border border-gray-300";
  const tableCellClass = "p-2 border border-gray-300 text-gray-800";

  return (
    <div className="printable-zip-batch-report hidden print:block bg-white text-black p-8 font-sans">
      {/* A) Encabezado */}
      <div className="flex justify-between items-start mb-8 border-b-2 border-gray-800 pb-4">
        <div>
          <h1 className="text-4xl font-black tracking-tighter text-blue-900">FISCORA</h1>
          <h2 className="text-xl font-bold text-gray-600 uppercase">Reporte de lote ZIP</h2>
        </div>
        <div className="text-right text-sm">
          <p>
            <strong>Fecha de generación:</strong> {new Date().toLocaleString("es-MX")}
          </p>
          <p>
            <strong>Batch ID:</strong> {batch.batchId}
          </p>
          <p>
            <strong>Nombre ZIP:</strong> {batch.zipFilename}
          </p>
        </div>
      </div>

      <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg text-sm italic text-gray-600">
        Este reporte se genera desde el historial temporal sanitizado. No incluye XML fuente,
        Addenda raw ni contenido normalizado.
      </div>

      {/* B) Resumen del lote */}
      <section className="mb-8">
        <h3 className="text-lg font-bold mb-4 uppercase border-l-4 border-blue-900 pl-2">
          Resumen ejecutivo del lote
        </h3>
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="border border-gray-200 p-3 rounded">
            <span className="block text-[10px] text-gray-500 font-bold uppercase">Total XML</span>
            <span className="text-xl font-bold">{batch.summary.totalRecords}</span>
          </div>
          <div className="border border-gray-200 p-3 rounded">
            <span className="block text-[10px] text-green-700 font-bold uppercase">OK</span>
            <span className="text-xl font-bold text-green-700">{batch.summary.okCount}</span>
          </div>
          <div className="border border-gray-200 p-3 rounded">
            <span className="block text-[10px] text-yellow-700 font-bold uppercase">Warnings</span>
            <span className="text-xl font-bold text-yellow-700">{batch.summary.warningCount}</span>
          </div>
          <div className="border border-gray-200 p-3 rounded">
            <span className="block text-[10px] text-red-700 font-bold uppercase">Críticos</span>
            <span className="text-xl font-bold text-red-700">{batch.summary.criticalCount}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-xs">
          <div className="flex justify-between border-b border-gray-100 py-1">
            <span className="font-bold text-gray-500 uppercase">Fecha inicio</span>
            <span>{formatDate(batch.createdAtFirst)}</span>
          </div>
          <div className="flex justify-between border-b border-gray-100 py-1">
            <span className="font-bold text-gray-500 uppercase">Expira</span>
            <span className="text-orange-700 font-semibold">{formatDate(batch.expiresAt)}</span>
          </div>
          <div className="flex justify-between border-b border-gray-100 py-1">
            <span className="font-bold text-gray-500 uppercase">Analizados</span>
            <span>{batch.summary.analyzedCount}</span>
          </div>
          <div className="flex justify-between border-b border-gray-100 py-1">
            <span className="font-bold text-gray-500 uppercase">Fallidos (Sistema)</span>
            <span className="text-red-600">{batch.summary.failedCount}</span>
          </div>
          <div className="flex justify-between border-b border-gray-100 py-1">
            <span className="font-bold text-gray-500 uppercase">XMLs con BOM</span>
            <span>{batch.summary.recordsWithBom}</span>
          </div>
          <div className="flex justify-between border-b border-gray-100 py-1">
            <span className="font-bold text-gray-500 uppercase">Normalizados</span>
            <span>{batch.summary.recordsWithNormalizedXml}</span>
          </div>
        </div>
      </section>

      {/* C) Tipos de documento */}
      <section className="mb-8 page-break-inside-avoid">
        <h3 className="text-lg font-bold mb-4 uppercase border-l-4 border-blue-900 pl-2">
          Composición de documentos
        </h3>
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className={tableHeaderClass}>Tipo de documento</th>
              <th className={`${tableHeaderClass} text-right`}>Cantidad</th>
            </tr>
          </thead>
          <tbody>
            {batch.summary.documentKinds.map((dk) => (
              <tr key={dk.documentKind}>
                <td className={tableCellClass}>{dk.documentKind}</td>
                <td className={`${tableCellClass} text-right font-bold`}>{dk.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* D) Registros del lote */}
      <section className="mb-8">
        <h3 className="text-lg font-bold mb-4 uppercase border-l-4 border-blue-900 pl-2">
          Detalle de registros (Máx 100)
        </h3>
        <table className="w-full border-collapse text-[9px]">
          <thead>
            <tr>
              <th className={tableHeaderClass}>#</th>
              <th className={tableHeaderClass}>Entrada ZIP</th>
              <th className={tableHeaderClass}>Estado</th>
              <th className={tableHeaderClass}>Riesgo</th>
              <th className={tableHeaderClass}>UUID / RFCs</th>
              <th className={tableHeaderClass} style={{ textAlign: "right" }}>
                Total
              </th>
              <th className={tableHeaderClass} style={{ textAlign: "right" }}>
                Hall.
              </th>
            </tr>
          </thead>
          <tbody>
            {records.slice(0, 100).map((r) => (
              <tr key={r.id}>
                <td className={tableCellClass}>{r.zipEntryIndex}</td>
                <td className={tableCellClass} style={{ maxWidth: "120px", overflow: "hidden" }}>
                  {r.zipEntryName}
                </td>
                <td className={tableCellClass}>
                  {r.analysisStatus === "FAILED" ? "ERROR" : "OK"}
                </td>
                <td className={tableCellClass}>{r.riskLevel || "OK"}</td>
                <td className={tableCellClass}>
                  <div className="font-mono text-[8px]">{r.uuid || "—"}</div>
                  <div className="mt-1">
                    {r.rfcEmisor} ➔ {r.rfcReceptor}
                  </div>
                </td>
                <td className={`${tableCellClass} text-right`}>
                  {r.total ? `$${r.total}` : "—"}
                </td>
                <td className={`${tableCellClass} text-right font-bold`}>{r.findingsCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {records.length > 100 && (
          <p className="mt-4 p-3 bg-blue-50 border border-blue-100 text-blue-800 text-xs italic rounded">
            El lote contiene {records.length} registros; el reporte imprimible muestra los primeros
            100. Use el CSV para el detalle completo.
          </p>
        )}
      </section>

      {/* E) Nota de seguridad */}
      <footer className="mt-12 pt-4 border-t border-gray-300 text-[10px] text-gray-500 text-center">
        <p>
          Este documento es confidencial y para uso exclusivo del usuario. No incluye XML fuente,
          analysisJson completo, evidence completo, Addenda raw ni normalizedXml.content.
        </p>
      </footer>

      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .printable-zip-batch-report, .printable-zip-batch-report * {
            visibility: visible;
          }
          .printable-zip-batch-report {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .page-break-inside-avoid {
            page-break-inside: avoid;
          }
        }
      `}</style>
    </div>
  );
}
