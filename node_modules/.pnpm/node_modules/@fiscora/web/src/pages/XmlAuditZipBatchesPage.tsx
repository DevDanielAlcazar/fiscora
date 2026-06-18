import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getXmlAuditZipBatches,
  getXmlAuditZipBatchDetail,
  getXmlAuditHistoryDetail,
  type XmlAuditZipBatchesResponse,
  type XmlAuditZipBatchesQuery,
  type XmlAuditZipBatchDetail,
} from "../api/xml-audit";
import ActionableSummary from "./xml-audit/ActionableSummary";
import FindingGlossary from "./xml-audit/FindingGlossary";
import {
  exportXmlAuditZipBatchesCsv,
  exportXmlAuditZipBatchDetailCsv,
} from "./xml-audit-batches/zipBatchesCsvExport";
import PrintableZipBatchReport from "./xml-audit-batches/PrintableZipBatchReport";

export default function XmlAuditZipBatchesPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState<XmlAuditZipBatchesResponse | null>(null);
  const [printMode, setPrintMode] = useState(false);

  // Filters
  const [page, setPage] = useState(1);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [zipFilename, setZipFilename] = useState("");
  const [batchId, setBatchId] = useState("");
  const [hasFailed, setHasFailed] = useState("");
  const [hasCritical, setHasCritical] = useState("");
  const [documentKind, setDocumentKind] = useState("");
  const [search, setSearch] = useState("");
  const [currentFilters, setCurrentFilters] = useState<XmlAuditZipBatchesQuery>({});

  // Batch Detail State
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [batchDetail, setBatchDetail] = useState<XmlAuditZipBatchDetail | null>(null);
  const [loadingBatchDetail, setLoadingBatchDetail] = useState(false);

  // Individual Record Detail State
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [recordDetail, setRecordDetail] = useState<any | null>(null);
  const [loadingRecordDetail, setLoadingRecordDetail] = useState(false);

  async function fetchBatches(p = 1) {
    const token = localStorage.getItem("accessToken");
    if (!token) {
      navigate("/login");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const query: XmlAuditZipBatchesQuery = {
        page: p,
        pageSize: 20,
      };
      if (from) query.from = from;
      if (to) query.to = to;
      if (zipFilename) query.zipFilename = zipFilename;
      if (batchId) query.batchId = batchId;
      if (hasFailed) query.hasFailed = hasFailed;
      if (hasCritical) query.hasCritical = hasCritical;
      if (documentKind) query.documentKind = documentKind;
      if (search) query.search = search;

      setCurrentFilters(query);
      const res = await getXmlAuditZipBatches(token, query);
      setData(res);
      setPage(p);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar lotes ZIP");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchBatches();
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

  async function handleViewBatch(bid: string) {
    const token = localStorage.getItem("accessToken");
    if (!token) return;
    setSelectedBatchId(bid);
    setLoadingBatchDetail(true);
    setBatchDetail(null);
    try {
      const res = await getXmlAuditZipBatchDetail(token, bid);
      setBatchDetail(res);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al cargar detalle del lote");
      setSelectedBatchId(null);
    } finally {
      setLoadingBatchDetail(false);
    }
  }

  async function handleViewRecord(rid: string) {
    const token = localStorage.getItem("accessToken");
    if (!token) return;
    setSelectedRecordId(rid);
    setLoadingRecordDetail(true);
    setRecordDetail(null);
    try {
      const res = await getXmlAuditHistoryDetail(token, rid);
      setRecordDetail(res);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al cargar detalle del análisis");
      setSelectedRecordId(null);
    } finally {
      setLoadingRecordDetail(false);
    }
  }

  function handleExportBatchesCsv() {
    if (data) {
      exportXmlAuditZipBatchesCsv(data, currentFilters);
    }
  }

  function handleExportBatchDetailCsv() {
    if (batchDetail) {
      exportXmlAuditZipBatchDetailCsv(batchDetail);
    }
  }

  function handlePrintBatch() {
    setPrintMode(true);
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    fetchBatches(1);
  }

  function handleClear() {
    setFrom("");
    setTo("");
    setZipFilename("");
    setBatchId("");
    setHasFailed("");
    setHasCritical("");
    setDocumentKind("");
    setSearch("");
    fetchBatches(1);
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
            <h1 className="text-2xl font-bold">Lotes ZIP recientes</h1>
            <p className="text-sm text-gray-400 mt-1">
              Consulta ZIPs analizados temporalmente durante las últimas 24 horas. No se almacena
              XML fuente.
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
              onClick={() => navigate("/modules/xml-audit/history")}
              className="px-4 py-2 rounded-lg bg-gray-800 text-gray-300 text-sm font-semibold hover:bg-gray-700 transition-all flex items-center gap-2"
            >
              Ver historial individual
            </button>
            <button
              onClick={() => navigate("/modules/xml-audit")}
              className="px-4 py-2 rounded-lg bg-gray-800 text-gray-300 text-sm font-semibold hover:bg-gray-700 transition-all flex items-center gap-2"
            >
              Nueva auditoría
            </button>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-900/20 border border-red-900/50 rounded-xl text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="flex gap-2 print:hidden">
          {data && data.items.length > 0 && (
            <button
              onClick={handleExportBatchesCsv}
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
              Exportar lotes CSV
            </button>
          )}
        </div>

        {/* Filters */}
        <form
          onSubmit={handleSearch}
          className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 space-y-4"
        >
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
              <label className="text-xs font-bold text-gray-500 uppercase">Filtros de Estado</label>
              <div className="flex gap-2">
                <select
                  value={hasFailed}
                  onChange={(e) => setHasFailed(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm"
                >
                  <option value="">Fallidos: Todos</option>
                  <option value="true">Sí</option>
                  <option value="false">No</option>
                </select>
                <select
                  value={hasCritical}
                  onChange={(e) => setHasCritical(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm"
                >
                  <option value="">Críticos: Todos</option>
                  <option value="true">Sí</option>
                  <option value="false">No</option>
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
                  placeholder="Buscar ZIP o Batch ID..."
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
          </div>
        </form>

        {/* Batches Table */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-gray-800/50 border-b border-gray-800 text-gray-400 font-medium">
                  <th className="px-4 py-3">Fecha Inicio</th>
                  <th className="px-4 py-3">ZIP</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-right text-green-400">OK</th>
                  <th className="px-4 py-3 text-right text-yellow-400">Warn</th>
                  <th className="px-4 py-3 text-right text-red-400">Crit/Err</th>
                  <th className="px-4 py-3">Prio Máx</th>
                  <th className="px-4 py-3">Doc Principal</th>
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
                      No hay lotes ZIP recientes con los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  data?.items.map((item) => (
                    <tr key={item.batchId} className="hover:bg-gray-800/30 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap text-gray-300">
                        {formatDate(item.createdAtFirst)}
                      </td>
                      <td className="px-4 py-3 max-w-[200px] truncate" title={item.zipFilename}>
                        <span className="font-semibold">{item.zipFilename}</span>
                        <span className="block text-[10px] text-gray-500 font-mono">
                          {item.batchId.slice(0, 8)}...
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-gray-300">
                        {item.totalRecords}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-green-400">
                        {item.okCount}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-yellow-400">
                        {item.warningCount}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-red-400">
                        {item.failedCount + item.criticalCount}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            item.priorityMax === "BLOCKER"
                              ? "bg-red-900/40 text-red-300"
                              : item.priorityMax === "HIGH"
                                ? "bg-orange-900/40 text-orange-300"
                                : item.priorityMax === "MEDIUM"
                                  ? "bg-yellow-900/40 text-yellow-300"
                                  : "bg-blue-900/40 text-blue-300"
                          }`}
                        >
                          {item.priorityMax || "LOW"}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-400 text-xs">
                        {item.documentKinds.sort((a, b) => b.count - a.count)[0]?.documentKind ||
                          "—"}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        <button
                          onClick={() => handleViewBatch(item.batchId)}
                          className="text-primary hover:underline font-semibold"
                        >
                          Ver lote
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
                Mostrando {data.items.length} de {data.pagination.total} lotes
              </p>
              <div className="flex gap-2">
                <button
                  disabled={page === 1}
                  onClick={() => fetchBatches(page - 1)}
                  className="px-3 py-1 bg-gray-800 rounded text-xs font-bold disabled:opacity-50"
                >
                  Anterior
                </button>
                <span className="text-xs font-bold flex items-center px-2">
                  Página {page} de {data.pagination.totalPages}
                </span>
                <button
                  disabled={page === data.pagination.totalPages}
                  onClick={() => fetchBatches(page + 1)}
                  className="px-3 py-1 bg-gray-800 rounded text-xs font-bold disabled:opacity-50"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Batch Detail Modal */}
      {selectedBatchId && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-4 border-b border-gray-800 flex items-center justify-between bg-gray-800/30">
              <div>
                <h2 className="font-bold text-lg">Detalle del Lote ZIP</h2>
                <p className="text-xs text-gray-400 font-mono">{selectedBatchId}</p>
              </div>
              <button
                onClick={() => setSelectedBatchId(null)}
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

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {loadingBatchDetail ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <p className="text-gray-400 text-sm">Cargando registros del lote...</p>
                </div>
              ) : batchDetail ? (
                <>
                  {/* Summary Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div className="bg-gray-800/40 p-3 rounded-xl border border-gray-700">
                      <span className="block text-[10px] text-gray-500 font-bold uppercase">
                        Total XML
                      </span>
                      <span className="text-xl font-bold">
                        {batchDetail.batch.summary.totalRecords}
                      </span>
                    </div>
                    <div className="bg-gray-800/40 p-3 rounded-xl border border-gray-700">
                      <span className="block text-[10px] text-green-500/70 font-bold uppercase">
                        OK / Analizados
                      </span>
                      <span className="text-xl font-bold text-green-400">
                        {batchDetail.batch.summary.okCount} /{" "}
                        {batchDetail.batch.summary.analyzedCount}
                      </span>
                    </div>
                    <div className="bg-gray-800/40 p-3 rounded-xl border border-gray-700">
                      <span className="block text-[10px] text-yellow-500/70 font-bold uppercase">
                        Advertencias
                      </span>
                      <span className="text-xl font-bold text-yellow-400">
                        {batchDetail.batch.summary.warningCount}
                      </span>
                    </div>
                    <div className="bg-gray-800/40 p-3 rounded-xl border border-gray-700">
                      <span className="block text-[10px] text-red-500/70 font-bold uppercase">
                        Críticos / Fallas
                      </span>
                      <span className="text-xl font-bold text-red-400">
                        {batchDetail.batch.summary.criticalCount} /{" "}
                        {batchDetail.batch.summary.failedCount}
                      </span>
                    </div>
                    <div className="bg-gray-800/40 p-3 rounded-xl border border-gray-700">
                      <span className="block text-[10px] text-blue-500/70 font-bold uppercase">
                        Normalizados
                      </span>
                      <span className="text-xl font-bold text-blue-400">
                        {batchDetail.batch.summary.recordsWithNormalizedXml}
                      </span>
                    </div>
                  </div>

                  <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-gray-800/50 border-b border-gray-800 text-gray-400 font-medium">
                          <th className="px-4 py-2">#</th>
                          <th className="px-4 py-2">Entrada ZIP</th>
                          <th className="px-4 py-2">Estado</th>
                          <th className="px-4 py-2">Doc</th>
                          <th className="px-4 py-2">Riesgo</th>
                          <th className="px-4 py-2">RFC Emisor / Receptor</th>
                          <th className="px-4 py-2 text-right">Total</th>
                          <th className="px-4 py-2 text-right">Hall.</th>
                          <th className="px-4 py-2 text-center">Detalle</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800">
                        {batchDetail.records.map((rec) => (
                          <tr key={rec.id} className="hover:bg-gray-800/30 transition-colors">
                            <td className="px-4 py-2 text-gray-500">{rec.zipEntryIndex}</td>
                            <td
                              className="px-4 py-2 truncate max-w-[150px]"
                              title={rec.zipEntryName || ""}
                            >
                              {rec.zipEntryName}
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap">
                              {rec.analysisStatus === "FAILED" ? (
                                <span className="text-red-400 font-bold">ERROR</span>
                              ) : (
                                <span className="text-green-400 font-bold uppercase text-[10px]">
                                  OK
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap text-gray-400">
                              {rec.documentKind}
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap">
                              {rec.analysisStatus === "ANALYZED" && (
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                    rec.riskLevel === "CRITICAL"
                                      ? "bg-red-900/40 text-red-300"
                                      : rec.riskLevel === "WARNING"
                                        ? "bg-yellow-900/40 text-yellow-300"
                                        : "bg-green-900/40 text-green-300"
                                  }`}
                                >
                                  {rec.riskLevel || "OK"}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap font-mono text-[10px] text-gray-500">
                              {rec.rfcEmisor || "—"} <br /> {rec.rfcReceptor || "—"}
                            </td>
                            <td className="px-4 py-2 text-right text-gray-300">
                              {rec.total ? `$${rec.total}` : "—"}
                            </td>
                            <td className="px-4 py-2 text-right font-bold">{rec.findingsCount}</td>
                            <td className="px-4 py-2 text-center">
                              <button
                                onClick={() => handleViewRecord(rec.id)}
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
                </>
              ) : null}
            </div>

            <div className="p-4 border-t border-gray-800 flex justify-end gap-2 bg-gray-800/30">
              {batchDetail && (
                <>
                  <button
                    onClick={handleExportBatchDetailCsv}
                    className="px-4 py-2 rounded-lg bg-emerald-700 text-white font-bold text-sm hover:bg-emerald-600 transition-all flex items-center gap-2"
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
                    Exportar lote CSV
                  </button>
                  <button
                    onClick={handlePrintBatch}
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
                    Imprimir lote / Guardar PDF
                  </button>
                </>
              )}
              <button
                onClick={() => setSelectedBatchId(null)}
                className="px-6 py-2 rounded-lg bg-gray-800 text-gray-300 font-bold text-sm hover:bg-gray-700 transition-all"
              >
                Cerrar lote
              </button>
            </div>
          </div>
        </div>
      )}

      {batchDetail && <PrintableZipBatchReport detail={batchDetail} />}

      {/* Record Detail Modal (Reusing History Detail UI logic) */}
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
                  {/* Metadata Header */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-4">
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-gray-500 uppercase">
                          UUID / Entrada
                        </p>
                        <p className="text-sm font-mono text-gray-300 break-all">
                          {recordDetail.uuid || recordDetail.zipEntryName || "—"}
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

                  {/* Summary & Findings */}
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

                  {recordDetail.analysisStatus === "FAILED" && (
                    <div className="p-4 rounded-xl bg-red-900/10 border border-red-900/50">
                      <h3 className="font-bold text-sm uppercase text-red-400 mb-1">
                        Error de análisis
                      </h3>
                      <p className="text-sm text-gray-300 font-mono">
                        {recordDetail.errorCode}: {recordDetail.errorMessage}
                      </p>
                    </div>
                  )}

                  {recordDetail.analysisJson?.findings &&
                    recordDetail.analysisJson.findings.length > 0 && (
                      <>
                        <ActionableSummary findings={recordDetail.analysisJson.findings} />
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
