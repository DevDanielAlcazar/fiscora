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

export interface CartaPorteDomicilio {
  codigoPostal?: string | null;
  estado?: string | null;
  pais?: string | null;
  municipio?: string | null;
  localidad?: string | null;
  colonia?: string | null;
}

export interface CartaPorteUbicacion {
  tipoUbicacion?: string | null;
  idUbicacion?: string | null;
  rfcRemitenteDestinatario?: string | null;
  nombreRemitenteDestinatario?: string | null;
  fechaHoraSalidaLlegada?: string | null;
  distanciaRecorrida?: string | null;
  domicilio?: CartaPorteDomicilio | null;
}

export interface CartaPorteMercancia {
  bienesTransp?: string | null;
  descripcion?: string | null;
  cantidad?: string | null;
  claveUnidad?: string | null;
  pesoEnKg?: string | null;
  valorMercancia?: string | null;
  moneda?: string | null;
  materialPeligroso?: string | null;
  cveMaterialPeligroso?: string | null;
  embalaje?: string | null;
}

export interface CartaPorteTransportFigure {
  tipoFigura?: string | null;
  rfcFigura?: string | null;
  nombreFigura?: string | null;
  numLicencia?: string | null;
}

export interface CartaPorteIdentificacionVehicular {
  configVehicular?: string | null;
  placaVM?: string | null;
  anioModeloVM?: string | null;
}

export interface CartaPorteSeguros {
  aseguraRespCivil?: string | null;
  polizaRespCivil?: string | null;
}

export interface CartaPorteAutotransporteInfo {
  permSCT?: string | null;
  numPermisoSCT?: string | null;
  identificacionVehicular?: CartaPorteIdentificacionVehicular | null;
  seguros?: CartaPorteSeguros | null;
}

export interface CartaPorteInfo {
  version?: string | null;
  idCCP?: string | null;
  transpInternac?: string | null;
  totalDistRec?: string | null;
  entradaSalidaMerc?: string | null;
  paisOrigenDestino?: string | null;
  viaEntradaSalida?: string | null;
  numTotalMercancias?: string | null;
  pesoBrutoTotal?: string | null;
  unidadPeso?: string | null;
  hasUbicaciones: boolean;
  hasMercancias: boolean;
  ubicaciones: CartaPorteUbicacion[];
  mercancias: CartaPorteMercancia[];
  figurasTransporte: CartaPorteTransportFigure[];
  hasAutotransporte: boolean;
  autotransporte?: CartaPorteAutotransporteInfo | null;
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
  difference?: string | number | null;
  tolerance?: string | number | null;
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
  location?: FindingLocation;
  valueTrace?: FindingValueTrace;
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
  subsidioAlEmpleo?: { subsidioCausado?: string | null } | null;
}

export interface NominaPercepcionesHeader {
  totalSueldos?: string | null;
  totalSeparacionIndemnizacion?: string | null;
  totalJubilacionPensionRetiro?: string | null;
  totalGravado?: string | null;
  totalExento?: string | null;
}

export interface NominaDeduccionesHeader {
  totalOtrasDeducciones?: string | null;
  totalImpuestosRetenidos?: string | null;
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
  percepcionesHeader?: NominaPercepcionesHeader | null;
  deduccionesHeader?: NominaDeduccionesHeader | null;
  percepciones: NominaPercepcionInfo[];
  deducciones: NominaDeduccionInfo[];
  otrosPagos: NominaOtroPagoInfo[];
}

export interface CceDomicilio {
  calle?: string | null;
  numeroExterior?: string | null;
  numeroInterior?: string | null;
  colonia?: string | null;
  localidad?: string | null;
  municipio?: string | null;
  estado?: string | null;
  pais?: string | null;
  codigoPostal?: string | null;
}

export interface CceMercancia {
  noIdentificacion?: string | null;
  fraccionArancelaria?: string | null;
  cantidadAduana?: string | null;
  unidadAduana?: string | null;
  valorUnitarioAduana?: string | null;
  valorDolares?: string | null;
  marca?: string | null;
  modelo?: string | null;
  subModelo?: string | null;
  numeroSerie?: string | null;
  descripcionesEspecificas?: string | null;
}

