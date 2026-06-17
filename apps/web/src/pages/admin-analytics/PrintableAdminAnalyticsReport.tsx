import type { XmlAnalyticsSummary, XmlAnalyticsQuery } from "../../api/admin";

interface Props {
  summary: XmlAnalyticsSummary;
  filters: XmlAnalyticsQuery;
}

export default function PrintableAdminAnalyticsReport({ summary, filters }: Props) {
  const v2 = summary.analyticsV2;

  function formatDate(dateStr: string | null) {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    return d.toLocaleDateString("es-MX", {
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
    <div className="printable-admin-analytics-report hidden print:block bg-white text-black p-8 font-sans">
      {/* A) Encabezado */}
      <div className="flex justify-between items-start mb-8 border-b-2 border-gray-800 pb-4">
        <div>
          <h1 className="text-4xl font-black tracking-tighter text-blue-900">FISCORA</h1>
          <h2 className="text-xl font-bold text-gray-600 uppercase">Reporte Admin Analytics XML</h2>
        </div>
        <div className="text-right text-sm">
          <p>
            <strong>Fecha de generación:</strong> {new Date().toLocaleString("es-MX")}
          </p>
          <p>
            <strong>Rango:</strong> {formatDate(filters.from || summary.range.from)} al{" "}
            {formatDate(filters.to || summary.range.to)}
          </p>
        </div>
      </div>

      <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg text-sm italic text-gray-600">
        Este reporte muestra métricas agregadas de análisis XML. No incluye XML fuente, Addenda raw
        ni contenido normalizado.
      </div>

      {/* B) Resumen ejecutivo */}
      <section className="mb-8">
        <h3 className="text-lg font-bold mb-4 uppercase border-l-4 border-blue-900 pl-2">
          Resumen ejecutivo
        </h3>
        <div className="grid grid-cols-4 gap-4 mb-4">
          <div className="border border-gray-300 p-3 rounded shadow-sm">
            <span className="block text-xs uppercase text-gray-500 font-bold">Total análisis</span>
            <span className="text-2xl font-bold">{summary.totals.records}</span>
          </div>
          <div className="border border-gray-300 p-3 rounded shadow-sm">
            <span className="block text-xs uppercase text-gray-500 font-bold">Analizados</span>
            <span className="text-2xl font-bold text-green-700">{summary.totals.analyzed}</span>
          </div>
          <div className="border border-gray-300 p-3 rounded shadow-sm">
            <span className="block text-xs uppercase text-gray-500 font-bold">Fallidos</span>
            <span className="text-2xl font-bold text-red-700">{summary.totals.failed}</span>
          </div>
          <div className="border border-gray-300 p-3 rounded shadow-sm">
            <span className="block text-xs uppercase text-gray-500 font-bold">Individuales</span>
            <span className="text-2xl font-bold">{summary.totals.individual}</span>
          </div>
          <div className="border border-gray-300 p-3 rounded shadow-sm">
            <span className="block text-xs uppercase text-gray-500 font-bold">ZIP</span>
            <span className="text-2xl font-bold">{summary.totals.zip}</span>
          </div>
          <div className="border border-gray-300 p-3 rounded shadow-sm">
            <span className="block text-xs uppercase text-gray-500 font-bold">Lotes ZIP</span>
            <span className="text-2xl font-bold">{summary.totals.uniqueBatches}</span>
          </div>
          <div className="border border-gray-300 p-3 rounded shadow-sm">
            <span className="block text-xs uppercase text-gray-500 font-bold">Usuarios</span>
            <span className="text-2xl font-bold">{summary.totals.uniqueUsers}</span>
          </div>
          <div className="border border-gray-300 p-3 rounded shadow-sm">
            <span className="block text-xs uppercase text-gray-500 font-bold">Organizaciones</span>
            <span className="text-2xl font-bold">{summary.totals.uniqueOrganizations}</span>
          </div>
        </div>
      </section>

      {v2 && (
        <>
          <div className="grid grid-cols-2 gap-8 mb-8">
            {/* C) Documentos analizados */}
            <section>
              <h3 className="text-lg font-bold mb-4 uppercase border-l-4 border-blue-900 pl-2">
                Documentos analizados
              </h3>
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className={tableHeaderClass}>Tipo documento</th>
                    <th className={tableHeaderClass}>Cantidad</th>
                  </tr>
                </thead>
                <tbody>
                  {v2.documentKinds.map((dk) => (
                    <tr key={dk.documentKind}>
                      <td className={tableCellClass}>{dk.documentKind}</td>
                      <td className={tableCellClass}>{dk.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            {/* D) Prioridades globales */}
            <section>
              <h3 className="text-lg font-bold mb-4 uppercase border-l-4 border-blue-900 pl-2">
                Prioridades globales
              </h3>
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className={tableHeaderClass}>Prioridad</th>
                    <th className={tableHeaderClass}>Hallazgos</th>
                    <th className={tableHeaderClass}>Registros</th>
                  </tr>
                </thead>
                <tbody>
                  {v2.priorities.map((p) => (
                    <tr key={p.priority}>
                      <td className={tableCellClass}>{p.priority}</td>
                      <td className={tableCellClass}>{p.findings}</td>
                      <td className={tableCellClass}>{p.recordsAffected}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>

          {/* E) Grupos accionables */}
          <section className="mb-8 page-break-inside-avoid">
            <h3 className="text-lg font-bold mb-4 uppercase border-l-4 border-blue-900 pl-2">
              Grupos accionables
            </h3>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className={tableHeaderClass}>Grupo</th>
                  <th className={tableHeaderClass}>Hallazgos</th>
                  <th className={tableHeaderClass}>Registros</th>
                  <th className={tableHeaderClass}>Críticos</th>
                  <th className={tableHeaderClass}>Warn</th>
                  <th className={tableHeaderClass}>Info</th>
                </tr>
              </thead>
              <tbody>
                {v2.actionGroups.map((ag) => (
                  <tr key={ag.actionGroup}>
                    <td className={tableCellClass}>{ag.actionGroup}</td>
                    <td className={tableCellClass}>{ag.findings}</td>
                    <td className={tableCellClass}>{ag.recordsAffected}</td>
                    <td className={tableCellClass}>{ag.critical}</td>
                    <td className={tableCellClass}>{ag.warning}</td>
                    <td className={tableCellClass}>{ag.info}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* F) Cobertura por módulo */}
          <section className="mb-8 page-break-inside-avoid">
            <h3 className="text-lg font-bold mb-4 uppercase border-l-4 border-blue-900 pl-2">
              Cobertura por módulo
            </h3>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className={tableHeaderClass}>Módulo</th>
                  <th className={tableHeaderClass}>Detectado</th>
                  <th className={tableHeaderClass}>Analizado</th>
                  <th className={tableHeaderClass}>Hallazgos</th>
                  <th className={tableHeaderClass}>Registros hall.</th>
                </tr>
              </thead>
              <tbody>
                {v2.modulesCoverage.map((m) => (
                  <tr key={m.key}>
                    <td className={tableCellClass}>{m.label}</td>
                    <td className={tableCellClass}>{m.detectedInRecords}</td>
                    <td className={tableCellClass}>{m.analyzedInRecords}</td>
                    <td className={tableCellClass}>{m.findings}</td>
                    <td className={tableCellClass}>{m.recordsWithFindings}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* G) Performance del motor */}
          <section className="mb-8 page-break-inside-avoid">
            <h3 className="text-lg font-bold mb-4 uppercase border-l-4 border-blue-900 pl-2">
              Performance del motor
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <table className="border-collapse">
                <tbody>
                  <tr>
                    <td className={tableHeaderClass}>Registros con metadata</td>
                    <td className={tableCellClass}>{v2.performance.recordsWithMeta}</td>
                  </tr>
                  <tr>
                    <td className={tableHeaderClass}>Tiempo promedio</td>
                    <td className={tableCellClass}>{v2.performance.avgMs} ms</td>
                  </tr>
                  <tr>
                    <td className={tableHeaderClass}>Tiempo máximo</td>
                    <td className={tableCellClass}>{v2.performance.maxMs} ms</td>
                  </tr>
                  <tr>
                    <td className={tableHeaderClass}>Tiempo mínimo</td>
                    <td className={tableCellClass}>{v2.performance.minMs} ms</td>
                  </tr>
                </tbody>
              </table>
              <table className="border-collapse">
                <tbody>
                  <tr>
                    <td className={tableHeaderClass}>KB promedio entrada</td>
                    <td className={tableCellClass}>{v2.performance.avgInputKb} KB</td>
                  </tr>
                  <tr>
                    <td className={tableHeaderClass}>Hallazgos originales</td>
                    <td className={tableCellClass}>{v2.performance.totalFindingsOriginal}</td>
                  </tr>
                  <tr>
                    <td className={tableHeaderClass}>Hallazgos devueltos</td>
                    <td className={tableCellClass}>{v2.performance.totalFindingsReturned}</td>
                  </tr>
                  <tr>
                    <td className={tableHeaderClass}>Registros truncados</td>
                    <td className={tableCellClass}>{v2.performance.recordsWithTruncatedFindings}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* H) Top hallazgos */}
          <section className="mb-8 page-break-inside-avoid">
            <h3 className="text-lg font-bold mb-4 uppercase border-l-4 border-blue-900 pl-2">
              Top hallazgos (Max 15)
            </h3>
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr>
                  <th className={tableHeaderClass}>Código</th>
                  <th className={tableHeaderClass}>Título</th>
                  <th className={tableHeaderClass}>Sev</th>
                  <th className={tableHeaderClass}>Prio</th>
                  <th className={tableHeaderClass}>Apariciones</th>
                  <th className={tableHeaderClass}>Registros</th>
                </tr>
              </thead>
              <tbody>
                {v2.topFindingCodes.slice(0, 15).map((fc) => (
                  <tr key={fc.code}>
                    <td className={`${tableCellClass} font-mono`}>{fc.code}</td>
                    <td className={tableCellClass}>{fc.title}</td>
                    <td className={tableCellClass}>{fc.severityMax}</td>
                    <td className={tableCellClass}>{fc.priorityMax}</td>
                    <td className={tableCellClass}>{fc.count}</td>
                    <td className={tableCellClass}>{fc.recordsAffected}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* I) Top módulos */}
          <section className="mb-8 page-break-inside-avoid">
            <h3 className="text-lg font-bold mb-4 uppercase border-l-4 border-blue-900 pl-2">
              Top módulos por hallazgos (Max 10)
            </h3>
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className={tableHeaderClass}>Módulo</th>
                  <th className={tableHeaderClass}>Hallazgos</th>
                  <th className={tableHeaderClass}>Registros afectados</th>
                </tr>
              </thead>
              <tbody>
                {v2.topModulesByFindings.slice(0, 10).map((tm) => (
                  <tr key={tm.key}>
                    <td className={tableCellClass}>{tm.label}</td>
                    <td className={tableCellClass}>{tm.findings}</td>
                    <td className={tableCellClass}>{tm.recordsAffected}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}

      {/* J) Nota de seguridad */}
      <footer className="mt-12 pt-4 border-t border-gray-300 text-[10px] text-gray-500 text-center">
        <p>
          Este documento es confidencial y para uso exclusivo del administrador de FISCORA. No
          contiene datos sensibles de XML fuente, analysisJson completo, evidence completo, Addenda
          raw ni normalizedXml.content.
        </p>
      </footer>

      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .printable-admin-analytics-report, .printable-admin-analytics-report * {
            visibility: visible;
          }
          .printable-admin-analytics-report {
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
