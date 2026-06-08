import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { getMe } from "../api/auth";
import { analyzeXml, analyzeZipInventory, analyzeZipFull, downloadNormalizedZip, type AnalysisResult, type ZipInventoryResult, type ZipFullAnalysisResult } from "../api/xml-audit";

export default function XmlAuditPage() {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filter, setFilter] = useState<"ALL" | "CRITICAL" | "WARNING" | "INFO">("ALL");
  const [categoryFilter, setCategoryFilter] = useState<"ALL" | "TOTALS" | "FISCAL" | "TAX" | "TECHNICAL" | "STRUCTURE" | "COMPLEMENT">("ALL");
  const [expandedEvidence, setExpandedEvidence] = useState<Set<string>>(new Set());
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [zipValidating, setZipValidating] = useState(false);
  const [zipResult, setZipResult] = useState<ZipInventoryResult | null>(null);
  const [zipError, setZipError] = useState("");
  const [fullAnalysisLoading, setFullAnalysisLoading] = useState(false);
  const [fullAnalysisResult, setFullAnalysisResult] = useState<ZipFullAnalysisResult | null>(null);
  const [fullAnalysisError, setFullAnalysisError] = useState("");
  const [normalizedZipLoading, setNormalizedZipLoading] = useState(false);
  const [normalizedZipError, setNormalizedZipError] = useState("");
  const [expandedMassiveDetail, setExpandedMassiveDetail] = useState<string | null>(null);

  function toggleMassiveDetail(key: string) {
    setExpandedMassiveDetail(prev => prev === key ? null : key);
  }

  function toggleEvidence(code: string) {
    setExpandedEvidence(prev => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code); else next.add(code);
      return next;
    });
  }

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (!token) {
      navigate("/login");
      return;
    }
    getMe(token)
      .catch(() => {
        localStorage.removeItem("accessToken");
        navigate("/login");
      })
      .finally(() => setLoading(false));
  }, [navigate]);

  async function handleAnalyze() {
    const token = localStorage.getItem("accessToken");
    if (!token) {
      navigate("/login");
      return;
    }

    if (!selectedFile) {
      setError("Selecciona un archivo XML.");
      return;
    }

    if (!selectedFile.name.toLowerCase().endsWith(".xml")) {
      setError("Solo se permiten archivos XML.");
      return;
    }

    if (selectedFile.size > 5 * 1024 * 1024) {
      setError("El archivo supera el límite de 5 MB.");
      return;
    }

    setError("");
    setResult(null);
    setAnalyzing(true);

    try {
      const analysis = await analyzeXml(token, selectedFile);
      setResult(analysis);
      setFilter("ALL");
      setCategoryFilter("ALL");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible analizar el XML.");
    } finally {
      setAnalyzing(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setError("");
    setResult(null);
    const file = e.target.files?.[0] ?? null;
    setSelectedFile(file);
  }

  async function handleValidateZip() {
    const token = localStorage.getItem("accessToken");
    if (!token) {
      navigate("/login");
      return;
    }

    if (!zipFile) {
      setZipError("Selecciona un archivo ZIP.");
      return;
    }

    if (!zipFile.name.toLowerCase().endsWith(".zip")) {
      setZipError("Solo se permiten archivos ZIP.");
      return;
    }

    if (zipFile.size > 25 * 1024 * 1024) {
      setZipError("El archivo ZIP supera el límite de 25 MB.");
      return;
    }

    setZipError("");
    setZipResult(null);
    setZipValidating(true);

    try {
      const result = await analyzeZipInventory(token, zipFile);
      setZipResult(result);
    } catch (err) {
      setZipError(err instanceof Error ? err.message : "No fue posible validar el ZIP.");
    } finally {
      setZipValidating(false);
    }
  }

  function escCsvMassive(val: string | number | null | undefined): string {
    const s = val === null || val === undefined ? "" : String(val);
    const v = s.replace(/"/g, '""');
    return /[",\n\r]/.test(v) ? `"${v}"` : v;
  }

  function handleExportMassiveCsv() {
    if (!fullAnalysisResult) return;
    const r = fullAnalysisResult;
    const bom = "\uFEFF";
    const lines: string[] = [];

    function section(title: string) {
      lines.push("");
      lines.push(`"${title}"`);
      lines.push("");
    }
    function row(...vals: (string | number | null | undefined)[]) {
      lines.push(vals.map(v => escCsvMassive(v ?? "—")).join(","));
    }

    section("RESUMEN MASIVO");
    row("Archivo ZIP", r.filename);
    row("Total entradas", r.totalEntries);
    row("XML encontrados", r.xmlFilesFound);
    row("XML analizados", r.analyzedCount);
    row("XML fallidos", r.failedCount);
    row("Entradas ignoradas", r.ignoredEntries);
    row("Críticos", r.summary.criticalCount);
    row("Advertencias", r.summary.warningCount);
    row("OK", r.summary.okCount);
    row("Solo informativos", r.summary.infoOnlyCount);
    row("XMLs con BOM", r.summary.filesWithBom);
    row("XMLs con normalización técnica", r.summary.filesWithTechnicalNormalization);
    const tiposStr = Object.entries(r.summary.byTipoComprobante)
      .map(([t, c]) => `${t}: ${c}`)
      .join(" | ");
    row("Tipos de comprobante", tiposStr || "—");

    section("RESULTADOS POR XML");
    const resultHeader = [
      "#", "Archivo", "Tamaño bytes", "Estado", "Código error", "Mensaje error",
      "UUID", "Tipo comprobante", "RFC emisor", "Nombre emisor", "RFC receptor",
      "Nombre receptor", "Fecha", "Subtotal", "Total", "Moneda", "Versión",
      "Serie", "Folio", "Riesgo", "Título resumen ejecutivo", "Mensaje resumen ejecutivo",
      "Acción recomendada", "Total hallazgos", "Críticos", "Advertencias",
      "Informativos", "BOM detectado", "Contenido previo al XML",
      "Normalización segura aplicada", "XML normalizado disponible",
      "Archivo normalizado", "Tipo normalización", "Contenido fiscal modificado",
      "Riesgo timbre/sello", "Hash original SHA-256", "Hash normalizado SHA-256",
    ];
    row(...resultHeader);

    for (let i = 0; i < r.results.length; i++) {
      const f = r.results[i];
      const isA = f.status === "ANALYZED";
      const a = f.analysis;
      const es = a?.executiveSummary;
      const td = a?.technicalDiagnostics;
      const nx = a?.normalizedXml;
      const findings = a?.findings ?? [];
      row(
        i + 1,
        f.name,
        f.sizeBytes,
        f.status,
        f.errorCode ?? "",
        f.errorMessage ?? "",
        isA ? (a?.uuid ?? "") : "",
        isA ? (a?.tipoComprobante ?? "") : "",
        isA ? (a?.rfcEmisor ?? "") : "",
        isA ? (a?.nombreEmisor ?? "") : "",
        isA ? (a?.rfcReceptor ?? "") : "",
        isA ? (a?.nombreReceptor ?? "") : "",
        isA ? (a?.fecha ?? "") : "",
        isA ? (a?.subtotal ?? "") : "",
        isA ? (a?.total ?? "") : "",
        isA ? (a?.moneda ?? "") : "",
        isA ? (a?.version ?? "") : "",
        isA ? (a?.serie ?? "") : "",
        isA ? (a?.folio ?? "") : "",
        isA ? (es?.riskLevel ?? "") : "",
        isA ? (es?.title ?? "") : "",
        isA ? (es?.message ?? "") : "",
        isA ? (es?.recommendedAction ?? "") : "",
        isA ? findings.length : 0,
        isA ? findings.filter(f => f.severity === "CRITICAL").length : 0,
        isA ? findings.filter(f => f.severity === "WARNING").length : 0,
        isA ? findings.filter(f => f.severity === "INFO").length : 0,
        isA ? (td?.bomDetected ? "Sí" : "No") : "",
        isA ? (td?.leadingContentBeforeXml ? "Sí" : "No") : "",
        isA ? (td?.safeNormalizationApplied ? "Sí" : "No") : "",
        isA ? (nx?.available ? "Sí" : "No") : "",
        isA ? (nx?.filename ?? "") : "",
        isA ? (nx?.normalizationType ?? "") : "",
        isA ? (nx?.fiscalContentModified ? "Sí" : "No") : "",
        isA ? (nx?.stampRisk ?? "") : "",
        isA ? (nx?.originalSha256 ?? "") : "",
        isA ? (nx?.normalizedSha256 ?? "") : "",
      );
    }

    section("HALLAZGOS POR XML");
    row("Archivo", "Finding ID", "Severidad", "Categoría", "Código", "Título", "Mensaje", "Acción recomendada", "Evidencia");
    for (const f of r.results) {
      if (f.status !== "ANALYZED" || !f.analysis?.findings) continue;
      for (const finding of f.analysis.findings) {
        const evidenceStr = finding.evidence
          ? finding.evidence.map(e => `${e.label}: ${e.value ?? "—"}`).join(" | ")
          : "";
        row(f.name, finding.id, finding.severity, finding.category, finding.code, finding.title, finding.message, finding.recommendedAction ?? "", evidenceStr);
      }
    }

    const csv = bom + "\r\n" + lines.join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;header=present" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const zipBase = r.filename ? r.filename.replace(/\.zip$/i, "").replace(/[^a-zA-Z0-9_-]/g, "_") : "masivo";
    a.download = `fiscora-analisis-masivo-xml-${zipBase}-${ts}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function handleDownloadNormalized() {
    const token = localStorage.getItem("accessToken");
    if (!token) {
      navigate("/login");
      return;
    }

    if (!zipFile) {
      setNormalizedZipError("Selecciona un archivo ZIP.");
      return;
    }

    setNormalizedZipError("");
    setNormalizedZipLoading(true);

    try {
      const blob = await downloadNormalizedZip(token, zipFile);
      const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      const zipBase = zipFile.name.replace(/\.zip$/i, "").replace(/[^a-zA-Z0-9_-]/g, "_");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `fiscora-xml-normalizados-${zipBase}-${ts}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setNormalizedZipError(err instanceof Error ? err.message : "Error al generar ZIP de XMLs normalizados.");
    } finally {
      setNormalizedZipLoading(false);
    }
  }

  async function handleFullAnalyze() {
    const token = localStorage.getItem("accessToken");
    if (!token) {
      navigate("/login");
      return;
    }

    if (!zipFile) {
      setFullAnalysisError("Selecciona un archivo ZIP.");
      return;
    }

    setFullAnalysisError("");
    setFullAnalysisResult(null);
    setFullAnalysisLoading(true);

    try {
      const result = await analyzeZipFull(token, zipFile);
      setFullAnalysisResult(result);
    } catch (err) {
      setFullAnalysisError(err instanceof Error ? err.message : "No fue posible analizar los XMLs del ZIP.");
    } finally {
      setFullAnalysisLoading(false);
    }
  }

  function handleZipFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setZipError("");
    setZipResult(null);
    const file = e.target.files?.[0] ?? null;
    setZipFile(file);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <p className="text-muted-foreground">Cargando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <h1 className="text-2xl font-extrabold tracking-tight">Auditoría XML</h1>

        <div className="p-6 rounded-xl border border-border bg-card space-y-4">
          <label className="block text-sm font-medium text-muted-foreground">
            Selecciona un archivo XML para analizar
          </label>
          <input
            ref={fileRef}
            type="file"
            accept=".xml"
            onChange={handleFileChange}
            className="block w-full text-sm text-foreground file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
          />

          <button
            onClick={handleAnalyze}
            disabled={analyzing || !selectedFile}
            className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 disabled:opacity-50 transition-all"
          >
            {analyzing ? "Analizando XML..." : "Analizar XML"}
          </button>

          {error && (
            <p className="text-sm text-red-500 bg-red-500/10 rounded-lg px-4 py-3">{error}</p>
          )}
        </div>

        <div className="p-6 rounded-xl border border-border bg-card space-y-4">
          <h2 className="text-xl font-extrabold tracking-tight">Auditoría XML masiva</h2>
          <p className="text-sm text-muted-foreground">
            Sube un archivo ZIP para validar los XML incluidos antes de ejecutar el análisis masivo.
          </p>
          <input
            type="file"
            accept=".zip"
            onChange={handleZipFileChange}
            className="block w-full text-sm text-foreground file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
          />

          <button
            onClick={handleValidateZip}
            disabled={zipValidating || !zipFile}
            className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 disabled:opacity-50 transition-all"
          >
            {zipValidating ? "Validando ZIP..." : "Validar ZIP"}
          </button>

          {zipError && (
            <p className="text-sm text-red-500 bg-red-500/10 rounded-lg px-4 py-3">{zipError}</p>
          )}

          {zipResult && (
            <div className="p-4 rounded-lg border border-border bg-muted/30 space-y-3">
              <h3 className="font-semibold text-sm">Inventario del ZIP</h3>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Archivo</span>
                  <span className="font-medium">{zipResult.filename}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Total de entradas</span>
                  <span className="font-medium">{zipResult.totalEntries}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">XML encontrados</span>
                  <span className="font-medium">{zipResult.xmlFilesFound}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Entradas ignoradas</span>
                  <span className="font-medium">{zipResult.ignoredEntries}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">XMLs con BOM</span>
                  <span className="font-medium">{zipResult.technicalSummary.filesWithBom}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">XMLs con contenido previo</span>
                  <span className="font-medium">{zipResult.technicalSummary.filesWithLeadingContent}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Normalización segura disponible</span>
                  <span className="font-medium">{zipResult.technicalSummary.filesWithSafeNormalizationAvailable}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">XMLs sin inicio XML válido</span>
                  <span className="font-medium">{zipResult.technicalSummary.filesWithoutXmlStart}</span>
                </div>
              </div>

              {zipResult.warnings.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground">Advertencias</p>
                  {zipResult.warnings.map((w, i) => (
                    <p key={i} className="text-sm text-yellow-600 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2">{w}</p>
                  ))}
                </div>
              )}

              {(zipResult.technicalSummary.filesWithBom > 0 || zipResult.technicalSummary.filesWithLeadingContent > 0) && (
                <p className="text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
                  Se detectaron XMLs con problemas técnicos reparables. En una fase posterior se podrá generar descarga normalizada masiva.
                </p>
              )}

              {zipResult.xmlFilesFound > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground">XMLs encontrados</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-border/50 text-muted-foreground">
                          <th className="text-left py-1 pr-2">#</th>
                          <th className="text-left py-1 pr-2">Nombre</th>
                          <th className="text-left py-1 pr-2">Tamaño</th>
                          <th className="text-left py-1 pr-2">BOM</th>
                          <th className="text-left py-1 pr-2">Contenido previo</th>
                          <th className="text-left py-1 pr-2">Normalización segura</th>
                          <th className="text-left py-1 pr-2">Inicio XML válido</th>
                        </tr>
                      </thead>
                      <tbody>
                        {zipResult.files.map((f, i) => (
                          <tr key={i} className="border-b border-border/30">
                            <td className="py-1 pr-2 text-muted-foreground">{i + 1}</td>
                            <td className="py-1 pr-2 font-mono break-all max-w-[220px]">{f.name}</td>
                            <td className="py-1 pr-2">{f.sizeBytes.toLocaleString()} bytes</td>
                            <td className="py-1 pr-2">{f.technicalDiagnostics.bomDetected ? "Sí" : "No"}</td>
                            <td className="py-1 pr-2">{f.technicalDiagnostics.leadingContentBeforeXml ? "Sí" : "No"}</td>
                            <td className="py-1 pr-2">{f.technicalDiagnostics.safeNormalizationAvailable ? "Sí" : "No"}</td>
                            <td className="py-1 pr-2">{f.technicalDiagnostics.startsWithXml ? "Sí" : "No"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No se encontraron archivos XML dentro del ZIP.</p>
              )}
            </div>
          )}

          <button
            onClick={handleFullAnalyze}
            disabled={fullAnalysisLoading || !zipFile}
            className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 disabled:opacity-50 transition-all"
          >
            {fullAnalysisLoading ? "Analizando XMLs del ZIP..." : "Analizar XMLs del ZIP"}
          </button>

          {fullAnalysisError && (
            <p className="text-sm text-red-500 bg-red-500/10 rounded-lg px-4 py-3">{fullAnalysisError}</p>
          )}

          {fullAnalysisResult && (
            <div className="p-4 rounded-lg border border-border bg-muted/30 space-y-3">
              <h3 className="font-semibold text-sm">Resultado del análisis masivo</h3>

              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">XML encontrados</span>
                  <span className="font-medium">{fullAnalysisResult.xmlFilesFound}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">XML analizados</span>
                  <span className="font-medium">{fullAnalysisResult.analyzedCount}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Fallidos</span>
                  <span className="font-medium text-red-600">{fullAnalysisResult.failedCount}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Críticos</span>
                  <span className="font-medium text-red-600">{fullAnalysisResult.summary.criticalCount}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Advertencias</span>
                  <span className="font-medium text-yellow-600">{fullAnalysisResult.summary.warningCount}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">OK</span>
                  <span className="font-medium text-emerald-600">{fullAnalysisResult.summary.okCount}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Solo informativos</span>
                  <span className="font-medium">{fullAnalysisResult.summary.infoOnlyCount}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">XMLs con BOM</span>
                  <span className="font-medium">{fullAnalysisResult.summary.filesWithBom}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">XMLs con normalización técnica</span>
                  <span className="font-medium">{fullAnalysisResult.summary.filesWithTechnicalNormalization}</span>
                </div>
              </div>

              {Object.keys(fullAnalysisResult.summary.byTipoComprobante).length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground">Tipos de comprobante detectados</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(fullAnalysisResult.summary.byTipoComprobante).map(([tipo, count]) => (
                      <span key={tipo} className="text-xs bg-muted px-2 py-0.5 rounded font-mono">{tipo}: {count}</span>
                    ))}
                  </div>
                </div>
              )}

              {fullAnalysisResult.warnings.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground">Advertencias</p>
                  {fullAnalysisResult.warnings.map((w, i) => (
                    <p key={i} className="text-sm text-yellow-600 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2">{w}</p>
                  ))}
                </div>
              )}

              {fullAnalysisResult.results.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground">Resultados por archivo</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-border/50 text-muted-foreground">
                          <th className="text-left py-1 pr-2">#</th>
                          <th className="text-left py-1 pr-2">Archivo</th>
                          <th className="text-left py-1 pr-2">Estado</th>
                          <th className="text-left py-1 pr-2">UUID</th>
                          <th className="text-left py-1 pr-2">Tipo</th>
                          <th className="text-left py-1 pr-2">RFC emisor</th>
                          <th className="text-left py-1 pr-2">RFC receptor</th>
                          <th className="text-left py-1 pr-2">Total</th>
                          <th className="text-left py-1 pr-2">Moneda</th>
                          <th className="text-left py-1 pr-2">Riesgo</th>
                          <th className="text-left py-1 pr-2">Críticos</th>
                          <th className="text-left py-1 pr-2">Advertencias</th>
                          <th className="text-left py-1 pr-2">Informativos</th>
                          <th className="text-left py-1 pr-2">BOM</th>
                          <th className="text-left py-1 pr-2">XML normalizado</th>
                          <th className="text-left py-1 pr-2">Error</th>
                          <th className="text-left py-1 pr-2"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {fullAnalysisResult.results.map((r, i) => {
                          const isAnalyzed = r.status === "ANALYZED";
                          const key = `${r.index}-${r.name}`;
                          const isExpanded = expandedMassiveDetail === key;
                          const riskBadge = isAnalyzed && r.analysis?.executiveSummary.riskLevel === "CRITICAL" ? "text-red-600" :
                            isAnalyzed && r.analysis?.executiveSummary.riskLevel === "WARNING" ? "text-yellow-600" : "text-emerald-600";
                          return (
                            <tr key={`${i}-row`} className="border-b border-border/30">
                              <td className="py-1 pr-2 text-muted-foreground">{i + 1}</td>
                              <td className="py-1 pr-2 font-mono break-all max-w-[180px]">{r.name}</td>
                              <td className="py-1 pr-2">{isAnalyzed ? (
                                <span className="text-emerald-600 font-medium">Analizado</span>
                              ) : (
                                <span className="text-red-600 font-medium">Fallido</span>
                              )}</td>
                              <td className="py-1 pr-2 font-mono max-w-[100px] truncate">{isAnalyzed ? (r.analysis?.uuid ?? "—") : "—"}</td>
                              <td className="py-1 pr-2">{isAnalyzed ? (r.analysis?.tipoComprobante ?? "—") : "—"}</td>
                              <td className="py-1 pr-2 font-mono">{isAnalyzed ? (r.analysis?.rfcEmisor ?? "—") : "—"}</td>
                              <td className="py-1 pr-2 font-mono">{isAnalyzed ? (r.analysis?.rfcReceptor ?? "—") : "—"}</td>
                              <td className="py-1 pr-2">{isAnalyzed ? (r.analysis?.total ?? "—") : "—"}</td>
                              <td className="py-1 pr-2">{isAnalyzed ? (r.analysis?.moneda ?? "—") : "—"}</td>
                              <td className={`py-1 pr-2 ${riskBadge}`}>{isAnalyzed ? (r.analysis?.executiveSummary.riskLevel ?? "—") : "—"}</td>
                              <td className="py-1 pr-2">{isAnalyzed ? (r.analysis?.findings?.filter(f => f.severity === "CRITICAL").length ?? 0) : "—"}</td>
                              <td className="py-1 pr-2">{isAnalyzed ? (r.analysis?.findings?.filter(f => f.severity === "WARNING").length ?? 0) : "—"}</td>
                              <td className="py-1 pr-2">{isAnalyzed ? (r.analysis?.findings?.filter(f => f.severity === "INFO").length ?? 0) : "—"}</td>
                              <td className="py-1 pr-2">{isAnalyzed ? (r.analysis?.technicalDiagnostics.bomDetected ? "Sí" : "No") : "—"}</td>
                              <td className="py-1 pr-2">{isAnalyzed ? (r.analysis?.normalizedXml?.available ? "Sí" : "No") : "—"}</td>
                              <td className="py-1 pr-2 text-red-600 max-w-[120px] break-all">{r.status === "FAILED" ? (r.errorMessage ?? r.errorCode ?? "Error") : "—"}</td>
                              <td className="py-1 pr-2">
                                <button onClick={() => toggleMassiveDetail(key)} className="text-primary font-semibold hover:underline whitespace-nowrap">
                                  {isExpanded ? "Ocultar detalle" : "Ver detalle"}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {fullAnalysisResult.results.map((r, i) => {
                    const key = `${r.index}-${r.name}`;
                    const isExpanded = expandedMassiveDetail === key;
                    if (!isExpanded) return null;
                    return (
                      <div key={`detail-${i}`} className="p-4 rounded-lg border border-border bg-card space-y-4">
                        <p className="text-xs font-semibold text-muted-foreground">Detalle: {r.name}</p>

                        {r.status === "FAILED" && (
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between py-1 border-b border-border/50">
                              <span className="text-muted-foreground">Archivo</span>
                              <span className="font-medium">{r.name}</span>
                            </div>
                            <div className="flex justify-between py-1 border-b border-border/50">
                              <span className="text-muted-foreground">Estado</span>
                              <span className="font-medium text-red-600">Fallido</span>
                            </div>
                            <div className="flex justify-between py-1 border-b border-border/50">
                              <span className="text-muted-foreground">Código de error</span>
                              <span className="font-medium font-mono">{r.errorCode ?? "—"}</span>
                            </div>
                            <div className="flex justify-between py-1 border-b border-border/50">
                              <span className="text-muted-foreground">Mensaje de error</span>
                              <span className="font-medium">{r.errorMessage ?? "—"}</span>
                            </div>
                          </div>
                        )}

                        {r.status === "ANALYZED" && r.analysis && (() => {
                          const a = r.analysis!;
                          const levelStyles: Record<string, string> = {
                            OK: "text-emerald-700 bg-emerald-50 border-emerald-200",
                            WARNING: "text-yellow-700 bg-yellow-50 border-yellow-200",
                            CRITICAL: "text-red-700 bg-red-50 border-red-200",
                          };
                          const levelLabels: Record<string, string> = {
                            OK: "Sin riesgo crítico detectado",
                            WARNING: "Revisión recomendada",
                            CRITICAL: "Incidencia crítica",
                          };
                          const s = levelStyles[a.executiveSummary.riskLevel] ?? levelStyles.WARNING;
                          const badge: Record<string, { label: string; style: string }> = {
                            INFO: { label: "Informativo", style: "text-blue-700 bg-blue-50 border-blue-200" },
                            WARNING: { label: "Advertencia", style: "text-yellow-700 bg-yellow-50 border-yellow-200" },
                            CRITICAL: { label: "Crítico", style: "text-red-700 bg-red-50 border-red-200" },
                          };
                          const criticals = a.findings?.filter(f => f.severity === "CRITICAL") ?? [];
                          const warnings = a.findings?.filter(f => f.severity === "WARNING") ?? [];
                          const infos = a.findings?.filter(f => f.severity === "INFO") ?? [];
                          return (
                            <>
                              <div className="space-y-2">
                                <p className="text-sm font-semibold">Resumen ejecutivo</p>
                                <div className={`p-3 rounded-lg border ${s} space-y-1`}>
                                  <div className="flex items-center justify-between">
                                    <p className="font-medium text-sm">{a.executiveSummary.title}</p>
                                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${s}`}>
                                      {levelLabels[a.executiveSummary.riskLevel] ?? a.executiveSummary.riskLevel}
                                    </span>
                                  </div>
                                  <p className="text-sm text-muted-foreground">{a.executiveSummary.message}</p>
                                  <p className="text-sm text-muted-foreground">
                                    <span className="font-semibold">Acción recomendada:</span> {a.executiveSummary.recommendedAction}
                                  </p>
                                </div>
                              </div>

                              <div className="space-y-2">
                                <p className="text-sm font-semibold">Hallazgos</p>
                                <div className="flex gap-3 text-xs">
                                  <span className="px-2 py-0.5 rounded-full bg-red-50 border border-red-200 text-red-700 font-bold">Críticos: {criticals.length}</span>
                                  <span className="px-2 py-0.5 rounded-full bg-yellow-50 border border-yellow-200 text-yellow-700 font-bold">Advertencias: {warnings.length}</span>
                                  <span className="px-2 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 font-bold">Informativos: {infos.length}</span>
                                </div>
                                {a.findings && a.findings.length > 0 ? (
                                  <div className="space-y-2">
                                    {a.findings.map((f, fIdx) => {
                                      const b = badge[f.severity] ?? badge.INFO;
                                      return (
                                        <div key={fIdx} className={`p-3 rounded-lg border ${b.style} space-y-1`}>
                                          <div className="flex items-center gap-2 flex-wrap">
                                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${b.style}`}>{b.label}</span>
                                            <span className="text-xs text-muted-foreground font-mono">{f.category}</span>
                                            <span className="text-xs text-muted-foreground font-mono">{f.code}</span>
                                          </div>
                                          <p className="text-sm font-medium">{f.title}</p>
                                          <p className="text-sm text-muted-foreground">{f.message}</p>
                                          {f.recommendedAction && (
                                            <p className="text-xs text-muted-foreground">
                                              <span className="font-semibold">Acción recomendada:</span> {f.recommendedAction}
                                            </p>
                                          )}
                                          {f.evidence && f.evidence.length > 0 && (
                                            <div className="space-y-0.5 pt-1 border-t border-border/40 mt-1">
                                              <p className="text-xs font-semibold text-muted-foreground">Evidencia</p>
                                              <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
                                                {f.evidence.map((e, eIdx) => (
                                                  <div key={eIdx} className="contents">
                                                    <span className="text-muted-foreground whitespace-nowrap">{e.label}:</span>
                                                    <span className="font-mono text-foreground/80 break-all">{e.value ?? "—"}</span>
                                                  </div>
                                                ))}
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <p className="text-sm text-muted-foreground">No se detectaron hallazgos estructurados.</p>
                                )}
                              </div>

                              <div className="space-y-2">
                                <p className="text-sm font-semibold">Diagnóstico técnico</p>
                                <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                                  <div className="flex justify-between py-1 border-b border-border/50">
                                    <span className="text-muted-foreground">XML timbrado</span>
                                    <span className={a.technicalDiagnostics.isStamped ? "text-emerald-600 font-medium" : "text-yellow-600 font-medium"}>{a.technicalDiagnostics.isStamped ? "Sí" : "No"}</span>
                                  </div>
                                  <div className="flex justify-between py-1 border-b border-border/50">
                                    <span className="text-muted-foreground">Timbre Fiscal Digital</span>
                                    <span className={a.technicalDiagnostics.hasTimbreFiscalDigital ? "text-emerald-600 font-medium" : "text-yellow-600 font-medium"}>{a.technicalDiagnostics.hasTimbreFiscalDigital ? "Sí" : "No"}</span>
                                  </div>
                                  <div className="flex justify-between py-1 border-b border-border/50">
                                    <span className="text-muted-foreground">BOM UTF-8 detectado</span>
                                    <span className="font-medium">{a.technicalDiagnostics.bomDetected ? "Sí" : "No"}</span>
                                  </div>
                                  <div className="flex justify-between py-1 border-b border-border/50">
                                    <span className="text-muted-foreground">Contenido previo al XML</span>
                                    <span className="font-medium">{a.technicalDiagnostics.leadingContentBeforeXml ? "Sí" : "No"}</span>
                                  </div>
                                  <div className="flex justify-between py-1 border-b border-border/50">
                                    <span className="text-muted-foreground">Normalización segura aplicada</span>
                                    <span className="font-medium">{a.technicalDiagnostics.safeNormalizationApplied ? "Sí" : "No"}</span>
                                  </div>
                                </div>
                                {a.technicalDiagnostics.safeNormalizationNotes?.length > 0 && (
                                  <div className="space-y-0.5">
                                    <p className="text-xs font-semibold text-muted-foreground">Notas de normalización</p>
                                    <ul className="space-y-0.5">
                                      {a.technicalDiagnostics.safeNormalizationNotes.map((note, nIdx) => (
                                        <li key={nIdx} className="text-sm text-muted-foreground flex items-center gap-1">
                                          <span className="text-blue-500">i</span> {note}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>

                              <div className="space-y-2">
                                <p className="text-sm font-semibold">Diagnóstico estructural</p>
                                <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                                  <div className="flex justify-between py-1 border-b border-border/50">
                                    <span className="text-muted-foreground">Tiene Complemento</span>
                                    <span className="font-medium">{a.structureDiagnostics.hasComplemento ? "Sí" : "No"}</span>
                                  </div>
                                  <div className="flex justify-between py-1 border-b border-border/50">
                                    <span className="text-muted-foreground">Tiene Addenda</span>
                                    <span className="font-medium">{a.structureDiagnostics.hasAddenda ? "Sí" : "No"}</span>
                                  </div>
                                </div>
                                {a.structureDiagnostics.namespaces?.length > 0 && (
                                  <div className="space-y-0.5">
                                    <p className="text-xs font-semibold text-muted-foreground">Namespaces</p>
                                    <div className="flex flex-wrap gap-1">
                                      {a.structureDiagnostics.namespaces.map((ns, nsIdx) => (
                                        <span key={nsIdx} className="text-xs bg-muted px-2 py-0.5 rounded font-mono">{ns}</span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {a.structureDiagnostics.complementNames?.length > 0 && (
                                  <div className="space-y-0.5">
                                    <p className="text-xs font-semibold text-muted-foreground">Complementos detectados</p>
                                    <div className="flex flex-wrap gap-1">
                                      {a.structureDiagnostics.complementNames.map((name, nIdx) => (
                                        <span key={nIdx} className="text-xs bg-muted px-2 py-0.5 rounded font-mono">{name}</span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {a.structureDiagnostics.knownComplements?.length > 0 && (
                                  <div className="space-y-0.5">
                                    <p className="text-xs font-semibold text-muted-foreground">Complementos clasificados</p>
                                    <div className="flex flex-wrap gap-1">
                                      {a.structureDiagnostics.knownComplements.map((name, nIdx) => (
                                        <span key={nIdx} className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-mono">{name}</span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {a.structureDiagnostics.unknownComplements?.length > 0 && (
                                  <div className="space-y-0.5">
                                    <p className="text-xs font-semibold text-muted-foreground">Complementos no clasificados</p>
                                    <div className="flex flex-wrap gap-1">
                                      {a.structureDiagnostics.unknownComplements.map((name, nIdx) => (
                                        <span key={nIdx} className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded font-mono">{name}</span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {a.structureDiagnostics.nodeShapeNotes?.length > 0 && (
                                  <div className="space-y-0.5">
                                    <p className="text-xs font-semibold text-muted-foreground">Notas de estructura</p>
                                    <ul className="space-y-0.5">
                                      {a.structureDiagnostics.nodeShapeNotes.map((note, nIdx) => (
                                        <li key={nIdx} className="text-sm text-muted-foreground flex items-center gap-1">
                                          <span className="text-blue-500">i</span> {note}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>

                              {a.normalizedXml && (
                                <div className="space-y-2">
                                  <p className="text-sm font-semibold">XML normalizado</p>
                                  <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                                    <div className="flex justify-between py-1 border-b border-border/50">
                                      <span className="text-muted-foreground">Disponible</span>
                                      <span className="font-medium">{a.normalizedXml.available ? "Sí" : "No"}</span>
                                    </div>
                                    <div className="flex justify-between py-1 border-b border-border/50">
                                      <span className="text-muted-foreground">Archivo</span>
                                      <span className="font-medium font-mono">{a.normalizedXml.filename}</span>
                                    </div>
                                    <div className="flex justify-between py-1 border-b border-border/50">
                                      <span className="text-muted-foreground">Tipo normalización</span>
                                      <span className="font-medium">{a.normalizedXml.normalizationType}</span>
                                    </div>
                                    <div className="flex justify-between py-1 border-b border-border/50">
                                      <span className="text-muted-foreground">Contenido fiscal modificado</span>
                                      <span className="font-medium">{a.normalizedXml.fiscalContentModified ? "Sí" : "No"}</span>
                                    </div>
                                    <div className="flex justify-between py-1 border-b border-border/50">
                                      <span className="text-muted-foreground">Riesgo timbre/sello</span>
                                      <span className="font-medium">{a.normalizedXml.stampRisk}</span>
                                    </div>
                                    <div className="flex justify-between py-1 border-b border-border/50 col-span-2">
                                      <span className="text-muted-foreground">Hash original SHA-256</span>
                                      <span className="font-mono text-xs break-all max-w-[300px] text-right">{a.normalizedXml.originalSha256}</span>
                                    </div>
                                    <div className="flex justify-between py-1 border-b border-border/50 col-span-2">
                                      <span className="text-muted-foreground">Hash normalizado SHA-256</span>
                                      <span className="font-mono text-xs break-all max-w-[300px] text-right">{a.normalizedXml.normalizedSha256}</span>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    );
                  })}
                  {/* TODO: En fase posterior, implementar descarga masiva:
                    - Generar ZIP con XMLs normalizados técnicamente cuando aplique (BOM, contenido previo).
                    - No incluir XMLs que requieran reparación fiscal en timbrados.
                    - Para XML no timbrados, descarga de reparados solo después de flujo asistido y confirmación explícita.
                    - Incluir manifiesto de trazabilidad por archivo. */}
                </div>
              )}
              <button
                onClick={handleExportMassiveCsv}
                className="w-full py-2.5 px-4 rounded-lg border border-primary text-primary font-semibold text-sm hover:bg-primary hover:text-primary-foreground transition-all"
              >
                Exportar análisis masivo CSV
              </button>
            </div>
          )}

          {zipFile && ((zipResult && zipResult.technicalSummary.filesWithSafeNormalizationAvailable > 0) || (fullAnalysisResult && fullAnalysisResult.summary.filesWithTechnicalNormalization > 0)) && (
            <div className="p-4 rounded-lg border border-blue-200 bg-blue-50 space-y-3">
              <p className="text-sm font-semibold text-blue-800">XMLs normalizables detectados</p>
              <div className="grid grid-cols-3 gap-x-6 gap-y-1 text-sm">
                {zipResult && (
                  <>
                    <div className="flex justify-between py-1 border-b border-blue-200/50">
                      <span className="text-blue-600">XMLs con BOM</span>
                      <span className="font-medium text-blue-800">{zipResult.technicalSummary.filesWithBom}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-blue-200/50">
                      <span className="text-blue-600">XMLs con contenido previo</span>
                      <span className="font-medium text-blue-800">{zipResult.technicalSummary.filesWithLeadingContent}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-blue-200/50">
                      <span className="text-blue-600">Normalización segura disponible</span>
                      <span className="font-medium text-blue-800">{zipResult.technicalSummary.filesWithSafeNormalizationAvailable}</span>
                    </div>
                  </>
                )}
                {fullAnalysisResult && (
                  <>
                    <div className="flex justify-between py-1 border-b border-blue-200/50 col-span-3">
                      <span className="text-blue-600">XMLs con normalización técnica (análisis completo)</span>
                      <span className="font-medium text-blue-800">{fullAnalysisResult.summary.filesWithTechnicalNormalization}</span>
                    </div>
                  </>
                )}
              </div>
              <p className="text-sm text-blue-700">
                Estos XMLs presentan problemas técnicos reparables. Fiscora puede generar una versión normalizada sin modificar contenido fiscal ni timbre/sello.
              </p>
              {fullAnalysisResult && Object.keys(fullAnalysisResult.summary.byTipoComprobante).length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-blue-700">Tipos de comprobante detectados</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(fullAnalysisResult.summary.byTipoComprobante).map(([tipo, count]) => (
                      <span key={tipo} className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-mono">{tipo}: {count}</span>
                    ))}
                  </div>
                </div>
              )}
              <p className="text-xs text-blue-600">
                La descarga incluirá únicamente XMLs cuya normalización sea técnica segura. Los XMLs sin ajustes o con reparaciones fiscales no seguras quedarán solo en el manifiesto.
              </p>
              <button
                onClick={handleDownloadNormalized}
                disabled={normalizedZipLoading}
                className="w-full py-2.5 rounded-lg bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 disabled:opacity-50 transition-all"
              >
                {normalizedZipLoading ? "Generando ZIP de XMLs normalizados..." : "Descargar ZIP de XMLs normalizados"}
              </button>
              <p className="text-xs text-blue-500">
                El ZIP incluirá una carpeta normalized/ y un manifiesto con trazabilidad por archivo.
              </p>
              {normalizedZipError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{normalizedZipError}</p>
              )}
            </div>
          )}
        </div>

          {result && (
          <>
            {result.executiveSummary && (() => {
              const levelStyles: Record<string, { badge: string; border: string }> = {
                OK: { badge: "text-emerald-700 bg-emerald-50 border-emerald-200", border: "border-emerald-200" },
                WARNING: { badge: "text-yellow-700 bg-yellow-50 border-yellow-200", border: "border-yellow-200" },
                CRITICAL: { badge: "text-red-700 bg-red-50 border-red-200", border: "border-red-200" },
              };
              const levelLabels: Record<string, string> = {
                OK: "Sin riesgo crítico detectado",
                WARNING: "Revisión recomendada",
                CRITICAL: "Incidencia crítica",
              };
              const s = levelStyles[result.executiveSummary.riskLevel] ?? levelStyles.WARNING;
              return (
                <div className={`p-6 rounded-xl border ${s.border} bg-card space-y-3`}>
                  <div className="flex items-center justify-between">
                    <h2 className="font-semibold text-lg">Resumen ejecutivo</h2>
                    <span className={`text-xs font-bold px-3 py-1 rounded-full border ${s.badge}`}>
                      {levelLabels[result.executiveSummary.riskLevel] ?? result.executiveSummary.riskLevel}
                    </span>
                  </div>
                  <p className="font-medium text-sm">{result.executiveSummary.title}</p>
                  <p className="text-sm text-muted-foreground">{result.executiveSummary.message}</p>
                  <p className="text-sm text-muted-foreground">
                    <span className="font-semibold">Acción recomendada:</span> {result.executiveSummary.recommendedAction}
                  </p>
                </div>
              );
            })()}

            {result.findings && (
              <div className="p-6 rounded-xl border border-border bg-card space-y-4">
                <h2 className="font-semibold text-lg">Hallazgos del análisis</h2>
                {result.findings.length > 0 ? (
                  <>
                    <div className="flex gap-4 text-sm">
                      <span className="px-3 py-1 rounded-full bg-red-50 border border-red-200 text-red-700 font-bold text-xs">
                        Críticos: {result.findings.filter(f => f.severity === "CRITICAL").length}
                      </span>
                      <span className="px-3 py-1 rounded-full bg-yellow-50 border border-yellow-200 text-yellow-700 font-bold text-xs">
                        Advertencias: {result.findings.filter(f => f.severity === "WARNING").length}
                      </span>
                      <span className="px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 font-bold text-xs">
                        Informativos: {result.findings.filter(f => f.severity === "INFO").length}
                      </span>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {(["ALL", "CRITICAL", "WARNING", "INFO"] as const).map((s) => {
                        const labels: Record<string, string> = { ALL: "Todos", CRITICAL: "Críticos", WARNING: "Advertencias", INFO: "Informativos" };
                        const active = filter === s;
                        return (
                          <button
                            key={s}
                            onClick={() => setFilter(s)}
                            className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-all ${
                              active
                                ? "bg-foreground text-background border-foreground"
                                : "bg-transparent text-muted-foreground border-border hover:border-foreground hover:text-foreground"
                            }`}
                          >
                            {labels[s]}
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <span className="text-xs text-muted-foreground self-center font-medium">Categoría:</span>
                      {(["ALL", "TOTALS", "FISCAL", "TAX", "TECHNICAL", "STRUCTURE", "COMPLEMENT"] as const).map((c) => {
                        const catLabels: Record<string, string> = { ALL: "Todas", TOTALS: "Totales", FISCAL: "Fiscal", TAX: "Impuestos", TECHNICAL: "Técnico", STRUCTURE: "Estructura", COMPLEMENT: "Complementos" };
                        const active = categoryFilter === c;
                        return (
                          <button
                            key={c}
                            onClick={() => setCategoryFilter(c)}
                            className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-all ${
                              active
                                ? "bg-foreground text-background border-foreground"
                                : "bg-transparent text-muted-foreground border-border hover:border-foreground hover:text-foreground"
                            }`}
                          >
                            {catLabels[c]}
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex gap-3 text-xs text-muted-foreground">
                      <span>Totales: {result.findings.filter(f => f.category === "TOTALS").length}</span>
                      <span>Fiscal: {result.findings.filter(f => f.category === "FISCAL").length}</span>
                      <span>Impuestos: {result.findings.filter(f => f.category === "TAX").length}</span>
                      <span>Técnico: {result.findings.filter(f => f.category === "TECHNICAL").length}</span>
                      <span>Estructura: {result.findings.filter(f => f.category === "STRUCTURE").length}</span>
                      <span>Complementos: {result.findings.filter(f => f.category === "COMPLEMENT").length}</span>
                    </div>
                    <div className="space-y-3">
                      {(() => {
                        let filtered = result.findings;
                        if (filter !== "ALL") filtered = filtered.filter(f => f.severity === filter);
                        if (categoryFilter !== "ALL") filtered = filtered.filter(f => f.category === categoryFilter);
                        if (filtered.length === 0) {
                          return <p className="text-sm text-muted-foreground">No hay hallazgos para los filtros seleccionados.</p>;
                        }
                        const badge: Record<string, { label: string; style: string }> = {
                          INFO: { label: "Informativo", style: "text-blue-700 bg-blue-50 border-blue-200" },
                          WARNING: { label: "Advertencia", style: "text-yellow-700 bg-yellow-50 border-yellow-200" },
                          CRITICAL: { label: "Crítico", style: "text-red-700 bg-red-50 border-red-200" },
                        };
                        return filtered.map((f, i) => {
                          const b = badge[f.severity] ?? badge.INFO;
                          return (
                            <div key={i} className={`p-4 rounded-lg border ${b.style} space-y-2`}>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${b.style}`}>{b.label}</span>
                                <span className="text-xs text-muted-foreground font-mono">{f.category}</span>
                                <span className="text-xs text-muted-foreground font-mono">{f.code}</span>
                              </div>
                              <p className="text-sm font-medium">{f.title}</p>
                              <p className="text-sm text-muted-foreground">{f.message}</p>
                              {f.recommendedAction && (
                                <p className="text-xs text-muted-foreground">
                                  <span className="font-semibold">Acción recomendada:</span> {f.recommendedAction}
                                </p>
                              )}
                              {f.evidence && f.evidence.length > 0 && (() => {
                                const findingKey = f.id ?? f.code;
                                const isExpanded = expandedEvidence.has(findingKey);
                                const visibleEvidence = isExpanded ? f.evidence : f.evidence.slice(0, 4);
                                const hasMore = f.evidence.length > 4;
                                return (
                                  <div className="space-y-1 pt-1 border-t border-border/40 mt-2">
                                    <p className="text-xs font-semibold text-muted-foreground pt-1">Evidencia detectada</p>
                                    <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5 text-xs">
                                      {visibleEvidence.map((e, eIdx) => (
                                        <div key={eIdx} className="contents">
                                          <span className="text-muted-foreground whitespace-nowrap">{e.label}:</span>
                                          <span className="font-mono text-foreground/80 break-all">{e.value ?? "—"}</span>
                                        </div>
                                      ))}
                                    </div>
                                    {hasMore && (
                                      <button
                                        onClick={() => toggleEvidence(findingKey)}
                                        className="text-xs font-semibold text-primary hover:underline mt-1"
                                      >
                                        {isExpanded ? "Ver menos" : `Ver más evidencia (${f.evidence.length - 4} restantes)`}
                                      </button>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">No se detectaron hallazgos estructurados.</p>
                )}
              </div>
            )}

            {result.paymentComplement && (
              <div className="p-6 rounded-xl border border-border bg-card space-y-4">
                <h2 className="font-semibold text-lg">Complemento de pago</h2>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Versión complemento</span>
                    <span className="font-medium">{result.paymentComplement.version ?? "—"}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Total de pagos detectados</span>
                    <span className="font-medium">{result.paymentComplement.pagos.length}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Total de documentos relacionados</span>
                    <span className="font-medium">
                      {result.paymentComplement.pagos.reduce((acc, p) => acc + p.documentosRelacionados.length, 0)}
                    </span>
                  </div>
                </div>

                {result.paymentComplement.pagos.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No se detectaron pagos dentro del complemento.</p>
                ) : (
                  result.paymentComplement.pagos.map((pago, idx) => (
                    <div key={idx} className="space-y-3 border-t border-border/50 pt-3 first:border-t-0 first:pt-0">
                      <h3 className="text-sm font-semibold">Pago {idx + 1}</h3>
                      <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                        <div className="flex justify-between py-1 border-b border-border/50">
                          <span className="text-muted-foreground">Fecha de pago</span>
                          <span className="font-medium">{pago.fechaPago ?? "—"}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-border/50">
                          <span className="text-muted-foreground">Forma de pago</span>
                          <span className="font-medium">{pago.formaDePagoP ?? "—"}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-border/50">
                          <span className="text-muted-foreground">Moneda</span>
                          <span className="font-medium">{pago.monedaP ?? "—"}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-border/50">
                          <span className="text-muted-foreground">Monto</span>
                          <span className="font-medium">{pago.monto ?? "—"}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-border/50">
                          <span className="text-muted-foreground">Tipo de cambio</span>
                          <span className="font-medium">{pago.tipoCambioP ?? "—"}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-border/50">
                          <span className="text-muted-foreground">Número de operación</span>
                          <span className="font-medium">{pago.numOperacion ?? "—"}</span>
                        </div>
                      </div>

                      {pago.documentosRelacionados.length > 0 ? (
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs border-collapse">
                            <thead>
                              <tr className="border-b border-border/50 text-muted-foreground">
                                <th className="text-left py-1 pr-2">UUID</th>
                                <th className="text-left py-1 pr-2">Serie</th>
                                <th className="text-left py-1 pr-2">Folio</th>
                                <th className="text-left py-1 pr-2">Moneda DR</th>
                                <th className="text-left py-1 pr-2">Equivalencia</th>
                                <th className="text-left py-1 pr-2">Parcialidad</th>
                                <th className="text-left py-1 pr-2">Saldo ant.</th>
                                <th className="text-left py-1 pr-2">Pagado</th>
                                <th className="text-left py-1 pr-2">Saldo insoluto</th>
                                <th className="text-left py-1 pr-2">Objeto imp.</th>
                              </tr>
                            </thead>
                            <tbody>
                              {pago.documentosRelacionados.map((doc, dIdx) => (
                                <tr key={dIdx} className="border-b border-border/30">
                                  <td className="py-1 pr-2 font-mono break-all max-w-[120px]">{doc.idDocumento ?? "—"}</td>
                                  <td className="py-1 pr-2">{doc.serie ?? "—"}</td>
                                  <td className="py-1 pr-2">{doc.folio ?? "—"}</td>
                                  <td className="py-1 pr-2">{doc.monedaDR ?? "—"}</td>
                                  <td className="py-1 pr-2">{doc.equivalenciaDR ?? "—"}</td>
                                  <td className="py-1 pr-2">{doc.numParcialidad ?? "—"}</td>
                                  <td className="py-1 pr-2">{doc.impSaldoAnt ?? "—"}</td>
                                  <td className="py-1 pr-2">{doc.impPagado ?? "—"}</td>
                                  <td className="py-1 pr-2">{doc.impSaldoInsoluto ?? "—"}</td>
                                  <td className="py-1 pr-2">{doc.objetoImpDR ?? "—"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">Este pago no contiene documentos relacionados.</p>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            <div className="p-6 rounded-xl border border-border bg-card space-y-4">
              <h2 className="font-semibold text-lg">Diagnóstico técnico del archivo</h2>

              {!result.technicalDiagnostics.isStamped && (
                <p className="text-sm text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3">
                  Este XML no contiene TimbreFiscalDigital. Podría tratarse de un comprobante no timbrado.
                </p>
              )}

              {(result.technicalDiagnostics.bomDetected || result.technicalDiagnostics.leadingContentBeforeXml) && (
                <p className="text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
                  Se aplicó una normalización técnica segura solo en memoria para poder leer el archivo. No se modificó el contenido fiscal del XML.
                </p>
              )}

              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">XML timbrado</span>
                  <span className={result.technicalDiagnostics.isStamped ? "text-emerald-600 font-medium" : "text-yellow-600 font-medium"}>
                    {result.technicalDiagnostics.isStamped ? "Sí" : "No"}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Timbre Fiscal Digital detectado</span>
                  <span className={result.technicalDiagnostics.hasTimbreFiscalDigital ? "text-emerald-600 font-medium" : "text-yellow-600 font-medium"}>
                    {result.technicalDiagnostics.hasTimbreFiscalDigital ? "Sí" : "No"}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">BOM UTF-8 detectado</span>
                  <span className="font-medium">{result.technicalDiagnostics.bomDetected ? "Sí" : "No"}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Contenido antes del inicio del XML</span>
                  <span className="font-medium">{result.technicalDiagnostics.leadingContentBeforeXml ? "Sí" : "No"}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Normalización segura aplicada</span>
                  <span className="font-medium">{result.technicalDiagnostics.safeNormalizationApplied ? "Sí" : "No"}</span>
                </div>
              </div>

              {result.technicalDiagnostics.safeNormalizationNotes.length > 0 && (
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-muted-foreground">Normalizaciones aplicadas</p>
                  <ul className="space-y-1">
                    {result.technicalDiagnostics.safeNormalizationNotes.map((note, i) => (
                      <li key={i} className="text-sm text-muted-foreground flex items-center gap-2">
                        <span className="text-blue-500">i</span> {note}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {result.normalizedXml?.available && (() => {
                const nx = result.normalizedXml!;
                function handleDownloadNormalized() {
                  const blob = new Blob([nx.content], { type: "application/xml" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = nx.filename;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                }
                return (
                  <div className="p-4 rounded-lg border border-blue-200 bg-blue-50 space-y-3">
                    <p className="text-sm font-semibold text-blue-800">XML normalizado disponible</p>
                    <p className="text-sm text-blue-700">
                      Se detectó un problema técnico de codificación o contenido previo al XML. Fiscora generó una versión normalizada sin modificar el contenido fiscal ni el timbre del CFDI.
                    </p>
                    <button
                      onClick={handleDownloadNormalized}
                      className="w-full py-2 px-4 rounded-lg bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 transition-all"
                    >
                      Descargar XML normalizado
                    </button>
                    <div className="space-y-1 pt-1 border-t border-blue-200/60">
                      <p className="text-xs font-semibold text-blue-800">Trazabilidad técnica</p>
                      <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
                        <span className="text-blue-600 whitespace-nowrap">Hash original:</span>
                        <span className="font-mono text-blue-800 break-all">{nx.originalSha256}</span>
                        <span className="text-blue-600 whitespace-nowrap">Hash normalizado:</span>
                        <span className="font-mono text-blue-800 break-all">{nx.normalizedSha256}</span>
                        <span className="text-blue-600 whitespace-nowrap">Contenido fiscal modificado:</span>
                        <span className="font-mono text-blue-800">No</span>
                        <span className="text-blue-600 whitespace-nowrap">Riesgo para timbre/sello:</span>
                        <span className="font-mono text-blue-800">Ninguno</span>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="p-6 rounded-xl border border-border bg-card space-y-4">
              <h2 className="font-semibold text-lg">Diagnóstico estructural del XML</h2>

              {result.structureDiagnostics.hasAddenda && (
                <p className="text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
                  El XML contiene Addenda. Se conserva como información adicional y no forma parte de la validación fiscal base.
                </p>
              )}

              {result.structureDiagnostics.unknownComplements.length > 0 && (
                <p className="text-sm text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3">
                  El XML contiene complementos no clasificados por el motor actual. Esto no significa que el XML sea inválido; puede requerir una revisión especializada según el proceso.
                </p>
              )}

              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Tiene Complemento</span>
                  <span className="font-medium">{result.structureDiagnostics.hasComplemento ? "Sí" : "No"}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Tiene Addenda</span>
                  <span className="font-medium">{result.structureDiagnostics.hasAddenda ? "Sí" : "No"}</span>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-sm font-semibold text-muted-foreground">Namespaces detectados</p>
                {result.structureDiagnostics.namespaces.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {result.structureDiagnostics.namespaces.map((ns, i) => (
                      <span key={i} className="text-xs bg-muted px-2 py-0.5 rounded font-mono">{ns}</span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No se detectaron namespaces declarados.</p>
                )}
              </div>

              <div className="space-y-1">
                <p className="text-sm font-semibold text-muted-foreground">Complementos detectados</p>
                {result.structureDiagnostics.complementNames.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {result.structureDiagnostics.complementNames.map((name, i) => (
                      <span key={i} className="text-xs bg-muted px-2 py-0.5 rounded font-mono">{name}</span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No se detectaron complementos.</p>
                )}
              </div>

              <div className="space-y-1">
                <p className="text-sm font-semibold text-muted-foreground">Complementos clasificados</p>
                {result.structureDiagnostics.knownComplements.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {result.structureDiagnostics.knownComplements.map((name, i) => (
                      <span key={i} className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-mono">{name}</span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Ninguno.</p>
                )}
              </div>

              <div className="space-y-1">
                <p className="text-sm font-semibold text-muted-foreground">Complementos no clasificados</p>
                {result.structureDiagnostics.unknownComplements.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {result.structureDiagnostics.unknownComplements.map((name, i) => (
                      <span key={i} className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded font-mono">{name}</span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Ninguno.</p>
                )}
              </div>

              {result.structureDiagnostics.nodeShapeNotes.length > 0 && (
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-muted-foreground">Notas de estructura</p>
                  <ul className="space-y-1">
                    {result.structureDiagnostics.nodeShapeNotes.map((note, i) => (
                      <li key={i} className="text-sm text-muted-foreground flex items-center gap-2">
                        <span className="text-blue-500">i</span> {note}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {result.concepts && (
              <div className="p-6 rounded-xl border border-border bg-card space-y-4">
                <h2 className="font-semibold text-lg">Conceptos del CFDI</h2>
                <div className="flex justify-between py-1 border-b border-border/50 text-sm">
                  <span className="text-muted-foreground">Total de conceptos detectados</span>
                  <span className="font-medium">{result.concepts.length}</span>
                </div>

                {result.concepts.length > 0 ? (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-border/50 text-muted-foreground">
                            <th className="text-left py-1 pr-2 whitespace-nowrap">ClaveProdServ</th>
                            <th className="text-left py-1 pr-2 whitespace-nowrap">No. identificación</th>
                            <th className="text-left py-1 pr-2 whitespace-nowrap">Cantidad</th>
                            <th className="text-left py-1 pr-2 whitespace-nowrap">Clave unidad</th>
                            <th className="text-left py-1 pr-2 whitespace-nowrap">Unidad</th>
                            <th className="text-left py-1 pr-2 whitespace-nowrap">Descripción</th>
                            <th className="text-left py-1 pr-2 whitespace-nowrap">Valor unitario</th>
                            <th className="text-left py-1 pr-2 whitespace-nowrap">Importe</th>
                            <th className="text-left py-1 pr-2 whitespace-nowrap">Descuento</th>
                            <th className="text-left py-1 pr-2 whitespace-nowrap">Objeto imp.</th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.concepts.map((c, i) => (
                            <tr key={i} className="border-b border-border/30">
                              <td className="py-1 pr-2 font-mono">{c.claveProdServ ?? "—"}</td>
                              <td className="py-1 pr-2">{c.noIdentificacion ?? "—"}</td>
                              <td className="py-1 pr-2">{c.cantidad ?? "—"}</td>
                              <td className="py-1 pr-2">{c.claveUnidad ?? "—"}</td>
                              <td className="py-1 pr-2">{c.unidad ?? "—"}</td>
                              <td className="py-1 pr-2 max-w-[200px] truncate" title={c.descripcion}>{c.descripcion ?? "—"}</td>
                              <td className="py-1 pr-2">{c.valorUnitario ?? "—"}</td>
                              <td className="py-1 pr-2">{c.importe ?? "—"}</td>
                              <td className="py-1 pr-2">{c.descuento ?? "—"}</td>
                              <td className="py-1 pr-2">{c.objetoImp ?? "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold">Impuestos por concepto</h3>
                      {result.concepts.map((c, idx) => (
                        <div key={idx} className="border-t border-border/50 pt-3 space-y-2">
                          <p className="text-sm font-medium">
                            Concepto #{idx + 1} — {c.descripcion ?? "(sin descripción)"} {c.importe ? `— ${c.importe}` : ""}
                          </p>
                          {c.impuestos ? (
                            <>
                              {c.impuestos.traslados.length > 0 && (
                                <div className="overflow-x-auto">
                                  <p className="text-xs font-semibold text-muted-foreground mb-1">Traslados</p>
                                  <table className="w-full text-xs border-collapse">
                                    <thead>
                                      <tr className="border-b border-border/50 text-muted-foreground">
                                        <th className="text-left py-1 pr-2">Base</th>
                                        <th className="text-left py-1 pr-2">Impuesto</th>
                                        <th className="text-left py-1 pr-2">Tipo factor</th>
                                        <th className="text-left py-1 pr-2">Tasa o cuota</th>
                                        <th className="text-left py-1 pr-2">Importe</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {c.impuestos.traslados.map((t, tIdx) => (
                                        <tr key={tIdx} className="border-b border-border/30">
                                          <td className="py-1 pr-2">{t.base ?? "—"}</td>
                                          <td className="py-1 pr-2">{t.impuesto ?? "—"}</td>
                                          <td className="py-1 pr-2">{t.tipoFactor ?? "—"}</td>
                                          <td className="py-1 pr-2">{t.tasaOCuota ?? "—"}</td>
                                          <td className="py-1 pr-2">{t.importe ?? "—"}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                              {c.impuestos.retenciones.length > 0 && (
                                <div className="overflow-x-auto">
                                  <p className="text-xs font-semibold text-muted-foreground mb-1">Retenciones</p>
                                  <table className="w-full text-xs border-collapse">
                                    <thead>
                                      <tr className="border-b border-border/50 text-muted-foreground">
                                        <th className="text-left py-1 pr-2">Base</th>
                                        <th className="text-left py-1 pr-2">Impuesto</th>
                                        <th className="text-left py-1 pr-2">Tipo factor</th>
                                        <th className="text-left py-1 pr-2">Tasa o cuota</th>
                                        <th className="text-left py-1 pr-2">Importe</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {c.impuestos.retenciones.map((r, rIdx) => (
                                        <tr key={rIdx} className="border-b border-border/30">
                                          <td className="py-1 pr-2">{r.base ?? "—"}</td>
                                          <td className="py-1 pr-2">{r.impuesto ?? "—"}</td>
                                          <td className="py-1 pr-2">{r.tipoFactor ?? "—"}</td>
                                          <td className="py-1 pr-2">{r.tasaOCuota ?? "—"}</td>
                                          <td className="py-1 pr-2">{r.importe ?? "—"}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                              {c.impuestos.traslados.length === 0 && c.impuestos.retenciones.length === 0 && (
                                <p className="text-sm text-muted-foreground">Este concepto no contiene impuestos a nivel concepto.</p>
                              )}
                            </>
                          ) : (
                            <p className="text-sm text-muted-foreground">Este concepto no contiene impuestos a nivel concepto.</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">No se detectaron conceptos fiscales en este XML.</p>
                )}
              </div>
            )}

            {result.taxSummary && (
              <div className="p-6 rounded-xl border border-border bg-card space-y-4">
                <h2 className="font-semibold text-lg">Resumen de impuestos</h2>

                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-muted-foreground">Trasladados</h3>
                  {result.taxSummary.transferred.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-border/50 text-muted-foreground">
                            <th className="text-left py-1 pr-2 whitespace-nowrap">Impuesto</th>
                            <th className="text-left py-1 pr-2 whitespace-nowrap">Tipo factor</th>
                            <th className="text-left py-1 pr-2 whitespace-nowrap">Tasa o cuota</th>
                            <th className="text-left py-1 pr-2 whitespace-nowrap">Base calculada</th>
                            <th className="text-left py-1 pr-2 whitespace-nowrap">Importe calculado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.taxSummary.transferred.map((t, i) => (
                            <tr key={i} className="border-b border-border/30">
                              <td className="py-1 pr-2 font-medium">{t.impuestoLabel} ({t.impuesto})</td>
                              <td className="py-1 pr-2">{t.tipoFactor ?? "—"}</td>
                              <td className="py-1 pr-2">{t.tasaOCuota ?? "—"}</td>
                              <td className="py-1 pr-2">{t.baseCalculated}</td>
                              <td className="py-1 pr-2">{t.importeCalculated}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No se detectaron impuestos trasladados por concepto.</p>
                  )}
                </div>

                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-muted-foreground">Retenidos</h3>
                  {result.taxSummary.retained.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-border/50 text-muted-foreground">
                            <th className="text-left py-1 pr-2 whitespace-nowrap">Impuesto</th>
                            <th className="text-left py-1 pr-2 whitespace-nowrap">Tipo factor</th>
                            <th className="text-left py-1 pr-2 whitespace-nowrap">Tasa o cuota</th>
                            <th className="text-left py-1 pr-2 whitespace-nowrap">Base calculada</th>
                            <th className="text-left py-1 pr-2 whitespace-nowrap">Importe calculado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.taxSummary.retained.map((r, i) => (
                            <tr key={i} className="border-b border-border/30">
                              <td className="py-1 pr-2 font-medium">{r.impuestoLabel} ({r.impuesto})</td>
                              <td className="py-1 pr-2">{r.tipoFactor ?? "—"}</td>
                              <td className="py-1 pr-2">{r.tasaOCuota ?? "—"}</td>
                              <td className="py-1 pr-2">{r.baseCalculated}</td>
                              <td className="py-1 pr-2">{r.importeCalculated}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No se detectaron impuestos retenidos por concepto.</p>
                  )}
                </div>
              </div>
            )}

            {result.totalsValidation && (
              <div className="p-6 rounded-xl border border-border bg-card space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold text-lg">Validación de totales</h2>
                  <span className={`text-xs font-bold px-3 py-1 rounded-full border ${
                    result.totalsValidation.matches
                      ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                      : "text-red-700 bg-red-50 border-red-200"
                  }`}>
                    {result.totalsValidation.matches ? "Totales consistentes" : "Diferencias detectadas"}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Subtotal XML</span>
                    <span className="font-medium">{result.totalsValidation.subtotalXml ?? "—"}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Subtotal calculado</span>
                    <span className="font-medium">{result.totalsValidation.subtotalCalculated ?? "—"}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Descuento calculado</span>
                    <span className="font-medium">{result.totalsValidation.discountCalculated ?? "—"}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50"></div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Impuestos trasladados XML</span>
                    <span className="font-medium">{result.totalsValidation.transferredTaxesXml ?? "—"}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Impuestos trasladados calculados</span>
                    <span className="font-medium">{result.totalsValidation.transferredTaxesCalculated ?? "—"}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Impuestos retenidos XML</span>
                    <span className="font-medium">{result.totalsValidation.retainedTaxesXml ?? "—"}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Impuestos retenidos calculados</span>
                    <span className="font-medium">{result.totalsValidation.retainedTaxesCalculated ?? "—"}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Total XML</span>
                    <span className="font-medium">{result.totalsValidation.totalXml ?? "—"}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Total calculado</span>
                    <span className="font-medium">{result.totalsValidation.totalCalculated ?? "—"}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Diferencia</span>
                    <span className="font-medium">{result.totalsValidation.difference ?? "—"}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Tolerancia</span>
                    <span className="font-medium">{result.totalsValidation.tolerance}</span>
                  </div>
                </div>
              </div>
            )}

            <div className="p-6 rounded-xl border border-border bg-card space-y-4">
            <h2 className="font-semibold text-lg">Resultado del análisis</h2>

            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <div className="flex justify-between py-1 border-b border-border/50 col-span-2">
                <span className="text-muted-foreground">UUID</span>
                <span className="font-mono text-xs text-right max-w-[300px] break-all">{result.uuid ?? "—"}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">Tipo de comprobante</span>
                <span className="font-medium">{result.tipoComprobante ?? "—"}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">Versión CFDI</span>
                <span className="font-medium">{result.version ?? "—"}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">RFC emisor</span>
                <span className="font-medium">{result.rfcEmisor ?? "—"}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">Nombre emisor</span>
                <span className="font-medium">{result.nombreEmisor ?? "—"}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">RFC receptor</span>
                <span className="font-medium">{result.rfcReceptor ?? "—"}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">Nombre receptor</span>
                <span className="font-medium">{result.nombreReceptor ?? "—"}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">Fecha</span>
                <span className="font-medium">{result.fecha ?? "—"}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">{result.subtotal ?? "—"}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">Total</span>
                <span className="font-medium">{result.total ?? "—"}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">Moneda</span>
                <span className="font-medium">{result.moneda ?? "—"}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">Serie</span>
                <span className="font-medium">{result.serie ?? "—"}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">Folio</span>
                <span className="font-medium">{result.folio ?? "—"}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">Uso CFDI</span>
                <span className="font-medium">{result.usoCfdi ?? "—"}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">Método de pago</span>
                <span className="font-medium">{result.metodoPago ?? "—"}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">Forma de pago</span>
                <span className="font-medium">{result.formaPago ?? "—"}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">Fecha de timbrado</span>
                <span className="font-medium">{result.fechaTimbrado ?? "—"}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">Total impuestos trasladados</span>
                <span className="font-medium">{result.totalImpuestosTrasladados ?? "—"}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">Total impuestos retenidos</span>
                <span className="font-medium">{result.totalImpuestosRetenidos ?? "—"}</span>
              </div>
            </div>

            {result.findings ? (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-muted-foreground">Compatibilidad técnica</h3>
                <p className="text-sm text-muted-foreground bg-muted/50 rounded-lg px-4 py-3">
                  Las incidencias y advertencias tradicionales se conservan internamente por compatibilidad. Consulta los hallazgos estructurados para el diagnóstico principal.
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-muted-foreground">Incidencias</h3>
                  {result.issues.length > 0 ? (
                    <ul className="space-y-1">
                      {result.issues.map((issue, i) => (
                        <li key={i} className="text-sm text-red-500 flex items-center gap-2">
                          <span>⚠</span> {issue}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-emerald-600">Sin incidencias detectadas</p>
                  )}
                </div>
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-muted-foreground">Advertencias</h3>
                  {result.warnings.length > 0 ? (
                    <ul className="space-y-1">
                      {result.warnings.map((w, i) => (
                        <li key={i} className="text-sm text-yellow-600 flex items-center gap-2">
                          <span>!</span> {w}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-emerald-600">Sin advertencias</p>
                  )}
                </div>
              </>
            )}
          </div>
          </>
        )}

        {result && (() => {
          const r = result;
          function handleExportJson() {
            const payload = {
              generatedAt: new Date().toISOString(),
              uuid: r.uuid,
              tipoComprobante: r.tipoComprobante,
              rfcEmisor: r.rfcEmisor,
              nombreEmisor: r.nombreEmisor,
              rfcReceptor: r.rfcReceptor,
              nombreReceptor: r.nombreReceptor,
              fecha: r.fecha,
              total: r.total,
              subtotal: r.subtotal,
              moneda: r.moneda,
              version: r.version,
              serie: r.serie,
              folio: r.folio,
              usoCfdi: r.usoCfdi,
              metodoPago: r.metodoPago,
              formaPago: r.formaPago,
              fechaTimbrado: r.fechaTimbrado,
              totalImpuestosTrasladados: r.totalImpuestosTrasladados,
              totalImpuestosRetenidos: r.totalImpuestosRetenidos,
              issues: r.issues,
              warnings: r.warnings,
              executiveSummary: r.executiveSummary,
              findings: r.findings,
              technicalDiagnostics: r.technicalDiagnostics,
              structureDiagnostics: r.structureDiagnostics,
              paymentComplement: r.paymentComplement,
              concepts: r.concepts,
              taxSummary: r.taxSummary,
              totalsValidation: r.totalsValidation,
              normalizedXml: r.normalizedXml
                ? {
                    available: r.normalizedXml.available,
                    reason: r.normalizedXml.reason,
                    filename: r.normalizedXml.filename,
                    originalSha256: r.normalizedXml.originalSha256,
                    normalizedSha256: r.normalizedXml.normalizedSha256,
                    normalizationType: r.normalizedXml.normalizationType,
                    fiscalContentModified: r.normalizedXml.fiscalContentModified,
                    stampRisk: r.normalizedXml.stampRisk,
                  }
                : undefined,
            };
            const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
            const suffix = r.uuid ?? ts;
            a.download = `fiscora-analisis-xml-${suffix}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }
          function escCsv(val: string): string {
            const v = val.replace(/"/g, '""');
            return /[",\n\r]/.test(v) ? `"${v}"` : v;
          }
          function formatEvidence(evidence: { label: string; value?: string }[] | undefined): string {
            if (!evidence || evidence.length === 0) return "";
            return evidence.map(e => `${e.label}: ${e.value ?? "—"}`).join(" | ");
          }
          function handleExportCsv() {
            if (!r.findings || r.findings.length === 0) return;
            const header = "ID,Severidad,Categoria,Codigo,Titulo,Mensaje,Accion recomendada,Evidencia";
            const rows = r.findings.map(f => {
              const cols = [
                escCsv(f.id),
                escCsv(f.severity),
                escCsv(f.category),
                escCsv(f.code),
                escCsv(f.title),
                escCsv(f.message),
                escCsv(f.recommendedAction ?? ""),
                escCsv(formatEvidence(f.evidence)),
              ];
              return cols.join(",");
            });
            const bom = "\uFEFF";
            const csv = bom + header + "\r\n" + rows.join("\r\n");
            const blob = new Blob([csv], { type: "text/csv;charset=utf-8;header=present" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
            const suffix = r.uuid ?? ts;
            a.download = `fiscora-hallazgos-xml-${suffix}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }
          // TODO: Reemplazar multi-section CSV por generación real .xlsx usando librería como exceljs o xlsx cuando se agregue como dependencia
          function handleExportExcel() {
            const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
            const suffix = r.uuid ?? ts;
            const bom = "\uFEFF";
            const lines: string[] = [];

            function section(title: string) {
              lines.push("");
              lines.push(`"${title}"`);
              lines.push("");
            }
            function row(...vals: (string | null | undefined)[]) {
              lines.push(vals.map(v => escCsv(v ?? "—")).join(","));
            }
            function sub(header: string, data: Record<string, string | null | undefined>) {
              lines.push(escCsv(header));
              for (const [k, v] of Object.entries(data)) {
                row(k, v ?? "—");
              }
              lines.push("");
            }

            section("RESUMEN EJECUTIVO");
            sub("", {
              "Nivel de riesgo": r.executiveSummary.riskLevel,
              Título: r.executiveSummary.title,
              Mensaje: r.executiveSummary.message,
              "Acción recomendada": r.executiveSummary.recommendedAction,
            });

            section("METADATA FISCAL");
            sub("", {
              UUID: r.uuid,
              "Tipo comprobante": r.tipoComprobante,
              "RFC emisor": r.rfcEmisor,
              "Nombre emisor": r.nombreEmisor,
              "RFC receptor": r.rfcReceptor,
              "Nombre receptor": r.nombreReceptor,
              Fecha: r.fecha,
              "Serie": r.serie,
              Folio: r.folio,
              Subtotal: r.subtotal,
              Total: r.total,
              Moneda: r.moneda,
              "Versión CFDI": r.version,
              "Uso CFDI": r.usoCfdi,
              "Método pago": r.metodoPago,
              "Forma pago": r.formaPago,
              "Fecha timbrado": r.fechaTimbrado,
              "Total impuestos trasladados": r.totalImpuestosTrasladados,
              "Total impuestos retenidos": r.totalImpuestosRetenidos,
            });

            section("HALLAZGOS");
            if (r.findings && r.findings.length > 0) {
              row("ID", "Severidad", "Categoría", "Código", "Título", "Mensaje", "Acción recomendada");
              for (const f of r.findings) {
                row(f.id, f.severity, f.category, f.code, f.title, f.message, f.recommendedAction ?? "");
              }
              lines.push("");
              section("EVIDENCIA DE HALLAZGOS");
              row("ID hallazgo", "Label", "Valor");
              for (const f of r.findings) {
                if (f.evidence) {
                  for (const e of f.evidence) {
                    row(f.id, e.label, e.value ?? "—");
                  }
                }
              }
            } else {
              row("No se detectaron hallazgos");
            }

            section("DIAGNÓSTICO TÉCNICO");
            sub("", {
              "XML timbrado": r.technicalDiagnostics.isStamped ? "Sí" : "No",
              "Timbre Fiscal Digital": r.technicalDiagnostics.hasTimbreFiscalDigital ? "Sí" : "No",
              "BOM UTF-8 detectado": r.technicalDiagnostics.bomDetected ? "Sí" : "No",
              "Contenido previo al XML": r.technicalDiagnostics.leadingContentBeforeXml ? "Sí" : "No",
              "Normalización segura aplicada": r.technicalDiagnostics.safeNormalizationApplied ? "Sí" : "No",
            });
            if (r.technicalDiagnostics.safeNormalizationNotes.length > 0) {
              lines.push(escCsv("Notas de normalización"));
              for (const n of r.technicalDiagnostics.safeNormalizationNotes) {
                row(n);
              }
              lines.push("");
            }

            section("DIAGNÓSTICO ESTRUCTURAL");
            sub("", {
              "Tiene complemento": r.structureDiagnostics.hasComplemento ? "Sí" : "No",
              "Tiene addenda": r.structureDiagnostics.hasAddenda ? "Sí" : "No",
            });
            if (r.structureDiagnostics.namespaces.length > 0) {
              lines.push(escCsv("Namespaces"));
              for (const ns of r.structureDiagnostics.namespaces) row(ns);
              lines.push("");
            }
            if (r.structureDiagnostics.complementNames.length > 0) {
              lines.push(escCsv("Complementos detectados"));
              for (const c of r.structureDiagnostics.complementNames) row(c);
              lines.push("");
            }

            if (r.paymentComplement) {
              section("COMPLEMENTO DE PAGO");
              sub("", {
                Versión: r.paymentComplement.version ?? "—",
                "Total pagos": String(r.paymentComplement.pagos.length),
              });
              for (let i = 0; i < r.paymentComplement.pagos.length; i++) {
                const p = r.paymentComplement.pagos[i];
                lines.push("");
                lines.push(escCsv(`Pago ${i + 1}`));
                sub("", {
                  "Fecha pago": p.fechaPago,
                  "Forma pago": p.formaDePagoP,
                  Moneda: p.monedaP,
                  Monto: p.monto,
                  "Tipo cambio": p.tipoCambioP,
                  "Núm. operación": p.numOperacion,
                });
                if (p.documentosRelacionados.length > 0) {
                  lines.push(escCsv("Documentos relacionados"));
                  row("UUID", "Serie", "Folio", "Moneda DR", "Equivalencia", "Parcialidad", "Saldo ant.", "Pagado", "Saldo insoluto", "Objeto imp.");
                  for (const d of p.documentosRelacionados) {
                    row(d.idDocumento, d.serie, d.folio, d.monedaDR, d.equivalenciaDR, d.numParcialidad, d.impSaldoAnt, d.impPagado, d.impSaldoInsoluto, d.objetoImpDR);
                  }
                }
              }
            }

            if (r.concepts && r.concepts.length > 0) {
              section("CONCEPTOS");
              row("ClaveProdServ", "No. identificación", "Cantidad", "Clave unidad", "Unidad", "Descripción", "Valor unitario", "Importe", "Descuento", "Objeto imp.");
              for (const c of r.concepts) {
                row(c.claveProdServ, c.noIdentificacion, c.cantidad, c.claveUnidad, c.unidad, c.descripcion, c.valorUnitario, c.importe, c.descuento, c.objetoImp);
              }
              lines.push("");
              section("IMPUESTOS POR CONCEPTO");
              row("Concepto #", "Tipo", "Base", "Impuesto", "Tipo factor", "Tasa o cuota", "Importe");
              for (let i = 0; i < r.concepts.length; i++) {
                const c = r.concepts[i];
                const label = `Concepto #${i + 1}`;
                if (c.impuestos) {
                  for (const t of c.impuestos.traslados) row(label, "Traslado", t.base, t.impuesto, t.tipoFactor, t.tasaOCuota, t.importe);
                  for (const t of c.impuestos.retenciones) row(label, "Retención", t.base, t.impuesto, t.tipoFactor, t.tasaOCuota, t.importe);
                }
              }
            }

            if (r.taxSummary) {
              section("RESUMEN DE IMPUESTOS");
              if (r.taxSummary.transferred.length > 0) {
                lines.push(escCsv("Trasladados"));
                row("Impuesto", "Tipo factor", "Tasa o cuota", "Base calculada", "Importe calculado");
                for (const t of r.taxSummary.transferred) row(t.impuestoLabel, t.tipoFactor, t.tasaOCuota, t.baseCalculated, t.importeCalculated);
                lines.push("");
              }
              if (r.taxSummary.retained.length > 0) {
                lines.push(escCsv("Retenidos"));
                row("Impuesto", "Tipo factor", "Tasa o cuota", "Base calculada", "Importe calculado");
                for (const t of r.taxSummary.retained) row(t.impuestoLabel, t.tipoFactor, t.tasaOCuota, t.baseCalculated, t.importeCalculated);
                lines.push("");
              }
            }

            if (r.totalsValidation) {
              section("VALIDACIÓN DE TOTALES");
              sub("", {
                "Subtotal XML": r.totalsValidation.subtotalXml,
                "Subtotal calculado": r.totalsValidation.subtotalCalculated,
                "Descuento calculado": r.totalsValidation.discountCalculated,
                "Impuestos trasladados XML": r.totalsValidation.transferredTaxesXml,
                "Impuestos trasladados calculados": r.totalsValidation.transferredTaxesCalculated,
                "Impuestos retenidos XML": r.totalsValidation.retainedTaxesXml,
                "Impuestos retenidos calculados": r.totalsValidation.retainedTaxesCalculated,
                "Total XML": r.totalsValidation.totalXml,
                "Total calculado": r.totalsValidation.totalCalculated,
                Diferencia: r.totalsValidation.difference,
                Tolerancia: r.totalsValidation.tolerance,
                Coinciden: r.totalsValidation.matches ? "Sí" : "No",
              });
            }

            if (r.normalizedXml) {
              section("NORMALIZACIÓN TÉCNICA");
              sub("", {
                Disponible: r.normalizedXml.available ? "Sí" : "No",
                Archivo: r.normalizedXml.filename,
                "Tipo normalización": r.normalizedXml.normalizationType,
                "Contenido fiscal modificado": r.normalizedXml.fiscalContentModified ? "Sí" : "No",
                "Riesgo timbre/sello": r.normalizedXml.stampRisk,
                "Hash original SHA-256": r.normalizedXml.originalSha256,
                "Hash normalizado SHA-256": r.normalizedXml.normalizedSha256,
              });
            }

            const csv = bom + "\r\n" + lines.join("\r\n");
            const blob = new Blob([csv], { type: "text/csv;charset=utf-8;header=present" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `fiscora-analisis-xml-${suffix}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }
          return (
            <div className="flex flex-col gap-2">
              <button
                onClick={handleExportJson}
                className="w-full py-2.5 px-4 rounded-lg border border-primary text-primary font-semibold text-sm hover:bg-primary hover:text-primary-foreground transition-all"
              >
                Exportar resultado JSON
              </button>
              {r.findings && r.findings.length > 0 && (
                <button
                  onClick={handleExportCsv}
                  className="w-full py-2.5 px-4 rounded-lg border border-primary text-primary font-semibold text-sm hover:bg-primary hover:text-primary-foreground transition-all"
                >
                  Exportar hallazgos CSV
                </button>
              )}
              <button
                onClick={handleExportExcel}
                className="w-full py-2.5 px-4 rounded-lg border border-primary text-primary font-semibold text-sm hover:bg-primary hover:text-primary-foreground transition-all"
              >
                Exportar análisis Excel (CSV)
              </button>
            </div>
          );
        })()}
        <button
          onClick={() => navigate("/dashboard")}
          className="w-full py-2.5 px-4 rounded-lg border border-border text-foreground font-semibold text-sm hover:bg-muted transition-all"
        >
          Volver al dashboard
        </button>
      </div>
    </div>
  );
}
