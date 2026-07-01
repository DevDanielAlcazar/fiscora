import AdmZip from "adm-zip";
import {
  analyzeCfdi,
  type CfdiAnalysisResult,
  type AnalysisResponse,
  type NormalizedXml,
} from "./xml-audit.service.js";

export interface FileTechnicalDiagnostics {
  bomDetected: boolean;
  leadingContentBeforeXml: boolean;
  startsWithXml: boolean;
  safeNormalizationAvailable: boolean;
  notes: string[];
}

export interface ZipEntryInfo {
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

export interface AnalyzeZipResult {
  ok: true;
  filename: string;
  totalEntries: number;
  xmlFilesFound: number;
  ignoredEntries: number;
  files: ZipEntryInfo[];
  warnings: string[];
  technicalSummary: TechnicalSummary;
}

const XML_EXT = ".xml";
const BOM_B1 = 0xef;
const BOM_B2 = 0xbb;
const BOM_B3 = 0xbf;

function isDangerousPath(entryName: string): boolean {
  if (entryName.startsWith("/") || /^[a-zA-Z]:\\/.test(entryName)) return true;
  if (entryName.includes("..")) return true;
  if (entryName.includes("\\")) return true;
  return false;
}

function inspectXmlBuffer(buffer: Buffer): FileTechnicalDiagnostics {
  const notes: string[] = [];
  let bomDetected = false;
  let leadingContentBeforeXml = false;
  let startsWithXml = false;

  if (buffer.length >= 3 && buffer[0] === BOM_B1 && buffer[1] === BOM_B2 && buffer[2] === BOM_B3) {
    bomDetected = true;
    notes.push("BOM UTF-8 detectado.");
  }

  let content = buffer.toString("utf8");
  if (bomDetected) {
    content = content.slice(1);
  }

  const xmlStartIndex = content.indexOf("<");
  if (xmlStartIndex === -1) {
    startsWithXml = false;
    notes.push("No se encontró inicio XML válido.");
  } else if (xmlStartIndex > 0) {
    leadingContentBeforeXml = true;
    startsWithXml = false;
    notes.push("Contenido previo al inicio del XML detectado.");
  } else {
    startsWithXml = true;
    notes.push("El XML inicia correctamente con <.");
  }

  const safeNormalizationAvailable = bomDetected || leadingContentBeforeXml;

  return {
    bomDetected,
    leadingContentBeforeXml,
    startsWithXml,
    safeNormalizationAvailable,
    notes,
  };
}

const MAX_FULL_ANALYSIS_XMLS = 50;

export interface ZipFullAnalysisFileResult {
  index: number;
  name: string;
  sizeBytes: number;
  status: "ANALYZED" | "FAILED";
  errorCode?: string;
  errorMessage?: string;
  analysis?: Omit<AnalysisResponse, "normalizedXml"> & {
    normalizedXml?: Omit<NormalizedXml, "content">;
  };
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

export interface ZipFullAnalysisResult {
  ok: true;
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
    policy: "ONE_PER_ZIP";
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

function sanitizeNormalizedXml(
  nx: NormalizedXml | undefined,
): Omit<NormalizedXml, "content"> | undefined {
  if (!nx) return undefined;
  return {
    available: nx.available,
    reason: nx.reason,
    filename: nx.filename,
    originalSha256: nx.originalSha256,
    normalizedSha256: nx.normalizedSha256,
    normalizationType: nx.normalizationType,
    fiscalContentModified: nx.fiscalContentModified,
    stampRisk: nx.stampRisk,
  };
}

export function analyzeZipFull(buffer: Buffer, originalFilename: string): ZipFullAnalysisResult {
  const zip = new AdmZip(buffer);
  const entries = zip.getEntries();

  const totalEntries = entries.length;
  const results: ZipFullAnalysisFileResult[] = [];
  const warnings: string[] = [];
  let xmlFilesFound = 0;
  let analyzedCount = 0;
  let failedCount = 0;
  let ignoredEntries = 0;
  let hasNonXmlIgnored = false;
  let hasDangerousPaths = false;

  const summary: ZipFullAnalysisSummary = {
    criticalCount: 0,
    warningCount: 0,
    okCount: 0,
    infoOnlyCount: 0,
    filesWithBom: 0,
    filesWithTechnicalNormalization: 0,
    byTipoComprobante: {},
  };

  // First pass: collect safe XML entries
  const xmlEntries: { entry: AdmZip.IZipEntry; index: number }[] = [];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];

