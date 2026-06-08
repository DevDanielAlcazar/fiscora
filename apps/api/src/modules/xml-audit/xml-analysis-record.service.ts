import { Prisma, PrismaClient } from "@prisma/client";
import type { AnalysisResponse } from "./xml-audit.service.js";

export interface SourceMetadata {
  sourceType: "INDIVIDUAL" | "ZIP";
  sourceFilename?: string;
  batchId?: string;
  zipFilename?: string;
  zipEntryName?: string;
  zipEntryIndex?: number;
}

interface SaveXmlAnalysisRecordParams {
  prisma: PrismaClient;
  userId: string;
  organizationId?: string | null;
  analysis: AnalysisResponse;
  source?: SourceMetadata;
}

function sanitizeAnalysisJson(analysis: AnalysisResponse): Record<string, unknown> {
  const obj = JSON.parse(JSON.stringify(analysis)) as Record<string, unknown>;
  if (obj.normalizedXml && typeof obj.normalizedXml === "object") {
    const nx = obj.normalizedXml as Record<string, unknown>;
    delete nx.content;
  }
  return obj;
}

export class XmlAnalysisRecordService {
  static async saveXmlAnalysisRecord(params: SaveXmlAnalysisRecordParams): Promise<void> {
    const { prisma, userId, organizationId, analysis, source } = params;

    const findings = analysis.findings ?? [];
    const criticalCount = findings.filter(f => f.severity === "CRITICAL").length;
    const warningCount = findings.filter(f => f.severity === "WARNING").length;
    const infoCount = findings.filter(f => f.severity === "INFO").length;

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    await prisma.xmlAnalysisRecord.create({
      data: {
        userId,
        organizationId: organizationId ?? undefined,
        uuid: analysis.uuid,
        tipoComprobante: analysis.tipoComprobante,
        rfcEmisor: analysis.rfcEmisor,
        nombreEmisor: analysis.nombreEmisor,
        rfcReceptor: analysis.rfcReceptor,
        nombreReceptor: analysis.nombreReceptor,
        fecha: analysis.fecha,
        total: analysis.total,
        subtotal: analysis.subtotal,
        moneda: analysis.moneda,
        version: analysis.version,
        serie: analysis.serie,
        folio: analysis.folio,
        riskLevel: analysis.executiveSummary?.riskLevel ?? null,
        findingsCount: findings.length,
        criticalCount,
        warningCount,
        infoCount,
        hasBom: analysis.technicalDiagnostics?.bomDetected ?? false,
        hasTechnicalNormalization: analysis.technicalDiagnostics?.safeNormalizationApplied ?? false,
        hasNormalizedXml: analysis.normalizedXml?.available ?? false,
        normalizedFilename: analysis.normalizedXml?.filename ?? null,
        originalSha256: analysis.normalizedXml?.originalSha256 ?? null,
        normalizedSha256: analysis.normalizedXml?.normalizedSha256 ?? null,
        analysisJson: sanitizeAnalysisJson(analysis) as Prisma.InputJsonValue,
        expiresAt,
        sourceType: source?.sourceType ?? null,
        sourceFilename: source?.sourceFilename ?? null,
        batchId: source?.batchId ?? null,
        zipFilename: source?.zipFilename ?? null,
        zipEntryName: source?.zipEntryName ?? null,
        zipEntryIndex: source?.zipEntryIndex ?? null,
      },
    });
  }
}
