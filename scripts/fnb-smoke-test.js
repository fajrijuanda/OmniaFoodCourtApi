const API_URL = process.env.SMOKE_API_URL || "http://127.0.0.1:4000/api";
const EMAIL = process.env.SMOKE_EMAIL || "fnb-smoke@omnia.local";
const PASSWORD = process.env.SMOKE_PASSWORD || "Smoke123!";
const SETUP_TENANT = process.env.SMOKE_SKIP_SETUP !== "true";

async function setupSmokeTenant() {
  if (!SETUP_TENANT) return;
  const { PrismaClient, UserRole } = require("@prisma/client");
  const bcrypt = require("bcryptjs");
  const prisma = new PrismaClient();
  try {
    const passwordHash = await bcrypt.hash(PASSWORD, 12);
    const user = await prisma.user.upsert({
      where: { email: EMAIL },
      update: { passwordHash, name: "FnB Smoke Owner", role: UserRole.owner, status: "active" },
      create: { email: EMAIL, passwordHash, name: "FnB Smoke Owner", role: UserRole.owner, status: "active" },
    });
    const tenant = await prisma.tenant.upsert({
      where: { id: "smoke-fnb-tenant" },
      update: { name: "Smoke FnB Tenant", status: "active" },
      create: { id: "smoke-fnb-tenant", name: "Smoke FnB Tenant", status: "active" },
    });
    const branch = await prisma.tenantBranch.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code: "MAIN" } },
      update: { name: "Main Branch", status: "active" },
      create: { tenantId: tenant.id, code: "MAIN", name: "Main Branch", status: "active" },
    });
    const tenantUser = await prisma.tenantUser.upsert({
      where: { userId_tenantId: { userId: user.id, tenantId: tenant.id } },
      update: { role: "owner" },
      create: { tenantId: tenant.id, userId: user.id, role: "owner" },
    });
    await prisma.tenantUserBranch.upsert({
      where: { tenantUserId_branchId: { tenantUserId: tenantUser.id, branchId: branch.id } },
      update: {},
      create: { tenantUserId: tenantUser.id, branchId: branch.id },
    });
  } finally {
    await prisma.$disconnect();
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(`${options.method || "GET"} ${path} failed (${response.status}): ${text}`);
  }
  return body;
}

function getTenantId(...sources) {
  for (const source of sources) {
    if (!source || typeof source !== "object") continue;
    if (source.tenantId) return source.tenantId;
    if (source.activeTenantId) return source.activeTenantId;
    if (source.user) {
      const nested = getTenantId(source.user);
      if (nested) return nested;
    }
    if (Array.isArray(source.tenantUsers) && source.tenantUsers[0]?.tenantId) {
      return source.tenantUsers[0].tenantId;
    }
  }
  return null;
}

