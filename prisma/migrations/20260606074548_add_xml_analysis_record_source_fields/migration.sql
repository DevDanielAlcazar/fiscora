-- AlterTable
ALTER TABLE "XmlAnalysisRecord" ADD COLUMN     "batchId" TEXT,
ADD COLUMN     "sourceFilename" TEXT,
ADD COLUMN     "sourceType" TEXT,
ADD COLUMN     "zipEntryIndex" INTEGER,
ADD COLUMN     "zipEntryName" TEXT,
ADD COLUMN     "zipFilename" TEXT;

-- CreateIndex
CREATE INDEX "XmlAnalysisRecord_sourceType_idx" ON "XmlAnalysisRecord"("sourceType");

-- CreateIndex
CREATE INDEX "XmlAnalysisRecord_batchId_idx" ON "XmlAnalysisRecord"("batchId");

-- CreateIndex
CREATE INDEX "XmlAnalysisRecord_zipFilename_idx" ON "XmlAnalysisRecord"("zipFilename");
