import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getXmlAnalyticsSummary,
  type XmlAnalyticsSummary,
  type XmlAnalyticsQuery,
} from "../api/admin";
import { exportAdminAnalyticsCsv } from "./admin-analytics/adminAnalyticsCsv";
import PrintableAdminAnalyticsReport from "./admin-analytics/PrintableAdminAnalyticsReport";

export default function AdminAnalyticsPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState<XmlAnalyticsSummary | null>(null);

  const [fFrom, setFFrom] = useState("");
  const [fTo, setFTo] = useState("");
  const [fSourceType, setFSourceType] = useState("");
  const [fAnalysisStatus, setFAnalysisStatus] = useState("");
  const [currentFilters, setCurrentFilters] = useState<XmlAnalyticsQuery>({});

  async function fetchData() {
    const token = localStorage.getItem("accessToken");
    if (!token) {
      navigate("/login");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const query: XmlAnalyticsQuery = {};
      if (fFrom) query.from = fFrom;
      if (fTo) query.to = fTo;
      if (fSourceType) query.sourceType = fSourceType;
      if (fAnalysisStatus) query.analysisStatus = fAnalysisStatus;
      setCurrentFilters(query);
      const res = await getXmlAnalyticsSummary(token, query);
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar analítica");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  function handleSearch() {
    fetchData();
  }
  function handleClear() {
    setFFrom("");
    setFTo("");
    setFSourceType("");
    setFAnalysisStatus("");
    fetchData();
  }

  function handleExportCsv() {
    if (data) {
      exportAdminAnalyticsCsv(data, currentFilters);
    }
  }

  function handlePrint() {
    window.print();
  }

  function formatDate(dateStr: string) {
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

  function card(title: string, value: string | number, accent = "text-blue-400") {
    return (
      <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl p-4 flex flex-col">
        <span className="text-xs text-gray-400 uppercase tracking-wide mb-1">{title}</span>
        <span className={`text-2xl font-bold ${accent}`}>{value}</span>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 text-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Cargando analítica...</p>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="min-h-screen bg-gray-950 text-gray-100 flex items-center justify-center">
        <div className="text-center max-w-md">
          <p className="text-red-400 text-lg font-semibold mb-2">Error</p>
          <p className="text-gray-400 mb-6">{error}</p>
          <button
            onClick={() => fetchData()}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-all"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 print:bg-white print:text-black">
      <div className="max-w-7xl mx-auto px-4 py-6 print:hidden">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Analítica XML</h1>
            <p className="text-sm text-gray-400 mt-1">
              {data?.range.from && data?.range.to
                ? `Datos del ${formatDate(data.range.from)} al ${formatDate(data.range.to)}`
                : "No hay datos disponibles"}
            </p>
          </div>
          <div className="flex gap-2">
            {data && (
              <>
                <button
                  onClick={handleExportCsv}
                  className="px-4 py-2 rounded-lg bg-emerald-700 text-white text-sm font-semibold hover:bg-emerald-600 transition-all flex items-center gap-2"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  Exportar analytics CSV
                </button>
                <button
                  onClick={handlePrint}
                  className="px-4 py-2 rounded-lg bg-blue-700 text-white text-sm font-semibold hover:bg-blue-600 transition-all flex items-center gap-2"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
                    />
                  </svg>
                  Imprimir reporte / Guardar PDF
                </button>
              </>
            )}
            <button
              onClick={() => navigate("/admin/xml-analyses")}
              className="px-4 py-2 rounded-lg bg-gray-800 text-gray-300 text-sm font-semibold hover:bg-gray-700 transition-all"
            >
              Ver análisis XML
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-900/30 border border-red-800/50 text-red-300 text-sm">
            {error}
          </div>
        )}

        <div className="bg-gray-800/40 border border-gray-700/50 rounded-xl p-4 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Desde</label>
              <input
                type="datetime-local"
                value={fFrom}
                onChange={(e) => setFFrom(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Hasta</label>
              <input
                type="datetime-local"
                value={fTo}
                onChange={(e) => setFTo(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Source type</label>
              <select
                value={fSourceType}
                onChange={(e) => setFSourceType(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-primary"
              >
                <option value="">Todos</option>
                <option value="INDIVIDUAL">INDIVIDUAL</option>
                <option value="ZIP">ZIP</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Estado</label>
              <select
                value={fAnalysisStatus}
                onChange={(e) => setFAnalysisStatus(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-primary"
              >
                <option value="">Todos</option>
                <option value="ANALYZED">ANALYZED</option>
                <option value="FAILED">FAILED</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleSearch}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-all"
            >
              Buscar
            </button>
            <button
              onClick={handleClear}
              className="px-4 py-2 rounded-lg bg-gray-700 text-gray-300 text-sm font-semibold hover:bg-gray-600 transition-all"
            >
              Limpiar
            </button>
          </div>
        </div>

        {data && (
          <>
            <h2 className="text-lg font-semibold mb-3">Resumen</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8 gap-3 mb-6">
              {card("Total análisis", data.totals.records, "text-blue-400")}
              {card("Analizados", data.totals.analyzed, "text-green-400")}
              {card(
                "Fallidos",
                data.totals.failed,
                data.totals.failed > 0 ? "text-red-400" : "text-gray-300",
              )}
              {card("Individuales", data.totals.individual, "text-cyan-400")}
              {card("ZIP", data.totals.zip, "text-purple-400")}
              {card("Lotes ZIP", data.totals.uniqueBatches, "text-yellow-400")}
              {card("Usuarios", data.totals.uniqueUsers, "text-pink-400")}
              {card("Organizaciones", data.totals.uniqueOrganizations, "text-orange-400")}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <h2 className="text-lg font-semibold mb-3">Riesgo</h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {card(
                    "Críticos",
                    data.risk.critical,
                    data.risk.critical > 0 ? "text-red-400" : "text-gray-300",
                  )}
                  {card(
                    "Advertencias",
                    data.risk.warning,
                    data.risk.warning > 0 ? "text-yellow-400" : "text-gray-300",
                  )}
                  {card("OK", data.risk.ok, "text-green-400")}
                  {card("Sin riesgo", data.risk.nullRisk, "text-gray-400")}
                </div>
              </div>
              <div>
                <h2 className="text-lg font-semibold mb-3">Hallazgos</h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {card("Total", data.findings.total, "text-blue-400")}
                  {card(
                    "Críticos",
                    data.findings.critical,
                    data.findings.critical > 0 ? "text-red-400" : "text-gray-300",
                  )}
                  {card(
                    "Advertencias",
                    data.findings.warnings,
                    data.findings.warnings > 0 ? "text-yellow-400" : "text-gray-300",
                  )}
                  {card("Info", data.findings.info, "text-cyan-400")}
                </div>
              </div>
            </div>

            <h2 className="text-lg font-semibold mb-3">Técnico</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
              {card("XMLs con BOM", data.technical.withBom, "text-orange-400")}
              {card(
                "Normalización técnica",
                data.technical.withTechnicalNormalization,
                "text-blue-400",
              )}
              {card("Normalizados disponibles", data.technical.withNormalizedXml, "text-green-400")}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <div className="bg-gray-800/40 border border-gray-700/50 rounded-xl p-4">
                <h2 className="text-lg font-semibold mb-3">Tipos de comprobante</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-400 border-b border-gray-700/50">
                        <th className="pb-2 font-medium">Tipo</th>
                        <th className="pb-2 font-medium text-right">Cantidad</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.byTipoComprobante.length === 0 ? (
                        <tr>
                          <td colSpan={2} className="py-4 text-center text-gray-500">
                            Sin datos
                          </td>
                        </tr>
                      ) : (
                        data.byTipoComprobante.map((t) => (
                          <tr
                            key={t.tipoComprobante}
                            className="border-b border-gray-700/30 hover:bg-gray-700/20"
                          >
                            <td className="py-2">{t.tipoComprobante}</td>
                            <td className="py-2 text-right font-mono">{t.count}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-gray-800/40 border border-gray-700/50 rounded-xl p-4">
                <h2 className="text-lg font-semibold mb-3">Por fuente y estado</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-400 border-b border-gray-700/50">
                        <th className="pb-2 font-medium">Fuente</th>
                        <th className="pb-2 font-medium text-right">Cantidad</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.bySourceType.map((s) => (
                        <tr
                          key={s.sourceType}
                          className="border-b border-gray-700/30 hover:bg-gray-700/20"
                        >
                          <td className="py-2">{s.sourceType}</td>
                          <td className="py-2 text-right font-mono">{s.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <table className="w-full text-sm mt-4">
                    <thead>
                      <tr className="text-left text-gray-400 border-b border-gray-700/50">
                        <th className="pb-2 font-medium">Estado</th>
                        <th className="pb-2 font-medium text-right">Cantidad</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.byAnalysisStatus.map((s) => (
                        <tr
                          key={s.analysisStatus}
                          className="border-b border-gray-700/30 hover:bg-gray-700/20"
                        >
                          <td className="py-2">
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                                s.analysisStatus === "ANALYZED"
                                  ? "bg-green-900/50 text-green-300"
                                  : "bg-red-900/50 text-red-300"
                              }`}
                            >
                              {s.analysisStatus}
                            </span>
                          </td>
                          <td className="py-2 text-right font-mono">{s.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {data.analyticsV2 && (
              <>
                <h2 className="text-lg font-semibold mb-3 mt-8">Documentos analizados</h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                  {data.analyticsV2.documentKinds.length === 0 ? (
                    <div className="col-span-full text-center text-gray-500 py-4">
                      Sin información disponible
                    </div>
                  ) : (
                    data.analyticsV2.documentKinds.map((dk) => (
                      <div
                        key={dk.documentKind}
                        className="bg-gray-800/60 border border-gray-700/50 rounded-xl p-4 flex flex-col"
                      >
                        <span className="text-xs text-gray-400 uppercase tracking-wide mb-1">
                          {dk.documentKind === "CFDI"
                            ? "CFDI"
                            : dk.documentKind === "RETENCIONES"
                              ? "Retenciones"
                              : dk.documentKind === "UNKNOWN"
                                ? "Unknown"
                                : "Sin data"}
                        </span>
                        <span className="text-2xl font-bold text-blue-400">{dk.count}</span>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}

            {data.analyticsV2 && (
              <>
                <h2 className="text-lg font-semibold mb-3">Prioridades globales</h2>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
                  {data.analyticsV2.priorities.length === 0 ? (
                    <div className="col-span-full text-center text-gray-500 py-4">
                      Sin información disponible
                    </div>
                  ) : (
                    data.analyticsV2.priorities.map((p) => (
                      <div
                        key={p.priority}
                        className="bg-gray-800/60 border border-gray-700/50 rounded-xl p-4 flex flex-col"
                      >
                        <span className="text-xs text-gray-400 uppercase tracking-wide mb-1">
                          {p.priority === "BLOCKER"
                            ? "Bloqueantes"
                            : p.priority === "HIGH"
                              ? "Alta"
                              : p.priority === "MEDIUM"
                                ? "Media"
                                : p.priority === "LOW"
                                  ? "Informativa"
                                  : "Sin data"}
                        </span>
                        <span
                          className={`text-2xl font-bold ${
                            p.priority === "BLOCKER"
                              ? "text-red-400"
                              : p.priority === "HIGH"
                                ? "text-orange-400"
                                : p.priority === "MEDIUM"
                                  ? "text-yellow-400"
                                  : "text-gray-300"
                          }`}
                        >
                          {p.findings}
                        </span>
                        <span className="text-xs text-gray-500 mt-1">
                          {p.recordsAffected} registros
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}

            {data.analyticsV2 && data.analyticsV2.actionGroups.length > 0 && (
              <div className="mb-6">
                <h2 className="text-lg font-semibold mb-3">Grupos accionables</h2>
                <div className="bg-gray-800/40 border border-gray-700/50 rounded-xl p-4 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-400 border-b border-gray-700/50">
                        <th className="pb-2 font-medium">Grupo accionable</th>
                        <th className="pb-2 font-medium text-right">Hallazgos</th>
                        <th className="pb-2 font-medium text-right">Registros afectados</th>
                        <th className="pb-2 font-medium text-right">Críticos</th>
                        <th className="pb-2 font-medium text-right">Advertencias</th>
                        <th className="pb-2 font-medium text-right">Info</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.analyticsV2.actionGroups.map((ag) => (
                        <tr
                          key={ag.actionGroup}
                          className="border-b border-gray-700/30 hover:bg-gray-700/20"
                        >
                          <td className="py-2 max-w-[200px] truncate" title={ag.actionGroup}>
                            {ag.actionGroup}
                          </td>
                          <td className="py-2 text-right font-mono">{ag.findings}</td>
                          <td className="py-2 text-right font-mono">{ag.recordsAffected}</td>
                          <td className="py-2 text-right font-mono text-red-400">{ag.critical}</td>
                          <td className="py-2 text-right font-mono text-yellow-400">
                            {ag.warning}
                          </td>
                          <td className="py-2 text-right font-mono text-cyan-400">{ag.info}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {data.analyticsV2 && data.analyticsV2.modulesCoverage.length > 0 && (
              <div className="mb-6">
                <h2 className="text-lg font-semibold mb-3">Cobertura por módulo</h2>
                <div className="bg-gray-800/40 border border-gray-700/50 rounded-xl p-4 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-400 border-b border-gray-700/50">
                        <th className="pb-2 font-medium">Módulo</th>
                        <th className="pb-2 font-medium text-right">Detectado en registros</th>
                        <th className="pb-2 font-medium text-right">Analizado en registros</th>
                        <th className="pb-2 font-medium text-right">Hallazgos</th>
                        <th className="pb-2 font-medium text-right">Registros con hallazgos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.analyticsV2.modulesCoverage.map((m) => (
                        <tr
                          key={m.key}
                          className="border-b border-gray-700/30 hover:bg-gray-700/20"
                        >
                          <td className="py-2 max-w-[200px] truncate" title={m.label}>
                            {m.label}
                          </td>
                          <td className="py-2 text-right font-mono">{m.detectedInRecords}</td>
                          <td className="py-2 text-right font-mono">{m.analyzedInRecords}</td>
                          <td className="py-2 text-right font-mono">{m.findings}</td>
                          <td className="py-2 text-right font-mono">{m.recordsWithFindings}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {data.analyticsV2 && (
              <>
                <h2 className="text-lg font-semibold mb-3">Performance del motor</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 mb-6">
                  {card(
                    "Registros con metadata",
                    data.analyticsV2.performance.recordsWithMeta,
                    "text-blue-400",
                  )}
                  {card(
                    "Tiempo promedio",
                    `${data.analyticsV2.performance.avgMs} ms`,
                    "text-cyan-400",
                  )}
                  {card(
                    "Tiempo máximo",
                    `${data.analyticsV2.performance.maxMs} ms`,
                    "text-orange-400",
                  )}
                  {card(
                    "Tiempo mínimo",
                    `${data.analyticsV2.performance.minMs} ms`,
                    "text-green-400",
                  )}
                  {card(
                    "KB promedio",
                    `${data.analyticsV2.performance.avgInputKb} KB`,
                    "text-purple-400",
                  )}
                  {card(
                    "Hallazgos originales",
                    data.analyticsV2.performance.totalFindingsOriginal,
                    "text-yellow-400",
                  )}
                  {card(
                    "Hallazgos devueltos",
                    data.analyticsV2.performance.totalFindingsReturned,
                    "text-blue-400",
                  )}
                  {card(
                    "Registros truncados",
                    data.analyticsV2.performance.recordsWithTruncatedFindings,
                    data.analyticsV2.performance.recordsWithTruncatedFindings > 0
                      ? "text-red-400"
                      : "text-gray-300",
                  )}
                </div>
              </>
            )}

            {data.analyticsV2 && data.analyticsV2.topFindingCodes.length > 0 && (
              <div className="mb-6">
                <h2 className="text-lg font-semibold mb-3">Top hallazgos</h2>
                <div className="bg-gray-800/40 border border-gray-700/50 rounded-xl p-4 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-400 border-b border-gray-700/50">
                        <th className="pb-2 font-medium">Código</th>
                        <th className="pb-2 font-medium">Título</th>
                        <th className="pb-2 font-medium text-right">Severidad</th>
                        <th className="pb-2 font-medium text-right">Prioridad</th>
                        <th className="pb-2 font-medium">Grupo accionable</th>
                        <th className="pb-2 font-medium text-right">Apariciones</th>
                        <th className="pb-2 font-medium text-right">Registros afectados</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.analyticsV2.topFindingCodes.map((fc) => (
                        <tr
                          key={fc.code}
                          className="border-b border-gray-700/30 hover:bg-gray-700/20"
                        >
                          <td
                            className="py-2 font-mono text-xs max-w-[120px] truncate"
                            title={fc.code}
                          >
                            {fc.code}
                          </td>
                          <td className="py-2 max-w-[200px] truncate" title={fc.title}>
                            {fc.title}
                          </td>
                          <td
                            className={`py-2 text-right font-mono ${
                              fc.severityMax === "CRITICAL"
                                ? "text-red-400"
                                : fc.severityMax === "WARNING"
                                  ? "text-yellow-400"
                                  : "text-cyan-400"
                            }`}
                          >
                            {fc.severityMax}
                          </td>
                          <td
                            className={`py-2 text-right font-mono ${
                              fc.priorityMax === "BLOCKER"
                                ? "text-red-400"
                                : fc.priorityMax === "HIGH"
                                  ? "text-orange-400"
                                  : fc.priorityMax === "MEDIUM"
                                    ? "text-yellow-400"
                                    : "text-gray-300"
                            }`}
                          >
                            {fc.priorityMax}
                          </td>
                          <td className="py-2 max-w-[150px] truncate" title={fc.actionGroup ?? "—"}>
                            {fc.actionGroup ?? "—"}
                          </td>
                          <td className="py-2 text-right font-mono">{fc.count}</td>
                          <td className="py-2 text-right font-mono">{fc.recordsAffected}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {data.analyticsV2 && data.analyticsV2.topModulesByFindings.length > 0 && (
              <div className="mb-6">
                <h2 className="text-lg font-semibold mb-3">Top módulos por hallazgos</h2>
                <div className="bg-gray-800/40 border border-gray-700/50 rounded-xl p-4 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-400 border-b border-gray-700/50">
                        <th className="pb-2 font-medium">Módulo</th>
                        <th className="pb-2 font-medium text-right">Hallazgos</th>
                        <th className="pb-2 font-medium text-right">Registros afectados</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.analyticsV2.topModulesByFindings.map((tm) => (
                        <tr
                          key={tm.key}
                          className="border-b border-gray-700/30 hover:bg-gray-700/20"
                        >
                          <td className="py-2 max-w-[200px] truncate" title={tm.label}>
                            {tm.label}
                          </td>
                          <td className="py-2 text-right font-mono">{tm.findings}</td>
                          <td className="py-2 text-right font-mono">{tm.recordsAffected}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <h2 className="text-lg font-semibold mb-3">Top organizaciones</h2>
            <div className="bg-gray-800/40 border border-gray-700/50 rounded-xl p-4 mb-6 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-400 border-b border-gray-700/50">
                    <th className="pb-2 font-medium">Organización</th>
                    <th className="pb-2 font-medium text-right">Registros</th>
                    <th className="pb-2 font-medium text-right">Fallidos</th>
                    <th className="pb-2 font-medium text-right">Críticos</th>
                    <th className="pb-2 font-medium text-right">BOM</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topOrganizations.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-4 text-center text-gray-500">
                        Sin datos
                      </td>
                    </tr>
                  ) : (
                    data.topOrganizations.map((o) => (
                      <tr
                        key={o.organizationId}
                        className="border-b border-gray-700/30 hover:bg-gray-700/20"
                      >
                        <td className="py-2 max-w-[200px] truncate" title={o.organizationName}>
                          {o.organizationName}
                        </td>
                        <td className="py-2 text-right font-mono">{o.records}</td>
                        <td
                          className={`py-2 text-right font-mono ${o.failed > 0 ? "text-red-400" : ""}`}
                        >
                          {o.failed}
                        </td>
                        <td
                          className={`py-2 text-right font-mono ${o.critical > 0 ? "text-red-400" : ""}`}
                        >
                          {o.critical}
                        </td>
                        <td className="py-2 text-right font-mono">{o.withBom}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <h2 className="text-lg font-semibold mb-3">Top usuarios</h2>
            <div className="bg-gray-800/40 border border-gray-700/50 rounded-xl p-4 mb-6 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-400 border-b border-gray-700/50">
                    <th className="pb-2 font-medium">Usuario</th>
                    <th className="pb-2 font-medium text-right">Registros</th>
                    <th className="pb-2 font-medium text-right">Fallidos</th>
                    <th className="pb-2 font-medium text-right">Críticos</th>
                    <th className="pb-2 font-medium text-right">BOM</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topUsers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-4 text-center text-gray-500">
                        Sin datos
                      </td>
                    </tr>
                  ) : (
                    data.topUsers.map((u) => (
                      <tr
                        key={u.userId}
                        className="border-b border-gray-700/30 hover:bg-gray-700/20"
                      >
                        <td className="py-2 max-w-[200px] truncate" title={u.userEmail}>
                          {u.userEmail}
                        </td>
                        <td className="py-2 text-right font-mono">{u.records}</td>
                        <td
                          className={`py-2 text-right font-mono ${u.failed > 0 ? "text-red-400" : ""}`}
                        >
                          {u.failed}
                        </td>
                        <td
                          className={`py-2 text-right font-mono ${u.critical > 0 ? "text-red-400" : ""}`}
                        >
                          {u.critical}
                        </td>
                        <td className="py-2 text-right font-mono">{u.withBom}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <h2 className="text-lg font-semibold mb-3">
              Lotes recientes
              <button
                onClick={() => navigate("/admin/xml-analysis-batches")}
                className="ml-3 px-3 py-1 rounded-lg bg-gray-700 text-gray-300 text-xs font-semibold hover:bg-gray-600 transition-all align-middle"
              >
                Ver todos
              </button>
            </h2>
            <div className="bg-gray-800/40 border border-gray-700/50 rounded-xl p-4 mb-6 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-400 border-b border-gray-700/50">
                    <th className="pb-2 font-medium">Fecha</th>
                    <th className="pb-2 font-medium">ZIP</th>
                    <th className="pb-2 font-medium">Batch ID</th>
                    <th className="pb-2 font-medium">Organización</th>
                    <th className="pb-2 font-medium">Usuario</th>
                    <th className="pb-2 font-medium text-right">Total</th>
                    <th className="pb-2 font-medium text-right">Fallidos</th>
                    <th className="pb-2 font-medium text-right">Críticos</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentBatches.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-4 text-center text-gray-500">
                        Sin lotes recientes
                      </td>
                    </tr>
                  ) : (
                    data.recentBatches.map((b) => (
                      <tr
                        key={b.batchId}
                        className="border-b border-gray-700/30 hover:bg-gray-700/20"
                      >
                        <td className="py-2 whitespace-nowrap text-xs">
                          {formatDate(b.createdAt)}
                        </td>
                        <td className="py-2 max-w-[150px] truncate" title={b.zipFilename}>
                          {b.zipFilename}
                        </td>
                        <td
                          className="py-2 max-w-[120px] truncate font-mono text-xs"
                          title={b.batchId}
                        >
                          {b.batchId}
                        </td>
                        <td
                          className="py-2 max-w-[120px] truncate"
                          title={b.organizationName ?? "—"}
                        >
                          {b.organizationName ?? "—"}
                        </td>
                        <td className="py-2 max-w-[150px] truncate" title={b.userEmail}>
                          {b.userEmail}
                        </td>
                        <td className="py-2 text-right font-mono">{b.totalRecords}</td>
                        <td
                          className={`py-2 text-right font-mono ${b.failed > 0 ? "text-red-400" : ""}`}
                        >
                          {b.failed}
                        </td>
                        <td
                          className={`py-2 text-right font-mono ${b.critical > 0 ? "text-red-400" : ""}`}
                        >
                          {b.critical}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {data && <PrintableAdminAnalyticsReport summary={data} filters={currentFilters} />}
    </div>
  );
}
