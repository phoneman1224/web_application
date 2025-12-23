export interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  IMAGES: R2Bucket;
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

  return routeApi(request, env, url);
}

async function routeApi(request: Request, env: Env, url: URL): Promise<Response> {
  const { pathname } = url;
  if (pathname === "/api/exports/csv") {
    return exportItemsCsv(env);
  }
  if (pathname === "/api/exports/year-end") {
    return exportYearEndCsv(env);
  }
  if (pathname === "/api/exports/florida-tax") {
    return exportFloridaTaxCsv(env);
  }
  if (pathname === "/api/items" && request.method === "GET") {
    return listItems(env);
  }
  if (pathname === "/api/items" && request.method === "POST") {
    return createItem(request, env);
  }
  if (pathname === "/api/items/ready" && request.method === "GET") {
    return readyToList(env);
  }
  if (pathname.startsWith("/api/items/") && pathname.endsWith("/mark") && request.method === "POST") {
    const id = pathname.split("/")[3];
    return markItemStatus(request, env, id);
  }
  if (pathname.startsWith("/api/items/") && pathname.endsWith("/images")) {
    const id = pathname.split("/")[3];
    return handleItemImages(request, env, id);
  }
  if (pathname.startsWith("/api/items/") && request.method === "GET") {
    const id = pathname.split("/")[3];
    return getItem(env, id);
  }
  if (pathname.startsWith("/api/items/") && request.method === "PUT") {
    const id = pathname.split("/")[3];
    return updateItem(request, env, id);
  }
  if (pathname.startsWith("/api/items/") && request.method === "DELETE") {
    const id = pathname.split("/")[3];
    return deleteItem(env, id);
  }
  if (pathname === "/api/expenses" && request.method === "GET") {
    return listExpenses(env);
  }
  if (pathname === "/api/expenses" && request.method === "POST") {
    return createExpense(request, env);
  }
  if (pathname.startsWith("/api/expenses/") && pathname.endsWith("/receipt")) {
    const id = pathname.split("/")[3];
    return handleReceipts(request, env, id);
  }
  if (pathname.startsWith("/api/expenses/") && request.method === "PUT") {
    const id = pathname.split("/")[3];
    return updateExpense(request, env, id);
  }
  if (pathname === "/api/sales" && request.method === "POST") {
    return createSale(request, env);
  }
  if (pathname === "/api/sales" && request.method === "GET") {
    return listSales(env);
  }
  if (pathname === "/api/lots" && request.method === "POST") {
    return createLot(request, env);
  }
  if (pathname === "/api/lots" && request.method === "GET") {
    return listLots(env);
  }
  if (pathname.startsWith("/api/lots/") && request.method === "PUT") {
    const id = pathname.split("/")[3];
    return updateLot(request, env, id);
  }
  if (pathname.startsWith("/api/lots/") && request.method === "DELETE") {
    const id = pathname.split("/")[3];
    return deleteLot(env, id);
  }
  if (pathname === "/api/pricing-drafts" && request.method === "POST") {
    return createPricingDraft(request, env);
  }
  if (pathname === "/api/reports/summary" && request.method === "GET") {
    return reportSummary(env);
  }
  if (pathname === "/api/reports/drilldown" && request.method === "GET") {
    return reportDrilldown(env);
  }
  if (pathname === "/api/settings" && request.method === "GET") {
    return listSettings(env);
  }
  if (pathname === "/api/settings" && request.method === "PUT") {
    return updateSettings(request, env);
  }

  return new Response(JSON.stringify({ error: "Not Found" }), {
    status: 404,
    headers: { "content-type": "application/json" }
  });
}

async function parseJson<T>(request: Request): Promise<T> {
  const body = await request.text();
  if (!body) {
    throw new Error("Missing body");
  }
  return JSON.parse(body) as T;
}

function okJson(data: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) }
  });
}

async function listItems(env: Env): Promise<Response> {
  const items = await env.DB.prepare(
    "SELECT id, name, status, bin_location, created_at FROM items ORDER BY created_at DESC"
  ).all();
  return okJson({ items: items.results ?? [] });
}

