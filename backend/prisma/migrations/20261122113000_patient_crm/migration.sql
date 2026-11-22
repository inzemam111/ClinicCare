ALTER TABLE "Patient"
  ADD COLUMN "gender" TEXT,
  ADD COLUMN "address" TEXT,
  ADD COLUMN "bloodGroup" TEXT,
  ADD COLUMN "allergies" TEXT,
  ADD COLUMN "medicalConditions" TEXT,
  ADD COLUMN "currentMedication" TEXT,
  ADD COLUMN "emergencyContactName" TEXT,
  ADD COLUMN "emergencyContactPhone" TEXT;

CREATE INDEX "Patient_clinicId_phone_idx" ON "Patient"("clinicId", "phone");
