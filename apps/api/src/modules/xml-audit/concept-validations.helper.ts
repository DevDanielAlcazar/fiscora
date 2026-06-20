import { type ConceptInfo } from "./xml-audit.service.js";

export interface ConceptValidationsContext {
  concepts: ConceptInfo[];
  subtotal: string | null;
  descuento: string | null;
  total: string | null;
  tipoComprobante: string | null;
  isPagoType: boolean;
  addFinding: (
    code: string,
    severity: "INFO" | "WARNING" | "CRITICAL",
    title: string,
    message: string,
    recommendedAction?: string,
    evidence?: { label: string; value?: string }[],
  ) => void;
}

function toNum(v: string | null | undefined): number | null {
  if (v == null) return null;
  const n = parseFloat(v.replace(",", ""));
  return isNaN(n) ? null : n;
}

function toMoney(v: string | null | undefined): number {
  const n = toNum(v);
  return n != null ? Math.round(n * 100) / 100 : 0;
}

function isSet(v: string | null | undefined): v is string {
  return v != null && v.trim().length > 0;
}

function countDecimals(v: string): number {
  const dot = v.indexOf(".");
  if (dot === -1) return 0;
  return v.length - dot - 1;
}

export function validateConceptsAdvanced(ctx: ConceptValidationsContext): void {
  const { concepts, subtotal, descuento, tipoComprobante, isPagoType, addFinding } = ctx;
  if (!concepts) return;

  const isIngresoEgreso =
    tipoComprobante === "I" || tipoComprobante === "E" || tipoComprobante === "N" || tipoComprobante === "T";

  // ── A) Campos mínimos del concepto ──

  for (let ci = 0; ci < concepts.length; ci++) {
    const c = concepts[ci];

    // A2) CONCEPT_MISSING_CLAVE_UNIDAD
    if (!isSet(c.claveUnidad)) {
      addFinding(
        "CONCEPT_MISSING_CLAVE_UNIDAD",
        "WARNING",
        "Concepto sin ClaveUnidad",
        `Concepto #${ci + 1}: falta ClaveUnidad.`,
        "La clave de unidad es necesaria para el desglose fiscal.",
        [
          { label: "Concepto #", value: String(ci + 1) },
          { label: "Descripción", value: (c.descripcion ?? "—").slice(0, 80) },
          { label: "ClaveProdServ", value: c.claveProdServ ?? "—" },
        ],
      );
    }

    // A4) CONCEPT_DESCRIPTION_TOO_SHORT_REVIEW
    if (isSet(c.descripcion) && c.descripcion.trim().length < 3) {
      addFinding(
        "CONCEPT_DESCRIPTION_TOO_SHORT_REVIEW",
        "INFO",
        "Descripción de concepto muy corta",
        `Concepto #${ci + 1}: descripción "${c.descripcion.trim()}" tiene menos de 3 caracteres.`,
        "Revisa que la descripción del producto o servicio sea suficientemente descriptiva.",
        [
          { label: "Concepto #", value: String(ci + 1) },
          { label: "Descripción", value: c.descripcion.trim() },
          { label: "ClaveProdServ", value: c.claveProdServ ?? "—" },
        ],
      );
    }

    // A5) CONCEPT_NO_IDENTIFICACION_DUPLICATED_REVIEW
    if (isSet(c.noIdentificacion)) {
      const dups = concepts
        .map((other, oi) => ({ other, oi }))
        .filter(
          (x) =>
            x.oi < ci &&
            x.other.noIdentificacion === c.noIdentificacion &&
            (x.other.descripcion !== c.descripcion ||
              Math.abs(toMoney(x.other.valorUnitario) - toMoney(c.valorUnitario)) > 0.01),
        );
      if (dups.length > 0) {
        addFinding(
          "CONCEPT_NO_IDENTIFICACION_DUPLICATED_REVIEW",
          "INFO",
          "NoIdentificación duplicado con diferente descripción o precio",
          `Concepto #${ci + 1}: NoIdentificación "${c.noIdentificacion}" se repite en concepto(s) #${dups.map((d) => d.oi + 1).join(", #")} con diferente contenido.`,
          "Revisa que el NoIdentificación esté correctamente asignado.",
          [
            { label: "Concepto #", value: String(ci + 1) },
            { label: "NoIdentificación", value: c.noIdentificacion },
            { label: "Descripción", value: (c.descripcion ?? "—").slice(0, 80) },
            { label: "ValorUnitario", value: c.valorUnitario ?? "—" },
          ],
        );
      }
    }

    // B3) CONCEPT_UNIT_VALUE_MISSING
    if (!isSet(c.valorUnitario)) {
      addFinding(
        "CONCEPT_UNIT_VALUE_MISSING",
        "WARNING",
        "Concepto sin ValorUnitario",
        `Concepto #${ci + 1}: falta ValorUnitario.`,
        "El valor unitario es necesario para verificar el importe del concepto.",
        [
          { label: "Concepto #", value: String(ci + 1) },
          { label: "Descripción", value: (c.descripcion ?? "—").slice(0, 80) },
          { label: "Cantidad", value: c.cantidad ?? "—" },
          { label: "Importe", value: c.importe ?? "—" },
        ],
      );
    }

    // B4) CONCEPT_UNIT_VALUE_NEGATIVE
    if (isSet(c.valorUnitario) && toMoney(c.valorUnitario) < 0) {
      addFinding(
        "CONCEPT_UNIT_VALUE_NEGATIVE",
        "WARNING",
        "ValorUnitario negativo",
        `Concepto #${ci + 1}: ValorUnitario=${c.valorUnitario}.`,
        "Revisa que el valor unitario del concepto no sea negativo.",
        [
          { label: "Concepto #", value: String(ci + 1) },
          { label: "Descripción", value: (c.descripcion ?? "—").slice(0, 80) },
          { label: "ValorUnitario", value: c.valorUnitario },
          { label: "Cantidad", value: c.cantidad ?? "—" },
        ],
      );
    }

    // B5) CONCEPT_IMPORT_MISSING
    if (!isSet(c.importe)) {
      addFinding(
        "CONCEPT_IMPORT_MISSING",
        "WARNING",
        "Concepto sin Importe",
        `Concepto #${ci + 1}: falta Importe.`,
        "El importe es necesario para determinar el valor fiscal del concepto.",
        [
          { label: "Concepto #", value: String(ci + 1) },
          { label: "Descripción", value: (c.descripcion ?? "—").slice(0, 80) },
          { label: "Cantidad", value: c.cantidad ?? "—" },
          { label: "ValorUnitario", value: c.valorUnitario ?? "—" },
        ],
      );
    }

    // B6) CONCEPT_IMPORT_NEGATIVE
    if (isSet(c.importe) && toMoney(c.importe) < 0) {
      addFinding(
        "CONCEPT_IMPORT_NEGATIVE",
        "WARNING",
        "Importe de concepto negativo",
        `Concepto #${ci + 1}: Importe=${c.importe}.`,
        "Revisa que el importe del concepto no sea negativo.",
        [
          { label: "Concepto #", value: String(ci + 1) },
          { label: "Descripción", value: (c.descripcion ?? "—").slice(0, 80) },
          { label: "Importe", value: c.importe },
          { label: "Cantidad", value: c.cantidad ?? "—" },
          { label: "ValorUnitario", value: c.valorUnitario ?? "—" },
        ],
      );
    }

    // B8) CONCEPT_ZERO_IMPORT_REVIEW
    if (isSet(c.importe) && toMoney(c.importe) === 0 && isIngresoEgreso) {
      addFinding(
        "CONCEPT_ZERO_IMPORT_REVIEW",
        "INFO",
        "Concepto con importe cero",
        `Concepto #${ci + 1}: Importe=0.00 en comprobante tipo ${tipoComprobante}.`,
        "Revisa que el importe cero sea correcto para el tipo de operación.",
        [
          { label: "Concepto #", value: String(ci + 1) },
          { label: "Descripción", value: (c.descripcion ?? "—").slice(0, 80) },
          { label: "Importe", value: "0.00" },
          { label: "ObjetoImp", value: c.objetoImp ?? "—" },
        ],
      );
    }

    // C1) CONCEPT_DISCOUNT_NEGATIVE
    if (isSet(c.descuento) && toMoney(c.descuento) < 0) {
      addFinding(
        "CONCEPT_DISCOUNT_NEGATIVE",
        "WARNING",
        "Descuento de concepto negativo",
        `Concepto #${ci + 1}: Descuento=${c.descuento}.`,
        "Revisa que el descuento del concepto no sea negativo.",
        [
          { label: "Concepto #", value: String(ci + 1) },
          { label: "Descripción", value: (c.descripcion ?? "—").slice(0, 80) },
          { label: "Descuento", value: c.descuento },
          { label: "Importe", value: c.importe ?? "—" },
        ],
      );
    }

    // E5) CONCEPT_OBJETO_IMP_04_08_REVIEW
    if (isSet(c.objetoImp) && ["04", "05", "06", "07", "08"].includes(c.objetoImp)) {
      addFinding(
        "CONCEPT_OBJETO_IMP_04_08_REVIEW",
        "INFO",
        "ObjetoImp entre 04–08 requiere revisión",
        `Concepto #${ci + 1}: ObjetoImp=${c.objetoImp} indica un tratamiento fiscal especial.`,
        "Revisa que el tratamiento fiscal del concepto sea correcto para el valor de ObjetoImp.",
        [
          { label: "Concepto #", value: String(ci + 1) },
          { label: "ObjetoImp", value: c.objetoImp },
          { label: "Descripción", value: (c.descripcion ?? "—").slice(0, 80) },
          { label: "ClaveProdServ", value: c.claveProdServ ?? "—" },
        ],
      );
    }

    // F1) CONCEPT_CLAVE_PROD_SERV_FORMAT_REVIEW
    if (isSet(c.claveProdServ) && !/^\d{8}$/.test(c.claveProdServ.trim())) {
      addFinding(
        "CONCEPT_CLAVE_PROD_SERV_FORMAT_REVIEW",
        "INFO",
        "ClaveProdServ con formato inusual",
        `Concepto #${ci + 1}: ClaveProdServ="${c.claveProdServ.trim()}" no tiene 8 dígitos numéricos.`,
        "Revisa que la clave de producto o servicio esté correctamente capturada.",
        [
          { label: "Concepto #", value: String(ci + 1) },
          { label: "ClaveProdServ", value: c.claveProdServ.trim() },
          { label: "Descripción", value: (c.descripcion ?? "—").slice(0, 80) },
        ],
      );
    }

    // F2) CONCEPT_CLAVE_UNIDAD_FORMAT_REVIEW
    if (isSet(c.claveUnidad) && (c.claveUnidad.trim().length < 2 || c.claveUnidad.trim().length > 3)) {
      addFinding(
        "CONCEPT_CLAVE_UNIDAD_FORMAT_REVIEW",
        "INFO",
        "ClaveUnidad con formato inusual",
        `Concepto #${ci + 1}: ClaveUnidad="${c.claveUnidad.trim()}" con longitud ${c.claveUnidad.trim().length} (esperado 2–3).`,
        "Revisa que la clave de unidad sea válida.",
        [
          { label: "Concepto #", value: String(ci + 1) },
          { label: "ClaveUnidad", value: c.claveUnidad.trim() },
          { label: "Descripción", value: (c.descripcion ?? "—").slice(0, 80) },
        ],
      );
    }

    // F3) CONCEPT_UNIDAD_WITHOUT_CLAVE_UNIDAD_REVIEW
    if (isSet(c.unidad) && !isSet(c.claveUnidad)) {
      addFinding(
        "CONCEPT_UNIDAD_WITHOUT_CLAVE_UNIDAD_REVIEW",
        "WARNING",
        "Concepto con Unidad pero sin ClaveUnidad",
        `Concepto #${ci + 1}: Unidad="${c.unidad}" pero falta ClaveUnidad.`,
        "La ClaveUnidad es obligatoria en CFDI 4.0 incluso si se proporciona Unidad descriptiva.",
        [
          { label: "Concepto #", value: String(ci + 1) },
          { label: "Unidad", value: c.unidad },
          { label: "Descripción", value: (c.descripcion ?? "—").slice(0, 80) },
        ],
      );
    }

    // F4) CONCEPT_CLAVE_UNIDAD_WITHOUT_UNIDAD_REVIEW
    if (isSet(c.claveUnidad) && !isSet(c.unidad)) {
      addFinding(
        "CONCEPT_CLAVE_UNIDAD_WITHOUT_UNIDAD_REVIEW",
        "INFO",
        "Concepto sin Unidad descriptiva",
        `Concepto #${ci + 1}: falta Unidad aunque ClaveUnidad="${c.claveUnidad}" está presente.`,
        "La Unidad descriptiva no es obligatoria pero ayuda a la claridad del CFDI.",
        [
          { label: "Concepto #", value: String(ci + 1) },
          { label: "ClaveUnidad", value: c.claveUnidad },
          { label: "Descripción", value: (c.descripcion ?? "—").slice(0, 80) },
        ],
      );
    }

    // G1) CONCEPT_DECIMALS_EXCESS_REVIEW
    const decFields: { label: string; value: string | undefined }[] = [
      { label: "Cantidad", value: c.cantidad },
      { label: "ValorUnitario", value: c.valorUnitario },
      { label: "Importe", value: c.importe },
      { label: "Descuento", value: c.descuento },
    ];
    const excessFields = decFields.filter((f) => isSet(f.value) && countDecimals(f.value!) > 6);
    if (excessFields.length > 0) {
      addFinding(
        "CONCEPT_DECIMALS_EXCESS_REVIEW",
        "INFO",
        "Concepto con más de 6 decimales en campos numéricos",
        `Concepto #${ci + 1}: ${excessFields.map((f) => `${f.label}=${f.value}`).join(", ")}`,
        "Revisa que la precisión de los valores numéricos sea la adecuada.",
        [
          { label: "Concepto #", value: String(ci + 1) },
          ...excessFields.map((f) => ({ label: f.label, value: f.value! })),
          { label: "Descripción", value: (c.descripcion ?? "—").slice(0, 80) },
        ],
      );
    }

    // G2) CONCEPT_ROUNDING_DIFFERENCE_REVIEW
    if (
      isSet(c.cantidad) &&
      isSet(c.valorUnitario) &&
      isSet(c.importe)
    ) {
      const qty = toNum(c.cantidad);
      const unitVal = toNum(c.valorUnitario);
      const impNum = toMoney(c.importe);
      if (qty != null && unitVal != null && qty > 0 && unitVal > 0) {
        const calculado = Math.round(qty * unitVal * 100) / 100;
        const diff = Math.abs(calculado - impNum);
        if (diff > 0.01 && diff <= 0.05) {
          addFinding(
            "CONCEPT_ROUNDING_DIFFERENCE_REVIEW",
            "INFO",
            "Pequeña diferencia por redondeo en importe del concepto",
            `Concepto #${ci + 1}: Cant*ValorUnit=${calculado.toFixed(2)} vs Importe=${c.importe} (diff=${diff.toFixed(4)}).`,
            "Revisa si la diferencia se debe a un criterio de redondeo aplicable.",
            [
              { label: "Concepto #", value: String(ci + 1) },
              { label: "Cantidad", value: c.cantidad },
              { label: "ValorUnitario", value: c.valorUnitario },
              { label: "Importe XML", value: c.importe },
              { label: "Importe calculado", value: calculado.toFixed(2) },
              { label: "Diferencia", value: diff.toFixed(4) },
            ],
          );
        }
      }
    }
  }

  // ── C3) CONCEPT_DISCOUNT_WITHOUT_GLOBAL_DISCOUNT_REVIEW ──
  const sumConceptDiscounts = concepts.reduce(
    (acc, c) => acc + (isSet(c.descuento) ? toMoney(c.descuento) : 0),
    0,
  );
  const hasGlobalDiscount = isSet(descuento) && toMoney(descuento) > 0.01;

  if (sumConceptDiscounts > 0.01 && !hasGlobalDiscount) {
    addFinding(
      "CONCEPT_DISCOUNT_WITHOUT_GLOBAL_DISCOUNT_REVIEW",
      "WARNING",
      "Descuentos por concepto sin descuento global en comprobante",
      `Suma descuentos por concepto=${sumConceptDiscounts.toFixed(2)} pero Comprobante.Descuento ${isSet(descuento) ? `=${descuento}` : "no existe"} (debería ser > 0).`,
      "Si hay descuentos a nivel concepto, el comprobante debe declarar el descuento total.",
      [
        { label: "Suma descuentos conceptos", value: sumConceptDiscounts.toFixed(2) },
        { label: "Comprobante Descuento", value: descuento ?? "—" },
      ],
    );
  }

  // ── C4) CONCEPT_GLOBAL_DISCOUNT_MISMATCH ──
  if (hasGlobalDiscount && sumConceptDiscounts > 0.01) {
    const globalDiscount = toMoney(descuento);
    const diff = Math.abs(globalDiscount - sumConceptDiscounts);
    if (diff > 0.01) {
      addFinding(
        "CONCEPT_GLOBAL_DISCOUNT_MISMATCH",
        "WARNING",
        "Descuento global no coincide con suma de descuentos por concepto",
        `Comprobante.Descuento=${descuento} vs suma conceptos=${sumConceptDiscounts.toFixed(2)} (diff=${diff.toFixed(2)}).`,
        "Revisa que el descuento global coincida con la suma de descuentos de los conceptos.",
        [
          { label: "Comprobante Descuento", value: descuento! },
          { label: "Suma descuentos conceptos", value: sumConceptDiscounts.toFixed(2) },
          { label: "Diferencia", value: diff.toFixed(2) },
          { label: "Tolerancia", value: "0.01" },
        ],
      );
    }
  }

  // ── D3) CONCEPTS_TOTAL_NET_AMOUNT_REVIEW ──
  const sumConceptImports = concepts.reduce(
    (acc, c) => acc + (isSet(c.importe) ? toMoney(c.importe) : 0),
    0,
  );
  const netoConceptos = sumConceptImports - sumConceptDiscounts;
  if (netoConceptos < -0.01) {
    addFinding(
      "CONCEPTS_TOTAL_NET_AMOUNT_REVIEW",
      "CRITICAL",
      "Neto de conceptos negativo",
      `Suma importes=${sumConceptImports.toFixed(2)} - suma descuentos=${sumConceptDiscounts.toFixed(2)} = neto=${netoConceptos.toFixed(2)}.`,
      "El neto de conceptos (importe - descuento) no debería ser negativo.",
      [
        { label: "Suma importes conceptos", value: sumConceptImports.toFixed(2) },
        { label: "Suma descuentos conceptos", value: sumConceptDiscounts.toFixed(2) },
        { label: "Neto conceptos", value: netoConceptos.toFixed(2) },
      ],
    );
  }
}
