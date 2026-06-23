import { useState, useMemo } from "react";
import type { Finding } from "../../api/xml-audit";
import {
  buildFindingGlossary,
  getFindingImpactLabel,
  getFindingRemediationHint,
  getSeverityLabel,
  getCategoryLabel,
} from "./findingGlossary.helpers";
import { getPriorityLabel } from "./findingPriority";

interface Props {
  findings: Finding[];
  compact?: boolean;
}

export default function FindingGlossary({ findings, compact }: Props) {
  const glossary = useMemo(() => buildFindingGlossary(findings), [findings]);
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState("ALL");
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [expandedCodes, setExpandedCodes] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    return glossary.filter((entry) => {
      const matchesSearch =
        entry.code.toLowerCase().includes(search.toLowerCase()) ||
        entry.title.toLowerCase().includes(search.toLowerCase()) ||
        entry.category.toLowerCase().includes(search.toLowerCase()) ||
        entry.recommendedAction.toLowerCase().includes(search.toLowerCase()) ||
        entry.message.toLowerCase().includes(search.toLowerCase());

      const matchesSeverity = severityFilter === "ALL" || entry.severity === severityFilter;
      const matchesPriority = priorityFilter === "ALL" || entry.priority === priorityFilter;
      const matchesCategory = categoryFilter === "ALL" || entry.category === categoryFilter;

      return matchesSearch && matchesSeverity && matchesPriority && matchesCategory;
    });
  }, [glossary, search, severityFilter, priorityFilter, categoryFilter]);

  const categories = useMemo(() => {
    const s = new Set<string>();
    glossary.forEach((e) => s.add(e.category));
    return Array.from(s).sort();
  }, [glossary]);

  function toggleExpand(code: string) {
    setExpandedCodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  if (glossary.length === 0) return null;

  const badgeStyle: Record<string, string> = {
    CRITICAL: "text-red-700 bg-red-50 border-red-200",
    WARNING: "text-yellow-700 bg-yellow-50 border-yellow-200",
    INFO: "text-blue-700 bg-blue-50 border-blue-200",
    BLOCKER: "text-red-700 bg-red-50 border-red-200",
    HIGH: "text-orange-700 bg-orange-50 border-orange-200",
    MEDIUM: "text-yellow-700 bg-yellow-50 border-yellow-200",
    LOW: "text-blue-700 bg-blue-50 border-blue-200",
  };

  return (
    <div className={`space-y-4 ${compact ? "" : "p-6 rounded-xl border border-border bg-card"}`}>
      {!compact && (
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-lg">Glosario de hallazgos</h2>
            <p className="text-sm text-muted-foreground">
              Explicación agrupada de los códigos detectados en este análisis.
            </p>
          </div>
        </div>
      )}

      {compact && <h3 className="font-semibold text-sm">Glosario de hallazgos del archivo</h3>}

      {!compact && (
        <div className="space-y-3">
          <input
            type="text"
            placeholder="Buscar por código, título, categoría o acción..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />

          <div className="flex gap-2 flex-wrap text-xs">
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="px-2 py-1 rounded border border-border bg-background"
            >
              <option value="ALL">Todas las severidades</option>
              <option value="CRITICAL">Crítico</option>
              <option value="WARNING">Advertencia</option>
              <option value="INFO">Informativo</option>
            </select>

            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="px-2 py-1 rounded border border-border bg-background"
            >
              <option value="ALL">Todas las prioridades</option>
              <option value="BLOCKER">Bloqueante</option>
              <option value="HIGH">Alta</option>
              <option value="MEDIUM">Media</option>
              <option value="LOW">Informativa</option>
            </select>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-2 py-1 rounded border border-border bg-background"
            >
              <option value="ALL">Todas las categorías</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {getCategoryLabel(c)}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">
            No se encontraron entradas en el glosario.
          </p>
        ) : (
          filtered.map((entry) => (
            <div
              key={entry.code}
              className="p-4 rounded-lg border border-border bg-muted/20 space-y-3"
            >
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold font-mono text-primary">{entry.code}</span>
                  <span className="text-sm font-semibold">{entry.title}</span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badgeStyle[entry.severity]}`}
                  >
                    {getSeverityLabel(entry.severity)}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badgeStyle[entry.priority]}`}
                  >
                    {getPriorityLabel(entry.priority)}
                  </span>
                  <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded">
                    {getCategoryLabel(entry.category)}
                  </span>
                </div>
                <div className="text-[10px] font-semibold text-muted-foreground uppercase">
                  {entry.occurrences} {entry.occurrences === 1 ? "aparición" : "apariciones"}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="space-y-1">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Qué significa
                  </p>
                  <p className="text-muted-foreground leading-relaxed">{entry.message}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Impacto
                  </p>
                  <p className="text-muted-foreground leading-relaxed">
                    {getFindingImpactLabel(entry.severity)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm pt-2 border-t border-border/50">
                <div className="space-y-1">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Acción recomendada
                  </p>
                  <p className="text-muted-foreground leading-relaxed">
                    {entry.recommendedAction || "Revisar el contexto y confirmar validez."}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Guía general
                  </p>
                  <p className="text-muted-foreground leading-relaxed italic text-xs">
                    {getFindingRemediationHint(entry.actionGroup)}
                  </p>
                </div>
              </div>

              {entry.sampleEvidence && entry.sampleEvidence.length > 0 && (
                <div className="pt-2">
                  <button
                    onClick={() => toggleExpand(entry.code)}
                    className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
                  >
                    {expandedCodes.has(entry.code) ? "Ocultar ejemplo" : "Ver ejemplo de evidencia"}
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      className={`w-3 h-3 transition-transform ${expandedCodes.has(entry.code) ? "rotate-180" : ""}`}
                    >
                      <path
                        fillRule="evenodd"
                        d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                  {expandedCodes.has(entry.code) && (
                    <div className="mt-2 p-3 rounded bg-muted/50 border border-border/50 space-y-2 text-xs">
                      {entry.sampleEvidence.length > 0 && (
                        <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5">
                          {entry.sampleEvidence.map((e, idx) => (
                            <div key={idx} className="contents">
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
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
