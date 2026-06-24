import { useState, useMemo, useCallback } from "react";
import type { Finding } from "../../api/xml-audit";
import { getFindingModuleLabel } from "./findingExplorer.helpers";
import {
  buildAuditFilterOptions,
  buildQuickFilterPresets,
  summarizeActiveFilters,
  type SmartFilters,
  type SortMode,
} from "./auditNavigation.helpers";

export interface AuditSmartFiltersProps {
  findings: Finding[];
  filteredFindings: Finding[];
  rawFilteredCount: number;
  filters: SmartFilters;
  onFiltersChange: (filters: SmartFilters) => void;
  sortMode: SortMode;
  onSortModeChange: (mode: SortMode) => void;
  compact?: boolean;
}

const ACTIVATED_CLASS = "bg-foreground text-background border-foreground";
const IDLE_CLASS =
  "bg-transparent text-muted-foreground border-border hover:border-foreground hover:text-foreground";

function chipClass(active: boolean) {
  return `px-2.5 py-1 rounded-full border text-xs font-semibold transition-all ${active ? ACTIVATED_CLASS : IDLE_CLASS}`;
}

const SORT_LABELS: Record<SortMode, string> = {
  priority: "Prioridad",
  severity: "Severidad",
  module: "Módulo",
  actionGroup: "Grupo de acción",
  location: "Ubicación",
  code: "Código",
  riskImpact: "Impacto",
  differenceDesc: "Diferencia",
};

