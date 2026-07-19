const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function createTestUser() {
  const email = "hris_test@example.com";
  const password = "password123";

  // Check if exists
  let user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    console.log("Test user already exists.");
    process.exit(0);
  }

  const passwordHash = await bcrypt.hash(password, 12);
  
  // Find HRIS industry
  let hrisIndustry = await prisma.industry.findUnique({ where: { slug: 'professional-services' } });
  if (!hrisIndustry) {
    hrisIndustry = await prisma.industry.create({
      data: { name: 'Professional Services', slug: 'professional-services', iconKey: 'briefcase', colorKey: 'blue', pain: '', solution: '' }
    });
  }

  let hrisSub = await prisma.subIndustry.findUnique({ where: { slug: 'hris' } });
  if (!hrisSub) {
    hrisSub = await prisma.subIndustry.create({
      data: { name: 'HRIS', slug: 'hris', need: '', offer: '', industryId: hrisIndustry.id }
    });
  }

  let tier = await prisma.tier.findFirst({ where: { subIndustryId: hrisSub.id } });
  if (!tier) {
    tier = await prisma.tier.create({
      data: { name: 'Starter', slug: 'hris-starter', price: '0', cadence: 'month', description: '', fit: '', subIndustryId: hrisSub.id }
    });
  }

  const tenant = await prisma.tenant.create({
    data: { name: "HRIS Test Workspace" }
  });

  user = await prisma.user.create({
    data: {
      email,
      name: "HRIS Tester",
      passwordHash,
      role: "owner",
      status: "active"
    }
  });

  await prisma.tenantUser.create({
    data: { userId: user.id, tenantId: tenant.id, role: "owner" }
  });

  await prisma.tenantSubscription.create({
    data: {
      tenantId: tenant.id,
      subIndustryId: hrisSub.id,
      tierId: tier.id,
      status: "active",
      startedAt: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30*24*60*60*1000)
    }
  });

  console.log("Test user created successfully!");
}

createTestUser().catch(console.error).finally(() => prisma.$disconnect());
