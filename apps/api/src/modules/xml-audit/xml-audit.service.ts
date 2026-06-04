import { XMLParser } from "fast-xml-parser";

export interface TechnicalDiagnostics {
  isStamped: boolean;
  hasTimbreFiscalDigital: boolean;
  bomDetected: boolean;
  leadingContentBeforeXml: boolean;
  safeNormalizationApplied: boolean;
  safeNormalizationNotes: string[];
}

export interface ExecutiveSummary {
  riskLevel: "OK" | "WARNING" | "CRITICAL";
  title: string;
  message: string;
  recommendedAction: string;
}

export interface PaymentDocument {
  idDocumento?: string;
  serie?: string;
  folio?: string;
  monedaDR?: string;
  equivalenciaDR?: string;
  numParcialidad?: string;
  impSaldoAnt?: string;
  impPagado?: string;
  impSaldoInsoluto?: string;
  objetoImpDR?: string;
}

export interface PaymentInfo {
  fechaPago?: string;
  formaDePagoP?: string;
  monedaP?: string;
  monto?: string;
  tipoCambioP?: string;
  numOperacion?: string;
  documentosRelacionados: PaymentDocument[];
}

export interface PaymentComplement {
  version?: string;
  pagos: PaymentInfo[];
}

export interface StructureDiagnostics {
  namespaces: string[];
  hasComplemento: boolean;
  hasAddenda: boolean;
  complementNames: string[];
  knownComplements: string[];
  unknownComplements: string[];
  addendaDetected: boolean;
  nodeShapeNotes: string[];
}

export interface ConceptTaxEntry {
  base?: string;
  impuesto?: string;
  tipoFactor?: string;
  tasaOCuota?: string;
  importe?: string;
}

export interface ConceptImpuestos {
  traslados: ConceptTaxEntry[];
  retenciones: ConceptTaxEntry[];
}

export interface ConceptInfo {
  claveProdServ?: string;
  noIdentificacion?: string;
  cantidad?: string;
  claveUnidad?: string;
  unidad?: string;
  descripcion?: string;
  valorUnitario?: string;
  importe?: string;
  descuento?: string;
  objetoImp?: string;
  impuestos?: ConceptImpuestos;
}

export interface TotalsValidation {
  subtotalXml?: string;
  subtotalCalculated?: string;
  discountCalculated?: string;
  transferredTaxesXml?: string;
  transferredTaxesCalculated?: string;
  retainedTaxesXml?: string;
  retainedTaxesCalculated?: string;
  totalXml?: string;
  totalCalculated?: string;
  difference?: string;
  tolerance: string;
  matches: boolean;
}

export interface TaxSummaryEntry {
  impuesto: string;
  impuestoLabel: string;
  tipoFactor?: string;
  tasaOCuota?: string;
  baseCalculated: string;
  importeCalculated: string;
}

export interface TaxSummary {
  transferred: TaxSummaryEntry[];
  retained: TaxSummaryEntry[];
}

export interface Finding {
  severity: "INFO" | "WARNING" | "CRITICAL";
  category: "TECHNICAL" | "FISCAL" | "STRUCTURE" | "COMPLEMENT" | "TAX" | "TOTALS";
  code: string;
  title: string;
  message: string;
  recommendedAction?: string;
}

export interface CfdiAnalysisResult {
  uuid: string | null;
  version: string | null;
  tipoComprobante: string | null;
  fecha: string | null;
  serie: string | null;
  folio: string | null;
  moneda: string | null;
  subtotal: string | null;
  total: string | null;
  rfcEmisor: string | null;
  nombreEmisor: string | null;
  rfcReceptor: string | null;
  nombreReceptor: string | null;
  fechaTimbrado: string | null;
  totalImpuestosTrasladados: string | null;
  totalImpuestosRetenidos: string | null;
  usoCfdi: string | null;
  metodoPago: string | null;
  formaPago: string | null;
  issues: string[];
  warnings: string[];
  findings: Finding[];
  technicalDiagnostics: TechnicalDiagnostics;
  executiveSummary: ExecutiveSummary;
  paymentComplement?: PaymentComplement | null;
  structureDiagnostics: StructureDiagnostics;
  concepts?: ConceptInfo[] | null;
  totalsValidation?: TotalsValidation | null;
  taxSummary?: TaxSummary | null;
}

export interface AnalysisResponse {
  uuid: string | null;
  tipoComprobante: string | null;
  rfcEmisor: string | null;
  nombreEmisor: string | null;
  rfcReceptor: string | null;
  nombreReceptor: string | null;
  fecha: string | null;
  total: string | null;
  subtotal: string | null;
  moneda: string | null;
  version: string | null;
  serie: string | null;
  folio: string | null;
  usoCfdi: string | null;
  metodoPago: string | null;
  formaPago: string | null;
  fechaTimbrado: string | null;
  totalImpuestosTrasladados: string | null;
  totalImpuestosRetenidos: string | null;
  issues: string[];
  warnings: string[];
  findings: Finding[];
  technicalDiagnostics: TechnicalDiagnostics;
  executiveSummary: ExecutiveSummary;
  paymentComplement?: PaymentComplement | null;
  structureDiagnostics: StructureDiagnostics;
  concepts?: ConceptInfo[] | null;
  totalsValidation?: TotalsValidation | null;
  taxSummary?: TaxSummary | null;
}

const BOM = "\uFEFF";

