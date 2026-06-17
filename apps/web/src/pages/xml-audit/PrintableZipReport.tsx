import type { ZipFullAnalysisResult } from "../../api/xml-audit";
import {
  aggregateMassiveTotals,
  aggregateMassivePriorities,
  aggregateMassiveActionGroups,
  getTopFindingCodes,
  aggregateMassiveDocumentKinds,
  aggregateMassiveModulesCoverage,
  aggregateMassivePerformance,
  getTopAffectedFiles,
} from "./massiveAggregates";
import { getPriorityLabel } from "./findingPriority";

interface Props {
  fullAnalysisResult: ZipFullAnalysisResult;
}

export default function PrintableZipReport({ fullAnalysisResult }: Props) {
  const r = fullAnalysisResult;
  const totals = aggregateMassiveTotals(r.results);
  const priorities = aggregateMassivePriorities(r.results);
  const actionGroups = aggregateMassiveActionGroups(r.results);
  const topFindings = getTopFindingCodes(r.results, 10);
  const docKinds = aggregateMassiveDocumentKinds(r.results);
  const modulesCov = aggregateMassiveModulesCoverage(r.results);
  const perf = aggregateMassivePerformance(r.results);
  const affectedFiles = getTopAffectedFiles(r.results, 15);
  const totalAnalyzed = totals.analyzed + totals.failed;
  return (
    <div className="print-report-zip hidden">
      <div style={{ padding: "32px 40px 24px", maxWidth: "800px", margin: "0 auto", fontFamily: "Arial, Helvetica, sans-serif" }}>
        <h1>Reporte ZIP — Análisis masivo Fiscora</h1>
        <p style={{ margin: "2px 0 16px", fontSize: 10, color: "#888" }}>
          Generado el {new Date().toISOString()} &mdash; {r.xmlFilesFound} archivos encontrados, {r.analyzedCount} analizados
        </p>

        <h2>Resumen general</h2>
        <div className="meta-grid">
          <div className="meta-item"><span className="meta-label">Archivos encontrados</span><span className="meta-value">{r.xmlFilesFound}</span></div>
          <div className="meta-item"><span className="meta-label">Analizados</span><span className="meta-value">{totals.analyzed}</span></div>
          <div className="meta-item"><span className="meta-label">Fallidos</span><span className="meta-value">{totals.failed}</span></div>
          <div className="meta-item"><span className="meta-label">Sin hallazgos</span><span className="meta-value">{totals.ok}</span></div>
          <div className="meta-item"><span className="meta-label">Con críticos</span><span className="meta-value">{totals.withCritical}</span></div>
          <div className="meta-item"><span className="meta-label">Con warnings</span><span className="meta-value">{totals.withWarning}</span></div>
          <div className="meta-item"><span className="meta-label">Con BOM</span><span className="meta-value">{totals.withBom}</span></div>
          <div className="meta-item"><span className="meta-label">Normalización técnica</span><span className="meta-value">{totals.withTechNorm}</span></div>
          <div className="meta-item"><span className="meta-label">XML normalizado disponible</span><span className="meta-value">{totals.withNormXml}</span></div>
          <div className="meta-item"><span className="meta-label">XMLs con hallazgos bloqueantes</span><span className="meta-value">{priorities.filesWithBlocker}</span></div>
          <div className="meta-item"><span className="meta-label">XMLs con prioridad alta</span><span className="meta-value">{priorities.filesWithHigh}</span></div>
        </div>

        <h2>Prioridades</h2>
        <table>
          <thead><tr><th>Prioridad</th><th>Hallazgos</th><th>Archivos afectados</th></tr></thead>
          <tbody>
            <tr><td><span className="badge-critical">Bloqueante</span></td><td>{priorities.BLOCKER}</td><td>{priorities.filesWithBlocker}</td></tr>
            <tr><td><span className="badge-warning">Alta</span></td><td>{priorities.HIGH}</td><td>{priorities.filesWithHigh}</td></tr>
            <tr><td><span className="badge-info">Media</span></td><td>{priorities.MEDIUM}</td><td>—</td></tr>
            <tr><td><span className="badge-ok">Informativa</span></td><td>{priorities.LOW}</td><td>—</td></tr>
          </tbody>
        </table>

        {actionGroups.length > 0 && (
          <>
            <h2>Grupos accionables</h2>
            <table>
              <thead><tr><th>Grupo</th><th>Hallazgos</th><th>Críticos</th><th>Warnings</th><th>Informativos</th><th>Archivos</th></tr></thead>
              <tbody>
                {actionGroups.map((g) => (
                  <tr key={g.group}>
                    <td style={{ fontWeight: 600 }}>{g.group}</td>
                    <td>{g.totalFindings}</td>
                    <td>{g.criticalCount > 0 ? <span className="badge-critical">{g.criticalCount}</span> : "0"}</td>
                    <td>{g.warningCount > 0 ? <span className="badge-warning">{g.warningCount}</span> : "0"}</td>
                    <td>{g.infoCount}</td>
                    <td>{g.affectedFiles.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {topFindings.length > 0 && (
          <>
            <h2>Top hallazgos más frecuentes</h2>
            <table>
              <thead><tr><th>Código</th><th>Título</th><th>Severidad</th><th>Prioridad</th><th>Frecuencia</th><th>Archivos</th></tr></thead>
              <tbody>
                {topFindings.map((f) => (
                  <tr key={f.code}>
                    <td style={{ fontFamily: "monospace", fontSize: 9 }}>{f.code}</td>
                    <td>{f.title}</td>
                    <td>{f.maxSeverity === "CRITICAL" ? <span className="badge-critical">CRITICAL</span> : f.maxSeverity === "WARNING" ? <span className="badge-warning">WARNING</span> : <span className="badge-info">INFO</span>}</td>
                    <td>{getPriorityLabel(f.maxPriority)}</td>
                    <td>{f.totalAppearances}</td>
                    <td>{f.affectedFiles.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {r.summary?.byTipoComprobante && Object.keys(r.summary.byTipoComprobante).length > 0 && (
          <>
            <h2>Tipos de comprobante</h2>
            <table>
              <thead><tr><th>Tipo</th><th>Cantidad</th><th>Porcentaje</th></tr></thead>
              <tbody>
                {Object.entries(r.summary.byTipoComprobante).map(([tipo, count]) => {
                  const pct = totalAnalyzed > 0 ? ((count / totalAnalyzed) * 100).toFixed(1) : "0.0";
                  return <tr key={tipo}><td>{tipo}</td><td>{count}</td><td>{pct}%</td></tr>;
                })}
              </tbody>
            </table>
          </>
        )}

        <h2>Tipos de documento analizados</h2>
        {(() => {
          const totalDK = docKinds.CFDI + docKinds.RETENCIONES + docKinds.UNKNOWN;
          const pct = (v: number) => totalDK > 0 ? ((v / totalDK) * 100).toFixed(1) : "0.0";
          return (
            <table>
              <thead><tr><th>Tipo</th><th>Cantidad</th><th>Porcentaje</th></tr></thead>
              <tbody>
                <tr><td>CFDI</td><td>{docKinds.CFDI}</td><td>{pct(docKinds.CFDI)}%</td></tr>
                <tr><td>RETENCIONES</td><td>{docKinds.RETENCIONES}</td><td>{pct(docKinds.RETENCIONES)}%</td></tr>
                <tr><td>Desconocido</td><td>{docKinds.UNKNOWN}</td><td>{pct(docKinds.UNKNOWN)}%</td></tr>
              </tbody>
            </table>
          );
        })()}

        {modulesCov.length > 0 && (
          <>
            <h2>Cobertura por módulo de análisis</h2>
            <table>
              <thead><tr><th>Módulo</th><th>Detectado en</th><th>Analizado en</th><th>Hallazgos totales</th><th>Archivos con hallazgos</th></tr></thead>
              <tbody>
                {modulesCov.map((m) => (
                  <tr key={m.moduleKey}>
                    <td>{m.moduleLabel}</td>
                    <td>{m.detectedIn}</td>
                    <td>{m.analyzedIn}</td>
                    <td>{m.totalFindings}</td>
                    <td>{m.filesWithFindings}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {perf && (
          <>
            <h2>Rendimiento del análisis</h2>
            <table>
              <thead><tr><th>Métrica</th><th>Valor</th></tr></thead>
              <tbody>
                <tr><td>Tiempo total</td><td>{(perf.totalMs / 1000).toFixed(2)}s</td></tr>
                <tr><td>Tiempo promedio por archivo</td><td>{perf.avgMs}ms</td></tr>
                <tr><td>Tiempo máximo</td><td>{perf.maxMs}ms ({perf.maxMsFile})</td></tr>
                <tr><td>Tiempo mínimo</td><td>{perf.minMs}ms ({perf.minMsFile})</td></tr>
                <tr><td>Total KB procesados</td><td>{perf.totalKb.toFixed(0)} KB</td></tr>
                <tr><td>Promedio KB por archivo</td><td>{perf.avgKb.toFixed(0)} KB</td></tr>
                <tr><td>Hallazgos originales</td><td>{perf.totalFindingsOriginal}</td></tr>
                <tr><td>Hallazgos retornados</td><td>{perf.totalFindingsReturned}</td></tr>
                <tr><td>Archivos con truncamiento</td><td>{perf.filesTruncated > 0 ? <span className="badge-warning">{perf.filesTruncated}</span> : "0"}</td></tr>
              </tbody>
            </table>
          </>
        )}

        {affectedFiles.length > 0 && (
          <>
            <h2>Archivos más afectados</h2>
            <table>
              <thead><tr><th>#</th><th>Archivo</th><th>Hallazgos</th><th>Críticos</th><th>Warnings</th><th>Prioridad máxima</th><th>Grupo principal</th></tr></thead>
              <tbody>
                {affectedFiles.map((af, i) => (
                  <tr key={af.file.name}>
                    <td>{i + 1}</td>
                    <td style={{ fontFamily: "monospace", fontSize: 9, wordBreak: "break-all" }}>{af.file.name}</td>
                    <td>{af.totalFindings}</td>
                    <td>{af.criticals > 0 ? <span className="badge-critical">{af.criticals}</span> : "0"}</td>
                    <td>{af.warnings > 0 ? <span className="badge-warning">{af.warnings}</span> : "0"}</td>
                    <td><span className={`badge-${af.maxPriority === "BLOCKER" ? "critical" : af.maxPriority === "HIGH" ? "warning" : "info"}`}>{getPriorityLabel(af.maxPriority)}</span></td>
                    <td>{af.topActionGroup}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        <div className="footer">
          <p style={{ margin: 0 }}>Generado por Fiscora / ConSafeDev</p>
          <p style={{ margin: "4px 0 0" }}>No se almacenan los XML fuente en este reporte. Datos sensibles redactados.</p>
          <p style={{ margin: "4px 0 0" }}>{new Date().toISOString()}</p>
        </div>
      </div>
    </div>
  );
}
