export interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  RECEIPTS: R2Bucket;
  APP_NAME: string;
}

const AUTH_HEADER = "cf-access-jwt-assertion";
const AUTH_EMAIL_HEADER = "cf-access-authenticated-user-email";

function isAuthorized(request: Request): boolean {
  const token = request.headers.get(AUTH_HEADER);
  const identity = request.headers.get(AUTH_EMAIL_HEADER) || request.headers.get("x-auth-user");
  return Boolean(token && identity);
}

function unauthorized(): Response {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { "content-type": "application/json" }
  });
}

async function handleApi(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  if (url.pathname === "/api/health") {
    const result = await env.DB.prepare("SELECT 1 as ok").first();
    return Response.json({ ok: true, db: result?.ok === 1 });
  }

  if (url.pathname === "/api/exports/csv") {
    const rows = await env.DB.prepare("SELECT id, name, status FROM items ORDER BY created_at DESC LIMIT 50").all();
    const headers = ["id", "name", "status"].join(",");
    const body = rows.results
      .map((row) => [row.id, row.name, row.status].map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    return new Response([headers, body].filter(Boolean).join("\n"), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": "attachment; filename=items-export.csv"
      }
    });
  }

  return new Response(JSON.stringify({ error: "Not Found" }), {
    status: 404,
    headers: { "content-type": "application/json" }
  });
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (!isAuthorized(request)) {
      return unauthorized();
    }

    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      return handleApi(request, env);
    }

    return env.ASSETS.fetch(request);
  }
};
