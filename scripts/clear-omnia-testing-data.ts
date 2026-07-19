import { PrismaClient } from "@prisma/client";
import * as fs from "fs/promises";
import * as path from "path";

const prisma = new PrismaClient();
const CONFIRM_TOKEN = "WIPE_PRODUCTION";
const VALID_SCOPES = ["fnb", "hris"] as const;
type ResetScope = (typeof VALID_SCOPES)[number];

function getArg(name: string) {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length).trim();
}

function hasFlag(name: string) {
  return process.argv.includes(`--${name}`);
}

function parseScopes() {
  const scopeArg = getArg("scope") ?? "fnb,hris";
  const scopes = scopeArg
    .split(",")
    .map((scope) => scope.trim().toLowerCase())
    .filter(Boolean);

  const invalid = scopes.filter((scope) => !VALID_SCOPES.includes(scope as ResetScope));
  if (invalid.length > 0 || scopes.length === 0) {
    throw new Error(`Invalid --scope value. Use one or both of: ${VALID_SCOPES.join(",")}`);
  }

  return [...new Set(scopes)] as ResetScope[];
}

function usage() {
  return [
    "Usage:",
    "  npm run clear:testing-data -- --scope=fnb,hris --confirm=WIPE_PRODUCTION",
    "  npm run clear:testing-data -- --scope=fnb --tenant=<tenantId> --confirm=WIPE_PRODUCTION",
    "",
    "Without --confirm=WIPE_PRODUCTION this script only prints before counts and refuses to mutate data.",
  ].join("\n");
}

const tenantId = getArg("tenant");
const scopes = parseScopes();
const confirmed = getArg("confirm") === CONFIRM_TOKEN;
const includeUploads = !hasFlag("keep-uploads");

const tenantWhere = tenantId ? { tenantId } : {};
const branchlessTenantWhere = tenantId ? { tenantId } : {};

async function countFnbRows() {
  return {
    posOrderItems: await prisma.posOrderItem.count({ where: tenantId ? { order: { tenantId } } : {} }),
    posOrders: await prisma.posOrder.count({ where: tenantWhere }),
    posShifts: await prisma.posShift.count({ where: tenantWhere }),
    posStockLogs: await prisma.posStockLog.count({ where: tenantWhere }),
    posRecipeItems: await prisma.posRecipeItem.count({
      where: tenantId ? { recipe: { product: { tenantId } } } : {},
    }),
    posRecipes: await prisma.posRecipe.count({ where: tenantId ? { product: { tenantId } } : {} }),
    posIngredients: await prisma.posIngredient.count({ where: tenantWhere }),
    fnbBakeryPreOrders: await prisma.fnbBakeryPreOrder.count({ where: tenantWhere }),
    fnbWholesaleOrders: await prisma.fnbWholesaleOrder.count({ where: tenantWhere }),
    fnbDeliveryStatuses: await prisma.fnbDeliveryStatus.count({ where: tenantWhere }),
    fnbTenantSettlements: await prisma.fnbTenantSettlement.count({ where: tenantWhere }),
  };
}

async function countHrisRows() {
  return {
    jobApplicants: await prisma.jobApplicant.count({ where: tenantWhere }),
    jobPostings: await prisma.jobPosting.count({ where: tenantWhere }),
    payrollRunItems: await prisma.payrollRunItem.count({
      where: tenantId ? { payrollRun: { tenantId } } : {},
    }),
    payrollRuns: await prisma.payrollRun.count({ where: tenantWhere }),
    employeeLoanRequests: await prisma.employeeLoanRequest.count({ where: tenantWhere }),
    reimbursementRequests: await prisma.reimbursementRequest.count({ where: tenantWhere }),
    performanceKpis: await prisma.performanceKpi.count({ where: tenantWhere }),
    fieldReports: await prisma.fieldReport.count({ where: tenantWhere }),
    leaveRequests: await prisma.leaveRequest.count({ where: tenantWhere }),
    attendanceLogs: await prisma.attendanceLog.count({ where: tenantWhere }),
    salaryComponents: await prisma.salaryComponent.count({ where: tenantWhere }),
    employees: await prisma.employee.count({ where: tenantWhere }),
    departments: await prisma.department.count({ where: branchlessTenantWhere }),
  };
}

