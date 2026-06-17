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

export interface SaveFailedXmlAnalysisRecordParams {
  prisma: PrismaClient;
  userId: string;
  organizationId?: string | null;
  sourceType: "ZIP";
  batchId: string;
  zipFilename: string;
  zipEntryName: string;
  zipEntryIndex: number;
  sourceFilename: string;
  errorCode: string;
  errorMessage: string;
}

function sanitizeAnalysisJson(analysis: AnalysisResponse): Record<string, unknown> {
  const obj = JSON.parse(JSON.stringify(analysis)) as Record<string, unknown>;
  if (obj.normalizedXml && typeof obj.normalizedXml === "object") {
    const nx = obj.normalizedXml as Record<string, unknown>;
    delete nx.content;
  }
  // Explicitly remove any other sensitive content that might have slipped in
  delete (obj as any).sourceXml;
  delete (obj as any).rawXml;
  if (obj.addenda && typeof obj.addenda === "object") {
    // Keep structured addenda info but ensure no raw content
    delete (obj as any).addenda.raw;
  }
  return obj;
}

export interface XmlHistoryQuery {
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

export class XmlAnalysisRecordService {
  static async getUserHistory(params: {
    prisma: PrismaClient;
    userId: string;
    organizationId?: string | null;
    query: XmlHistoryQuery;
  }) {
    const { prisma, userId, organizationId, query } = params;
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 20));
    const skip = (page - 1) * pageSize;

    const where: Prisma.XmlAnalysisRecordWhereInput = {
      expiresAt: { gte: new Date() },
    };

    // Security scoping
    if (organizationId) {
      where.organizationId = organizationId;
    } else {
      where.userId = userId;
      where.organizationId = null;
    }

    if (query.sourceType) where.sourceType = query.sourceType;
    if (query.analysisStatus) where.analysisStatus = query.analysisStatus;
    if (query.riskLevel) where.riskLevel = query.riskLevel;

    if (query.from || query.to) {
      where.createdAt = {};
      if (query.from) where.createdAt.gte = new Date(query.from);
      if (query.to) where.createdAt.lte = new Date(query.to);
    }

