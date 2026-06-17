import type { ZipFullAnalysisResult, ZipFullAnalysisFileResult } from "../../api/xml-audit";

interface MassiveResultsTableProps {
  fullAnalysisResult: ZipFullAnalysisResult;
  massiveFilter: string;
  onMassiveFilterChange: (filter: string) => void;
  onOpenDetail: (file: ZipFullAnalysisFileResult) => void;
}

export default function MassiveResultsTable({
  fullAnalysisResult,
  massiveFilter,
  onMassiveFilterChange,
  onOpenDetail,
}: MassiveResultsTableProps) {
  return (
    <>
      {fullAnalysisResult.results.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">Resultados por archivo</p>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {[
              ["ALL", "Todos"],
              ["BLOCKER", "Bloqueantes"],
              ["HIGH", "Alta prioridad"],
              ["FAILED", "Fallidos"],
              ["TRUNCATED", "Truncados"],
              ["RETENCIONES", "Retenciones"],
              ["CFDI", "CFDI"],
            ].map(([key, label]) => (
              <button
                key={key}
                onClick={() => onMassiveFilterChange(key)}
                className={`px-2 py-0.5 rounded text-xs font-semibold border transition-all ${massiveFilter === key ? "bg-primary text-primary-foreground border-primary" : "bg-muted text-muted-foreground border-border hover:bg-muted/70"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-border/50 text-muted-foreground">
                  <th className="text-left py-1 pr-2">#</th>
                  <th className="text-left py-1 pr-2">Archivo</th>
                  <th className="text-left py-1 pr-2">Estado</th>
                  <th className="text-left py-1 pr-2">UUID</th>
                  <th className="text-left py-1 pr-2">Tipo</th>
                  <th className="text-left py-1 pr-2">RFC emisor</th>
                  <th className="text-left py-1 pr-2">RFC receptor</th>
                  <th className="text-left py-1 pr-2">Total</th>
                  <th className="text-left py-1 pr-2">Moneda</th>
                  <th className="text-left py-1 pr-2">Riesgo</th>
                  <th className="text-left py-1 pr-2">Críticos</th>
                  <th className="text-left py-1 pr-2">Advertencias</th>
                  <th className="text-left py-1 pr-2">Informativos</th>
                  <th className="text-left py-1 pr-2">BOM</th>
                  <th className="text-left py-1 pr-2">XML normalizado</th>
                  <th className="text-left py-1 pr-2">Error</th>
                  <th className="text-left py-1 pr-2"></th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const filtered =
                    massiveFilter === "ALL"
                      ? fullAnalysisResult.results
                      : fullAnalysisResult.results.filter((r) => {
                          if (massiveFilter === "FAILED") return r.status === "FAILED";
                          if (r.status !== "ANALYZED" || !r.analysis) return false;
                          const fnd = r.analysis.findings ?? [];
                          if (massiveFilter === "BLOCKER")
                            return fnd.some((x) => x.priority === "BLOCKER");
                          if (massiveFilter === "HIGH")
                            return fnd.some((x) => x.priority === "HIGH");
                          if (massiveFilter === "TRUNCATED")
                            return r.analysis.analysisMeta?.performance.findingsTruncated;
                          if (massiveFilter === "RETENCIONES")
                            return r.analysis.documentKind === "RETENCIONES";
                          if (massiveFilter === "CFDI") return r.analysis.documentKind === "CFDI";
                          return true;
                        });
                  return filtered.map((r, i) => {
                    const isAnalyzed = r.status === "ANALYZED";
                    const riskBadge =
                      isAnalyzed && r.analysis?.executiveSummary.riskLevel === "CRITICAL"
                        ? "text-red-600"
                        : isAnalyzed && r.analysis?.executiveSummary.riskLevel === "WARNING"
                          ? "text-yellow-600"
                          : "text-emerald-600";
                    return (
                      <tr key={`${i}-row`} className="border-b border-border/30">
                        <td className="py-1 pr-2 text-muted-foreground">{i + 1}</td>
                        <td className="py-1 pr-2 font-mono break-all max-w-[180px]">{r.name}</td>
                        <td className="py-1 pr-2">
                          {isAnalyzed ? (
                            <span className="text-emerald-600 font-medium">Analizado</span>
                          ) : (
                            <span className="text-red-600 font-medium">Fallido</span>
                          )}
                        </td>
                        <td className="py-1 pr-2 font-mono max-w-[100px] truncate">
                          {isAnalyzed ? (r.analysis?.uuid ?? "—") : "—"}
                        </td>
                        <td className="py-1 pr-2">
                          {isAnalyzed ? (r.analysis?.tipoComprobante ?? "—") : "—"}
                        </td>
                        <td className="py-1 pr-2 font-mono">
                          {isAnalyzed ? (r.analysis?.rfcEmisor ?? "—") : "—"}
                        </td>
                        <td className="py-1 pr-2 font-mono">
                          {isAnalyzed ? (r.analysis?.rfcReceptor ?? "—") : "—"}
                        </td>
                        <td className="py-1 pr-2">
                          {isAnalyzed ? (r.analysis?.total ?? "—") : "—"}
                        </td>
                        <td className="py-1 pr-2">
                          {isAnalyzed ? (r.analysis?.moneda ?? "—") : "—"}
                        </td>
                        <td className={`py-1 pr-2 ${riskBadge}`}>
                          {isAnalyzed ? (r.analysis?.executiveSummary.riskLevel ?? "—") : "—"}
                        </td>
                        <td className="py-1 pr-2">
                          {isAnalyzed
                            ? (r.analysis?.findings?.filter((f) => f.severity === "CRITICAL")
                                .length ?? 0)
                            : "—"}
                        </td>
                        <td className="py-1 pr-2">
                          {isAnalyzed
                            ? (r.analysis?.findings?.filter((f) => f.severity === "WARNING")
                                .length ?? 0)
                            : "—"}
                        </td>
                        <td className="py-1 pr-2">
                          {isAnalyzed
                            ? (r.analysis?.findings?.filter((f) => f.severity === "INFO").length ??
                              0)
                            : "—"}
                        </td>
                        <td className="py-1 pr-2">
                          {isAnalyzed
                            ? r.analysis?.technicalDiagnostics.bomDetected
                              ? "Sí"
                              : "No"
                            : "—"}
                        </td>
                        <td className="py-1 pr-2">
                          {isAnalyzed ? (r.analysis?.normalizedXml?.available ? "Sí" : "No") : "—"}
                        </td>
                        <td className="py-1 pr-2 text-red-600 max-w-[120px] break-all">
                          {r.status === "FAILED" ? (r.errorMessage ?? r.errorCode ?? "Error") : "—"}
                        </td>
                        <td className="py-1 pr-2">
                          <button
                            onClick={() => onOpenDetail(r)}
                            className="text-primary font-semibold hover:underline whitespace-nowrap"
                          >
                            Ver detalle
                          </button>
                        </td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
