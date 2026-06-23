import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getXmlAnalyses,
  getXmlAnalysisDetail,
  exportXmlAnalyses,
  type XmlAnalysisListItem,
  type XmlAnalysisDetailResponse,
  type XmlAnalysesQuery,
} from "../api/admin";

export default function AdminXmlAnalysesPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [items, setItems] = useState<XmlAnalysisListItem[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<XmlAnalysisDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [fUuid, setFUuid] = useState("");
  const [fRfcEmisor, setFRfcEmisor] = useState("");
  const [fRfcReceptor, setFRfcReceptor] = useState("");
  const [fTipo, setFTipo] = useState("");
  const [fRiesgo, setFRiesgo] = useState("");
  const [fAnalysisStatus, setFAnalysisStatus] = useState("");
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
    try {
      const res = await getXmlAnalyses(token, {
        page: p ?? page,
        pageSize: 50,
        uuid: fUuid || undefined,
        rfcEmisor: fRfcEmisor || undefined,
        rfcReceptor: fRfcReceptor || undefined,
        tipoComprobante: fTipo || undefined,
        riskLevel: fRiesgo || undefined,
        analysisStatus: fAnalysisStatus || undefined,
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
    setFUuid("");
    setFRfcEmisor("");
    setFRfcReceptor("");
    setFTipo("");
    setFRiesgo("");
    setFAnalysisStatus("");
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
      const query: XmlAnalysesQuery = {
        uuid: fUuid || undefined,
        rfcEmisor: fRfcEmisor || undefined,
        rfcReceptor: fRfcReceptor || undefined,
        tipoComprobante: fTipo || undefined,
        riskLevel: fRiesgo || undefined,
        analysisStatus: fAnalysisStatus || undefined,
        from: fFrom || undefined,
        to: fTo || undefined,
      };
      const blob = await exportXmlAnalyses(token, query);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "fiscora-analisis-xml-recientes.csv";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al exportar");
    }
  }

  async function handleDetail(id: string) {
    const token = localStorage.getItem("accessToken");
    if (!token) {
      navigate("/login");
      return;
    }
    if (detailId === id) {
      setDetailId(null);
      setDetail(null);
      return;
    }
    setDetailId(id);
    setDetailLoading(true);
    setDetail(null);
    try {
      const d = await getXmlAnalysisDetail(token, id);
      setDetail(d);
    } catch {
      setDetail(null);
    } finally {
      setDetailLoading(false);
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
          <h1 className="text-2xl font-extrabold tracking-tight">Análisis XML recientes</h1>
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
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <input
              placeholder="UUID"
              value={fUuid}
              onChange={(e) => setFUuid(e.target.value)}
              className="text-sm px-3 py-1.5 rounded border border-border bg-background text-foreground"
            />
            <input
              placeholder="RFC emisor"
              value={fRfcEmisor}
              onChange={(e) => setFRfcEmisor(e.target.value)}
              className="text-sm px-3 py-1.5 rounded border border-border bg-background text-foreground"
            />
            <input
              placeholder="RFC receptor"
              value={fRfcReceptor}
              onChange={(e) => setFRfcReceptor(e.target.value)}
              className="text-sm px-3 py-1.5 rounded border border-border bg-background text-foreground"
            />
            <input
              placeholder="Tipo comprobante"
              value={fTipo}
              onChange={(e) => setFTipo(e.target.value)}
              className="text-sm px-3 py-1.5 rounded border border-border bg-background text-foreground"
            />
            <select
              value={fRiesgo}
              onChange={(e) => setFRiesgo(e.target.value)}
              className="text-sm px-3 py-1.5 rounded border border-border bg-background text-foreground"
            >
              <option value="">Todos los riesgos</option>
              <option value="CRITICAL">Crítico</option>
              <option value="WARNING">Advertencia</option>
              <option value="OK">Sin riesgo</option>
            </select>
            <select
              value={fAnalysisStatus}
              onChange={(e) => setFAnalysisStatus(e.target.value)}
              className="text-sm px-3 py-1.5 rounded border border-border bg-background text-foreground"
            >
              <option value="">Todos los estados</option>
              <option value="ANALYZED">ANALYZED</option>
              <option value="FAILED">FAILED</option>
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
              Exportar CSV
            </button>
          </div>
        </div>

        <div className="text-xs text-muted-foreground">
          {total} registro{total !== 1 ? "s" : ""}
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Cargando...</p>
        ) : items.length === 0 ? (
          <div className="p-6 rounded-xl border border-border bg-card">
            <p className="text-sm text-muted-foreground">No hay registros de análisis XML.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-border/50 text-muted-foreground bg-muted/30">
                  <th className="text-left py-2 px-3 whitespace-nowrap">Fecha análisis</th>
                  <th className="text-left py-2 px-3 whitespace-nowrap">Expira</th>
                  <th className="text-left py-2 px-3 whitespace-nowrap">Usuario</th>
                  <th className="text-left py-2 px-3 whitespace-nowrap">Organización</th>
                  <th className="text-left py-2 px-3 whitespace-nowrap">UUID</th>
                  <th className="text-center py-2 px-3 whitespace-nowrap">Origen</th>
                  <th className="text-center py-2 px-3 whitespace-nowrap">Estado análisis</th>
                  <th className="text-left py-2 px-3 whitespace-nowrap">Archivo fuente</th>
                  <th className="text-left py-2 px-3 whitespace-nowrap">Tipo</th>
                  <th className="text-left py-2 px-3 whitespace-nowrap">RFC emisor</th>
                  <th className="text-left py-2 px-3 whitespace-nowrap">RFC receptor</th>
                  <th className="text-left py-2 px-3 whitespace-nowrap">Total</th>
                  <th className="text-left py-2 px-3 whitespace-nowrap">Moneda</th>
                  <th className="text-left py-2 px-3 whitespace-nowrap">Riesgo</th>
                  <th className="text-center py-2 px-3 whitespace-nowrap">Crít</th>
                  <th className="text-center py-2 px-3 whitespace-nowrap">Adver</th>
                  <th className="text-center py-2 px-3 whitespace-nowrap">Info</th>
                  <th className="text-center py-2 px-3 whitespace-nowrap">BOM</th>
                  <th className="text-center py-2 px-3 whitespace-nowrap">XML Norm</th>
                  <th className="text-center py-2 px-3 whitespace-nowrap"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr key={r.id} className="border-b border-border/30 hover:bg-muted/20">
                    <td className="py-1.5 px-3 whitespace-nowrap">{fmt(r.createdAt)}</td>
                    <td className="py-1.5 px-3 whitespace-nowrap">{fmt(r.expiresAt)}</td>
                    <td className="py-1.5 px-3 max-w-[120px] truncate" title={r.userEmail}>
                      {r.userEmail}
                    </td>
                    <td
                      className="py-1.5 px-3 max-w-[120px] truncate"
                      title={r.organizationName ?? ""}
                    >
                      {r.organizationName ?? "—"}
                    </td>
                    <td
                      className="py-1.5 px-3 font-mono max-w-[100px] truncate"
                      title={r.uuid ?? ""}
                    >
                      {r.uuid ?? "—"}
                    </td>
                    <td className="py-1.5 px-3 text-center">
                      {r.sourceType ? (r.sourceType === "ZIP" ? "ZIP" : "Individual") : "—"}
                    </td>
                    <td className="py-1.5 px-3 text-center">
                      {r.analysisStatus === "FAILED" ? (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full border text-red-700 bg-red-50 border-red-200">
                          FAILED
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full border text-emerald-700 bg-emerald-50 border-emerald-200">
                          ANALYZED
                        </span>
                      )}
                    </td>
                    <td
                      className="py-1.5 px-3 max-w-[150px] truncate font-mono"
                      title={r.sourceFilename ?? ""}
                    >
                      {r.sourceFilename ?? "—"}
                    </td>
                    <td className="py-1.5 px-3">{r.tipoComprobante ?? "—"}</td>
                    <td className="py-1.5 px-3 font-mono">{r.rfcEmisor ?? "—"}</td>
                    <td className="py-1.5 px-3 font-mono">{r.rfcReceptor ?? "—"}</td>
                    <td className="py-1.5 px-3 text-right font-mono">{r.total ?? "—"}</td>
                    <td className="py-1.5 px-3">{r.moneda ?? "—"}</td>
                    <td className="py-1.5 px-3">
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
                    <td className="py-1.5 px-3 text-center font-mono">{r.criticalCount}</td>
                    <td className="py-1.5 px-3 text-center font-mono">{r.warningCount}</td>
                    <td className="py-1.5 px-3 text-center font-mono">{r.infoCount}</td>
                    <td className="py-1.5 px-3 text-center">{r.hasBom ? "Sí" : "—"}</td>
                    <td className="py-1.5 px-3 text-center">{r.hasNormalizedXml ? "Sí" : "—"}</td>
                    <td className="py-1.5 px-3 text-center">
                      <button
                        onClick={() => handleDetail(r.id)}
                        className="text-primary font-semibold hover:underline"
                      >
                        {detailId === r.id ? "Ocultar" : "Ver detalle"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {detailId && (
          <div className="p-4 rounded-xl border border-border bg-card space-y-3">
            {detailLoading ? (
              <p className="text-sm text-muted-foreground">Cargando detalle...</p>
            ) : detail ? (
              <>
                <h3 className="font-semibold text-sm">Detalle del análisis</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1 text-xs">
                  <div className="flex justify-between py-1 border-b border-border/30">
                    <span className="text-muted-foreground">Estado análisis</span>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${detail.analysisStatus === "FAILED" ? "text-red-700 bg-red-50 border-red-200" : "text-emerald-700 bg-emerald-50 border-emerald-200"}`}
                    >
                      {detail.analysisStatus}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/30">
                    <span className="text-muted-foreground">UUID</span>
                    <span className="font-mono">{detail.uuid ?? "—"}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/30">
                    <span className="text-muted-foreground">Tipo</span>
                    <span>{detail.tipoComprobante ?? "—"}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/30">
                    <span className="text-muted-foreground">RFC emisor</span>
                    <span className="font-mono">{detail.rfcEmisor ?? "—"}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/30">
                    <span className="text-muted-foreground">Nombre emisor</span>
                    <span>{detail.nombreEmisor ?? "—"}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/30">
                    <span className="text-muted-foreground">RFC receptor</span>
                    <span className="font-mono">{detail.rfcReceptor ?? "—"}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/30">
                    <span className="text-muted-foreground">Nombre receptor</span>
                    <span>{detail.nombreReceptor ?? "—"}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/30">
                    <span className="text-muted-foreground">Fecha</span>
                    <span>{detail.fecha ?? "—"}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/30">
                    <span className="text-muted-foreground">Total</span>
                    <span>{detail.total ?? "—"}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/30">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>{detail.subtotal ?? "—"}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/30">
                    <span className="text-muted-foreground">Moneda</span>
                    <span>{detail.moneda ?? "—"}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/30">
                    <span className="text-muted-foreground">Versión</span>
                    <span>{detail.version ?? "—"}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/30">
                    <span className="text-muted-foreground">Serie</span>
                    <span>{detail.serie ?? "—"}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/30">
                    <span className="text-muted-foreground">Folio</span>
                    <span>{detail.folio ?? "—"}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/30">
                    <span className="text-muted-foreground">Riesgo</span>
                    <span>{detail.riskLevel ?? "—"}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/30">
                    <span className="text-muted-foreground">Hallazgos</span>
                    <span>{detail.analysisStatus === "FAILED" ? "—" : detail.findingsCount}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/30">
                    <span className="text-muted-foreground">
                      Críticos / Advertencias / Informativos
                    </span>
                    <span>
                      {detail.analysisStatus === "FAILED"
                        ? "—"
                        : `${detail.criticalCount} / ${detail.warningCount} / ${detail.infoCount}`}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/30">
                    <span className="text-muted-foreground">BOM</span>
                    <span>
                      {detail.analysisStatus === "FAILED" ? "—" : detail.hasBom ? "Sí" : "No"}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/30">
                    <span className="text-muted-foreground">Normalización técnica</span>
                    <span>
                      {detail.analysisStatus === "FAILED"
                        ? "—"
                        : detail.hasTechnicalNormalization
                          ? "Sí"
                          : "No"}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/30">
                    <span className="text-muted-foreground">XML normalizado</span>
                    <span>
                      {detail.analysisStatus === "FAILED"
                        ? "—"
                        : detail.hasNormalizedXml
                          ? (detail.normalizedFilename ?? "Sí")
                          : "No"}
                    </span>
                  </div>
                  {detail.originalSha256 && (
                    <div className="flex justify-between py-1 border-b border-border/30 col-span-2">
                      <span className="text-muted-foreground">Hash original</span>
                      <span className="font-mono text-[10px] break-all">
                        {detail.originalSha256}
                      </span>
                    </div>
                  )}
                  {detail.normalizedSha256 && (
                    <div className="flex justify-between py-1 border-b border-border/30 col-span-2">
                      <span className="text-muted-foreground">Hash normalizado</span>
                      <span className="font-mono text-[10px] break-all">
                        {detail.normalizedSha256}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between py-1 border-b border-border/30">
                    <span className="text-muted-foreground">Usuario</span>
                    <span>{detail.userEmail}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/30">
                    <span className="text-muted-foreground">Organización</span>
                    <span>{detail.organizationName ?? "—"}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/30">
                    <span className="text-muted-foreground">Origen</span>
                    <span>
                      {detail.sourceType
                        ? detail.sourceType === "ZIP"
                          ? "ZIP"
                          : "Individual"
                        : "—"}
                    </span>
                  </div>
                  {detail.sourceFilename && (
                    <div className="flex justify-between py-1 border-b border-border/30 col-span-2">
                      <span className="text-muted-foreground">Archivo fuente</span>
                      <span className="font-mono">{detail.sourceFilename}</span>
                    </div>
                  )}
                  {detail.errorCode && (
                    <div className="flex justify-between py-1 border-b border-border/30 col-span-2">
                      <span className="text-muted-foreground">Código error</span>
                      <span className="font-mono text-red-600">{detail.errorCode}</span>
                    </div>
                  )}
                  {detail.errorMessage && (
                    <div className="flex justify-between py-1 border-b border-border/30 col-span-2">
                      <span className="text-muted-foreground">Mensaje error</span>
                      <span className="text-red-600">{detail.errorMessage}</span>
                    </div>
                  )}
                  {detail.batchId && (
                    <div className="flex justify-between py-1 border-b border-border/30 col-span-2">
                      <span className="text-muted-foreground">Batch ID</span>
                      <span className="font-mono text-[10px] break-all">{detail.batchId}</span>
                    </div>
                  )}
                  {detail.zipFilename && (
                    <div className="flex justify-between py-1 border-b border-border/30 col-span-2">
                      <span className="text-muted-foreground">ZIP filename</span>
                      <span className="font-mono">{detail.zipFilename}</span>
                    </div>
                  )}
                  {detail.zipEntryName && (
                    <div className="flex justify-between py-1 border-b border-border/30 col-span-2">
                      <span className="text-muted-foreground">ZIP entry</span>
                      <span className="font-mono">{detail.zipEntryName}</span>
                    </div>
                  )}
                  {detail.zipEntryIndex != null && (
                    <div className="flex justify-between py-1 border-b border-border/30">
                      <span className="text-muted-foreground">ZIP entry index</span>
                      <span className="font-mono">{detail.zipEntryIndex}</span>
                    </div>
                  )}
                  <div className="flex justify-between py-1 border-b border-border/30 col-span-2">
                    <span className="text-muted-foreground">Creado</span>
                    <span>{fmt(detail.createdAt)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/30 col-span-2">
                    <span className="text-muted-foreground">Expira</span>
                    <span>{fmt(detail.expiresAt)}</span>
                  </div>
                </div>

                {detail.analysisStatus === "FAILED" ? (
                  <div className="p-4 rounded-lg border border-red-200 bg-red-50 space-y-2">
                    <p className="text-sm font-semibold text-red-800">Error en análisis de XML</p>
                    <p className="text-xs text-red-700">
                      Revisar si el XML está corrupto o tiene estructura inválida. Si el archivo
                      puede abrirse individualmente, ejecutar análisis individual para aislar la
                      causa.
                    </p>
                  </div>
                ) : (
                  <>
                    {detail.analysisJson?.executiveSummary && (
                      <div className="space-y-1 pt-2 border-t border-border/40">
                        <p className="text-xs font-semibold text-muted-foreground">
                          Resumen ejecutivo
                        </p>
                        <p className="text-xs text-foreground/80">
                          {
                            (detail.analysisJson.executiveSummary as Record<string, unknown>)
                              ?.title as string
                          }
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {
                            (detail.analysisJson.executiveSummary as Record<string, unknown>)
                              ?.message as string
                          }
                        </p>
                        <p className="text-xs text-muted-foreground">
                          <span className="font-semibold">Acción:</span>{" "}
                          {
                            (detail.analysisJson.executiveSummary as Record<string, unknown>)
                              ?.recommendedAction as string
                          }
                        </p>
                      </div>
                    )}

                    {detail.analysisJson?.findings &&
                      Array.isArray(detail.analysisJson.findings) &&
                      (detail.analysisJson.findings as Record<string, unknown>[]).length > 0 && (
                        <div className="space-y-2 pt-2 border-t border-border/40">
                          <p className="text-xs font-semibold text-muted-foreground">
                            Hallazgos ({detail.findingsCount})
                          </p>
                          {(detail.analysisJson.findings as Record<string, unknown>[])
                            .slice(0, 20)
                            .map((f: Record<string, unknown>, i: number) => (
                              <div
                                key={i}
                                className="p-2 rounded border border-border/50 bg-muted/20 space-y-1"
                              >
                                <div className="flex gap-2 text-[10px] text-muted-foreground">
                                  <span className="font-semibold">{f.severity as string}</span>
                                  <span>{f.category as string}</span>
                                  <span className="font-mono">{f.code as string}</span>
                                </div>
                                <p className="text-xs font-medium">{f.title as string}</p>
                                <p className="text-xs text-muted-foreground">
                                  {f.message as string}
                                </p>
                                {f.location &&
                                  typeof f.location === "object" && (
                                    <div className="flex flex-wrap gap-x-2 text-[10px] text-muted-foreground">
                                      <span>Módulo: {String((f.location as Record<string, unknown>).module ?? "")}</span>
                                      {(f.location as Record<string, unknown>).section &&
                                        <span>Sección: {String((f.location as Record<string, unknown>).section)}</span>}
                                      {(f.location as Record<string, unknown>).field &&
                                        <span>Campo: {String((f.location as Record<string, unknown>).field)}</span>}
                                      {(f.location as Record<string, unknown>).index !== undefined &&
                                        <span>Índice: {String((f.location as Record<string, unknown>).index)}</span>}
                                    </div>
                                  )}
                                {f.valueTrace &&
                                  typeof f.valueTrace === "object" && (
                                    <div className="flex flex-wrap gap-x-2 text-[10px] text-muted-foreground">
                                      {(f.valueTrace as Record<string, unknown>).observed !== undefined &&
                                        <span>Observado: {String((f.valueTrace as Record<string, unknown>).observed)}</span>}
                                      {(f.valueTrace as Record<string, unknown>).expected !== undefined &&
                                        <span>Esperado: {String((f.valueTrace as Record<string, unknown>).expected)}</span>}
                                      {(f.valueTrace as Record<string, unknown>).calculated !== undefined &&
                                        <span>Calc: {String((f.valueTrace as Record<string, unknown>).calculated)}</span>}
                                      {(f.valueTrace as Record<string, unknown>).difference !== undefined &&
                                        <span>Dif: {String((f.valueTrace as Record<string, unknown>).difference)}</span>}
                                      {(f.valueTrace as Record<string, unknown>).tolerance !== undefined &&
                                        <span>Tol: {String((f.valueTrace as Record<string, unknown>).tolerance)}</span>}
                                    </div>
                                  )}
                                {(() => {
                                  const ev = f.evidence as Record<string, unknown>[] | undefined;
                                  if (!ev || ev.length === 0) return null;
                                  return (
                                    <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[10px]">
                                      {ev.map((e: Record<string, unknown>, ei: number) => (
                                        <div key={ei} className="contents">
                                          <span className="text-muted-foreground">
                                            {String(e.label ?? "")}:
                                          </span>
                                          <span className="font-mono break-all">
                                            {e.value != null ? String(e.value) : "—"}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  );
                                })()}
                              </div>
                            ))}
                          {(detail.analysisJson.findings as Record<string, unknown>[]).length >
                            20 && (
                            <p className="text-[10px] text-muted-foreground">
                              ... y{" "}
                              {(detail.analysisJson.findings as Record<string, unknown>[]).length -
                                20}{" "}
                              hallazgos más
                            </p>
                          )}
                        </div>
                      )}

                    {detail.analysisJson?.technicalDiagnostics && (
                      <div className="space-y-1 pt-2 border-t border-border/40">
                        <p className="text-xs font-semibold text-muted-foreground">
                          Diagnóstico técnico
                        </p>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[10px]">
                          <span className="text-muted-foreground">XML timbrado:</span>
                          <span>
                            {(detail.analysisJson.technicalDiagnostics as Record<string, unknown>)
                              ?.isStamped
                              ? "Sí"
                              : "No"}
                          </span>
                          <span className="text-muted-foreground">Timbre Fiscal Digital:</span>
                          <span>
                            {(detail.analysisJson.technicalDiagnostics as Record<string, unknown>)
                              ?.hasTimbreFiscalDigital
                              ? "Sí"
                              : "No"}
                          </span>
                          <span className="text-muted-foreground">BOM detectado:</span>
                          <span>
                            {(detail.analysisJson.technicalDiagnostics as Record<string, unknown>)
                              ?.bomDetected
                              ? "Sí"
                              : "No"}
                          </span>
                          <span className="text-muted-foreground">Normalización segura:</span>
                          <span>
                            {(detail.analysisJson.technicalDiagnostics as Record<string, unknown>)
                              ?.safeNormalizationApplied
                              ? "Sí"
                              : "No"}
                          </span>
                        </div>
                      </div>
                    )}

                    {detail.analysisJson?.structureDiagnostics && (
                      <div className="space-y-1 pt-2 border-t border-border/40">
                        <p className="text-xs font-semibold text-muted-foreground">
                          Diagnóstico estructural
                        </p>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[10px]">
                          <span className="text-muted-foreground">Complemento:</span>
                          <span>
                            {(detail.analysisJson.structureDiagnostics as Record<string, unknown>)
                              ?.hasComplemento
                              ? "Sí"
                              : "No"}
                          </span>
                          <span className="text-muted-foreground">Addenda:</span>
                          <span>
                            {(detail.analysisJson.structureDiagnostics as Record<string, unknown>)
                              ?.hasAddenda
                              ? "Sí"
                              : "No"}
                          </span>
                        </div>
                      </div>
                    )}

                    {detail.analysisJson?.normalizedXml && (
                      <div className="space-y-1 pt-2 border-t border-border/40">
                        <p className="text-xs font-semibold text-muted-foreground">
                          Normalización técnica
                        </p>
                        <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[10px]">
                          <span className="text-muted-foreground">Disponible:</span>
                          <span>
                            {(detail.analysisJson.normalizedXml as Record<string, unknown>)
                              ?.available
                              ? "Sí"
                              : "No"}
                          </span>
                          <span className="text-muted-foreground">Archivo:</span>
                          <span className="font-mono">
                            {((detail.analysisJson.normalizedXml as Record<string, unknown>)
                              ?.filename as string) ?? "—"}
                          </span>
                          <span className="text-muted-foreground">Tipo:</span>
                          <span>
                            {
                              (detail.analysisJson.normalizedXml as Record<string, unknown>)
                                ?.normalizationType as string
                            }
                          </span>
                          <span className="text-muted-foreground">
                            Contenido fiscal modificado:
                          </span>
                          <span>
                            {(detail.analysisJson.normalizedXml as Record<string, unknown>)
                              ?.fiscalContentModified
                              ? "Sí"
                              : "No"}
                          </span>
                          <span className="text-muted-foreground">Riesgo timbre/sello:</span>
                          <span>
                            {((detail.analysisJson.normalizedXml as Record<string, unknown>)
                              ?.stampRisk as string) ?? "—"}
                          </span>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </>
            ) : (
              <p className="text-sm text-red-500">Error al cargar detalle.</p>
            )}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Página {page} de {totalPages} ({total} registros)
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
      </div>
    </div>
  );
}
