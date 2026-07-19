import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const tenantArg = process.argv.find((arg) => arg.startsWith("--tenant="));
const tenantId = tenantArg?.slice("--tenant=".length).trim();
const where = tenantId ? { tenantId } : {};

async function countRows() {
  return {
    posOrderItems: await prisma.posOrderItem.count({ where: tenantId ? { order: { tenantId } } : {} }),
    posOrders: await prisma.posOrder.count({ where }),
    posShifts: await prisma.posShift.count({ where }),
    posTables: await prisma.posTable.count({ where }),
    posProducts: await prisma.posProduct.count({ where }),
    posCategories: await prisma.posCategory.count({ where }),
    posIngredients: await prisma.posIngredient.count({ where }),
    posStockLogs: await prisma.posStockLog.count({ where }),
    fnbPromoRules: await prisma.fnbPromoRule.count({ where }),
    fnbBakeryPreOrders: await prisma.fnbBakeryPreOrder.count({ where }),
    fnbWholesaleCustomers: await prisma.fnbWholesaleCustomer.count({ where }),
    fnbWholesaleOrders: await prisma.fnbWholesaleOrder.count({ where }),
    fnbDeliveryIntegrations: await prisma.fnbDeliveryIntegration.count({ where }),
    fnbDeliveryStatuses: await prisma.fnbDeliveryStatus.count({ where }),
    fnbFoodCourtTenants: await prisma.fnbFoodCourtTenant.count({ where }),
    fnbTenantSettlements: await prisma.fnbTenantSettlement.count({ where }),
  };
}

async function main() {
  const before = await countRows();

  await prisma.$transaction([
    prisma.fnbTenantSettlement.deleteMany({ where }),
    prisma.fnbFoodCourtTenant.deleteMany({ where }),
    prisma.fnbDeliveryStatus.deleteMany({ where }),
    prisma.fnbDeliveryIntegration.deleteMany({ where }),
    prisma.fnbWholesaleOrder.deleteMany({ where }),
    prisma.fnbWholesaleCustomer.deleteMany({ where }),
    prisma.fnbBakeryPreOrder.deleteMany({ where }),
    prisma.fnbPromoRule.deleteMany({ where }),
    prisma.posStockLog.deleteMany({ where }),
    prisma.posRecipeItem.deleteMany({ where: tenantId ? { recipe: { product: { tenantId } } } : {} }),
    prisma.posRecipe.deleteMany({ where: tenantId ? { product: { tenantId } } : {} }),
    prisma.posOrderItem.deleteMany({ where: tenantId ? { order: { tenantId } } : {} }),
    prisma.posOrder.deleteMany({ where }),
    prisma.posShift.deleteMany({ where }),
    prisma.posTable.deleteMany({ where }),
    prisma.posModifierGroupProduct.deleteMany({
      where: tenantId ? { OR: [{ product: { tenantId } }, { modifierGroup: { tenantId } }] } : {},
    }),
    prisma.posModifierOption.deleteMany({ where: tenantId ? { modifierGroup: { tenantId } } : {} }),
    prisma.posModifierGroup.deleteMany({ where }),
    prisma.posProductVariant.deleteMany({ where: tenantId ? { product: { tenantId } } : {} }),
    prisma.posProduct.deleteMany({ where }),
    prisma.posCategory.deleteMany({ where }),
    prisma.posIngredient.deleteMany({ where }),
  ]);

  const after = await countRows();
  console.log(JSON.stringify({ scope: tenantId ? { tenantId } : "all-tenants", before, after }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