    if (entry.isDirectory) {
      ignoredEntries++;
      continue;
    }

    const entryName = entry.entryName;

    if (isDangerousPath(entryName)) {
      ignoredEntries++;
      hasDangerousPaths = true;
      continue;
    }

    if (!entryName.toLowerCase().endsWith(XML_EXT)) {
      ignoredEntries++;
      hasNonXmlIgnored = true;
      continue;
    }

    xmlFilesFound++;
    xmlEntries.push({ entry, index: i });
  }

  if (hasDangerousPaths) {
    warnings.push("Se ignoraron entradas con rutas no seguras.");
  }

  if (hasNonXmlIgnored) {
    warnings.push("Se ignoraron archivos que no son XML.");
  }

  if (xmlFilesFound === 0) {
    warnings.push("No se encontraron archivos XML dentro del ZIP.");
    return {
      ok: true,
      filename: originalFilename,
      totalEntries,
      xmlFilesFound: 0,
      analyzedCount: 0,
      failedCount: 0,
      ignoredEntries,
      warnings,
      summary,
      results: [],
    };
  }

  if (xmlFilesFound > MAX_FULL_ANALYSIS_XMLS) {
    warnings.push(
      `El ZIP contiene más de ${MAX_FULL_ANALYSIS_XMLS} XMLs; para esta fase solo se analizaron los primeros ${MAX_FULL_ANALYSIS_XMLS}.`,
    );
  }

  const toAnalyze = xmlEntries.slice(0, MAX_FULL_ANALYSIS_XMLS);

  for (const { entry, index } of toAnalyze) {
    let content: string;
    try {
      content = entry.getData().toString("utf-8");
    } catch {
      results.push({
        index,
        name: entry.entryName,
        sizeBytes: entry.header.size,
        status: "FAILED",
        errorCode: "FILE_READ_ERROR",
        errorMessage: "No se pudo leer el contenido del archivo dentro del ZIP.",
      });
      failedCount++;
      // TODO: En fase posterior, implementar reintento con distinto encoding o
      // manejo de archivos corruptos dentro del ZIP.
      continue;
    }

    try {
      const cfdiResult = analyzeCfdi(content, entry.entryName);

      if (cfdiResult.technicalDiagnostics.bomDetected) summary.filesWithBom++;
      if (cfdiResult.technicalDiagnostics.safeNormalizationApplied)
        summary.filesWithTechnicalNormalization++;

      const riskLevel = cfdiResult.executiveSummary.riskLevel;
      if (riskLevel === "CRITICAL") summary.criticalCount++;
      else if (riskLevel === "WARNING") summary.warningCount++;
      else if (riskLevel === "OK") {
        const hasOnlyInfo = cfdiResult.findings.every((f) => f.severity === "INFO");
        if (hasOnlyInfo) summary.infoOnlyCount++;
        else summary.okCount++;
      }

      const tipo = cfdiResult.tipoComprobante ?? "DESCONOCIDO";
      summary.byTipoComprobante[tipo] = (summary.byTipoComprobante[tipo] ?? 0) + 1;

      // Build sanitized result (no normalizedXml.content)
      const analysis: ZipFullAnalysisFileResult["analysis"] = {
        documentKind: cfdiResult.documentKind,
        uuid: cfdiResult.uuid,
        tipoComprobante: cfdiResult.tipoComprobante,
        rfcEmisor: cfdiResult.rfcEmisor,
        nombreEmisor: cfdiResult.nombreEmisor,
        rfcReceptor: cfdiResult.rfcReceptor,
        nombreReceptor: cfdiResult.nombreReceptor,
        fecha: cfdiResult.fecha,
        subtotal: cfdiResult.subtotal,
        total: cfdiResult.total,
        moneda: cfdiResult.moneda,
        version: cfdiResult.version,
        serie: cfdiResult.serie,
        folio: cfdiResult.folio,
        usoCfdi: cfdiResult.usoCfdi,
        metodoPago: cfdiResult.metodoPago,
        formaPago: cfdiResult.formaPago,
        fechaTimbrado: cfdiResult.fechaTimbrado,
        totalImpuestosTrasladados: cfdiResult.totalImpuestosTrasladados,
        totalImpuestosRetenidos: cfdiResult.totalImpuestosRetenidos,
        issues: cfdiResult.issues,
        warnings: cfdiResult.warnings,
        findings: cfdiResult.findings,
        technicalDiagnostics: cfdiResult.technicalDiagnostics,
        executiveSummary: cfdiResult.executiveSummary,
        paymentComplement: cfdiResult.paymentComplement,
        structureDiagnostics: cfdiResult.structureDiagnostics,
        concepts: cfdiResult.concepts,
        totalsValidation: cfdiResult.totalsValidation,
        taxSummary: cfdiResult.taxSummary,
        normalizedXml: sanitizeNormalizedXml(cfdiResult.normalizedXml),
        analysisMeta: cfdiResult.analysisMeta,
      };

      results.push({
        index,
        name: entry.entryName,
        sizeBytes: entry.header.size,
        status: "ANALYZED",
        analysis,
      });
      analyzedCount++;
    } catch (err: unknown) {
      const error = err as { code?: string; message?: string };
      results.push({
        index,
        name: entry.entryName,
        sizeBytes: entry.header.size,
        status: "FAILED",
        errorCode: error.code ?? "ANALYSIS_ERROR",
        errorMessage: error.message ?? "Error desconocido al analizar el XML.",
      });
      failedCount++;
    }
  }

