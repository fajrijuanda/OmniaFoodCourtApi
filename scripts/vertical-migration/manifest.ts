export type Vertical = "core" | "hris" | "cafe";

export type VerticalManifest = {
  targetUrlEnv: string;
  tables: string[];
};

// Tables are deliberately ordered from shared tenant projections to dependent
// records. This is the source of truth for preflight, backup, copy, and
// reconciliation scripts during the blue-green cutover.
export const verticalManifests: Record<Vertical, VerticalManifest> = {
  core: {
    targetUrlEnv: "CORE_DATABASE_URL",
    tables: [
      "industries",
      "sub_industries",
      "tiers",
      "features",
      "tier_features",
      "add_ons",
      "users",
      "otp_challenges",
      "tenants",
      "tenant_branches",
      "tenant_role_profiles",
      "tenant_users",
      "tenant_user_branches",
      "tenant_audit_logs",
      "tenant_subscriptions",
      "billing_checkout_sessions",
      "tenant_add_ons",
      "notifications"
    ]
  },
  hris: {
    targetUrlEnv: "HRIS_DATABASE_URL",
    tables: [
      "industries",
      "sub_industries",
      "tiers",
      "features",
      "tier_features",
      "users",
      "tenants",
      "tenant_branches",
      "tenant_role_profiles",
      "tenant_users",
      "tenant_user_branches",
      "departments",
      "employees",
      "salary_components",
      "attendance_logs",
      "leave_requests",
      "employee_loan_requests",
      "payroll_runs",
      "payroll_run_items",
      "reimbursement_requests",
      "field_reports",
      "performance_kpis",
      "job_postings",
      "job_applicants",
      "notifications"
    ]
  },
  cafe: {
    targetUrlEnv: "CAFE_DATABASE_URL",
    tables: [
      "industries",
      "sub_industries",
      "tiers",
      "features",
      "tier_features",
      "users",
      "tenants",
      "tenant_branches",
      "tenant_role_profiles",
      "tenant_users",
      "tenant_user_branches",
      "pos_categories",
      "pos_products",
      "pos_promo_banners",
      "pos_product_variants",
      "pos_modifier_groups",
      "pos_modifier_group_products",
      "pos_ingredients",
      "pos_modifier_options",
      "pos_recipes",
      "pos_recipe_items",
      "pos_tables",
      "pos_shifts",
      "pos_orders",
      "pos_order_items",
      "pos_stock_logs",
      "fnb_promo_rules",
      "fnb_bakery_pre_orders",
      "fnb_wholesale_customers",
      "fnb_wholesale_orders",
      "fnb_delivery_integrations",
      "fnb_delivery_statuses",
      "fnb_food_court_tenants",
      "fnb_tenant_settlements",
      "notifications"
    ]
  }
};

export function getVertical(value: string | undefined): Vertical {
  if (value === "core" || value === "hris" || value === "cafe") return value;
  throw new Error("Set --vertical=core, --vertical=hris, atau --vertical=cafe.");
}
