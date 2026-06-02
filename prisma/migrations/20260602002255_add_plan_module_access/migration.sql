-- CreateTable
CREATE TABLE "PlanModuleAccess" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "adminOnly" BOOLEAN NOT NULL DEFAULT false,
    "beta" BOOLEAN NOT NULL DEFAULT false,
    "consumesUsage" BOOLEAN NOT NULL DEFAULT true,
    "allowSingleXml" BOOLEAN NOT NULL DEFAULT false,
    "allowZip" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanModuleAccess_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlanModuleAccess_planId_moduleId_key" ON "PlanModuleAccess"("planId", "moduleId");

-- AddForeignKey
ALTER TABLE "PlanModuleAccess" ADD CONSTRAINT "PlanModuleAccess_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanModuleAccess" ADD CONSTRAINT "PlanModuleAccess_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
