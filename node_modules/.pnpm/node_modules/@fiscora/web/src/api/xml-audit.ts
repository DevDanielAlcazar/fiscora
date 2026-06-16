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
  priority?: "BLOCKER" | "HIGH" | "MEDIUM" | "LOW";
  actionGroup?: string;
}

export interface GlobalTaxLine {
  type: "TRANSFERRED" | "WITHHELD";
  impuesto?: string | null;
  tipoFactor?: string | null;
  tasaOCuota?: string | null;
  base?: string | null;
  importe?: string | null;
}

export interface GlobalTaxesInfo {
  totalImpuestosTrasladados?: string | null;
  totalImpuestosRetenidos?: string | null;
  transferred: GlobalTaxLine[];
  withheld: GlobalTaxLine[];
}

export interface NominaReceptorInfo {
  curp?: string | null;
  numSeguridadSocial?: string | null;
  fechaInicioRelLaboral?: string | null;
  antiguedad?: string | null;
  tipoContrato?: string | null;
  sindicalizado?: string | null;
  tipoJornada?: string | null;
  tipoRegimen?: string | null;
  numEmpleado?: string | null;
  departamento?: string | null;
  puesto?: string | null;
  riesgoPuesto?: string | null;
  periodicidadPago?: string | null;
  banco?: string | null;
  cuentaBancaria?: string | null;
  salarioBaseCotApor?: string | null;
  salarioDiarioIntegrado?: string | null;
  claveEntFed?: string | null;
}

export interface NominaPercepcionInfo {
  tipoPercepcion?: string | null;
  clave?: string | null;
  concepto?: string | null;
  importeGravado?: string | null;
  importeExento?: string | null;
}

export interface NominaDeduccionInfo {
  tipoDeduccion?: string | null;
  clave?: string | null;
  concepto?: string | null;
  importe?: string | null;
}

export interface NominaOtroPagoInfo {
  tipoOtroPago?: string | null;
  clave?: string | null;
  concepto?: string | null;
  importe?: string | null;
}

export interface NominaInfo {
  version?: string | null;
  tipoNomina?: string | null;
  fechaPago?: string | null;
  fechaInicialPago?: string | null;
  fechaFinalPago?: string | null;
  numDiasPagados?: string | null;
  totalPercepciones?: string | null;
  totalDeducciones?: string | null;
  totalOtrosPagos?: string | null;
  receptor?: NominaReceptorInfo;
  percepciones: NominaPercepcionInfo[];
  deducciones: NominaDeduccionInfo[];
  otrosPagos: NominaOtroPagoInfo[];
}

export interface ComercioExteriorInfo {
  version?: string | null;
  tipoOperacion?: string | null;
  claveDePedimento?: string | null;
  certificadoOrigen?: string | null;
  numeroExportadorConfiable?: string | null;
  incoterm?: string | null;
  subDivision?: string | null;
  observaciones?: string | null;
  tipoCambioUSD?: string | null;
  totalUSD?: string | null;
}

export interface ImpuestoLocalRetencionInfo {
  impLocRetenido?: string | null;
  tasaDeRetencion?: string | null;
  importe?: string | null;
}

export interface ImpuestoLocalTrasladoInfo {
  impLocTrasladado?: string | null;
  tasaDeTraslado?: string | null;
  importe?: string | null;
}

export interface ImpuestosLocalesInfo {
  version?: string | null;
  totalDeRetenciones?: string | null;
  totalDeTraslados?: string | null;
  retenciones: ImpuestoLocalRetencionInfo[];
  traslados: ImpuestoLocalTrasladoInfo[];
}

export interface AddendaSignal {
  key: string;
  label: string;
  value: string;
  path: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
}

export interface AddendaNodeSummary {
  path: string;
  name: string;
  childCount: number;
  scalarFields: number;
}

export interface AddendaInfo {
  detected: boolean;
  rootKeys: string[];
  nodeCount: number;
  maxDepth: number;
  signals: AddendaSignal[];
  nodeSummary: AddendaNodeSummary[];
  truncated: boolean;
}

