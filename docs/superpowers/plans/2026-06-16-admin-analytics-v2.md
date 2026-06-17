# Admin Analytics V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enrich the Admin Analytics XML panel with analyticsV2 derived from analysisJson: documentKinds, priorities, actionGroups, moduleCoverage, performance, topFindingCodes, topModulesByFindings — without exposing raw JSON, XML, addenda, or normalizedXml.content.

**Architecture:** Two parallel Prisma queries under the same filters: (A) existing fields only (50k limit) for the current V1 response shape, (B) with analysisJson (50k limit) to derive analyticsV2 aggregations in memory. Backend derives all aggregates and returns them as analyticsV2; frontend adds 7 new visual sections.

**Tech Stack:** Fastify (backend), React + TypeScript (frontend), Prisma (PostgreSQL), Zod (filters)

## Global Constraints

- No modificar Prisma schema
- No exponer analysisJson completo, XML fuente, normalizedXml.content, Addenda raw, evidence completo
- No romper endpoint existente — analyticsV2 es un campo nuevo opcional en la respuesta
- Mantener filtros existentes: from, to, organizationId, userId, sourceType, analysisStatus
- Regresión xml-audit debe seguir 124/124
- package.json no debe cambiar (sin nuevas dependencias)
- pnpm typecheck debe pasar
- pnpm lint/prettier debe pasar

---

## File Map

| File                                        | Responsabilidad                                                                                                                                                                                                                  |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/api/src/routes/admin.routes.ts`       | Endpoint `GET /api/admin/xml-analytics/summary` — agregar segunda query con analysisJson y derivar analyticsV2                                                                                                                   |
| `apps/web/src/api/admin.ts`                 | Tipos `AnalyticsV2`, `DocumentKindAggregate`, `PriorityAggregate`, `ActionGroupAggregate`, `ModuleCoverageAggregate`, `PerformanceAggregate`, `TopFindingCodeAggregate`, `TopModuleAggregate` + actualizar `XmlAnalyticsSummary` |
| `apps/web/src/pages/AdminAnalyticsPage.tsx` | 7 nuevas secciones visuales para analyticsV2                                                                                                                                                                                     |

---

### Task 1: Backend — Agregar segunda query y deriveAnalyticsV2

**Files:**

- Modify: `apps/api/src/routes/admin.routes.ts:1904-2176`

**Interfaces:**

- Consumes: `XmlAnalysisRecord.analysisJson` (JSONB), `XmlAnalysisRecord.id` (para recordsAffected únicos)
- Produces: `analyticsV2` object (opcional) en respuesta de `/api/admin/xml-analytics/summary`

- [ ] **Step 1: Leer el handler actual para entender estructura**

Read the full handler at `apps/api/src/routes/admin.routes.ts:1904-2176` to confirm the response shape and query pattern.

- [ ] **Step 2: Agregar segunda query con analysisJson**

Después de la query original, agregar una segunda query paralela con `analysisJson` incluido:

```typescript
// Segunda query con analysisJson para analyticsV2
const v2Records = await fastify.prisma.xmlAnalysisRecord.findMany({
  where: where as any,
  orderBy: { createdAt: "desc" },
  take: 50000,
  select: {
    id: true,
    analysisStatus: true,
    analysisJson: true,
  },
});
```

- [ ] **Step 3: Implementar helper deriveDocumentKinds**

```typescript
interface DocumentKindAgg {
  documentKind: "CFDI" | "RETENCIONES" | "UNKNOWN" | "NO_DATA";
  count: number;
}

