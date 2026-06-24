import { useMemo } from "react";
import type { Finding, ZipFullAnalysisFileResult } from "../../api/xml-audit";
import {
  calculateRiskScore,
  calculateApproximateRiskScore,
  calculateZipRiskScore,
  getRiskBandLabel,
  getRiskBandDescription,
  getRiskBandStyles,
  getTopRiskDrivers,
  aggregateRiskByModule,
  type ZipRiskScore,
  type RiskBand,
} from "./riskScore.helpers";

interface RiskScorePanelProps {
  findings?: Finding[];
  approximateCounts?: {
    criticalCount: number;
    warningCount: number;
    infoCount: number;
    priorityMax?: string | null;
  };
  zipSummary?: ZipRiskScore;
  files?: ZipFullAnalysisFileResult[];
  title?: string;
  compact?: boolean;
  showModules?: boolean;
  showDrivers?: boolean;
}

export default function RiskScorePanel({
  findings,
  approximateCounts,
  zipSummary,
  files,
  title,
  compact,
  showModules = true,
  showDrivers = true,
}: RiskScorePanelProps) {
  const result = useMemo(() => {
    if (zipSummary) return null;
    if (findings && findings.length > 0) return calculateRiskScore(findings);
    if (approximateCounts) return calculateApproximateRiskScore(approximateCounts);
    if (findings && findings.length === 0) return calculateRiskScore(findings);
    return null;
  }, [findings, approximateCounts, zipSummary]);

  const zipResult = useMemo(() => {
    if (zipSummary) return zipSummary;
    if (files && files.length > 0) return calculateZipRiskScore(files);
    return null;
  }, [zipSummary, files]);

  const drivers = useMemo(() => {
    if (!findings || findings.length === 0 || compact) return [];
    return getTopRiskDrivers(findings, compact ? 3 : 5);
  }, [findings, compact]);

  const modules = useMemo(() => {
    if (!findings || findings.length === 0 || !showModules || compact) return [];
    return aggregateRiskByModule(findings);
  }, [findings, showModules, compact]);

  const effectiveBand: RiskBand = result?.band ?? zipResult?.band ?? "HEALTHY";

  if (zipResult) {
    return (
      <div
        className={`rounded-xl border border-border bg-card ${compact ? "p-4" : "p-6"} space-y-4`}
      >
        {title && <h3 className="font-semibold text-sm">{title}</h3>}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <span
              className={`text-3xl font-bold ${getRiskBandStyles(effectiveBand).split(" ")[0]}`}
            >
              {zipResult.score}
            </span>
            <div>
              <span
                className={`inline-block text-xs font-bold px-2.5 py-1 rounded-full border ${getRiskBandStyles(effectiveBand)}`}
              >
                {getRiskBandLabel(effectiveBand)}
              </span>
              <p className="text-xs text-muted-foreground mt-1">
                {getRiskBandDescription(effectiveBand)}
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 text-xs">
          <span className="px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-medium">
            Saludables: {zipResult.healthyFiles}
          </span>
          <span className="px-2.5 py-1 rounded-full bg-yellow-50 border border-yellow-200 text-yellow-700 font-medium">
            Advertencias: {zipResult.warningFiles}
          </span>
          <span className="px-2.5 py-1 rounded-full bg-red-50 border border-red-200 text-red-700 font-medium">
            Críticos: {zipResult.criticalFiles}
          </span>
          {zipResult.failedCount > 0 && (
            <span className="px-2.5 py-1 rounded-full bg-red-50 border border-red-300 text-red-800 font-medium">
              Fallidos: {zipResult.failedCount}
            </span>
          )}
          <span className="px-2.5 py-1 rounded-full bg-muted border border-border text-muted-foreground">
            Analizados: {zipResult.analyzedCount}
          </span>
        </div>
        {zipResult.topRiskFiles.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Archivos de mayor riesgo
            </p>
            <div className="space-y-1">
              {zipResult.topRiskFiles.map((f) => (
                <div
                  key={f.index}
                  className="flex items-center justify-between text-xs py-1 px-2 rounded bg-muted/30"
                >
                  <span className="truncate font-medium">{f.name}</span>
                  <span
                    className={`shrink-0 ml-2 font-bold ${getRiskBandStyles(f.band).split(" ")[0]}`}
                  >
                    {f.score}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (!result) return null;

  return (
    <div className={`rounded-xl border border-border bg-card ${compact ? "p-4" : "p-6"} space-y-4`}>
      {title && <h3 className="font-semibold text-sm">{title}</h3>}

      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <span className={`text-4xl font-bold ${getRiskBandStyles(effectiveBand).split(" ")[0]}`}>
            {result.score}
          </span>
          <div>
            <span
              className={`inline-block text-xs font-bold px-2.5 py-1 rounded-full border ${getRiskBandStyles(effectiveBand)}`}
            >
              {getRiskBandLabel(effectiveBand)}
            </span>
            <p className="text-xs text-muted-foreground mt-1">
              {getRiskBandDescription(effectiveBand)}
            </p>
            {approximateCounts && (
              <span className="text-[10px] text-muted-foreground italic">estimado</span>
            )}
          </div>
        </div>
      </div>

      {!compact && (
        <>
          <div className="flex flex-wrap gap-3 text-xs">
            {result.criticalCount > 0 && (
              <span className="px-2.5 py-1 rounded-full bg-red-50 border border-red-200 text-red-700 font-medium">
                Críticos: {result.criticalCount}
              </span>
            )}
            {result.warningCount > 0 && (
              <span className="px-2.5 py-1 rounded-full bg-yellow-50 border border-yellow-200 text-yellow-700 font-medium">
                Advertencias: {result.warningCount}
              </span>
            )}
            {result.blockerCount > 0 && (
              <span className="px-2.5 py-1 rounded-full bg-red-50 border border-red-300 text-red-800 font-medium">
                Bloqueantes: {result.blockerCount}
              </span>
            )}
            {result.infoCount > 0 && (
              <span className="px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 font-medium">
                Informativos: {result.infoCount}
              </span>
            )}
            {result.findingsWithDifference > 0 && (
              <span className="px-2.5 py-1 rounded-full bg-purple-50 border border-purple-200 text-purple-700 font-medium">
                Con diferencia: {result.findingsWithDifference}
              </span>
            )}
            <span className="px-2.5 py-1 rounded-full bg-muted border border-border text-muted-foreground">
              Riesgo bruto: {result.rawRisk}
            </span>
          </div>

          {drivers.length > 0 && showDrivers && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Principales causas del riesgo
              </p>
              <div className="space-y-1">
                {drivers.map((d, i) => (
                  <div
                    key={d.code + i}
                    className="flex items-center justify-between gap-2 text-xs py-1.5 px-2.5 rounded bg-muted/30"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="text-muted-foreground shrink-0 w-4 text-right">
                        {i + 1}.
                      </span>
                      <span className="font-mono text-[10px] text-muted-foreground shrink-0">
                        {d.code}
                      </span>
                      <span className="truncate font-medium">{d.title}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {d.moduleLabel}
                      </span>
                    </div>
                    <span className="shrink-0 font-bold text-red-600">+{d.weight}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {modules.length > 0 && showModules && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Riesgo por módulo
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {modules.map((m) => (
                  <div
                    key={m.module}
                    className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded bg-muted/20 border border-border/40"
                  >
                    <div className="min-w-0 flex-1">
                      <span className="font-medium">{m.label}</span>
                      <span className="text-muted-foreground ml-2">
                        {m.count} hallazgo{m.count !== 1 ? "s" : ""}
                      </span>
                      {m.critical > 0 && (
                        <span className="ml-1.5 text-red-600 font-medium">
                          ({m.critical} crítico{m.critical !== 1 ? "s" : ""})
                        </span>
                      )}
                    </div>
                    <span className="shrink-0 ml-2 font-medium text-muted-foreground">
                      +{m.totalRisk}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {compact && drivers.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Principales causas
          </p>
          {drivers.slice(0, 3).map((d, i) => (
            <div
              key={d.code + i}
              className="flex items-center justify-between text-xs py-1 px-2 rounded bg-muted/30"
            >
              <span className="truncate font-medium">{d.title}</span>
              <span className="shrink-0 ml-2 font-bold text-red-600">+{d.weight}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
