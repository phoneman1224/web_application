import { describe, expect, it } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const bucketName = process.env.CF_R2_BUCKET || "reseller-app";
const dbName = process.env.CF_D1_DB || "reseller_app";
const workerName = process.env.CF_WORKER || "reseller-app";

async function runWrangler(args: string[]) {
  const { stdout } = await execFileAsync("npx", ["wrangler", ...args], {
    env: process.env
  });
  return stdout.trim();
}

async function getWorkerUrl() {
  const whoami = await runWrangler(["whoami", "--json"]);
  const parsed = JSON.parse(whoami);
  const subdomain = parsed.workers_subdomain;
  return `https://${workerName}.${subdomain}.workers.dev`;
}

describe("cloudflare integration", () => {
  it("connects to D1 and schema exists", async () => {
    const output = await runWrangler([
      "d1",
      "execute",
      dbName,
      "--command",
      "SELECT name FROM sqlite_master WHERE type='table' AND name='items';",
      "--remote"
    ]);
    expect(output).toContain("items");
  });

  it("uploads, retrieves, and deletes an R2 object", async () => {
    await runWrangler(["r2", "object", "put", bucketName, "integration-test.txt", "--content", "hello"]);
    const result = await runWrangler(["r2", "object", "get", bucketName, "integration-test.txt"]);
    expect(result).toContain("integration-test.txt");
    await runWrangler(["r2", "object", "delete", bucketName, "integration-test.txt"]);
  });

  it("boots worker and enforces auth", async () => {
    const url = await getWorkerUrl();
    const unauth = await fetch(`${url}/api/health`);
    expect(unauth.status).toBe(401);

    const auth = await fetch(`${url}/api/health`, {
      headers: {
        "cf-access-jwt-assertion": "test",
        "cf-access-authenticated-user-email": "test@example.com"
      }
    });
    expect(auth.status).toBe(200);
    const payload = await auth.json();
    expect(payload.ok).toBe(true);
  });
});
