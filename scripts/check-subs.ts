import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const higherEdSub = await prisma.subIndustry.findUnique({
    where: { slug: "pendidikan-and-kursus-higher-education" },
    include: {
      tenantSubscriptions: true,
      tiers: {
        include: {
          tenantSubscriptions: true
        }
      }
    }
  });

  if (!higherEdSub) {
    console.log("Higher education sub-industry not found!");
    return;
  }

  const subCount = higherEdSub.tenantSubscriptions.length;
  let tierSubCount = 0;
  for (const tier of higherEdSub.tiers) {
    tierSubCount += tier.tenantSubscriptions.length;
  }

  console.log(`Higher Education Subscriptions: ${subCount}`);
  console.log(`Tier Subscriptions: ${tierSubCount}`);

  // check total subs in entire DB to be safe
  const allSubs = await prisma.tenantSubscription.count();
  console.log(`Total subscriptions in DB: ${allSubs}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
