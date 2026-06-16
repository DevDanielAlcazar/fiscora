import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { getMe } from "../api/auth";
import {
  analyzeXml,
  analyzeZipInventory,
  analyzeZipFull,
  downloadNormalizedZip,
  type AnalysisResult,
  type ZipInventoryResult,
  type ZipFullAnalysisResult,
  type ZipFullAnalysisFileResult,
  type Finding,
} from "../api/xml-audit";

const priorityOrder: Record<string, number> = { BLOCKER: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
const severityOrder: Record<string, number> = { CRITICAL: 0, WARNING: 1, INFO: 2 };
const categoryOrder: Record<string, number> = {
  TOTALS: 0, TAX: 1, COMPLEMENT: 2, FISCAL: 3, TECHNICAL: 4, STRUCTURE: 5,
};

function getPriorityLabel(p: string | undefined): string {
  const labels: Record<string, string> = { BLOCKER: "Bloqueante", HIGH: "Alta", MEDIUM: "Media", LOW: "Informativa" };
  return labels[p ?? ""] ?? "—";
}

function sortFindingsByPriority(findings: Finding[]): Finding[] {
  return [...findings].sort((a, b) => {
    const pa = priorityOrder[a.priority ?? "LOW"] ?? 3;
    const pb = priorityOrder[b.priority ?? "LOW"] ?? 3;
    if (pa !== pb) return pa - pb;
    const sa = severityOrder[a.severity] ?? 2;
    const sb = severityOrder[b.severity] ?? 2;
    if (sa !== sb) return sa - sb;
    return (categoryOrder[a.category] ?? 99) - (categoryOrder[b.category] ?? 99);
  });
}

function groupFindingsByActionGroup(findings: Finding[]): Record<string, Finding[]> {
  const groups: Record<string, Finding[]> = {};
  for (const f of findings) {
    const g = f.actionGroup ?? "Informativo";
    if (!groups[g]) groups[g] = [];
    groups[g].push(f);
  }
  return groups;
}

export default function XmlAuditPage() {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filter, setFilter] = useState<"ALL" | "CRITICAL" | "WARNING" | "INFO">("ALL");
  const [priorityFilter, setPriorityFilter] = useState<"ALL" | "BLOCKER" | "HIGH" | "MEDIUM" | "LOW">("ALL");
  const [categoryFilter, setCategoryFilter] = useState<
    "ALL" | "TOTALS" | "FISCAL" | "TAX" | "TECHNICAL" | "STRUCTURE" | "COMPLEMENT"
  >("ALL");
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
  const [normalizedZipSuccess, setNormalizedZipSuccess] = useState("");
  const [selectedMassiveDetail, setSelectedMassiveDetail] =
    useState<ZipFullAnalysisFileResult | null>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setSelectedMassiveDetail(null);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [selectedMassiveDetail]);

  function toggleEvidence(code: string) {
    setExpandedEvidence((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
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
      setPriorityFilter("ALL");
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
    setNormalizedZipSuccess("");
    setSelectedMassiveDetail(null);
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
      lines.push(vals.map((v) => escCsvMassive(v ?? "—")).join(","));
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
    const warningsGlobales = r.warnings.length > 0 ? r.warnings.join(" | ") : "—";
    row("Warnings globales", warningsGlobales);

    section("RESULTADOS POR XML");
    const resultHeader = [
      "#",
      "Archivo",
      "Tamaño bytes",
      "Estado",
      "Código error",
      "Mensaje error",
      "UUID",
      "Tipo comprobante",
      "RFC emisor",
      "Nombre emisor",
      "RFC receptor",
      "Nombre receptor",
      "Fecha CFDI",
      "Subtotal",
      "Total",
      "Moneda",
      "Versión",
      "Serie",
      "Folio",
      "Riesgo",
      "Título resumen ejecutivo",
      "Mensaje resumen ejecutivo",
      "Acción recomendada",
      "Total hallazgos",
      "Críticos",
      "Advertencias",
      "Informativos",
      "BOM",
      "Timbre Fiscal Digital",
      "XML timbrado",
      "Normalización segura aplicada",
      "XML normalizado disponible",
      "Archivo normalizado",
      "Tipo normalización",
      "Contenido fiscal modificado",
      "Riesgo timbre/sello",
      "Hash original SHA-256",
      "Hash normalizado SHA-256",
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
        isA ? findings.filter((f) => f.severity === "CRITICAL").length : 0,
        isA ? findings.filter((f) => f.severity === "WARNING").length : 0,
        isA ? findings.filter((f) => f.severity === "INFO").length : 0,
        isA ? (td?.bomDetected ? "Sí" : "No") : "",
        isA ? (td?.hasTimbreFiscalDigital ? "Sí" : "No") : "",
        isA ? (td?.isStamped ? "Sí" : "No") : "",
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
    row(
      "Archivo",
      "Finding ID",
      "Severidad",
      "Categoría",
      "Código",
      "Título",
      "Mensaje",
      "Acción recomendada",
      "Evidencia",
    );
    for (const f of r.results) {
      if (f.status !== "ANALYZED" || !f.analysis?.findings) continue;
      for (const finding of f.analysis.findings) {
        const evidenceStr = finding.evidence
          ? finding.evidence.map((e) => `${e.label}: ${e.value ?? "—"}`).join(" | ")
          : "";
        row(
          f.name,
          finding.id,
          finding.severity,
          finding.category,
          finding.code,
          finding.title,
          finding.message,
          finding.recommendedAction ?? "",
          evidenceStr,
        );
      }
    }

    const csv = bom + "\r\n" + lines.join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;header=present" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const zipBase = r.filename
      ? r.filename.replace(/\.zip$/i, "").replace(/[^a-zA-Z0-9_-]/g, "_")
      : "masivo";
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
    setNormalizedZipSuccess("");
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
      setNormalizedZipSuccess("ZIP de XMLs normalizados generado correctamente.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("No hay XMLs con normalización técnica")) {
        setNormalizedZipError("No hay XMLs con normalización técnica disponible para descargar.");
      } else if (
        msg.includes("ZIP_NOT_ALLOWED") ||
        msg.includes("no permite auditoría XML masiva")
      ) {
        setNormalizedZipError("Tu plan actual no permite auditoría XML masiva con ZIP.");
      } else {
        setNormalizedZipError(
          "No fue posible generar el ZIP de XMLs normalizados. Intenta nuevamente.",
        );
      }
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
    setNormalizedZipSuccess("");
    setSelectedMassiveDetail(null);
    setFullAnalysisLoading(true);

    try {
      const result = await analyzeZipFull(token, zipFile);
      setFullAnalysisResult(result);
    } catch (err) {
      setFullAnalysisError(
        err instanceof Error ? err.message : "No fue posible analizar los XMLs del ZIP.",
      );
    } finally {
      setFullAnalysisLoading(false);
    }
  }

  function handleZipFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setZipError("");
    setZipResult(null);
    setFullAnalysisResult(null);
    setFullAnalysisError("");
    setNormalizedZipError("");
    setNormalizedZipSuccess("");
    setSelectedMassiveDetail(null);
    const file = e.target.files?.[0] ?? null;
    setZipFile(file);
  }

  const normalizedZipStats = (() => {
    if (fullAnalysisResult) {
      return {
        filesWithTechnicalNormalization: fullAnalysisResult.summary.filesWithTechnicalNormalization,
        filesWithBom: fullAnalysisResult.summary.filesWithBom,
        filesWithLeadingContent: null as number | null,
        sourceLabel: "Análisis completo",
      };
    }
    if (zipResult) {
      return {
        filesWithTechnicalNormalization:
          zipResult.technicalSummary.filesWithSafeNormalizationAvailable,
        filesWithBom: zipResult.technicalSummary.filesWithBom,
        filesWithLeadingContent: zipResult.technicalSummary.filesWithLeadingContent,
        sourceLabel: "Inventario técnico",
      };
    }
    return null;
  })();

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
                  <span className="font-medium">
                    {zipResult.technicalSummary.filesWithLeadingContent}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Normalización segura disponible</span>
                  <span className="font-medium">
                    {zipResult.technicalSummary.filesWithSafeNormalizationAvailable}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">XMLs sin inicio XML válido</span>
                  <span className="font-medium">
                    {zipResult.technicalSummary.filesWithoutXmlStart}
                  </span>
                </div>
              </div>

              {zipResult.warnings.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground">Advertencias</p>
                  {zipResult.warnings.map((w, i) => (
                    <p
                      key={i}
                      className="text-sm text-yellow-600 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2"
                    >
                      {w}
                    </p>
                  ))}
                </div>
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
                            <td className="py-1 pr-2 font-mono break-all max-w-[220px]">
                              {f.name}
                            </td>
                            <td className="py-1 pr-2">{f.sizeBytes.toLocaleString()} bytes</td>
                            <td className="py-1 pr-2">
                              {f.technicalDiagnostics.bomDetected ? "Sí" : "No"}
                            </td>
                            <td className="py-1 pr-2">
                              {f.technicalDiagnostics.leadingContentBeforeXml ? "Sí" : "No"}
                            </td>
                            <td className="py-1 pr-2">
                              {f.technicalDiagnostics.safeNormalizationAvailable ? "Sí" : "No"}
                            </td>
                            <td className="py-1 pr-2">
                              {f.technicalDiagnostics.startsWithXml ? "Sí" : "No"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No se encontraron archivos XML dentro del ZIP.
                </p>
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
            <p className="text-sm text-red-500 bg-red-500/10 rounded-lg px-4 py-3">
              {fullAnalysisError}
            </p>
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
                  <span className="font-medium text-red-600">
                    {fullAnalysisResult.summary.criticalCount}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Advertencias</span>
                  <span className="font-medium text-yellow-600">
                    {fullAnalysisResult.summary.warningCount}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">OK</span>
                  <span className="font-medium text-emerald-600">
                    {fullAnalysisResult.summary.okCount}
                  </span>
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
                  <span className="font-medium">
                    {fullAnalysisResult.summary.filesWithTechnicalNormalization}
                  </span>
                </div>
                {fullAnalysisResult.usage && (
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Consumo registrado</span>
                    <span className="font-medium text-xs">
                      {fullAnalysisResult.usage.units} uso por ZIP
                    </span>
                  </div>
                )}
                {fullAnalysisResult.persistence && (
                  <>
                    <div className="flex justify-between py-1 border-b border-border/50">
                      <span className="text-muted-foreground">Persistencia temporal</span>
                      <span className="font-medium text-xs">
                        {fullAnalysisResult.persistence.recordsSaved} de{" "}
                        {fullAnalysisResult.persistence.recordsAttempted} registros guardados por{" "}
                        {fullAnalysisResult.persistence.retentionHours}h
                      </span>
                    </div>
                    {fullAnalysisResult.persistence.failedRecordsAttempted != null &&
                      fullAnalysisResult.persistence.failedRecordsAttempted > 0 && (
                        <div className="flex justify-between py-1 border-b border-border/50">
                          <span className="text-muted-foreground">Incluye XMLs fallidos</span>
                          <span className="font-medium text-xs">
                            {fullAnalysisResult.persistence.failedRecordsAttempted} registros FAILED
                          </span>
                        </div>
                      )}
                  </>
                )}
              </div>

              {Object.keys(fullAnalysisResult.summary.byTipoComprobante).length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground">
                    Tipos de comprobante detectados
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(fullAnalysisResult.summary.byTipoComprobante).map(
                      ([tipo, count]) => (
                        <span key={tipo} className="text-xs bg-muted px-2 py-0.5 rounded font-mono">
                          {tipo}: {count}
                        </span>
                      ),
                    )}
                  </div>
                </div>
              )}

              {fullAnalysisResult.warnings.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground">Advertencias</p>
                  {fullAnalysisResult.warnings.map((w, i) => (
                    <p
                      key={i}
                      className="text-sm text-yellow-600 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2"
                    >
                      {w}
                    </p>
                  ))}
                </div>
              )}

              {fullAnalysisResult.results.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground">
                    Resultados por archivo
                  </p>
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
                          const riskBadge =
                            isAnalyzed && r.analysis?.executiveSummary.riskLevel === "CRITICAL"
                              ? "text-red-600"
                              : isAnalyzed && r.analysis?.executiveSummary.riskLevel === "WARNING"
                                ? "text-yellow-600"
                                : "text-emerald-600";
                          return (
                            <tr key={`${i}-row`} className="border-b border-border/30">
                              <td className="py-1 pr-2 text-muted-foreground">{i + 1}</td>
                              <td className="py-1 pr-2 font-mono break-all max-w-[180px]">
                                {r.name}
                              </td>
                              <td className="py-1 pr-2">
                                {isAnalyzed ? (
                                  <span className="text-emerald-600 font-medium">Analizado</span>
                                ) : (
                                  <span className="text-red-600 font-medium">Fallido</span>
                                )}
                              </td>
                              <td className="py-1 pr-2 font-mono max-w-[100px] truncate">
                                {isAnalyzed ? (r.analysis?.uuid ?? "—") : "—"}
                              </td>
                              <td className="py-1 pr-2">
                                {isAnalyzed ? (r.analysis?.tipoComprobante ?? "—") : "—"}
                              </td>
                              <td className="py-1 pr-2 font-mono">
                                {isAnalyzed ? (r.analysis?.rfcEmisor ?? "—") : "—"}
                              </td>
                              <td className="py-1 pr-2 font-mono">
                                {isAnalyzed ? (r.analysis?.rfcReceptor ?? "—") : "—"}
                              </td>
                              <td className="py-1 pr-2">
                                {isAnalyzed ? (r.analysis?.total ?? "—") : "—"}
                              </td>
                              <td className="py-1 pr-2">
                                {isAnalyzed ? (r.analysis?.moneda ?? "—") : "—"}
                              </td>
                              <td className={`py-1 pr-2 ${riskBadge}`}>
                                {isAnalyzed ? (r.analysis?.executiveSummary.riskLevel ?? "—") : "—"}
                              </td>
                              <td className="py-1 pr-2">
                                {isAnalyzed
                                  ? (r.analysis?.findings?.filter((f) => f.severity === "CRITICAL")
                                      .length ?? 0)
                                  : "—"}
                              </td>
                              <td className="py-1 pr-2">
                                {isAnalyzed
                                  ? (r.analysis?.findings?.filter((f) => f.severity === "WARNING")
                                      .length ?? 0)
                                  : "—"}
                              </td>
                              <td className="py-1 pr-2">
                                {isAnalyzed
                                  ? (r.analysis?.findings?.filter((f) => f.severity === "INFO")
                                      .length ?? 0)
                                  : "—"}
                              </td>
                              <td className="py-1 pr-2">
                                {isAnalyzed
                                  ? r.analysis?.technicalDiagnostics.bomDetected
                                    ? "Sí"
                                    : "No"
                                  : "—"}
                              </td>
                              <td className="py-1 pr-2">
                                {isAnalyzed
                                  ? r.analysis?.normalizedXml?.available
                                    ? "Sí"
                                    : "No"
                                  : "—"}
                              </td>
                              <td className="py-1 pr-2 text-red-600 max-w-[120px] break-all">
                                {r.status === "FAILED"
                                  ? (r.errorMessage ?? r.errorCode ?? "Error")
                                  : "—"}
                              </td>
                              <td className="py-1 pr-2">
                                <button
                                  onClick={() => setSelectedMassiveDetail(r)}
                                  className="text-primary font-semibold hover:underline whitespace-nowrap"
                                >
                                  Ver detalle
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
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

          {zipFile &&
            normalizedZipStats &&
            normalizedZipStats.filesWithTechnicalNormalization > 0 && (
              <div className="p-4 rounded-lg border border-blue-200 bg-blue-50 space-y-3">
                <p className="text-sm font-semibold text-blue-800">XMLs normalizables detectados</p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                  <div className="flex justify-between py-1 border-b border-blue-200/50">
                    <span className="text-blue-600">XMLs con normalización técnica disponible</span>
                    <span className="font-medium text-blue-800">
                      {normalizedZipStats.filesWithTechnicalNormalization}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-blue-200/50">
                    <span className="text-blue-600">XMLs con BOM</span>
                    <span className="font-medium text-blue-800">
                      {normalizedZipStats.filesWithBom}
                    </span>
                  </div>
                  {normalizedZipStats.filesWithLeadingContent !== null && (
                    <div className="flex justify-between py-1 border-b border-blue-200/50">
                      <span className="text-blue-600">XMLs con contenido previo al XML</span>
                      <span className="font-medium text-blue-800">
                        {normalizedZipStats.filesWithLeadingContent}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between py-1 border-b border-blue-200/50">
                    <span className="text-blue-600">Fuente del cálculo</span>
                    <span className="font-medium text-blue-800">
                      {normalizedZipStats.sourceLabel}
                    </span>
                  </div>
                </div>
                <p className="text-sm text-blue-700 leading-relaxed">
                  Fiscora puede generar un ZIP con los XMLs que requieren únicamente normalización
                  técnica segura, como remover BOM UTF-8 o contenido previo al inicio del XML. No se
                  modifican datos fiscales, importes, RFCs, nodos del CFDI ni sellos.
                </p>
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-blue-700">El ZIP descargado incluye:</p>
                  <ul className="text-xs text-blue-600 space-y-0.5 list-disc list-inside">
                    <li>
                      Carpeta <span className="font-mono">normalized/</span> con los XMLs
                      normalizados disponibles.
                    </li>
                    <li>
                      <span className="font-mono">manifest/manifest.csv</span> con trazabilidad para
                      Excel.
                    </li>
                    <li>
                      <span className="font-mono">manifest/manifest.json</span> con trazabilidad
                      técnica estructurada.
                    </li>
                  </ul>
                </div>
                <p className="text-xs text-blue-600">
                  Los XMLs que no requieren normalización o que no sean seguros para normalizar se
                  omiten del ZIP y quedan documentados en el manifiesto.
                </p>
                <button
                  onClick={handleDownloadNormalized}
                  disabled={normalizedZipLoading}
                  className="w-full py-2.5 rounded-lg bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 disabled:opacity-50 transition-all"
                >
                  {normalizedZipLoading
                    ? "Generando ZIP de XMLs normalizados..."
                    : "Descargar ZIP de XMLs normalizados"}
                </button>
                {normalizedZipLoading && (
                  <p className="text-xs text-blue-500">
                    Generando ZIP, esto puede tomar unos segundos...
                  </p>
                )}
                {normalizedZipSuccess && (
                  <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3">
                    {normalizedZipSuccess}
                  </p>
                )}
                {normalizedZipError && (
                  <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                    {normalizedZipError}
                  </p>
                )}
              </div>
            )}
        </div>

        {result && (
          <>
            {result.executiveSummary &&
              (() => {
                const levelStyles: Record<string, { badge: string; border: string }> = {
                  OK: {
                    badge: "text-emerald-700 bg-emerald-50 border-emerald-200",
                    border: "border-emerald-200",
                  },
                  WARNING: {
                    badge: "text-yellow-700 bg-yellow-50 border-yellow-200",
                    border: "border-yellow-200",
                  },
                  CRITICAL: {
                    badge: "text-red-700 bg-red-50 border-red-200",
                    border: "border-red-200",
                  },
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
                      <span
                        className={`text-xs font-bold px-3 py-1 rounded-full border ${s.badge}`}
                      >
                        {levelLabels[result.executiveSummary.riskLevel] ??
                          result.executiveSummary.riskLevel}
                      </span>
                    </div>
                    <p className="font-medium text-sm">{result.executiveSummary.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {result.executiveSummary.message}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      <span className="font-semibold">Acción recomendada:</span>{" "}
                      {result.executiveSummary.recommendedAction}
                    </p>
                  </div>
                );
              })()}

            {result.analysisMeta && (
              <div className="p-6 rounded-xl border border-border bg-card space-y-4">
                <h2 className="font-semibold text-lg">Metadata del análisis</h2>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Fecha generación</span>
                    <span className="font-medium">{new Date(result.analysisMeta.generatedAt).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Engine version</span>
                    <span className="font-medium">{result.analysisMeta.engineVersion}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Tipo documento</span>
                    <span className="font-medium">{result.analysisMeta.coverage.documentKind}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Tiempo total</span>
                    <span className="font-medium">{result.analysisMeta.performance.totalMs} ms</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Tamaño de entrada</span>
                    <span className="font-medium">{result.analysisMeta.performance.inputKb} KB</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Hallazgos originales</span>
                    <span className="font-medium">{result.analysisMeta.performance.findingsOriginalCount}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Hallazgos devueltos</span>
                    <span className="font-medium">{result.analysisMeta.performance.findingsReturnedCount}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Truncado</span>
                    <span className="font-medium">{result.analysisMeta.performance.findingsTruncated ? "Sí" : "No"}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Sanitizado</span>
                    <span className="font-medium">{result.analysisMeta.performance.sanitized ? "Sí" : "No"}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">XML normalizado disponible</span>
                    <span className="font-medium">{result.analysisMeta.performance.normalizedXmlAvailable ? "Sí" : "No"}</span>
                  </div>
                </div>

                <h3 className="font-semibold text-sm mt-4">Cobertura del análisis</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 px-2 font-medium text-muted-foreground">Módulo</th>
                        <th className="text-center py-2 px-2 font-medium text-muted-foreground">Detectado</th>
                        <th className="text-center py-2 px-2 font-medium text-muted-foreground">Analizado</th>
                        <th className="text-right py-2 px-2 font-medium text-muted-foreground">Hallazgos</th>
                        <th className="text-left py-2 px-2 font-medium text-muted-foreground">Motivo omisión</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.analysisMeta.coverage.modules.map((m) => (
                        <tr key={m.key} className="border-b border-border/50">
                          <td className="py-1.5 px-2 font-medium whitespace-nowrap">{m.label}</td>
                          <td className="py-1.5 px-2 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${m.detected ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                              {m.detected ? "Sí" : "No"}
                            </span>
                          </td>
                          <td className="py-1.5 px-2 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${m.analyzed ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"}`}>
                              {m.analyzed ? "Sí" : "No"}
                            </span>
                          </td>
                          <td className="py-1.5 px-2 text-right font-mono">{m.findingsCount}</td>
                          <td className="py-1.5 px-2 text-muted-foreground italic text-xs">{m.skippedReason ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="text-xs text-muted-foreground mt-2">
                  {result.analysisMeta.coverage.complementsDetected.length > 0 && (
                    <p>Complementos detectados: {result.analysisMeta.coverage.complementsDetected.join(", ")}</p>
                  )}
                  {result.analysisMeta.coverage.complementsUnknown.length > 0 && (
                    <p className="text-yellow-600">Complementos no clasificados: {result.analysisMeta.coverage.complementsUnknown.join(", ")}</p>
                  )}
                </div>
              </div>
            )}

            {result.findings && (
              <div className="p-6 rounded-xl border border-border bg-card space-y-4">
                <h2 className="font-semibold text-lg">Hallazgos del análisis</h2>
                {result.findings.length > 0 ? (
                  <>
                    <div className="flex gap-4 text-sm">
                      <span className="px-3 py-1 rounded-full bg-red-50 border border-red-200 text-red-700 font-bold text-xs">
                        Críticos: {result.findings.filter((f) => f.severity === "CRITICAL").length}
                      </span>
                      <span className="px-3 py-1 rounded-full bg-yellow-50 border border-yellow-200 text-yellow-700 font-bold text-xs">
                        Advertencias:{" "}
                        {result.findings.filter((f) => f.severity === "WARNING").length}
                      </span>
                      <span className="px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 font-bold text-xs">
                        Informativos: {result.findings.filter((f) => f.severity === "INFO").length}
                      </span>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {(["ALL", "CRITICAL", "WARNING", "INFO"] as const).map((s) => {
                        const labels: Record<string, string> = {
                          ALL: "Todos",
                          CRITICAL: "Críticos",
                          WARNING: "Advertencias",
                          INFO: "Informativos",
                        };
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
                      {(["ALL", "BLOCKER", "HIGH", "MEDIUM", "LOW"] as const).map((p) => {
                        const pLabels: Record<string, string> = {
                          ALL: "Todas",
                          BLOCKER: "Bloqueantes",
                          HIGH: "Alta",
                          MEDIUM: "Media",
                          LOW: "Informativa",
                        };
                        const activeP = priorityFilter === p;
                        return (
                          <button
                            key={p}
                            onClick={() => setPriorityFilter(p)}
                            className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-all ${
                              activeP
                                ? "bg-foreground text-background border-foreground"
                                : "bg-transparent text-muted-foreground border-border hover:border-foreground hover:text-foreground"
                            }`}
                          >
                            {pLabels[p]}
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <span className="text-xs text-muted-foreground self-center font-medium">
                        Categoría:
                      </span>
                      {(
                        [
                          "ALL",
                          "TOTALS",
                          "FISCAL",
                          "TAX",
                          "TECHNICAL",
                          "STRUCTURE",
                          "COMPLEMENT",
                        ] as const
                      ).map((c) => {
                        const catLabels: Record<string, string> = {
                          ALL: "Todas",
                          TOTALS: "Totales",
                          FISCAL: "Fiscal",
                          TAX: "Impuestos",
                          TECHNICAL: "Técnico",
                          STRUCTURE: "Estructura",
                          COMPLEMENT: "Complementos",
                        };
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
                      <span>
                        Totales: {result.findings.filter((f) => f.category === "TOTALS").length}
                      </span>
                      <span>
                        Fiscal: {result.findings.filter((f) => f.category === "FISCAL").length}
                      </span>
                      <span>
                        Impuestos: {result.findings.filter((f) => f.category === "TAX").length}
                      </span>
                      <span>
                        Técnico: {result.findings.filter((f) => f.category === "TECHNICAL").length}
                      </span>
                      <span>
                        Estructura:{" "}
                        {result.findings.filter((f) => f.category === "STRUCTURE").length}
                      </span>
                      <span>
                        Complementos:{" "}
                        {result.findings.filter((f) => f.category === "COMPLEMENT").length}
                      </span>
                    </div>
                    {result.findings && result.findings.length > 0 && (
                      <div className="space-y-4 p-4 rounded-xl border border-border bg-card">
                        <h3 className="font-semibold text-sm">Resumen accionable</h3>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                          {([
                            { key: "BLOCKER", label: "Bloqueantes", style: "text-red-700 bg-red-50 border-red-200" },
                            { key: "HIGH", label: "Alta prioridad", style: "text-orange-700 bg-orange-50 border-orange-200" },
                            { key: "MEDIUM", label: "Media prioridad", style: "text-yellow-700 bg-yellow-50 border-yellow-200" },
                            { key: "LOW", label: "Informativos", style: "text-blue-700 bg-blue-50 border-blue-200" },
                            { key: "ALL", label: "Total hallazgos", style: "text-muted-foreground bg-muted border-border" },
                          ] as const).map(({ key, label, style }) => (
                            <div
                              key={key}
                              className={`flex flex-col items-center justify-center p-3 rounded-lg border ${style}`}
                            >
                              <span className="text-2xl font-bold">
                                {key === "ALL"
                                  ? result.findings!.length
                                  : result.findings!.filter((f) => f.priority === key).length}
                              </span>
                              <span className="text-xs font-medium">{label}</span>
                            </div>
                          ))}
                        </div>
                        {(() => {
                          const sorted = sortFindingsByPriority(result.findings!).slice(0, 5);
                          return (
                            <div>
                              <h4 className="text-xs font-semibold mb-2">Primeras acciones recomendadas</h4>
                              <div className="space-y-2">
                                {sorted.map((f, i) => (
                                  <div key={i} className="flex items-start gap-2 text-xs p-2 rounded border border-border">
                                    <span className="font-bold shrink-0 mt-0.5">#{i + 1}</span>
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="font-semibold">{f.code}</span>
                                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                                          f.priority === "BLOCKER" ? "text-red-700 bg-red-50 border-red-200" :
                                          f.priority === "HIGH" ? "text-orange-700 bg-orange-50 border-orange-200" :
                                          f.priority === "MEDIUM" ? "text-yellow-700 bg-yellow-50 border-yellow-200" :
                                          "text-blue-700 bg-blue-50 border-blue-200"
                                        }`}>
                                          {getPriorityLabel(f.priority)}
                                        </span>
                                      </div>
                                      <p className="text-muted-foreground mt-0.5">{f.recommendedAction ?? f.title}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })()}
                        {(() => {
                          const groups = groupFindingsByActionGroup(result.findings!);
                          return (
                            <div>
                              <h4 className="text-xs font-semibold mb-2">Grupos accionables</h4>
                              <div className="space-y-2">
                                {Object.entries(groups).map(([group, items]) => (
                                  <div
                                    key={group}
                                    className="flex items-center justify-between text-xs p-2 rounded border border-border"
                                  >
                                    <span className="font-medium">{group}</span>
                                    <div className="flex items-center gap-3">
                                      <span className="text-muted-foreground">{items.length} hallazgo(s)</span>
                                      <span className="text-red-600 font-medium">
                                        {items.filter((f) => f.severity === "CRITICAL").length} crítico(s)
                                      </span>
                                      <span className="text-yellow-600 font-medium">
                                        {items.filter((f) => f.severity === "WARNING").length} advertencia(s)
                                      </span>
                                      <span className="text-blue-600">
                                        {items.filter((f) => f.severity === "INFO").length} info
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                    <div className="space-y-3">
                      {(() => {
                        let filtered = result.findings!;
                        if (filter !== "ALL")
                          filtered = filtered.filter((f) => f.severity === filter);
                        if (categoryFilter !== "ALL")
                          filtered = filtered.filter((f) => f.category === categoryFilter);
                        if (priorityFilter !== "ALL")
                          filtered = filtered.filter((f) => f.priority === priorityFilter);
                        if (filtered.length === 0) {
                          return (
                            <p className="text-sm text-muted-foreground">
                              No hay hallazgos para los filtros seleccionados.
                            </p>
                          );
                        }
                        const badge: Record<string, { label: string; style: string }> = {
                          INFO: {
                            label: "Informativo",
                            style: "text-blue-700 bg-blue-50 border-blue-200",
                          },
                          WARNING: {
                            label: "Advertencia",
                            style: "text-yellow-700 bg-yellow-50 border-yellow-200",
                          },
                          CRITICAL: {
                            label: "Crítico",
                            style: "text-red-700 bg-red-50 border-red-200",
                          },
                        };
                        return filtered.map((f, i) => {
                          const b = badge[f.severity] ?? badge.INFO;
                          return (
                            <div key={i} className={`p-4 rounded-lg border ${b.style} space-y-2`}>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span
                                  className={`text-xs font-bold px-2 py-0.5 rounded-full border ${b.style}`}
                                >
                                  {b.label}
                                </span>
                                {f.priority && (
                                  <span
                                    className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
                                      f.priority === "BLOCKER" ? "text-red-700 bg-red-50 border-red-200" :
                                      f.priority === "HIGH" ? "text-orange-700 bg-orange-50 border-orange-200" :
                                      f.priority === "MEDIUM" ? "text-yellow-700 bg-yellow-50 border-yellow-200" :
                                      "text-blue-700 bg-blue-50 border-blue-200"
                                    }`}
                                  >
                                    {getPriorityLabel(f.priority)}
                                  </span>
                                )}
                                <span className="text-xs text-muted-foreground font-mono">
                                  {f.category}
                                </span>
                                <span className="text-xs text-muted-foreground font-mono">
                                  {f.code}
                                </span>
                              </div>
                              <p className="text-sm font-medium">{f.title}</p>
                              <p className="text-sm text-muted-foreground">{f.message}</p>
                              {f.recommendedAction && (
                                <p className="text-xs text-muted-foreground">
                                  <span className="font-semibold">Acción recomendada:</span>{" "}
                                  {f.recommendedAction}
                                </p>
                              )}
                              {f.evidence &&
                                f.evidence.length > 0 &&
                                (() => {
                                  const findingKey = f.id ?? f.code;
                                  const isExpanded = expandedEvidence.has(findingKey);
                                  const visibleEvidence = isExpanded
                                    ? f.evidence
                                    : f.evidence.slice(0, 4);
                                  const hasMore = f.evidence.length > 4;
                                  return (
                                    <div className="space-y-1 pt-1 border-t border-border/40 mt-2">
                                      <p className="text-xs font-semibold text-muted-foreground pt-1">
                                        Evidencia detectada
                                      </p>
                                      <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5 text-xs">
                                        {visibleEvidence.map((e, eIdx) => (
                                          <div key={eIdx} className="contents">
                                            <span className="text-muted-foreground whitespace-nowrap">
                                              {e.label}:
                                            </span>
                                            <span className="font-mono text-foreground/80 break-all">
                                              {e.value ?? "—"}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                      {hasMore && (
                                        <button
                                          onClick={() => toggleEvidence(findingKey)}
                                          className="text-xs font-semibold text-primary hover:underline mt-1"
                                        >
                                          {isExpanded
                                            ? "Ver menos"
                                            : `Ver más evidencia (${f.evidence.length - 4} restantes)`}
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
                  <p className="text-sm text-muted-foreground">
                    No se detectaron hallazgos estructurados.
                  </p>
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
                      {result.paymentComplement.pagos.reduce(
                        (acc, p) => acc + p.documentosRelacionados.length,
                        0,
                      )}
                    </span>
                  </div>
                </div>

                {result.paymentComplement.pagos.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No se detectaron pagos dentro del complemento.
                  </p>
                ) : (
                  result.paymentComplement.pagos.map((pago, idx) => (
                    <div
                      key={idx}
                      className="space-y-3 border-t border-border/50 pt-3 first:border-t-0 first:pt-0"
                    >
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
                                  <td className="py-1 pr-2 font-mono break-all max-w-[120px]">
                                    {doc.idDocumento ?? "—"}
                                  </td>
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
                        <p className="text-sm text-muted-foreground">
                          Este pago no contiene documentos relacionados.
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {result.cfdiRelations && (
              <div className="p-6 rounded-xl border border-border bg-card space-y-4">
                <h2 className="font-semibold text-lg">CFDI relacionados</h2>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Grupos de relación</span>
                    <span className="font-medium">{result.cfdiRelations.totalRelationGroups}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Total CFDI relacionados</span>
                    <span className="font-medium">{result.cfdiRelations.totalRelatedCfdis}</span>
                  </div>
                </div>
                {result.cfdiRelations.groups.map((group, gi) => (
                  <div key={gi} className="border-t border-border/50 pt-3 space-y-2">
                    <p className="text-sm font-semibold">
                      Grupo {gi + 1}
                      {group.tipoRelacion && (
                        <span className="text-muted-foreground font-normal">
                          {" "}
                          — TipoRelacion: {group.tipoRelacion}
                        </span>
                      )}
                    </p>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border/50 text-muted-foreground">
                          <th className="text-left py-1 pr-2">#</th>
                          <th className="text-left py-1 pr-2">UUID</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.relatedCfdis.map((rel, ri) => (
                          <tr key={ri} className="border-b border-border/30">
                            <td className="py-1 pr-2 align-top">{ri + 1}</td>
                            <td className="py-1 font-mono">{rel.uuid ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            )}

            {result.cartaPorte && (
              <div className="p-6 rounded-xl border border-border bg-card space-y-4">
                <h2 className="font-semibold text-lg">Carta Porte</h2>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Versión</span>
                    <span className="font-medium">{result.cartaPorte.version ?? "—"}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">IdCCP</span>
                    <span className="font-medium">{result.cartaPorte.idCCP ?? "—"}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Transporte internacional</span>
                    <span className="font-medium">{result.cartaPorte.transpInternac ?? "—"}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Total distancia recorrida</span>
                    <span className="font-medium">{result.cartaPorte.totalDistRec ?? "—"}</span>
                  </div>
                </div>

                {/* Badges medio transporte */}
                <div className="flex flex-wrap gap-2">
                  {result.cartaPorte.hasAutotransporte && (
                    <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-800 border border-blue-300">
                      Autotransporte
                    </span>
                  )}
                  {result.cartaPorte.hasTransporteMaritimo && (
                    <span className="text-xs px-2 py-1 rounded-full bg-cyan-100 text-cyan-800 border border-cyan-300">
                      Marítimo
                    </span>
                  )}
                  {result.cartaPorte.hasTransporteAereo && (
                    <span className="text-xs px-2 py-1 rounded-full bg-purple-100 text-purple-800 border border-purple-300">
                      Aéreo
                    </span>
                  )}
                  {result.cartaPorte.hasTransporteFerroviario && (
                    <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                      Ferroviario
                    </span>
                  )}
                </div>

                {/* Conteos */}
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div className="p-3 rounded-lg bg-muted/50 text-center">
                    <p className="text-lg font-semibold">{result.cartaPorte.ubicaciones.length}</p>
                    <p className="text-xs text-muted-foreground">Ubicaciones</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50 text-center">
                    <p className="text-lg font-semibold">{result.cartaPorte.mercancias.length}</p>
                    <p className="text-xs text-muted-foreground">Mercancías</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50 text-center">
                    <p className="text-lg font-semibold">
                      {result.cartaPorte.figurasTransporte.length}
                    </p>
                    <p className="text-xs text-muted-foreground">Figuras transporte</p>
                  </div>
                </div>

                {/* Ubicaciones */}
                {result.cartaPorte.ubicaciones.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold">Ubicaciones</h3>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border/50 text-muted-foreground">
                          <th className="text-left py-1 pr-2">Tipo</th>
                          <th className="text-left py-1 pr-2">ID</th>
                          <th className="text-left py-1 pr-2">RFC</th>
                          <th className="text-left py-1 pr-2">Nombre</th>
                          <th className="text-left py-1 pr-2">Fecha</th>
                          <th className="text-right py-1">Distancia</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.cartaPorte.ubicaciones.map((ubi, ui) => (
                          <tr key={ui} className="border-b border-border/30">
                            <td className="py-1 pr-2">{ubi.tipoUbicacion ?? "—"}</td>
                            <td className="py-1 pr-2 font-mono">{ubi.idUbicacion ?? "—"}</td>
                            <td className="py-1 pr-2 font-mono">
                              {ubi.rfcRemitenteDestinatario ?? "—"}
                            </td>
                            <td className="py-1 pr-2">{ubi.nombreRemitenteDestinatario ?? "—"}</td>
                            <td className="py-1 pr-2 text-[10px]">
                              {ubi.fechaHoraSalidaLlegada ?? "—"}
                            </td>
                            <td className="py-1 text-right">{ubi.distanciaRecorrida ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Mercancías */}
                {result.cartaPorte.mercancias.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold">Mercancías</h3>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border/50 text-muted-foreground">
                          <th className="text-left py-1 pr-2">BienesTransp</th>
                          <th className="text-left py-1 pr-2">Descripción</th>
                          <th className="text-right py-1 pr-2">Cantidad</th>
                          <th className="text-left py-1 pr-2">Unidad</th>
                          <th className="text-right py-1 pr-2">Peso KG</th>
                          <th className="text-right py-1">Valor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.cartaPorte.mercancias.map((mer, mi) => (
                          <tr key={mi} className="border-b border-border/30">
                            <td className="py-1 pr-2 font-mono">{mer.bienesTransp ?? "—"}</td>
                            <td className="py-1 pr-2">{mer.descripcion ?? "—"}</td>
                            <td className="py-1 pr-2 text-right">{mer.cantidad ?? "—"}</td>
                            <td className="py-1 pr-2">{mer.claveUnidad ?? "—"}</td>
                            <td className="py-1 pr-2 text-right">{mer.pesoEnKg ?? "—"}</td>
                            <td className="py-1 text-right">
                              {mer.valorMercancia
                                ? `${mer.valorMercancia}${mer.moneda ? ` ${mer.moneda}` : ""}`
                                : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Figuras transporte */}
                {result.cartaPorte.figurasTransporte.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold">Figuras de transporte</h3>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border/50 text-muted-foreground">
                          <th className="text-left py-1 pr-2">Tipo</th>
                          <th className="text-left py-1 pr-2">RFC</th>
                          <th className="text-left py-1 pr-2">Nombre</th>
                          <th className="text-left py-1">Licencia</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.cartaPorte.figurasTransporte.map((fig, fi) => (
                          <tr key={fi} className="border-b border-border/30">
                            <td className="py-1 pr-2">{fig.tipoFigura ?? "—"}</td>
                            <td className="py-1 pr-2 font-mono">{fig.rfcFigura ?? "—"}</td>
                            <td className="py-1 pr-2">{fig.nombreFigura ?? "—"}</td>
                            <td className="py-1">{fig.numLicencia ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {result.nomina && (
              <div className="p-6 rounded-xl border border-border bg-card space-y-4">
                <h2 className="font-semibold text-lg">Nómina</h2>

                {/* Resumen */}
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Versión</span>
                    <span className="font-medium">{result.nomina.version ?? "—"}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Tipo nómina</span>
                    <span className="font-medium">{result.nomina.tipoNomina ?? "—"}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Fecha pago</span>
                    <span className="font-medium">{result.nomina.fechaPago ?? "—"}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Periodo</span>
                    <span className="font-medium">
                      {result.nomina.fechaInicialPago ?? "—"} —{" "}
                      {result.nomina.fechaFinalPago ?? "—"}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Días pagados</span>
                    <span className="font-medium">{result.nomina.numDiasPagados ?? "—"}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Total percepciones</span>
                    <span className="font-medium">{result.nomina.totalPercepciones ?? "—"}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Total deducciones</span>
                    <span className="font-medium">{result.nomina.totalDeducciones ?? "—"}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Total otros pagos</span>
                    <span className="font-medium">{result.nomina.totalOtrosPagos ?? "—"}</span>
                  </div>
                </div>

                {/* Receptor */}
                {result.nomina.receptor && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold">Receptor</h3>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                      <div className="flex justify-between py-1 border-b border-border/50">
                        <span className="text-muted-foreground">CURP</span>
                        <span className="font-medium font-mono text-xs">
                          {result.nomina.receptor.curp ?? "—"}
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-border/50">
                        <span className="text-muted-foreground">NSS</span>
                        <span className="font-medium">
                          {result.nomina.receptor.numSeguridadSocial ?? "—"}
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-border/50">
                        <span className="text-muted-foreground">NumEmpleado</span>
                        <span className="font-medium">
                          {result.nomina.receptor.numEmpleado ?? "—"}
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-border/50">
                        <span className="text-muted-foreground">Departamento</span>
                        <span className="font-medium">
                          {result.nomina.receptor.departamento ?? "—"}
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-border/50">
                        <span className="text-muted-foreground">Puesto</span>
                        <span className="font-medium">{result.nomina.receptor.puesto ?? "—"}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-border/50">
                        <span className="text-muted-foreground">Tipo contrato</span>
                        <span className="font-medium">
                          {result.nomina.receptor.tipoContrato ?? "—"}
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-border/50">
                        <span className="text-muted-foreground">Tipo régimen</span>
                        <span className="font-medium">
                          {result.nomina.receptor.tipoRegimen ?? "—"}
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-border/50">
                        <span className="text-muted-foreground">Periodicidad pago</span>
                        <span className="font-medium">
                          {result.nomina.receptor.periodicidadPago ?? "—"}
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-border/50">
                        <span className="text-muted-foreground">Salario base cotización</span>
                        <span className="font-medium">
                          {result.nomina.receptor.salarioBaseCotApor ?? "—"}
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-border/50">
                        <span className="text-muted-foreground">Salario diario integrado</span>
                        <span className="font-medium">
                          {result.nomina.receptor.salarioDiarioIntegrado ?? "—"}
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-border/50">
                        <span className="text-muted-foreground">Entidad federativa</span>
                        <span className="font-medium">
                          {result.nomina.receptor.claveEntFed ?? "—"}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Percepciones */}
                {result.nomina.percepciones.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold">Percepciones</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-border/50 text-muted-foreground">
                            <th className="text-left py-1 pr-2">Tipo</th>
                            <th className="text-left py-1 pr-2">Clave</th>
                            <th className="text-left py-1 pr-2">Concepto</th>
                            <th className="text-right py-1 pr-2">Gravado</th>
                            <th className="text-right py-1">Exento</th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.nomina.percepciones.map((p, i) => (
                            <tr key={i} className="border-b border-border/30">
                              <td className="py-1 pr-2">{p.tipoPercepcion ?? "—"}</td>
                              <td className="py-1 pr-2 font-mono">{p.clave ?? "—"}</td>
                              <td
                                className="py-1 pr-2 max-w-[200px] truncate"
                                title={p.concepto ?? ""}
                              >
                                {p.concepto ?? "—"}
                              </td>
                              <td className="py-1 pr-2 text-right">{p.importeGravado ?? "—"}</td>
                              <td className="py-1 text-right">{p.importeExento ?? "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Deducciones */}
                {result.nomina.deducciones.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold">Deducciones</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-border/50 text-muted-foreground">
                            <th className="text-left py-1 pr-2">Tipo</th>
                            <th className="text-left py-1 pr-2">Clave</th>
                            <th className="text-left py-1 pr-2">Concepto</th>
                            <th className="text-right py-1">Importe</th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.nomina.deducciones.map((d, i) => (
                            <tr key={i} className="border-b border-border/30">
                              <td className="py-1 pr-2">{d.tipoDeduccion ?? "—"}</td>
                              <td className="py-1 pr-2 font-mono">{d.clave ?? "—"}</td>
                              <td
                                className="py-1 pr-2 max-w-[200px] truncate"
                                title={d.concepto ?? ""}
                              >
                                {d.concepto ?? "—"}
                              </td>
                              <td className="py-1 text-right">{d.importe ?? "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Otros pagos */}
                {result.nomina.otrosPagos.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold">Otros pagos</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-border/50 text-muted-foreground">
                            <th className="text-left py-1 pr-2">Tipo</th>
                            <th className="text-left py-1 pr-2">Clave</th>
                            <th className="text-left py-1 pr-2">Concepto</th>
                            <th className="text-right py-1">Importe</th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.nomina.otrosPagos.map((o, i) => (
                            <tr key={i} className="border-b border-border/30">
                              <td className="py-1 pr-2">{o.tipoOtroPago ?? "—"}</td>
                              <td className="py-1 pr-2 font-mono">{o.clave ?? "—"}</td>
                              <td
                                className="py-1 pr-2 max-w-[200px] truncate"
                                title={o.concepto ?? ""}
                              >
                                {o.concepto ?? "—"}
                              </td>
                              <td className="py-1 text-right">{o.importe ?? "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {result.comercioExterior && (
              <div className="p-6 rounded-xl border border-border bg-card space-y-4">
                <h2 className="font-semibold text-lg">Comercio Exterior</h2>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Versión</span>
                    <span className="font-medium">{result.comercioExterior.version ?? "—"}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Tipo operación</span>
                    <span className="font-medium">{result.comercioExterior.tipoOperacion ?? "—"}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Clave de pedimento</span>
                    <span className="font-medium">{result.comercioExterior.claveDePedimento ?? "—"}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Certificado de origen</span>
                    <span className="font-medium">{result.comercioExterior.certificadoOrigen ?? "—"}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">No. exportador confiable</span>
                    <span className="font-medium">{result.comercioExterior.numeroExportadorConfiable ?? "—"}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Incoterm</span>
                    <span className="font-medium">{result.comercioExterior.incoterm ?? "—"}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">SubDivisión</span>
                    <span className="font-medium">{result.comercioExterior.subDivision ?? "—"}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">TipoCambioUSD</span>
                    <span className="font-medium">{result.comercioExterior.tipoCambioUSD ?? "—"}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">TotalUSD</span>
                    <span className="font-medium">{result.comercioExterior.totalUSD ?? "—"}</span>
                  </div>
                </div>
                {result.comercioExterior.observaciones && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Observaciones: </span>
                    <span className="font-medium">{result.comercioExterior.observaciones}</span>
                  </div>
                )}
              </div>
            )}

            {result.impuestosLocales && (
              <div className="p-6 rounded-xl border border-border bg-card space-y-4">
                <h2 className="font-semibold text-lg">Impuestos Locales</h2>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Versión</span>
                    <span className="font-medium">{result.impuestosLocales.version ?? "—"}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Total retenciones</span>
                    <span className="font-medium">{result.impuestosLocales.totalDeRetenciones ?? "—"}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Total traslados</span>
                    <span className="font-medium">{result.impuestosLocales.totalDeTraslados ?? "—"}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Retenciones</span>
                    <span className="font-medium">{result.impuestosLocales.retenciones.length}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Traslados</span>
                    <span className="font-medium">{result.impuestosLocales.traslados.length}</span>
                  </div>
                </div>
                {result.impuestosLocales.retenciones.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold">Retenciones locales</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-border/30 text-muted-foreground">
                            <th className="text-left py-1 pr-2">#</th>
                            <th className="text-left py-1 pr-2">Impuesto</th>
                            <th className="text-right py-1 pr-2">Tasa</th>
                            <th className="text-right py-1">Importe</th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.impuestosLocales.retenciones.map((r, i) => (
                            <tr key={i} className="border-b border-border/30">
                              <td className="py-1 pr-2">{i + 1}</td>
                              <td className="py-1 pr-2">{r.impLocRetenido ?? "—"}</td>
                              <td className="py-1 pr-2 text-right">{r.tasaDeRetencion ?? "—"}</td>
                              <td className="py-1 text-right">{r.importe ?? "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                {result.impuestosLocales.traslados.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold">Traslados locales</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-border/30 text-muted-foreground">
                            <th className="text-left py-1 pr-2">#</th>
                            <th className="text-left py-1 pr-2">Impuesto</th>
                            <th className="text-right py-1 pr-2">Tasa</th>
                            <th className="text-right py-1">Importe</th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.impuestosLocales.traslados.map((t, i) => (
                            <tr key={i} className="border-b border-border/30">
                              <td className="py-1 pr-2">{i + 1}</td>
                              <td className="py-1 pr-2">{t.impLocTrasladado ?? "—"}</td>
                              <td className="py-1 pr-2 text-right">{t.tasaDeTraslado ?? "—"}</td>
                              <td className="py-1 text-right">{t.importe ?? "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {result.leyendasFiscales && (
              <div className="p-6 rounded-xl border border-border bg-card space-y-4">
                <h2 className="font-semibold text-lg">Leyendas Fiscales</h2>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Versión</span>
                    <span className="font-medium">{result.leyendasFiscales.version ?? "—"}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Total leyendas</span>
                    <span className="font-medium">{result.leyendasFiscales.leyendas.length}</span>
                  </div>
                </div>
                {result.leyendasFiscales.leyendas.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold">Leyendas</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-border/30 text-muted-foreground">
                            <th className="text-left py-1 pr-2">#</th>
                            <th className="text-left py-1 pr-2">Disposición fiscal</th>
                            <th className="text-left py-1 pr-2">Norma</th>
                            <th className="text-left py-1">Texto leyenda</th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.leyendasFiscales.leyendas.map((l, i) => (
                            <tr key={i} className="border-b border-border/30">
                              <td className="py-1 pr-2">{i + 1}</td>
                              <td className="py-1 pr-2">{l.disposicionFiscal ?? "—"}</td>
                              <td className="py-1 pr-2">{l.norma ?? "—"}</td>
                              <td className="py-1">{l.textoLeyenda ?? "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {result.donatarias && (
              <div className="p-6 rounded-xl border border-border bg-card space-y-4">
                <h2 className="font-semibold text-lg">Donatarias</h2>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Versión</span>
                    <span className="font-medium">{result.donatarias.version ?? "—"}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">NoAutorizacion</span>
                    <span className="font-medium">{result.donatarias.noAutorizacion ?? "—"}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">FechaAutorizacion</span>
                    <span className="font-medium">{result.donatarias.fechaAutorizacion ?? "—"}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Leyenda</span>
                    <span className="font-medium">{result.donatarias.leyenda ?? "—"}</span>
                  </div>
                </div>
              </div>
            )}

            {result.documentKind === "RETENCIONES" && result.retenciones && (
              <div className="p-6 rounded-xl border border-border bg-card space-y-4">
                <h2 className="font-semibold text-lg">Retenciones</h2>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Versión</span>
                    <span className="font-medium">{result.retenciones.version ?? "—"}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Folio interno</span>
                    <span className="font-medium">{result.retenciones.folioInt ?? "—"}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Fecha expedición</span>
                    <span className="font-medium">{result.retenciones.fechaExp ?? "—"}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">CveRetenc</span>
                    <span className="font-medium">{result.retenciones.cveRetenc ?? "—"}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">DescRetenc</span>
                    <span className="font-medium">{result.retenciones.descRetenc ?? "—"}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Lugar expedición</span>
                    <span className="font-medium">{result.retenciones.lugarExpRetenc ?? "—"}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">UUID</span>
                    <span className="font-medium">{result.retenciones.uuid ?? "—"}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Fecha timbrado</span>
                    <span className="font-medium">{result.retenciones.fechaTimbrado ?? "—"}</span>
                  </div>
                </div>
                {result.retenciones.emisor && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold">Emisor</h3>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                      <div className="flex justify-between py-1 border-b border-border/50">
                        <span className="text-muted-foreground">RFC</span>
                        <span className="font-medium">{result.retenciones.emisor.rfcEmisor ?? "—"}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-border/50">
                        <span className="text-muted-foreground">Nombre</span>
                        <span className="font-medium">{result.retenciones.emisor.nombre ?? "—"}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-border/50">
                        <span className="text-muted-foreground">CURP</span>
                        <span className="font-medium">{result.retenciones.emisor.curp ?? "—"}</span>
                      </div>
                    </div>
                  </div>
                )}
                {result.retenciones.receptor && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold">Receptor</h3>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                      <div className="flex justify-between py-1 border-b border-border/50">
                        <span className="text-muted-foreground">Nacionalidad</span>
                        <span className="font-medium">{result.retenciones.receptor.nacionalidad ?? "—"}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-border/50">
                        <span className="text-muted-foreground">RFC / NumRegIdTrib</span>
                        <span className="font-medium">{result.retenciones.receptor.rfcReceptor ?? result.retenciones.receptor.numRegIdTrib ?? "—"}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-border/50">
                        <span className="text-muted-foreground">Nombre</span>
                        <span className="font-medium">{result.retenciones.receptor.nombre ?? "—"}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-border/50">
                        <span className="text-muted-foreground">CURP</span>
                        <span className="font-medium">{result.retenciones.receptor.curp ?? "—"}</span>
                      </div>
                    </div>
                  </div>
                )}
                {result.retenciones.periodo && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold">Periodo</h3>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                      <div className="flex justify-between py-1 border-b border-border/50">
                        <span className="text-muted-foreground">Mes inicial</span>
                        <span className="font-medium">{result.retenciones.periodo.mesIni ?? "—"}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-border/50">
                        <span className="text-muted-foreground">Mes final</span>
                        <span className="font-medium">{result.retenciones.periodo.mesFin ?? "—"}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-border/50">
                        <span className="text-muted-foreground">Ejercicio</span>
                        <span className="font-medium">{result.retenciones.periodo.ejercicio ?? "—"}</span>
                      </div>
                    </div>
                  </div>
                )}
                {result.retenciones.totales && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold">Totales</h3>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                      <div className="flex justify-between py-1 border-b border-border/50">
                        <span className="text-muted-foreground">Monto total operación</span>
                        <span className="font-medium">{result.retenciones.totales.montoTotOperacion ?? "—"}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-border/50">
                        <span className="text-muted-foreground">Monto total gravado</span>
                        <span className="font-medium">{result.retenciones.totales.montoTotGrav ?? "—"}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-border/50">
                        <span className="text-muted-foreground">Monto total exento</span>
                        <span className="font-medium">{result.retenciones.totales.montoTotExent ?? "—"}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-border/50">
                        <span className="text-muted-foreground">Monto total retenido</span>
                        <span className="font-medium">{result.retenciones.totales.montoTotRet ?? "—"}</span>
                      </div>
                    </div>
                    {result.retenciones.totales.impuestosRetenidos.length > 0 && (
                      <div className="overflow-x-auto">
                        <h4 className="text-sm font-semibold mb-1">Impuestos retenidos</h4>
                        <table className="w-full text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-border/30 text-muted-foreground">
                              <th className="text-left py-1 pr-2">#</th>
                              <th className="text-left py-1 pr-2">BaseRet</th>
                              <th className="text-left py-1 pr-2">Impuesto</th>
                              <th className="text-right py-1 pr-2">MontoRet</th>
                              <th className="text-left py-1">TipoPagoRet</th>
                            </tr>
                          </thead>
                          <tbody>
                            {result.retenciones.totales.impuestosRetenidos.map((ir, i) => (
                              <tr key={i} className="border-b border-border/30">
                                <td className="py-1 pr-2">{i + 1}</td>
                                <td className="py-1 pr-2">{ir.baseRet ?? "—"}</td>
                                <td className="py-1 pr-2">{ir.impuesto ?? "—"}</td>
                                <td className="py-1 pr-2 text-right">{ir.montoRet ?? "—"}</td>
                                <td className="py-1">{ir.tipoPagoRet ?? "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {result.addenda?.detected && (
              <div className="p-6 rounded-xl border border-border bg-card space-y-4">
                <h2 className="font-semibold text-lg">Addenda</h2>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Detectada</span>
                    <span className="font-medium">Sí</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Root keys</span>
                    <span className="font-medium">{result.addenda.rootKeys.join(", ")}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Node count</span>
                    <span className="font-medium">{result.addenda.nodeCount}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Max depth</span>
                    <span className="font-medium">{result.addenda.maxDepth}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Truncada</span>
                    <span className="font-medium">{result.addenda.truncated ? "Sí" : "No"}</span>
                  </div>
                </div>
                {result.addenda.signals.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold">Señales detectadas ({result.addenda.signals.length})</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-border/30 text-muted-foreground">
                            <th className="text-left py-1 pr-2">Label</th>
                            <th className="text-left py-1 pr-2">Valor</th>
                            <th className="text-left py-1 pr-2">Path</th>
                            <th className="text-left py-1">Confianza</th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.addenda.signals.map((s, i) => (
                            <tr key={i} className="border-b border-border/30">
                              <td className="py-1 pr-2 font-medium">{s.label}</td>
                              <td className="py-1 pr-2">{s.value}</td>
                              <td className="py-1 pr-2 text-muted-foreground">{s.path}</td>
                              <td className="py-1">{s.confidence}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                {result.addenda.nodeSummary.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold">Resumen de nodos ({result.addenda.nodeSummary.length})</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-border/30 text-muted-foreground">
                            <th className="text-left py-1 pr-2">Path</th>
                            <th className="text-left py-1 pr-2">Nombre</th>
                            <th className="text-right py-1 pr-2">Child count</th>
                            <th className="text-right py-1">Scalar fields</th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.addenda.nodeSummary.map((ns, i) => (
                            <tr key={i} className="border-b border-border/30">
                              <td className="py-1 pr-2">{ns.path}</td>
                              <td className="py-1 pr-2">{ns.name}</td>
                              <td className="py-1 pr-2 text-right">{ns.childCount}</td>
                              <td className="py-1 text-right">{ns.scalarFields}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="p-6 rounded-xl border border-border bg-card space-y-4">
              <h2 className="font-semibold text-lg">Diagnóstico técnico del archivo</h2>

              {!result.technicalDiagnostics.isStamped && (
                <p className="text-sm text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3">
                  Este XML no contiene TimbreFiscalDigital. Podría tratarse de un comprobante no
                  timbrado.
                </p>
              )}

              {(result.technicalDiagnostics.bomDetected ||
                result.technicalDiagnostics.leadingContentBeforeXml) && (
                <p className="text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
                  {result.normalizedXml?.available
                    ? "Puedes descargar el XML normalizado desde el botón disponible en el diagnóstico técnico."
                    : "Se aplicó una normalización técnica segura solo en memoria para poder leer el archivo. No se modificó el contenido fiscal del XML."}
                </p>
              )}

              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">XML timbrado</span>
                  <span
                    className={
                      result.technicalDiagnostics.isStamped
                        ? "text-emerald-600 font-medium"
                        : "text-yellow-600 font-medium"
                    }
                  >
                    {result.technicalDiagnostics.isStamped ? "Sí" : "No"}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Timbre Fiscal Digital detectado</span>
                  <span
                    className={
                      result.technicalDiagnostics.hasTimbreFiscalDigital
                        ? "text-emerald-600 font-medium"
                        : "text-yellow-600 font-medium"
                    }
                  >
                    {result.technicalDiagnostics.hasTimbreFiscalDigital ? "Sí" : "No"}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">BOM UTF-8 detectado</span>
                  <span className="font-medium">
                    {result.technicalDiagnostics.bomDetected ? "Sí" : "No"}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Contenido antes del inicio del XML</span>
                  <span className="font-medium">
                    {result.technicalDiagnostics.leadingContentBeforeXml ? "Sí" : "No"}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Normalización segura aplicada</span>
                  <span className="font-medium">
                    {result.technicalDiagnostics.safeNormalizationApplied ? "Sí" : "No"}
                  </span>
                </div>
              </div>

              {result.technicalDiagnostics.safeNormalizationNotes.length > 0 && (
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-muted-foreground">
                    Normalizaciones aplicadas
                  </p>
                  <ul className="space-y-1">
                    {result.technicalDiagnostics.safeNormalizationNotes.map((note, i) => (
                      <li key={i} className="text-sm text-muted-foreground flex items-center gap-2">
                        <span className="text-blue-500">i</span> {note}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {result.normalizedXml?.available &&
                (() => {
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
                      <p className="text-sm font-semibold text-blue-800">
                        XML normalizado disponible
                      </p>
                      <p className="text-sm text-blue-700">
                        Se detectó un problema técnico de codificación o contenido previo al XML.
                        Fiscora generó una versión normalizada sin modificar el contenido fiscal ni
                        el timbre del CFDI.
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
                          <span className="font-mono text-blue-800 break-all">
                            {nx.originalSha256}
                          </span>
                          <span className="text-blue-600 whitespace-nowrap">Hash normalizado:</span>
                          <span className="font-mono text-blue-800 break-all">
                            {nx.normalizedSha256}
                          </span>
                          <span className="text-blue-600 whitespace-nowrap">
                            Contenido fiscal modificado:
                          </span>
                          <span className="font-mono text-blue-800">No</span>
                          <span className="text-blue-600 whitespace-nowrap">
                            Riesgo para timbre/sello:
                          </span>
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
                  El XML contiene Addenda. Se conserva como información adicional y no forma parte
                  de la validación fiscal base.
                </p>
              )}

              {result.structureDiagnostics.unknownComplements.length > 0 && (
                <p className="text-sm text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3">
                  El XML contiene complementos no clasificados por el motor actual. Esto no
                  significa que el XML sea inválido; puede requerir una revisión especializada según
                  el proceso.
                </p>
              )}

              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Tiene Complemento</span>
                  <span className="font-medium">
                    {result.structureDiagnostics.hasComplemento ? "Sí" : "No"}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Tiene Addenda</span>
                  <span className="font-medium">
                    {result.structureDiagnostics.hasAddenda ? "Sí" : "No"}
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-sm font-semibold text-muted-foreground">Namespaces detectados</p>
                {result.structureDiagnostics.namespaces.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {result.structureDiagnostics.namespaces.map((ns, i) => (
                      <span key={i} className="text-xs bg-muted px-2 py-0.5 rounded font-mono">
                        {ns}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No se detectaron namespaces declarados.
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <p className="text-sm font-semibold text-muted-foreground">
                  Complementos detectados
                </p>
                {result.structureDiagnostics.complementNames.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {result.structureDiagnostics.complementNames.map((name, i) => (
                      <span key={i} className="text-xs bg-muted px-2 py-0.5 rounded font-mono">
                        {name}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No se detectaron complementos.</p>
                )}
              </div>

              <div className="space-y-1">
                <p className="text-sm font-semibold text-muted-foreground">
                  Complementos clasificados
                </p>
                {result.structureDiagnostics.knownComplements.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {result.structureDiagnostics.knownComplements.map((name, i) => (
                      <span
                        key={i}
                        className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-mono"
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Ninguno.</p>
                )}
              </div>

              <div className="space-y-1">
                <p className="text-sm font-semibold text-muted-foreground">
                  Complementos no clasificados
                </p>
                {result.structureDiagnostics.unknownComplements.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {result.structureDiagnostics.unknownComplements.map((name, i) => (
                      <span
                        key={i}
                        className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded font-mono"
                      >
                        {name}
                      </span>
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
                            <th className="text-left py-1 pr-2 whitespace-nowrap">
                              No. identificación
                            </th>
                            <th className="text-left py-1 pr-2 whitespace-nowrap">Cantidad</th>
                            <th className="text-left py-1 pr-2 whitespace-nowrap">Clave unidad</th>
                            <th className="text-left py-1 pr-2 whitespace-nowrap">Unidad</th>
                            <th className="text-left py-1 pr-2 whitespace-nowrap">Descripción</th>
                            <th className="text-left py-1 pr-2 whitespace-nowrap">
                              Valor unitario
                            </th>
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
                              <td
                                className="py-1 pr-2 max-w-[200px] truncate"
                                title={c.descripcion}
                              >
                                {c.descripcion ?? "—"}
                              </td>
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
                            Concepto #{idx + 1} — {c.descripcion ?? "(sin descripción)"}{" "}
                            {c.importe ? `— ${c.importe}` : ""}
                          </p>
                          {c.impuestos ? (
                            <>
                              {c.impuestos.traslados.length > 0 && (
                                <div className="overflow-x-auto">
                                  <p className="text-xs font-semibold text-muted-foreground mb-1">
                                    Traslados
                                  </p>
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
                                  <p className="text-xs font-semibold text-muted-foreground mb-1">
                                    Retenciones
                                  </p>
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
                              {c.impuestos.traslados.length === 0 &&
                                c.impuestos.retenciones.length === 0 && (
                                  <p className="text-sm text-muted-foreground">
                                    Este concepto no contiene impuestos a nivel concepto.
                                  </p>
                                )}
                            </>
                          ) : (
                            <p className="text-sm text-muted-foreground">
                              Este concepto no contiene impuestos a nivel concepto.
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No se detectaron conceptos fiscales en este XML.
                  </p>
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
                            <th className="text-left py-1 pr-2 whitespace-nowrap">
                              Base calculada
                            </th>
                            <th className="text-left py-1 pr-2 whitespace-nowrap">
                              Importe calculado
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.taxSummary.transferred.map((t, i) => (
                            <tr key={i} className="border-b border-border/30">
                              <td className="py-1 pr-2 font-medium">
                                {t.impuestoLabel} ({t.impuesto})
                              </td>
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
                    <p className="text-sm text-muted-foreground">
                      No se detectaron impuestos trasladados por concepto.
                    </p>
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
                            <th className="text-left py-1 pr-2 whitespace-nowrap">
                              Base calculada
                            </th>
                            <th className="text-left py-1 pr-2 whitespace-nowrap">
                              Importe calculado
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.taxSummary.retained.map((r, i) => (
                            <tr key={i} className="border-b border-border/30">
                              <td className="py-1 pr-2 font-medium">
                                {r.impuestoLabel} ({r.impuesto})
                              </td>
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
                    <p className="text-sm text-muted-foreground">
                      No se detectaron impuestos retenidos por concepto.
                    </p>
                  )}
                </div>
              </div>
            )}

            {result.totalsValidation && (
              <div className="p-6 rounded-xl border border-border bg-card space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold text-lg">Validación de totales</h2>
                  <span
                    className={`text-xs font-bold px-3 py-1 rounded-full border ${
                      result.totalsValidation.matches
                        ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                        : "text-red-700 bg-red-50 border-red-200"
                    }`}
                  >
                    {result.totalsValidation.matches
                      ? "Totales consistentes"
                      : "Diferencias detectadas"}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Subtotal XML</span>
                    <span className="font-medium">
                      {result.totalsValidation.subtotalXml ?? "—"}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Subtotal calculado</span>
                    <span className="font-medium">
                      {result.totalsValidation.subtotalCalculated ?? "—"}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Descuento calculado</span>
                    <span className="font-medium">
                      {result.totalsValidation.discountCalculated ?? "—"}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50"></div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Impuestos trasladados XML</span>
                    <span className="font-medium">
                      {result.totalsValidation.transferredTaxesXml ?? "—"}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Impuestos trasladados calculados</span>
                    <span className="font-medium">
                      {result.totalsValidation.transferredTaxesCalculated ?? "—"}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Impuestos retenidos XML</span>
                    <span className="font-medium">
                      {result.totalsValidation.retainedTaxesXml ?? "—"}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Impuestos retenidos calculados</span>
                    <span className="font-medium">
                      {result.totalsValidation.retainedTaxesCalculated ?? "—"}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Total XML</span>
                    <span className="font-medium">{result.totalsValidation.totalXml ?? "—"}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Total calculado</span>
                    <span className="font-medium">
                      {result.totalsValidation.totalCalculated ?? "—"}
                    </span>
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
                  <span className="font-mono text-xs text-right max-w-[300px] break-all">
                    {result.uuid ?? "—"}
                  </span>
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
                  <h3 className="text-sm font-semibold text-muted-foreground">
                    Compatibilidad técnica
                  </h3>
                  <p className="text-sm text-muted-foreground bg-muted/50 rounded-lg px-4 py-3">
                    Las incidencias y advertencias tradicionales se conservan internamente por
                    compatibilidad. Consulta los hallazgos estructurados para el diagnóstico
                    principal.
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

        {result &&
          (() => {
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
              const blob = new Blob([JSON.stringify(payload, null, 2)], {
                type: "application/json",
              });
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
            function formatEvidence(
              evidence: { label: string; value?: string }[] | undefined,
            ): string {
              if (!evidence || evidence.length === 0) return "";
              return evidence.map((e) => `${e.label}: ${e.value ?? "—"}`).join(" | ");
            }
            function handleExportCsv() {
              if (!r.findings || r.findings.length === 0) return;
              const header =
                "ID,Severidad,Prioridad,Categoria,Grupo accionable,Codigo,Titulo,Mensaje,Accion recomendada,Evidencia";
              const rows = r.findings.map((f) => {
                const cols = [
                  escCsv(f.id),
                  escCsv(f.severity),
                  escCsv(f.priority ?? "LOW"),
                  escCsv(f.category),
                  escCsv(f.actionGroup ?? "Informativo"),
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
                lines.push(vals.map((v) => escCsv(v ?? "—")).join(","));
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
                Serie: r.serie,
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
                row(
                  "ID",
                  "Severidad",
                  "Categoría",
                  "Código",
                  "Título",
                  "Mensaje",
                  "Acción recomendada",
                );
                for (const f of r.findings) {
                  row(
                    f.id,
                    f.severity,
                    f.category,
                    f.code,
                    f.title,
                    f.message,
                    f.recommendedAction ?? "",
                  );
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
                "Timbre Fiscal Digital": r.technicalDiagnostics.hasTimbreFiscalDigital
                  ? "Sí"
                  : "No",
                "BOM UTF-8 detectado": r.technicalDiagnostics.bomDetected ? "Sí" : "No",
                "Contenido previo al XML": r.technicalDiagnostics.leadingContentBeforeXml
                  ? "Sí"
                  : "No",
                "Normalización segura aplicada": r.technicalDiagnostics.safeNormalizationApplied
                  ? "Sí"
                  : "No",
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
                    row(
                      "UUID",
                      "Serie",
                      "Folio",
                      "Moneda DR",
                      "Equivalencia",
                      "Parcialidad",
                      "Saldo ant.",
                      "Pagado",
                      "Saldo insoluto",
                      "Objeto imp.",
                    );
                    for (const d of p.documentosRelacionados) {
                      row(
                        d.idDocumento,
                        d.serie,
                        d.folio,
                        d.monedaDR,
                        d.equivalenciaDR,
                        d.numParcialidad,
                        d.impSaldoAnt,
                        d.impPagado,
                        d.impSaldoInsoluto,
                        d.objetoImpDR,
                      );
                    }
                  }
                }
              }

              if (r.cartaPorte) {
                section("CARTA PORTE - RESUMEN");
                sub("", {
                  Versión: r.cartaPorte.version ?? "—",
                  IdCCP: r.cartaPorte.idCCP ?? "—",
                  "Transporte internacional": r.cartaPorte.transpInternac ?? "—",
                  "Total distancia recorrida": r.cartaPorte.totalDistRec ?? "—",
                  Autotransporte: r.cartaPorte.hasAutotransporte ? "Sí" : "No",
                  Marítimo: r.cartaPorte.hasTransporteMaritimo ? "Sí" : "No",
                  Aéreo: r.cartaPorte.hasTransporteAereo ? "Sí" : "No",
                  Ferroviario: r.cartaPorte.hasTransporteFerroviario ? "Sí" : "No",
                  "Total ubicaciones": String(r.cartaPorte.ubicaciones.length),
                  "Total mercancías": String(r.cartaPorte.mercancias.length),
                  "Total figuras transporte": String(r.cartaPorte.figurasTransporte.length),
                });

                if (r.cartaPorte.ubicaciones.length > 0) {
                  section("CARTA PORTE - UBICACIONES");
                  row(
                    "#",
                    "TipoUbicacion",
                    "IDUbicacion",
                    "RFCRemitenteDestinatario",
                    "NombreRemitenteDestinatario",
                    "FechaHoraSalidaLlegada",
                    "DistanciaRecorrida",
                  );
                  for (let i = 0; i < r.cartaPorte.ubicaciones.length; i++) {
                    const u = r.cartaPorte.ubicaciones[i];
                    row(
                      String(i + 1),
                      u.tipoUbicacion,
                      u.idUbicacion,
                      u.rfcRemitenteDestinatario,
                      u.nombreRemitenteDestinatario,
                      u.fechaHoraSalidaLlegada,
                      u.distanciaRecorrida,
                    );
                  }
                  lines.push("");
                }

                if (r.cartaPorte.mercancias.length > 0) {
                  section("CARTA PORTE - MERCANCÍAS");
                  row(
                    "#",
                    "BienesTransp",
                    "Descripcion",
                    "Cantidad",
                    "ClaveUnidad",
                    "PesoEnKg",
                    "ValorMercancia",
                    "Moneda",
                  );
                  for (let i = 0; i < r.cartaPorte.mercancias.length; i++) {
                    const m = r.cartaPorte.mercancias[i];
                    row(
                      String(i + 1),
                      m.bienesTransp,
                      m.descripcion,
                      m.cantidad,
                      m.claveUnidad,
                      m.pesoEnKg,
                      m.valorMercancia,
                      m.moneda,
                    );
                  }
                  lines.push("");
                }

                if (r.cartaPorte.figurasTransporte.length > 0) {
                  section("CARTA PORTE - FIGURAS TRANSPORTE");
                  row("#", "TipoFigura", "RFCFigura", "NombreFigura", "NumLicencia");
                  for (let i = 0; i < r.cartaPorte.figurasTransporte.length; i++) {
                    const f = r.cartaPorte.figurasTransporte[i];
                    row(String(i + 1), f.tipoFigura, f.rfcFigura, f.nombreFigura, f.numLicencia);
                  }
                  lines.push("");
                }
              }

              if (r.comercioExterior) {
                section("COMERCIO EXTERIOR");
                sub("", {
                  Versión: r.comercioExterior.version ?? "—",
                  "Tipo operación": r.comercioExterior.tipoOperacion ?? "—",
                  "Clave de pedimento": r.comercioExterior.claveDePedimento ?? "—",
                  "Certificado de origen": r.comercioExterior.certificadoOrigen ?? "—",
                  "No. exportador confiable": r.comercioExterior.numeroExportadorConfiable ?? "—",
                  Incoterm: r.comercioExterior.incoterm ?? "—",
                  SubDivisión: r.comercioExterior.subDivision ?? "—",
                  TipoCambioUSD: r.comercioExterior.tipoCambioUSD ?? "—",
                  TotalUSD: r.comercioExterior.totalUSD ?? "—",
                  Observaciones: r.comercioExterior.observaciones ?? "—",
                });
              }

              if (r.impuestosLocales) {
                section("IMPUESTOS LOCALES - RESUMEN");
                sub("", {
                  Versión: r.impuestosLocales.version ?? "—",
                  "Total retenciones": r.impuestosLocales.totalDeRetenciones ?? "—",
                  "Total traslados": r.impuestosLocales.totalDeTraslados ?? "—",
                  Retenciones: String(r.impuestosLocales.retenciones.length),
                  Traslados: String(r.impuestosLocales.traslados.length),
                });
                if (r.impuestosLocales.retenciones.length > 0) {
                  section("IMPUESTOS LOCALES - RETENCIONES");
                  row("#", "ImpLocRetenido", "TasaDeRetencion", "Importe");
                  for (let i = 0; i < r.impuestosLocales.retenciones.length; i++) {
                    const ret = r.impuestosLocales.retenciones[i];
                    row(String(i + 1), ret.impLocRetenido, ret.tasaDeRetencion, ret.importe);
                  }
                  lines.push("");
                }
                if (r.impuestosLocales.traslados.length > 0) {
                  section("IMPUESTOS LOCALES - TRASLADOS");
                  row("#", "ImpLocTrasladado", "TasaDeTraslado", "Importe");
                  for (let i = 0; i < r.impuestosLocales.traslados.length; i++) {
                    const tras = r.impuestosLocales.traslados[i];
                    row(String(i + 1), tras.impLocTrasladado, tras.tasaDeTraslado, tras.importe);
                  }
                  lines.push("");
                }
              }

              if (r.leyendasFiscales) {
                section("LEYENDAS FISCALES - RESUMEN");
                sub("", {
                  Versión: r.leyendasFiscales.version ?? "—",
                  "Total leyendas": String(r.leyendasFiscales.leyendas.length),
                });
                if (r.leyendasFiscales.leyendas.length > 0) {
                  section("LEYENDAS FISCALES - DETALLE");
                  row("#", "DisposicionFiscal", "Norma", "TextoLeyenda");
                  for (let i = 0; i < r.leyendasFiscales.leyendas.length; i++) {
                    const l = r.leyendasFiscales.leyendas[i];
                    row(String(i + 1), l.disposicionFiscal ?? "—", l.norma ?? "—", l.textoLeyenda ?? "—");
                  }
                  lines.push("");
                }
              }

              if (r.donatarias) {
                section("DONATARIAS");
                sub("", {
                  Versión: r.donatarias.version ?? "—",
                  NoAutorizacion: r.donatarias.noAutorizacion ?? "—",
                  FechaAutorizacion: r.donatarias.fechaAutorizacion ?? "—",
                  Leyenda: r.donatarias.leyenda ?? "—",
                });
                lines.push("");
              }

              if (r.documentKind === "RETENCIONES" && r.retenciones) {
                section("RETENCIONES - GENERAL");
                sub("", {
                  Versión: r.retenciones.version ?? "—",
                  "Folio interno": r.retenciones.folioInt ?? "—",
                  "Fecha expedición": r.retenciones.fechaExp ?? "—",
                  CveRetenc: r.retenciones.cveRetenc ?? "—",
                  DescRetenc: r.retenciones.descRetenc ?? "—",
                  "Lugar expedición": r.retenciones.lugarExpRetenc ?? "—",
                  UUID: r.retenciones.uuid ?? "—",
                  "Fecha timbrado": r.retenciones.fechaTimbrado ?? "—",
                });
                if (r.retenciones.emisor) {
                  section("RETENCIONES - EMISOR");
                  sub("", {
                    RFC: r.retenciones.emisor.rfcEmisor ?? "—",
                    Nombre: r.retenciones.emisor.nombre ?? "—",
                    CURP: r.retenciones.emisor.curp ?? "—",
                  });
                }
                if (r.retenciones.receptor) {
                  section("RETENCIONES - RECEPTOR");
                  sub("", {
                    Nacionalidad: r.retenciones.receptor.nacionalidad ?? "—",
                    "RFC / NumRegIdTrib": r.retenciones.receptor.rfcReceptor ?? r.retenciones.receptor.numRegIdTrib ?? "—",
                    Nombre: r.retenciones.receptor.nombre ?? "—",
                    CURP: r.retenciones.receptor.curp ?? "—",
                  });
                }
                if (r.retenciones.periodo) {
                  section("RETENCIONES - PERIODO");
                  sub("", {
                    "Mes inicial": r.retenciones.periodo.mesIni ?? "—",
                    "Mes final": r.retenciones.periodo.mesFin ?? "—",
                    Ejercicio: r.retenciones.periodo.ejercicio ?? "—",
                  });
                }
                if (r.retenciones.totales) {
                  section("RETENCIONES - TOTALES");
                  sub("", {
                    "Monto total operación": r.retenciones.totales.montoTotOperacion ?? "—",
                    "Monto total gravado": r.retenciones.totales.montoTotGrav ?? "—",
                    "Monto total exento": r.retenciones.totales.montoTotExent ?? "—",
                    "Monto total retenido": r.retenciones.totales.montoTotRet ?? "—",
                  });
                  if (r.retenciones.totales.impuestosRetenidos.length > 0) {
                    section("RETENCIONES - IMPUESTOS RETENIDOS");
                    row("#", "BaseRet", "Impuesto", "MontoRet", "TipoPagoRet");
                    for (let i = 0; i < r.retenciones.totales.impuestosRetenidos.length; i++) {
                      const ir = r.retenciones.totales.impuestosRetenidos[i];
                      row(String(i + 1), ir.baseRet ?? "—", ir.impuesto ?? "—", ir.montoRet ?? "—", ir.tipoPagoRet ?? "—");
                    }
                    lines.push("");
                  }
                }
              }

              if (r.addenda?.detected) {
                section("ADDENDA - RESUMEN");
                sub("", {
                  Detectada: "Sí",
                  "Root keys": r.addenda.rootKeys.join(", "),
                  "Node count": String(r.addenda.nodeCount),
                  "Max depth": String(r.addenda.maxDepth),
                  Truncada: r.addenda.truncated ? "Sí" : "No",
                  "Señales detectadas": String(r.addenda.signals.length),
                });
                if (r.addenda.signals.length > 0) {
                  section("ADDENDA - SEÑALES");
                  row("#", "Label", "Valor", "Path", "Confianza");
                  for (let i = 0; i < r.addenda.signals.length; i++) {
                    const s = r.addenda.signals[i];
                    row(String(i + 1), s.label, s.value, s.path, s.confidence);
                  }
                  lines.push("");
                }
                if (r.addenda.nodeSummary.length > 0) {
                  section("ADDENDA - NODOS");
                  row("#", "Path", "Nombre", "Child count", "Scalar fields");
                  for (let i = 0; i < r.addenda.nodeSummary.length; i++) {
                    const ns = r.addenda.nodeSummary[i];
                    row(String(i + 1), ns.path, ns.name, String(ns.childCount), String(ns.scalarFields));
                  }
                  lines.push("");
                }
              }

              if (r.concepts && r.concepts.length > 0) {
                section("CONCEPTOS");
                row(
                  "ClaveProdServ",
                  "No. identificación",
                  "Cantidad",
                  "Clave unidad",
                  "Unidad",
                  "Descripción",
                  "Valor unitario",
                  "Importe",
                  "Descuento",
                  "Objeto imp.",
                );
                for (const c of r.concepts) {
                  row(
                    c.claveProdServ,
                    c.noIdentificacion,
                    c.cantidad,
                    c.claveUnidad,
                    c.unidad,
                    c.descripcion,
                    c.valorUnitario,
                    c.importe,
                    c.descuento,
                    c.objetoImp,
                  );
                }
                lines.push("");
                section("IMPUESTOS POR CONCEPTO");
                row(
                  "Concepto #",
                  "Tipo",
                  "Base",
                  "Impuesto",
                  "Tipo factor",
                  "Tasa o cuota",
                  "Importe",
                );
                for (let i = 0; i < r.concepts.length; i++) {
                  const c = r.concepts[i];
                  const label = `Concepto #${i + 1}`;
                  if (c.impuestos) {
                    for (const t of c.impuestos.traslados)
                      row(
                        label,
                        "Traslado",
                        t.base,
                        t.impuesto,
                        t.tipoFactor,
                        t.tasaOCuota,
                        t.importe,
                      );
                    for (const t of c.impuestos.retenciones)
                      row(
                        label,
                        "Retención",
                        t.base,
                        t.impuesto,
                        t.tipoFactor,
                        t.tasaOCuota,
                        t.importe,
                      );
                  }
                }
              }

              if (r.taxSummary) {
                section("RESUMEN DE IMPUESTOS");
                if (r.taxSummary.transferred.length > 0) {
                  lines.push(escCsv("Trasladados"));
                  row(
                    "Impuesto",
                    "Tipo factor",
                    "Tasa o cuota",
                    "Base calculada",
                    "Importe calculado",
                  );
                  for (const t of r.taxSummary.transferred)
                    row(
                      t.impuestoLabel,
                      t.tipoFactor,
                      t.tasaOCuota,
                      t.baseCalculated,
                      t.importeCalculated,
                    );
                  lines.push("");
                }
                if (r.taxSummary.retained.length > 0) {
                  lines.push(escCsv("Retenidos"));
                  row(
                    "Impuesto",
                    "Tipo factor",
                    "Tasa o cuota",
                    "Base calculada",
                    "Importe calculado",
                  );
                  for (const t of r.taxSummary.retained)
                    row(
                      t.impuestoLabel,
                      t.tipoFactor,
                      t.tasaOCuota,
                      t.baseCalculated,
                      t.importeCalculated,
                    );
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
                  "Contenido fiscal modificado": r.normalizedXml.fiscalContentModified
                    ? "Sí"
                    : "No",
                  "Riesgo timbre/sello": r.normalizedXml.stampRisk,
                  "Hash original SHA-256": r.normalizedXml.originalSha256,
                  "Hash normalizado SHA-256": r.normalizedXml.normalizedSha256,
                });
              }

              if (r.analysisMeta) {
                const p = r.analysisMeta.performance;
                section("METADATA DEL ANALISIS");
                sub("Rendimiento", {
                  "Tiempo total (ms)": String(p.totalMs),
                  "Tamaño entrada (bytes)": String(p.inputBytes),
                  "Tamaño entrada (KB)": String(p.inputKb),
                  "Hallazgos originales": String(p.findingsOriginalCount),
                  "Hallazgos devueltos": String(p.findingsReturnedCount),
                  Truncado: p.findingsTruncated ? "Sí" : "No",
                  Sanitizado: p.sanitized ? "Sí" : "No",
                  "XML normalizado disponible": p.normalizedXmlAvailable ? "Sí" : "No",
                });
                sub("Documento", {
                  "Engine version": r.analysisMeta.engineVersion,
                  "Tipo documento": r.analysisMeta.coverage.documentKind,
                  "Complementos detectados": r.analysisMeta.coverage.complementsDetected.join(", "),
                  "Complementos no clasificados": r.analysisMeta.coverage.complementsUnknown.join(", "),
                  Addenda: r.analysisMeta.coverage.hasAddenda ? "Sí" : "No",
                  "Timbre Fiscal Digital": r.analysisMeta.coverage.hasTimbreFiscalDigital ? "Sí" : "No",
                  "Normalización segura": r.analysisMeta.coverage.hasSafeNormalization ? "Sí" : "No",
                });
                section("COBERTURA DEL ANALISIS");
                row("Módulo", "Detectado", "Analizado", "Hallazgos", "Motivo omisión");
                for (const m of r.analysisMeta.coverage.modules) {
                  row(m.label, m.detected ? "Sí" : "No", m.analyzed ? "Sí" : "No", String(m.findingsCount), m.skippedReason ?? "");
                }
                lines.push("");
              }

              if (r.findings && r.findings.length > 0) {
                section("PRIORIDADES DE HALLAZGOS");
                row("Prioridad", "Grupo accionable", "Código", "Severidad", "Categoría", "Título", "Acción recomendada");
                const sorted = sortFindingsByPriority(r.findings);
                for (const f of sorted) {
                  row(
                    f.priority ?? "LOW",
                    f.actionGroup ?? "Informativo",
                    f.code,
                    f.severity,
                    f.category,
                    f.title,
                    f.recommendedAction ?? "",
                  );
                }
                lines.push("");
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
                <button
                  onClick={() => window.print()}
                  className="w-full py-2.5 px-4 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-all"
                >
                  Imprimir reporte / Guardar PDF
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

      {result &&
        (() => {
          const r = result;
          function severityBadge(s: string) {
            const cls =
              s === "CRITICAL"
                ? "badge-critical"
                : s === "WARNING"
                  ? "badge-warning"
                  : "badge-info";
            return <span className={cls}>{s}</span>;
          }
          return (
            <div className="print-report hidden">
              <div
                style={{
                  padding: "32px 40px 24px",
                  maxWidth: "800px",
                  margin: "0 auto",
                  fontFamily: "Arial, Helvetica, sans-serif",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: "16px",
                  }}
                >
                  <div>
                    <h1 style={{ fontSize: "20px", fontWeight: 700, color: "#2563eb", margin: 0 }}>
                      FISCORA
                    </h1>
                    <p style={{ fontSize: "10px", color: "#888", margin: "2px 0 0" }}>
                      Reporte de Auditoría XML
                    </p>
                  </div>
                  <div style={{ textAlign: "right", fontSize: "10px", color: "#555" }}>
                    <p style={{ margin: 0 }}>
                      {new Date().toLocaleDateString("es-MX", {
                        day: "2-digit",
                        month: "long",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                    {r.uuid && (
                      <p
                        style={{
                          margin: "2px 0 0",
                          fontFamily: "monospace",
                          fontSize: "9px",
                          color: "#888",
                        }}
                      >
                        UUID: {r.uuid}
                      </p>
                    )}
                  </div>
                </div>

                <p
                  style={{
                    fontSize: "9px",
                    color: "#888",
                    fontStyle: "italic",
                    marginBottom: "16px",
                    padding: "8px",
                    background: "#f9fafb",
                    borderRadius: "4px",
                    border: "1px solid #e5e7eb",
                  }}
                >
                  Este reporte se genera con base en el XML analizado en memoria. No sustituye la
                  validación oficial del SAT ni constituye dictamen fiscal.
                </p>

                {r.executiveSummary && (
                  <div className="avoid-break">
                    <h2>Resumen ejecutivo</h2>
                    <div style={{ marginBottom: "8px" }}>
                      <span
                        className={`badge-${r.executiveSummary.riskLevel === "CRITICAL" ? "critical" : r.executiveSummary.riskLevel === "WARNING" ? "warning" : "ok"}`}
                        style={{ marginBottom: "4px" }}
                      >
                        {r.executiveSummary.riskLevel}
                      </span>
                    </div>
                    <p style={{ fontWeight: 600, margin: "4px 0" }}>{r.executiveSummary.title}</p>
                    <p style={{ margin: "4px 0" }}>{r.executiveSummary.message}</p>
                    <p style={{ margin: "4px 0", fontSize: "10px" }}>
                      <span style={{ fontWeight: 600 }}>Acción recomendada:</span>{" "}
                      {r.executiveSummary.recommendedAction}
                    </p>
                  </div>
                )}

                {r.analysisMeta && (
                  <div className="avoid-break">
                    <h2>Metadata del análisis</h2>
                    <div className="meta-grid">
                      <div className="meta-item">
                        <span className="meta-label">Fecha generación</span>
                        <span className="meta-value">{new Date(r.analysisMeta.generatedAt).toLocaleString()}</span>
                      </div>
                      <div className="meta-item">
                        <span className="meta-label">Engine version</span>
                        <span className="meta-value">{r.analysisMeta.engineVersion}</span>
                      </div>
                      <div className="meta-item">
                        <span className="meta-label">Tipo documento</span>
                        <span className="meta-value">{r.analysisMeta.coverage.documentKind}</span>
                      </div>
                      <div className="meta-item">
                        <span className="meta-label">Tiempo total</span>
                        <span className="meta-value">{r.analysisMeta.performance.totalMs} ms</span>
                      </div>
                      <div className="meta-item">
                        <span className="meta-label">Tamaño de entrada</span>
                        <span className="meta-value">{r.analysisMeta.performance.inputKb} KB</span>
                      </div>
                      <div className="meta-item">
                        <span className="meta-label">Hallazgos originales</span>
                        <span className="meta-value">{r.analysisMeta.performance.findingsOriginalCount}</span>
                      </div>
                      <div className="meta-item">
                        <span className="meta-label">Hallazgos devueltos</span>
                        <span className="meta-value">{r.analysisMeta.performance.findingsReturnedCount}</span>
                      </div>
                      <div className="meta-item">
                        <span className="meta-label">Truncado</span>
                        <span className="meta-value">{r.analysisMeta.performance.findingsTruncated ? "Sí" : "No"}</span>
                      </div>
                      <div className="meta-item">
                        <span className="meta-label">Sanitizado</span>
                        <span className="meta-value">{r.analysisMeta.performance.sanitized ? "Sí" : "No"}</span>
                      </div>
                      <div className="meta-item">
                        <span className="meta-label">XML normalizado disponible</span>
                        <span className="meta-value">{r.analysisMeta.performance.normalizedXmlAvailable ? "Sí" : "No"}</span>
                      </div>
                    </div>
                    <h3 style={{ fontSize: "14px", fontWeight: 600, marginTop: "16px", marginBottom: "8px" }}>Cobertura del análisis</h3>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10px" }}>
                      <thead>
                        <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                          <th style={{ textAlign: "left", padding: "4px 6px" }}>Módulo</th>
                          <th style={{ textAlign: "center", padding: "4px 6px" }}>Detectado</th>
                          <th style={{ textAlign: "center", padding: "4px 6px" }}>Analizado</th>
                          <th style={{ textAlign: "right", padding: "4px 6px" }}>Hallazgos</th>
                          <th style={{ textAlign: "left", padding: "4px 6px" }}>Motivo omisión</th>
                        </tr>
                      </thead>
                      <tbody>
                        {r.analysisMeta.coverage.modules.map((m) => (
                          <tr key={m.key} style={{ borderBottom: "1px solid #e5e7eb" }}>
                            <td style={{ padding: "3px 6px", fontWeight: 500 }}>{m.label}</td>
                            <td style={{ padding: "3px 6px", textAlign: "center" }}>{m.detected ? "Sí" : "No"}</td>
                            <td style={{ padding: "3px 6px", textAlign: "center" }}>{m.analyzed ? "Sí" : "No"}</td>
                            <td style={{ padding: "3px 6px", textAlign: "right", fontFamily: "monospace" }}>{m.findingsCount}</td>
                            <td style={{ padding: "3px 6px", color: "#888", fontStyle: "italic" }}>{m.skippedReason ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {r.analysisMeta.coverage.complementsDetected.length > 0 && (
                      <p style={{ fontSize: "10px", color: "#666", marginTop: "8px" }}>
                        Complementos detectados: {r.analysisMeta.coverage.complementsDetected.join(", ")}
                      </p>
                    )}
                  </div>
                )}

                <div className="avoid-break">
                  <h2>Metadata fiscal</h2>
                  <div className="meta-grid">
                    <div className="meta-item">
                      <span className="meta-label">UUID</span>
                      <span className="meta-value">{r.uuid ?? "—"}</span>
                    </div>
                    <div className="meta-item">
                      <span className="meta-label">Tipo comprobante</span>
                      <span className="meta-value">{r.tipoComprobante ?? "—"}</span>
                    </div>
                    <div className="meta-item">
                      <span className="meta-label">Versión CFDI</span>
                      <span className="meta-value">{r.version ?? "—"}</span>
                    </div>
                    <div className="meta-item">
                      <span className="meta-label">Fecha CFDI</span>
                      <span className="meta-value">{r.fecha ?? "—"}</span>
                    </div>
                    <div className="meta-item">
                      <span className="meta-label">Fecha timbrado</span>
                      <span className="meta-value">{r.fechaTimbrado ?? "—"}</span>
                    </div>
                    <div className="meta-item">
                      <span className="meta-label">RFC emisor</span>
                      <span className="meta-value">{r.rfcEmisor ?? "—"}</span>
                    </div>
                    <div className="meta-item">
                      <span className="meta-label">Nombre emisor</span>
                      <span className="meta-value">{r.nombreEmisor ?? "—"}</span>
                    </div>
                    <div className="meta-item">
                      <span className="meta-label">RFC receptor</span>
                      <span className="meta-value">{r.rfcReceptor ?? "—"}</span>
                    </div>
                    <div className="meta-item">
                      <span className="meta-label">Nombre receptor</span>
                      <span className="meta-value">{r.nombreReceptor ?? "—"}</span>
                    </div>
                    <div className="meta-item">
                      <span className="meta-label">Serie</span>
                      <span className="meta-value">{r.serie ?? "—"}</span>
                    </div>
                    <div className="meta-item">
                      <span className="meta-label">Folio</span>
                      <span className="meta-value">{r.folio ?? "—"}</span>
                    </div>
                    <div className="meta-item">
                      <span className="meta-label">Moneda</span>
                      <span className="meta-value">{r.moneda ?? "—"}</span>
                    </div>
                    <div className="meta-item">
                      <span className="meta-label">Subtotal</span>
                      <span className="meta-value">{r.subtotal ?? "—"}</span>
                    </div>
                    <div className="meta-item">
                      <span className="meta-label">Total</span>
                      <span className="meta-value">{r.total ?? "—"}</span>
                    </div>
                    <div className="meta-item">
                      <span className="meta-label">Método de pago</span>
                      <span className="meta-value">{r.metodoPago ?? "—"}</span>
                    </div>
                    <div className="meta-item">
                      <span className="meta-label">Forma de pago</span>
                      <span className="meta-value">{r.formaPago ?? "—"}</span>
                    </div>
                    <div className="meta-item">
                      <span className="meta-label">Uso CFDI</span>
                      <span className="meta-value">{r.usoCfdi ?? "—"}</span>
                    </div>
                  </div>
                </div>

                <div className="avoid-break">
                  <h2>Hallazgos</h2>
                  {r.findings && r.findings.length > 0 ? (
                    <>
                      <div className="findings-count">
                        <span>
                          Críticos:{" "}
                          <strong>
                            {r.findings.filter((f) => f.severity === "CRITICAL").length}
                          </strong>
                        </span>
                        <span>
                          Advertencias:{" "}
                          <strong>
                            {r.findings.filter((f) => f.severity === "WARNING").length}
                          </strong>
                        </span>
                        <span>
                          Informativos:{" "}
                          <strong>{r.findings.filter((f) => f.severity === "INFO").length}</strong>
                        </span>
                      </div>
                      <div style={{ marginTop: "8px", marginBottom: "8px" }}>
                        <p style={{ fontWeight: 600, fontSize: "11px", margin: "0 0 4px" }}>
                          Prioridades del análisis
                        </p>
                        <div style={{ display: "flex", gap: "12px", fontSize: "10px" }}>
                          {([
                            { key: "BLOCKER", label: "Bloqueantes" },
                            { key: "HIGH", label: "Alta" },
                            { key: "MEDIUM", label: "Media" },
                            { key: "LOW", label: "Informativa" },
                          ] as const).map(({ key, label }) => (
                            <span key={key}>
                              {label}: <strong>{r.findings!.filter((f: Finding) => f.priority === key).length}</strong>
                            </span>
                          ))}
                        </div>
                        {(() => {
                          const sorted = sortFindingsByPriority(r.findings!).slice(0, 5);
                          return (
                            <div style={{ marginTop: "6px" }}>
                              <p style={{ fontWeight: 600, fontSize: "10px", margin: "0 0 2px" }}>
                                Top 5 acciones recomendadas
                              </p>
                              {sorted.map((f, i) => (
                                <p key={i} style={{ fontSize: "9px", margin: "1px 0" }}>
                                  <strong>#{i + 1} {f.code}</strong> ({f.priority ?? "LOW"}):{" "}
                                  {f.recommendedAction ?? f.title}
                                </p>
                              ))}
                            </div>
                          );
                        })()}
                        {(() => {
                          const groups = groupFindingsByActionGroup(r.findings!);
                          return (
                            <div style={{ marginTop: "6px" }}>
                              <p style={{ fontWeight: 600, fontSize: "10px", margin: "0 0 2px" }}>
                                Grupos accionables
                              </p>
                              {Object.entries(groups).map(([group, items]) => (
                                <p key={group} style={{ fontSize: "9px", margin: "1px 0" }}>
                                  <strong>{group}:</strong> {items.length} hallazgo(s) (
                                  {items.filter((f) => f.severity === "CRITICAL").length} crítico(s),{" "}
                                  {items.filter((f) => f.severity === "WARNING").length} advertencia(s),{" "}
                                  {items.filter((f) => f.severity === "INFO").length} info)
                                </p>
                              ))}
                            </div>
                          );
                        })()}
                      </div>
                      <table>
                        <thead>
                          <tr>
                            <th style={{ width: "70px" }}>Severidad</th>
                            <th style={{ width: "60px" }}>Categoría</th>
                            <th style={{ width: "80px" }}>Código</th>
                            <th>Título</th>
                            <th>Evidencia</th>
                          </tr>
                        </thead>
                        <tbody>
                          {r.findings.map((f) => (
                            <tr key={f.id}>
                              <td>{severityBadge(f.severity)}</td>
                              <td style={{ fontSize: "9px" }}>{f.category}</td>
                              <td style={{ fontFamily: "monospace", fontSize: "9px" }}>{f.code}</td>
                              <td>
                                <p style={{ fontWeight: 600, margin: 0, fontSize: "10px" }}>
                                  {f.title}
                                </p>
                                <p style={{ margin: "2px 0 0", fontSize: "9px" }}>{f.message}</p>
                                {f.recommendedAction && (
                                  <p style={{ margin: "2px 0 0", fontSize: "9px", color: "#555" }}>
                                    Acción: {f.recommendedAction}
                                  </p>
                                )}
                              </td>
                              <td style={{ fontSize: "9px" }}>
                                {f.evidence && f.evidence.length > 0
                                  ? f.evidence.map((e, i) => (
                                      <div key={i}>
                                        <span style={{ fontWeight: 600 }}>{e.label}:</span>{" "}
                                        {e.value ?? "—"}
                                      </div>
                                    ))
                                  : "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  ) : (
                    <p style={{ fontSize: "10px", color: "#888" }}>No se detectaron hallazgos.</p>
                  )}
                </div>

                <div className="avoid-break">
                  <h2>Diagnóstico técnico</h2>
                  <table>
                    <tbody>
                      <tr>
                        <td style={{ fontWeight: 600, width: "240px" }}>XML timbrado</td>
                        <td>{r.technicalDiagnostics.isStamped ? "Sí" : "No"}</td>
                      </tr>
                      <tr>
                        <td style={{ fontWeight: 600 }}>Timbre Fiscal Digital detectado</td>
                        <td>{r.technicalDiagnostics.hasTimbreFiscalDigital ? "Sí" : "No"}</td>
                      </tr>
                      <tr>
                        <td style={{ fontWeight: 600 }}>BOM UTF-8 detectado</td>
                        <td>{r.technicalDiagnostics.bomDetected ? "Sí" : "No"}</td>
                      </tr>
                      <tr>
                        <td style={{ fontWeight: 600 }}>Contenido previo al XML</td>
                        <td>{r.technicalDiagnostics.leadingContentBeforeXml ? "Sí" : "No"}</td>
                      </tr>
                      <tr>
                        <td style={{ fontWeight: 600 }}>Normalización segura aplicada</td>
                        <td>{r.technicalDiagnostics.safeNormalizationApplied ? "Sí" : "No"}</td>
                      </tr>
                      {r.normalizedXml && (
                        <>
                          <tr>
                            <td style={{ fontWeight: 600 }}>Hash original SHA-256</td>
                            <td
                              style={{
                                fontFamily: "monospace",
                                fontSize: "9px",
                                wordBreak: "break-all",
                              }}
                            >
                              {r.normalizedXml.originalSha256 ?? "—"}
                            </td>
                          </tr>
                          {r.normalizedXml.normalizedSha256 && (
                            <tr>
                              <td style={{ fontWeight: 600 }}>Hash normalizado SHA-256</td>
                              <td
                                style={{
                                  fontFamily: "monospace",
                                  fontSize: "9px",
                                  wordBreak: "break-all",
                                }}
                              >
                                {r.normalizedXml.normalizedSha256}
                              </td>
                            </tr>
                          )}
                          <tr>
                            <td style={{ fontWeight: 600 }}>Riesgo timbre/sello</td>
                            <td>{r.normalizedXml.stampRisk ?? "—"}</td>
                          </tr>
                          <tr>
                            <td style={{ fontWeight: 600 }}>Contenido fiscal modificado</td>
                            <td>{r.normalizedXml.fiscalContentModified ? "Sí" : "No"}</td>
                          </tr>
                        </>
                      )}
                    </tbody>
                  </table>
                  {r.technicalDiagnostics.safeNormalizationNotes.length > 0 && (
                    <div style={{ marginTop: "8px" }}>
                      <p style={{ fontWeight: 600, fontSize: "10px", margin: "0 0 4px" }}>
                        Notas de normalización:
                      </p>
                      <ul style={{ margin: 0, paddingLeft: "16px" }}>
                        {r.technicalDiagnostics.safeNormalizationNotes.map((note, i) => (
                          <li key={i} style={{ fontSize: "10px" }}>
                            {note}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                <div className="avoid-break">
                  <h2>Diagnóstico estructural</h2>
                  <table>
                    <tbody>
                      <tr>
                        <td style={{ fontWeight: 600, width: "240px" }}>Complemento detectado</td>
                        <td>{r.structureDiagnostics.hasComplemento ? "Sí" : "No"}</td>
                      </tr>
                      <tr>
                        <td style={{ fontWeight: 600 }}>Addenda detectada</td>
                        <td>{r.structureDiagnostics.hasAddenda ? "Sí" : "No"}</td>
                      </tr>
                    </tbody>
                  </table>
                  {r.structureDiagnostics.namespaces.length > 0 && (
                    <div style={{ marginTop: "8px" }}>
                      <p style={{ fontWeight: 600, fontSize: "10px", margin: "0 0 4px" }}>
                        Namespaces:
                      </p>
                      <ul style={{ margin: 0, paddingLeft: "16px" }}>
                        {r.structureDiagnostics.namespaces.map((ns, i) => (
                          <li key={i} style={{ fontFamily: "monospace", fontSize: "9px" }}>
                            {ns}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {r.structureDiagnostics.complementNames.length > 0 && (
                    <div style={{ marginTop: "8px" }}>
                      <p style={{ fontWeight: 600, fontSize: "10px", margin: "0 0 4px" }}>
                        Complementos detectados:
                      </p>
                      <ul style={{ margin: 0, paddingLeft: "16px" }}>
                        {r.structureDiagnostics.complementNames.map((name, i) => (
                          <li key={i} style={{ fontSize: "10px" }}>
                            {name}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {r.structureDiagnostics.knownComplements.length > 0 && (
                    <div style={{ marginTop: "8px" }}>
                      <p style={{ fontWeight: 600, fontSize: "10px", margin: "0 0 4px" }}>
                        Complementos clasificados:
                      </p>
                      <ul style={{ margin: 0, paddingLeft: "16px" }}>
                        {r.structureDiagnostics.knownComplements.map((name, i) => (
                          <li key={i} style={{ fontSize: "10px" }}>
                            {name}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {r.structureDiagnostics.unknownComplements.length > 0 && (
                    <div style={{ marginTop: "8px" }}>
                      <p style={{ fontWeight: 600, fontSize: "10px", margin: "0 0 4px" }}>
                        Complementos no clasificados:
                      </p>
                      <ul style={{ margin: 0, paddingLeft: "16px" }}>
                        {r.structureDiagnostics.unknownComplements.map((name, i) => (
                          <li key={i} style={{ fontSize: "10px" }}>
                            {name}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {r.structureDiagnostics.nodeShapeNotes.length > 0 && (
                    <div style={{ marginTop: "8px" }}>
                      <p style={{ fontWeight: 600, fontSize: "10px", margin: "0 0 4px" }}>
                        Notas estructurales:
                      </p>
                      <ul style={{ margin: 0, paddingLeft: "16px" }}>
                        {r.structureDiagnostics.nodeShapeNotes.map((note, i) => (
                          <li key={i} style={{ fontSize: "10px" }}>
                            {note}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {r.paymentComplement && (
                  <div className="avoid-break">
                    <h2>Complemento de pago</h2>
                    <table>
                      <tbody>
                        <tr>
                          <td style={{ fontWeight: 600, width: "240px" }}>Versión</td>
                          <td>{r.paymentComplement.version ?? "—"}</td>
                        </tr>
                        <tr>
                          <td style={{ fontWeight: 600 }}>Total pagos</td>
                          <td>{r.paymentComplement.pagos.length}</td>
                        </tr>
                        <tr>
                          <td style={{ fontWeight: 600 }}>Documentos relacionados</td>
                          <td>
                            {r.paymentComplement.pagos.reduce(
                              (acc, p) => acc + p.documentosRelacionados.length,
                              0,
                            )}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                    {r.paymentComplement.pagos.map((pago, idx) => (
                      <div key={idx} style={{ marginTop: "8px" }}>
                        <p style={{ fontWeight: 600, fontSize: "11px", margin: "0 0 4px" }}>
                          Pago #{idx + 1}
                        </p>
                        <table>
                          <thead>
                            <tr>
                              <th>Id Documento</th>
                              <th>Serie</th>
                              <th>Folio</th>
                              <th>Moneda DR</th>
                              <th>Parcialidad</th>
                              <th>Saldo anterior</th>
                              <th>Pagado</th>
                              <th>Saldo insoluto</th>
                            </tr>
                          </thead>
                          <tbody>
                            {pago.documentosRelacionados.length > 0 ? (
                              pago.documentosRelacionados.map((d, i) => (
                                <tr key={i}>
                                  <td style={{ fontFamily: "monospace", fontSize: "9px" }}>
                                    {d.idDocumento ?? "—"}
                                  </td>
                                  <td>{d.serie ?? "—"}</td>
                                  <td>{d.folio ?? "—"}</td>
                                  <td>{d.monedaDR ?? "—"}</td>
                                  <td>{d.numParcialidad ?? "—"}</td>
                                  <td>{d.impSaldoAnt ?? "—"}</td>
                                  <td>{d.impPagado ?? "—"}</td>
                                  <td>{d.impSaldoInsoluto ?? "—"}</td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td
                                  colSpan={8}
                                  style={{ textAlign: "center", fontSize: "10px", color: "#888" }}
                                >
                                  Sin documentos relacionados
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    ))}
                  </div>
                )}

                {r.cfdiRelations && (
                  <div className="avoid-break">
                    <h2>CFDI relacionados</h2>
                    <table>
                      <tbody>
                        <tr>
                          <td style={{ fontWeight: 600, width: "240px" }}>Grupos de relación</td>
                          <td>{r.cfdiRelations.totalRelationGroups}</td>
                        </tr>
                        <tr>
                          <td style={{ fontWeight: 600 }}>Total CFDI relacionados</td>
                          <td>{r.cfdiRelations.totalRelatedCfdis}</td>
                        </tr>
                      </tbody>
                    </table>
                    {r.cfdiRelations.groups.map((group, gi) => (
                      <div key={gi} style={{ marginTop: "8px" }}>
                        <p style={{ fontWeight: 600, fontSize: "12px", margin: "0 0 4px" }}>
                          Grupo {gi + 1}
                          {group.tipoRelacion ? ` — TipoRelacion: ${group.tipoRelacion}` : ""}
                        </p>
                        <table>
                          <thead>
                            <tr style={{ fontSize: "10px", borderBottom: "1px solid #ccc" }}>
                              <th style={{ textAlign: "left", padding: "2px 8px 2px 0" }}>#</th>
                              <th style={{ textAlign: "left", padding: "2px 0" }}>UUID</th>
                            </tr>
                          </thead>
                          <tbody>
                            {group.relatedCfdis.map((rel, ri) => (
                              <tr key={ri} style={{ fontSize: "10px" }}>
                                <td style={{ padding: "2px 8px 2px 0", verticalAlign: "top" }}>
                                  {ri + 1}
                                </td>
                                <td style={{ fontFamily: "monospace", padding: "2px 0" }}>
                                  {rel.uuid ?? "—"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ))}
                  </div>
                )}

                {r.cartaPorte && (
                  <div className="avoid-break">
                    <h2>Carta Porte</h2>
                    <table>
                      <tbody>
                        <tr>
                          <td style={{ fontWeight: 600, width: "240px" }}>Versión</td>
                          <td>{r.cartaPorte.version ?? "—"}</td>
                        </tr>
                        <tr>
                          <td style={{ fontWeight: 600 }}>IdCCP</td>
                          <td>{r.cartaPorte.idCCP ?? "—"}</td>
                        </tr>
                        <tr>
                          <td style={{ fontWeight: 600 }}>Transporte internacional</td>
                          <td>{r.cartaPorte.transpInternac ?? "—"}</td>
                        </tr>
                        <tr>
                          <td style={{ fontWeight: 600 }}>Total distancia recorrida</td>
                          <td>{r.cartaPorte.totalDistRec ?? "—"}</td>
                        </tr>
                      </tbody>
                    </table>
                    <p style={{ fontSize: "10px", margin: "4px 0" }}>
                      Modos:{r.cartaPorte.hasAutotransporte ? " Autotransporte" : ""}
                      {r.cartaPorte.hasTransporteMaritimo ? " Marítimo" : ""}
                      {r.cartaPorte.hasTransporteAereo ? " Aéreo" : ""}
                      {r.cartaPorte.hasTransporteFerroviario ? " Ferroviario" : ""} | Ubicaciones:{" "}
                      {r.cartaPorte.ubicaciones.length} | Mercancías:{" "}
                      {r.cartaPorte.mercancias.length} | Figuras:{" "}
                      {r.cartaPorte.figurasTransporte.length}
                    </p>
                    {r.cartaPorte.ubicaciones.length > 0 && (
                      <div style={{ marginTop: "8px" }}>
                        <p style={{ fontWeight: 600, fontSize: "11px", margin: "0 0 4px" }}>
                          Ubicaciones
                        </p>
                        <table>
                          <thead>
                            <tr style={{ fontSize: "9px", borderBottom: "1px solid #ccc" }}>
                              <th style={{ textAlign: "left", padding: "2px 4px 2px 0" }}>Tipo</th>
                              <th style={{ textAlign: "left", padding: "2px 4px" }}>ID</th>
                              <th style={{ textAlign: "left", padding: "2px 4px" }}>RFC</th>
                              <th style={{ textAlign: "left", padding: "2px 4px" }}>Nombre</th>
                              <th style={{ textAlign: "left", padding: "2px 4px" }}>Fecha</th>
                              <th style={{ textAlign: "right", padding: "2px 0 2px 4px" }}>
                                Distancia
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {r.cartaPorte.ubicaciones.map((ubi, ui) => (
                              <tr key={ui} style={{ fontSize: "9px" }}>
                                <td style={{ padding: "2px 4px 2px 0" }}>
                                  {ubi.tipoUbicacion ?? "—"}
                                </td>
                                <td style={{ padding: "2px 4px", fontFamily: "monospace" }}>
                                  {ubi.idUbicacion ?? "—"}
                                </td>
                                <td style={{ padding: "2px 4px", fontFamily: "monospace" }}>
                                  {ubi.rfcRemitenteDestinatario ?? "—"}
                                </td>
                                <td style={{ padding: "2px 4px" }}>
                                  {ubi.nombreRemitenteDestinatario ?? "—"}
                                </td>
                                <td style={{ padding: "2px 4px" }}>
                                  {ubi.fechaHoraSalidaLlegada ?? "—"}
                                </td>
                                <td style={{ padding: "2px 0 2px 4px", textAlign: "right" }}>
                                  {ubi.distanciaRecorrida ?? "—"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    {r.cartaPorte.mercancias.length > 0 && (
                      <div style={{ marginTop: "8px" }}>
                        <p style={{ fontWeight: 600, fontSize: "11px", margin: "0 0 4px" }}>
                          Mercancías
                        </p>
                        <table>
                          <thead>
                            <tr style={{ fontSize: "9px", borderBottom: "1px solid #ccc" }}>
                              <th style={{ textAlign: "left", padding: "2px 4px 2px 0" }}>
                                BienesTransp
                              </th>
                              <th style={{ textAlign: "left", padding: "2px 4px" }}>Descripción</th>
                              <th style={{ textAlign: "right", padding: "2px 4px" }}>Cantidad</th>
                              <th style={{ textAlign: "left", padding: "2px 4px" }}>Unidad</th>
                              <th style={{ textAlign: "right", padding: "2px 4px" }}>Peso KG</th>
                              <th style={{ textAlign: "right", padding: "2px 0 2px 4px" }}>
                                Valor
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {r.cartaPorte.mercancias.map((mer, mi) => (
                              <tr key={mi} style={{ fontSize: "9px" }}>
                                <td style={{ padding: "2px 4px 2px 0", fontFamily: "monospace" }}>
                                  {mer.bienesTransp ?? "—"}
                                </td>
                                <td style={{ padding: "2px 4px" }}>{mer.descripcion ?? "—"}</td>
                                <td style={{ padding: "2px 4px", textAlign: "right" }}>
                                  {mer.cantidad ?? "—"}
                                </td>
                                <td style={{ padding: "2px 4px" }}>{mer.claveUnidad ?? "—"}</td>
                                <td style={{ padding: "2px 4px", textAlign: "right" }}>
                                  {mer.pesoEnKg ?? "—"}
                                </td>
                                <td style={{ padding: "2px 0 2px 4px", textAlign: "right" }}>
                                  {mer.valorMercancia
                                    ? `${mer.valorMercancia}${mer.moneda ? ` ${mer.moneda}` : ""}`
                                    : "—"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    {r.cartaPorte.figurasTransporte.length > 0 && (
                      <div style={{ marginTop: "8px" }}>
                        <p style={{ fontWeight: 600, fontSize: "11px", margin: "0 0 4px" }}>
                          Figuras de transporte
                        </p>
                        <table>
                          <thead>
                            <tr style={{ fontSize: "9px", borderBottom: "1px solid #ccc" }}>
                              <th style={{ textAlign: "left", padding: "2px 4px 2px 0" }}>Tipo</th>
                              <th style={{ textAlign: "left", padding: "2px 4px" }}>RFC</th>
                              <th style={{ textAlign: "left", padding: "2px 4px" }}>Nombre</th>
                              <th style={{ textAlign: "left", padding: "2px 0 2px 4px" }}>
                                Licencia
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {r.cartaPorte.figurasTransporte.map((fig, fi) => (
                              <tr key={fi} style={{ fontSize: "9px" }}>
                                <td style={{ padding: "2px 4px 2px 0" }}>
                                  {fig.tipoFigura ?? "—"}
                                </td>
                                <td style={{ padding: "2px 4px", fontFamily: "monospace" }}>
                                  {fig.rfcFigura ?? "—"}
                                </td>
                                <td style={{ padding: "2px 4px" }}>{fig.nombreFigura ?? "—"}</td>
                                <td style={{ padding: "2px 0 2px 4px" }}>
                                  {fig.numLicencia ?? "—"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {r.nomina && (
                  <>
                    <div className="print-report-break"></div>
                    <h3 className="text-lg font-bold mt-4 mb-2">Nómina</h3>
                    <table className="w-full text-xs border-collapse mb-3">
                      <tbody>
                        <tr>
                          <td className="font-semibold pr-2">Versión</td>
                          <td>{r.nomina.version ?? "—"}</td>
                        </tr>
                        <tr>
                          <td className="font-semibold pr-2">Tipo nómina</td>
                          <td>{r.nomina.tipoNomina ?? "—"}</td>
                        </tr>
                        <tr>
                          <td className="font-semibold pr-2">Fecha pago</td>
                          <td>{r.nomina.fechaPago ?? "—"}</td>
                        </tr>
                        <tr>
                          <td className="font-semibold pr-2">Periodo</td>
                          <td>
                            {r.nomina.fechaInicialPago ?? "—"} — {r.nomina.fechaFinalPago ?? "—"}
                          </td>
                        </tr>
                        <tr>
                          <td className="font-semibold pr-2">Días pagados</td>
                          <td>{r.nomina.numDiasPagados ?? "—"}</td>
                        </tr>
                        <tr>
                          <td className="font-semibold pr-2">Total percepciones</td>
                          <td>{r.nomina.totalPercepciones ?? "—"}</td>
                        </tr>
                        <tr>
                          <td className="font-semibold pr-2">Total deducciones</td>
                          <td>{r.nomina.totalDeducciones ?? "—"}</td>
                        </tr>
                        <tr>
                          <td className="font-semibold pr-2">Total otros pagos</td>
                          <td>{r.nomina.totalOtrosPagos ?? "—"}</td>
                        </tr>
                      </tbody>
                    </table>
                    {r.nomina.receptor && (
                      <table className="w-full text-xs border-collapse mb-3">
                        <thead>
                          <tr className="border-b font-semibold">
                            <th colSpan={2} className="text-left py-1">
                              Receptor
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td className="font-semibold pr-2">CURP</td>
                            <td>{r.nomina.receptor.curp ?? "—"}</td>
                          </tr>
                          <tr>
                            <td className="font-semibold pr-2">NSS</td>
                            <td>{r.nomina.receptor.numSeguridadSocial ?? "—"}</td>
                          </tr>
                          <tr>
                            <td className="font-semibold pr-2">NumEmpleado</td>
                            <td>{r.nomina.receptor.numEmpleado ?? "—"}</td>
                          </tr>
                          <tr>
                            <td className="font-semibold pr-2">Departamento</td>
                            <td>{r.nomina.receptor.departamento ?? "—"}</td>
                          </tr>
                          <tr>
                            <td className="font-semibold pr-2">Puesto</td>
                            <td>{r.nomina.receptor.puesto ?? "—"}</td>
                          </tr>
                          <tr>
                            <td className="font-semibold pr-2">Tipo contrato</td>
                            <td>{r.nomina.receptor.tipoContrato ?? "—"}</td>
                          </tr>
                          <tr>
                            <td className="font-semibold pr-2">Tipo régimen</td>
                            <td>{r.nomina.receptor.tipoRegimen ?? "—"}</td>
                          </tr>
                          <tr>
                            <td className="font-semibold pr-2">Periodicidad pago</td>
                            <td>{r.nomina.receptor.periodicidadPago ?? "—"}</td>
                          </tr>
                          <tr>
                            <td className="font-semibold pr-2">Salario base cotización</td>
                            <td>{r.nomina.receptor.salarioBaseCotApor ?? "—"}</td>
                          </tr>
                          <tr>
                            <td className="font-semibold pr-2">Salario diario integrado</td>
                            <td>{r.nomina.receptor.salarioDiarioIntegrado ?? "—"}</td>
                          </tr>
                          <tr>
                            <td className="font-semibold pr-2">Entidad federativa</td>
                            <td>{r.nomina.receptor.claveEntFed ?? "—"}</td>
                          </tr>
                        </tbody>
                      </table>
                    )}
                    {r.nomina.percepciones.length > 0 && (
                      <>
                        <h4 className="text-sm font-bold mt-2 mb-1">Percepciones</h4>
                        <table className="w-full text-xs border-collapse mb-2">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left pr-2">Tipo</th>
                              <th className="text-left pr-2">Clave</th>
                              <th className="text-left pr-2">Concepto</th>
                              <th className="text-right pr-2">Gravado</th>
                              <th className="text-right">Exento</th>
                            </tr>
                          </thead>
                          <tbody>
                            {r.nomina.percepciones.map((p, i) => (
                              <tr key={i} className="border-b">
                                <td>{p.tipoPercepcion ?? "—"}</td>
                                <td>{p.clave ?? "—"}</td>
                                <td>{p.concepto ?? "—"}</td>
                                <td className="text-right">{p.importeGravado ?? "—"}</td>
                                <td className="text-right">{p.importeExento ?? "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </>
                    )}
                    {r.nomina.deducciones.length > 0 && (
                      <>
                        <h4 className="text-sm font-bold mt-2 mb-1">Deducciones</h4>
                        <table className="w-full text-xs border-collapse mb-2">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left pr-2">Tipo</th>
                              <th className="text-left pr-2">Clave</th>
                              <th className="text-left pr-2">Concepto</th>
                              <th className="text-right">Importe</th>
                            </tr>
                          </thead>
                          <tbody>
                            {r.nomina.deducciones.map((d, i) => (
                              <tr key={i} className="border-b">
                                <td>{d.tipoDeduccion ?? "—"}</td>
                                <td>{d.clave ?? "—"}</td>
                                <td>{d.concepto ?? "—"}</td>
                                <td className="text-right">{d.importe ?? "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </>
                    )}
                    {r.nomina.otrosPagos.length > 0 && (
                      <>
                        <h4 className="text-sm font-bold mt-2 mb-1">Otros pagos</h4>
                        <table className="w-full text-xs border-collapse mb-2">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left pr-2">Tipo</th>
                              <th className="text-left pr-2">Clave</th>
                              <th className="text-left pr-2">Concepto</th>
                              <th className="text-right">Importe</th>
                            </tr>
                          </thead>
                          <tbody>
                            {r.nomina.otrosPagos.map((o, i) => (
                              <tr key={i} className="border-b">
                                <td>{o.tipoOtroPago ?? "—"}</td>
                                <td>{o.clave ?? "—"}</td>
                                <td>{o.concepto ?? "—"}</td>
                                <td className="text-right">{o.importe ?? "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </>
                    )}
                  </>
                )}

                {r.comercioExterior && (
                  <>
                    <div className="print-report-break"></div>
                    <h3 className="text-lg font-bold mt-4 mb-2">Comercio Exterior</h3>
                    <table className="w-full text-xs border-collapse mb-3">
                      <tbody>
                        <tr>
                          <td className="font-semibold pr-2" style={{ width: "200px" }}>Versión</td>
                          <td>{r.comercioExterior.version ?? "—"}</td>
                        </tr>
                        <tr>
                          <td className="font-semibold pr-2">Tipo operación</td>
                          <td>{r.comercioExterior.tipoOperacion ?? "—"}</td>
                        </tr>
                        <tr>
                          <td className="font-semibold pr-2">Clave de pedimento</td>
                          <td>{r.comercioExterior.claveDePedimento ?? "—"}</td>
                        </tr>
                        <tr>
                          <td className="font-semibold pr-2">Certificado de origen</td>
                          <td>{r.comercioExterior.certificadoOrigen ?? "—"}</td>
                        </tr>
                        <tr>
                          <td className="font-semibold pr-2">No. exportador confiable</td>
                          <td>{r.comercioExterior.numeroExportadorConfiable ?? "—"}</td>
                        </tr>
                        <tr>
                          <td className="font-semibold pr-2">Incoterm</td>
                          <td>{r.comercioExterior.incoterm ?? "—"}</td>
                        </tr>
                        <tr>
                          <td className="font-semibold pr-2">SubDivisión</td>
                          <td>{r.comercioExterior.subDivision ?? "—"}</td>
                        </tr>
                        <tr>
                          <td className="font-semibold pr-2">TipoCambioUSD</td>
                          <td>{r.comercioExterior.tipoCambioUSD ?? "—"}</td>
                        </tr>
                        <tr>
                          <td className="font-semibold pr-2">TotalUSD</td>
                          <td>{r.comercioExterior.totalUSD ?? "—"}</td>
                        </tr>
                        {r.comercioExterior.observaciones && (
                          <tr>
                            <td className="font-semibold pr-2">Observaciones</td>
                            <td>{r.comercioExterior.observaciones}</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </>
                )}

                {r.impuestosLocales && (
                  <>
                    <div className="print-report-break"></div>
                    <h3 className="text-lg font-bold mt-4 mb-2">Impuestos Locales</h3>
                    <table className="w-full text-xs border-collapse mb-3">
                      <tbody>
                        <tr>
                          <td className="font-semibold pr-2" style={{ width: "200px" }}>Versión</td>
                          <td>{r.impuestosLocales.version ?? "—"}</td>
                        </tr>
                        <tr>
                          <td className="font-semibold pr-2">Total retenciones</td>
                          <td>{r.impuestosLocales.totalDeRetenciones ?? "—"}</td>
                        </tr>
                        <tr>
                          <td className="font-semibold pr-2">Total traslados</td>
                          <td>{r.impuestosLocales.totalDeTraslados ?? "—"}</td>
                        </tr>
                        <tr>
                          <td className="font-semibold pr-2">Retenciones</td>
                          <td>{r.impuestosLocales.retenciones.length}</td>
                        </tr>
                        <tr>
                          <td className="font-semibold pr-2">Traslados</td>
                          <td>{r.impuestosLocales.traslados.length}</td>
                        </tr>
                      </tbody>
                    </table>
                    {r.impuestosLocales.retenciones.length > 0 && (
                      <>
                        <h4 className="text-sm font-bold mt-2 mb-1">Retenciones locales</h4>
                        <table className="w-full text-xs border-collapse mb-2">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left pr-2">#</th>
                              <th className="text-left pr-2">Impuesto</th>
                              <th className="text-right pr-2">Tasa</th>
                              <th className="text-right">Importe</th>
                            </tr>
                          </thead>
                          <tbody>
                            {r.impuestosLocales.retenciones.map((ret, i) => (
                              <tr key={i} className="border-b">
                                <td>{i + 1}</td>
                                <td>{ret.impLocRetenido ?? "—"}</td>
                                <td className="text-right">{ret.tasaDeRetencion ?? "—"}</td>
                                <td className="text-right">{ret.importe ?? "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </>
                    )}
                    {r.impuestosLocales.traslados.length > 0 && (
                      <>
                        <h4 className="text-sm font-bold mt-2 mb-1">Traslados locales</h4>
                        <table className="w-full text-xs border-collapse mb-2">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left pr-2">#</th>
                              <th className="text-left pr-2">Impuesto</th>
                              <th className="text-right pr-2">Tasa</th>
                              <th className="text-right">Importe</th>
                            </tr>
                          </thead>
                          <tbody>
                            {r.impuestosLocales.traslados.map((tras, i) => (
                              <tr key={i} className="border-b">
                                <td>{i + 1}</td>
                                <td>{tras.impLocTrasladado ?? "—"}</td>
                                <td className="text-right">{tras.tasaDeTraslado ?? "—"}</td>
                                <td className="text-right">{tras.importe ?? "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </>
                    )}
                  </>
                )}

                {r.leyendasFiscales && (
                  <>
                    <div className="print-report-break"></div>
                    <h3 className="text-lg font-bold mt-4 mb-2">Leyendas Fiscales</h3>
                    <table className="w-full text-xs border-collapse mb-3">
                      <tbody>
                        <tr>
                          <td className="font-semibold pr-2" style={{ width: "200px" }}>Versión</td>
                          <td>{r.leyendasFiscales.version ?? "—"}</td>
                        </tr>
                        <tr>
                          <td className="font-semibold pr-2">Total leyendas</td>
                          <td>{r.leyendasFiscales.leyendas.length}</td>
                        </tr>
                      </tbody>
                    </table>
                    {r.leyendasFiscales.leyendas.length > 0 && (
                      <>
                        <h4 className="text-sm font-bold mt-2 mb-1">Leyendas</h4>
                        <table className="w-full text-xs border-collapse mb-2">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left pr-2">#</th>
                              <th className="text-left pr-2">Disposición fiscal</th>
                              <th className="text-left pr-2">Norma</th>
                              <th className="text-left">Texto leyenda</th>
                            </tr>
                          </thead>
                          <tbody>
                            {r.leyendasFiscales.leyendas.map((l, i) => (
                              <tr key={i} className="border-b">
                                <td>{i + 1}</td>
                                <td>{l.disposicionFiscal ?? "—"}</td>
                                <td>{l.norma ?? "—"}</td>
                                <td>{l.textoLeyenda ?? "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </>
                    )}
                  </>
                )}

                {r.donatarias && (
                  <>
                    <div className="print-report-break"></div>
                    <h3 className="text-lg font-bold mt-4 mb-2">Donatarias</h3>
                    <table className="w-full text-xs border-collapse mb-3">
                      <tbody>
                        <tr>
                          <td className="font-semibold pr-2" style={{ width: "200px" }}>Versión</td>
                          <td>{r.donatarias.version ?? "—"}</td>
                        </tr>
                        <tr>
                          <td className="font-semibold pr-2">NoAutorizacion</td>
                          <td>{r.donatarias.noAutorizacion ?? "—"}</td>
                        </tr>
                        <tr>
                          <td className="font-semibold pr-2">FechaAutorizacion</td>
                          <td>{r.donatarias.fechaAutorizacion ?? "—"}</td>
                        </tr>
                        <tr>
                          <td className="font-semibold pr-2">Leyenda</td>
                          <td>{r.donatarias.leyenda ?? "—"}</td>
                        </tr>
                      </tbody>
                    </table>
                  </>
                )}

                {r.documentKind === "RETENCIONES" && r.retenciones && (
                  <>
                    <div className="print-report-break"></div>
                    <h3 className="text-lg font-bold mt-4 mb-2">Retenciones</h3>
                    <table className="w-full text-xs border-collapse mb-3">
                      <tbody>
                        <tr>
                          <td className="font-semibold pr-2" style={{ width: "200px" }}>Versión</td>
                          <td>{r.retenciones.version ?? "—"}</td>
                        </tr>
                        <tr>
                          <td className="font-semibold pr-2">Folio interno</td>
                          <td>{r.retenciones.folioInt ?? "—"}</td>
                        </tr>
                        <tr>
                          <td className="font-semibold pr-2">Fecha expedición</td>
                          <td>{r.retenciones.fechaExp ?? "—"}</td>
                        </tr>
                        <tr>
                          <td className="font-semibold pr-2">CveRetenc</td>
                          <td>{r.retenciones.cveRetenc ?? "—"}</td>
                        </tr>
                        <tr>
                          <td className="font-semibold pr-2">DescRetenc</td>
                          <td>{r.retenciones.descRetenc ?? "—"}</td>
                        </tr>
                        <tr>
                          <td className="font-semibold pr-2">Lugar expedición</td>
                          <td>{r.retenciones.lugarExpRetenc ?? "—"}</td>
                        </tr>
                        <tr>
                          <td className="font-semibold pr-2">UUID</td>
                          <td>{r.retenciones.uuid ?? "—"}</td>
                        </tr>
                        <tr>
                          <td className="font-semibold pr-2">Fecha timbrado</td>
                          <td>{r.retenciones.fechaTimbrado ?? "—"}</td>
                        </tr>
                      </tbody>
                    </table>
                    {r.retenciones.emisor && (
                      <table className="w-full text-xs border-collapse mb-3">
                        <caption className="text-sm font-bold mb-1 text-left">Emisor</caption>
                        <tbody>
                          <tr>
                            <td className="font-semibold pr-2" style={{ width: "200px" }}>RFC</td>
                            <td>{r.retenciones.emisor.rfcEmisor ?? "—"}</td>
                          </tr>
                          <tr>
                            <td className="font-semibold pr-2">Nombre</td>
                            <td>{r.retenciones.emisor.nombre ?? "—"}</td>
                          </tr>
                          <tr>
                            <td className="font-semibold pr-2">CURP</td>
                            <td>{r.retenciones.emisor.curp ?? "—"}</td>
                          </tr>
                        </tbody>
                      </table>
                    )}
                    {r.retenciones.receptor && (
                      <table className="w-full text-xs border-collapse mb-3">
                        <caption className="text-sm font-bold mb-1 text-left">Receptor</caption>
                        <tbody>
                          <tr>
                            <td className="font-semibold pr-2" style={{ width: "200px" }}>Nacionalidad</td>
                            <td>{r.retenciones.receptor.nacionalidad ?? "—"}</td>
                          </tr>
                          <tr>
                            <td className="font-semibold pr-2">RFC / NumRegIdTrib</td>
                            <td>{r.retenciones.receptor.rfcReceptor ?? r.retenciones.receptor.numRegIdTrib ?? "—"}</td>
                          </tr>
                          <tr>
                            <td className="font-semibold pr-2">Nombre</td>
                            <td>{r.retenciones.receptor.nombre ?? "—"}</td>
                          </tr>
                          <tr>
                            <td className="font-semibold pr-2">CURP</td>
                            <td>{r.retenciones.receptor.curp ?? "—"}</td>
                          </tr>
                        </tbody>
                      </table>
                    )}
                    {r.retenciones.periodo && (
                      <table className="w-full text-xs border-collapse mb-3">
                        <caption className="text-sm font-bold mb-1 text-left">Periodo</caption>
                        <tbody>
                          <tr>
                            <td className="font-semibold pr-2" style={{ width: "200px" }}>Mes inicial</td>
                            <td>{r.retenciones.periodo.mesIni ?? "—"}</td>
                          </tr>
                          <tr>
                            <td className="font-semibold pr-2">Mes final</td>
                            <td>{r.retenciones.periodo.mesFin ?? "—"}</td>
                          </tr>
                          <tr>
                            <td className="font-semibold pr-2">Ejercicio</td>
                            <td>{r.retenciones.periodo.ejercicio ?? "—"}</td>
                          </tr>
                        </tbody>
                      </table>
                    )}
                    {r.retenciones.totales && (
                      <>
                        <table className="w-full text-xs border-collapse mb-3">
                          <caption className="text-sm font-bold mb-1 text-left">Totales</caption>
                          <tbody>
                            <tr>
                              <td className="font-semibold pr-2" style={{ width: "200px" }}>Monto total operación</td>
                              <td>{r.retenciones.totales.montoTotOperacion ?? "—"}</td>
                            </tr>
                            <tr>
                              <td className="font-semibold pr-2">Monto total gravado</td>
                              <td>{r.retenciones.totales.montoTotGrav ?? "—"}</td>
                            </tr>
                            <tr>
                              <td className="font-semibold pr-2">Monto total exento</td>
                              <td>{r.retenciones.totales.montoTotExent ?? "—"}</td>
                            </tr>
                            <tr>
                              <td className="font-semibold pr-2">Monto total retenido</td>
                              <td>{r.retenciones.totales.montoTotRet ?? "—"}</td>
                            </tr>
                          </tbody>
                        </table>
                        {r.retenciones.totales.impuestosRetenidos.length > 0 && (
                          <>
                            <h4 className="text-sm font-bold mt-2 mb-1">Impuestos retenidos</h4>
                            <table className="w-full text-xs border-collapse mb-2">
                              <thead>
                                <tr className="border-b">
                                  <th className="text-left pr-2">#</th>
                                  <th className="text-left pr-2">BaseRet</th>
                                  <th className="text-left pr-2">Impuesto</th>
                                  <th className="text-right pr-2">MontoRet</th>
                                  <th className="text-left">TipoPagoRet</th>
                                </tr>
                              </thead>
                              <tbody>
                                {r.retenciones.totales.impuestosRetenidos.map((ir, i) => (
                                  <tr key={i} className="border-b">
                                    <td>{i + 1}</td>
                                    <td>{ir.baseRet ?? "—"}</td>
                                    <td>{ir.impuesto ?? "—"}</td>
                                    <td className="text-right">{ir.montoRet ?? "—"}</td>
                                    <td>{ir.tipoPagoRet ?? "—"}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </>
                        )}
                      </>
                    )}
                  </>
                )}

                {r.addenda?.detected && (
                  <>
                    <div className="print-report-break"></div>
                    <h3 className="text-lg font-bold mt-4 mb-2">Addenda</h3>
                    <table className="w-full text-xs border-collapse mb-3">
                      <tbody>
                        <tr>
                          <td className="font-semibold pr-2" style={{ width: "200px" }}>Detectada</td>
                          <td>Sí</td>
                        </tr>
                        <tr>
                          <td className="font-semibold pr-2">Root keys</td>
                          <td>{r.addenda.rootKeys.join(", ")}</td>
                        </tr>
                        <tr>
                          <td className="font-semibold pr-2">Node count</td>
                          <td>{r.addenda.nodeCount}</td>
                        </tr>
                        <tr>
                          <td className="font-semibold pr-2">Max depth</td>
                          <td>{r.addenda.maxDepth}</td>
                        </tr>
                        <tr>
                          <td className="font-semibold pr-2">Truncada</td>
                          <td>{r.addenda.truncated ? "Sí" : "No"}</td>
                        </tr>
                        <tr>
                          <td className="font-semibold pr-2">Señales</td>
                          <td>{r.addenda.signals.length}</td>
                        </tr>
                      </tbody>
                    </table>
                    {r.addenda.signals.length > 0 && (
                      <>
                        <h4 className="text-sm font-bold mt-2 mb-1">Señales detectadas</h4>
                        <table className="w-full text-xs border-collapse mb-2">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left pr-2">Label</th>
                              <th className="text-left pr-2">Valor</th>
                              <th className="text-left pr-2">Path</th>
                              <th className="text-left">Confianza</th>
                            </tr>
                          </thead>
                          <tbody>
                            {r.addenda.signals.map((s, i) => (
                              <tr key={i} className="border-b">
                                <td>{s.label}</td>
                                <td>{s.value}</td>
                                <td className="text-muted-foreground">{s.path}</td>
                                <td>{s.confidence}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </>
                    )}
                    {r.addenda.nodeSummary.length > 0 && (
                      <>
                        <h4 className="text-sm font-bold mt-2 mb-1">Resumen de nodos</h4>
                        <table className="w-full text-xs border-collapse mb-2">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left pr-2">Path</th>
                              <th className="text-left pr-2">Nombre</th>
                              <th className="text-right pr-2">Child count</th>
                              <th className="text-right">Scalar fields</th>
                            </tr>
                          </thead>
                          <tbody>
                            {r.addenda.nodeSummary.map((ns, i) => (
                              <tr key={i} className="border-b">
                                <td>{ns.path}</td>
                                <td>{ns.name}</td>
                                <td className="text-right">{ns.childCount}</td>
                                <td className="text-right">{ns.scalarFields}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </>
                    )}
                  </>
                )}

                {r.concepts && r.concepts.length > 0 && (
                  <div className="avoid-break">
                    <h2>Conceptos ({r.concepts.length})</h2>
                    <table>
                      <thead>
                        <tr>
                          <th>Clave</th>
                          <th>No. id.</th>
                          <th>Cant.</th>
                          <th>Clave unid.</th>
                          <th>Descripción</th>
                          <th>Valor unit.</th>
                          <th>Importe</th>
                          <th>Dto.</th>
                          <th>Obj. imp.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {r.concepts.map((c, i) => (
                          <tr key={i}>
                            <td style={{ fontFamily: "monospace", fontSize: "9px" }}>
                              {c.claveProdServ ?? "—"}
                            </td>
                            <td style={{ fontSize: "9px" }}>{c.noIdentificacion ?? "—"}</td>
                            <td>{c.cantidad ?? "—"}</td>
                            <td style={{ fontSize: "9px" }}>{c.claveUnidad ?? "—"}</td>
                            <td style={{ fontSize: "9px" }}>{c.descripcion ?? "—"}</td>
                            <td>{c.valorUnitario ?? "—"}</td>
                            <td style={{ fontWeight: 600 }}>{c.importe ?? "—"}</td>
                            <td>{c.descuento ?? "—"}</td>
                            <td style={{ fontSize: "9px" }}>{c.objetoImp ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {r.taxSummary && (
                  <div className="avoid-break">
                    <h2>Resumen de impuestos</h2>
                    {r.taxSummary.transferred.length > 0 && (
                      <div style={{ marginBottom: "8px" }}>
                        <p style={{ fontWeight: 600, fontSize: "10px", margin: "0 0 4px" }}>
                          Trasladados
                        </p>
                        <table>
                          <thead>
                            <tr>
                              <th>Impuesto</th>
                              <th>Tipo factor</th>
                              <th>Tasa / cuota</th>
                              <th>Base calculada</th>
                              <th>Importe calculado</th>
                            </tr>
                          </thead>
                          <tbody>
                            {r.taxSummary.transferred.map((t, i) => (
                              <tr key={i}>
                                <td style={{ fontWeight: 600 }}>{t.impuestoLabel}</td>
                                <td>{t.tipoFactor ?? "—"}</td>
                                <td>{t.tasaOCuota ?? "—"}</td>
                                <td>{t.baseCalculated}</td>
                                <td style={{ fontWeight: 600 }}>{t.importeCalculated}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    {r.taxSummary.retained.length > 0 && (
                      <div>
                        <p style={{ fontWeight: 600, fontSize: "10px", margin: "0 0 4px" }}>
                          Retenidos
                        </p>
                        <table>
                          <thead>
                            <tr>
                              <th>Impuesto</th>
                              <th>Tipo factor</th>
                              <th>Tasa / cuota</th>
                              <th>Base calculada</th>
                              <th>Importe calculado</th>
                            </tr>
                          </thead>
                          <tbody>
                            {r.taxSummary.retained.map((r2, i) => (
                              <tr key={i}>
                                <td style={{ fontWeight: 600 }}>{r2.impuestoLabel}</td>
                                <td>{r2.tipoFactor ?? "—"}</td>
                                <td>{r2.tasaOCuota ?? "—"}</td>
                                <td>{r2.baseCalculated}</td>
                                <td style={{ fontWeight: 600 }}>{r2.importeCalculated}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {r.totalsValidation && (
                  <div className="avoid-break">
                    <h2>Validación de totales</h2>
                    <div style={{ marginBottom: "8px" }}>
                      <span className={r.totalsValidation.matches ? "badge-ok" : "badge-critical"}>
                        {r.totalsValidation.matches
                          ? "Totales consistentes"
                          : "Diferencias detectadas"}
                      </span>
                    </div>
                    <table>
                      <tbody>
                        <tr>
                          <td style={{ fontWeight: 600, width: "240px" }}>Subtotal XML</td>
                          <td>{r.totalsValidation.subtotalXml ?? "—"}</td>
                        </tr>
                        <tr>
                          <td style={{ fontWeight: 600 }}>Subtotal calculado</td>
                          <td>{r.totalsValidation.subtotalCalculated ?? "—"}</td>
                        </tr>
                        <tr>
                          <td style={{ fontWeight: 600 }}>Descuento calculado</td>
                          <td>{r.totalsValidation.discountCalculated ?? "—"}</td>
                        </tr>
                        <tr>
                          <td style={{ fontWeight: 600 }}>Impuestos trasladados XML</td>
                          <td>{r.totalsValidation.transferredTaxesXml ?? "—"}</td>
                        </tr>
                        <tr>
                          <td style={{ fontWeight: 600 }}>Impuestos trasladados calculados</td>
                          <td>{r.totalsValidation.transferredTaxesCalculated ?? "—"}</td>
                        </tr>
                        <tr>
                          <td style={{ fontWeight: 600 }}>Impuestos retenidos XML</td>
                          <td>{r.totalsValidation.retainedTaxesXml ?? "—"}</td>
                        </tr>
                        <tr>
                          <td style={{ fontWeight: 600 }}>Impuestos retenidos calculados</td>
                          <td>{r.totalsValidation.retainedTaxesCalculated ?? "—"}</td>
                        </tr>
                        <tr>
                          <td style={{ fontWeight: 600 }}>Total XML</td>
                          <td style={{ fontWeight: 600 }}>{r.totalsValidation.totalXml ?? "—"}</td>
                        </tr>
                        <tr>
                          <td style={{ fontWeight: 600 }}>Total calculado</td>
                          <td style={{ fontWeight: 600 }}>
                            {r.totalsValidation.totalCalculated ?? "—"}
                          </td>
                        </tr>
                        <tr>
                          <td style={{ fontWeight: 600 }}>Diferencia</td>
                          <td
                            style={{
                              color: r.totalsValidation.matches ? "#065f46" : "#991b1b",
                              fontWeight: 600,
                            }}
                          >
                            {r.totalsValidation.difference ?? "—"}
                          </td>
                        </tr>
                        <tr>
                          <td style={{ fontWeight: 600 }}>Tolerancia</td>
                          <td>{r.totalsValidation.tolerance}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="footer">
                  <p style={{ margin: 0 }}>Generado por Fiscora / ConSafeDev</p>
                  <p style={{ margin: "4px 0 0" }}>No se almacena el XML fuente en este reporte.</p>
                  <p style={{ margin: "4px 0 0" }}>{new Date().toISOString()}</p>
                </div>
              </div>
            </div>
          );
        })()}

      {selectedMassiveDetail &&
        (() => {
          const sd = selectedMassiveDetail;
          const isAnalyzed = sd.status === "ANALYZED";
          const a = sd.analysis;
          const td = a?.technicalDiagnostics;
          const es = a?.executiveSummary;
          const nx = a?.normalizedXml;
          const findings = a?.findings ?? [];
          const criticals = findings.filter((f) => f.severity === "CRITICAL");
          const warnings = findings.filter((f) => f.severity === "WARNING");
          const infos = findings.filter((f) => f.severity === "INFO");
          const riskStyles: Record<string, string> = {
            OK: "text-emerald-700 bg-emerald-50 border-emerald-200",
            WARNING: "text-yellow-700 bg-yellow-50 border-yellow-200",
            CRITICAL: "text-red-700 bg-red-50 border-red-200",
          };
          const riskLabels: Record<string, string> = {
            OK: "Sin riesgo",
            WARNING: "Revisión recomendada",
            CRITICAL: "Incidencia crítica",
          };
          const badge: Record<string, { label: string; style: string }> = {
            INFO: { label: "Informativo", style: "text-blue-700 bg-blue-50 border-blue-200" },
            WARNING: {
              label: "Advertencia",
              style: "text-yellow-700 bg-yellow-50 border-yellow-200",
            },
            CRITICAL: { label: "Crítico", style: "text-red-700 bg-red-50 border-red-200" },
          };
          const rs = riskStyles[es?.riskLevel ?? "OK"] ?? riskStyles.WARNING;
          return (
            <div
              className="fixed inset-0 z-50 flex items-start justify-center pt-8 pb-8 bg-black/60 overflow-y-auto"
              onClick={() => setSelectedMassiveDetail(null)}
            >
              <div
                className="relative w-full max-w-3xl mx-4 rounded-xl border border-border bg-card shadow-2xl max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-border bg-card rounded-t-xl">
                  <div className="min-w-0 flex-1">
                    <h2 className="text-base font-bold truncate">{sd.name}</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      #{sd.index + 1} &middot; {(sd.sizeBytes ?? 0).toLocaleString()} bytes &middot;{" "}
                      {isAnalyzed ? (
                        <span className="text-emerald-600 font-medium">ANALYZED</span>
                      ) : (
                        <span className="text-red-600 font-medium">FAILED</span>
                      )}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedMassiveDetail(null)}
                    className="ml-4 shrink-0 p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
                    aria-label="Cerrar"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                </div>

                <div className="p-6 space-y-6">
                  {!isAnalyzed ? (
                    <div className="p-4 rounded-lg border border-red-200 bg-red-50 space-y-3">
                      <p className="text-sm font-semibold text-red-800">
                        Error al analizar el archivo
                      </p>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between py-1 border-b border-red-200/50">
                          <span className="text-red-600">Código de error</span>
                          <span className="font-medium text-red-800 font-mono">
                            {sd.errorCode ?? "—"}
                          </span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-red-200/50">
                          <span className="text-red-600">Mensaje de error</span>
                          <span className="font-medium text-red-800">{sd.errorMessage ?? "—"}</span>
                        </div>
                      </div>
                      <p className="text-xs text-red-600 bg-red-100/50 rounded-lg px-3 py-2">
                        Revisa que el archivo sea XML válido y que no esté corrupto. Si el problema
                        persiste, analiza el archivo individualmente para aislar la causa.
                      </p>
                    </div>
                  ) : a ? (
                    <>
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Resumen ejecutivo
                        </p>
                        <div className={`p-4 rounded-lg border ${rs} space-y-2`}>
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-semibold text-sm">{es?.title}</p>
                            <span
                              className={`shrink-0 text-xs font-bold px-2.5 py-1 rounded-full border ${rs}`}
                            >
                              {riskLabels[es?.riskLevel ?? "OK"]}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground">{es?.message}</p>
                          <p className="text-xs text-muted-foreground">
                            <span className="font-semibold">Acción recomendada:</span>{" "}
                            {es?.recommendedAction}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Hallazgos
                        </p>
                        <div className="flex flex-wrap gap-2 text-xs">
                          <span className="px-2.5 py-1 rounded-full bg-red-50 border border-red-200 text-red-700 font-bold">
                            Críticos: {criticals.length}
                          </span>
                          <span className="px-2.5 py-1 rounded-full bg-yellow-50 border border-yellow-200 text-yellow-700 font-bold">
                            Advertencias: {warnings.length}
                          </span>
                          <span className="px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 font-bold">
                            Informativos: {infos.length}
                          </span>
                          <span className="px-2.5 py-1 rounded-full bg-muted border border-border text-muted-foreground">
                            Total: {findings.length}
                          </span>
                        </div>
                        {findings.length > 0 ? (
                          <div className="space-y-2 max-h-80 overflow-y-auto">
                            {findings.map((f, fi) => {
                              const b = badge[f.severity] ?? badge.INFO;
                              return (
                                <div
                                  key={fi}
                                  className={`p-3 rounded-lg border ${b.style} space-y-1.5`}
                                >
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span
                                      className={`text-xs font-bold px-2 py-0.5 rounded-full border ${b.style}`}
                                    >
                                      {b.label}
                                    </span>
                                    <span className="text-xs text-muted-foreground font-mono">
                                      {f.category}
                                    </span>
                                    <span className="text-xs text-muted-foreground font-mono">
                                      {f.code}
                                    </span>
                                  </div>
                                  <p className="text-sm font-medium">{f.title}</p>
                                  <p className="text-sm text-muted-foreground">{f.message}</p>
                                  {f.recommendedAction && (
                                    <p className="text-xs text-muted-foreground">
                                      <span className="font-semibold">Acción recomendada:</span>{" "}
                                      {f.recommendedAction}
                                    </p>
                                  )}
                                  {f.evidence && f.evidence.length > 0 && (
                                    <div className="space-y-0.5 pt-1.5 border-t border-border/40 mt-1.5">
                                      <p className="text-xs font-semibold text-muted-foreground">
                                        Evidencia
                                      </p>
                                      <div className="space-y-0.5 text-xs">
                                        {f.evidence.map((e, ei) => (
                                          <div key={ei} className="flex gap-2">
                                            <span className="text-muted-foreground whitespace-nowrap shrink-0">
                                              {e.label}:
                                            </span>
                                            <span className="font-mono text-foreground/80 break-all">
                                              {e.value ?? "—"}
                                            </span>
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
                          <p className="text-sm text-muted-foreground bg-muted/30 rounded-lg px-4 py-3">
                            No se detectaron hallazgos estructurados para este XML.
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Diagnóstico técnico
                        </p>
                        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                          <div className="flex justify-between py-1.5 border-b border-border/50">
                            <span className="text-muted-foreground">XML timbrado</span>
                            <span
                              className={
                                td?.isStamped
                                  ? "text-emerald-600 font-medium"
                                  : "text-yellow-600 font-medium"
                              }
                            >
                              {td?.isStamped ? "Sí" : "No"}
                            </span>
                          </div>
                          <div className="flex justify-between py-1.5 border-b border-border/50">
                            <span className="text-muted-foreground">Timbre Fiscal Digital</span>
                            <span
                              className={
                                td?.hasTimbreFiscalDigital
                                  ? "text-emerald-600 font-medium"
                                  : "text-yellow-600 font-medium"
                              }
                            >
                              {td?.hasTimbreFiscalDigital ? "Sí" : "No"}
                            </span>
                          </div>
                          <div className="flex justify-between py-1.5 border-b border-border/50">
                            <span className="text-muted-foreground">BOM UTF-8 detectado</span>
                            <span className="font-medium">{td?.bomDetected ? "Sí" : "No"}</span>
                          </div>
                          <div className="flex justify-between py-1.5 border-b border-border/50">
                            <span className="text-muted-foreground">
                              Contenido antes del inicio del XML
                            </span>
                            <span className="font-medium">
                              {td?.leadingContentBeforeXml ? "Sí" : "No"}
                            </span>
                          </div>
                          <div className="flex justify-between py-1.5 border-b border-border/50 col-span-2">
                            <span className="text-muted-foreground">
                              Normalización segura aplicada
                            </span>
                            <span className="font-medium">
                              {td?.safeNormalizationApplied ? "Sí" : "No"}
                            </span>
                          </div>
                        </div>
                        {td?.safeNormalizationNotes && td.safeNormalizationNotes.length > 0 && (
                          <div className="space-y-1">
                            <p className="text-xs font-semibold text-muted-foreground">
                              Notas de normalización
                            </p>
                            <ul className="space-y-0.5">
                              {td.safeNormalizationNotes.map((note, ni) => (
                                <li
                                  key={ni}
                                  className="text-sm text-muted-foreground flex items-start gap-1.5"
                                >
                                  <span className="text-blue-500 mt-0.5 shrink-0">i</span> {note}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {nx && (
                          <div className="p-3 rounded-lg border border-blue-200 bg-blue-50 space-y-1.5">
                            <p className="text-xs font-semibold text-blue-800">XML normalizado</p>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                              <div className="flex justify-between py-0.5">
                                <span className="text-blue-600">Archivo</span>
                                <span className="font-medium text-blue-800 font-mono">
                                  {nx.filename}
                                </span>
                              </div>
                              <div className="flex justify-between py-0.5">
                                <span className="text-blue-600">Tipo normalización</span>
                                <span className="font-medium text-blue-800">
                                  {nx.normalizationType}
                                </span>
                              </div>
                              <div className="flex justify-between py-0.5">
                                <span className="text-blue-600">Contenido fiscal modificado</span>
                                <span className="font-medium text-blue-800">
                                  {nx.fiscalContentModified ? "Sí" : "No"}
                                </span>
                              </div>
                              <div className="flex justify-between py-0.5">
                                <span className="text-blue-600">Riesgo timbre/sello</span>
                                <span className="font-medium text-blue-800">{nx.stampRisk}</span>
                              </div>
                              <div className="flex justify-between py-0.5 col-span-2">
                                <span className="text-blue-600 shrink-0">
                                  Hash original SHA-256
                                </span>
                                <span className="font-mono text-blue-800 break-all text-right ml-4">
                                  {nx.originalSha256}
                                </span>
                              </div>
                              <div className="flex justify-between py-0.5 col-span-2">
                                <span className="text-blue-600 shrink-0">
                                  Hash normalizado SHA-256
                                </span>
                                <span className="font-mono text-blue-800 break-all text-right ml-4">
                                  {nx.normalizedSha256}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Diagnóstico estructural
                        </p>
                        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                          <div className="flex justify-between py-1.5 border-b border-border/50">
                            <span className="text-muted-foreground">Tiene Complemento</span>
                            <span className="font-medium">
                              {a?.structureDiagnostics.hasComplemento ? "Sí" : "No"}
                            </span>
                          </div>
                          <div className="flex justify-between py-1.5 border-b border-border/50">
                            <span className="text-muted-foreground">Tiene Addenda</span>
                            <span className="font-medium">
                              {a?.structureDiagnostics.hasAddenda ? "Sí" : "No"}
                            </span>
                          </div>
                        </div>
                        {a?.structureDiagnostics.namespaces &&
                          a.structureDiagnostics.namespaces.length > 0 && (
                            <div className="space-y-1">
                              <p className="text-xs font-semibold text-muted-foreground">
                                Namespaces detectados
                              </p>
                              <div className="flex flex-wrap gap-1">
                                {a.structureDiagnostics.namespaces.map((ns, ni) => (
                                  <span
                                    key={ni}
                                    className="text-xs bg-muted px-2 py-0.5 rounded font-mono"
                                  >
                                    {ns}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        {a?.structureDiagnostics.complementNames &&
                          a.structureDiagnostics.complementNames.length > 0 && (
                            <div className="space-y-1">
                              <p className="text-xs font-semibold text-muted-foreground">
                                Complementos detectados
                              </p>
                              <div className="flex flex-wrap gap-1">
                                {a.structureDiagnostics.complementNames.map((name, ni) => (
                                  <span
                                    key={ni}
                                    className="text-xs bg-muted px-2 py-0.5 rounded font-mono"
                                  >
                                    {name}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        {a?.structureDiagnostics.knownComplements &&
                          a.structureDiagnostics.knownComplements.length > 0 && (
                            <div className="space-y-1">
                              <p className="text-xs font-semibold text-muted-foreground">
                                Complementos clasificados
                              </p>
                              <div className="flex flex-wrap gap-1">
                                {a.structureDiagnostics.knownComplements.map((name, ni) => (
                                  <span
                                    key={ni}
                                    className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-mono"
                                  >
                                    {name}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        {a?.structureDiagnostics.unknownComplements &&
                          a.structureDiagnostics.unknownComplements.length > 0 && (
                            <div className="space-y-1">
                              <p className="text-xs font-semibold text-muted-foreground">
                                Complementos no clasificados
                              </p>
                              <div className="flex flex-wrap gap-1">
                                {a.structureDiagnostics.unknownComplements.map((name, ni) => (
                                  <span
                                    key={ni}
                                    className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded font-mono"
                                  >
                                    {name}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        {a?.structureDiagnostics.nodeShapeNotes &&
                          a.structureDiagnostics.nodeShapeNotes.length > 0 && (
                            <div className="space-y-1">
                              <p className="text-xs font-semibold text-muted-foreground">
                                Notas de estructura
                              </p>
                              <ul className="space-y-0.5">
                                {a.structureDiagnostics.nodeShapeNotes.map((note, ni) => (
                                  <li
                                    key={ni}
                                    className="text-sm text-muted-foreground flex items-start gap-1.5"
                                  >
                                    <span className="text-blue-500 mt-0.5 shrink-0">i</span> {note}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                      </div>

                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Metadata fiscal
                        </p>
                        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                          <div className="flex justify-between py-1.5 border-b border-border/50 col-span-2">
                            <span className="text-muted-foreground">UUID</span>
                            <span className="font-mono text-xs text-right max-w-[320px] break-all">
                              {a?.uuid ?? "—"}
                            </span>
                          </div>
                          <div className="flex justify-between py-1.5 border-b border-border/50">
                            <span className="text-muted-foreground">Tipo comprobante</span>
                            <span className="font-medium">{a?.tipoComprobante ?? "—"}</span>
                          </div>
                          <div className="flex justify-between py-1.5 border-b border-border/50">
                            <span className="text-muted-foreground">Versión CFDI</span>
                            <span className="font-medium">{a?.version ?? "—"}</span>
                          </div>
                          <div className="flex justify-between py-1.5 border-b border-border/50">
                            <span className="text-muted-foreground">RFC emisor</span>
                            <span className="font-medium">{a?.rfcEmisor ?? "—"}</span>
                          </div>
                          <div className="flex justify-between py-1.5 border-b border-border/50">
                            <span className="text-muted-foreground">Nombre emisor</span>
                            <span className="font-medium">{a?.nombreEmisor ?? "—"}</span>
                          </div>
                          <div className="flex justify-between py-1.5 border-b border-border/50">
                            <span className="text-muted-foreground">RFC receptor</span>
                            <span className="font-medium">{a?.rfcReceptor ?? "—"}</span>
                          </div>
                          <div className="flex justify-between py-1.5 border-b border-border/50">
                            <span className="text-muted-foreground">Nombre receptor</span>
                            <span className="font-medium">{a?.nombreReceptor ?? "—"}</span>
                          </div>
                          <div className="flex justify-between py-1.5 border-b border-border/50">
                            <span className="text-muted-foreground">Fecha CFDI</span>
                            <span className="font-medium">{a?.fecha ?? "—"}</span>
                          </div>
                          <div className="flex justify-between py-1.5 border-b border-border/50">
                            <span className="text-muted-foreground">Serie</span>
                            <span className="font-medium">{a?.serie ?? "—"}</span>
                          </div>
                          <div className="flex justify-between py-1.5 border-b border-border/50">
                            <span className="text-muted-foreground">Folio</span>
                            <span className="font-medium">{a?.folio ?? "—"}</span>
                          </div>
                          <div className="flex justify-between py-1.5 border-b border-border/50">
                            <span className="text-muted-foreground">Subtotal</span>
                            <span className="font-medium">{a?.subtotal ?? "—"}</span>
                          </div>
                          <div className="flex justify-between py-1.5 border-b border-border/50">
                            <span className="text-muted-foreground">Total</span>
                            <span className="font-medium">{a?.total ?? "—"}</span>
                          </div>
                          <div className="flex justify-between py-1.5 border-b border-border/50">
                            <span className="text-muted-foreground">Moneda</span>
                            <span className="font-medium">{a?.moneda ?? "—"}</span>
                          </div>
                        </div>
                      </div>

                      {a?.paymentComplement && (
                        <div className="space-y-2">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Complemento de pago
                          </p>
                          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                            <div className="flex justify-between py-1.5 border-b border-border/50">
                              <span className="text-muted-foreground">Versión</span>
                              <span className="font-medium">
                                {a.paymentComplement.version ?? "—"}
                              </span>
                            </div>
                            <div className="flex justify-between py-1.5 border-b border-border/50">
                              <span className="text-muted-foreground">Pagos detectados</span>
                              <span className="font-medium">
                                {a.paymentComplement.pagos.length}
                              </span>
                            </div>
                          </div>
                          {a.paymentComplement.pagos.length > 0 && (
                            <div className="space-y-3">
                              {a.paymentComplement.pagos.map((pago, pi) => (
                                <div
                                  key={pi}
                                  className="p-3 rounded-lg border border-border bg-muted/20 space-y-2"
                                >
                                  <p className="text-xs font-semibold text-muted-foreground">
                                    Pago {pi + 1}
                                  </p>
                                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                                    <div className="flex justify-between py-0.5">
                                      <span className="text-muted-foreground">Fecha</span>
                                      <span>{pago.fechaPago ?? "—"}</span>
                                    </div>
                                    <div className="flex justify-between py-0.5">
                                      <span className="text-muted-foreground">Forma pago</span>
                                      <span>{pago.formaDePagoP ?? "—"}</span>
                                    </div>
                                    <div className="flex justify-between py-0.5">
                                      <span className="text-muted-foreground">Moneda</span>
                                      <span>{pago.monedaP ?? "—"}</span>
                                    </div>
                                    <div className="flex justify-between py-0.5">
                                      <span className="text-muted-foreground">Monto</span>
                                      <span>{pago.monto ?? "—"}</span>
                                    </div>
                                    <div className="flex justify-between py-0.5">
                                      <span className="text-muted-foreground">Tipo cambio</span>
                                      <span>{pago.tipoCambioP ?? "—"}</span>
                                    </div>
                                    <div className="flex justify-between py-0.5">
                                      <span className="text-muted-foreground">Núm. operación</span>
                                      <span>{pago.numOperacion ?? "—"}</span>
                                    </div>
                                  </div>
                                  {pago.documentosRelacionados.length > 0 && (
                                    <div className="overflow-x-auto">
                                      <p className="text-xs text-muted-foreground mb-1">
                                        Documentos relacionados
                                      </p>
                                      <table className="w-full text-xs border-collapse">
                                        <thead>
                                          <tr className="border-b border-border/50 text-muted-foreground">
                                            <th className="text-left py-1 pr-1">UUID</th>
                                            <th className="text-left py-1 pr-1">Serie</th>
                                            <th className="text-left py-1 pr-1">Folio</th>
                                            <th className="text-left py-1 pr-1">Moneda</th>
                                            <th className="text-left py-1 pr-1">Parcialidad</th>
                                            <th className="text-left py-1 pr-1">Pagado</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {pago.documentosRelacionados.map((doc, di) => (
                                            <tr key={di} className="border-b border-border/30">
                                              <td className="py-1 pr-1 font-mono truncate max-w-[80px]">
                                                {doc.idDocumento ?? "—"}
                                              </td>
                                              <td className="py-1 pr-1">{doc.serie ?? "—"}</td>
                                              <td className="py-1 pr-1">{doc.folio ?? "—"}</td>
                                              <td className="py-1 pr-1">{doc.monedaDR ?? "—"}</td>
                                              <td className="py-1 pr-1">
                                                {doc.numParcialidad ?? "—"}
                                              </td>
                                              <td className="py-1 pr-1">{doc.impPagado ?? "—"}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {a?.concepts && a.concepts.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Conceptos
                          </p>
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs border-collapse">
                              <thead>
                                <tr className="border-b border-border/50 text-muted-foreground">
                                  <th className="text-left py-1 pr-1">Clave</th>
                                  <th className="text-left py-1 pr-1">Cant.</th>
                                  <th className="text-left py-1 pr-1">Descripción</th>
                                  <th className="text-left py-1 pr-1">V. unitario</th>
                                  <th className="text-left py-1 pr-1">Importe</th>
                                  <th className="text-left py-1 pr-1">Dto.</th>
                                </tr>
                              </thead>
                              <tbody>
                                {a.concepts.map((c, ci) => (
                                  <tr key={ci} className="border-b border-border/30">
                                    <td className="py-1 pr-1 font-mono">
                                      {c.claveProdServ ?? "—"}
                                    </td>
                                    <td className="py-1 pr-1">{c.cantidad ?? "—"}</td>
                                    <td
                                      className="py-1 pr-1 max-w-[180px] truncate"
                                      title={c.descripcion}
                                    >
                                      {c.descripcion ?? "—"}
                                    </td>
                                    <td className="py-1 pr-1">{c.valorUnitario ?? "—"}</td>
                                    <td className="py-1 pr-1">{c.importe ?? "—"}</td>
                                    <td className="py-1 pr-1">{c.descuento ?? "—"}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {a?.taxSummary && (
                        <div className="space-y-2">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Resumen de impuestos
                          </p>
                          {a.taxSummary.transferred.length > 0 && (
                            <div className="space-y-1">
                              <p className="text-xs text-muted-foreground font-medium">
                                Trasladados
                              </p>
                              <div className="overflow-x-auto">
                                <table className="w-full text-xs border-collapse">
                                  <thead>
                                    <tr className="border-b border-border/50 text-muted-foreground">
                                      <th className="text-left py-1 pr-1">Impuesto</th>
                                      <th className="text-left py-1 pr-1">Tasa</th>
                                      <th className="text-left py-1 pr-1">Base</th>
                                      <th className="text-left py-1 pr-1">Importe</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {a.taxSummary.transferred.map((t, ti) => (
                                      <tr key={ti} className="border-b border-border/30">
                                        <td className="py-1 pr-1">{t.impuestoLabel}</td>
                                        <td className="py-1 pr-1">{t.tasaOCuota ?? "—"}</td>
                                        <td className="py-1 pr-1">{t.baseCalculated}</td>
                                        <td className="py-1 pr-1">{t.importeCalculated}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                          {a.taxSummary.retained.length > 0 && (
                            <div className="space-y-1">
                              <p className="text-xs text-muted-foreground font-medium">Retenidos</p>
                              <div className="overflow-x-auto">
                                <table className="w-full text-xs border-collapse">
                                  <thead>
                                    <tr className="border-b border-border/50 text-muted-foreground">
                                      <th className="text-left py-1 pr-1">Impuesto</th>
                                      <th className="text-left py-1 pr-1">Tasa</th>
                                      <th className="text-left py-1 pr-1">Base</th>
                                      <th className="text-left py-1 pr-1">Importe</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {a.taxSummary.retained.map((r, ri) => (
                                      <tr key={ri} className="border-b border-border/30">
                                        <td className="py-1 pr-1">{r.impuestoLabel}</td>
                                        <td className="py-1 pr-1">{r.tasaOCuota ?? "—"}</td>
                                        <td className="py-1 pr-1">{r.baseCalculated}</td>
                                        <td className="py-1 pr-1">{r.importeCalculated}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {a?.totalsValidation && (
                        <div className="space-y-2">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Validación de totales
                          </p>
                          <div
                            className={`p-3 rounded-lg border ${a.totalsValidation.matches ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"}`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-semibold text-muted-foreground">
                                Totales
                              </span>
                              <span
                                className={`text-xs font-bold px-2 py-0.5 rounded-full border ${a.totalsValidation.matches ? "text-emerald-700 bg-emerald-50 border-emerald-200" : "text-red-700 bg-red-50 border-red-200"}`}
                              >
                                {a.totalsValidation.matches ? "Consistentes" : "Inconsistentes"}
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                              <div className="flex justify-between py-0.5">
                                <span className="text-muted-foreground">Subtotal XML</span>
                                <span className="font-medium">
                                  {a.totalsValidation.subtotalXml ?? "—"}
                                </span>
                              </div>
                              <div className="flex justify-between py-0.5">
                                <span className="text-muted-foreground">Subtotal calculado</span>
                                <span className="font-medium">
                                  {a.totalsValidation.subtotalCalculated ?? "—"}
                                </span>
                              </div>
                              <div className="flex justify-between py-0.5">
                                <span className="text-muted-foreground">Imp. trasladados XML</span>
                                <span className="font-medium">
                                  {a.totalsValidation.transferredTaxesXml ?? "—"}
                                </span>
                              </div>
                              <div className="flex justify-between py-0.5">
                                <span className="text-muted-foreground">
                                  Imp. trasladados calc.
                                </span>
                                <span className="font-medium">
                                  {a.totalsValidation.transferredTaxesCalculated ?? "—"}
                                </span>
                              </div>
                              <div className="flex justify-between py-0.5">
                                <span className="text-muted-foreground">Imp. retenidos XML</span>
                                <span className="font-medium">
                                  {a.totalsValidation.retainedTaxesXml ?? "—"}
                                </span>
                              </div>
                              <div className="flex justify-between py-0.5">
                                <span className="text-muted-foreground">Imp. retenidos calc.</span>
                                <span className="font-medium">
                                  {a.totalsValidation.retainedTaxesCalculated ?? "—"}
                                </span>
                              </div>
                              <div className="flex justify-between py-0.5">
                                <span className="text-muted-foreground">Total XML</span>
                                <span className="font-medium">
                                  {a.totalsValidation.totalXml ?? "—"}
                                </span>
                              </div>
                              <div className="flex justify-between py-0.5">
                                <span className="text-muted-foreground">Total calculado</span>
                                <span className="font-medium">
                                  {a.totalsValidation.totalCalculated ?? "—"}
                                </span>
                              </div>
                              <div className="flex justify-between py-0.5">
                                <span className="text-muted-foreground">Diferencia</span>
                                <span className="font-medium">
                                  {a.totalsValidation.difference ?? "—"}
                                </span>
                              </div>
                              <div className="flex justify-between py-0.5">
                                <span className="text-muted-foreground">Tolerancia</span>
                                <span className="font-medium">{a.totalsValidation.tolerance}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  ) : null}
                </div>

                <div className="sticky bottom-0 flex justify-end px-6 py-3 border-t border-border bg-card rounded-b-xl">
                  <button
                    onClick={() => setSelectedMassiveDetail(null)}
                    className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-all"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
    </div>
  );
}