async function getItem(env: Env, id: string): Promise<Response> {
  const item = await env.DB.prepare("SELECT * FROM items WHERE id = ?").bind(id).first();
  if (!item) return okJson({ error: "Not Found" }, { status: 404 });
  return okJson({ item });
}

async function createItem(request: Request, env: Env): Promise<Response> {
  const payload = await parseJson<{ name: string; status?: string; binLocation?: string }>(request);
  if (!payload.name) return okJson({ error: "Name required" }, { status: 400 });
  const id = crypto.randomUUID();
  const status = payload.status ?? "unlisted";
  await env.DB.prepare("INSERT INTO items (id, name, status, bin_location) VALUES (?, ?, ?, ?)")
    .bind(id, payload.name, status, payload.binLocation ?? null)
    .run();
  return okJson({ id, status }, { status: 201 });
}

async function updateItem(request: Request, env: Env, id: string): Promise<Response> {
  const payload = await parseJson<{ name?: string; status?: string; binLocation?: string }>(request);
  await env.DB.prepare(
    "UPDATE items SET name = COALESCE(?, name), status = COALESCE(?, status), bin_location = COALESCE(?, bin_location) WHERE id = ?"
  )
    .bind(payload.name ?? null, payload.status ?? null, payload.binLocation ?? null, id)
    .run();
  return okJson({ ok: true });
}

async function deleteItem(env: Env, id: string): Promise<Response> {
  await env.DB.prepare("DELETE FROM items WHERE id = ?").bind(id).run();
  return okJson({ ok: true });
}

async function markItemStatus(request: Request, env: Env, id: string): Promise<Response> {
  const payload = await parseJson<{ status: string }>(request);
  if (!payload.status) return okJson({ error: "Status required" }, { status: 400 });
  await env.DB.prepare("UPDATE items SET status = ? WHERE id = ?").bind(payload.status, id).run();
  return okJson({ ok: true });
}

async function readyToList(env: Env): Promise<Response> {
  const rows = await env.DB.prepare(
    "SELECT items.id, items.name FROM items JOIN pricing_drafts ON pricing_drafts.item_id = items.id WHERE items.status = 'unlisted'"
  ).all();
  return okJson({ items: rows.results ?? [] });
}

async function handleItemImages(request: Request, env: Env, itemId: string): Promise<Response> {
  if (request.method === "POST") {
    const key = `items/${itemId}/${crypto.randomUUID()}.jpg`;
    const body = await request.arrayBuffer();
    await env.IMAGES.put(key, body, { httpMetadata: { contentType: request.headers.get("content-type") ?? "image/jpeg" } });
    await env.DB.prepare("INSERT INTO item_photos (id, item_id, r2_key) VALUES (?, ?, ?)")
      .bind(crypto.randomUUID(), itemId, key)
      .run();
    return okJson({ key }, { status: 201 });
  }
  if (request.method === "GET") {
    const photos = await env.DB.prepare("SELECT r2_key FROM item_photos WHERE item_id = ?").bind(itemId).all();
    return okJson({ photos: photos.results ?? [] });
  }
  if (request.method === "DELETE") {
    const payload = await parseJson<{ key: string }>(request);
    await env.IMAGES.delete(payload.key);
    await env.DB.prepare("DELETE FROM item_photos WHERE r2_key = ?").bind(payload.key).run();
    return okJson({ ok: true });
  }
  return okJson({ error: "Method not allowed" }, { status: 405 });
}

async function listExpenses(env: Env): Promise<Response> {
  const rows = await env.DB.prepare("SELECT * FROM expenses ORDER BY created_at DESC").all();
  return okJson({ expenses: rows.results ?? [] });
}

async function createExpense(request: Request, env: Env): Promise<Response> {
  const payload = await parseJson<{ name: string; category: string; amount: number }>(request);
  if (!payload.name || !payload.category) return okJson({ error: "Invalid payload" }, { status: 400 });
  const id = crypto.randomUUID();
  await env.DB.prepare("INSERT INTO expenses (id, name, category, amount) VALUES (?, ?, ?, ?)")
    .bind(id, payload.name, payload.category, payload.amount ?? 0)
    .run();
  return okJson({ id }, { status: 201 });
}