async function countRows() {
  return {
    ...(scopes.includes("fnb") ? { fnb: await countFnbRows() } : {}),
    ...(scopes.includes("hris") ? { hris: await countHrisRows() } : {}),
  };
}

async function clearFnbRows() {
  await prisma.$transaction([
    prisma.fnbTenantSettlement.deleteMany({ where: tenantWhere }),
    prisma.fnbDeliveryStatus.deleteMany({ where: tenantWhere }),
    prisma.fnbWholesaleOrder.deleteMany({ where: tenantWhere }),
    prisma.fnbBakeryPreOrder.deleteMany({ where: tenantWhere }),
    prisma.posStockLog.deleteMany({ where: tenantWhere }),
    prisma.posRecipeItem.deleteMany({ where: tenantId ? { recipe: { product: { tenantId } } } : {} }),
    prisma.posRecipe.deleteMany({ where: tenantId ? { product: { tenantId } } : {} }),
    prisma.posOrderItem.deleteMany({ where: tenantId ? { order: { tenantId } } : {} }),
    prisma.posOrder.deleteMany({ where: tenantWhere }),
    prisma.posShift.deleteMany({ where: tenantWhere }),
    prisma.posIngredient.deleteMany({ where: tenantWhere }),
  ]);
}

async function clearHrisRows() {
  await prisma.$transaction([
    prisma.jobApplicant.deleteMany({ where: tenantWhere }),
    prisma.jobPosting.deleteMany({ where: tenantWhere }),
    prisma.payrollRunItem.deleteMany({ where: tenantId ? { payrollRun: { tenantId } } : {} }),
    prisma.payrollRun.deleteMany({ where: tenantWhere }),
    prisma.employeeLoanRequest.deleteMany({ where: tenantWhere }),
    prisma.reimbursementRequest.deleteMany({ where: tenantWhere }),
    prisma.performanceKpi.deleteMany({ where: tenantWhere }),
    prisma.fieldReport.deleteMany({ where: tenantWhere }),
    prisma.leaveRequest.deleteMany({ where: tenantWhere }),
    prisma.attendanceLog.deleteMany({ where: tenantWhere }),
    prisma.salaryComponent.deleteMany({ where: tenantWhere }),
    prisma.employee.deleteMany({ where: tenantWhere }),
    prisma.department.deleteMany({ where: branchlessTenantWhere }),
  ]);
}

async function removeHrisUploads() {
  if (tenantId || !includeUploads || !scopes.includes("hris")) return [];

  const folders = ["attendance", "reimbursement", "field-report", "recruitment"];
  const removed: string[] = [];
  for (const folder of folders) {
    const target = path.join(process.cwd(), "uploads", "hris", folder);
    await fs.rm(target, { recursive: true, force: true });
    removed.push(target);
  }
  return removed;
}

async function main() {
  const before = await countRows();

  if (!confirmed) {
    console.log(JSON.stringify({
      mode: "dry-run",
      scope: scopes,
      target: tenantId ? { tenantId } : "all-tenants",
      before,
      message: `Refusing to delete data without --confirm=${CONFIRM_TOKEN}.`,
      usage: usage(),
    }, null, 2));
    return;
  }

  if (scopes.includes("fnb")) {
    await clearFnbRows();
  }
  if (scopes.includes("hris")) {
    await clearHrisRows();
  }

  const removedUploadFolders = await removeHrisUploads();
  const after = await countRows();

  console.log(JSON.stringify({
    mode: "mutated",
    scope: scopes,
    target: tenantId ? { tenantId } : "all-tenants",
    before,
    after,
    removedUploadFolders,
    preserved: [
      "users",
      "tenants",
      "tenant subscriptions",
      "tenant roles/access",
      "FnB categories/products/modifiers/tables/settings",
      "FnB promo rules/delivery integrations/wholesale customers",
    ],
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
