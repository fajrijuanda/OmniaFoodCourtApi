-- F&B operational extension modules used by the F&B sub-industry portal.

CREATE TABLE "fnb_promo_rules" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "tenant_name" TEXT,
  "type" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'Aktif',
  "start_date" TIMESTAMP(3),
  "end_date" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "fnb_promo_rules_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "fnb_bakery_pre_orders" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "customer_name" TEXT NOT NULL,
  "contact" TEXT NOT NULL,
  "product_name" TEXT NOT NULL,
  "pickup_date" TIMESTAMP(3) NOT NULL,
  "pickup_time" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "deposit_paid" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "total_amount" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'New',
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "fnb_bakery_pre_orders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "fnb_wholesale_customers" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "price_tier" TEXT NOT NULL,
  "payment_terms" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "fnb_wholesale_customers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "fnb_wholesale_orders" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "customer_id" TEXT NOT NULL,
  "delivery_date" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'Draft',
  "items" JSONB NOT NULL DEFAULT '[]',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "fnb_wholesale_orders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "fnb_delivery_integrations" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'Ready to connect',
  "menu_mapped" INTEGER NOT NULL DEFAULT 0,
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "fnb_delivery_integrations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "fnb_delivery_statuses" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "invoice_number" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "kitchen_status" TEXT NOT NULL,
  "fulfillment" TEXT NOT NULL,
  "eta_minutes" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "fnb_delivery_statuses_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "fnb_food_court_tenants" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'Aktif',
  "commission" DECIMAL(65,30) NOT NULL DEFAULT 12,
  "category_name" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "fnb_food_court_tenants_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "fnb_tenant_settlements" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "food_court_tenant_id" TEXT NOT NULL,
  "period" TEXT NOT NULL,
  "sales_amount" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "commission_amount" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "net_settlement" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'Pending',
  "paid_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "fnb_tenant_settlements_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "fnb_promo_rules_tenant_id_status_idx" ON "fnb_promo_rules"("tenant_id", "status");
CREATE INDEX "fnb_bakery_pre_orders_tenant_id_status_idx" ON "fnb_bakery_pre_orders"("tenant_id", "status");
CREATE INDEX "fnb_wholesale_customers_tenant_id_idx" ON "fnb_wholesale_customers"("tenant_id");
CREATE INDEX "fnb_wholesale_orders_tenant_id_status_idx" ON "fnb_wholesale_orders"("tenant_id", "status");
CREATE UNIQUE INDEX "fnb_delivery_integrations_tenant_id_channel_key" ON "fnb_delivery_integrations"("tenant_id", "channel");
CREATE INDEX "fnb_delivery_statuses_tenant_id_channel_idx" ON "fnb_delivery_statuses"("tenant_id", "channel");
CREATE INDEX "fnb_food_court_tenants_tenant_id_status_idx" ON "fnb_food_court_tenants"("tenant_id", "status");
CREATE UNIQUE INDEX "fnb_tenant_settlements_food_court_tenant_id_period_key" ON "fnb_tenant_settlements"("food_court_tenant_id", "period");
CREATE INDEX "fnb_tenant_settlements_tenant_id_status_idx" ON "fnb_tenant_settlements"("tenant_id", "status");

ALTER TABLE "fnb_promo_rules" ADD CONSTRAINT "fnb_promo_rules_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fnb_bakery_pre_orders" ADD CONSTRAINT "fnb_bakery_pre_orders_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fnb_wholesale_customers" ADD CONSTRAINT "fnb_wholesale_customers_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fnb_wholesale_orders" ADD CONSTRAINT "fnb_wholesale_orders_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fnb_wholesale_orders" ADD CONSTRAINT "fnb_wholesale_orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "fnb_wholesale_customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "fnb_delivery_integrations" ADD CONSTRAINT "fnb_delivery_integrations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fnb_delivery_statuses" ADD CONSTRAINT "fnb_delivery_statuses_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fnb_food_court_tenants" ADD CONSTRAINT "fnb_food_court_tenants_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fnb_tenant_settlements" ADD CONSTRAINT "fnb_tenant_settlements_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fnb_tenant_settlements" ADD CONSTRAINT "fnb_tenant_settlements_food_court_tenant_id_fkey" FOREIGN KEY ("food_court_tenant_id") REFERENCES "fnb_food_court_tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