function deriveDocumentKinds(
  records: { analysisJson: unknown; analysisStatus: string }[],
): DocumentKindAgg[] {
  const map = new Map<string, number>();
  for (const r of records) {
    if (r.analysisStatus !== "ANALYZED" || !r.analysisJson || typeof r.analysisJson !== "object") {
      map.set("NO_DATA", (map.get("NO_DATA") ?? 0) + 1);
      continue;
    }
    const aj = r.analysisJson as Record<string, unknown>;
    let dk = aj.documentKind as string | undefined;
    if (!dk) {
      const meta = aj.analysisMeta as Record<string, unknown> | undefined;
      const cov = meta?.coverage as Record<string, unknown> | undefined;
      dk = cov?.documentKind as string | undefined;
    }
    if (dk && ["CFDI", "RETENCIONES", "UNKNOWN"].includes(dk)) {
      map.set(dk, (map.get(dk) ?? 0) + 1);
    } else {
      map.set("NO_DATA", (map.get("NO_DATA") ?? 0) + 1);
    }
  }
  const order = ["CFDI", "RETENCIONES", "UNKNOWN", "NO_DATA"];
  return Array.from(map.entries())
    .map(([documentKind, count]) => ({ documentKind, count }) as DocumentKindAgg)
    .sort((a, b) => order.indexOf(a.documentKind) - order.indexOf(b.documentKind));
}
```

- [ ] **Step 4: Implementar helper derivePriorities**

```typescript
interface PriorityAgg {
  priority: "BLOCKER" | "HIGH" | "MEDIUM" | "LOW" | "NO_DATA";
  findings: number;
  recordsAffected: number;
}

function derivePriorities(
  records: { analysisJson: unknown; analysisStatus: string }[],
): PriorityAgg[] {
  const map = new Map<string, { findings: number; records: Set<string> }>();
  const initPriority = (p: string) => {
    if (!map.has(p)) map.set(p, { findings: 0, records: new Set() });
  };
  initPriority("BLOCKER");
  initPriority("HIGH");
  initPriority("MEDIUM");
  initPriority("LOW");
  initPriority("NO_DATA");

  for (const r of records) {
    if (r.analysisStatus !== "ANALYZED" || !r.analysisJson || typeof r.analysisJson !== "object") {
      const nd = map.get("NO_DATA")!;
      nd.findings++;
      nd.records.add(r.id);
      continue;
    }
    const aj = r.analysisJson as Record<string, unknown>;
    const findings = aj.findings as Array<Record<string, unknown>> | undefined;
    if (!findings || !Array.isArray(findings) || findings.length === 0) {
      const nd = map.get("NO_DATA")!;
      nd.findings++;
      nd.records.add(r.id);
      continue;
    }
    const recordPriorities = new Set<string>();
    for (const f of findings) {
      let priority = f.priority as string | undefined;
      if (!priority) {
        const severity = f.severity as string | undefined;
        if (severity === "CRITICAL") priority = "BLOCKER";
        else if (severity === "WARNING") priority = "HIGH";
        else if (severity === "INFO") priority = "LOW";
        else priority = "NO_DATA";
      }
      if (!["BLOCKER", "HIGH", "MEDIUM", "LOW"].includes(priority)) priority = "NO_DATA";
      const entry = map.get(priority)!;
      entry.findings++;
      recordPriorities.add(priority);
    }
    for (const p of recordPriorities) {
      map.get(p)!.records.add(r.id);
    }
  }

  const order = ["BLOCKER", "HIGH", "MEDIUM", "LOW", "NO_DATA"];
  return Array.from(map.entries())
    .map(
      ([priority, data]) =>
        ({ priority, findings: data.findings, recordsAffected: data.records.size }) as PriorityAgg,
    )
    .sort((a, b) => order.indexOf(a.priority) - order.indexOf(b.priority));
}
```

- [ ] **Step 5: Implementar helper deriveActionGroups**

```typescript
interface ActionGroupAgg {
  actionGroup: string;
  findings: number;
  recordsAffected: number;
  critical: number;
  warning: number;
  info: number;
}

