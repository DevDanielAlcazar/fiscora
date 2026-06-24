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
import { getFindingModuleLabel } from "./findingExplorer.helpers";

interface ZipRiskNavigatorProps {
  fullAnalysisResult: ZipFullAnalysisResult;
  onOpenDetail: (file: ZipFullAnalysisFileResult) => void;
}

const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;
type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

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

// Memoized file row data to avoid recalculating on each render
function useFileRowData(r: ZipFullAnalysisFileResult) {
  return useMemo(() => {
    const isAnalyzed = r.status === "ANALYZED";
    const findings = isAnalyzed && r.analysis?.findings ? r.analysis.findings : [];
    const score = isAnalyzed ? calculateRiskScore(findings) : null;
    const criticalCount = findings.filter((fx) => fx.severity === "CRITICAL").length;
    const warningCount = findings.filter((fx) => fx.severity === "WARNING").length;
    const modules = new Set<string>();
    for (const fx of findings) {
      if (fx.location?.module) modules.add(fx.location.module);
    }
    let topDriver = "—";
    if (score) {
      const sorted = [...findings].sort(
        (a, b) =>
          (b.priority === "BLOCKER" ? 100 : b.severity === "CRITICAL" ? 50 : 0) -
          (a.priority === "BLOCKER" ? 100 : a.severity === "CRITICAL" ? 50 : 0),
      );
      topDriver = sorted[0]?.code ?? "—";
    }
    return {
      isAnalyzed,
      score,
      criticalCount,
      warningCount,
      modules,
      topDriver,
    };
  }, [r]);
}

