ALTER TABLE "tenants"
  ADD COLUMN IF NOT EXISTS "fnb_settings" JSONB;
