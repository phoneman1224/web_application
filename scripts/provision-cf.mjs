import { readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const envTarget = process.argv.includes("--env")
  ? process.argv[process.argv.indexOf("--env") + 1]
  : "test";

const d1Name = envTarget === "prod" ? "reseller_app_prod" : "reseller_app_test";
const r2Name = envTarget === "prod" ? "reseller-app-prod" : "reseller-app-test";
const workerName = envTarget === "prod" ? "reseller-app" : "reseller-app-test";

function runWrangler(args) {
  const result = spawnSync("npx", ["wrangler", ...args], { encoding: "utf-8" });
  if (result.status !== 0) {
    console.error(result.stderr || result.stdout);
    process.exit(result.status ?? 1);
  }
  return result.stdout.trim();
}

function ensureD1(name) {
  const list = JSON.parse(runWrangler(["d1", "list", "--json"]));
  const existing = list.find((db) => db.name === name);
  if (existing) return existing.uuid;
  const created = JSON.parse(runWrangler(["d1", "create", name, "--json"]));
  return created.uuid;
}

function ensureR2(name) {
  const list = JSON.parse(runWrangler(["r2", "bucket", "list", "--json"]));
  const existing = list.find((bucket) => bucket.name === name);
  if (existing) return existing.name;
  const created = JSON.parse(runWrangler(["r2", "bucket", "create", name, "--json"]));
  return created.name;
}

async function main() {
  const d1Id = ensureD1(d1Name);
  const r2Bucket = ensureR2(r2Name);
  const base = await readFile("wrangler.toml", "utf-8");

  const envBlock = `\n[env.${envTarget}]\nname = "${workerName}"\n[[env.${envTarget}.d1_databases]]\nbinding = "DB"\ndatabase_name = "${d1Name}"\ndatabase_id = "${d1Id}"\n[[env.${envTarget}.r2_buckets]]\nbinding = "IMAGES"\nbucket_name = "${r2Bucket}"\n[[env.${envTarget}.r2_buckets]]\nbinding = "RECEIPTS"\nbucket_name = "${r2Bucket}"\n`;

  const generated = `${base.trim()}${envBlock}`;
  await writeFile("wrangler.generated.toml", generated);

  console.log(`Provisioned ${envTarget}: D1 ${d1Name} (${d1Id}), R2 ${r2Bucket}`);
}

await main();
