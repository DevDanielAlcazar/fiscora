-- CreateTable
CREATE TABLE "XmlAnalysisRecord" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "userId" TEXT NOT NULL,
    "uuid" TEXT,
    "tipoComprobante" TEXT,
    "rfcEmisor" TEXT,
    "nombreEmisor" TEXT,
    "rfcReceptor" TEXT,
    "nombreReceptor" TEXT,
    "fecha" TEXT,
    "total" TEXT,
    "subtotal" TEXT,
    "moneda" TEXT,
    "version" TEXT,
    "serie" TEXT,
    "folio" TEXT,
    "riskLevel" TEXT,
    "findingsCount" INTEGER NOT NULL DEFAULT 0,
    "criticalCount" INTEGER NOT NULL DEFAULT 0,
    "warningCount" INTEGER NOT NULL DEFAULT 0,
    "infoCount" INTEGER NOT NULL DEFAULT 0,
    "hasBom" BOOLEAN NOT NULL DEFAULT false,
    "hasTechnicalNormalization" BOOLEAN NOT NULL DEFAULT false,
    "hasNormalizedXml" BOOLEAN NOT NULL DEFAULT false,
    "normalizedFilename" TEXT,
    "originalSha256" TEXT,
    "normalizedSha256" TEXT,
    "analysisJson" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "XmlAnalysisRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "XmlAnalysisRecord_userId_idx" ON "XmlAnalysisRecord"("userId");

-- CreateIndex
CREATE INDEX "XmlAnalysisRecord_organizationId_idx" ON "XmlAnalysisRecord"("organizationId");

-- CreateIndex
CREATE INDEX "XmlAnalysisRecord_createdAt_idx" ON "XmlAnalysisRecord"("createdAt");

-- CreateIndex
CREATE INDEX "XmlAnalysisRecord_expiresAt_idx" ON "XmlAnalysisRecord"("expiresAt");

-- CreateIndex
CREATE INDEX "XmlAnalysisRecord_riskLevel_idx" ON "XmlAnalysisRecord"("riskLevel");

-- AddForeignKey
ALTER TABLE "XmlAnalysisRecord" ADD CONSTRAINT "XmlAnalysisRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "XmlAnalysisRecord" ADD CONSTRAINT "XmlAnalysisRecord_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