async function updateExpense(request: Request, env: Env, id: string): Promise<Response> {
  const payload = await parseJson<{ name?: string; category?: string; amount?: number }>(request);
  await env.DB.prepare(
    "UPDATE expenses SET name = COALESCE(?, name), category = COALESCE(?, category), amount = COALESCE(?, amount) WHERE id = ?"
  )
    .bind(payload.name ?? null, payload.category ?? null, payload.amount ?? null, id)
    .run();
  return okJson({ ok: true });
}

async function handleReceipts(request: Request, env: Env, expenseId: string): Promise<Response> {
  if (request.method === "POST") {
    const key = `receipts/${expenseId}/${crypto.randomUUID()}.pdf`;
    const body = await request.arrayBuffer();
    await env.RECEIPTS.put(key, body, {
      httpMetadata: { contentType: request.headers.get("content-type") ?? "application/pdf" }
    });
    await env.DB.prepare("INSERT INTO receipts (id, expense_id, r2_key) VALUES (?, ?, ?)")
      .bind(crypto.randomUUID(), expenseId, key)
      .run();
    return okJson({ key }, { status: 201 });
  }
  if (request.method === "GET") {
    const rows = await env.DB.prepare("SELECT r2_key FROM receipts WHERE expense_id = ?").bind(expenseId).all();
    return okJson({ receipts: rows.results ?? [] });
  }
  if (request.method === "DELETE") {
    const payload = await parseJson<{ key: string }>(request);
    await env.RECEIPTS.delete(payload.key);
    await env.DB.prepare("DELETE FROM receipts WHERE r2_key = ?").bind(payload.key).run();
    return okJson({ ok: true });
  }
  return okJson({ error: "Method not allowed" }, { status: 405 });
}

async function listSales(env: Env): Promise<Response> {
  const rows = await env.DB.prepare("SELECT * FROM sales ORDER BY created_at DESC").all();
  return okJson({ sales: rows.results ?? [] });
}

async function createSale(request: Request, env: Env): Promise<Response> {
  const payload = await parseJson<{
    orderNumber: string;
    platform: string;
    grossAmount: number;
    floridaTaxCollected: number;
    ebayTaxCollected: number;
  }>(request);
  const id = crypto.randomUUID();
  await env.DB.prepare(
    "INSERT INTO sales (id, order_number, platform, gross_amount, florida_tax_collected, ebay_tax_collected) VALUES (?, ?, ?, ?, ?, ?)"
  )
    .bind(
      id,
      payload.orderNumber,
      payload.platform,
      payload.grossAmount ?? 0,
      payload.floridaTaxCollected ?? 0,
      payload.ebayTaxCollected ?? 0
    )
    .run();
  return okJson({ id }, { status: 201 });
}

async function createLot(request: Request, env: Env): Promise<Response> {
  const payload = await parseJson<{ name: string; itemIds: string[] }>(request);
  const id = crypto.randomUUID();
  await env.DB.prepare("INSERT INTO lots (id, name) VALUES (?, ?)").bind(id, payload.name).run();
  const stmt = env.DB.prepare("INSERT INTO lot_items (lot_id, item_id) VALUES (?, ?)");
  for (const itemId of payload.itemIds ?? []) {
    await stmt.bind(id, itemId).run();
  }
  return okJson({ id }, { status: 201 });
}

async function listLots(env: Env): Promise<Response> {
  const rows = await env.DB.prepare("SELECT id, name FROM lots ORDER BY created_at DESC").all();
  return okJson({ lots: rows.results ?? [] });
}

