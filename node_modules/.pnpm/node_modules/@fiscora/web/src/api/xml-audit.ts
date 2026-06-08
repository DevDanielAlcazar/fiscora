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

export interface AnalysisResult {
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
  findings?: Finding[];
  technicalDiagnostics: TechnicalDiagnostics;
  executiveSummary: ExecutiveSummary;
  paymentComplement?: PaymentComplement;
  structureDiagnostics: StructureDiagnostics;
  concepts?: ConceptInfo[];
  totalsValidation?: TotalsValidation;
  taxSummary?: TaxSummary;
  normalizedXml?: NormalizedXml;
}

export interface AnalyzeResponse {
  ok: boolean;
  analysis: AnalysisResult;
}

export interface FileTechnicalDiagnostics {
  bomDetected: boolean;
  leadingContentBeforeXml: boolean;
  startsWithXml: boolean;
  safeNormalizationAvailable: boolean;
  notes: string[];
}

export interface ZipInventoryFile {
  index: number;
  name: string;
  sizeBytes: number;
  technicalDiagnostics: FileTechnicalDiagnostics;
}

export interface TechnicalSummary {
  filesWithBom: number;
  filesWithLeadingContent: number;
  filesWithSafeNormalizationAvailable: number;
  filesWithoutXmlStart: number;
}

export interface ZipInventoryResult {
  ok: boolean;
  filename: string;
  totalEntries: number;
  xmlFilesFound: number;
  ignoredEntries: number;
  files: ZipInventoryFile[];
  warnings: string[];
  technicalSummary: TechnicalSummary;
}

export async function analyzeZipInventory(token: string, file: File): Promise<ZipInventoryResult> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch("/api/modules/xml-audit/analyze-zip", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  if (res.status === 400) {
    const body = await res.json().catch(() => null);
    const code = body?.error?.code ?? "";
    const messages: Record<string, string> = {
      FILE_REQUIRED: "Selecciona un archivo ZIP.",
      INVALID_FILE_TYPE: "Solo se permiten archivos ZIP.",
      FILE_TOO_LARGE: "El archivo ZIP supera el límite de 25 MB.",
    };
    throw new Error(messages[code] ?? "No fue posible validar el ZIP.");
  }

  if (res.status === 403) {
    const body = await res.json().catch(() => null);
    const code = body?.error?.code ?? "";
    const messages: Record<string, string> = {
      ZIP_NOT_ALLOWED: "Tu plan actual no permite auditoría XML masiva con ZIP.",
      MODULE_NOT_ALLOWED: "Tu plan no tiene acceso a este módulo.",
      USAGE_LIMIT_EXCEEDED: "Has alcanzado el límite mensual de usos de tu plan.",
    };
    throw new Error(messages[code] ?? "No tienes permiso para usar esta función.");
  }

  if (!res.ok) {
    throw new Error("No fue posible validar el ZIP.");
  }

  return res.json();
}

export interface ZipFullAnalysisSummary {
  criticalCount: number;
  warningCount: number;
  okCount: number;
  infoOnlyCount: number;
  filesWithBom: number;
  filesWithTechnicalNormalization: number;
  byTipoComprobante: Record<string, number>;
}

export interface ZipFullAnalysisFileResult {
  index: number;
  name: string;
  sizeBytes: number;
  status: "ANALYZED" | "FAILED";
  errorCode?: string;
  errorMessage?: string;
  analysis?: AnalysisResult & { normalizedXml?: Omit<NormalizedXml, "content"> };
}

export interface ZipFullAnalysisResult {
  ok: boolean;
  filename: string;
  totalEntries: number;
  xmlFilesFound: number;
  analyzedCount: number;
  failedCount: number;
  ignoredEntries: number;
  warnings: string[];
  summary: ZipFullAnalysisSummary;
  results: ZipFullAnalysisFileResult[];
}

