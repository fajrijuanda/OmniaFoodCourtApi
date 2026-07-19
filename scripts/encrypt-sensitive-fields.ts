import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { createCipheriv, randomBytes } from "crypto";

const PREFIX = "v1:";
const prisma = new PrismaClient();

function encrypt(value: string | null) {
  if (!value || value.startsWith(PREFIX)) return value;
  const rawKey = process.env.FIELD_ENCRYPTION_KEY;
  if (!rawKey) throw new Error("FIELD_ENCRYPTION_KEY wajib diisi untuk menjalankan script ini.");
  const key = Buffer.from(rawKey, "base64");
  if (key.length !== 32) throw new Error("FIELD_ENCRYPTION_KEY harus base64 32-byte.");

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64url")}:${tag.toString("base64url")}:${ciphertext.toString("base64url")}`;
}

async function main() {
  const employees = await prisma.employee.findMany({
    where: {
      OR: [
        { npwp: { not: null } },
        { bpjsKesehatan: { not: null } },
        { bpjsKetenagakerjaan: { not: null } },
        { bankAccountNumber: { not: null } }
      ]
    }
  });

  for (const employee of employees) {
    await prisma.employee.update({
      where: { id: employee.id },
      data: {
        npwp: encrypt(employee.npwp),
        bpjsKesehatan: encrypt(employee.bpjsKesehatan),
        bpjsKetenagakerjaan: encrypt(employee.bpjsKetenagakerjaan),
        bankAccountNumber: encrypt(employee.bankAccountNumber)
      }
    });
  }

  const applicants = await prisma.jobApplicant.findMany({ where: { phone: { not: null } } });
  for (const applicant of applicants) {
    await prisma.jobApplicant.update({
      where: { id: applicant.id },
      data: { phone: encrypt(applicant.phone) }
    });
  }

  console.log(`Encrypted ${employees.length} employees and ${applicants.length} applicants.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
