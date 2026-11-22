ALTER TABLE "Medicine"
  ADD COLUMN "brandName" TEXT,
  ADD COLUMN "strength" TEXT;

ALTER TABLE "Prescription"
  ADD COLUMN "prescriptionNumber" TEXT,
  ADD COLUMN "diagnosis" TEXT,
  ADD COLUMN "investigationRecommendations" TEXT,
  ADD COLUMN "followUpInstructions" TEXT,
  ADD COLUMN "status" TEXT NOT NULL DEFAULT 'ISSUED',
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "previousVersionId" UUID,
  ADD COLUMN "isCurrent" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "correctionReason" TEXT,
  ADD COLUMN "verificationCode" TEXT,
  ADD COLUMN "signedHash" TEXT;

UPDATE "Prescription"
SET "prescriptionNumber" = 'RX-' || substr(replace("id"::text, '-', ''), 1, 12),
    "verificationCode" = replace("id"::text, '-', '');

ALTER TABLE "Prescription"
  ALTER COLUMN "prescriptionNumber" SET NOT NULL,
  ALTER COLUMN "verificationCode" SET NOT NULL;

CREATE UNIQUE INDEX "Prescription_prescriptionNumber_key" ON "Prescription"("prescriptionNumber");
CREATE UNIQUE INDEX "Prescription_verificationCode_key" ON "Prescription"("verificationCode");
CREATE INDEX "Prescription_clinicId_patientId_issuedAt_idx" ON "Prescription"("clinicId", "patientId", "issuedAt");

ALTER TABLE "Prescription"
  ADD CONSTRAINT "Prescription_previousVersionId_fkey"
  FOREIGN KEY ("previousVersionId") REFERENCES "Prescription"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PrescriptionItem"
  ADD COLUMN "quantity" INTEGER,
  ADD COLUMN "genericName" TEXT,
  ADD COLUMN "brandName" TEXT,
  ADD COLUMN "strength" TEXT,
  ADD COLUMN "foodInstructions" TEXT,
  ADD COLUMN "specialInstructions" TEXT;
