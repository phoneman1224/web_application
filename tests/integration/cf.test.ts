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
  it("connects to Cloudflare and verifies D1 provisioning", async () => {
    const whoami = await runWrangler(["whoami"]);
    expect(whoami.length).toBeGreaterThan(0);

    const list = await runWrangler(["d1", "list", "--json"]);
    const databases = JSON.parse(list) as { name: string }[];
    const exists = databases.some((db) => db.name === dbName);
    expect(exists).toBe(true);
  });

  it("uploads, retrieves, and deletes an IMAGES object", async () => {
    await runWranglerWithInput(["r2", "object", "put", `${bucketName}/images-test.txt`, "--pipe"], "image");
    const result = await runWrangler(["r2", "object", "get", `${bucketName}/images-test.txt`]);
    expect(result).toContain("images-test.txt");
    await runWrangler(["r2", "object", "delete", `${bucketName}/images-test.txt`]);
  });

  it("uploads, retrieves, and deletes a RECEIPTS object", async () => {
    await runWranglerWithInput(["r2", "object", "put", `${bucketName}/receipts-test.txt`, "--pipe"], "receipt");
    const result = await runWrangler(["r2", "object", "get", `${bucketName}/receipts-test.txt`]);
    expect(result).toContain("receipts-test.txt");
    await runWrangler(["r2", "object", "delete", `${bucketName}/receipts-test.txt`]);
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

    const list = await fetch(`${url}/api/items`, { headers });
    expect(list.status).toBe(200);

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
