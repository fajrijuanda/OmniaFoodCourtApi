CREATE TABLE "clinic_patients" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "branch_id" TEXT,
  "medical_record_no" TEXT NOT NULL,
  "full_name" TEXT NOT NULL,
  "gender" TEXT,
  "dob" TIMESTAMP(3),
  "phone_number" TEXT,
  "identity_number" TEXT,
  "address" TEXT,
  "blood_type" TEXT,
  "allergy_notes" TEXT,
  "status" TEXT NOT NULL DEFAULT 'active',
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "clinic_patients_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "clinic_services" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "branch_id" TEXT,
  "name" TEXT NOT NULL,
  "code" TEXT,
  "category" TEXT NOT NULL DEFAULT 'Poli',
  "price" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "duration_min" INTEGER NOT NULL DEFAULT 30,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "clinic_services_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "clinic_appointments" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "branch_id" TEXT,
  "patient_id" TEXT NOT NULL,
  "service_id" TEXT,
  "provider_employee_id" TEXT,
  "scheduled_at" TIMESTAMP(3) NOT NULL,
  "queue_number" TEXT,
  "status" TEXT NOT NULL DEFAULT 'scheduled',
  "source" TEXT NOT NULL DEFAULT 'internal',
  "reminder_status" TEXT NOT NULL DEFAULT 'pending',
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "clinic_appointments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "clinic_queue_tickets" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "branch_id" TEXT,
  "patient_id" TEXT NOT NULL,
  "appointment_id" TEXT,
  "number" TEXT NOT NULL,
  "station" TEXT,
  "status" TEXT NOT NULL DEFAULT 'waiting',
  "called_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "clinic_queue_tickets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "clinic_visits" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "branch_id" TEXT,
  "patient_id" TEXT NOT NULL,
  "appointment_id" TEXT,
  "service_id" TEXT,
  "provider_employee_id" TEXT,
  "nurse_employee_id" TEXT,
  "chief_complaint" TEXT,
  "status" TEXT NOT NULL DEFAULT 'open',
  "follow_up_at" TIMESTAMP(3),
  "finalized_at" TIMESTAMP(3),
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "clinic_visits_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "clinic_visit_vitals" (
  "id" TEXT NOT NULL,
  "visit_id" TEXT NOT NULL,
  "temperature" DECIMAL(65,30),
  "systolic" INTEGER,
  "diastolic" INTEGER,
  "pulse" INTEGER,
  "respiration" INTEGER,
  "weight" DECIMAL(65,30),
  "height" DECIMAL(65,30),
  "oxygen_sat" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "clinic_visit_vitals_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "clinic_visit_soaps" (
  "id" TEXT NOT NULL,
  "visit_id" TEXT NOT NULL,
  "subjective" TEXT,
  "objective" TEXT,
  "assessment" TEXT,
  "plan" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "clinic_visit_soaps_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "clinic_diagnoses" (
  "id" TEXT NOT NULL,
  "visit_id" TEXT NOT NULL,
  "code" TEXT,
  "name" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'primary',
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "clinic_diagnoses_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "clinic_treatments" (
  "id" TEXT NOT NULL,
  "visit_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "price" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "clinic_treatments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "clinic_prescriptions" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "branch_id" TEXT,
  "patient_id" TEXT NOT NULL,
  "visit_id" TEXT,
  "status" TEXT NOT NULL DEFAULT 'issued',
  "notes" TEXT,
  "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dispensed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "clinic_prescriptions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "clinic_prescription_items" (
  "id" TEXT NOT NULL,
  "prescription_id" TEXT NOT NULL,
  "drug_id" TEXT,
  "name" TEXT NOT NULL,
  "dosage" TEXT,
  "quantity" DECIMAL(65,30) NOT NULL DEFAULT 1,
  "instructions" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "clinic_prescription_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "clinic_drugs" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "branch_id" TEXT,
  "sku" TEXT,
  "name" TEXT NOT NULL,
  "unit" TEXT NOT NULL DEFAULT 'pcs',
  "cost_price" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "sale_price" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "min_stock" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "expiry_date" TIMESTAMP(3),
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "clinic_drugs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "clinic_drug_stocks" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "branch_id" TEXT,
  "drug_id" TEXT NOT NULL,
  "quantity" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "batch_no" TEXT,
  "expiry_date" TIMESTAMP(3),
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "clinic_drug_stocks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "clinic_drug_movements" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "branch_id" TEXT,
  "drug_id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "quantity" DECIMAL(65,30) NOT NULL,
  "reference" TEXT,
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "clinic_drug_movements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "clinic_purchase_orders" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "branch_id" TEXT,
  "po_number" TEXT NOT NULL,
  "vendor_name" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "total_amount" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "clinic_purchase_orders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "clinic_stock_opnames" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "branch_id" TEXT,
  "code" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "clinic_stock_opnames_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "clinic_invoices" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "branch_id" TEXT,
  "patient_id" TEXT NOT NULL,
  "visit_id" TEXT,
  "invoice_number" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "total_amount" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "paid_amount" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "paid_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "clinic_invoices_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "clinic_invoice_items" (
  "id" TEXT NOT NULL,
  "invoice_id" TEXT NOT NULL,
  "service_id" TEXT,
  "drug_id" TEXT,
  "name" TEXT NOT NULL,
  "quantity" DECIMAL(65,30) NOT NULL DEFAULT 1,
  "unit_price" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "total_amount" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "clinic_invoice_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "clinic_payments" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "branch_id" TEXT,
  "invoice_id" TEXT NOT NULL,
  "amount" DECIMAL(65,30) NOT NULL,
  "method" TEXT NOT NULL DEFAULT 'cash',
  "status" TEXT NOT NULL DEFAULT 'paid',
  "reference" TEXT,
  "paid_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "clinic_payments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "clinic_cashier_closings" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "branch_id" TEXT,
  "cashier_user_id" TEXT,
  "period_date" TIMESTAMP(3) NOT NULL,
  "system_amount" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "actual_amount" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'closed',
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "clinic_cashier_closings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "clinic_patient_transfers" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "patient_id" TEXT NOT NULL,
  "from_branch_id" TEXT,
  "to_branch_id" TEXT,
  "status" TEXT NOT NULL DEFAULT 'requested',
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "clinic_patient_transfers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "clinic_lab_mailbox_messages" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "branch_id" TEXT,
  "vendor" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'new',
  "payload" JSONB NOT NULL DEFAULT '{}',
  "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "clinic_lab_mailbox_messages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "clinic_satusehat_sync_logs" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "branch_id" TEXT,
  "entity_type" TEXT NOT NULL,
  "entity_id" TEXT,
  "status" TEXT NOT NULL DEFAULT 'queued',
  "request_json" JSONB,
  "response_json" JSONB,
  "synced_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "clinic_satusehat_sync_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "clinic_patients_tenant_id_medical_record_no_key" ON "clinic_patients"("tenant_id", "medical_record_no");
CREATE INDEX "clinic_patients_tenant_id_branch_id_status_idx" ON "clinic_patients"("tenant_id", "branch_id", "status");
CREATE INDEX "clinic_patients_tenant_id_full_name_idx" ON "clinic_patients"("tenant_id", "full_name");
CREATE INDEX "clinic_services_tenant_id_branch_id_is_active_idx" ON "clinic_services"("tenant_id", "branch_id", "is_active");
CREATE INDEX "clinic_appointments_tenant_id_branch_id_scheduled_at_idx" ON "clinic_appointments"("tenant_id", "branch_id", "scheduled_at");
CREATE INDEX "clinic_appointments_tenant_id_status_idx" ON "clinic_appointments"("tenant_id", "status");
CREATE INDEX "clinic_queue_tickets_tenant_id_branch_id_status_created_at_idx" ON "clinic_queue_tickets"("tenant_id", "branch_id", "status", "created_at");
CREATE INDEX "clinic_visits_tenant_id_branch_id_status_idx" ON "clinic_visits"("tenant_id", "branch_id", "status");
CREATE INDEX "clinic_visits_tenant_id_patient_id_created_at_idx" ON "clinic_visits"("tenant_id", "patient_id", "created_at");
CREATE UNIQUE INDEX "clinic_visit_vitals_visit_id_key" ON "clinic_visit_vitals"("visit_id");
CREATE UNIQUE INDEX "clinic_visit_soaps_visit_id_key" ON "clinic_visit_soaps"("visit_id");
CREATE INDEX "clinic_prescriptions_tenant_id_branch_id_status_idx" ON "clinic_prescriptions"("tenant_id", "branch_id", "status");
CREATE INDEX "clinic_drugs_tenant_id_branch_id_is_active_idx" ON "clinic_drugs"("tenant_id", "branch_id", "is_active");
CREATE UNIQUE INDEX "clinic_drug_stocks_branch_id_drug_id_batch_no_key" ON "clinic_drug_stocks"("branch_id", "drug_id", "batch_no");
CREATE INDEX "clinic_drug_stocks_tenant_id_branch_id_idx" ON "clinic_drug_stocks"("tenant_id", "branch_id");
CREATE INDEX "clinic_drug_movements_tenant_id_branch_id_created_at_idx" ON "clinic_drug_movements"("tenant_id", "branch_id", "created_at");
CREATE UNIQUE INDEX "clinic_purchase_orders_tenant_id_po_number_key" ON "clinic_purchase_orders"("tenant_id", "po_number");
CREATE UNIQUE INDEX "clinic_stock_opnames_tenant_id_code_key" ON "clinic_stock_opnames"("tenant_id", "code");
CREATE UNIQUE INDEX "clinic_invoices_tenant_id_invoice_number_key" ON "clinic_invoices"("tenant_id", "invoice_number");
CREATE INDEX "clinic_invoices_tenant_id_branch_id_status_idx" ON "clinic_invoices"("tenant_id", "branch_id", "status");
CREATE INDEX "clinic_payments_tenant_id_branch_id_paid_at_idx" ON "clinic_payments"("tenant_id", "branch_id", "paid_at");
CREATE INDEX "clinic_cashier_closings_tenant_id_branch_id_period_date_idx" ON "clinic_cashier_closings"("tenant_id", "branch_id", "period_date");
CREATE INDEX "clinic_patient_transfers_tenant_id_status_idx" ON "clinic_patient_transfers"("tenant_id", "status");
CREATE INDEX "clinic_lab_mailbox_messages_tenant_id_branch_id_status_idx" ON "clinic_lab_mailbox_messages"("tenant_id", "branch_id", "status");
CREATE INDEX "clinic_satusehat_sync_logs_tenant_id_branch_id_status_idx" ON "clinic_satusehat_sync_logs"("tenant_id", "branch_id", "status");

ALTER TABLE "clinic_patients" ADD CONSTRAINT "clinic_patients_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "clinic_patients" ADD CONSTRAINT "clinic_patients_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "tenant_branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "clinic_services" ADD CONSTRAINT "clinic_services_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "clinic_services" ADD CONSTRAINT "clinic_services_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "tenant_branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "clinic_appointments" ADD CONSTRAINT "clinic_appointments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "clinic_appointments" ADD CONSTRAINT "clinic_appointments_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "tenant_branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "clinic_appointments" ADD CONSTRAINT "clinic_appointments_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "clinic_patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "clinic_appointments" ADD CONSTRAINT "clinic_appointments_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "clinic_services"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "clinic_appointments" ADD CONSTRAINT "clinic_appointments_provider_employee_id_fkey" FOREIGN KEY ("provider_employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "clinic_queue_tickets" ADD CONSTRAINT "clinic_queue_tickets_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "clinic_queue_tickets" ADD CONSTRAINT "clinic_queue_tickets_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "tenant_branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "clinic_queue_tickets" ADD CONSTRAINT "clinic_queue_tickets_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "clinic_patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "clinic_queue_tickets" ADD CONSTRAINT "clinic_queue_tickets_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "clinic_appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "clinic_visits" ADD CONSTRAINT "clinic_visits_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "clinic_visits" ADD CONSTRAINT "clinic_visits_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "tenant_branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "clinic_visits" ADD CONSTRAINT "clinic_visits_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "clinic_patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "clinic_visits" ADD CONSTRAINT "clinic_visits_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "clinic_appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "clinic_visits" ADD CONSTRAINT "clinic_visits_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "clinic_services"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "clinic_visits" ADD CONSTRAINT "clinic_visits_provider_employee_id_fkey" FOREIGN KEY ("provider_employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "clinic_visits" ADD CONSTRAINT "clinic_visits_nurse_employee_id_fkey" FOREIGN KEY ("nurse_employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "clinic_visit_vitals" ADD CONSTRAINT "clinic_visit_vitals_visit_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "clinic_visits"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "clinic_visit_soaps" ADD CONSTRAINT "clinic_visit_soaps_visit_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "clinic_visits"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "clinic_diagnoses" ADD CONSTRAINT "clinic_diagnoses_visit_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "clinic_visits"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "clinic_treatments" ADD CONSTRAINT "clinic_treatments_visit_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "clinic_visits"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "clinic_prescriptions" ADD CONSTRAINT "clinic_prescriptions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "clinic_prescriptions" ADD CONSTRAINT "clinic_prescriptions_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "tenant_branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "clinic_prescriptions" ADD CONSTRAINT "clinic_prescriptions_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "clinic_patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "clinic_prescriptions" ADD CONSTRAINT "clinic_prescriptions_visit_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "clinic_visits"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "clinic_prescription_items" ADD CONSTRAINT "clinic_prescription_items_prescription_id_fkey" FOREIGN KEY ("prescription_id") REFERENCES "clinic_prescriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "clinic_prescription_items" ADD CONSTRAINT "clinic_prescription_items_drug_id_fkey" FOREIGN KEY ("drug_id") REFERENCES "clinic_drugs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "clinic_drugs" ADD CONSTRAINT "clinic_drugs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "clinic_drugs" ADD CONSTRAINT "clinic_drugs_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "tenant_branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "clinic_drug_stocks" ADD CONSTRAINT "clinic_drug_stocks_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "clinic_drug_stocks" ADD CONSTRAINT "clinic_drug_stocks_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "tenant_branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "clinic_drug_stocks" ADD CONSTRAINT "clinic_drug_stocks_drug_id_fkey" FOREIGN KEY ("drug_id") REFERENCES "clinic_drugs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "clinic_drug_movements" ADD CONSTRAINT "clinic_drug_movements_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "clinic_drug_movements" ADD CONSTRAINT "clinic_drug_movements_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "tenant_branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "clinic_drug_movements" ADD CONSTRAINT "clinic_drug_movements_drug_id_fkey" FOREIGN KEY ("drug_id") REFERENCES "clinic_drugs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "clinic_purchase_orders" ADD CONSTRAINT "clinic_purchase_orders_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "clinic_purchase_orders" ADD CONSTRAINT "clinic_purchase_orders_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "tenant_branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "clinic_stock_opnames" ADD CONSTRAINT "clinic_stock_opnames_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "clinic_stock_opnames" ADD CONSTRAINT "clinic_stock_opnames_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "tenant_branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "clinic_invoices" ADD CONSTRAINT "clinic_invoices_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "clinic_invoices" ADD CONSTRAINT "clinic_invoices_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "tenant_branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "clinic_invoices" ADD CONSTRAINT "clinic_invoices_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "clinic_patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "clinic_invoices" ADD CONSTRAINT "clinic_invoices_visit_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "clinic_visits"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "clinic_invoice_items" ADD CONSTRAINT "clinic_invoice_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "clinic_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "clinic_invoice_items" ADD CONSTRAINT "clinic_invoice_items_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "clinic_services"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "clinic_invoice_items" ADD CONSTRAINT "clinic_invoice_items_drug_id_fkey" FOREIGN KEY ("drug_id") REFERENCES "clinic_drugs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "clinic_payments" ADD CONSTRAINT "clinic_payments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "clinic_payments" ADD CONSTRAINT "clinic_payments_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "tenant_branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "clinic_payments" ADD CONSTRAINT "clinic_payments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "clinic_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "clinic_cashier_closings" ADD CONSTRAINT "clinic_cashier_closings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "clinic_cashier_closings" ADD CONSTRAINT "clinic_cashier_closings_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "tenant_branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "clinic_patient_transfers" ADD CONSTRAINT "clinic_patient_transfers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "clinic_patient_transfers" ADD CONSTRAINT "clinic_patient_transfers_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "clinic_patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "clinic_patient_transfers" ADD CONSTRAINT "clinic_patient_transfers_from_branch_id_fkey" FOREIGN KEY ("from_branch_id") REFERENCES "tenant_branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "clinic_patient_transfers" ADD CONSTRAINT "clinic_patient_transfers_to_branch_id_fkey" FOREIGN KEY ("to_branch_id") REFERENCES "tenant_branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "clinic_lab_mailbox_messages" ADD CONSTRAINT "clinic_lab_mailbox_messages_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "clinic_lab_mailbox_messages" ADD CONSTRAINT "clinic_lab_mailbox_messages_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "tenant_branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "clinic_satusehat_sync_logs" ADD CONSTRAINT "clinic_satusehat_sync_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "clinic_satusehat_sync_logs" ADD CONSTRAINT "clinic_satusehat_sync_logs_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "tenant_branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
