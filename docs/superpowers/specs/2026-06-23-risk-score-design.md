# Risk Score / Salud Fiscal — Design Doc

> **Goal:** Implementar scoring inteligente de riesgo/salud fiscal 100% frontend para análisis XML individual, ZIP, historial y dashboard.

**Arquitectura:** Capa de helpers puros (`riskScore.helpers.ts`) + componente UI (`RiskScorePanel.tsx`) insertado en páginas existentes sin modificar backend, Prisma, endpoints ni lógica fiscal.

**Constraints:** No nuevas dependencias, no nuevas llamadas API, no exponer XML raw, normalizedXml.content, Addenda raw, sellos/certificados completos, tokens/session/secrets, analysisJson completo.

---

## Helper Layer — `riskScore.helpers.ts`

### `calculateFindingWeight(finding)`
- Base: CRITICAL=25, WARNING=8, INFO=2
- Priority bonus: BLOCKER=+25, HIGH=+12, MEDIUM=+5, LOW=+0
- ActionGroup bonus: TAX/IMPUESTOS/importes/total/pago/retenciones=+5, CFDI_STRUCTURE/TIMBRADO/TFD/certificado=+4, CATALOGS/REVIEW=+1
- ValueTrace: difference numérica > 0 = +3
- Cap: 50 por finding

### `calculateRiskScore(findings, options?)`
- rawRisk = sum(weights). score = max(0, 100 - rawRisk)
- Caps: BLOCKER presente → max 45; CRITICAL presente → max 65; >5 WARNING → max 75; sin findings → 100

### `calculateApproximateRiskScore(counts)`
- Para contextos sin findings completos (dashboard, history list)
- Usa criticalCount, warningCount, infoCount, priorityMax
- Misma fórmula base con penalización proporcional

### `getRiskBand(score, findings)` → `"HEALTHY" | "REVIEW" | "HIGH_RISK" | "BLOCKED"`
- HEALTHY: score ≥ 90 sin CRITICAL/BLOCKER
- REVIEW: score 70–89 o warnings relevantes
- HIGH_RISK: score 40–69 o criticals
- BLOCKED: score < 40 o blocker

### `getRiskBandDescription(band)` → string español
- Saludable / Revisión recomendada / Alto riesgo / Bloqueante

### `getTopRiskDrivers(findings, limit=5)` → top findings por weight
### `aggregateRiskByModule(findings)` → riesgo agregado por módulo
### `aggregateRiskByActionGroup(findings)` → riesgo agregado por actionGroup
### `calculateZipRiskScore(files)` → score lote + stats
- Promedio ponderado por archivos analizados
- Fallidos penalizan fuerte; BLOCKER → lote max 60; >20% CRITICAL → max 50

---

## Component Layer — `RiskScorePanel.tsx`

### Props
```ts
interface RiskScorePanelProps {
  findings?: Finding[];
  approximateCounts?: { criticalCount: number; warningCount: number; infoCount: number; priorityMax?: string | null };
  zipSummary?: ZipRiskScore;
  files?: ZipFullAnalysisFileResult[];
  title?: string;
  compact?: boolean;
  showModules?: boolean;
  showDrivers?: boolean;
}
```

### Rendering modes

**Full** (compact=false): Score grande + badge banda + descripción ejecutiva + cards (críticos, advertencias, bloqueantes, módulos, con diferencia) + top 5 causas + tabla riesgo por módulo.

**Compact** (compact=true): Score + badge + top 3 drivers.

**ZipSummary** (zipSummary prop): Score lote + bandas + archivos alto riesgo + fallidos + top 5.

**Estimated** (approximateCounts prop): Score con badge "estimado" + resumen básico.

---

## Integration Points

| File | Location | Mode |
|---|---|---|
| `XmlAuditPage.tsx` | Después de executive summary, antes de FindingExplorer | Full |
| `MassiveDetailModal.tsx` | Después de badges de severidad | Compact |
| ZIP results (`XmlAuditPage.tsx`) | En sección ZIP completa | ZipSummary |
| `XmlAuditHistoryPage.tsx` — detalle | En modal de detalle | Full |
| `XmlAuditHistoryPage.tsx` — lista | Score por registro en tabla | Estimated |
| `XmlAuditDashboardPage.tsx` | Sección "Salud fiscal reciente" | Estimated |
| `AdminXmlAnalysesPage.tsx` — detalle | En detalle admin | Full |
| `PrintableIndividualReport.tsx` | Cabecera del reporte | Score + Badge + description |
| `csvExports.ts` | Columnas nuevas | N/A |

## Seguridad

No exponer: XML fuente, normalizedXml.content, Addenda raw, sello completo, certificado completo, tokens/session/cookies/secrets, analysisJson completo. Solo findings sanitizados.

## Performance

- useMemo para cada cálculo de score por analysis result
- Para ZIP grande, calcular una vez por cambio de resultado
- Evitar recalcular en cada render
- No loops costosos innecesarios

## Verificación

- `pnpm --filter @fiscora/web typecheck`
- `pnpm lint`
- `pnpm --filter @fiscora/api xml-audit:regression` (debe seguir 270/270)
