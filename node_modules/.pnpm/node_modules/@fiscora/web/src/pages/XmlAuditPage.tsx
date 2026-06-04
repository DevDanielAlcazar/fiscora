import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { getMe } from "../api/auth";
import { analyzeXml, type AnalysisResult } from "../api/xml-audit";

export default function XmlAuditPage() {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filter, setFilter] = useState<"ALL" | "CRITICAL" | "WARNING" | "INFO">("ALL");

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
                      {(["ALL", "CRITICAL", "WARNING", "INFO"] as const).map((f) => {
                        const labels: Record<string, string> = { ALL: "Todos", CRITICAL: "Críticos", WARNING: "Advertencias", INFO: "Informativos" };
                        const active = filter === f;
                        return (
                          <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-all ${
                              active
                                ? "bg-foreground text-background border-foreground"
                                : "bg-transparent text-muted-foreground border-border hover:border-foreground hover:text-foreground"
                            }`}
                          >
                            {labels[f]}
                          </button>
                        );
                      })}
                    </div>
                    <div className="space-y-3">
                      {(() => {
                        const filtered = filter === "ALL" ? result.findings : result.findings.filter(f => f.severity === filter);
                        if (filtered.length === 0) {
                          return <p className="text-sm text-muted-foreground">No hay hallazgos para este filtro.</p>;
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
