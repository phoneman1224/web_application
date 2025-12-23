import { describe, it, expect } from "vitest";
import { execSync } from "node:child_process";

function hasCloudflareSecrets() {
  return (
    !!process.env.CLOUDFLARE_API_TOKEN &&
    !!process.env.CLOUDFLARE_ACCOUNT_ID
  );
}

function run(cmd: string) {
  return execSync(cmd, {
    stdio: "pipe",
    encoding: "utf8",
    env: process.env,
  });
}

describe("cloudflare integration", () => {
  if (!hasCloudflareSecrets()) {
    it("skips Cloudflare integration tests when secrets are missing", () => {
      console.warn("Skipping Cloudflare integration tests (no secrets)");
      expect(true).toBe(true);
    });
    return;
  }

  it("authenticates with Cloudflare (wrangler whoami)", () => {
    const output = run("npx wrangler whoami");
    expect(output.length).toBeGreaterThan(0);
  });

  it("confirms TEST D1 database exists", () => {
    const output = run("npx wrangler d1 list --json");
    const databases = JSON.parse(output);

    const names = databases.map((db: any) => db.name);
    expect(names).toContain("reseller_app_test");
  });

  it("uploads, retrieves, and deletes an R2 object", () => {
    const bucket = "reseller-app-test";
    const key = "integration-test.txt";
    const content = "hello world";

    // upload via pipe (Wrangler v4 compatible)
    run(
      `echo "${content}" | npx wrangler r2 object put ${bucket}/${key} --pipe`
    );

    // retrieve
    const retrieved = run(
      `npx wrangler r2 object get ${bucket}/${key}`
    );
    expect(retrieved.trim()).toBe(content);

    // delete
    run(`npx wrangler r2 object delete ${bucket}/${key}`);

    // verify deletion
    let deleted = false;
    try {
      run(`npx wrangler r2 object get ${bucket}/${key}`);
    } catch {
      deleted = true;
    }

    expect(deleted).toBe(true);
  });
});
