CREATE TABLE "social_commerce_workspace_settings" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "branch_id" TEXT,
  "market" TEXT NOT NULL DEFAULT 'Indonesia',
  "preset" TEXT NOT NULL DEFAULT 'Beauty & skincare',
  "refresh_mode" TEXT NOT NULL DEFAULT 'demo_seeded',
  "categories" JSONB NOT NULL DEFAULT '[]',
  "channels" JSONB NOT NULL DEFAULT '[]',
  "data_mode" TEXT NOT NULL DEFAULT 'demo_seeded',
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "social_commerce_workspace_settings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "social_commerce_connectors" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "branch_id" TEXT,
  "channel" TEXT NOT NULL,
  "display_name" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'needs_credentials',
  "last_sync_at" TIMESTAMP(3),
  "credential_hint" TEXT,
  "notes" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "social_commerce_connectors_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "social_commerce_product_trends" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "branch_id" TEXT,
  "product_name" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "marketplace_rank" INTEGER,
  "signal" TEXT NOT NULL,
  "freshness_score" INTEGER NOT NULL DEFAULT 0,
  "saturation_level" TEXT NOT NULL,
  "confidence_score" INTEGER NOT NULL DEFAULT 0,
  "margin_estimate" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "price_min" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "price_max" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "gmv_proxy" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "review_velocity" INTEGER NOT NULL DEFAULT 0,
  "creator_velocity" INTEGER NOT NULL DEFAULT 0,
  "recommended_action" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'watch',
  "details" JSONB NOT NULL DEFAULT '{}',
  "captured_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "social_commerce_product_trends_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "social_commerce_creator_signals" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "branch_id" TEXT,
  "handle" TEXT NOT NULL,
  "niche" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "fit_score" INTEGER NOT NULL DEFAULT 0,
  "gmv_proxy" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "commission_range" TEXT NOT NULL,
  "audience_fit" TEXT NOT NULL,
  "risk_level" TEXT NOT NULL DEFAULT 'low',
  "note" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "social_commerce_creator_signals_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "social_commerce_competitor_watches" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "branch_id" TEXT,
  "shop_name" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "movement" TEXT NOT NULL,
  "risk" TEXT NOT NULL,
  "response" TEXT NOT NULL,
  "velocity_score" INTEGER NOT NULL DEFAULT 0,
  "price_change_pct" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "creator_collab_count" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'monitoring',
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "social_commerce_competitor_watches_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "social_commerce_action_cards" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "branch_id" TEXT,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "confidence" TEXT NOT NULL,
  "action_label" TEXT NOT NULL,
  "module_key" TEXT NOT NULL,
  "priority" TEXT NOT NULL DEFAULT 'normal',
  "status" TEXT NOT NULL DEFAULT 'open',
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "social_commerce_action_cards_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "social_commerce_alerts" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "branch_id" TEXT,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "channel" TEXT,
  "category" TEXT,
  "severity" TEXT NOT NULL DEFAULT 'normal',
  "status" TEXT NOT NULL DEFAULT 'unread',
  "rule" TEXT NOT NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "triggered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "social_commerce_alerts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "social_commerce_experiments" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "branch_id" TEXT,
  "title" TEXT NOT NULL,
  "product_name" TEXT,
  "channel" TEXT,
  "hypothesis" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'backlog',
  "budget" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "target_metric" TEXT,
  "result" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "social_commerce_experiments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "social_commerce_reports" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "branch_id" TEXT,
  "title" TEXT NOT NULL,
  "period" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ready',
  "sections" JSONB NOT NULL DEFAULT '[]',
  "summary" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "social_commerce_reports_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "social_commerce_connectors_tenant_id_channel_key" ON "social_commerce_connectors"("tenant_id", "channel");
CREATE INDEX "social_commerce_workspace_settings_tenant_id_branch_id_idx" ON "social_commerce_workspace_settings"("tenant_id", "branch_id");
CREATE INDEX "social_commerce_connectors_tenant_id_status_idx" ON "social_commerce_connectors"("tenant_id", "status");
CREATE INDEX "social_commerce_product_trends_tenant_id_channel_category_idx" ON "social_commerce_product_trends"("tenant_id", "channel", "category");
CREATE INDEX "social_commerce_product_trends_tenant_id_freshness_score_idx" ON "social_commerce_product_trends"("tenant_id", "freshness_score");
CREATE INDEX "social_commerce_creator_signals_tenant_id_channel_fit_score_idx" ON "social_commerce_creator_signals"("tenant_id", "channel", "fit_score");
CREATE INDEX "social_commerce_competitor_watches_tenant_id_channel_status_idx" ON "social_commerce_competitor_watches"("tenant_id", "channel", "status");
CREATE INDEX "social_commerce_action_cards_tenant_id_status_priority_idx" ON "social_commerce_action_cards"("tenant_id", "status", "priority");
CREATE INDEX "social_commerce_alerts_tenant_id_status_severity_idx" ON "social_commerce_alerts"("tenant_id", "status", "severity");
CREATE INDEX "social_commerce_experiments_tenant_id_status_idx" ON "social_commerce_experiments"("tenant_id", "status");
CREATE INDEX "social_commerce_reports_tenant_id_period_idx" ON "social_commerce_reports"("tenant_id", "period");

ALTER TABLE "social_commerce_workspace_settings" ADD CONSTRAINT "social_commerce_workspace_settings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "social_commerce_workspace_settings" ADD CONSTRAINT "social_commerce_workspace_settings_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "tenant_branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "social_commerce_connectors" ADD CONSTRAINT "social_commerce_connectors_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "social_commerce_connectors" ADD CONSTRAINT "social_commerce_connectors_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "tenant_branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "social_commerce_product_trends" ADD CONSTRAINT "social_commerce_product_trends_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "social_commerce_product_trends" ADD CONSTRAINT "social_commerce_product_trends_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "tenant_branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "social_commerce_creator_signals" ADD CONSTRAINT "social_commerce_creator_signals_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "social_commerce_creator_signals" ADD CONSTRAINT "social_commerce_creator_signals_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "tenant_branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "social_commerce_competitor_watches" ADD CONSTRAINT "social_commerce_competitor_watches_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "social_commerce_competitor_watches" ADD CONSTRAINT "social_commerce_competitor_watches_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "tenant_branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "social_commerce_action_cards" ADD CONSTRAINT "social_commerce_action_cards_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "social_commerce_action_cards" ADD CONSTRAINT "social_commerce_action_cards_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "tenant_branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "social_commerce_alerts" ADD CONSTRAINT "social_commerce_alerts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "social_commerce_alerts" ADD CONSTRAINT "social_commerce_alerts_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "tenant_branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "social_commerce_experiments" ADD CONSTRAINT "social_commerce_experiments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "social_commerce_experiments" ADD CONSTRAINT "social_commerce_experiments_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "tenant_branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "social_commerce_reports" ADD CONSTRAINT "social_commerce_reports_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "social_commerce_reports" ADD CONSTRAINT "social_commerce_reports_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "tenant_branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
