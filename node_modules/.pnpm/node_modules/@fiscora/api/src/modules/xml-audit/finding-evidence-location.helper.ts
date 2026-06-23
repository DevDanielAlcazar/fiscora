export interface FindingLocation {
  module:
    | "cfdi-base"
    | "parties"
    | "concepts"
    | "concept-taxes"
    | "global-taxes"
    | "tfd"
    | "cfdi-relations"
    | "payment"
    | "nomina"
    | "carta-porte"
    | "comercio-exterior"
    | "retenciones"
    | "impuestos-locales"
    | "leyendas-fiscales"
    | "donatarias"
    | "addenda"
    | "cross-module"
    | "version"
    | "catalogs"
    | "unknown";
  section?: string;
  logicalPath?: string;
  field?: string;
  index?: number;
  parentIndex?: number;
  groupKey?: string;
}

export interface FindingValueTrace {
  observed?: string | number | boolean | null;
  expected?: string | number | boolean | null;
  calculated?: string | number | boolean | null;
  difference?: string | number | boolean | null;
  tolerance?: string | number | boolean | null;
}

export function buildFindingLocation(params: {
  module: FindingLocation["module"];
  section?: string;
  logicalPath?: string;
  field?: string;
  index?: number;
  parentIndex?: number;
  groupKey?: string;
}): FindingLocation {
  const loc: FindingLocation = { module: params.module };
  if (params.section) loc.section = params.section;
  if (params.logicalPath) {
    loc.logicalPath = params.logicalPath.length > 120
      ? params.logicalPath.slice(0, 117) + "..."
      : params.logicalPath;
  }
  if (params.field) loc.field = params.field;
  if (params.index !== undefined) loc.index = params.index;
  if (params.parentIndex !== undefined) loc.parentIndex = params.parentIndex;
  if (params.groupKey) loc.groupKey = params.groupKey;
  return loc;
}

export function buildValueTrace(params: {
  observed?: string | number | boolean | null;
  expected?: string | number | boolean | null;
  calculated?: string | number | boolean | null;
  difference?: string | number | null;
  tolerance?: string | number | null;
}): FindingValueTrace {
  const vt: FindingValueTrace = {};
  const trunc = (v: unknown): string | number | boolean | null => {
    if (v == null) return null;
    if (typeof v === "string") return v.length > 80 ? v.slice(0, 77) + "..." : v;
    if (typeof v === "number") return isFinite(v) ? parseFloat(v.toFixed(6)) : v;
    if (typeof v === "boolean") return v;
    return String(v).slice(0, 77) + "...";
  };
  if (params.observed !== undefined) vt.observed = trunc(params.observed);
  if (params.expected !== undefined) vt.expected = trunc(params.expected);
  if (params.calculated !== undefined) vt.calculated = trunc(params.calculated);
  if (params.difference !== undefined) vt.difference = trunc(params.difference);
  if (params.tolerance !== undefined) vt.tolerance = trunc(params.tolerance);
  return vt;
}

