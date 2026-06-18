import { useState, useMemo } from "react";
import {
  buildAggregateRemediationPlan,
  type AggregateRemediationSource,
} from "./remediationPlan.helpers";

interface Props {
  sources: AggregateRemediationSource[];
  title?: string;
  compact?: boolean;
  maxItems?: number;
  onOpenSource?: (fileId: string) => void;
}

export default function AggregateRemediationPlan({
  sources,
  compact,
  title,
  maxItems,
  onOpenSource,
}: Props) {
  const plan = useMemo(() => buildAggregateRemediationPlan(sources), [sources]);
  const [expandedCodes, setExpandedCodes] = useState<Set<string>>(new Set());

  // Filters
  const [urgencyFilter, setUrgencyFilter] = useState("ALL");
  const [ownerFilter, setOwnerFilter] = useState("ALL");
  const [effortFilter, setEffortFilter] = useState("ALL");

  const filteredItems = useMemo(() => {
    let items = plan.items;
    if (urgencyFilter !== "ALL") items = items.filter((i) => i.urgency === urgencyFilter);
    if (ownerFilter !== "ALL") items = items.filter((i) => i.ownerSuggestion === ownerFilter);
    if (effortFilter !== "ALL") items = items.filter((i) => i.effort === effortFilter);
    if (maxItems) items = items.slice(0, maxItems);
    return items;
  }, [plan.items, urgencyFilter, ownerFilter, effortFilter, maxItems]);

  function toggleExpand(code: string) {
    setExpandedCodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  if (plan.items.length === 0) return null;

  const urgencyStyle: Record<string, string> = {
    INMEDIATA: "text-red-700 bg-red-50 border-red-200",
    ALTA: "text-orange-700 bg-orange-50 border-orange-200",
    MEDIA: "text-yellow-700 bg-yellow-50 border-yellow-200",
    BAJA: "text-blue-700 bg-blue-50 border-blue-200",
  };

  const effortStyle: Record<string, string> = {
    ALTO: "text-red-700 bg-red-50 border-red-200",
    MEDIO: "text-yellow-700 bg-yellow-50 border-yellow-200",
    BAJO: "text-green-700 bg-green-50 border-green-200",
  };

  if (compact) {
    return (
      <div className="space-y-4">
        <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground">
          Plan de acción (Top 5)
        </h3>
        <div className="space-y-2">
          {plan.items.slice(0, 5).map((item) => (
            <div key={item.code} className="p-3 rounded-lg border border-border bg-muted/20">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-xs font-bold font-mono text-primary">{item.code}</span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded border ${urgencyStyle[item.urgency]}`}
                >
                  {item.urgency}
                </span>
              </div>
              <p className="text-xs font-semibold mb-1">{item.title}</p>
              <p className="text-[10px] text-muted-foreground italic mb-2">
                {item.affectedFiles} archivos | {item.ownerSuggestion}
              </p>
              <p className="text-[10px] text-foreground leading-tight">{item.recommendedAction}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 rounded-xl border border-border bg-card space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-lg">{title || "Plan de acción del lote"}</h2>
          <p className="text-sm text-muted-foreground">
            Acciones consolidadas a partir de los hallazgos detectados en los XML del lote.
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <div className="p-3 rounded-lg bg-muted/30 border border-border text-center">
          <span className="block text-[10px] uppercase font-bold text-muted-foreground">
            Acciones
          </span>
          <span className="text-xl font-bold">{plan.summary.totalItems}</span>
        </div>
        <div className="p-3 rounded-lg bg-muted/30 border border-border text-center">
          <span className="block text-[10px] uppercase font-bold text-muted-foreground">
            Archivos
          </span>
          <span className="text-xl font-bold">{plan.summary.affectedFiles}</span>
        </div>
        <div className="p-3 rounded-lg bg-red-900/10 border border-red-900/20 text-center">
          <span className="block text-[10px] uppercase font-bold text-red-400">Inmediatas</span>
          <span className="text-xl font-bold text-red-500">{plan.summary.immediate}</span>
        </div>
        <div className="p-3 rounded-lg bg-orange-900/10 border border-orange-900/20 text-center">
          <span className="block text-[10px] uppercase font-bold text-orange-400">Alta Prio</span>
          <span className="text-xl font-bold text-orange-500">{plan.summary.high}</span>
        </div>
        <div className="p-3 rounded-lg bg-muted/30 border border-border text-center">
          <span className="block text-[10px] uppercase font-bold text-muted-foreground">
            Esfuerzo Alto
          </span>
          <span className="text-xl font-bold">{plan.summary.estimatedEffortHigh}</span>
        </div>
        <div className="p-3 rounded-lg bg-red-900/10 border border-red-900/20 text-center">
          <span className="block text-[10px] uppercase font-bold text-red-400">Críticos</span>
          <span className="text-xl font-bold text-red-500">{plan.summary.criticalFiles}</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap text-xs">
        <select
          value={urgencyFilter}
          onChange={(e) => setUrgencyFilter(e.target.value)}
          className="px-2 py-1 rounded border border-border bg-background"
        >
          <option value="ALL">Todas las urgencias</option>
          <option value="INMEDIATA">Inmediata</option>
          <option value="ALTA">Alta</option>
          <option value="MEDIA">Media</option>
          <option value="BAJA">Baja</option>
        </select>
        <select
          value={ownerFilter}
          onChange={(e) => setOwnerFilter(e.target.value)}
          className="px-2 py-1 rounded border border-border bg-background"
        >
          <option value="ALL">Todos los responsables</option>
          {plan.summary.byOwner.map((o) => (
            <option key={o.owner} value={o.owner}>
              {o.owner}
            </option>
          ))}
        </select>
        <select
          value={effortFilter}
          onChange={(e) => setEffortFilter(e.target.value)}
          className="px-2 py-1 rounded border border-border bg-background"
        >
          <option value="ALL">Todos los niveles de esfuerzo</option>
          <option value="ALTO">Esfuerzo Alto</option>
          <option value="MEDIO">Esfuerzo Medio</option>
          <option value="BAJO">Esfuerzo Bajo</option>
        </select>
      </div>

      {/* Items */}
      <div className="space-y-4">
        {filteredItems.length === 0 ? (
          <p className="text-sm text-muted-foreground italic text-center py-8">
            No hay acciones que coincidan con los filtros.
          </p>
        ) : (
          filteredItems.map((item) => (
            <div
              key={item.code}
              className="rounded-xl border border-border overflow-hidden bg-muted/10"
            >
              <div className="p-4 border-b border-border bg-muted/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold font-mono text-primary">{item.code}</span>
                    <span className="text-sm font-bold">{item.title}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${urgencyStyle[item.urgency]}`}
                    >
                      Urgencia: {item.urgency}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${effortStyle[item.effort]}`}
                    >
                      Esfuerzo: {item.effort}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted border border-border">
                      Responsable: {item.ownerSuggestion}
                    </span>
                  </div>
                </div>
                <div className="text-[10px] font-semibold text-muted-foreground uppercase text-right">
                  {item.affectedFiles} {item.affectedFiles === 1 ? "archivo" : "archivos"}{" "}
                  afectado(s)
                </div>
              </div>

              <div className="p-4 space-y-4">
                <p className="text-sm leading-relaxed">{item.recommendedAction}</p>

                <div className="pt-2 border-t border-border/50">
                  <button
                    onClick={() => toggleExpand(item.code)}
                    className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
                  >
                    {expandedCodes.has(item.code)
                      ? "Ocultar archivos ejemplo"
                      : "Ver archivos ejemplo"}
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      className={`w-3 h-3 transition-transform ${expandedCodes.has(item.code) ? "rotate-180" : ""}`}
                    >
                      <path
                        fillRule="evenodd"
                        d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                  {expandedCodes.has(item.code) && (
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                      {item.topExamples.map((ex, i) => (
                        <div
                          key={i}
                          className="p-2 rounded bg-muted/50 border border-border/50 text-[10px] flex items-center justify-between gap-2"
                        >
                          <span className="truncate" title={ex.filename}>
                            {ex.filename}
                          </span>
                          {onOpenSource && (
                            <button
                              onClick={() => onOpenSource(ex.fileId)}
                              className="text-primary hover:underline font-bold shrink-0"
                            >
                              Ver detalle
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
