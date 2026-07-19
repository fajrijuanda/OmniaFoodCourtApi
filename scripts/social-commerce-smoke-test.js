const API_URL = process.env.SMOKE_API_URL || "http://127.0.0.1:4000/api";
const EMAIL = process.env.SMOKE_EMAIL || "social-commerce-smoke@omnia.local";
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
      update: { passwordHash, name: "Social Commerce Smoke Owner", role: UserRole.owner, status: "active" },
      create: { email: EMAIL, passwordHash, name: "Social Commerce Smoke Owner", role: UserRole.owner, status: "active" },
    });
    const tenant = await prisma.tenant.upsert({
      where: { id: "smoke-social-commerce-tenant" },
      update: { name: "Smoke Social Commerce Tenant", status: "active" },
      create: { id: "smoke-social-commerce-tenant", name: "Smoke Social Commerce Tenant", status: "active" },
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
  assert(me.email === EMAIL, "Auth session returned a different user.");

  const snapshot = await request("/social-commerce-intelligence/snapshot", { token });
  assert(snapshot.dataMode === "demo_seeded", "Snapshot should expose demo_seeded data mode.");
  assert(Array.isArray(snapshot.connectors) && snapshot.connectors.length === 5, "Snapshot should include five Indonesia channels.");
  assert(snapshot.connectors.some((item) => item.channel === "tiktok_shop"), "TikTok Shop connector missing.");
  assert(Array.isArray(snapshot.products) && snapshot.products.length > 0, "Snapshot products missing.");
  assert(snapshot.products.every((item) => item.productName && item.channel && item.recommendedAction), "Product trend shape is incomplete.");

  const products = await request("/social-commerce-intelligence/products?channel=tiktok_shop&category=Beauty", { token });
  assert(products.length > 0, "Filtered product radar returned no TikTok Beauty rows.");
  assert(products.every((item) => item.channel === "tiktok_shop" && item.category === "Beauty"), "Product filter leaked another channel/category.");

  const connectors = await request("/social-commerce-intelligence/connectors", { token });
  const lazada = connectors.find((item) => item.channel === "lazada");
  assert(lazada?.id, "Lazada connector missing.");
  const updatedConnector = await request(`/social-commerce-intelligence/connectors/${lazada.id}`, {
    method: "PATCH",
    token,
    body: { status: "queued", notes: `Smoke queued ${runId}` },
  });
  assert(updatedConnector.status === "queued", "Connector status update failed.");

  const alerts = await request("/social-commerce-intelligence/alerts?status=unread", { token });
  assert(Array.isArray(alerts) && alerts.length > 0, "Unread alerts missing.");
  const readAlert = await request(`/social-commerce-intelligence/alerts/${alerts[0].id}`, {
    method: "PATCH",
    token,
    body: { status: "read" },
  });
  assert(readAlert.status === "read", "Alert status update failed.");

  const competitor = await request("/social-commerce-intelligence/competitors", {
    method: "POST",
    token,
    body: {
      shopName: `Smoke Watch ${runId}`,
      channel: "shopee",
      category: "Beauty",
      movement: "+12% review velocity",
      risk: "Voucher campaign",
      response: "Pantau 3 hari",
      velocityScore: 77,
    },
  });
  assert(competitor.id && competitor.channel === "shopee", "Competitor watch creation failed.");

  const experiment = await request("/social-commerce-intelligence/experiments", {
    method: "POST",
    token,
    body: {
      title: `Smoke Experiment ${runId}`,
      productName: "Hair serum travel pack",
      channel: "tiktok_shop",
      hypothesis: "Smoke test validates experiment workflow.",
      budget: 500000,
    },
  });
  assert(experiment.id, "Experiment creation failed.");
  const updatedExperiment = await request(`/social-commerce-intelligence/experiments/${experiment.id}`, {
    method: "PATCH",
    token,
    body: { status: "running", result: "Smoke moved to running." },
  });
  assert(updatedExperiment.status === "running", "Experiment status update failed.");

  console.log(JSON.stringify({
    ok: true,
    apiUrl: API_URL,
    user: me.email,
    connectors: connectors.length,
    productCount: products.length,
    competitorId: competitor.id,
    experimentId: experiment.id,
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
