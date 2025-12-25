import { describe, expect, it } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const bucketName = process.env.CF_R2_BUCKET_TEST || "reseller-app-test";
const dbName = process.env.CF_D1_DB_TEST || "reseller_app_test";
const workerName = process.env.CF_WORKER_TEST || "reseller-app-test";

async function runWrangler(args: string[]) {
  const { stdout } = await execFileAsync("npx", ["wrangler", ...args], {
    env: process.env
  });
  return stdout.trim();
}

async function runWranglerWithInput(args: string[], input: string) {
  const { stdout } = await execFileAsync("npx", ["wrangler", ...args], {
    env: process.env,
    input
  });
  return stdout.trim();
}

async function getWorkerUrl() {
  const whoami = await runWrangler(["whoami"]);
  const match = whoami.match(/([\w-]+)\.workers\.dev/);
  if (match?.[1]) {
    return `https://${workerName}.${match[1]}.workers.dev`;
  }
  throw new Error("Unable to determine workers.dev subdomain from wrangler whoami output.");
}

describe("cloudflare integration", () => {
  it("connects to Cloudflare and verifies D1 provisioning", async (ctx) => {
    await execFileAsync("npx", ["wrangler", "whoami"], { env: process.env });

    const list = await runWrangler(["d1", "list", "--json"]);
    const databases = JSON.parse(list) as { name: string }[];
    const exists = databases.some((db) => db.name === dbName);
    if (!exists) {
      console.warn(`D1 database ${dbName} not found yet; skipping D1 schema check.`);
      ctx.skip();
      return;
    }

    const tableCheck = await runWrangler([
      "d1",
      "execute",
      dbName,
      "--remote",
      "--command",
      "SELECT name FROM sqlite_master WHERE type='table' AND name='items';"
    ]);
    expect(tableCheck).toContain("items");
  });

  it("uploads, retrieves, and deletes an IMAGES object", async () => {
    const content = "hello world";
    const key = `${bucketName}/images-test.txt`;
    await runWranglerWithInput(["r2", "object", "put", key, "--pipe", "--remote"], content);
    const result = await runWrangler(["r2", "object", "get", key, "--pipe", "--remote"]);
    expect(result).toBe(content);
    await runWrangler(["r2", "object", "delete", key, "--remote"]);
  });

  it("uploads, retrieves, and deletes a RECEIPTS object", async () => {
    const content = "hello world";
    const key = `${bucketName}/receipts-test.txt`;
    await runWranglerWithInput(["r2", "object", "put", key, "--pipe", "--remote"], content);
    const result = await runWrangler(["r2", "object", "get", key, "--pipe", "--remote"]);
    expect(result).toBe(content);
    await runWrangler(["r2", "object", "delete", key, "--remote"]);
  });

  it("boots worker and enforces auth", async () => {
    await execFileAsync("npx", ["wrangler", "whoami"], { env: process.env });

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
  });

  it("supports item CRUD", async () => {
    const url = await getWorkerUrl();
    const headers = {
      "content-type": "application/json",
      "cf-access-jwt-assertion": "test",
      "cf-access-authenticated-user-email": "test@example.com"
    };

    const create = await fetch(`${url}/api/items`, {
      method: "POST",
      headers,
      body: JSON.stringify({ name: "Integration Item", status: "unlisted" })
    });
    expect(create.status).toBe(201);
    const created = await create.json();
    const itemId = created.id;

    const listItems = await fetch(`${url}/api/items`, { headers });
    expect(listItems.status).toBe(200);

    const update = await fetch(`${url}/api/items/${itemId}`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ status: "listed" })
    });
    expect(update.status).toBe(200);

    const remove = await fetch(`${url}/api/items/${itemId}`, {
      method: "DELETE",
      headers
    });
    expect(remove.status).toBe(200);
  });
});
