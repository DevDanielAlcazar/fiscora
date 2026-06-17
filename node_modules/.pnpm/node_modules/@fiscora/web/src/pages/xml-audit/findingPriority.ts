import type { Finding } from "../../api/xml-audit";

export const priorityOrder: Record<string, number> = { BLOCKER: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
export const severityOrder: Record<string, number> = { CRITICAL: 0, WARNING: 1, INFO: 2 };
export const categoryOrder: Record<string, number> = {
  TOTALS: 0, TAX: 1, COMPLEMENT: 2, FISCAL: 3, TECHNICAL: 4, STRUCTURE: 5,
};

export function getPriorityLabel(p: string | undefined): string {
  const labels: Record<string, string> = { BLOCKER: "Bloqueante", HIGH: "Alta", MEDIUM: "Media", LOW: "Informativa" };
  return labels[p ?? ""] ?? "—";
}

export function sortFindingsByPriority(findings: Finding[]): Finding[] {
  return [...findings].sort((a, b) => {
    const pa = priorityOrder[a.priority ?? "LOW"] ?? 3;
    const pb = priorityOrder[b.priority ?? "LOW"] ?? 3;
    if (pa !== pb) return pa - pb;
    const sa = severityOrder[a.severity] ?? 2;
    const sb = severityOrder[b.severity] ?? 2;
    if (sa !== sb) return sa - sb;
    return (categoryOrder[a.category] ?? 99) - (categoryOrder[b.category] ?? 99);
  });
}

export function groupFindingsByActionGroup(findings: Finding[]): Record<string, Finding[]> {
  const groups: Record<string, Finding[]> = {};
  for (const f of findings) {
    const g = f.actionGroup ?? "Informativo";
    if (!groups[g]) groups[g] = [];
    groups[g].push(f);
  }
  return groups;
}
