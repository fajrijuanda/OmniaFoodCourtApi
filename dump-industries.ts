import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const industries = await prisma.industry.findMany({ include: { subIndustries: true } });
  console.log(JSON.stringify(industries, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
