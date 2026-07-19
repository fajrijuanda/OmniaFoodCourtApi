import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, role: true, status: true, passwordHash: true }
  });
  console.log("Users:");
  for (const u of users) {
    console.log(`  ${u.email} | role=${u.role} | status=${u.status} | hasHash=${!!u.passwordHash} | hashLength=${u.passwordHash?.length ?? 0}`);
  }

  // Reset admin password
  console.log("\nResetting admin@omnia.local password to Admin123! ...");
  const hash = await bcrypt.hash("Admin123!", 12);
  await prisma.user.update({
    where: { email: "admin@omnia.local" },
    data: { passwordHash: hash, status: "active" }
  });
  console.log("Done. Verifying...");

  // Verify
  const admin = await prisma.user.findUnique({ where: { email: "admin@omnia.local" } });
  const valid = await bcrypt.compare("Admin123!", admin!.passwordHash!);
  console.log("Password valid after reset:", valid);
}

main().then(() => prisma.$disconnect()).catch(console.error);