export interface CceDestinatario {
  numRegIdTrib?: string | null;
  nombre?: string | null;
  domicilio?: CceDomicilio | null;
}

export interface CceReceptor {
  numRegIdTrib?: string | null;
  residenciaFiscal?: string | null;
  domicilio?: CceDomicilio | null;
}

export interface CceEmisor {
  curp?: string | null;
  domicilio?: CceDomicilio | null;
}

export interface ComercioExteriorInfo {
  version?: string | null;
  tipoOperacion?: string | null;
  claveDePedimento?: string | null;
  certificadoOrigen?: string | null;
  numCertificadoOrigen?: string | null;
  numeroExportadorConfiable?: string | null;
  incoterm?: string | null;
  subDivision?: string | null;
  observaciones?: string | null;
  tipoCambioUSD?: string | null;
  totalUSD?: string | null;
  motivoTraslado?: string | null;
  emisor?: CceEmisor | null;
  receptor?: CceReceptor | null;
  destinatarios: CceDestinatario[];
  mercancias: CceMercancia[];
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
  regimenFiscalE?: string | null;
}

export interface RetencionesReceptorInfo {
  nacionalidad?: string | null;
  rfcReceptor?: string | null;
  curp?: string | null;
  nombre?: string | null;
  numRegIdTrib?: string | null;
  domicilioFiscalR?: string | null;
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
  payloadPolicy?: {
    evidenceMaxStringLength: number;
    findingsMaxTotal: number;
    findingsMaxPerCode: number;
    sanitized: boolean;
  };
  analysisMeta?: AnalysisMetaInfo;
}

export interface AnalysisPerformanceInfo {
  totalMs: number;
  inputBytes: number;
  inputKb: number;
  findingsOriginalCount: number;
  findingsReturnedCount: number;
  findingsTruncated: boolean;
  normalizedXmlAvailable: boolean;
  sanitized: boolean;
}

export interface AnalysisCoverageModule {
  key: string;
  label: string;
  detected: boolean;
  analyzed: boolean;
  skippedReason?: string | null;
  findingsCount: number;
}

export interface AnalysisCoverageInfo {
  documentKind: "CFDI" | "RETENCIONES" | "UNKNOWN";
  modules: AnalysisCoverageModule[];
  complementsDetected: string[];
  complementsKnown: string[];
  complementsUnknown: string[];
  hasAddenda: boolean;
  hasTimbreFiscalDigital: boolean;
  hasSafeNormalization: boolean;
}

