CREATE TABLE "pos_promo_banners" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "branch_id" TEXT,
    "title" TEXT NOT NULL,
    "image_url" TEXT NOT NULL,
    "link_url" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "starts_at" TIMESTAMP(3),
    "ends_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "pos_promo_banners_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "pos_promo_banners_tenant_id_branch_id_is_active_sort_order_idx" ON "pos_promo_banners"("tenant_id", "branch_id", "is_active", "sort_order");

ALTER TABLE "pos_promo_banners" ADD CONSTRAINT "pos_promo_banners_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pos_promo_banners" ADD CONSTRAINT "pos_promo_banners_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "tenant_branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
