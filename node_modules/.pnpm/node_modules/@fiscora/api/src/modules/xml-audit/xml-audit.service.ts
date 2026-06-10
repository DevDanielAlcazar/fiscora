import { XMLParser } from "fast-xml-parser";
import { createHash } from "node:crypto";

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
  id: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  category: "TECHNICAL" | "FISCAL" | "STRUCTURE" | "COMPLEMENT" | "TAX" | "TOTALS";
  code: string;
  title: string;
  message: string;
  recommendedAction?: string;
  evidence?: { label: string; value?: string }[];
}

export interface NormalizedXml {
  available: boolean;
  reason: string;
  filename: string;
  content: string;
  originalSha256: string;
  normalizedSha256: string;
  normalizationType: "TECHNICAL_SAFE";
  fiscalContentModified: false;
  stampRisk: "NONE";
}

function sha256Text(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export interface RelatedCfdi {
  uuid?: string | null;
}

export interface CfdiRelationGroup {
  tipoRelacion?: string | null;
  relatedCfdis: RelatedCfdi[];
}

export interface CfdiRelations {
  totalRelationGroups: number;
  totalRelatedCfdis: number;
  groups: CfdiRelationGroup[];
}

export interface CartaPorteUbicacion {
  tipoUbicacion?: string | null;
  idUbicacion?: string | null;
  rfcRemitenteDestinatario?: string | null;
  nombreRemitenteDestinatario?: string | null;
  fechaHoraSalidaLlegada?: string | null;
  distanciaRecorrida?: string | null;
}

export interface CartaPorteMercancia {
  bienesTransp?: string | null;
  descripcion?: string | null;
  cantidad?: string | null;
  claveUnidad?: string | null;
  pesoEnKg?: string | null;
  valorMercancia?: string | null;
  moneda?: string | null;
}

export interface CartaPorteTransportFigure {
  tipoFigura?: string | null;
  rfcFigura?: string | null;
  nombreFigura?: string | null;
  numLicencia?: string | null;
}

export interface CartaPorteInfo {
  version?: string | null;
  idCCP?: string | null;
  transpInternac?: string | null;
  totalDistRec?: string | null;
  hasUbicaciones: boolean;
  hasMercancias: boolean;
  ubicaciones: CartaPorteUbicacion[];
  mercancias: CartaPorteMercancia[];
  figurasTransporte: CartaPorteTransportFigure[];
  hasAutotransporte: boolean;
  hasTransporteMaritimo: boolean;
  hasTransporteAereo: boolean;
  hasTransporteFerroviario: boolean;
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
  cfdiRelations?: CfdiRelations;
  cartaPorte?: CartaPorteInfo;
  structureDiagnostics: StructureDiagnostics;
  concepts?: ConceptInfo[] | null;
  totalsValidation?: TotalsValidation | null;
  taxSummary?: TaxSummary | null;
  normalizedXml?: NormalizedXml;
  regimenFiscalReceptor?: string | null;
  domicilioFiscalReceptor?: string | null;
  lugarExpedicion?: string | null;
  sello?: string | null;
  certificado?: string | null;
  noCertificado?: string | null;
  selloCfd?: string | null;
  selloSat?: string | null;
  noCertificadoSat?: string | null;
  rfcProvCertif?: string | null;
  versionTimbre?: string | null;
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
  cfdiRelations?: CfdiRelations;
  cartaPorte?: CartaPorteInfo;
  structureDiagnostics: StructureDiagnostics;
  concepts?: ConceptInfo[] | null;
  totalsValidation?: TotalsValidation | null;
  taxSummary?: TaxSummary | null;
  normalizedXml?: NormalizedXml;
  regimenFiscalReceptor?: string | null;
  domicilioFiscalReceptor?: string | null;
  lugarExpedicion?: string | null;
  sello?: string | null;
  certificado?: string | null;
  noCertificado?: string | null;
  selloCfd?: string | null;
  selloSat?: string | null;
  noCertificadoSat?: string | null;
  rfcProvCertif?: string | null;
  versionTimbre?: string | null;
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

function isNonEmptyString(value: string | null | undefined): boolean {
  return value !== null && value !== undefined && value.trim().length > 0;
}

function looksLikeCertificateNumber(value: string | null | undefined): boolean {
  if (!value) return false;
  const cleaned = value.trim();
  return /^\d{20}$/.test(cleaned) || (cleaned.length >= 10 && !isNaN(Number(cleaned)));
}

function parseCfdiDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

function isDateBefore(a: Date | null, b: Date | null): boolean {
  if (!a || !b) return false;
  return a.getTime() < b.getTime();
}

function normalizeCurrency(value: string | null | undefined): string {
  if (!value) return "";
  return value.trim().toUpperCase();
}

function moneyDiff(a: number, b: number): number {
  return Math.round(Math.abs(a - b) * 100) / 100;
}

function isPositiveMoney(value: number): boolean {
  return value > 0;
}

function isZeroOrPositiveMoney(value: number): boolean {
  return value >= 0;
}

function isIntegerLike(value: string | null | undefined): boolean {
  if (!value) return false;
  return /^\d+$/.test(value.trim());
}

function normalizeUuid(value: string | null | undefined): string {
  if (!value) return "";
  return value.trim().toUpperCase();
}

function isStandardUuid(value: string | null | undefined): boolean {
  if (!value) return false;
  return UUID_REGEX.test(value.trim());
}

function normalizeTipoRelacion(value: string | null | undefined): string {
  if (!value) return "";
  return value.trim();
}

function isTipoComprobanteEgreso(tipo: string | null | undefined): boolean {
  return normalizeTipoRelacion(tipo) === "E" || normalizeTipoRelacion(tipo) === "Egreso";
}

function isTipoComprobantePago(tipo: string | null | undefined): boolean {
  return normalizeTipoRelacion(tipo) === "P" || normalizeTipoRelacion(tipo) === "Pago";
}

function isTipoComprobanteIngreso(tipo: string | null | undefined): boolean {
  return normalizeTipoRelacion(tipo) === "I" || normalizeTipoRelacion(tipo) === "Ingreso";
}

function isTipoComprobanteTraslado(tipo: string | null | undefined): boolean {
  return normalizeTipoRelacion(tipo) === "T" || normalizeTipoRelacion(tipo) === "Traslado";
}

function isPositiveNumberLike(value: string | null | undefined): boolean {
  if (!value) return false;
  const n = parseFloat(value.trim());
  return !isNaN(n) && n > 0;
}

function isZeroOrPositiveNumberLike(value: string | null | undefined): boolean {
  if (!value) return false;
  const n = parseFloat(value.trim());
  return !isNaN(n) && n >= 0;
}

function normalizeCartaPorteVersion(value: string | null | undefined): string {
  if (!value) return "";
  return value.trim();
}

function hasChildNode(parent: Record<string, unknown>, ...names: string[]): boolean {
  return names.some(n => n in parent);
}

function isCartaPorteComplementName(name: string): boolean {
  const lower = name.toLowerCase();
  return lower.includes("cartaporte") || lower.includes("carta porte") || lower.includes("carta_porte");
}

function normalizeRfc(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.toUpperCase().trim();
}

function isGenericNationalRfc(rfc: string | null | undefined): boolean {
  return normalizeRfc(rfc) === "XAXX010101000";
}

function isGenericForeignRfc(rfc: string | null | undefined): boolean {
  return normalizeRfc(rfc) === "XEXX010101000";
}

function isGenericRfc(rfc: string | null | undefined): boolean {
  return isGenericNationalRfc(rfc) || isGenericForeignRfc(rfc);
}

function rc(version: string | null, target: "3.3" | "4.0"): boolean {
  return version === target;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RFC_MORAL = /^[A-ZÑ&]{3}\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])[A-Z0-9]{3}$/i;
const RFC_FISICA = /^[A-ZÑ&]{4}\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])[A-Z0-9]{3}$/i;

