import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { getVertical, verticalManifests } from "./manifest";

const vertical = getVertical(process.argv.find((arg) => arg.startsWith("--vertical="))?.split("=", 2)[1]);
const manifest = verticalManifests[vertical];

function loadLocalEnv() {
  for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^"|"$/g, "");
  }
}

function run(command: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "inherit", "inherit"], windowsHide: true });
    child.on("error", () => reject(new Error(`${command} tidak dapat dijalankan.`)));
    child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`${command} gagal dengan exit code ${code}.`)));
  });
}

async function main() {
  loadLocalEnv();
  const sourceUrl = process.env.SOURCE_DATABASE_URL ?? process.env.DATABASE_URL;
  const targetUrl = process.env[manifest.targetUrlEnv];
  if (!sourceUrl) throw new Error("DATABASE_URL sumber belum tersedia.");
  if (!targetUrl) throw new Error(`${manifest.targetUrlEnv} target belum tersedia.`);

  const temporaryDirectory = mkdtempSync(join(tmpdir(), `omnia-${vertical}-migration-`));
  const dumpFile = join(temporaryDirectory, `${vertical}.sql`);
  const transactionFile = join(temporaryDirectory, `${vertical}.transaction.sql`);
  const tableArgs = manifest.tables.flatMap((table) => ["--table", `public.${table}`]);

  try {
    await run("pg_dump", [
      "--dbname", sourceUrl,
      "--data-only",
      "--no-owner",
      "--no-privileges",
      "--file", dumpFile,
      ...tableArgs
    ]);
    writeFileSync(transactionFile, `BEGIN;\n${readFileSync(dumpFile, "utf8")}\nCOMMIT;\n\\q\n`);
    const psqlIncludePath = transactionFile.replace(/\\/g, "/").replace(/'/g, "''");
    await run("psql", [
      "--quiet",
      "--set", "ON_ERROR_STOP=1",
      "--command", `\\i '${psqlIncludePath}'`,
      targetUrl
    ]);
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
