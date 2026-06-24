# Coverage Confidence Center - Design Specification

## Overview

Frontend-only panel that displays XML engine coverage, confidence level, payload policies, and unknown complements using existing backend data (`analysisMeta`, `coverage`, `payloadPolicy`, `structureDiagnostics`).

## Architecture

### Files to Create

1. `apps/web/src/pages/xml-audit/coverageConfidence.helpers.ts` - Pure functions for coverage/confidence calculations
2. `apps/web/src/pages/xml-audit/CoverageConfidencePanel.tsx` - Reactive component with compact/full variants

### Files to Modify

- `apps/web/src/pages/XmlAuditPage.tsx` - Add panel after RiskScorePanel
- `apps/web/src/pages/xml-audit/MassiveDetailModal.tsx` - Add compact panel
- `apps/web/src/pages/XmlAuditHistoryPage.tsx` - Add panel in detail view
- `apps/web/src/pages/XmlAuditZipBatchesPage.tsx` - Add batch summary aggregation
- `apps/web/src/pages/XmlAuditDashboardPage.tsx` - Add summary card
- `apps/web/src/pages/AdminXmlAnalysesPage.tsx` - Add panel in detail
- `apps/web/src/pages/xml-audit/PrintableIndividualReport.tsx` - Add compact section
- `apps/web/src/pages/xml-audit/PrintableZipReport.tsx` - Add batch section
- `apps/web/src/pages/xml-audit/csvExports.ts` - Optional columns for exports

## Helper Design: coverageConfidence.helpers.ts

### Types

```typescript
interface CoverageModuleRow {
  module: string;
  label: string;
  detected: boolean;
  analyzed: boolean;
  skippedReason?: string | null;
  findingsCount: number;
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  confidenceImpact: number; // -5 to 0
  notes?: string;
}

interface CoverageSummary {
  totalModules: number;
  detectedModules: number;
  analyzedModules: number;
  skippedModules: number;
  modulesWithFindings: number;
  modulesWithoutFindings: number;
  unknownModules: number;
  totalFindings: number;
  findingsByModule: Record<string, number>;
  confidenceScore: number;
}

interface PayloadPolicySummary {
  sanitized: boolean;
  findingsReturned: number;
  findingsOriginal: number;
  findingsTruncated: boolean;
  evidenceMaxLength: number;
  sensitiveFieldsRedacted: boolean;
  normalizedXmlContentExcluded: boolean;
  addendaRawExcluded: boolean;
  sourceXmlExcluded: boolean;
}
```

### Functions

1. `normalizeCoverageModule(module: AnalysisCoverageModule): CoverageModuleRow` - Normalizes backend module data
2. `buildCoverageSummary(result: AnalysisResult): CoverageSummary` - Aggregates from `analysisMeta.coverage` + findings inference
3. `calculateConfidenceScore(result: AnalysisResult, summary: CoverageSummary): number` - 0-100 score (NOT risk score)
4. `getConfidenceBand(score: number): "high" | "good" | "partial" | "limited"` - Categorizes score
5. `getConfidenceDescription(band: string, summary: CoverageSummary): string` - Executive description
6. `buildModuleCoverageRows(result: AnalysisResult, summary: CoverageSummary): CoverageModuleRow[]` - Table rows
7. `buildPayloadPolicySummary(result: AnalysisResult): PayloadPolicySummary | null`
8. `buildUnknownComplementsSummary(result: AnalysisResult): { known: string[]; unknown: string[]; hasAddenda: boolean } | null`
9. `aggregateZipCoverage(files: ZipFullAnalysisFileResult[]): { avgConfidence: number; limitedCount: number; unknownComplementsCount: number }`

## Confidence Score Algorithm

Base: 100
Penalties:

- -15: No `analysisMeta` present
- -10: No `coverage` data
- -10: Findings truncated (`findingsTruncated: true`)
- -10: Strong payload truncamiento (`sanitized: true` + limits restrictive)
- -8: Any module with `unknown` category
- -5: Unknown complements detected
- -5: No `isStamped` (no fiscal stamp)
- -5: Analysis failed (`status === "FAILED"`)
  Min: 0, Max: 95+

## Component Design: CoverageConfidencePanel

### Props

```typescript
interface CoverageConfidencePanelProps {
  result?: AnalysisResult | ZipFullAnalysisFileResult;
  zipFiles?: ZipFullAnalysisFileResult[];
  compact?: boolean;
  title?: string;
  showPayloadPolicy?: boolean;
  showUnknownComplements?: boolean;
  showModuleTable?: boolean;
}
```

### Sections

**A) Header de Confianza**

- Score numérico (0-100)
- Badge con banda (Alta confianza / Buena cobertura / Cobertura parcial / Cobertura limitada)
- Descripción ejecutiva corta

**B) Cards de Cobertura** (non-compact)

- Módulos detectados vs analizados
- Módulos omitidos/no aplicables
- Módulos con hallazgos
- Complementos no clasificados
- Hallazgos devueltos vs originales (si hay truncamiento)

**C) Tabla de Módulos** (non-compact)
Columns: Módulo | Detectado | Analizado | Hallazgos | Críticos | Advertencias | Estado

**D) Política de Payload / Seguridad** (compact variant shows minimal)

- XML fuente excluido
- Addenda raw excluida
- Evidence sanitizado
- Findings truncados sí/no

**E) Complementos no clasificados**

- Lista si existen
- Mensaje conservador sobre qué se hizo con la evidencia

## Integration Points

### XmlAuditPage (individual analysis)

- Full panel after RiskScorePanel
- Uses `analysis` prop directly

### MassiveDetailModal

- Compact panel with score + badge + module counts
- Uses selected file's analysis

### XmlAuditHistoryPage

- Full panel in detail view
- For list view, show simple indicator if `findingsCount > 0`

### XmlAuditZipBatchesPage

- Batch aggregation showing avg confidence across files
- Highlight files with coverage limitada

### XmlAuditDashboardPage

- Summary card with avg confidence trend
- Count of unknown complements this period

### AdminXmlAnalysesPage

- Full panel in admin detail view

### Printable Reports

- Compact section with key metrics
- Security note about excluded content

### CSV Exports

- Optional columns: confidenceScore, confidenceBand, modulesAnalyzed, unknownComplementsCount, findingsTruncated

## Security Notes

- Never display: XML source, normalizedXml.content, Addenda raw, full sellos, certificados completos, tokens, secrets
- Only show sanitized evidence (already handled by backend)
- Only show SHA-256 hashes (already present in NormalizedXml)

## Performance

- All calculations memoized
- No XML parsing
- No backend calls
- Batch aggregations use single-pass iteration
