import type { Finding } from "../../api/xml-audit";
import { sortFindingsByPriority, getPriorityLabel, groupFindingsByActionGroup } from "./findingPriority";

interface ActionableSummaryProps {
  findings: Finding[];
}

export default function ActionableSummary({ findings }: ActionableSummaryProps) {
  if (!findings || findings.length === 0) return null;
  return (
    <div className="space-y-4 p-4 rounded-xl border border-border bg-card">
      <h3 className="font-semibold text-sm">Resumen accionable</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {([
          { key: "BLOCKER", label: "Bloqueantes", style: "text-red-700 bg-red-50 border-red-200" },
          { key: "HIGH", label: "Alta prioridad", style: "text-orange-700 bg-orange-50 border-orange-200" },
          { key: "MEDIUM", label: "Media prioridad", style: "text-yellow-700 bg-yellow-50 border-yellow-200" },
          { key: "LOW", label: "Informativos", style: "text-blue-700 bg-blue-50 border-blue-200" },
          { key: "ALL", label: "Total hallazgos", style: "text-muted-foreground bg-muted border-border" },
        ] as const).map(({ key, label, style }) => (
          <div
            key={key}
            className={`flex flex-col items-center justify-center p-3 rounded-lg border ${style}`}
          >
            <span className="text-2xl font-bold">
              {key === "ALL"
                ? findings.length
                : findings.filter((f) => f.priority === key).length}
            </span>
            <span className="text-xs font-medium">{label}</span>
          </div>
        ))}
      </div>
      {(() => {
        const sorted = sortFindingsByPriority(findings).slice(0, 5);
        return (
          <div>
            <h4 className="text-xs font-semibold mb-2">Primeras acciones recomendadas</h4>
            <div className="space-y-2">
              {sorted.map((f, i) => (
                <div key={i} className="flex items-start gap-2 text-xs p-2 rounded border border-border">
                  <span className="font-bold shrink-0 mt-0.5">#{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-semibold">{f.code}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                        f.priority === "BLOCKER" ? "text-red-700 bg-red-50 border-red-200" :
                        f.priority === "HIGH" ? "text-orange-700 bg-orange-50 border-orange-200" :
                        f.priority === "MEDIUM" ? "text-yellow-700 bg-yellow-50 border-yellow-200" :
                        "text-blue-700 bg-blue-50 border-blue-200"
                      }`}>
                        {getPriorityLabel(f.priority)}
                      </span>
                    </div>
                    <p className="text-muted-foreground mt-0.5">{f.recommendedAction ?? f.title}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}
      {(() => {
        const groups = groupFindingsByActionGroup(findings);
        return (
          <div>
            <h4 className="text-xs font-semibold mb-2">Grupos accionables</h4>
            <div className="space-y-2">
              {Object.entries(groups).map(([group, items]) => (
                <div
                  key={group}
                  className="flex items-center justify-between text-xs p-2 rounded border border-border"
                >
                  <span className="font-medium">{group}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground">{items.length} hallazgo(s)</span>
                    <span className="text-red-600 font-medium">
                      {items.filter((f) => f.severity === "CRITICAL").length} crítico(s)
                    </span>
                    <span className="text-yellow-600 font-medium">
                      {items.filter((f) => f.severity === "WARNING").length} advertencia(s)
                    </span>
                    <span className="text-blue-600">
                      {items.filter((f) => f.severity === "INFO").length} info
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