  // TODO: En fase posterior, implementar persistencia masiva en XmlAnalysisRecord
  // 1 registro por ZIP con los resultados agregados o 1 registro por XML analizado.

  // TODO: Definir política de consumo de uso:
  // - Opción A: 1 uso por ZIP (independientemente de la cantidad de XMLs analizados)
  // - Opción B: 1 uso por XML analizado
  // - Pendiente de definición del plan de negocio.

  // TODO: En fase posterior, implementar descarga masiva:
  // - Generar ZIP con XMLs normalizados técnicamente cuando aplique (BOM, contenido previo).
  // - No incluir XMLs que requieran reparación fiscal en timbrados.
  // - Para XML no timbrados, descarga de reparados solo después de flujo asistido y confirmación explícita.
  // - Incluir manifiesto de trazabilidad por archivo (originalSha256, normalizedSha256, normalizaciones aplicadas).

  return {
    ok: true,
    filename: originalFilename,
    totalEntries,
    xmlFilesFound,
    analyzedCount,
    failedCount,
    ignoredEntries,
    warnings,
    summary,
    results,
  };
}

export interface ManifestFileEntry {
  originalName: string;
  outputName?: string;
  status: "NORMALIZED" | "SKIPPED_NO_NORMALIZATION" | "SKIPPED_UNSAFE_REPAIR" | "FAILED";
  reason: string;
  uuid?: string | null;
  tipoComprobante?: string | null;
  rfcEmisor?: string | null;
  rfcReceptor?: string | null;
  isStamped?: boolean | null;
  normalizationType?: string | null;
  fiscalContentModified?: boolean | null;
  stampRisk?: string | null;
  originalSha256?: string | null;
  normalizedSha256?: string | null;
  errorCode?: string;
  errorMessage?: string;
}

export interface NormalizedZipManifest {
  generatedAt: string;
  sourceZipFilename: string;
  totalXmlFound: number;
  normalizedCount: number;
  skippedCount: number;
  failedCount: number;
  files: ManifestFileEntry[];
}

function sanitizeOutputName(entryName: string): string {
  const name = entryName.replace(/^.*[\\/]/, "");
  return name.replace(/[^a-zA-Z0-9_.-]/g, "_");
}

function escCsvManifest(val: string | null | undefined): string {
  if (val === null || val === undefined) return "";
  const v = String(val).replace(/"/g, '""');
  return /[",\n\r]/.test(v) ? `"${v}"` : v;
}

export function generateNormalizedZip(buffer: Buffer, originalFilename: string): Buffer {
  const zip = new AdmZip(buffer);
  const entries = zip.getEntries();

  const outZip = new AdmZip();
  const manifestFiles: ManifestFileEntry[] = [];
  let totalXmlFound = 0;
  let normalizedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];

    if (entry.isDirectory) continue;

    const entryName = entry.entryName;
    if (isDangerousPath(entryName)) continue;
    if (!entryName.toLowerCase().endsWith(XML_EXT)) continue;

    totalXmlFound++;

    let content: string;
    try {
      content = entry.getData().toString("utf-8");
    } catch {
      manifestFiles.push({
        originalName: entryName,
        status: "FAILED",
        reason: "No se pudo leer el contenido del archivo dentro del ZIP.",
        errorCode: "FILE_READ_ERROR",
        errorMessage: "No se pudo leer el contenido del archivo dentro del ZIP.",
      });
      failedCount++;
      continue;
    }

    let cfdiResult: CfdiAnalysisResult;
    try {
      cfdiResult = analyzeCfdi(content, entryName);
    } catch (err: unknown) {
      const error = err as { code?: string; message?: string };
      manifestFiles.push({
        originalName: entryName,
        status: "FAILED",
        reason: error.message ?? "Error desconocido al analizar el XML.",
        errorCode: error.code ?? "ANALYSIS_ERROR",
        errorMessage: error.message ?? "Error desconocido al analizar el XML.",
      });
      failedCount++;
      continue;
    }

    const nx = cfdiResult.normalizedXml;

    if (nx && nx.available && nx.content) {
      if (nx.fiscalContentModified || nx.stampRisk !== "NONE") {
        manifestFiles.push({
          originalName: entryName,
          status: "SKIPPED_UNSAFE_REPAIR",
          reason: nx.fiscalContentModified
            ? "La normalización modificaría contenido fiscal."
            : `La normalización presenta riesgo para timbre/sello: ${nx.stampRisk}`,
          uuid: cfdiResult.uuid,
          tipoComprobante: cfdiResult.tipoComprobante,
          rfcEmisor: cfdiResult.rfcEmisor,
          rfcReceptor: cfdiResult.rfcReceptor,
          isStamped: cfdiResult.technicalDiagnostics.isStamped,
          normalizationType: nx.normalizationType,
          fiscalContentModified: nx.fiscalContentModified,
          stampRisk: nx.stampRisk,
          originalSha256: nx.originalSha256,
          normalizedSha256: nx.normalizedSha256,
        });
        skippedCount++;
        continue;
      }

      const outputName = sanitizeOutputName(entryName);
      outZip.addFile(`normalized/${outputName}`, Buffer.from(nx.content, "utf-8"));

      manifestFiles.push({
        originalName: entryName,
        outputName,
        status: "NORMALIZED",
        reason: "Normalización técnica segura aplicada.",
        uuid: cfdiResult.uuid,
        tipoComprobante: cfdiResult.tipoComprobante,
        rfcEmisor: cfdiResult.rfcEmisor,
        rfcReceptor: cfdiResult.rfcReceptor,
        isStamped: cfdiResult.technicalDiagnostics.isStamped,
        normalizationType: nx.normalizationType,
        fiscalContentModified: nx.fiscalContentModified,
        stampRisk: nx.stampRisk,
        originalSha256: nx.originalSha256,
        normalizedSha256: nx.normalizedSha256,
      });
      normalizedCount++;
    } else {
      manifestFiles.push({
        originalName: entryName,
        status: "SKIPPED_NO_NORMALIZATION",
        reason: "El XML no requiere normalización técnica.",
        uuid: cfdiResult.uuid,
        tipoComprobante: cfdiResult.tipoComprobante,
        rfcEmisor: cfdiResult.rfcEmisor,
        rfcReceptor: cfdiResult.rfcReceptor,
        isStamped: cfdiResult.technicalDiagnostics.isStamped,
      });
      skippedCount++;
    }
  }

  if (normalizedCount === 0) {
    throw Object.assign(
      new Error("No se encontraron XMLs con normalización técnica segura disponible."),
      { code: "NO_NORMALIZED_XMLS_AVAILABLE" },
    );
  }

  const manifest: NormalizedZipManifest = {
    generatedAt: new Date().toISOString(),
    sourceZipFilename: originalFilename,
    totalXmlFound,
    normalizedCount,
    skippedCount,
    failedCount,
    files: manifestFiles,
  };

  outZip.addFile("manifest/manifest.json", Buffer.from(JSON.stringify(manifest, null, 2), "utf-8"));

  const bom = "\uFEFF";
  const csvHeader = [
    "Archivo original",
    "Archivo salida",
    "Estado",
    "Motivo",
    "UUID",
    "Tipo comprobante",
    "RFC emisor",
    "RFC receptor",
    "Timbrado",
    "Tipo normalización",
    "Contenido fiscal modificado",
    "Riesgo timbre/sello",
    "Hash original SHA-256",
    "Hash normalizado SHA-256",
    "Código error",
    "Mensaje error",
  ]
    .map((h) => escCsvManifest(h))
    .join(",");
  const csvRows = manifestFiles.map((f) =>
    [
      f.originalName,
      f.outputName ?? "",
      f.status,
      f.reason,
      f.uuid ?? "",
      f.tipoComprobante ?? "",
      f.rfcEmisor ?? "",
      f.rfcReceptor ?? "",
      f.isStamped === true ? "Sí" : f.isStamped === false ? "No" : "",
      f.normalizationType ?? "",
      f.fiscalContentModified === true ? "Sí" : f.fiscalContentModified === false ? "No" : "",
      f.stampRisk ?? "",
      f.originalSha256 ?? "",
      f.normalizedSha256 ?? "",
      f.errorCode ?? "",
      f.errorMessage ?? "",
    ]
      .map((v) => escCsvManifest(v))
      .join(","),
  );
  const csv = bom + csvHeader + "\r\n" + csvRows.join("\r\n");
  outZip.addFile("manifest/manifest.csv", Buffer.from(csv, "utf-8"));

  // TODO: En fase posterior, evaluar política de consumo de uso:
  // - 1 uso por descarga de ZIP normalizado
  // - o incluido en el uso del análisis masivo
  // Pendiente de definición del plan de negocio.

  return outZip.toBuffer();
}

export function analyzeZip(buffer: Buffer, originalFilename: string): AnalyzeZipResult {
  const zip = new AdmZip(buffer);
  const entries = zip.getEntries();

  const totalEntries = entries.length;
  const files: ZipEntryInfo[] = [];
  const warnings: string[] = [];
  let xmlFilesFound = 0;
  let ignoredEntries = 0;
  let hasNonXmlIgnored = false;
  let hasDangerousPaths = false;

  const ts: TechnicalSummary = {
    filesWithBom: 0,
    filesWithLeadingContent: 0,
    filesWithSafeNormalizationAvailable: 0,
    filesWithoutXmlStart: 0,
  };

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];

