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

export interface XmlZipBatchesQuery {
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

export interface XmlSummaryQuery {
  from?: string;
  to?: string;
  sourceType?: string;
  analysisStatus?: string;
}

export class XmlAnalysisRecordService {
  static async getUserHistorySummary(params: {
    prisma: PrismaClient;
    userId: string;
    organizationId?: string | null;
    query: XmlSummaryQuery;
  }) {
    const { prisma, userId, organizationId, query } = params;

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

    if (query.from || query.to) {
      where.createdAt = {};
      if (query.from) where.createdAt.gte = new Date(query.from);
      if (query.to) where.createdAt.lte = new Date(query.to);
    }

    const maxAggregation = 20000;
    const records = await prisma.xmlAnalysisRecord.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: maxAggregation,
    });

    const truncated = records.length === maxAggregation;

    // Totals
    const t = {
      records: records.length,
      analyzed: 0,
      failed: 0,
      individual: 0,
      zip: 0,
      ok: 0,
      warning: 0,
      critical: 0,
      infoFindings: 0,
      warningFindings: 0,
      criticalFindings: 0,
      recordsWithBom: 0,
      recordsWithTechnicalNormalization: 0,
      recordsWithNormalizedXml: 0,
    };

    const batchesSet = new Set<string>();
    const docKindsMap = new Map<string, number>();
    const prioritiesMap = new Map<string, { findings: number; records: Set<string> }>();
    const actionGroupsMap = new Map<string, { findings: number; records: Set<string> }>();
    const findingCodesMap = new Map<
      string,
      {
        title: string;
        severityMax: string;
        priorityMax: string;
        count: number;
        records: Set<string>;
      }
    >();

    const priorityRanking: Record<string, number> = { BLOCKER: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };

    for (const r of records) {
      if (r.analysisStatus === "ANALYZED") t.analyzed++;
      else if (r.analysisStatus === "FAILED") t.failed++;

      if (r.sourceType === "INDIVIDUAL") t.individual++;
      else if (r.sourceType === "ZIP") {
        t.zip++;
        if (r.batchId) batchesSet.add(r.batchId);
      }

      if (r.riskLevel === "OK") t.ok++;
      else if (r.riskLevel === "WARNING") t.warning++;
      else if (r.riskLevel === "CRITICAL") t.critical++;

      t.infoFindings += r.infoCount;
      t.warningFindings += r.warningCount;
      t.criticalFindings += r.criticalCount;

      if (r.hasBom) t.recordsWithBom++;
      if (r.hasTechnicalNormalization) t.recordsWithTechnicalNormalization++;
      if (r.hasNormalizedXml) t.recordsWithNormalizedXml++;

      const analysis = r.analysisJson as any;
      const dk =
        analysis?.documentKind || analysis?.analysisMeta?.coverage?.documentKind || "UNKNOWN";
      docKindsMap.set(dk, (docKindsMap.get(dk) || 0) + 1);

      const findings = analysis?.findings || [];
      for (const f of findings) {
        // Priorities
        const p = f.priority || "LOW";
        const pEntry = prioritiesMap.get(p) || { findings: 0, records: new Set() };
        pEntry.findings++;
        pEntry.records.add(r.id);
        prioritiesMap.set(p, pEntry);

        // Action Groups
        const ag = f.actionGroup || "Informativo";
        const agEntry = actionGroupsMap.get(ag) || { findings: 0, records: new Set() };
        agEntry.findings++;
        agEntry.records.add(r.id);
        actionGroupsMap.set(ag, agEntry);

        // Finding Codes
        const fc = findingCodesMap.get(f.code) || {
          title: f.title || "",
          severityMax: "INFO",
          priorityMax: "LOW",
          count: 0,
          records: new Set(),
        };
        fc.count++;
        fc.records.add(r.id);
        if (priorityRanking[f.priority] > (priorityRanking[fc.priorityMax] || 0)) {
          fc.priorityMax = f.priority;
        }
        // severity simple logic
        const sevRanking: Record<string, number> = { CRITICAL: 3, WARNING: 2, INFO: 1 };
        if (sevRanking[f.severity] > (sevRanking[fc.severityMax] || 0)) {
          fc.severityMax = f.severity;
        }
        findingCodesMap.set(f.code, fc);
      }
    }

    const priorities = Array.from(prioritiesMap.entries()).map(([priority, val]) => ({
      priority,
      findings: val.findings,
      recordsAffected: val.records.size,
    }));

    const documentKinds = Array.from(docKindsMap.entries()).map(([documentKind, count]) => ({
      documentKind,
      count,
    }));

    const actionGroups = Array.from(actionGroupsMap.entries()).map(([actionGroup, val]) => ({
      actionGroup,
      findings: val.findings,
      recordsAffected: val.records.size,
    }));

