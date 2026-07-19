-- Multi-tenant branch, role profile, and audit foundation.

CREATE TABLE "tenant_branches" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "address" TEXT,
  "phone_number" TEXT,
  "email" TEXT,
  "work_location_lat" DECIMAL(65,30),
  "work_location_lng" DECIMAL(65,30),
  "geofence_radius" INTEGER,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "tenant_branches_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tenant_user_branches" (
  "id" TEXT NOT NULL,
  "tenant_user_id" TEXT NOT NULL,
  "branch_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "tenant_user_branches_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tenant_role_profiles" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT,
  "permissions" JSONB NOT NULL DEFAULT '[]',
  "is_system" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "tenant_role_profiles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tenant_audit_logs" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "branch_id" TEXT,
  "actor_user_id" TEXT,
  "action" TEXT NOT NULL,
  "module" TEXT NOT NULL,
  "entity_type" TEXT,
  "entity_id" TEXT,
  "before" JSONB,
  "after" JSONB,
  "ip" TEXT,
  "user_agent" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "tenant_audit_logs_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "tenant_users" ADD COLUMN "role_profile_id" TEXT;

ALTER TABLE "departments" ADD COLUMN "branch_id" TEXT;
ALTER TABLE "employees" ADD COLUMN "branch_id" TEXT;
ALTER TABLE "attendance_logs" ADD COLUMN "branch_id" TEXT;
ALTER TABLE "leave_requests" ADD COLUMN "branch_id" TEXT;
ALTER TABLE "salary_components" ADD COLUMN "branch_id" TEXT;
ALTER TABLE "payroll_runs" ADD COLUMN "branch_id" TEXT;
ALTER TABLE "reimbursement_requests" ADD COLUMN "branch_id" TEXT;
ALTER TABLE "field_reports" ADD COLUMN "branch_id" TEXT;
ALTER TABLE "performance_kpis" ADD COLUMN "branch_id" TEXT;
ALTER TABLE "job_postings" ADD COLUMN "branch_id" TEXT;
ALTER TABLE "job_applicants" ADD COLUMN "branch_id" TEXT;

ALTER TABLE "pos_tables" ADD COLUMN "branch_id" TEXT;
ALTER TABLE "pos_categories" ADD COLUMN "branch_id" TEXT;
ALTER TABLE "pos_products" ADD COLUMN "branch_id" TEXT;
ALTER TABLE "pos_modifier_groups" ADD COLUMN "branch_id" TEXT;
ALTER TABLE "pos_orders" ADD COLUMN "branch_id" TEXT;
ALTER TABLE "pos_shifts" ADD COLUMN "branch_id" TEXT;
ALTER TABLE "pos_ingredients" ADD COLUMN "branch_id" TEXT;
ALTER TABLE "pos_stock_logs" ADD COLUMN "branch_id" TEXT;
ALTER TABLE "fnb_promo_rules" ADD COLUMN "branch_id" TEXT;
ALTER TABLE "fnb_bakery_pre_orders" ADD COLUMN "branch_id" TEXT;
ALTER TABLE "fnb_wholesale_customers" ADD COLUMN "branch_id" TEXT;
ALTER TABLE "fnb_wholesale_orders" ADD COLUMN "branch_id" TEXT;
ALTER TABLE "fnb_delivery_integrations" ADD COLUMN "branch_id" TEXT;
ALTER TABLE "fnb_delivery_statuses" ADD COLUMN "branch_id" TEXT;
ALTER TABLE "fnb_food_court_tenants" ADD COLUMN "branch_id" TEXT;
ALTER TABLE "fnb_tenant_settlements" ADD COLUMN "branch_id" TEXT;

ALTER TABLE "church_members" ADD COLUMN "branch_id" TEXT;
ALTER TABLE "church_cell_groups" ADD COLUMN "branch_id" TEXT;
ALTER TABLE "church_events" ADD COLUMN "branch_id" TEXT;
ALTER TABLE "church_volunteer_schedules" ADD COLUMN "branch_id" TEXT;
ALTER TABLE "church_donations" ADD COLUMN "branch_id" TEXT;
ALTER TABLE "church_assets" ADD COLUMN "branch_id" TEXT;

CREATE UNIQUE INDEX "tenant_branches_tenant_id_code_key" ON "tenant_branches"("tenant_id", "code");
CREATE INDEX "tenant_branches_tenant_id_status_idx" ON "tenant_branches"("tenant_id", "status");
CREATE UNIQUE INDEX "tenant_user_branches_tenant_user_id_branch_id_key" ON "tenant_user_branches"("tenant_user_id", "branch_id");
CREATE UNIQUE INDEX "tenant_role_profiles_tenant_id_slug_key" ON "tenant_role_profiles"("tenant_id", "slug");
CREATE INDEX "tenant_audit_logs_tenant_id_branch_id_created_at_idx" ON "tenant_audit_logs"("tenant_id", "branch_id", "created_at");
CREATE INDEX "tenant_audit_logs_tenant_id_action_idx" ON "tenant_audit_logs"("tenant_id", "action");

DROP INDEX IF EXISTS "payroll_runs_tenant_id_period_key";
CREATE UNIQUE INDEX "payroll_runs_tenant_id_branch_id_period_key" ON "payroll_runs"("tenant_id", "branch_id", "period");

ALTER TABLE "tenant_branches" ADD CONSTRAINT "tenant_branches_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tenant_user_branches" ADD CONSTRAINT "tenant_user_branches_tenant_user_id_fkey" FOREIGN KEY ("tenant_user_id") REFERENCES "tenant_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tenant_user_branches" ADD CONSTRAINT "tenant_user_branches_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "tenant_branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tenant_role_profiles" ADD CONSTRAINT "tenant_role_profiles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tenant_users" ADD CONSTRAINT "tenant_users_role_profile_id_fkey" FOREIGN KEY ("role_profile_id") REFERENCES "tenant_role_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tenant_audit_logs" ADD CONSTRAINT "tenant_audit_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tenant_audit_logs" ADD CONSTRAINT "tenant_audit_logs_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "tenant_branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "tenant_branches" ("id", "tenant_id", "name", "code", "status", "work_location_lat", "work_location_lng", "geofence_radius", "metadata", "created_at", "updated_at")
SELECT
  'main-branch-' || "id",
  "id",
  'Main Branch',
  'MAIN',
  'active',
  "work_location_lat",
  "work_location_lng",
  "geofence_radius",
  '{}',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "tenants"
ON CONFLICT ("tenant_id", "code") DO NOTHING;

INSERT INTO "tenant_user_branches" ("id", "tenant_user_id", "branch_id", "created_at")
SELECT
  'access-' || tu."id" || '-' || tb."id",
  tu."id",
  tb."id",
  CURRENT_TIMESTAMP
FROM "tenant_users" tu
JOIN "tenant_branches" tb ON tb."tenant_id" = tu."tenant_id" AND tb."code" = 'MAIN'
ON CONFLICT ("tenant_user_id", "branch_id") DO NOTHING;

INSERT INTO "tenant_role_profiles" ("id", "tenant_id", "name", "slug", "description", "permissions", "is_system", "created_at", "updated_at")
SELECT 'owner-role-' || "id", "id", 'Owner', 'owner', 'Full owner access', '["*"]', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "tenants"
ON CONFLICT ("tenant_id", "slug") DO NOTHING;

UPDATE "tenant_users" tu
SET "role_profile_id" = rp."id"
FROM "tenant_role_profiles" rp
WHERE rp."tenant_id" = tu."tenant_id" AND rp."slug" = 'owner' AND tu."role" IN ('owner', 'admin') AND tu."role_profile_id" IS NULL;

DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'departments','employees','attendance_logs','leave_requests','salary_components','payroll_runs',
    'reimbursement_requests','field_reports','performance_kpis','job_postings','job_applicants',
    'pos_tables','pos_categories','pos_products','pos_modifier_groups','pos_orders','pos_shifts','pos_ingredients','pos_stock_logs',
    'fnb_promo_rules','fnb_bakery_pre_orders','fnb_wholesale_customers','fnb_wholesale_orders','fnb_delivery_integrations','fnb_delivery_statuses','fnb_food_court_tenants','fnb_tenant_settlements',
    'church_members','church_cell_groups','church_events','church_volunteer_schedules','church_donations','church_assets'
  ]
  LOOP
    EXECUTE format('UPDATE %I row SET branch_id = tb.id FROM tenant_branches tb WHERE row.tenant_id = tb.tenant_id AND tb.code = %L AND row.branch_id IS NULL', table_name, 'MAIN');
  END LOOP;
END $$;

DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'departments','employees','attendance_logs','leave_requests','salary_components','payroll_runs',
    'reimbursement_requests','field_reports','performance_kpis','job_postings','job_applicants',
    'pos_tables','pos_categories','pos_products','pos_modifier_groups','pos_orders','pos_shifts','pos_ingredients','pos_stock_logs',
    'fnb_promo_rules','fnb_bakery_pre_orders','fnb_wholesale_customers','fnb_wholesale_orders','fnb_delivery_integrations','fnb_delivery_statuses','fnb_food_court_tenants','fnb_tenant_settlements',
    'church_members','church_cell_groups','church_events','church_volunteer_schedules','church_donations','church_assets'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY ("branch_id") REFERENCES "tenant_branches"("id") ON DELETE SET NULL ON UPDATE CASCADE', table_name, table_name || '_branch_id_fkey');
  END LOOP;
END $$;