export interface LeyendaFiscalInfo {
  disposicionFiscal?: string | null;
  norma?: string | null;
  textoLeyenda?: string | null;
}

export interface LeyendasFiscalesInfo {
  version?: string | null;
  leyendas: LeyendaFiscalInfo[];
}

export interface DonatariasInfo {
  version?: string | null;
  noAutorizacion?: string | null;
  fechaAutorizacion?: string | null;
  leyenda?: string | null;
}

export interface RetencionesEmisorInfo {
  rfcEmisor?: string | null;
  nombre?: string | null;
  curp?: string | null;
}

export interface RetencionesReceptorInfo {
  nacionalidad?: string | null;
  rfcReceptor?: string | null;
  curp?: string | null;
  nombre?: string | null;
  numRegIdTrib?: string | null;
}

export interface RetencionesPeriodoInfo {
  mesIni?: string | null;
  mesFin?: string | null;
  ejercicio?: string | null;
}

export interface RetencionImpuestoInfo {
  baseRet?: string | null;
  impuesto?: string | null;
  montoRet?: string | null;
  tipoPagoRet?: string | null;
}

export interface RetencionesTotalesInfo {
  montoTotOperacion?: string | null;
  montoTotGrav?: string | null;
  montoTotExent?: string | null;
  montoTotRet?: string | null;
  impuestosRetenidos: RetencionImpuestoInfo[];
}

export interface RetencionesInfo {
  version?: string | null;
  folioInt?: string | null;
  sello?: string | null;
  numCert?: string | null;
  cert?: string | null;
  fechaExp?: string | null;
  cveRetenc?: string | null;
  descRetenc?: string | null;
  lugarExpRetenc?: string | null;
  emisor?: RetencionesEmisorInfo;
  receptor?: RetencionesReceptorInfo;
  periodo?: RetencionesPeriodoInfo;
  totales?: RetencionesTotalesInfo;
  complementoNames: string[];
  uuid?: string | null;
  fechaTimbrado?: string | null;
  rfcProvCertif?: string | null;
}

export type DocumentKind = "CFDI" | "RETENCIONES" | "UNKNOWN";

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
  documentKind: DocumentKind;
  uuid: string | null;
  tipoComprobante: string | null;
  rfcEmisor: string | null;
  nombreEmisor: string | null;
  regimenFiscal?: string | null;
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
  cfdiRelations?: CfdiRelations;
  cartaPorte?: CartaPorteInfo;
  nomina?: NominaInfo;
  comercioExterior?: ComercioExteriorInfo;
  impuestosLocales?: ImpuestosLocalesInfo;
  leyendasFiscales?: LeyendasFiscalesInfo;
  donatarias?: DonatariasInfo;
  retenciones?: RetencionesInfo;
  addenda?: AddendaInfo;
  structureDiagnostics: StructureDiagnostics;
  concepts?: ConceptInfo[];
  totalsValidation?: TotalsValidation;
  taxSummary?: TaxSummary;
  globalTaxes?: GlobalTaxesInfo;
  normalizedXml?: NormalizedXml;
  regimenFiscalReceptor?: string | null;
  domicilioFiscalReceptor?: string | null;
  lugarExpedicion?: string | null;
  exportacion?: string | null;
  tipoCambio?: string | null;
  sello?: string | null;
  certificado?: string | null;
  noCertificado?: string | null;
  selloCfd?: string | null;
  selloSat?: string | null;
  noCertificadoSat?: string | null;
  rfcProvCertif?: string | null;
  versionTimbre?: string | null;
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
  usage?: {
    consumed: boolean;
    units: number;
    policy: string;
  };
  persistence?: {
    enabled: true;
    zipBatchId: string;
    recordsAttempted: number;
    recordsSaved: number;
    recordsFailed: number;
    retentionHours: 24;
    analyzedRecordsAttempted?: number;
    failedRecordsAttempted?: number;
  };
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