function deriveActionGroups(
  records: { id: string; analysisJson: unknown; analysisStatus: string }[],
): ActionGroupAgg[] {
  const map = new Map<
    string,
    { findings: number; records: Set<string>; critical: number; warning: number; info: number }
  >();

  for (const r of records) {
    if (r.analysisStatus !== "ANALYZED" || !r.analysisJson || typeof r.analysisJson !== "object")
      continue;
    const aj = r.analysisJson as Record<string, unknown>;
    const findings = aj.findings as Array<Record<string, unknown>> | undefined;
    if (!findings || !Array.isArray(findings)) continue;

    const recordGroups = new Set<string>();
    for (const f of findings) {
      const ag = (f.actionGroup as string) || "Sin grupo";
      let entry = map.get(ag);
      if (!entry) {
        entry = { findings: 0, records: new Set(), critical: 0, warning: 0, info: 0 };
        map.set(ag, entry);
      }
      entry.findings++;
      recordGroups.add(ag);
      const severity = f.severity as string;
      if (severity === "CRITICAL") entry.critical++;
      else if (severity === "WARNING") entry.warning++;
      else if (severity === "INFO") entry.info++;
    }
    for (const ag of recordGroups) {
      map.get(ag)!.records.add(r.id);
    }
  }

  return Array.from(map.entries())
    .map(([actionGroup, data]) => ({
      actionGroup,
      findings: data.findings,
      recordsAffected: data.records.size,
      critical: data.critical,
      warning: data.warning,
      info: data.info,
    }))
    .sort((a, b) => b.findings - a.findings);
}
```

- [ ] **Step 6: Implementar helper deriveModulesCoverage**

```typescript
interface ModuleCoverageAgg {
  key: string;
  label: string;
  detectedInRecords: number;
  analyzedInRecords: number;
  findings: number;
  recordsWithFindings: number;
}

function deriveModulesCoverage(
  records: { id: string; analysisJson: unknown; analysisStatus: string }[],
): ModuleCoverageAgg[] {
  const map = new Map<
    string,
    {
      label: string;
      detected: Set<string>;
      analyzed: Set<string>;
      findings: number;
      recordsWithFindings: Set<string>;
    }
  >();

  for (const r of records) {
    if (r.analysisStatus !== "ANALYZED" || !r.analysisJson || typeof r.analysisJson !== "object")
      continue;
    const aj = r.analysisJson as Record<string, unknown>;
    const meta = aj.analysisMeta as Record<string, unknown> | undefined;
    const cov = meta?.coverage as Record<string, unknown> | undefined;
    const modules = cov?.modules as Array<Record<string, unknown>> | undefined;
    if (!modules || !Array.isArray(modules)) continue;

    for (const mod of modules) {
      const key = mod.key as string;
      const label = mod.label as string;
      if (!key) continue;
      let entry = map.get(key);
      if (!entry) {
        entry = {
          label,
          detected: new Set(),
          analyzed: new Set(),
          findings: 0,
          recordsWithFindings: new Set(),
        };
        map.set(key, entry);
      }
      if (mod.detected) entry.detected.add(r.id);
      if (mod.analyzed) entry.analyzed.add(r.id);
      const fCount = typeof mod.findingsCount === "number" ? mod.findingsCount : 0;
      if (fCount > 0) {
        entry.findings += fCount;
        entry.recordsWithFindings.add(r.id);
      }
    }
  }

  return Array.from(map.entries())
    .map(([key, data]) => ({
      key,
      label: data.label,
      detectedInRecords: data.detected.size,
      analyzedInRecords: data.analyzed.size,
      findings: data.findings,
      recordsWithFindings: data.recordsWithFindings.size,
    }))
    .sort((a, b) => b.findings - a.findings);
}
```

- [ ] **Step 7: Implementar helper derivePerformance**

```typescript
interface PerformanceAgg {
  recordsWithMeta: number;
  totalMs: number;
  avgMs: number;
  maxMs: number;
  minMs: number;
  totalInputKb: number;
  avgInputKb: number;
  totalFindingsOriginal: number;
  totalFindingsReturned: number;
  recordsWithTruncatedFindings: number;
}

