import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import { getVertical, verticalManifests } from "./manifest";

const vertical = getVertical(process.argv.find((arg) => arg.startsWith("--vertical="))?.split("=", 2)[1]);
const manifest = verticalManifests[vertical];
const reconcile = process.argv.includes("--reconcile");

function loadLocalEnv() {
  for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^"|"$/g, "");
  }
}

function countQuery(table: string) {
  return `SELECT COUNT(*)::text AS count FROM "${table}"`;
}

async function getCounts(client: PrismaClient, tables: string[]) {
  const counts: Record<string, number> = {};
  for (const table of tables) {
    const rows = await client.$queryRawUnsafe<Array<{ count: string }>>(countQuery(table));
    counts[table] = Number(rows[0]?.count ?? 0);
  }
  return counts;
}

async function main() {
  loadLocalEnv();
  const targetUrl = process.env[manifest.targetUrlEnv];
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL sumber belum tersedia.");
  if (!targetUrl) throw new Error(`${manifest.targetUrlEnv} target belum tersedia.`);

  const source = new PrismaClient();
  const target = new PrismaClient({ datasources: { db: { url: targetUrl } } });

  try {
    await Promise.all([source.$connect(), target.$connect()]);
    const sourceCounts = await getCounts(source, manifest.tables);
    const targetCounts = await getCounts(target, manifest.tables);

    console.table(manifest.tables.map((table) => ({
      table,
      source: sourceCounts[table],
      target: targetCounts[table],
      status: reconcile
        ? targetCounts[table] === sourceCounts[table] ? "match" : "mismatch"
        : targetCounts[table] === 0 ? "ready" : "target contains data"
    })));

    if (reconcile && manifest.tables.some((table) => targetCounts[table] !== sourceCounts[table])) {
      throw new Error("Rekonsiliasi gagal. Jumlah baris source dan target berbeda.");
    }

    if (!reconcile && Object.values(targetCounts).some((count) => count > 0)) {
      throw new Error("Target bukan database kosong. Hentikan migrasi dan verifikasi target terlebih dahulu.");
    }
  } finally {
    await Promise.all([source.$disconnect(), target.$disconnect()]);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
