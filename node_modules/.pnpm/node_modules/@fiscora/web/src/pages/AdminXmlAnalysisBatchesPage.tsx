import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getXmlAnalysisBatches,
  getXmlAnalysisBatchDetail,
  getXmlAnalysisDetail,
  exportXmlAnalysisBatches,
  exportXmlAnalysisBatchDetail,
  type XmlAnalysisBatchListItem,
  type XmlAnalysisBatchDetailRecord,
  type XmlAnalysisDetailResponse,
  type XmlAnalysisBatchQuery,
} from "../api/admin";

export default function AdminXmlAnalysisBatchesPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [items, setItems] = useState<XmlAnalysisBatchListItem[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const [detailBatchId, setDetailBatchId] = useState<string | null>(null);
  const [detail, setDetail] = useState<{
    batch: XmlAnalysisBatchListItem;
    records: XmlAnalysisBatchDetailRecord[];
  } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [recordDetailId, setRecordDetailId] = useState<string | null>(null);
  const [recordDetail, setRecordDetail] = useState<XmlAnalysisDetailResponse | null>(null);
  const [recordDetailLoading, setRecordDetailLoading] = useState(false);

  const [fBatchId, setFBatchId] = useState("");
  const [fZipFilename, setFZipFilename] = useState("");
  const [fUserEmail, setFUserEmail] = useState("");
  const [fOrgName, setFOrgName] = useState("");
  const [fHasFailed, setFHasFailed] = useState("");
  const [fHasCritical, setFHasCritical] = useState("");
  const [fFrom, setFFrom] = useState("");
  const [fTo, setFTo] = useState("");

  async function fetchData(p?: number) {
    const token = localStorage.getItem("accessToken");
    if (!token) {
      navigate("/login");
      return;
    }
    setLoading(true);
    setError("");
    setDetailBatchId(null);
    setDetail(null);
    setRecordDetailId(null);
    setRecordDetail(null);
    try {
      const res = await getXmlAnalysisBatches(token, {
        page: p ?? page,
        pageSize: 25,
        batchId: fBatchId || undefined,
        zipFilename: fZipFilename || undefined,
        userEmail: fUserEmail || undefined,
        organizationName: fOrgName || undefined,
        hasFailed: fHasFailed || undefined,
        hasCritical: fHasCritical || undefined,
        from: fFrom || undefined,
        to: fTo || undefined,
      });
      setItems(res.items);
      setTotal(res.pagination.total);
      setTotalPages(res.pagination.totalPages);
      setPage(res.pagination.page);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar datos");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData(1);
  }, []);

  function handleSearch() {
    fetchData(1);
  }
  function handleClear() {
    setFBatchId("");
    setFZipFilename("");
    setFUserEmail("");
    setFOrgName("");
    setFHasFailed("");
    setFHasCritical("");
    setFFrom("");
    setFTo("");
    fetchData(1);
  }

  async function handleExportCsv() {
    const token = localStorage.getItem("accessToken");
    if (!token) {
      navigate("/login");
      return;
    }
    try {
      const query: XmlAnalysisBatchQuery = {
        batchId: fBatchId || undefined,
        zipFilename: fZipFilename || undefined,
        userEmail: fUserEmail || undefined,
        organizationName: fOrgName || undefined,
        hasFailed: fHasFailed || undefined,
        hasCritical: fHasCritical || undefined,
        from: fFrom || undefined,
        to: fTo || undefined,
      };
      const blob = await exportXmlAnalysisBatches(token, query);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "fiscora-lotes-xml-zip.csv";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al exportar lotes CSV");
    }
  }

  async function handleExportBatchCsv() {
    if (!detailBatchId) return;
    const token = localStorage.getItem("accessToken");
    if (!token) {
      navigate("/login");
      return;
    }
    try {
      const blob = await exportXmlAnalysisBatchDetail(token, detailBatchId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `fiscora-lote-xml-zip-${detailBatchId}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al exportar lote CSV");
    }
  }

  async function handleDetail(batchId: string) {
    const token = localStorage.getItem("accessToken");
    if (!token) {
      navigate("/login");
      return;
    }
    if (detailBatchId === batchId) {
      setDetailBatchId(null);
      setDetail(null);
      return;
    }
    setDetailBatchId(batchId);
    setDetailLoading(true);
    setDetail(null);
    setRecordDetailId(null);
    setRecordDetail(null);
    try {
      const d = await getXmlAnalysisBatchDetail(token, batchId);
      setDetail(d);
    } catch {
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }

  async function handleRecordDetail(id: string) {
    const token = localStorage.getItem("accessToken");
    if (!token) {
      navigate("/login");
      return;
    }
    if (recordDetailId === id) {
      setRecordDetailId(null);
      setRecordDetail(null);
      return;
    }
    setRecordDetailId(id);
    setRecordDetailLoading(true);
    setRecordDetail(null);
    try {
      const d = await getXmlAnalysisDetail(token, id);
      setRecordDetail(d);
    } catch {
      setRecordDetail(null);
    } finally {
      setRecordDetailLoading(false);
    }
  }

  function fmt(d: string | null | undefined): string {
    if (!d) return "—";
    try {
      return new Date(d).toLocaleString("es-MX");
    } catch {
      return d;
    }
  }

  function riskColor(r: string | null): string {
    if (r === "CRITICAL") return "text-red-700 bg-red-50 border-red-200";
    if (r === "WARNING") return "text-yellow-700 bg-yellow-50 border-yellow-200";
    if (r === "OK") return "text-emerald-700 bg-emerald-50 border-emerald-200";
    return "text-muted-foreground bg-muted border-border";
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-extrabold tracking-tight">Lotes XML ZIP</h1>
          <button
            onClick={() => navigate("/dashboard")}
            className="text-sm text-muted-foreground hover:underline"
          >
            Volver al dashboard
          </button>
        </div>

        {error && (
          <p className="text-sm text-red-500 bg-red-500/10 rounded-lg px-4 py-3">{error}</p>
        )}

        <div className="p-4 rounded-xl border border-border bg-card space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <input
              placeholder="Batch ID"
              value={fBatchId}
              onChange={(e) => setFBatchId(e.target.value)}
              className="text-sm px-3 py-1.5 rounded border border-border bg-background text-foreground"
            />
            <input
              placeholder="ZIP filename"
              value={fZipFilename}
              onChange={(e) => setFZipFilename(e.target.value)}
              className="text-sm px-3 py-1.5 rounded border border-border bg-background text-foreground"
            />
            <input
              placeholder="Usuario email"
              value={fUserEmail}
              onChange={(e) => setFUserEmail(e.target.value)}
              className="text-sm px-3 py-1.5 rounded border border-border bg-background text-foreground"
            />
            <input
              placeholder="Organización"
              value={fOrgName}
              onChange={(e) => setFOrgName(e.target.value)}
              className="text-sm px-3 py-1.5 rounded border border-border bg-background text-foreground"
            />
            <select
              value={fHasFailed}
              onChange={(e) => setFHasFailed(e.target.value)}
              className="text-sm px-3 py-1.5 rounded border border-border bg-background text-foreground"
            >
              <option value="">Todos (fallidos)</option>
              <option value="true">Con fallidos</option>
            </select>
            <select
              value={fHasCritical}
              onChange={(e) => setFHasCritical(e.target.value)}
              className="text-sm px-3 py-1.5 rounded border border-border bg-background text-foreground"
            >
              <option value="">Todos (críticos)</option>
              <option value="true">Con críticos</option>
            </select>
            <input
              type="date"
              value={fFrom}
              onChange={(e) => setFFrom(e.target.value)}
              className="text-sm px-3 py-1.5 rounded border border-border bg-background text-foreground"
            />
            <input
              type="date"
              value={fTo}
              onChange={(e) => setFTo(e.target.value)}
              className="text-sm px-3 py-1.5 rounded border border-border bg-background text-foreground"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSearch}
              className="px-4 py-1.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-all"
            >
              Buscar
            </button>
            <button
              onClick={handleClear}
              className="px-4 py-1.5 rounded-lg border border-border text-foreground font-semibold text-sm hover:bg-muted transition-all"
            >
              Limpiar
            </button>
            <button
              onClick={handleExportCsv}
              className="px-4 py-1.5 rounded-lg border border-border text-foreground font-semibold text-sm hover:bg-muted transition-all ml-auto"
            >
              Exportar lotes CSV
            </button>
          </div>
        </div>

        <div className="text-xs text-muted-foreground">
          {total} lote{total !== 1 ? "s" : ""}
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Cargando...</p>
        ) : items.length === 0 ? (
          <div className="p-6 rounded-xl border border-border bg-card">
            <p className="text-sm text-muted-foreground">No hay lotes ZIP recientes.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-border/50 text-muted-foreground bg-muted/30">
                  <th className="text-left py-2 px-3 whitespace-nowrap">Fecha inicio</th>
                  <th className="text-left py-2 px-3 whitespace-nowrap">Expira</th>
                  <th className="text-left py-2 px-3 whitespace-nowrap">ZIP</th>
                  <th className="text-left py-2 px-3 whitespace-nowrap">Batch ID</th>
                  <th className="text-left py-2 px-3 whitespace-nowrap">Usuario</th>
                  <th className="text-left py-2 px-3 whitespace-nowrap">Organización</th>
                  <th className="text-center py-2 px-3 whitespace-nowrap">Total</th>
                  <th className="text-center py-2 px-3 whitespace-nowrap">Analizados</th>
                  <th className="text-center py-2 px-3 whitespace-nowrap">Fallidos</th>
                  <th className="text-center py-2 px-3 whitespace-nowrap">Crít</th>
                  <th className="text-center py-2 px-3 whitespace-nowrap">Adver</th>
                  <th className="text-center py-2 px-3 whitespace-nowrap">Info</th>
                  <th className="text-center py-2 px-3 whitespace-nowrap">OK</th>
                  <th className="text-center py-2 px-3 whitespace-nowrap">BOM</th>
                  <th className="text-center py-2 px-3 whitespace-nowrap">XML Norm</th>
                  <th className="text-center py-2 px-3 whitespace-nowrap"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((b) => (
                  <tr key={b.batchId} className="border-b border-border/30 hover:bg-muted/20">
                    <td className="py-1.5 px-3 whitespace-nowrap">{fmt(b.createdAtFirst)}</td>
                    <td className="py-1.5 px-3 whitespace-nowrap">{fmt(b.expiresAt)}</td>
                    <td
                      className="py-1.5 px-3 max-w-[150px] truncate font-mono"
                      title={b.zipFilename}
                    >
                      {b.zipFilename}
                    </td>
                    <td
                      className="py-1.5 px-3 max-w-[100px] truncate font-mono text-[9px]"
                      title={b.batchId}
                    >
                      {b.batchId}
                    </td>
                    <td className="py-1.5 px-3 max-w-[100px] truncate" title={b.userEmail}>
                      {b.userEmail}
                    </td>
                    <td
                      className="py-1.5 px-3 max-w-[100px] truncate"
                      title={b.organizationName ?? ""}
                    >
                      {b.organizationName ?? "—"}
                    </td>
                    <td className="py-1.5 px-3 text-center font-mono">{b.totalRecords}</td>
                    <td className="py-1.5 px-3 text-center font-mono">{b.analyzedCount}</td>
                    <td className="py-1.5 px-3 text-center font-mono">
                      {b.failedCount > 0 ? (
                        <span className="text-red-600">{b.failedCount}</span>
                      ) : (
                        b.failedCount
                      )}
                    </td>
                    <td className="py-1.5 px-3 text-center font-mono">
                      {b.criticalCount > 0 ? (
                        <span className="text-red-600">{b.criticalCount}</span>
                      ) : (
                        b.criticalCount
                      )}
                    </td>
                    <td className="py-1.5 px-3 text-center font-mono">
                      {b.warningCount > 0 ? (
                        <span className="text-yellow-600">{b.warningCount}</span>
                      ) : (
                        b.warningCount
                      )}
                    </td>
                    <td className="py-1.5 px-3 text-center font-mono">{b.infoCount}</td>
                    <td className="py-1.5 px-3 text-center font-mono">{b.okCount}</td>
                    <td className="py-1.5 px-3 text-center">{b.recordsWithBom > 0 ? "Sí" : "—"}</td>
                    <td className="py-1.5 px-3 text-center">
                      {b.recordsWithNormalizedXml > 0 ? "Sí" : "—"}
                    </td>
                    <td className="py-1.5 px-3 text-center">
                      <button
                        onClick={() => handleDetail(b.batchId)}
                        className="text-primary font-semibold hover:underline"
                      >
                        {detailBatchId === b.batchId ? "Ocultar" : "Ver lote"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Página {page} de {totalPages} ({total} lotes)
            </span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => fetchData(page - 1)}
                className="px-3 py-1.5 rounded-lg border border-border text-foreground font-semibold text-xs hover:bg-muted disabled:opacity-30 transition-all"
              >
                Anterior
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => fetchData(page + 1)}
                className="px-3 py-1.5 rounded-lg border border-border text-foreground font-semibold text-xs hover:bg-muted disabled:opacity-30 transition-all"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}

        {detailBatchId && (
          <div className="p-4 rounded-xl border border-border bg-card space-y-3">
            {detailLoading ? (
              <p className="text-sm text-muted-foreground">Cargando detalle del lote...</p>
            ) : detail ? (
              <>
                <h3 className="font-semibold text-sm">Detalle del lote ZIP</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-1 text-xs">
                  <div className="flex justify-between py-1 border-b border-border/30">
                    <span className="text-muted-foreground">ZIP</span>
                    <span className="font-mono">{detail.batch.zipFilename}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/30">
                    <span className="text-muted-foreground">Batch ID</span>
                    <span className="font-mono text-[9px] break-all">{detail.batch.batchId}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/30">
                    <span className="text-muted-foreground">Usuario</span>
                    <span>{detail.batch.userEmail}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/30">
                    <span className="text-muted-foreground">Organización</span>
                    <span>{detail.batch.organizationName ?? "—"}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/30">
                    <span className="text-muted-foreground">Total registros</span>
                    <span className="font-mono">{detail.batch.totalRecords}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/30">
                    <span className="text-muted-foreground">Analizados</span>
                    <span className="font-mono">{detail.batch.analyzedCount}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/30">
                    <span className="text-muted-foreground">Fallidos</span>
                    <span className="font-mono text-red-600">{detail.batch.failedCount}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/30">
                    <span className="text-muted-foreground">Críticos / Adver / Info</span>
                    <span className="font-mono">
                      {detail.batch.criticalCount} / {detail.batch.warningCount} /{" "}
                      {detail.batch.infoCount}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/30">
                    <span className="text-muted-foreground">OK</span>
                    <span className="font-mono">{detail.batch.okCount}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/30">
                    <span className="text-muted-foreground">XMLs con BOM</span>
                    <span className="font-mono">{detail.batch.recordsWithBom}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/30">
                    <span className="text-muted-foreground">Normalización técnica</span>
                    <span className="font-mono">{detail.batch.recordsWithNormalization}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/30">
                    <span className="text-muted-foreground">XML normalizado</span>
                    <span className="font-mono">{detail.batch.recordsWithNormalizedXml}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/30 col-span-1">
                    <span className="text-muted-foreground">Creado</span>
                    <span>{fmt(detail.batch.createdAtFirst)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/30 col-span-1">
                    <span className="text-muted-foreground">Expira</span>
                    <span>{fmt(detail.batch.expiresAt)}</span>
                  </div>
                </div>

                {Object.keys(detail.batch.tiposComprobante).length > 0 && (
                  <div className="space-y-1 pt-1 border-t border-border/40">
                    <p className="text-xs font-semibold text-muted-foreground">
                      Tipos de comprobante
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(detail.batch.tiposComprobante).map(([tipo, count]) => (
                        <span
                          key={tipo}
                          className="text-xs bg-muted text-foreground px-2 py-0.5 rounded font-mono"
                        >
                          {tipo}: {count}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between pt-1 border-t border-border/40">
                  <p className="text-xs font-semibold text-muted-foreground">
                    Registros del lote ({detail.records.length})
                  </p>
                  <button
                    onClick={handleExportBatchCsv}
                    className="text-[10px] font-semibold text-primary hover:underline"
                  >
                    Exportar lote CSV
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-border/50 text-muted-foreground bg-muted/30">
                        <th className="text-left py-1.5 px-2 whitespace-nowrap">#</th>
                        <th className="text-center py-1.5 px-2 whitespace-nowrap">Estado</th>
                        <th className="text-left py-1.5 px-2 whitespace-nowrap">Archivo</th>
                        <th className="text-left py-1.5 px-2 whitespace-nowrap">UUID</th>
                        <th className="text-left py-1.5 px-2 whitespace-nowrap">Tipo</th>
                        <th className="text-left py-1.5 px-2 whitespace-nowrap">RFC emisor</th>
                        <th className="text-left py-1.5 px-2 whitespace-nowrap">RFC receptor</th>
                        <th className="text-right py-1.5 px-2 whitespace-nowrap">Total</th>
                        <th className="text-left py-1.5 px-2 whitespace-nowrap">Moneda</th>
                        <th className="text-left py-1.5 px-2 whitespace-nowrap">Riesgo</th>
                        <th className="text-center py-1.5 px-2 whitespace-nowrap">Crít</th>
                        <th className="text-center py-1.5 px-2 whitespace-nowrap">Adver</th>
                        <th className="text-center py-1.5 px-2 whitespace-nowrap">Info</th>
                        <th className="text-center py-1.5 px-2 whitespace-nowrap">BOM</th>
                        <th className="text-center py-1.5 px-2 whitespace-nowrap">XML Norm</th>
                        <th className="text-left py-1.5 px-2 whitespace-nowrap">Error</th>
                        <th className="text-center py-1.5 px-2 whitespace-nowrap"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.records.map((r, i) => (
                        <tr key={r.id} className="border-b border-border/30 hover:bg-muted/20">
                          <td className="py-1 px-2">{i + 1}</td>
                          <td className="py-1 px-2 text-center">
                            {r.analysisStatus === "FAILED" ? (
                              <span className="text-[10px] font-bold px-1 py-0.5 rounded-full border text-red-700 bg-red-50 border-red-200">
                                FAILED
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold px-1 py-0.5 rounded-full border text-emerald-700 bg-emerald-50 border-emerald-200">
                                OK
                              </span>
                            )}
                          </td>
                          <td
                            className="py-1 px-2 max-w-[120px] truncate font-mono"
                            title={r.zipEntryName ?? ""}
                          >
                            {r.zipEntryName ?? "—"}
                          </td>
                          <td
                            className="py-1 px-2 max-w-[80px] truncate font-mono"
                            title={r.uuid ?? ""}
                          >
                            {r.uuid ?? "—"}
                          </td>
                          <td className="py-1 px-2">{r.tipoComprobante ?? "—"}</td>
                          <td className="py-1 px-2 font-mono">{r.rfcEmisor ?? "—"}</td>
                          <td className="py-1 px-2 font-mono">{r.rfcReceptor ?? "—"}</td>
                          <td className="py-1 px-2 text-right font-mono">{r.total ?? "—"}</td>
                          <td className="py-1 px-2">{r.moneda ?? "—"}</td>
                          <td className="py-1 px-2">
                            {r.riskLevel ? (
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${riskColor(r.riskLevel)}`}
                              >
                                {r.riskLevel}
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="py-1 px-2 text-center font-mono">
                            {r.analysisStatus === "FAILED" ? "—" : r.criticalCount}
                          </td>
                          <td className="py-1 px-2 text-center font-mono">
                            {r.analysisStatus === "FAILED" ? "—" : r.warningCount}
                          </td>
                          <td className="py-1 px-2 text-center font-mono">
                            {r.analysisStatus === "FAILED" ? "—" : r.infoCount}
                          </td>
                          <td className="py-1 px-2 text-center">
                            {r.analysisStatus === "FAILED" ? "—" : r.hasBom ? "Sí" : "—"}
                          </td>
                          <td className="py-1 px-2 text-center">
                            {r.analysisStatus === "FAILED" ? "—" : r.hasNormalizedXml ? "Sí" : "—"}
                          </td>
                          <td
                            className="py-1 px-2 max-w-[120px] truncate text-red-600"
                            title={r.errorMessage ?? ""}
                          >
                            {r.errorMessage ?? "—"}
                          </td>
                          <td className="py-1 px-2 text-center">
                            <button
                              onClick={() => handleRecordDetail(r.id)}
                              className="text-primary font-semibold hover:underline"
                            >
                              {recordDetailId === r.id ? "Ocultar" : "Ver detalle"}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {recordDetailId && recordDetail && (
                  <div className="p-4 rounded-lg border border-border bg-muted/20 space-y-2 mt-2">
                    <p className="text-xs font-semibold text-muted-foreground">
                      Detalle individual del registro
                    </p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[10px]">
                      <span className="text-muted-foreground">ID:</span>
                      <span className="font-mono break-all">{recordDetail.id}</span>
                      <span className="text-muted-foreground">Estado:</span>
                      <span>{recordDetail.analysisStatus}</span>
                      {recordDetail.errorCode && (
                        <>
                          <span className="text-muted-foreground">Código error:</span>
                          <span className="text-red-600">{recordDetail.errorCode}</span>
                        </>
                      )}
                      {recordDetail.errorMessage && (
                        <>
                          <span className="text-muted-foreground">Mensaje error:</span>
                          <span className="text-red-600">{recordDetail.errorMessage}</span>
                        </>
                      )}
                      <span className="text-muted-foreground">UUID:</span>
                      <span className="font-mono">{recordDetail.uuid ?? "—"}</span>
                      <span className="text-muted-foreground">RFC emisor:</span>
                      <span className="font-mono">{recordDetail.rfcEmisor ?? "—"}</span>
                      <span className="text-muted-foreground">RFC receptor:</span>
                      <span className="font-mono">{recordDetail.rfcReceptor ?? "—"}</span>
                      <span className="text-muted-foreground">Total:</span>
                      <span>{recordDetail.total ?? "—"}</span>
                      <span className="text-muted-foreground">Riesgo:</span>
                      <span>
                        {recordDetail.riskLevel ? (
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${riskColor(recordDetail.riskLevel)}`}
                          >
                            {recordDetail.riskLevel}
                          </span>
                        ) : (
                          "—"
                        )}
                      </span>
                    </div>
                    {(() => {
                      const es = recordDetail.analysisJson?.executiveSummary;
                      if (!es) return null;
                      const esObj = es as Record<string, unknown>;
                      return (
                        <div className="pt-1 border-t border-border/30">
                          <p className="text-[10px] font-semibold text-muted-foreground">
                            Resumen ejecutivo
                          </p>
                          <p className="text-xs text-foreground/80">{String(esObj.title ?? "")}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {String(esObj.message ?? "")}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            <span className="font-semibold">Acción:</span>{" "}
                            {String(esObj.recommendedAction ?? "")}
                          </p>
                        </div>
                      );
                    })()}
                    <button
                      onClick={() => navigate(`/admin/xml-analyses?id=${recordDetail.id}`)}
                      className="text-[10px] text-primary font-semibold hover:underline"
                    >
                      Abrir detalle completo
                    </button>
                  </div>
                )}
                {recordDetailId && !recordDetail && !recordDetailLoading && (
                  <p className="text-xs text-red-500">Error al cargar detalle del registro.</p>
                )}
                {recordDetailLoading && (
                  <p className="text-xs text-muted-foreground">Cargando detalle del registro...</p>
                )}
              </>
            ) : (
              <p className="text-sm text-red-500">Error al cargar detalle del lote.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
