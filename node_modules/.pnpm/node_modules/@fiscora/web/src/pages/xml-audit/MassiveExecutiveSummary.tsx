import { useMemo } from "react";
import type { ZipFullAnalysisResult, ZipFullAnalysisFileResult } from "../../api/xml-audit";
import {
  aggregateMassivePerformance,
  aggregateMassiveTotals,
  aggregateMassivePriorities,
  aggregateMassiveActionGroups,
  getTopFindingCodes,
  aggregateMassiveModulesCoverage,
  getTopAffectedFiles,
  type PriorityCounts,
} from "./massiveAggregates";
import AggregateRemediationPlan from "./AggregateRemediationPlan";
import ExecutiveSummaryActions from "./ExecutiveSummaryActions";

interface MassiveExecutiveSummaryProps {
  fullAnalysisResult: ZipFullAnalysisResult;
  onOpenDetail: (file: ZipFullAnalysisFileResult) => void;
}

export default function MassiveExecutiveSummary({
  fullAnalysisResult,
  onOpenDetail,
}: MassiveExecutiveSummaryProps) {
  const perfAgg = aggregateMassivePerformance(fullAnalysisResult.results);
  const totals = aggregateMassiveTotals(fullAnalysisResult.results);
  const priorities = aggregateMassivePriorities(fullAnalysisResult.results);
  const actionGroups = aggregateMassiveActionGroups(fullAnalysisResult.results);
  const topFindings = getTopFindingCodes(fullAnalysisResult.results, 10);
  const modulesCov = aggregateMassiveModulesCoverage(fullAnalysisResult.results);
  const affectedFiles = getTopAffectedFiles(fullAnalysisResult.results, 10);

  const remediationSources = useMemo(() => {
    return fullAnalysisResult.results
      .filter(
        (r) => r.status === "ANALYZED" && r.analysis?.findings && r.analysis.findings.length > 0,
      )
      .map((r, index) => ({
        fileId: String(index),
        filename: r.name,
        status: r.status,
        riskLevel: r.analysis?.executiveSummary?.riskLevel,
        documentKind:
          r.analysis?.documentKind || r.analysis?.analysisMeta?.coverage?.documentKind || "UNKNOWN",
        findings: r.analysis!.findings!,
      }));
  }, [fullAnalysisResult.results]);

  return (
    <div className="space-y-4 mt-4">
      <h3 className="font-semibold text-sm">Resumen ejecutivo del ZIP</h3>

      <div className="grid grid-cols-4 gap-3">
        <div className="p-3 rounded-lg border border-border bg-card text-center">
          <p className="text-2xl font-bold text-emerald-600">{totals.analyzed}</p>
          <p className="text-xs text-muted-foreground">XMLs analizados</p>
        </div>
        <div className="p-3 rounded-lg border border-border bg-card text-center">
          <p className="text-2xl font-bold text-red-600">{totals.failed}</p>
          <p className="text-xs text-muted-foreground">Fallidos</p>
        </div>
        <div className="p-3 rounded-lg border border-border bg-card text-center">
          <p className="text-2xl font-bold text-red-600">{totals.withCritical}</p>
          <p className="text-xs text-muted-foreground">Con críticos</p>
        </div>
        <div className="p-3 rounded-lg border border-border bg-card text-center">
          <p className="text-2xl font-bold text-yellow-600">{totals.withWarning}</p>
          <p className="text-xs text-muted-foreground">Con advertencias</p>
        </div>
        <div className="p-3 rounded-lg border border-border bg-card text-center">
          <p className="text-2xl font-bold text-red-600">{priorities.BLOCKER}</p>
          <p className="text-xs text-muted-foreground">Bloqueantes</p>
        </div>
        <div className="p-3 rounded-lg border border-border bg-card text-center">
          <p className="text-2xl font-bold text-orange-600">{priorities.HIGH}</p>
          <p className="text-xs text-muted-foreground">Alta prioridad</p>
        </div>
        <div className="p-3 rounded-lg border border-border bg-card text-center">
          <p className="text-2xl font-bold">{perfAgg ? perfAgg.avgMs : "—"}</p>
          <p className="text-xs text-muted-foreground">Tiempo promedio ms</p>
        </div>
        <div className="p-3 rounded-lg border border-border bg-card text-center">
          <p className="text-2xl font-bold text-yellow-600">
            {perfAgg ? perfAgg.filesTruncated : "—"}
          </p>
          <p className="text-xs text-muted-foreground">Con truncamiento</p>
        </div>
      </div>

      {priorities.BLOCKER + priorities.HIGH + priorities.MEDIUM + priorities.LOW > 0 && (
        <div className="p-4 rounded-xl border border-border bg-card space-y-3">
          <h4 className="font-semibold text-xs text-muted-foreground">Prioridades del ZIP</h4>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-border/50 text-muted-foreground">
                <th className="text-left py-1 pr-2 font-medium">Prioridad</th>
                <th className="text-right py-1 pr-2 font-medium">Hallazgos</th>
                <th className="text-right py-1 pr-2 font-medium">Archivos afectados</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["BLOCKER", "Bloqueante", "text-red-600"],
                ["HIGH", "Alta", "text-orange-600"],
                ["MEDIUM", "Media", "text-yellow-600"],
                ["LOW", "Informativa", "text-muted-foreground"],
              ].map(([key, label, cls]) => {
                const count = priorities[key as keyof PriorityCounts] as number;
                if (count === 0) return null;
                return (
                  <tr key={key} className="border-b border-border/30">
                    <td className={`py-1 pr-2 font-medium ${cls}`}>{label}</td>
                    <td className="py-1 pr-2 text-right font-mono">{count}</td>
                    <td className="py-1 pr-2 text-right font-mono">
                      {key === "BLOCKER"
                        ? priorities.filesWithBlocker
                        : key === "HIGH"
                          ? priorities.filesWithHigh
                          : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {actionGroups.length > 0 && (
        <div className="p-4 rounded-xl border border-border bg-card space-y-3">
          <h4 className="font-semibold text-xs text-muted-foreground">Grupos accionables</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-border/50 text-muted-foreground">
                  <th className="text-left py-1 pr-2 font-medium">Grupo</th>
                  <th className="text-right py-1 pr-2 font-medium">Hallazgos</th>
                  <th className="text-right py-1 pr-2 font-medium">Archivos afectados</th>
                  <th className="text-right py-1 pr-2 font-medium">Críticos</th>
                  <th className="text-right py-1 pr-2 font-medium">Advertencias</th>
                  <th className="text-right py-1 pr-2 font-medium">Info</th>
                </tr>
              </thead>
              <tbody>
                {actionGroups.map((g) => (
                  <tr key={g.group} className="border-b border-border/30">
                    <td className="py-1 pr-2 font-medium">{g.group}</td>
                    <td className="py-1 pr-2 text-right font-mono">{g.totalFindings}</td>
                    <td className="py-1 pr-2 text-right font-mono">{g.affectedFiles.length}</td>
                    <td className="py-1 pr-2 text-right font-mono text-red-600">
                      {g.criticalCount}
                    </td>
                    <td className="py-1 pr-2 text-right font-mono text-yellow-600">
                      {g.warningCount}
                    </td>
                    <td className="py-1 pr-2 text-right font-mono text-muted-foreground">
                      {g.infoCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

{/* NEW SECTION: Remediation Plan */}
       {remediationSources.length > 0 && (
         <AggregateRemediationPlan
           sources={remediationSources}
           title="Plan de acción del ZIP"
           onOpenSource={(fileId) => {
             const file = fullAnalysisResult.results[parseInt(fileId, 10)];
             if (file) onOpenDetail(file);
           }}
         />
       )}

       {/* Executive Summary Actions */}
       <div className="flex justify-end">
         <ExecutiveSummaryActions mode="zip" zipResult={fullAnalysisResult} />
       </div>

      {topFindings.length > 0 && (
        <div className="p-4 rounded-xl border border-border bg-card space-y-3">
          <h4 className="font-semibold text-xs text-muted-foreground">Top hallazgos</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-border/50 text-muted-foreground">
                  <th className="text-left py-1 pr-2 font-medium">Código</th>
                  <th className="text-left py-1 pr-2 font-medium">Título</th>
                  <th className="text-center py-1 pr-2 font-medium">Severidad</th>
                  <th className="text-center py-1 pr-2 font-medium">Prioridad</th>
                  <th className="text-right py-1 pr-2 font-medium">Apariciones</th>
                  <th className="text-right py-1 pr-2 font-medium">Archivos afectados</th>
                </tr>
              </thead>
              <tbody>
                {topFindings.map((f) => (
                  <tr key={f.code} className="border-b border-border/30">
                    <td className="py-1 pr-2 font-mono max-w-[120px] truncate" title={f.code}>
                      {f.code}
                    </td>
                    <td className="py-1 pr-2 max-w-[200px] truncate" title={f.title}>
                      {f.title}
                    </td>
                    <td className="py-1 pr-2 text-center">
                      <span
                        className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${f.maxSeverity === "CRITICAL" ? "bg-red-100 text-red-700" : f.maxSeverity === "WARNING" ? "bg-yellow-100 text-yellow-700" : "bg-blue-100 text-blue-700"}`}
                      >
                        {f.maxSeverity}
                      </span>
                    </td>
                    <td className="py-1 pr-2 text-center">
                      <span
                        className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${f.maxPriority === "BLOCKER" ? "bg-red-100 text-red-700" : f.maxPriority === "HIGH" ? "bg-orange-100 text-orange-700" : f.maxPriority === "MEDIUM" ? "bg-yellow-100 text-yellow-700" : "bg-gray-100 text-gray-500"}`}
                      >
                        {f.maxPriority}
                      </span>
                    </td>
                    <td className="py-1 pr-2 text-right font-mono">{f.totalAppearances}</td>
                    <td className="py-1 pr-2 text-right font-mono">{f.affectedFiles.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modulesCov.length > 0 && (
        <div className="p-4 rounded-xl border border-border bg-card space-y-3">
          <h4 className="font-semibold text-xs text-muted-foreground">Cobertura por módulo</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-border/50 text-muted-foreground">
                  <th className="text-left py-1 pr-2 font-medium">Módulo</th>
                  <th className="text-right py-1 pr-2 font-medium">Detectado</th>
                  <th className="text-right py-1 pr-2 font-medium">Analizado</th>
                  <th className="text-right py-1 pr-2 font-medium">Hallazgos</th>
                  <th className="text-right py-1 pr-2 font-medium">Archivos con hallazgos</th>
                  <th className="text-left py-1 pr-2 font-medium">Motivo omisión principal</th>
                </tr>
              </thead>
              <tbody>
                {modulesCov.map((m) => (
                  <tr key={m.moduleKey} className="border-b border-border/30">
                    <td className="py-1 pr-2 font-medium">{m.moduleLabel}</td>
                    <td className="py-1 pr-2 text-right font-mono">{m.detectedIn}</td>
                    <td className="py-1 pr-2 text-right font-mono">{m.analyzedIn}</td>
                    <td className="py-1 pr-2 text-right font-mono">{m.totalFindings}</td>
                    <td className="py-1 pr-2 text-right font-mono">{m.filesWithFindings}</td>
                    <td className="py-1 pr-2 text-muted-foreground italic text-xs max-w-[180px] truncate">
                      {m.skippedReasons.length > 0 ? m.skippedReasons[0] : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {perfAgg && (
        <div className="p-4 rounded-xl border border-border bg-card space-y-3">
          <h4 className="font-semibold text-xs text-muted-foreground">Performance</h4>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <div className="flex justify-between py-1 border-b border-border/50">
              <span className="text-muted-foreground">Tiempo total</span>
              <span className="font-medium">{perfAgg.totalMs} ms</span>
            </div>
            <div className="flex justify-between py-1 border-b border-border/50">
              <span className="text-muted-foreground">Promedio por XML</span>
              <span className="font-medium">{perfAgg.avgMs} ms</span>
            </div>
            <div className="flex justify-between py-1 border-b border-border/50">
              <span className="text-muted-foreground">XML más lento</span>
              <span className="font-medium font-mono text-xs">
                {perfAgg.maxMsFile} ({perfAgg.maxMs} ms)
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-border/50">
              <span className="text-muted-foreground">XML más rápido</span>
              <span className="font-medium font-mono text-xs">
                {perfAgg.minMsFile} ({perfAgg.minMs} ms)
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-border/50">
              <span className="text-muted-foreground">Tamaño total analizado</span>
              <span className="font-medium">{perfAgg.totalKb} KB</span>
            </div>
            <div className="flex justify-between py-1 border-b border-border/50">
              <span className="text-muted-foreground">Tamaño promedio por XML</span>
              <span className="font-medium">{perfAgg.avgKb} KB</span>
            </div>
            <div className="flex justify-between py-1 border-b border-border/50">
              <span className="text-muted-foreground">Hallazgos originales totales</span>
              <span className="font-medium">{perfAgg.totalFindingsOriginal}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-border/50">
              <span className="text-muted-foreground">Hallazgos devueltos totales</span>
              <span className="font-medium">{perfAgg.totalFindingsReturned}</span>
            </div>
          </div>
        </div>
      )}

      {affectedFiles.length > 0 && (
        <div className="p-4 rounded-xl border border-border bg-card space-y-3">
          <h4 className="font-semibold text-xs text-muted-foreground">Archivos más afectados</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-border/50 text-muted-foreground">
                  <th className="text-left py-1 pr-2 font-medium">Archivo</th>
                  <th className="text-right py-1 pr-2 font-medium">Hallazgos</th>
                  <th className="text-right py-1 pr-2 font-medium">Críticos</th>
                  <th className="text-right py-1 pr-2 font-medium">Advertencias</th>
                  <th className="text-center py-1 pr-2 font-medium">Prioridad máxima</th>
                  <th className="text-left py-1 pr-2 font-medium">Acción principal</th>
                  <th className="text-center py-1 pr-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {affectedFiles.map((af, i) => (
                  <tr key={i} className="border-b border-border/30">
                    <td className="py-1 pr-2 font-mono max-w-[160px] truncate" title={af.file.name}>
                      {af.file.name}
                    </td>
                    <td className="py-1 pr-2 text-right font-mono">{af.totalFindings}</td>
                    <td className="py-1 pr-2 text-right font-mono text-red-600">{af.criticals}</td>
                    <td className="py-1 pr-2 text-right font-mono text-yellow-600">
                      {af.warnings}
                    </td>
                    <td className="py-1 pr-2 text-center">
                      <span
                        className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${af.maxPriority === "BLOCKER" ? "bg-red-100 text-red-700" : af.maxPriority === "HIGH" ? "bg-orange-100 text-orange-700" : af.maxPriority === "MEDIUM" ? "bg-yellow-100 text-yellow-700" : "bg-gray-100 text-gray-500"}`}
                      >
                        {af.maxPriority}
                      </span>
                    </td>
                    <td
                      className="py-1 pr-2 text-xs max-w-[140px] truncate"
                      title={af.topActionGroup}
                    >
                      {af.topActionGroup}
                    </td>
                    <td className="py-1 pr-2 text-center">
                      <button
                        onClick={() => onOpenDetail(af.file)}
                        className="text-primary font-semibold hover:underline text-xs"
                      >
                        Ver detalle
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
