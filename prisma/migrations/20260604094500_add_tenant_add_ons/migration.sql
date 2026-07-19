-- Add dynamic add-on catalog and tenant entitlement ownership.
CREATE TABLE "add_ons" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "complexity" TEXT NOT NULL,
    "price" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "cadence" TEXT NOT NULL DEFAULT '/ bulan',
    "description" TEXT NOT NULL,
    "best_for" TEXT NOT NULL,
    "recommended_for" JSONB NOT NULL DEFAULT '[]',
    "source_app" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "add_ons_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tenant_add_ons" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "branch_id" TEXT,
    "add_on_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "started_at" TIMESTAMP(3) NOT NULL,
    "current_period_end" TIMESTAMP(3),
    "price" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "purchased_by_user_id" TEXT,
    "checkout_session_id" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_add_ons_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "tenant_subscriptions"
    ADD COLUMN "branch_id" TEXT,
    ADD COLUMN "created_by_user_id" TEXT;

ALTER TABLE "billing_checkout_sessions"
    ADD COLUMN "branch_id" TEXT,
    ADD COLUMN "created_by_user_id" TEXT;

CREATE UNIQUE INDEX "add_ons_slug_key" ON "add_ons"("slug");
CREATE INDEX "add_ons_category_is_active_idx" ON "add_ons"("category", "is_active");
CREATE INDEX "tenant_subscriptions_tenant_id_branch_id_status_idx" ON "tenant_subscriptions"("tenant_id", "branch_id", "status");
CREATE INDEX "tenant_subscriptions_created_by_user_id_idx" ON "tenant_subscriptions"("created_by_user_id");
CREATE INDEX "billing_checkout_sessions_tenant_id_branch_id_status_idx" ON "billing_checkout_sessions"("tenant_id", "branch_id", "status");
CREATE INDEX "billing_checkout_sessions_created_by_user_id_idx" ON "billing_checkout_sessions"("created_by_user_id");
CREATE INDEX "tenant_add_ons_tenant_id_status_idx" ON "tenant_add_ons"("tenant_id", "status");
CREATE INDEX "tenant_add_ons_tenant_id_branch_id_status_idx" ON "tenant_add_ons"("tenant_id", "branch_id", "status");
CREATE INDEX "tenant_add_ons_tenant_id_add_on_id_idx" ON "tenant_add_ons"("tenant_id", "add_on_id");
CREATE INDEX "tenant_add_ons_purchased_by_user_id_idx" ON "tenant_add_ons"("purchased_by_user_id");

ALTER TABLE "tenant_subscriptions"
    ADD CONSTRAINT "tenant_subscriptions_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "tenant_branches"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT "tenant_subscriptions_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "billing_checkout_sessions"
    ADD CONSTRAINT "billing_checkout_sessions_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "tenant_branches"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT "billing_checkout_sessions_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "tenant_add_ons"
    ADD CONSTRAINT "tenant_add_ons_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "tenant_add_ons_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "tenant_branches"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT "tenant_add_ons_add_on_id_fkey" FOREIGN KEY ("add_on_id") REFERENCES "add_ons"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "tenant_add_ons_purchased_by_user_id_fkey" FOREIGN KEY ("purchased_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT "tenant_add_ons_checkout_session_id_fkey" FOREIGN KEY ("checkout_session_id") REFERENCES "billing_checkout_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