function derivePerformance(
  records: { analysisJson: unknown; analysisStatus: string }[],
): PerformanceAgg {
  let recordsWithMeta = 0;
  let totalMs = 0;
  let maxMs = 0;
  let minMs = Infinity;
  let totalInputKb = 0;
  let totalFindingsOriginal = 0;
  let totalFindingsReturned = 0;
  let recordsWithTruncatedFindings = 0;

  for (const r of records) {
    if (r.analysisStatus !== "ANALYZED" || !r.analysisJson || typeof r.analysisJson !== "object")
      continue;
    const aj = r.analysisJson as Record<string, unknown>;
    const meta = aj.analysisMeta as Record<string, unknown> | undefined;
    const perf = meta?.performance as Record<string, unknown> | undefined;
    if (!perf) continue;

    recordsWithMeta++;
    const ms = typeof perf.totalMs === "number" ? perf.totalMs : 0;
    totalMs += ms;
    if (ms > maxMs) maxMs = ms;
    if (ms < minMs) minMs = ms;

    const kb = typeof perf.inputKb === "number" ? perf.inputKb : 0;
    totalInputKb += kb;

    const orig = typeof perf.findingsOriginalCount === "number" ? perf.findingsOriginalCount : 0;
    totalFindingsOriginal += orig;

    const ret = typeof perf.findingsReturnedCount === "number" ? perf.findingsReturnedCount : 0;
    totalFindingsReturned += ret;

    if (perf.findingsTruncated) recordsWithTruncatedFindings++;
  }

  return {
    recordsWithMeta,
    totalMs,
    avgMs: recordsWithMeta > 0 ? Math.round((totalMs / recordsWithMeta) * 100) / 100 : 0,
    maxMs,
    minMs: recordsWithMeta > 0 ? minMs : 0,
    totalInputKb: Math.round(totalInputKb * 100) / 100,
    avgInputKb: recordsWithMeta > 0 ? Math.round((totalInputKb / recordsWithMeta) * 100) / 100 : 0,
    totalFindingsOriginal,
    totalFindingsReturned,
    recordsWithTruncatedFindings,
  };
}
```

- [ ] **Step 8: Implementar helper deriveTopFindingCodes**

```typescript
interface TopFindingCodeAgg {
  code: string;
  title: string;
  severityMax: string;
  priorityMax: string;
  actionGroup: string | null;
  count: number;
  recordsAffected: number;
}

