import {
  type ConceptInfo,
  type GlobalTaxesInfo,
} from "./xml-audit.service.js";

export interface TaxAdvancedValidationContext {
  concepts: ConceptInfo[];
  globalTaxes: GlobalTaxesInfo | null;
  subtotal: string | null;
  total: string | null;
  descuento: string | null;
  addFinding: (
    code: string,
    severity: "INFO" | "WARNING" | "CRITICAL",
    title: string,
    message: string,
    recommendedAction?: string,
    evidence?: { label: string; value?: string }[],
  ) => void;
}

const SIETE_CENTESIMAS = 0.01;
const ISR = "001";
const IVA = "002";
const IEPS = "003";
const TASA = "Tasa";
const CUOTA = "Cuota";
const EXENTO = "Exento";

function toNum(v: string | null | undefined): number | null {
  if (v == null) return null;
  const n = parseFloat(v.replace(",", ""));
  return isNaN(n) ? null : n;
}

function toMoney(v: string | null | undefined): number {
  const n = toNum(v);
  return n != null ? Math.round(n * 100) / 100 : 0;
}

function fmt(v: number): string {
  return Math.round(v * 100) / 100 + "";
}

function padRate(v: string): string {
  const trimmed = v.trim();
  if (trimmed.includes(".")) return trimmed;
  return trimmed;
}

