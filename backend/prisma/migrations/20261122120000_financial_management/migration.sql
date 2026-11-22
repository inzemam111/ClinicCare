CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'UPI', 'CARD', 'ONLINE');

ALTER TABLE "Payment"
  ADD COLUMN "method" "PaymentMethod" NOT NULL DEFAULT 'CASH',
  ADD COLUMN "serviceCategory" TEXT NOT NULL DEFAULT 'OTHER_SERVICES',
  ADD COLUMN "verifiedAt" TIMESTAMP(3),
  ADD COLUMN "verifiedById" UUID,
  ADD COLUMN "note" TEXT;

ALTER TABLE "Refund" ADD COLUMN "processedById" UUID;

ALTER TABLE "Expense"
  ADD COLUMN "isCurrent" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "previousVersionId" UUID,
  ADD COLUMN "correctionReason" TEXT;

ALTER TABLE "IncomeEntry"
  ADD CONSTRAINT "IncomeEntry_paymentId_fkey"
  FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Expense"
  ADD CONSTRAINT "Expense_previousVersionId_fkey"
  FOREIGN KEY ("previousVersionId") REFERENCES "Expense"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "Payment_clinicId_method_verifiedAt_idx" ON "Payment"("clinicId", "method", "verifiedAt");
CREATE INDEX "Payment_clinicId_serviceCategory_verifiedAt_idx" ON "Payment"("clinicId", "serviceCategory", "verifiedAt");
CREATE INDEX "Expense_clinicId_isCurrent_occurredAt_idx" ON "Expense"("clinicId", "isCurrent", "occurredAt");
