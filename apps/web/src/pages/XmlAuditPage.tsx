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
} from "../api/xml-audit";
import { getPriorityLabel } from "./xml-audit/findingPriority";

import {
  handleExportJsonIndividual,
  handleExportCsvIndividual,
  handleExportExcelIndividual,
  handleExportMassiveCsv as handleExportMassiveCsvExport,
} from "./xml-audit/csvExports";
import ActionableSummary from "./xml-audit/ActionableSummary";
import MassiveExecutiveSummary from "./xml-audit/MassiveExecutiveSummary";
import MassiveResultsTable from "./xml-audit/MassiveResultsTable";
import MassiveDetailModal from "./xml-audit/MassiveDetailModal";
import PrintableIndividualReport from "./xml-audit/PrintableIndividualReport";
import PrintableZipReport from "./xml-audit/PrintableZipReport";
import FindingGlossary from "./xml-audit/FindingGlossary";
import RemediationPlan from "./xml-audit/RemediationPlan";
import CopySummaryActions from "./xml-audit/CopySummaryActions";
import { buildIndividualExecutiveText, buildSupportMessageFromAnalysis } from "./xml-audit/shareSummary.helpers";

/* Todos los textos visibles deben guardarse en UTF-8. No pegar texto mojibake. */
export default function XmlAuditPage() {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filter, setFilter] = useState<"ALL" | "CRITICAL" | "WARNING" | "INFO">("ALL");
  const [priorityFilter, setPriorityFilter] = useState<
    "ALL" | "BLOCKER" | "HIGH" | "MEDIUM" | "LOW"
  >("ALL");
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
  const [massiveFilter, setMassiveFilter] = useState<string>("ALL");
  const [printMode, setPrintMode] = useState<"none" | "individual" | "zip">("none");

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setSelectedMassiveDetail(null);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [selectedMassiveDetail]);

  useEffect(() => {
    if (printMode === "none") {
      delete document.body.dataset.printMode;
      return;
    }
    document.body.dataset.printMode = printMode;
    const timer = setTimeout(() => {
      window.print();
    }, 0);
    return () => {
      clearTimeout(timer);
    };
  }, [printMode]);

  useEffect(() => {
    function onAfterPrint() {
      setPrintMode("none");
    }
    window.addEventListener("afterprint", onAfterPrint);
    return () => window.removeEventListener("afterprint", onAfterPrint);
  }, []);

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

  function handleExportMassiveCsv() {
    if (!fullAnalysisResult) return;
    handleExportMassiveCsvExport(fullAnalysisResult);
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
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-extrabold tracking-tight">Auditoría XML</h1>
          <div className="flex gap-2">
            <button
              onClick={() => navigate("/modules/xml-audit/dashboard")}
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
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
              Dashboard XML
            </button>
            <button
              onClick={() => navigate("/modules/xml-audit/history")}
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
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              Ver historial reciente
            </button>
            <button
              onClick={() => navigate("/modules/xml-audit/history/batches")}
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
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
              Ver lotes ZIP recientes
            </button>
          </div>
        </div>

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

              <MassiveExecutiveSummary
                fullAnalysisResult={fullAnalysisResult}
                onOpenDetail={(file) => setSelectedMassiveDetail(file)}
              />

              <MassiveResultsTable
                fullAnalysisResult={fullAnalysisResult}
                massiveFilter={massiveFilter}
                onMassiveFilterChange={setMassiveFilter}
                onOpenDetail={(file) => setSelectedMassiveDetail(file)}
              />
              <button
                onClick={handleExportMassiveCsv}
                className="w-full py-2.5 px-4 rounded-lg border border-primary text-primary font-semibold text-sm hover:bg-primary hover:text-primary-foreground transition-all"
              >
                Exportar análisis masivo CSV
              </button>
              <button
                onClick={() => setPrintMode("zip")}
                className="w-full py-2.5 px-4 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-all"
              >
                Imprimir reporte ZIP / Guardar PDF
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
                    <span className="font-medium">
                      {new Date(result.analysisMeta.generatedAt).toLocaleString()}
                    </span>
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
                    <span className="font-medium">
                      {result.analysisMeta.performance.totalMs} ms
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Tamaño de entrada</span>
                    <span className="font-medium">
                      {result.analysisMeta.performance.inputKb} KB
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Hallazgos originales</span>
                    <span className="font-medium">
                      {result.analysisMeta.performance.findingsOriginalCount}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Hallazgos devueltos</span>
                    <span className="font-medium">
                      {result.analysisMeta.performance.findingsReturnedCount}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Truncado</span>
                    <span className="font-medium">
                      {result.analysisMeta.performance.findingsTruncated ? "Sí" : "No"}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Sanitizado</span>
                    <span className="font-medium">
                      {result.analysisMeta.performance.sanitized ? "Sí" : "No"}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">XML normalizado disponible</span>
                    <span className="font-medium">
                      {result.analysisMeta.performance.normalizedXmlAvailable ? "Sí" : "No"}
                    </span>
                  </div>
                </div>

                <h3 className="font-semibold text-sm mt-4">Cobertura del análisis</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 px-2 font-medium text-muted-foreground">
                          Módulo
                        </th>
                        <th className="text-center py-2 px-2 font-medium text-muted-foreground">
                          Detectado
                        </th>
                        <th className="text-center py-2 px-2 font-medium text-muted-foreground">
                          Analizado
                        </th>
                        <th className="text-right py-2 px-2 font-medium text-muted-foreground">
                          Hallazgos
                        </th>
                        <th className="text-left py-2 px-2 font-medium text-muted-foreground">
                          Motivo omisión
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.analysisMeta.coverage.modules.map((m) => (
                        <tr key={m.key} className="border-b border-border/50">
                          <td className="py-1.5 px-2 font-medium whitespace-nowrap">{m.label}</td>
                          <td className="py-1.5 px-2 text-center">
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${m.detected ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}
                            >
                              {m.detected ? "Sí" : "No"}
                            </span>
                          </td>
                          <td className="py-1.5 px-2 text-center">
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${m.analyzed ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"}`}
                            >
                              {m.analyzed ? "Sí" : "No"}
                            </span>
                          </td>
                          <td className="py-1.5 px-2 text-right font-mono">{m.findingsCount}</td>
                          <td className="py-1.5 px-2 text-muted-foreground italic text-xs">
                            {m.skippedReason ?? "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="text-xs text-muted-foreground mt-2">
                  {result.analysisMeta.coverage.complementsDetected.length > 0 && (
                    <p>
                      Complementos detectados:{" "}
                      {result.analysisMeta.coverage.complementsDetected.join(", ")}
                    </p>
                  )}
                  {result.analysisMeta.coverage.complementsUnknown.length > 0 && (
                    <p className="text-yellow-600">
                      Complementos no clasificados:{" "}
                      {result.analysisMeta.coverage.complementsUnknown.join(", ")}
                    </p>
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
                      <div className="flex justify-end mb-4">
                        <CopySummaryActions
                          mode="individual"
                          generateSummaryText={() => buildIndividualExecutiveText(result)}
                          generateSupportText={() => buildSupportMessageFromAnalysis(result)}
                        />
                      </div>
                    )}
                    {result.findings && result.findings.length > 0 && (
                      <ActionableSummary findings={result.findings!} />
                    )}
                    {result.findings && result.findings.length > 0 && (
                      <RemediationPlan findings={result.findings!} />
                    )}
                    {result.findings && result.findings.length > 0 && (
                      <FindingGlossary findings={result.findings!} />
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
                                      f.priority === "BLOCKER"
                                        ? "text-red-700 bg-red-50 border-red-200"
                                        : f.priority === "HIGH"
                                          ? "text-orange-700 bg-orange-50 border-orange-200"
                                          : f.priority === "MEDIUM"
                                            ? "text-yellow-700 bg-yellow-50 border-yellow-200"
                                            : "text-blue-700 bg-blue-50 border-blue-200"
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

                              {fullAnalysisResult && (
                                <PrintableZipReport fullAnalysisResult={fullAnalysisResult} />
                              )}
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
                    <span className="font-medium">
                      {result.comercioExterior.tipoOperacion ?? "—"}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Clave de pedimento</span>
                    <span className="font-medium">
                      {result.comercioExterior.claveDePedimento ?? "—"}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Certificado de origen</span>
                    <span className="font-medium">
                      {result.comercioExterior.certificadoOrigen ?? "—"}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">No. exportador confiable</span>
                    <span className="font-medium">
                      {result.comercioExterior.numeroExportadorConfiable ?? "—"}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Incoterm</span>
                    <span className="font-medium">{result.comercioExterior.incoterm ?? "—"}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">SubDivisión</span>
                    <span className="font-medium">
                      {result.comercioExterior.subDivision ?? "—"}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">TipoCambioUSD</span>
                    <span className="font-medium">
                      {result.comercioExterior.tipoCambioUSD ?? "—"}
                    </span>
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
                    <span className="font-medium">
                      {result.impuestosLocales.totalDeRetenciones ?? "—"}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Total traslados</span>
                    <span className="font-medium">
                      {result.impuestosLocales.totalDeTraslados ?? "—"}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Retenciones</span>
                    <span className="font-medium">
                      {result.impuestosLocales.retenciones.length}
                    </span>
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
                    <span className="font-medium">
                      {result.donatarias.fechaAutorizacion ?? "—"}
                    </span>
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
                        <span className="font-medium">
                          {result.retenciones.emisor.rfcEmisor ?? "—"}
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-border/50">
                        <span className="text-muted-foreground">Nombre</span>
                        <span className="font-medium">
                          {result.retenciones.emisor.nombre ?? "—"}
                        </span>
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
                        <span className="font-medium">
                          {result.retenciones.receptor.nacionalidad ?? "—"}
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-border/50">
                        <span className="text-muted-foreground">RFC / NumRegIdTrib</span>
                        <span className="font-medium">
                          {result.retenciones.receptor.rfcReceptor ??
                            result.retenciones.receptor.numRegIdTrib ??
                            "—"}
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-border/50">
                        <span className="text-muted-foreground">Nombre</span>
                        <span className="font-medium">
                          {result.retenciones.receptor.nombre ?? "—"}
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-border/50">
                        <span className="text-muted-foreground">CURP</span>
                        <span className="font-medium">
                          {result.retenciones.receptor.curp ?? "—"}
                        </span>
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
                        <span className="font-medium">
                          {result.retenciones.periodo.mesIni ?? "—"}
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-border/50">
                        <span className="text-muted-foreground">Mes final</span>
                        <span className="font-medium">
                          {result.retenciones.periodo.mesFin ?? "—"}
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-border/50">
                        <span className="text-muted-foreground">Ejercicio</span>
                        <span className="font-medium">
                          {result.retenciones.periodo.ejercicio ?? "—"}
                        </span>
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
                        <span className="font-medium">
                          {result.retenciones.totales.montoTotOperacion ?? "—"}
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-border/50">
                        <span className="text-muted-foreground">Monto total gravado</span>
                        <span className="font-medium">
                          {result.retenciones.totales.montoTotGrav ?? "—"}
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-border/50">
                        <span className="text-muted-foreground">Monto total exento</span>
                        <span className="font-medium">
                          {result.retenciones.totales.montoTotExent ?? "—"}
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-border/50">
                        <span className="text-muted-foreground">Monto total retenido</span>
                        <span className="font-medium">
                          {result.retenciones.totales.montoTotRet ?? "—"}
                        </span>
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
                    <h3 className="text-sm font-semibold">
                      Señales detectadas ({result.addenda.signals.length})
                    </h3>
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
                    <h3 className="text-sm font-semibold">
                      Resumen de nodos ({result.addenda.nodeSummary.length})
                    </h3>
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
                            <span>⚠ </span> {issue}
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
              handleExportJsonIndividual(r);
            }
            function handleExportCsv() {
              handleExportCsvIndividual(r);
            }
            function handleExportExcel() {
              handleExportExcelIndividual(r);
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
                  onClick={() => setPrintMode("individual")}
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

      {result && <PrintableIndividualReport result={result} />}

      <MassiveDetailModal
        selectedMassiveDetail={selectedMassiveDetail}
        onClose={() => setSelectedMassiveDetail(null)}
      />
    </div>
  );
}
