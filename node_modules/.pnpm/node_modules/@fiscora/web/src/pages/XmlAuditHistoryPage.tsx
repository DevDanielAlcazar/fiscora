import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getXmlAuditHistory,
  getXmlAuditHistoryDetail,
  type XmlAuditHistoryResponse,
  type XmlAuditHistoryQuery,
  type XmlAuditHistoryDetail,
} from "../api/xml-audit";
import ActionableSummary from "./xml-audit/ActionableSummary";
import FindingExplorer from "./xml-audit/FindingExplorer";
import FindingGlossary from "./xml-audit/FindingGlossary";
import RemediationPlan from "./xml-audit/RemediationPlan";
import RiskScorePanel from "./xml-audit/RiskScorePanel";
import CoverageConfidencePanel from "./xml-audit/CoverageConfidencePanel";
import { exportXmlAuditHistoryCsv } from "./xml-audit-history/historyCsvExport";
import PrintableHistoryDetailReport from "./xml-audit-history/PrintableHistoryDetailReport";

export default function XmlAuditHistoryPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState<XmlAuditHistoryResponse | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<XmlAuditHistoryDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [printMode, setPrintMode] = useState(false);

  // Filters
  const [page, setPage] = useState(1);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sourceType, setSourceType] = useState("");
  const [analysisStatus, setAnalysisStatus] = useState("");
  const [riskLevel, setRiskLevel] = useState("");
  const [documentKind, setDocumentKind] = useState("");
  const [search, setSearch] = useState("");
  const [currentFilters, setCurrentFilters] = useState<XmlAuditHistoryQuery>({});

  async function fetchHistory(p = 1) {
    const token = localStorage.getItem("accessToken");
    if (!token) {
      navigate("/login");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const query: XmlAuditHistoryQuery = {
        page: p,
        pageSize: 20,
      };
      if (from) query.from = from;
      if (to) query.to = to;
      if (sourceType) query.sourceType = sourceType;
      if (analysisStatus) query.analysisStatus = analysisStatus;
      if (riskLevel) query.riskLevel = riskLevel;
      if (documentKind) query.documentKind = documentKind;
      if (search) query.search = search;

      setCurrentFilters(query);
      const res = await getXmlAuditHistory(token, query);
      setData(res);
      setPage(p);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar historial");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchHistory();
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

  async function handleViewDetail(id: string) {
    const token = localStorage.getItem("accessToken");
    if (!token) return;
    setSelectedId(id);
    setLoadingDetail(true);
    setDetail(null);
    try {
      const res = await getXmlAuditHistoryDetail(token, id);
      setDetail(res);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al cargar detalle");
      setSelectedId(null);
    } finally {
      setLoadingDetail(false);
    }
  }

  function handleExportCsv() {
    if (data) {
      exportXmlAuditHistoryCsv(data, currentFilters);
    }
  }

  function handlePrintDetail() {
    setPrintMode(true);
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    fetchHistory(1);
  }

  function handleClear() {
    setFrom("");
    setTo("");
    setSourceType("");
    setAnalysisStatus("");
    setRiskLevel("");
    setDocumentKind("");
    setSearch("");
    fetchHistory(1);
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

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col">
      <div className="max-w-7xl mx-auto px-4 py-8 w-full flex-1 flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Historial reciente de análisis XML</h1>
            <p className="text-sm text-gray-400 mt-1">
              Los análisis se conservan temporalmente por 24 horas. No se almacena XML fuente.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => navigate("/modules/xml-audit/dashboard")}
              className="px-4 py-2 rounded-lg bg-gray-800 text-gray-300 text-sm font-semibold hover:bg-gray-700 transition-all flex items-center gap-2"
            >
              Ver dashboard
            </button>
            <button
              onClick={() => navigate("/modules/xml-audit/history/batches")}
              className="px-4 py-2 rounded-lg bg-gray-800 text-gray-300 text-sm font-semibold hover:bg-gray-700 transition-all flex items-center gap-2"
            >
              Ver lotes ZIP recientes
            </button>
            <button
              onClick={() => navigate("/modules/xml-audit")}
              className="px-4 py-2 rounded-lg bg-gray-800 text-gray-300 text-sm font-semibold hover:bg-gray-700 transition-all flex items-center gap-2"
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
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
              Nueva auditoría
            </button>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-900/20 border border-red-900/50 rounded-xl text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="flex gap-2">
          {data && data.items.length > 0 && (
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
              Exportar historial CSV
            </button>
          )}
        </div>

        {/* Filters */}
        <form
          onSubmit={handleSearch}
          className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 grid grid-cols-1 md:grid-cols-4 gap-4"
        >
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 uppercase">Desde / Hasta</label>
            <div className="flex gap-2">
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm"
              />
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 uppercase">Filtros</label>
            <div className="flex gap-2">
              <select
                value={sourceType}
                onChange={(e) => setSourceType(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm"
              >
                <option value="">Tipo: Todos</option>
                <option value="INDIVIDUAL">Individual</option>
                <option value="ZIP">ZIP</option>
              </select>
              <select
                value={riskLevel}
                onChange={(e) => setRiskLevel(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm"
              >
                <option value="">Riesgo: Todos</option>
                <option value="OK">OK</option>
                <option value="WARNING">Warning</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 uppercase">Tipo Documento</label>
            <select
              value={documentKind}
              onChange={(e) => setDocumentKind(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm"
            >
              <option value="">Todos</option>
              <option value="CFDI">CFDI</option>
              <option value="RETENCIONES">Retenciones</option>
              <option value="UNKNOWN">Desconocido</option>
            </select>
          </div>
          <div className="space-y-1 flex flex-col justify-end">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Buscar RFC, UUID, Folio..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm"
              />
              <button
                type="submit"
                className="px-4 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-bold hover:bg-primary/90 transition-all"
              >
                Buscar
              </button>
              <button
                type="button"
                onClick={handleClear}
                className="px-4 py-1.5 bg-gray-800 text-gray-300 rounded-lg text-sm font-bold hover:bg-gray-700 transition-all"
              >
                Limpiar
              </button>
            </div>
          </div>
        </form>

        {/* History Table */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-gray-800/50 border-b border-gray-800 text-gray-400 font-medium">
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Fuente</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Riesgo</th>
                  <th className="px-4 py-3">RFC Emisor</th>
                  <th className="px-4 py-3">RFC Receptor</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3 text-right">Hallazgos</th>
                  <th className="px-4 py-3 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={9} className="px-4 py-4 h-12 bg-gray-800/20" />
                    </tr>
                  ))
                ) : data?.items.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-gray-500 italic">
                      No hay análisis recientes con los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  data?.items.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-800/30 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap text-gray-300">
                        {formatDate(item.createdAt)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${item.sourceType === "ZIP" ? "bg-purple-900/40 text-purple-300" : "bg-blue-900/40 text-blue-300"}`}
                        >
                          {item.sourceType}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-300">
                        {item.documentKind}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {item.analysisStatus === "FAILED" ? (
                          <span className="text-red-400 font-bold">ERROR</span>
                        ) : (
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              item.riskLevel === "CRITICAL"
                                ? "bg-red-900/40 text-red-300"
                                : item.riskLevel === "WARNING"
                                  ? "bg-yellow-900/40 text-yellow-300"
                                  : "bg-green-900/40 text-green-300"
                            }`}
                          >
                            {item.riskLevel || "OK"}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap font-mono text-xs text-gray-400">
                        {item.rfcEmisor || "—"}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap font-mono text-xs text-gray-400">
                        {item.rfcReceptor || "—"}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-300">
                        {item.total ? `$${item.total} ${item.moneda || ""}` : "—"}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        <div className="flex flex-col items-end gap-1">
                          <span className="font-bold text-gray-200">{item.findingsCount}</span>
                          <RiskScorePanel
                            approximateCounts={{
                              criticalCount: item.criticalCount,
                              warningCount: item.warningCount,
                              infoCount: item.infoCount,
                              priorityMax: item.priorityMax,
                            }}
                            compact
                          />
                          <div className="flex gap-1">
                            {item.criticalCount > 0 && (
                              <span
                                className="w-1.5 h-1.5 rounded-full bg-red-500"
                                title="Críticos"
                              />
                            )}
                            {item.warningCount > 0 && (
                              <span
                                className="w-1.5 h-1.5 rounded-full bg-yellow-500"
                                title="Advertencias"
                              />
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        <button
                          onClick={() => handleViewDetail(item.id)}
                          className="text-primary hover:underline font-semibold"
                        >
                          Ver detalle
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {data && data.pagination.totalPages > 1 && (
            <div className="bg-gray-800/30 px-4 py-3 flex items-center justify-between border-t border-gray-800">
              <p className="text-xs text-gray-400">
                Mostrando {data.items.length} de {data.pagination.total} registros
              </p>
              <div className="flex gap-2">
                <button
                  disabled={page === 1}
                  onClick={() => fetchHistory(page - 1)}
                  className="px-3 py-1 bg-gray-800 rounded text-xs font-bold disabled:opacity-50"
                >
                  Anterior
                </button>
                <span className="text-xs font-bold flex items-center px-2">
                  Página {page} de {data.pagination.totalPages}
                </span>
                <button
                  disabled={page === data.pagination.totalPages}
                  onClick={() => fetchHistory(page + 1)}
                  className="px-3 py-1 bg-gray-800 rounded text-xs font-bold disabled:opacity-50"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Detail Modal */}
      {selectedId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-4 border-b border-gray-800 flex items-center justify-between bg-gray-800/30">
              <h2 className="font-bold text-lg">Detalle del análisis</h2>
              <button
                onClick={() => setSelectedId(null)}
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
              {loadingDetail ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <p className="text-gray-400 text-sm">Cargando detalle...</p>
                </div>
              ) : detail ? (
                <>
                  {/* Metadata Header */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-4">
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-gray-500 uppercase">
                          UUID / Archivo
                        </p>
                        <p className="text-sm font-mono text-gray-300 break-all">
                          {detail.uuid || detail.sourceFilename || "—"}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-gray-500 uppercase">
                          Estado / Riesgo
                        </p>
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${detail.analysisStatus === "ANALYZED" ? "bg-green-900/40 text-green-300" : "bg-red-900/40 text-red-300"}`}
                          >
                            {detail.analysisStatus}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              detail.riskLevel === "CRITICAL"
                                ? "bg-red-900/40 text-red-300"
                                : detail.riskLevel === "WARNING"
                                  ? "bg-yellow-900/40 text-yellow-300"
                                  : "bg-green-900/40 text-green-300"
                            }`}
                          >
                            {detail.riskLevel || "OK"}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-gray-500 uppercase">Emisor</p>
                        <p className="text-sm font-semibold text-gray-200">
                          {detail.nombreEmisor || "—"}
                        </p>
                        <p className="text-xs font-mono text-gray-400">{detail.rfcEmisor || "—"}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-gray-500 uppercase">Receptor</p>
                        <p className="text-sm font-semibold text-gray-200">
                          {detail.nombreReceptor || "—"}
                        </p>
                        <p className="text-xs font-mono text-gray-400">
                          {detail.rfcReceptor || "—"}
                        </p>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-gray-500 uppercase">
                          Fecha / Total
                        </p>
                        <p className="text-sm text-gray-200">{detail.fecha || "—"}</p>
                        <p className="text-lg font-bold text-primary">
                          {detail.total ? `$${detail.total} ${detail.moneda || ""}` : "—"}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-gray-500 uppercase">Expiración</p>
                        <p className="text-xs text-orange-400 italic">
                          Expira el {formatDate(detail.expiresAt)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Summary & Findings */}
                  {detail.analysisJson?.executiveSummary && (
                    <div
                      className={`p-4 rounded-xl border ${
                        detail.riskLevel === "CRITICAL"
                          ? "bg-red-900/10 border-red-900/50"
                          : detail.riskLevel === "WARNING"
                            ? "bg-yellow-900/10 border-yellow-900/50"
                            : "bg-green-900/10 border-green-900/50"
                      }`}
                    >
                      <h3 className="font-bold text-sm uppercase tracking-wide mb-1">
                        {detail.analysisJson.executiveSummary.title}
                      </h3>
                      <p className="text-sm text-gray-300">
                        {detail.analysisJson.executiveSummary.message}
                      </p>
                    </div>
                  )}

                  {detail.analysisStatus === "FAILED" && (
                    <div className="p-4 rounded-xl bg-red-900/10 border border-red-900/50">
                      <h3 className="font-bold text-sm uppercase text-red-400 mb-1">
                        Error de análisis
                      </h3>
                      <p className="text-sm text-gray-300 font-mono">
                        {detail.errorCode}: {detail.errorMessage}
                      </p>
                    </div>
                  )}

                  {detail.analysisJson?.findings && detail.analysisJson.findings.length > 0 && (
                    <>
                      <ActionableSummary findings={detail.analysisJson.findings} />
                      <RiskScorePanel findings={detail.analysisJson.findings} />
                      <CoverageConfidencePanel result={detail.analysisJson} />
                      <FindingExplorer findings={detail.analysisJson.findings} compact />
                      <RemediationPlan findings={detail.analysisJson.findings} compact />
                      <FindingGlossary findings={detail.analysisJson.findings} compact />
                    </>
                  )}

                  {!detail.analysisJson?.findings?.length &&
                    detail.analysisStatus === "ANALYZED" && (
                      <p className="text-center text-sm text-gray-500 italic py-10">
                        No se detectaron hallazgos estructurados para este análisis.
                      </p>
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

            <div className="p-4 border-t border-gray-800 flex justify-end gap-2 bg-gray-800/30">
              {detail && (
                <button
                  onClick={handlePrintDetail}
                  className="px-4 py-2 rounded-lg bg-blue-700 text-white font-bold text-sm hover:bg-blue-600 transition-all flex items-center gap-2"
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
                  Imprimir detalle / Guardar PDF
                </button>
              )}
              <button
                onClick={() => setSelectedId(null)}
                className="px-6 py-2 rounded-lg bg-gray-800 text-gray-300 font-bold text-sm hover:bg-gray-700 transition-all"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {detail && <PrintableHistoryDetailReport detail={detail} />}
    </div>
  );
}