export default function AuditSmartFilters({
  findings,
  filteredFindings,
  rawFilteredCount,
  filters,
  onFiltersChange,
  sortMode,
  onSortModeChange,
  compact,
}: AuditSmartFiltersProps) {
  const [showMore, setShowMore] = useState(false);

  const options = useMemo(() => buildAuditFilterOptions(findings), [findings]);
  const presets = useMemo(() => buildQuickFilterPresets(compact), [compact]);
  const [activePreset, setActivePreset] = useState("all");

  const allModules = useMemo(() => {
    const set = new Set<string>();
    for (const f of findings) {
      if (f.location?.module) set.add(f.location.module);
    }
    return Array.from(set).sort();
  }, [findings]);

  const hasActiveFilters = useMemo(() => {
    return (
      filters.text ||
      filters.severities.length > 0 ||
      filters.priorities.length > 0 ||
      filters.actionGroups.length > 0 ||
      filters.modules.length > 0 ||
      filters.fields.length > 0 ||
      filters.hasLocation !== null ||
      filters.hasValueTrace !== null ||
      filters.onlyCriticalOrBlocker ||
      filters.onlyWithDifference ||
      filters.onlyTaxImpact ||
      filters.onlyTechnicalImpact ||
      filters.onlySupportMessageRelevant
    );
  }, [filters]);

  const filterSummary = useMemo(() => summarizeActiveFilters(filters), [filters]);

  const handlePreset = useCallback(
    (key: string) => {
      setActivePreset(key);
      if (key === "all") {
        onFiltersChange({
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
        });
        return;
      }
      const preset = presets.find((p) => p.key === key);
      if (preset) {
        const matching = findings.filter(preset.filter);
        const sevs = Array.from(new Set(matching.map((f) => f.severity)));
        const pris = Array.from(new Set(matching.map((f) => f.priority).filter(Boolean)));
        onFiltersChange({
          text: "",
          severities: sevs,
          priorities: pris as string[],
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
        });
      }
    },
    [findings, onFiltersChange, presets],
  );

  const clearAll = useCallback(() => {
    setActivePreset("all");
    onFiltersChange({
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
    });
  }, [onFiltersChange]);

  return (
    <div className="space-y-3">
      <div
        className="flex flex-wrap gap-1.5"
        role="toolbar"
        aria-label="Filtros rápidos de hallazgos"
      >
        {presets.map((p) => (
          <button
            key={p.key}
            onClick={() => handlePreset(p.key)}
            className={chipClass(activePreset === p.key)}
            aria-pressed={activePreset === p.key}
          >
            {p.label}
          </button>
        ))}
      </div>

      {!compact && (
        <>
          <div className="flex flex-wrap gap-2 items-center">
            <select
              aria-label="Filtrar por módulo"
              value={filters.modules.length === 1 ? filters.modules[0] : ""}
              onChange={(e) => {
                const val = e.target.value;
                setActivePreset("");
                onFiltersChange({ ...filters, modules: val ? [val] : [] });
              }}
              className="px-2 py-1.5 rounded border border-border bg-background text-xs"
            >
              <option value="">Todos módulos</option>
              {allModules.map((m) => (
                <option key={m} value={m}>
                  {getFindingModuleLabel(m)}
                </option>
              ))}
            </select>
            <select
              aria-label="Filtrar por severidad"
              value={filters.severities.length === 1 ? filters.severities[0] : ""}
              onChange={(e) => {
                const val = e.target.value;
                setActivePreset("");
                onFiltersChange({ ...filters, severities: val ? [val] : [] });
              }}
              className="px-2 py-1.5 rounded border border-border bg-background text-xs"
            >
              <option value="">Todas severidades</option>
              {options.severities.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <select
              aria-label="Filtrar por prioridad"
              value={filters.priorities.length === 1 ? filters.priorities[0] : ""}
              onChange={(e) => {
                const val = e.target.value;
                setActivePreset("");
                onFiltersChange({ ...filters, priorities: val ? [val] : [] });
              }}
              className="px-2 py-1.5 rounded border border-border bg-background text-xs"
            >
              <option value="">Todas prioridades</option>
              {options.priorities.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <select
              aria-label="Ordenar resultados"
              value={sortMode}
              onChange={(e) => onSortModeChange(e.target.value as SortMode)}
              className="px-2 py-1.5 rounded border border-border bg-background text-xs"
            >
              {Object.entries(SORT_LABELS).map(([k, l]) => (
                <option key={k} value={k}>
                  Orden: {l}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                aria-label="Mostrar solo críticos y bloqueantes"
                checked={filters.onlyCriticalOrBlocker}
                onChange={() => {
                  setActivePreset("");
                  onFiltersChange({
                    ...filters,
                    onlyCriticalOrBlocker: !filters.onlyCriticalOrBlocker,
                  });
                }}
                className="rounded border-border"
              />
              Críticos/Bloqueantes
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                aria-label="Mostrar solo hallazgos con diferencia"
                checked={filters.onlyWithDifference}
                onChange={() => {
                  setActivePreset("");
                  onFiltersChange({ ...filters, onlyWithDifference: !filters.onlyWithDifference });
                }}
                className="rounded border-border"
              />
              Con diferencia
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                aria-label="Mostrar solo impacto fiscal"
                checked={filters.onlyTaxImpact}
                onChange={() => {
                  setActivePreset("");
                  onFiltersChange({ ...filters, onlyTaxImpact: !filters.onlyTaxImpact });
                }}
                className="rounded border-border"
              />
              Impacto fiscal
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                aria-label="Mostrar solo hallazgos técnicos"
                checked={filters.onlyTechnicalImpact}
                onChange={() => {
                  setActivePreset("");
                  onFiltersChange({
                    ...filters,
                    onlyTechnicalImpact: !filters.onlyTechnicalImpact,
                  });
                }}
                className="rounded border-border"
              />
              Técnico
            </label>
            <button
              onClick={() => setShowMore(!showMore)}
              className="text-primary font-semibold hover:underline"
              aria-expanded={showMore}
            >
              {showMore ? "Menos filtros" : "Más filtros"}
            </button>
          </div>

          {showMore && (
            <div className="flex flex-wrap gap-2 text-xs">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  aria-label="Mostrar solo hallazgos con ubicación"
                  checked={filters.hasLocation === true}
                  onChange={() => {
                    setActivePreset("");
                    onFiltersChange({
                      ...filters,
                      hasLocation: filters.hasLocation === true ? null : true,
                    });
                  }}
                  className="rounded border-border"
                />
                Con ubicación
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  aria-label="Mostrar solo hallazgos sin ubicación"
                  checked={filters.hasLocation === false}
                  onChange={() => {
                    setActivePreset("");
                    onFiltersChange({
                      ...filters,
                      hasLocation: filters.hasLocation === false ? null : false,
                    });
                  }}
                  className="rounded border-border"
                />
                Sin ubicación
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  aria-label="Mostrar solo hallazgos con valor"
                  checked={filters.hasValueTrace === true}
                  onChange={() => {
                    setActivePreset("");
                    onFiltersChange({
                      ...filters,
                      hasValueTrace: filters.hasValueTrace === true ? null : true,
                    });
                  }}
                  className="rounded border-border"
                />
                Con valor
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  aria-label="Mostrar solo hallazgos con acción recomendada"
                  checked={filters.onlySupportMessageRelevant}
                  onChange={() => {
                    setActivePreset("");
                    onFiltersChange({
                      ...filters,
                      onlySupportMessageRelevant: !filters.onlySupportMessageRelevant,
                    });
                  }}
                  className="rounded border-border"
                />
                Con acción recomendada
              </label>
            </div>
          )}
        </>
      )}

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Mostrando <strong>{filteredFindings.length}</strong> de{" "}
          <strong>{rawFilteredCount}</strong> hallazgo{rawFilteredCount !== 1 ? "s" : ""}
          {activePreset !== "all" && activePreset
            ? ` · ${presets.find((p) => p.key === activePreset)?.label ?? activePreset}`
            : ""}
          {filterSummary && !activePreset ? ` · ${filterSummary}` : ""}
        </span>
        {hasActiveFilters && (
          <button onClick={clearAll} className="text-primary font-semibold hover:underline">
            Limpiar filtros
          </button>
        )}
      </div>
    </div>
  );
}
