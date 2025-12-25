import { spawn } from "node:child_process";

const required = ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID"];
const missing = required.filter((key) => !process.env[key]);

if (missing.length > 0) {
  console.log(
    `Cloudflare integration tests skipped. Missing secrets: ${missing.join(", ")}. ` +
      "Set them to run npm run test:cf."
  );
  process.exit(0);
}

const child = spawn("npx", ["vitest", "run", "--config", "vitest.cf.config.ts"], {
  stdio: "inherit",
  env: process.env
});

child.on("exit", (code) => {
  process.exit(code ?? 1);
});