    if (entry.isDirectory) {
      ignoredEntries++;
      continue;
    }

    const entryName = entry.entryName;

    if (isDangerousPath(entryName)) {
      ignoredEntries++;
      hasDangerousPaths = true;
      continue;
    }

    if (!entryName.toLowerCase().endsWith(XML_EXT)) {
      ignoredEntries++;
      hasNonXmlIgnored = true;
      continue;
    }

    const fileBuffer = entry.getData();
    const diag = inspectXmlBuffer(fileBuffer);

    if (diag.bomDetected) ts.filesWithBom++;
    if (diag.leadingContentBeforeXml) ts.filesWithLeadingContent++;
    if (diag.safeNormalizationAvailable) ts.filesWithSafeNormalizationAvailable++;
    if (!diag.startsWithXml && !diag.leadingContentBeforeXml) ts.filesWithoutXmlStart++;

    xmlFilesFound++;
    files.push({
      index: i,
      name: entryName,
      sizeBytes: entry.header.size,
      technicalDiagnostics: diag,
    });
  }

  if (hasDangerousPaths) {
    warnings.push("Se ignoraron entradas con rutas no seguras.");
  }

  if (hasNonXmlIgnored) {
    warnings.push("Se ignoraron archivos que no son XML.");
  }

  if (xmlFilesFound === 0) {
    warnings.push("No se encontraron archivos XML dentro del ZIP.");
  }

  if (ts.filesWithBom > 0 || ts.filesWithLeadingContent > 0) {
    warnings.push(
      "Se detectaron XMLs con problemas técnicos reparables. En una fase posterior se podrá generar descarga normalizada masiva.",
    );
  }

  return {
    ok: true,
    filename: originalFilename,
    totalEntries,
    xmlFilesFound,
    ignoredEntries,
    files,
    warnings,
    technicalSummary: ts,
  };
}
