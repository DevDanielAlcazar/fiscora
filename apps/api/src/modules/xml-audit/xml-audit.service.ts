import { XMLParser } from "fast-xml-parser";

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
}

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

export function analyzeCfdi(xmlContent: string): CfdiAnalysisResult {
  const issues: string[] = [];
  const warnings: string[] = [];

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
    warnings.push("No se pudo determinar la versión del CFDI");
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
  const totalTrasladados = str(get(impuestos, "@_TotalImpuestosTrasladados"));
  const totalRetenidos = str(get(impuestos, "@_TotalImpuestosRetenidos"));

  // TimbreFiscalDigital (Complemento)
  let uuid: string | null = null;
  let fechaTimbrado: string | null = null;

  const complemento = get(comprobante, "cfdi:Complemento") as Record<string, unknown> ?? {};
  const timbre = get(complemento, "tfd:TimbreFiscalDigital") as Record<string, unknown> ??
    get(complemento, "TimbreFiscalDigital") as Record<string, unknown> ?? {};

  if (timbre && typeof timbre === "object") {
    uuid = str(get(timbre, "@_UUID")) ?? str(get(timbre, "@_uuid"));
    fechaTimbrado = str(get(timbre, "@_FechaTimbrado"));
  }

  // Validate required fields
  if (!rfcEmisor) issues.push("No se encontró el RFC del emisor");
  if (!rfcReceptor) issues.push("No se encontró el RFC del receptor");
  if (!total) issues.push("No se encontró el total del comprobante");
  if (!uuid) issues.push("No se encontró el UUID (TimbreFiscalDigital)");

  if (version && !["3.3", "4.0"].includes(version)) {
    warnings.push(`Versión de CFDI no estándar: ${version}`);
  }

  return {
    uuid,
    version,
    tipoComprobante: tipoComprobante === "I" ? "Ingreso" : tipoComprobante === "E" ? "Egreso" : tipoComprobante === "P" ? "Pago" : tipoComprobante === "N" ? "Nómina" : tipoComprobante === "T" ? "Traslado" : tipoComprobante,
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
    totalImpuestosTrasladados: totalTrasladados,
    totalImpuestosRetenidos: totalRetenidos,
    usoCfdi,
    metodoPago,
    formaPago,
    issues,
    warnings,
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
  };
}