function normalizeTipoFactor(v: string | null | undefined): string {
  if (!v) return "";
  const s = v.trim();
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function key(impuesto?: string | null, tipoFactor?: string | null, tasaOCuota?: string | null): string {
  return `${impuesto ?? ""}|${normalizeTipoFactor(tipoFactor)}|${tasaOCuota ?? ""}`;
}

function sumByKey(
  concepts: ConceptInfo[],
  type: "TRANSFERRED" | "WITHHELD",
  field: "base" | "importe",
): Map<string, number> {
  const m = new Map<string, number>();
  for (const c of concepts) {
    if (!c.impuestos) continue;
    const entries = type === "TRANSFERRED" ? c.impuestos.traslados : c.impuestos.retenciones;
    for (const e of entries) {
      const k = key(e.impuesto, e.tipoFactor, e.tasaOCuota);
      m.set(k, (m.get(k) ?? 0) + toMoney(e[field]));
    }
  }
  return m;
}

function sumGlobalByKey(
  globalTaxes: GlobalTaxesInfo,
  type: "TRANSFERRED" | "WITHHELD",
  field: "base" | "importe",
): Map<string, number> {
  const m = new Map<string, number>();
  const entries = type === "TRANSFERRED" ? globalTaxes.transferred : globalTaxes.withheld;
  for (const e of entries) {
    const k = key(e.impuesto, e.tipoFactor, e.tasaOCuota);
    m.set(k, (m.get(k) ?? 0) + toMoney(e[field]));
  }
  return m;
}

export function validateTaxAdvanced(ctx: TaxAdvancedValidationContext): void {
  const { concepts, globalTaxes, total, subtotal, descuento, addFinding } = ctx;
  if (!concepts || concepts.length === 0) return;

  // A1) TAX_BASE_EXCEEDS_CONCEPT_AMOUNT_REVIEW
  for (let ci = 0; ci < concepts.length; ci++) {
    const c = concepts[ci];
    const conceptImporte = toMoney(c.importe);
    if (conceptImporte <= 0) continue;
    if (!c.impuestos) continue;
    for (const entry of c.impuestos.traslados) {
      const base = toMoney(entry.base);
      if (base > conceptImporte + 0.01) {
        addFinding(
          "TAX_BASE_EXCEEDS_CONCEPT_AMOUNT_REVIEW",
          "WARNING",
          "Base del impuesto excede el importe del concepto",
          `Concepto #${ci + 1}: base ${entry.base} > importe concepto ${c.importe}`,
          "Revisa que la base del impuesto no supere el importe del concepto.",
          [
            { label: "Concepto #", value: String(ci + 1) },
            { label: "Impuesto", value: entry.impuesto ?? "—" },
            { label: "TipoFactor", value: entry.tipoFactor ?? "—" },
            { label: "Base", value: entry.base ?? "—" },
            { label: "Importe concepto", value: c.importe ?? "—" },
          ],
        );
      }
    }
  }

  // A4) TAX_AMOUNT_NEGATIVE_REVIEW
  const allConceptTaxEntries: Array<{ conceptIndex: number; scope: string; entry: { base?: string; impuesto?: string; tipoFactor?: string; tasaOCuota?: string; importe?: string } }> = [];
  for (let ci = 0; ci < concepts.length; ci++) {
    const c = concepts[ci];
    if (!c.impuestos) continue;
    for (const t of c.impuestos.traslados) {
      allConceptTaxEntries.push({ conceptIndex: ci, scope: "TRANSFERRED", entry: t });
    }
    for (const r of c.impuestos.retenciones) {
      allConceptTaxEntries.push({ conceptIndex: ci, scope: "WITHHELD", entry: r });
    }
  }
  for (const item of allConceptTaxEntries) {
    const importe = toMoney(item.entry.importe);
    if (importe < 0) {
      addFinding(
        "TAX_AMOUNT_NEGATIVE_REVIEW",
        "WARNING",
        "Importe de impuesto negativo",
        `Concepto #${item.conceptIndex + 1} (${item.scope}): importe ${item.entry.importe}`,
        "Revisa que el importe del impuesto sea correcto.",
        [
          { label: "Concepto #", value: String(item.conceptIndex + 1) },
          { label: "Scope", value: item.scope },
          { label: "Impuesto", value: item.entry.impuesto ?? "—" },
          { label: "TipoFactor", value: item.entry.tipoFactor ?? "—" },
          { label: "Base", value: item.entry.base ?? "—" },
          { label: "Importe", value: item.entry.importe ?? "—" },
        ],
      );
    }
  }

  // A5) TAX_RATE_NEGATIVE_REVIEW
  for (const item of allConceptTaxEntries) {
    if (!isNonEmptyString(item.entry.tasaOCuota)) continue;
    const tasa = toMoney(item.entry.tasaOCuota);
    if (tasa < 0) {
      addFinding(
        "TAX_RATE_NEGATIVE_REVIEW",
        "WARNING",
        "Tasa/Cuota de impuesto negativa",
        `Concepto #${item.conceptIndex + 1} (${item.scope}): tasaOCuota ${item.entry.tasaOCuota}`,
        "Revisa que la tasa o cuota del impuesto sea un valor positivo.",
        [
          { label: "Concepto #", value: String(item.conceptIndex + 1) },
          { label: "Scope", value: item.scope },
          { label: "Impuesto", value: item.entry.impuesto ?? "—" },
          { label: "TipoFactor", value: item.entry.tipoFactor ?? "—" },
          { label: "Base", value: item.entry.base ?? "—" },
          { label: "TasaOCuota", value: item.entry.tasaOCuota ?? "—" },
          { label: "Importe", value: item.entry.importe ?? "—" },
        ],
      );
    }
  }

  // A6) TAX_RATE_TOO_HIGH_REVIEW
  for (const item of allConceptTaxEntries) {
    if (!isNonEmptyString(item.entry.tasaOCuota)) continue;
    const tasa = toNum(item.entry.tasaOCuota);
    if (tasa != null && tasa > 1) {
      addFinding(
        "TAX_RATE_TOO_HIGH_REVIEW",
        "INFO",
        "Tasa/Cuota mayor a 100%",
        `Concepto #${item.conceptIndex + 1} (${item.scope}): tasaOCuota ${item.entry.tasaOCuota}`,
        "Revisa que la tasa o cuota no supere el 100%.",
        [
          { label: "Concepto #", value: String(item.conceptIndex + 1) },
          { label: "Scope", value: item.scope },
          { label: "Impuesto", value: item.entry.impuesto ?? "—" },
          { label: "TipoFactor", value: item.entry.tipoFactor ?? "—" },
          { label: "Base", value: item.entry.base ?? "—" },
          { label: "TasaOCuota", value: item.entry.tasaOCuota ?? "—" },
          { label: "Importe", value: item.entry.importe ?? "—" },
        ],
      );
    }
  }

  // B3) TAX_EXENTO_WITH_RATE_REVIEW
  for (const item of allConceptTaxEntries) {
    const tf = normalizeTipoFactor(item.entry.tipoFactor);
    if (tf === EXENTO && isNonEmptyString(item.entry.tasaOCuota)) {
      addFinding(
        "TAX_EXENTO_WITH_RATE_REVIEW",
        "INFO",
        "Impuesto exento con tasa/cuota especificada",
        `Concepto #${item.conceptIndex + 1} (${item.scope}): TipoFactor Exento pero tasaOCuota=${item.entry.tasaOCuota}`,
        "Un impuesto exento no debería tener tasa o cuota.",
        [
          { label: "Concepto #", value: String(item.conceptIndex + 1) },
          { label: "Scope", value: item.scope },
          { label: "Impuesto", value: item.entry.impuesto ?? "—" },
          { label: "Base", value: item.entry.base ?? "—" },
          { label: "TasaOCuota", value: item.entry.tasaOCuota },
        ],
      );
    }
  }

  // B5) TAX_TASA_ZERO_WITH_AMOUNT_REVIEW
  for (const item of allConceptTaxEntries) {
    const tf = normalizeTipoFactor(item.entry.tipoFactor);
    if (tf !== TASA) continue;
    if (!isNonEmptyString(item.entry.tasaOCuota)) continue;
    const tasa = toNum(item.entry.tasaOCuota);
    if (tasa != null && tasa === 0) {
      const importe = toMoney(item.entry.importe);
      if (importe > 0) {
        addFinding(
          "TAX_TASA_ZERO_WITH_AMOUNT_REVIEW",
          "WARNING",
          "Impuesto con tasa 0 e importe mayor a cero",
          `Concepto #${item.conceptIndex + 1} (${item.scope}): tasaOCuota=0, importe=${item.entry.importe}`,
          "Si la tasa es 0, el importe debería ser 0.",
          [
            { label: "Concepto #", value: String(item.conceptIndex + 1) },
            { label: "Scope", value: item.scope },
            { label: "Impuesto", value: item.entry.impuesto ?? "—" },
            { label: "Base", value: item.entry.base ?? "—" },
            { label: "TasaOCuota", value: item.entry.tasaOCuota },
            { label: "Importe", value: item.entry.importe ?? "—" },
          ],
        );
      }
    }
  }

  // D1) RETENTION_ISR_RATE_UNUSUAL_REVIEW
  for (const item of allConceptTaxEntries) {
    if (item.scope !== "WITHHELD") continue;
    if (item.entry.impuesto !== ISR) continue;
    const tf = normalizeTipoFactor(item.entry.tipoFactor);
    if (tf !== TASA) continue;
    if (!isNonEmptyString(item.entry.tasaOCuota)) continue;
    const rateStr = item.entry.tasaOCuota.trim();
    if (!KNOWN_ISR_RATES.has(rateStr)) {
      addFinding(
        "RETENTION_ISR_RATE_UNUSUAL_REVIEW",
        "INFO",
        "Tasa ISR retención poco común",
        `Concepto #${item.conceptIndex + 1}: tasa ISR=${rateStr}`,
        "Verifica que la tasa de retención ISR sea fiscalmente correcta.",
        [
          { label: "Concepto #", value: String(item.conceptIndex + 1) },
          { label: "Impuesto", value: "001 (ISR)" },
          { label: "TipoFactor", value: "Tasa" },
          { label: "TasaOCuota", value: rateStr },
          { label: "Base", value: item.entry.base ?? "—" },
          { label: "Importe", value: item.entry.importe ?? "—" },
        ],
      );
    }
  }

  // D2) RETENTION_IVA_RATE_UNUSUAL_REVIEW
  for (const item of allConceptTaxEntries) {
    if (item.scope !== "WITHHELD") continue;
    if (item.entry.impuesto !== IVA) continue;
    const tf = normalizeTipoFactor(item.entry.tipoFactor);
    if (tf !== TASA) continue;
    if (!isNonEmptyString(item.entry.tasaOCuota)) continue;
    const rateStr = item.entry.tasaOCuota.trim();
    if (!KNOWN_IVA_RETENTION_RATES.has(rateStr)) {
      addFinding(
        "RETENTION_IVA_RATE_UNUSUAL_REVIEW",
        "INFO",
        "Tasa IVA retención poco común",
        `Concepto #${item.conceptIndex + 1}: tasa IVA retención=${rateStr}`,
        "Verifica que la tasa de retención IVA sea fiscalmente correcta (común: 0.106666 o 0.053333).",
        [
          { label: "Concepto #", value: String(item.conceptIndex + 1) },
          { label: "Impuesto", value: "002 (IVA)" },
          { label: "TipoFactor", value: "Tasa" },
          { label: "TasaOCuota", value: rateStr },
          { label: "Base", value: item.entry.base ?? "—" },
          { label: "Importe", value: item.entry.importe ?? "—" },
        ],
      );
    }
  }

  // D3) RETENTION_IEPS_REVIEW
  for (const item of allConceptTaxEntries) {
    if (item.scope !== "WITHHELD") continue;
    if (item.entry.impuesto !== IEPS) continue;
    addFinding(
      "RETENTION_IEPS_REVIEW",
      "INFO",
      "Retención IEPS detectada",
      `Concepto #${item.conceptIndex + 1}: se encontró retención IEPS`,
      "Revisa que la retención IEPS sea aplicable y sus tasas sean correctas.",
      [
        { label: "Concepto #", value: String(item.conceptIndex + 1) },
        { label: "Impuesto", value: "003 (IEPS)" },
        { label: "Base", value: item.entry.base ?? "—" },
        { label: "TasaOCuota", value: item.entry.tasaOCuota ?? "—" },
        { label: "Importe", value: item.entry.importe ?? "—" },
      ],
    );
  }

  // E4) GLOBAL_TAX_BASE_SUM_MISMATCH
  if (globalTaxes) {
    const conceptBasesTransferred = sumByKey(concepts, "TRANSFERRED", "base");
    const globalBasesTransferred = sumGlobalByKey(globalTaxes, "TRANSFERRED", "base");
    for (const [k, gb] of globalBasesTransferred) {
      const cb = conceptBasesTransferred.get(k) ?? 0;
      if (Math.abs(cb - gb) > SIETE_CENTESIMAS) {
        const [impuesto, tipoFactor, tasa] = k.split("|");
        addFinding(
          "GLOBAL_TAX_BASE_SUM_MISMATCH",
          "WARNING",
          "Suma de bases de impuestos no coincide entre global y conceptos",
          `Grupo ${k}: suma conceptos=${fmt(cb)}, global=${fmt(gb)}`,
          "Revisa que las bases declaradas a nivel global coincidan con la suma de los conceptos.",
          [
            { label: "Impuesto", value: impuesto },
            { label: "TipoFactor", value: tipoFactor },
            { label: "TasaOCuota", value: tasa },
            { label: "Base suma conceptos", value: fmt(cb) },
            { label: "Base global", value: fmt(gb) },
            { label: "Diferencia", value: fmt(Math.abs(cb - gb)) },
          ],
        );
      }
    }
    const conceptBasesWithheld = sumByKey(concepts, "WITHHELD", "base");
    const globalBasesWithheld = sumGlobalByKey(globalTaxes, "WITHHELD", "base");
    for (const [k, gb] of globalBasesWithheld) {
      const cb = conceptBasesWithheld.get(k) ?? 0;
      if (Math.abs(cb - gb) > SIETE_CENTESIMAS) {
        const [impuesto, tipoFactor, tasa] = k.split("|");
        addFinding(
          "GLOBAL_TAX_BASE_SUM_MISMATCH",
          "WARNING",
          "Suma de bases de impuestos no coincide entre global y conceptos",
          `Grupo ${k}: suma conceptos=${fmt(cb)}, global=${fmt(gb)}`,
          "Revisa que las bases declaradas a nivel global coincidan con la suma de los conceptos.",
          [
            { label: "Impuesto", value: impuesto },
            { label: "TipoFactor", value: tipoFactor },
            { label: "TasaOCuota", value: tasa },
            { label: "Base suma conceptos", value: fmt(cb) },
            { label: "Base global", value: fmt(gb) },
            { label: "Diferencia", value: fmt(Math.abs(cb - gb)) },
          ],
        );
      }
    }
  }

  // F2) CFDI_TOTAL_WITH_CONCEPT_TAXES_RECALC_REVIEW
  if (isNonEmptyString(total) && isNonEmptyString(subtotal)) {
    const totalNum = toMoney(total);
    const subtotalNum = toMoney(subtotal);
    const descuentoNum = toMoney(descuento);
    const taxGroupsTransferred = sumByKey(concepts, "TRANSFERRED", "importe");
    const taxGroupsWithheld = sumByKey(concepts, "WITHHELD", "importe");
    let sumTransferred = 0;
    for (const v of taxGroupsTransferred.values()) sumTransferred += v;
    let sumWithheld = 0;
    for (const v of taxGroupsWithheld.values()) sumWithheld += v;
    const calculatedTotal = roundMoney(subtotalNum - descuentoNum + sumTransferred - sumWithheld);
    if (Math.abs(calculatedTotal - totalNum) > 0.01) {
      addFinding(
        "CFDI_TOTAL_WITH_CONCEPT_TAXES_RECALC_REVIEW",
        "WARNING",
        "Total CFDI no coincide con recálculo usando impuestos de conceptos",
        `Total XML=${total}, recálculo=${fmt(calculatedTotal)} (subtotal=${subtotal}, descuento=${descuento ?? "0.00"}, traslados=${fmt(sumTransferred)}, retenciones=${fmt(sumWithheld)})`,
        "Revisa que el total declarado sea consistente con los impuestos a nivel concepto.",
        [
          { label: "Total XML", value: total },
          { label: "Total recalculado", value: fmt(calculatedTotal) },
          { label: "Subtotal", value: subtotal },
          { label: "Descuento", value: descuento ?? "0.00" },
          { label: "Suma traslados conceptos", value: fmt(sumTransferred) },
          { label: "Suma retenciones conceptos", value: fmt(sumWithheld) },
          { label: "Diferencia", value: fmt(Math.abs(calculatedTotal - totalNum)) },
        ],
      );
    }
  }

  // G1) OBJETOIMP_01_WITH_GLOBAL_TAXES_REVIEW
  if (globalTaxes) {
    const allHaveObjImp01 = concepts.every((c) => c.objetoImp === "01");
    const hasGlobalTransferred = globalTaxes.transferred.length > 0;
    const hasGlobalWithheld = globalTaxes.withheld.length > 0;
    if (allHaveObjImp01 && (hasGlobalTransferred || hasGlobalWithheld)) {
      addFinding(
        "OBJETOIMP_01_WITH_GLOBAL_TAXES_REVIEW",
        "WARNING",
        "Todos los conceptos tienen ObjetoImp 01 pero existen impuestos globales",
        `Todos los conceptos indican ObjetoImp=01 pero hay ${hasGlobalTransferred ? "traslados" : ""}${hasGlobalTransferred && hasGlobalWithheld ? " y " : ""}${hasGlobalWithheld ? "retenciones" : ""} globales.`,
        "Si todos los conceptos son ObjetoImp 01, no deberían declararse impuestos globales.",
        [
          { label: "Conceptos con ObjetoImp 01", value: String(concepts.length) },
          { label: "Traslados globales", value: String(globalTaxes.transferred.length) },
          { label: "Retenciones globales", value: String(globalTaxes.withheld.length) },
        ],
      );
    }
  }

  // G3) OBJETOIMP_MIXED_WITHOUT_CLEAR_TAXES_REVIEW
  const hasObjImp01 = concepts.some((c) => c.objetoImp === "01");
  const hasObjImpNot01 = concepts.some((c) => c.objetoImp !== "01");
  if (hasObjImp01 && hasObjImpNot01) {
    addFinding(
      "OBJETOIMP_MIXED_WITHOUT_CLEAR_TAXES_REVIEW",
      "INFO",
      "Conceptos con ObjetoImp mixto (01 y otros)",
      `Se encontraron ${concepts.filter((c) => c.objetoImp === "01").length} concepto(s) con ObjetoImp=01 y ${concepts.filter((c) => c.objetoImp !== "01").length} con otro valor.`,
      "Revisa que el tratamiento de impuestos mixtos sea fiscalmente correcto.",
      [
        { label: "Conceptos ObjetoImp 01", value: String(concepts.filter((c) => c.objetoImp === "01").length) },
        { label: "Conceptos ObjetoImp ≠ 01", value: String(concepts.filter((c) => c.objetoImp !== "01").length) },
      ],
    );
  }
}

function isNonEmptyString(v: string | null | undefined): v is string {
  return v != null && v.trim().length > 0;
}

function roundMoney(v: number): number {
  return Math.round(v * 100) / 100;
}

const KNOWN_ISR_RATES = new Set([
  "0.100000", "0.200000", "0.300000", "0.350000",
  "0.1000", "0.2000", "0.3000", "0.3500",
  "0.10", "0.20", "0.30", "0.35",
]);

const KNOWN_IVA_RETENTION_RATES = new Set([
  "0.106666", "0.053333",
  "0.1067", "0.0533",
]);
