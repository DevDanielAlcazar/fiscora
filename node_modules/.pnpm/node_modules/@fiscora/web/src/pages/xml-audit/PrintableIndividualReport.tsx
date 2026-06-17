import type { AnalysisResult } from "../../api/xml-audit";
import { sortFindingsByPriority, groupFindingsByActionGroup } from "./findingPriority";

interface Props {
  result: AnalysisResult;
}

export default function PrintableIndividualReport({ result }: Props) {
  function severityBadge(s: string) {
    const cls =
      s === "CRITICAL" ? "badge-critical" : s === "WARNING" ? "badge-warning" : "badge-info";
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
            {result.uuid && (
              <p
                style={{
                  margin: "2px 0 0",
                  fontFamily: "monospace",
                  fontSize: "9px",
                  color: "#888",
                }}
              >
                UUID: {result.uuid}
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
          Este reporte se genera con base en el XML analizado en memoria. No sustituye la validación
          oficial del SAT ni constituye dictamen fiscal.
        </p>

        {result.executiveSummary && (
          <div className="avoid-break">
            <h2>Resumen ejecutivo</h2>
            <div style={{ marginBottom: "8px" }}>
              <span
                className={`badge-${result.executiveSummary.riskLevel === "CRITICAL" ? "critical" : result.executiveSummary.riskLevel === "WARNING" ? "warning" : "ok"}`}
                style={{ marginBottom: "4px" }}
              >
                {result.executiveSummary.riskLevel}
              </span>
            </div>
            <p style={{ fontWeight: 600, margin: "4px 0" }}>{result.executiveSummary.title}</p>
            <p style={{ margin: "4px 0" }}>{result.executiveSummary.message}</p>
            <p style={{ margin: "4px 0", fontSize: "10px" }}>
              <span style={{ fontWeight: 600 }}>Acción recomendada:</span>{" "}
              {result.executiveSummary.recommendedAction}
            </p>
          </div>
        )}

        {result.analysisMeta && (
          <div className="avoid-break">
            <h2>Metadata del análisis</h2>
            <div className="meta-grid">
              <div className="meta-item">
                <span className="meta-label">Fecha generación</span>
                <span className="meta-value">
                  {new Date(result.analysisMeta.generatedAt).toLocaleString()}
                </span>
              </div>
              <div className="meta-item">
                <span className="meta-label">Engine version</span>
                <span className="meta-value">{result.analysisMeta.engineVersion}</span>
              </div>
              <div className="meta-item">
                <span className="meta-label">Tipo documento</span>
                <span className="meta-value">{result.analysisMeta.coverage.documentKind}</span>
              </div>
              <div className="meta-item">
                <span className="meta-label">Tiempo total</span>
                <span className="meta-value">{result.analysisMeta.performance.totalMs} ms</span>
              </div>
              <div className="meta-item">
                <span className="meta-label">Tamaño de entrada</span>
                <span className="meta-value">{result.analysisMeta.performance.inputKb} KB</span>
              </div>
              <div className="meta-item">
                <span className="meta-label">Hallazgos originales</span>
                <span className="meta-value">
                  {result.analysisMeta.performance.findingsOriginalCount}
                </span>
              </div>
              <div className="meta-item">
                <span className="meta-label">Hallazgos devueltos</span>
                <span className="meta-value">
                  {result.analysisMeta.performance.findingsReturnedCount}
                </span>
              </div>
              <div className="meta-item">
                <span className="meta-label">Truncado</span>
                <span className="meta-value">
                  {result.analysisMeta.performance.findingsTruncated ? "Sí" : "No"}
                </span>
              </div>
              <div className="meta-item">
                <span className="meta-label">Sanitizado</span>
                <span className="meta-value">
                  {result.analysisMeta.performance.sanitized ? "Sí" : "No"}
                </span>
              </div>
              <div className="meta-item">
                <span className="meta-label">XML normalizado disponible</span>
                <span className="meta-value">
                  {result.analysisMeta.performance.normalizedXmlAvailable ? "Sí" : "No"}
                </span>
              </div>
            </div>
            <h3
              style={{ fontSize: "14px", fontWeight: 600, marginTop: "16px", marginBottom: "8px" }}
            >
              Cobertura del análisis
            </h3>
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
                {result.analysisMeta.coverage.modules.map((m) => (
                  <tr key={m.key} style={{ borderBottom: "1px solid #e5e7eb" }}>
                    <td style={{ padding: "3px 6px", fontWeight: 500 }}>{m.label}</td>
                    <td style={{ padding: "3px 6px", textAlign: "center" }}>
                      {m.detected ? "Sí" : "No"}
                    </td>
                    <td style={{ padding: "3px 6px", textAlign: "center" }}>
                      {m.analyzed ? "Sí" : "No"}
                    </td>
                    <td style={{ padding: "3px 6px", textAlign: "right", fontFamily: "monospace" }}>
                      {m.findingsCount}
                    </td>
                    <td style={{ padding: "3px 6px", color: "#888", fontStyle: "italic" }}>
                      {m.skippedReason ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {result.analysisMeta.coverage.complementsDetected.length > 0 && (
              <p style={{ fontSize: "10px", color: "#666", marginTop: "8px" }}>
                Complementos detectados:{" "}
                {result.analysisMeta.coverage.complementsDetected.join(", ")}
              </p>
            )}
          </div>
        )}

        <div className="avoid-break">
          <h2>Metadata fiscal</h2>
          <div className="meta-grid">
            <div className="meta-item">
              <span className="meta-label">UUID</span>
              <span className="meta-value">{result.uuid ?? "—"}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Tipo comprobante</span>
              <span className="meta-value">{result.tipoComprobante ?? "—"}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Versión CFDI</span>
              <span className="meta-value">{result.version ?? "—"}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Fecha CFDI</span>
              <span className="meta-value">{result.fecha ?? "—"}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Fecha timbrado</span>
              <span className="meta-value">{result.fechaTimbrado ?? "—"}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">RFC emisor</span>
              <span className="meta-value">{result.rfcEmisor ?? "—"}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Nombre emisor</span>
              <span className="meta-value">{result.nombreEmisor ?? "—"}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">RFC receptor</span>
              <span className="meta-value">{result.rfcReceptor ?? "—"}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Nombre receptor</span>
              <span className="meta-value">{result.nombreReceptor ?? "—"}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Serie</span>
              <span className="meta-value">{result.serie ?? "—"}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Folio</span>
              <span className="meta-value">{result.folio ?? "—"}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Moneda</span>
              <span className="meta-value">{result.moneda ?? "—"}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Subtotal</span>
              <span className="meta-value">{result.subtotal ?? "—"}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Total</span>
              <span className="meta-value">{result.total ?? "—"}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Método de pago</span>
              <span className="meta-value">{result.metodoPago ?? "—"}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Forma de pago</span>
              <span className="meta-value">{result.formaPago ?? "—"}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Uso CFDI</span>
              <span className="meta-value">{result.usoCfdi ?? "—"}</span>
            </div>
          </div>
        </div>

        <div className="avoid-break">
          <h2>Hallazgos</h2>
          {result.findings && result.findings.length > 0 ? (
            <>
              <div className="findings-count">
                <span>
                  Críticos:{" "}
                  <strong>{result.findings.filter((f) => f.severity === "CRITICAL").length}</strong>
                </span>
                <span>
                  Advertencias:{" "}
                  <strong>{result.findings.filter((f) => f.severity === "WARNING").length}</strong>
                </span>
                <span>
                  Informativos:{" "}
                  <strong>{result.findings.filter((f) => f.severity === "INFO").length}</strong>
                </span>
              </div>
              <div style={{ marginTop: "8px", marginBottom: "8px" }}>
                <p style={{ fontWeight: 600, fontSize: "11px", margin: "0 0 4px" }}>
                  Prioridades del análisis
                </p>
                <div style={{ display: "flex", gap: "12px", fontSize: "10px" }}>
                  {(
                    [
                      { key: "BLOCKER", label: "Bloqueantes" },
                      { key: "HIGH", label: "Alta" },
                      { key: "MEDIUM", label: "Media" },
                      { key: "LOW", label: "Informativa" },
                    ] as const
                  ).map(({ key, label }) => (
                    <span key={key}>
                      {label}:{" "}
                      <strong>
                        {
                          result.findings!.filter(
                            (f: import("../../api/xml-audit").Finding) => f.priority === key,
                          ).length
                        }
                      </strong>
                    </span>
                  ))}
                </div>
                {(() => {
                  const sorted = sortFindingsByPriority(result.findings!).slice(0, 5);
                  return (
                    <div style={{ marginTop: "6px" }}>
                      <p style={{ fontWeight: 600, fontSize: "10px", margin: "0 0 2px" }}>
                        Top 5 acciones recomendadas
                      </p>
                      {sorted.map((f, i) => (
                        <p key={i} style={{ fontSize: "9px", margin: "1px 0" }}>
                          <strong>
                            #{i + 1} {f.code}
                          </strong>{" "}
                          ({f.priority ?? "LOW"}): {f.recommendedAction ?? f.title}
                        </p>
                      ))}
                    </div>
                  );
                })()}
                {(() => {
                  const groups = groupFindingsByActionGroup(result.findings!);
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
                  {result.findings.map((f) => (
                    <tr key={f.id}>
                      <td>{severityBadge(f.severity)}</td>
                      <td style={{ fontSize: "9px" }}>{f.category}</td>
                      <td style={{ fontFamily: "monospace", fontSize: "9px" }}>{f.code}</td>
                      <td>
                        <p style={{ fontWeight: 600, margin: 0, fontSize: "10px" }}>{f.title}</p>
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
                                <span style={{ fontWeight: 600 }}>{e.label}:</span> {e.value ?? "—"}
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
                <td>{result.technicalDiagnostics.isStamped ? "Sí" : "No"}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600 }}>Timbre Fiscal Digital detectado</td>
                <td>{result.technicalDiagnostics.hasTimbreFiscalDigital ? "Sí" : "No"}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600 }}>BOM UTF-8 detectado</td>
                <td>{result.technicalDiagnostics.bomDetected ? "Sí" : "No"}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600 }}>Contenido previo al XML</td>
                <td>{result.technicalDiagnostics.leadingContentBeforeXml ? "Sí" : "No"}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600 }}>Normalización segura aplicada</td>
                <td>{result.technicalDiagnostics.safeNormalizationApplied ? "Sí" : "No"}</td>
              </tr>
              {result.normalizedXml && (
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
                      {result.normalizedXml.originalSha256 ?? "—"}
                    </td>
                  </tr>
                  {result.normalizedXml.normalizedSha256 && (
                    <tr>
                      <td style={{ fontWeight: 600 }}>Hash normalizado SHA-256</td>
                      <td
                        style={{
                          fontFamily: "monospace",
                          fontSize: "9px",
                          wordBreak: "break-all",
                        }}
                      >
                        {result.normalizedXml.normalizedSha256}
                      </td>
                    </tr>
                  )}
                  <tr>
                    <td style={{ fontWeight: 600 }}>Riesgo timbre/sello</td>
                    <td>{result.normalizedXml.stampRisk ?? "—"}</td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 600 }}>Contenido fiscal modificado</td>
                    <td>{result.normalizedXml.fiscalContentModified ? "Sí" : "No"}</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
          {result.technicalDiagnostics.safeNormalizationNotes.length > 0 && (
            <div style={{ marginTop: "8px" }}>
              <p style={{ fontWeight: 600, fontSize: "10px", margin: "0 0 4px" }}>
                Notas de normalización:
              </p>
              <ul style={{ margin: 0, paddingLeft: "16px" }}>
                {result.technicalDiagnostics.safeNormalizationNotes.map((note, i) => (
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
                <td>{result.structureDiagnostics.hasComplemento ? "Sí" : "No"}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600 }}>Addenda detectada</td>
                <td>{result.structureDiagnostics.hasAddenda ? "Sí" : "No"}</td>
              </tr>
            </tbody>
          </table>
          {result.structureDiagnostics.namespaces.length > 0 && (
            <div style={{ marginTop: "8px" }}>
              <p style={{ fontWeight: 600, fontSize: "10px", margin: "0 0 4px" }}>Namespaces:</p>
              <ul style={{ margin: 0, paddingLeft: "16px" }}>
                {result.structureDiagnostics.namespaces.map((ns, i) => (
                  <li key={i} style={{ fontFamily: "monospace", fontSize: "9px" }}>
                    {ns}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {result.structureDiagnostics.complementNames.length > 0 && (
            <div style={{ marginTop: "8px" }}>
              <p style={{ fontWeight: 600, fontSize: "10px", margin: "0 0 4px" }}>
                Complementos detectados:
              </p>
              <ul style={{ margin: 0, paddingLeft: "16px" }}>
                {result.structureDiagnostics.complementNames.map((name, i) => (
                  <li key={i} style={{ fontSize: "10px" }}>
                    {name}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {result.structureDiagnostics.knownComplements.length > 0 && (
            <div style={{ marginTop: "8px" }}>
              <p style={{ fontWeight: 600, fontSize: "10px", margin: "0 0 4px" }}>
                Complementos clasificados:
              </p>
              <ul style={{ margin: 0, paddingLeft: "16px" }}>
                {result.structureDiagnostics.knownComplements.map((name, i) => (
                  <li key={i} style={{ fontSize: "10px" }}>
                    {name}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {result.structureDiagnostics.unknownComplements.length > 0 && (
            <div style={{ marginTop: "8px" }}>
              <p style={{ fontWeight: 600, fontSize: "10px", margin: "0 0 4px" }}>
                Complementos no clasificados:
              </p>
              <ul style={{ margin: 0, paddingLeft: "16px" }}>
                {result.structureDiagnostics.unknownComplements.map((name, i) => (
                  <li key={i} style={{ fontSize: "10px" }}>
                    {name}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {result.structureDiagnostics.nodeShapeNotes.length > 0 && (
            <div style={{ marginTop: "8px" }}>
              <p style={{ fontWeight: 600, fontSize: "10px", margin: "0 0 4px" }}>
                Notas estructurales:
              </p>
              <ul style={{ margin: 0, paddingLeft: "16px" }}>
                {result.structureDiagnostics.nodeShapeNotes.map((note, i) => (
                  <li key={i} style={{ fontSize: "10px" }}>
                    {note}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {result.paymentComplement && (
          <div className="avoid-break">
            <h2>Complemento de pago</h2>
            <table>
              <tbody>
                <tr>
                  <td style={{ fontWeight: 600, width: "240px" }}>Versión</td>
                  <td>{result.paymentComplement.version ?? "—"}</td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 600 }}>Total pagos</td>
                  <td>{result.paymentComplement.pagos.length}</td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 600 }}>Documentos relacionados</td>
                  <td>
                    {result.paymentComplement.pagos.reduce(
                      (acc, p) => acc + p.documentosRelacionados.length,
                      0,
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
            {result.paymentComplement.pagos.map((pago, idx) => (
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

        {result.cfdiRelations && (
          <div className="avoid-break">
            <h2>CFDI relacionados</h2>
            <table>
              <tbody>
                <tr>
                  <td style={{ fontWeight: 600, width: "240px" }}>Grupos de relación</td>
                  <td>{result.cfdiRelations.totalRelationGroups}</td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 600 }}>Total CFDI relacionados</td>
                  <td>{result.cfdiRelations.totalRelatedCfdis}</td>
                </tr>
              </tbody>
            </table>
            {result.cfdiRelations.groups.map((group, gi) => (
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
                        <td style={{ padding: "2px 8px 2px 0", verticalAlign: "top" }}>{ri + 1}</td>
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

        {result.cartaPorte && (
          <div className="avoid-break">
            <h2>Carta Porte</h2>
            <table>
              <tbody>
                <tr>
                  <td style={{ fontWeight: 600, width: "240px" }}>Versión</td>
                  <td>{result.cartaPorte.version ?? "—"}</td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 600 }}>IdCCP</td>
                  <td>{result.cartaPorte.idCCP ?? "—"}</td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 600 }}>Transporte internacional</td>
                  <td>{result.cartaPorte.transpInternac ?? "—"}</td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 600 }}>Total distancia recorrida</td>
                  <td>{result.cartaPorte.totalDistRec ?? "—"}</td>
                </tr>
              </tbody>
            </table>
            <p style={{ fontSize: "10px", margin: "4px 0" }}>
              Modos:{result.cartaPorte.hasAutotransporte ? " Autotransporte" : ""}
              {result.cartaPorte.hasTransporteMaritimo ? " Marítimo" : ""}
              {result.cartaPorte.hasTransporteAereo ? " Aéreo" : ""}
              {result.cartaPorte.hasTransporteFerroviario ? " Ferroviario" : ""} | Ubicaciones:{" "}
              {result.cartaPorte.ubicaciones.length} | Mercancías:{" "}
              {result.cartaPorte.mercancias.length} | Figuras:{" "}
              {result.cartaPorte.figurasTransporte.length}
            </p>
            {result.cartaPorte.ubicaciones.length > 0 && (
              <div style={{ marginTop: "8px" }}>
                <p style={{ fontWeight: 600, fontSize: "11px", margin: "0 0 4px" }}>Ubicaciones</p>
                <table>
                  <thead>
                    <tr style={{ fontSize: "9px", borderBottom: "1px solid #ccc" }}>
                      <th style={{ textAlign: "left", padding: "2px 4px 2px 0" }}>Tipo</th>
                      <th style={{ textAlign: "left", padding: "2px 4px" }}>ID</th>
                      <th style={{ textAlign: "left", padding: "2px 4px" }}>RFC</th>
                      <th style={{ textAlign: "left", padding: "2px 4px" }}>Nombre</th>
                      <th style={{ textAlign: "left", padding: "2px 4px" }}>Fecha</th>
                      <th style={{ textAlign: "right", padding: "2px 0 2px 4px" }}>Distancia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.cartaPorte.ubicaciones.map((ubi, ui) => (
                      <tr key={ui} style={{ fontSize: "9px" }}>
                        <td style={{ padding: "2px 4px 2px 0" }}>{ubi.tipoUbicacion ?? "—"}</td>
                        <td style={{ padding: "2px 4px", fontFamily: "monospace" }}>
                          {ubi.idUbicacion ?? "—"}
                        </td>
                        <td style={{ padding: "2px 4px", fontFamily: "monospace" }}>
                          {ubi.rfcRemitenteDestinatario ?? "—"}
                        </td>
                        <td style={{ padding: "2px 4px" }}>
                          {ubi.nombreRemitenteDestinatario ?? "—"}
                        </td>
                        <td style={{ padding: "2px 4px" }}>{ubi.fechaHoraSalidaLlegada ?? "—"}</td>
                        <td style={{ padding: "2px 0 2px 4px", textAlign: "right" }}>
                          {ubi.distanciaRecorrida ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {result.cartaPorte.mercancias.length > 0 && (
              <div style={{ marginTop: "8px" }}>
                <p style={{ fontWeight: 600, fontSize: "11px", margin: "0 0 4px" }}>Mercancías</p>
                <table>
                  <thead>
                    <tr style={{ fontSize: "9px", borderBottom: "1px solid #ccc" }}>
                      <th style={{ textAlign: "left", padding: "2px 4px 2px 0" }}>BienesTransp</th>
                      <th style={{ textAlign: "left", padding: "2px 4px" }}>Descripción</th>
                      <th style={{ textAlign: "right", padding: "2px 4px" }}>Cantidad</th>
                      <th style={{ textAlign: "left", padding: "2px 4px" }}>Unidad</th>
                      <th style={{ textAlign: "right", padding: "2px 4px" }}>Peso KG</th>
                      <th style={{ textAlign: "right", padding: "2px 0 2px 4px" }}>Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.cartaPorte.mercancias.map((mer, mi) => (
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
            {result.cartaPorte.figurasTransporte.length > 0 && (
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
                      <th style={{ textAlign: "left", padding: "2px 0 2px 4px" }}>Licencia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.cartaPorte.figurasTransporte.map((fig, fi) => (
                      <tr key={fi} style={{ fontSize: "9px" }}>
                        <td style={{ padding: "2px 4px 2px 0" }}>{fig.tipoFigura ?? "—"}</td>
                        <td style={{ padding: "2px 4px", fontFamily: "monospace" }}>
                          {fig.rfcFigura ?? "—"}
                        </td>
                        <td style={{ padding: "2px 4px" }}>{fig.nombreFigura ?? "—"}</td>
                        <td style={{ padding: "2px 0 2px 4px" }}>{fig.numLicencia ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {result.nomina && (
          <>
            <div className="print-report-break"></div>
            <h3 className="text-lg font-bold mt-4 mb-2">Nómina</h3>
            <table className="w-full text-xs border-collapse mb-3">
              <tbody>
                <tr>
                  <td className="font-semibold pr-2">Versión</td>
                  <td>{result.nomina.version ?? "—"}</td>
                </tr>
                <tr>
                  <td className="font-semibold pr-2">Tipo nómina</td>
                  <td>{result.nomina.tipoNomina ?? "—"}</td>
                </tr>
                <tr>
                  <td className="font-semibold pr-2">Fecha pago</td>
                  <td>{result.nomina.fechaPago ?? "—"}</td>
                </tr>
                <tr>
                  <td className="font-semibold pr-2">Periodo</td>
                  <td>
                    {result.nomina.fechaInicialPago ?? "—"} — {result.nomina.fechaFinalPago ?? "—"}
                  </td>
                </tr>
                <tr>
                  <td className="font-semibold pr-2">Días pagados</td>
                  <td>{result.nomina.numDiasPagados ?? "—"}</td>
                </tr>
                <tr>
                  <td className="font-semibold pr-2">Total percepciones</td>
                  <td>{result.nomina.totalPercepciones ?? "—"}</td>
                </tr>
                <tr>
                  <td className="font-semibold pr-2">Total deducciones</td>
                  <td>{result.nomina.totalDeducciones ?? "—"}</td>
                </tr>
                <tr>
                  <td className="font-semibold pr-2">Total otros pagos</td>
                  <td>{result.nomina.totalOtrosPagos ?? "—"}</td>
                </tr>
              </tbody>
            </table>
            {result.nomina.receptor && (
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
                    <td>{result.nomina.receptor.curp ?? "—"}</td>
                  </tr>
                  <tr>
                    <td className="font-semibold pr-2">NSS</td>
                    <td>{result.nomina.receptor.numSeguridadSocial ?? "—"}</td>
                  </tr>
                  <tr>
                    <td className="font-semibold pr-2">NumEmpleado</td>
                    <td>{result.nomina.receptor.numEmpleado ?? "—"}</td>
                  </tr>
                  <tr>
                    <td className="font-semibold pr-2">Departamento</td>
                    <td>{result.nomina.receptor.departamento ?? "—"}</td>
                  </tr>
                  <tr>
                    <td className="font-semibold pr-2">Puesto</td>
                    <td>{result.nomina.receptor.puesto ?? "—"}</td>
                  </tr>
                  <tr>
                    <td className="font-semibold pr-2">Tipo contrato</td>
                    <td>{result.nomina.receptor.tipoContrato ?? "—"}</td>
                  </tr>
                  <tr>
                    <td className="font-semibold pr-2">Tipo régimen</td>
                    <td>{result.nomina.receptor.tipoRegimen ?? "—"}</td>
                  </tr>
                  <tr>
                    <td className="font-semibold pr-2">Periodicidad pago</td>
                    <td>{result.nomina.receptor.periodicidadPago ?? "—"}</td>
                  </tr>
                  <tr>
                    <td className="font-semibold pr-2">Salario base cotización</td>
                    <td>{result.nomina.receptor.salarioBaseCotApor ?? "—"}</td>
                  </tr>
                  <tr>
                    <td className="font-semibold pr-2">Salario diario integrado</td>
                    <td>{result.nomina.receptor.salarioDiarioIntegrado ?? "—"}</td>
                  </tr>
                  <tr>
                    <td className="font-semibold pr-2">Entidad federativa</td>
                    <td>{result.nomina.receptor.claveEntFed ?? "—"}</td>
                  </tr>
                </tbody>
              </table>
            )}
            {result.nomina.percepciones.length > 0 && (
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
                    {result.nomina.percepciones.map((p, i) => (
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
            {result.nomina.deducciones.length > 0 && (
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
                    {result.nomina.deducciones.map((d, i) => (
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
            {result.nomina.otrosPagos.length > 0 && (
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
                    {result.nomina.otrosPagos.map((o, i) => (
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

        {result.comercioExterior && (
          <>
            <div className="print-report-break"></div>
            <h3 className="text-lg font-bold mt-4 mb-2">Comercio Exterior</h3>
            <table className="w-full text-xs border-collapse mb-3">
              <tbody>
                <tr>
                  <td className="font-semibold pr-2" style={{ width: "200px" }}>
                    Versión
                  </td>
                  <td>{result.comercioExterior.version ?? "—"}</td>
                </tr>
                <tr>
                  <td className="font-semibold pr-2">Tipo operación</td>
                  <td>{result.comercioExterior.tipoOperacion ?? "—"}</td>
                </tr>
                <tr>
                  <td className="font-semibold pr-2">Clave de pedimento</td>
                  <td>{result.comercioExterior.claveDePedimento ?? "—"}</td>
                </tr>
                <tr>
                  <td className="font-semibold pr-2">Certificado de origen</td>
                  <td>{result.comercioExterior.certificadoOrigen ?? "—"}</td>
                </tr>
                <tr>
                  <td className="font-semibold pr-2">No. exportador confiable</td>
                  <td>{result.comercioExterior.numeroExportadorConfiable ?? "—"}</td>
                </tr>
                <tr>
                  <td className="font-semibold pr-2">Incoterm</td>
                  <td>{result.comercioExterior.incoterm ?? "—"}</td>
                </tr>
                <tr>
                  <td className="font-semibold pr-2">SubDivisión</td>
                  <td>{result.comercioExterior.subDivision ?? "—"}</td>
                </tr>
                <tr>
                  <td className="font-semibold pr-2">TipoCambioUSD</td>
                  <td>{result.comercioExterior.tipoCambioUSD ?? "—"}</td>
                </tr>
                <tr>
                  <td className="font-semibold pr-2">TotalUSD</td>
                  <td>{result.comercioExterior.totalUSD ?? "—"}</td>
                </tr>
                {result.comercioExterior.observaciones && (
                  <tr>
                    <td className="font-semibold pr-2">Observaciones</td>
                    <td>{result.comercioExterior.observaciones}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </>
        )}

        {result.impuestosLocales && (
          <>
            <div className="print-report-break"></div>
            <h3 className="text-lg font-bold mt-4 mb-2">Impuestos Locales</h3>
            <table className="w-full text-xs border-collapse mb-3">
              <tbody>
                <tr>
                  <td className="font-semibold pr-2" style={{ width: "200px" }}>
                    Versión
                  </td>
                  <td>{result.impuestosLocales.version ?? "—"}</td>
                </tr>
                <tr>
                  <td className="font-semibold pr-2">Total retenciones</td>
                  <td>{result.impuestosLocales.totalDeRetenciones ?? "—"}</td>
                </tr>
                <tr>
                  <td className="font-semibold pr-2">Total traslados</td>
                  <td>{result.impuestosLocales.totalDeTraslados ?? "—"}</td>
                </tr>
                <tr>
                  <td className="font-semibold pr-2">Retenciones</td>
                  <td>{result.impuestosLocales.retenciones.length}</td>
                </tr>
                <tr>
                  <td className="font-semibold pr-2">Traslados</td>
                  <td>{result.impuestosLocales.traslados.length}</td>
                </tr>
              </tbody>
            </table>
            {result.impuestosLocales.retenciones.length > 0 && (
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
                    {result.impuestosLocales.retenciones.map((ret, i) => (
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
            {result.impuestosLocales.traslados.length > 0 && (
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
                    {result.impuestosLocales.traslados.map((tras, i) => (
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

        {result.leyendasFiscales && (
          <>
            <div className="print-report-break"></div>
            <h3 className="text-lg font-bold mt-4 mb-2">Leyendas Fiscales</h3>
            <table className="w-full text-xs border-collapse mb-3">
              <tbody>
                <tr>
                  <td className="font-semibold pr-2" style={{ width: "200px" }}>
                    Versión
                  </td>
                  <td>{result.leyendasFiscales.version ?? "—"}</td>
                </tr>
                <tr>
                  <td className="font-semibold pr-2">Total leyendas</td>
                  <td>{result.leyendasFiscales.leyendas.length}</td>
                </tr>
              </tbody>
            </table>
            {result.leyendasFiscales.leyendas.length > 0 && (
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
                    {result.leyendasFiscales.leyendas.map((l, i) => (
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

        {result.donatarias && (
          <>
            <div className="print-report-break"></div>
            <h3 className="text-lg font-bold mt-4 mb-2">Donatarias</h3>
            <table className="w-full text-xs border-collapse mb-3">
              <tbody>
                <tr>
                  <td className="font-semibold pr-2" style={{ width: "200px" }}>
                    Versión
                  </td>
                  <td>{result.donatarias.version ?? "—"}</td>
                </tr>
                <tr>
                  <td className="font-semibold pr-2">NoAutorizacion</td>
                  <td>{result.donatarias.noAutorizacion ?? "—"}</td>
                </tr>
                <tr>
                  <td className="font-semibold pr-2">FechaAutorizacion</td>
                  <td>{result.donatarias.fechaAutorizacion ?? "—"}</td>
                </tr>
                <tr>
                  <td className="font-semibold pr-2">Leyenda</td>
                  <td>{result.donatarias.leyenda ?? "—"}</td>
                </tr>
              </tbody>
            </table>
          </>
        )}

        {result.documentKind === "RETENCIONES" && result.retenciones && (
          <>
            <div className="print-report-break"></div>
            <h3 className="text-lg font-bold mt-4 mb-2">Retenciones</h3>
            <table className="w-full text-xs border-collapse mb-3">
              <tbody>
                <tr>
                  <td className="font-semibold pr-2" style={{ width: "200px" }}>
                    Versión
                  </td>
                  <td>{result.retenciones.version ?? "—"}</td>
                </tr>
                <tr>
                  <td className="font-semibold pr-2">Folio interno</td>
                  <td>{result.retenciones.folioInt ?? "—"}</td>
                </tr>
                <tr>
                  <td className="font-semibold pr-2">Fecha expedición</td>
                  <td>{result.retenciones.fechaExp ?? "—"}</td>
                </tr>
                <tr>
                  <td className="font-semibold pr-2">CveRetenc</td>
                  <td>{result.retenciones.cveRetenc ?? "—"}</td>
                </tr>
                <tr>
                  <td className="font-semibold pr-2">DescRetenc</td>
                  <td>{result.retenciones.descRetenc ?? "—"}</td>
                </tr>
                <tr>
                  <td className="font-semibold pr-2">Lugar expedición</td>
                  <td>{result.retenciones.lugarExpRetenc ?? "—"}</td>
                </tr>
                <tr>
                  <td className="font-semibold pr-2">UUID</td>
                  <td>{result.retenciones.uuid ?? "—"}</td>
                </tr>
                <tr>
                  <td className="font-semibold pr-2">Fecha timbrado</td>
                  <td>{result.retenciones.fechaTimbrado ?? "—"}</td>
                </tr>
              </tbody>
            </table>
            {result.retenciones.emisor && (
              <table className="w-full text-xs border-collapse mb-3">
                <caption className="text-sm font-bold mb-1 text-left">Emisor</caption>
                <tbody>
                  <tr>
                    <td className="font-semibold pr-2" style={{ width: "200px" }}>
                      RFC
                    </td>
                    <td>{result.retenciones.emisor.rfcEmisor ?? "—"}</td>
                  </tr>
                  <tr>
                    <td className="font-semibold pr-2">Nombre</td>
                    <td>{result.retenciones.emisor.nombre ?? "—"}</td>
                  </tr>
                  <tr>
                    <td className="font-semibold pr-2">CURP</td>
                    <td>{result.retenciones.emisor.curp ?? "—"}</td>
                  </tr>
                </tbody>
              </table>
            )}
            {result.retenciones.receptor && (
              <table className="w-full text-xs border-collapse mb-3">
                <caption className="text-sm font-bold mb-1 text-left">Receptor</caption>
                <tbody>
                  <tr>
                    <td className="font-semibold pr-2" style={{ width: "200px" }}>
                      Nacionalidad
                    </td>
                    <td>{result.retenciones.receptor.nacionalidad ?? "—"}</td>
                  </tr>
                  <tr>
                    <td className="font-semibold pr-2">RFC / NumRegIdTrib</td>
                    <td>
                      {result.retenciones.receptor.rfcReceptor ??
                        result.retenciones.receptor.numRegIdTrib ??
                        "—"}
                    </td>
                  </tr>
                  <tr>
                    <td className="font-semibold pr-2">Nombre</td>
                    <td>{result.retenciones.receptor.nombre ?? "—"}</td>
                  </tr>
                  <tr>
                    <td className="font-semibold pr-2">CURP</td>
                    <td>{result.retenciones.receptor.curp ?? "—"}</td>
                  </tr>
                </tbody>
              </table>
            )}
            {result.retenciones.periodo && (
              <table className="w-full text-xs border-collapse mb-3">
                <caption className="text-sm font-bold mb-1 text-left">Periodo</caption>
                <tbody>
                  <tr>
                    <td className="font-semibold pr-2" style={{ width: "200px" }}>
                      Mes inicial
                    </td>
                    <td>{result.retenciones.periodo.mesIni ?? "—"}</td>
                  </tr>
                  <tr>
                    <td className="font-semibold pr-2">Mes final</td>
                    <td>{result.retenciones.periodo.mesFin ?? "—"}</td>
                  </tr>
                  <tr>
                    <td className="font-semibold pr-2">Ejercicio</td>
                    <td>{result.retenciones.periodo.ejercicio ?? "—"}</td>
                  </tr>
                </tbody>
              </table>
            )}
            {result.retenciones.totales && (
              <>
                <table className="w-full text-xs border-collapse mb-3">
                  <caption className="text-sm font-bold mb-1 text-left">Totales</caption>
                  <tbody>
                    <tr>
                      <td className="font-semibold pr-2" style={{ width: "200px" }}>
                        Monto total operación
                      </td>
                      <td>{result.retenciones.totales.montoTotOperacion ?? "—"}</td>
                    </tr>
                    <tr>
                      <td className="font-semibold pr-2">Monto total gravado</td>
                      <td>{result.retenciones.totales.montoTotGrav ?? "—"}</td>
                    </tr>
                    <tr>
                      <td className="font-semibold pr-2">Monto total exento</td>
                      <td>{result.retenciones.totales.montoTotExent ?? "—"}</td>
                    </tr>
                    <tr>
                      <td className="font-semibold pr-2">Monto total retenido</td>
                      <td>{result.retenciones.totales.montoTotRet ?? "—"}</td>
                    </tr>
                  </tbody>
                </table>
                {result.retenciones.totales.impuestosRetenidos.length > 0 && (
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
                        {result.retenciones.totales.impuestosRetenidos.map((ir, i) => (
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

        {result.addenda?.detected && (
          <>
            <div className="print-report-break"></div>
            <h3 className="text-lg font-bold mt-4 mb-2">Addenda</h3>
            <table className="w-full text-xs border-collapse mb-3">
              <tbody>
                <tr>
                  <td className="font-semibold pr-2" style={{ width: "200px" }}>
                    Detectada
                  </td>
                  <td>Sí</td>
                </tr>
                <tr>
                  <td className="font-semibold pr-2">Root keys</td>
                  <td>{result.addenda.rootKeys.join(", ")}</td>
                </tr>
                <tr>
                  <td className="font-semibold pr-2">Node count</td>
                  <td>{result.addenda.nodeCount}</td>
                </tr>
                <tr>
                  <td className="font-semibold pr-2">Max depth</td>
                  <td>{result.addenda.maxDepth}</td>
                </tr>
                <tr>
                  <td className="font-semibold pr-2">Truncada</td>
                  <td>{result.addenda.truncated ? "Sí" : "No"}</td>
                </tr>
                <tr>
                  <td className="font-semibold pr-2">Señales</td>
                  <td>{result.addenda.signals.length}</td>
                </tr>
              </tbody>
            </table>
            {result.addenda.signals.length > 0 && (
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
                    {result.addenda.signals.map((s, i) => (
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
            {result.addenda.nodeSummary.length > 0 && (
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
                    {result.addenda.nodeSummary.map((ns, i) => (
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

        {result.concepts && result.concepts.length > 0 && (
          <div className="avoid-break">
            <h2>Conceptos ({result.concepts.length})</h2>
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
                {result.concepts.map((c, i) => (
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

        {result.taxSummary && (
          <div className="avoid-break">
            <h2>Resumen de impuestos</h2>
            {result.taxSummary.transferred.length > 0 && (
              <div style={{ marginBottom: "8px" }}>
                <p style={{ fontWeight: 600, fontSize: "10px", margin: "0 0 4px" }}>Trasladados</p>
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
                    {result.taxSummary.transferred.map((t, i) => (
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
            {result.taxSummary.retained.length > 0 && (
              <div>
                <p style={{ fontWeight: 600, fontSize: "10px", margin: "0 0 4px" }}>Retenidos</p>
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
                    {result.taxSummary.retained.map((r2, i) => (
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

        {result.totalsValidation && (
          <div className="avoid-break">
            <h2>Validación de totales</h2>
            <div style={{ marginBottom: "8px" }}>
              <span className={result.totalsValidation.matches ? "badge-ok" : "badge-critical"}>
                {result.totalsValidation.matches
                  ? "Totales consistentes"
                  : "Diferencias detectadas"}
              </span>
            </div>
            <table>
              <tbody>
                <tr>
                  <td style={{ fontWeight: 600, width: "240px" }}>Subtotal XML</td>
                  <td>{result.totalsValidation.subtotalXml ?? "—"}</td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 600 }}>Subtotal calculado</td>
                  <td>{result.totalsValidation.subtotalCalculated ?? "—"}</td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 600 }}>Descuento calculado</td>
                  <td>{result.totalsValidation.discountCalculated ?? "—"}</td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 600 }}>Impuestos trasladados XML</td>
                  <td>{result.totalsValidation.transferredTaxesXml ?? "—"}</td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 600 }}>Impuestos trasladados calculados</td>
                  <td>{result.totalsValidation.transferredTaxesCalculated ?? "—"}</td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 600 }}>Impuestos retenidos XML</td>
                  <td>{result.totalsValidation.retainedTaxesXml ?? "—"}</td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 600 }}>Impuestos retenidos calculados</td>
                  <td>{result.totalsValidation.retainedTaxesCalculated ?? "—"}</td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 600 }}>Total XML</td>
                  <td style={{ fontWeight: 600 }}>{result.totalsValidation.totalXml ?? "—"}</td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 600 }}>Total calculado</td>
                  <td style={{ fontWeight: 600 }}>
                    {result.totalsValidation.totalCalculated ?? "—"}
                  </td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 600 }}>Diferencia</td>
                  <td
                    style={{
                      color: result.totalsValidation.matches ? "#065f46" : "#991b1b",
                      fontWeight: 600,
                    }}
                  >
                    {result.totalsValidation.difference ?? "—"}
                  </td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 600 }}>Tolerancia</td>
                  <td>{result.totalsValidation.tolerance}</td>
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
}