async function main() {
  await setupSmokeTenant();

  const runId = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  const login = await request("/auth/login", {
    method: "POST",
    body: { email: EMAIL, password: PASSWORD },
  });
  const token = login.accessToken;
  assert(token, "Login did not return accessToken.");

  const me = await request("/auth/me", { token });
  const tenantId = getTenantId(login, me);

  const category = await request("/fnb/pos/categories", {
    method: "POST",
    token,
    body: {
      name: `Smoke Category ${runId}`,
      slug: `smoke-category-${runId}`,
      color: "#f97316",
      sortOrder: 1,
    },
  });
  assert(category.id, "Category creation failed.");

  const ingredient = await request("/fnb/pos/ingredients", {
    method: "POST",
    token,
    body: {
      name: `Smoke Ingredient ${runId}`,
      unit: "gram",
      currentStock: 1000,
      minStockAlert: 100,
      costPerUnit: 25,
    },
  });
  assert(ingredient.id, "Ingredient creation failed.");

  const updatedIngredient = await request(`/fnb/pos/ingredients/${ingredient.id}`, {
    method: "PATCH",
    token,
    body: { minStockAlert: 120 },
  });
  assert(updatedIngredient.minStockAlert === 120, "Ingredient update failed.");

  const product = await request("/fnb/pos/products", {
    method: "POST",
    token,
    body: {
      name: `Smoke Menu ${runId}`,
      description: "FnB smoke test menu",
      categoryId: category.id,
      price: 15000,
      isAvailable: true,
      recipeItems: [{ ingredientId: ingredient.id, quantityRequired: 10 }],
    },
  });
  assert(product.id && product.recipe?.items?.length === 1, "Product creation with recipe failed.");

  const updatedProduct = await request(`/fnb/pos/products/${product.id}`, {
    method: "PATCH",
    token,
    body: { price: 16000 },
  });
  assert(updatedProduct.price === 16000, "Product update failed.");

  const catalog = await request("/fnb/pos/catalog?scope=management", { token });
  assert(catalog.categories.some((item) => item.id === category.id), "Created category missing from catalog.");
  assert(catalog.products.some((item) => item.id === product.id), "Created product missing from catalog.");

  const table = await request("/fnb/pos/tables", {
    method: "POST",
    token,
    body: { number: `S${runId.slice(-4)}`, capacity: 4 },
  });
  assert(table.id, "Table creation failed.");

  const reservation = await request("/fnb/pos/reservations", {
    method: "POST",
    token,
    body: {
      guestName: "Smoke Reservation",
      contact: "081234567890",
      pax: 2,
      time: "19:00",
      tableId: table.id,
    },
  });
  assert(reservation.id && reservation.status === "Upcoming", "Reservation creation failed.");

  const seatedReservation = await request(`/fnb/pos/reservations/${reservation.id}/status`, {
    method: "PATCH",
    token,
    body: { status: "Seated" },
  });
  assert(seatedReservation.status === "Seated", "Reservation check-in failed.");

  const shift = await request("/fnb/pos/shifts", {
    method: "POST",
    token,
    body: { cashierId: `SMOKE-${runId}`, initialCash: 500000 },
  });
  assert(shift.id && shift.status === "OPEN", "Open shift failed.");

  const order = await request("/fnb/pos/orders", {
    method: "POST",
    token,
    body: {
      totalAmount: 32000,
      paymentMethod: "CASH",
      cashReceived: 50000,
      changeAmount: 18000,
      orderType: "DINE_IN",
      customerName: "Smoke Tester",
      items: [{ productId: product.id, quantity: 2, priceAtSale: 16000 }],
    },
  });
  assert(order.id, "POS order creation failed.");

  const paidOrder = await request(`/fnb/pos/orders/${order.id}/pay`, {
    method: "PATCH",
    token,
    body: { cashReceived: 50000 },
  });
  assert(paidOrder.paymentStatus === "PAID", "Order payment failed.");

  let kdsRows = await request("/fnb/pos/kds/orders", { token });
  assert(kdsRows.some((item) => item.id === order.id), "Paid order missing from KDS.");
  for (const status of ["ACCEPTED", "COOKING", "READY"]) {
    const updated = await request(`/fnb/pos/kds/orders/${order.id}/status`, {
      method: "PATCH",
      token,
      body: { status },
    });
    assert(updated.status === status, `KDS status ${status} failed.`);
  }

  await request("/fnb/pos/stock-adjustments", {
    method: "POST",
    token,
    body: { ingredientId: ingredient.id, amount: -5, reason: "WASTE", notes: "FnB smoke waste" },
  });
  const stockLogs = await request("/fnb/pos/stock-logs", { token });
  assert(stockLogs.some((item) => item.ingredientId === ingredient.id && item.reason === "SALES"), "Sales stock log missing.");
  assert(stockLogs.some((item) => item.ingredientId === ingredient.id && item.reason === "WASTE"), "Waste stock log missing.");

  const closedShift = await request(`/fnb/pos/shifts/${shift.id}/close`, {
    method: "PATCH",
    token,
    body: { finalCashActual: 532000, notes: "FnB smoke closing" },
  });
  assert(closedShift.status === "CLOSED", "Close shift failed.");

  const promo = await request("/fnb/operations/promo-rules", {
    method: "POST",
    token,
    body: { name: `Smoke Promo ${runId}`, tenant: "Semua tenant", type: "Discount" },
  });
  assert(promo.id, "Promo rule creation failed.");

  const preOrder = await request("/fnb/operations/pre-orders", {
    method: "POST",
    token,
    body: {
      customerName: "Smoke Bakery",
      contact: "smoke@example.test",
      productName: "Smoke Cake",
      pickupDate: "2026-06-15",
      pickupTime: "10:00",
      quantity: 1,
      depositPaid: 100000,
      totalAmount: 250000,
    },
  });
  assert(preOrder.id, "Pre-order creation failed.");
  const confirmedPreOrder = await request(`/fnb/operations/pre-orders/${preOrder.id}/status`, {
    method: "PATCH",
    token,
    body: { status: "Confirmed" },
  });
  assert(confirmedPreOrder.status === "Confirmed", "Pre-order status update failed.");

  const wholesaleCustomer = await request("/fnb/operations/wholesale-customers", {
    method: "POST",
    token,
    body: { name: `Smoke Wholesale ${runId}`, channel: "Cafe", priceTier: "Gold", paymentTerms: "Net 7" },
  });
  assert(wholesaleCustomer.id, "Wholesale customer creation failed.");
  const wholesaleOrder = await request("/fnb/operations/wholesale-orders", {
    method: "POST",
    token,
    body: {
      customerId: wholesaleCustomer.id,
      deliveryDate: "2026-06-16",
      items: [{ productName: "Smoke Croissant", quantity: 12, unitPrice: 18000 }],
    },
  });
  assert(wholesaleOrder.id, "Wholesale order creation failed.");
  const packedWholesale = await request(`/fnb/operations/wholesale-orders/${wholesaleOrder.id}/status`, {
    method: "PATCH",
    token,
    body: { status: "Packed" },
  });
  assert(packedWholesale.status === "Packed", "Wholesale status update failed.");

  const deliveryIntegration = await request("/fnb/operations/delivery-integrations", {
    method: "POST",
    token,
    body: { channel: "GrabFood", status: "Connected", menuMapped: 1, notes: "FnB smoke" },
  });
  assert(deliveryIntegration.id, "Delivery integration creation failed.");
  const deliveryStatuses = await request("/fnb/operations/delivery-statuses/generate", { method: "POST", token });
  assert(Array.isArray(deliveryStatuses) && deliveryStatuses.length > 0, "Delivery status generation failed.");

  const foodCourtTenant = await request("/fnb/operations/food-court-tenants", {
    method: "POST",
    token,
    body: { name: `Smoke Tenant ${runId}`, status: "Aktif", commission: 12, categoryName: category.name },
  });
  assert(foodCourtTenant.id, "Food court tenant creation failed.");
  const settlements = await request("/fnb/operations/tenant-settlements/generate", { method: "POST", token });
  assert(Array.isArray(settlements) && settlements.length > 0, "Tenant settlement generation failed.");
  const paidSettlement = await request(`/fnb/operations/tenant-settlements/${settlements[0].id}/pay`, { method: "PATCH", token });
  assert(paidSettlement.status === "Paid", "Tenant settlement payment failed.");

  const snapshot = await request("/fnb/operations/snapshot", { token });
  assert(Array.isArray(snapshot.promoRules), "Operations snapshot failed.");

  if (tenantId) {
    const publicCatalog = await request(`/fnb/public/catalog/${tenantId}`);
    assert(publicCatalog.products.some((item) => item.id === product.id), "Public catalog missing product.");
    await request(`/fnb/public/tables/${tenantId}`);
    const publicOrder = await request(`/fnb/public/orders/${tenantId}`, {
      method: "POST",
      body: {
        totalAmount: 16000,
        paymentMethod: "QRIS",
        orderType: "TAKEAWAY",
        customerName: "Public Smoke",
        items: [{ productId: product.id, quantity: 1, priceAtSale: 16000 }],
      },
    });
    assert(publicOrder.id, "Public order creation failed.");
    const receipt = await request(`/fnb/public/orders/${tenantId}/${publicOrder.id}`);
    assert(receipt.id === publicOrder.id, "Public receipt failed.");
    const history = await request(`/fnb/public/orders/${tenantId}/history?ids=${publicOrder.id}`);
    assert(Array.isArray(history) && history.some((item) => item.id === publicOrder.id), "Public order history failed.");
  }

  console.log(JSON.stringify({
    ok: true,
    apiUrl: API_URL,
    user: me.email,
    tenantId,
    categoryId: category.id,
    productId: product.id,
    tableId: table.id,
    reservationId: reservation.id,
    orderId: order.id,
    preOrderId: preOrder.id,
    wholesaleOrderId: wholesaleOrder.id,
    settlementId: settlements[0].id,
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
