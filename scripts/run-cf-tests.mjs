import { execSync } from "node:child_process";

const required = ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID"];
const missing = required.filter((k) => !process.env[k]);

if (missing.length) {
  console.log(
    "Cloudflare integration tests skipped. Missing secrets:",
    missing.join(", ")
  );
  process.exit(0);
}

function run(cmd, input) {
  execSync(cmd, {
    stdio: input ? ["pipe", "inherit", "inherit"] : "inherit",
    input,
    env: { ...process.env, WRANGLER_SEND_METRICS: "false" },
  });
}

console.log(" Provisioning TEST resources...");
run("node scripts/provision-cf.mjs --env test");

console.log("️ Verifying D1 schema...");
run(
  "npx wrangler d1 execute reseller_app_test --remote --command \"SELECT name FROM sqlite_master WHERE type='table' AND name='items';\""
);

console.log(" Testing R2 put/get/delete...");
run(
  "npx wrangler r2 object put reseller-app-test integration-test.txt --pipe --remote",
  "hello"
);
run(
  "npx wrangler r2 object get reseller-app-test integration-test.txt --pipe --remote"
);
run(
  "npx wrangler r2 object delete reseller-app-test integration-test.txt --remote"
);

console.log(" Deploying TEST worker...");
run("npx wrangler deploy --env test --config wrangler.generated.toml");

console.log("✅ Cloudflare integration tests completed.");