const severityRank: Record<string, number> = { CRITICAL: 0, WARNING: 1, INFO: 2 };
const priorityRank: Record<string, number> = { BLOCKER: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

function deriveTopFindingCodes(
  records: { id: string; analysisJson: unknown; analysisStatus: string }[],
): TopFindingCodeAgg[] {
  const map = new Map<
    string,
    {
      title: string;
      severityMax: string;
      priorityMax: string;
      actionGroupCounts: Map<string, number>;
      count: number;
      records: Set<string>;
    }
  >();

  for (const r of records) {
    if (r.analysisStatus !== "ANALYZED" || !r.analysisJson || typeof r.analysisJson !== "object")
      continue;
    const aj = r.analysisJson as Record<string, unknown>;
    const findings = aj.findings as Array<Record<string, unknown>> | undefined;
    if (!findings || !Array.isArray(findings)) continue;

    for (const f of findings) {
      const code = f.code as string;
      if (!code) continue;
      let entry = map.get(code);
      if (!entry) {
        entry = {
          title: "",
          severityMax: "INFO",
          priorityMax: "LOW",
          actionGroupCounts: new Map(),
          count: 0,
          records: new Set(),
        };
        map.set(code, entry);
      }
      entry.count++;
      entry.records.add(r.id);

      if (!entry.title && f.title) entry.title = f.title as string;

      const sev = f.severity as string;
      if (
        sev &&
        severityRank[sev] !== undefined &&
        severityRank[sev] < severityRank[entry.severityMax]
      ) {
        entry.severityMax = sev;
      }

      const pri = f.priority as string;
      if (
        pri &&
        priorityRank[pri] !== undefined &&
        priorityRank[pri] < priorityRank[entry.priorityMax]
      ) {
        entry.priorityMax = pri;
      } else if (!pri) {
        const derivedSev = f.severity as string;
        let derivedPri = "LOW";
        if (derivedSev === "CRITICAL") derivedPri = "BLOCKER";
        else if (derivedSev === "WARNING") derivedPri = "HIGH";
        if (priorityRank[derivedPri] < priorityRank[entry.priorityMax]) {
          entry.priorityMax = derivedPri;
        }
      }

      const ag = f.actionGroup as string | undefined;
      if (ag) {
        entry.actionGroupCounts.set(ag, (entry.actionGroupCounts.get(ag) ?? 0) + 1);
      }
    }
  }

  return Array.from(map.entries())
    .map(([code, data]) => {
      let bestAg: string | null = null;
      let bestCount = 0;
      for (const [ag, c] of data.actionGroupCounts) {
        if (c > bestCount) {
          bestCount = c;
          bestAg = ag;
        }
      }
      return {
        code,
        title: data.title || code,
        severityMax: data.severityMax,
        priorityMax: data.priorityMax,
        actionGroup: bestAg,
        count: data.count,
        recordsAffected: data.records.size,
      };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);
}
```

- [ ] **Step 9: Implementar helper deriveTopModulesByFindings**

```typescript
interface TopModuleAgg {
  key: string;
  label: string;
  findings: number;
  recordsAffected: number;
}

function deriveTopModulesByFindings(
  records: { id: string; analysisJson: unknown; analysisStatus: string }[],
): TopModuleAgg[] {
  const map = new Map<string, { label: string; findings: number; records: Set<string> }>();

  for (const r of records) {
    if (r.analysisStatus !== "ANALYZED" || !r.analysisJson || typeof r.analysisJson !== "object")
      continue;
    const aj = r.analysisJson as Record<string, unknown>;
    const meta = aj.analysisMeta as Record<string, unknown> | undefined;
    const cov = meta?.coverage as Record<string, unknown> | undefined;
    const modules = cov?.modules as Array<Record<string, unknown>> | undefined;
    if (!modules || !Array.isArray(modules)) continue;

    for (const mod of modules) {
      const key = mod.key as string;
      if (!key) continue;
      const fCount = typeof mod.findingsCount === "number" ? mod.findingsCount : 0;
      if (fCount === 0) continue;
      let entry = map.get(key);
      if (!entry) {
        entry = { label: (mod.label as string) || key, findings: 0, records: new Set() };
        map.set(key, entry);
      }
      entry.findings += fCount;
      entry.records.add(r.id);
    }
  }

  return Array.from(map.entries())
    .map(([key, data]) => ({
      key,
      label: data.label,
      findings: data.findings,
      recordsAffected: data.records.size,
    }))
    .sort((a, b) => b.findings - a.findings)
    .slice(0, 10);
}
```

- [ ] **Step 10: Integrar analyticsV2 en el handler**

Después de la query original existente y la nueva query `v2Records`, agregar al response:

```typescript
const onlyAnalyzed = v2Records.filter((r) => r.analysisStatus === "ANALYZED");

const analyticsV2 = {
  documentKinds: deriveDocumentKinds(v2Records),
  priorities: derivePriorities(v2Records),
  actionGroups: deriveActionGroups(v2Records),
  modulesCoverage: deriveModulesCoverage(v2Records),
  performance: derivePerformance(v2Records),
  topFindingCodes: deriveTopFindingCodes(v2Records),
  topModulesByFindings: deriveTopModulesByFindings(v2Records),
};

// En el return, agregar analyticsV2:
return reply.send({
  // ...existing fields...
  analyticsV2,
});
```

Si `v2Records.length === 0`, enviar `analyticsV2: undefined` (para que el frontend muestre fallback).

- [ ] **Step 11: Verificar typecheck**

Run: `pnpm --filter @fiscora/api typecheck`
Expected: PASS

---

### Task 2: Frontend — Tipos en admin.ts

**Files:**

- Modify: `apps/web/src/api/admin.ts:632-704`

**Interfaces:**

- Consumes: response de `GET /api/admin/xml-analytics/summary` con nuevo campo `analyticsV2`
- Produces: nuevos tipos `AnalyticsV2` y subtipos exportados

- [ ] **Step 1: Agregar tipos analyticsV2 en admin.ts**

Después de la interfaz `XmlAnalyticsSummary` (line 676):

```typescript
export interface DocumentKindAggregate {
  documentKind: "CFDI" | "RETENCIONES" | "UNKNOWN" | "NO_DATA";
  count: number;
}

export interface PriorityAggregate {
  priority: "BLOCKER" | "HIGH" | "MEDIUM" | "LOW" | "NO_DATA";
  findings: number;
  recordsAffected: number;
}

export interface ActionGroupAggregate {
  actionGroup: string;
  findings: number;
  recordsAffected: number;
  critical: number;
  warning: number;
  info: number;
}

export interface ModuleCoverageAggregate {
  key: string;
  label: string;
  detectedInRecords: number;
  analyzedInRecords: number;
  findings: number;
  recordsWithFindings: number;
}

export interface PerformanceAggregate {
  recordsWithMeta: number;
  totalMs: number;
  avgMs: number;
  maxMs: number;
  minMs: number;
  totalInputKb: number;
  avgInputKb: number;
  totalFindingsOriginal: number;
  totalFindingsReturned: number;
  recordsWithTruncatedFindings: number;
}

export interface TopFindingCodeAggregate {
  code: string;
  title: string;
  severityMax: string;
  priorityMax: string;
  actionGroup: string | null;
  count: number;
  recordsAffected: number;
}

export interface TopModuleAggregate {
  key: string;
  label: string;
  findings: number;
  recordsAffected: number;
}

export interface AnalyticsV2 {
  documentKinds: DocumentKindAggregate[];
  priorities: PriorityAggregate[];
  actionGroups: ActionGroupAggregate[];
  modulesCoverage: ModuleCoverageAggregate[];
  performance: PerformanceAggregate;
  topFindingCodes: TopFindingCodeAggregate[];
  topModulesByFindings: TopModuleAggregate[];
}
```

- [ ] **Step 2: Actualizar XmlAnalyticsSummary para incluir analyticsV2 opcional**

```typescript
export interface XmlAnalyticsSummary {
  // ... existing fields (unchanged) ...
  analyticsV2?: AnalyticsV2;
}
```

- [ ] **Step 3: Verificar typecheck**

Run: `pnpm --filter @fiscora/web typecheck`
Expected: PASS

---

### Task 3: Frontend — AdminAnalyticsPage.tsx nuevas secciones

**Files:**

- Modify: `apps/web/src/pages/AdminAnalyticsPage.tsx`

**Interfaces:**

- Consumes: `data.analyticsV2` del summary response

- [ ] **Step 1: Agregar import de AnalyticsV2**

Agregar a la línea de imports:

```typescript
import {
  getXmlAnalyticsSummary,
  type XmlAnalyticsSummary,
  type XmlAnalyticsQuery,
  type AnalyticsV2,
} from "../api/admin";
```

- [ ] **Step 2: Agregar sección de Documentos analizados**

Después del cierre de la sección Técnico (después de line 258), insertar:

```tsx
{
  data.analyticsV2 && (
    <>
      <h2 className="text-lg font-semibold mb-3 mt-8">Documentos analizados</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {data.analyticsV2.documentKinds.length === 0 ? (
          <div className="col-span-full text-center text-gray-500 py-4">
            Sin información disponible
          </div>
        ) : (
          data.analyticsV2.documentKinds.map((dk) => (
            <div
              key={dk.documentKind}
              className="bg-gray-800/60 border border-gray-700/50 rounded-xl p-4 flex flex-col"
            >
              <span className="text-xs text-gray-400 uppercase tracking-wide mb-1">
                {dk.documentKind === "CFDI"
                  ? "CFDI"
                  : dk.documentKind === "RETENCIONES"
                    ? "Retenciones"
                    : dk.documentKind === "UNKNOWN"
                      ? "Unknown"
                      : "Sin data"}
              </span>
              <span className="text-2xl font-bold text-blue-400">{dk.count}</span>
            </div>
          ))
        )}
      </div>
    </>
  );
}
```

- [ ] **Step 3: Agregar sección de Prioridades globales**

```tsx
{
  data.analyticsV2 && (
    <>
      <h2 className="text-lg font-semibold mb-3">Prioridades globales</h2>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        {data.analyticsV2.priorities.length === 0 ? (
          <div className="col-span-full text-center text-gray-500 py-4">
            Sin información disponible
          </div>
        ) : (
          data.analyticsV2.priorities.map((p) => (
            <div
              key={p.priority}
              className="bg-gray-800/60 border border-gray-700/50 rounded-xl p-4 flex flex-col"
            >
              <span className="text-xs text-gray-400 uppercase tracking-wide mb-1">
                {p.priority === "BLOCKER"
                  ? "Bloqueantes"
                  : p.priority === "HIGH"
                    ? "Alta"
                    : p.priority === "MEDIUM"
                      ? "Media"
                      : p.priority === "LOW"
                        ? "Informativa"
                        : "Sin data"}
              </span>
              <span
                className={`text-2xl font-bold ${
                  p.priority === "BLOCKER"
                    ? "text-red-400"
                    : p.priority === "HIGH"
                      ? "text-orange-400"
                      : p.priority === "MEDIUM"
                        ? "text-yellow-400"
                        : "text-gray-300"
                }`}
              >
                {p.findings}
              </span>
              <span className="text-xs text-gray-500 mt-1">{p.recordsAffected} registros</span>
            </div>
          ))
        )}
      </div>
    </>
  );
}
```

- [ ] **Step 4: Agregar sección de Grupos accionables**

```tsx
{
  data.analyticsV2 && data.analyticsV2.actionGroups.length > 0 && (
    <div className="mb-6">
      <h2 className="text-lg font-semibold mb-3">Grupos accionables</h2>
      <div className="bg-gray-800/40 border border-gray-700/50 rounded-xl p-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-400 border-b border-gray-700/50">
              <th className="pb-2 font-medium">Grupo accionable</th>
              <th className="pb-2 font-medium text-right">Hallazgos</th>
              <th className="pb-2 font-medium text-right">Registros afectados</th>
              <th className="pb-2 font-medium text-right">Críticos</th>
              <th className="pb-2 font-medium text-right">Advertencias</th>
              <th className="pb-2 font-medium text-right">Info</th>
            </tr>
          </thead>
          <tbody>
            {data.analyticsV2.actionGroups.map((ag) => (
              <tr key={ag.actionGroup} className="border-b border-gray-700/30 hover:bg-gray-700/20">
                <td className="py-2 max-w-[200px] truncate" title={ag.actionGroup}>
                  {ag.actionGroup}
                </td>
                <td className="py-2 text-right font-mono">{ag.findings}</td>
                <td className="py-2 text-right font-mono">{ag.recordsAffected}</td>
                <td className="py-2 text-right font-mono text-red-400">{ag.critical}</td>
                <td className="py-2 text-right font-mono text-yellow-400">{ag.warning}</td>
                <td className="py-2 text-right font-mono text-cyan-400">{ag.info}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Agregar sección de Cobertura por módulo**

```tsx
{
  data.analyticsV2 && data.analyticsV2.modulesCoverage.length > 0 && (
    <div className="mb-6">
      <h2 className="text-lg font-semibold mb-3">Cobertura por módulo</h2>
      <div className="bg-gray-800/40 border border-gray-700/50 rounded-xl p-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-400 border-b border-gray-700/50">
              <th className="pb-2 font-medium">Módulo</th>
              <th className="pb-2 font-medium text-right">Detectado en registros</th>
              <th className="pb-2 font-medium text-right">Analizado en registros</th>
              <th className="pb-2 font-medium text-right">Hallazgos</th>
              <th className="pb-2 font-medium text-right">Registros con hallazgos</th>
            </tr>
          </thead>
          <tbody>
            {data.analyticsV2.modulesCoverage.map((m) => (
              <tr key={m.key} className="border-b border-gray-700/30 hover:bg-gray-700/20">
                <td className="py-2 max-w-[200px] truncate" title={m.label}>
                  {m.label}
                </td>
                <td className="py-2 text-right font-mono">{m.detectedInRecords}</td>
                <td className="py-2 text-right font-mono">{m.analyzedInRecords}</td>
                <td className="py-2 text-right font-mono">{m.findings}</td>
                <td className="py-2 text-right font-mono">{m.recordsWithFindings}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Agregar sección de Performance del motor**

```tsx
{
  data.analyticsV2 && (
    <>
      <h2 className="text-lg font-semibold mb-3">Performance del motor</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 mb-6">
        {card(
          "Registros con metadata",
          data.analyticsV2.performance.recordsWithMeta,
          "text-blue-400",
        )}
        {card("Tiempo promedio", `${data.analyticsV2.performance.avgMs} ms`, "text-cyan-400")}
        {card("Tiempo máximo", `${data.analyticsV2.performance.maxMs} ms`, "text-orange-400")}
        {card("Tiempo mínimo", `${data.analyticsV2.performance.minMs} ms`, "text-green-400")}
        {card("KB promedio", `${data.analyticsV2.performance.avgInputKb} KB`, "text-purple-400")}
        {card(
          "Hallazgos originales",
          data.analyticsV2.performance.totalFindingsOriginal,
          "text-yellow-400",
        )}
        {card(
          "Hallazgos devueltos",
          data.analyticsV2.performance.totalFindingsReturned,
          "text-blue-400",
        )}
        {card(
          "Registros truncados",
          data.analyticsV2.performance.recordsWithTruncatedFindings,
          data.analyticsV2.performance.recordsWithTruncatedFindings > 0
            ? "text-red-400"
            : "text-gray-300",
        )}
      </div>
    </>
  );
}
```

- [ ] **Step 7: Agregar sección de Top hallazgos**

```tsx
{
  data.analyticsV2 && data.analyticsV2.topFindingCodes.length > 0 && (
    <div className="mb-6">
      <h2 className="text-lg font-semibold mb-3">Top hallazgos</h2>
      <div className="bg-gray-800/40 border border-gray-700/50 rounded-xl p-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-400 border-b border-gray-700/50">
              <th className="pb-2 font-medium">Código</th>
              <th className="pb-2 font-medium">Título</th>
              <th className="pb-2 font-medium text-right">Severidad</th>
              <th className="pb-2 font-medium text-right">Prioridad</th>
              <th className="pb-2 font-medium">Grupo accionable</th>
              <th className="pb-2 font-medium text-right">Apariciones</th>
              <th className="pb-2 font-medium text-right">Registros afectados</th>
            </tr>
          </thead>
          <tbody>
            {data.analyticsV2.topFindingCodes.map((fc) => (
              <tr key={fc.code} className="border-b border-gray-700/30 hover:bg-gray-700/20">
                <td className="py-2 font-mono text-xs max-w-[120px] truncate" title={fc.code}>
                  {fc.code}
                </td>
                <td className="py-2 max-w-[200px] truncate" title={fc.title}>
                  {fc.title}
                </td>
                <td
                  className={`py-2 text-right font-mono ${
                    fc.severityMax === "CRITICAL"
                      ? "text-red-400"
                      : fc.severityMax === "WARNING"
                        ? "text-yellow-400"
                        : "text-cyan-400"
                  }`}
                >
                  {fc.severityMax}
                </td>
                <td
                  className={`py-2 text-right font-mono ${
                    fc.priorityMax === "BLOCKER"
                      ? "text-red-400"
                      : fc.priorityMax === "HIGH"
                        ? "text-orange-400"
                        : fc.priorityMax === "MEDIUM"
                          ? "text-yellow-400"
                          : "text-gray-300"
                  }`}
                >
                  {fc.priorityMax}
                </td>
                <td className="py-2 max-w-[150px] truncate" title={fc.actionGroup ?? "—"}>
                  {fc.actionGroup ?? "—"}
                </td>
                <td className="py-2 text-right font-mono">{fc.count}</td>
                <td className="py-2 text-right font-mono">{fc.recordsAffected}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Agregar sección de Top módulos por hallazgos**

```tsx
{
  data.analyticsV2 && data.analyticsV2.topModulesByFindings.length > 0 && (
    <div className="mb-6">
      <h2 className="text-lg font-semibold mb-3">Top módulos por hallazgos</h2>
      <div className="bg-gray-800/40 border border-gray-700/50 rounded-xl p-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-400 border-b border-gray-700/50">
              <th className="pb-2 font-medium">Módulo</th>
              <th className="pb-2 font-medium text-right">Hallazgos</th>
              <th className="pb-2 font-medium text-right">Registros afectados</th>
            </tr>
          </thead>
          <tbody>
            {data.analyticsV2.topModulesByFindings.map((tm) => (
              <tr key={tm.key} className="border-b border-gray-700/30 hover:bg-gray-700/20">
                <td className="py-2 max-w-[200px] truncate" title={tm.label}>
                  {tm.label}
                </td>
                <td className="py-2 text-right font-mono">{tm.findings}</td>
                <td className="py-2 text-right font-mono">{tm.recordsAffected}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 9: Verificar typecheck**

Run: `pnpm --filter @fiscora/web typecheck`
Expected: PASS

---

### Task 4: Verificación final

- [ ] **Step 1: Correr typecheck global**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 2: Correr lint**

Run: `pnpm lint`
Expected: PASS

- [ ] **Step 3: Correr formateo**

Run: `pnpm format`
Expected: PASS

- [ ] **Step 4: Correr regresión xml-audit**

Run: `pnpm --filter @fiscora/api xml-audit:regression`
Expected: 124/124
