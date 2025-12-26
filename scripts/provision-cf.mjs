// scripts/provision-cf.mjs
import { execSync } from "node:child_process";

const envArg = process.argv.find((a) => a === "--env");
const env = envArg ? process.argv[process.argv.indexOf(envArg) + 1] : "test";

if (!["test", "preview", "production"].includes(env)) {
  console.error("Invalid env. Use --env test|preview|production");
  process.exit(1);
}

const D1_NAME = env === "test" ? "reseller_app_test" : "reseller_app";
const R2_BUCKET = env === "test" ? "reseller-app-test" : "reseller-app";

function run(cmd) {
  try {
    execSync(cmd, { stdio: "inherit" });
  } catch (err) {
    // Ignore "already exists" errors
    const msg = String(err?.stderr || err?.message || "");
    if (
      msg.includes("already exists") ||
      msg.includes("Duplicate") ||
      msg.includes("exists")
    ) {
      console.log("ℹ️  Resource already exists, continuing...");
      return;
    }
    throw err;
  }
}

console.log(` Provisioning Cloudflare resources for env: ${env}`);

console.log(`️  Ensuring D1 database: ${D1_NAME}`);
run(`npx wrangler d1 create ${D1_NAME}`);

console.log(` Ensuring R2 bucket: ${R2_BUCKET}`);
run(`npx wrangler r2 bucket create ${R2_BUCKET}`);

console.log("✅ Provisioning complete.");

