ALTER TABLE "tenants"
  ADD COLUMN IF NOT EXISTS "hris_settings" JSONB,
  ADD COLUMN IF NOT EXISTS "church_settings" JSONB;
