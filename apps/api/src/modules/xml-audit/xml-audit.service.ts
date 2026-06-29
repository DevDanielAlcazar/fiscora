import { XMLParser } from "fast-xml-parser";
import { createHash } from "node:crypto";
import {
  getTipoComprobanteLabel,
  getMetodoPagoLabel,
  getFormaPagoLabel,
  getObjetoImpLabel,
  getImpuestoLabel,
  getTipoFactorLabel,
  getTipoRelacionLabel,
  getExportacionLabel,
  getCurrencyLabel,
  getUsoCfdiLabel,
  isKnownTipoComprobante,
  isKnownMetodoPago,
  isKnownFormaPago,
  isKnownObjetoImp,
  isKnownImpuesto,
  isKnownTipoFactor,
  isKnownTipoRelacion,
  isKnownExportacion,
  isKnownUsoCfdi,
  getRegimenFiscalLabel,
  isKnownRegimenFiscal,
  CFDI_METODO_PAGO_BASIC,
  CFDI_FORMA_PAGO_BASIC,
  CFDI_IMPUESTO_BASIC,
  CFDI_TIPO_RELACION_BASIC,
  CFDI_MONEDAS_BASICAS,
} from "./xml-audit.catalogs.js";
import { validatePaymentComplementAdvanced } from "./payment-complement-validations.helper.js";
import { validateNominaAdvanced } from "./nomina-validations.helper.js";
import { validateCartaPorteAdvanced } from "./carta-porte-validations.helper.js";
import { validateComercioExteriorAdvanced } from "./comercio-exterior-validations.helper.js";
import { validateRetencionesAdvanced } from "./retenciones-validations.helper.js";
import { validateCatalogConsistency } from "./catalog-consistency.helper.js";
import { validateTaxAdvanced } from "./tax-advanced-validations.helper.js";
import { validateConceptsAdvanced } from "./concept-validations.helper.js";
import { validateStamp } from "./stamp-validations.helper.js";
import { validateCfdiRelationsAdvanced } from "./cfdi-relations-validations.helper.js";
import { validatePartiesAdvanced } from "./party-validations.helper.js";
import { validateCrossModuleConsistency } from "./cross-module-validations.helper.js";
import { validateCfdiVersionConsistency } from "./cfdi-version-validations.helper.js";
import { validateXmlWellFormedness } from "./xml-wellformedness.helper.js";
import { buildXsdValidationSummary } from "./xsd/xsd-validation.service.js";
import type { XsdValidationSummary } from "./xsd/xsd-validation.types.js";
import { buildCryptoValidationSummary } from "./crypto/crypto-validation.service.js";
import {
  type FindingLocation,
  type FindingValueTrace,
  inferFindingLocationFromEvidence,
} from "./finding-evidence-location.helper.js";

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

export interface PaymentDrTaxEntry {
  baseDR?: string;
  impuestoDR?: string;
  tipoFactorDR?: string;
  tasaOCuotaDR?: string;
  importeDR?: string;
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
  impuestosDR?: { trasladosDR: PaymentDrTaxEntry[]; retencionesDR: PaymentDrTaxEntry[] };
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

export interface PaymentTotalesInfo {
  montoTotalPagos?: string;
  totalTrasladosBaseIVA16?: string;
  totalTrasladosImpuestoIVA16?: string;
  totalTrasladosBaseIVA8?: string;
  totalTrasladosImpuestoIVA8?: string;
  totalTrasladosBaseIVA0?: string;
  totalTrasladosImpuestoIVA0?: string;
  totalTrasladosBaseIVAExento?: string;
  totalRetencionesIVA?: string;
  totalRetencionesISR?: string;
  totalRetencionesIEPS?: string;
}

export interface PaymentComplement {
  version?: string;
  pagos: PaymentInfo[];
  totales?: PaymentTotalesInfo;
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
  priority?: "BLOCKER" | "HIGH" | "MEDIUM" | "LOW";
  actionGroup?: string;
  location?: FindingLocation;
  valueTrace?: FindingValueTrace;
}

export function getFindingPriority(
  severity: Finding["severity"],
  category: Finding["category"],
): Finding["priority"] {
  if (severity === "CRITICAL") return "BLOCKER";
  if (severity === "WARNING") {
    if (["TOTALS", "TAX", "COMPLEMENT"].includes(category)) return "HIGH";
    if (["FISCAL", "TECHNICAL", "STRUCTURE"].includes(category)) return "MEDIUM";
  }
  return "LOW";
}

export function getFindingActionGroup(finding: {
  severity: Finding["severity"];
  category: Finding["category"];
  code: string;
}): string {
  const codeUpper = finding.code.toUpperCase();
  if (/TOTAL|SUBTOTAL|MISMATCH|DISCOUNT|BALANCE/.test(codeUpper))
    return "Corregir importes/totales";
  if (finding.category === "TAX") return "Revisar impuestos";
  if (finding.category === "COMPLEMENT") return "Revisar complemento";
  if (finding.category === "FISCAL") return "Validar datos fiscales";
  if (finding.category === "TECHNICAL") return "Validar timbrado/estructura técnica";
  if (finding.category === "STRUCTURE" && codeUpper.startsWith("ADDENDA"))
    return "Revisar referencias operativas";
  if (finding.category === "STRUCTURE") return "Validar estructura XML";
  return "Informativo";
}

// ─── Sanitization constants ─────────────────────────────────────────────────

const FINDING_EVIDENCE_MAX_STRING_LENGTH = 240;
const FINDING_EVIDENCE_MAX_ARRAY_ITEMS = 20;
const FINDING_EVIDENCE_MAX_OBJECT_KEYS = 30;
const FINDING_EVIDENCE_MAX_DEPTH = 3;
const FINDINGS_MAX_TOTAL = 500;
const FINDINGS_MAX_PER_CODE = 50;

const SENSITIVE_EVIDENCE_LABELS = new Set([
  "rawxml",
  "sourcexml",
  "normalizedxmlcontent",
  "filecontent",
  "base64",
  "token",
  "authorization",
  "password",
  "secret",
  "session",
  "cookie",
]);

// ─── Sanitization helpers ─────────────────────────────────────────────────

export function sanitizeEvidenceValue(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") {
    const cleaned = value
      .split("")
      .filter((c) => {
        const code = c.charCodeAt(0);
        return code >= 32 || code === 9 || code === 10 || code === 13;
      })
      .join("");
    if (cleaned.length > FINDING_EVIDENCE_MAX_STRING_LENGTH) {
      return cleaned.slice(0, FINDING_EVIDENCE_MAX_STRING_LENGTH) + "… [truncated]";
    }
    return cleaned;
  }
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) {
    const result: unknown[] = [];
    const max = FINDING_EVIDENCE_MAX_ARRAY_ITEMS;
    for (let i = 0; i < Math.min(value.length, max); i++) {
      result.push(sanitizeEvidenceValue(value[i], depth + 1));
    }
    if (value.length > max) {
      result.push(`[truncated ${value.length - max} additional items]`);
    }
    return result;
  }
  if (typeof value === "object" && value !== null) {
    if (depth >= FINDING_EVIDENCE_MAX_DEPTH) return "[max depth]";
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj);
    const limitedKeys = keys.slice(0, FINDING_EVIDENCE_MAX_OBJECT_KEYS);
    const result: Record<string, unknown> = {};
    for (const key of limitedKeys) {
      result[key] = sanitizeEvidenceValue(obj[key], depth + 1);
    }
    if (keys.length > FINDING_EVIDENCE_MAX_OBJECT_KEYS) {
      result.__truncatedKeys = keys.length - FINDING_EVIDENCE_MAX_OBJECT_KEYS;
    }
    return result;
  }
  const str = String(value);
  if (str.length > FINDING_EVIDENCE_MAX_STRING_LENGTH) {
    return str.slice(0, FINDING_EVIDENCE_MAX_STRING_LENGTH) + "… [truncated]";
  }
  return str;
}

export function sanitizeFindingEvidence(
  evidence: { label: string; value?: string }[] | undefined,
): { label: string; value?: string }[] | undefined {
  if (!evidence) return evidence;
  return evidence.map((e) => {
    const labelLower = e.label.toLowerCase().replace(/[\s_-]/g, "");
    const shouldRedact = SENSITIVE_EVIDENCE_LABELS.has(labelLower);
    return {
      label: e.label,
      value: shouldRedact ? "[redacted]" : (sanitizeEvidenceValue(e.value) as string | undefined),
    };
  });
}

const FINDING_TITLE_MAX = 160;
const FINDING_MESSAGE_MAX = 500;
const FINDING_ACTION_MAX = 500;

function truncateString(str: string | undefined, max: number): string | undefined {
  if (!str) return str;
  if (str.length <= max) return str;
  return str.slice(0, max) + "… [truncated]";
}

export function sanitizeFinding(finding: Finding): Finding {
  return {
    ...finding,
    title: truncateString(finding.title, FINDING_TITLE_MAX) ?? finding.title,
    message: truncateString(finding.message, FINDING_MESSAGE_MAX) ?? finding.message,
    recommendedAction: finding.recommendedAction
      ? (truncateString(finding.recommendedAction, FINDING_ACTION_MAX) ?? finding.recommendedAction)
      : undefined,
    evidence: sanitizeFindingEvidence(finding.evidence),
  };
}

export function limitFindings(findings: Finding[]): Finding[] {
  const perCode: Record<string, number> = {};
  const result: Finding[] = [];
  let truncated = false;
  const originalCount = findings.length;

  if (originalCount <= FINDINGS_MAX_TOTAL) {
    for (const f of findings) {
      perCode[f.code] = (perCode[f.code] ?? 0) + 1;
      if (perCode[f.code] > FINDINGS_MAX_PER_CODE) {
        truncated = true;
        break;
      }
    }
    if (!truncated) return findings;
  }

  const resetPerCode: Record<string, number> = {};
  truncated = false;

  for (const f of findings) {
    resetPerCode[f.code] = (resetPerCode[f.code] ?? 0) + 1;
    if (resetPerCode[f.code] > FINDINGS_MAX_PER_CODE) {
      truncated = true;
      continue;
    }
    if (result.length >= FINDINGS_MAX_TOTAL) {
      truncated = true;
      break;
    }
    result.push(f);
  }

  if (truncated) {
    result.push({
      id: "FINDINGS_TRUNCATED_FOR_RESPONSE-1",
      severity: "INFO",
      category: "STRUCTURE",
      code: "FINDINGS_TRUNCATED_FOR_RESPONSE",
      title: "Hallazgos truncados por límites de respuesta",
      message:
        "El análisis generó más hallazgos de los permitidos para una respuesta segura y eficiente.",
      recommendedAction:
        "Descarga el reporte o revisa el XML en partes si necesitas mayor detalle.",
      evidence: [
        { label: "originalCount", value: String(originalCount) },
        { label: "returnedCount", value: String(result.length) },
        { label: "maxTotal", value: String(FINDINGS_MAX_TOTAL) },
        { label: "maxPerCode", value: String(FINDINGS_MAX_PER_CODE) },
      ],
    });
  }
  return result;
}

export function buildAnalysisCoverage(result: CfdiAnalysisResult): AnalysisCoverageInfo {
  const docKind = result.documentKind as "CFDI" | "RETENCIONES" | "UNKNOWN";
  const findings = result.findings ?? [];

  const countByPrefix = (prefix: string): number =>
    findings.filter((f) => f.code.startsWith(prefix)).length;

  const detected = (complement: unknown): boolean =>
    complement !== null && complement !== undefined;

  const hasPayment = detected(result.paymentComplement);
  const hasRelations = detected(result.cfdiRelations);
  const hasCartaPorte = detected(result.cartaPorte);
  const hasNomina = detected(result.nomina);
  const hasComercioExterior = detected(result.comercioExterior);
  const hasImpuestosLocales = detected(result.impuestosLocales);
  const hasLeyendasFiscales = detected(result.leyendasFiscales);
  const hasDonatarias = detected(result.donatarias);
  const hasAddendaDetected = result.addenda?.detected === true;
  const hasRetenciones = detected(result.retenciones);
  const hasConcepts = result.concepts !== null && result.concepts !== undefined;
  const hasGlobalTaxes = detected(result.globalTaxes);
  const hasTimbreFiscalDigital = result.technicalDiagnostics?.hasTimbreFiscalDigital ?? false;
  const hasSafeNormalization = result.technicalDiagnostics?.safeNormalizationApplied ?? false;

  const isCfdi = docKind === "CFDI";
  const isRetenciones = docKind === "RETENCIONES";

  const skipped = (reason: string): string | null => reason;

  const modules: AnalysisCoverageModule[] = [
    {
      key: "cfdi-base",
      label: "CFDI Base",
      detected: isCfdi,
      analyzed: isCfdi,
      skippedReason: isCfdi ? null : skipped("No aplica para XML de Retenciones"),
      findingsCount: isCfdi
        ? countByPrefix("COMPROBANTE_") +
          countByPrefix("EMISOR_") +
          countByPrefix("RECEPTOR_") +
          countByPrefix("GENERIC_RFC_") +
          countByPrefix("EXPORTACION_") +
          countByPrefix("SERIE_FOLIO_") +
          countByPrefix("MONEDA_") +
          countByPrefix("LUGAR_EXPEDICION_") +
          countByPrefix("FECHA_") +
          countByPrefix("TOTAL_") +
          countByPrefix("SUBTOTAL_") +
          countByPrefix("FORMA_PAGO_") +
          countByPrefix("METODO_PAGO_") +
          countByPrefix("DESCUENTO_")
        : 0,
    },
    {
      key: "retenciones",
      label: "Retenciones",
      detected: isRetenciones || hasRetenciones,
      analyzed: hasRetenciones,
      skippedReason: hasRetenciones
        ? null
        : isCfdi
          ? skipped("Complemento no detectado")
          : skipped("Tipo de documento no compatible"),
      findingsCount: countByPrefix("RETENCIONES_"),
    },
    {
      key: "timbre-fiscal-digital",
      label: "Timbre Fiscal Digital",
      detected: hasTimbreFiscalDigital,
      analyzed: hasTimbreFiscalDigital,
      skippedReason: hasTimbreFiscalDigital ? null : skipped("Complemento no detectado"),
      findingsCount:
        countByPrefix("MISSING_TFD_") +
        countByPrefix("TFD_") +
        countByPrefix("TIMBRADO_") +
        countByPrefix("MISSING_COMPROBANTE_") +
        countByPrefix("NO_CERTIFICADO_") +
        countByPrefix("MISSING_RFC_PROV_CERTIF") +
        countByPrefix("MISSING_NO_CERTIFICADO"),
    },
    {
      key: "concept-taxes",
      label: "Impuestos por concepto",
      detected: isCfdi && hasConcepts,
      analyzed: isCfdi && hasConcepts,
      skippedReason:
        isCfdi && !hasConcepts
          ? skipped("Complemento no detectado")
          : !isCfdi
            ? skipped("No aplica para XML de Retenciones")
            : null,
      findingsCount: countByPrefix("CONCEPT_"),
    },
    {
      key: "global-taxes",
      label: "Impuestos globales",
      detected: hasGlobalTaxes,
      analyzed: hasGlobalTaxes,
      skippedReason: hasGlobalTaxes
        ? null
        : isRetenciones
          ? skipped("No aplica para XML de Retenciones")
          : skipped("Complemento no detectado"),
      findingsCount: countByPrefix("GLOBAL_"),
    },
    {
      key: "payment-complement",
      label: "Complemento Pago",
      detected: hasPayment,
      analyzed: hasPayment,
      skippedReason: hasPayment
        ? null
        : isRetenciones
          ? skipped("No aplica para XML de Retenciones")
          : skipped("Complemento no detectado"),
      findingsCount: countByPrefix("PAYMENT_") + countByPrefix("RELATED_DOCUMENT_"),
    },
    {
      key: "cfdi-relations",
      label: "CFDI Relacionados",
      detected: hasRelations,
      analyzed: hasRelations,
      skippedReason: hasRelations ? null : skipped("Complemento no detectado"),
      findingsCount:
        countByPrefix("CFDI_RELATION_") +
        countByPrefix("CFDI_RELATED_") +
        countByPrefix("CFDI_SELF_RELATION") +
        countByPrefix("EGRESO_WITHOUT_CFDI_RELACIONADOS") +
        countByPrefix("PAYMENT_WITH_CFDI_RELACIONADOS_REVIEW"),
    },
    {
      key: "carta-porte",
      label: "Carta Porte",
      detected: hasCartaPorte,
      analyzed: hasCartaPorte,
      skippedReason: hasCartaPorte ? null : skipped("Complemento no detectado"),
      findingsCount: countByPrefix("CARTA_PORTE_"),
    },
    {
      key: "nomina",
      label: "Nómina",
      detected: hasNomina,
      analyzed: hasNomina,
      skippedReason: hasNomina ? null : skipped("Complemento no detectado"),
      findingsCount: countByPrefix("NOMINA_") + countByPrefix("RECEPTOR_NOMINA_"),
    },
    {
      key: "comercio-exterior",
      label: "Comercio Exterior",
      detected: hasComercioExterior,
      analyzed: hasComercioExterior,
      skippedReason: hasComercioExterior ? null : skipped("Complemento no detectado"),
      findingsCount:
        countByPrefix("COMERCIO_EXTERIOR_") +
        countByPrefix("EXPORTACION_WITHOUT_COMERCIO_EXTERIOR"),
    },
    {
      key: "impuestos-locales",
      label: "Impuestos Locales",
      detected: hasImpuestosLocales,
      analyzed: hasImpuestosLocales,
      skippedReason: hasImpuestosLocales ? null : skipped("Complemento no detectado"),
      findingsCount: countByPrefix("IMPUESTOS_LOCALES_"),
    },
    {
      key: "leyendas-fiscales",
      label: "Leyendas Fiscales",
      detected: hasLeyendasFiscales,
      analyzed: hasLeyendasFiscales,
      skippedReason: hasLeyendasFiscales ? null : skipped("Complemento no detectado"),
      findingsCount: countByPrefix("LEYENDAS_FISCALES_") + countByPrefix("LEYENDA_FISCAL_"),
    },
    {
      key: "donatarias",
      label: "Donatarias",
      detected: hasDonatarias,
      analyzed: hasDonatarias,
      skippedReason: hasDonatarias ? null : skipped("Complemento no detectado"),
      findingsCount: countByPrefix("DONATARIAS_"),
    },
    {
      key: "addenda",
      label: "Addenda",
      detected: hasAddendaDetected,
      analyzed: hasAddendaDetected,
      skippedReason: hasAddendaDetected ? null : skipped("Complemento no detectado"),
      findingsCount: countByPrefix("ADDENDA_"),
    },
  ];

  const complementsDetected: string[] = [];
  if (hasTimbreFiscalDigital) complementsDetected.push("TimbreFiscalDigital");
  if (hasPayment) complementsDetected.push("Pagos");
  if (hasCartaPorte) complementsDetected.push("CartaPorte");
  if (hasNomina) complementsDetected.push("Nomina");
  if (hasComercioExterior) complementsDetected.push("ComercioExterior");
  if (hasImpuestosLocales) complementsDetected.push("ImpuestosLocales");
  if (hasLeyendasFiscales) complementsDetected.push("LeyendasFiscales");
  if (hasDonatarias) complementsDetected.push("Donatarias");
  if (hasAddendaDetected) complementsDetected.push("Addenda");
  if (hasRetenciones) complementsDetected.push("Retenciones");

  const complementsKnown = complementsDetected.filter((c) =>
    [
      "TimbreFiscalDigital",
      "Pagos",
      "CartaPorte",
      "Nomina",
      "ComercioExterior",
      "ImpuestosLocales",
      "LeyendasFiscales",
      "Donatarias",
      "Addenda",
      "Retenciones",
    ].includes(c),
  );

  const knownSet = new Set(complementsKnown);
  const complementsUnknown = complementsDetected.filter((c) => !knownSet.has(c));

  return {
    documentKind: docKind,
    modules,
    complementsDetected,
    complementsKnown,
    complementsUnknown,
    hasAddenda: hasAddendaDetected,
    hasTimbreFiscalDigital,
    hasSafeNormalization,
  };
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

import type { CryptoValidationSummary } from "./crypto/crypto-validation.types.js";

export interface AnalysisCoverageInfo {
  documentKind: "CFDI" | "RETENCIONES" | "UNKNOWN";
  modules: AnalysisCoverageModule[];
  complementsDetected: string[];
  complementsKnown: string[];
  complementsUnknown: string[];
  hasAddenda: boolean;
  hasTimbreFiscalDigital: boolean;
  hasSafeNormalization: boolean;
  xsdValidation?: XsdValidationSummary;
}

export interface AnalysisMetaInfo {
  generatedAt: string;
  engineVersion: string;
  performance: AnalysisPerformanceInfo;
  coverage: AnalysisCoverageInfo;
  xsdValidationSummary?: XsdValidationSummary;
  cryptoValidation?: CryptoValidationSummary;
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

export type DocumentKind = "CFDI" | "RETENCIONES" | "UNKNOWN";

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

export interface CfdiAnalysisResult {
  documentKind: DocumentKind;
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
  regimenFiscal?: string | null;
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
  nomina?: NominaInfo;
  comercioExterior?: ComercioExteriorInfo;
  impuestosLocales?: ImpuestosLocalesInfo;
  leyendasFiscales?: LeyendasFiscalesInfo;
  donatarias?: DonatariasInfo;
  retenciones?: RetencionesInfo;
  addenda?: AddendaInfo;
  structureDiagnostics: StructureDiagnostics;
  concepts?: ConceptInfo[] | null;
  totalsValidation?: TotalsValidation | null;
  taxSummary?: TaxSummary | null;
  globalTaxes?: GlobalTaxesInfo | null;
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

export interface AnalysisResponse {
  documentKind: DocumentKind;
  uuid: string | null;
  tipoComprobante: string | null;
  rfcEmisor: string | null;
  nombreEmisor: string | null;
  retenciones?: RetencionesInfo;
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
  findings: Finding[];
  technicalDiagnostics: TechnicalDiagnostics;
  executiveSummary: ExecutiveSummary;
  paymentComplement?: PaymentComplement | null;
  cfdiRelations?: CfdiRelations;
  cartaPorte?: CartaPorteInfo;
  nomina?: NominaInfo;
  comercioExterior?: ComercioExteriorInfo;
  impuestosLocales?: ImpuestosLocalesInfo;
  leyendasFiscales?: LeyendasFiscalesInfo;
  donatarias?: DonatariasInfo;
  addenda?: AddendaInfo;
  structureDiagnostics: StructureDiagnostics;
  concepts?: ConceptInfo[] | null;
  totalsValidation?: TotalsValidation | null;
  taxSummary?: TaxSummary | null;
  globalTaxes?: GlobalTaxesInfo | null;
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

function isNonEmptyString(value: string | null | undefined): value is string {
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

function normalizeText(value: string | null | undefined): string {
  if (!value) return "";
  return value.trim();
}

function truncateStr(value: string | null | undefined, maxLength: number): string {
  if (!value) return "—";
  const trimmed = value.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return trimmed.slice(0, maxLength) + "...";
}

function looksLikeAuthorizationNumber(value: string | null | undefined): boolean {
  if (!value) return false;
  const cleaned = value.trim();
  if (cleaned.length < 3 || cleaned.length > 30) return false;
  return /^[A-Za-z0-9][A-Za-z0-9\s\-/.]{1,28}[A-Za-z0-9]$/.test(cleaned);
}

function looksLikeRfc(value: string | null | undefined): boolean {
  if (!value) return false;
  const cleaned = value.trim().toUpperCase();
  return /^[A-ZÑ&]{3,4}\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])[A-Z0-9]{2,3}[0-9A-Z]$/.test(
    cleaned,
  );
}

function hasTimbreInNode(node: Record<string, unknown>): boolean {
  const complemento =
    (get(node, "cfdi:Complemento") as Record<string, unknown>) ??
    (get(node, "retenciones:Complemento") as Record<string, unknown>) ??
    (get(node, "Complemento") as Record<string, unknown>) ??
    {};
  const timbre =
    (get(complemento, "tfd:TimbreFiscalDigital") as Record<string, unknown>) ??
    (get(complemento, "TimbreFiscalDigital") as Record<string, unknown>) ??
    null;
  return timbre !== null && typeof timbre === "object" && Object.keys(timbre).length > 0;
}

function looksLikeCurp(value: string | null | undefined): boolean {
  if (!value) return false;
  return /^[A-Z][A-Z][A-Z][A-Z]\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])[HM](AS|BC|BS|CC|CL|CM|CS|CH|DF|DG|GT|GR|HG|JC|MC|MN|MS|NT|NL|OC|PL|QT|QR|SP|SL|SR|TC|TS|TL|VZ|YN|ZS|NE)\d{3}[A-Z0-9]\d$/.test(
    value.toUpperCase().trim(),
  );
}

function looksLikeNss(value: string | null | undefined): boolean {
  if (!value) return false;
  return /^\d{11}$/.test(value.trim());
}

function looksLikeBankAccount(value: string | null | undefined): boolean {
  if (!value) return false;
  return /^\d{10,18}$/.test(value.trim());
}

function isTipoComprobanteNominaCompatible(tipo: string | null | undefined): boolean {
  if (!tipo) return false;
  const t = tipo.toUpperCase().trim();
  return t === "N" || t === "NÓMINA" || t === "NOMINA" || t === "I" || t === "INGRESO";
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

function normalizeTaxCode(value: string | null | undefined): string {
  if (!value) return "";
  return value.trim();
}

function normalizeTipoFactor(value: string | null | undefined): string {
  if (!value) return "";
  const v = value.trim().toLowerCase();
  if (v === "tasa") return "Tasa";
  if (v === "cuota") return "Cuota";
  if (v === "exento") return "Exento";
  return value.trim();
}

function normalizeObjetoImp(value: string | null | undefined): string {
  if (!value) return "";
  return value.trim();
}

function normalizeRate(value: string | null | undefined): number | null {
  if (!value) return null;
  const n = parseFloat(value.trim());
  return isNaN(n) ? null : n;
}

function calculateTaxAmount(base: number, tasaOCuota: number): number {
  return Math.round(base * tasaOCuota * 100) / 100;
}

function hasConceptTaxes(concept: ConceptInfo): boolean {
  return !!(
    concept.impuestos &&
    (concept.impuestos.traslados.length > 0 || concept.impuestos.retenciones.length > 0)
  );
}

function getConceptTransferredTaxes(concept: ConceptInfo): ConceptTaxEntry[] {
  return concept.impuestos?.traslados ?? [];
}

function getConceptWithheldTaxes(concept: ConceptInfo): ConceptTaxEntry[] {
  return concept.impuestos?.retenciones ?? [];
}

function buildTaxGroupKey(
  impuesto?: string | null,
  tipoFactor?: string | null,
  tasaOCuota?: string | null,
): string {
  return `${normalizeTaxCode(impuesto)}|${normalizeTipoFactor(tipoFactor)}|${normalizeText(tasaOCuota)}`;
}

function sumConceptTaxesByGroup(
  concepts: ConceptInfo[],
  type: "TRANSFERRED" | "WITHHELD",
): Map<string, number> {
  const map = new Map<string, number>();
  for (const c of concepts) {
    if (!c.impuestos) continue;
    const entries = type === "TRANSFERRED" ? c.impuestos.traslados : c.impuestos.retenciones;
    for (const e of entries) {
      const key = buildTaxGroupKey(e.impuesto, e.tipoFactor, e.tasaOCuota);
      map.set(key, (map.get(key) ?? 0) + toMoneyNumber(e.importe));
    }
  }
  return map;
}

function sumGlobalTaxesByGroup(
  globalTaxes: GlobalTaxesInfo,
  type: "TRANSFERRED" | "WITHHELD",
): Map<string, number> {
  const map = new Map<string, number>();
  const entries = type === "TRANSFERRED" ? globalTaxes.transferred : globalTaxes.withheld;
  for (const e of entries) {
    const key = buildTaxGroupKey(e.impuesto, e.tipoFactor, e.tasaOCuota);
    map.set(key, (map.get(key) ?? 0) + toMoneyNumber(e.importe));
  }
  return map;
}

function hasAnyConceptTransferredTaxes(concepts: ConceptInfo[]): boolean {
  return concepts.some((c) => c.impuestos && c.impuestos.traslados.length > 0);
}

function hasAnyConceptWithheldTaxes(concepts: ConceptInfo[]): boolean {
  return concepts.some((c) => c.impuestos && c.impuestos.retenciones.length > 0);
}

function hasChildNode(parent: Record<string, unknown>, ...names: string[]): boolean {
  return names.some((n) => n in parent);
}

function isCartaPorteComplementName(name: string): boolean {
  const lower = name.toLowerCase();
  return (
    lower.includes("cartaporte") || lower.includes("carta porte") || lower.includes("carta_porte")
  );
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

function normalizePaymentMethod(value: string | null | undefined): string {
  if (!value) return "";
  return value.trim().toUpperCase();
}

function normalizePaymentForm(value: string | null | undefined): string {
  if (!value) return "";
  return value.trim();
}

function normalizeExportacion(value: string | null | undefined): string {
  if (!value) return "";
  return value.trim();
}

function looksLikePostalCode(value: string | null | undefined): boolean {
  if (!value) return false;
  return /^\d{5}$/.test(value.trim());
}

function isKnownCurrencyBasic(value: string | null | undefined): boolean {
  if (!value) return false;
  const key = value.trim().toUpperCase();
  return CFDI_MONEDAS_BASICAS[key] !== undefined;
}

function isFutureDateBeyondTolerance(date: Date, now: Date, toleranceMinutes: number): boolean {
  const toleranceMs = toleranceMinutes * 60 * 1000;
  return date.getTime() > now.getTime() + toleranceMs;
}

function extractGlobalTaxLines(
  impuestosNode: Record<string, unknown>,
  nodeName: string,
  singular: string,
  type: "TRANSFERRED" | "WITHHELD",
): GlobalTaxLine[] {
  const node =
    (get(impuestosNode, `cfdi:${nodeName}`) as Record<string, unknown>) ??
    (get(impuestosNode, nodeName) as Record<string, unknown>) ??
    {};
  const rawEntry = get(node, `cfdi:${singular}`) ?? get(node, singular);
  if (rawEntry === null || rawEntry === undefined) return [];
  const arr = Array.isArray(rawEntry) ? rawEntry : [rawEntry];
  return arr.map((e: Record<string, unknown>) => ({
    type,
    impuesto: str(get(e, "@_Impuesto")),
    tipoFactor: str(get(e, "@_TipoFactor")),
    tasaOCuota: str(get(e, "@_TasaOCuota")),
    base: str(get(e, "@_Base")),
    importe: str(get(e, "@_Importe")),
  }));
}

function strAttr(node: Record<string, unknown>, ...names: string[]): string | null {
  for (const name of names) {
    const val = str(get(node, `@_${name}`));
    if (isNonEmptyString(val)) return val;
  }
  return null;
}

function extractCceDomicilio(rawDom: Record<string, unknown> | null): CceDomicilio | null {
  if (!rawDom || typeof rawDom !== "object" || Object.keys(rawDom).length === 0) return null;
  return {
    calle: str(get(rawDom, "@_Calle")) ?? null,
    numeroExterior: str(get(rawDom, "@_NumeroExterior")) ?? null,
    numeroInterior: str(get(rawDom, "@_NumeroInterior")) ?? null,
    colonia: str(get(rawDom, "@_Colonia")) ?? null,
    localidad: str(get(rawDom, "@_Localidad")) ?? null,
    municipio: str(get(rawDom, "@_Municipio")) ?? null,
    estado: str(get(rawDom, "@_Estado")) ?? null,
    pais: str(get(rawDom, "@_Pais")) ?? null,
    codigoPostal: str(get(rawDom, "@_CodigoPostal")) ?? null,
  };
}

function extractGlobalTaxes(comprobante: Record<string, unknown>): GlobalTaxesInfo | null {
  const impuestosNode =
    (get(comprobante, "cfdi:Impuestos") as Record<string, unknown>) ??
    (get(comprobante, "Impuestos") as Record<string, unknown>) ??
    null;
  if (
    !impuestosNode ||
    typeof impuestosNode !== "object" ||
    Object.keys(impuestosNode).length === 0
  ) {
    return null;
  }
  const totalImpuestosTrasladados = str(get(impuestosNode, "@_TotalImpuestosTrasladados"));
  const totalImpuestosRetenidos = str(get(impuestosNode, "@_TotalImpuestosRetenidos"));
  const transferred = extractGlobalTaxLines(impuestosNode, "Traslados", "Traslado", "TRANSFERRED");
  const withheld = extractGlobalTaxLines(impuestosNode, "Retenciones", "Retencion", "WITHHELD");
  return { totalImpuestosTrasladados, totalImpuestosRetenidos, transferred, withheld };
}

const MAX_ADDENDA_DEPTH = 6;
const MAX_ADDENDA_SIGNALS = 50;
const MAX_ADDENDA_NODE_SUMMARY = 30;
const ADDENDA_VALUE_TRUNCATE = 120;

function normalizeAddendaKey(key: string): string {
  return key
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[_\-:.\s]+/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function classifyAddendaSignal(
  normalizedKey: string,
  path: string,
  value: string,
): { label: string; confidence: "HIGH" | "MEDIUM" | "LOW" } | null {
  const highKeywords: Record<string, string[]> = {
    PURCHASE_ORDER: [
      "ordencompra",
      "ordendecompra",
      "purchaseorder",
      "purchaseordernumber",
      "po",
      "ponumber",
      "pedido",
      "pedidoexterno",
      "numpedido",
      "numeropedido",
      "ordernumber",
    ],
    GOODS_RECEIPT: [
      "entradamercancia",
      "entrada",
      "recepcion",
      "receipt",
      "goodsreceipt",
      "gr",
      "grnumber",
      "remision",
      "deliverynote",
      "recepcionmercancia",
    ],
    VENDOR_ID: [
      "proveedor",
      "vendor",
      "supplier",
      "supplierid",
      "vendorid",
      "numeroproveedor",
      "numproveedor",
    ],
    CUSTOMER_ID: ["cliente", "customer", "customerid", "shipto", "soldto", "billto"],
    REFERENCE: [
      "referencia",
      "reference",
      "ref",
      "foliointerno",
      "documentref",
      "documentreference",
    ],
    COMPANY_CODE: ["sociedad", "companycode", "bukrs"],
    PLANT: ["centro", "plant", "werks", "site"],
  };
  for (const [label, keywords] of Object.entries(highKeywords)) {
    if (keywords.some((kw) => normalizedKey.includes(kw))) {
      return { label, confidence: "HIGH" };
    }
  }

  const mediumKeywords: Record<string, string[]> = {
    CONTRACT: ["contract", "contrato"],
    COST_CENTER: ["costcenter", "centrocosto"],
    SHIPMENT: ["route", "ruta", "shipment", "embarque", "delivery", "entrega"],
  };
  for (const [label, keywords] of Object.entries(mediumKeywords)) {
    if (keywords.some((kw) => normalizedKey.includes(kw))) {
      return { label, confidence: "MEDIUM" };
    }
  }

  if (/^(id|number|numero|folio|code|codigo)/.test(normalizedKey)) {
    return { label: "GENERIC_IDENTIFIER", confidence: "LOW" };
  }

  return null;
}

function extractAddendaInfo(addendaNode: Record<string, unknown>): AddendaInfo {
  const signals: AddendaSignal[] = [];
  const nodeSummary: AddendaNodeSummary[] = [];
  let nodeCount = 0;
  let maxDepth = 0;
  let truncated = false;

  function traverse(node: Record<string, unknown>, currentPath: string, depth: number): void {
    if (depth > MAX_ADDENDA_DEPTH) {
      truncated = true;
      return;
    }
    if (depth > maxDepth) maxDepth = depth;
    const keys = Object.keys(node);
    let childCount = 0;
    let scalarFields = 0;

    for (const key of keys) {
      if (key.startsWith("@_")) continue;
      const val = node[key];
      const childPath = currentPath ? `${currentPath}/${key}` : key;

      if (val === null || val === undefined) continue;

      if (typeof val === "object" && !Array.isArray(val)) {
        const childKeys = Object.keys(val as Record<string, unknown>).filter(
          (k) => !k.startsWith("@_"),
        );
        if (childKeys.length > 0) {
          childCount++;
          traverse(val as Record<string, unknown>, childPath, depth + 1);
          continue;
        }
      }

      // scalar value reached
      scalarFields++;

      if (signals.length >= MAX_ADDENDA_SIGNALS) {
        truncated = true;
        continue;
      }

      const strVal = typeof val === "string" ? val : String(val);
      if (!strVal || strVal.length === 0) continue;
      if (strVal === "true" || strVal === "false") {
        if (!/(?:id|number|numero|folio|code|codigo|ref)/i.test(key)) continue;
      }
      if (strVal.length > 200 && !/\s/.test(strVal.trim())) {
        // long string without spaces that might still be a key
      }

      const truncatedVal =
        strVal.length > ADDENDA_VALUE_TRUNCATE
          ? strVal.slice(0, ADDENDA_VALUE_TRUNCATE) + "..."
          : strVal;

      const normalizedKey = normalizeAddendaKey(key);
      const classification = classifyAddendaSignal(normalizedKey, childPath, truncatedVal);
      if (classification) {
        signals.push({
          key,
          label: classification.label,
          value: truncatedVal,
          path: childPath,
          confidence: classification.confidence,
        });
      }
    }

    if (currentPath) {
      nodeSummary.push({
        path: currentPath,
        name: currentPath.split("/").pop() ?? currentPath,
        childCount,
        scalarFields,
      });
    }
    nodeCount++;
  }

  const rootKeys = Object.keys(addendaNode).filter((k) => !k.startsWith("@_"));
  for (const rootKey of rootKeys) {
    const child = addendaNode[rootKey];
    if (child && typeof child === "object" && !Array.isArray(child)) {
      traverse(child as Record<string, unknown>, rootKey, 1);
    }
  }

  // Truncate summaries if needed
  const limitedSummary = nodeSummary.slice(0, MAX_ADDENDA_NODE_SUMMARY);
  if (nodeSummary.length > MAX_ADDENDA_NODE_SUMMARY) truncated = true;

  // Truncate signals if needed
  const limitedSignals = signals.slice(0, MAX_ADDENDA_SIGNALS);
  if (signals.length > MAX_ADDENDA_SIGNALS) truncated = true;

  return {
    detected: rootKeys.length > 0,
    rootKeys,
    nodeCount,
    maxDepth,
    signals: limitedSignals,
    nodeSummary: limitedSummary,
    truncated,
  };
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RFC_MORAL = /^[A-ZÑ&]{3}\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])[A-Z0-9]{3}$/i;
const RFC_FISICA = /^[A-ZÑ&]{4}\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])[A-Z0-9]{3}$/i;

import { validateComprobanteConsistency } from "./cfdi-consistency.helper.js";

export function analyzeCfdi(rawXml: string, originalFilename?: string): CfdiAnalysisResult {
  const startedAt = Date.now();
  const inputBytes = Buffer.byteLength(rawXml, "utf8");
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
    warnings.push(
      "Se detectó BOM UTF-8 al inicio del archivo. Se normalizó en memoria para lectura; no se modificó contenido fiscal.",
    );
  }
  if (leadingContentBeforeXml) {
    diag.leadingContentBeforeXml = true;
    warnings.push(
      "Se detectó contenido antes del inicio del XML. Se normalizó en memoria para lectura; validar origen del archivo.",
    );
  }
  diag.safeNormalizationApplied = safeNormalizationApplied;
  diag.safeNormalizationNotes = safeNormalizationNotes;

  const wellFormed = validateXmlWellFormedness(xmlContent);
  if (!wellFormed.isWellFormed) {
    throw Object.assign(
      new Error(wellFormed.message ?? "El XML no está bien formado"),
      { code: wellFormed.errorCode ?? "XML_MALFORMED", wellFormed },
    );
  }

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

  const comprobante =
    ((parsed as Record<string, unknown>)["cfdi:Comprobante"] as Record<string, unknown>) ?? {};

  const retencionesNode =
    ((parsed as Record<string, unknown>)["retenciones:Retenciones"] as Record<string, unknown>) ??
    ((parsed as Record<string, unknown>)["Retenciones"] as Record<string, unknown>) ??
    null;

  const isRetenciones =
    retencionesNode !== null &&
    typeof retencionesNode === "object" &&
    Object.keys(retencionesNode).length > 0;

  if (isRetenciones) {
    diag.hasTimbreFiscalDigital = hasTimbreInNode(retencionesNode);
    diag.isStamped = diag.hasTimbreFiscalDigital;
    return buildRetencionesResult(
      retencionesNode,
      rawXml,
      xmlContent,
      originalFilename,
      originalSha256,
      normalizedSha256,
      diag,
      safeNormalizationApplied,
      bomDetected,
      leadingContentBeforeXml,
      startedAt,
      inputBytes,
    );
  }

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
  const emisor = (get(comprobante, "cfdi:Emisor") as Record<string, unknown>) ?? {};
  const rfcEmisor = str(get(emisor, "@_Rfc"));
  const nombreEmisor = str(get(emisor, "@_Nombre"));
  const regimenFiscal = str(get(emisor, "@_RegimenFiscal"));

  // Receptor
  const receptor = (get(comprobante, "cfdi:Receptor") as Record<string, unknown>) ?? {};
  const rfcReceptor = str(get(receptor, "@_Rfc"));
  const nombreReceptor = str(get(receptor, "@_Nombre"));
  const usoCfdi = str(get(receptor, "@_UsoCFDI"));
  const regimenFiscalReceptor = str(get(receptor, "@_RegimenFiscalReceptor"));
  const domicilioFiscalReceptor = str(get(receptor, "@_DomicilioFiscalReceptor"));
  const lugarExpedicion = str(get(comprobante, "@_LugarExpedicion"));
  const exportacion = str(get(comprobante, "@_Exportacion"));
  const tipoCambio = str(get(comprobante, "@_TipoCambio"));
  const confirmacion = str(get(comprobante, "@_Confirmacion"));

  // Impuestos
  const impuestos = (get(comprobante, "cfdi:Impuestos") as Record<string, unknown>) ?? {};
  const totalTrasladadosVal = str(get(impuestos, "@_TotalImpuestosTrasladados"));
  const totalRetenidosVal = str(get(impuestos, "@_TotalImpuestosRetenidos"));

  // TimbreFiscalDigital (Complemento)
  let uuid: string | null = null;
  let fechaTimbrado: string | null = null;

  const complemento = (get(comprobante, "cfdi:Complemento") as Record<string, unknown>) ?? {};
  const timbre =
    (get(complemento, "tfd:TimbreFiscalDigital") as Record<string, unknown>) ??
    (get(complemento, "TimbreFiscalDigital") as Record<string, unknown>) ??
    {};

  const hasTimbreFiscalDigital =
    timbre !== null && typeof timbre === "object" && Object.keys(timbre).length > 0;
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

  const tipoLabel = getTipoComprobanteLabel(tipoComprobante) ?? tipoComprobante;

  // ── Structure Diagnostics ──
  const nodeShapeNotes: string[] = [];
  const complementNames: string[] = [];
  const knownComplements: string[] = [];
  const unknownComplements: string[] = [];

  const knownSet = new Set([
    "TimbreFiscalDigital",
    "Pagos",
    "ImpuestosLocales",
    "LeyendasFiscales",
    "Donatarias",
    "CartaPorte",
    "ComercioExterior",
    "Retenciones",
    "Nomina",
  ]);

  const hasComplemento =
    complemento !== null && typeof complemento === "object" && Object.keys(complemento).length > 0;

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
    if (
      complementoKeys.length === 1 &&
      typeof complemento[complementoKeys[0]] === "object" &&
      !Array.isArray(complemento[complementoKeys[0]])
    ) {
      nodeShapeNotes.push(`Complemento de tipo único: ${complementoKeys[0]}`);
    }
  }

  const addendaNode =
    (get(comprobante, "cfdi:Addenda") as Record<string, unknown>) ??
    (get(comprobante, "Addenda") as Record<string, unknown>) ??
    {};
  const hasAddenda =
    addendaNode !== null && typeof addendaNode === "object" && Object.keys(addendaNode).length > 0;
  const addendaDetected = hasAddenda;

  let addenda: AddendaInfo | undefined;
  if (addendaDetected && addendaNode) {
    addenda = extractAddendaInfo(addendaNode);
  }

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
    warnings.push(
      "El XML contiene Addenda. Se conservará como información adicional, pero no forma parte de la validación fiscal base.",
    );
  }

  if (unknownComplements.length > 0) {
    warnings.push(
      "El XML contiene complementos no clasificados por el motor actual; se recomienda revisión especializada si son relevantes para el proceso.",
    );
  }

  // ── Concept extraction ──
  let concepts: ConceptInfo[] | null = null;

  const rawConceptos =
    (get(comprobante, "cfdi:Conceptos") as Record<string, unknown>) ??
    (get(comprobante, "Conceptos") as Record<string, unknown>) ??
    {};

  const rawConcepto = get(rawConceptos, "cfdi:Concepto") ?? get(rawConceptos, "Concepto");

  if (rawConcepto !== null && rawConcepto !== undefined) {
    const conceptoArray = Array.isArray(rawConcepto) ? rawConcepto : [rawConcepto];

    if (conceptoArray.length === 1 && !Array.isArray(rawConcepto)) {
      nodeShapeNotes.push("Concepto de tipo único normalizado a arreglo");
    } else {
      nodeShapeNotes.push("Conceptos múltiples detectados");
    }

    const extractTaxEntries = (
      raw: unknown,
      prefix: string,
      nodeName: string,
      singular: string,
      pluralNotes: string,
    ): ConceptTaxEntry[] => {
      const node =
        (get(raw, `${prefix}${nodeName}`) as Record<string, unknown>) ??
        (get(raw, nodeName) as Record<string, unknown>) ??
        {};
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
      const rawImpuestos =
        (get(c, "cfdi:Impuestos") as Record<string, unknown>) ??
        (get(c, "Impuestos") as Record<string, unknown>) ??
        {};

      const traslados = extractTaxEntries(
        rawImpuestos,
        "cfdi:",
        "Traslados",
        "Traslado",
        "Traslados en concepto",
      );
      const retenciones = extractTaxEntries(
        rawImpuestos,
        "cfdi:",
        "Retenciones",
        "Retencion",
        "Retenciones en concepto",
      );

      const impuestos =
        traslados.length > 0 || retenciones.length > 0 ? { traslados, retenciones } : undefined;

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

  // ── Global taxes extraction ──
  const globalTaxes = extractGlobalTaxes(comprobante);

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
          warnings.push(
            "Un concepto marcado como objeto de impuesto sí objeto de impuesto no contiene impuestos.",
          );
        }
      }

      if (c.impuestos) {
        for (const t of c.impuestos.traslados) {
          if (!t.base) warnings.push("Un traslado de concepto no contiene base.");
          if (!t.impuesto) warnings.push("Un traslado de concepto no contiene impuesto.");
          if (!t.tipoFactor) warnings.push("Un traslado de concepto no contiene tipo factor.");
          if (t.tipoFactor !== "Exento" && !t.importe)
            warnings.push("Un traslado de concepto gravado no contiene importe.");
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
    const pagosNode =
      (get(complemento, "pago20:Pagos") as Record<string, unknown>) ??
      (get(complemento, "pagos:Pagos") as Record<string, unknown>) ??
      (get(complemento, "Pagos") as Record<string, unknown>) ??
      {};

    if (pagosNode && typeof pagosNode === "object" && Object.keys(pagosNode).length > 0) {
      const complementVersion = str(get(pagosNode, "@_Version"));
      const rawPagos =
        (get(pagosNode, "pago20:Pago") as unknown) ??
        (get(pagosNode, "pagos:Pago") as unknown) ??
        (get(pagosNode, "Pago") as unknown);

      const pagoArray = Array.isArray(rawPagos) ? rawPagos : rawPagos ? [rawPagos] : [];

      const pagos: PaymentInfo[] = pagoArray.map((p: Record<string, unknown>) => {
        const docsRaw =
          (get(p, "pago20:DoctoRelacionado") as unknown) ??
          (get(p, "pagos:DoctoRelacionado") as unknown) ??
          (get(p, "DoctoRelacionado") as unknown);
        const docsArray = Array.isArray(docsRaw) ? docsRaw : docsRaw ? [docsRaw] : [];

        const extractDrTaxEntries = (
          raw: unknown,
          prefix: string,
          nodeName: string,
          singular: string,
        ): PaymentDrTaxEntry[] => {
          const node =
            (get(raw, `${prefix}${nodeName}`) as Record<string, unknown>) ??
            (get(raw, nodeName) as Record<string, unknown>) ??
            {};
          const rawEntry = get(node, `${prefix}${singular}`) ?? get(node, singular);
          if (rawEntry === null || rawEntry === undefined) return [];
          const arr = Array.isArray(rawEntry) ? rawEntry : [rawEntry];
          return arr.map((e: Record<string, unknown>) => ({
            baseDR: str(get(e, "@_BaseDR")) ?? undefined,
            impuestoDR: str(get(e, "@_ImpuestoDR")) ?? undefined,
            tipoFactorDR: str(get(e, "@_TipoFactorDR")) ?? undefined,
            tasaOCuotaDR: str(get(e, "@_TasaOCuotaDR")) ?? undefined,
            importeDR: str(get(e, "@_ImporteDR")) ?? undefined,
          }));
        };

        const documentosRelacionados: PaymentDocument[] = docsArray.map(
          (d: Record<string, unknown>) => {
            const rawImpuestosDR =
              (get(d, "pago20:ImpuestosDR") as Record<string, unknown>) ??
              (get(d, "ImpuestosDR") as Record<string, unknown>) ??
              {};
            const trasladosDR = extractDrTaxEntries(
              rawImpuestosDR,
              "pago20:",
              "TrasladosDR",
              "TrasladoDR",
            );
            const retencionesDR = extractDrTaxEntries(
              rawImpuestosDR,
              "pago20:",
              "RetencionesDR",
              "RetencionDR",
            );
            const impuestosDR =
              trasladosDR.length > 0 || retencionesDR.length > 0
                ? { trasladosDR, retencionesDR }
                : undefined;

            return {
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
              impuestosDR,
            };
          },
        );

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

      const rawTotales =
        (get(pagosNode, "pago20:Totales") as Record<string, unknown>) ??
        (get(pagosNode, "Totales") as Record<string, unknown>) ??
        null;
      let totales: PaymentTotalesInfo | undefined;
      if (rawTotales && typeof rawTotales === "object" && Object.keys(rawTotales).length > 0) {
        totales = {
          montoTotalPagos: str(get(rawTotales, "@_MontoTotalPagos")) ?? undefined,
          totalTrasladosBaseIVA16: str(get(rawTotales, "@_TotalTrasladosBaseIVA16")) ?? undefined,
          totalTrasladosImpuestoIVA16:
            str(get(rawTotales, "@_TotalTrasladosImpuestoIVA16")) ?? undefined,
          totalTrasladosBaseIVA8: str(get(rawTotales, "@_TotalTrasladosBaseIVA8")) ?? undefined,
          totalTrasladosImpuestoIVA8:
            str(get(rawTotales, "@_TotalTrasladosImpuestoIVA8")) ?? undefined,
          totalTrasladosBaseIVA0: str(get(rawTotales, "@_TotalTrasladosBaseIVA0")) ?? undefined,
          totalTrasladosImpuestoIVA0:
            str(get(rawTotales, "@_TotalTrasladosImpuestoIVA0")) ?? undefined,
          totalTrasladosBaseIVAExento:
            str(get(rawTotales, "@_TotalTrasladosBaseIVAExento")) ?? undefined,
          totalRetencionesIVA: str(get(rawTotales, "@_TotalRetencionesIVA")) ?? undefined,
          totalRetencionesISR: str(get(rawTotales, "@_TotalRetencionesISR")) ?? undefined,
          totalRetencionesIEPS: str(get(rawTotales, "@_TotalRetencionesIEPS")) ?? undefined,
        };
      }

      paymentComplement = {
        version: complementVersion ?? undefined,
        pagos,
        totales,
      };

      const hasRelatedDocs = pagos.some((p) => p.documentosRelacionados.length > 0);
      if (!hasRelatedDocs) {
        warnings.push("El complemento de pago no contiene documentos relacionados.");
      }
    } else {
      warnings.push("El comprobante es tipo Pago, pero no se detectó complemento de pagos.");
    }

    if (moneda !== "XXX") {
      warnings.push(
        "En comprobantes tipo Pago, la moneda del comprobante normalmente debe ser XXX.",
      );
    }
  }

  // ── CFDI Relacionados ──
  let cfdiRelations: CfdiRelations | undefined;

  const rawRelationGroups =
    (get(comprobante, "cfdi:CfdiRelacionados") as unknown) ??
    (get(comprobante, "CfdiRelacionados") as unknown);

  if (rawRelationGroups) {
    const groupArray = Array.isArray(rawRelationGroups) ? rawRelationGroups : [rawRelationGroups];

    const groups: CfdiRelationGroup[] = [];

    for (const group of groupArray) {
      if (!group || typeof group !== "object") continue;

      const tipoRelacion = str(get(group, "@_TipoRelacion")) ?? null;
      const rawRelated =
        (get(group, "cfdi:CfdiRelacionado") as unknown) ??
        (get(group, "CfdiRelacionado") as unknown);

      const relatedArray = Array.isArray(rawRelated) ? rawRelated : rawRelated ? [rawRelated] : [];

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

  const cartaPorteNode =
    (get(complemento, "cartaporte31:CartaPorte") as Record<string, unknown>) ??
    (get(complemento, "cartaporte30:CartaPorte") as Record<string, unknown>) ??
    (get(complemento, "cartaporte20:CartaPorte") as Record<string, unknown>) ??
    (get(complemento, "CartaPorte") as Record<string, unknown>) ??
    null;

  if (
    cartaPorteNode &&
    typeof cartaPorteNode === "object" &&
    Object.keys(cartaPorteNode).length > 0
  ) {
    const version = str(get(cartaPorteNode, "@_Version")) ?? null;
    const idCCP = str(get(cartaPorteNode, "@_IdCCP")) ?? null;
    const transpInternac = str(get(cartaPorteNode, "@_TranspInternac")) ?? null;
    const totalDistRec = str(get(cartaPorteNode, "@_TotalDistRec")) ?? null;
    const entradaSalidaMerc = str(get(cartaPorteNode, "@_EntradaSalidaMerc")) ?? null;
    const paisOrigenDestino = str(get(cartaPorteNode, "@_PaisOrigenDestino")) ?? null;
    const viaEntradaSalida = str(get(cartaPorteNode, "@_ViaEntradaSalida")) ?? null;

    // Ubicaciones
    const rawUbics =
      (get(cartaPorteNode, "cartaporte31:Ubicaciones") as Record<string, unknown>) ??
      (get(cartaPorteNode, "cartaporte30:Ubicaciones") as Record<string, unknown>) ??
      (get(cartaPorteNode, "cartaporte20:Ubicaciones") as Record<string, unknown>) ??
      (get(cartaPorteNode, "Ubicaciones") as Record<string, unknown>) ??
      null;

    let ubicacionesNodes: unknown[] = [];
    if (rawUbics && typeof rawUbics === "object") {
      const rawUbi =
        (get(rawUbics, "cartaporte31:Ubicacion") as unknown) ??
        (get(rawUbics, "cartaporte30:Ubicacion") as unknown) ??
        (get(rawUbics, "cartaporte20:Ubicacion") as unknown) ??
        (get(rawUbics, "Ubicacion") as unknown);
      ubicacionesNodes = Array.isArray(rawUbi) ? rawUbi : rawUbi ? [rawUbi] : [];
    }

    const ubicaciones: CartaPorteUbicacion[] = (ubicacionesNodes as Record<string, unknown>[]).map(
      (u) => {
        const rawDomicilio =
          (get(u, "cartaporte31:Domicilio") as Record<string, unknown>) ??
          (get(u, "cartaporte30:Domicilio") as Record<string, unknown>) ??
          (get(u, "cartaporte20:Domicilio") as Record<string, unknown>) ??
          (get(u, "Domicilio") as Record<string, unknown>) ??
          null;
        const domicilio: CartaPorteDomicilio | null =
          rawDomicilio && typeof rawDomicilio === "object" && Object.keys(rawDomicilio).length > 0
            ? {
                codigoPostal: str(get(rawDomicilio, "@_CodigoPostal")) ?? null,
                estado: str(get(rawDomicilio, "@_Estado")) ?? null,
                pais: str(get(rawDomicilio, "@_Pais")) ?? null,
                municipio: str(get(rawDomicilio, "@_Municipio")) ?? null,
                localidad: str(get(rawDomicilio, "@_Localidad")) ?? null,
                colonia: str(get(rawDomicilio, "@_Colonia")) ?? null,
              }
            : null;
        return {
          tipoUbicacion: str(get(u, "@_TipoUbicacion")) ?? null,
          idUbicacion: str(get(u, "@_IDUbicacion")) ?? null,
          rfcRemitenteDestinatario: str(get(u, "@_RFCRemitenteDestinatario")) ?? null,
          nombreRemitenteDestinatario: str(get(u, "@_NombreRemitenteDestinatario")) ?? null,
          fechaHoraSalidaLlegada: str(get(u, "@_FechaHoraSalidaLlegada")) ?? null,
          distanciaRecorrida: str(get(u, "@_DistanciaRecorrida")) ?? null,
          domicilio,
        };
      },
    );

    // Mercancias
    const rawMercs =
      (get(cartaPorteNode, "cartaporte31:Mercancias") as Record<string, unknown>) ??
      (get(cartaPorteNode, "cartaporte30:Mercancias") as Record<string, unknown>) ??
      (get(cartaPorteNode, "cartaporte20:Mercancias") as Record<string, unknown>) ??
      (get(cartaPorteNode, "Mercancias") as Record<string, unknown>) ??
      null;

    let mercanciasNodes: unknown[] = [];
    let numTotalMercancias: string | null = null;
    let pesoBrutoTotal: string | null = null;
    let unidadPeso: string | null = null;
    if (rawMercs && typeof rawMercs === "object") {
      numTotalMercancias = str(get(rawMercs, "@_NumTotalMercancias")) ?? null;
      pesoBrutoTotal = str(get(rawMercs, "@_PesoBrutoTotal")) ?? null;
      unidadPeso = str(get(rawMercs, "@_UnidadPeso")) ?? null;
      const rawMer =
        (get(rawMercs, "cartaporte31:Mercancia") as unknown) ??
        (get(rawMercs, "cartaporte30:Mercancia") as unknown) ??
        (get(rawMercs, "cartaporte20:Mercancia") as unknown) ??
        (get(rawMercs, "Mercancia") as unknown);
      mercanciasNodes = Array.isArray(rawMer) ? rawMer : rawMer ? [rawMer] : [];
    }

    const mercancias: CartaPorteMercancia[] = (mercanciasNodes as Record<string, unknown>[]).map(
      (m) => ({
        bienesTransp: str(get(m, "@_BienesTransp")) ?? null,
        descripcion: str(get(m, "@_Descripcion")) ?? null,
        cantidad: str(get(m, "@_Cantidad")) ?? null,
        claveUnidad: str(get(m, "@_ClaveUnidad")) ?? null,
        pesoEnKg: str(get(m, "@_PesoEnKg")) ?? null,
        valorMercancia: str(get(m, "@_ValorMercancia")) ?? null,
        moneda: str(get(m, "@_Moneda")) ?? null,
        materialPeligroso: str(get(m, "@_MaterialPeligroso")) ?? null,
        cveMaterialPeligroso: str(get(m, "@_CveMaterialPeligroso")) ?? null,
        embalaje: str(get(m, "@_Embalaje")) ?? null,
      }),
    );

    // Figuras Transporte
    const rawFigs =
      (get(cartaPorteNode, "cartaporte31:FiguraTransporte") as Record<string, unknown>) ??
      (get(cartaPorteNode, "cartaporte30:FiguraTransporte") as Record<string, unknown>) ??
      (get(cartaPorteNode, "cartaporte20:FiguraTransporte") as Record<string, unknown>) ??
      (get(cartaPorteNode, "FiguraTransporte") as Record<string, unknown>) ??
      null;

    const figurasNodes: unknown[] = [];
    if (rawFigs && typeof rawFigs === "object") {
      const rawTiposFig =
        (get(rawFigs, "cartaporte31:TiposFigura") as unknown) ??
        (get(rawFigs, "cartaporte30:TiposFigura") as unknown) ??
        (get(rawFigs, "cartaporte20:TiposFigura") as unknown) ??
        (get(rawFigs, "TiposFigura") as unknown);
      const tiposFigArray = Array.isArray(rawTiposFig)
        ? rawTiposFig
        : rawTiposFig
          ? [rawTiposFig]
          : [];
      tiposFigArray.forEach((tf: Record<string, unknown>) => {
        const rawFig =
          (get(tf, "cartaporte31:PartesTransporte") as unknown) ??
          (get(tf, "cartaporte30:PartesTransporte") as unknown) ??
          (get(tf, "cartaporte20:PartesTransporte") as unknown) ??
          (get(tf, "PartesTransporte") as unknown);
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

    const figurasTransporte: CartaPorteTransportFigure[] = (
      figurasNodes as Record<string, unknown>[]
    ).map((f) => ({
      tipoFigura: str(get(f, "tipoFigura")) ?? null,
      rfcFigura: str(get(f, "rfcFigura")) ?? null,
      nombreFigura: str(get(f, "nombreFigura")) ?? null,
      numLicencia: str(get(f, "numLicencia")) ?? null,
    }));

    // Detect and extract medio transporte
    const hasAutotransporte = hasChildNode(
      cartaPorteNode,
      "cartaporte31:Autotransporte",
      "cartaporte30:Autotransporte",
      "cartaporte20:Autotransporte",
      "Autotransporte",
    );
    let autotransporte: CartaPorteAutotransporteInfo | null = null;
    if (hasAutotransporte) {
      const autoNode =
        (get(cartaPorteNode, "cartaporte31:Autotransporte") as Record<string, unknown>) ??
        (get(cartaPorteNode, "cartaporte30:Autotransporte") as Record<string, unknown>) ??
        (get(cartaPorteNode, "cartaporte20:Autotransporte") as Record<string, unknown>) ??
        (get(cartaPorteNode, "Autotransporte") as Record<string, unknown>) ??
        null;
      if (autoNode && typeof autoNode === "object") {
        const idVehicular =
          (get(autoNode, "cartaporte31:IdentificacionVehicular") as Record<string, unknown>) ??
          (get(autoNode, "cartaporte30:IdentificacionVehicular") as Record<string, unknown>) ??
          (get(autoNode, "cartaporte20:IdentificacionVehicular") as Record<string, unknown>) ??
          (get(autoNode, "IdentificacionVehicular") as Record<string, unknown>) ??
          null;
        const seguros =
          (get(autoNode, "cartaporte31:Seguros") as Record<string, unknown>) ??
          (get(autoNode, "cartaporte30:Seguros") as Record<string, unknown>) ??
          (get(autoNode, "cartaporte20:Seguros") as Record<string, unknown>) ??
          (get(autoNode, "Seguros") as Record<string, unknown>) ??
          null;
        autotransporte = {
          permSCT: str(get(autoNode, "@_PermSCT")) ?? null,
          numPermisoSCT: str(get(autoNode, "@_NumPermisoSCT")) ?? null,
          identificacionVehicular:
            idVehicular && typeof idVehicular === "object" && Object.keys(idVehicular).length > 0
              ? {
                  configVehicular: str(get(idVehicular, "@_ConfigVehicular")) ?? null,
                  placaVM: str(get(idVehicular, "@_PlacaVM")) ?? null,
                  anioModeloVM: str(get(idVehicular, "@_AnioModeloVM")) ?? null,
                }
              : null,
          seguros:
            seguros && typeof seguros === "object" && Object.keys(seguros).length > 0
              ? {
                  aseguraRespCivil: str(get(seguros, "@_AseguraRespCivil")) ?? null,
                  polizaRespCivil: str(get(seguros, "@_PolizaRespCivil")) ?? null,
                }
              : null,
        };
      }
    }
    const hasTransporteMaritimo = hasChildNode(
      cartaPorteNode,
      "cartaporte31:TransporteMaritimo",
      "cartaporte30:TransporteMaritimo",
      "cartaporte20:TransporteMaritimo",
      "TransporteMaritimo",
    );
    const hasTransporteAereo = hasChildNode(
      cartaPorteNode,
      "cartaporte31:TransporteAereo",
      "cartaporte30:TransporteAereo",
      "cartaporte20:TransporteAereo",
      "TransporteAereo",
    );
    const hasTransporteFerroviario = hasChildNode(
      cartaPorteNode,
      "cartaporte31:TransporteFerroviario",
      "cartaporte30:TransporteFerroviario",
      "cartaporte20:TransporteFerroviario",
      "TransporteFerroviario",
    );

    cartaPorte = {
      version,
      idCCP,
      transpInternac,
      totalDistRec,
      entradaSalidaMerc,
      paisOrigenDestino,
      viaEntradaSalida,
      numTotalMercancias,
      pesoBrutoTotal,
      unidadPeso,
      hasUbicaciones: ubicaciones.length > 0,
      hasMercancias: mercancias.length > 0,
      ubicaciones,
      mercancias,
      figurasTransporte,
      hasAutotransporte,
      autotransporte,
      hasTransporteMaritimo,
      hasTransporteAereo,
      hasTransporteFerroviario,
    };
  }

  // ── Nomina 1.2 extraction ──
  let nomina: NominaInfo | undefined;

  const nominaNode =
    (get(complemento, "nomina12:Nomina") as Record<string, unknown>) ??
    (get(complemento, "Nomina") as Record<string, unknown>) ??
    null;

  if (nominaNode && typeof nominaNode === "object" && Object.keys(nominaNode).length > 0) {
    const nominaVersion = str(get(nominaNode, "@_Version")) ?? null;
    const tipoNomina = str(get(nominaNode, "@_TipoNomina")) ?? null;
    const fechaPago = str(get(nominaNode, "@_FechaPago")) ?? null;
    const fechaInicialPago = str(get(nominaNode, "@_FechaInicialPago")) ?? null;
    const fechaFinalPago = str(get(nominaNode, "@_FechaFinalPago")) ?? null;
    const numDiasPagados = str(get(nominaNode, "@_NumDiasPagados")) ?? null;
    const totalPercepciones = str(get(nominaNode, "@_TotalPercepciones")) ?? null;
    const totalDeducciones = str(get(nominaNode, "@_TotalDeducciones")) ?? null;
    const totalOtrosPagos = str(get(nominaNode, "@_TotalOtrosPagos")) ?? null;

    // Receptor node
    const nominaReceptor =
      (get(nominaNode, "nomina12:Receptor") as Record<string, unknown>) ??
      (get(nominaNode, "Receptor") as Record<string, unknown>) ??
      {};

    const receptor: NominaReceptorInfo = {
      curp: str(get(nominaReceptor, "@_CURP")) ?? null,
      numSeguridadSocial: str(get(nominaReceptor, "@_NumSeguridadSocial")) ?? null,
      fechaInicioRelLaboral: str(get(nominaReceptor, "@_FechaInicioRelLaboral")) ?? null,
      antiguedad: str(get(nominaReceptor, "@_Antiguedad")) ?? null,
      tipoContrato: str(get(nominaReceptor, "@_TipoContrato")) ?? null,
      sindicalizado: str(get(nominaReceptor, "@_Sindicalizado")) ?? null,
      tipoJornada: str(get(nominaReceptor, "@_TipoJornada")) ?? null,
      tipoRegimen: str(get(nominaReceptor, "@_TipoRegimen")) ?? null,
      numEmpleado: str(get(nominaReceptor, "@_NumEmpleado")) ?? null,
      departamento: str(get(nominaReceptor, "@_Departamento")) ?? null,
      puesto: str(get(nominaReceptor, "@_Puesto")) ?? null,
      riesgoPuesto: str(get(nominaReceptor, "@_RiesgoPuesto")) ?? null,
      periodicidadPago: str(get(nominaReceptor, "@_PeriodicidadPago")) ?? null,
      banco: str(get(nominaReceptor, "@_Banco")) ?? null,
      cuentaBancaria: str(get(nominaReceptor, "@_CuentaBancaria")) ?? null,
      salarioBaseCotApor: str(get(nominaReceptor, "@_SalarioBaseCotApor")) ?? null,
      salarioDiarioIntegrado: str(get(nominaReceptor, "@_SalarioDiarioIntegrado")) ?? null,
      claveEntFed: str(get(nominaReceptor, "@_ClaveEntFed")) ?? null,
    };

    // Percepciones
    const percepciones: NominaPercepcionInfo[] = [];
    let percepcionesHeader: NominaPercepcionesHeader | undefined;
    const rawPercepcionesNode =
      (get(nominaNode, "nomina12:Percepciones") as Record<string, unknown>) ??
      (get(nominaNode, "Percepciones") as Record<string, unknown>) ??
      {};
    if (rawPercepcionesNode && typeof rawPercepcionesNode === "object") {
      const rawPercHeaderTotalSueldos = str(get(rawPercepcionesNode, "@_TotalSueldos"));
      const rawPercHeaderTotalSep = str(get(rawPercepcionesNode, "@_TotalSeparacionIndemnizacion"));
      const rawPercHeaderTotalJub = str(get(rawPercepcionesNode, "@_TotalJubilacionPensionRetiro"));
      const rawPercHeaderTotalGravado = str(get(rawPercepcionesNode, "@_TotalGravado"));
      const rawPercHeaderTotalExento = str(get(rawPercepcionesNode, "@_TotalExento"));
      if (
        rawPercHeaderTotalSueldos ||
        rawPercHeaderTotalSep ||
        rawPercHeaderTotalJub ||
        rawPercHeaderTotalGravado ||
        rawPercHeaderTotalExento
      ) {
        percepcionesHeader = {
          totalSueldos: rawPercHeaderTotalSueldos ?? null,
          totalSeparacionIndemnizacion: rawPercHeaderTotalSep ?? null,
          totalJubilacionPensionRetiro: rawPercHeaderTotalJub ?? null,
          totalGravado: rawPercHeaderTotalGravado ?? null,
          totalExento: rawPercHeaderTotalExento ?? null,
        };
      }
      const rawPerc =
        (get(rawPercepcionesNode, "nomina12:Percepcion") as unknown) ??
        (get(rawPercepcionesNode, "Percepcion") as unknown);
      const percArray = Array.isArray(rawPerc) ? rawPerc : rawPerc ? [rawPerc] : [];
      percepciones.push(
        ...percArray.map((p: Record<string, unknown>) => ({
          tipoPercepcion: str(get(p, "@_TipoPercepcion")) ?? null,
          clave: str(get(p, "@_Clave")) ?? null,
          concepto: str(get(p, "@_Concepto")) ?? null,
          importeGravado: str(get(p, "@_ImporteGravado")) ?? null,
          importeExento: str(get(p, "@_ImporteExento")) ?? null,
        })),
      );
    }

    // Deducciones
    const deducciones: NominaDeduccionInfo[] = [];
    let deduccionesHeader: NominaDeduccionesHeader | undefined;
    const rawDeduccionesNode =
      (get(nominaNode, "nomina12:Deducciones") as Record<string, unknown>) ??
      (get(nominaNode, "Deducciones") as Record<string, unknown>) ??
      {};
    if (rawDeduccionesNode && typeof rawDeduccionesNode === "object") {
      const rawDedHeaderOtras = str(get(rawDeduccionesNode, "@_TotalOtrasDeducciones"));
      const rawDedHeaderIsr = str(get(rawDeduccionesNode, "@_TotalImpuestosRetenidos"));
      if (rawDedHeaderOtras || rawDedHeaderIsr) {
        deduccionesHeader = {
          totalOtrasDeducciones: rawDedHeaderOtras ?? null,
          totalImpuestosRetenidos: rawDedHeaderIsr ?? null,
        };
      }
      const rawDed =
        (get(rawDeduccionesNode, "nomina12:Deduccion") as unknown) ??
        (get(rawDeduccionesNode, "Deduccion") as unknown);
      const dedArray = Array.isArray(rawDed) ? rawDed : rawDed ? [rawDed] : [];
      deducciones.push(
        ...dedArray.map((d: Record<string, unknown>) => ({
          tipoDeduccion: str(get(d, "@_TipoDeduccion")) ?? null,
          clave: str(get(d, "@_Clave")) ?? null,
          concepto: str(get(d, "@_Concepto")) ?? null,
          importe: str(get(d, "@_Importe")) ?? null,
        })),
      );
    }

    // OtrosPagos
    const otrosPagos: NominaOtroPagoInfo[] = [];
    const rawOtrosPagosNode =
      (get(nominaNode, "nomina12:OtrosPagos") as Record<string, unknown>) ??
      (get(nominaNode, "OtrosPagos") as Record<string, unknown>) ??
      {};
    if (rawOtrosPagosNode && typeof rawOtrosPagosNode === "object") {
      const rawOP =
        (get(rawOtrosPagosNode, "nomina12:OtroPago") as unknown) ??
        (get(rawOtrosPagosNode, "OtroPago") as unknown);
      const opArray = Array.isArray(rawOP) ? rawOP : rawOP ? [rawOP] : [];
      otrosPagos.push(
        ...opArray.map((o: Record<string, unknown>) => {
          const subsidioNode =
            (get(o, "nomina12:SubsidioAlEmpleo") as Record<string, unknown>) ??
            (get(o, "SubsidioAlEmpleo") as Record<string, unknown>) ??
            null;
          let subsidioAlEmpleo: { subsidioCausado?: string | null } | null = null;
          if (
            subsidioNode &&
            typeof subsidioNode === "object" &&
            Object.keys(subsidioNode).length > 0
          ) {
            subsidioAlEmpleo = {
              subsidioCausado: str(get(subsidioNode, "@_SubsidioCausado")) ?? null,
            };
          }
          return {
            tipoOtroPago: str(get(o, "@_TipoOtroPago")) ?? null,
            clave: str(get(o, "@_Clave")) ?? null,
            concepto: str(get(o, "@_Concepto")) ?? null,
            importe: str(get(o, "@_Importe")) ?? null,
            subsidioAlEmpleo,
          };
        }),
      );
    }

    nomina = {
      version: nominaVersion,
      tipoNomina,
      fechaPago,
      fechaInicialPago,
      fechaFinalPago,
      numDiasPagados,
      totalPercepciones,
      totalDeducciones,
      totalOtrosPagos,
      receptor,
      percepcionesHeader: percepcionesHeader ?? null,
      deduccionesHeader: deduccionesHeader ?? null,
      percepciones,
      deducciones,
      otrosPagos,
    };
  }

  // ── Comercio Exterior 1.1 extraction ──
  let comercioExterior: ComercioExteriorInfo | undefined;

  const comercioExteriorNode =
    (get(complemento, "cce11:ComercioExterior") as Record<string, unknown>) ??
    (get(complemento, "ComercioExterior") as Record<string, unknown>) ??
    null;

  if (
    comercioExteriorNode &&
    typeof comercioExteriorNode === "object" &&
    Object.keys(comercioExteriorNode).length > 0
  ) {
    // ── Emisor dentro de CCE ──
    const rawCceEmisor =
      (get(comercioExteriorNode, "cce11:Emisor") as Record<string, unknown>) ??
      (get(comercioExteriorNode, "Emisor") as Record<string, unknown>) ??
      null;
    let cceEmisor: CceEmisor | null = null;
    if (rawCceEmisor && typeof rawCceEmisor === "object") {
      const rawDom =
        (get(rawCceEmisor, "cce11:Domicilio") as Record<string, unknown>) ??
        (get(rawCceEmisor, "Domicilio") as Record<string, unknown>) ??
        null;
      cceEmisor = {
        curp: str(get(rawCceEmisor, "@_CURP")) ?? null,
        domicilio: extractCceDomicilio(rawDom),
      };
    }

    // ── Receptor dentro de CCE ──
    const rawCceReceptor =
      (get(comercioExteriorNode, "cce11:Receptor") as Record<string, unknown>) ??
      (get(comercioExteriorNode, "Receptor") as Record<string, unknown>) ??
      null;
    let cceReceptor: CceReceptor | null = null;
    if (rawCceReceptor && typeof rawCceReceptor === "object") {
      const rawDom =
        (get(rawCceReceptor, "cce11:Domicilio") as Record<string, unknown>) ??
        (get(rawCceReceptor, "Domicilio") as Record<string, unknown>) ??
        null;
      cceReceptor = {
        numRegIdTrib: str(get(rawCceReceptor, "@_NumRegIdTrib")) ?? null,
        residenciaFiscal: str(get(rawCceReceptor, "@_ResidenciaFiscal")) ?? null,
        domicilio: extractCceDomicilio(rawDom),
      };
    }

    // ── Destinatarios ──
    const rawDestinatarios =
      (get(comercioExteriorNode, "cce11:Destinatario") as unknown) ??
      (get(comercioExteriorNode, "Destinatario") as unknown) ??
      null;
    const destinatariosArr: unknown[] = rawDestinatarios
      ? Array.isArray(rawDestinatarios)
        ? rawDestinatarios
        : [rawDestinatarios]
      : [];
    const destinatarios: CceDestinatario[] = (destinatariosArr as Record<string, unknown>[]).map(
      (d) => {
        const rawDom =
          (get(d, "cce11:Domicilio") as Record<string, unknown>) ??
          (get(d, "Domicilio") as Record<string, unknown>) ??
          null;
        return {
          numRegIdTrib: str(get(d, "@_NumRegIdTrib")) ?? null,
          nombre: str(get(d, "@_Nombre")) ?? null,
          domicilio: extractCceDomicilio(rawDom),
        };
      },
    );

    // ── Mercancias ──
    const rawMercsNode =
      (get(comercioExteriorNode, "cce11:Mercancias") as Record<string, unknown>) ??
      (get(comercioExteriorNode, "Mercancias") as Record<string, unknown>) ??
      null;
    let mercanciasNodes: unknown[] = [];
    if (rawMercsNode && typeof rawMercsNode === "object") {
      const rawMer =
        (get(rawMercsNode, "cce11:Mercancia") as unknown) ??
        (get(rawMercsNode, "Mercancia") as unknown);
      mercanciasNodes = Array.isArray(rawMer) ? rawMer : rawMer ? [rawMer] : [];
    }
    const mercancias: CceMercancia[] = (mercanciasNodes as Record<string, unknown>[]).map((m) => ({
      noIdentificacion: str(get(m, "@_NoIdentificacion")) ?? null,
      fraccionArancelaria: str(get(m, "@_FraccionArancelaria")) ?? null,
      cantidadAduana: str(get(m, "@_CantidadAduana")) ?? null,
      unidadAduana: str(get(m, "@_UnidadAduana")) ?? null,
      valorUnitarioAduana: str(get(m, "@_ValorUnitarioAduana")) ?? null,
      valorDolares: str(get(m, "@_ValorDolares")) ?? null,
      marca: str(get(m, "@_Marca")) ?? null,
      modelo: str(get(m, "@_Modelo")) ?? null,
      subModelo: str(get(m, "@_SubModelo")) ?? null,
      numeroSerie: str(get(m, "@_NumeroSerie")) ?? null,
      descripcionesEspecificas: str(get(m, "@_DescripcionesEspecificas")) ?? null,
    }));

    comercioExterior = {
      version: str(get(comercioExteriorNode, "@_Version")) ?? null,
      tipoOperacion: str(get(comercioExteriorNode, "@_TipoOperacion")) ?? null,
      claveDePedimento: str(get(comercioExteriorNode, "@_ClaveDePedimento")) ?? null,
      certificadoOrigen: str(get(comercioExteriorNode, "@_CertificadoOrigen")) ?? null,
      numCertificadoOrigen: str(get(comercioExteriorNode, "@_NumCertificadoOrigen")) ?? null,
      numeroExportadorConfiable:
        str(get(comercioExteriorNode, "@_NumeroExportadorConfiable")) ?? null,
      incoterm: str(get(comercioExteriorNode, "@_Incoterm")) ?? null,
      subDivision: str(get(comercioExteriorNode, "@_SubDivision")) ?? null,
      observaciones: str(get(comercioExteriorNode, "@_Observaciones")) ?? null,
      tipoCambioUSD: str(get(comercioExteriorNode, "@_TipoCambioUSD")) ?? null,
      totalUSD: str(get(comercioExteriorNode, "@_TotalUSD")) ?? null,
      motivoTraslado: str(get(comercioExteriorNode, "@_MotivoTraslado")) ?? null,
      emisor: cceEmisor,
      receptor: cceReceptor,
      destinatarios,
      mercancias,
    };
  }

  // ── Impuestos Locales 1.0 extraction ──
  let impuestosLocales: ImpuestosLocalesInfo | undefined;

  const impuestosLocalesNode =
    (get(complemento, "implocal:ImpuestosLocales") as Record<string, unknown>) ??
    (get(complemento, "ImpuestosLocales") as Record<string, unknown>) ??
    null;

  if (
    impuestosLocalesNode &&
    typeof impuestosLocalesNode === "object" &&
    Object.keys(impuestosLocalesNode).length > 0
  ) {
    const ilVersion = strAttr(impuestosLocalesNode, "Version");
    const ilTotalRetenciones = strAttr(
      impuestosLocalesNode,
      "TotaldeRetenciones",
      "TotalDeRetenciones",
    );
    const ilTotalTraslados = strAttr(impuestosLocalesNode, "TotaldeTraslados", "TotalDeTraslados");

    // RetencionesLocales
    const rawRetencionesNode =
      (get(impuestosLocalesNode, "implocal:RetencionesLocales") as Record<string, unknown>) ??
      (get(impuestosLocalesNode, "RetencionesLocales") as Record<string, unknown>) ??
      null;
    let retencionesRaw: unknown[] = [];
    if (rawRetencionesNode && typeof rawRetencionesNode === "object") {
      const rawRet =
        (get(rawRetencionesNode, "implocal:RetencionLocal") as unknown) ??
        (get(rawRetencionesNode, "RetencionLocal") as unknown);
      retencionesRaw = Array.isArray(rawRet) ? rawRet : rawRet ? [rawRet] : [];
    }

    const retenciones: ImpuestoLocalRetencionInfo[] = (
      retencionesRaw as Record<string, unknown>[]
    ).map((r) => ({
      impLocRetenido: str(get(r, "@_ImpLocRetenido")) ?? null,
      tasaDeRetencion: strAttr(r, "TasadeRetencion", "TasaDeRetencion"),
      importe: str(get(r, "@_Importe")) ?? null,
    }));

    // TrasladosLocales
    const rawTrasladosNode =
      (get(impuestosLocalesNode, "implocal:TrasladosLocales") as Record<string, unknown>) ??
      (get(impuestosLocalesNode, "TrasladosLocales") as Record<string, unknown>) ??
      null;
    let trasladosRaw: unknown[] = [];
    if (rawTrasladosNode && typeof rawTrasladosNode === "object") {
      const rawTr =
        (get(rawTrasladosNode, "implocal:TrasladoLocal") as unknown) ??
        (get(rawTrasladosNode, "TrasladoLocal") as unknown);
      trasladosRaw = Array.isArray(rawTr) ? rawTr : rawTr ? [rawTr] : [];
    }

    const traslados: ImpuestoLocalTrasladoInfo[] = (trasladosRaw as Record<string, unknown>[]).map(
      (t) => ({
        impLocTrasladado: str(get(t, "@_ImpLocTrasladado")) ?? null,
        tasaDeTraslado: strAttr(t, "TasadeTraslado", "TasaDeTraslado"),
        importe: str(get(t, "@_Importe")) ?? null,
      }),
    );

    impuestosLocales = {
      version: ilVersion,
      totalDeRetenciones: ilTotalRetenciones,
      totalDeTraslados: ilTotalTraslados,
      retenciones,
      traslados,
    };
  }

  // ── Leyendas Fiscales extraction ──
  let leyendasFiscales: LeyendasFiscalesInfo | undefined;

  const leyendasFiscalesNode =
    (get(complemento, "leyendasFisc:LeyendasFiscales") as Record<string, unknown>) ??
    (get(complemento, "LeyendasFiscales") as Record<string, unknown>) ??
    null;

  if (
    leyendasFiscalesNode &&
    typeof leyendasFiscalesNode === "object" &&
    Object.keys(leyendasFiscalesNode).length > 0
  ) {
    const lfVersion = strAttr(leyendasFiscalesNode, "Version");
    const rawLeyenda =
      (get(leyendasFiscalesNode, "leyendasFisc:Leyenda") as unknown) ??
      (get(leyendasFiscalesNode, "Leyenda") as unknown);
    const leyendasRaw = Array.isArray(rawLeyenda) ? rawLeyenda : rawLeyenda ? [rawLeyenda] : [];

    const leyendas: LeyendaFiscalInfo[] = (leyendasRaw as Record<string, unknown>[]).map((l) => ({
      disposicionFiscal: str(get(l, "@_DisposicionFiscal")) ?? null,
      norma: str(get(l, "@_Norma")) ?? null,
      textoLeyenda: str(get(l, "@_TextoLeyenda")) ?? null,
    }));

    leyendasFiscales = {
      version: lfVersion,
      leyendas,
    };
  }

  // ── Donatarias extraction ──
  let donatarias: DonatariasInfo | undefined;

  const donatariasNode =
    (get(complemento, "donat:Donatarias") as Record<string, unknown>) ??
    (get(complemento, "Donatarias") as Record<string, unknown>) ??
    null;

  if (
    donatariasNode &&
    typeof donatariasNode === "object" &&
    Object.keys(donatariasNode).length > 0
  ) {
    donatarias = {
      version: strAttr(donatariasNode, "Version"),
      noAutorizacion: strAttr(donatariasNode, "NoAutorizacion"),
      fechaAutorizacion: strAttr(donatariasNode, "FechaAutorizacion"),
      leyenda: strAttr(donatariasNode, "Leyenda"),
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

    const totalCalculated = roundMoney(
      subtotalCalculated -
        discountCalculated +
        transferredTaxesCalculated -
        retainedTaxesCalculated,
    );
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
      issues.push(
        "El total global no coincide con conceptos + impuestos - descuentos - retenciones.",
      );
    }

    if (trasladadosNum > 0 && Math.abs(transferredTaxesCalculated - trasladadosNum) > 0.01) {
      warnings.push(
        "El total de impuestos trasladados global no coincide con la suma de traslados por concepto.",
      );
    }

    if (retenidosNum > 0 && Math.abs(retainedTaxesCalculated - retenidosNum) > 0.01) {
      warnings.push(
        "El total de impuestos retenidos global no coincide con la suma de retenciones por concepto.",
      );
    }
  }

  // ── Tax Summary ──

  function groupTaxEntries(entries: ConceptTaxEntry[]): TaxSummaryEntry[] {
    const map = new Map<
      string,
      {
        base: number;
        importe: number;
        impuesto: string;
        tipoFactor: string | undefined;
        tasaOCuota: string | undefined;
      }
    >();

    for (const e of entries) {
      const impuesto = e.impuesto ?? "SIN_IMPUESTO";
      const grupo = `${impuesto}|${e.tipoFactor ?? ""}|${e.tasaOCuota ?? ""}`;

      if (!map.has(grupo)) {
        map.set(grupo, {
          base: 0,
          importe: 0,
          impuesto,
          tipoFactor: e.tipoFactor,
          tasaOCuota: e.tasaOCuota,
        });
      }
      const g = map.get(grupo)!;
      g.base += toNum(e.base) ?? 0;
      g.importe += toNum(e.importe) ?? 0;
    }

    const result: TaxSummaryEntry[] = [];
    for (const [, g] of map) {
      result.push({
        impuesto: g.impuesto,
        impuestoLabel: getImpuestoLabel(g.impuesto) ?? `Impuesto ${g.impuesto}`,
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
      if (t.impuesto && !isKnownImpuesto(t.impuesto)) {
        warnings.push("Se detectó un impuesto no clasificado por el catálogo base del motor.");
        break;
      }
    }

    for (const r of allRetenciones) {
      if (r.impuesto && !isKnownImpuesto(r.impuesto)) {
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
      if (
        t.impuesto === "002" &&
        t.tipoFactor === "Tasa" &&
        t.tasaOCuota &&
        !["0.160000", "0.080000", "0.000000"].includes(t.tasaOCuota)
      ) {
        warnings.push(
          "Se detectó una tasa de IVA no común; revisar si corresponde al caso fiscal.",
        );
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
        if (
          r.impuesto === "001" &&
          toNum(r.importe) &&
          toNum(r.base) &&
          toNum(r.importe)! > toNum(r.base)!
        ) {
          warnings.push("Una retención ISR tiene importe mayor que su base.");
          break;
        }
        if (
          r.impuesto === "002" &&
          toNum(r.importe) &&
          toNum(r.base) &&
          toNum(r.importe)! > toNum(r.base)!
        ) {
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
            lastBaseRateMismatch = {
              base: e.base ?? "",
              tasaOCuota: e.tasaOCuota ?? "",
              importe: e.importe ?? "",
            };
            break;
          }
        }
      }
    }
  }

  // ── Warnings ──
  if (moneda === "XXX" && tipoComprobante !== "P") {
    warnings.push(
      "La moneda del comprobante es 'XXX' (sin moneda), inusual en comprobantes que no son de pago",
    );
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

  // ── Consistency Validation ──
  validateComprobanteConsistency({
    tipoComprobante,
    metodoPago,
    formaPago,
    moneda,
    exportacion,
    usoCfdi,
    receptorRegimenFiscal: regimenFiscalReceptor,
    receptorRfc: rfcReceptor,
    concepts: concepts || [],
    paymentComplement: null,
    cfdiRelations: null,
    globalTaxes: null,
    subtotal,
    total,
    hasComercioExterior: !!comercioExterior,
    addFinding: (code, severity, title, message, recommendedAction, evidence) => {
      addFindingOnce({
        code,
        severity,
        title,
        message,
        recommendedAction,
        evidence,
        category: "FISCAL",
        priority: "LOW",
        actionGroup: "Validar datos fiscales",
      });
    },
  });

  if (diag.bomDetected) {
    addFindingOnce({
      severity: "INFO",
      category: "TECHNICAL",
      code: "BOM_UTF8_DETECTED",
      title: "BOM UTF-8 detectado",
      message:
        "El archivo contiene BOM UTF-8 al inicio. Se normalizó en memoria para lectura sin modificar contenido fiscal.",
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
      recommendedAction:
        "Verifica que el archivo provenga de una fuente confiable o descarga una copia limpia del SAT.",
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
      message:
        "El CFDI no contiene TimbreFiscalDigital; podría no estar timbrado ni válido ante el SAT.",
      recommendedAction: "Solicita al emisor el XML timbrado o verifica en el portal del SAT.",
    });
  }

  if (unknownComplements.length > 0) {
    addFindingOnce({
      severity: "WARNING",
      category: "STRUCTURE",
      code: "UNKNOWN_COMPLEMENT",
      title: "Complemento desconocido detectado",
      message: `Se encontraron complementos no reconocidos por el motor base: ${unknownComplements.join(", ")}.`,
      recommendedAction:
        "Verifica si el complemento es válido fiscalmente o requiere un módulo adicional.",
    });
  }

  if (totalsValidation && !totalsValidation.matches) {
    addFindingOnce({
      severity: "CRITICAL",
      category: "TOTALS",
      code: "TOTAL_MISMATCH",
      title: "Total global inconsistente",
      message: "El total global no coincide con conceptos, impuestos, descuentos y retenciones.",
      recommendedAction:
        "Solicita al emisor revisar el CFDI o valida si corresponde una corrección antes de usarlo fiscalmente.",
      evidence: [
        { label: "Total XML", value: totalsValidation.totalXml },
        { label: "Total calculado", value: totalsValidation.totalCalculated },
        { label: "Diferencia", value: totalsValidation.difference },
        { label: "Tolerancia", value: totalsValidation.tolerance },
      ],
    });
  }

  // ── Map issues to findings ──

  if (issues.some((i) => i.includes("El subtotal global no coincide"))) {
    addFindingOnce({
      severity: "CRITICAL",
      category: "TOTALS",
      code: "SUBTOTAL_MISMATCH",
      title: "Subtotal global inconsistente",
      message: "El subtotal global no coincide con la suma de importes de conceptos.",
      recommendedAction:
        "Verifica que cada concepto tenga el importe correcto y que el subtotal esté declarado correctamente en el CFDI.",
      evidence: [
        { label: "Subtotal XML", value: totalsValidation?.subtotalXml },
        { label: "Subtotal calculado", value: totalsValidation?.subtotalCalculated },
      ],
    });
  }

  if (issues.some((i) => i.includes("El total no coincide con subtotal + impuestos"))) {
    addFindingOnce({
      severity: "CRITICAL",
      category: "TOTALS",
      code: "ARITHMETIC_TOTAL_MISMATCH",
      title: "Total aritmético inconsistente",
      message:
        "El total del comprobante no coincide con la operación resta de subtotal, descuento, impuestos y retenciones.",
      recommendedAction:
        "Revisa los valores de subtotal, descuentos, traslados y retenciones declarados en el XML.",
    });
  }

  if (issues.some((i) => i.includes("No se encontró la versión del CFDI"))) {
    addFindingOnce({
      severity: "CRITICAL",
      category: "TECHNICAL",
      code: "MISSING_VERSION",
      title: "Versión del CFDI faltante",
      message: "No se encontró la versión del CFDI en el comprobante.",
      recommendedAction:
        "Verifica que el XML sea un CFDI válido emitido por un proveedor autorizado.",
    });
  }

  if (issues.some((i) => i.includes("No se encontró el UUID"))) {
    addFindingOnce({
      severity: "CRITICAL",
      category: "TECHNICAL",
      code: "MISSING_UUID",
      title: "UUID del timbre faltante",
      message: "No se encontró el UUID en el TimbreFiscalDigital.",
      recommendedAction:
        "El comprobante no cuenta con un UUID válido; solicita el XML timbrado al emisor.",
    });
  }

  if (issues.some((i) => i.includes("No se encontró el RFC del emisor"))) {
    addFindingOnce({
      severity: "CRITICAL",
      category: "FISCAL",
      code: "MISSING_RFC_EMISOR",
      title: "RFC del emisor faltante",
      message: "No se encontró el RFC del emisor en el comprobante.",
      recommendedAction: "El RFC del emisor es obligatorio; solicita un CFDI válido al proveedor.",
    });
  }

  if (issues.some((i) => i.includes("No se encontró el RFC del receptor"))) {
    addFindingOnce({
      severity: "CRITICAL",
      category: "FISCAL",
      code: "MISSING_RFC_RECEPTOR",
      title: "RFC del receptor faltante",
      message: "No se encontró el RFC del receptor en el comprobante.",
      recommendedAction:
        "El RFC del receptor es obligatorio; verifica que el CFDI incluya tus datos fiscales.",
    });
  }

  if (issues.some((i) => i.includes("El comprobante no contiene conceptos"))) {
    addFindingOnce({
      severity: "CRITICAL",
      category: "FISCAL",
      code: "MISSING_CONCEPTS",
      title: "Conceptos fiscales faltantes",
      message: "El comprobante no contiene conceptos. Sin conceptos no hay base fiscal en el CFDI.",
      recommendedAction: "Solicita al emisor un CFDI que incluya al menos un concepto.",
    });
  }

  if (issues.some((i) => i.includes("No se encontró el total"))) {
    addFindingOnce({
      severity: "CRITICAL",
      category: "FISCAL",
      code: "MISSING_TOTAL",
      title: "Total del comprobante faltante",
      message: "No se encontró el total del comprobante.",
      recommendedAction: "El total es obligatorio; verifica que el XML esté completo.",
    });
  }

  if (issues.some((i) => i.includes("No se encontró el subtotal"))) {
    addFindingOnce({
      severity: "CRITICAL",
      category: "FISCAL",
      code: "MISSING_SUBTOTAL",
      title: "Subtotal del comprobante faltante",
      message: "No se encontró el subtotal del comprobante.",
      recommendedAction: "El subtotal es obligatorio; verifica que el XML esté completo.",
    });
  }

  if (issues.some((i) => i.includes("No se encontró el tipo de comprobante"))) {
    addFindingOnce({
      severity: "CRITICAL",
      category: "FISCAL",
      code: "MISSING_TIPO_COMPROBANTE",
      title: "Tipo de comprobante faltante",
      message: "No se encontró el TipoDeComprobante en el CFDI.",
      recommendedAction:
        "El tipo de comprobante es obligatorio; verifica que el XML esté completo.",
    });
  }

  if (issues.some((i) => i.includes("No se encontró la fecha"))) {
    addFindingOnce({
      severity: "CRITICAL",
      category: "FISCAL",
      code: "MISSING_FECHA",
      title: "Fecha del comprobante faltante",
      message: "No se encontró la fecha del comprobante.",
      recommendedAction: "La fecha es obligatoria; verifica que el XML esté completo.",
    });
  }

  if (issues.some((i) => i.includes("No se encontró la moneda"))) {
    addFindingOnce({
      severity: "CRITICAL",
      category: "FISCAL",
      code: "MISSING_MONEDA",
      title: "Moneda del comprobante faltante",
      message: "No se encontró la moneda en el comprobante.",
      recommendedAction: "La moneda es obligatoria; verifica que el XML esté completo.",
    });
  }

  if (issues.some((i) => i.includes("El subtotal no puede ser negativo"))) {
    addFindingOnce({
      severity: "CRITICAL",
      category: "FISCAL",
      code: "SUBTOTAL_NEGATIVE",
      title: "Subtotal negativo",
      message: "El subtotal del comprobante es negativo, lo cual no es válido.",
      recommendedAction:
        "Revisa el origen del CFDI; un subtotal negativo puede indicar un error en la emisión.",
    });
  }

  if (issues.some((i) => i.includes("El total debe ser mayor a 0"))) {
    addFindingOnce({
      severity: "CRITICAL",
      category: "FISCAL",
      code: "TOTAL_NON_POSITIVE",
      title: "Total no positivo en ingreso/egreso",
      message: "El total debe ser mayor a 0 en comprobantes de ingreso o egreso.",
      recommendedAction: "Verifica que el CFDI tenga un valor fiscal válido.",
    });
  }

  if (issues.some((i) => i.includes("CFDI 4.0: No se encontró el nombre del emisor"))) {
    addFindingOnce({
      severity: "CRITICAL",
      category: "FISCAL",
      code: "CFDI40_MISSING_EMISOR_NAME",
      title: "Nombre del emisor faltante (CFDI 4.0)",
      message: "En CFDI 4.0 el nombre del emisor es obligatorio y no se encontró.",
      recommendedAction:
        "Solicita al emisor que el CFDI incluya su nombre completo o razón social.",
    });
  }

  if (issues.some((i) => i.includes("CFDI 4.0: No se encontró el nombre del receptor"))) {
    addFindingOnce({
      severity: "CRITICAL",
      category: "FISCAL",
      code: "CFDI40_MISSING_RECEPTOR_NAME",
      title: "Nombre del receptor faltante (CFDI 4.0)",
      message: "En CFDI 4.0 el nombre del receptor es obligatorio y no se encontró.",
      recommendedAction: "Verifica que el CFDI incluya tu nombre o razón fiscal.",
    });
  }

  if (issues.some((i) => i.includes("CFDI 4.0: No se encontró el uso del CFDI"))) {
    addFindingOnce({
      severity: "CRITICAL",
      category: "FISCAL",
      code: "CFDI40_MISSING_USO_CFDI",
      title: "Uso del CFDI faltante (CFDI 4.0)",
      message: "En CFDI 4.0 el UsoCFDI del receptor es obligatorio y no se encontró.",
      recommendedAction: "Asegúrate de proporcionar tu uso de CFDI correcto al emisor.",
    });
  }

  if (issues.some((i) => i.includes("No se encontró el régimen fiscal del receptor"))) {
    addFindingOnce({
      severity: "CRITICAL",
      category: "FISCAL",
      code: "CFDI40_MISSING_REGIMEN_RECEPTOR",
      title: "Régimen fiscal del receptor faltante (CFDI 4.0)",
      message: "En CFDI 4.0 el régimen fiscal del receptor es obligatorio y no se encontró.",
      recommendedAction:
        "Verifica que tu régimen fiscal esté correctamente registrado con el emisor.",
    });
  }

  if (issues.some((i) => i.includes("No se encontró el domicilio fiscal del receptor"))) {
    addFindingOnce({
      severity: "CRITICAL",
      category: "FISCAL",
      code: "CFDI40_MISSING_DOMICILIO_RECEPTOR",
      title: "Domicilio fiscal del receptor faltante (CFDI 4.0)",
      message: "En CFDI 4.0 el DomicilioFiscalReceptor es obligatorio y no se encontró.",
      recommendedAction:
        "Verifica que tu domicilio fiscal esté correctamente registrado con el emisor.",
    });
  }

  // ── Map warnings to findings ──

  if (warnings.some((w) => w.includes("Versión de CFDI no estándar"))) {
    addFindingOnce({
      severity: "WARNING",
      category: "TECHNICAL",
      code: "UNSUPPORTED_CFDI_VERSION",
      title: "Versión de CFDI no estándar",
      message: "La versión del CFDI no es 3.3 ni 4.0.",
      recommendedAction: "Verifica que el comprobante use una versión de CFDI aceptada por el SAT.",
    });
  }

  if (warnings.some((w) => w.includes("El total de impuestos trasladados global no coincide"))) {
    addFindingOnce({
      severity: "WARNING",
      category: "TAX",
      code: "TRANSFERRED_TAXES_MISMATCH",
      title: "Impuestos trasladados globales inconsistentes",
      message:
        "El total de impuestos trasladados global no coincide con la suma de traslados por concepto.",
      recommendedAction:
        "Revisa cada concepto para confirmar que los traslados de IVA/IEPS estén correctamente desglosados.",
      evidence: [
        { label: "Trasladados XML", value: totalsValidation?.transferredTaxesXml },
        { label: "Trasladados calculados", value: totalsValidation?.transferredTaxesCalculated },
      ],
    });
  }

  if (warnings.some((w) => w.includes("El total de impuestos retenidos global no coincide"))) {
    addFindingOnce({
      severity: "WARNING",
      category: "TAX",
      code: "RETAINED_TAXES_MISMATCH",
      title: "Impuestos retenidos globales inconsistentes",
      message:
        "El total de impuestos retenidos global no coincide con la suma de retenciones por concepto.",
      recommendedAction:
        "Revisa cada concepto para confirmar que las retenciones estén correctamente desglosadas.",
      evidence: [
        { label: "Retenidos XML", value: totalsValidation?.retainedTaxesXml },
        { label: "Retenidos calculados", value: totalsValidation?.retainedTaxesCalculated },
      ],
    });
  }

  if (warnings.some((w) => w.includes("Se detectó una tasa de IVA no común"))) {
    addFindingOnce({
      severity: "WARNING",
      category: "TAX",
      code: "UNCOMMON_VAT_RATE",
      title: "Tasa de IVA no común",
      message:
        "Se detectó una tasa de IVA fuera de las tasas comunes configuradas en el motor base.",
      recommendedAction: "Verifica que la tasa corresponda al supuesto fiscal aplicable.",
      evidence: [
        { label: "Impuesto", value: "IVA (002)" },
        { label: "Tasa detectada", value: lastUncommonVatRate },
        { label: "Tasas comunes", value: "0.160000, 0.080000, 0.000000" },
      ],
    });
  }

  if (warnings.some((w) => w.includes("El importe de un impuesto no coincide con base por tasa"))) {
    const baseNum = toNum(lastBaseRateMismatch?.base);
    const tasaNum = toNum(lastBaseRateMismatch?.tasaOCuota);
    addFindingOnce({
      severity: "WARNING",
      category: "TAX",
      code: "TAX_BASE_RATE_MISMATCH",
      title: "Importe fiscal no coincide con base por tasa",
      message: "El importe de un impuesto no coincide con el resultado de base por tasa/cuota.",
      recommendedAction:
        "Revisa que los valores de base, tasa y el importe trasladado o retenido sean fiscalmente correctos.",
      evidence: [
        { label: "Base", value: lastBaseRateMismatch?.base },
        { label: "Tasa", value: lastBaseRateMismatch?.tasaOCuota },
        { label: "Importe XML", value: lastBaseRateMismatch?.importe },
        {
          label: "Importe esperado",
          value: baseNum !== null && tasaNum !== null ? formatMoney(baseNum * tasaNum) : undefined,
        },
      ],
    });
  }

  if (warnings.some((w) => w.includes("Un concepto no contiene ClaveProdServ"))) {
    addFindingOnce({
      severity: "WARNING",
      category: "FISCAL",
      code: "CONCEPT_MISSING_CLAVE_PROD_SERV",
      title: "Concepto sin ClaveProdServ",
      message: "Un concepto del CFDI no contiene clave de producto o servicio.",
      recommendedAction:
        "La clave de producto o servicio es importante para la clasificación fiscal; solicita al emisor incluirla.",
    });
  }

  if (warnings.some((w) => w.includes("Un concepto no contiene cantidad"))) {
    addFindingOnce({
      severity: "WARNING",
      category: "FISCAL",
      code: "CONCEPT_MISSING_CANTIDAD",
      title: "Concepto sin cantidad",
      message: "Un concepto del CFDI no tiene cantidad especificada.",
      recommendedAction:
        "La cantidad permite verificar la integridad del cálculo fiscal; solicítala al emisor.",
    });
  }

  if (warnings.some((w) => w.includes("Un concepto no contiene descripción"))) {
    addFindingOnce({
      severity: "WARNING",
      category: "FISCAL",
      code: "CONCEPT_MISSING_DESCRIPCION",
      title: "Concepto sin descripción",
      message: "Un concepto del CFDI no tiene descripción del bien o servicio.",
      recommendedAction:
        "La descripción es necesaria para identificar el producto o servicio; solicítala al emisor.",
    });
  }

  if (warnings.some((w) => w.includes("Un concepto no contiene ObjetoImp"))) {
    addFindingOnce({
      severity: "WARNING",
      category: "FISCAL",
      code: "CONCEPT_MISSING_OBJETO_IMP",
      title: "Concepto sin ObjetoImp (CFDI 4.0)",
      message: "Un concepto en CFDI 4.0 no contiene el campo ObjetoImp.",
      recommendedAction:
        "ObjetoImp es obligatorio en CFDI 4.0; solicita al emisor corregir el CFDI.",
    });
  }

  if (
    warnings.some((w) =>
      w.includes(
        "Un concepto marcado como objeto de impuesto sí objeto de impuesto no contiene impuestos",
      ),
    )
  ) {
    addFindingOnce({
      severity: "WARNING",
      category: "TAX",
      code: "CONCEPT_OBJETO_IMP_NO_TAX",
      title: "Concepto marcado como objeto de impuesto sin impuestos",
      message:
        "Un concepto con ObjetoImp=02 (sí objeto de impuesto) no contiene traslados ni retenciones.",
      recommendedAction:
        "Verifica que el concepto deba estar exento o solicita al emisor corregir los impuestos.",
    });
  }

  if (warnings.some((w) => w.includes("Un traslado de concepto no contiene base"))) {
    addFindingOnce({
      severity: "WARNING",
      category: "TAX",
      code: "TRASLADO_MISSING_BASE",
      title: "Traslado sin base",
      message: "Un traslado de impuesto en un concepto no tiene base especificada.",
      recommendedAction:
        "La base es necesaria para calcular el impuesto; solicita al emisor corregir el CFDI.",
    });
  }

  if (warnings.some((w) => w.includes("Un traslado de concepto no contiene impuesto"))) {
    addFindingOnce({
      severity: "WARNING",
      category: "TAX",
      code: "TRASLADO_MISSING_IMPUESTO",
      title: "Traslado sin tipo de impuesto",
      message: "Un traslado de concepto no especifica el tipo de impuesto (IVA/IEPS).",
      recommendedAction: "El tipo de impuesto es obligatorio; solicita al emisor corregir el CFDI.",
    });
  }

  if (warnings.some((w) => w.includes("Un traslado de concepto no contiene tipo factor"))) {
    addFindingOnce({
      severity: "WARNING",
      category: "TAX",
      code: "TRASLADO_MISSING_TIPO_FACTOR",
      title: "Traslado sin tipo factor",
      message: "Un traslado de concepto no contiene el tipo factor (Tasa/Cuota/Exento).",
      recommendedAction: "El tipo factor es obligatorio; solicita al emisor corregir el CFDI.",
    });
  }

  if (warnings.some((w) => w.includes("Un traslado de concepto gravado no contiene importe"))) {
    addFindingOnce({
      severity: "WARNING",
      category: "TAX",
      code: "TRASLADO_MISSING_IMPORTE",
      title: "Traslado gravado sin importe",
      message: "Un traslado de concepto con tipo factor distinto de Exento no contiene importe.",
      recommendedAction:
        "El importe del traslado es obligatorio para impuestos gravados; solicita al emisor corregir el CFDI.",
    });
  }

  if (warnings.some((w) => w.includes("Una retención de concepto no contiene base"))) {
    addFindingOnce({
      severity: "WARNING",
      category: "TAX",
      code: "RETENCION_MISSING_BASE",
      title: "Retención sin base",
      message: "Una retención de concepto no tiene base especificada.",
      recommendedAction:
        "La base es necesaria para calcular la retención; solicita al emisor corregir el CFDI.",
    });
  }

  if (warnings.some((w) => w.includes("Una retención de concepto no contiene impuesto"))) {
    addFindingOnce({
      severity: "WARNING",
      category: "TAX",
      code: "RETENCION_MISSING_IMPUESTO",
      title: "Retención sin tipo de impuesto",
      message: "Una retención de concepto no especifica el tipo de impuesto (ISR/IVA).",
      recommendedAction: "El tipo de impuesto es obligatorio; solicita al emisor corregir el CFDI.",
    });
  }

  if (warnings.some((w) => w.includes("Una retención de concepto no contiene importe"))) {
    addFindingOnce({
      severity: "WARNING",
      category: "TAX",
      code: "RETENCION_MISSING_IMPORTE",
      title: "Retención sin importe",
      message: "Una retención de concepto no tiene importe especificado.",
      recommendedAction:
        "El importe de la retención es obligatorio; solicita al emisor corregir el CFDI.",
    });
  }

  if (warnings.some((w) => w.includes("No se especificó el método de pago"))) {
    addFindingOnce({
      severity: "WARNING",
      category: "FISCAL",
      code: "MISSING_METODO_PAGO",
      title: "Método de pago no especificado",
      message: "El método de pago (MetodoPago) no fue especificado en el comprobante.",
      recommendedAction: "Se recomienda especificar el método de pago para mayor claridad fiscal.",
    });
  }

  if (warnings.some((w) => w.includes("No se especificó la forma de pago"))) {
    addFindingOnce({
      severity: "WARNING",
      category: "FISCAL",
      code: "MISSING_FORMA_PAGO",
      title: "Forma de pago no especificada",
      message: "La forma de pago (FormaPago) no fue especificada en el comprobante.",
      recommendedAction: "Se recomienda especificar la forma de pago para mayor claridad fiscal.",
    });
  }

  if (
    warnings.some((w) => w.includes("El complemento de pago no contiene documentos relacionados"))
  ) {
    addFindingOnce({
      severity: "WARNING",
      category: "COMPLEMENT",
      code: "PAGO_MISSING_DOCUMENTOS",
      title: "Complemento de pago sin documentos relacionados",
      message: "El complemento de pago no contiene documentos relacionados.",
      recommendedAction:
        "En comprobantes de pago los documentos relacionados son esperados; verifica el origen.",
    });
  }

  if (
    warnings.some((w) =>
      w.includes("El comprobante es tipo Pago, pero no se detectó complemento de pagos"),
    )
  ) {
    addFindingOnce({
      severity: "WARNING",
      category: "COMPLEMENT",
      code: "PAGO_MISSING_COMPLEMENT",
      title: "Complemento de pagos faltante en tipo Pago",
      message: "El comprobante es tipo Pago pero no se detectó el complemento de pagos.",
      recommendedAction: "Verifica que el XML contenga el complemento de pagos necesario.",
    });
  }

  if (
    warnings.some((w) =>
      w.includes("En comprobantes tipo Pago, la moneda del comprobante normalmente debe ser XXX"),
    )
  ) {
    addFindingOnce({
      severity: "WARNING",
      category: "FISCAL",
      code: "PAGO_MONEDA_NOT_XXX",
      title: "Moneda distinta de XXX en tipo Pago",
      message: "En comprobantes tipo Pago, la moneda del comprobante normalmente debe ser XXX.",
      recommendedAction:
        "Verifica que la moneda declarada sea correcta para el tipo de comprobante.",
    });
  }

  if (
    warnings.some((w) => w.includes("Se detectó un impuesto no clasificado por el catálogo base"))
  ) {
    addFindingOnce({
      severity: "WARNING",
      category: "TAX",
      code: "UNCLASSIFIED_TAX",
      title: "Impuesto no clasificado detectado",
      message: "Se detectó un impuesto con código no reconocido por el catálogo base del motor.",
      recommendedAction:
        "Revisa que el tipo de impuesto en el CFDI corresponda al catálogo fiscal vigente.",
    });
  }

  if (warnings.some((w) => w.includes("Un impuesto exento contiene importe"))) {
    addFindingOnce({
      severity: "WARNING",
      category: "TAX",
      code: "EXENTO_WITH_IMPORTE",
      title: "Impuesto exento con importe",
      message: "Un impuesto exento contiene importe mayor a 0; revisar consistencia fiscal.",
      recommendedAction:
        "Un impuesto exento no debería tener importe; verifica que el tipo factor sea correcto.",
    });
  }

  if (
    warnings.some((w) => w.includes("Un impuesto con tipo factor Tasa no contiene tasa o cuota"))
  ) {
    addFindingOnce({
      severity: "WARNING",
      category: "TAX",
      code: "TASA_MISSING_TASA_OCUOTA",
      title: "Impuesto con tipo Tasa sin tasa o cuota",
      message: "Un impuesto con tipo factor Tasa no contiene el valor de tasa o cuota.",
      recommendedAction:
        "El valor de tasa o cuota es obligatorio para impuestos con tipo factor Tasa.",
    });
  }

  if (
    warnings.some((w) =>
      w.includes("Un impuesto IEPS con tipo factor Tasa no contiene tasa o cuota"),
    )
  ) {
    addFindingOnce({
      severity: "WARNING",
      category: "TAX",
      code: "IEPS_TASA_MISSING_TASA_OCUOTA",
      title: "IEPS con tipo Tasa sin tasa o cuota",
      message: "Un impuesto IEPS con tipo factor Tasa no contiene el valor de tasa o cuota.",
      recommendedAction: "El valor de tasa o cuota es obligatorio para IEPS con tipo factor Tasa.",
    });
  }

  if (warnings.some((w) => w.includes("Una retención ISR tiene importe mayor que su base"))) {
    addFindingOnce({
      severity: "WARNING",
      category: "TAX",
      code: "ISR_RETENTION_EXCEEDS_BASE",
      title: "Retención ISR con importe mayor que la base",
      message: "Una retención ISR tiene importe mayor que su base.",
      recommendedAction: "Revisa que el cálculo de la retención ISR sea fiscalmente correcto.",
    });
  }

  if (warnings.some((w) => w.includes("Una retención de IVA tiene importe mayor que su base"))) {
    addFindingOnce({
      severity: "WARNING",
      category: "TAX",
      code: "IVA_RETENTION_EXCEEDS_BASE",
      title: "Retención de IVA con importe mayor que la base",
      message: "Una retención de IVA tiene importe mayor que su base.",
      recommendedAction: "Revisa que el cálculo de la retención de IVA sea fiscalmente correcto.",
    });
  }

  if (
    warnings.some((w) =>
      w.includes("Un impuesto tiene importe mayor a 0 con base igual o menor a 0"),
    )
  ) {
    addFindingOnce({
      severity: "WARNING",
      category: "TAX",
      code: "TAX_IMPORTE_WITHOUT_BASE",
      title: "Impuesto con importe y base no positiva",
      message: "Un impuesto tiene importe mayor a 0 con base igual o menor a 0.",
      recommendedAction:
        "Revisa que la base del impuesto sea correcta y consistente con el importe.",
    });
  }

  if (warnings.some((w) => w.includes("La moneda del comprobante es 'XXX'"))) {
    addFindingOnce({
      severity: "INFO",
      category: "FISCAL",
      code: "MONEDA_XXX",
      title: "Moneda en código XXX",
      message:
        "La moneda del comprobante es 'XXX' (sin moneda), inusual en comprobantes que no son de pago.",
      recommendedAction: "Verifica que usar moneda XXX sea correcto para el tipo de operación.",
    });
  }

  if (warnings.some((w) => w.includes("El total del comprobante es 0"))) {
    addFindingOnce({
      severity: "WARNING",
      category: "FISCAL",
      code: "TOTAL_ZERO",
      title: "Total del comprobante es 0",
      message: "El total del comprobante es 0, inusual en comprobantes de ingreso o egreso.",
      recommendedAction: "Verifica que el total declarado sea correcto.",
    });
  }

  if (warnings.some((w) => w.includes("No se encontró la fecha de timbrado"))) {
    addFindingOnce({
      severity: "WARNING",
      category: "TECHNICAL",
      code: "MISSING_TIMBRADO_FECHA",
      title: "Fecha de timbrado faltante",
      message: "No se encontró la fecha de timbrado en el TimbreFiscalDigital.",
      recommendedAction: "La fecha de timbrado debería estar presente si el XML fue timbrado.",
    });
  }

  if (warnings.some((w) => w.includes("El formato del UUID no es estándar"))) {
    addFindingOnce({
      severity: "WARNING",
      category: "TECHNICAL",
      code: "UUID_NON_STANDARD",
      title: "Formato de UUID no estándar",
      message: "El formato del UUID del TimbreFiscalDigital no cumple con el estándar.",
      recommendedAction: "Verifica que el UUID haya sido generado correctamente por el PAC.",
    });
  }

  if (warnings.some((w) => w.includes("El RFC del emisor tiene un formato sospechoso"))) {
    addFindingOnce({
      severity: "WARNING",
      category: "FISCAL",
      code: "SUSPICIOUS_RFC_EMISOR",
      title: "RFC del emisor con formato sospechoso",
      message: "El RFC del emisor no cumple con el formato estándar del SAT.",
      recommendedAction: "Verifica que el RFC del emisor sea válido ante el SAT.",
    });
  }

  if (warnings.some((w) => w.includes("El RFC del receptor tiene un formato sospechoso"))) {
    addFindingOnce({
      severity: "WARNING",
      category: "FISCAL",
      code: "SUSPICIOUS_RFC_RECEPTOR",
      title: "RFC del receptor con formato sospechoso",
      message: "El RFC del receptor no cumple con el formato estándar del SAT.",
      recommendedAction: "Verifica que tu RFC esté correctamente registrado ante el SAT.",
    });
  }

  if (warnings.some((w) => w.includes("No se pudo determinar la versión del CFDI"))) {
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
      message:
        "El receptor utiliza el RFC genérico nacional XAXX010101000. Esto puede ser válido para operaciones con público en general, pero debe revisarse según el contexto fiscal del comprobante.",
      recommendedAction:
        "Confirma que el uso de RFC genérico corresponda al escenario fiscal real del comprobante y que los campos del receptor sean consistentes.",
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
      message:
        "El receptor utiliza el RFC genérico extranjero XEXX010101000. Esto puede ser válido para operaciones con residentes en el extranjero no inscritos en RFC, pero debe revisarse según el contexto fiscal del comprobante.",
      recommendedAction:
        "Confirma que la operación corresponda a un receptor extranjero sin RFC mexicano y que los campos fiscales del receptor sean consistentes.",
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
      message:
        "El RFC genérico aparece en el emisor del comprobante. Esto es inusual y puede indicar un XML de prueba, inválido o mal generado.",
      recommendedAction:
        "Verifica que el RFC emisor corresponda a un contribuyente real y que el XML provenga de una emisión válida.",
      evidence: [
        { label: "RFC emisor", value: rfcEmisor },
        { label: "Nombre emisor", value: nombreEmisor ?? "—" },
        { label: "Tipo comprobante", value: tipoComprobante ?? "—" },
        { label: "UUID", value: uuid ?? "—" },
        { label: "XML timbrado", value: diag.isStamped ? "Sí" : "No" },
      ],
    });
  }

  if (
    rc(version, "4.0") &&
    rfcReceptor &&
    isGenericRfc(rfcReceptor) &&
    regimenFiscalReceptor &&
    regimenFiscalReceptor !== "616"
  ) {
    addFindingOnce({
      severity: "WARNING",
      category: "FISCAL",
      code: "GENERIC_RFC_RECEPTOR_REGIMEN_NOT_616",
      title: "Régimen fiscal receptor no esperado para RFC genérico",
      message:
        "El receptor usa RFC genérico, pero el RégimenFiscalReceptor no es 616. Esto puede generar inconsistencias según el tipo de CFDI y el contexto de emisión.",
      recommendedAction:
        "Revisa si el receptor genérico debe usar RégimenFiscalReceptor 616 conforme al escenario fiscal aplicable.",
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
        message:
          "El receptor usa RFC genérico y el UsoCFDI detectado no corresponde al patrón esperado para este escenario. Puede ser válido en casos específicos, pero requiere revisión.",
        recommendedAction:
          "Valida que el UsoCFDI sea consistente con el tipo de comprobante, el régimen fiscal del receptor y el escenario de emisión.",
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

  if (
    rc(version, "4.0") &&
    rfcReceptor &&
    isGenericRfc(rfcReceptor) &&
    domicilioFiscalReceptor &&
    lugarExpedicion &&
    domicilioFiscalReceptor !== lugarExpedicion
  ) {
    addFindingOnce({
      severity: "WARNING",
      category: "FISCAL",
      code: "GENERIC_RFC_RECEPTOR_POSTAL_MISMATCH",
      title: "Domicilio fiscal receptor no coincide con lugar de expedición",
      message:
        "El receptor usa RFC genérico, pero el DomicilioFiscalReceptor no coincide con LugarExpedicion. Esto puede ser inconsistente para CFDI 4.0 según reglas de validación aplicables.",
      recommendedAction:
        "Revisa el código postal del receptor y el lugar de expedición capturados en el CFDI.",
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
      if (
        !normalizedName.includes("PUBLICO EN GENERAL") &&
        !normalizedName.includes("PÚBLICO EN GENERAL")
      ) {
        addFindingOnce({
          severity: "INFO",
          category: "FISCAL",
          code: "GENERIC_RFC_RECEPTOR_NAME_REVIEW",
          title: "Nombre de receptor con RFC genérico requiere revisión",
          message:
            "El receptor usa RFC genérico, pero el nombre del receptor no corresponde al patrón común de público en general. Puede ser válido según el tipo de operación, pero conviene revisarlo.",
          recommendedAction:
            "Confirma si el comprobante corresponde a público en general, extranjero u otro escenario donde el RFC genérico sea procedente.",
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
      message:
        "El comprobante timbrado no contiene el atributo Sello en el nodo principal. Esto puede indicar un XML incompleto, alterado o mal generado.",
      recommendedAction:
        "Solicita al emisor el XML original timbrado y verifica que el archivo no haya sido modificado.",
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
      message:
        "El comprobante timbrado no contiene el atributo Certificado en el nodo principal. Esto puede indicar que el XML está incompleto o fue alterado.",
      recommendedAction:
        "Verifica el XML original emitido por el PAC o solicita una nueva descarga al emisor.",
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
      message:
        "El comprobante no contiene NoCertificado en el nodo principal. Esto puede afectar la trazabilidad técnica del CFDI.",
      recommendedAction:
        "Confirma que el XML corresponda al comprobante original timbrado y no a una representación parcial.",
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
      message:
        "El número de certificado del CFDI tiene un formato poco común. Puede ser válido en escenarios específicos, pero conviene revisarlo.",
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
      message:
        "El TimbreFiscalDigital no contiene SelloCFD. Esto puede indicar un timbre incompleto o una extracción incorrecta del XML.",
      recommendedAction:
        "Solicita el XML original al emisor o valida que el archivo no haya sido manipulado.",
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
      message:
        "El TimbreFiscalDigital no contiene SelloSAT. Esto puede indicar un timbre incompleto o un XML alterado.",
      recommendedAction:
        "Verifica el XML original timbrado y confirma que provenga de una fuente confiable.",
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
      message:
        "El TimbreFiscalDigital no contiene NoCertificadoSAT. Esto limita la trazabilidad del timbrado.",
      recommendedAction:
        "Solicita el XML original timbrado o revisa si el complemento fue alterado.",
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
      message:
        "El número de certificado SAT del timbre tiene un formato poco común. Puede requerir revisión técnica.",
      recommendedAction: "Confirma que el TimbreFiscalDigital corresponda a una emisión válida.",
      evidence: [
        { label: "UUID", value: uuid ?? "—" },
        { label: "NoCertificadoSAT", value: noCertificadoSat ?? "—" },
        {
          label: "Longitud",
          value: noCertificadoSat ? String(noCertificadoSat.trim().length) : "—",
        },
      ],
    });
  }

  if (hasTimbreFiscalDigital && !isNonEmptyString(rfcProvCertif)) {
    addFindingOnce({
      severity: "INFO",
      category: "TECHNICAL",
      code: "MISSING_RFC_PROV_CERTIF",
      title: "RFC del proveedor de certificación no detectado",
      message:
        "No se detectó RfcProvCertif en el TimbreFiscalDigital. Esto puede limitar la trazabilidad del PAC.",
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
      message:
        "No se detectó la versión del complemento TimbreFiscalDigital. Puede deberse a estructura no estándar o atributos incompletos.",
      recommendedAction:
        "Revisa el XML original si se requiere trazabilidad técnica completa del timbrado.",
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
      message:
        "La fecha de timbrado es anterior a la fecha de emisión del CFDI. Esto puede indicar inconsistencia temporal en el comprobante.",
      recommendedAction:
        "Verifica las fechas del XML y confirma que el comprobante no haya sido generado con datos inconsistentes.",
      evidence: [
        { label: "Fecha CFDI", value: fecha ?? "—" },
        { label: "Fecha timbrado", value: fechaTimbrado ?? "—" },
        { label: "UUID", value: uuid ?? "—" },
        { label: "RFC emisor", value: rfcEmisor ?? "—" },
      ],
    });
  }

  // ── Timbre Fiscal Digital Advanced Validations ──
  validateStamp({
    hasTimbreFiscalDigital,
    versionTimbre,
    uuid,
    fechaTimbrado,
    fecha,
    rfcProvCertif,
    selloCfd,
    selloSat,
    sello,
    noCertificadoSat,
    certificado,
    diag,
    addFinding: (code, severity, title, message, recommendedAction, evidence) => {
      addFindingOnce({
        severity,
        category: "TECHNICAL",
        code,
        title,
        message,
        recommendedAction,
        evidence,
      });
    },
  });

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
        message:
          "El comprobante es de tipo Pago, pero no se detectó información válida del complemento de pagos.",
        recommendedAction:
          "Verifica que el XML corresponda a un REP válido y que incluya el complemento Pagos 2.0.",
        evidence: [
          { label: "Tipo comprobante", value: tipoComprobante ?? "—" },
          { label: "UUID", value: uuid ?? "—" },
          {
            label: "Complementos detectados",
            value: complemento ? Object.keys(complemento).join(", ") : "Ninguno",
          },
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
            message:
              "Se detectó un pago dentro del complemento, pero no contiene documentos relacionados.",
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
            recommendedAction:
              "Valida que la forma de pago del REP haya sido capturada correctamente.",
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
            message:
              "En el detalle del pago, MonedaP normalmente debe indicar la moneda real del pago y no XXX.",
            recommendedAction: "Valida la moneda del pago en el complemento Pagos.",
            evidence: [
              { label: "Número de pago", value: String(pagoNum) },
              { label: "MonedaP", value: monedaP },
              { label: "Monto pago", value: pago.monto ?? "—" },
            ],
          });
        }

        // H) PAYMENT_EXCHANGE_RATE_REQUIRED
        if (
          isNonEmptyString(pago.monedaP) &&
          monedaP !== "MXN" &&
          !isNonEmptyString(pago.tipoCambioP)
        ) {
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
              recommendedAction:
                "Verifica que cada documento relacionado incluya el UUID del CFDI pagado.",
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
              message:
                "El número de parcialidad del documento relacionado no tiene un formato válido.",
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
              message:
                "El documento relacionado contiene saldo anterior o saldo insoluto negativo.",
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
                message:
                  "El saldo insoluto del documento relacionado no coincide con saldo anterior menos importe pagado.",
                recommendedAction:
                  "Revisa los importes ImpSaldoAnt, ImpPagado e ImpSaldoInsoluto del documento relacionado antes de usar este REP.",
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
              recommendedAction:
                "Valida los importes del REP; puede existir un error en parcialidad, saldo anterior o pago aplicado.",
              evidence: [
                { label: "Número de pago", value: String(pagoNum) },
                { label: "Documento relacionado #", value: String(docNum) },
                { label: "IdDocumento", value: doc.idDocumento ?? "—" },
                { label: "ImpSaldoAnt", value: doc.impSaldoAnt ?? "—" },
                { label: "ImpPagado", value: doc.impPagado ?? "—" },
                {
                  label: "Diferencia",
                  value: String(Math.round((impPagado - impSaldoAnt) * 100) / 100),
                },
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
                message:
                  "La suma de importes pagados en documentos relacionados excede el monto del pago.",
                recommendedAction:
                  "Revisa el monto del pago y los importes aplicados a documentos relacionados.",
                evidence: [
                  { label: "Número de pago", value: String(pagoNum) },
                  { label: "Monto pago", value: pago.monto ?? "—" },
                  { label: "MonedaP", value: monedaPago },
                  { label: "Suma ImpPagado comparable", value: String(sumPagado) },
                  {
                    label: "Diferencia",
                    value: String(Math.round((sumPagado - pagoMonto) * 100) / 100),
                  },
                  {
                    label: "Criterio comparación",
                    value: "MonedaP = MonedaDR y EquivalenciaDR = 1 o vacío",
                  },
                ],
              });
            }
          } else {
            addFindingOnce({
              severity: "INFO",
              category: "COMPLEMENT",
              code: "PAYMENT_TOTAL_RELATED_PAID_REVIEW",
              title: "Importes relacionados requieren revisión por moneda/equivalencia",
              message:
                "El pago contiene documentos relacionados con moneda o equivalencia que requieren revisión antes de comparar importes de forma directa.",
              recommendedAction:
                "Valida manualmente la equivalencia y el tipo de cambio aplicado en el REP.",
              evidence: [
                { label: "Número de pago", value: String(pagoNum) },
                { label: "MonedaP", value: monedaPago },
                {
                  label: "Monedas DR detectadas",
                  value: [
                    ...new Set(
                      pago.documentosRelacionados.map((d) => normalizeCurrency(d.monedaDR) || "—"),
                    ),
                  ].join(", "),
                },
                {
                  label: "Equivalencias DR detectadas",
                  value: [
                    ...new Set(
                      pago.documentosRelacionados.map(
                        (d) => normalizeCurrency(d.equivalenciaDR) || "—",
                      ),
                    ),
                  ].join(", "),
                },
                { label: "Monto pago", value: pago.monto ?? "—" },
              ],
            });
          }
        }
      });
    }
  }

  // ── Advanced Payment Complement Validations (A1–D7)
  if (paymentComplement && paymentComplement.pagos.length > 0) {
    validatePaymentComplementAdvanced({
      paymentComplement,
      addFinding: (code, severity, title, message, recommendedAction, evidence) => {
        addFindingOnce({
          severity,
          category: "COMPLEMENT",
          code,
          title,
          message,
          recommendedAction,
          evidence,
        });
      },
    });
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
          recommendedAction:
            "Verifica que el nodo CfdiRelacionados incluya el TipoRelacion correspondiente.",
          evidence: [
            { label: "Grupo #", value: String(groupNum) },
            {
              label: "Total CFDI relacionados en el grupo",
              value: String(group.relatedCfdis.length),
            },
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
          message:
            "Se detectó TipoRelacion 04 con múltiples CFDI relacionados. Puede ser válido según el caso, pero requiere revisión operativa.",
          recommendedAction:
            "Confirma que la sustitución se haya generado contra los CFDI origen correctos.",
          evidence: [
            { label: "Grupo #", value: String(groupNum) },
            { label: "TipoRelacion", value: group.tipoRelacion },
            { label: "Total relacionados", value: String(group.relatedCfdis.length) },
            {
              label: "UUIDs relacionados",
              value: group.relatedCfdis.map((r) => r.uuid ?? "—").join(", "),
            },
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
            recommendedAction:
              "Verifica que cada CFDI relacionado tenga el UUID del comprobante origen.",
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
            message:
              "El comprobante se relaciona a sí mismo como CFDI relacionado. Esto es inusual y puede indicar un error de generación.",
            recommendedAction:
              "Verifica que el UUID relacionado corresponda al comprobante origen correcto.",
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
          message:
            "El mismo UUID relacionado aparece más de una vez en el XML. Puede ser válido en estructuras específicas, pero conviene revisarlo.",
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
      message:
        "El comprobante es de tipo Egreso, pero no se detectaron CFDI relacionados. En notas de crédito o devoluciones normalmente debe existir una relación con el CFDI origen.",
      recommendedAction:
        "Revisa si el CFDI de egreso debe relacionarse con la factura original o documento que corrige.",
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
      if (
        grupoTipoRel &&
        grupoTipoRel.trim().length > 0 &&
        !expectedEgresoTypes.includes(grupoTipoRel.trim())
      ) {
        const relLabel = getTipoRelacionLabel(grupoTipoRel);
        addFindingOnce({
          severity: "INFO",
          category: "FISCAL",
          code: "EGRESO_RELATION_TYPE_REVIEW",
          title: "Tipo de relación en egreso requiere revisión",
          message:
            "El comprobante de egreso usa un TipoRelacion que puede ser válido, pero no corresponde al patrón más común para notas de crédito, devoluciones o sustituciones.",
          recommendedAction:
            "Revisa que el TipoRelacion sea correcto para el escenario fiscal del egreso.",
          evidence: [
            { label: "Tipo comprobante", value: tipoComprobante ?? "—" },
            {
              label: "TipoRelacion",
              value: relLabel ? `${grupoTipoRel} - ${relLabel}` : grupoTipoRel,
            },
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
      message:
        "El comprobante de pago incluye CfdiRelacionados además del complemento de pagos. Puede ser válido en escenarios específicos, pero normalmente la relación principal de documentos se controla dentro del complemento Pagos.",
      recommendedAction:
        "Revisa si la relación adicional es necesaria o si la trazabilidad debe estar únicamente en DoctoRelacionado del complemento de pago.",
      evidence: [
        { label: "Tipo comprobante", value: tipoComprobante ?? "—" },
        { label: "Total CFDI relacionados", value: String(cfdiRelations.totalRelatedCfdis) },
        {
          label: "Total documentos relacionados en Pagos",
          value: String(
            paymentComplement?.pagos.reduce((acc, p) => acc + p.documentosRelacionados.length, 0) ??
              0,
          ),
        },
        { label: "UUID comprobante", value: uuid ?? "—" },
      ],
    });
  }

  // ── CFDI Relations Advanced Validations ──
  validateCfdiRelationsAdvanced({
    tipoComprobante,
    uuid,
    cfdiRelations: cfdiRelations ?? null,
    paymentComplement,
    addFinding: (code, severity, title, message, recommendedAction, evidence) => {
      addFindingOnce({
        severity,
        category: "FISCAL",
        code,
        title,
        message,
        recommendedAction,
        evidence,
      });
    },
  });

  // ── Party (Emisor/Receptor) Advanced Validations ──
  validatePartiesAdvanced({
    tipoComprobante,
    version,
    emisor: { rfc: rfcEmisor, nombre: nombreEmisor, regimenFiscal },
    receptor: {
      rfc: rfcReceptor,
      nombre: nombreReceptor,
      regimenFiscalReceptor,
      domicilioFiscalReceptor,
      usoCfdi,
    },
    comercioExteriorReceptor: comercioExterior?.receptor ?? null,
    hasComercioExterior: !!comercioExterior,
    lugarExpedicion,
    exportacion,
    addFinding: (code, severity, title, message, recommendedAction, evidence) => {
      addFindingOnce({
        severity,
        category: "FISCAL",
        code,
        title,
        message,
        recommendedAction,
        evidence,
      });
    },
  });

  // ── Carta Porte Findings ──
  if (cartaPorte) {
    // A) CARTA_PORTE_DETECTED
    addFindingOnce({
      severity: "INFO",
      category: "COMPLEMENT",
      code: "CARTA_PORTE_DETECTED",
      title: "Complemento Carta Porte detectado",
      message:
        "El XML contiene complemento Carta Porte. Se realizará una revisión estructural base de ubicaciones, mercancías y transporte.",
      recommendedAction:
        "Revisa que los datos logísticos y fiscales del traslado correspondan al escenario real de la operación.",
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
          {
            label: "Complementos detectados",
            value: complemento ? Object.keys(complemento).join(", ") : "Ninguno",
          },
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
        message:
          "El complemento Carta Porte tiene una versión no reconocida por el motor actual. El XML puede requerir revisión especializada.",
        recommendedAction:
          "Confirma que la versión del complemento Carta Porte sea compatible con el CFDI y con las reglas vigentes aplicables.",
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
        message:
          "No se detectó IdCCP en Carta Porte. Este identificador es relevante para la trazabilidad del complemento.",
        recommendedAction:
          "Revisa que el XML de Carta Porte incluya el identificador del complemento cuando aplique.",
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
        message:
          "Se detectó Carta Porte en un tipo de comprobante distinto de Ingreso o Traslado. Esto es inusual y requiere revisión.",
        recommendedAction:
          "Confirma que el tipo de comprobante sea correcto para el traslado o servicio de transporte documentado.",
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
        message:
          "El CFDI de tipo Traslado con Carta Porte normalmente debe manejar subtotal y total en cero.",
        recommendedAction:
          "Revisa si el CFDI debe ser de tipo Ingreso o si los importes del traslado fueron capturados correctamente.",
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
        recommendedAction:
          "Verifica que el complemento incluya las ubicaciones de origen, destino y, si aplica, puntos intermedios.",
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
        recommendedAction:
          "Verifica que el complemento incluya el detalle de bienes o mercancías trasladadas.",
        evidence: [
          { label: "Versión Carta Porte", value: cartaPorte.version ?? "—" },
          { label: "UUID", value: uuid ?? "—" },
          { label: "Total mercancías", value: String(cartaPorte.mercancias.length) },
        ],
      });
    }

    // I) CARTA_PORTE_ORIGIN_DESTINATION_REVIEW
    if (cartaPorte.hasUbicaciones) {
      const tiposUbicacion = cartaPorte.ubicaciones.map((u) => u.tipoUbicacion).filter(Boolean);
      const hasOrigen = tiposUbicacion.some((t) => t && t.toLowerCase() === "origen");
      const hasDestino = tiposUbicacion.some((t) => t && t.toLowerCase() === "destino");
      if (!hasOrigen || !hasDestino) {
        addFindingOnce({
          severity: "WARNING",
          category: "COMPLEMENT",
          code: "CARTA_PORTE_ORIGIN_DESTINATION_REVIEW",
          title: "Ubicaciones de origen/destino incompletas",
          message:
            "No se detectó la combinación mínima de ubicación origen y destino dentro de Carta Porte.",
          recommendedAction:
            "Revisa que el complemento incluya una ubicación de origen y una de destino.",
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
            {
              label: "Nombre remitente/destinatario",
              value: ubi.nombreRemitenteDestinatario ?? "—",
            },
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
            message:
              "Una ubicación contiene DistanciaRecorrida con formato inválido o valor negativo.",
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
    if (
      !cartaPorte.hasAutotransporte &&
      !cartaPorte.hasTransporteMaritimo &&
      !cartaPorte.hasTransporteAereo &&
      !cartaPorte.hasTransporteFerroviario
    ) {
      addFindingOnce({
        severity: "INFO",
        category: "COMPLEMENT",
        code: "CARTA_PORTE_NO_TRANSPORT_MODE_DETECTED",
        title: "Medio de transporte no detectado",
        message:
          "No se detectó un nodo de medio de transporte específico dentro de Carta Porte. Puede ser válido según estructura, pero requiere revisión.",
        recommendedAction:
          "Revisa si el complemento debe incluir información de autotransporte, transporte marítimo, aéreo o ferroviario.",
        evidence: [
          { label: "Versión Carta Porte", value: cartaPorte.version ?? "—" },
          { label: "Autotransporte detectado", value: cartaPorte.hasAutotransporte ? "Sí" : "No" },
          {
            label: "Transporte marítimo detectado",
            value: cartaPorte.hasTransporteMaritimo ? "Sí" : "No",
          },
          {
            label: "Transporte aéreo detectado",
            value: cartaPorte.hasTransporteAereo ? "Sí" : "No",
          },
          {
            label: "Transporte ferroviario detectado",
            value: cartaPorte.hasTransporteFerroviario ? "Sí" : "No",
          },
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
          message:
            "Una figura de transporte contiene nombre, pero no RFCFigura. Puede ser válido según el caso, pero conviene revisarlo.",
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

  // ── Advanced Carta Porte Validations (A2–F3, excluding existing duplicates) ──
  if (cartaPorte) {
    validateCartaPorteAdvanced({
      cartaPorte,
      addFinding: (code, severity, title, message, recommendedAction, evidence) => {
        addFindingOnce({
          severity,
          category: "COMPLEMENT",
          code,
          title,
          message,
          recommendedAction,
          evidence,
        });
      },
    });
  }

  // ── Nomina 1.2 Findings ──
  if (nomina) {
    // A) NOMINA_DETECTED
    addFindingOnce({
      severity: "INFO",
      category: "COMPLEMENT",
      code: "NOMINA_DETECTED",
      title: "Complemento Nómina detectado",
      message:
        "El XML contiene complemento Nómina. Se realizará una revisión base de fechas, empleado, percepciones, deducciones y totales.",
      recommendedAction:
        "Revisa que los datos laborales y fiscales correspondan al recibo de nómina emitido.",
      evidence: [
        { label: "Versión Nómina", value: nomina.version ?? "—" },
        { label: "Tipo nómina", value: nomina.tipoNomina ?? "—" },
        { label: "Fecha pago", value: nomina.fechaPago ?? "—" },
        { label: "RFC receptor", value: rfcReceptor ?? "—" },
        { label: "Total CFDI", value: total ?? "—" },
      ],
    });

    // B) NOMINA_MISSING_VERSION
    if (!isNonEmptyString(nomina.version)) {
      addFindingOnce({
        severity: "WARNING",
        category: "COMPLEMENT",
        code: "NOMINA_MISSING_VERSION",
        title: "Versión de Nómina faltante",
        message: "No se detectó la versión del complemento Nómina.",
        recommendedAction: "Verifica que el complemento Nómina esté completo.",
        evidence: [
          { label: "UUID", value: uuid ?? "—" },
          { label: "Tipo comprobante", value: tipoComprobante ?? "—" },
        ],
      });
    }

    // C) NOMINA_VERSION_REVIEW
    if (isNonEmptyString(nomina.version) && nomina.version !== "1.2") {
      addFindingOnce({
        severity: "INFO",
        category: "COMPLEMENT",
        code: "NOMINA_VERSION_REVIEW",
        title: "Versión de Nómina requiere revisión",
        message:
          "El complemento Nómina tiene una versión distinta a la esperada por el motor actual.",
        recommendedAction:
          "Confirma si la versión del complemento corresponde al escenario fiscal del XML.",
        evidence: [
          { label: "Versión detectada", value: nomina.version ?? "—" },
          { label: "UUID", value: uuid ?? "—" },
        ],
      });
    }

    // D) NOMINA_WITH_UNEXPECTED_CFDI_TYPE
    if (!isTipoComprobanteNominaCompatible(tipoComprobante)) {
      addFindingOnce({
        severity: "WARNING",
        category: "FISCAL",
        code: "NOMINA_WITH_UNEXPECTED_CFDI_TYPE",
        title: "Nómina en tipo de comprobante no esperado",
        message: "Se detectó complemento Nómina en un tipo de comprobante no esperado.",
        recommendedAction:
          "Verifica que el tipo de comprobante sea correcto para un recibo de nómina.",
        evidence: [
          { label: "Tipo comprobante", value: tipoComprobante ?? "—" },
          { label: "Versión Nómina", value: nomina.version ?? "—" },
          { label: "UUID", value: uuid ?? "—" },
        ],
      });
    }

    // E) NOMINA_MISSING_FECHA_PAGO
    if (!isNonEmptyString(nomina.fechaPago)) {
      addFindingOnce({
        severity: "WARNING",
        category: "COMPLEMENT",
        code: "NOMINA_MISSING_FECHA_PAGO",
        title: "Fecha de pago faltante en Nómina",
        message: "No se detectó FechaPago en el complemento Nómina.",
        recommendedAction: "Revisa la fecha de pago capturada en el recibo.",
        evidence: [
          { label: "UUID", value: uuid ?? "—" },
          { label: "Tipo nómina", value: nomina.tipoNomina ?? "—" },
        ],
      });
    }

    // F) NOMINA_PAYMENT_DATE_OUTSIDE_PERIOD
    const pagoDate = parseCfdiDate(nomina.fechaPago);
    const inicialDate = parseCfdiDate(nomina.fechaInicialPago);
    const finalDate = parseCfdiDate(nomina.fechaFinalPago);
    if (pagoDate && inicialDate && finalDate) {
      if (isDateBefore(pagoDate, inicialDate) || isDateBefore(finalDate, inicialDate)) {
        addFindingOnce({
          severity: "WARNING",
          category: "COMPLEMENT",
          code: "NOMINA_PAYMENT_DATE_OUTSIDE_PERIOD",
          title: "Fechas de nómina requieren revisión",
          message: "Las fechas del complemento Nómina presentan una inconsistencia temporal.",
          recommendedAction: "Verifica FechaPago, FechaInicialPago y FechaFinalPago.",
          evidence: [
            { label: "Fecha pago", value: nomina.fechaPago ?? "—" },
            { label: "Fecha inicial pago", value: nomina.fechaInicialPago ?? "—" },
            { label: "Fecha final pago", value: nomina.fechaFinalPago ?? "—" },
          ],
        });
      }
    }

    // G) NOMINA_NUM_DIAS_INVALID
    if (isNonEmptyString(nomina.numDiasPagados)) {
      const dias = parseFloat(nomina.numDiasPagados!.trim());
      if (isNaN(dias) || dias <= 0) {
        addFindingOnce({
          severity: "WARNING",
          category: "COMPLEMENT",
          code: "NOMINA_NUM_DIAS_INVALID",
          title: "Número de días pagados inválido",
          message: "NumDiasPagados no tiene un valor numérico positivo.",
          recommendedAction: "Revisa los días pagados capturados en el complemento.",
          evidence: [
            { label: "NumDiasPagados", value: nomina.numDiasPagados ?? "—" },
            { label: "Fecha inicial pago", value: nomina.fechaInicialPago ?? "—" },
            { label: "Fecha final pago", value: nomina.fechaFinalPago ?? "—" },
          ],
        });
      }
    }

    // H) NOMINA_RECEPTOR_MISSING_CURP
    if (nomina.receptor && !isNonEmptyString(nomina.receptor.curp)) {
      addFindingOnce({
        severity: "WARNING",
        category: "FISCAL",
        code: "NOMINA_RECEPTOR_MISSING_CURP",
        title: "CURP del receptor faltante",
        message: "No se detectó CURP del trabajador en el complemento Nómina.",
        recommendedAction: "Verifica los datos del receptor de nómina.",
        evidence: [
          { label: "RFC receptor", value: rfcReceptor ?? "—" },
          { label: "Nombre receptor", value: nombreReceptor ?? "—" },
          { label: "NumEmpleado", value: nomina.receptor.numEmpleado ?? "—" },
        ],
      });
    }

    // I) NOMINA_RECEPTOR_CURP_FORMAT_REVIEW
    if (
      nomina.receptor &&
      isNonEmptyString(nomina.receptor.curp) &&
      !looksLikeCurp(nomina.receptor.curp)
    ) {
      addFindingOnce({
        severity: "INFO",
        category: "FISCAL",
        code: "NOMINA_RECEPTOR_CURP_FORMAT_REVIEW",
        title: "Formato de CURP requiere revisión",
        message: "La CURP del trabajador tiene un formato poco común o incompleto.",
        recommendedAction: "Verifica la CURP capturada en el complemento.",
        evidence: [
          { label: "CURP", value: nomina.receptor.curp ?? "—" },
          { label: "RFC receptor", value: rfcReceptor ?? "—" },
          { label: "NumEmpleado", value: nomina.receptor.numEmpleado ?? "—" },
        ],
      });
    }

    // J) NOMINA_RECEPTOR_NSS_FORMAT_REVIEW
    if (
      nomina.receptor &&
      isNonEmptyString(nomina.receptor.numSeguridadSocial) &&
      !looksLikeNss(nomina.receptor.numSeguridadSocial)
    ) {
      addFindingOnce({
        severity: "INFO",
        category: "FISCAL",
        code: "NOMINA_RECEPTOR_NSS_FORMAT_REVIEW",
        title: "Formato de NSS requiere revisión",
        message: "El número de seguridad social tiene un formato poco común.",
        recommendedAction: "Verifica el NSS del trabajador.",
        evidence: [
          { label: "NSS", value: nomina.receptor.numSeguridadSocial ?? "—" },
          { label: "NumEmpleado", value: nomina.receptor.numEmpleado ?? "—" },
          { label: "RFC receptor", value: rfcReceptor ?? "—" },
        ],
      });
    }

    // K) NOMINA_RECEPTOR_MISSING_NUM_EMPLEADO
    if (nomina.receptor && !isNonEmptyString(nomina.receptor.numEmpleado)) {
      addFindingOnce({
        severity: "WARNING",
        category: "COMPLEMENT",
        code: "NOMINA_RECEPTOR_MISSING_NUM_EMPLEADO",
        title: "Número de empleado faltante",
        message: "No se detectó NumEmpleado en el receptor de Nómina.",
        recommendedAction: "Verifica la información laboral del receptor.",
        evidence: [
          { label: "RFC receptor", value: rfcReceptor ?? "—" },
          { label: "Nombre receptor", value: nombreReceptor ?? "—" },
          { label: "CURP", value: nomina.receptor.curp ?? "—" },
        ],
      });
    }

    // L) NOMINA_WITHOUT_PERCEPCIONES
    if (nomina.percepciones.length === 0) {
      addFindingOnce({
        severity: "WARNING",
        category: "COMPLEMENT",
        code: "NOMINA_WITHOUT_PERCEPCIONES",
        title: "Nómina sin percepciones",
        message: "No se detectaron percepciones en el complemento Nómina.",
        recommendedAction: "Revisa si el recibo debe incluir percepciones del trabajador.",
        evidence: [
          { label: "UUID", value: uuid ?? "—" },
          { label: "Tipo nómina", value: nomina.tipoNomina ?? "—" },
          { label: "Total percepciones", value: nomina.totalPercepciones ?? "—" },
        ],
      });
    }

    // M) NOMINA_PERCEPCION_MISSING_TIPO
    nomina.percepciones.forEach((p, idx) => {
      const percNum = idx + 1;
      if (!isNonEmptyString(p.tipoPercepcion)) {
        addFindingOnce({
          severity: "WARNING",
          category: "COMPLEMENT",
          code: "NOMINA_PERCEPCION_MISSING_TIPO",
          title: "Percepción sin TipoPercepcion",
          message: "Una percepción no contiene TipoPercepcion.",
          recommendedAction: "Revisa el detalle de percepciones del complemento.",
          evidence: [
            { label: "Percepción #", value: String(percNum) },
            { label: "Clave", value: p.clave ?? "—" },
            { label: "Concepto", value: p.concepto ?? "—" },
            { label: "Importe gravado", value: p.importeGravado ?? "—" },
            { label: "Importe exento", value: p.importeExento ?? "—" },
          ],
        });
      }
    });

    // N) NOMINA_PERCEPCION_AMOUNT_INVALID
    nomina.percepciones.forEach((p, idx) => {
      const percNum = idx + 1;
      const gravado = toMoneyNumber(p.importeGravado);
      const exento = toMoneyNumber(p.importeExento);
      const hasInvalidAmount =
        (!isNonEmptyString(p.importeGravado) && !isNonEmptyString(p.importeExento)) ||
        (isNonEmptyString(p.importeGravado) && gravado < 0) ||
        (isNonEmptyString(p.importeExento) && exento < 0);
      if (hasInvalidAmount) {
        addFindingOnce({
          severity: "WARNING",
          category: "COMPLEMENT",
          code: "NOMINA_PERCEPCION_AMOUNT_INVALID",
          title: "Importe de percepción inválido",
          message: "Una percepción contiene importes inválidos o negativos.",
          recommendedAction: "Revisa ImporteGravado e ImporteExento de la percepción.",
          evidence: [
            { label: "Percepción #", value: String(percNum) },
            { label: "TipoPercepcion", value: p.tipoPercepcion ?? "—" },
            { label: "Concepto", value: p.concepto ?? "—" },
            { label: "Importe gravado", value: p.importeGravado ?? "—" },
            { label: "Importe exento", value: p.importeExento ?? "—" },
          ],
        });
      }
    });

    // O) NOMINA_DEDUCCION_AMOUNT_INVALID
    nomina.deducciones.forEach((d, idx) => {
      const dedNum = idx + 1;
      if (!isNonEmptyString(d.importe)) {
        addFindingOnce({
          severity: "WARNING",
          category: "COMPLEMENT",
          code: "NOMINA_DEDUCCION_AMOUNT_INVALID",
          title: "Importe de deducción inválido",
          message: "Una deducción contiene importe inválido o negativo.",
          recommendedAction: "Revisa el importe de la deducción.",
          evidence: [
            { label: "Deducción #", value: String(dedNum) },
            { label: "TipoDeduccion", value: d.tipoDeduccion ?? "—" },
            { label: "Concepto", value: d.concepto ?? "—" },
            { label: "Importe", value: d.importe ?? "—" },
          ],
        });
        return;
      }
      const importeNum = toMoneyNumber(d.importe);
      if (importeNum < 0) {
        addFindingOnce({
          severity: "WARNING",
          category: "COMPLEMENT",
          code: "NOMINA_DEDUCCION_AMOUNT_INVALID",
          title: "Importe de deducción inválido",
          message: "Una deducción contiene importe inválido o negativo.",
          recommendedAction: "Revisa el importe de la deducción.",
          evidence: [
            { label: "Deducción #", value: String(dedNum) },
            { label: "TipoDeduccion", value: d.tipoDeduccion ?? "—" },
            { label: "Concepto", value: d.concepto ?? "—" },
            { label: "Importe", value: d.importe ?? "—" },
          ],
        });
      }
    });

    // P) NOMINA_TOTAL_PERCEPCIONES_MISMATCH
    if (isNonEmptyString(nomina.totalPercepciones) && nomina.percepciones.length > 0) {
      const sumaPercepciones = nomina.percepciones.reduce(
        (acc, p) => acc + toMoneyNumber(p.importeGravado) + toMoneyNumber(p.importeExento),
        0,
      );
      const totalPercNum = toMoneyNumber(nomina.totalPercepciones);
      const diff = moneyDiff(totalPercNum, sumaPercepciones);
      if (diff > 0.01) {
        addFindingOnce({
          severity: "CRITICAL",
          category: "COMPLEMENT",
          code: "NOMINA_TOTAL_PERCEPCIONES_MISMATCH",
          title: "Total de percepciones no coincide",
          message:
            "El TotalPercepciones del complemento no coincide con la suma de percepciones detectadas.",
          recommendedAction: "Revisa los importes de percepciones antes de utilizar este XML.",
          evidence: [
            { label: "TotalPercepciones XML", value: nomina.totalPercepciones ?? "—" },
            { label: "Total percepciones calculado", value: formatMoney(sumaPercepciones) },
            { label: "Diferencia", value: formatMoney(diff) },
            { label: "Tolerancia", value: "0.01" },
          ],
        });
      }
    }

    // Q) NOMINA_TOTAL_DEDUCCIONES_MISMATCH
    if (isNonEmptyString(nomina.totalDeducciones) && nomina.deducciones.length > 0) {
      const sumaDeducciones = nomina.deducciones.reduce(
        (acc, d) => acc + toMoneyNumber(d.importe),
        0,
      );
      const totalDedNum = toMoneyNumber(nomina.totalDeducciones);
      const diff = moneyDiff(totalDedNum, sumaDeducciones);
      if (diff > 0.01) {
        addFindingOnce({
          severity: "CRITICAL",
          category: "COMPLEMENT",
          code: "NOMINA_TOTAL_DEDUCCIONES_MISMATCH",
          title: "Total de deducciones no coincide",
          message:
            "El TotalDeducciones del complemento no coincide con la suma de deducciones detectadas.",
          recommendedAction: "Revisa los importes de deducciones antes de utilizar este XML.",
          evidence: [
            { label: "TotalDeducciones XML", value: nomina.totalDeducciones ?? "—" },
            { label: "Total deducciones calculado", value: formatMoney(sumaDeducciones) },
            { label: "Diferencia", value: formatMoney(diff) },
            { label: "Tolerancia", value: "0.01" },
          ],
        });
      }
    }

    // R) NOMINA_TOTAL_OTROS_PAGOS_MISMATCH
    if (isNonEmptyString(nomina.totalOtrosPagos) && nomina.otrosPagos.length > 0) {
      const sumaOtrosPagos = nomina.otrosPagos.reduce(
        (acc, o) => acc + toMoneyNumber(o.importe),
        0,
      );
      const totalOPNum = toMoneyNumber(nomina.totalOtrosPagos);
      const diff = moneyDiff(totalOPNum, sumaOtrosPagos);
      if (diff > 0.01) {
        addFindingOnce({
          severity: "CRITICAL",
          category: "COMPLEMENT",
          code: "NOMINA_TOTAL_OTROS_PAGOS_MISMATCH",
          title: "Total de otros pagos no coincide",
          message:
            "El TotalOtrosPagos del complemento no coincide con la suma de otros pagos detectados.",
          recommendedAction: "Revisa los importes de OtrosPagos antes de utilizar este XML.",
          evidence: [
            { label: "TotalOtrosPagos XML", value: nomina.totalOtrosPagos ?? "—" },
            { label: "Total otros pagos calculado", value: formatMoney(sumaOtrosPagos) },
            { label: "Diferencia", value: formatMoney(diff) },
            { label: "Tolerancia", value: "0.01" },
          ],
        });
      }
    }
  }

  // ── Comercio Exterior 1.1 Findings ──
  // ── Advanced Nómina Validations (A2–F4, excluding existing duplicates) ──
  if (nomina) {
    validateNominaAdvanced({
      tipoComprobante,
      total,
      subTotal: subtotal,
      nomina,
      addFinding: (code, severity, title, message, recommendedAction, evidence) => {
        addFindingOnce({
          severity,
          category: "COMPLEMENT",
          code,
          title,
          message,
          recommendedAction,
          evidence,
        });
      },
    });
  }

  if (comercioExterior) {
    // A) COMERCIO_EXTERIOR_DETECTED
    addFindingOnce({
      severity: "INFO",
      category: "COMPLEMENT",
      code: "COMERCIO_EXTERIOR_DETECTED",
      title: "Complemento Comercio Exterior detectado",
      message:
        "El XML contiene complemento Comercio Exterior. Se realizará una revisión base de la operación, moneda e importes.",
      recommendedAction:
        "Revisa que los datos de comercio exterior correspondan a la operación de importación/exportación.",
      evidence: [
        { label: "Versión", value: comercioExterior.version ?? "—" },
        { label: "Tipo operación", value: comercioExterior.tipoOperacion ?? "—" },
        { label: "TotalUSD", value: comercioExterior.totalUSD ?? "—" },
      ],
    });

    // B) COMERCIO_EXTERIOR_MISSING_VERSION
    if (!isNonEmptyString(comercioExterior.version)) {
      addFindingOnce({
        severity: "WARNING",
        category: "COMPLEMENT",
        code: "COMERCIO_EXTERIOR_MISSING_VERSION",
        title: "Versión de Comercio Exterior faltante",
        message: "No se detectó la versión del complemento Comercio Exterior.",
        recommendedAction: "Verifica que el complemento Comercio Exterior esté completo.",
        evidence: [
          { label: "UUID", value: uuid ?? "—" },
          { label: "Tipo operación", value: comercioExterior.tipoOperacion ?? "—" },
        ],
      });
    }

    // C) COMERCIO_EXTERIOR_VERSION_REVIEW
    if (isNonEmptyString(comercioExterior.version) && comercioExterior.version !== "1.1") {
      addFindingOnce({
        severity: "INFO",
        category: "COMPLEMENT",
        code: "COMERCIO_EXTERIOR_VERSION_REVIEW",
        title: "Versión de Comercio Exterior requiere revisión",
        message:
          "El complemento Comercio Exterior tiene una versión distinta a la esperada por el motor actual.",
        recommendedAction:
          "Confirma si la versión del complemento corresponde al escenario fiscal del XML.",
        evidence: [
          { label: "Versión detectada", value: comercioExterior.version ?? "—" },
          { label: "UUID", value: uuid ?? "—" },
        ],
      });
    }

    // D) COMERCIO_EXTERIOR_MISSING_TIPO_OPERACION
    if (!isNonEmptyString(comercioExterior.tipoOperacion)) {
      addFindingOnce({
        severity: "WARNING",
        category: "COMPLEMENT",
        code: "COMERCIO_EXTERIOR_MISSING_TIPO_OPERACION",
        title: "Tipo de operación faltante",
        message: "No se detectó TipoOperacion en el complemento Comercio Exterior.",
        recommendedAction: "Verifica que el complemento incluya el tipo de operación.",
        evidence: [
          { label: "UUID", value: uuid ?? "—" },
          { label: "Versión", value: comercioExterior.version ?? "—" },
        ],
      });
    }

    // E) COMERCIO_EXTERIOR_TIPO_OPERACION_REVIEW
    if (
      isNonEmptyString(comercioExterior.tipoOperacion) &&
      !["1", "2"].includes(comercioExterior.tipoOperacion.trim())
    ) {
      addFindingOnce({
        severity: "INFO",
        category: "COMPLEMENT",
        code: "COMERCIO_EXTERIOR_TIPO_OPERACION_REVIEW",
        title: "Tipo de operación requiere revisión",
        message:
          "El tipo de operación del complemento no es el habitual (1=Temporal, 2=Definitiva).",
        recommendedAction: "Confirma que el tipo de operación corresponda al escenario real.",
        evidence: [
          { label: "TipoOperacion", value: comercioExterior.tipoOperacion ?? "—" },
          { label: "UUID", value: uuid ?? "—" },
        ],
      });
    }

    // F) COMERCIO_EXTERIOR_TOTAL_USD_MISMATCH
    if (isNonEmptyString(comercioExterior.totalUSD) && isNonEmptyString(total)) {
      const totalUSDNum = parseFloat(comercioExterior.totalUSD.trim());
      const totalNum = parseFloat(total.trim());
      if (!isNaN(totalUSDNum) && !isNaN(totalNum) && Math.abs(totalUSDNum - totalNum) > 0.01) {
        addFindingOnce({
          severity: "CRITICAL",
          category: "COMPLEMENT",
          code: "COMERCIO_EXTERIOR_TOTAL_USD_MISMATCH",
          title: "TotalUSD no coincide con total del CFDI",
          message: "El valor de TotalUSD en el complemento difiere del total del comprobante.",
          recommendedAction: "Verifica que el monto en dólares coincida con el total del CFDI.",
          evidence: [
            { label: "TotalUSD", value: comercioExterior.totalUSD ?? "—" },
            { label: "Total CFDI", value: total },
            { label: "UUID", value: uuid ?? "—" },
          ],
        });
      }
    }
  }

  // ── Advanced Comercio Exterior Validations (A4–E12, excluding existing duplicates) ──
  if (comercioExterior) {
    validateComercioExteriorAdvanced({
      tipoComprobante,
      exportacion,
      moneda,
      total,
      subtotal,
      comercioExterior,
      concepts: concepts ?? [],
      addFinding: (code, severity, title, message, recommendedAction, evidence) => {
        addFindingOnce({
          severity,
          category: "COMPLEMENT",
          code,
          title,
          message,
          recommendedAction,
          evidence,
        });
      },
    });
  }

  // ── Impuestos Locales 1.0 Findings ──
  if (impuestosLocales) {
    const ilRetTotal = toMoneyNumber(impuestosLocales.totalDeRetenciones);
    const ilTrasTotal = toMoneyNumber(impuestosLocales.totalDeTraslados);
    const sumaRetenciones = impuestosLocales.retenciones.reduce(
      (acc, r) => acc + toMoneyNumber(r.importe),
      0,
    );
    const sumaTraslados = impuestosLocales.traslados.reduce(
      (acc, t) => acc + toMoneyNumber(t.importe),
      0,
    );

    // A) IMPUESTOS_LOCALES_DETECTED
    addFindingOnce({
      severity: "INFO",
      category: "COMPLEMENT",
      code: "IMPUESTOS_LOCALES_DETECTED",
      title: "Complemento Impuestos Locales detectado",
      message:
        "El XML contiene complemento Impuestos Locales. Se realizará una revisión base de retenciones, traslados y totales locales.",
      recommendedAction:
        "Revisa que los impuestos locales correspondan al escenario fiscal y territorial aplicable.",
      evidence: [
        { label: "Versión", value: impuestosLocales.version ?? "—" },
        { label: "Total retenciones locales", value: impuestosLocales.totalDeRetenciones ?? "—" },
        { label: "Total traslados locales", value: impuestosLocales.totalDeTraslados ?? "—" },
        { label: "Retenciones detectadas", value: String(impuestosLocales.retenciones.length) },
        { label: "Traslados detectados", value: String(impuestosLocales.traslados.length) },
      ],
    });

    // B) IMPUESTOS_LOCALES_MISSING_VERSION
    if (!isNonEmptyString(impuestosLocales.version)) {
      addFindingOnce({
        severity: "WARNING",
        category: "COMPLEMENT",
        code: "IMPUESTOS_LOCALES_MISSING_VERSION",
        title: "Versión de Impuestos Locales faltante",
        message: "No se detectó la versión del complemento Impuestos Locales.",
        recommendedAction: "Verifica que el complemento Impuestos Locales esté completo.",
        evidence: [
          { label: "UUID", value: uuid ?? "—" },
          { label: "Total retenciones locales", value: impuestosLocales.totalDeRetenciones ?? "—" },
          { label: "Total traslados locales", value: impuestosLocales.totalDeTraslados ?? "—" },
        ],
      });
    }

    // C) IMPUESTOS_LOCALES_VERSION_REVIEW
    if (isNonEmptyString(impuestosLocales.version) && impuestosLocales.version !== "1.0") {
      addFindingOnce({
        severity: "INFO",
        category: "COMPLEMENT",
        code: "IMPUESTOS_LOCALES_VERSION_REVIEW",
        title: "Versión de Impuestos Locales requiere revisión",
        message:
          "El complemento Impuestos Locales tiene una versión no reconocida por el motor actual.",
        recommendedAction: "Confirma que la versión del complemento corresponda al XML analizado.",
        evidence: [
          { label: "Versión detectada", value: impuestosLocales.version ?? "—" },
          { label: "UUID", value: uuid ?? "—" },
        ],
      });
    }

    // D) IMPUESTOS_LOCALES_WITHOUT_LINES
    if (impuestosLocales.retenciones.length === 0 && impuestosLocales.traslados.length === 0) {
      addFindingOnce({
        severity: "WARNING",
        category: "COMPLEMENT",
        code: "IMPUESTOS_LOCALES_WITHOUT_LINES",
        title: "Impuestos Locales sin retenciones ni traslados",
        message: "El complemento Impuestos Locales no contiene retenciones ni traslados locales.",
        recommendedAction:
          "Revisa si el complemento fue generado incompleto o si no debía incluirse.",
        evidence: [
          { label: "Versión", value: impuestosLocales.version ?? "—" },
          { label: "Total retenciones locales", value: impuestosLocales.totalDeRetenciones ?? "—" },
          { label: "Total traslados locales", value: impuestosLocales.totalDeTraslados ?? "—" },
          { label: "UUID", value: uuid ?? "—" },
        ],
      });
    }

    // E) IMPUESTOS_LOCALES_RETENCION_MISSING_NAME
    impuestosLocales.retenciones.forEach((r, idx) => {
      const retNum = idx + 1;
      if (!isNonEmptyString(r.impLocRetenido)) {
        addFindingOnce({
          severity: "WARNING",
          category: "COMPLEMENT",
          code: "IMPUESTOS_LOCALES_RETENCION_MISSING_NAME",
          title: "Retención local sin nombre de impuesto",
          message: "Una retención local no contiene ImpLocRetenido.",
          recommendedAction: "Revisa el nombre o clave del impuesto local retenido.",
          evidence: [
            { label: "Retención #", value: String(retNum) },
            { label: "Tasa", value: r.tasaDeRetencion ?? "—" },
            { label: "Importe", value: r.importe ?? "—" },
          ],
        });
      }
    });

    // F) IMPUESTOS_LOCALES_TRASLADO_MISSING_NAME
    impuestosLocales.traslados.forEach((t, idx) => {
      const trasNum = idx + 1;
      if (!isNonEmptyString(t.impLocTrasladado)) {
        addFindingOnce({
          severity: "WARNING",
          category: "COMPLEMENT",
          code: "IMPUESTOS_LOCALES_TRASLADO_MISSING_NAME",
          title: "Traslado local sin nombre de impuesto",
          message: "Un traslado local no contiene ImpLocTrasladado.",
          recommendedAction: "Revisa el nombre o clave del impuesto local trasladado.",
          evidence: [
            { label: "Traslado #", value: String(trasNum) },
            { label: "Tasa", value: t.tasaDeTraslado ?? "—" },
            { label: "Importe", value: t.importe ?? "—" },
          ],
        });
      }
    });

    // G) IMPUESTOS_LOCALES_RETENCION_TASA_INVALID
    impuestosLocales.retenciones.forEach((r, idx) => {
      const retNum = idx + 1;
      if (isNonEmptyString(r.tasaDeRetencion)) {
        const tasaNum = toMoneyNumber(r.tasaDeRetencion);
        if (tasaNum < 0) {
          addFindingOnce({
            severity: "WARNING",
            category: "COMPLEMENT",
            code: "IMPUESTOS_LOCALES_RETENCION_TASA_INVALID",
            title: "Tasa de retención local inválida",
            message: "Una retención local contiene tasa inválida.",
            recommendedAction: "Revisa TasadeRetencion de la retención local.",
            evidence: [
              { label: "Retención #", value: String(retNum) },
              { label: "ImpLocRetenido", value: r.impLocRetenido ?? "—" },
              { label: "Tasa", value: r.tasaDeRetencion ?? "—" },
              { label: "Importe", value: r.importe ?? "—" },
            ],
          });
        }
      }
    });

    // H) IMPUESTOS_LOCALES_TRASLADO_TASA_INVALID
    impuestosLocales.traslados.forEach((t, idx) => {
      const trasNum = idx + 1;
      if (isNonEmptyString(t.tasaDeTraslado)) {
        const tasaNum = toMoneyNumber(t.tasaDeTraslado);
        if (tasaNum < 0) {
          addFindingOnce({
            severity: "WARNING",
            category: "COMPLEMENT",
            code: "IMPUESTOS_LOCALES_TRASLADO_TASA_INVALID",
            title: "Tasa de traslado local inválida",
            message: "Un traslado local contiene tasa inválida.",
            recommendedAction: "Revisa TasadeTraslado del traslado local.",
            evidence: [
              { label: "Traslado #", value: String(trasNum) },
              { label: "ImpLocTrasladado", value: t.impLocTrasladado ?? "—" },
              { label: "Tasa", value: t.tasaDeTraslado ?? "—" },
              { label: "Importe", value: t.importe ?? "—" },
            ],
          });
        }
      }
    });

    // I) IMPUESTOS_LOCALES_RETENCION_IMPORTE_INVALID
    impuestosLocales.retenciones.forEach((r, idx) => {
      const retNum = idx + 1;
      if (isNonEmptyString(r.importe)) {
        const importeNum = toMoneyNumber(r.importe);
        if (importeNum < 0) {
          addFindingOnce({
            severity: "WARNING",
            category: "COMPLEMENT",
            code: "IMPUESTOS_LOCALES_RETENCION_IMPORTE_INVALID",
            title: "Importe de retención local inválido",
            message: "Una retención local contiene importe inválido.",
            recommendedAction: "Revisa el importe de la retención local.",
            evidence: [
              { label: "Retención #", value: String(retNum) },
              { label: "ImpLocRetenido", value: r.impLocRetenido ?? "—" },
              { label: "Tasa", value: r.tasaDeRetencion ?? "—" },
              { label: "Importe", value: r.importe ?? "—" },
            ],
          });
        }
      }
    });

    // J) IMPUESTOS_LOCALES_TRASLADO_IMPORTE_INVALID
    impuestosLocales.traslados.forEach((t, idx) => {
      const trasNum = idx + 1;
      if (isNonEmptyString(t.importe)) {
        const importeNum = toMoneyNumber(t.importe);
        if (importeNum < 0) {
          addFindingOnce({
            severity: "WARNING",
            category: "COMPLEMENT",
            code: "IMPUESTOS_LOCALES_TRASLADO_IMPORTE_INVALID",
            title: "Importe de traslado local inválido",
            message: "Un traslado local contiene importe inválido.",
            recommendedAction: "Revisa el importe del traslado local.",
            evidence: [
              { label: "Traslado #", value: String(trasNum) },
              { label: "ImpLocTrasladado", value: t.impLocTrasladado ?? "—" },
              { label: "Tasa", value: t.tasaDeTraslado ?? "—" },
              { label: "Importe", value: t.importe ?? "—" },
            ],
          });
        }
      }
    });

    // K) IMPUESTOS_LOCALES_TOTAL_RETENCIONES_MISMATCH
    if (isNonEmptyString(impuestosLocales.totalDeRetenciones)) {
      const diff = moneyDiff(ilRetTotal, sumaRetenciones);
      if (diff > 0.01) {
        addFindingOnce({
          severity: "CRITICAL",
          category: "COMPLEMENT",
          code: "IMPUESTOS_LOCALES_TOTAL_RETENCIONES_MISMATCH",
          title: "Total de retenciones locales no coincide",
          message: "TotaldeRetenciones no coincide con la suma de retenciones locales.",
          recommendedAction:
            "Revisa TotaldeRetenciones y los importes de RetencionesLocales antes de utilizar este XML.",
          evidence: [
            { label: "Total retenciones XML", value: impuestosLocales.totalDeRetenciones ?? "—" },
            { label: "Suma retenciones", value: formatMoney(sumaRetenciones) },
            { label: "Diferencia", value: formatMoney(diff) },
            { label: "Tolerancia", value: "0.01" },
            { label: "Total líneas retención", value: String(impuestosLocales.retenciones.length) },
          ],
        });
      }
    }

    // L) IMPUESTOS_LOCALES_TOTAL_TRASLADOS_MISMATCH
    if (isNonEmptyString(impuestosLocales.totalDeTraslados)) {
      const diff = moneyDiff(ilTrasTotal, sumaTraslados);
      if (diff > 0.01) {
        addFindingOnce({
          severity: "CRITICAL",
          category: "COMPLEMENT",
          code: "IMPUESTOS_LOCALES_TOTAL_TRASLADOS_MISMATCH",
          title: "Total de traslados locales no coincide",
          message: "TotaldeTraslados no coincide con la suma de traslados locales.",
          recommendedAction:
            "Revisa TotaldeTraslados y los importes de TrasladosLocales antes de utilizar este XML.",
          evidence: [
            { label: "Total traslados XML", value: impuestosLocales.totalDeTraslados ?? "—" },
            { label: "Suma traslados", value: formatMoney(sumaTraslados) },
            { label: "Diferencia", value: formatMoney(diff) },
            { label: "Tolerancia", value: "0.01" },
            { label: "Total líneas traslado", value: String(impuestosLocales.traslados.length) },
          ],
        });
      }
    }

    // M) IMPUESTOS_LOCALES_TOTAL_RETENCIONES_MISSING_REVIEW
    if (
      impuestosLocales.retenciones.length > 0 &&
      !isNonEmptyString(impuestosLocales.totalDeRetenciones)
    ) {
      addFindingOnce({
        severity: "INFO",
        category: "COMPLEMENT",
        code: "IMPUESTOS_LOCALES_TOTAL_RETENCIONES_MISSING_REVIEW",
        title: "Total de retenciones locales no declarado",
        message: "Se detectaron retenciones locales, pero no se detectó TotaldeRetenciones.",
        recommendedAction:
          "Revisa si el complemento debe declarar el total de retenciones locales.",
        evidence: [
          { label: "Suma retenciones", value: formatMoney(sumaRetenciones) },
          { label: "Total líneas retención", value: String(impuestosLocales.retenciones.length) },
          { label: "UUID", value: uuid ?? "—" },
        ],
      });
    }

    // N) IMPUESTOS_LOCALES_TOTAL_TRASLADOS_MISSING_REVIEW
    if (
      impuestosLocales.traslados.length > 0 &&
      !isNonEmptyString(impuestosLocales.totalDeTraslados)
    ) {
      addFindingOnce({
        severity: "INFO",
        category: "COMPLEMENT",
        code: "IMPUESTOS_LOCALES_TOTAL_TRASLADOS_MISSING_REVIEW",
        title: "Total de traslados locales no declarado",
        message: "Se detectaron traslados locales, pero no se detectó TotaldeTraslados.",
        recommendedAction: "Revisa si el complemento debe declarar el total de traslados locales.",
        evidence: [
          { label: "Suma traslados", value: formatMoney(sumaTraslados) },
          { label: "Total líneas traslado", value: String(impuestosLocales.traslados.length) },
          { label: "UUID", value: uuid ?? "—" },
        ],
      });
    }
  }

  // ── Addenda Findings ──
  if (addenda) {
    // A) ADDENDA_DETECTED
    addFindingOnce({
      severity: "INFO",
      category: "STRUCTURE",
      code: "ADDENDA_DETECTED",
      title: "Addenda detectada",
      message:
        "El XML contiene Addenda. Se extrajeron señales comerciales de forma heurística y limitada.",
      recommendedAction:
        "Revisa si las referencias comerciales detectadas son suficientes para el proceso operativo o ERP.",
      evidence: [
        { label: "Root keys", value: addenda.rootKeys.join(", ") || "—" },
        { label: "Node count", value: String(addenda.nodeCount) },
        { label: "Max depth", value: String(addenda.maxDepth) },
        { label: "Señales detectadas", value: String(addenda.signals.length) },
        { label: "Truncado", value: addenda.truncated ? "Sí" : "No" },
      ],
    });

    // B) ADDENDA_NO_BUSINESS_SIGNALS_REVIEW
    if (addenda.signals.length === 0) {
      addFindingOnce({
        severity: "INFO",
        category: "STRUCTURE",
        code: "ADDENDA_NO_BUSINESS_SIGNALS_REVIEW",
        title: "Addenda sin señales comerciales reconocidas",
        message:
          "Se detectó Addenda, pero el motor no identificó referencias comerciales conocidas.",
        recommendedAction:
          "Revisa manualmente si la Addenda contiene datos específicos del cliente o ERP.",
        evidence: [
          { label: "Root keys", value: addenda.rootKeys.join(", ") || "—" },
          { label: "Node count", value: String(addenda.nodeCount) },
          { label: "Max depth", value: String(addenda.maxDepth) },
        ],
      });
    }

    // C) ADDENDA_PURCHASE_ORDER_DETECTED
    const poSignals = addenda.signals.filter(
      (s) => s.label === "PURCHASE_ORDER" && (s.confidence === "HIGH" || s.confidence === "MEDIUM"),
    );
    if (poSignals.length > 0) {
      addFindingOnce({
        severity: "INFO",
        category: "STRUCTURE",
        code: "ADDENDA_PURCHASE_ORDER_DETECTED",
        title: "Orden de compra detectada en Addenda",
        message: "Se detectó una posible orden de compra o pedido dentro de la Addenda.",
        recommendedAction:
          "Usa esta referencia para conciliación operativa o match contra ERP si aplica.",
        evidence: poSignals.slice(0, 5).map((s) => ({
          label: `Señal PURCHASE_ORDER`,
          value: `${s.path} = ${s.value} (${s.confidence})`,
        })),
      });
    }

    // D) ADDENDA_GOODS_RECEIPT_DETECTED
    const grSignals = addenda.signals.filter(
      (s) => s.label === "GOODS_RECEIPT" && (s.confidence === "HIGH" || s.confidence === "MEDIUM"),
    );
    if (grSignals.length > 0) {
      addFindingOnce({
        severity: "INFO",
        category: "STRUCTURE",
        code: "ADDENDA_GOODS_RECEIPT_DETECTED",
        title: "Recepción o entrada de mercancía detectada en Addenda",
        message:
          "Se detectó una posible recepción, entrada de mercancía o goods receipt dentro de la Addenda.",
        recommendedAction: "Usa esta referencia para conciliación operativa si aplica.",
        evidence: grSignals.slice(0, 5).map((s) => ({
          label: `Señal GOODS_RECEIPT`,
          value: `${s.path} = ${s.value} (${s.confidence})`,
        })),
      });
    }

    // E) ADDENDA_VENDOR_REFERENCE_DETECTED
    const vendorSignals = addenda.signals.filter(
      (s) => s.label === "VENDOR_ID" && (s.confidence === "HIGH" || s.confidence === "MEDIUM"),
    );
    if (vendorSignals.length > 0) {
      addFindingOnce({
        severity: "INFO",
        category: "STRUCTURE",
        code: "ADDENDA_VENDOR_REFERENCE_DETECTED",
        title: "Referencia de proveedor detectada en Addenda",
        message: "Se detectó una posible referencia de proveedor dentro de la Addenda.",
        recommendedAction:
          "Valida si esta referencia corresponde al número de proveedor usado por el cliente o ERP.",
        evidence: vendorSignals.slice(0, 5).map((s) => ({
          label: `Señal VENDOR_ID`,
          value: `${s.path} = ${s.value} (${s.confidence})`,
        })),
      });
    }

    // F) ADDENDA_TRUNCATED_REVIEW
    if (addenda.truncated) {
      addFindingOnce({
        severity: "INFO",
        category: "STRUCTURE",
        code: "ADDENDA_TRUNCATED_REVIEW",
        title: "Addenda truncada por límites de seguridad",
        message:
          "El análisis de Addenda fue limitado para evitar exponer contenido excesivo o afectar rendimiento.",
        recommendedAction:
          "Si necesitas revisar todos los campos de Addenda, usa el XML original de forma controlada.",
        evidence: [
          { label: "Node count", value: String(addenda.nodeCount) },
          { label: "Max depth", value: String(addenda.maxDepth) },
          { label: "Signals returned", value: String(addenda.signals.length) },
          { label: "Node summary returned", value: String(addenda.nodeSummary.length) },
        ],
      });
    }
  }

  // ── Leyendas Fiscales Findings ──
  if (leyendasFiscales) {
    // A) LEYENDAS_FISCALES_DETECTED
    addFindingOnce({
      severity: "INFO",
      category: "COMPLEMENT",
      code: "LEYENDAS_FISCALES_DETECTED",
      title: "Complemento Leyendas Fiscales detectado",
      message:
        "El XML contiene complemento Leyendas Fiscales. Se realizará una revisión base de versión y leyendas declaradas.",
      recommendedAction:
        "Revisa que las leyendas fiscales correspondan al supuesto normativo aplicable.",
      evidence: [
        { label: "Versión", value: leyendasFiscales.version ?? "—" },
        { label: "Total leyendas", value: String(leyendasFiscales.leyendas.length) },
        { label: "UUID", value: uuid ?? "—" },
      ],
    });

    // B) LEYENDAS_FISCALES_MISSING_VERSION
    if (!isNonEmptyString(leyendasFiscales.version)) {
      addFindingOnce({
        severity: "WARNING",
        category: "COMPLEMENT",
        code: "LEYENDAS_FISCALES_MISSING_VERSION",
        title: "Versión de Leyendas Fiscales faltante",
        message: "No se detectó la versión del complemento Leyendas Fiscales.",
        recommendedAction: "Verifica que el complemento Leyendas Fiscales esté completo.",
        evidence: [
          { label: "UUID", value: uuid ?? "—" },
          { label: "Total leyendas", value: String(leyendasFiscales.leyendas.length) },
        ],
      });
    }

    // C) LEYENDAS_FISCALES_VERSION_REVIEW
    if (isNonEmptyString(leyendasFiscales.version) && !["1.0"].includes(leyendasFiscales.version)) {
      addFindingOnce({
        severity: "INFO",
        category: "COMPLEMENT",
        code: "LEYENDAS_FISCALES_VERSION_REVIEW",
        title: "Versión de Leyendas Fiscales requiere revisión",
        message:
          "El complemento Leyendas Fiscales tiene una versión no reconocida por el motor actual.",
        recommendedAction: "Confirma que la versión del complemento corresponda al XML analizado.",
        evidence: [
          { label: "Versión detectada", value: leyendasFiscales.version },
          { label: "UUID", value: uuid ?? "—" },
        ],
      });
    }

    // D) LEYENDAS_FISCALES_WITHOUT_LEYENDAS
    if (leyendasFiscales.leyendas.length === 0) {
      addFindingOnce({
        severity: "WARNING",
        category: "COMPLEMENT",
        code: "LEYENDAS_FISCALES_WITHOUT_LEYENDAS",
        title: "Leyendas Fiscales sin leyendas",
        message: "El complemento Leyendas Fiscales no contiene nodos Leyenda.",
        recommendedAction:
          "Revisa si el complemento fue generado incompleto o si no debía incluirse.",
        evidence: [
          { label: "Versión", value: leyendasFiscales.version ?? "—" },
          { label: "UUID", value: uuid ?? "—" },
        ],
      });
    }

    // Per-leyenda findings
    leyendasFiscales.leyendas.forEach((ley, idx) => {
      const nro = idx + 1;

      // E) LEYENDA_FISCAL_MISSING_TEXT
      if (!isNonEmptyString(ley.textoLeyenda)) {
        addFindingOnce({
          severity: "WARNING",
          category: "COMPLEMENT",
          code: "LEYENDA_FISCAL_MISSING_TEXT",
          title: "Leyenda fiscal sin texto",
          message: "Una leyenda fiscal no contiene TextoLeyenda.",
          recommendedAction: "Revisa el texto de la leyenda fiscal declarada.",
          evidence: [
            { label: "Leyenda #", value: String(nro) },
            { label: "DisposicionFiscal", value: ley.disposicionFiscal ?? "—" },
            { label: "Norma", value: ley.norma ?? "—" },
          ],
        });
      }

      // F) LEYENDA_FISCAL_MISSING_NORMA_REVIEW
      if (!isNonEmptyString(ley.norma)) {
        addFindingOnce({
          severity: "INFO",
          category: "COMPLEMENT",
          code: "LEYENDA_FISCAL_MISSING_NORMA_REVIEW",
          title: "Leyenda fiscal sin norma",
          message:
            "No se detectó Norma en una leyenda fiscal. Puede requerir revisión según el supuesto aplicable.",
          recommendedAction: "Confirma si la leyenda fiscal debe indicar Norma.",
          evidence: [
            { label: "Leyenda #", value: String(nro) },
            { label: "DisposicionFiscal", value: ley.disposicionFiscal ?? "—" },
            { label: "TextoLeyenda", value: truncateStr(ley.textoLeyenda, 80) },
          ],
        });
      }

      // G) LEYENDA_FISCAL_MISSING_DISPOSICION_REVIEW
      if (!isNonEmptyString(ley.disposicionFiscal)) {
        addFindingOnce({
          severity: "INFO",
          category: "COMPLEMENT",
          code: "LEYENDA_FISCAL_MISSING_DISPOSICION_REVIEW",
          title: "Leyenda fiscal sin disposición fiscal",
          message:
            "No se detectó DisposicionFiscal en una leyenda fiscal. Puede requerir revisión según el supuesto aplicable.",
          recommendedAction: "Confirma si la leyenda fiscal debe indicar disposición fiscal.",
          evidence: [
            { label: "Leyenda #", value: String(nro) },
            { label: "Norma", value: ley.norma ?? "—" },
            { label: "TextoLeyenda", value: truncateStr(ley.textoLeyenda, 80) },
          ],
        });
      }

      // H) LEYENDA_FISCAL_TEXT_TOO_SHORT_REVIEW
      if (isNonEmptyString(ley.textoLeyenda) && normalizeText(ley.textoLeyenda).length < 10) {
        addFindingOnce({
          severity: "INFO",
          category: "COMPLEMENT",
          code: "LEYENDA_FISCAL_TEXT_TOO_SHORT_REVIEW",
          title: "Texto de leyenda fiscal muy corto",
          message:
            "El texto de la leyenda fiscal parece demasiado corto para describir un supuesto normativo.",
          recommendedAction: "Revisa si TextoLeyenda fue capturado completo.",
          evidence: [
            { label: "Leyenda #", value: String(nro) },
            { label: "TextoLeyenda", value: ley.textoLeyenda },
            { label: "Longitud", value: String(normalizeText(ley.textoLeyenda).length) },
          ],
        });
      }
    });
  }

  // ── Donatarias Findings ──
  if (donatarias) {
    // I) DONATARIAS_DETECTED
    addFindingOnce({
      severity: "INFO",
      category: "COMPLEMENT",
      code: "DONATARIAS_DETECTED",
      title: "Complemento Donatarias detectado",
      message:
        "El XML contiene complemento Donatarias. Se realizará una revisión base de autorización, fecha y leyenda.",
      recommendedAction:
        "Revisa que los datos de donataria autorizada correspondan al comprobante emitido.",
      evidence: [
        { label: "Versión", value: donatarias.version ?? "—" },
        { label: "NoAutorizacion", value: donatarias.noAutorizacion ?? "—" },
        { label: "FechaAutorizacion", value: donatarias.fechaAutorizacion ?? "—" },
        { label: "UUID", value: uuid ?? "—" },
      ],
    });

    // J) DONATARIAS_MISSING_VERSION
    if (!isNonEmptyString(donatarias.version)) {
      addFindingOnce({
        severity: "WARNING",
        category: "COMPLEMENT",
        code: "DONATARIAS_MISSING_VERSION",
        title: "Versión de Donatarias faltante",
        message: "No se detectó la versión del complemento Donatarias.",
        recommendedAction: "Verifica que el complemento Donatarias esté completo.",
        evidence: [
          { label: "UUID", value: uuid ?? "—" },
          { label: "NoAutorizacion", value: donatarias.noAutorizacion ?? "—" },
          { label: "FechaAutorizacion", value: donatarias.fechaAutorizacion ?? "—" },
        ],
      });
    }

    // K) DONATARIAS_VERSION_REVIEW
    if (isNonEmptyString(donatarias.version) && !["1.1"].includes(donatarias.version)) {
      addFindingOnce({
        severity: "INFO",
        category: "COMPLEMENT",
        code: "DONATARIAS_VERSION_REVIEW",
        title: "Versión de Donatarias requiere revisión",
        message: "El complemento Donatarias tiene una versión no reconocida por el motor actual.",
        recommendedAction: "Confirma que la versión del complemento corresponda al XML analizado.",
        evidence: [
          { label: "Versión detectada", value: donatarias.version },
          { label: "UUID", value: uuid ?? "—" },
        ],
      });
    }

    // L) DONATARIAS_MISSING_NO_AUTORIZACION
    if (!isNonEmptyString(donatarias.noAutorizacion)) {
      addFindingOnce({
        severity: "WARNING",
        category: "COMPLEMENT",
        code: "DONATARIAS_MISSING_NO_AUTORIZACION",
        title: "Número de autorización de Donatarias faltante",
        message: "No se detectó NoAutorizacion en el complemento Donatarias.",
        recommendedAction: "Revisa el número de autorización de donataria capturado en el XML.",
        evidence: [
          { label: "Versión", value: donatarias.version ?? "—" },
          { label: "FechaAutorizacion", value: donatarias.fechaAutorizacion ?? "—" },
          { label: "UUID", value: uuid ?? "—" },
        ],
      });
    }

    // M) DONATARIAS_NO_AUTORIZACION_FORMAT_REVIEW
    if (
      isNonEmptyString(donatarias.noAutorizacion) &&
      !looksLikeAuthorizationNumber(donatarias.noAutorizacion)
    ) {
      addFindingOnce({
        severity: "INFO",
        category: "COMPLEMENT",
        code: "DONATARIAS_NO_AUTORIZACION_FORMAT_REVIEW",
        title: "Formato de NoAutorizacion requiere revisión",
        message: "NoAutorizacion tiene un formato poco común.",
        recommendedAction: "Confirma que el número de autorización sea correcto.",
        evidence: [
          { label: "NoAutorizacion", value: donatarias.noAutorizacion },
          { label: "Longitud", value: String(donatarias.noAutorizacion.length) },
          { label: "UUID", value: uuid ?? "—" },
        ],
      });
    }

    // N) DONATARIAS_MISSING_FECHA_AUTORIZACION
    if (!isNonEmptyString(donatarias.fechaAutorizacion)) {
      addFindingOnce({
        severity: "WARNING",
        category: "COMPLEMENT",
        code: "DONATARIAS_MISSING_FECHA_AUTORIZACION",
        title: "Fecha de autorización de Donatarias faltante",
        message: "No se detectó FechaAutorizacion en el complemento Donatarias.",
        recommendedAction: "Revisa la fecha de autorización de la donataria.",
        evidence: [
          { label: "Versión", value: donatarias.version ?? "—" },
          { label: "NoAutorizacion", value: donatarias.noAutorizacion ?? "—" },
          { label: "UUID", value: uuid ?? "—" },
        ],
      });
    }

    // O) DONATARIAS_FECHA_AUTORIZACION_INVALID
    if (
      isNonEmptyString(donatarias.fechaAutorizacion) &&
      !parseCfdiDate(donatarias.fechaAutorizacion)
    ) {
      addFindingOnce({
        severity: "WARNING",
        category: "COMPLEMENT",
        code: "DONATARIAS_FECHA_AUTORIZACION_INVALID",
        title: "Fecha de autorización de Donatarias inválida",
        message: "FechaAutorizacion no pudo interpretarse como fecha válida.",
        recommendedAction: "Revisa el formato de FechaAutorizacion.",
        evidence: [
          { label: "FechaAutorizacion", value: donatarias.fechaAutorizacion },
          { label: "NoAutorizacion", value: donatarias.noAutorizacion ?? "—" },
          { label: "UUID", value: uuid ?? "—" },
        ],
      });
    }

    // P) DONATARIAS_MISSING_LEYENDA
    if (!isNonEmptyString(donatarias.leyenda)) {
      addFindingOnce({
        severity: "WARNING",
        category: "COMPLEMENT",
        code: "DONATARIAS_MISSING_LEYENDA",
        title: "Leyenda de Donatarias faltante",
        message: "No se detectó Leyenda en el complemento Donatarias.",
        recommendedAction: "Revisa la leyenda del complemento Donatarias.",
        evidence: [
          { label: "Versión", value: donatarias.version ?? "—" },
          { label: "NoAutorizacion", value: donatarias.noAutorizacion ?? "—" },
          { label: "FechaAutorizacion", value: donatarias.fechaAutorizacion ?? "—" },
          { label: "UUID", value: uuid ?? "—" },
        ],
      });
    }

    // Q) DONATARIAS_LEYENDA_TOO_SHORT_REVIEW
    if (isNonEmptyString(donatarias.leyenda) && normalizeText(donatarias.leyenda).length < 20) {
      addFindingOnce({
        severity: "INFO",
        category: "COMPLEMENT",
        code: "DONATARIAS_LEYENDA_TOO_SHORT_REVIEW",
        title: "Leyenda de Donatarias muy corta",
        message: "La leyenda del complemento Donatarias parece demasiado corta.",
        recommendedAction: "Revisa si la leyenda fue capturada completa.",
        evidence: [
          { label: "Leyenda", value: truncateStr(donatarias.leyenda, 80) },
          { label: "Longitud", value: String(normalizeText(donatarias.leyenda).length) },
          { label: "UUID", value: uuid ?? "—" },
        ],
      });
    }
  }

  // ── Concept-level Tax Findings ──
  if (concepts && concepts.length > 0 && rc(version, "4.0")) {
    concepts.forEach((c, idx) => {
      const cn = idx + 1;
      const objetoImp = normalizeObjetoImp(c.objetoImp);
      const hasTransferred = getConceptTransferredTaxes(c).length > 0;
      const hasWithheld = getConceptWithheldTaxes(c).length > 0;
      const hasAnyTax = hasConceptTaxes(c);
      const allTransferred = getConceptTransferredTaxes(c);
      const allWithheld = getConceptWithheldTaxes(c);

      // A) CONCEPT_OBJETO_IMP_MISSING
      if (!isNonEmptyString(objetoImp)) {
        addFindingOnce({
          severity: "WARNING",
          category: "TAX",
          code: "CONCEPT_OBJETO_IMP_MISSING",
          title: "ObjetoImp faltante en concepto",
          message:
            "Un concepto no contiene ObjetoImp, campo necesario para identificar si el concepto es objeto de impuesto.",
          recommendedAction:
            "Revisa el concepto y confirma si debe indicar ObjetoImp conforme al tratamiento fiscal aplicable.",
          evidence: [
            { label: "Concepto #", value: String(cn) },
            { label: "ClaveProdServ", value: c.claveProdServ ?? "—" },
            { label: "Descripción", value: c.descripcion ?? "—" },
            { label: "Importe", value: c.importe ?? "—" },
            { label: "ObjetoImp", value: c.objetoImp ?? "—" },
          ],
        });
      }

      // B) CONCEPT_OBJETO_IMP_01_WITH_TAXES
      if (objetoImp === "01" && hasAnyTax) {
        const totalTraslados = allTransferred.reduce((s, t) => s + toMoneyNumber(t.importe), 0);
        const totalRetenciones = allWithheld.reduce((s, r) => s + toMoneyNumber(r.importe), 0);
        addFindingOnce({
          severity: "WARNING",
          category: "TAX",
          code: "CONCEPT_OBJETO_IMP_01_WITH_TAXES",
          title: "Concepto no objeto de impuesto contiene impuestos",
          message: "El concepto indica ObjetoImp 01, pero contiene impuestos a nivel concepto.",
          recommendedAction:
            "Revisa si el concepto realmente no es objeto de impuesto o si los impuestos fueron capturados incorrectamente.",
          evidence: [
            { label: "Concepto #", value: String(cn) },
            { label: "ObjetoImp", value: objetoImp },
            { label: "Total traslados concepto", value: formatMoney(totalTraslados) },
            { label: "Total retenciones concepto", value: formatMoney(totalRetenciones) },
            { label: "Descripción", value: c.descripcion ?? "—" },
          ],
        });
      }

      // C) CONCEPT_OBJETO_IMP_02_WITHOUT_TAXES
      if (objetoImp === "02" && !hasAnyTax) {
        addFindingOnce({
          severity: "WARNING",
          category: "TAX",
          code: "CONCEPT_OBJETO_IMP_02_WITHOUT_TAXES",
          title: "Concepto objeto de impuesto sin impuestos",
          message:
            "El concepto indica ObjetoImp 02, pero no se detectaron impuestos a nivel concepto.",
          recommendedAction:
            "Verifica si el concepto debe incluir traslados o retenciones, o si el ObjetoImp correcto debe ser otro.",
          evidence: [
            { label: "Concepto #", value: String(cn) },
            { label: "ObjetoImp", value: objetoImp },
            { label: "ClaveProdServ", value: c.claveProdServ ?? "—" },
            { label: "Descripción", value: c.descripcion ?? "—" },
            { label: "Importe", value: c.importe ?? "—" },
          ],
        });
      }

      // D) CONCEPT_OBJETO_IMP_03_WITHOUT_EXEMPT_REVIEW
      if (objetoImp === "03") {
        const hasExentoTraslado = allTransferred.some(
          (t) => normalizeTipoFactor(t.tipoFactor) === "Exento",
        );
        if (!hasExentoTraslado) {
          const tiposFactor = [...new Set(allTransferred.map((t) => t.tipoFactor ?? "—"))];
          addFindingOnce({
            severity: "INFO",
            category: "TAX",
            code: "CONCEPT_OBJETO_IMP_03_WITHOUT_EXEMPT_REVIEW",
            title: "ObjetoImp 03 requiere revisión",
            message:
              "El concepto indica ObjetoImp 03, pero no se detectó un traslado exento a nivel concepto. Puede ser válido según estructura, pero requiere revisión.",
            recommendedAction:
              "Confirma que el tratamiento exento del concepto esté correctamente representado.",
            evidence: [
              { label: "Concepto #", value: String(cn) },
              { label: "ObjetoImp", value: objetoImp },
              { label: "TipoFactor detectados", value: tiposFactor.join(", ") || "—" },
              { label: "Descripción", value: c.descripcion ?? "—" },
            ],
          });
        }
      }

      // E) CONCEPT_TAX_BASE_MISSING
      for (const t of allTransferred) {
        if (!isNonEmptyString(t.base)) {
          addFindingOnce({
            severity: "WARNING",
            category: "TAX",
            code: "CONCEPT_TAX_BASE_MISSING",
            title: "Base de impuesto faltante en concepto",
            message: "Un impuesto a nivel concepto no contiene Base.",
            recommendedAction: "Revisa la base gravable del impuesto dentro del concepto.",
            evidence: [
              { label: "Concepto #", value: String(cn) },
              { label: "Tipo impuesto", value: "Traslado" },
              { label: "Impuesto", value: t.impuesto ?? "—" },
              { label: "TipoFactor", value: t.tipoFactor ?? "—" },
              { label: "TasaOCuota", value: t.tasaOCuota ?? "—" },
              { label: "Importe impuesto", value: t.importe ?? "—" },
            ],
          });
        }
      }
      for (const r of allWithheld) {
        if (!isNonEmptyString(r.base)) {
          addFindingOnce({
            severity: "WARNING",
            category: "TAX",
            code: "CONCEPT_TAX_BASE_MISSING",
            title: "Base de impuesto faltante en concepto",
            message: "Un impuesto a nivel concepto no contiene Base.",
            recommendedAction: "Revisa la base gravable del impuesto dentro del concepto.",
            evidence: [
              { label: "Concepto #", value: String(cn) },
              { label: "Tipo impuesto", value: "Retención" },
              { label: "Impuesto", value: r.impuesto ?? "—" },
              { label: "TipoFactor", value: r.tipoFactor ?? "—" },
              { label: "TasaOCuota", value: r.tasaOCuota ?? "—" },
              { label: "Importe impuesto", value: r.importe ?? "—" },
            ],
          });
        }
      }

      // F) CONCEPT_TAX_BASE_INVALID
      for (const t of allTransferred) {
        if (isNonEmptyString(t.base)) {
          const baseNum = toMoneyNumber(t.base);
          if (baseNum <= 0) {
            addFindingOnce({
              severity: "WARNING",
              category: "TAX",
              code: "CONCEPT_TAX_BASE_INVALID",
              title: "Base de impuesto inválida en concepto",
              message: "La base de impuesto a nivel concepto no tiene un valor numérico positivo.",
              recommendedAction: "Revisa la Base del impuesto en el concepto.",
              evidence: [
                { label: "Concepto #", value: String(cn) },
                { label: "Tipo impuesto", value: "Traslado" },
                { label: "Base", value: t.base },
                { label: "Impuesto", value: t.impuesto ?? "—" },
                { label: "Descripción", value: c.descripcion ?? "—" },
              ],
            });
          }
        }
      }
      for (const r of allWithheld) {
        if (isNonEmptyString(r.base)) {
          const baseNum = toMoneyNumber(r.base);
          if (baseNum <= 0) {
            addFindingOnce({
              severity: "WARNING",
              category: "TAX",
              code: "CONCEPT_TAX_BASE_INVALID",
              title: "Base de impuesto inválida en concepto",
              message: "La base de impuesto a nivel concepto no tiene un valor numérico positivo.",
              recommendedAction: "Revisa la Base del impuesto en el concepto.",
              evidence: [
                { label: "Concepto #", value: String(cn) },
                { label: "Tipo impuesto", value: "Retención" },
                { label: "Base", value: r.base },
                { label: "Impuesto", value: r.impuesto ?? "—" },
                { label: "Descripción", value: c.descripcion ?? "—" },
              ],
            });
          }
        }
      }

      // G) CONCEPT_TAX_MISSING_TAX_CODE
      for (const t of allTransferred) {
        if (!isNonEmptyString(t.impuesto)) {
          addFindingOnce({
            severity: "WARNING",
            category: "TAX",
            code: "CONCEPT_TAX_MISSING_TAX_CODE",
            title: "Clave de impuesto faltante en concepto",
            message: "Un impuesto a nivel concepto no contiene la clave de impuesto.",
            recommendedAction:
              "Revisa que el impuesto indique la clave correspondiente, por ejemplo IVA, ISR o IEPS.",
            evidence: [
              { label: "Concepto #", value: String(cn) },
              { label: "Tipo impuesto", value: "Traslado" },
              { label: "Base", value: t.base ?? "—" },
              { label: "TipoFactor", value: t.tipoFactor ?? "—" },
              { label: "TasaOCuota", value: t.tasaOCuota ?? "—" },
              { label: "Importe", value: t.importe ?? "—" },
            ],
          });
        }
      }
      for (const r of allWithheld) {
        if (!isNonEmptyString(r.impuesto)) {
          addFindingOnce({
            severity: "WARNING",
            category: "TAX",
            code: "CONCEPT_TAX_MISSING_TAX_CODE",
            title: "Clave de impuesto faltante en concepto",
            message: "Un impuesto a nivel concepto no contiene la clave de impuesto.",
            recommendedAction:
              "Revisa que el impuesto indique la clave correspondiente, por ejemplo IVA, ISR o IEPS.",
            evidence: [
              { label: "Concepto #", value: String(cn) },
              { label: "Tipo impuesto", value: "Retención" },
              { label: "Base", value: r.base ?? "—" },
              { label: "TipoFactor", value: r.tipoFactor ?? "—" },
              { label: "TasaOCuota", value: r.tasaOCuota ?? "—" },
              { label: "Importe", value: r.importe ?? "—" },
            ],
          });
        }
      }

      // H) CONCEPT_TAX_UNKNOWN_CODE_REVIEW
      for (const t of allTransferred) {
        if (isNonEmptyString(t.impuesto) && !isKnownImpuesto(t.impuesto)) {
          addFindingOnce({
            severity: "INFO",
            category: "TAX",
            code: "CONCEPT_TAX_UNKNOWN_CODE_REVIEW",
            title: "Clave de impuesto no reconocida",
            message: "El impuesto del concepto usa una clave no reconocida por el motor actual.",
            recommendedAction:
              "Revisa si la clave de impuesto corresponde a un caso fiscal específico o estructura no estándar.",
            evidence: [
              { label: "Concepto #", value: String(cn) },
              { label: "Impuesto", value: t.impuesto! },
              { label: "Tipo impuesto", value: "Traslado" },
              { label: "Descripción", value: c.descripcion ?? "—" },
            ],
          });
        }
      }
      for (const r of allWithheld) {
        if (isNonEmptyString(r.impuesto) && !isKnownImpuesto(r.impuesto)) {
          addFindingOnce({
            severity: "INFO",
            category: "TAX",
            code: "CONCEPT_TAX_UNKNOWN_CODE_REVIEW",
            title: "Clave de impuesto no reconocida",
            message: "El impuesto del concepto usa una clave no reconocida por el motor actual.",
            recommendedAction:
              "Revisa si la clave de impuesto corresponde a un caso fiscal específico o estructura no estándar.",
            evidence: [
              { label: "Concepto #", value: String(cn) },
              { label: "Impuesto", value: r.impuesto! },
              { label: "Tipo impuesto", value: "Retención" },
              { label: "Descripción", value: c.descripcion ?? "—" },
            ],
          });
        }
      }

      // I) CONCEPT_TAX_TIPO_FACTOR_MISSING
      for (const t of allTransferred) {
        if (!isNonEmptyString(t.tipoFactor)) {
          addFindingOnce({
            severity: "WARNING",
            category: "TAX",
            code: "CONCEPT_TAX_TIPO_FACTOR_MISSING",
            title: "TipoFactor faltante en traslado",
            message: "Un traslado a nivel concepto no contiene TipoFactor.",
            recommendedAction: "Revisa si el traslado debe indicar Tasa, Cuota o Exento.",
            evidence: [
              { label: "Concepto #", value: String(cn) },
              { label: "Impuesto", value: t.impuesto ?? "—" },
              { label: "Base", value: t.base ?? "—" },
              { label: "TasaOCuota", value: t.tasaOCuota ?? "—" },
              { label: "Importe", value: t.importe ?? "—" },
            ],
          });
        }
      }

      // J) CONCEPT_TAX_RATE_REQUIRED
      for (const t of allTransferred) {
        const tf = normalizeTipoFactor(t.tipoFactor);
        if ((tf === "Tasa" || tf === "Cuota") && !isNonEmptyString(t.tasaOCuota)) {
          addFindingOnce({
            severity: "WARNING",
            category: "TAX",
            code: "CONCEPT_TAX_RATE_REQUIRED",
            title: "TasaOCuota faltante en impuesto",
            message: "El impuesto tiene TipoFactor Tasa/Cuota, pero no contiene TasaOCuota.",
            recommendedAction: "Revisa la tasa o cuota del impuesto a nivel concepto.",
            evidence: [
              { label: "Concepto #", value: String(cn) },
              { label: "Impuesto", value: t.impuesto ?? "—" },
              { label: "TipoFactor", value: tf },
              { label: "Base", value: t.base ?? "—" },
              { label: "Importe", value: t.importe ?? "—" },
            ],
          });
        }
      }
      for (const r of allWithheld) {
        const tf = normalizeTipoFactor(r.tipoFactor);
        if ((tf === "Tasa" || tf === "Cuota") && !isNonEmptyString(r.tasaOCuota)) {
          addFindingOnce({
            severity: "WARNING",
            category: "TAX",
            code: "CONCEPT_TAX_RATE_REQUIRED",
            title: "TasaOCuota faltante en impuesto",
            message: "El impuesto tiene TipoFactor Tasa/Cuota, pero no contiene TasaOCuota.",
            recommendedAction: "Revisa la tasa o cuota del impuesto a nivel concepto.",
            evidence: [
              { label: "Concepto #", value: String(cn) },
              { label: "Impuesto", value: r.impuesto ?? "—" },
              { label: "TipoFactor", value: tf },
              { label: "Base", value: r.base ?? "—" },
              { label: "Importe", value: r.importe ?? "—" },
            ],
          });
        }
      }

      // K) CONCEPT_TAX_AMOUNT_REQUIRED
      for (const t of allTransferred) {
        const tf = normalizeTipoFactor(t.tipoFactor);
        if ((tf === "Tasa" || tf === "Cuota") && !isNonEmptyString(t.importe)) {
          addFindingOnce({
            severity: "WARNING",
            category: "TAX",
            code: "CONCEPT_TAX_AMOUNT_REQUIRED",
            title: "Importe de impuesto faltante",
            message: "El impuesto tiene TipoFactor Tasa/Cuota, pero no contiene Importe.",
            recommendedAction: "Revisa el importe calculado del impuesto a nivel concepto.",
            evidence: [
              { label: "Concepto #", value: String(cn) },
              { label: "Impuesto", value: t.impuesto ?? "—" },
              { label: "TipoFactor", value: tf },
              { label: "Base", value: t.base ?? "—" },
              { label: "TasaOCuota", value: t.tasaOCuota ?? "—" },
            ],
          });
        }
      }
      for (const r of allWithheld) {
        const tf = normalizeTipoFactor(r.tipoFactor);
        if ((tf === "Tasa" || tf === "Cuota") && !isNonEmptyString(r.importe)) {
          addFindingOnce({
            severity: "WARNING",
            category: "TAX",
            code: "CONCEPT_TAX_AMOUNT_REQUIRED",
            title: "Importe de impuesto faltante",
            message: "El impuesto tiene TipoFactor Tasa/Cuota, pero no contiene Importe.",
            recommendedAction: "Revisa el importe calculado del impuesto a nivel concepto.",
            evidence: [
              { label: "Concepto #", value: String(cn) },
              { label: "Impuesto", value: r.impuesto ?? "—" },
              { label: "TipoFactor", value: tf },
              { label: "Base", value: r.base ?? "—" },
              { label: "TasaOCuota", value: r.tasaOCuota ?? "—" },
            ],
          });
        }
      }

      // L) CONCEPT_TAX_EXEMPT_WITH_AMOUNT
      for (const t of allTransferred) {
        const tf = normalizeTipoFactor(t.tipoFactor);
        if (tf === "Exento" && isNonEmptyString(t.importe)) {
          const importeNum = toMoneyNumber(t.importe);
          if (importeNum > 0) {
            addFindingOnce({
              severity: "WARNING",
              category: "TAX",
              code: "CONCEPT_TAX_EXEMPT_WITH_AMOUNT",
              title: "Impuesto exento con importe",
              message: "Un traslado exento contiene Importe mayor a cero.",
              recommendedAction: "Revisa el tratamiento exento del impuesto en el concepto.",
              evidence: [
                { label: "Concepto #", value: String(cn) },
                { label: "Impuesto", value: t.impuesto ?? "—" },
                { label: "TipoFactor", value: tf },
                { label: "Base", value: t.base ?? "—" },
                { label: "Importe", value: t.importe },
              ],
            });
          }
        }
      }

      // M) CONCEPT_TAX_AMOUNT_MISMATCH
      for (const t of allTransferred) {
        const tf = normalizeTipoFactor(t.tipoFactor);
        if (
          tf === "Tasa" &&
          isNonEmptyString(t.base) &&
          isNonEmptyString(t.tasaOCuota) &&
          isNonEmptyString(t.importe)
        ) {
          const baseNum = toMoneyNumber(t.base);
          const tasaNum = normalizeRate(t.tasaOCuota);
          const importeXml = toMoneyNumber(t.importe);
          if (baseNum > 0 && tasaNum !== null && tasaNum > 0) {
            const calculado = calculateTaxAmount(baseNum, tasaNum);
            const diff = moneyDiff(calculado, importeXml);
            if (diff > 0.01) {
              addFindingOnce({
                severity: "CRITICAL",
                category: "TAX",
                code: "CONCEPT_TAX_AMOUNT_MISMATCH",
                title: "Importe de impuesto no coincide con base por tasa",
                message:
                  "El importe del impuesto a nivel concepto no coincide con la base multiplicada por la tasa.",
                recommendedAction:
                  "Revisa Base, TasaOCuota e Importe del impuesto dentro del concepto antes de utilizar este XML.",
                evidence: [
                  { label: "Concepto #", value: String(cn) },
                  { label: "Impuesto", value: t.impuesto ?? "—" },
                  { label: "TipoFactor", value: tf },
                  { label: "Base", value: t.base },
                  { label: "TasaOCuota", value: t.tasaOCuota },
                  { label: "Importe XML", value: t.importe },
                  { label: "Importe calculado", value: formatMoney(calculado) },
                  { label: "Diferencia", value: formatMoney(diff) },
                  { label: "Tolerancia", value: "0.01" },
                ],
              });
            }
          }
        }
      }

      // N) CONCEPT_WITHHELD_TAX_WITH_EXEMPT_FACTOR
      for (const r of allWithheld) {
        const tf = normalizeTipoFactor(r.tipoFactor);
        if (tf === "Exento") {
          addFindingOnce({
            severity: "WARNING",
            category: "TAX",
            code: "CONCEPT_WITHHELD_TAX_WITH_EXEMPT_FACTOR",
            title: "Retención con TipoFactor Exento",
            message:
              "Se detectó una retención con TipoFactor Exento, lo cual es inusual y requiere revisión.",
            recommendedAction: "Verifica la estructura de la retención dentro del concepto.",
            evidence: [
              { label: "Concepto #", value: String(cn) },
              { label: "Impuesto", value: r.impuesto ?? "—" },
              { label: "TipoFactor", value: tf },
              { label: "Base", value: r.base ?? "—" },
              { label: "Importe", value: r.importe ?? "—" },
            ],
          });
        }
      }
    });
  }

  // ── Concept-level non-tax findings ──
  if (concepts && concepts.length > 0) {
    concepts.forEach((c, idx) => {
      const cn = idx + 1;

      // O) CONCEPT_NEGATIVE_IMPORT
      if (isNonEmptyString(c.importe)) {
        const impNum = toMoneyNumber(c.importe);
        if (impNum < 0) {
          addFindingOnce({
            severity: "WARNING",
            category: "TAX",
            code: "CONCEPT_NEGATIVE_IMPORT",
            title: "Importe negativo en concepto",
            message:
              "Un concepto contiene importe negativo. Esto puede ser inusual dependiendo del tipo de comprobante.",
            recommendedAction:
              "Revisa si el importe negativo es procedente o si debe representarse mediante un CFDI de egreso.",
            evidence: [
              { label: "Concepto #", value: String(cn) },
              { label: "Tipo comprobante", value: tipoComprobante ?? "—" },
              { label: "Importe", value: c.importe },
              { label: "Descripción", value: c.descripcion ?? "—" },
            ],
          });
        }
      }

      // P) CONCEPT_DISCOUNT_EXCEEDS_IMPORT
      if (isNonEmptyString(c.descuento) && isNonEmptyString(c.importe)) {
        const descNum = toMoneyNumber(c.descuento);
        const impNum = toMoneyNumber(c.importe);
        if (descNum > impNum + 0.01) {
          addFindingOnce({
            severity: "CRITICAL",
            category: "TAX",
            code: "CONCEPT_DISCOUNT_EXCEEDS_IMPORT",
            title: "Descuento mayor al importe del concepto",
            message: "El descuento del concepto es mayor al importe del concepto.",
            recommendedAction:
              "Revisa Importe y Descuento del concepto antes de utilizar este XML.",
            evidence: [
              { label: "Concepto #", value: String(cn) },
              { label: "Importe", value: c.importe },
              { label: "Descuento", value: c.descuento },
              { label: "Diferencia", value: formatMoney(descNum - impNum) },
              { label: "Descripción", value: c.descripcion ?? "—" },
            ],
          });
        }
      }

      // Q) CONCEPT_ZERO_QUANTITY_REVIEW
      if (isNonEmptyString(c.cantidad)) {
        const qty = parseFloat(c.cantidad!.trim());
        if (isNaN(qty) || qty <= 0) {
          addFindingOnce({
            severity: "WARNING",
            category: "TAX",
            code: "CONCEPT_ZERO_QUANTITY_REVIEW",
            title: "Cantidad inválida en concepto",
            message: "La cantidad del concepto no tiene un valor numérico positivo.",
            recommendedAction: "Revisa la cantidad capturada en el concepto.",
            evidence: [
              { label: "Concepto #", value: String(cn) },
              { label: "Cantidad", value: c.cantidad! },
              { label: "Clave unidad", value: c.claveUnidad ?? "—" },
              { label: "Descripción", value: c.descripcion ?? "—" },
            ],
          });
        }
      }

      // R) CONCEPT_UNIT_VALUE_MISMATCH_REVIEW
      if (
        isNonEmptyString(c.cantidad) &&
        isNonEmptyString(c.valorUnitario) &&
        isNonEmptyString(c.importe)
      ) {
        const qty = parseFloat(c.cantidad!.trim());
        const unitVal = parseFloat(c.valorUnitario!.trim());
        const impNum = toMoneyNumber(c.importe);
        if (!isNaN(qty) && !isNaN(unitVal) && qty > 0 && unitVal > 0) {
          const calculado = Math.round(qty * unitVal * 100) / 100;
          const diff = moneyDiff(calculado, impNum);
          if (diff > 0.01) {
            addFindingOnce({
              severity: "WARNING",
              category: "TAX",
              code: "CONCEPT_UNIT_VALUE_MISMATCH_REVIEW",
              title: "Importe del concepto no coincide con cantidad por valor unitario",
              message:
                "El importe del concepto no coincide con cantidad multiplicada por valor unitario.",
              recommendedAction: "Revisa cantidad, valor unitario e importe del concepto.",
              evidence: [
                { label: "Concepto #", value: String(cn) },
                { label: "Cantidad", value: c.cantidad },
                { label: "Valor unitario", value: c.valorUnitario },
                { label: "Importe XML", value: c.importe },
                { label: "Importe calculado", value: formatMoney(calculado) },
                { label: "Diferencia", value: formatMoney(diff) },
                { label: "Tolerancia", value: "0.01" },
              ],
            });
          }
        }
      }
    });
  }

  // ── Global Tax Findings ──
  if (
    globalTaxes !== null ||
    (concepts &&
      concepts.length > 0 &&
      (hasAnyConceptTransferredTaxes(concepts) || hasAnyConceptWithheldTaxes(concepts)))
  ) {
    const isPagoType = isTipoComprobantePago(tipoComprobante);
    const hasConceptTraslados = concepts ? hasAnyConceptTransferredTaxes(concepts) : false;
    const hasConceptRetenciones = concepts ? hasAnyConceptWithheldTaxes(concepts) : false;
    const hasGlobalNode = globalTaxes !== null;
    const hasGlobalTransferred = hasGlobalNode && globalTaxes!.transferred.length > 0;
    const hasGlobalWithheld = hasGlobalNode && globalTaxes!.withheld.length > 0;

    const conceptTrasladosGroup = concepts
      ? sumConceptTaxesByGroup(concepts, "TRANSFERRED")
      : new Map<string, number>();
    const conceptRetencionesGroup = concepts
      ? sumConceptTaxesByGroup(concepts, "WITHHELD")
      : new Map<string, number>();
    const globalTrasladosGroup = hasGlobalNode
      ? sumGlobalTaxesByGroup(globalTaxes!, "TRANSFERRED")
      : new Map<string, number>();
    const globalRetencionesGroup = hasGlobalNode
      ? sumGlobalTaxesByGroup(globalTaxes!, "WITHHELD")
      : new Map<string, number>();

    const sumTrasladosConceptos = Array.from(conceptTrasladosGroup.values()).reduce(
      (a, b) => a + b,
      0,
    );
    const sumRetencionesConceptos = Array.from(conceptRetencionesGroup.values()).reduce(
      (a, b) => a + b,
      0,
    );

    const sumTrasladosGlobales = Array.from(globalTrasladosGroup.values()).reduce(
      (a, b) => a + b,
      0,
    );
    const sumRetencionesGlobales = Array.from(globalRetencionesGroup.values()).reduce(
      (a, b) => a + b,
      0,
    );

    // A) GLOBAL_TAXES_MISSING_WITH_CONCEPT_TAXES
    if ((hasConceptTraslados || hasConceptRetenciones) && !hasGlobalNode) {
      addFindingOnce({
        severity: "WARNING",
        category: "TAX",
        code: "GLOBAL_TAXES_MISSING_WITH_CONCEPT_TAXES",
        title: "Nodo global de impuestos no detectado",
        message:
          "El CFDI contiene impuestos a nivel concepto, pero no se detectó el nodo global de Impuestos.",
        recommendedAction:
          "Revisa que el XML incluya el resumen global de impuestos cuando aplique.",
        evidence: [
          { label: "Total traslados por concepto", value: formatMoney(sumTrasladosConceptos) },
          { label: "Total retenciones por concepto", value: formatMoney(sumRetencionesConceptos) },
          { label: "Tipo comprobante", value: tipoComprobante ?? "—" },
          { label: "UUID", value: uuid ?? "—" },
        ],
      });
    }

    // B) GLOBAL_TRANSFERRED_TOTAL_MISMATCH
    if (
      hasGlobalNode &&
      globalTaxes!.totalImpuestosTrasladados !== null &&
      sumTrasladosGlobales > 0
    ) {
      const totalTrasladadosNum = toMoneyNumber(globalTaxes!.totalImpuestosTrasladados);
      const diff = moneyDiff(totalTrasladadosNum, sumTrasladosGlobales);
      if (diff > 0.01) {
        addFindingOnce({
          severity: "CRITICAL",
          category: "TAX",
          code: "GLOBAL_TRANSFERRED_TOTAL_MISMATCH",
          title: "TotalImpuestosTrasladados no coincide con traslados globales",
          message:
            "El TotalImpuestosTrasladados del nodo global no coincide con la suma de los traslados globales.",
          recommendedAction:
            "Revisa el resumen global de impuestos trasladados antes de utilizar este XML.",
          evidence: [
            {
              label: "TotalImpuestosTrasladados XML",
              value: globalTaxes!.totalImpuestosTrasladados!,
            },
            { label: "Suma traslados globales", value: formatMoney(sumTrasladosGlobales) },
            { label: "Diferencia", value: formatMoney(diff) },
            { label: "Tolerancia", value: "0.01" },
          ],
        });
      }
    }

    // C) GLOBAL_WITHHELD_TOTAL_MISMATCH
    if (
      hasGlobalNode &&
      globalTaxes!.totalImpuestosRetenidos !== null &&
      sumRetencionesGlobales > 0
    ) {
      const totalRetenidosNum = toMoneyNumber(globalTaxes!.totalImpuestosRetenidos);
      const diff = moneyDiff(totalRetenidosNum, sumRetencionesGlobales);
      if (diff > 0.01) {
        addFindingOnce({
          severity: "CRITICAL",
          category: "TAX",
          code: "GLOBAL_WITHHELD_TOTAL_MISMATCH",
          title: "TotalImpuestosRetenidos no coincide con retenciones globales",
          message:
            "El TotalImpuestosRetenidos del nodo global no coincide con la suma de las retenciones globales.",
          recommendedAction:
            "Revisa el resumen global de impuestos retenidos antes de utilizar este XML.",
          evidence: [
            { label: "TotalImpuestosRetenidos XML", value: globalTaxes!.totalImpuestosRetenidos! },
            { label: "Suma retenciones globales", value: formatMoney(sumRetencionesGlobales) },
            { label: "Diferencia", value: formatMoney(diff) },
            { label: "Tolerancia", value: "0.01" },
          ],
        });
      }
    }

    // D) GLOBAL_TRANSFERRED_CONCEPT_SUM_MISMATCH
    if (conceptTrasladosGroup.size > 0 && globalTrasladosGroup.size > 0) {
      for (const [key, sumaConceptos] of conceptTrasladosGroup.entries()) {
        const importeGlobal = globalTrasladosGroup.get(key);
        if (importeGlobal === undefined) continue;
        const parts = key.split("|");
        const tipoFactor = parts[1] ?? "";
        if (normalizeTipoFactor(tipoFactor) === "Exento") continue;
        const diff = moneyDiff(sumaConceptos, importeGlobal);
        if (diff > 0.01) {
          addFindingOnce({
            severity: "CRITICAL",
            category: "TAX",
            code: "GLOBAL_TRANSFERRED_CONCEPT_SUM_MISMATCH",
            title: "Traslado global no coincide con suma de conceptos",
            message:
              "El importe de un traslado global no coincide con la suma de traslados por concepto para el mismo impuesto, tipo factor y tasa.",
            recommendedAction:
              "Revisa los impuestos trasladados por concepto y el resumen global del CFDI.",
            evidence: [
              { label: "Impuesto", value: parts[0] ?? "—" },
              { label: "TipoFactor", value: parts[1] ?? "—" },
              { label: "TasaOCuota", value: parts.slice(2).join("|") || "—" },
              { label: "Suma conceptos", value: formatMoney(sumaConceptos) },
              { label: "Importe global", value: formatMoney(importeGlobal) },
              { label: "Diferencia", value: formatMoney(diff) },
              { label: "Tolerancia", value: "0.01" },
            ],
          });
        }
      }
    }

    // E) GLOBAL_WITHHELD_CONCEPT_SUM_MISMATCH
    if (conceptRetencionesGroup.size > 0 && globalRetencionesGroup.size > 0) {
      for (const [key, sumaConceptos] of conceptRetencionesGroup.entries()) {
        const importeGlobal = globalRetencionesGroup.get(key);
        if (importeGlobal === undefined) continue;
        const parts = key.split("|");
        const diff = moneyDiff(sumaConceptos, importeGlobal);
        if (diff > 0.01) {
          addFindingOnce({
            severity: "CRITICAL",
            category: "TAX",
            code: "GLOBAL_WITHHELD_CONCEPT_SUM_MISMATCH",
            title: "Retención global no coincide con suma de conceptos",
            message:
              "El importe de una retención global no coincide con la suma de retenciones por concepto para el mismo impuesto, tipo factor y tasa.",
            recommendedAction: "Revisa las retenciones por concepto y el resumen global del CFDI.",
            evidence: [
              { label: "Impuesto", value: parts[0] ?? "—" },
              { label: "TipoFactor", value: parts[1] ?? "—" },
              { label: "TasaOCuota", value: parts.slice(2).join("|") || "—" },
              { label: "Suma conceptos", value: formatMoney(sumaConceptos) },
              { label: "Importe global", value: formatMoney(importeGlobal) },
              { label: "Diferencia", value: formatMoney(diff) },
              { label: "Tolerancia", value: "0.01" },
            ],
          });
        }
      }
    }

    // F) GLOBAL_TRANSFERRED_GROUP_MISSING
    if (conceptTrasladosGroup.size > 0) {
      for (const [key, sumaConceptos] of conceptTrasladosGroup.entries()) {
        const parts = key.split("|");
        const tipoFactor = parts[1] ?? "";
        if (normalizeTipoFactor(tipoFactor) === "Exento" && sumaConceptos <= 0) continue;
        if (!globalTrasladosGroup.has(key)) {
          addFindingOnce({
            severity: "WARNING",
            category: "TAX",
            code: "GLOBAL_TRANSFERRED_GROUP_MISSING",
            title: "Traslado global faltante",
            message:
              "Existe un traslado por concepto que no aparece en el resumen global de impuestos.",
            recommendedAction:
              "Revisa si el resumen global de impuestos trasladados está completo.",
            evidence: [
              { label: "Impuesto", value: parts[0] ?? "—" },
              { label: "TipoFactor", value: parts[1] ?? "—" },
              { label: "TasaOCuota", value: parts.slice(2).join("|") || "—" },
              { label: "Suma conceptos", value: formatMoney(sumaConceptos) },
            ],
          });
        }
      }
    }

    // G) GLOBAL_WITHHELD_GROUP_MISSING
    if (conceptRetencionesGroup.size > 0) {
      for (const [key, sumaConceptos] of conceptRetencionesGroup.entries()) {
        const parts = key.split("|");
        if (!globalRetencionesGroup.has(key)) {
          addFindingOnce({
            severity: "WARNING",
            category: "TAX",
            code: "GLOBAL_WITHHELD_GROUP_MISSING",
            title: "Retención global faltante",
            message:
              "Existe una retención por concepto que no aparece en el resumen global de impuestos.",
            recommendedAction: "Revisa si el resumen global de impuestos retenidos está completo.",
            evidence: [
              { label: "Impuesto", value: parts[0] ?? "—" },
              { label: "TipoFactor", value: parts[1] ?? "—" },
              { label: "TasaOCuota", value: parts.slice(2).join("|") || "—" },
              { label: "Suma conceptos", value: formatMoney(sumaConceptos) },
            ],
          });
        }
      }
    }

    // H) GLOBAL_TRANSFERRED_GROUP_WITHOUT_CONCEPTS
    if (globalTrasladosGroup.size > 0) {
      for (const [key, importeGlobal] of globalTrasladosGroup.entries()) {
        const parts = key.split("|");
        const tipoFactor = parts[1] ?? "";
        if (normalizeTipoFactor(tipoFactor) === "Exento" && importeGlobal <= 0) continue;
        if (!conceptTrasladosGroup.has(key)) {
          addFindingOnce({
            severity: "WARNING",
            category: "TAX",
            code: "GLOBAL_TRANSFERRED_GROUP_WITHOUT_CONCEPTS",
            title: "Traslado global sin respaldo en conceptos",
            message: "Existe un traslado global que no se detectó en impuestos por concepto.",
            recommendedAction: "Revisa si el traslado global corresponde a los conceptos del CFDI.",
            evidence: [
              { label: "Impuesto", value: parts[0] ?? "—" },
              { label: "TipoFactor", value: parts[1] ?? "—" },
              { label: "TasaOCuota", value: parts.slice(2).join("|") || "—" },
              { label: "Importe global", value: formatMoney(importeGlobal) },
            ],
          });
        }
      }
    }

    // I) GLOBAL_WITHHELD_GROUP_WITHOUT_CONCEPTS
    if (globalRetencionesGroup.size > 0) {
      for (const [key, importeGlobal] of globalRetencionesGroup.entries()) {
        const parts = key.split("|");
        if (!conceptRetencionesGroup.has(key)) {
          addFindingOnce({
            severity: "WARNING",
            category: "TAX",
            code: "GLOBAL_WITHHELD_GROUP_WITHOUT_CONCEPTS",
            title: "Retención global sin respaldo en conceptos",
            message: "Existe una retención global que no se detectó en impuestos por concepto.",
            recommendedAction:
              "Revisa si la retención global corresponde a los conceptos del CFDI.",
            evidence: [
              { label: "Impuesto", value: parts[0] ?? "—" },
              { label: "TipoFactor", value: parts[1] ?? "—" },
              { label: "TasaOCuota", value: parts.slice(2).join("|") || "—" },
              { label: "Importe global", value: formatMoney(importeGlobal) },
            ],
          });
        }
      }
    }

    // J) GLOBAL_TAX_NEGATIVE_AMOUNT
    if (hasGlobalNode) {
      for (const line of globalTaxes!.transferred) {
        if (line.importe !== null && line.importe !== undefined) {
          const imp = toMoneyNumber(line.importe);
          if (imp < 0) {
            addFindingOnce({
              severity: "WARNING",
              category: "TAX",
              code: "GLOBAL_TAX_NEGATIVE_AMOUNT",
              title: "Importe global de impuesto negativo",
              message: "Un impuesto global contiene importe negativo.",
              recommendedAction: "Revisa los importes del resumen global de impuestos.",
              evidence: [
                { label: "Tipo impuesto", value: "Traslado" },
                { label: "Impuesto", value: line.impuesto ?? "—" },
                { label: "TipoFactor", value: line.tipoFactor ?? "—" },
                { label: "TasaOCuota", value: line.tasaOCuota ?? "—" },
                { label: "Importe", value: line.importe! },
              ],
            });
          }
        }
      }
      for (const line of globalTaxes!.withheld) {
        if (line.importe !== null && line.importe !== undefined) {
          const imp = toMoneyNumber(line.importe);
          if (imp < 0) {
            addFindingOnce({
              severity: "WARNING",
              category: "TAX",
              code: "GLOBAL_TAX_NEGATIVE_AMOUNT",
              title: "Importe global de impuesto negativo",
              message: "Un impuesto global contiene importe negativo.",
              recommendedAction: "Revisa los importes del resumen global de impuestos.",
              evidence: [
                { label: "Tipo impuesto", value: "Retención" },
                { label: "Impuesto", value: line.impuesto ?? "—" },
                { label: "TipoFactor", value: line.tipoFactor ?? "—" },
                { label: "TasaOCuota", value: line.tasaOCuota ?? "—" },
                { label: "Importe", value: line.importe! },
              ],
            });
          }
        }
      }
    }

    // K) GLOBAL_TAX_DUPLICATE_GROUP_REVIEW
    if (hasGlobalNode) {
      const countGlobalLines = new Map<string, number>();
      for (const line of globalTaxes!.transferred) {
        const key =
          buildTaxGroupKey(line.impuesto, line.tipoFactor, line.tasaOCuota) + "|TRANSFERRED";
        countGlobalLines.set(key, (countGlobalLines.get(key) ?? 0) + 1);
      }
      for (const line of globalTaxes!.withheld) {
        const key = buildTaxGroupKey(line.impuesto, line.tipoFactor, line.tasaOCuota) + "|WITHHELD";
        countGlobalLines.set(key, (countGlobalLines.get(key) ?? 0) + 1);
      }
      for (const [key, count] of countGlobalLines.entries()) {
        if (count > 1) {
          const parts = key.split("|");
          addFindingOnce({
            severity: "INFO",
            category: "TAX",
            code: "GLOBAL_TAX_DUPLICATE_GROUP_REVIEW",
            title: "Grupo de impuesto global duplicado",
            message:
              "Se detectaron múltiples líneas globales para el mismo impuesto, tipo factor y tasa. Puede ser válido en algunos escenarios, pero requiere revisión.",
            recommendedAction:
              "Confirma si la duplicidad del grupo global de impuestos es intencional.",
            evidence: [
              {
                label: "Tipo impuesto",
                value: parts[3] === "TRANSFERRED" ? "Traslado" : "Retención",
              },
              { label: "Impuesto", value: parts[0] ?? "—" },
              { label: "TipoFactor", value: parts[1] ?? "—" },
              { label: "TasaOCuota", value: parts.slice(2, -1).join("|") || "—" },
              { label: "Apariciones", value: String(count) },
            ],
          });
        }
      }
    }

    // L) GLOBAL_TAX_TOTALS_NOT_PRESENT_REVIEW
    if (hasGlobalTransferred && !isNonEmptyString(globalTaxes!.totalImpuestosTrasladados)) {
      addFindingOnce({
        severity: "INFO",
        category: "TAX",
        code: "GLOBAL_TAX_TOTALS_NOT_PRESENT_REVIEW",
        title: "Total global de impuestos no declarado",
        message:
          "Se detectaron impuestos globales con importe, pero no se detectó TotalImpuestosTrasladados.",
        recommendedAction:
          "Revisa si el XML debe declarar TotalImpuestosTrasladados según el caso.",
        evidence: [
          { label: "Tipo total faltante", value: "TotalImpuestosTrasladados" },
          { label: "Suma líneas globales", value: formatMoney(sumTrasladosGlobales) },
          { label: "Tipo comprobante", value: tipoComprobante ?? "—" },
          { label: "UUID", value: uuid ?? "—" },
        ],
      });
    }
    if (hasGlobalWithheld && !isNonEmptyString(globalTaxes!.totalImpuestosRetenidos)) {
      addFindingOnce({
        severity: "INFO",
        category: "TAX",
        code: "GLOBAL_TAX_TOTALS_NOT_PRESENT_REVIEW",
        title: "Total global de impuestos no declarado",
        message:
          "Se detectaron impuestos globales con importe, pero no se detectó TotalImpuestosRetenidos.",
        recommendedAction: "Revisa si el XML debe declarar TotalImpuestosRetenidos según el caso.",
        evidence: [
          { label: "Tipo total faltante", value: "TotalImpuestosRetenidos" },
          { label: "Suma líneas globales", value: formatMoney(sumRetencionesGlobales) },
          { label: "Tipo comprobante", value: tipoComprobante ?? "—" },
          { label: "UUID", value: uuid ?? "—" },
        ],
      });
    }
  }

  // ── Comprobante-level Findings (A-W) ──
  const isIngresoEgreso =
    isTipoComprobanteIngreso(tipoComprobante) || isTipoComprobanteEgreso(tipoComprobante);
  const isTrasladoType = isTipoComprobanteTraslado(tipoComprobante);
  const isCfdi40 = rc(version, "4.0");
  const subtotalNum = toMoneyNumber(subtotal);
  const totalNum = toMoneyNumber(total);
  const descuentoNum = toMoneyNumber(descuento);

  // A) COMPROBANTE_MISSING_MONEDA
  if (!isPagoType && !isNonEmptyString(moneda)) {
    addFindingOnce({
      severity: "WARNING",
      category: "FISCAL",
      code: "COMPROBANTE_MISSING_MONEDA",
      title: "Moneda faltante en comprobante",
      message: "El comprobante no contiene Moneda en el nodo principal.",
      recommendedAction: "Revisa la moneda capturada en el CFDI.",
      evidence: [
        { label: "Tipo comprobante", value: tipoComprobante ?? "—" },
        { label: "UUID", value: uuid ?? "—" },
        { label: "Total", value: total ?? "—" },
      ],
    });
  }

  // B) COMPROBANTE_MONEDA_UNKNOWN_REVIEW
  if (isNonEmptyString(moneda) && !isKnownCurrencyBasic(moneda)) {
    addFindingOnce({
      severity: "INFO",
      category: "FISCAL",
      code: "COMPROBANTE_MONEDA_UNKNOWN_REVIEW",
      title: "Moneda requiere revisión",
      message:
        "El comprobante utiliza una moneda no reconocida por la lista básica del motor actual.",
      recommendedAction: "Confirma que la moneda sea válida para el CFDI.",
      evidence: [
        { label: "Moneda", value: moneda! },
        { label: "Tipo comprobante", value: tipoComprobante ?? "—" },
        { label: "Total", value: total ?? "—" },
      ],
    });
  }

  // C) COMPROBANTE_MONEDA_XXX_UNEXPECTED
  if (normalizeCurrency(moneda) === "XXX" && !isPagoType && !isTrasladoType) {
    addFindingOnce({
      severity: "WARNING",
      category: "FISCAL",
      code: "COMPROBANTE_MONEDA_XXX_UNEXPECTED",
      title: "Moneda XXX en comprobante no esperado",
      message:
        "El comprobante utiliza Moneda XXX en un tipo de comprobante donde normalmente se espera una moneda específica.",
      recommendedAction: "Revisa si el tipo de comprobante y la moneda capturada son correctos.",
      evidence: [
        { label: "Moneda", value: moneda ?? "—" },
        { label: "Tipo comprobante", value: tipoComprobante ?? "—" },
        { label: "UUID", value: uuid ?? "—" },
      ],
    });
  }

  // D) COMPROBANTE_TIPO_CAMBIO_REQUIRED
  if (
    isNonEmptyString(moneda) &&
    normalizeCurrency(moneda) !== "MXN" &&
    normalizeCurrency(moneda) !== "XXX" &&
    !isNonEmptyString(tipoCambio)
  ) {
    addFindingOnce({
      severity: "WARNING",
      category: "FISCAL",
      code: "COMPROBANTE_TIPO_CAMBIO_REQUIRED",
      title: "Tipo de cambio requerido",
      message: "El comprobante está en moneda distinta de MXN, pero no se detectó TipoCambio.",
      recommendedAction:
        "Revisa si el CFDI debe incluir TipoCambio conforme a la moneda utilizada.",
      evidence: [
        { label: "Moneda", value: moneda! },
        { label: "TipoCambio", value: tipoCambio ?? "—" },
        { label: "Total", value: total ?? "—" },
      ],
    });
  }

  // E) COMPROBANTE_TIPO_CAMBIO_INVALID
  if (isNonEmptyString(tipoCambio)) {
    const tcNum = toMoneyNumber(tipoCambio);
    if (tcNum <= 0) {
      addFindingOnce({
        severity: "WARNING",
        category: "FISCAL",
        code: "COMPROBANTE_TIPO_CAMBIO_INVALID",
        title: "Tipo de cambio inválido",
        message: "TipoCambio no tiene un valor numérico positivo.",
        recommendedAction: "Revisa el tipo de cambio capturado en el comprobante.",
        evidence: [
          { label: "Moneda", value: moneda ?? "—" },
          { label: "TipoCambio", value: tipoCambio! },
          { label: "UUID", value: uuid ?? "—" },
        ],
      });
    }
  }

  // F) COMPROBANTE_TIPO_CAMBIO_MXN_REVIEW
  if (
    normalizeCurrency(moneda) === "MXN" &&
    isNonEmptyString(tipoCambio) &&
    normalizeText(tipoCambio) !== "1" &&
    normalizeText(tipoCambio) !== "1.000000"
  ) {
    addFindingOnce({
      severity: "INFO",
      category: "FISCAL",
      code: "COMPROBANTE_TIPO_CAMBIO_MXN_REVIEW",
      title: "Tipo de cambio en MXN requiere revisión",
      message:
        "El comprobante está en MXN y contiene TipoCambio distinto de 1. Puede ser válido por estructura, pero conviene revisarlo.",
      recommendedAction: "Confirma que el TipoCambio sea correcto para un CFDI en MXN.",
      evidence: [
        { label: "Moneda", value: moneda ?? "—" },
        { label: "TipoCambio", value: tipoCambio! },
        { label: "UUID", value: uuid ?? "—" },
      ],
    });
  }

  // G) COMPROBANTE_MISSING_EXPORTACION
  if (isCfdi40 && !isNonEmptyString(exportacion)) {
    addFindingOnce({
      severity: "WARNING",
      category: "FISCAL",
      code: "COMPROBANTE_MISSING_EXPORTACION",
      title: "Exportación faltante",
      message: "El CFDI 4.0 no contiene el campo Exportacion.",
      recommendedAction: "Revisa el valor de Exportacion capturado en el comprobante.",
      evidence: [
        { label: "Versión", value: version ?? "—" },
        { label: "Tipo comprobante", value: tipoComprobante ?? "—" },
        { label: "RFC receptor", value: rfcReceptor ?? "—" },
        { label: "Moneda", value: moneda ?? "—" },
      ],
    });
  }

  // H) COMPROBANTE_EXPORTACION_REVIEW
  if (isNonEmptyString(exportacion) && !isKnownExportacion(exportacion)) {
    addFindingOnce({
      severity: "INFO",
      category: "FISCAL",
      code: "COMPROBANTE_EXPORTACION_REVIEW",
      title: "Valor de Exportacion requiere revisión",
      message: "El valor de Exportacion no está reconocido por la lista básica del motor actual.",
      recommendedAction: "Confirma que el valor de Exportacion sea válido para el CFDI.",
      evidence: [
        { label: "Exportacion", value: exportacion! },
        { label: "Tipo comprobante", value: tipoComprobante ?? "—" },
        { label: "RFC receptor", value: rfcReceptor ?? "—" },
      ],
    });
  }

  // I) COMPROBANTE_FOREIGN_RFC_WITHOUT_EXPORTACION_REVIEW
  if (
    isNonEmptyString(exportacion) &&
    isGenericForeignRfc(rfcReceptor) &&
    normalizeExportacion(exportacion) === "01"
  ) {
    addFindingOnce({
      severity: "INFO",
      category: "FISCAL",
      code: "COMPROBANTE_FOREIGN_RFC_WITHOUT_EXPORTACION_REVIEW",
      title: "RFC extranjero con Exportacion 01",
      message:
        "El receptor usa RFC genérico extranjero y el CFDI indica Exportacion 01. Puede ser válido según el caso, pero requiere revisión.",
      recommendedAction: "Confirma si la operación corresponde o no a exportación.",
      evidence: [
        { label: "RFC receptor", value: rfcReceptor ?? "—" },
        { label: "Exportacion", value: exportacion! },
        { label: "Moneda", value: moneda ?? "—" },
        { label: "Tipo comprobante", value: tipoComprobante ?? "—" },
      ],
    });
  }

  // J) COMPROBANTE_MISSING_LUGAR_EXPEDICION
  if (isCfdi40 && !isNonEmptyString(lugarExpedicion)) {
    addFindingOnce({
      severity: "WARNING",
      category: "FISCAL",
      code: "COMPROBANTE_MISSING_LUGAR_EXPEDICION",
      title: "LugarExpedicion faltante",
      message: "No se detectó LugarExpedicion en el comprobante.",
      recommendedAction: "Revisa el código postal del lugar de expedición capturado en el CFDI.",
      evidence: [
        { label: "Versión", value: version ?? "—" },
        { label: "UUID", value: uuid ?? "—" },
        { label: "RFC emisor", value: rfcEmisor ?? "—" },
      ],
    });
  }

  // K) COMPROBANTE_LUGAR_EXPEDICION_FORMAT_REVIEW
  if (isNonEmptyString(lugarExpedicion) && !looksLikePostalCode(lugarExpedicion)) {
    addFindingOnce({
      severity: "INFO",
      category: "FISCAL",
      code: "COMPROBANTE_LUGAR_EXPEDICION_FORMAT_REVIEW",
      title: "Formato de LugarExpedicion requiere revisión",
      message: "LugarExpedicion no tiene formato básico de código postal de 5 dígitos.",
      recommendedAction: "Confirma que el código postal de expedición sea correcto.",
      evidence: [
        { label: "LugarExpedicion", value: lugarExpedicion! },
        { label: "RFC emisor", value: rfcEmisor ?? "—" },
        { label: "UUID", value: uuid ?? "—" },
      ],
    });
  }

  // L) COMPROBANTE_FECHA_MISSING
  if (!isNonEmptyString(fecha)) {
    addFindingOnce({
      severity: "WARNING",
      category: "TECHNICAL",
      code: "COMPROBANTE_FECHA_MISSING",
      title: "Fecha del comprobante faltante",
      message: "No se detectó la fecha de emisión del comprobante.",
      recommendedAction: "Verifica que el XML incluya la fecha de emisión.",
      evidence: [
        { label: "UUID", value: uuid ?? "—" },
        { label: "Tipo comprobante", value: tipoComprobante ?? "—" },
      ],
    });
  }

  // M) COMPROBANTE_FECHA_INVALID
  if (isNonEmptyString(fecha)) {
    const parsedDate = parseCfdiDate(fecha);
    if (parsedDate === null) {
      addFindingOnce({
        severity: "WARNING",
        category: "TECHNICAL",
        code: "COMPROBANTE_FECHA_INVALID",
        title: "Fecha del comprobante inválida",
        message: "La fecha de emisión del comprobante no pudo interpretarse correctamente.",
        recommendedAction: "Revisa el formato de Fecha en el XML.",
        evidence: [
          { label: "Fecha", value: fecha! },
          { label: "UUID", value: uuid ?? "—" },
        ],
      });
    }
  }

  // N) COMPROBANTE_FECHA_FUTURE_REVIEW
  if (isNonEmptyString(fecha)) {
    const parsedDate = parseCfdiDate(fecha);
    if (parsedDate !== null && isFutureDateBeyondTolerance(parsedDate, new Date(), 10)) {
      addFindingOnce({
        severity: "INFO",
        category: "TECHNICAL",
        code: "COMPROBANTE_FECHA_FUTURE_REVIEW",
        title: "Fecha del comprobante en el futuro",
        message:
          "La fecha de emisión del comprobante parece estar en el futuro respecto al momento de análisis.",
        recommendedAction:
          "Confirma si la fecha del equipo/emisor o la fecha del CFDI son correctas.",
        evidence: [
          { label: "Fecha", value: fecha! },
          { label: "Fecha análisis", value: new Date().toISOString() },
          { label: "UUID", value: uuid ?? "—" },
        ],
      });
    }
  }

  // O) COMPROBANTE_METODO_PAGO_MISSING_REVIEW
  if (isIngresoEgreso && !isNonEmptyString(metodoPago)) {
    addFindingOnce({
      severity: "INFO",
      category: "FISCAL",
      code: "COMPROBANTE_METODO_PAGO_MISSING_REVIEW",
      title: "Método de pago no detectado",
      message:
        "No se detectó MetodoPago en un comprobante de ingreso/egreso. Puede ser válido según el caso, pero conviene revisarlo.",
      recommendedAction: "Confirma si el comprobante debe incluir MetodoPago.",
      evidence: [
        { label: "Tipo comprobante", value: tipoComprobante ?? "—" },
        { label: "MetodoPago", value: metodoPago ?? "—" },
        { label: "FormaPago", value: formaPago ?? "—" },
        { label: "UUID", value: uuid ?? "—" },
      ],
    });
  }

  // P) COMPROBANTE_FORMA_PAGO_MISSING_REVIEW
  if (isIngresoEgreso && !isNonEmptyString(formaPago)) {
    addFindingOnce({
      severity: "INFO",
      category: "FISCAL",
      code: "COMPROBANTE_FORMA_PAGO_MISSING_REVIEW",
      title: "Forma de pago no detectada",
      message:
        "No se detectó FormaPago en un comprobante de ingreso/egreso. Puede ser válido según el método de pago, pero conviene revisarlo.",
      recommendedAction: "Confirma si el comprobante debe incluir FormaPago.",
      evidence: [
        { label: "Tipo comprobante", value: tipoComprobante ?? "—" },
        { label: "MetodoPago", value: metodoPago ?? "—" },
        { label: "FormaPago", value: formaPago ?? "—" },
        { label: "UUID", value: uuid ?? "—" },
      ],
    });
  }

  // Q) COMPROBANTE_PPD_WITH_FORMA_PAGO_REVIEW
  if (
    isNonEmptyString(metodoPago) &&
    isNonEmptyString(formaPago) &&
    normalizePaymentMethod(metodoPago) === "PPD" &&
    normalizePaymentForm(formaPago) !== "99"
  ) {
    addFindingOnce({
      severity: "INFO",
      category: "FISCAL",
      code: "COMPROBANTE_PPD_WITH_FORMA_PAGO_REVIEW",
      title: "PPD con FormaPago distinta de 99",
      message:
        "El comprobante usa MetodoPago PPD y FormaPago distinta de 99. Puede requerir revisión fiscal.",
      recommendedAction: "Revisa si la FormaPago debe corresponder a pago por definir.",
      evidence: [
        { label: "MetodoPago", value: metodoPago! },
        { label: "FormaPago", value: formaPago! },
        { label: "Tipo comprobante", value: tipoComprobante ?? "—" },
        { label: "UUID", value: uuid ?? "—" },
      ],
    });
  }

  // R) COMPROBANTE_PUE_WITH_FORMA_PAGO_99_REVIEW
  if (
    isNonEmptyString(metodoPago) &&
    isNonEmptyString(formaPago) &&
    normalizePaymentMethod(metodoPago) === "PUE" &&
    normalizePaymentForm(formaPago) === "99"
  ) {
    addFindingOnce({
      severity: "INFO",
      category: "FISCAL",
      code: "COMPROBANTE_PUE_WITH_FORMA_PAGO_99_REVIEW",
      title: "PUE con FormaPago 99",
      message:
        "El comprobante usa MetodoPago PUE con FormaPago 99. Puede requerir revisión fiscal.",
      recommendedAction: "Confirma si la forma de pago es consistente con el método de pago.",
      evidence: [
        { label: "MetodoPago", value: metodoPago! },
        { label: "FormaPago", value: formaPago! },
        { label: "Tipo comprobante", value: tipoComprobante ?? "—" },
        { label: "UUID", value: uuid ?? "—" },
      ],
    });
  }

  // S) COMPROBANTE_SUBTOTAL_NEGATIVE
  if (isNonEmptyString(subtotal) && subtotalNum < 0) {
    addFindingOnce({
      severity: "WARNING",
      category: "TOTALS",
      code: "COMPROBANTE_SUBTOTAL_NEGATIVE",
      title: "Subtotal negativo",
      message: "El subtotal del comprobante es negativo.",
      recommendedAction: "Revisa los importes del comprobante.",
      evidence: [
        { label: "SubTotal", value: subtotal! },
        { label: "Tipo comprobante", value: tipoComprobante ?? "—" },
        { label: "UUID", value: uuid ?? "—" },
      ],
    });
  }

  // T) COMPROBANTE_TOTAL_NEGATIVE
  if (isNonEmptyString(total) && totalNum < 0) {
    addFindingOnce({
      severity: "WARNING",
      category: "TOTALS",
      code: "COMPROBANTE_TOTAL_NEGATIVE",
      title: "Total negativo",
      message: "El total del comprobante es negativo.",
      recommendedAction: "Revisa el total del CFDI.",
      evidence: [
        { label: "Total", value: total! },
        { label: "Tipo comprobante", value: tipoComprobante ?? "—" },
        { label: "UUID", value: uuid ?? "—" },
      ],
    });
  }

  // U) COMPROBANTE_DESCUENTO_EXCEEDS_SUBTOTAL
  if (
    isNonEmptyString(descuento) &&
    isNonEmptyString(subtotal) &&
    descuentoNum > subtotalNum + 0.01
  ) {
    addFindingOnce({
      severity: "CRITICAL",
      category: "TOTALS",
      code: "COMPROBANTE_DESCUENTO_EXCEEDS_SUBTOTAL",
      title: "Descuento mayor al subtotal",
      message: "El descuento global es mayor al subtotal del comprobante.",
      recommendedAction: "Revisa SubTotal y Descuento antes de utilizar este XML.",
      evidence: [
        { label: "SubTotal", value: subtotal! },
        { label: "Descuento", value: descuento! },
        { label: "Diferencia", value: formatMoney(descuentoNum - subtotalNum) },
        { label: "UUID", value: uuid ?? "—" },
      ],
    });
  }

  // V) COMPROBANTE_SUBTOTAL_CONCEPT_SUM_MISMATCH
  if (!isPagoType && isNonEmptyString(subtotal) && concepts && concepts.length > 0) {
    const sumaConceptos = concepts.reduce((acc, c) => acc + toMoneyNumber(c.importe), 0);
    const diff = moneyDiff(subtotalNum, sumaConceptos);
    if (diff > 0.01) {
      addFindingOnce({
        severity: "CRITICAL",
        category: "TOTALS",
        code: "COMPROBANTE_SUBTOTAL_CONCEPT_SUM_MISMATCH",
        title: "Subtotal no coincide con suma de conceptos",
        message: "El SubTotal del comprobante no coincide con la suma de importes de conceptos.",
        recommendedAction: "Revisa los importes de conceptos y el SubTotal del CFDI.",
        evidence: [
          { label: "SubTotal XML", value: subtotal! },
          { label: "Suma conceptos", value: formatMoney(sumaConceptos) },
          { label: "Diferencia", value: formatMoney(diff) },
          { label: "Tolerancia", value: "0.01" },
        ],
      });
    }
  }

  // W) COMPROBANTE_TOTAL_ZERO_REVIEW
  if (isNonEmptyString(total) && totalNum === 0 && !isPagoType && !isTrasladoType) {
    addFindingOnce({
      severity: "INFO",
      category: "TOTALS",
      code: "COMPROBANTE_TOTAL_ZERO_REVIEW",
      title: "Total cero requiere revisión",
      message:
        "El comprobante tiene Total igual a cero en un tipo de comprobante donde puede requerir revisión.",
      recommendedAction:
        "Confirma si el total cero corresponde al escenario fiscal del comprobante.",
      evidence: [
        { label: "Total", value: total! },
        { label: "Tipo comprobante", value: tipoComprobante ?? "—" },
        { label: "UUID", value: uuid ?? "—" },
      ],
    });
  }

  // ── Concept Advanced Validations ──
  if (concepts) {
    validateConceptsAdvanced({
      concepts,
      subtotal,
      descuento,
      total,
      tipoComprobante,
      isPagoType,
      addFinding: (code, severity, title, message, recommendedAction, evidence) => {
        const category =
          code.startsWith("CONCEPT_DISCOUNT_") || code.startsWith("CONCEPT_GLOBAL_DISCOUNT_")
            ? "TAX"
            : code.startsWith("CONCEPTS_TOTAL_") || code.startsWith("CFDI_WITHOUT_")
              ? "TOTALS"
              : code.startsWith("CONCEPT_IMPORT_") ||
                  code.startsWith("CONCEPT_ZERO_IMPORT_") ||
                  code.startsWith("CONCEPT_ROUNDING_")
                ? "TAX"
                : "FISCAL";
        addFindingOnce({
          severity,
          category,
          code,
          title,
          message,
          recommendedAction,
          evidence,
        });
      },
    });
  }

  // ── Catalog Unknown Findings ──

  // A) COMPROBANTE_TIPO_COMPROBANTE_UNKNOWN
  if (isNonEmptyString(tipoComprobante) && !isKnownTipoComprobante(tipoComprobante)) {
    addFindingOnce({
      severity: "WARNING",
      category: "FISCAL",
      code: "COMPROBANTE_TIPO_COMPROBANTE_UNKNOWN",
      title: "Tipo de comprobante no reconocido",
      message: "El tipo de comprobante no está reconocido por el catálogo mínimo local del motor.",
      recommendedAction: "Verifica que TipoDeComprobante corresponda a un valor válido para CFDI.",
      evidence: [
        { label: "Tipo comprobante", value: tipoComprobante! },
        { label: "UUID", value: uuid ?? "—" },
        { label: "Versión", value: version ?? "—" },
      ],
    });
  }

  // B) COMPROBANTE_METODO_PAGO_UNKNOWN_REVIEW
  if (isNonEmptyString(metodoPago) && !isKnownMetodoPago(metodoPago)) {
    addFindingOnce({
      severity: "INFO",
      category: "FISCAL",
      code: "COMPROBANTE_METODO_PAGO_UNKNOWN_REVIEW",
      title: "Método de pago no reconocido",
      message: "El método de pago no está reconocido por el catálogo mínimo local del motor.",
      recommendedAction: "Revisa que MetodoPago sea válido para el CFDI.",
      evidence: [
        { label: "MetodoPago", value: metodoPago! },
        { label: "Tipo comprobante", value: tipoComprobante ?? "—" },
        { label: "FormaPago", value: formaPago ?? "—" },
        { label: "UUID", value: uuid ?? "—" },
      ],
    });
  }

  // C) COMPROBANTE_FORMA_PAGO_UNKNOWN_REVIEW
  if (isNonEmptyString(formaPago) && !isKnownFormaPago(formaPago)) {
    addFindingOnce({
      severity: "INFO",
      category: "FISCAL",
      code: "COMPROBANTE_FORMA_PAGO_UNKNOWN_REVIEW",
      title: "Forma de pago no reconocida",
      message: "FormaPago no está reconocida por el catálogo mínimo local del motor.",
      recommendedAction: "Revisa que FormaPago sea válida para el CFDI.",
      evidence: [
        { label: "FormaPago", value: formaPago! },
        { label: "MetodoPago", value: metodoPago ?? "—" },
        { label: "Tipo comprobante", value: tipoComprobante ?? "—" },
        { label: "UUID", value: uuid ?? "—" },
      ],
    });
  }

  // D) COMPROBANTE_OBJETO_IMP_UNKNOWN_REVIEW
  if (concepts && concepts.length > 0) {
    for (let cn = 0; cn < concepts.length; cn++) {
      const c = concepts[cn];
      if (isNonEmptyString(c.objetoImp) && !isKnownObjetoImp(c.objetoImp)) {
        addFindingOnce({
          severity: "INFO",
          category: "TAX",
          code: "COMPROBANTE_OBJETO_IMP_UNKNOWN_REVIEW",
          title: "ObjetoImp no reconocido",
          message:
            "El valor de ObjetoImp del concepto no está reconocido por el catálogo mínimo local del motor.",
          recommendedAction: "Revisa que ObjetoImp corresponda al tratamiento fiscal del concepto.",
          evidence: [
            { label: "Concepto #", value: String(cn + 1) },
            { label: "ObjetoImp", value: c.objetoImp! },
            { label: "Descripción", value: c.descripcion ?? "—" },
          ],
        });
      }
    }
  }

  // E) COMPROBANTE_TIPO_FACTOR_UNKNOWN_REVIEW
  if (concepts && concepts.length > 0) {
    for (let cn = 0; cn < concepts.length; cn++) {
      const c = concepts[cn];
      if (!c.impuestos) continue;
      const allTransferred = getConceptTransferredTaxes(c);
      const allWithheld = getConceptWithheldTaxes(c);
      for (const t of allTransferred) {
        if (isNonEmptyString(t.tipoFactor) && !isKnownTipoFactor(t.tipoFactor)) {
          addFindingOnce({
            severity: "INFO",
            category: "TAX",
            code: "COMPROBANTE_TIPO_FACTOR_UNKNOWN_REVIEW",
            title: "TipoFactor no reconocido",
            message:
              "El TipoFactor del impuesto no está reconocido por el catálogo mínimo local del motor.",
            recommendedAction: "Revisa que TipoFactor corresponda a Tasa, Cuota o Exento.",
            evidence: [
              { label: "Concepto #", value: String(cn + 1) },
              { label: "Tipo impuesto", value: "Traslado" },
              { label: "Impuesto", value: t.impuesto ?? "—" },
              { label: "TipoFactor", value: t.tipoFactor! },
              { label: "TasaOCuota", value: t.tasaOCuota ?? "—" },
            ],
          });
        }
      }
      for (const r of allWithheld) {
        if (isNonEmptyString(r.tipoFactor) && !isKnownTipoFactor(r.tipoFactor)) {
          addFindingOnce({
            severity: "INFO",
            category: "TAX",
            code: "COMPROBANTE_TIPO_FACTOR_UNKNOWN_REVIEW",
            title: "TipoFactor no reconocido",
            message:
              "El TipoFactor del impuesto no está reconocido por el catálogo mínimo local del motor.",
            recommendedAction: "Revisa que TipoFactor corresponda a Tasa, Cuota o Exento.",
            evidence: [
              { label: "Concepto #", value: String(cn + 1) },
              { label: "Tipo impuesto", value: "Retención" },
              { label: "Impuesto", value: r.impuesto ?? "—" },
              { label: "TipoFactor", value: r.tipoFactor! },
              { label: "TasaOCuota", value: r.tasaOCuota ?? "—" },
            ],
          });
        }
      }
    }
  }

  // F) CFDI_RELATION_TIPO_RELACION_UNKNOWN_REVIEW
  if (cfdiRelations && cfdiRelations.groups.length > 0) {
    cfdiRelations.groups.forEach((group, groupIdx) => {
      if (isNonEmptyString(group.tipoRelacion) && !isKnownTipoRelacion(group.tipoRelacion)) {
        addFindingOnce({
          severity: "INFO",
          category: "FISCAL",
          code: "CFDI_RELATION_TIPO_RELACION_UNKNOWN_REVIEW",
          title: "TipoRelacion no reconocido",
          message: "El TipoRelacion no está reconocido por el catálogo mínimo local del motor.",
          recommendedAction:
            "Revisa que el tipo de relación sea válido para el escenario fiscal del CFDI.",
          evidence: [
            { label: "Grupo #", value: String(groupIdx + 1) },
            { label: "TipoRelacion", value: group.tipoRelacion! },
            { label: "UUID comprobante", value: uuid ?? "—" },
          ],
        });
      }
    });
  }

  // ── Tipo Comprobante Base Rules (G-K) ──

  // G) PAYMENT_CFDI_TOTAL_NOT_ZERO
  if (isPagoType && isNonEmptyString(total) && Math.abs(totalNum) > 0.01) {
    addFindingOnce({
      severity: "WARNING",
      category: "FISCAL",
      code: "PAYMENT_CFDI_TOTAL_NOT_ZERO",
      title: "CFDI de pago con total distinto de cero",
      message:
        "El comprobante de tipo Pago normalmente debe manejar Total igual a cero en el nodo principal.",
      recommendedAction:
        "Revisa si el XML corresponde a un REP válido y si los importes deben estar en el complemento de pagos.",
      evidence: [
        { label: "Tipo comprobante", value: tipoComprobante ?? "—" },
        { label: "Total", value: total! },
        { label: "Moneda", value: moneda ?? "—" },
        { label: "UUID", value: uuid ?? "—" },
      ],
    });
  }

  // H) PAYMENT_CFDI_SUBTOTAL_NOT_ZERO
  if (isPagoType && isNonEmptyString(subtotal) && Math.abs(subtotalNum) > 0.01) {
    addFindingOnce({
      severity: "WARNING",
      category: "FISCAL",
      code: "PAYMENT_CFDI_SUBTOTAL_NOT_ZERO",
      title: "CFDI de pago con subtotal distinto de cero",
      message:
        "El comprobante de tipo Pago normalmente debe manejar SubTotal igual a cero en el nodo principal.",
      recommendedAction: "Revisa si el XML corresponde a un REP válido.",
      evidence: [
        { label: "Tipo comprobante", value: tipoComprobante ?? "—" },
        { label: "SubTotal", value: subtotal! },
        { label: "Moneda", value: moneda ?? "—" },
        { label: "UUID", value: uuid ?? "—" },
      ],
    });
  }

  // I) PAYMENT_CFDI_MONEDA_NOT_XXX
  if (isPagoType && isNonEmptyString(moneda) && normalizeCurrency(moneda) !== "XXX") {
    addFindingOnce({
      severity: "WARNING",
      category: "FISCAL",
      code: "PAYMENT_CFDI_MONEDA_NOT_XXX",
      title: "CFDI de pago con moneda distinta de XXX",
      message: "El comprobante de tipo Pago normalmente utiliza Moneda XXX en el nodo principal.",
      recommendedAction: "Revisa la moneda del nodo principal del REP.",
      evidence: [
        { label: "Tipo comprobante", value: tipoComprobante ?? "—" },
        { label: "Moneda", value: moneda! },
        { label: "UUID", value: uuid ?? "—" },
      ],
    });
  }

  // J) NOMINA_CFDI_WITHOUT_NOMINA_COMPLEMENT
  if (
    isNonEmptyString(tipoComprobante) &&
    tipoComprobante!.trim().toUpperCase() === "N" &&
    !nomina
  ) {
    addFindingOnce({
      severity: "WARNING",
      category: "COMPLEMENT",
      code: "NOMINA_CFDI_WITHOUT_NOMINA_COMPLEMENT",
      title: "CFDI de Nómina sin complemento Nómina",
      message: "El comprobante es de tipo Nómina, pero no se detectó complemento Nómina.",
      recommendedAction: "Verifica que el XML incluya el complemento Nómina correspondiente.",
      evidence: [
        { label: "Tipo comprobante", value: tipoComprobante ?? "—" },
        { label: "UUID", value: uuid ?? "—" },
        { label: "RFC receptor", value: rfcReceptor ?? "—" },
      ],
    });
  }

  // K) TRASLADO_CFDI_WITH_PAYMENT_FIELDS_REVIEW
  if (isTrasladoType && (isNonEmptyString(metodoPago) || isNonEmptyString(formaPago))) {
    addFindingOnce({
      severity: "INFO",
      category: "FISCAL",
      code: "TRASLADO_CFDI_WITH_PAYMENT_FIELDS_REVIEW",
      title: "CFDI de traslado con campos de pago",
      message:
        "El comprobante de traslado contiene MetodoPago o FormaPago. Puede ser válido en estructuras específicas, pero requiere revisión.",
      recommendedAction: "Confirma si los campos de pago son procedentes para el CFDI de traslado.",
      evidence: [
        { label: "Tipo comprobante", value: tipoComprobante ?? "—" },
        { label: "MetodoPago", value: metodoPago ?? "—" },
        { label: "FormaPago", value: formaPago ?? "—" },
        { label: "UUID", value: uuid ?? "—" },
      ],
    });
  }

  // ── UsoCFDI & Payment Consistency Findings (A-H) ──

  const usoCfdiLabel = getUsoCfdiLabel(usoCfdi);
  const metodoPagoLabel = getMetodoPagoLabel(metodoPago);
  const formaPagoLabel = getFormaPagoLabel(formaPago);

  // A) RECEPTOR_USO_CFDI_UNKNOWN_REVIEW
  if (isNonEmptyString(usoCfdi) && !isKnownUsoCfdi(usoCfdi)) {
    addFindingOnce({
      severity: "INFO",
      category: "FISCAL",
      code: "RECEPTOR_USO_CFDI_UNKNOWN_REVIEW",
      title: "UsoCFDI no reconocido",
      message: "El UsoCFDI no está reconocido por el catálogo mínimo local del motor.",
      recommendedAction: "Revisa que UsoCFDI corresponda a un valor válido para CFDI 4.0.",
      evidence: [
        { label: "UsoCFDI", value: usoCfdi! },
        { label: "Tipo comprobante", value: tipoComprobante ?? "—" },
        { label: "RFC receptor", value: rfcReceptor ?? "—" },
        { label: "UUID", value: uuid ?? "—" },
      ],
    });
  }

  // B) PAYMENT_USO_CFDI_NOT_CP01
  if (isPagoType && isNonEmptyString(usoCfdi) && usoCfdi !== "CP01") {
    addFindingOnce({
      severity: "WARNING",
      category: "FISCAL",
      code: "PAYMENT_USO_CFDI_NOT_CP01",
      title: "CFDI de pago con UsoCFDI distinto de CP01",
      message: "El comprobante de tipo Pago normalmente utiliza UsoCFDI CP01.",
      recommendedAction: "Revisa si el REP fue emitido con el UsoCFDI correcto.",
      evidence: [
        { label: "Tipo comprobante", value: tipoComprobante ?? "—" },
        { label: "UsoCFDI", value: usoCfdiLabel ? `${usoCfdi!} - ${usoCfdiLabel}` : usoCfdi! },
        { label: "UUID", value: uuid ?? "—" },
      ],
    });
  }

  // C) NOMINA_USO_CFDI_NOT_CN01
  if (
    isNonEmptyString(tipoComprobante) &&
    tipoComprobante!.trim().toUpperCase() === "N" &&
    isNonEmptyString(usoCfdi) &&
    usoCfdi !== "CN01"
  ) {
    addFindingOnce({
      severity: "WARNING",
      category: "FISCAL",
      code: "NOMINA_USO_CFDI_NOT_CN01",
      title: "CFDI de nómina con UsoCFDI distinto de CN01",
      message: "El comprobante de tipo Nómina normalmente utiliza UsoCFDI CN01.",
      recommendedAction: "Revisa si el CFDI de nómina fue emitido con el UsoCFDI correcto.",
      evidence: [
        { label: "Tipo comprobante", value: tipoComprobante! },
        { label: "UsoCFDI", value: usoCfdiLabel ? `${usoCfdi!} - ${usoCfdiLabel}` : usoCfdi! },
        { label: "UUID", value: uuid ?? "—" },
      ],
    });
  }

  // E) METODO_PAGO_PPD_WITH_FORMA_PAGO_NOT_99
  if (
    isNonEmptyString(metodoPago) &&
    normalizePaymentMethod(metodoPago) === "PPD" &&
    isNonEmptyString(formaPago) &&
    normalizePaymentForm(formaPago) !== "99"
  ) {
    addFindingOnce({
      severity: "WARNING",
      category: "FISCAL",
      code: "METODO_PAGO_PPD_WITH_FORMA_PAGO_NOT_99",
      title: "Método PPD con FormaPago distinta de 99",
      message: "Cuando MetodoPago es PPD, FormaPago normalmente debe ser 99.",
      recommendedAction: "Revisa la consistencia entre MetodoPago y FormaPago.",
      evidence: [
        {
          label: "MetodoPago",
          value: metodoPagoLabel ? `${metodoPago!} - ${metodoPagoLabel}` : metodoPago!,
        },
        {
          label: "FormaPago",
          value: formaPagoLabel ? `${formaPago!} - ${formaPagoLabel}` : formaPago!,
        },
        { label: "Tipo comprobante", value: tipoComprobante ?? "—" },
        { label: "UUID", value: uuid ?? "—" },
      ],
    });
  }

  // F) METODO_PAGO_PUE_WITHOUT_FORMA_PAGO
  if (
    isNonEmptyString(metodoPago) &&
    normalizePaymentMethod(metodoPago) === "PUE" &&
    !isNonEmptyString(formaPago)
  ) {
    addFindingOnce({
      severity: "WARNING",
      category: "FISCAL",
      code: "METODO_PAGO_PUE_WITHOUT_FORMA_PAGO",
      title: "Método PUE sin FormaPago",
      message: "Cuando MetodoPago es PUE, normalmente debe especificarse FormaPago.",
      recommendedAction: "Revisa si falta capturar FormaPago en el comprobante.",
      evidence: [
        {
          label: "MetodoPago",
          value: metodoPagoLabel ? `${metodoPago!} - ${metodoPagoLabel}` : metodoPago!,
        },
        { label: "FormaPago", value: formaPago ?? "—" },
        { label: "Tipo comprobante", value: tipoComprobante ?? "—" },
        { label: "UUID", value: uuid ?? "—" },
      ],
    });
  }

  // G) FORMA_PAGO_PRESENT_WITHOUT_METODO_PAGO_REVIEW
  if (
    isNonEmptyString(formaPago) &&
    !isNonEmptyString(metodoPago) &&
    !isTrasladoType &&
    !isPagoType
  ) {
    addFindingOnce({
      severity: "INFO",
      category: "FISCAL",
      code: "FORMA_PAGO_PRESENT_WITHOUT_METODO_PAGO_REVIEW",
      title: "FormaPago presente sin MetodoPago",
      message: "Se detectó FormaPago sin MetodoPago. Esto amerita revisión de consistencia.",
      recommendedAction: "Verifica si el CFDI debe incluir MetodoPago junto con FormaPago.",
      evidence: [
        {
          label: "FormaPago",
          value: formaPagoLabel ? `${formaPago!} - ${formaPagoLabel}` : formaPago!,
        },
        { label: "MetodoPago", value: metodoPago ?? "—" },
        { label: "Tipo comprobante", value: tipoComprobante ?? "—" },
        { label: "UUID", value: uuid ?? "—" },
      ],
    });
  }

  // H) INGRESO_O_EGRESO_WITHOUT_METODO_FORMA_PAGO_REVIEW
  if (isIngresoEgreso && !isNonEmptyString(metodoPago) && !isNonEmptyString(formaPago)) {
    addFindingOnce({
      severity: "INFO",
      category: "FISCAL",
      code: "INGRESO_O_EGRESO_WITHOUT_METODO_FORMA_PAGO_REVIEW",
      title: "CFDI de ingreso/egreso sin datos de pago",
      message: "El comprobante de ingreso o egreso no contiene MetodoPago ni FormaPago.",
      recommendedAction: "Revisa si la omisión corresponde al escenario operativo del CFDI.",
      evidence: [
        { label: "Tipo comprobante", value: tipoComprobante ?? "—" },
        { label: "MetodoPago", value: metodoPago ?? "—" },
        { label: "FormaPago", value: formaPago ?? "—" },
        { label: "UUID", value: uuid ?? "—" },
      ],
    });
  }

  // ── Emisor/Receptor Fiscal Consistency (A-R) ──

  const regimenFiscalLabel = getRegimenFiscalLabel(regimenFiscal);
  const regimenFiscalReceptorLabel = getRegimenFiscalLabel(regimenFiscalReceptor);
  const isNominaStrict =
    isNonEmptyString(tipoComprobante) && tipoComprobante!.trim().toUpperCase() === "N";

  // A) EMISOR_REGIMEN_FISCAL_MISSING
  if (isCfdi40 && !isNonEmptyString(regimenFiscal)) {
    addFindingOnce({
      severity: "WARNING",
      category: "FISCAL",
      code: "EMISOR_REGIMEN_FISCAL_MISSING",
      title: "Régimen fiscal del emisor faltante",
      message: "No se detectó RégimenFiscal en el emisor del CFDI.",
      recommendedAction: "Revisa que el nodo Emisor incluya RégimenFiscal conforme al CFDI 4.0.",
      evidence: [
        { label: "RFC emisor", value: rfcEmisor ?? "—" },
        { label: "Nombre emisor", value: nombreEmisor ?? "—" },
        { label: "Versión", value: version ?? "—" },
        { label: "UUID", value: uuid ?? "—" },
      ],
    });
  }

  // B) EMISOR_REGIMEN_FISCAL_UNKNOWN_REVIEW
  if (isNonEmptyString(regimenFiscal) && !isKnownRegimenFiscal(regimenFiscal)) {
    addFindingOnce({
      severity: "INFO",
      category: "FISCAL",
      code: "EMISOR_REGIMEN_FISCAL_UNKNOWN_REVIEW",
      title: "Régimen fiscal del emisor no reconocido",
      message:
        "El RégimenFiscal del emisor no está reconocido por el catálogo mínimo local del motor.",
      recommendedAction: "Revisa que el régimen fiscal del emisor sea válido para el CFDI.",
      evidence: [
        { label: "RFC emisor", value: rfcEmisor ?? "—" },
        {
          label: "RégimenFiscal",
          value: regimenFiscalLabel ? `${regimenFiscal!} - ${regimenFiscalLabel}` : regimenFiscal!,
        },
        { label: "UUID", value: uuid ?? "—" },
      ],
    });
  }

  // C) RECEPTOR_REGIMEN_FISCAL_MISSING
  if (isCfdi40 && !isNonEmptyString(regimenFiscalReceptor)) {
    addFindingOnce({
      severity: "WARNING",
      category: "FISCAL",
      code: "RECEPTOR_REGIMEN_FISCAL_MISSING",
      title: "Régimen fiscal del receptor faltante",
      message: "No se detectó RégimenFiscalReceptor en el receptor del CFDI.",
      recommendedAction:
        "Revisa que el nodo Receptor incluya RégimenFiscalReceptor conforme al CFDI 4.0.",
      evidence: [
        { label: "RFC receptor", value: rfcReceptor ?? "—" },
        { label: "Nombre receptor", value: nombreReceptor ?? "—" },
        { label: "UsoCFDI", value: usoCfdi ?? "—" },
        { label: "UUID", value: uuid ?? "—" },
      ],
    });
  }

  // D) RECEPTOR_REGIMEN_FISCAL_UNKNOWN_REVIEW
  if (isNonEmptyString(regimenFiscalReceptor) && !isKnownRegimenFiscal(regimenFiscalReceptor)) {
    addFindingOnce({
      severity: "INFO",
      category: "FISCAL",
      code: "RECEPTOR_REGIMEN_FISCAL_UNKNOWN_REVIEW",
      title: "Régimen fiscal del receptor no reconocido",
      message:
        "El RégimenFiscalReceptor no está reconocido por el catálogo mínimo local del motor.",
      recommendedAction: "Revisa que el régimen fiscal del receptor sea válido para el CFDI.",
      evidence: [
        { label: "RFC receptor", value: rfcReceptor ?? "—" },
        {
          label: "RégimenFiscalReceptor",
          value: regimenFiscalReceptorLabel
            ? `${regimenFiscalReceptor!} - ${regimenFiscalReceptorLabel}`
            : regimenFiscalReceptor!,
        },
        { label: "UsoCFDI", value: usoCfdi ?? "—" },
        { label: "UUID", value: uuid ?? "—" },
      ],
    });
  }

  // E) RECEPTOR_DOMICILIO_FISCAL_MISSING
  if (isCfdi40 && !isNonEmptyString(domicilioFiscalReceptor)) {
    addFindingOnce({
      severity: "WARNING",
      category: "FISCAL",
      code: "RECEPTOR_DOMICILIO_FISCAL_MISSING",
      title: "Domicilio fiscal receptor faltante",
      message: "No se detectó DomicilioFiscalReceptor en el CFDI.",
      recommendedAction: "Revisa que el código postal fiscal del receptor esté capturado.",
      evidence: [
        { label: "RFC receptor", value: rfcReceptor ?? "—" },
        { label: "Nombre receptor", value: nombreReceptor ?? "—" },
        { label: "RégimenFiscalReceptor", value: regimenFiscalReceptor ?? "—" },
        { label: "UUID", value: uuid ?? "—" },
      ],
    });
  }

  // F) RECEPTOR_DOMICILIO_FISCAL_FORMAT_REVIEW
  if (isNonEmptyString(domicilioFiscalReceptor) && !looksLikePostalCode(domicilioFiscalReceptor)) {
    addFindingOnce({
      severity: "INFO",
      category: "FISCAL",
      code: "RECEPTOR_DOMICILIO_FISCAL_FORMAT_REVIEW",
      title: "Formato de DomicilioFiscalReceptor requiere revisión",
      message: "DomicilioFiscalReceptor no tiene formato básico de código postal de 5 dígitos.",
      recommendedAction: "Confirma que el código postal fiscal del receptor sea correcto.",
      evidence: [
        { label: "DomicilioFiscalReceptor", value: domicilioFiscalReceptor! },
        { label: "RFC receptor", value: rfcReceptor ?? "—" },
        { label: "UUID", value: uuid ?? "—" },
      ],
    });
  }

  // G) EMISOR_RECEPTOR_SAME_RFC_REVIEW
  if (
    isNonEmptyString(rfcEmisor) &&
    isNonEmptyString(rfcReceptor) &&
    normalizeRfc(rfcEmisor) === normalizeRfc(rfcReceptor) &&
    !isNominaStrict
  ) {
    addFindingOnce({
      severity: "INFO",
      category: "FISCAL",
      code: "EMISOR_RECEPTOR_SAME_RFC_REVIEW",
      title: "Emisor y receptor con el mismo RFC",
      message:
        "El emisor y receptor tienen el mismo RFC. Puede ser válido en algunos escenarios, pero requiere revisión.",
      recommendedAction:
        "Confirma si la operación permite que emisor y receptor sean el mismo contribuyente.",
      evidence: [
        { label: "RFC emisor", value: rfcEmisor! },
        { label: "RFC receptor", value: rfcReceptor! },
        { label: "Tipo comprobante", value: tipoComprobante ?? "—" },
        { label: "UUID", value: uuid ?? "—" },
      ],
    });
  }

  // K) FOREIGN_GENERIC_RFC_WITH_MXN_REVIEW
  if (
    isGenericForeignRfc(rfcReceptor) &&
    normalizeCurrency(moneda) === "MXN" &&
    isNonEmptyString(exportacion) &&
    ["02", "03", "04"].includes(normalizeExportacion(exportacion))
  ) {
    addFindingOnce({
      severity: "INFO",
      category: "FISCAL",
      code: "FOREIGN_GENERIC_RFC_WITH_MXN_REVIEW",
      title: "RFC extranjero con exportación y moneda MXN",
      message:
        "El receptor usa RFC genérico extranjero con operación marcada como exportación y moneda MXN.",
      recommendedAction: "Confirma moneda, tipo de cambio y tratamiento de exportación.",
      evidence: [
        { label: "RFC receptor", value: rfcReceptor ?? "—" },
        { label: "Moneda", value: moneda ?? "—" },
        { label: "Exportacion", value: exportacion! },
        { label: "TipoCambio", value: tipoCambio ?? "—" },
        { label: "UUID", value: uuid ?? "—" },
      ],
    });
  }

  // M) RECEPTOR_NAME_EMPTY_REVIEW
  if (isCfdi40 && !isNonEmptyString(nombreReceptor)) {
    addFindingOnce({
      severity: "WARNING",
      category: "FISCAL",
      code: "RECEPTOR_NAME_EMPTY_REVIEW",
      title: "Nombre del receptor faltante",
      message: "No se detectó nombre del receptor en el CFDI.",
      recommendedAction: "Revisa que el nodo Receptor incluya Nombre cuando aplique.",
      evidence: [
        { label: "RFC receptor", value: rfcReceptor ?? "—" },
        { label: "UsoCFDI", value: usoCfdi ?? "—" },
        { label: "UUID", value: uuid ?? "—" },
      ],
    });
  }

  // N) EMISOR_NAME_EMPTY_REVIEW
  if (isCfdi40 && !isNonEmptyString(nombreEmisor)) {
    addFindingOnce({
      severity: "WARNING",
      category: "FISCAL",
      code: "EMISOR_NAME_EMPTY_REVIEW",
      title: "Nombre del emisor faltante",
      message: "No se detectó nombre del emisor en el CFDI.",
      recommendedAction: "Revisa que el nodo Emisor incluya Nombre cuando aplique.",
      evidence: [
        { label: "RFC emisor", value: rfcEmisor ?? "—" },
        { label: "RégimenFiscal", value: regimenFiscal ?? "—" },
        { label: "UUID", value: uuid ?? "—" },
      ],
    });
  }

  // O) RECEPTOR_NOMINA_REGIMEN_REVIEW
  if (
    isNominaStrict &&
    isNonEmptyString(regimenFiscalReceptor) &&
    regimenFiscalReceptor !== "605"
  ) {
    addFindingOnce({
      severity: "INFO",
      category: "FISCAL",
      code: "RECEPTOR_NOMINA_REGIMEN_REVIEW",
      title: "Nómina con régimen receptor distinto de sueldos y salarios",
      message: "El CFDI de nómina tiene RégimenFiscalReceptor distinto de 605.",
      recommendedAction:
        "Confirma que el régimen fiscal del receptor sea consistente con el recibo de nómina.",
      evidence: [
        { label: "Tipo comprobante", value: tipoComprobante! },
        { label: "RFC receptor", value: rfcReceptor ?? "—" },
        {
          label: "RégimenFiscalReceptor",
          value: regimenFiscalReceptorLabel
            ? `${regimenFiscalReceptor!} - ${regimenFiscalReceptorLabel}`
            : regimenFiscalReceptor!,
        },
        { label: "UUID", value: uuid ?? "—" },
      ],
    });
  }

  // Q) RECEPTOR_USO_CFDI_DEDUCCIONES_WITH_GENERIC_RFC_REVIEW
  if (isNonEmptyString(usoCfdi) && isGenericRfc(rfcReceptor) && /^D\d\d$/.test(usoCfdi.trim())) {
    addFindingOnce({
      severity: "WARNING",
      category: "FISCAL",
      code: "RECEPTOR_USO_CFDI_DEDUCCIONES_WITH_GENERIC_RFC_REVIEW",
      title: "UsoCFDI de deducción personal con RFC genérico",
      message:
        "El comprobante usa un UsoCFDI de deducción personal con RFC genérico, lo cual requiere revisión fiscal.",
      recommendedAction:
        "Confirma que el receptor y el UsoCFDI sean correctos para efectos fiscales.",
      evidence: [
        { label: "RFC receptor", value: rfcReceptor ?? "—" },
        {
          label: "UsoCFDI",
          value: getUsoCfdiLabel(usoCfdi) ? `${usoCfdi!} - ${getUsoCfdiLabel(usoCfdi)}` : usoCfdi!,
        },
        { label: "Tipo comprobante", value: tipoComprobante ?? "—" },
        { label: "UUID", value: uuid ?? "—" },
      ],
    });
  }

  // R) RECEPTOR_USO_CFDI_INVERSION_WITH_GENERIC_RFC_REVIEW
  if (isNonEmptyString(usoCfdi) && isGenericRfc(rfcReceptor) && /^I\d\d$/.test(usoCfdi.trim())) {
    addFindingOnce({
      severity: "INFO",
      category: "FISCAL",
      code: "RECEPTOR_USO_CFDI_INVERSION_WITH_GENERIC_RFC_REVIEW",
      title: "UsoCFDI de inversión con RFC genérico",
      message:
        "El comprobante usa UsoCFDI de inversión con RFC genérico. Puede requerir revisión según el escenario.",
      recommendedAction: "Confirma si el uso de CFDI y receptor son consistentes.",
      evidence: [
        { label: "RFC receptor", value: rfcReceptor ?? "—" },
        {
          label: "UsoCFDI",
          value: getUsoCfdiLabel(usoCfdi) ? `${usoCfdi!} - ${getUsoCfdiLabel(usoCfdi)}` : usoCfdi!,
        },
        { label: "Tipo comprobante", value: tipoComprobante ?? "—" },
        { label: "UUID", value: uuid ?? "—" },
      ],
    });
  }

  // ── Executive Summary ──
  let riskLevel: "OK" | "WARNING" | "CRITICAL" = "OK";
  let summaryTitle: string;
  let summaryMessage: string;
  let summaryAction: string;

  const hasCritical = findings.some((f) => f.severity === "CRITICAL");
  const hasWarning = findings.some((f) => f.severity === "WARNING");
  const hasInfoOnly = findings.length > 0 && !hasCritical && !hasWarning;

  if (hasCritical) {
    riskLevel = "CRITICAL";
    summaryTitle = "XML con incidencias críticas";
    summaryMessage =
      "Se detectaron hallazgos críticos que pueden afectar la lectura, consistencia fiscal o uso operativo del comprobante.";
    summaryAction =
      "Revisa los hallazgos críticos antes de usar este XML en procesos fiscales, contables u operativos.";
  } else if (hasWarning) {
    riskLevel = "WARNING";
    summaryTitle = "XML con advertencias";
    summaryMessage =
      "El comprobante pudo leerse, pero se detectaron advertencias que conviene revisar.";
    summaryAction =
      "Revisa las advertencias para confirmar que corresponden al caso fiscal u operativo.";
  } else {
    riskLevel = "OK";
    summaryTitle = "XML sin incidencias críticas detectadas";
    summaryMessage =
      "El comprobante pudo leerse correctamente y no se detectaron hallazgos críticos ni advertencias.";
    summaryAction = "Puedes continuar con la revisión operativa o conservar el XML como soporte.";
  }

  if (hasInfoOnly) {
    summaryMessage += " Existen hallazgos informativos que no representan una incidencia crítica.";
  }

  if (riskLevel !== "CRITICAL") {
    if (findings.some((f) => f.code === "BOM_UTF8_DETECTED")) {
      summaryAction +=
        " La normalización aplicada fue solo técnica (BOM/contenido previo), no fiscal.";
    }
    if (findings.some((f) => f.code === "UNSTAMPED_XML")) {
      summaryMessage += " El XML no está timbrado, lo que puede afectar su validez fiscal.";
      summaryAction +=
        " Verifica que el comprobante haya sido timbrado ante el SAT antes de utilizarlo.";
    }
  }

  const severityOrder: Record<string, number> = { CRITICAL: 0, WARNING: 1, INFO: 2 };
  const categoryOrder: Record<string, number> = {
    TOTALS: 0,
    FISCAL: 1,
    TAX: 2,
    TECHNICAL: 3,
    STRUCTURE: 4,
    COMPLEMENT: 5,
  };
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
      reason:
        "Se detectó un problema técnico de codificación o contenido previo al XML. Fiscora generó una versión normalizada sin modificar el contenido fiscal ni el timbre del CFDI.",
      filename: normalizedFilename,
      content: xmlContent,
      originalSha256,
      normalizedSha256,
      normalizationType: "TECHNICAL_SAFE",
      fiscalContentModified: false,
      stampRisk: "NONE",
    };
  }

  const totalMs = Date.now() - startedAt;
  const findingsOriginalCount = findings.length;
  const inputKb = Math.round((inputBytes / 1024) * 100) / 100;

  const cDetected: string[] = [];
  if (diag.hasTimbreFiscalDigital) cDetected.push("TimbreFiscalDigital");
  if (paymentComplement) cDetected.push("Pagos");
  if (cfdiRelations) cDetected.push("CfdiRelacionados");
  if (cartaPorte) cDetected.push("CartaPorte");
  if (nomina) cDetected.push("Nomina");
  if (comercioExterior) cDetected.push("ComercioExterior");
  if (impuestosLocales) cDetected.push("ImpuestosLocales");
  if (leyendasFiscales) cDetected.push("LeyendasFiscales");
  if (donatarias) cDetected.push("Donatarias");
  if (addendaDetected) cDetected.push("Addenda");
  const cKnown = cDetected.filter((c) =>
    [
      "TimbreFiscalDigital",
      "Pagos",
      "CartaPorte",
      "Nomina",
      "ComercioExterior",
      "ImpuestosLocales",
      "LeyendasFiscales",
      "Donatarias",
      "Addenda",
    ].includes(c),
  );
  const cUnknown = cDetected.filter((c) => !new Set(cKnown).has(c));

const countBP = (p: string): number => findings.filter((f) => f.code.startsWith(p)).length;

  const xsdValidationSummary = buildXsdValidationSummary(undefined, {
    version,
    hasTimbreFiscalDigital: diag.hasTimbreFiscalDigital,
    hasPaymentComplement: !!paymentComplement,
    hasNomina: !!nomina,
    hasCartaPorte: cartaPorte ? { detected: true, hasAutotransporte: false } : undefined,
    hasComercioExterior: !!comercioExterior,
    hasRetenciones: false,
    hasImpuestosLocales: !!impuestosLocales,
    hasLeyendasFiscales: !!leyendasFiscales,
    hasDonatarias: !!donatarias,
  });

  const cryptoValidation = buildCryptoValidationSummary(certificado, {
    hasSello: !!sello,
    hasCertificado: !!certificado,
    hasNoCertificado: !!noCertificado,
    hasTimbreFiscalDigital: diag.hasTimbreFiscalDigital,
    hasSelloSat: !!selloSat,
  });

  const analysisMeta: AnalysisMetaInfo = {
    generatedAt: new Date().toISOString(),
    engineVersion: "xml-audit-engine-1.0",
    performance: {
      totalMs,
      inputBytes,
      inputKb,
      findingsOriginalCount,
      findingsReturnedCount: findingsOriginalCount,
      findingsTruncated: false,
      normalizedXmlAvailable: normalizedXml?.available === true,
      sanitized: false,
    },
    coverage: {
      documentKind: "CFDI",
      modules: [
        {
          key: "cfdi-base",
          label: "CFDI Base",
          detected: true,
          analyzed: true,
          skippedReason: null,
          findingsCount:
            countBP("COMPROBANTE_") +
            countBP("EMISOR_") +
            countBP("RECEPTOR_") +
            countBP("GENERIC_RFC_") +
            countBP("EXPORTACION_") +
            countBP("SERIE_FOLIO_") +
            countBP("MONEDA_") +
            countBP("LUGAR_EXPEDICION_") +
            countBP("FECHA_") +
            countBP("TOTAL_") +
            countBP("SUBTOTAL_") +
            countBP("FORMA_PAGO_") +
            countBP("METODO_PAGO_") +
            countBP("DESCUENTO_"),
        },
        {
          key: "retenciones",
          label: "Retenciones",
          detected: false,
          analyzed: false,
          skippedReason: "No aplica para XML de Retenciones",
          findingsCount: 0,
        },
        {
          key: "timbre-fiscal-digital",
          label: "Timbre Fiscal Digital",
          detected: diag.hasTimbreFiscalDigital,
          analyzed: diag.hasTimbreFiscalDigital,
          skippedReason: diag.hasTimbreFiscalDigital ? null : "Complemento no detectado",
          findingsCount:
            countBP("MISSING_TFD_") +
            countBP("TFD_") +
            countBP("TIMBRADO_") +
            countBP("MISSING_COMPROBANTE_") +
            countBP("NO_CERTIFICADO_") +
            countBP("MISSING_RFC_PROV_CERTIF") +
            countBP("MISSING_NO_CERTIFICADO"),
        },
        {
          key: "concept-taxes",
          label: "Impuestos por concepto",
          detected: concepts !== null && concepts !== undefined,
          analyzed: concepts !== null && concepts !== undefined,
          skippedReason: concepts ? null : "Complemento no detectado",
          findingsCount: countBP("CONCEPT_"),
        },
        {
          key: "global-taxes",
          label: "Impuestos globales",
          detected: globalTaxes !== null && globalTaxes !== undefined,
          analyzed: globalTaxes !== null && globalTaxes !== undefined,
          skippedReason: globalTaxes ? null : "Complemento no detectado",
          findingsCount: countBP("GLOBAL_"),
        },
        {
          key: "payment-complement",
          label: "Complemento Pago",
          detected: !!paymentComplement,
          analyzed: !!paymentComplement,
          skippedReason: paymentComplement ? null : "Complemento no detectado",
          findingsCount: countBP("PAYMENT_") + countBP("RELATED_DOCUMENT_"),
        },
        {
          key: "cfdi-relations",
          label: "CFDI Relacionados",
          detected: !!cfdiRelations,
          analyzed: !!cfdiRelations,
          skippedReason: cfdiRelations ? null : "Complemento no detectado",
          findingsCount:
            countBP("CFDI_RELATION_") +
            countBP("CFDI_RELATED_") +
            countBP("CFDI_SELF_RELATION") +
            countBP("EGRESO_WITHOUT_CFDI_RELACIONADOS") +
            countBP("PAYMENT_WITH_CFDI_RELACIONADOS_REVIEW"),
        },
        {
          key: "carta-porte",
          label: "Carta Porte",
          detected: !!cartaPorte,
          analyzed: !!cartaPorte,
          skippedReason: cartaPorte ? null : "Complemento no detectado",
          findingsCount: countBP("CARTA_PORTE_"),
        },
        {
          key: "nomina",
          label: "Nómina",
          detected: !!nomina,
          analyzed: !!nomina,
          skippedReason: nomina ? null : "Complemento no detectado",
          findingsCount: countBP("NOMINA_") + countBP("RECEPTOR_NOMINA_"),
        },
        {
          key: "comercio-exterior",
          label: "Comercio Exterior",
          detected: !!comercioExterior,
          analyzed: !!comercioExterior,
          skippedReason: comercioExterior ? null : "Complemento no detectado",
          findingsCount:
            countBP("COMERCIO_EXTERIOR_") + countBP("EXPORTACION_WITHOUT_COMERCIO_EXTERIOR"),
        },
        {
          key: "impuestos-locales",
          label: "Impuestos Locales",
          detected: !!impuestosLocales,
          analyzed: !!impuestosLocales,
          skippedReason: impuestosLocales ? null : "Complemento no detectado",
          findingsCount: countBP("IMPUESTOS_LOCALES_"),
        },
        {
          key: "leyendas-fiscales",
          label: "Leyendas Fiscales",
          detected: !!leyendasFiscales,
          analyzed: !!leyendasFiscales,
          skippedReason: leyendasFiscales ? null : "Complemento no detectado",
          findingsCount: countBP("LEYENDAS_FISCALES_") + countBP("LEYENDA_FISCAL_"),
        },
        {
          key: "donatarias",
          label: "Donatarias",
          detected: !!donatarias,
          analyzed: !!donatarias,
          skippedReason: donatarias ? null : "Complemento no detectado",
          findingsCount: countBP("DONATARIAS_"),
        },
        {
          key: "addenda",
          label: "Addenda",
          detected: addendaDetected,
          analyzed: addendaDetected,
          skippedReason: addendaDetected ? null : "Complemento no detectado",
          findingsCount: countBP("ADDENDA_"),
        },
      ],
      complementsDetected: cDetected,
      complementsKnown: cKnown,
      complementsUnknown: cUnknown,
      hasAddenda: addendaDetected,
      hasTimbreFiscalDigital: diag.hasTimbreFiscalDigital,
      hasSafeNormalization: safeNormalizationApplied,
      xsdValidation: xsdValidationSummary,
    },
    cryptoValidation,
  };

  // ── Catalog Consistency Validations (CFDI) ──
  validateCatalogConsistency({
    tipoComprobante,
    moneda,
    exportacion,
    metodoPago,
    formaPago,
    concepts: concepts ?? undefined,
    cfdiRelations,
    paymentComplement,
    nomina,
    cartaPorte,
    addFinding: (code, severity, title, message, recommendedAction, evidence) => {
      addFindingOnce({
        severity,
        category: "TECHNICAL",
        code,
        title,
        message,
        recommendedAction,
        evidence,
      });
    },
  });

  // ── Tax Advanced Validations (CFDI) ──
  if (concepts) {
    validateTaxAdvanced({
      concepts,
      globalTaxes: globalTaxes ?? null,
      subtotal,
      total,
      descuento,
      addFinding: (code, severity, title, message, recommendedAction, evidence) => {
        const category =
          code.startsWith("TAX_") || code.startsWith("RETENTION_") || code.startsWith("GLOBAL_TAX_")
            ? "TAX"
            : code.startsWith("CFDI_TOTAL_")
              ? "TOTALS"
              : "FISCAL";
        addFindingOnce({
          severity,
          category,
          code,
          title,
          message,
          recommendedAction,
          evidence,
        });
      },
    });
  }

  // ── Cross-Module Consistency Validations ──
  const anyConceptHasTaxes = concepts ? concepts.some((c) => hasConceptTaxes(c)) : false;
  const anyGlobalTaxes = !!(
    globalTaxes &&
    (globalTaxes.transferred.length > 0 || globalTaxes.withheld.length > 0)
  );
  const hasCriticalFindings = findings.some((f) => f.severity === "CRITICAL");
  const hasPaymentComplement = !!paymentComplement || knownComplements.includes("Pagos");
  const paymentDocumentsCount = paymentComplement
    ? paymentComplement.pagos.reduce((acc, p) => acc + p.documentosRelacionados.length, 0)
    : 0;
  const relationGroupsCount = cfdiRelations ? cfdiRelations.groups.length : 0;

  validateCrossModuleConsistency({
    tipoComprobante,
    version,
    exportacion,
    moneda,
    hasPaymentComplement,
    hasNomina: !!nomina,
    hasCartaPorte: !!cartaPorte,
    cartaPorteTranspInternac: cartaPorte?.transpInternac ?? null,
    hasComercioExterior: !!comercioExterior,
    hasCfdiRelations: !!cfdiRelations,
    hasDonatarias: !!donatarias,
    hasLeyendasFiscales: !!leyendasFiscales,
    hasImpuestosLocales: !!impuestosLocales,
    hasAddenda: !!addenda,
    hasConceptTaxes: anyConceptHasTaxes,
    hasGlobalTaxes: anyGlobalTaxes,
    conceptsCount: concepts?.length ?? 0,
    paymentDocumentsCount,
    relationGroupsCount,
    knownComplements,
    unknownComplements,
    concepts: concepts ? concepts.map((c) => ({ objetoImp: c.objetoImp })) : null,
    cartaPorteMercancias:
      cartaPorte?.mercancias?.map((m) => ({ bienesTransp: m.bienesTransp })) ?? null,
    comercioExteriorMercancias:
      comercioExterior?.mercancias?.map((m) => ({ noIdentificacion: m.noIdentificacion })) ?? null,
    hasCriticalFindings,
    addFinding: (code, severity, title, message, recommendedAction, evidence) => {
      addFindingOnce({
        severity,
        category: "FISCAL",
        code,
        title,
        message,
        recommendedAction,
        evidence,
      });
    },
  });

  // ── CFDI Version Consistency Validations ──
  validateCfdiVersionConsistency({
    version,
    tipoComprobante,
    exportacion,
    moneda,
    tipoCambio,
    formaPago,
    metodoPago,
    lugarExpedicion,
    confirmacion,
    total,
    emisor: { nombre: nombreEmisor },
    receptor: {
      nombre: nombreReceptor,
      regimenFiscalReceptor,
      domicilioFiscalReceptor,
      usoCfdi,
    },
    concepts: concepts ? concepts.map((c) => ({ objetoImp: c.objetoImp })) : null,
    addFinding: (code, severity, title, message, recommendedAction, evidence) => {
      addFindingOnce({
        severity,
        category: "FISCAL",
        code,
        title,
        message,
        recommendedAction,
        evidence,
      });
    },
  });

  return {
    documentKind: "CFDI",
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
    regimenFiscal: regimenFiscal ?? undefined,
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
    nomina,
    comercioExterior,
    impuestosLocales,
    leyendasFiscales,
    donatarias,
    addenda,
    structureDiagnostics,
    concepts: concepts ?? undefined,
    totalsValidation: totalsValidation ?? undefined,
    taxSummary: taxSummary ?? undefined,
    globalTaxes: globalTaxes ?? undefined,
    normalizedXml,
    analysisMeta,
    regimenFiscalReceptor: regimenFiscalReceptor ?? undefined,
    domicilioFiscalReceptor: domicilioFiscalReceptor ?? undefined,
    lugarExpedicion: lugarExpedicion ?? undefined,
    exportacion: exportacion ?? undefined,
    tipoCambio: tipoCambio ?? undefined,
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

function buildRetencionesResult(
  root: Record<string, unknown>,
  rawXml: string,
  xmlContent: string,
  originalFilename: string | undefined,
  originalSha256: string,
  normalizedSha256: string,
  diag: TechnicalDiagnostics,
  safeNormalizationApplied: boolean,
  bomDetected: boolean,
  leadingContentBeforeXml: boolean,
  startedAt: number,
  inputBytes: number,
): CfdiAnalysisResult {
  const issues: string[] = [];
  const warnings: string[] = [];
  const findings: Finding[] = [];
  const addedKeys = new Set<string>();
  const codeCounters: Record<string, number> = {};

  function addFindingOnce(f: Omit<Finding, "id">): void {
    const evidenceStr = JSON.stringify(f.evidence ?? []);
    const key = `${f.code}||${f.message}||${evidenceStr}`;
    if (!addedKeys.has(key)) {
      addedKeys.add(key);
      if (!codeCounters[f.code]) codeCounters[f.code] = 1;
      const id = `${f.code}-${codeCounters[f.code]++}`;
      findings.push({ ...f, id });
    }
  }

  // Extract attributes
  const version = strAttr(root, "Version");
  const folioInt = strAttr(root, "FolioInt");
  const sello = strAttr(root, "Sello");
  const numCert = strAttr(root, "NumCert");
  const cert = strAttr(root, "Cert");
  const fechaExp = strAttr(root, "FechaExp");
  const cveRetenc = strAttr(root, "CveRetenc");
  const descRetenc = strAttr(root, "DescRetenc");
  const lugarExpRetenc = strAttr(root, "LugarExpRetenc");

  // Emisor
  const emisorNode =
    (get(root, "cfdi:Emisor") as Record<string, unknown>) ??
    (get(root, "retenciones:Emisor") as Record<string, unknown>) ??
    (get(root, "Emisor") as Record<string, unknown>) ??
    null;
  let emisor: RetencionesEmisorInfo | undefined;
  if (emisorNode && typeof emisorNode === "object") {
    emisor = {
      rfcEmisor: str(get(emisorNode, "@_RfcE")) ?? null,
      nombre: str(get(emisorNode, "@_NomDenRazSocE")) ?? null,
      curp: str(get(emisorNode, "@_CURPE")) ?? null,
      regimenFiscalE: str(get(emisorNode, "@_RegimenFiscalE")) ?? null,
    };
  }

  // Receptor
  const receptorNode =
    (get(root, "cfdi:Receptor") as Record<string, unknown>) ??
    (get(root, "retenciones:Receptor") as Record<string, unknown>) ??
    (get(root, "Receptor") as Record<string, unknown>) ??
    null;
  let receptor: RetencionesReceptorInfo | undefined;
  if (receptorNode && typeof receptorNode === "object") {
    const nacional =
      (get(receptorNode, "cfdi:Nacional") as Record<string, unknown>) ??
      (get(receptorNode, "retenciones:Nacional") as Record<string, unknown>) ??
      (get(receptorNode, "Nacional") as Record<string, unknown>) ??
      null;
    const extranjero =
      (get(receptorNode, "cfdi:Extranjero") as Record<string, unknown>) ??
      (get(receptorNode, "retenciones:Extranjero") as Record<string, unknown>) ??
      (get(receptorNode, "Extranjero") as Record<string, unknown>) ??
      null;
    const nacionalidad = strAttr(receptorNode, "Nacionalidad");
    receptor = {
      nacionalidad,
      rfcReceptor:
        nacional && typeof nacional === "object" ? (str(get(nacional, "@_RfcR")) ?? null) : null,
      curp:
        nacional && typeof nacional === "object" ? (str(get(nacional, "@_CURPR")) ?? null) : null,
      nombre:
        (nacional && typeof nacional === "object" ? str(get(nacional, "@_NomDenRazSocR")) : null) ??
        (extranjero && typeof extranjero === "object"
          ? str(get(extranjero, "@_NomDenRazSocR"))
          : null) ??
        null,
      numRegIdTrib:
        extranjero && typeof extranjero === "object"
          ? (str(get(extranjero, "@_NumRegIdTrib")) ?? null)
          : null,
      domicilioFiscalR:
        nacional && typeof nacional === "object"
          ? (str(get(nacional, "@_DomicilioFiscalR")) ?? null)
          : null,
    };
  }

  // Periodo
  const periodoNode =
    (get(root, "cfdi:Periodo") as Record<string, unknown>) ??
    (get(root, "retenciones:Periodo") as Record<string, unknown>) ??
    (get(root, "Periodo") as Record<string, unknown>) ??
    null;
  let periodo: RetencionesPeriodoInfo | undefined;
  if (periodoNode && typeof periodoNode === "object") {
    periodo = {
      mesIni: str(get(periodoNode, "@_MesIni")) ?? null,
      mesFin: str(get(periodoNode, "@_MesFin")) ?? null,
      ejercicio: str(get(periodoNode, "@_Ejerc")) ?? null,
    };
  }

  // Totales
  const totalesNode =
    (get(root, "cfdi:Totales") as Record<string, unknown>) ??
    (get(root, "retenciones:Totales") as Record<string, unknown>) ??
    (get(root, "Totales") as Record<string, unknown>) ??
    null;
  let totales: RetencionesTotalesInfo | undefined;
  if (totalesNode && typeof totalesNode === "object") {
    const impRetenidosRaw =
      (get(totalesNode, "cfdi:ImpRetenidos") as Record<string, unknown>) ??
      (get(totalesNode, "retenciones:ImpRetenidos") as Record<string, unknown>) ??
      (get(totalesNode, "ImpRetenidos") as Record<string, unknown>) ??
      null;
    let impuestosRaw: unknown[] = [];
    if (impRetenidosRaw && typeof impRetenidosRaw === "object") {
      const raw =
        (get(impRetenidosRaw, "cfdi:ImpRetenido") as unknown) ??
        (get(impRetenidosRaw, "retenciones:ImpRetenido") as unknown) ??
        (get(impRetenidosRaw, "ImpRetenido") as unknown);
      impuestosRaw = Array.isArray(raw) ? raw : raw ? [raw] : [];
    }
    const impuestosRetenidos: RetencionImpuestoInfo[] = (
      impuestosRaw as Record<string, unknown>[]
    ).map((ir) => ({
      baseRet: str(get(ir, "@_BaseRet")) ?? null,
      impuesto: str(get(ir, "@_Impuesto")) ?? null,
      montoRet: str(get(ir, "@_MontoRet")) ?? null,
      tipoPagoRet: str(get(ir, "@_TipoPagoRet")) ?? null,
    }));

    totales = {
      montoTotOperacion: strAttr(totalesNode, "MontoTotOperacion"),
      montoTotGrav: strAttr(totalesNode, "MontoTotGrav"),
      montoTotExent: strAttr(totalesNode, "MontoTotExent"),
      montoTotRet: strAttr(totalesNode, "MontoTotRet"),
      impuestosRetenidos,
    };
  }

  // Complemento / Timbre
  const complemento =
    (get(root, "cfdi:Complemento") as Record<string, unknown>) ??
    (get(root, "retenciones:Complemento") as Record<string, unknown>) ??
    (get(root, "Complemento") as Record<string, unknown>) ??
    {};
  const hasComplemento =
    complemento !== null && typeof complemento === "object" && Object.keys(complemento).length > 0;
  const complementoNames: string[] = [];
  if (hasComplemento) {
    for (const key of Object.keys(complemento)) {
      const normalized = key.replace(/^[\w.-]+:/, "");
      complementoNames.push(normalized);
    }
  }

  const timbreNode =
    (get(complemento, "tfd:TimbreFiscalDigital") as Record<string, unknown>) ??
    (get(complemento, "TimbreFiscalDigital") as Record<string, unknown>) ??
    null;
  const hasTimbre =
    timbreNode !== null && typeof timbreNode === "object" && Object.keys(timbreNode).length > 0;
  const uuid = hasTimbre ? (str(get(timbreNode!, "@_UUID")) ?? null) : null;
  const fechaTimbrado = hasTimbre ? (str(get(timbreNode!, "@_FechaTimbrado")) ?? null) : null;
  const rfcProvCertif = hasTimbre ? (str(get(timbreNode!, "@_RfcProvCertif")) ?? null) : null;

  diag.hasTimbreFiscalDigital = hasTimbre;
  diag.isStamped = hasTimbre;

  // ── Findings ──

  // A) RETENCIONES_DOCUMENT_DETECTED
  addFindingOnce({
    severity: "INFO",
    category: "STRUCTURE",
    code: "RETENCIONES_DOCUMENT_DETECTED",
    title: "XML de Retenciones detectado",
    message:
      "El XML corresponde a Retenciones e Información de Pagos, no a un CFDI Comprobante tradicional.",
    recommendedAction:
      "Revisa las secciones de emisor, receptor, periodo, totales e impuestos retenidos.",
    evidence: [
      { label: "Versión", value: version ?? "—" },
      { label: "CveRetenc", value: cveRetenc ?? "—" },
      { label: "DescRetenc", value: descRetenc ?? "—" },
      { label: "Folio interno", value: folioInt ?? "—" },
      { label: "UUID", value: uuid ?? "—" },
    ],
  });

  // B) RETENCIONES_MISSING_VERSION
  if (!isNonEmptyString(version)) {
    addFindingOnce({
      severity: "WARNING",
      category: "STRUCTURE",
      code: "RETENCIONES_MISSING_VERSION",
      title: "Versión de Retenciones faltante",
      message: "No se detectó la versión del XML de Retenciones.",
      recommendedAction: "Verifica que el XML de Retenciones esté completo.",
      evidence: [
        { label: "Folio interno", value: folioInt ?? "—" },
        { label: "CveRetenc", value: cveRetenc ?? "—" },
        { label: "UUID", value: uuid ?? "—" },
      ],
    });
  }

  // C) RETENCIONES_VERSION_REVIEW
  if (isNonEmptyString(version) && !["1.0", "2.0"].includes(version)) {
    addFindingOnce({
      severity: "INFO",
      category: "STRUCTURE",
      code: "RETENCIONES_VERSION_REVIEW",
      title: "Versión de Retenciones requiere revisión",
      message: "La versión del XML de Retenciones no está reconocida por el motor actual.",
      recommendedAction: "Confirma que la versión corresponda al esquema fiscal del XML.",
      evidence: [
        { label: "Versión", value: version },
        { label: "Folio interno", value: folioInt ?? "—" },
        { label: "UUID", value: uuid ?? "—" },
      ],
    });
  }

  // D) RETENCIONES_MISSING_CVE_RETENC
  if (!isNonEmptyString(cveRetenc)) {
    addFindingOnce({
      severity: "WARNING",
      category: "FISCAL",
      code: "RETENCIONES_MISSING_CVE_RETENC",
      title: "Clave de retención faltante",
      message: "No se detectó CveRetenc en el XML de Retenciones.",
      recommendedAction: "Revisa la clave de tipo de retención o información de pagos.",
      evidence: [
        { label: "Folio interno", value: folioInt ?? "—" },
        { label: "DescRetenc", value: descRetenc ?? "—" },
        { label: "UUID", value: uuid ?? "—" },
      ],
    });
  }

  // E) RETENCIONES_MISSING_FECHA_EXP
  if (!isNonEmptyString(fechaExp)) {
    addFindingOnce({
      severity: "WARNING",
      category: "TECHNICAL",
      code: "RETENCIONES_MISSING_FECHA_EXP",
      title: "Fecha de expedición de Retenciones faltante",
      message: "No se detectó FechaExp en el XML de Retenciones.",
      recommendedAction: "Revisa la fecha de expedición del documento.",
      evidence: [
        { label: "Folio interno", value: folioInt ?? "—" },
        { label: "CveRetenc", value: cveRetenc ?? "—" },
        { label: "UUID", value: uuid ?? "—" },
      ],
    });
  }

  // F) RETENCIONES_FECHA_EXP_INVALID
  if (isNonEmptyString(fechaExp) && !parseCfdiDate(fechaExp)) {
    addFindingOnce({
      severity: "WARNING",
      category: "TECHNICAL",
      code: "RETENCIONES_FECHA_EXP_INVALID",
      title: "Fecha de expedición de Retenciones inválida",
      message: "FechaExp no pudo interpretarse como fecha válida.",
      recommendedAction: "Revisa el formato de FechaExp.",
      evidence: [
        { label: "FechaExp", value: fechaExp },
        { label: "Folio interno", value: folioInt ?? "—" },
        { label: "UUID", value: uuid ?? "—" },
      ],
    });
  }

  // G) RETENCIONES_MISSING_EMISOR_RFC
  if (!emisor || !isNonEmptyString(emisor.rfcEmisor)) {
    addFindingOnce({
      severity: "WARNING",
      category: "FISCAL",
      code: "RETENCIONES_MISSING_EMISOR_RFC",
      title: "RFC del emisor faltante en Retenciones",
      message: "No se detectó RFC del emisor en el XML de Retenciones.",
      recommendedAction: "Revisa el nodo Emisor del XML de Retenciones.",
      evidence: [
        { label: "Nombre emisor", value: emisor?.nombre ?? "—" },
        { label: "Folio interno", value: folioInt ?? "—" },
        { label: "UUID", value: uuid ?? "—" },
      ],
    });
  }

  // H) RETENCIONES_EMISOR_RFC_FORMAT_REVIEW
  if (emisor && isNonEmptyString(emisor.rfcEmisor) && !looksLikeRfc(emisor.rfcEmisor)) {
    addFindingOnce({
      severity: "INFO",
      category: "FISCAL",
      code: "RETENCIONES_EMISOR_RFC_FORMAT_REVIEW",
      title: "Formato de RFC emisor requiere revisión",
      message: "El RFC del emisor en Retenciones tiene formato poco común.",
      recommendedAction: "Verifica el RFC del emisor.",
      evidence: [
        { label: "RFC emisor", value: emisor.rfcEmisor },
        { label: "Nombre emisor", value: emisor.nombre ?? "—" },
        { label: "UUID", value: uuid ?? "—" },
      ],
    });
  }

  // I) RETENCIONES_MISSING_RECEPTOR
  if (
    !receptor ||
    (!isNonEmptyString(receptor.rfcReceptor) && !isNonEmptyString(receptor.numRegIdTrib))
  ) {
    addFindingOnce({
      severity: "WARNING",
      category: "FISCAL",
      code: "RETENCIONES_MISSING_RECEPTOR",
      title: "Receptor faltante en Retenciones",
      message: "No se detectó información suficiente del receptor en el XML de Retenciones.",
      recommendedAction: "Revisa el nodo Receptor y su información nacional o extranjera.",
      evidence: [
        { label: "Nacionalidad", value: receptor?.nacionalidad ?? "—" },
        { label: "UUID", value: uuid ?? "—" },
        { label: "Folio interno", value: folioInt ?? "—" },
      ],
    });
  }

  // J) RETENCIONES_RECEPTOR_NACIONAL_MISSING_RFC
  const isNacional =
    !receptor?.nacionalidad || normalizeText(receptor.nacionalidad).toUpperCase() !== "EXTRANJERO";
  if (receptor && isNacional && !isNonEmptyString(receptor.rfcReceptor)) {
    addFindingOnce({
      severity: "WARNING",
      category: "FISCAL",
      code: "RETENCIONES_RECEPTOR_NACIONAL_MISSING_RFC",
      title: "RFC del receptor nacional faltante",
      message: "No se detectó RFC del receptor nacional en Retenciones.",
      recommendedAction: "Revisa la información nacional del receptor.",
      evidence: [
        { label: "Nacionalidad", value: receptor.nacionalidad ?? "—" },
        { label: "Nombre receptor", value: receptor.nombre ?? "—" },
        { label: "UUID", value: uuid ?? "—" },
      ],
    });
  }

  // K) RETENCIONES_RECEPTOR_EXTRANJERO_MISSING_NUM_REG_ID_TRIB
  const isExtranjero =
    receptor?.nacionalidad && normalizeText(receptor.nacionalidad).toUpperCase() === "EXTRANJERO";
  if (receptor && isExtranjero && !isNonEmptyString(receptor.numRegIdTrib)) {
    addFindingOnce({
      severity: "WARNING",
      category: "FISCAL",
      code: "RETENCIONES_RECEPTOR_EXTRANJERO_MISSING_NUM_REG_ID_TRIB",
      title: "NumRegIdTrib del receptor extranjero faltante",
      message: "No se detectó NumRegIdTrib para receptor extranjero en Retenciones.",
      recommendedAction: "Revisa la identificación tributaria del receptor extranjero.",
      evidence: [
        { label: "Nacionalidad", value: receptor.nacionalidad ?? "—" },
        { label: "Nombre receptor", value: receptor.nombre ?? "—" },
        { label: "UUID", value: uuid ?? "—" },
      ],
    });
  }

  // L) RETENCIONES_MISSING_PERIODO
  if (!periodo) {
    addFindingOnce({
      severity: "WARNING",
      category: "FISCAL",
      code: "RETENCIONES_MISSING_PERIODO",
      title: "Periodo faltante en Retenciones",
      message: "No se detectó el periodo del XML de Retenciones.",
      recommendedAction: "Revisa MesIni, MesFin y Ejercicio.",
      evidence: [
        { label: "Folio interno", value: folioInt ?? "—" },
        { label: "CveRetenc", value: cveRetenc ?? "—" },
        { label: "UUID", value: uuid ?? "—" },
      ],
    });
  }

  // M) RETENCIONES_PERIODO_INVALID
  if (periodo) {
    let periodoInvalid = false;
    const mesIniNum = periodo.mesIni ? parseInt(periodo.mesIni, 10) : NaN;
    const mesFinNum = periodo.mesFin ? parseInt(periodo.mesFin, 10) : NaN;
    if (periodo.mesIni && (mesIniNum < 1 || mesIniNum > 12)) periodoInvalid = true;
    if (periodo.mesFin && (mesFinNum < 1 || mesFinNum > 12)) periodoInvalid = true;
    if (!isNaN(mesIniNum) && !isNaN(mesFinNum) && mesIniNum > mesFinNum) periodoInvalid = true;
    if (periodo.ejercicio && !/^\d{4}$/.test(periodo.ejercicio)) periodoInvalid = true;
    if (periodoInvalid) {
      addFindingOnce({
        severity: "WARNING",
        category: "FISCAL",
        code: "RETENCIONES_PERIODO_INVALID",
        title: "Periodo de Retenciones inválido",
        message: "El periodo del XML de Retenciones presenta valores inválidos o inconsistentes.",
        recommendedAction: "Revisa MesIni, MesFin y Ejercicio.",
        evidence: [
          { label: "MesIni", value: periodo.mesIni ?? "—" },
          { label: "MesFin", value: periodo.mesFin ?? "—" },
          { label: "Ejercicio", value: periodo.ejercicio ?? "—" },
          { label: "UUID", value: uuid ?? "—" },
        ],
      });
    }
  }

  // N) RETENCIONES_MISSING_TOTALES
  if (!totales) {
    addFindingOnce({
      severity: "WARNING",
      category: "TOTALS",
      code: "RETENCIONES_MISSING_TOTALES",
      title: "Totales faltantes en Retenciones",
      message: "No se detectó el nodo Totales en el XML de Retenciones.",
      recommendedAction: "Revisa los montos totales e impuestos retenidos.",
      evidence: [
        { label: "Folio interno", value: folioInt ?? "—" },
        { label: "CveRetenc", value: cveRetenc ?? "—" },
        { label: "UUID", value: uuid ?? "—" },
      ],
    });
  }

  if (totales) {
    // O) RETENCIONES_TOTAL_OPERATION_INVALID
    if (isNonEmptyString(totales.montoTotOperacion)) {
      const montoOpVal = toMoneyNumber(totales.montoTotOperacion);
      if (montoOpVal < 0) {
        addFindingOnce({
          severity: "WARNING",
          category: "TOTALS",
          code: "RETENCIONES_TOTAL_OPERATION_INVALID",
          title: "Monto total de operación inválido",
          message: "MontoTotOperacion no tiene un valor numérico válido.",
          recommendedAction: "Revisa el monto total de operación.",
          evidence: [
            { label: "MontoTotOperacion", value: totales.montoTotOperacion },
            { label: "Folio interno", value: folioInt ?? "—" },
            { label: "UUID", value: uuid ?? "—" },
          ],
        });
      }
    }

    // P) RETENCIONES_TOTAL_RET_MISMATCH (CRITICAL)
    if (isNonEmptyString(totales.montoTotRet) && totales.impuestosRetenidos.length > 0) {
      const montoTotRetVal = toMoneyNumber(totales.montoTotRet);
      const sumMontoRet = totales.impuestosRetenidos.reduce((acc, ir) => {
        return acc + toMoneyNumber(ir.montoRet);
      }, 0);
      if (Math.abs(montoTotRetVal - sumMontoRet) > 0.01) {
        addFindingOnce({
          severity: "CRITICAL",
          category: "TOTALS",
          code: "RETENCIONES_TOTAL_RET_MISMATCH",
          title: "Monto total retenido no coincide",
          message: "MontoTotRet no coincide con la suma de MontoRet de los impuestos retenidos.",
          recommendedAction:
            "Revisa MontoTotRet y los impuestos retenidos antes de utilizar este XML.",
          evidence: [
            { label: "MontoTotRet XML", value: totales.montoTotRet },
            { label: "Suma MontoRet", value: sumMontoRet.toFixed(2) },
            { label: "Diferencia", value: Math.abs(montoTotRetVal - sumMontoRet).toFixed(2) },
            { label: "Tolerancia", value: "0.01" },
            {
              label: "Total impuestos retenidos",
              value: String(totales.impuestosRetenidos.length),
            },
          ],
        });
      }
    }

    // Q) RETENCIONES_TOTAL_GRAV_EXENT_OPERATION_REVIEW
    if (
      isNonEmptyString(totales.montoTotOperacion) &&
      isNonEmptyString(totales.montoTotGrav) &&
      isNonEmptyString(totales.montoTotExent)
    ) {
      const montoOp = toMoneyNumber(totales.montoTotOperacion);
      const montoGrav = toMoneyNumber(totales.montoTotGrav);
      const montoExent = toMoneyNumber(totales.montoTotExent);
      if (Math.abs(montoGrav + montoExent - montoOp) > 0.01) {
        addFindingOnce({
          severity: "WARNING",
          category: "TOTALS",
          code: "RETENCIONES_TOTAL_GRAV_EXENT_OPERATION_REVIEW",
          title: "Operación no coincide con gravado más exento",
          message: "MontoTotOperacion no coincide con MontoTotGrav más MontoTotExent.",
          recommendedAction: "Revisa los montos gravados, exentos y total de operación.",
          evidence: [
            { label: "MontoTotOperacion", value: totales.montoTotOperacion },
            { label: "MontoTotGrav", value: totales.montoTotGrav },
            { label: "MontoTotExent", value: totales.montoTotExent },
            { label: "Suma calculada", value: (montoGrav + montoExent).toFixed(2) },
            { label: "Diferencia", value: Math.abs(montoGrav + montoExent - montoOp).toFixed(2) },
          ],
        });
      }
    }

    // R) RETENCIONES_WITHOUT_IMP_RETENIDOS_REVIEW
    if (totales.impuestosRetenidos.length === 0) {
      addFindingOnce({
        severity: "INFO",
        category: "TOTALS",
        code: "RETENCIONES_WITHOUT_IMP_RETENIDOS_REVIEW",
        title: "Retenciones sin impuestos retenidos",
        message:
          "No se detectaron nodos ImpRetenido. Puede ser válido según el tipo de información de pagos, pero requiere revisión.",
        recommendedAction: "Confirma si el XML debe incluir detalle de impuestos retenidos.",
        evidence: [
          { label: "MontoTotRet", value: totales.montoTotRet ?? "—" },
          { label: "CveRetenc", value: cveRetenc ?? "—" },
          { label: "DescRetenc", value: descRetenc ?? "—" },
          { label: "UUID", value: uuid ?? "—" },
        ],
      });
    }

    // Per-ImpRetenido findings
    totales.impuestosRetenidos.forEach((ir, idx) => {
      const nro = idx + 1;

      // S) RETENCIONES_IMP_RETENIDO_MISSING_IMPUESTO
      if (!isNonEmptyString(ir.impuesto)) {
        addFindingOnce({
          severity: "WARNING",
          category: "TAX",
          code: "RETENCIONES_IMP_RETENIDO_MISSING_IMPUESTO",
          title: "Impuesto retenido sin clave de impuesto",
          message: "Un impuesto retenido no contiene la clave Impuesto.",
          recommendedAction: "Revisa el detalle de ImpRetenido.",
          evidence: [
            { label: "ImpRetenido #", value: String(nro) },
            { label: "BaseRet", value: ir.baseRet ?? "—" },
            { label: "MontoRet", value: ir.montoRet ?? "—" },
            { label: "TipoPagoRet", value: ir.tipoPagoRet ?? "—" },
          ],
        });
      }

      // T) RETENCIONES_IMP_RETENIDO_AMOUNT_INVALID
      if (isNonEmptyString(ir.montoRet) && toMoneyNumber(ir.montoRet) < 0) {
        addFindingOnce({
          severity: "WARNING",
          category: "TAX",
          code: "RETENCIONES_IMP_RETENIDO_AMOUNT_INVALID",
          title: "MontoRet inválido",
          message: "Un impuesto retenido contiene MontoRet inválido.",
          recommendedAction: "Revisa el monto retenido.",
          evidence: [
            { label: "ImpRetenido #", value: String(nro) },
            { label: "Impuesto", value: ir.impuesto ?? "—" },
            { label: "MontoRet", value: ir.montoRet },
            { label: "TipoPagoRet", value: ir.tipoPagoRet ?? "—" },
          ],
        });
      }

      // U) RETENCIONES_IMP_RETENIDO_BASE_INVALID_REVIEW
      if (isNonEmptyString(ir.baseRet) && toMoneyNumber(ir.baseRet) < 0) {
        addFindingOnce({
          severity: "INFO",
          category: "TAX",
          code: "RETENCIONES_IMP_RETENIDO_BASE_INVALID_REVIEW",
          title: "BaseRet requiere revisión",
          message: "BaseRet tiene un valor inválido o poco común.",
          recommendedAction: "Revisa la base de retención.",
          evidence: [
            { label: "ImpRetenido #", value: String(nro) },
            { label: "BaseRet", value: ir.baseRet },
            { label: "Impuesto", value: ir.impuesto ?? "—" },
            { label: "MontoRet", value: ir.montoRet ?? "—" },
          ],
        });
      }
    });
  }

  // V) RETENCIONES_MISSING_SELLO_OR_CERT_REVIEW
  if (!isNonEmptyString(sello) || !isNonEmptyString(numCert) || !isNonEmptyString(cert)) {
    addFindingOnce({
      severity: "INFO",
      category: "TECHNICAL",
      code: "RETENCIONES_MISSING_SELLO_OR_CERT_REVIEW",
      title: "Sello o certificado de Retenciones incompleto",
      message:
        "El XML de Retenciones no contiene sello, número de certificado o certificado completo.",
      recommendedAction: "Verifica si el XML corresponde al documento original emitido.",
      evidence: [
        { label: "Sello presente", value: isNonEmptyString(sello) ? "Sí" : "No" },
        { label: "NumCert", value: numCert ?? "—" },
        { label: "Certificado presente", value: isNonEmptyString(cert) ? "Sí" : "No" },
        { label: "UUID", value: uuid ?? "—" },
      ],
    });
  }

  // W) RETENCIONES_TIMBRE_MISSING_REVIEW
  if (!hasTimbre) {
    addFindingOnce({
      severity: "WARNING",
      category: "TECHNICAL",
      code: "RETENCIONES_TIMBRE_MISSING_REVIEW",
      title: "Timbre Fiscal Digital no detectado en Retenciones",
      message: "No se detectó TimbreFiscalDigital en el XML de Retenciones.",
      recommendedAction:
        "Verifica si el XML de Retenciones está timbrado y corresponde al documento fiscal original.",
      evidence: [
        { label: "Folio interno", value: folioInt ?? "—" },
        { label: "CveRetenc", value: cveRetenc ?? "—" },
        { label: "UUID", value: uuid ?? "—" },
      ],
    });
  }

  // ── Advanced Retenciones Validations (A5–H2, excluding existing duplicates) ──
  const retenciones: RetencionesInfo = {
    version,
    folioInt,
    sello,
    numCert,
    cert,
    fechaExp,
    cveRetenc,
    descRetenc,
    lugarExpRetenc,
    emisor,
    receptor,
    periodo,
    totales,
    complementoNames,
    uuid,
    fechaTimbrado,
    rfcProvCertif,
  };
  validateRetencionesAdvanced({
    retenciones,
    addFinding: (code, severity, title, message, recommendedAction, evidence) => {
      addFindingOnce({
        severity,
        category: "FISCAL",
        code,
        title,
        message,
        recommendedAction,
        evidence,
      });
    },
  });

  // ── Executive Summary ──
  let riskLevel: "OK" | "WARNING" | "CRITICAL" = "OK";
  let summaryTitle: string;
  let summaryMessage: string;
  let summaryAction: string;

  const hasCritical = findings.some((f) => f.severity === "CRITICAL");
  const hasWarning = findings.some((f) => f.severity === "WARNING");
  const hasInfoOnly = findings.length > 0 && !hasCritical && !hasWarning;

  if (hasCritical) {
    riskLevel = "CRITICAL";
    summaryTitle = "XML de Retenciones con incidencias críticas";
    summaryMessage =
      "Se detectaron hallazgos críticos que pueden afectar la consistencia de montos retenidos.";
    summaryAction =
      "Revisa los hallazgos críticos antes de usar este XML de Retenciones en procesos fiscales.";
  } else if (hasWarning) {
    riskLevel = "WARNING";
    summaryTitle = "XML de Retenciones con advertencias";
    summaryMessage =
      "El XML de Retenciones pudo leerse, pero se detectaron advertencias que conviene revisar.";
    summaryAction =
      "Revisa las advertencias para confirmar que corresponden al caso fiscal u operativo.";
  } else {
    riskLevel = "OK";
    summaryTitle = "XML de Retenciones sin incidencias críticas detectadas";
    summaryMessage =
      "El XML de Retenciones pudo leerse correctamente y no se detectaron hallazgos críticos ni advertencias.";
    summaryAction = "Puedes continuar con la revisión operativa o conservar el XML como soporte.";
  }

  if (hasInfoOnly) {
    summaryMessage += " Existen hallazgos informativos que no representan una incidencia crítica.";
  }

  const severityOrder: Record<string, number> = { CRITICAL: 0, WARNING: 1, INFO: 2 };
  const categoryOrder: Record<string, number> = {
    TOTALS: 0,
    FISCAL: 1,
    TAX: 2,
    TECHNICAL: 3,
    STRUCTURE: 4,
    COMPLEMENT: 5,
  };
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

  // Namespaces
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
    hasAddenda: false,
    complementNames: [],
    knownComplements: [],
    unknownComplements: [],
    addendaDetected: false,
    nodeShapeNotes: [],
  };

  let normalizedXml: NormalizedXml | undefined;
  if (safeNormalizationApplied) {
    const normalizedFilename = originalFilename
      ? originalFilename.replace(/\.xml$/i, "") + "-normalizado.xml"
      : "retenciones-normalizado.xml";
    normalizedXml = {
      available: true,
      reason:
        "Se detectó un problema técnico de codificación o contenido previo al XML. Fiscora generó una versión normalizada sin modificar el contenido fiscal ni el timbre.",
      filename: normalizedFilename,
      content: xmlContent,
      originalSha256,
      normalizedSha256,
      normalizationType: "TECHNICAL_SAFE",
      fiscalContentModified: false,
      stampRisk: "NONE",
    };
  }

  const totalMs = Date.now() - startedAt;
  const findingsOriginalCount = findings.length;
  const inputKb2 = Math.round((inputBytes / 1024) * 100) / 100;

  const cDetected2: string[] = [];
  if (diag.hasTimbreFiscalDigital) cDetected2.push("TimbreFiscalDigital");
  if (hasComplemento)
    cDetected2.push(...complementoNames.filter((n) => n !== "TimbreFiscalDigital"));
  const cKnown2 = cDetected2.filter((c) =>
    [
      "TimbreFiscalDigital",
      "Pagos",
      "CartaPorte",
      "Nomina",
      "ComercioExterior",
      "ImpuestosLocales",
      "LeyendasFiscales",
      "Donatarias",
      "Addenda",
    ].includes(c),
  );
  const cUnknown2 = cDetected2.filter((c) => !new Set(cKnown2).has(c));

  const countBP2 = (p: string): number => findings.filter((f) => f.code.startsWith(p)).length;

  const xsdValidationSummary2 = buildXsdValidationSummary(undefined, {
    version,
    hasTimbreFiscalDigital: diag.hasTimbreFiscalDigital,
    hasPaymentComplement: false,
    hasNomina: false,
    hasCartaPorte: undefined,
    hasComercioExterior: false,
    hasRetenciones: true,
    hasImpuestosLocales: false,
    hasLeyendasFiscales: false,
    hasDonatarias: false,
  });

  const cryptoValidation2 = buildCryptoValidationSummary(cert, {
    hasSello: !!sello,
    hasCertificado: !!cert,
    hasNoCertificado: !!numCert,
    hasTimbreFiscalDigital: diag.hasTimbreFiscalDigital,
    hasSelloSat: false,
  });

  const analysisMeta: AnalysisMetaInfo = {
    generatedAt: new Date().toISOString(),
    engineVersion: "xml-audit-engine-1.0",
    performance: {
      totalMs,
      inputBytes,
      inputKb: inputKb2,
      findingsOriginalCount,
      findingsReturnedCount: findingsOriginalCount,
      findingsTruncated: false,
      normalizedXmlAvailable: normalizedXml?.available === true,
      sanitized: false,
    },
    coverage: {
      documentKind: "RETENCIONES",
      modules: [
        {
          key: "cfdi-base",
          label: "CFDI Base",
          detected: false,
          analyzed: false,
          skippedReason: "No aplica para XML de Retenciones",
          findingsCount: 0,
        },
        {
          key: "retenciones",
          label: "Retenciones",
          detected: true,
          analyzed: true,
          skippedReason: null,
          findingsCount: countBP2("RETENCIONES_"),
        },
        {
          key: "timbre-fiscal-digital",
          label: "Timbre Fiscal Digital",
          detected: diag.hasTimbreFiscalDigital,
          analyzed: diag.hasTimbreFiscalDigital,
          skippedReason: diag.hasTimbreFiscalDigital ? null : "Complemento no detectado",
          findingsCount:
            countBP2("MISSING_TFD_") +
            countBP2("TFD_") +
            countBP2("TIMBRADO_") +
            countBP2("MISSING_COMPROBANTE_") +
            countBP2("NO_CERTIFICADO_") +
            countBP2("MISSING_RFC_PROV_CERTIF") +
            countBP2("MISSING_NO_CERTIFICADO"),
        },
        {
          key: "concept-taxes",
          label: "Impuestos por concepto",
          detected: false,
          analyzed: false,
          skippedReason: "No aplica para XML de Retenciones",
          findingsCount: 0,
        },
        {
          key: "global-taxes",
          label: "Impuestos globales",
          detected: false,
          analyzed: false,
          skippedReason: "No aplica para XML de Retenciones",
          findingsCount: 0,
        },
        {
          key: "payment-complement",
          label: "Complemento Pago",
          detected: false,
          analyzed: false,
          skippedReason: "No aplica para XML de Retenciones",
          findingsCount: 0,
        },
        {
          key: "cfdi-relations",
          label: "CFDI Relacionados",
          detected: false,
          analyzed: false,
          skippedReason: "Complemento no detectado",
          findingsCount: 0,
        },
        {
          key: "carta-porte",
          label: "Carta Porte",
          detected: false,
          analyzed: false,
          skippedReason: "Complemento no detectado",
          findingsCount: 0,
        },
        {
          key: "nomina",
          label: "Nómina",
          detected: false,
          analyzed: false,
          skippedReason: "Complemento no detectado",
          findingsCount: 0,
        },
        {
          key: "comercio-exterior",
          label: "Comercio Exterior",
          detected: false,
          analyzed: false,
          skippedReason: "Complemento no detectado",
          findingsCount: 0,
        },
        {
          key: "impuestos-locales",
          label: "Impuestos Locales",
          detected: false,
          analyzed: false,
          skippedReason: "Complemento no detectado",
          findingsCount: 0,
        },
        {
          key: "leyendas-fiscales",
          label: "Leyendas Fiscales",
          detected: false,
          analyzed: false,
          skippedReason: "Complemento no detectado",
          findingsCount: 0,
        },
        {
          key: "donatarias",
          label: "Donatarias",
          detected: false,
          analyzed: false,
          skippedReason: "Complemento no detectado",
          findingsCount: 0,
        },
        {
          key: "addenda",
          label: "Addenda",
          detected: false,
          analyzed: false,
          skippedReason: "Complemento no detectado",
          findingsCount: 0,
        },
      ],
      complementsDetected: cDetected2,
      complementsKnown: cKnown2,
      complementsUnknown: cUnknown2,
      hasAddenda: false,
      hasTimbreFiscalDigital: diag.hasTimbreFiscalDigital,
      hasSafeNormalization: safeNormalizationApplied,
      xsdValidation: xsdValidationSummary2,
    },
    cryptoValidation: cryptoValidation2,
  };

  // ── Catalog Consistency Validations (Retenciones) ──
  validateCatalogConsistency({
    retencionesNacionalidad: receptor?.nacionalidad,
    retencionesCveRetenc: cveRetenc,
    retencionesImpuestos: totales?.impuestosRetenidos,
    addFinding: (code, severity, title, message, recommendedAction, evidence) => {
      addFindingOnce({
        severity,
        category: "TECHNICAL",
        code,
        title,
        message,
        recommendedAction,
        evidence,
      });
    },
  });

  return {
    documentKind: "RETENCIONES",
    uuid,
    version: version ?? null,
    tipoComprobante: null,
    fecha: null,
    serie: null,
    folio: folioInt ?? null,
    moneda: null,
    subtotal: null,
    total: null,
    rfcEmisor: emisor?.rfcEmisor ?? null,
    nombreEmisor: emisor?.nombre ?? null,
    regimenFiscal: undefined,
    rfcReceptor: receptor?.rfcReceptor ?? null,
    nombreReceptor: receptor?.nombre ?? null,
    fechaTimbrado,
    totalImpuestosTrasladados: null,
    totalImpuestosRetenidos: totales?.montoTotRet ?? null,
    usoCfdi: null,
    metodoPago: null,
    formaPago: null,
    issues,
    warnings,
    findings,
    technicalDiagnostics: diag,
    executiveSummary,
    paymentComplement: undefined,
    cfdiRelations: undefined,
    cartaPorte: undefined,
    nomina: undefined,
    comercioExterior: undefined,
    impuestosLocales: undefined,
    leyendasFiscales: undefined,
    donatarias: undefined,
    retenciones: {
      version: version ?? null,
      folioInt,
      sello,
      numCert,
      cert,
      fechaExp,
      cveRetenc,
      descRetenc,
      lugarExpRetenc,
      emisor,
      receptor,
      periodo,
      totales,
      complementoNames,
      uuid,
      fechaTimbrado,
      rfcProvCertif,
    },
    addenda: undefined,
    structureDiagnostics,
    concepts: undefined,
    totalsValidation: undefined,
    taxSummary: undefined,
    globalTaxes: undefined,
    normalizedXml,
    analysisMeta,
    regimenFiscalReceptor: undefined,
    domicilioFiscalReceptor: undefined,
    lugarExpedicion: undefined,
    exportacion: undefined,
    tipoCambio: undefined,
    sello,
    certificado: cert ?? null,
    noCertificado: numCert ?? null,
    selloCfd: undefined,
    selloSat: undefined,
    noCertificadoSat: undefined,
    rfcProvCertif,
    versionTimbre: undefined,
  };
}

export function toAnalysisResponse(result: CfdiAnalysisResult): AnalysisResponse {
  const processedFindings = (() => {
    const enriched = result.findings.map((f) => ({
      ...f,
      priority: getFindingPriority(f.severity, f.category),
      actionGroup: getFindingActionGroup(f),
    }));
    const withLocation = enriched.map((f) => {
      if (f.location || f.valueTrace) return f;
      const inferred = inferFindingLocationFromEvidence(f);
      return {
        ...f,
        ...(inferred.location ? { location: inferred.location } : {}),
        ...(inferred.valueTrace ? { valueTrace: inferred.valueTrace } : {}),
      };
    });
    const sanitized = withLocation.map((f) => sanitizeFinding(f));
    return limitFindings(sanitized);
  })();

  const findingsReturnedCount = processedFindings.length;
  const hasTruncatedFinding = processedFindings.some(
    (f) => f.code === "FINDINGS_TRUNCATED_FOR_RESPONSE",
  );
  const findingsTruncated = hasTruncatedFinding || result.findings.length > findingsReturnedCount;

  const analysisMeta: AnalysisMetaInfo | undefined = result.analysisMeta
    ? {
        ...result.analysisMeta,
        performance: {
          ...result.analysisMeta.performance,
          findingsReturnedCount,
          findingsTruncated,
          sanitized: true,
        },
      }
    : undefined;

  return {
    documentKind: result.documentKind,
    uuid: result.uuid,
    tipoComprobante: result.tipoComprobante,
    rfcEmisor: result.rfcEmisor,
    nombreEmisor: result.nombreEmisor,
    regimenFiscal: result.regimenFiscal,
    rfcReceptor: result.rfcReceptor,
    nombreReceptor: result.nombreReceptor,
    retenciones: result.retenciones,
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
    findings: processedFindings,
    technicalDiagnostics: result.technicalDiagnostics,
    executiveSummary: result.executiveSummary,
    paymentComplement: result.paymentComplement,
    cfdiRelations: result.cfdiRelations,
    cartaPorte: result.cartaPorte,
    nomina: result.nomina,
    comercioExterior: result.comercioExterior,
    impuestosLocales: result.impuestosLocales,
    leyendasFiscales: result.leyendasFiscales,
    donatarias: result.donatarias,
    addenda: result.addenda,
    structureDiagnostics: result.structureDiagnostics,
    concepts: result.concepts,
    totalsValidation: result.totalsValidation,
    taxSummary: result.taxSummary,
    globalTaxes: result.globalTaxes,
    normalizedXml: result.normalizedXml,
    analysisMeta,
    regimenFiscalReceptor: result.regimenFiscalReceptor,
    domicilioFiscalReceptor: result.domicilioFiscalReceptor,
    lugarExpedicion: result.lugarExpedicion,
    exportacion: result.exportacion,
    tipoCambio: result.tipoCambio,
    sello: result.sello,
    certificado: result.certificado,
    noCertificado: result.noCertificado,
    selloCfd: result.selloCfd,
    selloSat: result.selloSat,
    noCertificadoSat: result.noCertificadoSat,
    rfcProvCertif: result.rfcProvCertif,
    versionTimbre: result.versionTimbre,
    payloadPolicy: {
      evidenceMaxStringLength: FINDING_EVIDENCE_MAX_STRING_LENGTH,
      findingsMaxTotal: FINDINGS_MAX_TOTAL,
      findingsMaxPerCode: FINDINGS_MAX_PER_CODE,
      sanitized: true,
    },
  };
}