export function inferFindingLocationFromEvidence(finding: {
  code: string;
  evidence?: { label: string; value?: string }[];
}): { location?: FindingLocation; valueTrace?: FindingValueTrace } {
  const evidence = finding.evidence ?? [];
  const code = finding.code ?? "";

  const out: { location?: FindingLocation; valueTrace?: FindingValueTrace } = {};

  // 1. valueTrace from evidence labels
  const vt: FindingValueTrace = {};
  for (const e of evidence) {
    if (e.value == null) continue;
    const label = e.label?.toLowerCase() ?? "";
    if (/^expected|esperado/i.test(label)) vt.expected = e.value;
    if (/^observed|observado/i.test(label)) vt.observed = e.value;
    if (/^calculated|calculado/i.test(label)) vt.calculated = e.value;
    if (/^difference|diferencia|diference/i.test(label)) vt.difference = e.value;
    if (/^tolerance|tolerancia/i.test(label)) vt.tolerance = e.value;
  }
  if (Object.keys(vt).length > 0) out.valueTrace = vt;

  // 2. Infer module
  let module: FindingLocation["module"] = "unknown";

  // 2a. Code prefix match (fast, authoritative)
  if (/^PAYMENT_/.test(code)) module = "payment";
  else if (/^CARTA_PORTE_/.test(code)) module = "carta-porte";
  else if (/^NOMINA_/.test(code)) module = "nomina";
  else if (/^COMERCIO_EXTERIOR_/.test(code)) module = "comercio-exterior";
  else if (/^RETENCIONES_/.test(code)) module = "retenciones";
  else if (/^IMPUESTOS_LOCALES_/.test(code)) module = "impuestos-locales";
  else if (/^LEYENDAS_/.test(code)) module = "leyendas-fiscales";
  else if (/^DONATARIAS_/.test(code)) module = "donatarias";
  else if (/^ADDENDA_/.test(code)) module = "addenda";
  else if (/^CONCEPT_/.test(code)) module = "concepts";
  else if (/^TAX_/.test(code)) {
    const hasGlobalScope = evidence.some((e) => e.label === "taxScope" && e.value === "GLOBAL");
    module = hasGlobalScope ? "global-taxes" : "concept-taxes";
  } else if (/^TFD_/.test(code)) module = "tfd";
  else if (/^CFDI_RELATIONS_/.test(code)) module = "cfdi-relations";
  else if (/^(RECEPTOR_|EMISOR_)/.test(code)) module = "parties";
  else if (/^CATALOG_/.test(code)) module = "catalogs";
  else if (/^(CFDI_VERSION_|CFDI33_|CFDI40_)/.test(code)) module = "version";
  else if (/^COMPROBANTE_/.test(code)) module = "cfdi-base";
  else {
    // 2b. Evidence-based inference
    const labels = evidence.map((e) => e.label);
    if (labels.some((l) => l === "pagoIndex" || l === "documentoIndex" || l === "monedaP"))
      module = "payment";
    else if (
      labels.some(
        (l) => l === "ubicacionIndex" || l === "mercanciaIndex" || l === "transpInternac" || l === "totalDistRec",
      )
    )
      module = "carta-porte";
    else if (
      labels.some((l) => l === "fraccionArancelaria" || l === "totalUSD" || l === "tipoCambioUSD")
    )
      module = "comercio-exterior";
    else if (labels.some((l) => l === "curp" || l === "numEmpleado" || l === "tipoRegimen" || l === "periodicidadPago"))
      module = "nomina";
    else if (labels.some((l) => l === "rfcProvCertif" || l === "selloCFD" || l === "selloSAT" || l === "noCertificadoSAT"))
      module = "tfd";
    else if (labels.some((l) => l === "tipoRelacion" || l === "relatedUuid"))
      module = "cfdi-relations";
    else if (labels.some((l) => l === "conceptIndex" || l === "Concepto #")) module = "concepts";
    else if (labels.some((l) => l === "taxScope" || l === "taxType")) module = "concept-taxes";
    else if (labels.some((l) => l === "impRetenidoIndex")) module = "retenciones";
    else if (labels.some((l) => l === "rfcEmisor" || l === "rfcReceptor" || l === "usoCFDI" || l === "domicilioFiscalReceptor"))
      module = "parties";
    else if (labels.some((l) => l === "categoria" || l === "localTasa")) module = "impuestos-locales";
    else if (labels.some((l) => l === "leyenda")) module = "leyendas-fiscales";
    else if (labels.some((l) => l === "cfdi40OnlyFieldsDetected" || l === "cfdi33FieldsDetected"))
      module = "version";
    else if (
      labels.some(
        (l) =>
          l === "catálogo" || l === "catalogo" || l === "allowedValues" || l === "valoresPermitidos",
      )
    )
      module = "catalogs";
    else if (code.startsWith("CFDI_")) module = "cfdi-base";
  }

  // 3. Infer section, index, field from evidence
  let index: number | undefined;
  let parentIndex: number | undefined;
  let field: string | undefined;
  let section: string | undefined;

  for (const e of evidence) {
    if (e.value == null) continue;
    const label = e.label;
    const num = parseInt(e.value, 10);
    if (label === "pagoIndex" && !isNaN(num)) {
      index = num;
      section = "Pago";
    }
    if (label === "documentoIndex" && !isNaN(num)) {
      parentIndex = index;
      index = num;
      section = "DoctoRelacionado";
    }
    if ((label === "conceptIndex" || label === "Concepto #") && !isNaN(num)) {
      index = num;
      section = "Concepto";
    }
    if (label === "ubicacionIndex" && !isNaN(num)) {
      index = num;
      section = "Ubicación";
    }
    if (label === "mercanciaIndex" && !isNaN(num)) {
      index = num;
      section = "Mercancía";
    }
    if (label === "impRetenidoIndex" && !isNaN(num)) {
      index = num;
      section = "ImpRetenido";
    }
    if (label === "relationGroupIndex" && !isNaN(num)) {
      index = num;
      section = "CfdiRelacionados";
    }
    if (label === "taxScope" && e.value) {
      section = e.value === "GLOBAL" ? "Global" : "Concepto";
    }
    if (label === "version" && section === undefined && module === "version") {
      section = `CFDI${e.value}`;
    }
    if (!field) {
      const fieldCandidates = [
        "exportacion",
        "moneda",
        "tipoCambio",
        "total",
        "subtotal",
        "usoCFDI",
        "claveProdServ",
        "claveUnidad",
        "unidad",
        "descripcion",
        "objetoImp",
        "base",
        "impuesto",
        "tipoFactor",
        "tasaOCuota",
        "importe",
        "formaPago",
        "metodoPago",
        "lugarExpedicion",
        "curp",
        "numEmpleado",
        "tipoRegimen",
        "periodicidadPago",
        "claveEntFed",
        "fraccionArancelaria",
        "totalUSD",
        "incoterm",
        "regimenFiscalReceptor",
        "domicilioFiscalReceptor",
        "confirmacion",
      ];
      if (fieldCandidates.includes(label)) field = label;
    }
  }

  const location: FindingLocation = { module };
  if (section) location.section = section;
  if (field) location.field = field;
  if (index !== undefined) location.index = index;
  if (parentIndex !== undefined) location.parentIndex = parentIndex;

  if (
    location.module !== "unknown" ||
    location.section ||
    location.field ||
    location.index !== undefined
  ) {
    out.location = location;
  }

  return out;
}
