import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getXmlAnalyticsSummary,
  type XmlAnalyticsSummary,
  type XmlAnalyticsQuery,
} from "../api/admin";

export default function AdminAnalyticsPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState<XmlAnalyticsSummary | null>(null);

  const [fFrom, setFFrom] = useState("");
  const [fTo, setFTo] = useState("");
  const [fSourceType, setFSourceType] = useState("");
  const [fAnalysisStatus, setFAnalysisStatus] = useState("");

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
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Analítica XML</h1>
            <p className="text-sm text-gray-400 mt-1">
              {data?.range.from && data?.range.to
                ? `Datos del ${formatDate(data.range.from)} al ${formatDate(data.range.to)}`
                : "No hay datos disponibles"}
            </p>
          </div>
          <button
            onClick={() => navigate("/admin/xml-analyses")}
            className="px-4 py-2 rounded-lg bg-gray-800 text-gray-300 text-sm font-semibold hover:bg-gray-700 transition-all"
          >
            Ver análisis XML
          </button>
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
    </div>
  );
}
