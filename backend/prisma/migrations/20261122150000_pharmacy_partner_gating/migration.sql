ALTER TABLE "Medicine" ADD COLUMN "category" TEXT DEFAULT 'GENERAL', ADD COLUMN "requiresPrescription" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN "isRestricted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Pharmacy" ADD COLUMN "licenseNumber" TEXT, ADD COLUMN "licenseVerifiedAt" TIMESTAMP(3), ADD COLUMN "isApproved" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Order" ADD COLUMN "patientId" UUID, ADD COLUMN "prescriptionId" UUID, ADD COLUMN "deliveryAddress" TEXT, ADD COLUMN "trackingNumber" TEXT, ADD COLUMN "invoiceNumber" TEXT;
ALTER TABLE "Order" ADD CONSTRAINT "Order_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_prescriptionId_fkey" FOREIGN KEY ("prescriptionId") REFERENCES "Prescription"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Order_patientId_createdAt_idx" ON "Order"("patientId", "createdAt");
