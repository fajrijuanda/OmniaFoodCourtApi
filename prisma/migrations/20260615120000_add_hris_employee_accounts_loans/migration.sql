ALTER TABLE "users"
ADD COLUMN "must_change_password" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "employees"
ADD COLUMN "user_id" TEXT,
ADD COLUMN "email" TEXT;

CREATE UNIQUE INDEX "employees_user_id_key" ON "employees"("user_id");
CREATE INDEX "employees_tenant_id_email_idx" ON "employees"("tenant_id", "email");

ALTER TABLE "employees"
ADD CONSTRAINT "employees_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "employee_loan_requests" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "branch_id" TEXT,
  "employee_id" TEXT NOT NULL,
  "amount" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "reason" TEXT,
  "installment_months" INTEGER NOT NULL DEFAULT 1,
  "monthly_deduction" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "remaining_balance" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'Pending',
  "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "decided_at" TIMESTAMP(3),
  "decided_by_user_id" TEXT,
  "decision_notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "employee_loan_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "employee_loan_requests_tenant_id_branch_id_status_idx"
ON "employee_loan_requests"("tenant_id", "branch_id", "status");

CREATE INDEX "employee_loan_requests_employee_id_status_idx"
ON "employee_loan_requests"("employee_id", "status");

ALTER TABLE "employee_loan_requests"
ADD CONSTRAINT "employee_loan_requests_tenant_id_fkey"
FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "employee_loan_requests"
ADD CONSTRAINT "employee_loan_requests_branch_id_fkey"
FOREIGN KEY ("branch_id") REFERENCES "tenant_branches"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "employee_loan_requests"
ADD CONSTRAINT "employee_loan_requests_employee_id_fkey"
FOREIGN KEY ("employee_id") REFERENCES "employees"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
