import { useState, useMemo, useCallback } from "react";
import type { ZipFullAnalysisResult, ZipFullAnalysisFileResult } from "../../api/xml-audit";
import {
  calculateZipRiskScore,
  calculateRiskScore,
  getRiskBandLabel,
  getRiskBandStyles,
} from "./riskScore.helpers";
import {
  buildZipQuickFilters,
  filterZipFiles,
  sortZipFiles,
  getZipFileTopModules,
  type ZipFilters,
  type ZipSortMode,
} from "./auditNavigation.helpers";
import RiskScorePanel from "./RiskScorePanel";

interface ZipRiskNavigatorProps {
  fullAnalysisResult: ZipFullAnalysisResult;
  onOpenDetail: (file: ZipFullAnalysisFileResult) => void;
}

const chipClass = (active: boolean) =>
  active
    ? "bg-foreground text-background border-foreground"
    : "bg-transparent text-muted-foreground border-border hover:border-foreground hover:text-foreground";

const ZIP_SORT_LABELS: Record<ZipSortMode, string> = {
  "score-asc": "Menor score",
  "score-desc": "Mayor score",
  "critical-desc": "Más críticos",
  "warning-desc": "Más advertencias",
  name: "Nombre",
  status: "Estado",
};

export default function ZipRiskNavigator({ fullAnalysisResult, onOpenDetail }: ZipRiskNavigatorProps) {
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortMode, setSortMode] = useState<ZipSortMode>("score-asc");
  const [search, setSearch] = useState("");

  const zipScore = useMemo(() => calculateZipRiskScore(fullAnalysisResult.results), [fullAnalysisResult.results]);
  const topModules = useMemo(() => getZipFileTopModules(fullAnalysisResult.results), [fullAnalysisResult.results]);

  const filters: ZipFilters = useMemo(
    () => ({
      text: search || undefined,
      statusFilter,
      scoreMax: null,
      hasCritical: false,
      hasWarning: false,
      hasBom: false,
      hasNormalizedXml: false,
      hasTimbreError: false,
      hasTaxError: false,
      hasPaymentError: false,
      hasCartaPorteError: false,
      hasRetenciones: false,
      hasNomina: false,
    }),
    [search, statusFilter],
  );

  const filtered = useMemo(
    () => sortZipFiles(filterZipFiles(fullAnalysisResult.results, filters), sortMode),
    [fullAnalysisResult.results, filters, sortMode],
  );

  const handleQuickFilter = useCallback((key: string) => {
    setStatusFilter(key);
  }, []);

  const quickFilters = useMemo(() => buildZipQuickFilters(), []);

  return (
    <div className="space-y-4">
      <RiskScorePanel zipSummary={zipScore} files={fullAnalysisResult.results} title="Score del lote" />

      <div className="flex flex-wrap gap-1.5">
        {quickFilters.map((qf) => (
          <button
            key={qf.key}
            onClick={() => handleQuickFilter(qf.key)}
            className={`px-2.5 py-1 rounded-full border text-xs font-semibold transition-all ${chipClass(statusFilter === qf.key)}`}
          >
            {qf.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <input
          type="text"
          placeholder="Buscar archivo..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] px-3 py-1.5 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <select
          value={sortMode}
          onChange={(e) => setSortMode(e.target.value as ZipSortMode)}
          className="px-2 py-1.5 rounded border border-border bg-background text-xs"
        >
          {Object.entries(ZIP_SORT_LABELS).map(([k, l]) => (
            <option key={k} value={k}>{l}</option>
          ))}
        </select>
      </div>

      {topModules.length > 0 && (
        <div className="flex flex-wrap gap-1 text-xs text-muted-foreground">
          <span className="font-semibold">Módulos más afectados:</span>
          {topModules.map((m) => (
            <span key={m} className="px-1.5 py-0.5 rounded bg-muted/30">{m}</span>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Mostrando <strong>{filtered.length}</strong> de{" "}
        <strong>{fullAnalysisResult.results.length}</strong> archivos
      </p>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">No hay archivos para los filtros seleccionados.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-border/50 text-muted-foreground">
                <th className="text-left py-1 pr-2">#</th>
                <th className="text-left py-1 pr-2">Archivo</th>
                <th className="text-left py-1 pr-2">Score</th>
                <th className="text-left py-1 pr-2">Banda</th>
                <th className="text-left py-1 pr-2">Estado</th>
                <th className="text-left py-1 pr-2">Críticos</th>
                <th className="text-left py-1 pr-2">Advertencias</th>
                <th className="text-left py-1 pr-2">Top driver</th>
                <th className="text-left py-1 pr-2">Módulos</th>
                <th className="text-left py-1 pr-2"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => {
                const isAnalyzed = r.status === "ANALYZED";
                const sr = isAnalyzed && r.analysis?.findings
                  ? calculateRiskScore(r.analysis.findings)
                  : null;
                const fnd = isAnalyzed && r.analysis?.findings ? r.analysis.findings : [];
                const topDriver = sr
                  ? [...fnd]
                      .sort(
                        (a, b) =>
                          (b.priority === "BLOCKER" ? 100 : b.severity === "CRITICAL" ? 50 : 0) -
                          (a.priority === "BLOCKER" ? 100 : a.severity === "CRITICAL" ? 50 : 0),
                      )
                      .slice(0, 1)
                      .map((x) => x.code)[0] ?? "—"
                  : "—";
                const modules = new Set<string>();
                for (const fx of fnd) {
                  if (fx.location?.module) modules.add(fx.location.module);
                }
                const criticalCount = fnd.filter((fx) => fx.severity === "CRITICAL").length;
                const warningCount = fnd.filter((fx) => fx.severity === "WARNING").length;
                const bandStyles = sr ? getRiskBandStyles(sr.band) : "";
                return (
                  <tr key={`${r.index}-zn`} className="border-b border-border/30 hover:bg-muted/20">
                    <td className="py-1 pr-2 text-muted-foreground">{i + 1}</td>
                    <td className="py-1 pr-2 font-mono break-all max-w-[180px]">{r.name}</td>
                    <td className={`py-1 pr-2 font-bold ${bandStyles}`}>
                      {sr !== null ? `${sr.score}/100` : "—"}
                    </td>
                    <td className="py-1 pr-2">
                      {sr !== null ? (
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${bandStyles}`}>
                          {getRiskBandLabel(sr.band)}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-1 pr-2">
                      {isAnalyzed ? (
                        <span className="text-emerald-600 font-medium">Analizado</span>
                      ) : (
                        <span className="text-red-600 font-medium">Fallido</span>
                      )}
                    </td>
                    <td className="py-1 pr-2">
                      {isAnalyzed ? (
                        criticalCount > 0 ? (
                          <span className="text-red-600 font-bold">{criticalCount}</span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )
                      ) : "—"}
                    </td>
                    <td className="py-1 pr-2">
                      {isAnalyzed ? (
                        warningCount > 0 ? (
                          <span className="text-yellow-600 font-bold">{warningCount}</span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )
                      ) : "—"}
                    </td>
                    <td className="py-1 pr-2 font-mono max-w-[100px] truncate">{topDriver}</td>
                    <td className="py-1 pr-2 max-w-[120px]">
                      <div className="flex flex-wrap gap-0.5">
                        {Array.from(modules).slice(0, 2).map((m) => (
                          <span key={m} className="text-[10px] px-1 rounded bg-muted/30 text-muted-foreground">
                            {m}
                          </span>
                        ))}
                        {modules.size > 2 && (
                          <span className="text-[10px] text-muted-foreground">+{modules.size - 2}</span>
                        )}
                      </div>
                    </td>
                    <td className="py-1 pr-2">
                      <button
                        onClick={() => onOpenDetail(r)}
                        className="text-primary font-semibold hover:underline whitespace-nowrap text-xs"
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
      )}

      {zipScore.topRiskFiles.length > 0 && (
        <div className="p-4 rounded-lg border border-red-200 bg-red-50 space-y-2">
          <p className="text-xs font-bold text-red-700 uppercase tracking-wider">
            Top archivos de riesgo
          </p>
          <div className="flex flex-col gap-1.5">
            {zipScore.topRiskFiles.map((tf) => (
              <div
                key={tf.index}
                className="flex items-center justify-between text-xs"
              >
                <span className="font-mono truncate max-w-[300px]">{tf.name}</span>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${getRiskBandStyles(tf.band)}`}>
                    {tf.score}/100 · {getRiskBandLabel(tf.band)}
                  </span>
                  <button
                    onClick={() => {
                      const file = fullAnalysisResult.results.find((r) => r.index === tf.index);
                      if (file) onOpenDetail(file);
                    }}
                    className="text-primary font-semibold hover:underline"
                  >
                    Ver
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