async function updateLot(request: Request, env: Env, id: string): Promise<Response> {
  const payload = await parseJson<{ name?: string; itemIds?: string[] }>(request);
  if (payload.name) {
    await env.DB.prepare("UPDATE lots SET name = ? WHERE id = ?").bind(payload.name, id).run();
  }
  if (payload.itemIds) {
    await env.DB.prepare("DELETE FROM lot_items WHERE lot_id = ?").bind(id).run();
    const stmt = env.DB.prepare("INSERT INTO lot_items (lot_id, item_id) VALUES (?, ?)");
    for (const itemId of payload.itemIds) {
      await stmt.bind(id, itemId).run();
    }
  }
  return okJson({ ok: true });
}

async function deleteLot(env: Env, id: string): Promise<Response> {
  await env.DB.prepare("DELETE FROM lot_items WHERE lot_id = ?").bind(id).run();
  await env.DB.prepare("DELETE FROM lots WHERE id = ?").bind(id).run();
  return okJson({ ok: true });
}

async function createPricingDraft(request: Request, env: Env): Promise<Response> {
  const payload = await parseJson<{ itemId: string; price: number; seoTitle?: string; confidence?: number }>(request);
  const id = crypto.randomUUID();
  await env.DB.prepare(
    "INSERT INTO pricing_drafts (id, item_id, suggested_price, seo_title, confidence_level) VALUES (?, ?, ?, ?, ?)"
  )
    .bind(id, payload.itemId, payload.price ?? 0, payload.seoTitle ?? null, payload.confidence ?? 0.5)
    .run();
  return okJson({ id }, { status: 201 });
}

async function reportSummary(env: Env): Promise<Response> {
  const sales = await env.DB.prepare("SELECT SUM(gross_amount) as total FROM sales").first();
  const expenses = await env.DB.prepare("SELECT SUM(amount) as total FROM expenses").first();
  const tax = await env.DB.prepare("SELECT SUM(florida_tax_collected) - SUM(ebay_tax_collected) as liability FROM sales").first();
  return okJson({
    salesTotal: sales?.total ?? 0,
    expenseTotal: expenses?.total ?? 0,
    floridaLiability: tax?.liability ?? 0
  });
}

async function reportDrilldown(env: Env): Promise<Response> {
  const rows = await env.DB.prepare(
    "SELECT items.name, sales.order_number, sales.gross_amount FROM sales JOIN sale_items ON sale_items.sale_id = sales.id JOIN items ON items.id = sale_items.item_id"
  ).all();
  return okJson({ rows: rows.results ?? [] });
}

async function exportItemsCsv(env: Env): Promise<Response> {
  const rows = await env.DB.prepare("SELECT id, name, status FROM items ORDER BY created_at DESC LIMIT 200").all();
  return csvResponse(rows.results ?? [], ["id", "name", "status"], "items-export.csv");
}

async function exportYearEndCsv(env: Env): Promise<Response> {
  const rows = await env.DB.prepare("SELECT order_number, gross_amount, platform FROM sales").all();
  return csvResponse(rows.results ?? [], ["order_number", "gross_amount", "platform"], "year-end.csv");
}

async function exportFloridaTaxCsv(env: Env): Promise<Response> {
  const rows = await env.DB.prepare(
    "SELECT order_number, florida_tax_collected, ebay_tax_collected FROM sales"
  ).all();
  return csvResponse(rows.results ?? [], ["order_number", "florida_tax_collected", "ebay_tax_collected"], "florida-tax.csv");
}

function csvResponse(rows: Record<string, unknown>[], columns: string[], filename: string): Response {
  const headers = columns.join(",");
  const body = rows
    .map((row) => columns.map((col) => `"${String(row[col] ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");
  return new Response([headers, body].filter(Boolean).join("\n"), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename=${filename}`
    }
  });
}

async function listSettings(env: Env): Promise<Response> {
  const rows = await env.DB.prepare("SELECT key, value FROM settings").all();
  return okJson({ settings: rows.results ?? [] });
}

async function updateSettings(request: Request, env: Env): Promise<Response> {
  const payload = await parseJson<Record<string, string>>(request);
  const stmt = env.DB.prepare("INSERT INTO settings (id, key, value) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value");
  for (const [key, value] of Object.entries(payload)) {
    await stmt.bind(crypto.randomUUID(), key, value).run();
  }
  return okJson({ ok: true });
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