    const topFindingCodes = Array.from(findingCodesMap.entries())
      .map(([code, val]) => ({
        code,
        title: val.title,
        severityMax: val.severityMax,
        priorityMax: val.priorityMax,
        count: val.count,
        recordsAffected: val.records.size,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);

    // Recent Records
    const recentRecords = records.slice(0, 10).map((item) => {
      const analysis = item.analysisJson as any;
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
      let actionGroupTop = null;
      if (findings.length > 0) {
        const groups: Record<string, number> = {};
        findings.forEach((f: any) => {
          const g = f.actionGroup || "Informativo";
          groups[g] = (groups[g] || 0) + 1;
        });
        const sorted = Object.entries(groups).sort((a, b) => b[1] - a[1]);
        if (sorted.length > 0) actionGroupTop = sorted[0][0];
      }
      const documentKind =
        analysis?.documentKind || analysis?.analysisMeta?.coverage?.documentKind || "UNKNOWN";

      return {
        id: item.id,
        createdAt: item.createdAt,
        sourceType: item.sourceType,
        sourceFilename: item.sourceFilename,
        zipFilename: item.zipFilename,
        zipEntryName: item.zipEntryName,
        analysisStatus: item.analysisStatus,
        documentKind,
        uuid: item.uuid,
        rfcEmisor: item.rfcEmisor,
        rfcReceptor: item.rfcReceptor,
        total: item.total,
        moneda: item.moneda,
        riskLevel: item.riskLevel,
        findingsCount: item.findingsCount,
        criticalCount: item.criticalCount,
        warningCount: item.warningCount,
        infoCount: item.infoCount,
        priorityMax,
        actionGroupTop,
      };
    });

    // Recent Batches (Derived from full records list)
    const recentBatches = [];
    const bidSeen = new Set<string>();
    for (const r of records) {
      if (r.sourceType === "ZIP" && r.batchId && !bidSeen.has(r.batchId)) {
        const bid = r.batchId;
        bidSeen.add(bid);
        const recs = records.filter((rec) => rec.batchId === bid);
        const first = recs.reduce((a, b) => (a.createdAt < b.createdAt ? a : b));
        const last = recs.reduce((a, b) => (a.createdAt > b.createdAt ? a : b));

        const analyzedCount = recs.filter((re) => re.analysisStatus === "ANALYZED").length;
        const failedCount = recs.filter((re) => re.analysisStatus === "FAILED").length;
        const criticalCount = recs.reduce((s, re) => s + re.criticalCount, 0);
        const warningCount = recs.reduce((s, re) => s + re.warningCount, 0);
        const okCount = recs.filter(
          (re) => re.analysisStatus === "ANALYZED" && re.riskLevel === "OK",
        ).length;

        // priorityMax derivation
        let priorityMax = null;
        for (const p of ["BLOCKER", "HIGH", "MEDIUM", "LOW"]) {
          if (
            recs.some((re) => {
              const fs = (re.analysisJson as any)?.findings || [];
              return fs.some((f: any) => f.priority === p);
            })
          ) {
            priorityMax = p;
            break;
          }
        }

        const actionGroupsM = new Map<string, number>();
        const findingCodesM = new Map<string, number>();
        for (const re of recs) {
          const fs = (re.analysisJson as any)?.findings || [];
          for (const f of fs) {
            const g = f.actionGroup || "Informativo";
            actionGroupsM.set(g, (actionGroupsM.get(g) || 0) + 1);
            findingCodesM.set(f.code, (findingCodesM.get(f.code) || 0) + 1);
          }
        }
        const topActionGroup =
          Array.from(actionGroupsM.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
        const topFindingCode =
          Array.from(findingCodesM.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

        recentBatches.push({
          batchId: bid,
          zipFilename: first.zipFilename ?? "—",
          createdAtFirst: first.createdAt,
          createdAtLast: last.createdAt,
          totalRecords: recs.length,
          analyzedCount,
          failedCount,
          criticalCount,
          warningCount,
          okCount,
          priorityMax,
          topActionGroup,
          topFindingCode,
        });
        if (recentBatches.length >= 5) break;
      }
    }

    return {
      generatedAt: new Date().toISOString(),
      retentionHours: 24,
      truncated,
      maxRecords: maxAggregation,
      filters: {
        from: query.from,
        to: query.to,
        sourceType: query.sourceType,
        analysisStatus: query.analysisStatus,
      },
      totals: {
        ...t,
        batches: batchesSet.size,
      },
      priorities,
      documentKinds,
      actionGroups,
      topFindingCodes,
      recentRecords,
      recentBatches,
    };
  }

  static async getUserZipBatches(params: {
    prisma: PrismaClient;
    userId: string;
    organizationId?: string | null;
    query: XmlZipBatchesQuery;
  }) {
    const { prisma, userId, organizationId, query } = params;
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 20));
    const skip = (page - 1) * pageSize;

    const recordWhere: Prisma.XmlAnalysisRecordWhereInput = {
      sourceType: "ZIP",
      batchId: { not: null },
      expiresAt: { gte: new Date() },
    };

    // Security scoping
    if (organizationId) {
      recordWhere.organizationId = organizationId;
    } else {
      recordWhere.userId = userId;
      recordWhere.organizationId = null;
    }

    if (query.batchId) recordWhere.batchId = query.batchId;
    if (query.zipFilename)
      recordWhere.zipFilename = { contains: query.zipFilename, mode: "insensitive" };
    if (query.from || query.to) {
      recordWhere.createdAt = {};
      if (query.from) recordWhere.createdAt.gte = new Date(query.from);
      if (query.to) recordWhere.createdAt.lte = new Date(query.to);
    }

    // Fetch records to group in memory
    const records = await prisma.xmlAnalysisRecord.findMany({
      where: recordWhere,
      orderBy: { createdAt: "desc" },
      take: 10000, // Safety limit
    });

    // Group by batchId
    const groups = new Map<string, typeof records>();
    for (const rec of records) {
      const bid = rec.batchId!;
      const g = groups.get(bid);
      if (g) g.push(rec);
      else groups.set(bid, [rec]);
    }

    const allBatches = Array.from(groups.entries()).map(([batchId, recs]) => {
      const first = recs.reduce((a, b) => (a.createdAt < b.createdAt ? a : b));
      const last = recs.reduce((a, b) => (a.createdAt > b.createdAt ? a : b));
      const expiresAt = recs.reduce((a, b) => (a.expiresAt < b.expiresAt ? a : b)).expiresAt;

      const analyzedCount = recs.filter((r) => r.analysisStatus === "ANALYZED").length;
      const failedCount = recs.filter((r) => r.analysisStatus === "FAILED").length;
      const criticalCount = recs.reduce((s, r) => s + r.criticalCount, 0);
      const warningCount = recs.reduce((s, r) => s + r.warningCount, 0);
      const infoCount = recs.reduce((s, r) => s + r.infoCount, 0);
      const okCount = recs.filter(
        (r) => r.analysisStatus === "ANALYZED" && r.riskLevel === "OK",
      ).length;

      const recordsWithBom = recs.filter((r) => r.hasBom).length;
      const recordsWithNormalization = recs.filter((r) => r.hasTechnicalNormalization).length;
      const recordsWithNormalizedXml = recs.filter((r) => r.hasNormalizedXml).length;

      // documentKinds derivation
      const dksMap = new Map<string, number>();
      for (const r of recs) {
        const analysis = r.analysisJson as any;
        const dk =
          analysis?.documentKind || analysis?.analysisMeta?.coverage?.documentKind || "UNKNOWN";
        dksMap.set(dk, (dksMap.get(dk) || 0) + 1);
      }
      const documentKinds = Array.from(dksMap.entries()).map(([documentKind, count]) => ({
        documentKind,
        count,
      }));

      // priorityMax derivation
      let priorityMax = null;
      const prioritiesRanking = ["BLOCKER", "HIGH", "MEDIUM", "LOW"];
      for (const p of prioritiesRanking) {
        if (
          recs.some((r) => {
            const findings = (r.analysisJson as any)?.findings || [];
            return findings.some((f: any) => f.priority === p);
          })
        ) {
          priorityMax = p;
          break;
        }
      }

      // topActionGroup and topFindingCode
      const actionGroupsMap = new Map<string, number>();
      const findingCodesMap = new Map<string, number>();
      for (const r of recs) {
        const findings = (r.analysisJson as any)?.findings || [];
        for (const f of findings) {
          const g = f.actionGroup || "Informativo";
          actionGroupsMap.set(g, (actionGroupsMap.get(g) || 0) + 1);
          findingCodesMap.set(f.code, (findingCodesMap.get(f.code) || 0) + 1);
        }
      }
      const topActionGroup =
        Array.from(actionGroupsMap.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
      const topFindingCode =
        Array.from(findingCodesMap.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

      return {
        batchId,
        zipFilename: first.zipFilename ?? "—",
        createdAtFirst: first.createdAt,
        createdAtLast: last.createdAt,
        expiresAt,
        totalRecords: recs.length,
        analyzedCount,
        failedCount,
        criticalCount,
        warningCount,
        infoCount,
        okCount,
        recordsWithBom,
        recordsWithTechnicalNormalization: recordsWithNormalization,
        recordsWithNormalizedXml,
        documentKinds,
        priorityMax,
        topActionGroup,
        topFindingCode,
        hasFailed: failedCount > 0,
        hasCritical: criticalCount > 0 || priorityMax === "BLOCKER",
      };
    });

    // Apply post-group filters
    let filtered = allBatches;
    if (query.hasFailed === "true") filtered = filtered.filter((b) => b.hasFailed);
    if (query.hasCritical === "true") filtered = filtered.filter((b) => b.hasCritical);
    if (query.documentKind) {
      filtered = filtered.filter((b) =>
        b.documentKinds.some((dk) => dk.documentKind === query.documentKind),
      );
    }
    if (query.search) {
      const s = query.search.toLowerCase();
      filtered = filtered.filter(
        (b) => b.zipFilename.toLowerCase().includes(s) || b.batchId.toLowerCase().includes(s),
      );
    }

    // Sort by most recent start date
    filtered.sort((a, b) => b.createdAtFirst.getTime() - a.createdAtFirst.getTime());

    const total = filtered.length;
    const totalPages = Math.ceil(total / pageSize);
    const items = filtered.slice(skip, skip + pageSize);

    return {
      items,
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
      },
    };
  }

  static async getUserZipBatchDetail(params: {
    prisma: PrismaClient;
    userId: string;
    organizationId?: string | null;
    batchId: string;
  }) {
    const { prisma, userId, organizationId, batchId } = params;

    const recordWhere: Prisma.XmlAnalysisRecordWhereInput = {
      batchId,
      sourceType: "ZIP",
    };

    // Security scoping
    if (organizationId) {
      recordWhere.organizationId = organizationId;
    } else {
      recordWhere.userId = userId;
      recordWhere.organizationId = null;
    }

    const records = await prisma.xmlAnalysisRecord.findMany({
      where: recordWhere,
      orderBy: { zipEntryIndex: "asc" },
    });

    if (records.length === 0) return null;

    const first = records[0];
    const last = records[records.length - 1];
    const expiresAt = records.reduce((a, b) => (a.expiresAt < b.expiresAt ? a : b)).expiresAt;

    const analyzedCount = records.filter((r) => r.analysisStatus === "ANALYZED").length;
    const failedCount = records.filter((r) => r.analysisStatus === "FAILED").length;
    const criticalCount = records.reduce((s, r) => s + r.criticalCount, 0);
    const warningCount = records.reduce((s, r) => s + r.warningCount, 0);
    const infoCount = records.reduce((s, r) => s + r.infoCount, 0);
    const okCount = records.filter(
      (r) => r.analysisStatus === "ANALYZED" && r.riskLevel === "OK",
    ).length;

    const recordsWithBom = records.filter((r) => r.hasBom).length;
    const recordsWithNormalization = records.filter((r) => r.hasTechnicalNormalization).length;
    const recordsWithNormalizedXml = records.filter((r) => r.hasNormalizedXml).length;

    // documentKinds derivation
    const dksMap = new Map<string, number>();
    for (const r of records) {
      const analysis = r.analysisJson as any;
      const dk =
        analysis?.documentKind || analysis?.analysisMeta?.coverage?.documentKind || "UNKNOWN";
      dksMap.set(dk, (dksMap.get(dk) || 0) + 1);
    }
    const documentKinds = Array.from(dksMap.entries()).map(([documentKind, count]) => ({
      documentKind,
      count,
    }));

    return {
      batch: {
        batchId,
        zipFilename: first.zipFilename ?? "—",
        createdAtFirst: first.createdAt,
        createdAtLast: last.createdAt,
        expiresAt,
        summary: {
          totalRecords: records.length,
          analyzedCount,
          failedCount,
          criticalCount,
          warningCount,
          infoCount,
          okCount,
          recordsWithBom,
          recordsWithTechnicalNormalization: recordsWithNormalization,
          recordsWithNormalizedXml,
          documentKinds,
        },
      },
      records: records.map((item) => {
        const analysis = item.analysisJson as any;
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
        let actionGroupTop = null;
        if (findings.length > 0) {
          const groups: Record<string, number> = {};
          findings.forEach((f: any) => {
            const g = f.actionGroup || "Informativo";
            groups[g] = (groups[g] || 0) + 1;
          });
          const sorted = Object.entries(groups).sort((a, b) => b[1] - a[1]);
          if (sorted.length > 0) actionGroupTop = sorted[0][0];
        }
        const documentKind =
          analysis?.documentKind || analysis?.analysisMeta?.coverage?.documentKind || "UNKNOWN";

        return {
          id: item.id,
          createdAt: item.createdAt,
          expiresAt: item.expiresAt,
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
      }),
    };
  }

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
