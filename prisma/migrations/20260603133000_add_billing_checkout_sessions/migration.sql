CREATE TABLE "billing_checkout_sessions" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "sub_industry_id" TEXT NOT NULL,
  "tier_id" TEXT NOT NULL,
  "external_id" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'xendit',
  "provider_invoice_id" TEXT,
  "checkout_url" TEXT,
  "action" TEXT NOT NULL,
  "payment_method" TEXT NOT NULL,
  "subtotal" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "tax" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "gateway_fee" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "total" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "paid_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "billing_checkout_sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "billing_checkout_sessions_external_id_key" ON "billing_checkout_sessions"("external_id");
CREATE INDEX "billing_checkout_sessions_tenant_id_status_idx" ON "billing_checkout_sessions"("tenant_id", "status");

ALTER TABLE "billing_checkout_sessions" ADD CONSTRAINT "billing_checkout_sessions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "billing_checkout_sessions" ADD CONSTRAINT "billing_checkout_sessions_sub_industry_id_fkey" FOREIGN KEY ("sub_industry_id") REFERENCES "sub_industries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "billing_checkout_sessions" ADD CONSTRAINT "billing_checkout_sessions_tier_id_fkey" FOREIGN KEY ("tier_id") REFERENCES "tiers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
