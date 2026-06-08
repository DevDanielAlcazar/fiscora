import type { PrismaClient } from "@prisma/client";

export async function cleanupExpiredXmlAnalysisRecords(prisma: PrismaClient): Promise<number> {
  const now = new Date();
  const result = await prisma.xmlAnalysisRecord.deleteMany({
    where: { expiresAt: { lt: now } },
  });
  return result.count;
}
