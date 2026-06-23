import type { ZipFullAnalysisFileResult } from "../../api/xml-audit";
import FindingExplorer from "./FindingExplorer";
import FindingGlossary from "./FindingGlossary";
import RemediationPlan from "./RemediationPlan";
import RiskScorePanel from "./RiskScorePanel";

interface MassiveDetailModalProps {
  selectedMassiveDetail: ZipFullAnalysisFileResult | null;
  onClose: () => void;
}

export default function MassiveDetailModal({
  selectedMassiveDetail,
  onClose,
}: MassiveDetailModalProps) {
  if (!selectedMassiveDetail) return null;

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
  const rs = riskStyles[es?.riskLevel ?? "OK"] ?? riskStyles.WARNING;
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-8 pb-8 bg-black/60 overflow-y-auto"
      onClick={() => onClose()}
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
            onClick={() => onClose()}
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
              <p className="text-sm font-semibold text-red-800">Error al analizar el archivo</p>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between py-1 border-b border-red-200/50">
                  <span className="text-red-600">Código de error</span>
                  <span className="font-medium text-red-800 font-mono">{sd.errorCode ?? "—"}</span>
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
                <RiskScorePanel findings={findings} compact />
                {findings.length > 0 ? (
                  <FindingExplorer findings={findings} compact />
                ) : (
                  <p className="text-sm text-muted-foreground bg-muted/30 rounded-lg px-4 py-3">
                    No se detectaron hallazgos estructurados para este XML.
                  </p>
                )}
                {findings.length > 0 && <RemediationPlan findings={findings} compact />}
                {findings.length > 0 && <FindingGlossary findings={findings} compact />}
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
                    <span className="font-medium">{td?.leadingContentBeforeXml ? "Sí" : "No"}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-border/50 col-span-2">
                    <span className="text-muted-foreground">Normalización segura aplicada</span>
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
                        <span className="font-medium text-blue-800 font-mono">{nx.filename}</span>
                      </div>
                      <div className="flex justify-between py-0.5">
                        <span className="text-blue-600">Tipo normalización</span>
                        <span className="font-medium text-blue-800">{nx.normalizationType}</span>
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
                        <span className="text-blue-600 shrink-0">Hash original SHA-256</span>
                        <span className="font-mono text-blue-800 break-all text-right ml-4">
                          {nx.originalSha256}
                        </span>
                      </div>
                      <div className="flex justify-between py-0.5 col-span-2">
                        <span className="text-blue-600 shrink-0">Hash normalizado SHA-256</span>
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
                          <span key={ni} className="text-xs bg-muted px-2 py-0.5 rounded font-mono">
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
                          <span key={ni} className="text-xs bg-muted px-2 py-0.5 rounded font-mono">
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
                      <span className="font-medium">{a.paymentComplement.version ?? "—"}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-border/50">
                      <span className="text-muted-foreground">Pagos detectados</span>
                      <span className="font-medium">{a.paymentComplement.pagos.length}</span>
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
                                      <td className="py-1 pr-1">{doc.numParcialidad ?? "—"}</td>
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
                            <td className="py-1 pr-1 font-mono">{c.claveProdServ ?? "—"}</td>
                            <td className="py-1 pr-1">{c.cantidad ?? "—"}</td>
                            <td className="py-1 pr-1 max-w-[180px] truncate" title={c.descripcion}>
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
                      <p className="text-xs text-muted-foreground font-medium">Trasladados</p>
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
                      <span className="text-xs font-semibold text-muted-foreground">Totales</span>
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded-full border ${a.totalsValidation.matches ? "text-emerald-700 bg-emerald-50 border-emerald-200" : "text-red-700 bg-red-50 border-red-200"}`}
                      >
                        {a.totalsValidation.matches ? "Consistentes" : "Inconsistentes"}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                      <div className="flex justify-between py-0.5">
                        <span className="text-muted-foreground">Subtotal XML</span>
                        <span className="font-medium">{a.totalsValidation.subtotalXml ?? "—"}</span>
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
                        <span className="text-muted-foreground">Imp. trasladados calc.</span>
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
                        <span className="font-medium">{a.totalsValidation.totalXml ?? "—"}</span>
                      </div>
                      <div className="flex justify-between py-0.5">
                        <span className="text-muted-foreground">Total calculado</span>
                        <span className="font-medium">
                          {a.totalsValidation.totalCalculated ?? "—"}
                        </span>
                      </div>
                      <div className="flex justify-between py-0.5">
                        <span className="text-muted-foreground">Diferencia</span>
                        <span className="font-medium">{a.totalsValidation.difference ?? "—"}</span>
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
            onClick={() => onClose()}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-all"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
