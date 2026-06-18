import type { XmlAuditHistoryDetail } from "../../api/xml-audit";
import { getPriorityLabel } from "../xml-audit/findingPriority";
import {
  buildFindingGlossary,
  getSeverityLabel,
  getCategoryLabel,
} from "../xml-audit/findingGlossary.helpers";
import { buildRemediationPlan } from "../xml-audit/remediationPlan.helpers";

interface Props {
  detail: XmlAuditHistoryDetail;
}

export default function PrintableHistoryDetailReport({ detail }: Props) {
  const analysis = detail.analysisJson;

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
    <div className="printable-history-detail-report hidden print:block bg-white text-black p-8 font-sans">
      {/* A) Encabezado */}
      <div className="flex justify-between items-start mb-8 border-b-2 border-gray-800 pb-4">
        <div>
          <h1 className="text-4xl font-black tracking-tighter text-blue-900">FISCORA</h1>
          <h2 className="text-xl font-bold text-gray-600 uppercase">
            Reporte de análisis XML histórico
          </h2>
        </div>
        <div className="text-right text-sm">
          <p>
            <strong>Fecha de generación:</strong> {new Date().toLocaleString("es-MX")}
          </p>
          <p>
            <strong>ID Registro:</strong> {detail.id}
          </p>
        </div>
      </div>

      <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg text-sm italic text-gray-600">
        Este reporte se genera a partir del historial temporal sanitizado. No incluye XML fuente ni
        contenido normalizado.
      </div>

      {/* B) Metadata del registro */}
      <section className="mb-8">
        <h3 className="text-lg font-bold mb-4 uppercase border-l-4 border-blue-900 pl-2">
          Información del registro
        </h3>
        <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
          <div className="flex justify-between border-b border-gray-100 py-1">
            <span className="font-bold text-gray-500 uppercase text-[10px]">Fecha análisis</span>
            <span>{formatDate(detail.createdAt)}</span>
          </div>
          <div className="flex justify-between border-b border-gray-100 py-1">
            <span className="font-bold text-gray-500 uppercase text-[10px]">Expira</span>
            <span className="text-orange-700 font-semibold">{formatDate(detail.expiresAt)}</span>
          </div>
          <div className="flex justify-between border-b border-gray-100 py-1">
            <span className="font-bold text-gray-500 uppercase text-[10px]">Fuente / Archivo</span>
            <span>
              {detail.sourceType} / {detail.sourceFilename}
            </span>
          </div>
          <div className="flex justify-between border-b border-gray-100 py-1">
            <span className="font-bold text-gray-500 uppercase text-[10px]">UUID</span>
            <span className="font-mono">{detail.uuid || "—"}</span>
          </div>
          <div className="flex justify-between border-b border-gray-100 py-1">
            <span className="font-bold text-gray-500 uppercase text-[10px]">Estado / Riesgo</span>
            <span className="font-bold">
              {detail.analysisStatus} / {detail.riskLevel || "OK"}
            </span>
          </div>
          <div className="flex justify-between border-b border-gray-100 py-1">
            <span className="font-bold text-gray-500 uppercase text-[10px]">Tipo comprobante</span>
            <span>
              {detail.documentKind} ({detail.tipoComprobante})
            </span>
          </div>
          <div className="flex justify-between border-b border-gray-100 py-1">
            <span className="font-bold text-gray-500 uppercase text-[10px]">Emisor RFC</span>
            <span className="font-mono">{detail.rfcEmisor || "—"}</span>
          </div>
          <div className="flex justify-between border-b border-gray-100 py-1">
            <span className="font-bold text-gray-500 uppercase text-[10px]">Emisor Nombre</span>
            <span>{detail.nombreEmisor || "—"}</span>
          </div>
          <div className="flex justify-between border-b border-gray-100 py-1">
            <span className="font-bold text-gray-500 uppercase text-[10px]">Receptor RFC</span>
            <span className="font-mono">{detail.rfcReceptor || "—"}</span>
          </div>
          <div className="flex justify-between border-b border-gray-100 py-1">
            <span className="font-bold text-gray-500 uppercase text-[10px]">Receptor Nombre</span>
            <span>{detail.nombreReceptor || "—"}</span>
          </div>
          <div className="flex justify-between border-b border-gray-100 py-1">
            <span className="font-bold text-gray-500 uppercase text-[10px]">Total</span>
            <span className="text-blue-900 font-bold">
              {detail.total ? `$${detail.total} ${detail.moneda || ""}` : "—"}
            </span>
          </div>
          <div className="flex justify-between border-b border-gray-100 py-1">
            <span className="font-bold text-gray-500 uppercase text-[10px]">Prioridad Máxima</span>
            <span className="font-bold">{detail.priorityMax || "LOW"}</span>
          </div>
        </div>
      </section>

      {/* C) Resumen ejecutivo */}
      <section className="mb-8 page-break-inside-avoid">
        <h3 className="text-lg font-bold mb-4 uppercase border-l-4 border-blue-900 pl-2">
          Resumen ejecutivo
        </h3>
        {analysis.executiveSummary ? (
          <div className="bg-gray-50 p-4 border border-gray-200 rounded-xl">
            <h4 className="font-bold text-blue-900 mb-1">{analysis.executiveSummary.title}</h4>
            <p className="text-sm text-gray-700 leading-relaxed">{analysis.executiveSummary.message}</p>
            <p className="mt-2 text-xs font-bold text-gray-500 uppercase tracking-tighter">Acción recomendada:</p>
            <p className="text-sm text-gray-700">{analysis.executiveSummary.recommendedAction}</p>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-4">
            <div className="border border-gray-200 p-3 rounded text-center">
              <span className="block text-[10px] uppercase text-gray-500 font-bold">Hallazgos</span>
              <span className="text-xl font-bold">{detail.findingsCount}</span>
            </div>
            <div className="border border-gray-200 p-3 rounded text-center">
              <span className="block text-[10px] uppercase text-gray-500 font-bold">Críticos</span>
              <span className="text-xl font-bold text-red-700">{detail.criticalCount}</span>
            </div>
            <div className="border border-gray-200 p-3 rounded text-center">
              <span className="block text-[10px] uppercase text-gray-500 font-bold">Warnings</span>
              <span className="text-xl font-bold text-yellow-700">{detail.warningCount}</span>
            </div>
            <div className="border border-gray-200 p-3 rounded text-center">
              <span className="block text-[10px] uppercase text-gray-500 font-bold">Info</span>
              <span className="text-xl font-bold text-blue-700">{detail.infoCount}</span>
            </div>
          </div>
        )}
      </section>

      {/* D) Metadata del análisis */}
      {analysis.analysisMeta && (
        <section className="mb-8 page-break-inside-avoid">
          <h3 className="text-lg font-bold mb-4 uppercase border-l-4 border-blue-900 pl-2">
            Metadata del motor
          </h3>
          <div className="grid grid-cols-4 gap-4 text-xs">
            <div>
              <p className="font-bold text-gray-500 uppercase text-[9px]">Engine Version</p>
              <p>{analysis.analysisMeta.engineVersion}</p>
            </div>
            <div>
              <p className="font-bold text-gray-500 uppercase text-[9px]">Tiempo total</p>
              <p>{analysis.analysisMeta.performance.totalMs} ms</p>
            </div>
            <div>
              <p className="font-bold text-gray-500 uppercase text-[9px]">Tamaño entrada</p>
              <p>{analysis.analysisMeta.performance.inputKb.toFixed(2)} KB</p>
            </div>
            <div>
              <p className="font-bold text-gray-500 uppercase text-[9px]">Sanitizado</p>
              <p>{analysis.analysisMeta.performance.sanitized ? "SÍ" : "NO"}</p>
            </div>
          </div>
        </section>
      )}

      {/* E) Cobertura del análisis */}
      {analysis.analysisMeta?.coverage && (
        <section className="mb-8 page-break-inside-avoid">
          <h3 className="text-lg font-bold mb-4 uppercase border-l-4 border-blue-900 pl-2">
            Cobertura por módulo
          </h3>
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                <th className={tableHeaderClass}>Módulo</th>
                <th className={tableHeaderClass}>Detectado</th>
                <th className={tableHeaderClass}>Analizado</th>
                <th className={tableHeaderClass}>Hallazgos</th>
                <th className={tableHeaderClass}>Motivo omisión</th>
              </tr>
            </thead>
            <tbody>
              {analysis.analysisMeta.coverage.modules.map((m) => (
                <tr key={m.key}>
                  <td className={tableCellClass}>{m.label}</td>
                  <td className={`${tableCellClass} text-center`}>{m.detected ? "SÍ" : "NO"}</td>
                  <td className={`${tableCellClass} text-center`}>{m.analyzed ? "SÍ" : "NO"}</td>
                  <td className={`${tableCellClass} text-center font-bold`}>{m.findingsCount}</td>
                  <td className={`${tableCellClass} italic text-gray-500`}>
                    {m.skippedReason || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* F) Hallazgos accionables */}
      {analysis.findings && analysis.findings.length > 0 && (
        <section className="mb-8 page-break-inside-avoid">
          <h3 className="text-lg font-bold mb-4 uppercase border-l-4 border-blue-900 pl-2">
            Hallazgos detectados
          </h3>
          <table className="w-full border-collapse text-[10px]">
            <thead>
              <tr>
                <th className={tableHeaderClass}>Prio</th>
                <th className={tableHeaderClass}>Sev</th>
                <th className={tableHeaderClass}>Cat</th>
                <th className={tableHeaderClass}>Código</th>
                <th className={tableHeaderClass}>Título</th>
                <th className={tableHeaderClass}>Acción recomendada</th>
              </tr>
            </thead>
            <tbody>
              {analysis.findings.slice(0, 50).map((f) => (
                <tr key={f.id}>
                  <td className={`${tableCellClass} font-bold`}>
                    {getPriorityLabel(f.priority || "LOW").slice(0, 4)}
                  </td>
                  <td className={tableCellClass}>{getSeverityLabel(f.severity).slice(0, 4)}</td>
                  <td className={tableCellClass}>{getCategoryLabel(f.category).slice(0, 4)}</td>
                  <td className={`${tableCellClass} font-mono font-bold text-blue-900`}>{f.code}</td>
                  <td className={tableCellClass}>{f.title}</td>
                  <td className={tableCellClass}>{f.recommendedAction || "Revisar contexto."}</td>
                </tr>
              ))}
              {analysis.findings.length > 50 && (
                <tr>
                  <td colSpan={6} className={`${tableCellClass} text-center italic text-gray-500`}>
                    ... mostrando primeros 50 de {analysis.findings.length} hallazgos. Ver glosario para resumen completo.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      )}

      {/* F2) Plan de acción */}
      {analysis.findings && analysis.findings.length > 0 && (
        <section className="mb-8 page-break-inside-avoid">
          <h3 className="text-lg font-bold mb-4 uppercase border-l-4 border-blue-900 pl-2">
            Plan de acción sugerido (Top 10)
          </h3>
          <table className="w-full border-collapse text-[9px]">
            <thead>
              <tr>
                <th className={tableHeaderClass}>Código</th>
                <th className={tableHeaderClass}>Urgencia</th>
                <th className={tableHeaderClass}>Responsable</th>
                <th className={tableHeaderClass}>Acción recomendada</th>
              </tr>
            </thead>
            <tbody>
              {buildRemediationPlan(analysis.findings).items.slice(0, 10).map((item) => (
                <tr key={item.code} style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td className={`${tableCellClass} font-mono font-bold`}>{item.code}</td>
                  <td className={tableCellClass}>{item.urgency}</td>
                  <td className={tableCellClass}>{item.ownerSuggestion}</td>
                  <td className={tableCellClass}>{item.recommendedAction}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* G) Glosario de hallazgos */}
      {analysis.findings && analysis.findings.length > 0 && (
        <section className="mb-8 page-break-inside-avoid">
          <h3 className="text-lg font-bold mb-4 uppercase border-l-4 border-blue-900 pl-2">
            Glosario de códigos detectados
          </h3>
          <table className="w-full border-collapse text-[10px]">
            <thead>
              <tr>
                <th className={tableHeaderClass}>Código</th>
                <th className={tableHeaderClass}>Título</th>
                <th className={tableHeaderClass}>Sev. Máx</th>
                <th className={tableHeaderClass}>Ocurr.</th>
                <th className={tableHeaderClass}>Acción recomendada</th>
              </tr>
            </thead>
            <tbody>
              {buildFindingGlossary(analysis.findings).map((e) => (
                <tr key={e.code}>
                  <td className={`${tableCellClass} font-mono font-bold`}>{e.code}</td>
                  <td className={tableCellClass}>{e.title}</td>
                  <td className={tableCellClass}>{getSeverityLabel(e.severity)}</td>
                  <td className={`${tableCellClass} text-center`}>{e.occurrences}</td>
                  <td className={tableCellClass}>{e.recommendedAction || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* H) Nota de seguridad */}
      <footer className="mt-12 pt-4 border-t border-gray-300 text-[10px] text-gray-500 text-center">
        <p>
          Este documento es confidencial y para uso exclusivo del usuario. No contiene datos
          sensibles de XML fuente, Addenda raw ni normalizedXml.content. Los datos provienen del
          historial temporal sanitizado de FISCORA.
        </p>
      </footer>

      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .printable-history-detail-report, .printable-history-detail-report * {
            visibility: visible;
          }
          .printable-history-detail-report {
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
