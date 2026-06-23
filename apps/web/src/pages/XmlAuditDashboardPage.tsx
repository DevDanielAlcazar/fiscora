import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getXmlAuditHistorySummary,
  getXmlAuditHistoryDetail,
  type XmlAuditHistorySummary,
  type XmlAuditHistorySummaryQuery,
} from "../api/xml-audit";
import ActionableSummary from "./xml-audit/ActionableSummary";
import FindingGlossary from "./xml-audit/FindingGlossary";
import RiskScorePanel from "./xml-audit/RiskScorePanel";
import { exportXmlAuditDashboardCsv } from "./xml-audit-dashboard/dashboardCsvExport";
import PrintableXmlAuditDashboardReport from "./xml-audit-dashboard/PrintableXmlAuditDashboardReport";

export default function XmlAuditDashboardPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState<XmlAuditHistorySummary | null>(null);
  const [printMode, setPrintMode] = useState(false);

  // Filters
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sourceType, setSourceType] = useState("");
  const [analysisStatus, setAnalysisStatus] = useState("");
  const [currentFilters, setCurrentFilters] = useState<XmlAuditHistorySummaryQuery>({});

  // Record Detail Modal
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [recordDetail, setRecordDetail] = useState<any | null>(null);
  const [loadingRecordDetail, setLoadingRecordDetail] = useState(false);

  async function fetchSummary() {
    const token = localStorage.getItem("accessToken");
    if (!token) {
      navigate("/login");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const query: XmlAuditHistorySummaryQuery = {};
      if (from) query.from = from;
      if (to) query.to = to;
      if (sourceType) query.sourceType = sourceType;
      if (analysisStatus) query.analysisStatus = analysisStatus;

      setCurrentFilters(query);
      const res = await getXmlAuditHistorySummary(token, query);
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar dashboard");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchSummary();
  }, []);

  useEffect(() => {
    if (!printMode) return;
    const timer = setTimeout(() => {
      window.print();
    }, 100);
    const onAfterPrint = () => setPrintMode(false);
    window.addEventListener("afterprint", onAfterPrint);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("afterprint", onAfterPrint);
    };
  }, [printMode]);

  async function handleViewRecord(id: string) {
    const token = localStorage.getItem("accessToken");
    if (!token) return;
    setSelectedRecordId(id);
    setLoadingRecordDetail(true);
    setRecordDetail(null);
    try {
      const res = await getXmlAuditHistoryDetail(token, id);
      setRecordDetail(res);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al cargar detalle");
      setSelectedRecordId(null);
    } finally {
      setLoadingRecordDetail(false);
    }
  }

  function handleExportCsv() {
    if (data) {
      exportXmlAuditDashboardCsv(data, currentFilters);
    }
  }

  function handlePrint() {
    setPrintMode(true);
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    fetchSummary();
  }

  function handleClear() {
    setFrom("");
    setTo("");
    setSourceType("");
    setAnalysisStatus("");
    fetchSummary();
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleString("es-MX", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-gray-950 text-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Generando resumen...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col">
      <div className="max-w-7xl mx-auto px-4 py-8 w-full flex-1 flex flex-col gap-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Dashboard Auditoría XML</h1>
            <p className="text-sm text-gray-400 mt-1">
              Resumen de análisis recientes (últimas 24 horas). No se almacena XML fuente.
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
                  Exportar dashboard CSV
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
                  Imprimir dashboard / Guardar PDF
                </button>
              </>
            )}
            <button
              onClick={() => navigate("/modules/xml-audit")}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-all flex items-center gap-2"
            >
              Nuevo análisis
            </button>
            <button
              onClick={() => navigate("/dashboard")}
              className="px-4 py-2 rounded-lg bg-gray-800 text-gray-300 text-sm font-semibold hover:bg-gray-700 transition-all"
            >
              Dashboard General
            </button>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-900/20 border border-red-900/50 rounded-xl text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Filters */}
        <form
          onSubmit={handleSearch}
          className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 grid grid-cols-1 md:grid-cols-5 gap-4 items-end"
        >
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-tighter">
              Desde
            </label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-tighter">
              Hasta
            </label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-tighter">
              Fuente
            </label>
            <select
              value={sourceType}
              onChange={(e) => setSourceType(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm"
            >
              <option value="">Todas</option>
              <option value="INDIVIDUAL">Individual</option>
              <option value="ZIP">ZIP</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-tighter">
              Estado
            </label>
            <select
              value={analysisStatus}
              onChange={(e) => setAnalysisStatus(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm"
            >
              <option value="">Todos</option>
              <option value="ANALYZED">Analizados</option>
              <option value="FAILED">Fallidos</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="flex-1 px-4 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-bold hover:bg-primary/90 transition-all"
            >
              Filtrar
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="px-4 py-1.5 bg-gray-800 text-gray-300 rounded-lg text-sm font-bold hover:bg-gray-700 transition-all"
            >
              Limpiar
            </button>
          </div>
        </form>

        {data && data.totals.records === 0 ? (
          <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-12 text-center flex flex-col items-center gap-6">
            <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-8 w-8 text-gray-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold mb-2">No hay análisis recientes</h2>
              <p className="text-gray-400 max-w-sm mx-auto">
                No se encontraron registros en la ventana seleccionada. Inicia una nueva auditoría
                para comenzar.
              </p>
            </div>
            <div className="flex gap-4">
              <button
                onClick={() => navigate("/modules/xml-audit")}
                className="px-6 py-2 bg-primary text-primary-foreground rounded-lg font-bold hover:bg-primary/90 transition-all"
              >
                Analizar XML
              </button>
              <button
                onClick={() => navigate("/modules/xml-audit")}
                className="px-6 py-2 bg-gray-800 text-gray-300 rounded-lg font-bold hover:bg-gray-700 transition-all"
              >
                Analizar ZIP
              </button>
            </div>
          </div>
        ) : (
          data && (
            <div className="space-y-8 animate-in fade-in duration-500">
              {/* A) Main Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                <div className="bg-gray-800/40 p-4 rounded-xl border border-gray-800">
                  <span className="block text-[10px] text-gray-500 font-bold uppercase mb-1">
                    Total Análisis
                  </span>
                  <span className="text-2xl font-bold text-gray-100">{data.totals.records}</span>
                </div>
                <div className="bg-gray-800/40 p-4 rounded-xl border border-gray-800">
                  <span className="block text-[10px] text-green-500 font-bold uppercase mb-1">
                    OK
                  </span>
                  <span className="text-2xl font-bold text-green-400">{data.totals.ok}</span>
                </div>
                <div className="bg-gray-800/40 p-4 rounded-xl border border-gray-800">
                  <span className="block text-[10px] text-yellow-500 font-bold uppercase mb-1">
                    Advertencias
                  </span>
                  <span className="text-2xl font-bold text-yellow-400">{data.totals.warning}</span>
                </div>
                <div className="bg-gray-800/40 p-4 rounded-xl border border-gray-800">
                  <span className="block text-[10px] text-red-500 font-bold uppercase mb-1">
                    Críticos
                  </span>
                  <span className="text-2xl font-bold text-red-400">
                    {data.totals.critical + data.totals.failed}
                  </span>
                </div>
                <div className="bg-gray-800/40 p-4 rounded-xl border border-gray-800">
                  <span className="block text-[10px] text-blue-500 font-bold uppercase mb-1">
                    Lotes ZIP
                  </span>
                  <span className="text-2xl font-bold text-blue-400">{data.totals.batches}</span>
                </div>
                <div className="bg-gray-800/40 p-4 rounded-xl border border-gray-800">
                  <span className="block text-[10px] text-purple-500 font-bold uppercase mb-1">
                    Normalizados
                  </span>
                  <span className="text-2xl font-bold text-purple-400">
                    {data.totals.recordsWithNormalizedXml}
                  </span>
                </div>
              </div>

              {/* B) General Health */}
              <div
                className={`p-6 rounded-2xl border flex flex-col md:flex-row items-center gap-6 ${
                  data.totals.critical > 0 || data.totals.failed > 0
                    ? "bg-red-900/10 border-red-900/50"
                    : data.totals.warning > 0
                      ? "bg-yellow-900/10 border-yellow-900/50"
                      : "bg-green-900/10 border-green-900/50"
                }`}
              >
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${
                    data.totals.critical > 0 || data.totals.failed > 0
                      ? "bg-red-500 text-white"
                      : data.totals.warning > 0
                        ? "bg-yellow-500 text-black"
                        : "bg-green-500 text-white"
                  }`}
                >
                  {data.totals.critical > 0 || data.totals.failed > 0 ? (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-6 w-6"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={3}
                        d="M6 18L18 6M6 6l18 18"
                      />
                    </svg>
                  ) : data.totals.warning > 0 ? (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-6 w-6"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={3}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                      />
                    </svg>
                  ) : (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-6 w-6"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={3}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                </div>
                <div className="flex-1 text-center md:text-left">
                  <h2 className="text-xl font-bold uppercase tracking-tight">
                    {data.totals.critical > 0 || data.totals.failed > 0
                      ? "Atención Crítica"
                      : data.totals.warning > 0
                        ? "Revisión Recomendada"
                        : "Operación Estable"}
                  </h2>
                  <p className="text-sm text-gray-400 mt-1">
                    {data.totals.critical > 0 || data.totals.failed > 0
                      ? "Se han detectado riesgos de alta prioridad o fallas técnicas. Revisa los análisis críticos primero."
                      : data.totals.warning > 0
                        ? "Existen advertencias que requieren tu validación antes de procesar fiscalmente los comprobantes."
                        : "No se detectan riesgos altos en la ventana de retención seleccionada."}
                  </p>
                    <div className="mt-2">
                      <RiskScorePanel
                        approximateCounts={{
                          criticalCount: data.totals.criticalFindings ?? data.totals.critical,
                          warningCount: data.totals.warningFindings ?? data.totals.warning,
                          infoCount: data.totals.infoFindings ?? 0,
                          priorityMax: data.priorities?.[0]?.priority ?? null,
                        }}
                        compact
                      />
                    </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => navigate("/modules/xml-audit/history")}
                    className="px-6 py-2 bg-gray-800 text-white rounded-xl font-bold hover:bg-gray-700 transition-all text-sm whitespace-nowrap"
                  >
                    Ver Historial
                  </button>
                </div>
              </div>

              {/* Aggregates Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Prioridades */}
                <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6 flex flex-col gap-4">
                  <h3 className="font-bold text-sm uppercase text-gray-500">
                    Distribución de Prioridades
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="text-gray-500 border-b border-gray-800">
                          <th className="pb-2">Prioridad</th>
                          <th className="pb-2 text-right">Hallazgos</th>
                          <th className="pb-2 text-right">Registros</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800">
                        {data.priorities
                          .sort((a, b) => b.findings - a.findings)
                          .map((p) => (
                            <tr key={p.priority} className="hover:bg-gray-800/20">
                              <td className="py-2 flex items-center gap-2">
                                <span
                                  className={`w-2 h-2 rounded-full ${
                                    p.priority === "BLOCKER"
                                      ? "bg-red-500"
                                      : p.priority === "HIGH"
                                        ? "bg-orange-500"
                                        : p.priority === "MEDIUM"
                                          ? "bg-yellow-500"
                                          : "bg-blue-500"
                                  }`}
                                />
                                <span className="font-semibold text-xs">{p.priority}</span>
                              </td>
                              <td className="py-2 text-right font-mono text-xs">{p.findings}</td>
                              <td className="py-2 text-right font-bold text-xs">
                                {p.recordsAffected}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Document Kinds */}
                <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6 flex flex-col gap-4">
                  <h3 className="font-bold text-sm uppercase text-gray-500">Tipos de Documento</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="text-gray-500 border-b border-gray-800">
                          <th className="pb-2">Tipo</th>
                          <th className="pb-2 text-right">Cantidad</th>
                          <th className="pb-2 text-right">%</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800">
                        {data.documentKinds
                          .sort((a, b) => b.count - a.count)
                          .map((dk) => (
                            <tr key={dk.documentKind} className="hover:bg-gray-800/20">
                              <td className="py-2 text-xs font-semibold">{dk.documentKind}</td>
                              <td className="py-2 text-right font-bold text-xs">{dk.count}</td>
                              <td className="py-2 text-right text-gray-500 text-[10px]">
                                {((dk.count / data.totals.analyzed) * 100).toFixed(1)}%
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Top Findings */}
              <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6 space-y-4">
                <h3 className="font-bold text-sm uppercase text-gray-500">
                  Hallazgos más recurrentes
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="text-gray-500 border-b border-gray-800">
                        <th className="pb-2">Código</th>
                        <th className="pb-2">Título</th>
                        <th className="pb-2 text-right">Frecuencia</th>
                        <th className="pb-2 text-right">Afectación</th>
                        <th className="pb-2 text-center">Severidad</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {data.topFindingCodes.map((fc) => (
                        <tr key={fc.code} className="hover:bg-gray-800/20">
                          <td className="py-3 font-mono font-bold text-primary">{fc.code}</td>
                          <td className="py-3 max-w-xs truncate" title={fc.title}>
                            {fc.title}
                          </td>
                          <td className="py-3 text-right font-bold">{fc.count}</td>
                          <td className="py-3 text-right text-gray-400">
                            {fc.recordsAffected} recs
                          </td>
                          <td className="py-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-[4px] text-[9px] font-bold ${
                                fc.severityMax === "CRITICAL"
                                  ? "bg-red-900/30 text-red-400 border border-red-900/50"
                                  : fc.severityMax === "WARNING"
                                    ? "bg-yellow-900/30 text-yellow-400 border border-yellow-900/50"
                                    : "bg-blue-900/30 text-blue-400 border border-blue-900/50"
                              }`}
                            >
                              {fc.severityMax}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Recent Activity */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm uppercase text-gray-500">Actividad Reciente</h3>
                  <button
                    onClick={() => navigate("/modules/xml-audit/history")}
                    className="text-xs text-primary hover:underline font-bold"
                  >
                    Ver historial completo
                  </button>
                </div>
                <div className="bg-gray-900/50 border border-gray-800 rounded-2xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-gray-800/30 text-gray-400 border-b border-gray-800">
                        <th className="px-4 py-2">Fecha</th>
                        <th className="px-4 py-2">Fuente</th>
                        <th className="px-4 py-2">Estado</th>
                        <th className="px-4 py-2">Tipo</th>
                        <th className="px-4 py-2">RFCs Emisor/Receptor</th>
                        <th className="px-4 py-2 text-right">Hallazgos</th>
                        <th className="px-4 py-2 text-center">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {data.recentRecords.map((r) => (
                        <tr key={r.id} className="hover:bg-gray-800/20">
                          <td className="px-4 py-3 whitespace-nowrap text-gray-300">
                            {formatDate(r.createdAt)}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${r.sourceType === "ZIP" ? "bg-purple-900/40 text-purple-300" : "bg-blue-900/40 text-blue-300"}`}
                            >
                              {r.sourceType}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`font-bold ${r.analysisStatus === "FAILED" ? "text-red-500" : "text-green-500"}`}
                            >
                              {r.analysisStatus === "FAILED" ? "ERROR" : "OK"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-400">{r.documentKind}</td>
                          <td className="px-4 py-3">
                            <div className="font-mono text-[10px] text-gray-500">
                              {r.rfcEmisor || "—"} ➔ {r.rfcReceptor || "—"}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex flex-col items-end gap-0.5">
                              <span className="font-bold">{r.findingsCount}</span>
                              <div className="flex gap-0.5">
                                {r.criticalCount > 0 && (
                                  <span className="w-1 h-1 rounded-full bg-red-500" />
                                )}
                                {r.warningCount > 0 && (
                                  <span className="w-1 h-1 rounded-full bg-yellow-500" />
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => handleViewRecord(r.id)}
                              className="text-primary hover:underline font-bold"
                            >
                              Ver
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Quick Access */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pb-12">
                <button
                  onClick={() => navigate("/modules/xml-audit")}
                  className="p-4 bg-gray-900 border border-gray-800 rounded-2xl hover:border-primary transition-all group"
                >
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 4v16m8-8H4"
                        />
                      </svg>
                    </div>
                    <span className="font-bold text-sm">Nuevo análisis XML</span>
                  </div>
                </button>
                <button
                  onClick={() => navigate("/modules/xml-audit/history")}
                  className="p-4 bg-gray-900 border border-gray-800 rounded-2xl hover:border-primary transition-all group"
                >
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-10 h-10 bg-blue-500/10 rounded-full flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    </div>
                    <span className="font-bold text-sm">Historial reciente</span>
                  </div>
                </button>
                <button
                  onClick={() => navigate("/modules/xml-audit/history/batches")}
                  className="p-4 bg-gray-900 border border-gray-800 rounded-2xl hover:border-primary transition-all group"
                >
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-10 h-10 bg-purple-500/10 rounded-full flex items-center justify-center text-purple-500 group-hover:scale-110 transition-transform">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                        />
                      </svg>
                    </div>
                    <span className="font-bold text-sm">Lotes ZIP recientes</span>
                  </div>
                </button>
                <button
                  onClick={() => navigate("/modules/xml-audit/history")}
                  className="p-4 bg-gray-900 border border-gray-800 rounded-2xl hover:border-primary transition-all group"
                >
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-10 h-10 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-500 group-hover:scale-110 transition-transform">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                        />
                      </svg>
                    </div>
                    <span className="font-bold text-sm">Exportar desde historial</span>
                  </div>
                </button>
              </div>
            </div>
          )
        )}
      </div>

      {data && <PrintableXmlAuditDashboardReport summary={data} currentFilters={currentFilters} />}

      {/* Record Detail Modal */}
      {selectedRecordId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-4 border-b border-gray-800 flex items-center justify-between bg-gray-800/30">
              <h2 className="font-bold text-lg">Detalle del análisis</h2>
              <button
                onClick={() => setSelectedRecordId(null)}
                className="p-1 hover:bg-gray-700 rounded-lg transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l18 18"
                  />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              {loadingRecordDetail ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <p className="text-gray-400 text-sm">Cargando detalle...</p>
                </div>
              ) : recordDetail ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-4">
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-gray-500 uppercase">
                          UUID / Archivo
                        </p>
                        <p className="text-sm font-mono text-gray-300 break-all">
                          {recordDetail.uuid || recordDetail.sourceFilename || "—"}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-gray-500 uppercase">
                          Estado / Riesgo
                        </p>
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${recordDetail.analysisStatus === "ANALYZED" ? "bg-green-900/40 text-green-300" : "bg-red-900/40 text-red-300"}`}
                          >
                            {recordDetail.analysisStatus}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              recordDetail.riskLevel === "CRITICAL"
                                ? "bg-red-900/40 text-red-300"
                                : recordDetail.riskLevel === "WARNING"
                                  ? "bg-yellow-900/40 text-yellow-300"
                                  : "bg-green-900/40 text-green-300"
                            }`}
                          >
                            {recordDetail.riskLevel || "OK"}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-gray-500 uppercase">Emisor</p>
                        <p className="text-sm font-semibold text-gray-200">
                          {recordDetail.nombreEmisor || "—"}
                        </p>
                        <p className="text-xs font-mono text-gray-400">
                          {recordDetail.rfcEmisor || "—"}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-gray-500 uppercase">Receptor</p>
                        <p className="text-sm font-semibold text-gray-200">
                          {recordDetail.nombreReceptor || "—"}
                        </p>
                        <p className="text-xs font-mono text-gray-400">
                          {recordDetail.rfcReceptor || "—"}
                        </p>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-gray-500 uppercase">
                          Fecha / Total
                        </p>
                        <p className="text-sm text-gray-200">{recordDetail.fecha || "—"}</p>
                        <p className="text-lg font-bold text-primary">
                          {recordDetail.total
                            ? `$${recordDetail.total} ${recordDetail.moneda || ""}`
                            : "—"}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-gray-500 uppercase">Expiración</p>
                        <p className="text-xs text-orange-400 italic">
                          Expira el {formatDate(recordDetail.expiresAt)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {recordDetail.analysisJson?.executiveSummary && (
                    <div
                      className={`p-4 rounded-xl border ${
                        recordDetail.riskLevel === "CRITICAL"
                          ? "bg-red-900/10 border-red-900/50"
                          : recordDetail.riskLevel === "WARNING"
                            ? "bg-yellow-900/10 border-yellow-900/50"
                            : "bg-green-900/10 border-green-900/50"
                      }`}
                    >
                      <h3 className="font-bold text-sm uppercase tracking-wide mb-1">
                        {recordDetail.analysisJson.executiveSummary.title}
                      </h3>
                      <p className="text-sm text-gray-300">
                        {recordDetail.analysisJson.executiveSummary.message}
                      </p>
                    </div>
                  )}

                  {recordDetail.analysisJson?.findings &&
                    recordDetail.analysisJson.findings.length > 0 && (
                      <>
                        <ActionableSummary findings={recordDetail.analysisJson.findings} />
                        <RiskScorePanel findings={recordDetail.analysisJson.findings} />
                        <FindingGlossary findings={recordDetail.analysisJson.findings} compact />
                      </>
                    )}

                  <div className="p-4 bg-blue-900/10 border border-blue-900/30 rounded-xl text-xs text-blue-300/80">
                    <p className="font-bold mb-1">Nota de seguridad y retención:</p>
                    <p>
                      Este registro es una copia sanitizada del análisis realizado. El contenido XML
                      original y el contenido normalizado no se almacenan por políticas de seguridad
                      y privacidad.
                    </p>
                  </div>
                </>
              ) : null}
            </div>

            <div className="p-4 border-t border-gray-800 flex justify-end bg-gray-800/30">
              <button
                onClick={() => setSelectedRecordId(null)}
                className="px-6 py-2 rounded-lg bg-gray-800 text-gray-300 font-bold text-sm hover:bg-gray-700 transition-all"
              >
                Cerrar detalle
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