export interface AnalysisMetaInfo {
  generatedAt: string;
  engineVersion: string;
  performance: AnalysisPerformanceInfo;
  coverage: AnalysisCoverageInfo;
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

export interface XmlAuditHistorySummaryTotals {
  records: number;
  analyzed: number;
  failed: number;
  individual: number;
  zip: number;
  batches: number;
  ok: number;
  warning: number;
  critical: number;
  infoFindings: number;
  warningFindings: number;
  criticalFindings: number;
  recordsWithBom: number;
  recordsWithTechnicalNormalization: number;
  recordsWithNormalizedXml: number;
}

export interface XmlAuditHistorySummaryPriority {
  priority: string;
  findings: number;
  recordsAffected: number;
}

export interface XmlAuditHistorySummaryDocumentKind {
  documentKind: string;
  count: number;
}

export interface XmlAuditHistorySummaryActionGroup {
  actionGroup: string;
  findings: number;
  recordsAffected: number;
}

export interface XmlAuditHistorySummaryTopFinding {
  code: string;
  title: string;
  severityMax: string;
  priorityMax: string;
  count: number;
  recordsAffected: number;
}

export interface XmlAuditHistorySummaryRecord {
  id: string;
  createdAt: string;
  sourceType: string | null;
  sourceFilename: string | null;
  zipFilename: string | null;
  zipEntryName: string | null;
  analysisStatus: string;
  documentKind: string;
  uuid: string | null;
  rfcEmisor: string | null;
  rfcReceptor: string | null;
  total: string | null;
  moneda: string | null;
  riskLevel: string | null;
  findingsCount: number;
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  priorityMax: string | null;
  actionGroupTop: string | null;
}

export interface XmlAuditHistorySummaryBatch {
  batchId: string;
  zipFilename: string;
  createdAtFirst: string;
  createdAtLast: string;
  totalRecords: number;
  analyzedCount: number;
  failedCount: number;
  criticalCount: number;
  warningCount: number;
  okCount: number;
  priorityMax: string | null;
  topActionGroup: string | null;
  topFindingCode: string | null;
}

export interface XmlAuditHistorySummary {
  generatedAt: string;
  retentionHours: number;
  truncated?: boolean;
  maxRecords?: number;
  filters: {
    from?: string;
    to?: string;
    sourceType?: string;
    analysisStatus?: string;
  };
  totals: XmlAuditHistorySummaryTotals;
  priorities: XmlAuditHistorySummaryPriority[];
  documentKinds: XmlAuditHistorySummaryDocumentKind[];
  actionGroups: XmlAuditHistorySummaryActionGroup[];
  topFindingCodes: XmlAuditHistorySummaryTopFinding[];
  recentRecords: XmlAuditHistorySummaryRecord[];
  recentBatches: XmlAuditHistorySummaryBatch[];
}

export interface XmlAuditHistorySummaryQuery {
  from?: string;
  to?: string;
  sourceType?: string;
  analysisStatus?: string;
}

export async function getXmlAuditHistorySummary(
  token: string,
  query: XmlAuditHistorySummaryQuery,
): Promise<XmlAuditHistorySummary> {
  const params = new URLSearchParams();
  if (query.from) params.set("from", query.from);
  if (query.to) params.set("to", query.to);
  if (query.sourceType) params.set("sourceType", query.sourceType);
  if (query.analysisStatus) params.set("analysisStatus", query.analysisStatus);

  const res = await fetch(`/api/modules/xml-audit/history/summary?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error("No fue posible consultar el resumen de la auditoría.");
  }

  return res.json();
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

export interface XmlAuditHistoryItem {
  id: string;
  createdAt: string;
  expiresAt: string;
  sourceType: "INDIVIDUAL" | "ZIP" | null;
  sourceFilename: string | null;
  batchId: string | null;
  zipFilename: string | null;
  zipEntryName: string | null;
  zipEntryIndex: number | null;
  analysisStatus: "ANALYZED" | "FAILED";
  errorCode: string | null;
  errorMessage: string | null;
  uuid: string | null;
  tipoComprobante: string | null;
  documentKind: DocumentKind;
  rfcEmisor: string | null;
  nombreEmisor: string | null;
  rfcReceptor: string | null;
  nombreReceptor: string | null;
  fecha: string | null;
  total: string | null;
  moneda: string | null;
  riskLevel: string | null;
  findingsCount: number;
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  hasBom: boolean;
  hasTechnicalNormalization: boolean;
  hasNormalizedXml: boolean;
  priorityMax: string | null;
  actionGroupTop: string | null;
}

export interface XmlAuditHistoryResponse {
  items: XmlAuditHistoryItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface XmlAuditHistoryQuery {
  page?: number;
  pageSize?: number;
  sourceType?: string;
  analysisStatus?: string;
  riskLevel?: string;
  documentKind?: string;
  from?: string;
  to?: string;
  search?: string;
}

export interface XmlAuditHistoryDetail extends XmlAuditHistoryItem {
  analysisJson: AnalysisResult;
}

export async function getXmlAuditHistory(
  token: string,
  query: XmlAuditHistoryQuery,
): Promise<XmlAuditHistoryResponse> {
  const params = new URLSearchParams();
  if (query.page) params.set("page", String(query.page));
  if (query.pageSize) params.set("pageSize", String(query.pageSize));
  if (query.sourceType) params.set("sourceType", query.sourceType);
  if (query.analysisStatus) params.set("analysisStatus", query.analysisStatus);
  if (query.riskLevel) params.set("riskLevel", query.riskLevel);
  if (query.documentKind) params.set("documentKind", query.documentKind);
  if (query.from) params.set("from", query.from);
  if (query.to) params.set("to", query.to);
  if (query.search) params.set("search", query.search);

  const res = await fetch(`/api/modules/xml-audit/history?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error("No fue posible consultar el historial de análisis.");
  }

  return res.json();
}

export async function getXmlAuditHistoryDetail(
  token: string,
  id: string,
): Promise<XmlAuditHistoryDetail> {
  const res = await fetch(`/api/modules/xml-audit/history/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 404) {
    throw new Error("Registro de análisis no encontrado.");
  }

  if (!res.ok) {
    throw new Error("No fue posible consultar el detalle del análisis.");
  }

  return res.json();
}

export interface XmlAuditZipBatchItem {
  batchId: string;
  zipFilename: string;
  createdAtFirst: string;
  createdAtLast: string;
  expiresAt: string;
  totalRecords: number;
  analyzedCount: number;
  failedCount: number;
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  okCount: number;
  recordsWithBom: number;
  recordsWithTechnicalNormalization: number;
  recordsWithNormalizedXml: number;
  documentKinds: Array<{ documentKind: string; count: number }>;
  priorityMax: string | null;
  topActionGroup: string | null;
  topFindingCode: string | null;
  hasFailed: boolean;
  hasCritical: boolean;
}

export interface XmlAuditZipBatchesResponse {
  items: XmlAuditZipBatchItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface XmlAuditZipBatchesQuery {
  page?: number;
  pageSize?: number;
  from?: string;
  to?: string;
  zipFilename?: string;
  batchId?: string;
  hasFailed?: string;
  hasCritical?: string;
  documentKind?: string;
  search?: string;
}

export type XmlAuditZipBatchRecord = XmlAuditHistoryItem;

export interface XmlAuditZipBatchDetail {
  batch: {
    batchId: string;
    zipFilename: string;
    createdAtFirst: string;
    createdAtLast: string;
    expiresAt: string;
    hasCritical: boolean;
    hasFailed: boolean;
    summary: {
      totalRecords: number;
      analyzedCount: number;
      failedCount: number;
      criticalCount: number;
      warningCount: number;
      infoCount: number;
      okCount: number;
      recordsWithBom: number;
      recordsWithTechnicalNormalization: number;
      recordsWithNormalizedXml: number;
      documentKinds: Array<{ documentKind: string; count: number }>;
    };
  };
  records: XmlAuditZipBatchRecord[];
}

export async function getXmlAuditZipBatches(
  token: string,
  query: XmlAuditZipBatchesQuery,
): Promise<XmlAuditZipBatchesResponse> {
  const params = new URLSearchParams();
  if (query.page) params.set("page", String(query.page));
  if (query.pageSize) params.set("pageSize", String(query.pageSize));
  if (query.from) params.set("from", query.from);
  if (query.to) params.set("to", query.to);
  if (query.zipFilename) params.set("zipFilename", query.zipFilename);
  if (query.batchId) params.set("batchId", query.batchId);
  if (query.hasFailed) params.set("hasFailed", query.hasFailed);
  if (query.hasCritical) params.set("hasCritical", query.hasCritical);
  if (query.documentKind) params.set("documentKind", query.documentKind);
  if (query.search) params.set("search", query.search);

  const res = await fetch(`/api/modules/xml-audit/history/batches?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error("No fue posible consultar los lotes ZIP.");
  }

  return res.json();
}

export async function getXmlAuditZipBatchDetail(
  token: string,
  batchId: string,
): Promise<XmlAuditZipBatchDetail> {
  const res = await fetch(`/api/modules/xml-audit/history/batches/${batchId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 404) {
    throw new Error("Lote ZIP no encontrado.");
  }

  if (!res.ok) {
    throw new Error("No fue posible consultar el detalle del lote ZIP.");
  }

  return res.json();
}