export async function analyzeZipFull(token: string, file: File): Promise<ZipFullAnalysisResult> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch("/api/modules/xml-audit/analyze-zip/full", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  if (res.status === 400) {
    const body = await res.json().catch(() => null);
    const code = body?.error?.code ?? "";
    const messages: Record<string, string> = {
      FILE_REQUIRED: "Selecciona un archivo ZIP.",
      INVALID_FILE_TYPE: "Solo se permiten archivos ZIP.",
      FILE_TOO_LARGE: "El archivo ZIP supera el límite de 25 MB.",
    };
    throw new Error(messages[code] ?? "No fue posible analizar el ZIP.");
  }

  if (res.status === 403) {
    const body = await res.json().catch(() => null);
    const code = body?.error?.code ?? "";
    const messages: Record<string, string> = {
      ZIP_NOT_ALLOWED: "Tu plan actual no permite auditoría XML masiva con ZIP.",
      MODULE_NOT_ALLOWED: "Tu plan no tiene acceso a este módulo.",
      USAGE_LIMIT_EXCEEDED: "Has alcanzado el límite mensual de usos de tu plan.",
    };
    throw new Error(messages[code] ?? "No tienes permiso para usar esta función.");
  }

  if (!res.ok) {
    throw new Error("No fue posible analizar el ZIP.");
  }

  return res.json();
}

export async function downloadNormalizedZip(token: string, file: File): Promise<Blob> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch("/api/modules/xml-audit/analyze-zip/download-normalized", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  if (res.status === 400) {
    const body = await res.json().catch(() => null);
    const code = body?.error?.code ?? "";
    if (code === "NO_NORMALIZED_XMLS_AVAILABLE") {
      throw new Error("No hay XMLs con normalización técnica segura disponible en este ZIP.");
    }
    const messages: Record<string, string> = {
      FILE_REQUIRED: "Selecciona un archivo ZIP.",
      INVALID_FILE_TYPE: "Solo se permiten archivos ZIP.",
      FILE_TOO_LARGE: "El archivo ZIP supera el límite de 25 MB.",
    };
    throw new Error(messages[code] ?? "No fue posible generar el ZIP de normalizados.");
  }

  if (res.status === 403) {
    const body = await res.json().catch(() => null);
    const code = body?.error?.code ?? "";
    const messages: Record<string, string> = {
      ZIP_NOT_ALLOWED: "Tu plan actual no permite auditoría XML masiva con ZIP.",
      MODULE_NOT_ALLOWED: "Tu plan no tiene acceso a este módulo.",
    };
    throw new Error(messages[code] ?? "No tienes permiso para usar esta función.");
  }

  if (!res.ok) {
    throw new Error("No fue posible generar el ZIP de XMLs normalizados.");
  }

  return res.blob();
}

export async function analyzeXml(token: string, file: File): Promise<AnalysisResult> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch("/api/modules/xml-audit/analyze", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  if (res.status === 400) {
    const body = await res.json().catch(() => null);
    const code = body?.error?.code ?? "";
    const messages: Record<string, string> = {
      FILE_REQUIRED: "Selecciona un archivo XML.",
      INVALID_FILE_TYPE: "Solo se permiten archivos XML.",
      FILE_TOO_LARGE: "El archivo supera el límite de 5 MB.",
      XML_INVALID: "El XML no es válido o no pudo leerse.",
    };
    throw new Error(messages[code] ?? "No fue posible analizar el XML.");
  }

  if (res.status === 403) {
    const body = await res.json().catch(() => null);
    const code = body?.error?.code ?? "";
    const messages: Record<string, string> = {
      MODULE_NOT_ALLOWED: "Tu plan no tiene acceso a este módulo.",
      USAGE_LIMIT_EXCEEDED: "Has alcanzado el límite mensual de usos de tu plan.",
    };
    throw new Error(messages[code] ?? "No tienes permiso para usar este módulo.");
  }

  if (!res.ok) {
    throw new Error("No fue posible analizar el XML.");
  }

  const data: AnalyzeResponse = await res.json();
  return data.analysis;
}
