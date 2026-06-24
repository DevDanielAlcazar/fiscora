import { useState, useMemo, useCallback } from "react";
import type { Finding } from "../../api/xml-audit";
import {
  getFindingModuleLabel,
  getFindingLocationText,
  getFindingValueTraceText,
  aggregateFindingsByModule,
} from "./findingExplorer.helpers";
import {
  filterFindingsSmart,
  sortFindingsSmart,
  type SmartFilters,
  type SortMode,
} from "./auditNavigation.helpers";
import AuditSmartFilters from "./AuditSmartFilters";

interface Props {
  findings: Finding[];
  compact?: boolean;
}

const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;
type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

const BADGE: Record<string, { label: string; style: string }> = {
  CRITICAL: { label: "Crítico", style: "text-red-700 bg-red-50 border-red-200" },
  WARNING: { label: "Advertencia", style: "text-yellow-700 bg-yellow-50 border-yellow-200" },
  INFO: { label: "Informativo", style: "text-blue-700 bg-blue-50 border-blue-200" },
};

const PRIORITY_BADGE: Record<string, { label: string; style: string }> = {
  BLOCKER: { label: "Bloqueante", style: "text-red-700 bg-red-50 border-red-200" },
  HIGH: { label: "Alta", style: "text-orange-700 bg-orange-50 border-orange-200" },
  MEDIUM: { label: "Media", style: "text-yellow-700 bg-yellow-50 border-yellow-200" },
  LOW: { label: "Informativa", style: "text-blue-700 bg-blue-50 border-blue-200" },
};

const DEFAULT_FILTERS: SmartFilters = {
  text: "",
  severities: [],
  priorities: [],
  actionGroups: [],
  modules: [],
  fields: [],
  hasLocation: null,
  hasValueTrace: null,
  onlyCriticalOrBlocker: false,
  onlyWithDifference: false,
  onlyTaxImpact: false,
  onlyTechnicalImpact: false,
  onlySupportMessageRelevant: false,
};