export function analyzeCfdi(rawXml: string, originalFilename?: string): CfdiAnalysisResult {
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

  const originalSha256 = sha256Text(rawXml);
  const normalizedSha256 = sha256Text(xmlContent);

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
  const sello = str(get(comprobante, "@_Sello"));
  const certificado = str(get(comprobante, "@_Certificado"));
  const noCertificado = str(get(comprobante, "@_NoCertificado"));

  // Emisor
  const emisor = get(comprobante, "cfdi:Emisor") as Record<string, unknown> ?? {};
  const rfcEmisor = str(get(emisor, "@_Rfc"));
  const nombreEmisor = str(get(emisor, "@_Nombre"));

  // Receptor
  const receptor = get(comprobante, "cfdi:Receptor") as Record<string, unknown> ?? {};
  const rfcReceptor = str(get(receptor, "@_Rfc"));
  const nombreReceptor = str(get(receptor, "@_Nombre"));
  const usoCfdi = str(get(receptor, "@_UsoCFDI"));
  const regimenFiscalReceptor = str(get(receptor, "@_RegimenFiscalReceptor"));
  const domicilioFiscalReceptor = str(get(receptor, "@_DomicilioFiscalReceptor"));
  const lugarExpedicion = str(get(comprobante, "@_LugarExpedicion"));

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

  let selloCfd: string | null = null;
  let selloSat: string | null = null;
  let noCertificadoSat: string | null = null;
  let rfcProvCertif: string | null = null;
  let versionTimbre: string | null = null;

  if (hasTimbreFiscalDigital) {
    uuid = str(get(timbre, "@_UUID")) ?? str(get(timbre, "@_uuid"));
    fechaTimbrado = str(get(timbre, "@_FechaTimbrado"));
    selloCfd = str(get(timbre, "@_SelloCFD"));
    selloSat = str(get(timbre, "@_SelloSAT"));
    noCertificadoSat = str(get(timbre, "@_NoCertificadoSAT"));
    rfcProvCertif = str(get(timbre, "@_RfcProvCertif"));
    versionTimbre = str(get(timbre, "@_Version"));
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

    if (!regimenFiscalReceptor) {
      issues.push("CFDI 4.0: No se encontró el régimen fiscal del receptor");
    }

    if (!domicilioFiscalReceptor) {
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

  // ── CFDI Relacionados ──
  let cfdiRelations: CfdiRelations | undefined;

  const rawRelationGroups = get(comprobante, "cfdi:CfdiRelacionados") as unknown ??
    get(comprobante, "CfdiRelacionados") as unknown;

  if (rawRelationGroups) {
    const groupArray = Array.isArray(rawRelationGroups)
      ? rawRelationGroups
      : [rawRelationGroups];

    const groups: CfdiRelationGroup[] = [];

    for (const group of groupArray) {
      if (!group || typeof group !== "object") continue;

      const tipoRelacion = str(get(group, "@_TipoRelacion")) ?? null;
      const rawRelated = get(group, "cfdi:CfdiRelacionado") as unknown ??
        get(group, "CfdiRelacionado") as unknown;

      const relatedArray = Array.isArray(rawRelated)
        ? rawRelated
        : rawRelated
          ? [rawRelated]
          : [];

      const relatedCfdis: RelatedCfdi[] = relatedArray.map((r: Record<string, unknown>) => ({
        uuid: str(get(r, "@_UUID")) ?? undefined,
      }));

      groups.push({ tipoRelacion, relatedCfdis });
    }

    if (groups.length > 0) {
      const totalRelatedCfdis = groups.reduce((acc, g) => acc + g.relatedCfdis.length, 0);
      cfdiRelations = {
        totalRelationGroups: groups.length,
        totalRelatedCfdis,
        groups,
      };
    }
  }

  // ── Carta Porte ──
  let cartaPorte: CartaPorteInfo | undefined;

  const cartaPorteNode = get(complemento, "cartaporte31:CartaPorte") as Record<string, unknown> ??
    get(complemento, "cartaporte30:CartaPorte") as Record<string, unknown> ??
    get(complemento, "cartaporte20:CartaPorte") as Record<string, unknown> ??
    get(complemento, "CartaPorte") as Record<string, unknown> ?? null;

  if (cartaPorteNode && typeof cartaPorteNode === "object" && Object.keys(cartaPorteNode).length > 0) {
    const version = str(get(cartaPorteNode, "@_Version")) ?? null;
    const idCCP = str(get(cartaPorteNode, "@_IdCCP")) ?? null;
    const transpInternac = str(get(cartaPorteNode, "@_TranspInternac")) ?? null;
    const totalDistRec = str(get(cartaPorteNode, "@_TotalDistRec")) ?? null;

    // Ubicaciones
    const rawUbics = get(cartaPorteNode, "cartaporte31:Ubicaciones") as Record<string, unknown> ??
      get(cartaPorteNode, "cartaporte30:Ubicaciones") as Record<string, unknown> ??
      get(cartaPorteNode, "cartaporte20:Ubicaciones") as Record<string, unknown> ??
      get(cartaPorteNode, "Ubicaciones") as Record<string, unknown> ?? null;

    let ubicacionesNodes: unknown[] = [];
    if (rawUbics && typeof rawUbics === "object") {
      const rawUbi = get(rawUbics, "cartaporte31:Ubicacion") as unknown ??
        get(rawUbics, "cartaporte30:Ubicacion") as unknown ??
        get(rawUbics, "cartaporte20:Ubicacion") as unknown ??
        get(rawUbics, "Ubicacion") as unknown;
      ubicacionesNodes = Array.isArray(rawUbi) ? rawUbi : rawUbi ? [rawUbi] : [];
    }

    const ubicaciones: CartaPorteUbicacion[] = (ubicacionesNodes as Record<string, unknown>[]).map((u) => ({
      tipoUbicacion: str(get(u, "@_TipoUbicacion")) ?? null,
      idUbicacion: str(get(u, "@_IDUbicacion")) ?? null,
      rfcRemitenteDestinatario: str(get(u, "@_RFCRemitenteDestinatario")) ?? null,
      nombreRemitenteDestinatario: str(get(u, "@_NombreRemitenteDestinatario")) ?? null,
      fechaHoraSalidaLlegada: str(get(u, "@_FechaHoraSalidaLlegada")) ?? null,
      distanciaRecorrida: str(get(u, "@_DistanciaRecorrida")) ?? null,
    }));

    // Mercancias
    const rawMercs = get(cartaPorteNode, "cartaporte31:Mercancias") as Record<string, unknown> ??
      get(cartaPorteNode, "cartaporte30:Mercancias") as Record<string, unknown> ??
      get(cartaPorteNode, "cartaporte20:Mercancias") as Record<string, unknown> ??
      get(cartaPorteNode, "Mercancias") as Record<string, unknown> ?? null;

    let mercanciasNodes: unknown[] = [];
    if (rawMercs && typeof rawMercs === "object") {
      const rawMer = get(rawMercs, "cartaporte31:Mercancia") as unknown ??
        get(rawMercs, "cartaporte30:Mercancia") as unknown ??
        get(rawMercs, "cartaporte20:Mercancia") as unknown ??
        get(rawMercs, "Mercancia") as unknown;
      mercanciasNodes = Array.isArray(rawMer) ? rawMer : rawMer ? [rawMer] : [];
    }

    const mercancias: CartaPorteMercancia[] = (mercanciasNodes as Record<string, unknown>[]).map((m) => ({
      bienesTransp: str(get(m, "@_BienesTransp")) ?? null,
      descripcion: str(get(m, "@_Descripcion")) ?? null,
      cantidad: str(get(m, "@_Cantidad")) ?? null,
      claveUnidad: str(get(m, "@_ClaveUnidad")) ?? null,
      pesoEnKg: str(get(m, "@_PesoEnKg")) ?? null,
      valorMercancia: str(get(m, "@_ValorMercancia")) ?? null,
      moneda: str(get(m, "@_Moneda")) ?? null,
    }));

    // Figuras Transporte
    const rawFigs = get(cartaPorteNode, "cartaporte31:FiguraTransporte") as Record<string, unknown> ??
      get(cartaPorteNode, "cartaporte30:FiguraTransporte") as Record<string, unknown> ??
      get(cartaPorteNode, "cartaporte20:FiguraTransporte") as Record<string, unknown> ??
      get(cartaPorteNode, "FiguraTransporte") as Record<string, unknown> ?? null;

    const figurasNodes: unknown[] = [];
    if (rawFigs && typeof rawFigs === "object") {
      const rawTiposFig = get(rawFigs, "cartaporte31:TiposFigura") as unknown ??
        get(rawFigs, "cartaporte30:TiposFigura") as unknown ??
        get(rawFigs, "cartaporte20:TiposFigura") as unknown ??
        get(rawFigs, "TiposFigura") as unknown;
      const tiposFigArray = Array.isArray(rawTiposFig) ? rawTiposFig : rawTiposFig ? [rawTiposFig] : [];
      tiposFigArray.forEach((tf: Record<string, unknown>) => {
        const rawFig = get(tf, "cartaporte31:PartesTransporte") as unknown ??
          get(tf, "cartaporte30:PartesTransporte") as unknown ??
          get(tf, "cartaporte20:PartesTransporte") as unknown ??
          get(tf, "PartesTransporte") as unknown;
        const partesArray = Array.isArray(rawFig) ? rawFig : rawFig ? [rawFig] : [];
        partesArray.forEach((p: Record<string, unknown>) => {
          figurasNodes.push({
            tipoFigura: str(get(tf, "@_TipoFigura")) ?? null,
            rfcFigura: str(get(p, "@_RFCFigura")) ?? null,
            nombreFigura: str(get(p, "@_NombreFigura")) ?? null,
            numLicencia: str(get(p, "@_NumLicencia")) ?? null,
          });
        });
      });
    }

    const figurasTransporte: CartaPorteTransportFigure[] = (figurasNodes as Record<string, unknown>[]).map((f) => ({
      tipoFigura: str(get(f, "tipoFigura")) ?? null,
      rfcFigura: str(get(f, "rfcFigura")) ?? null,
      nombreFigura: str(get(f, "nombreFigura")) ?? null,
      numLicencia: str(get(f, "numLicencia")) ?? null,
    }));

    // Detect medio transporte
    const hasAutotransporte = hasChildNode(cartaPorteNode,
      "cartaporte31:Autotransporte", "cartaporte30:Autotransporte", "cartaporte20:Autotransporte", "Autotransporte",
    );
    const hasTransporteMaritimo = hasChildNode(cartaPorteNode,
      "cartaporte31:TransporteMaritimo", "cartaporte30:TransporteMaritimo", "cartaporte20:TransporteMaritimo", "TransporteMaritimo",
    );
    const hasTransporteAereo = hasChildNode(cartaPorteNode,
      "cartaporte31:TransporteAereo", "cartaporte30:TransporteAereo", "cartaporte20:TransporteAereo", "TransporteAereo",
    );
    const hasTransporteFerroviario = hasChildNode(cartaPorteNode,
      "cartaporte31:TransporteFerroviario", "cartaporte30:TransporteFerroviario", "cartaporte20:TransporteFerroviario", "TransporteFerroviario",
    );

    cartaPorte = {
      version,
      idCCP,
      transpInternac,
      totalDistRec,
      hasUbicaciones: ubicaciones.length > 0,
      hasMercancias: mercancias.length > 0,
      ubicaciones,
      mercancias,
      figurasTransporte,
      hasAutotransporte,
      hasTransporteMaritimo,
      hasTransporteAereo,
      hasTransporteFerroviario,
    };
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
  let lastUncommonVatRate: string | undefined;
  let lastBaseRateMismatch: { base: string; tasaOCuota: string; importe: string } | undefined;

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
        lastUncommonVatRate = t.tasaOCuota;
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
            lastBaseRateMismatch = { base: e.base ?? "", tasaOCuota: e.tasaOCuota ?? "", importe: e.importe ?? "" };
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
  const addedKeys = new Set<string>();
  const codeCounters: Record<string, number> = {};

  function addFindingOnce(f: Omit<Finding, "id">) {
    const evidenceStr = JSON.stringify(f.evidence ?? []);
    const key = `${f.code}||${f.message}||${evidenceStr}`;
    if (!addedKeys.has(key)) {
      addedKeys.add(key);
      if (!codeCounters[f.code]) codeCounters[f.code] = 1;
      const id = `${f.code}-${codeCounters[f.code]++}`;
      findings.push({ ...f, id });
    }
  }

  if (diag.bomDetected) {
    addFindingOnce({
      severity: "INFO",
      category: "TECHNICAL",
      code: "BOM_UTF8_DETECTED",
      title: "BOM UTF-8 detectado",
      message: "El archivo contiene BOM UTF-8 al inicio. Se normalizó en memoria para lectura sin modificar contenido fiscal.",
      recommendedAction: "En fases futuras podrás descargar el XML técnicamente normalizado.",
      evidence: [
        { label: "Problema detectado", value: "BOM UTF-8 al inicio del archivo" },
        { label: "Normalización aplicada", value: "Sí, solo en memoria" },
        { label: "Contenido fiscal modificado", value: "No" },
        { label: "Hash original SHA-256", value: originalSha256 },
        { label: "Hash normalizado SHA-256", value: normalizedSha256 },
        { label: "Riesgo para timbre/sello", value: "Ninguno" },
        { label: "Tipo de normalización", value: "TECHNICAL_SAFE" },
      ],
    });
  }

  if (diag.leadingContentBeforeXml) {
    addFindingOnce({
      severity: "INFO",
      category: "TECHNICAL",
      code: "LEADING_CONTENT_BEFORE_XML",
      title: "Contenido previo al XML",
      message: "Se detectó contenido antes del inicio del XML. Validar origen del archivo.",
      recommendedAction: "Verifica que el archivo provenga de una fuente confiable o descarga una copia limpia del SAT.",
      evidence: [
        { label: "Problema detectado", value: "Contenido previo al primer '<'" },
        { label: "Normalización aplicada", value: "Sí, solo en memoria" },
        { label: "Contenido fiscal modificado", value: "No" },
        { label: "Hash original SHA-256", value: originalSha256 },
        { label: "Hash normalizado SHA-256", value: normalizedSha256 },
        { label: "Riesgo para timbre/sello", value: "Ninguno" },
        { label: "Tipo de normalización", value: "TECHNICAL_SAFE" },
      ],
    });
  }

  if (!hasTimbreFiscalDigital) {
    addFindingOnce({
      severity: "WARNING",
      category: "TECHNICAL",
      code: "UNSTAMPED_XML",
      title: "XML sin timbre fiscal",
      message: "El CFDI no contiene TimbreFiscalDigital; podría no estar timbrado ni válido ante el SAT.",
      recommendedAction: "Solicita al emisor el XML timbrado o verifica en el portal del SAT.",
    });
  }

  if (structureDiagnostics.hasAddenda) {
    addFindingOnce({
      severity: "INFO",
      category: "STRUCTURE",
      code: "ADDENDA_DETECTED",
      title: "Addenda detectada",
      message: "El comprobante contiene Addenda, utilizada típicamente para intercambio de datos entre sistemas privados.",
      recommendedAction: "Revisa que la addenda no interfiera con la validez fiscal del CFDI.",
    });
  }

  if (unknownComplements.length > 0) {
    addFindingOnce({
      severity: "WARNING",
      category: "STRUCTURE",
      code: "UNKNOWN_COMPLEMENT",
      title: "Complemento desconocido detectado",
      message: `Se encontraron complementos no reconocidos por el motor base: ${unknownComplements.join(", ")}.`,
      recommendedAction: "Verifica si el complemento es válido fiscalmente o requiere un módulo adicional.",
    });
  }

  if (totalsValidation && !totalsValidation.matches) {
    addFindingOnce({
      severity: "CRITICAL",
      category: "TOTALS",
      code: "TOTAL_MISMATCH",
      title: "Total global inconsistente",
      message: "El total global no coincide con conceptos, impuestos, descuentos y retenciones.",
      recommendedAction: "Solicita al emisor revisar el CFDI o valida si corresponde una corrección antes de usarlo fiscalmente.",
      evidence: [
        { label: "Total XML", value: totalsValidation.totalXml },
        { label: "Total calculado", value: totalsValidation.totalCalculated },
        { label: "Diferencia", value: totalsValidation.difference },
        { label: "Tolerancia", value: totalsValidation.tolerance },
      ],
    });
  }

  // ── Map issues to findings ──

  if (issues.some(i => i.includes("El subtotal global no coincide"))) {
    addFindingOnce({
      severity: "CRITICAL",
      category: "TOTALS",
      code: "SUBTOTAL_MISMATCH",
      title: "Subtotal global inconsistente",
      message: "El subtotal global no coincide con la suma de importes de conceptos.",
      recommendedAction: "Verifica que cada concepto tenga el importe correcto y que el subtotal esté declarado correctamente en el CFDI.",
      evidence: [
        { label: "Subtotal XML", value: totalsValidation?.subtotalXml },
        { label: "Subtotal calculado", value: totalsValidation?.subtotalCalculated },
      ],
    });
  }

  if (issues.some(i => i.includes("El total no coincide con subtotal + impuestos"))) {
    addFindingOnce({
      severity: "CRITICAL",
      category: "TOTALS",
      code: "ARITHMETIC_TOTAL_MISMATCH",
      title: "Total aritmético inconsistente",
      message: "El total del comprobante no coincide con la operación resta de subtotal, descuento, impuestos y retenciones.",
      recommendedAction: "Revisa los valores de subtotal, descuentos, traslados y retenciones declarados en el XML.",
    });
  }

  if (issues.some(i => i.includes("No se encontró la versión del CFDI"))) {
    addFindingOnce({
      severity: "CRITICAL",
      category: "TECHNICAL",
      code: "MISSING_VERSION",
      title: "Versión del CFDI faltante",
      message: "No se encontró la versión del CFDI en el comprobante.",
      recommendedAction: "Verifica que el XML sea un CFDI válido emitido por un proveedor autorizado.",
    });
  }

  if (issues.some(i => i.includes("No se encontró el UUID"))) {
    addFindingOnce({
      severity: "CRITICAL",
      category: "TECHNICAL",
      code: "MISSING_UUID",
      title: "UUID del timbre faltante",
      message: "No se encontró el UUID en el TimbreFiscalDigital.",
      recommendedAction: "El comprobante no cuenta con un UUID válido; solicita el XML timbrado al emisor.",
    });
  }

  if (issues.some(i => i.includes("No se encontró el RFC del emisor"))) {
    addFindingOnce({
      severity: "CRITICAL",
      category: "FISCAL",
      code: "MISSING_RFC_EMISOR",
      title: "RFC del emisor faltante",
      message: "No se encontró el RFC del emisor en el comprobante.",
      recommendedAction: "El RFC del emisor es obligatorio; solicita un CFDI válido al proveedor.",
    });
  }

  if (issues.some(i => i.includes("No se encontró el RFC del receptor"))) {
    addFindingOnce({
      severity: "CRITICAL",
      category: "FISCAL",
      code: "MISSING_RFC_RECEPTOR",
      title: "RFC del receptor faltante",
      message: "No se encontró el RFC del receptor en el comprobante.",
      recommendedAction: "El RFC del receptor es obligatorio; verifica que el CFDI incluya tus datos fiscales.",
    });
  }

  if (issues.some(i => i.includes("El comprobante no contiene conceptos"))) {
    addFindingOnce({
      severity: "CRITICAL",
      category: "FISCAL",
      code: "MISSING_CONCEPTS",
      title: "Conceptos fiscales faltantes",
      message: "El comprobante no contiene conceptos. Sin conceptos no hay base fiscal en el CFDI.",
      recommendedAction: "Solicita al emisor un CFDI que incluya al menos un concepto.",
    });
  }

  if (issues.some(i => i.includes("No se encontró el total"))) {
    addFindingOnce({
      severity: "CRITICAL",
      category: "FISCAL",
      code: "MISSING_TOTAL",
      title: "Total del comprobante faltante",
      message: "No se encontró el total del comprobante.",
      recommendedAction: "El total es obligatorio; verifica que el XML esté completo.",
    });
  }

  if (issues.some(i => i.includes("No se encontró el subtotal"))) {
    addFindingOnce({
      severity: "CRITICAL",
      category: "FISCAL",
      code: "MISSING_SUBTOTAL",
      title: "Subtotal del comprobante faltante",
      message: "No se encontró el subtotal del comprobante.",
      recommendedAction: "El subtotal es obligatorio; verifica que el XML esté completo.",
    });
  }

  if (issues.some(i => i.includes("No se encontró el tipo de comprobante"))) {
    addFindingOnce({
      severity: "CRITICAL",
      category: "FISCAL",
      code: "MISSING_TIPO_COMPROBANTE",
      title: "Tipo de comprobante faltante",
      message: "No se encontró el TipoDeComprobante en el CFDI.",
      recommendedAction: "El tipo de comprobante es obligatorio; verifica que el XML esté completo.",
    });
  }

  if (issues.some(i => i.includes("No se encontró la fecha"))) {
    addFindingOnce({
      severity: "CRITICAL",
      category: "FISCAL",
      code: "MISSING_FECHA",
      title: "Fecha del comprobante faltante",
      message: "No se encontró la fecha del comprobante.",
      recommendedAction: "La fecha es obligatoria; verifica que el XML esté completo.",
    });
  }

  if (issues.some(i => i.includes("No se encontró la moneda"))) {
    addFindingOnce({
      severity: "CRITICAL",
      category: "FISCAL",
      code: "MISSING_MONEDA",
      title: "Moneda del comprobante faltante",
      message: "No se encontró la moneda en el comprobante.",
      recommendedAction: "La moneda es obligatoria; verifica que el XML esté completo.",
    });
  }

  if (issues.some(i => i.includes("El subtotal no puede ser negativo"))) {
    addFindingOnce({
      severity: "CRITICAL",
      category: "FISCAL",
      code: "SUBTOTAL_NEGATIVE",
      title: "Subtotal negativo",
      message: "El subtotal del comprobante es negativo, lo cual no es válido.",
      recommendedAction: "Revisa el origen del CFDI; un subtotal negativo puede indicar un error en la emisión.",
    });
  }

  if (issues.some(i => i.includes("El total debe ser mayor a 0"))) {
    addFindingOnce({
      severity: "CRITICAL",
      category: "FISCAL",
      code: "TOTAL_NON_POSITIVE",
      title: "Total no positivo en ingreso/egreso",
      message: "El total debe ser mayor a 0 en comprobantes de ingreso o egreso.",
      recommendedAction: "Verifica que el CFDI tenga un valor fiscal válido.",
    });
  }

  if (issues.some(i => i.includes("CFDI 4.0: No se encontró el nombre del emisor"))) {
    addFindingOnce({
      severity: "CRITICAL",
      category: "FISCAL",
      code: "CFDI40_MISSING_EMISOR_NAME",
      title: "Nombre del emisor faltante (CFDI 4.0)",
      message: "En CFDI 4.0 el nombre del emisor es obligatorio y no se encontró.",
      recommendedAction: "Solicita al emisor que el CFDI incluya su nombre completo o razón social.",
    });
  }

  if (issues.some(i => i.includes("CFDI 4.0: No se encontró el nombre del receptor"))) {
    addFindingOnce({
      severity: "CRITICAL",
      category: "FISCAL",
      code: "CFDI40_MISSING_RECEPTOR_NAME",
      title: "Nombre del receptor faltante (CFDI 4.0)",
      message: "En CFDI 4.0 el nombre del receptor es obligatorio y no se encontró.",
      recommendedAction: "Verifica que el CFDI incluya tu nombre o razón fiscal.",
    });
  }

  if (issues.some(i => i.includes("CFDI 4.0: No se encontró el uso del CFDI"))) {
    addFindingOnce({
      severity: "CRITICAL",
      category: "FISCAL",
      code: "CFDI40_MISSING_USO_CFDI",
      title: "Uso del CFDI faltante (CFDI 4.0)",
      message: "En CFDI 4.0 el UsoCFDI del receptor es obligatorio y no se encontró.",
      recommendedAction: "Asegúrate de proporcionar tu uso de CFDI correcto al emisor.",
    });
  }

  if (issues.some(i => i.includes("No se encontró el régimen fiscal del receptor"))) {
    addFindingOnce({
      severity: "CRITICAL",
      category: "FISCAL",
      code: "CFDI40_MISSING_REGIMEN_RECEPTOR",
      title: "Régimen fiscal del receptor faltante (CFDI 4.0)",
      message: "En CFDI 4.0 el régimen fiscal del receptor es obligatorio y no se encontró.",
      recommendedAction: "Verifica que tu régimen fiscal esté correctamente registrado con el emisor.",
    });
  }

  if (issues.some(i => i.includes("No se encontró el domicilio fiscal del receptor"))) {
    addFindingOnce({
      severity: "CRITICAL",
      category: "FISCAL",
      code: "CFDI40_MISSING_DOMICILIO_RECEPTOR",
      title: "Domicilio fiscal del receptor faltante (CFDI 4.0)",
      message: "En CFDI 4.0 el DomicilioFiscalReceptor es obligatorio y no se encontró.",
      recommendedAction: "Verifica que tu domicilio fiscal esté correctamente registrado con el emisor.",
    });
  }

  // ── Map warnings to findings ──

  if (warnings.some(w => w.includes("Versión de CFDI no estándar"))) {
    addFindingOnce({
      severity: "WARNING",
      category: "TECHNICAL",
      code: "UNSUPPORTED_CFDI_VERSION",
      title: "Versión de CFDI no estándar",
      message: "La versión del CFDI no es 3.3 ni 4.0.",
      recommendedAction: "Verifica que el comprobante use una versión de CFDI aceptada por el SAT.",
    });
  }

  if (warnings.some(w => w.includes("El total de impuestos trasladados global no coincide"))) {
    addFindingOnce({
      severity: "WARNING",
      category: "TAX",
      code: "TRANSFERRED_TAXES_MISMATCH",
      title: "Impuestos trasladados globales inconsistentes",
      message: "El total de impuestos trasladados global no coincide con la suma de traslados por concepto.",
      recommendedAction: "Revisa cada concepto para confirmar que los traslados de IVA/IEPS estén correctamente desglosados.",
      evidence: [
        { label: "Trasladados XML", value: totalsValidation?.transferredTaxesXml },
        { label: "Trasladados calculados", value: totalsValidation?.transferredTaxesCalculated },
      ],
    });
  }

  if (warnings.some(w => w.includes("El total de impuestos retenidos global no coincide"))) {
    addFindingOnce({
      severity: "WARNING",
      category: "TAX",
      code: "RETAINED_TAXES_MISMATCH",
      title: "Impuestos retenidos globales inconsistentes",
      message: "El total de impuestos retenidos global no coincide con la suma de retenciones por concepto.",
      recommendedAction: "Revisa cada concepto para confirmar que las retenciones estén correctamente desglosadas.",
      evidence: [
        { label: "Retenidos XML", value: totalsValidation?.retainedTaxesXml },
        { label: "Retenidos calculados", value: totalsValidation?.retainedTaxesCalculated },
      ],
    });
  }

  if (warnings.some(w => w.includes("Se detectó una tasa de IVA no común"))) {
    addFindingOnce({
      severity: "WARNING",
      category: "TAX",
      code: "UNCOMMON_VAT_RATE",
      title: "Tasa de IVA no común",
      message: "Se detectó una tasa de IVA fuera de las tasas comunes configuradas en el motor base.",
      recommendedAction: "Verifica que la tasa corresponda al supuesto fiscal aplicable.",
      evidence: [
        { label: "Impuesto", value: "IVA (002)" },
        { label: "Tasa detectada", value: lastUncommonVatRate },
        { label: "Tasas comunes", value: "0.160000, 0.080000, 0.000000" },
      ],
    });
  }

  if (warnings.some(w => w.includes("El importe de un impuesto no coincide con base por tasa"))) {
    const baseNum = toNum(lastBaseRateMismatch?.base);
    const tasaNum = toNum(lastBaseRateMismatch?.tasaOCuota);
    addFindingOnce({
      severity: "WARNING",
      category: "TAX",
      code: "TAX_BASE_RATE_MISMATCH",
      title: "Importe fiscal no coincide con base por tasa",
      message: "El importe de un impuesto no coincide con el resultado de base por tasa/cuota.",
      recommendedAction: "Revisa que los valores de base, tasa y el importe trasladado o retenido sean fiscalmente correctos.",
      evidence: [
        { label: "Base", value: lastBaseRateMismatch?.base },
        { label: "Tasa", value: lastBaseRateMismatch?.tasaOCuota },
        { label: "Importe XML", value: lastBaseRateMismatch?.importe },
        { label: "Importe esperado", value: baseNum !== null && tasaNum !== null ? formatMoney(baseNum * tasaNum) : undefined },
      ],
    });
  }

  if (warnings.some(w => w.includes("Un concepto no contiene ClaveProdServ"))) {
    addFindingOnce({
      severity: "WARNING",
      category: "FISCAL",
      code: "CONCEPT_MISSING_CLAVE_PROD_SERV",
      title: "Concepto sin ClaveProdServ",
      message: "Un concepto del CFDI no contiene clave de producto o servicio.",
      recommendedAction: "La clave de producto o servicio es importante para la clasificación fiscal; solicita al emisor incluirla.",
    });
  }

  if (warnings.some(w => w.includes("Un concepto no contiene cantidad"))) {
    addFindingOnce({
      severity: "WARNING",
      category: "FISCAL",
      code: "CONCEPT_MISSING_CANTIDAD",
      title: "Concepto sin cantidad",
      message: "Un concepto del CFDI no tiene cantidad especificada.",
      recommendedAction: "La cantidad permite verificar la integridad del cálculo fiscal; solicítala al emisor.",
    });
  }

  if (warnings.some(w => w.includes("Un concepto no contiene descripción"))) {
    addFindingOnce({
      severity: "WARNING",
      category: "FISCAL",
      code: "CONCEPT_MISSING_DESCRIPCION",
      title: "Concepto sin descripción",
      message: "Un concepto del CFDI no tiene descripción del bien o servicio.",
      recommendedAction: "La descripción es necesaria para identificar el producto o servicio; solicítala al emisor.",
    });
  }

  if (warnings.some(w => w.includes("Un concepto no contiene ObjetoImp"))) {
    addFindingOnce({
      severity: "WARNING",
      category: "FISCAL",
      code: "CONCEPT_MISSING_OBJETO_IMP",
      title: "Concepto sin ObjetoImp (CFDI 4.0)",
      message: "Un concepto en CFDI 4.0 no contiene el campo ObjetoImp.",
      recommendedAction: "ObjetoImp es obligatorio en CFDI 4.0; solicita al emisor corregir el CFDI.",
    });
  }

  if (warnings.some(w => w.includes("Un concepto marcado como objeto de impuesto sí objeto de impuesto no contiene impuestos"))) {
    addFindingOnce({
      severity: "WARNING",
      category: "TAX",
      code: "CONCEPT_OBJETO_IMP_NO_TAX",
      title: "Concepto marcado como objeto de impuesto sin impuestos",
      message: "Un concepto con ObjetoImp=02 (sí objeto de impuesto) no contiene traslados ni retenciones.",
      recommendedAction: "Verifica que el concepto deba estar exento o solicita al emisor corregir los impuestos.",
    });
  }

  if (warnings.some(w => w.includes("Un traslado de concepto no contiene base"))) {
    addFindingOnce({
      severity: "WARNING",
      category: "TAX",
      code: "TRASLADO_MISSING_BASE",
      title: "Traslado sin base",
      message: "Un traslado de impuesto en un concepto no tiene base especificada.",
      recommendedAction: "La base es necesaria para calcular el impuesto; solicita al emisor corregir el CFDI.",
    });
  }

  if (warnings.some(w => w.includes("Un traslado de concepto no contiene impuesto"))) {
    addFindingOnce({
      severity: "WARNING",
      category: "TAX",
      code: "TRASLADO_MISSING_IMPUESTO",
      title: "Traslado sin tipo de impuesto",
      message: "Un traslado de concepto no especifica el tipo de impuesto (IVA/IEPS).",
      recommendedAction: "El tipo de impuesto es obligatorio; solicita al emisor corregir el CFDI.",
    });
  }

  if (warnings.some(w => w.includes("Un traslado de concepto no contiene tipo factor"))) {
    addFindingOnce({
      severity: "WARNING",
      category: "TAX",
      code: "TRASLADO_MISSING_TIPO_FACTOR",
      title: "Traslado sin tipo factor",
      message: "Un traslado de concepto no contiene el tipo factor (Tasa/Cuota/Exento).",
      recommendedAction: "El tipo factor es obligatorio; solicita al emisor corregir el CFDI.",
    });
  }

  if (warnings.some(w => w.includes("Un traslado de concepto gravado no contiene importe"))) {
    addFindingOnce({
      severity: "WARNING",
      category: "TAX",
      code: "TRASLADO_MISSING_IMPORTE",
      title: "Traslado gravado sin importe",
      message: "Un traslado de concepto con tipo factor distinto de Exento no contiene importe.",
      recommendedAction: "El importe del traslado es obligatorio para impuestos gravados; solicita al emisor corregir el CFDI.",
    });
  }

  if (warnings.some(w => w.includes("Una retención de concepto no contiene base"))) {
    addFindingOnce({
      severity: "WARNING",
      category: "TAX",
      code: "RETENCION_MISSING_BASE",
      title: "Retención sin base",
      message: "Una retención de concepto no tiene base especificada.",
      recommendedAction: "La base es necesaria para calcular la retención; solicita al emisor corregir el CFDI.",
    });
  }

  if (warnings.some(w => w.includes("Una retención de concepto no contiene impuesto"))) {
    addFindingOnce({
      severity: "WARNING",
      category: "TAX",
      code: "RETENCION_MISSING_IMPUESTO",
      title: "Retención sin tipo de impuesto",
      message: "Una retención de concepto no especifica el tipo de impuesto (ISR/IVA).",
      recommendedAction: "El tipo de impuesto es obligatorio; solicita al emisor corregir el CFDI.",
    });
  }

  if (warnings.some(w => w.includes("Una retención de concepto no contiene importe"))) {
    addFindingOnce({
      severity: "WARNING",
      category: "TAX",
      code: "RETENCION_MISSING_IMPORTE",
      title: "Retención sin importe",
      message: "Una retención de concepto no tiene importe especificado.",
      recommendedAction: "El importe de la retención es obligatorio; solicita al emisor corregir el CFDI.",
    });
  }

  if (warnings.some(w => w.includes("No se especificó el método de pago"))) {
    addFindingOnce({
      severity: "WARNING",
      category: "FISCAL",
      code: "MISSING_METODO_PAGO",
      title: "Método de pago no especificado",
      message: "El método de pago (MetodoPago) no fue especificado en el comprobante.",
      recommendedAction: "Se recomienda especificar el método de pago para mayor claridad fiscal.",
    });
  }

  if (warnings.some(w => w.includes("No se especificó la forma de pago"))) {
    addFindingOnce({
      severity: "WARNING",
      category: "FISCAL",
      code: "MISSING_FORMA_PAGO",
      title: "Forma de pago no especificada",
      message: "La forma de pago (FormaPago) no fue especificada en el comprobante.",
      recommendedAction: "Se recomienda especificar la forma de pago para mayor claridad fiscal.",
    });
  }

  if (warnings.some(w => w.includes("El complemento de pago no contiene documentos relacionados"))) {
    addFindingOnce({
      severity: "WARNING",
      category: "COMPLEMENT",
      code: "PAGO_MISSING_DOCUMENTOS",
      title: "Complemento de pago sin documentos relacionados",
      message: "El complemento de pago no contiene documentos relacionados.",
      recommendedAction: "En comprobantes de pago los documentos relacionados son esperados; verifica el origen.",
    });
  }

  if (warnings.some(w => w.includes("El comprobante es tipo Pago, pero no se detectó complemento de pagos"))) {
    addFindingOnce({
      severity: "WARNING",
      category: "COMPLEMENT",
      code: "PAGO_MISSING_COMPLEMENT",
      title: "Complemento de pagos faltante en tipo Pago",
      message: "El comprobante es tipo Pago pero no se detectó el complemento de pagos.",
      recommendedAction: "Verifica que el XML contenga el complemento de pagos necesario.",
    });
  }

  if (warnings.some(w => w.includes("En comprobantes tipo Pago, la moneda del comprobante normalmente debe ser XXX"))) {
    addFindingOnce({
      severity: "WARNING",
      category: "FISCAL",
      code: "PAGO_MONEDA_NOT_XXX",
      title: "Moneda distinta de XXX en tipo Pago",
      message: "En comprobantes tipo Pago, la moneda del comprobante normalmente debe ser XXX.",
      recommendedAction: "Verifica que la moneda declarada sea correcta para el tipo de comprobante.",
    });
  }

  if (warnings.some(w => w.includes("Se detectó un impuesto no clasificado por el catálogo base"))) {
    addFindingOnce({
      severity: "WARNING",
      category: "TAX",
      code: "UNCLASSIFIED_TAX",
      title: "Impuesto no clasificado detectado",
      message: "Se detectó un impuesto con código no reconocido por el catálogo base del motor.",
      recommendedAction: "Revisa que el tipo de impuesto en el CFDI corresponda al catálogo fiscal vigente.",
    });
  }

  if (warnings.some(w => w.includes("Un impuesto exento contiene importe"))) {
    addFindingOnce({
      severity: "WARNING",
      category: "TAX",
      code: "EXENTO_WITH_IMPORTE",
      title: "Impuesto exento con importe",
      message: "Un impuesto exento contiene importe mayor a 0; revisar consistencia fiscal.",
      recommendedAction: "Un impuesto exento no debería tener importe; verifica que el tipo factor sea correcto.",
    });
  }

  if (warnings.some(w => w.includes("Un impuesto con tipo factor Tasa no contiene tasa o cuota"))) {
    addFindingOnce({
      severity: "WARNING",
      category: "TAX",
      code: "TASA_MISSING_TASA_OCUOTA",
      title: "Impuesto con tipo Tasa sin tasa o cuota",
      message: "Un impuesto con tipo factor Tasa no contiene el valor de tasa o cuota.",
      recommendedAction: "El valor de tasa o cuota es obligatorio para impuestos con tipo factor Tasa.",
    });
  }

  if (warnings.some(w => w.includes("Un impuesto IEPS con tipo factor Tasa no contiene tasa o cuota"))) {
    addFindingOnce({
      severity: "WARNING",
      category: "TAX",
      code: "IEPS_TASA_MISSING_TASA_OCUOTA",
      title: "IEPS con tipo Tasa sin tasa o cuota",
      message: "Un impuesto IEPS con tipo factor Tasa no contiene el valor de tasa o cuota.",
      recommendedAction: "El valor de tasa o cuota es obligatorio para IEPS con tipo factor Tasa.",
    });
  }

  if (warnings.some(w => w.includes("Una retención ISR tiene importe mayor que su base"))) {
    addFindingOnce({
      severity: "WARNING",
      category: "TAX",
      code: "ISR_RETENTION_EXCEEDS_BASE",
      title: "Retención ISR con importe mayor que la base",
      message: "Una retención ISR tiene importe mayor que su base.",
      recommendedAction: "Revisa que el cálculo de la retención ISR sea fiscalmente correcto.",
    });
  }

  if (warnings.some(w => w.includes("Una retención de IVA tiene importe mayor que su base"))) {
    addFindingOnce({
      severity: "WARNING",
      category: "TAX",
      code: "IVA_RETENTION_EXCEEDS_BASE",
      title: "Retención de IVA con importe mayor que la base",
      message: "Una retención de IVA tiene importe mayor que su base.",
      recommendedAction: "Revisa que el cálculo de la retención de IVA sea fiscalmente correcto.",
    });
  }

  if (warnings.some(w => w.includes("Un impuesto tiene importe mayor a 0 con base igual o menor a 0"))) {
    addFindingOnce({
      severity: "WARNING",
      category: "TAX",
      code: "TAX_IMPORTE_WITHOUT_BASE",
      title: "Impuesto con importe y base no positiva",
      message: "Un impuesto tiene importe mayor a 0 con base igual o menor a 0.",
      recommendedAction: "Revisa que la base del impuesto sea correcta y consistente con el importe.",
    });
  }

  if (warnings.some(w => w.includes("La moneda del comprobante es 'XXX'"))) {
    addFindingOnce({
      severity: "INFO",
      category: "FISCAL",
      code: "MONEDA_XXX",
      title: "Moneda en código XXX",
      message: "La moneda del comprobante es 'XXX' (sin moneda), inusual en comprobantes que no son de pago.",
      recommendedAction: "Verifica que usar moneda XXX sea correcto para el tipo de operación.",
    });
  }

  if (warnings.some(w => w.includes("El total del comprobante es 0"))) {
    addFindingOnce({
      severity: "WARNING",
      category: "FISCAL",
      code: "TOTAL_ZERO",
      title: "Total del comprobante es 0",
      message: "El total del comprobante es 0, inusual en comprobantes de ingreso o egreso.",
      recommendedAction: "Verifica que el total declarado sea correcto.",
    });
  }

  if (warnings.some(w => w.includes("No se encontró la fecha de timbrado"))) {
    addFindingOnce({
      severity: "WARNING",
      category: "TECHNICAL",
      code: "MISSING_TIMBRADO_FECHA",
      title: "Fecha de timbrado faltante",
      message: "No se encontró la fecha de timbrado en el TimbreFiscalDigital.",
      recommendedAction: "La fecha de timbrado debería estar presente si el XML fue timbrado.",
    });
  }

  if (warnings.some(w => w.includes("El formato del UUID no es estándar"))) {
    addFindingOnce({
      severity: "WARNING",
      category: "TECHNICAL",
      code: "UUID_NON_STANDARD",
      title: "Formato de UUID no estándar",
      message: "El formato del UUID del TimbreFiscalDigital no cumple con el estándar.",
      recommendedAction: "Verifica que el UUID haya sido generado correctamente por el PAC.",
    });
  }

  if (warnings.some(w => w.includes("El RFC del emisor tiene un formato sospechoso"))) {
    addFindingOnce({
      severity: "WARNING",
      category: "FISCAL",
      code: "SUSPICIOUS_RFC_EMISOR",
      title: "RFC del emisor con formato sospechoso",
      message: "El RFC del emisor no cumple con el formato estándar del SAT.",
      recommendedAction: "Verifica que el RFC del emisor sea válido ante el SAT.",
    });
  }

  if (warnings.some(w => w.includes("El RFC del receptor tiene un formato sospechoso"))) {
    addFindingOnce({
      severity: "WARNING",
      category: "FISCAL",
      code: "SUSPICIOUS_RFC_RECEPTOR",
      title: "RFC del receptor con formato sospechoso",
      message: "El RFC del receptor no cumple con el formato estándar del SAT.",
      recommendedAction: "Verifica que tu RFC esté correctamente registrado ante el SAT.",
    });
  }

  if (warnings.some(w => w.includes("No se pudo determinar la versión del CFDI"))) {
    addFindingOnce({
      severity: "WARNING",
      category: "TECHNICAL",
      code: "UNDETERMINED_VERSION",
      title: "Versión del CFDI no determinada",
      message: "No se pudo determinar la versión del CFDI del comprobante.",
      recommendedAction: "Verifica que el XML sea un CFDI válido con una versión estándar.",
    });
  }

  // ── Generic RFC Findings ──

  if (rfcReceptor && isGenericNationalRfc(rfcReceptor)) {
    addFindingOnce({
      severity: "INFO",
      category: "FISCAL",
      code: "GENERIC_RFC_RECEPTOR_NATIONAL",
      title: "RFC genérico nacional en receptor",
      message: "El receptor utiliza el RFC genérico nacional XAXX010101000. Esto puede ser válido para operaciones con público en general, pero debe revisarse según el contexto fiscal del comprobante.",
      recommendedAction: "Confirma que el uso de RFC genérico corresponda al escenario fiscal real del comprobante y que los campos del receptor sean consistentes.",
      evidence: [
        { label: "RFC receptor", value: rfcReceptor },
        { label: "Nombre receptor", value: nombreReceptor ?? "—" },
        { label: "Tipo comprobante", value: tipoComprobante ?? "—" },
        { label: "Uso CFDI", value: usoCfdi ?? "—" },
        { label: "Régimen fiscal receptor", value: regimenFiscalReceptor ?? "—" },
        { label: "Domicilio fiscal receptor", value: domicilioFiscalReceptor ?? "—" },
        { label: "Lugar expedición", value: lugarExpedicion ?? "—" },
      ],
    });
  }

  if (rfcReceptor && isGenericForeignRfc(rfcReceptor)) {
    addFindingOnce({
      severity: "INFO",
      category: "FISCAL",
      code: "GENERIC_RFC_RECEPTOR_FOREIGN",
      title: "RFC genérico extranjero en receptor",
      message: "El receptor utiliza el RFC genérico extranjero XEXX010101000. Esto puede ser válido para operaciones con residentes en el extranjero no inscritos en RFC, pero debe revisarse según el contexto fiscal del comprobante.",
      recommendedAction: "Confirma que la operación corresponda a un receptor extranjero sin RFC mexicano y que los campos fiscales del receptor sean consistentes.",
      evidence: [
        { label: "RFC receptor", value: rfcReceptor },
        { label: "Nombre receptor", value: nombreReceptor ?? "—" },
        { label: "Tipo comprobante", value: tipoComprobante ?? "—" },
        { label: "Uso CFDI", value: usoCfdi ?? "—" },
        { label: "Régimen fiscal receptor", value: regimenFiscalReceptor ?? "—" },
        { label: "Domicilio fiscal receptor", value: domicilioFiscalReceptor ?? "—" },
        { label: "Lugar expedición", value: lugarExpedicion ?? "—" },
      ],
    });
  }

  if (rfcEmisor && isGenericRfc(rfcEmisor)) {
    addFindingOnce({
      severity: "WARNING",
      category: "FISCAL",
      code: "GENERIC_RFC_EMISOR",
      title: "RFC genérico usado como emisor",
      message: "El RFC genérico aparece en el emisor del comprobante. Esto es inusual y puede indicar un XML de prueba, inválido o mal generado.",
      recommendedAction: "Verifica que el RFC emisor corresponda a un contribuyente real y que el XML provenga de una emisión válida.",
      evidence: [
        { label: "RFC emisor", value: rfcEmisor },
        { label: "Nombre emisor", value: nombreEmisor ?? "—" },
        { label: "Tipo comprobante", value: tipoComprobante ?? "—" },
        { label: "UUID", value: uuid ?? "—" },
        { label: "XML timbrado", value: diag.isStamped ? "Sí" : "No" },
      ],
    });
  }

  if (rc(version, "4.0") && rfcReceptor && isGenericRfc(rfcReceptor) && regimenFiscalReceptor && regimenFiscalReceptor !== "616") {
    addFindingOnce({
      severity: "WARNING",
      category: "FISCAL",
      code: "GENERIC_RFC_RECEPTOR_REGIMEN_NOT_616",
      title: "Régimen fiscal receptor no esperado para RFC genérico",
      message: "El receptor usa RFC genérico, pero el RégimenFiscalReceptor no es 616. Esto puede generar inconsistencias según el tipo de CFDI y el contexto de emisión.",
      recommendedAction: "Revisa si el receptor genérico debe usar RégimenFiscalReceptor 616 conforme al escenario fiscal aplicable.",
      evidence: [
        { label: "RFC receptor", value: rfcReceptor },
        { label: "Régimen fiscal receptor detectado", value: regimenFiscalReceptor },
        { label: "Régimen esperado", value: "616 (Sin obligaciones)" },
        { label: "Tipo comprobante", value: tipoComprobante ?? "—" },
        { label: "Uso CFDI", value: usoCfdi ?? "—" },
      ],
    });
  }

  if (rc(version, "4.0") && rfcReceptor && isGenericRfc(rfcReceptor) && usoCfdi) {
    const isPago = tipoComprobante === "P" || tipoLabel === "Pago";
    let usoReview = false;
    if (isPago) {
      if (usoCfdi !== "CP01") usoReview = true;
    } else {
      if (!["S01", "CP01"].includes(usoCfdi)) usoReview = true;
    }
    if (usoReview) {
      addFindingOnce({
        severity: "WARNING",
        category: "FISCAL",
        code: "GENERIC_RFC_RECEPTOR_USO_CFDI_REVIEW",
        title: "Uso CFDI requiere revisión para RFC genérico",
        message: "El receptor usa RFC genérico y el UsoCFDI detectado no corresponde al patrón esperado para este escenario. Puede ser válido en casos específicos, pero requiere revisión.",
        recommendedAction: "Valida que el UsoCFDI sea consistente con el tipo de comprobante, el régimen fiscal del receptor y el escenario de emisión.",
        evidence: [
          { label: "RFC receptor", value: rfcReceptor },
          { label: "Uso CFDI detectado", value: usoCfdi },
          { label: "Tipo comprobante", value: tipoComprobante ?? "—" },
          { label: "Valores esperados de referencia", value: isPago ? "CP01" : "S01, CP01" },
          { label: "Régimen fiscal receptor", value: regimenFiscalReceptor ?? "—" },
        ],
      });
    }
  }

  if (rc(version, "4.0") && rfcReceptor && isGenericRfc(rfcReceptor) && domicilioFiscalReceptor && lugarExpedicion && domicilioFiscalReceptor !== lugarExpedicion) {
    addFindingOnce({
      severity: "WARNING",
      category: "FISCAL",
      code: "GENERIC_RFC_RECEPTOR_POSTAL_MISMATCH",
      title: "Domicilio fiscal receptor no coincide con lugar de expedición",
      message: "El receptor usa RFC genérico, pero el DomicilioFiscalReceptor no coincide con LugarExpedicion. Esto puede ser inconsistente para CFDI 4.0 según reglas de validación aplicables.",
      recommendedAction: "Revisa el código postal del receptor y el lugar de expedición capturados en el CFDI.",
      evidence: [
        { label: "RFC receptor", value: rfcReceptor },
        { label: "Domicilio fiscal receptor", value: domicilioFiscalReceptor },
        { label: "Lugar expedición", value: lugarExpedicion },
        { label: "Tipo comprobante", value: tipoComprobante ?? "—" },
        { label: "Uso CFDI", value: usoCfdi ?? "—" },
      ],
    });
  }

  if (rfcReceptor && isGenericRfc(rfcReceptor) && nombreReceptor) {
    const isPago = tipoComprobante === "P" || tipoLabel === "Pago";
    if (!isPago) {
      const normalizedName = nombreReceptor.toUpperCase().trim();
      if (!normalizedName.includes("PUBLICO EN GENERAL") && !normalizedName.includes("PÚBLICO EN GENERAL")) {
        addFindingOnce({
          severity: "INFO",
          category: "FISCAL",
          code: "GENERIC_RFC_RECEPTOR_NAME_REVIEW",
          title: "Nombre de receptor con RFC genérico requiere revisión",
          message: "El receptor usa RFC genérico, pero el nombre del receptor no corresponde al patrón común de público en general. Puede ser válido según el tipo de operación, pero conviene revisarlo.",
          recommendedAction: "Confirma si el comprobante corresponde a público en general, extranjero u otro escenario donde el RFC genérico sea procedente.",
          evidence: [
            { label: "RFC receptor", value: rfcReceptor },
            { label: "Nombre receptor", value: nombreReceptor },
            { label: "Tipo comprobante", value: tipoComprobante ?? "—" },
            { label: "Uso CFDI", value: usoCfdi ?? "—" },
          ],
        });
      }
    }
  }

  // ── Stamp / Sello / Certificado Findings ──
  const isStampedOrTimbre = diag.isStamped || hasTimbreFiscalDigital;

  if (isStampedOrTimbre && !isNonEmptyString(sello)) {
    addFindingOnce({
      severity: "WARNING",
      category: "TECHNICAL",
      code: "MISSING_COMPROBANTE_SELLO",
      title: "Sello del CFDI ausente",
      message: "El comprobante timbrado no contiene el atributo Sello en el nodo principal. Esto puede indicar un XML incompleto, alterado o mal generado.",
      recommendedAction: "Solicita al emisor el XML original timbrado y verifica que el archivo no haya sido modificado.",
      evidence: [
        { label: "UUID", value: uuid ?? "—" },
        { label: "XML timbrado", value: diag.isStamped ? "Sí" : "No" },
        { label: "Sello presente", value: "No" },
        { label: "Timbre Fiscal Digital detectado", value: hasTimbreFiscalDigital ? "Sí" : "No" },
      ],
    });
  }

  if (isStampedOrTimbre && !isNonEmptyString(certificado)) {
    addFindingOnce({
      severity: "WARNING",
      category: "TECHNICAL",
      code: "MISSING_COMPROBANTE_CERTIFICADO",
      title: "Certificado del CFDI ausente",
      message: "El comprobante timbrado no contiene el atributo Certificado en el nodo principal. Esto puede indicar que el XML está incompleto o fue alterado.",
      recommendedAction: "Verifica el XML original emitido por el PAC o solicita una nueva descarga al emisor.",
      evidence: [
        { label: "UUID", value: uuid ?? "—" },
        { label: "Certificado presente", value: "No" },
        { label: "RFC emisor", value: rfcEmisor ?? "—" },
        { label: "Tipo comprobante", value: tipoComprobante ?? "—" },
      ],
    });
  }

  if (isStampedOrTimbre && !isNonEmptyString(noCertificado)) {
    addFindingOnce({
      severity: "WARNING",
      category: "TECHNICAL",
      code: "MISSING_NO_CERTIFICADO",
      title: "Número de certificado del CFDI ausente",
      message: "El comprobante no contiene NoCertificado en el nodo principal. Esto puede afectar la trazabilidad técnica del CFDI.",
      recommendedAction: "Confirma que el XML corresponda al comprobante original timbrado y no a una representación parcial.",
      evidence: [
        { label: "UUID", value: uuid ?? "—" },
        { label: "NoCertificado", value: noCertificado ?? "—" },
        { label: "RFC emisor", value: rfcEmisor ?? "—" },
      ],
    });
  }

  if (isNonEmptyString(noCertificado) && !looksLikeCertificateNumber(noCertificado)) {
    addFindingOnce({
      severity: "INFO",
      category: "TECHNICAL",
      code: "NO_CERTIFICADO_FORMAT_REVIEW",
      title: "Formato de NoCertificado requiere revisión",
      message: "El número de certificado del CFDI tiene un formato poco común. Puede ser válido en escenarios específicos, pero conviene revisarlo.",
      recommendedAction: "Verifica que el NoCertificado corresponda al XML original emitido.",
      evidence: [
        { label: "NoCertificado", value: noCertificado ?? "—" },
        { label: "Longitud", value: noCertificado ? String(noCertificado.trim().length) : "—" },
        { label: "RFC emisor", value: rfcEmisor ?? "—" },
      ],
    });
  }

  if (hasTimbreFiscalDigital && !isNonEmptyString(selloCfd)) {
    addFindingOnce({
      severity: "WARNING",
      category: "TECHNICAL",
      code: "MISSING_TFD_SELLO_CFD",
      title: "SelloCFD ausente en TimbreFiscalDigital",
      message: "El TimbreFiscalDigital no contiene SelloCFD. Esto puede indicar un timbre incompleto o una extracción incorrecta del XML.",
      recommendedAction: "Solicita el XML original al emisor o valida que el archivo no haya sido manipulado.",
      evidence: [
        { label: "UUID", value: uuid ?? "—" },
        { label: "Fecha timbrado", value: fechaTimbrado ?? "—" },
        { label: "SelloCFD presente", value: "No" },
      ],
    });
  }

  if (hasTimbreFiscalDigital && !isNonEmptyString(selloSat)) {
    addFindingOnce({
      severity: "WARNING",
      category: "TECHNICAL",
      code: "MISSING_TFD_SELLO_SAT",
      title: "SelloSAT ausente en TimbreFiscalDigital",
      message: "El TimbreFiscalDigital no contiene SelloSAT. Esto puede indicar un timbre incompleto o un XML alterado.",
      recommendedAction: "Verifica el XML original timbrado y confirma que provenga de una fuente confiable.",
      evidence: [
        { label: "UUID", value: uuid ?? "—" },
        { label: "Fecha timbrado", value: fechaTimbrado ?? "—" },
        { label: "SelloSAT presente", value: "No" },
      ],
    });
  }

  if (hasTimbreFiscalDigital && !isNonEmptyString(noCertificadoSat)) {
    addFindingOnce({
      severity: "WARNING",
      category: "TECHNICAL",
      code: "MISSING_TFD_NO_CERTIFICADO_SAT",
      title: "NoCertificadoSAT ausente en TimbreFiscalDigital",
      message: "El TimbreFiscalDigital no contiene NoCertificadoSAT. Esto limita la trazabilidad del timbrado.",
      recommendedAction: "Solicita el XML original timbrado o revisa si el complemento fue alterado.",
      evidence: [
        { label: "UUID", value: uuid ?? "—" },
        { label: "NoCertificadoSAT", value: noCertificadoSat ?? "—" },
        { label: "RFC proveedor certificación", value: rfcProvCertif ?? "—" },
      ],
    });
  }

  if (isNonEmptyString(noCertificadoSat) && !looksLikeCertificateNumber(noCertificadoSat)) {
    addFindingOnce({
      severity: "INFO",
      category: "TECHNICAL",
      code: "TFD_NO_CERTIFICADO_SAT_FORMAT_REVIEW",
      title: "Formato de NoCertificadoSAT requiere revisión",
      message: "El número de certificado SAT del timbre tiene un formato poco común. Puede requerir revisión técnica.",
      recommendedAction: "Confirma que el TimbreFiscalDigital corresponda a una emisión válida.",
      evidence: [
        { label: "UUID", value: uuid ?? "—" },
        { label: "NoCertificadoSAT", value: noCertificadoSat ?? "—" },
        { label: "Longitud", value: noCertificadoSat ? String(noCertificadoSat.trim().length) : "—" },
      ],
    });
  }

  if (hasTimbreFiscalDigital && !isNonEmptyString(rfcProvCertif)) {
    addFindingOnce({
      severity: "INFO",
      category: "TECHNICAL",
      code: "MISSING_RFC_PROV_CERTIF",
      title: "RFC del proveedor de certificación no detectado",
      message: "No se detectó RfcProvCertif en el TimbreFiscalDigital. Esto puede limitar la trazabilidad del PAC.",
      recommendedAction: "Revisa el complemento TimbreFiscalDigital del XML original.",
      evidence: [
        { label: "UUID", value: uuid ?? "—" },
        { label: "Fecha timbrado", value: fechaTimbrado ?? "—" },
        { label: "RfcProvCertif", value: rfcProvCertif ?? "—" },
      ],
    });
  }

  if (hasTimbreFiscalDigital && !isNonEmptyString(versionTimbre)) {
    addFindingOnce({
      severity: "INFO",
      category: "TECHNICAL",
      code: "MISSING_TFD_VERSION",
      title: "Versión del TimbreFiscalDigital no detectada",
      message: "No se detectó la versión del complemento TimbreFiscalDigital. Puede deberse a estructura no estándar o atributos incompletos.",
      recommendedAction: "Revisa el XML original si se requiere trazabilidad técnica completa del timbrado.",
      evidence: [
        { label: "UUID", value: uuid ?? "—" },
        { label: "Complemento detectado", value: "TimbreFiscalDigital" },
        { label: "Fecha timbrado", value: fechaTimbrado ?? "—" },
      ],
    });
  }

  const cfdiDate = parseCfdiDate(fecha);
  const timbradoDate = parseCfdiDate(fechaTimbrado);
  if (cfdiDate && timbradoDate && isDateBefore(timbradoDate, cfdiDate)) {
    addFindingOnce({
      severity: "WARNING",
      category: "TECHNICAL",
      code: "TIMBRADO_DATE_BEFORE_CFDI_DATE",
      title: "Fecha de timbrado anterior a la fecha del CFDI",
      message: "La fecha de timbrado es anterior a la fecha de emisión del CFDI. Esto puede indicar inconsistencia temporal en el comprobante.",
      recommendedAction: "Verifica las fechas del XML y confirma que el comprobante no haya sido generado con datos inconsistentes.",
      evidence: [
        { label: "Fecha CFDI", value: fecha ?? "—" },
        { label: "Fecha timbrado", value: fechaTimbrado ?? "—" },
        { label: "UUID", value: uuid ?? "—" },
        { label: "RFC emisor", value: rfcEmisor ?? "—" },
      ],
    });
  }

  // ── Payment Complement Findings (only for tipo Pago/P) ──
  const isPago = tipoComprobante === "P";

  if (isPago) {

    // A) PAYMENT_COMPLEMENT_MISSING
    if (!paymentComplement || paymentComplement.pagos.length === 0) {
      addFindingOnce({
        severity: "WARNING",
        category: "COMPLEMENT",
        code: "PAYMENT_COMPLEMENT_MISSING",
        title: "Complemento de pago no detectado",
        message: "El comprobante es de tipo Pago, pero no se detectó información válida del complemento de pagos.",
        recommendedAction: "Verifica que el XML corresponda a un REP válido y que incluya el complemento Pagos 2.0.",
        evidence: [
          { label: "Tipo comprobante", value: tipoComprobante ?? "—" },
          { label: "UUID", value: uuid ?? "—" },
          { label: "Complementos detectados", value: complemento ? Object.keys(complemento).join(", ") : "Ninguno" },
        ],
      });
    }

    if (paymentComplement && paymentComplement.pagos.length > 0) {
      paymentComplement.pagos.forEach((pago, pagoIdx) => {
        const pagoNum = pagoIdx + 1;

        // B) PAYMENT_WITHOUT_RELATED_DOCUMENTS
        if (pago.documentosRelacionados.length === 0) {
          addFindingOnce({
            severity: "WARNING",
            category: "COMPLEMENT",
            code: "PAYMENT_WITHOUT_RELATED_DOCUMENTS",
            title: "Pago sin documentos relacionados",
            message: "Se detectó un pago dentro del complemento, pero no contiene documentos relacionados.",
            recommendedAction: "Revisa que el REP incluya los CFDI relacionados al pago.",
            evidence: [
              { label: "Número de pago", value: String(pagoNum) },
              { label: "Fecha pago", value: pago.fechaPago ?? "—" },
              { label: "Moneda pago", value: pago.monedaP ?? "—" },
              { label: "Monto pago", value: pago.monto ?? "—" },
            ],
          });
        }

        // C) PAYMENT_MISSING_FECHA_PAGO
        if (!isNonEmptyString(pago.fechaPago)) {
          addFindingOnce({
            severity: "WARNING",
            category: "COMPLEMENT",
            code: "PAYMENT_MISSING_FECHA_PAGO",
            title: "Fecha de pago faltante",
            message: "Un pago del complemento no contiene FechaPago.",
            recommendedAction: "Verifica la información del pago capturada en el REP.",
            evidence: [
              { label: "Número de pago", value: String(pagoNum) },
              { label: "Moneda pago", value: pago.monedaP ?? "—" },
              { label: "Monto pago", value: pago.monto ?? "—" },
            ],
          });
        }

        // D) PAYMENT_MISSING_FORMA_PAGO
        if (!isNonEmptyString(pago.formaDePagoP)) {
          addFindingOnce({
            severity: "WARNING",
            category: "COMPLEMENT",
            code: "PAYMENT_MISSING_FORMA_PAGO",
            title: "Forma de pago faltante en pago",
            message: "Un pago del complemento no contiene FormaDePagoP.",
            recommendedAction: "Valida que la forma de pago del REP haya sido capturada correctamente.",
            evidence: [
              { label: "Número de pago", value: String(pagoNum) },
              { label: "Fecha pago", value: pago.fechaPago ?? "—" },
              { label: "Moneda pago", value: pago.monedaP ?? "—" },
              { label: "Monto pago", value: pago.monto ?? "—" },
            ],
          });
        }

        // E) PAYMENT_MISSING_MONEDA
        if (!isNonEmptyString(pago.monedaP)) {
          addFindingOnce({
            severity: "WARNING",
            category: "COMPLEMENT",
            code: "PAYMENT_MISSING_MONEDA",
            title: "Moneda del pago faltante",
            message: "Un pago del complemento no contiene MonedaP.",
            recommendedAction: "Valida la moneda del pago capturada en el complemento.",
            evidence: [
              { label: "Número de pago", value: String(pagoNum) },
              { label: "Fecha pago", value: pago.fechaPago ?? "—" },
              { label: "Monto pago", value: pago.monto ?? "—" },
            ],
          });
        }

        // F) PAYMENT_AMOUNT_NON_POSITIVE
        const monto = toMoneyNumber(pago.monto);
        if (isNonEmptyString(pago.monto) && monto <= 0) {
          addFindingOnce({
            severity: "WARNING",
            category: "COMPLEMENT",
            code: "PAYMENT_AMOUNT_NON_POSITIVE",
            title: "Monto del pago no positivo",
            message: "El monto del pago debe ser mayor a cero.",
            recommendedAction: "Revisa el importe del pago capturado en el REP.",
            evidence: [
              { label: "Número de pago", value: String(pagoNum) },
              { label: "Monto pago", value: pago.monto ?? "—" },
              { label: "Moneda pago", value: pago.monedaP ?? "—" },
            ],
          });
        }

        // G) PAYMENT_CURRENCY_XXX
        const monedaP = normalizeCurrency(pago.monedaP);
        if (monedaP === "XXX") {
          addFindingOnce({
            severity: "WARNING",
            category: "COMPLEMENT",
            code: "PAYMENT_CURRENCY_XXX",
            title: "MonedaP no debe ser XXX",
            message: "En el detalle del pago, MonedaP normalmente debe indicar la moneda real del pago y no XXX.",
            recommendedAction: "Valida la moneda del pago en el complemento Pagos.",
            evidence: [
              { label: "Número de pago", value: String(pagoNum) },
              { label: "MonedaP", value: monedaP },
              { label: "Monto pago", value: pago.monto ?? "—" },
            ],
          });
        }

        // H) PAYMENT_EXCHANGE_RATE_REQUIRED
        if (isNonEmptyString(pago.monedaP) && monedaP !== "MXN" && !isNonEmptyString(pago.tipoCambioP)) {
          addFindingOnce({
            severity: "WARNING",
            category: "COMPLEMENT",
            code: "PAYMENT_EXCHANGE_RATE_REQUIRED",
            title: "Tipo de cambio del pago requerido",
            message: "El pago está en moneda distinta de MXN, pero no se detectó TipoCambioP.",
            recommendedAction: "Revisa si el REP debe incluir el tipo de cambio del pago.",
            evidence: [
              { label: "Número de pago", value: String(pagoNum) },
              { label: "MonedaP", value: monedaP },
              { label: "TipoCambioP", value: pago.tipoCambioP ?? "—" },
              { label: "Monto pago", value: pago.monto ?? "—" },
            ],
          });
        }

        // ── Document-level findings ──
        pago.documentosRelacionados.forEach((doc, docIdx) => {
          const docNum = docIdx + 1;

          // I) RELATED_DOCUMENT_MISSING_UUID
          if (!isNonEmptyString(doc.idDocumento)) {
            addFindingOnce({
              severity: "WARNING",
              category: "COMPLEMENT",
              code: "RELATED_DOCUMENT_MISSING_UUID",
              title: "Documento relacionado sin UUID",
              message: "Un documento relacionado del REP no contiene IdDocumento.",
              recommendedAction: "Verifica que cada documento relacionado incluya el UUID del CFDI pagado.",
              evidence: [
                { label: "Número de pago", value: String(pagoNum) },
                { label: "Documento relacionado #", value: String(docNum) },
                { label: "Serie", value: doc.serie ?? "—" },
                { label: "Folio", value: doc.folio ?? "—" },
                { label: "MonedaDR", value: doc.monedaDR ?? "—" },
              ],
            });
          }

          // J) RELATED_DOCUMENT_MISSING_MONEDA
          if (!isNonEmptyString(doc.monedaDR)) {
            addFindingOnce({
              severity: "WARNING",
              category: "COMPLEMENT",
              code: "RELATED_DOCUMENT_MISSING_MONEDA",
              title: "Moneda del documento relacionado faltante",
              message: "Un documento relacionado no contiene MonedaDR.",
              recommendedAction: "Valida la moneda del documento relacionado dentro del REP.",
              evidence: [
                { label: "Número de pago", value: String(pagoNum) },
                { label: "Documento relacionado #", value: String(docNum) },
                { label: "IdDocumento", value: doc.idDocumento ?? "—" },
                { label: "Serie", value: doc.serie ?? "—" },
                { label: "Folio", value: doc.folio ?? "—" },
              ],
            });
          }

          // K) RELATED_DOCUMENT_PARTIALITY_INVALID
          if (isNonEmptyString(doc.numParcialidad) && !isIntegerLike(doc.numParcialidad)) {
            addFindingOnce({
              severity: "WARNING",
              category: "COMPLEMENT",
              code: "RELATED_DOCUMENT_PARTIALITY_INVALID",
              title: "Parcialidad inválida en documento relacionado",
              message: "El número de parcialidad del documento relacionado no tiene un formato válido.",
              recommendedAction: "Revisa NumParcialidad en el documento relacionado.",
              evidence: [
                { label: "Número de pago", value: String(pagoNum) },
                { label: "Documento relacionado #", value: String(docNum) },
                { label: "IdDocumento", value: doc.idDocumento ?? "—" },
                { label: "NumParcialidad", value: doc.numParcialidad },
              ],
            });
          }

          // L) RELATED_DOCUMENT_PAID_AMOUNT_NON_POSITIVE
          const impPagado = toMoneyNumber(doc.impPagado);
          if (isNonEmptyString(doc.impPagado) && impPagado <= 0) {
            addFindingOnce({
              severity: "WARNING",
              category: "COMPLEMENT",
              code: "RELATED_DOCUMENT_PAID_AMOUNT_NON_POSITIVE",
              title: "Importe pagado no positivo",
              message: "El importe pagado del documento relacionado debe ser mayor a cero.",
              recommendedAction: "Revisa ImpPagado del documento relacionado.",
              evidence: [
                { label: "Número de pago", value: String(pagoNum) },
                { label: "Documento relacionado #", value: String(docNum) },
                { label: "IdDocumento", value: doc.idDocumento ?? "—" },
                { label: "ImpPagado", value: doc.impPagado ?? "—" },
              ],
            });
          }

          // M) RELATED_DOCUMENT_BALANCE_NEGATIVE
          const impSaldoAnt = toMoneyNumber(doc.impSaldoAnt);
          const impSaldoInsoluto = toMoneyNumber(doc.impSaldoInsoluto);
          if (
            (isNonEmptyString(doc.impSaldoAnt) && impSaldoAnt < 0) ||
            (isNonEmptyString(doc.impSaldoInsoluto) && impSaldoInsoluto < 0)
          ) {
            addFindingOnce({
              severity: "WARNING",
              category: "COMPLEMENT",
              code: "RELATED_DOCUMENT_BALANCE_NEGATIVE",
              title: "Saldo negativo en documento relacionado",
              message: "El documento relacionado contiene saldo anterior o saldo insoluto negativo.",
              recommendedAction: "Verifica los saldos del documento relacionado dentro del REP.",
              evidence: [
                { label: "Número de pago", value: String(pagoNum) },
                { label: "Documento relacionado #", value: String(docNum) },
                { label: "IdDocumento", value: doc.idDocumento ?? "—" },
                { label: "ImpSaldoAnt", value: doc.impSaldoAnt ?? "—" },
                { label: "ImpSaldoInsoluto", value: doc.impSaldoInsoluto ?? "—" },
              ],
            });
          }

          // N) RELATED_DOCUMENT_BALANCE_MISMATCH
          if (
            isNonEmptyString(doc.impSaldoAnt) &&
            isNonEmptyString(doc.impPagado) &&
            isNonEmptyString(doc.impSaldoInsoluto)
          ) {
            const expectedBalance = Math.round((impSaldoAnt - impPagado) * 100) / 100;
            const diff = moneyDiff(impSaldoInsoluto, expectedBalance);
            if (diff > 0.01) {
              addFindingOnce({
                severity: "CRITICAL",
                category: "COMPLEMENT",
                code: "RELATED_DOCUMENT_BALANCE_MISMATCH",
                title: "Saldo insoluto no coincide",
                message: "El saldo insoluto del documento relacionado no coincide con saldo anterior menos importe pagado.",
                recommendedAction: "Revisa los importes ImpSaldoAnt, ImpPagado e ImpSaldoInsoluto del documento relacionado antes de usar este REP.",
                evidence: [
                  { label: "Número de pago", value: String(pagoNum) },
                  { label: "Documento relacionado #", value: String(docNum) },
                  { label: "IdDocumento", value: doc.idDocumento ?? "—" },
                  { label: "ImpSaldoAnt", value: doc.impSaldoAnt ?? "—" },
                  { label: "ImpPagado", value: doc.impPagado ?? "—" },
                  { label: "ImpSaldoInsoluto", value: doc.impSaldoInsoluto ?? "—" },
                  { label: "Saldo calculado", value: String(expectedBalance) },
                  { label: "Diferencia", value: String(diff) },
                  { label: "Tolerancia", value: "0.01" },
                ],
              });
            }
          }

          // O) RELATED_DOCUMENT_PAID_EXCEEDS_PREVIOUS_BALANCE
          if (
            isNonEmptyString(doc.impSaldoAnt) &&
            isNonEmptyString(doc.impPagado) &&
            impPagado > impSaldoAnt + 0.01
          ) {
            addFindingOnce({
              severity: "CRITICAL",
              category: "COMPLEMENT",
              code: "RELATED_DOCUMENT_PAID_EXCEEDS_PREVIOUS_BALANCE",
              title: "Importe pagado mayor al saldo anterior",
              message: "El importe pagado del documento relacionado es mayor al saldo anterior.",
              recommendedAction: "Valida los importes del REP; puede existir un error en parcialidad, saldo anterior o pago aplicado.",
              evidence: [
                { label: "Número de pago", value: String(pagoNum) },
                { label: "Documento relacionado #", value: String(docNum) },
                { label: "IdDocumento", value: doc.idDocumento ?? "—" },
                { label: "ImpSaldoAnt", value: doc.impSaldoAnt ?? "—" },
                { label: "ImpPagado", value: doc.impPagado ?? "—" },
                { label: "Diferencia", value: String(Math.round((impPagado - impSaldoAnt) * 100) / 100) },
              ],
            });
          }
        });

        // P) PAYMENT_TOTAL_RELATED_PAID_EXCEEDS_PAYMENT_AMOUNT
        // Q) PAYMENT_TOTAL_RELATED_PAID_REVIEW
        if (pago.documentosRelacionados.length > 0 && isNonEmptyString(pago.monto)) {
          const pagoMonto = toMoneyNumber(pago.monto);
          const monedaPago = normalizeCurrency(pago.monedaP);

          const allDocsComparable = pago.documentosRelacionados.every((doc) => {
            const docMoneda = normalizeCurrency(doc.monedaDR);
            const docEquivalencia = normalizeCurrency(doc.equivalenciaDR);
            return (
              isNonEmptyString(doc.impPagado) &&
              docMoneda === monedaPago &&
              (docEquivalencia === "" || docEquivalencia === "1")
            );
          });

          if (allDocsComparable) {
            const sumPagado = pago.documentosRelacionados.reduce(
              (acc, doc) => acc + toMoneyNumber(doc.impPagado),
              0,
            );
            if (sumPagado > pagoMonto + 0.01) {
              addFindingOnce({
                severity: "CRITICAL",
                category: "COMPLEMENT",
                code: "PAYMENT_TOTAL_RELATED_PAID_EXCEEDS_PAYMENT_AMOUNT",
                title: "Importes relacionados exceden el monto del pago",
                message: "La suma de importes pagados en documentos relacionados excede el monto del pago.",
                recommendedAction: "Revisa el monto del pago y los importes aplicados a documentos relacionados.",
                evidence: [
                  { label: "Número de pago", value: String(pagoNum) },
                  { label: "Monto pago", value: pago.monto ?? "—" },
                  { label: "MonedaP", value: monedaPago },
                  { label: "Suma ImpPagado comparable", value: String(sumPagado) },
                  { label: "Diferencia", value: String(Math.round((sumPagado - pagoMonto) * 100) / 100) },
                  { label: "Criterio comparación", value: "MonedaP = MonedaDR y EquivalenciaDR = 1 o vacío" },
                ],
              });
            }
          } else {
            addFindingOnce({
              severity: "INFO",
              category: "COMPLEMENT",
              code: "PAYMENT_TOTAL_RELATED_PAID_REVIEW",
              title: "Importes relacionados requieren revisión por moneda/equivalencia",
              message: "El pago contiene documentos relacionados con moneda o equivalencia que requieren revisión antes de comparar importes de forma directa.",
              recommendedAction: "Valida manualmente la equivalencia y el tipo de cambio aplicado en el REP.",
              evidence: [
                { label: "Número de pago", value: String(pagoNum) },
                { label: "MonedaP", value: monedaPago },
                { label: "Monedas DR detectadas", value: [...new Set(pago.documentosRelacionados.map((d) => normalizeCurrency(d.monedaDR) || "—"))].join(", ") },
                { label: "Equivalencias DR detectadas", value: [...new Set(pago.documentosRelacionados.map((d) => normalizeCurrency(d.equivalenciaDR) || "—"))].join(", ") },
                { label: "Monto pago", value: pago.monto ?? "—" },
              ],
            });
          }
        }
      });
    }
  }

  // ── CFDI Relations Findings ──
  const isEgreso = isTipoComprobanteEgreso(tipoComprobante);
  const isPagoType = isTipoComprobantePago(tipoComprobante);

  if (cfdiRelations && cfdiRelations.groups.length > 0) {
    const seenRelatedUuids = new Map<string, number>();

    cfdiRelations.groups.forEach((group, groupIdx) => {
      const groupNum = groupIdx + 1;

      // B) CFDI_RELATION_GROUP_WITHOUT_TIPO_RELACION
      if (!isNonEmptyString(group.tipoRelacion)) {
        addFindingOnce({
          severity: "WARNING",
          category: "FISCAL",
          code: "CFDI_RELATION_GROUP_WITHOUT_TIPO_RELACION",
          title: "Tipo de relación faltante",
          message: "Se detectó un grupo de CFDI relacionados sin TipoRelacion.",
          recommendedAction: "Verifica que el nodo CfdiRelacionados incluya el TipoRelacion correspondiente.",
          evidence: [
            { label: "Grupo #", value: String(groupNum) },
            { label: "Total CFDI relacionados en el grupo", value: String(group.relatedCfdis.length) },
            { label: "UUID comprobante", value: uuid ?? "—" },
          ],
        });
      }

      // C) CFDI_RELATION_GROUP_WITHOUT_RELATED_UUIDS
      if (group.relatedCfdis.length === 0) {
        addFindingOnce({
          severity: "WARNING",
          category: "FISCAL",
          code: "CFDI_RELATION_GROUP_WITHOUT_RELATED_UUIDS",
          title: "Grupo de relación sin CFDI relacionados",
          message: "Se detectó un nodo CfdiRelacionados, pero no contiene CFDI relacionados.",
          recommendedAction: "Revisa que el XML incluya al menos un nodo CfdiRelacionado con UUID.",
          evidence: [
            { label: "Grupo #", value: String(groupNum) },
            { label: "TipoRelacion", value: group.tipoRelacion ?? "—" },
            { label: "UUID comprobante", value: uuid ?? "—" },
          ],
        });
        return;
      }

      // I) SUBSTITUTION_RELATION_WITH_MULTIPLE_UUIDS_REVIEW
      if (group.tipoRelacion === "04" && group.relatedCfdis.length > 1) {
        addFindingOnce({
          severity: "INFO",
          category: "FISCAL",
          code: "SUBSTITUTION_RELATION_WITH_MULTIPLE_UUIDS_REVIEW",
          title: "Sustitución con múltiples CFDI relacionados",
          message: "Se detectó TipoRelacion 04 con múltiples CFDI relacionados. Puede ser válido según el caso, pero requiere revisión operativa.",
          recommendedAction: "Confirma que la sustitución se haya generado contra los CFDI origen correctos.",
          evidence: [
            { label: "Grupo #", value: String(groupNum) },
            { label: "TipoRelacion", value: group.tipoRelacion },
            { label: "Total relacionados", value: String(group.relatedCfdis.length) },
            { label: "UUIDs relacionados", value: group.relatedCfdis.map(r => r.uuid ?? "—").join(", ") },
          ],
        });
      }

      group.relatedCfdis.forEach((rel, relIdx) => {
        const relNum = relIdx + 1;
        const relatedUuid = normalizeUuid(rel.uuid);

        // D) CFDI_RELATED_MISSING_UUID
        if (!isNonEmptyString(rel.uuid)) {
          addFindingOnce({
            severity: "WARNING",
            category: "FISCAL",
            code: "CFDI_RELATED_MISSING_UUID",
            title: "CFDI relacionado sin UUID",
            message: "Un CFDI relacionado no contiene UUID.",
            recommendedAction: "Verifica que cada CFDI relacionado tenga el UUID del comprobante origen.",
            evidence: [
              { label: "Grupo #", value: String(groupNum) },
              { label: "Relacionado #", value: String(relNum) },
              { label: "TipoRelacion", value: group.tipoRelacion ?? "—" },
              { label: "UUID comprobante", value: uuid ?? "—" },
            ],
          });
        }

        // E) CFDI_RELATED_UUID_NON_STANDARD
        if (isNonEmptyString(rel.uuid) && !isStandardUuid(rel.uuid)) {
          addFindingOnce({
            severity: "WARNING",
            category: "FISCAL",
            code: "CFDI_RELATED_UUID_NON_STANDARD",
            title: "UUID relacionado con formato no estándar",
            message: "El UUID de un CFDI relacionado no tiene el formato estándar esperado.",
            recommendedAction: "Revisa el UUID relacionado capturado en el XML.",
            evidence: [
              { label: "Grupo #", value: String(groupNum) },
              { label: "Relacionado #", value: String(relNum) },
              { label: "TipoRelacion", value: group.tipoRelacion ?? "—" },
              { label: "UUID relacionado", value: relatedUuid },
              { label: "UUID comprobante", value: uuid ?? "—" },
            ],
          });
        }

        // G) CFDI_SELF_RELATION
        const compUuid = normalizeUuid(uuid);
        if (isNonEmptyString(rel.uuid) && isNonEmptyString(uuid) && relatedUuid === compUuid) {
          addFindingOnce({
            severity: "WARNING",
            category: "FISCAL",
            code: "CFDI_SELF_RELATION",
            title: "CFDI relacionado apunta al mismo comprobante",
            message: "El comprobante se relaciona a sí mismo como CFDI relacionado. Esto es inusual y puede indicar un error de generación.",
            recommendedAction: "Verifica que el UUID relacionado corresponda al comprobante origen correcto.",
            evidence: [
              { label: "UUID comprobante", value: compUuid },
              { label: "UUID relacionado", value: relatedUuid },
              { label: "TipoRelacion", value: group.tipoRelacion ?? "—" },
            ],
          });
        }

        // F) CFDI_RELATED_DUPLICATE_UUID (track per group)
        const relUuidVal = rel.uuid;
        if (relUuidVal && relUuidVal.trim().length > 0) {
          const lowerUuid = relUuidVal.trim().toLowerCase();
          const count = (seenRelatedUuids.get(lowerUuid) ?? 0) + 1;
          seenRelatedUuids.set(lowerUuid, count);
        }
      });
    });

    // F) CFDI_RELATED_DUPLICATE_UUID - emit after counting
    for (const [lowerUuid, count] of seenRelatedUuids.entries()) {
      if (count > 1) {
        addFindingOnce({
          severity: "INFO",
          category: "FISCAL",
          code: "CFDI_RELATED_DUPLICATE_UUID",
          title: "UUID relacionado duplicado",
          message: "El mismo UUID relacionado aparece más de una vez en el XML. Puede ser válido en estructuras específicas, pero conviene revisarlo.",
          recommendedAction: "Confirma si la duplicidad del UUID relacionado es intencional.",
          evidence: [
            { label: "UUID relacionado", value: lowerUuid.toUpperCase() },
            { label: "Apariciones", value: String(count) },
            { label: "UUID comprobante", value: uuid ?? "—" },
          ],
        });
      }
    }
  }

  // A) EGRESO_WITHOUT_CFDI_RELACIONADOS
  if (isEgreso && (!cfdiRelations || cfdiRelations.totalRelatedCfdis === 0)) {
    addFindingOnce({
      severity: "WARNING",
      category: "FISCAL",
      code: "EGRESO_WITHOUT_CFDI_RELACIONADOS",
      title: "Egreso sin CFDI relacionado",
      message: "El comprobante es de tipo Egreso, pero no se detectaron CFDI relacionados. En notas de crédito o devoluciones normalmente debe existir una relación con el CFDI origen.",
      recommendedAction: "Revisa si el CFDI de egreso debe relacionarse con la factura original o documento que corrige.",
      evidence: [
        { label: "Tipo comprobante", value: tipoComprobante ?? "—" },
        { label: "UUID", value: uuid ?? "—" },
        { label: "Serie", value: serie ?? "—" },
        { label: "Folio", value: folio ?? "—" },
        { label: "Total", value: total ?? "—" },
      ],
    });
  }

  // H) EGRESO_RELATION_TYPE_REVIEW
  if (isEgreso && cfdiRelations && cfdiRelations.groups.length > 0) {
    const expectedEgresoTypes = ["01", "03", "04", "07"];
    cfdiRelations.groups.forEach((group) => {
      const grupoTipoRel = group.tipoRelacion;
      if (grupoTipoRel && grupoTipoRel.trim().length > 0 && !expectedEgresoTypes.includes(grupoTipoRel.trim())) {
        addFindingOnce({
          severity: "INFO",
          category: "FISCAL",
          code: "EGRESO_RELATION_TYPE_REVIEW",
          title: "Tipo de relación en egreso requiere revisión",
          message: "El comprobante de egreso usa un TipoRelacion que puede ser válido, pero no corresponde al patrón más común para notas de crédito, devoluciones o sustituciones.",
          recommendedAction: "Revisa que el TipoRelacion sea correcto para el escenario fiscal del egreso.",
          evidence: [
            { label: "Tipo comprobante", value: tipoComprobante ?? "—" },
            { label: "TipoRelacion", value: grupoTipoRel },
            { label: "Valores de referencia", value: expectedEgresoTypes.join(", ") },
            { label: "UUID comprobante", value: uuid ?? "—" },
          ],
        });
      }
    });
  }

  // J) PAYMENT_WITH_CFDI_RELACIONADOS_REVIEW
  if (isPagoType && cfdiRelations && cfdiRelations.totalRelatedCfdis > 0) {
    addFindingOnce({
      severity: "INFO",
      category: "COMPLEMENT",
      code: "PAYMENT_WITH_CFDI_RELACIONADOS_REVIEW",
      title: "Comprobante de pago con CFDI relacionados",
      message: "El comprobante de pago incluye CfdiRelacionados además del complemento de pagos. Puede ser válido en escenarios específicos, pero normalmente la relación principal de documentos se controla dentro del complemento Pagos.",
      recommendedAction: "Revisa si la relación adicional es necesaria o si la trazabilidad debe estar únicamente en DoctoRelacionado del complemento de pago.",
      evidence: [
        { label: "Tipo comprobante", value: tipoComprobante ?? "—" },
        { label: "Total CFDI relacionados", value: String(cfdiRelations.totalRelatedCfdis) },
        { label: "Total documentos relacionados en Pagos", value: String(paymentComplement?.pagos.reduce((acc, p) => acc + p.documentosRelacionados.length, 0) ?? 0) },
        { label: "UUID comprobante", value: uuid ?? "—" },
      ],
    });
  }

  // ── Carta Porte Findings ──
  if (cartaPorte) {

    // A) CARTA_PORTE_DETECTED
    addFindingOnce({
      severity: "INFO",
      category: "COMPLEMENT",
      code: "CARTA_PORTE_DETECTED",
      title: "Complemento Carta Porte detectado",
      message: "El XML contiene complemento Carta Porte. Se realizará una revisión estructural base de ubicaciones, mercancías y transporte.",
      recommendedAction: "Revisa que los datos logísticos y fiscales del traslado correspondan al escenario real de la operación.",
      evidence: [
        { label: "Versión Carta Porte", value: cartaPorte.version ?? "—" },
        { label: "IdCCP", value: cartaPorte.idCCP ?? "—" },
        { label: "Tipo comprobante", value: tipoComprobante ?? "—" },
        { label: "Transporte internacional", value: cartaPorte.transpInternac ?? "—" },
        { label: "Total distancia recorrida", value: cartaPorte.totalDistRec ?? "—" },
      ],
    });

    // C) CARTA_PORTE_MISSING_VERSION
    if (!isNonEmptyString(cartaPorte.version)) {
      addFindingOnce({
        severity: "WARNING",
        category: "COMPLEMENT",
        code: "CARTA_PORTE_MISSING_VERSION",
        title: "Versión de Carta Porte faltante",
        message: "No se detectó la versión del complemento Carta Porte.",
        recommendedAction: "Verifica que el complemento Carta Porte del XML esté completo.",
        evidence: [
          { label: "UUID", value: uuid ?? "—" },
          { label: "Tipo comprobante", value: tipoComprobante ?? "—" },
          { label: "Complementos detectados", value: complemento ? Object.keys(complemento).join(", ") : "Ninguno" },
        ],
      });
    }

    // B) CARTA_PORTE_VERSION_REVIEW
    const cpVersionReview = normalizeCartaPorteVersion(cartaPorte.version);
    if (cpVersionReview && !["2.0", "3.0", "3.1"].includes(cpVersionReview)) {
      addFindingOnce({
        severity: "WARNING",
        category: "COMPLEMENT",
        code: "CARTA_PORTE_VERSION_REVIEW",
        title: "Versión de Carta Porte no reconocida",
        message: "El complemento Carta Porte tiene una versión no reconocida por el motor actual. El XML puede requerir revisión especializada.",
        recommendedAction: "Confirma que la versión del complemento Carta Porte sea compatible con el CFDI y con las reglas vigentes aplicables.",
        evidence: [
          { label: "Versión detectada", value: cpVersionReview },
          { label: "Complemento detectado", value: "CartaPorte" },
          { label: "UUID", value: uuid ?? "—" },
        ],
      });
    }

    // D) CARTA_PORTE_MISSING_IDCCP
    const cpVersion = normalizeCartaPorteVersion(cartaPorte.version);
    if ((cpVersion === "3.0" || cpVersion === "3.1") && !isNonEmptyString(cartaPorte.idCCP)) {
      addFindingOnce({
        severity: "WARNING",
        category: "COMPLEMENT",
        code: "CARTA_PORTE_MISSING_IDCCP",
        title: "IdCCP faltante en Carta Porte",
        message: "No se detectó IdCCP en Carta Porte. Este identificador es relevante para la trazabilidad del complemento.",
        recommendedAction: "Revisa que el XML de Carta Porte incluya el identificador del complemento cuando aplique.",
        evidence: [
          { label: "Versión Carta Porte", value: cpVersion },
          { label: "IdCCP", value: cartaPorte.idCCP ?? "—" },
          { label: "UUID", value: uuid ?? "—" },
        ],
      });
    }

    // E) CARTA_PORTE_WITH_UNEXPECTED_CFDI_TYPE
    if (!isTipoComprobanteIngreso(tipoComprobante) && !isTipoComprobanteTraslado(tipoComprobante)) {
      addFindingOnce({
        severity: "WARNING",
        category: "FISCAL",
        code: "CARTA_PORTE_WITH_UNEXPECTED_CFDI_TYPE",
        title: "Carta Porte en tipo de comprobante no esperado",
        message: "Se detectó Carta Porte en un tipo de comprobante distinto de Ingreso o Traslado. Esto es inusual y requiere revisión.",
        recommendedAction: "Confirma que el tipo de comprobante sea correcto para el traslado o servicio de transporte documentado.",
        evidence: [
          { label: "Tipo comprobante", value: tipoComprobante ?? "—" },
          { label: "Versión Carta Porte", value: cartaPorte.version ?? "—" },
          { label: "UUID", value: uuid ?? "—" },
        ],
      });
    }

    // F) CARTA_PORTE_TRASLADO_TOTAL_NOT_ZERO
    const totalNum = toMoneyNumber(total);
    if (isTipoComprobanteTraslado(tipoComprobante) && isNonEmptyString(total) && totalNum !== 0) {
      addFindingOnce({
        severity: "WARNING",
        category: "FISCAL",
        code: "CARTA_PORTE_TRASLADO_TOTAL_NOT_ZERO",
        title: "CFDI de traslado con Carta Porte tiene total distinto de cero",
        message: "El CFDI de tipo Traslado con Carta Porte normalmente debe manejar subtotal y total en cero.",
        recommendedAction: "Revisa si el CFDI debe ser de tipo Ingreso o si los importes del traslado fueron capturados correctamente.",
        evidence: [
          { label: "Tipo comprobante", value: tipoComprobante ?? "—" },
          { label: "Subtotal", value: subtotal ?? "—" },
          { label: "Total", value: total ?? "—" },
          { label: "Versión Carta Porte", value: cartaPorte.version ?? "—" },
        ],
      });
    }

    // G) CARTA_PORTE_MISSING_UBICACIONES
    if (!cartaPorte.hasUbicaciones) {
      addFindingOnce({
        severity: "WARNING",
        category: "COMPLEMENT",
        code: "CARTA_PORTE_MISSING_UBICACIONES",
        title: "Carta Porte sin ubicaciones",
        message: "No se detectaron ubicaciones dentro del complemento Carta Porte.",
        recommendedAction: "Verifica que el complemento incluya las ubicaciones de origen, destino y, si aplica, puntos intermedios.",
        evidence: [
          { label: "Versión Carta Porte", value: cartaPorte.version ?? "—" },
          { label: "UUID", value: uuid ?? "—" },
          { label: "Total ubicaciones", value: String(cartaPorte.ubicaciones.length) },
        ],
      });
    }

    // H) CARTA_PORTE_MISSING_MERCANCIAS
    if (!cartaPorte.hasMercancias) {
      addFindingOnce({
        severity: "WARNING",
        category: "COMPLEMENT",
        code: "CARTA_PORTE_MISSING_MERCANCIAS",
        title: "Carta Porte sin mercancías",
        message: "No se detectaron mercancías dentro del complemento Carta Porte.",
        recommendedAction: "Verifica que el complemento incluya el detalle de bienes o mercancías trasladadas.",
        evidence: [
          { label: "Versión Carta Porte", value: cartaPorte.version ?? "—" },
          { label: "UUID", value: uuid ?? "—" },
          { label: "Total mercancías", value: String(cartaPorte.mercancias.length) },
        ],
      });
    }

    // I) CARTA_PORTE_ORIGIN_DESTINATION_REVIEW
    if (cartaPorte.hasUbicaciones) {
      const tiposUbicacion = cartaPorte.ubicaciones.map(u => u.tipoUbicacion).filter(Boolean);
      const hasOrigen = tiposUbicacion.some(t => t && t.toLowerCase() === "origen");
      const hasDestino = tiposUbicacion.some(t => t && t.toLowerCase() === "destino");
      if (!hasOrigen || !hasDestino) {
        addFindingOnce({
          severity: "WARNING",
          category: "COMPLEMENT",
          code: "CARTA_PORTE_ORIGIN_DESTINATION_REVIEW",
          title: "Ubicaciones de origen/destino incompletas",
          message: "No se detectó la combinación mínima de ubicación origen y destino dentro de Carta Porte.",
          recommendedAction: "Revisa que el complemento incluya una ubicación de origen y una de destino.",
          evidence: [
            { label: "Total ubicaciones", value: String(cartaPorte.ubicaciones.length) },
            { label: "Tipos de ubicación detectados", value: tiposUbicacion.join(", ") || "—" },
            { label: "Versión Carta Porte", value: cartaPorte.version ?? "—" },
          ],
        });
      }
    }

    // J) CARTA_PORTE_UBICACION_MISSING_RFC (per ubicacion)
    cartaPorte.ubicaciones.forEach((ubi, uIdx) => {
      const ubiNum = uIdx + 1;
      if (!isNonEmptyString(ubi.rfcRemitenteDestinatario)) {
        addFindingOnce({
          severity: "WARNING",
          category: "COMPLEMENT",
          code: "CARTA_PORTE_UBICACION_MISSING_RFC",
          title: "Ubicación sin RFC de remitente/destinatario",
          message: "Una ubicación de Carta Porte no contiene RFCRemitenteDestinatario.",
          recommendedAction: "Revisa la información fiscal de la ubicación correspondiente.",
          evidence: [
            { label: "Ubicación #", value: String(ubiNum) },
            { label: "Tipo ubicación", value: ubi.tipoUbicacion ?? "—" },
            { label: "ID ubicación", value: ubi.idUbicacion ?? "—" },
            { label: "Nombre remitente/destinatario", value: ubi.nombreRemitenteDestinatario ?? "—" },
          ],
        });
      }
    });

    // K) CARTA_PORTE_UBICACION_INVALID_DISTANCE (per ubicacion)
    cartaPorte.ubicaciones.forEach((ubi, uIdx) => {
      const ubiNum = uIdx + 1;
      const distStr = ubi.distanciaRecorrida;
      if (distStr != null && distStr.trim().length > 0) {
        const dist = parseFloat(distStr.trim());
        if (isNaN(dist) || dist < 0) {
          addFindingOnce({
            severity: "WARNING",
            category: "COMPLEMENT",
            code: "CARTA_PORTE_UBICACION_INVALID_DISTANCE",
            title: "Distancia recorrida inválida",
            message: "Una ubicación contiene DistanciaRecorrida con formato inválido o valor negativo.",
            recommendedAction: "Revisa la distancia recorrida capturada para la ubicación.",
            evidence: [
              { label: "Ubicación #", value: String(ubiNum) },
              { label: "Tipo ubicación", value: ubi.tipoUbicacion ?? "—" },
              { label: "Distancia recorrida", value: distStr ?? "—" },
            ],
          });
        }
      }
    });

    // L) CARTA_PORTE_MERCANCIA_MISSING_BIENES_TRANSP (per mercancia)
    cartaPorte.mercancias.forEach((mer, mIdx) => {
      const merNum = mIdx + 1;
      if (!isNonEmptyString(mer.bienesTransp)) {
        addFindingOnce({
          severity: "WARNING",
          category: "COMPLEMENT",
          code: "CARTA_PORTE_MERCANCIA_MISSING_BIENES_TRANSP",
          title: "Mercancía sin clave de bienes transportados",
          message: "Una mercancía de Carta Porte no contiene BienesTransp.",
          recommendedAction: "Revisa la clave de bienes transportados capturada en la mercancía.",
          evidence: [
            { label: "Mercancía #", value: String(merNum) },
            { label: "Descripción", value: mer.descripcion ?? "—" },
            { label: "Cantidad", value: mer.cantidad ?? "—" },
            { label: "Clave unidad", value: mer.claveUnidad ?? "—" },
          ],
        });
      }
    });

    // M) CARTA_PORTE_MERCANCIA_MISSING_DESCRIPTION (per mercancia)
    cartaPorte.mercancias.forEach((mer, mIdx) => {
      const merNum = mIdx + 1;
      if (!isNonEmptyString(mer.descripcion)) {
        addFindingOnce({
          severity: "WARNING",
          category: "COMPLEMENT",
          code: "CARTA_PORTE_MERCANCIA_MISSING_DESCRIPTION",
          title: "Mercancía sin descripción",
          message: "Una mercancía de Carta Porte no contiene descripción.",
          recommendedAction: "Revisa el detalle descriptivo de la mercancía transportada.",
          evidence: [
            { label: "Mercancía #", value: String(merNum) },
            { label: "BienesTransp", value: mer.bienesTransp ?? "—" },
            { label: "Cantidad", value: mer.cantidad ?? "—" },
          ],
        });
      }
    });

    // N) CARTA_PORTE_MERCANCIA_INVALID_QUANTITY (per mercancia)
    cartaPorte.mercancias.forEach((mer, mIdx) => {
      const merNum = mIdx + 1;
      const cantidadStr = mer.cantidad;
      if (cantidadStr != null && cantidadStr.trim().length > 0) {
        const qty = parseFloat(cantidadStr.trim());
        if (isNaN(qty) || qty <= 0) {
          addFindingOnce({
            severity: "WARNING",
            category: "COMPLEMENT",
            code: "CARTA_PORTE_MERCANCIA_INVALID_QUANTITY",
            title: "Cantidad de mercancía inválida",
            message: "Una mercancía de Carta Porte contiene cantidad no válida.",
            recommendedAction: "Revisa la cantidad capturada para la mercancía.",
            evidence: [
              { label: "Mercancía #", value: String(merNum) },
              { label: "BienesTransp", value: mer.bienesTransp ?? "—" },
              { label: "Descripción", value: mer.descripcion ?? "—" },
              { label: "Cantidad", value: cantidadStr ?? "—" },
            ],
          });
        }
      }
    });

    // O) CARTA_PORTE_MERCANCIA_INVALID_WEIGHT (per mercancia)
    cartaPorte.mercancias.forEach((mer, mIdx) => {
      const merNum = mIdx + 1;
      const pesoStr = mer.pesoEnKg;
      if (pesoStr != null && pesoStr.trim().length > 0) {
        const peso = parseFloat(pesoStr.trim());
        if (isNaN(peso) || peso <= 0) {
          addFindingOnce({
            severity: "WARNING",
            category: "COMPLEMENT",
            code: "CARTA_PORTE_MERCANCIA_INVALID_WEIGHT",
            title: "Peso de mercancía inválido",
            message: "Una mercancía de Carta Porte contiene PesoEnKg no válido.",
            recommendedAction: "Revisa el peso capturado para la mercancía.",
            evidence: [
              { label: "Mercancía #", value: String(merNum) },
              { label: "BienesTransp", value: mer.bienesTransp ?? "—" },
              { label: "Descripción", value: mer.descripcion ?? "—" },
              { label: "PesoEnKg", value: pesoStr ?? "—" },
            ],
          });
        }
      }
    });

    // P) CARTA_PORTE_NO_TRANSPORT_MODE_DETECTED
    if (!cartaPorte.hasAutotransporte && !cartaPorte.hasTransporteMaritimo && !cartaPorte.hasTransporteAereo && !cartaPorte.hasTransporteFerroviario) {
      addFindingOnce({
        severity: "INFO",
        category: "COMPLEMENT",
        code: "CARTA_PORTE_NO_TRANSPORT_MODE_DETECTED",
        title: "Medio de transporte no detectado",
        message: "No se detectó un nodo de medio de transporte específico dentro de Carta Porte. Puede ser válido según estructura, pero requiere revisión.",
        recommendedAction: "Revisa si el complemento debe incluir información de autotransporte, transporte marítimo, aéreo o ferroviario.",
        evidence: [
          { label: "Versión Carta Porte", value: cartaPorte.version ?? "—" },
          { label: "Autotransporte detectado", value: cartaPorte.hasAutotransporte ? "Sí" : "No" },
          { label: "Transporte marítimo detectado", value: cartaPorte.hasTransporteMaritimo ? "Sí" : "No" },
          { label: "Transporte aéreo detectado", value: cartaPorte.hasTransporteAereo ? "Sí" : "No" },
          { label: "Transporte ferroviario detectado", value: cartaPorte.hasTransporteFerroviario ? "Sí" : "No" },
        ],
      });
    }

    // Q) CARTA_PORTE_FIGURA_MISSING_RFC_REVIEW (per figura)
    cartaPorte.figurasTransporte.forEach((fig, fIdx) => {
      const figNum = fIdx + 1;
      if (!isNonEmptyString(fig.rfcFigura) && isNonEmptyString(fig.nombreFigura)) {
        addFindingOnce({
          severity: "INFO",
          category: "COMPLEMENT",
          code: "CARTA_PORTE_FIGURA_MISSING_RFC_REVIEW",
          title: "Figura de transporte sin RFC",
          message: "Una figura de transporte contiene nombre, pero no RFCFigura. Puede ser válido según el caso, pero conviene revisarlo.",
          recommendedAction: "Confirma si la figura de transporte debe incluir RFC.",
          evidence: [
            { label: "Figura #", value: String(figNum) },
            { label: "Tipo figura", value: fig.tipoFigura ?? "—" },
            { label: "Nombre figura", value: fig.nombreFigura ?? "—" },
            { label: "Número licencia", value: fig.numLicencia ?? "—" },
          ],
        });
      }
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

  const severityOrder: Record<string, number> = { CRITICAL: 0, WARNING: 1, INFO: 2 };
  const categoryOrder: Record<string, number> = { TOTALS: 0, FISCAL: 1, TAX: 2, TECHNICAL: 3, STRUCTURE: 4, COMPLEMENT: 5 };
  findings.sort((a, b) => {
    const svA = severityOrder[a.severity] ?? 99;
    const svB = severityOrder[b.severity] ?? 99;
    if (svA !== svB) return svA - svB;
    const catA = categoryOrder[a.category] ?? 99;
    const catB = categoryOrder[b.category] ?? 99;
    if (catA !== catB) return catA - catB;
    return a.code.localeCompare(b.code);
  });

  const executiveSummary: ExecutiveSummary = {
    riskLevel,
    title: summaryTitle,
    message: summaryMessage,
    recommendedAction: summaryAction,
  };

  let normalizedXml: NormalizedXml | undefined;
  if (safeNormalizationApplied) {
    const normalizedFilename = originalFilename
      ? originalFilename.replace(/\.xml$/i, "") + "-normalizado.xml"
      : "cfdi-normalizado.xml";
    normalizedXml = {
      available: true,
      reason: "Se detectó un problema técnico de codificación o contenido previo al XML. Fiscora generó una versión normalizada sin modificar el contenido fiscal ni el timbre del CFDI.",
      filename: normalizedFilename,
      content: xmlContent,
      originalSha256,
      normalizedSha256,
      normalizationType: "TECHNICAL_SAFE",
      fiscalContentModified: false,
      stampRisk: "NONE",
    };
  }

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
    cfdiRelations,
    cartaPorte,
    structureDiagnostics,
    concepts: concepts ?? undefined,
    totalsValidation: totalsValidation ?? undefined,
    taxSummary: taxSummary ?? undefined,
    normalizedXml,
    regimenFiscalReceptor: regimenFiscalReceptor ?? undefined,
    domicilioFiscalReceptor: domicilioFiscalReceptor ?? undefined,
    lugarExpedicion: lugarExpedicion ?? undefined,
    sello: sello ?? undefined,
    certificado: certificado ?? undefined,
    noCertificado: noCertificado ?? undefined,
    selloCfd: selloCfd ?? undefined,
    selloSat: selloSat ?? undefined,
    noCertificadoSat: noCertificadoSat ?? undefined,
    rfcProvCertif: rfcProvCertif ?? undefined,
    versionTimbre: versionTimbre ?? undefined,
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
    cfdiRelations: result.cfdiRelations,
    cartaPorte: result.cartaPorte,
    structureDiagnostics: result.structureDiagnostics,
    concepts: result.concepts,
    totalsValidation: result.totalsValidation,
    taxSummary: result.taxSummary,
    normalizedXml: result.normalizedXml,
    regimenFiscalReceptor: result.regimenFiscalReceptor,
    domicilioFiscalReceptor: result.domicilioFiscalReceptor,
    lugarExpedicion: result.lugarExpedicion,
    sello: result.sello,
    certificado: result.certificado,
    noCertificado: result.noCertificado,
    selloCfd: result.selloCfd,
    selloSat: result.selloSat,
    noCertificadoSat: result.noCertificadoSat,
    rfcProvCertif: result.rfcProvCertif,
    versionTimbre: result.versionTimbre,
  };
}