    if (query.search) {
      const s = query.search;
      where.OR = [
        { sourceFilename: { contains: s, mode: "insensitive" } },
        { zipFilename: { contains: s, mode: "insensitive" } },
        { zipEntryName: { contains: s, mode: "insensitive" } },
        { uuid: { contains: s, mode: "insensitive" } },
        { rfcEmisor: { contains: s, mode: "insensitive" } },
        { rfcReceptor: { contains: s, mode: "insensitive" } },
        { folio: { contains: s, mode: "insensitive" } },
        { serie: { contains: s, mode: "insensitive" } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.xmlAnalysisRecord.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
      prisma.xmlAnalysisRecord.count({ where }),
    ]);

    const mappedItems = items.map((item) => {
      const analysis = item.analysisJson as any;

      // priorityMax derivation
      let priorityMax = null;
      const findings = analysis?.findings || [];
      if (findings.length > 0) {
        const priorities = ["BLOCKER", "HIGH", "MEDIUM", "LOW"];
        for (const p of priorities) {
          if (findings.some((f: any) => f.priority === p)) {
            priorityMax = p;
            break;
          }
        }
      }

      // actionGroupTop derivation
      let actionGroupTop = null;
      if (findings.length > 0) {
        const groups: Record<string, number> = {};
        findings.forEach((f: any) => {
          const g = f.actionGroup || "Informativo";
          groups[g] = (groups[g] || 0) + 1;
        });
        const sorted = Object.entries(groups).sort((a, b) => b[1] - a[1]);
        if (sorted.length > 0) {
          actionGroupTop = sorted[0][0];
        }
      }

      // documentKind derivation
      const documentKind =
        analysis?.documentKind || analysis?.analysisMeta?.coverage?.documentKind || "UNKNOWN";

      // Return item without full analysisJson for the list view
      return {
        id: item.id,
        createdAt: item.createdAt,
        expiresAt: item.expiresAt,
        sourceType: item.sourceType,
        sourceFilename: item.sourceFilename,
        batchId: item.batchId,
        zipFilename: item.zipFilename,
        zipEntryName: item.zipEntryName,
        zipEntryIndex: item.zipEntryIndex,
        analysisStatus: item.analysisStatus,
        errorCode: item.errorCode,
        errorMessage: item.errorMessage,
        uuid: item.uuid,
        tipoComprobante: item.tipoComprobante,
        documentKind,
        rfcEmisor: item.rfcEmisor,
        nombreEmisor: item.nombreEmisor,
        rfcReceptor: item.rfcReceptor,
        nombreReceptor: item.nombreReceptor,
        fecha: item.fecha,
        total: item.total,
        moneda: item.moneda,
        riskLevel: item.riskLevel,
        findingsCount: item.findingsCount,
        criticalCount: item.criticalCount,
        warningCount: item.warningCount,
        infoCount: item.infoCount,
        hasBom: item.hasBom,
        hasTechnicalNormalization: item.hasTechnicalNormalization,
        hasNormalizedXml: item.hasNormalizedXml,
        priorityMax,
        actionGroupTop,
      };
    });

    // Post-filter by documentKind if requested (since it's not a DB column)
    let filteredItems = mappedItems;
    if (query.documentKind) {
      filteredItems = mappedItems.filter((i) => i.documentKind === query.documentKind);
    }

    return {
      items: filteredItems,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  static async getRecordDetail(params: {
    prisma: PrismaClient;
    userId: string;
    organizationId?: string | null;
    id: string;
  }) {
    const { prisma, userId, organizationId, id } = params;

    const record = await prisma.xmlAnalysisRecord.findUnique({
      where: { id },
    });

    if (!record) return null;

    // Security scoping
    const isOwner = record.userId === userId;
    const isSameOrg = organizationId && record.organizationId === organizationId;

    if (!isOwner && !isSameOrg) {
      return null; // Return null to trigger 404 and not leak existence
    }

    // Derive documentKind
    const analysis = record.analysisJson as any;
    const documentKind =
      analysis?.documentKind || analysis?.analysisMeta?.coverage?.documentKind || "UNKNOWN";

    // priorityMax derivation
    let priorityMax = null;
    const findings = analysis?.findings || [];
    if (findings.length > 0) {
      const priorities = ["BLOCKER", "HIGH", "MEDIUM", "LOW"];
      for (const p of priorities) {
        if (findings.some((f: any) => f.priority === p)) {
          priorityMax = p;
          break;
        }
      }
    }

    // actionGroupTop derivation
    let actionGroupTop = null;
    if (findings.length > 0) {
      const groups: Record<string, number> = {};
      findings.forEach((f: any) => {
        const g = f.actionGroup || "Informativo";
        groups[g] = (groups[g] || 0) + 1;
      });
      const sorted = Object.entries(groups).sort((a, b) => b[1] - a[1]);
      if (sorted.length > 0) {
        actionGroupTop = sorted[0][0];
      }
    }

    return {
      id: record.id,
      createdAt: record.createdAt,
      expiresAt: record.expiresAt,
      sourceType: record.sourceType,
      sourceFilename: record.sourceFilename,
      batchId: record.batchId,
      zipFilename: record.zipFilename,
      zipEntryName: record.zipEntryName,
      zipEntryIndex: record.zipEntryIndex,
      analysisStatus: record.analysisStatus,
      errorCode: record.errorCode,
      errorMessage: record.errorMessage,
      uuid: record.uuid,
      tipoComprobante: record.tipoComprobante,
      documentKind,
      rfcEmisor: record.rfcEmisor,
      nombreEmisor: record.nombreEmisor,
      rfcReceptor: record.rfcReceptor,
      nombreReceptor: record.nombreReceptor,
      fecha: record.fecha,
      total: record.total,
      moneda: record.moneda,
      riskLevel: record.riskLevel,
      findingsCount: record.findingsCount,
      criticalCount: record.criticalCount,
      warningCount: record.warningCount,
      infoCount: record.infoCount,
      hasBom: record.hasBom,
      hasTechnicalNormalization: record.hasTechnicalNormalization,
      hasNormalizedXml: record.hasNormalizedXml,
      priorityMax,
      actionGroupTop,
      analysisJson: record.analysisJson, // Already sanitized during save
    };
  }

  static async saveXmlAnalysisRecord(params: SaveXmlAnalysisRecordParams): Promise<void> {
    const { prisma, userId, organizationId, analysis, source } = params;

    const findings = analysis.findings ?? [];
    const criticalCount = findings.filter((f) => f.severity === "CRITICAL").length;
    const warningCount = findings.filter((f) => f.severity === "WARNING").length;
    const infoCount = findings.filter((f) => f.severity === "INFO").length;

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    await prisma.xmlAnalysisRecord.create({
      data: {
        userId,
        organizationId: organizationId ?? undefined,
        analysisStatus: "ANALYZED",
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

  static async saveFailedXmlAnalysisRecord(
    params: SaveFailedXmlAnalysisRecordParams,
  ): Promise<void> {
    const {
      prisma,
      userId,
      organizationId,
      sourceType,
      batchId,
      zipFilename,
      zipEntryName,
      zipEntryIndex,
      sourceFilename,
      errorCode,
      errorMessage,
    } = params;

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const analysisJson: Record<string, unknown> = {
      status: "FAILED",
      errorCode,
      errorMessage,
      source: {
        sourceType,
        batchId,
        zipFilename,
        zipEntryName,
        zipEntryIndex,
      },
    };

    await prisma.xmlAnalysisRecord.create({
      data: {
        userId,
        organizationId: organizationId ?? undefined,
        analysisStatus: "FAILED",
        errorCode,
        errorMessage,
        riskLevel: null,
        findingsCount: 0,
        criticalCount: 0,
        warningCount: 0,
        infoCount: 0,
        hasBom: false,
        hasTechnicalNormalization: false,
        hasNormalizedXml: false,
        normalizedFilename: null,
        originalSha256: null,
        normalizedSha256: null,
        analysisJson: analysisJson as Prisma.InputJsonValue,
        expiresAt,
        sourceType,
        sourceFilename,
        batchId,
        zipFilename,
        zipEntryName,
        zipEntryIndex,
      },
    });
  }
}