function get(obj: unknown, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function str(val: unknown): string | null {
  if (val === null || val === undefined) return null;
  return String(val);
}

function toNum(val: string | null | undefined): number | null {
  if (val === null || val === undefined) return null;
  const n = parseFloat(val.replace(",", ""));
  return isNaN(n) ? null : n;
}

function toMoneyNumber(val: string | null | undefined): number {
  const n = toNum(val);
  return n !== null ? roundMoney(n) : 0;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function formatMoney(value: number): string {
  return roundMoney(value).toFixed(2);
}

function rc(version: string | null, target: "3.3" | "4.0"): boolean {
  return version === target;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RFC_MORAL = /^[A-ZÑ&]{3}\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])[A-Z0-9]{3}$/i;
const RFC_FISICA = /^[A-ZÑ&]{4}\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])[A-Z0-9]{3}$/i;

export function analyzeCfdi(rawXml: string): CfdiAnalysisResult {
  const issues: string[] = [];
  const warnings: string[] = [];
  const safeNormalizationNotes: string[] = [];

  let bomDetected = false;
  let leadingContentBeforeXml = false;
  let safeNormalizationApplied = false;

  const diag: TechnicalDiagnostics = {
    isStamped: false,
    hasTimbreFiscalDigital: false,
    bomDetected: false,
    leadingContentBeforeXml: false,
    safeNormalizationApplied: false,
    safeNormalizationNotes: [],
  };

  let xmlContent = rawXml;

  if (xmlContent.startsWith(BOM)) {
    bomDetected = true;
    xmlContent = xmlContent.slice(1);
    safeNormalizationApplied = true;
    safeNormalizationNotes.push("BOM UTF-8 removido en memoria");
  }

  const xmlStartIndex = xmlContent.indexOf("<");
  if (xmlStartIndex > 0) {
    leadingContentBeforeXml = true;
    xmlContent = xmlContent.slice(xmlStartIndex);
    safeNormalizationApplied = true;
    safeNormalizationNotes.push("Contenido previo al primer '<' removido en memoria");
  }

  if (bomDetected) {
    diag.bomDetected = true;
    warnings.push("Se detectó BOM UTF-8 al inicio del archivo. Se normalizó en memoria para lectura; no se modificó contenido fiscal.");
  }
  if (leadingContentBeforeXml) {
    diag.leadingContentBeforeXml = true;
    warnings.push("Se detectó contenido antes del inicio del XML. Se normalizó en memoria para lectura; validar origen del archivo.");
  }
  diag.safeNormalizationApplied = safeNormalizationApplied;
  diag.safeNormalizationNotes = safeNormalizationNotes;

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    preserveOrder: false,
    parseTagValue: false,
    parseAttributeValue: false,
  });

  let parsed: unknown;
  try {
    parsed = parser.parse(xmlContent);
  } catch {
    throw Object.assign(new Error("El XML no es válido o no pudo ser parseado"), {
      code: "XML_INVALID",
    });
  }

  const comprobante = (parsed as Record<string, unknown>)["cfdi:Comprobante"] as Record<string, unknown> ?? {};

  if (!comprobante || Object.keys(comprobante).length === 0) {
    throw Object.assign(new Error("No se encontró un elemento cfdi:Comprobante válido"), {
      code: "XML_INVALID",
    });
  }

  const version = str(get(comprobante, "@_Version"));
  if (!version) {
    issues.push("No se encontró la versión del CFDI");
  } else if (!["3.3", "4.0"].includes(version)) {
    warnings.push(`Versión de CFDI no estándar: ${version}`);
  }

  const tipoComprobante = str(get(comprobante, "@_TipoDeComprobante"));
  const fecha = str(get(comprobante, "@_Fecha"));
  const serie = str(get(comprobante, "@_Serie"));
  const folio = str(get(comprobante, "@_Folio"));
  const moneda = str(get(comprobante, "@_Moneda"));
  const subtotal = str(get(comprobante, "@_SubTotal"));
  const total = str(get(comprobante, "@_Total"));
  const metodoPago = str(get(comprobante, "@_MetodoPago"));
  const formaPago = str(get(comprobante, "@_FormaPago"));
  const descuento = str(get(comprobante, "@_Descuento"));

  // Emisor
  const emisor = get(comprobante, "cfdi:Emisor") as Record<string, unknown> ?? {};
  const rfcEmisor = str(get(emisor, "@_Rfc"));
  const nombreEmisor = str(get(emisor, "@_Nombre"));

  // Receptor
  const receptor = get(comprobante, "cfdi:Receptor") as Record<string, unknown> ?? {};
  const rfcReceptor = str(get(receptor, "@_Rfc"));
  const nombreReceptor = str(get(receptor, "@_Nombre"));
  const usoCfdi = str(get(receptor, "@_UsoCFDI"));

  // Impuestos
  const impuestos = get(comprobante, "cfdi:Impuestos") as Record<string, unknown> ?? {};
  const totalTrasladadosVal = str(get(impuestos, "@_TotalImpuestosTrasladados"));
  const totalRetenidosVal = str(get(impuestos, "@_TotalImpuestosRetenidos"));

  // TimbreFiscalDigital (Complemento)
  let uuid: string | null = null;
  let fechaTimbrado: string | null = null;

  const complemento = get(comprobante, "cfdi:Complemento") as Record<string, unknown> ?? {};
  const timbre = get(complemento, "tfd:TimbreFiscalDigital") as Record<string, unknown> ??
    get(complemento, "TimbreFiscalDigital") as Record<string, unknown> ?? {};

  const hasTimbreFiscalDigital = timbre !== null && typeof timbre === "object" && Object.keys(timbre).length > 0;
  diag.hasTimbreFiscalDigital = hasTimbreFiscalDigital;

  if (hasTimbreFiscalDigital) {
    uuid = str(get(timbre, "@_UUID")) ?? str(get(timbre, "@_uuid"));
    fechaTimbrado = str(get(timbre, "@_FechaTimbrado"));
  }

  diag.isStamped = hasTimbreFiscalDigital && uuid !== null;

  if (!hasTimbreFiscalDigital) {
    warnings.push("El XML no contiene TimbreFiscalDigital; podría no estar timbrado.");
  }

  const tipoLabel =
    tipoComprobante === "I" ? "Ingreso" :
    tipoComprobante === "E" ? "Egreso" :
    tipoComprobante === "P" ? "Pago" :
    tipoComprobante === "N" ? "Nómina" :
    tipoComprobante === "T" ? "Traslado" :
    tipoComprobante;

  // ── Structure Diagnostics ──
  const nodeShapeNotes: string[] = [];
  const complementNames: string[] = [];
  const knownComplements: string[] = [];
  const unknownComplements: string[] = [];

  const knownSet = new Set([
    "TimbreFiscalDigital", "Pagos", "ImpuestosLocales", "LeyendasFiscales",
    "CartaPorte", "ComercioExterior", "Retenciones", "Nomina",
  ]);

  const hasComplemento = complemento !== null && typeof complemento === "object" && Object.keys(complemento).length > 0;

  const complementoKeys = hasComplemento ? Object.keys(complemento) : [];

  for (const key of complementoKeys) {
    const normalized = key.replace(/^[\w.-]+:/, "");
    complementNames.push(key);
    const seenKnown = new Set(knownComplements);
    const seenUnknown = new Set(unknownComplements);
    if (knownSet.has(normalized)) {
      if (!seenKnown.has(normalized)) knownComplements.push(normalized);
    } else {
      if (!seenUnknown.has(normalized)) unknownComplements.push(normalized);
    }
  }

  if (complementoKeys.length > 0) {
    if (complementoKeys.length === 1 && typeof complemento[complementoKeys[0]] === "object" && !Array.isArray(complemento[complementoKeys[0]])) {
      nodeShapeNotes.push(`Complemento de tipo único: ${complementoKeys[0]}`);
    }
  }

  const addendaNode = get(comprobante, "cfdi:Addenda") as Record<string, unknown> ??
    get(comprobante, "Addenda") as Record<string, unknown> ?? {};
  const hasAddenda = addendaNode !== null && typeof addendaNode === "object" && Object.keys(addendaNode).length > 0;
  const addendaDetected = hasAddenda;

  if (addendaDetected) {
    nodeShapeNotes.push("Addenda detectada en el comprobante");
  }

  const nsRegex = /xmlns:([a-zA-Z][\w.-]*)\s*=\s*["']([^"']+)["']/g;
  const namespaces: string[] = [];
  const nsSet = new Set<string>();
  let nsMatch: RegExpExecArray | null;
  while ((nsMatch = nsRegex.exec(xmlContent)) !== null) {
    const uri = nsMatch[2];
    if (!nsSet.has(uri)) {
      nsSet.add(uri);
      namespaces.push(`${nsMatch[1]}=${uri}`);
    }
  }

  const structureDiagnostics: StructureDiagnostics = {
    namespaces,
    hasComplemento,
    hasAddenda,
    complementNames,
    knownComplements,
    unknownComplements,
    addendaDetected,
    nodeShapeNotes,
  };

  if (addendaDetected) {
    warnings.push("El XML contiene Addenda. Se conservará como información adicional, pero no forma parte de la validación fiscal base.");
  }

  if (unknownComplements.length > 0) {
    warnings.push("El XML contiene complementos no clasificados por el motor actual; se recomienda revisión especializada si son relevantes para el proceso.");
  }

  // ── Concept extraction ──
  let concepts: ConceptInfo[] | null = null;

  const rawConceptos = get(comprobante, "cfdi:Conceptos") as Record<string, unknown> ??
    get(comprobante, "Conceptos") as Record<string, unknown> ?? {};

  const rawConcepto = get(rawConceptos, "cfdi:Concepto") ?? get(rawConceptos, "Concepto");

  if (rawConcepto !== null && rawConcepto !== undefined) {
    const conceptoArray = Array.isArray(rawConcepto) ? rawConcepto : [rawConcepto];

    if (conceptoArray.length === 1 && !Array.isArray(rawConcepto)) {
      nodeShapeNotes.push("Concepto de tipo único normalizado a arreglo");
    } else {
      nodeShapeNotes.push("Conceptos múltiples detectados");
    }

    const extractTaxEntries = (raw: unknown, prefix: string, nodeName: string, singular: string, pluralNotes: string): ConceptTaxEntry[] => {
    const node = get(raw, `${prefix}${nodeName}`) as Record<string, unknown> ??
      get(raw, nodeName) as Record<string, unknown> ?? {};
    const rawEntry = get(node, `${prefix}${singular}`) ?? get(node, singular);
    if (rawEntry === null || rawEntry === undefined) return [];
    const arr = Array.isArray(rawEntry) ? rawEntry : [rawEntry];
    if (arr.length === 1 && !Array.isArray(rawEntry)) {
      nodeShapeNotes.push(`${pluralNotes} — nodo único normalizado a arreglo`);
    } else {
      nodeShapeNotes.push(`${pluralNotes} — múltiples nodos detectados`);
    }
    return arr.map((e: Record<string, unknown>) => ({
      base: str(get(e, "@_Base")) ?? undefined,
      impuesto: str(get(e, "@_Impuesto")) ?? undefined,
      tipoFactor: str(get(e, "@_TipoFactor")) ?? undefined,
      tasaOCuota: str(get(e, "@_TasaOCuota")) ?? undefined,
      importe: str(get(e, "@_Importe")) ?? undefined,
    }));
  };

  concepts = conceptoArray.map((c: Record<string, unknown>) => {
    const rawImpuestos = get(c, "cfdi:Impuestos") as Record<string, unknown> ??
      get(c, "Impuestos") as Record<string, unknown> ?? {};

    const traslados = extractTaxEntries(rawImpuestos, "cfdi:", "Traslados", "Traslado", "Traslados en concepto");
    const retenciones = extractTaxEntries(rawImpuestos, "cfdi:", "Retenciones", "Retencion", "Retenciones en concepto");

    const impuestos = traslados.length > 0 || retenciones.length > 0
      ? { traslados, retenciones }
      : undefined;

    return {
      claveProdServ: str(get(c, "@_ClaveProdServ")) ?? undefined,
      noIdentificacion: str(get(c, "@_NoIdentificacion")) ?? undefined,
      cantidad: str(get(c, "@_Cantidad")) ?? undefined,
      claveUnidad: str(get(c, "@_ClaveUnidad")) ?? undefined,
      unidad: str(get(c, "@_Unidad")) ?? undefined,
      descripcion: str(get(c, "@_Descripcion")) ?? undefined,
      valorUnitario: str(get(c, "@_ValorUnitario")) ?? undefined,
      importe: str(get(c, "@_Importe")) ?? undefined,
      descuento: str(get(c, "@_Descuento")) ?? undefined,
      objetoImp: str(get(c, "@_ObjetoImp")) ?? undefined,
      impuestos,
    };
  });
  }

  if (tipoComprobante === "I" || tipoComprobante === "E") {
    if (!concepts || concepts.length === 0) {
      issues.push("El comprobante no contiene conceptos.");
    }
  }

  if (concepts) {
    for (const c of concepts) {
      if (!c.claveProdServ) warnings.push("Un concepto no contiene ClaveProdServ.");
      if (!c.cantidad) warnings.push("Un concepto no contiene cantidad.");
      if (!c.descripcion) warnings.push("Un concepto no contiene descripción.");
      if (rc(version, "4.0") && !c.objetoImp) warnings.push("Un concepto no contiene ObjetoImp.");

      if (c.objetoImp === "02") {
        const hasTraslados = c.impuestos && c.impuestos.traslados.length > 0;
        const hasRetenciones = c.impuestos && c.impuestos.retenciones.length > 0;
        if (!hasTraslados && !hasRetenciones) {
          warnings.push("Un concepto marcado como objeto de impuesto sí objeto de impuesto no contiene impuestos.");
        }
      }

      if (c.impuestos) {
        for (const t of c.impuestos.traslados) {
          if (!t.base) warnings.push("Un traslado de concepto no contiene base.");
          if (!t.impuesto) warnings.push("Un traslado de concepto no contiene impuesto.");
          if (!t.tipoFactor) warnings.push("Un traslado de concepto no contiene tipo factor.");
          if (t.tipoFactor !== "Exento" && !t.importe) warnings.push("Un traslado de concepto gravado no contiene importe.");
        }
        for (const r of c.impuestos.retenciones) {
          if (!r.base) warnings.push("Una retención de concepto no contiene base.");
          if (!r.impuesto) warnings.push("Una retención de concepto no contiene impuesto.");
          if (!r.importe) warnings.push("Una retención de concepto no contiene importe.");
        }
      }
    }
  }

  // ── General required field validation ──
  if (!uuid) issues.push("No se encontró el UUID (TimbreFiscalDigital)");
  if (!rfcEmisor) issues.push("No se encontró el RFC del emisor");
  if (!rfcReceptor) issues.push("No se encontró el RFC del receptor");
  if (!total) issues.push("No se encontró el total del comprobante");
  if (!subtotal) issues.push("No se encontró el subtotal del comprobante");
  if (!tipoComprobante) issues.push("No se encontró el tipo de comprobante");
  if (!fecha) issues.push("No se encontró la fecha del comprobante");

  // ── CFDI 4.0 validations ──
  if (rc(version, "4.0")) {
    if (!nombreEmisor) issues.push("CFDI 4.0: No se encontró el nombre del emisor");
    if (!nombreReceptor) issues.push("CFDI 4.0: No se encontró el nombre del receptor");
    if (!usoCfdi) issues.push("CFDI 4.0: No se encontró el uso del CFDI");

    const regimenFiscalReceptor = str(get(receptor, "@_RegimenFiscalReceptor"));
    if (!regimenFiscalReceptor) {
      issues.push("CFDI 4.0: No se encontró el régimen fiscal del receptor");
    }

    const domicilioFiscal = str(get(receptor, "@_DomicilioFiscalReceptor"));
    if (!domicilioFiscal) {
      issues.push("CFDI 4.0: No se encontró el domicilio fiscal del receptor");
    }
  }

  // ── Type-specific validations ──
  if (tipoComprobante === "I" || tipoComprobante === "E") {
    const subtotalNum = toNum(subtotal);
    const totalNum = toNum(total);

    if (subtotalNum !== null && subtotalNum < 0) {
      issues.push("El subtotal no puede ser negativo");
    }
    if (totalNum !== null && totalNum <= 0) {
      issues.push("El total debe ser mayor a 0 en comprobantes de ingreso/egreso");
    }
    if (!moneda) issues.push("No se encontró la moneda del comprobante");
    if (!metodoPago) warnings.push("No se especificó el método de pago (MetodoPago) — recomendado");
    if (!formaPago) warnings.push("No se especificó la forma de pago (FormaPago) — recomendada");

    // ── Arithmetic validation for Ingreso/Egreso ──
    if (subtotalNum !== null && totalNum !== null) {
      const descuentoNum = toNum(descuento) ?? 0;
      const trasladadosNum = toNum(totalTrasladadosVal) ?? 0;
      const retenidosNum = toNum(totalRetenidosVal) ?? 0;
      const esperado = subtotalNum - descuentoNum + trasladadosNum - retenidosNum;
      if (Math.abs(esperado - totalNum) > 0.01) {
        issues.push("El total no coincide con subtotal + impuestos - retenciones.");
      }
    }
  }

  // ── Pago: extract payment complement ──
  let paymentComplement: PaymentComplement | null = null;

  if (tipoComprobante === "P") {
    const pagosNode = get(complemento, "pago20:Pagos") as Record<string, unknown> ??
      get(complemento, "pagos:Pagos") as Record<string, unknown> ??
      get(complemento, "Pagos") as Record<string, unknown> ?? {};

    if (pagosNode && typeof pagosNode === "object" && Object.keys(pagosNode).length > 0) {
      const complementVersion = str(get(pagosNode, "@_Version"));
      const rawPagos = get(pagosNode, "pago20:Pago") as unknown ??
        get(pagosNode, "pagos:Pago") as unknown ??
        get(pagosNode, "Pago") as unknown;

      const pagoArray = Array.isArray(rawPagos) ? rawPagos : rawPagos ? [rawPagos] : [];

      const pagos: PaymentInfo[] = pagoArray.map((p: Record<string, unknown>) => {
        const docsRaw = get(p, "pago20:DoctoRelacionado") as unknown ??
          get(p, "pagos:DoctoRelacionado") as unknown ??
          get(p, "DoctoRelacionado") as unknown;
        const docsArray = Array.isArray(docsRaw) ? docsRaw : docsRaw ? [docsRaw] : [];

        const documentosRelacionados: PaymentDocument[] = docsArray.map((d: Record<string, unknown>) => ({
          idDocumento: str(get(d, "@_IdDocumento")) ?? undefined,
          serie: str(get(d, "@_Serie")) ?? undefined,
          folio: str(get(d, "@_Folio")) ?? undefined,
          monedaDR: str(get(d, "@_MonedaDR")) ?? undefined,
          equivalenciaDR: str(get(d, "@_EquivalenciaDR")) ?? undefined,
          numParcialidad: str(get(d, "@_NumParcialidad")) ?? undefined,
          impSaldoAnt: str(get(d, "@_ImpSaldoAnt")) ?? undefined,
          impPagado: str(get(d, "@_ImpPagado")) ?? undefined,
          impSaldoInsoluto: str(get(d, "@_ImpSaldoInsoluto")) ?? undefined,
          objetoImpDR: str(get(d, "@_ObjetoImpDR")) ?? undefined,
        }));

        return {
          fechaPago: str(get(p, "@_FechaPago")) ?? undefined,
          formaDePagoP: str(get(p, "@_FormaDePagoP")) ?? undefined,
          monedaP: str(get(p, "@_MonedaP")) ?? undefined,
          monto: str(get(p, "@_Monto")) ?? undefined,
          tipoCambioP: str(get(p, "@_TipoCambioP")) ?? undefined,
          numOperacion: str(get(p, "@_NumOperacion")) ?? undefined,
          documentosRelacionados,
        };
      });

      paymentComplement = {
        version: complementVersion ?? undefined,
        pagos,
      };

      const hasRelatedDocs = pagos.some((p) => p.documentosRelacionados.length > 0);
      if (!hasRelatedDocs) {
        warnings.push("El complemento de pago no contiene documentos relacionados.");
      }
    } else {
      warnings.push("El comprobante es tipo Pago, pero no se detectó complemento de pagos.");
    }

    if (moneda !== "XXX") {
      warnings.push("En comprobantes tipo Pago, la moneda del comprobante normalmente debe ser XXX.");
    }
  }

  // ── Totals validation (Ingreso/Egreso only) ──
  let totalsValidation: TotalsValidation | null = null;

  if ((tipoComprobante === "I" || tipoComprobante === "E") && concepts && concepts.length > 0) {
    const sumaImportes = concepts.reduce((acc, c) => acc + toMoneyNumber(c.importe), 0);
    const sumaDescuentos = concepts.reduce((acc, c) => acc + toMoneyNumber(c.descuento), 0);

    let sumaTraslados = 0;
    let sumaRetenciones = 0;

    for (const c of concepts) {
      if (c.impuestos) {
        for (const t of c.impuestos.traslados) {
          sumaTraslados += toMoneyNumber(t.importe);
        }
        for (const r of c.impuestos.retenciones) {
          sumaRetenciones += toMoneyNumber(r.importe);
        }
      }
    }

    const subtotalCalculated = roundMoney(sumaImportes);
    const discountCalculated = roundMoney(sumaDescuentos);
    const transferredTaxesCalculated = roundMoney(sumaTraslados);
    const retainedTaxesCalculated = roundMoney(sumaRetenciones);

    const subtotalNum = toMoneyNumber(subtotal);
    const totalNum = toMoneyNumber(total);
    const trasladadosNum = toMoneyNumber(totalTrasladadosVal);
    const retenidosNum = toMoneyNumber(totalRetenidosVal);

    const totalCalculated = roundMoney(subtotalCalculated - discountCalculated + transferredTaxesCalculated - retainedTaxesCalculated);
    const rawDifference = Math.abs(totalCalculated - totalNum);
    const matches = rawDifference <= 0.01;
    const difference = matches ? 0 : roundMoney(rawDifference);

    totalsValidation = {
      subtotalXml: formatMoney(subtotalNum),
      subtotalCalculated: formatMoney(subtotalCalculated),
      discountCalculated: formatMoney(discountCalculated),
      transferredTaxesXml: formatMoney(trasladadosNum),
      transferredTaxesCalculated: formatMoney(transferredTaxesCalculated),
      retainedTaxesXml: formatMoney(retenidosNum),
      retainedTaxesCalculated: formatMoney(retainedTaxesCalculated),
      totalXml: formatMoney(totalNum),
      totalCalculated: formatMoney(totalCalculated),
      difference: formatMoney(difference),
      tolerance: "0.01",
      matches,
    };

    if (Math.abs(subtotalCalculated - subtotalNum) > 0.01) {
      issues.push("El subtotal global no coincide con la suma de importes de conceptos.");
    }

    if (!matches) {
      issues.push("El total global no coincide con conceptos + impuestos - descuentos - retenciones.");
    }

    if (trasladadosNum > 0 && Math.abs(transferredTaxesCalculated - trasladadosNum) > 0.01) {
      warnings.push("El total de impuestos trasladados global no coincide con la suma de traslados por concepto.");
    }

    if (retenidosNum > 0 && Math.abs(retainedTaxesCalculated - retenidosNum) > 0.01) {
      warnings.push("El total de impuestos retenidos global no coincide con la suma de retenciones por concepto.");
    }
  }

  // ── Tax Summary ──
  const TAX_LABELS: Record<string, string> = { "001": "ISR", "002": "IVA", "003": "IEPS" };

  function groupTaxEntries(entries: ConceptTaxEntry[]): TaxSummaryEntry[] {
    const map = new Map<string, { base: number; importe: number; impuesto: string; tipoFactor: string | undefined; tasaOCuota: string | undefined }>();

    for (const e of entries) {
      const impuesto = e.impuesto ?? "SIN_IMPUESTO";
      const grupo = `${impuesto}|${e.tipoFactor ?? ""}|${e.tasaOCuota ?? ""}`;

      if (!map.has(grupo)) {
        map.set(grupo, { base: 0, importe: 0, impuesto, tipoFactor: e.tipoFactor, tasaOCuota: e.tasaOCuota });
      }
      const g = map.get(grupo)!;
      g.base += toNum(e.base) ?? 0;
      g.importe += toNum(e.importe) ?? 0;
    }

    const result: TaxSummaryEntry[] = [];
    for (const [, g] of map) {
      result.push({
        impuesto: g.impuesto,
        impuestoLabel: TAX_LABELS[g.impuesto] ?? `Impuesto ${g.impuesto}`,
        tipoFactor: g.tipoFactor,
        tasaOCuota: g.tasaOCuota,
        baseCalculated: formatMoney(g.base),
        importeCalculated: formatMoney(g.importe),
      });
    }

    return result;
  }

  let taxSummary: TaxSummary | null = null;

  if (concepts && concepts.length > 0) {
    const allTraslados: ConceptTaxEntry[] = [];
    const allRetenciones: ConceptTaxEntry[] = [];

    for (const c of concepts) {
      if (c.impuestos) {
        allTraslados.push(...c.impuestos.traslados);
        allRetenciones.push(...c.impuestos.retenciones);
      }
    }

    const transferred = groupTaxEntries(allTraslados);
    const retained = groupTaxEntries(allRetenciones);

    if (transferred.length > 0 || retained.length > 0) {
      taxSummary = { transferred, retained };
    }

    for (const t of allTraslados) {
      if (t.impuesto && !["001", "002", "003"].includes(t.impuesto)) {
        warnings.push("Se detectó un impuesto no clasificado por el catálogo base del motor.");
        break;
      }
    }

    for (const r of allRetenciones) {
      if (r.impuesto && !["001", "002", "003"].includes(r.impuesto)) {
        warnings.push("Se detectó un impuesto no clasificado por el catálogo base del motor.");
        break;
      }
    }

    for (const t of allTraslados) {
      if (t.tipoFactor === "Exento" && toNum(t.importe) && toNum(t.importe)! > 0) {
        warnings.push("Un impuesto exento contiene importe; revisar consistencia fiscal.");
        break;
      }
    }

    for (const t of allTraslados) {
      if (t.tipoFactor === "Tasa" && !t.tasaOCuota) {
        warnings.push("Un impuesto con tipo factor Tasa no contiene tasa o cuota.");
        break;
      }
    }

    for (const t of allTraslados) {
      if (t.impuesto === "002" && t.tipoFactor === "Tasa" && t.tasaOCuota && !["0.160000", "0.080000", "0.000000"].includes(t.tasaOCuota)) {
        warnings.push("Se detectó una tasa de IVA no común; revisar si corresponde al caso fiscal.");
        break;
      }
    }

    for (const t of allTraslados) {
      if (t.impuesto === "003" && t.tipoFactor === "Tasa" && !t.tasaOCuota) {
        warnings.push("Un impuesto IEPS con tipo factor Tasa no contiene tasa o cuota.");
        break;
      }
    }

    for (const r of allRetenciones) {
      if (tipoComprobante === "I" || tipoComprobante === "E") {
        if (r.impuesto === "001" && toNum(r.importe) && toNum(r.base) && toNum(r.importe)! > toNum(r.base)!) {
          warnings.push("Una retención ISR tiene importe mayor que su base.");
          break;
        }
        if (r.impuesto === "002" && toNum(r.importe) && toNum(r.base) && toNum(r.importe)! > toNum(r.base)!) {
          warnings.push("Una retención de IVA tiene importe mayor que su base.");
          break;
        }
      }
    }

    const allEntries = [...allTraslados, ...allRetenciones];
    for (const e of allEntries) {
      if (e.tipoFactor === "Tasa") {
        const base = toNum(e.base) ?? 0;
        const importe = toNum(e.importe) ?? 0;
        if (base <= 0 && importe > 0) {
          warnings.push("Un impuesto tiene importe mayor a 0 con base igual o menor a 0.");
          break;
        }
        if (e.tasaOCuota) {
          const tasa = toNum(e.tasaOCuota) ?? 0;
          const esperado = roundMoney(base * tasa);
          if (Math.abs(esperado - importe) > 0.01) {
            warnings.push("El importe de un impuesto no coincide con base por tasa.");
            break;
          }
        }
      }
    }
  }

  // ── Warnings ──
  if (moneda === "XXX" && tipoComprobante !== "P") {
    warnings.push("La moneda del comprobante es 'XXX' (sin moneda), inusual en comprobantes que no son de pago");
  }

  if (tipoComprobante === "I" || tipoComprobante === "E") {
    const totalNum = toNum(total);
    if (totalNum !== null && totalNum === 0) {
      warnings.push("El total del comprobante es 0, inusual en ingreso/egreso");
    }
  }

  if (!fechaTimbrado) {
    warnings.push("No se encontró la fecha de timbrado (TimbreFiscalDigital)");
  }

  if (uuid && !UUID_REGEX.test(uuid)) {
    warnings.push("El formato del UUID no es estándar");
  }

  if (rfcEmisor && !RFC_MORAL.test(rfcEmisor) && !RFC_FISICA.test(rfcEmisor)) {
    warnings.push("El RFC del emisor tiene un formato sospechoso");
  }

  if (rfcReceptor && !RFC_MORAL.test(rfcReceptor) && !RFC_FISICA.test(rfcReceptor)) {
    warnings.push("El RFC del receptor tiene un formato sospechoso");
  }

  if (!version) {
    warnings.push("No se pudo determinar la versión del CFDI");
  }

  // ── Findings ──
  const findings: Finding[] = [];

  if (diag.bomDetected) {
    findings.push({
      severity: "INFO",
      category: "TECHNICAL",
      code: "BOM_UTF8_DETECTED",
      title: "BOM UTF-8 detectado",
      message: "El archivo contiene BOM UTF-8 al inicio. Se normalizó en memoria para lectura sin modificar contenido fiscal.",
      recommendedAction: "En fases futuras podrás descargar el XML técnicamente normalizado.",
    });
  }

  if (diag.leadingContentBeforeXml) {
    findings.push({
      severity: "INFO",
      category: "TECHNICAL",
      code: "LEADING_CONTENT_BEFORE_XML",
      title: "Contenido previo al XML",
      message: "Se detectó contenido antes del inicio del XML. Validar origen del archivo.",
      recommendedAction: "Verifica que el archivo provenga de una fuente confiable o descarga una copia limpia del SAT.",
    });
  }

  if (!hasTimbreFiscalDigital) {
    findings.push({
      severity: "WARNING",
      category: "TECHNICAL",
      code: "UNSTAMPED_XML",
      title: "XML sin timbre fiscal",
      message: "El CFDI no contiene TimbreFiscalDigital; podría no estar timbrado ni válido ante el SAT.",
      recommendedAction: "Solicita al emisor el XML timbrado o verifica en el portal del SAT.",
    });
  }

  if (structureDiagnostics.hasAddenda) {
    findings.push({
      severity: "INFO",
      category: "STRUCTURE",
      code: "ADDENDA_DETECTED",
      title: "Addenda detectada",
      message: "El comprobante contiene Addenda, utilizada típicamente para intercambio de datos entre sistemas privados.",
      recommendedAction: "Revisa que la addenda no interfiera con la validez fiscal del CFDI.",
    });
  }

  if (unknownComplements.length > 0) {
    findings.push({
      severity: "WARNING",
      category: "STRUCTURE",
      code: "UNKNOWN_COMPLEMENT",
      title: "Complemento desconocido detectado",
      message: `Se encontraron complementos no reconocidos por el motor base: ${unknownComplements.join(", ")}.`,
      recommendedAction: "Verifica si el complemento es válido fiscalmente o requiere un módulo adicional.",
    });
  }

  if (totalsValidation && !totalsValidation.matches) {
    findings.push({
      severity: "CRITICAL",
      category: "TOTALS",
      code: "TOTAL_MISMATCH",
      title: "Total global inconsistente",
      message: "El total global no coincide con conceptos, impuestos, descuentos y retenciones.",
      recommendedAction: "Solicita al emisor revisar el CFDI o valida si corresponde una corrección antes de usarlo fiscalmente.",
    });
  }

  if (issues.some(i => i.includes("El subtotal global no coincide"))) {
    findings.push({
      severity: "CRITICAL",
      category: "TOTALS",
      code: "SUBTOTAL_MISMATCH",
      title: "Subtotal global inconsistente",
      message: "El subtotal global no coincide con la suma de importes de conceptos.",
      recommendedAction: "Verifica que cada concepto tenga el importe correcto y que el subtotal esté declarado correctamente en el CFDI.",
    });
  }

  if (warnings.some(w => w.includes("El total de impuestos trasladados global no coincide"))) {
    findings.push({
      severity: "WARNING",
      category: "TAX",
      code: "TRANSFERRED_TAXES_MISMATCH",
      title: "Impuestos trasladados globales inconsistentes",
      message: "El total de impuestos trasladados global no coincide con la suma de traslados por concepto.",
      recommendedAction: "Revisa cada concepto para confirmar que los traslados de IVA/IEPS estén correctamente desglosados.",
    });
  }

  if (warnings.some(w => w.includes("El total de impuestos retenidos global no coincide"))) {
    findings.push({
      severity: "WARNING",
      category: "TAX",
      code: "RETAINED_TAXES_MISMATCH",
      title: "Impuestos retenidos globales inconsistentes",
      message: "El total de impuestos retenidos global no coincide con la suma de retenciones por concepto.",
      recommendedAction: "Revisa cada concepto para confirmar que las retenciones estén correctamente desglosadas.",
    });
  }

  if (warnings.some(w => w.includes("Se detectó una tasa de IVA no común"))) {
    findings.push({
      severity: "WARNING",
      category: "TAX",
      code: "UNCOMMON_VAT_RATE",
      title: "Tasa de IVA no común",
      message: "Se detectó una tasa de IVA fuera de las tasas comunes configuradas en el motor base.",
      recommendedAction: "Verifica que la tasa corresponda al supuesto fiscal aplicable.",
    });
  }

  if (warnings.some(w => w.includes("El importe de un impuesto no coincide con base por tasa"))) {
    findings.push({
      severity: "WARNING",
      category: "TAX",
      code: "TAX_BASE_RATE_MISMATCH",
      title: "Importe fiscal no coincide con base por tasa",
      message: "El importe de un impuesto no coincide con el resultado de base por tasa/cuota.",
      recommendedAction: "Revisa que los valores de base, tasa y el importe trasladado o retenido sean fiscalmente correctos.",
    });
  }

  // ── Executive Summary ──
  let riskLevel: "OK" | "WARNING" | "CRITICAL" = "OK";
  let summaryTitle: string;
  let summaryMessage: string;
  let summaryAction: string;

  const hasCritical = findings.some(f => f.severity === "CRITICAL");
  const hasWarning = findings.some(f => f.severity === "WARNING");
  const hasInfoOnly = findings.length > 0 && !hasCritical && !hasWarning;

  if (hasCritical) {
    riskLevel = "CRITICAL";
    summaryTitle = "XML con incidencias críticas";
    summaryMessage = "Se detectaron hallazgos críticos que pueden afectar la lectura, consistencia fiscal o uso operativo del comprobante.";
    summaryAction = "Revisa los hallazgos críticos antes de usar este XML en procesos fiscales, contables u operativos.";
  } else if (hasWarning) {
    riskLevel = "WARNING";
    summaryTitle = "XML con advertencias";
    summaryMessage = "El comprobante pudo leerse, pero se detectaron advertencias que conviene revisar.";
    summaryAction = "Revisa las advertencias para confirmar que corresponden al caso fiscal u operativo.";
  } else {
    riskLevel = "OK";
    summaryTitle = "XML sin incidencias críticas detectadas";
    summaryMessage = "El comprobante pudo leerse correctamente y no se detectaron hallazgos críticos ni advertencias.";
    summaryAction = "Puedes continuar con la revisión operativa o conservar el XML como soporte.";
  }

  if (hasInfoOnly) {
    summaryMessage += " Existen hallazgos informativos que no representan una incidencia crítica.";
  }

  if (riskLevel !== "CRITICAL") {
    if (findings.some(f => f.code === "BOM_UTF8_DETECTED")) {
      summaryAction += " La normalización aplicada fue solo técnica (BOM/contenido previo), no fiscal.";
    }
    if (findings.some(f => f.code === "UNSTAMPED_XML")) {
      summaryMessage += " El XML no está timbrado, lo que puede afectar su validez fiscal.";
      summaryAction += " Verifica que el comprobante haya sido timbrado ante el SAT antes de utilizarlo.";
    }
  }

  const executiveSummary: ExecutiveSummary = {
    riskLevel,
    title: summaryTitle,
    message: summaryMessage,
    recommendedAction: summaryAction,
  };

  return {
    uuid,
    version,
    tipoComprobante: tipoLabel,
    fecha,
    serie,
    folio,
    moneda,
    subtotal,
    total,
    rfcEmisor,
    nombreEmisor,
    rfcReceptor,
    nombreReceptor,
    fechaTimbrado,
    totalImpuestosTrasladados: totalTrasladadosVal,
    totalImpuestosRetenidos: totalRetenidosVal,
    usoCfdi,
    metodoPago,
    formaPago,
    issues,
    warnings,
    findings,
    technicalDiagnostics: diag,
    executiveSummary,
    paymentComplement: paymentComplement ?? undefined,
    structureDiagnostics,
    concepts: concepts ?? undefined,
    totalsValidation: totalsValidation ?? undefined,
    taxSummary: taxSummary ?? undefined,
  };
}