export default function FindingExplorer({ findings, compact }: Props) {
  const [filters, setFilters] = useState<SmartFilters>(DEFAULT_FILTERS);
  const [sortMode, setSortMode] = useState<SortMode>("priority");
  const [groupView, setGroupView] = useState<"list" | "module">("list");
  const [expandedIdx, setExpandedIdx] = useState<Set<number>>(new Set());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(50);

  const toggleExpand = useCallback((idx: number) => {
    setExpandedIdx((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }, []);

  const handleFiltersChange = useCallback((newFilters: SmartFilters) => {
    setFilters(newFilters);
    setPage(1);
  }, []);

  const handlePageSizeChange = useCallback((newPageSize: PageSize) => {
    setPageSize(newPageSize);
    setPage(1);
  }, []);

  const filtered = useMemo(
    () => sortFindingsSmart(filterFindingsSmart(findings, filters), sortMode),
    [findings, filters, sortMode],
  );

  const byModule = useMemo(() => aggregateFindingsByModule(findings), [findings]);

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    return {
      items: filtered.slice(start, end),
      total: filtered.length,
      totalPages: Math.ceil(filtered.length / pageSize),
    };
  }, [filtered, page, pageSize]);

  const totalCrit = useMemo(
    () => findings.filter((f) => f.severity === "CRITICAL").length,
    [findings],
  );
  const totalWarn = useMemo(
    () => findings.filter((f) => f.severity === "WARNING").length,
    [findings],
  );
  const totalInfo = useMemo(() => findings.filter((f) => f.severity === "INFO").length, [findings]);
  const totalBlocker = useMemo(
    () => findings.filter((f) => f.priority === "BLOCKER").length,
    [findings],
  );
  const totalWithLoc = useMemo(() => findings.filter((f) => f.location).length, [findings]);
  const totalWithVT = useMemo(() => findings.filter((f) => f.valueTrace).length, [findings]);
  const affModules = useMemo(() => {
    const set = new Set<string>();
    for (const f of findings) {
      if (f.location?.module) set.add(getFindingModuleLabel(f.location.module));
    }
    return set.size;
  }, [findings]);

  if (findings.length === 0) return null;

  const summaryCards = useMemo(() => [
    { label: "Total", count: findings.length, style: "bg-muted/50 text-foreground" },
    { label: "Bloqueantes", count: totalCrit, style: "bg-red-50 text-red-700 border-red-200" },
    { label: "Críticos", count: totalBlocker, style: "bg-red-50 text-red-700 border-red-200" },
    {
      label: "Advertencias",
      count: totalWarn,
      style: "bg-yellow-50 text-yellow-700 border-yellow-200",
    },
    { label: "Informativos", count: totalInfo, style: "bg-blue-50 text-blue-700 border-blue-200" },
    { label: "Con ubicación", count: totalWithLoc, style: "bg-muted/30 text-muted-foreground" },
    { label: "Con diferencia", count: totalWithVT, style: "bg-muted/30 text-muted-foreground" },
    { label: "Módulos", count: affModules, style: "bg-muted/30 text-muted-foreground" },
  ], [findings.length, totalCrit, totalBlocker, totalWarn, totalInfo, totalWithLoc, totalWithVT, affModules]);

  const chipStyle = (active: boolean) =>
    active
      ? "bg-foreground text-background border-foreground"
      : "bg-transparent text-muted-foreground border-border hover:border-foreground hover:text-foreground";

  return (
    <div className={`space-y-4 ${compact ? "" : "p-6 rounded-xl border border-border bg-card"}`}>
      {!compact && (
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-lg">Explorador de hallazgos</h2>
          <div className="flex gap-1 text-xs">
            <button
              onClick={() => setGroupView("list")}
              className={`px-2 py-1 rounded border ${chipStyle(groupView === "list")}`}
            >
              Lista
            </button>
            <button
              onClick={() => setGroupView("module")}
              className={`px-2 py-1 rounded border ${chipStyle(groupView === "module")}`}
            >
              Por módulo
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {summaryCards.map((c) => (
          <span
            key={c.label}
            className={`px-2.5 py-1 rounded-full border text-xs font-bold ${c.style}`}
          >
            {c.label}: {c.count}
          </span>
        ))}
      </div>

      <div className="space-y-2">
        <input
          type="text"
          placeholder="Buscar por código, título, mensaje, módulo, campo..."
          value={filters.text ?? ""}
          onChange={(e) => setFilters((prev) => ({ ...prev, text: e.target.value }))}
          className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <AuditSmartFilters
          findings={findings}
          filteredFindings={filtered}
          rawFilteredCount={findings.length}
          filters={filters}
          onFiltersChange={handleFiltersChange}
          sortMode={sortMode}
          onSortModeChange={setSortMode}
          compact={compact}
        />
      </div>

      {groupView === "module" && byModule.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {byModule.map((m) => (
            <div
              key={m.module}
              className="p-3 rounded-lg border border-border bg-muted/20 space-y-1"
            >
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                {m.label}
              </p>
              <div className="flex flex-wrap gap-1 text-[10px]">
                <span className="px-1.5 py-0.5 rounded bg-red-50 text-red-700 font-bold">
                  {m.critical} C
                </span>
                <span className="px-1.5 py-0.5 rounded bg-yellow-50 text-yellow-700 font-bold">
                  {m.warning} W
                </span>
                <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-bold">
                  {m.info} I
                </span>
                <span className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-bold">
                  {m.total} total
                </span>
              </div>
              {m.topCodes.length > 0 && (
                <p className="text-[10px] text-muted-foreground truncate">
                  {m.topCodes.slice(0, 3).join(", ")}
                  {m.topCodes.length > 3 ? "..." : ""}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {groupView === "list" && (
        <div className="space-y-2">
          {paginated.items.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <p className="text-sm text-muted-foreground italic">
                No hay hallazgos con estos filtros.
              </p>
              <button
                onClick={() => setFilters(DEFAULT_FILTERS)}
                className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-all"
                aria-label="Limpiar todos los filtros y mostrar todos los hallazgos"
              >
                Limpiar filtros
              </button>
            </div>
          ) : (
            paginated.items.map((f, idx) => {
              const b = BADGE[f.severity] ?? BADGE.INFO;
              const pb = f.priority ? PRIORITY_BADGE[f.priority] : null;
              const locText = getFindingLocationText(f);
              const vtText = getFindingValueTraceText(f);
              const pageStartIdx = (page - 1) * pageSize;
              const isExpanded = expandedIdx.has(pageStartIdx + idx);
              const modLabel = f.location ? getFindingModuleLabel(f.location.module) : null;
              return (
                <div key={f.id ?? idx} className={`p-4 rounded-lg border ${b.style} space-y-2`}>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-full border ${b.style}`}
                    >
                      {b.label}
                    </span>
                    {pb && (
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded-full border ${pb.style}`}
                      >
                        {pb.label}
                      </span>
                    )}
                    {modLabel && (
                      <span className="text-[10px] font-semibold text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">
                        {modLabel}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground font-mono">{f.code}</span>
                  </div>
                  <p className="text-sm font-medium">{f.title}</p>
                  <p className="text-xs text-muted-foreground">{f.message}</p>
                  {f.recommendedAction && (
                    <p className="text-xs text-muted-foreground">
                      <span className="font-semibold">Acción:</span> {f.recommendedAction}
                    </p>
                  )}
                  {locText && (
                    <p className="text-xs text-muted-foreground">
                      <span className="font-semibold">Ubicación:</span> {locText}
                    </p>
                  )}
                  {vtText && (
                    <p className="text-xs text-muted-foreground">
                      <span className="font-semibold">Valor:</span> {vtText}
                    </p>
                  )}
                  {f.evidence && f.evidence.length > 0 && (
                    <>
                      <button
                        onClick={() => toggleExpand(pageStartIdx + idx)}
                        className="text-xs font-semibold text-primary hover:underline"
                        aria-expanded={isExpanded}
                        aria-controls={`evidence-content-${f.id ?? (pageStartIdx + idx)}`}
                      >
                        {isExpanded ? "Ocultar evidencia" : "Ver evidencia"}
                      </button>
                      {isExpanded && (
                        <div
                          id={`evidence-content-${f.id ?? (pageStartIdx + idx)}`}
                          className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5 text-xs pt-1"
                        >
                          {f.evidence.map((e, ei) => (
                            <div key={ei} className="contents">
                              <span className="text-muted-foreground whitespace-nowrap">
                                {e.label}:
                              </span>
                              <span className="font-mono text-foreground/80 break-all">
                                {e.value ?? "—"}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })
          )}

          {filtered.length > pageSize && (
            <div className="flex items-center justify-between pt-3 border-t border-border/50">
              <div className="flex items-center gap-3">
                <p className="text-xs text-muted-foreground">
                  Mostrando {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, filtered.length)} de {filtered.length} hallazgos
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
                <span className="px-2 py-1 text-xs font-medium text-foreground">
                  {page} / {paginated.totalPages}
                </span>
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
        </div>
      )}
    </div>
  );
}