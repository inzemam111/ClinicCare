ALTER TABLE "Consultation"
  ADD COLUMN "symptoms" TEXT,
  ADD COLUMN "examination" TEXT,
  ADD COLUMN "treatmentPlan" TEXT,
  ADD COLUMN "followUpAt" TIMESTAMP(3),
  ADD COLUMN "templateId" UUID,
  ADD COLUMN "status" TEXT NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "finalizedAt" TIMESTAMP(3),
  ADD COLUMN "finalizedById" UUID;

ALTER TABLE "VitalRecord"
  ADD COLUMN "temperature" DECIMAL(4,1),
  ADD COLUMN "oxygenSaturation" INTEGER,
  ADD COLUMN "heightCm" DECIMAL(5,2),
  ADD COLUMN "weightKg" DECIMAL(5,2),
  ADD COLUMN "bmi" DECIMAL(4,2);

CREATE TABLE "ClinicalTemplate" (
  "id" UUID NOT NULL,
  "clinicId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "specialty" TEXT,
  "symptoms" TEXT,
  "examination" TEXT,
  "treatmentPlan" TEXT,
  "createdById" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "ClinicalTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClinicalTemplate_clinicId_name_key" ON "ClinicalTemplate"("clinicId", "name");
CREATE INDEX "ClinicalTemplate_clinicId_deletedAt_idx" ON "ClinicalTemplate"("clinicId", "deletedAt");