export function toAnalysisResponse(result: CfdiAnalysisResult): AnalysisResponse {
  return {
    uuid: result.uuid,
    tipoComprobante: result.tipoComprobante,
    rfcEmisor: result.rfcEmisor,
    nombreEmisor: result.nombreEmisor,
    rfcReceptor: result.rfcReceptor,
    nombreReceptor: result.nombreReceptor,
    fecha: result.fecha,
    total: result.total,
    subtotal: result.subtotal,
    moneda: result.moneda,
    version: result.version,
    serie: result.serie,
    folio: result.folio,
    usoCfdi: result.usoCfdi,
    metodoPago: result.metodoPago,
    formaPago: result.formaPago,
    fechaTimbrado: result.fechaTimbrado,
    totalImpuestosTrasladados: result.totalImpuestosTrasladados,
    totalImpuestosRetenidos: result.totalImpuestosRetenidos,
    issues: result.issues,
    warnings: result.warnings,
    findings: result.findings,
    technicalDiagnostics: result.technicalDiagnostics,
    executiveSummary: result.executiveSummary,
    paymentComplement: result.paymentComplement,
    structureDiagnostics: result.structureDiagnostics,
    concepts: result.concepts,
    totalsValidation: result.totalsValidation,
    taxSummary: result.taxSummary,
  };
}
