import { useMemo } from "react";
import type { AnalysisResult, ZipFullAnalysisFileResult } from "../../api/xml-audit";
import {
  buildCoverageSummary,
  buildModuleCoverageRows,
  buildPayloadPolicySummary,
  buildUnknownComplementsSummary,
  aggregateZipCoverage,
  getConfidenceBand,
  getConfidenceLabel,
  getConfidenceDescription,
} from "./coverageConfidence.helpers";

interface CoverageConfidencePanelProps {
  result?: AnalysisResult | ZipFullAnalysisFileResult;
  zipFiles?: ZipFullAnalysisFileResult[];
  compact?: boolean;
  title?: string;
  showPayloadPolicy?: boolean;
  showUnknownComplements?: boolean;
  showModuleTable?: boolean;
}

const BAND_STYLES: Record<string, string> = {
  high: "text-emerald-700 bg-emerald-50 border-emerald-200",
  good: "text-blue-700 bg-blue-50 border-blue-200",
  partial: "text-yellow-700 bg-yellow-50 border-yellow-200",
  limited: "text-red-700 bg-red-50 border-red-200",
};

export default function CoverageConfidencePanel({
  result,
  zipFiles,
  compact,
  title,
  showPayloadPolicy = true,
  showUnknownComplements = true,
  showModuleTable = true,
}: CoverageConfidencePanelProps) {
  const summary = useMemo(() => {
    if (!result && !zipFiles) return null;

    if (zipFiles && zipFiles.length > 0) {
      const agg = aggregateZipCoverage(zipFiles);
      const findings = zipFiles.flatMap((f) => f.analysis?.findings ?? []);
      const findingsByModule = findings.reduce(
        (acc, f) => {
          const mod = f.location?.module ?? "unknown";
          acc[mod] = (acc[mod] ?? 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      );

      return {
        totalModules: 0,
        detectedModules: 0,
        analyzedModules: 0,
        skippedModules: 0,
        modulesWithFindings: Object.keys(findingsByModule).length,
        modulesWithoutFindings: 0,
        unknownModules: 0,
        totalFindings: findings.length,
        findingsByModule,
        confidenceScore: agg.avgConfidence,
      };
    }

    const analysis = result as AnalysisResult;
    const findings = analysis.findings ?? [];

    return buildCoverageSummary(
      analysis.analysisMeta,
      findings,
      analysis.structureDiagnostics,
      analysis.payloadPolicy,
      false,
    );
  }, [result, zipFiles]);

  const payload = useMemo(() => {
    if (!result || zipFiles) return null;
    const analysis = result as AnalysisResult;
    return buildPayloadPolicySummary(analysis.payloadPolicy, analysis.analysisMeta?.performance);
  }, [result, zipFiles]);

  const unknownComp = useMemo(() => {
    if (!result || zipFiles) return null;
    const analysis = result as AnalysisResult;
    return buildUnknownComplementsSummary(analysis);
  }, [result, zipFiles]);

  const rows = useMemo((): ReturnType<typeof buildModuleCoverageRows> => {
    if (!result || zipFiles) return [];
    const analysis = result as AnalysisResult;
    return buildModuleCoverageRows(analysis.analysisMeta, analysis.findings ?? []);
  }, [result, zipFiles]);

  const band = summary ? getConfidenceBand(summary.confidenceScore) : "limited";

  if (!summary) return null;

  return (
    <div className={`rounded-xl border border-border bg-card ${compact ? "p-4" : "p-6"} space-y-4`}>
      {title && <h3 className="font-semibold text-sm">{title}</h3>}

      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <span className={`text-3xl font-bold ${BAND_STYLES[band].split(" ")[0]}`}>
            {summary.confidenceScore}
          </span>
          <div>
            <span
              className={`inline-block text-xs font-bold px-2.5 py-1 rounded-full border ${BAND_STYLES[band]}`}
            >
              {getConfidenceLabel(band)}
            </span>
            <p className="text-xs text-muted-foreground mt-1">{getConfidenceDescription(band)}</p>
          </div>
        </div>
      </div>

      {!compact && (
        <>
          <div className="flex flex-wrap gap-3 text-xs">
            <span className="px-2.5 py-1 rounded-full bg-muted border border-border text-muted-foreground">
              Módulos detectados: {summary.detectedModules || summary.modulesWithFindings}
            </span>
            <span className="px-2.5 py-1 rounded-full bg-muted border border-border text-muted-foreground">
              Módulos analizados: {summary.analyzedModules || summary.modulesWithFindings}
            </span>
            {payload?.findingsTruncated && (
              <span className="px-2.5 py-1 rounded-full bg-yellow-50 border border-yellow-200 text-yellow-700">
                Hallazgos truncados
              </span>
            )}
          </div>

          {showModuleTable && rows.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Cobertura por módulo
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-border/50 text-muted-foreground">
                      <th className="text-left py-1 pr-1">Módulo</th>
                      <th className="text-left py-1 pr-1">Detectado</th>
                      <th className="text-left py-1 pr-1">Analizado</th>
                      <th className="text-left py-1 pr-1">Hallazgos</th>
                      <th className="text-left py-1 pr-1">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.module} className="border-b border-border/30">
                        <td className="py-1 pr-1 font-medium">{r.label}</td>
                        <td className="py-1 pr-1">{r.detected ? "Sí" : "No"}</td>
                        <td className="py-1 pr-1">{r.analyzed ? "Sí" : "No"}</td>
                        <td className="py-1 pr-1">
                          {r.findingsCount > 0 ? (
                            <span>
                              {r.findingsCount}
                              {r.criticalCount > 0 && (
                                <span className="text-red-600 ml-1">({r.criticalCount})</span>
                              )}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="py-1 pr-1 text-muted-foreground">
                          {r.analyzed ? "Analizado" : r.skippedReason ? "Omitido" : "No aplica"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {showPayloadPolicy && payload && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Política de payload
              </p>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="px-2 py-0.5 rounded bg-muted/50">XML fuente: excluido</span>
                <span className="px-2 py-0.5 rounded bg-muted/50">Evidence sanitizado</span>
                {payload.findingsTruncated && (
                  <span className="px-2 py-0.5 rounded bg-yellow-50 text-yellow-700">
                    Findings truncados
                  </span>
                )}
              </div>
            </div>
          )}

          {showUnknownComplements && unknownComp && unknownComp.unknown.length > 0 && (
            <div className="p-3 rounded-lg border border-yellow-200 bg-yellow-50 space-y-1.5">
              <p className="text-xs font-semibold text-yellow-800">Complementos no clasificados</p>
              <p className="text-xs text-yellow-700">{unknownComp.unknown.join(", ")}</p>
              <p className="text-[10px] text-yellow-600">
                Estos complementos fueron detectados, pero no cuentan aún con análisis
                especializado.
              </p>
            </div>
          )}
        </>
      )}

      {compact && zipFiles && (
        <div className="text-xs text-muted-foreground">
          {unknownComp && unknownComp.unknown.length > 0 && (
            <span>Complementos desconocidos: {unknownComp.unknown.length}</span>
          )}
        </div>
      )}
    </div>
  );
}