export default function ZipRiskNavigator({
  fullAnalysisResult,
  onOpenDetail,
}: ZipRiskNavigatorProps) {
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortMode, setSortMode] = useState<ZipSortMode>("score-asc");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(50);

  const zipScore = useMemo(
    () => calculateZipRiskScore(fullAnalysisResult.results),
    [fullAnalysisResult.results],
  );
  const topModules = useMemo(
    () => getZipFileTopModules(fullAnalysisResult.results),
    [fullAnalysisResult.results],
  );

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

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    return {
      items: filtered.slice(start, end),
      total: filtered.length,
      totalPages: Math.ceil(filtered.length / pageSize),
    };
  }, [filtered, page, pageSize]);

  const handleQuickFilter = useCallback((key: string) => {
    setStatusFilter(key);
    setPage(1);
  }, []);

  const handlePageSizeChange = useCallback((newPageSize: PageSize) => {
    setPageSize(newPageSize);
    setPage(1);
  }, []);

  const quickFilters = useMemo(() => buildZipQuickFilters(), []);

  return (
    <div className="space-y-4" role="region" aria-label="Navegador de riesgo ZIP">
      <RiskScorePanel
        zipSummary={zipScore}
        files={fullAnalysisResult.results}
        title="Score del lote"
      />

      <div
        className="flex flex-wrap gap-1.5"
        role="toolbar"
        aria-label="Filtros rápidos por archivo"
      >
        {quickFilters.map((qf) => (
          <button
            key={qf.key}
            onClick={() => handleQuickFilter(qf.key)}
            className={`px-2.5 py-1 rounded-full border text-xs font-semibold transition-all ${chipClass(statusFilter === qf.key)}`}
            aria-pressed={statusFilter === qf.key}
          >
            {qf.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <input
          type="text"
          placeholder="Buscar archivo..."
          aria-label="Buscar archivo por nombre"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] px-3 py-1.5 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <select
          aria-label="Ordenar archivos"
          value={sortMode}
          onChange={(e) => setSortMode(e.target.value as ZipSortMode)}
          className="px-2 py-1.5 rounded border border-border bg-background text-xs"
        >
          {Object.entries(ZIP_SORT_LABELS).map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </select>
      </div>

      {topModules.length > 0 && (
        <div className="flex flex-wrap gap-1 text-xs text-muted-foreground">
          <span className="font-semibold">Módulos más afectados:</span>
          {topModules.map((m) => (
            <span key={m} className="px-1.5 py-0.5 rounded bg-muted/30">
              {m}
            </span>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Mostrando <strong>{paginated.total}</strong> de{" "}
        <strong>{fullAnalysisResult.results.length}</strong> archivos
        {paginated.total < fullAnalysisResult.results.length && (
          <span> (filtrados)</span>
        )}
      </p>

      {paginated.items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-8">
          <p className="text-sm text-muted-foreground italic">No hay archivos con estos filtros.</p>
          <button
            onClick={() => setStatusFilter("all")}
            className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-all"
            aria-label="Mostrar todos los archivos del lote"
          >
            Mostrar todos
          </button>
        </div>
      ) : (
        <>
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
                {paginated.items.map((r, i) => {
                  const rowData = useFileRowData(r);
                  const bandStyles = rowData.score ? getRiskBandStyles(rowData.score.band) : "";
                  return (
                    <tr key={`${r.index}-zn`} className="border-b border-border/30 hover:bg-muted/20">
                      <td className="py-1 pr-2 text-muted-foreground">{(page - 1) * pageSize + i + 1}</td>
                      <td className="py-1 pr-2 font-mono break-all max-w-[180px]">{r.name}</td>
                      <td className={`py-1 pr-2 font-bold ${bandStyles}`}>
                        {rowData.score !== null ? `${rowData.score.score}/100` : "—"}
                      </td>
                      <td className="py-1 pr-2">
                        {rowData.score !== null ? (
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${bandStyles}`}
                          >
                            {getRiskBandLabel(rowData.score.band)}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="py-1 pr-2">
                        {rowData.isAnalyzed ? (
                          <span className="text-emerald-600 font-medium">Analizado</span>
                        ) : (
                          <span className="text-red-600 font-medium">Fallido</span>
                        )}
                      </td>
                      <td className="py-1 pr-2">
                        {rowData.isAnalyzed ? (
                          rowData.criticalCount > 0 ? (
                            <span className="text-red-600 font-bold">{rowData.criticalCount}</span>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="py-1 pr-2">
                        {rowData.isAnalyzed ? (
                          rowData.warningCount > 0 ? (
                            <span className="text-yellow-600 font-bold">{rowData.warningCount}</span>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="py-1 pr-2 font-mono max-w-[100px] truncate">{rowData.topDriver}</td>
                      <td className="py-1 pr-2 max-w-[120px]">
                        <div className="flex flex-wrap gap-0.5">
                          {Array.from(rowData.modules)
                            .slice(0, 2)
                            .map((m) => (
                              <span
                                key={m}
                                className="text-[10px] px-1 rounded bg-muted/30 text-muted-foreground"
                              >
                                {getFindingModuleLabel(m)}
                              </span>
                            ))}
                          {rowData.modules.size > 2 && (
                            <span className="text-[10px] text-muted-foreground">
                              +{rowData.modules.size - 2}
                            </span>
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
          {paginated.total > pageSize && (
            <div className="flex items-center justify-between pt-3 border-t border-border/50">
              <div className="flex items-center gap-3">
                <p className="text-xs text-muted-foreground">
                  Página {page} de {paginated.totalPages}
                </p>
                <div className="flex items-center gap-1 text-xs">
                  <span className="text-muted-foreground">Ver:</span>
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <button
                      key={size}
                      onClick={() => handlePageSizeChange(size)}
                      className={`px-1.5 py-0.5 rounded border ${pageSize === size ? "bg-foreground text-background" : "hover:bg-muted"}`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => setPage(1)}
                  disabled={page === 1}
                  className="px-2 py-1 rounded border border-border text-xs font-semibold disabled:opacity-50 hover:bg-muted transition-all"
                >
                  ««
                </button>
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-2 py-1 rounded border border-border text-xs font-semibold disabled:opacity-50 hover:bg-muted transition-all"
                >
                  ‹
                </button>
                <span className="px-2 py-1 text-xs font-medium text-foreground">{page} / {paginated.totalPages}</span>
                <button
                  onClick={() => setPage((p) => Math.min(paginated.totalPages, p + 1))}
                  disabled={page >= paginated.totalPages}
                  className="px-2 py-1 rounded border border-border text-xs font-semibold disabled:opacity-50 hover:bg-muted transition-all"
                >
                  ›
                </button>
                <button
                  onClick={() => setPage(paginated.totalPages)}
                  disabled={page === paginated.totalPages}
                  className="px-2 py-1 rounded border border-border text-xs font-semibold disabled:opacity-50 hover:bg-muted transition-all"
                >
                  »»
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {zipScore.topRiskFiles.length > 0 && (
        <div className="p-4 rounded-lg border border-red-200 bg-red-50 space-y-2">
          <p className="text-xs font-bold text-red-700 uppercase tracking-wider">
            Top archivos de riesgo
          </p>
          <div className="flex flex-col gap-1.5">
            {zipScore.topRiskFiles.map((tf) => (
              <div key={tf.index} className="flex items-center justify-between text-xs">
                <span className="font-mono truncate max-w-[300px]">{tf.name}</span>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${getRiskBandStyles(tf.band)}`}
                  >
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
