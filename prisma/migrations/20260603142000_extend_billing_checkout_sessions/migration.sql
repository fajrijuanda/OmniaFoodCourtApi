ALTER TABLE "billing_checkout_sessions"
  ALTER COLUMN "tenant_id" DROP NOT NULL,
  ALTER COLUMN "sub_industry_id" DROP NOT NULL,
  ALTER COLUMN "tier_id" DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'portal',
  ADD COLUMN IF NOT EXISTS "customer_name" TEXT,
  ADD COLUMN IF NOT EXISTS "customer_email" TEXT,
  ADD COLUMN IF NOT EXISTS "customer_phone" TEXT,
  ADD COLUMN IF NOT EXISTS "items_json" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS "follow_up_status" TEXT NOT NULL DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS "follow_up_notes" TEXT,
  ADD COLUMN IF NOT EXISTS "last_followed_up_at" TIMESTAMP(3);
