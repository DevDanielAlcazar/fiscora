import type { XmlAuditHistorySummary, XmlAuditHistorySummaryQuery } from "../../api/xml-audit";

interface Props {
  summary: XmlAuditHistorySummary;
  currentFilters: XmlAuditHistorySummaryQuery;
}

export default function PrintableXmlAuditDashboardReport({ summary, currentFilters }: Props) {
  function formatDate(dateStr: string | null) {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("es-MX", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const tableHeaderClass =
    "bg-gray-100 text-gray-700 font-bold p-2 text-left border border-gray-300";
  const tableCellClass = "p-2 border border-gray-300 text-gray-800";

  const healthState =
    summary.totals.records === 0
      ? "Sin actividad"
      : summary.totals.critical > 0 || summary.totals.failed > 0
        ? "Atención crítica"
        : summary.totals.warning > 0
          ? "Revisión recomendada"
          : "Operación estable";

  const healthMessage =
    summary.totals.records === 0
      ? "No se han realizado análisis en la ventana seleccionada."
      : summary.totals.critical > 0 || summary.totals.failed > 0
        ? "Se han detectado riesgos de alta prioridad o fallas técnicas. Revisa los análisis críticos primero."
        : summary.totals.warning > 0
          ? "Existen advertencias que requieren tu validación antes de procesar fiscalmente los comprobantes."
          : "No se detectan riesgos altos en la ventana de retención seleccionada.";

  return (
    <div className="printable-xml-audit-dashboard-report hidden print:block bg-white text-black p-8 font-sans">
      {/* A) Encabezado */}
      <div className="flex justify-between items-start mb-8 border-b-2 border-gray-800 pb-4">
        <div>
          <h1 className="text-4xl font-black tracking-tighter text-blue-900">FISCORA</h1>
          <h2 className="text-xl font-bold text-gray-600 uppercase">Dashboard de Auditoría XML</h2>
        </div>
        <div className="text-right text-sm">
          <p>
            <strong>Fecha de generación:</strong> {new Date().toLocaleString("es-MX")}
          </p>
          <p>
            <strong>Rango:</strong> {currentFilters.from || "Vigentes"} al{" "}
            {currentFilters.to || "Hoy"}
          </p>
        </div>
      </div>

      <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg text-sm italic text-gray-600">
        Este reporte muestra métricas agregadas de análisis XML recientes dentro de la ventana de
        retención (24h). No incluye XML fuente, Addenda raw ni contenido normalizado.
      </div>

      {/* B) Salud general */}
      <section className="mb-8">
        <h3 className="text-lg font-bold mb-4 uppercase border-l-4 border-blue-900 pl-2">
          Salud de la operación
        </h3>
        <div
          className={`p-4 rounded-xl border ${
            healthState === "Atención crítica"
              ? "bg-red-50 border-red-200"
              : healthState === "Revisión recomendada"
                ? "bg-yellow-50 border-yellow-200"
                : "bg-green-50 border-green-200"
          }`}
        >
          <h4 className="font-bold uppercase text-sm mb-1">{healthState}</h4>
          <p className="text-sm">{healthMessage}</p>
        </div>
      </section>

      {/* C) Resumen principal */}
      <section className="mb-8">
        <h3 className="text-lg font-bold mb-4 uppercase border-l-4 border-blue-900 pl-2">
          Resumen operativo
        </h3>
        <div className="grid grid-cols-4 gap-4 mb-4">
          <div className="border border-gray-300 p-3 rounded text-center">
            <span className="block text-[10px] uppercase text-gray-500 font-bold">
              Total Análisis
            </span>
            <span className="text-xl font-bold">{summary.totals.records}</span>
          </div>
          <div className="border border-gray-300 p-3 rounded text-center text-green-700">
            <span className="block text-[10px] uppercase text-gray-500 font-bold">OK</span>
            <span className="text-xl font-bold">{summary.totals.ok}</span>
          </div>
          <div className="border border-gray-300 p-3 rounded text-center text-yellow-700">
            <span className="block text-[10px] uppercase text-gray-500 font-bold">Warnings</span>
            <span className="text-xl font-bold">{summary.totals.warning}</span>
          </div>
          <div className="border border-gray-300 p-3 rounded text-center text-red-700">
            <span className="block text-[10px] uppercase text-gray-500 font-bold">
              Críticos/Err
            </span>
            <span className="text-xl font-bold">
              {summary.totals.critical + summary.totals.failed}
            </span>
          </div>
          <div className="border border-gray-300 p-3 rounded text-center">
            <span className="block text-[10px] uppercase text-gray-500 font-bold">ZIP</span>
            <span className="text-xl font-bold">{summary.totals.zip}</span>
          </div>
          <div className="border border-gray-300 p-3 rounded text-center text-blue-700">
            <span className="block text-[10px] uppercase text-gray-500 font-bold">Lotes</span>
            <span className="text-xl font-bold">{summary.totals.batches}</span>
          </div>
          <div className="border border-gray-300 p-3 rounded text-center">
            <span className="block text-[10px] uppercase text-gray-500 font-bold">Con BOM</span>
            <span className="text-xl font-bold">{summary.totals.recordsWithBom}</span>
          </div>
          <div className="border border-gray-300 p-3 rounded text-center text-purple-700">
            <span className="block text-[10px] uppercase text-gray-500 font-bold">
              Normalizados
            </span>
            <span className="text-xl font-bold">{summary.totals.recordsWithNormalizedXml}</span>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-8 mb-8">
        {/* D) Prioridades */}
        <section className="page-break-inside-avoid">
          <h3 className="text-lg font-bold mb-4 uppercase border-l-4 border-blue-900 pl-2">
            Prioridades
          </h3>
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                <th className={tableHeaderClass}>Prioridad</th>
                <th className={`${tableHeaderClass} text-right`}>Hallazgos</th>
                <th className={`${tableHeaderClass} text-right`}>Registros</th>
              </tr>
            </thead>
            <tbody>
              {summary.priorities.map((p) => (
                <tr key={p.priority}>
                  <td className={tableCellClass}>{p.priority}</td>
                  <td className={`${tableCellClass} text-right`}>{p.findings}</td>
                  <td className={`${tableCellClass} text-right`}>{p.recordsAffected}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* E) Tipos de documento */}
        <section className="page-break-inside-avoid">
          <h3 className="text-lg font-bold mb-4 uppercase border-l-4 border-blue-900 pl-2">
            Tipos de comprobante
          </h3>
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                <th className={tableHeaderClass}>Tipo de documento</th>
                <th className={`${tableHeaderClass} text-right`}>Cantidad</th>
              </tr>
            </thead>
            <tbody>
              {summary.documentKinds.map((dk) => (
                <tr key={dk.documentKind}>
                  <td className={tableCellClass}>{dk.documentKind}</td>
                  <td className={`${tableCellClass} text-right font-bold`}>{dk.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      {/* F) Grupos accionables */}
      <section className="mb-8 page-break-inside-avoid">
        <h3 className="text-lg font-bold mb-4 uppercase border-l-4 border-blue-900 pl-2">
          Grupos accionables
        </h3>
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className={tableHeaderClass}>Grupo</th>
              <th className={`${tableHeaderClass} text-right`}>Hallazgos</th>
              <th className={`${tableHeaderClass} text-right`}>Registros afectados</th>
            </tr>
          </thead>
          <tbody>
            {summary.actionGroups.map((ag) => (
              <tr key={ag.actionGroup}>
                <td className={tableCellClass}>{ag.actionGroup}</td>
                <td className={`${tableCellClass} text-right`}>{ag.findings}</td>
                <td className={`${tableCellClass} text-right font-bold`}>{ag.recordsAffected}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* G) Top hallazgos */}
      <section className="mb-8 page-break-inside-avoid">
        <h3 className="text-lg font-bold mb-4 uppercase border-l-4 border-blue-900 pl-2">
          Principales hallazgos
        </h3>
        <table className="w-full border-collapse text-[10px]">
          <thead>
            <tr>
              <th className={tableHeaderClass}>Código</th>
              <th className={tableHeaderClass}>Título</th>
              <th className={tableHeaderClass}>Sev</th>
              <th className={tableHeaderClass}>Prio</th>
              <th className={`${tableHeaderClass} text-right`}>Ocurr.</th>
              <th className={`${tableHeaderClass} text-right`}>Regs</th>
            </tr>
          </thead>
          <tbody>
            {summary.topFindingCodes.slice(0, 10).map((fc) => (
              <tr key={fc.code}>
                <td className={`${tableCellClass} font-mono font-bold`}>{fc.code}</td>
                <td className={tableCellClass}>{fc.title}</td>
                <td className={tableCellClass}>{fc.severityMax}</td>
                <td className={tableCellClass}>{fc.priorityMax}</td>
                <td className={`${tableCellClass} text-right`}>{fc.count}</td>
                <td className={`${tableCellClass} text-right`}>{fc.recordsAffected}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* H) Actividad reciente */}
      <section className="mb-8 page-break-inside-avoid">
        <h3 className="text-lg font-bold mb-4 uppercase border-l-4 border-blue-900 pl-2">
          Actividad reciente (Últimos 10)
        </h3>
        <table className="w-full border-collapse text-[9px]">
          <thead>
            <tr>
              <th className={tableHeaderClass}>Fecha</th>
              <th className={tableHeaderClass}>Fuente</th>
              <th className={tableHeaderClass}>UUID / Archivo</th>
              <th className={tableHeaderClass}>Estado</th>
              <th className={tableHeaderClass}>Riesgo</th>
              <th className={`${tableHeaderClass} text-right`}>Hall.</th>
            </tr>
          </thead>
          <tbody>
            {summary.recentRecords.map((r) => (
              <tr key={r.id}>
                <td className={tableCellClass}>{formatDate(r.createdAt)}</td>
                <td className={tableCellClass}>{r.sourceType}</td>
                <td className={tableCellClass} style={{ maxWidth: "200px", overflow: "hidden" }}>
                  <div className="font-mono">{r.uuid || "—"}</div>
                  <div className="text-[7px] text-gray-500">
                    {r.sourceFilename || r.zipEntryName}
                  </div>
                </td>
                <td className={tableCellClass}>{r.analysisStatus}</td>
                <td className={tableCellClass}>{r.riskLevel || "OK"}</td>
                <td className={`${tableCellClass} text-right font-bold`}>{r.findingsCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* I) Lotes ZIP recientes */}
      <section className="mb-8 page-break-inside-avoid">
        <h3 className="text-lg font-bold mb-4 uppercase border-l-4 border-blue-900 pl-2">
          Lotes ZIP recientes (Últimos 5)
        </h3>
        <table className="w-full border-collapse text-[10px]">
          <thead>
            <tr>
              <th className={tableHeaderClass}>Fecha</th>
              <th className={tableHeaderClass}>Nombre ZIP</th>
              <th className={`${tableHeaderClass} text-right`}>Total XML</th>
              <th className={`${tableHeaderClass} text-right`}>Fallidos</th>
              <th className={tableHeaderClass}>Prioridad Máx</th>
              <th className={tableHeaderClass}>Hallazgo Principal</th>
            </tr>
          </thead>
          <tbody>
            {summary.recentBatches.map((b) => (
              <tr key={b.batchId}>
                <td className={tableCellClass}>{formatDate(b.createdAtFirst)}</td>
                <td className={tableCellClass}>{b.zipFilename}</td>
                <td className={`${tableCellClass} text-right`}>{b.totalRecords}</td>
                <td className={`${tableCellClass} text-right text-red-600`}>{b.failedCount}</td>
                <td className={tableCellClass}>{b.priorityMax || "LOW"}</td>
                <td className={tableCellClass}>{b.topFindingCode || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* J) Nota de seguridad */}
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
          .printable-xml-audit-dashboard-report, .printable-xml-audit-dashboard-report * {
            visibility: visible;
          }
          .printable-xml-audit-dashboard-report {
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
