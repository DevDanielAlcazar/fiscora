-- AlterTable
ALTER TABLE "XmlAnalysisRecord" ADD COLUMN     "analysisStatus" TEXT NOT NULL DEFAULT 'ANALYZED',
ADD COLUMN     "errorCode" TEXT,
ADD COLUMN     "errorMessage" TEXT;

-- CreateIndex
CREATE INDEX "XmlAnalysisRecord_analysisStatus_idx" ON "XmlAnalysisRecord"("analysisStatus");
