import {
  Router,
  parseJsonBody,
  ok,
  okCached,
  okCachedLong,
  okNoCache,
  created,
  noContent,
  badRequest,
  unauthorized as unauthorizedResponse,
  notFound as notFoundResponse,
  conflict,
  getQueryParams,
  generateId
} from './lib/router';
import {
  getById,
  getAll,
  insert,
  update,
  deleteById,
  exists,
  executeQueryFirst,
  getSetting,
  updateSetting,
  getAllSettings
} from './lib/db';
import {
  validateRequired,
  validatePositive,
  validateEnum,
  validateSKUUnique,
  validateXOR,
  validateConfidence,
  ValidationError
} from './lib/validation';
import {
  exchangeCodeForTokens,
  saveEbayTokens,
  isEbayConnected,
  disconnectEbay,
  getTextValuation,
  getPhotoValuation,
  createEbayDraftListing,
  fetchEbayListings,
  fetchEbayOrders
} from './lib/ebay';

export interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  RECEIPTS: R2Bucket;
  AI: any; // Cloudflare Workers AI binding
  APP_NAME: string;
  EBAY_APP_ID: string;
  EBAY_CERT_ID: string;
  EBAY_RU_NAME: string;
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

// Initialize router
const router = new Router();

// ============================================================================
// HEALTH & UTILITY ENDPOINTS
// ============================================================================

router.get('/api/health', async (request, params, env: Env) => {
  const result = await env.DB.prepare("SELECT 1 as ok").first();
  return ok({ ok: true, db: result?.ok === 1 });
});

router.get('/api/debug/env', async (request, params, env: Env) => {
  return ok({
    hasEbayAppId: !!env.EBAY_APP_ID,
    hasEbayCertId: !!env.EBAY_CERT_ID,
    hasEbayRuName: !!env.EBAY_RU_NAME,
    ebayAppIdLength: env.EBAY_APP_ID?.length || 0,
    ebayRuNameValue: env.EBAY_RU_NAME?.substring(0, 20) + '...' || 'undefined'
  });
});

// ============================================================================
// ITEMS CRUD
// ============================================================================

/**
 * GET /api/items
 * List all items with optional filtering
 */
router.get('/api/items', async (request, params, env: Env) => {
  const query = getQueryParams(request);
  const filters: Record<string, any> = {};

  if (query.status) {
    filters.status = query.status;
  }
  if (query.lifecycle_stage) {
    filters.lifecycle_stage = query.lifecycle_stage;
  }
  if (query.category) {
    filters.category = query.category;
  }

  const items = await getAll(env.DB, 'items', filters);
  return ok({ items });
});

/**
 * GET /api/items/:id
 * Get a single item by ID
 */
router.get('/api/items/:id', async (request, params, env: Env) => {
  const item = await getById(env.DB, 'items', params.id);

  if (!item) {
    return notFoundResponse('Item not found');
  }

  return ok({ item });
});

/**
 * POST /api/items
 * Create a new item
 */
router.post('/api/items', async (request, params, env: Env) => {
  const body = await parseJsonBody<any>(request);

  // Validate required fields
  validateRequired(body, ['name']);

  // Validate enums
  if (body.status) {
    validateEnum(body.status, 'status', ['Unlisted', 'Draft', 'Listed', 'Sold']);
  }
  if (body.lifecycle_stage) {
    validateEnum(body.lifecycle_stage, 'lifecycle_stage', ['Captured', 'Prepared', 'Listed', 'Sold']);
  }

  // Validate positive numbers
  if (body.cost !== undefined) {
    validatePositive(body.cost, 'cost');
  }
  if (body.sold_price !== undefined) {
    validatePositive(body.sold_price, 'sold_price');
  }

  // Check SKU uniqueness
  if (body.sku) {
    const isUnique = await validateSKUUnique(env.DB, body.sku);
    if (!isUnique) {
      return conflict('SKU already exists', { sku: body.sku });
    }
  }

  // Generate ID
  const id = generateId('itm');

  // Create item
  const itemData = {
    id,
    sku: body.sku || null,
    name: body.name,
    description: body.description || null,
    cost: body.cost || 0,
    bin_location: body.bin_location || null,
    photos: body.photos || null,
    category: body.category || null,
    status: body.status || 'Unlisted',
    lifecycle_stage: body.lifecycle_stage || 'Captured',
    sold_price: body.sold_price || null,
    sold_date: body.sold_date || null,
    ai_suggested_category: body.ai_suggested_category || null,
    ai_category_confidence: body.ai_category_confidence || null
  };

  const item = await insert(env.DB, 'items', itemData);
  return created({ item });
});

/**
 * PUT /api/items/:id
 * Update an existing item
 */
router.put('/api/items/:id', async (request, params, env: Env) => {
  const body = await parseJsonBody<any>(request);

  // Check item exists
  const itemExists = await exists(env.DB, 'items', params.id);
  if (!itemExists) {
    return notFoundResponse('Item not found');
  }

  // Validate enums
  if (body.status) {
    validateEnum(body.status, 'status', ['Unlisted', 'Draft', 'Listed', 'Sold']);
  }
  if (body.lifecycle_stage) {
    validateEnum(body.lifecycle_stage, 'lifecycle_stage', ['Captured', 'Prepared', 'Listed', 'Sold']);
  }

  // Validate positive numbers
  if (body.cost !== undefined) {
    validatePositive(body.cost, 'cost');
  }
  if (body.sold_price !== undefined) {
    validatePositive(body.sold_price, 'sold_price');
  }

  // Check SKU uniqueness (excluding current item)
  if (body.sku) {
    const isUnique = await validateSKUUnique(env.DB, body.sku, params.id);
    if (!isUnique) {
      return conflict('SKU already exists', { sku: body.sku });
    }
  }

  // Check if editing item in closed period (if sold_date is being changed)
  if (body.sold_date) {
    const inClosedPeriod = await executeQueryFirst<{ id: string }>(
      env.DB,
      `SELECT id FROM closed_periods
       WHERE ? BETWEEN starts_on AND ends_on
       LIMIT 1`,
      [body.sold_date]
    );

    if (inClosedPeriod) {
      return badRequest('Cannot edit item in closed period', { sold_date: body.sold_date });
    }
  }

  // Update item
  const updateData: Record<string, any> = {};

  const allowedFields = [
    'sku', 'name', 'description', 'cost', 'bin_location', 'photos',
    'category', 'status', 'lifecycle_stage', 'sold_price', 'sold_date',
    'ai_suggested_category', 'ai_category_confidence'
  ];

  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updateData[field] = body[field];
    }
  }

  const item = await update(env.DB, 'items', params.id, updateData);
  return ok({ item });
});

/**
 * DELETE /api/items/:id
 * Delete an item (only if not in a sale)
 */
router.delete('/api/items/:id', async (request, params, env: Env) => {
  // Check if item exists
  const itemExists = await exists(env.DB, 'items', params.id);
  if (!itemExists) {
    return notFoundResponse('Item not found');
  }

  // Check if item is in any sales
  const inSale = await executeQueryFirst<{ id: string }>(
    env.DB,
    'SELECT id FROM sale_items WHERE item_id = ? LIMIT 1',
    [params.id]
  );

  if (inSale) {
    return conflict('Cannot delete item that is part of a sale');
  }

  // Delete item
  await deleteById(env.DB, 'items', params.id);
  return noContent();
});

// ============================================================================
// SALES CRUD
// ============================================================================

/**
 * GET /api/sales
 * List all sales with optional date range filtering
 */
router.get('/api/sales', async (request, params, env: Env) => {
  const query = getQueryParams(request);
  let sqlQuery = 'SELECT * FROM sales';
  const sqlParams: any[] = [];
  const conditions: string[] = [];

  if (query.start_date) {
    conditions.push('sale_date >= ?');
    sqlParams.push(query.start_date);
  }

  if (query.end_date) {
    conditions.push('sale_date <= ?');
    sqlParams.push(query.end_date);
  }

  if (query.platform) {
    conditions.push('platform = ?');
    sqlParams.push(query.platform);
  }

  if (conditions.length > 0) {
    sqlQuery += ' WHERE ' + conditions.join(' AND ');
  }

  sqlQuery += ' ORDER BY sale_date DESC, created_at DESC';

  const result = await env.DB.prepare(sqlQuery).bind(...sqlParams).all();
  const sales = result.results || [];

  // Performance: Fetch all sale items in a single query to avoid N+1
  if (sales.length > 0) {
    const saleIds = sales.map((s: any) => s.id);
    const placeholders = saleIds.map(() => '?').join(',');

    const allSaleItems = await env.DB
      .prepare(`
        SELECT si.*, i.name as item_name, i.cost as item_cost
        FROM sale_items si
        JOIN items i ON si.item_id = i.id
        WHERE si.sale_id IN (${placeholders})
      `)
      .bind(...saleIds)
      .all();

    // Group sale items by sale_id
    const itemsBySale: Record<string, any[]> = {};
    for (const item of allSaleItems.results || []) {
      const saleId = (item as any).sale_id;
      if (!itemsBySale[saleId]) {
        itemsBySale[saleId] = [];
      }
      itemsBySale[saleId].push(item);
    }

    // Attach items to each sale
    for (const sale of sales) {
      (sale as any).items = itemsBySale[(sale as any).id] || [];
    }
  }

  return ok({ sales });
});

/**
 * GET /api/sales/:id
 * Get a single sale with items
 */
router.get('/api/sales/:id', async (request, params, env: Env) => {
  const sale = await getById<any>(env.DB, 'sales', params.id);

  if (!sale) {
    return notFoundResponse('Sale not found');
  }

  // Fetch associated items
  const saleItems = await env.DB
    .prepare(`
      SELECT si.*, i.name as item_name, i.cost as item_cost
      FROM sale_items si
      JOIN items i ON si.item_id = i.id
      WHERE si.sale_id = ?
    `)
    .bind(params.id)
    .all();

  sale.items = saleItems.results || [];

  return ok({ sale });
});

/**
 * POST /api/sales
 * Create a new sale with items (auto-calculate profit and taxes)
 */
router.post('/api/sales', async (request, params, env: Env) => {
  const body = await parseJsonBody<any>(request);

  // Validate required fields
  validateRequired(body, ['order_number', 'platform', 'gross_amount', 'cost_of_goods', 'sale_date']);

  // Validate sale has at least one item
  if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
    return badRequest('Sale must include at least one item');
  }

  // Validate each item
  for (const item of body.items) {
    if (!item.item_id) {
      return badRequest('Each sale item must have an item_id');
    }
    if (!item.quantity || item.quantity <= 0) {
      return badRequest('Each sale item must have a positive quantity');
    }
  }

  // Validate positive numbers
  validatePositive(body.gross_amount, 'gross_amount');
  validatePositive(body.platform_fees || 0, 'platform_fees');
  validatePositive(body.promotion_discount || 0, 'promotion_discount');
  validatePositive(body.shipping_cost || 0, 'shipping_cost');
  validatePositive(body.cost_of_goods, 'cost_of_goods');
  validatePositive(body.florida_tax_collected || 0, 'florida_tax_collected');
  validatePositive(body.ebay_tax_collected || 0, 'ebay_tax_collected');

  // Get federal tax rate from settings
  const federalTaxRate = parseFloat(
    (await getSetting(env.DB, 'federal_tax_rate', '0.22')) || '0.22'
  );

  // Auto-calculate profit
  const grossAmount = body.gross_amount;
  const platformFees = body.platform_fees || 0;
  const promotionDiscount = body.promotion_discount || 0;
  const shippingCost = body.shipping_cost || 0;
  const costOfGoods = body.cost_of_goods;

  const profit = grossAmount - platformFees - promotionDiscount - shippingCost - costOfGoods;

  // Auto-calculate federal tax estimate (on profit)
  const federalTaxEstimate = Math.max(0, profit * federalTaxRate);

  // Generate sale ID
  const saleId = generateId('sal');

  // Create sale
  const saleData = {
    id: saleId,
    order_number: body.order_number,
    platform: body.platform,
    gross_amount: grossAmount,
    platform_fees: platformFees,
    promotion_discount: promotionDiscount,
    shipping_cost: shippingCost,
    cost_of_goods: costOfGoods,
    florida_tax_collected: body.florida_tax_collected || 0,
    ebay_tax_collected: body.ebay_tax_collected || 0,
    federal_tax_estimate: Math.round(federalTaxEstimate * 100) / 100,
    profit: Math.round(profit * 100) / 100,
    sale_date: body.sale_date,
    notes: body.notes || null
  };

  const sale = await insert(env.DB, 'sales', saleData);

  // Create sale items
  const saleItems = [];
  for (const item of body.items) {
    const saleItemId = generateId('si');
    const saleItemData = {
      id: saleItemId,
      sale_id: saleId,
      item_id: item.item_id,
      quantity: item.quantity
    };
    await insert(env.DB, 'sale_items', saleItemData);
    saleItems.push(saleItemData);
  }

  (sale as any).items = saleItems;

  return created({ sale });
});

/**
 * PUT /api/sales/:id
 * Update an existing sale
 */
router.put('/api/sales/:id', async (request, params, env: Env) => {
  const body = await parseJsonBody<any>(request);

  // Check sale exists
  const existingSale = await getById<any>(env.DB, 'sales', params.id);
  if (!existingSale) {
    return notFoundResponse('Sale not found');
  }

  // Check if editing sale in closed period
  const saleDateToCheck = body.sale_date || existingSale.sale_date;
  const inClosedPeriod = await executeQueryFirst<{ id: string }>(
    env.DB,
    `SELECT id FROM closed_periods
     WHERE ? BETWEEN starts_on AND ends_on
     LIMIT 1`,
    [saleDateToCheck]
  );

  if (inClosedPeriod) {
    return badRequest('Cannot edit sale in closed period', { sale_date: saleDateToCheck });
  }

  // Validate positive numbers if provided
  if (body.gross_amount !== undefined) {
    validatePositive(body.gross_amount, 'gross_amount');
  }
  if (body.platform_fees !== undefined) {
    validatePositive(body.platform_fees, 'platform_fees');
  }
  if (body.promotion_discount !== undefined) {
    validatePositive(body.promotion_discount, 'promotion_discount');
  }
  if (body.shipping_cost !== undefined) {
    validatePositive(body.shipping_cost, 'shipping_cost');
  }
  if (body.cost_of_goods !== undefined) {
    validatePositive(body.cost_of_goods, 'cost_of_goods');
  }
  if (body.florida_tax_collected !== undefined) {
    validatePositive(body.florida_tax_collected, 'florida_tax_collected');
  }
  if (body.ebay_tax_collected !== undefined) {
    validatePositive(body.ebay_tax_collected, 'ebay_tax_collected');
  }

  // Recalculate profit and taxes if any financial fields changed
  const needsRecalculation =
    body.gross_amount !== undefined ||
    body.platform_fees !== undefined ||
    body.promotion_discount !== undefined ||
    body.shipping_cost !== undefined ||
    body.cost_of_goods !== undefined;

  let updateData: Record<string, any> = {};

  if (needsRecalculation) {
    const grossAmount = body.gross_amount ?? existingSale.gross_amount;
    const platformFees = body.platform_fees ?? existingSale.platform_fees;
    const promotionDiscount = body.promotion_discount ?? existingSale.promotion_discount;
    const shippingCost = body.shipping_cost ?? existingSale.shipping_cost;
    const costOfGoods = body.cost_of_goods ?? existingSale.cost_of_goods;

    const profit = grossAmount - platformFees - promotionDiscount - shippingCost - costOfGoods;

    const federalTaxRate = parseFloat(
      (await getSetting(env.DB, 'federal_tax_rate', '0.22')) || '0.22'
    );
    const federalTaxEstimate = Math.max(0, profit * federalTaxRate);

    updateData = {
      ...body,
      profit: Math.round(profit * 100) / 100,
      federal_tax_estimate: Math.round(federalTaxEstimate * 100) / 100
    };
  } else {
    updateData = { ...body };
  }

  // Remove items field if present (handled separately)
  delete updateData.items;

  // Update sale
  const sale = await update(env.DB, 'sales', params.id, updateData);

  // Update sale items if provided
  if (body.items && Array.isArray(body.items)) {
    // Delete existing sale items
    await env.DB.prepare('DELETE FROM sale_items WHERE sale_id = ?').bind(params.id).run();

    // Insert new sale items
    const saleItems = [];
    for (const item of body.items) {
      const saleItemId = generateId('si');
      const saleItemData = {
        id: saleItemId,
        sale_id: params.id,
        item_id: item.item_id,
        quantity: item.quantity
      };
      await insert(env.DB, 'sale_items', saleItemData);
      saleItems.push(saleItemData);
    }
    (sale as any).items = saleItems;
  } else {
    // Fetch existing items
    const saleItems = await env.DB
      .prepare('SELECT * FROM sale_items WHERE sale_id = ?')
      .bind(params.id)
      .all();
    (sale as any).items = saleItems.results || [];
  }

  return ok({ sale });
});

/**
 * DELETE /api/sales/:id
 * Delete a sale (cascades to sale_items)
 */
router.delete('/api/sales/:id', async (request, params, env: Env) => {
  const saleExists = await exists(env.DB, 'sales', params.id);
  if (!saleExists) {
    return notFoundResponse('Sale not found');
  }

  // Check if in closed period
  const sale = await getById<any>(env.DB, 'sales', params.id);
  const inClosedPeriod = await executeQueryFirst<{ id: string }>(
    env.DB,
    `SELECT id FROM closed_periods
     WHERE ? BETWEEN starts_on AND ends_on
     LIMIT 1`,
    [sale.sale_date]
  );

  if (inClosedPeriod) {
    return badRequest('Cannot delete sale in closed period', { sale_date: sale.sale_date });
  }

  // Delete sale (cascade to sale_items via ON DELETE CASCADE)
  await deleteById(env.DB, 'sales', params.id);
  return noContent();
});

// ============================================================================
// EXPENSES CRUD
// ============================================================================

/**
 * GET /api/expenses
 * List all expenses with optional filtering
 */
router.get('/api/expenses', async (request, params, env: Env) => {
  const query = getQueryParams(request);
  let sqlQuery = 'SELECT * FROM expenses';
  const sqlParams: any[] = [];
  const conditions: string[] = [];

  if (query.start_date) {
    conditions.push('expense_date >= ?');
    sqlParams.push(query.start_date);
  }

  if (query.end_date) {
    conditions.push('expense_date <= ?');
    sqlParams.push(query.end_date);
  }

  if (query.category) {
    conditions.push('category = ?');
    sqlParams.push(query.category);
  }

  if (conditions.length > 0) {
    sqlQuery += ' WHERE ' + conditions.join(' AND ');
  }

  sqlQuery += ' ORDER BY expense_date DESC, created_at DESC';

  const result = await env.DB.prepare(sqlQuery).bind(...sqlParams).all();
  return ok({ expenses: result.results || [] });
});

/**
 * GET /api/expenses/:id
 * Get a single expense
 */
router.get('/api/expenses/:id', async (request, params, env: Env) => {
  const expense = await getById(env.DB, 'expenses', params.id);

  if (!expense) {
    return notFoundResponse('Expense not found');
  }

  return ok({ expense });
});

/**
 * POST /api/expenses
 * Create a new expense with split validation
 */
router.post('/api/expenses', async (request, params, env: Env) => {
  const body = await parseJsonBody<any>(request);

  // Validate required fields
  validateRequired(body, ['name', 'category', 'amount', 'expense_date']);

  // Validate positive numbers
  validatePositive(body.amount, 'amount');
  validatePositive(body.split_inventory || 0, 'split_inventory');
  validatePositive(body.split_operations || 0, 'split_operations');
  validatePositive(body.split_other || 0, 'split_other');

  // Validate vehicle deduction mutual exclusivity
  if (body.vehicle_mileage !== undefined || body.vehicle_actual !== undefined) {
    const { validateVehicleDeduction } = await import('./lib/validation');
    validateVehicleDeduction(body.vehicle_mileage, body.vehicle_actual);
  }

  // Validate expense splits sum to amount (within 1 cent tolerance)
  const inventory = body.split_inventory || 0;
  const operations = body.split_operations || 0;
  const other = body.split_other || 0;
  const total = inventory + operations + other;
  const epsilon = 0.01;

  if (Math.abs(total - body.amount) > epsilon) {
    return badRequest('Expense splits must sum to total amount', {
      amount: body.amount,
      total,
      splits: { inventory, operations, other }
    });
  }

  // Generate ID
  const id = generateId('exp');

  // Create expense
  const expenseData = {
    id,
    name: body.name,
    category: body.category,
    amount: body.amount,
    split_inventory: inventory,
    split_operations: operations,
    split_other: other,
    receipt_key: body.receipt_key || null,
    vehicle_mileage: body.vehicle_mileage || null,
    vehicle_actual: body.vehicle_actual || null,
    expense_date: body.expense_date,
    notes: body.notes || null,
    ai_suggested_category: body.ai_suggested_category || null,
    ai_split_confidence: body.ai_split_confidence || null
  };

  const expense = await insert(env.DB, 'expenses', expenseData);
  return created({ expense });
});

/**
 * PUT /api/expenses/:id
 * Update an existing expense
 */
router.put('/api/expenses/:id', async (request, params, env: Env) => {
  const body = await parseJsonBody<any>(request);

  // Check expense exists
  const existingExpense = await getById<any>(env.DB, 'expenses', params.id);
  if (!existingExpense) {
    return notFoundResponse('Expense not found');
  }

  // Validate positive numbers if provided
  if (body.amount !== undefined) {
    validatePositive(body.amount, 'amount');
  }
  if (body.split_inventory !== undefined) {
    validatePositive(body.split_inventory, 'split_inventory');
  }
  if (body.split_operations !== undefined) {
    validatePositive(body.split_operations, 'split_operations');
  }
  if (body.split_other !== undefined) {
    validatePositive(body.split_other, 'split_other');
  }

  // Validate vehicle deduction mutual exclusivity
  const mileage = body.vehicle_mileage !== undefined ? body.vehicle_mileage : existingExpense.vehicle_mileage;
  const actual = body.vehicle_actual !== undefined ? body.vehicle_actual : existingExpense.vehicle_actual;

  if (mileage !== undefined || actual !== undefined) {
    const { validateVehicleDeduction } = await import('./lib/validation');
    validateVehicleDeduction(mileage, actual);
  }

  // Validate splits if any split or amount changed
  const amount = body.amount ?? existingExpense.amount;
  const inventory = body.split_inventory ?? existingExpense.split_inventory;
  const operations = body.split_operations ?? existingExpense.split_operations;
  const other = body.split_other ?? existingExpense.split_other;
  const total = inventory + operations + other;
  const epsilon = 0.01;

  if (Math.abs(total - amount) > epsilon) {
    return badRequest('Expense splits must sum to total amount', {
      amount,
      total,
      splits: { inventory, operations, other }
    });
  }

  // Check if editing expense in closed period
  const expenseDateToCheck = body.expense_date || existingExpense.expense_date;
  const inClosedPeriod = await executeQueryFirst<{ id: string }>(
    env.DB,
    `SELECT id FROM closed_periods
     WHERE ? BETWEEN starts_on AND ends_on
     LIMIT 1`,
    [expenseDateToCheck]
  );

  if (inClosedPeriod) {
    return badRequest('Cannot edit expense in closed period', { expense_date: expenseDateToCheck });
  }

  // Update expense
  const updateData: Record<string, any> = {};
  const allowedFields = [
    'name', 'category', 'amount', 'split_inventory', 'split_operations', 'split_other',
    'receipt_key', 'vehicle_mileage', 'vehicle_actual', 'expense_date', 'notes',
    'ai_suggested_category', 'ai_split_confidence'
  ];

  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updateData[field] = body[field];
    }
  }

  const expense = await update(env.DB, 'expenses', params.id, updateData);
  return ok({ expense });
});

/**
 * DELETE /api/expenses/:id
 * Delete an expense
 */
router.delete('/api/expenses/:id', async (request, params, env: Env) => {
  const expenseExists = await exists(env.DB, 'expenses', params.id);
  if (!expenseExists) {
    return notFoundResponse('Expense not found');
  }

  // Check if in closed period
  const expense = await getById<any>(env.DB, 'expenses', params.id);
  const inClosedPeriod = await executeQueryFirst<{ id: string }>(
    env.DB,
    `SELECT id FROM closed_periods
     WHERE ? BETWEEN starts_on AND ends_on
     LIMIT 1`,
    [expense.expense_date]
  );

  if (inClosedPeriod) {
    return badRequest('Cannot delete expense in closed period', { expense_date: expense.expense_date });
  }

  await deleteById(env.DB, 'expenses', params.id);
  return noContent();
});

// ============================================================================
// LOTS CRUD
// ============================================================================

/**
 * GET /api/lots
 * List all lots with rolled-up costs
 */
router.get('/api/lots', async (request, params, env: Env) => {
  const lots = await getAll<any>(env.DB, 'lots');

  // Performance: Fetch all lot items in a single query to avoid N+1
  if (lots.length > 0) {
    const lotIds = lots.map(l => l.id);
    const placeholders = lotIds.map(() => '?').join(',');

    const allLotItems = await env.DB
      .prepare(`
        SELECT li.*, i.name as item_name, i.cost as item_cost, i.category as item_category
        FROM lot_items li
        JOIN items i ON li.item_id = i.id
        WHERE li.lot_id IN (${placeholders})
      `)
      .bind(...lotIds)
      .all();

    // Group lot items by lot_id
    const itemsByLot: Record<string, any[]> = {};
    for (const item of allLotItems.results || []) {
      const lotId = (item as any).lot_id;
      if (!itemsByLot[lotId]) {
        itemsByLot[lotId] = [];
      }
      itemsByLot[lotId].push(item);
    }

    // Attach items to each lot and calculate rolled-up cost
    for (const lot of lots) {
      lot.items = itemsByLot[lot.id] || [];

      // Calculate rolled-up cost
      let totalCost = 0;
      for (const item of lot.items) {
        totalCost += (item as any).item_cost * (item as any).quantity;
      }
      lot.total_cost = Math.round(totalCost * 100) / 100;
    }
  }

  return ok({ lots });
});

/**
 * GET /api/lots/:id
 * Get a single lot with items and rolled-up cost
 */
router.get('/api/lots/:id', async (request, params, env: Env) => {
  const lot = await getById<any>(env.DB, 'lots', params.id);

  if (!lot) {
    return notFoundResponse('Lot not found');
  }

  // Fetch lot items
  const lotItems = await env.DB
    .prepare(`
      SELECT li.*, i.name as item_name, i.cost as item_cost, i.category as item_category
      FROM lot_items li
      JOIN items i ON li.item_id = i.id
      WHERE li.lot_id = ?
    `)
    .bind(params.id)
    .all();

  lot.items = lotItems.results || [];

  // Calculate rolled-up cost
  let totalCost = 0;
  for (const item of lot.items) {
    totalCost += (item as any).item_cost * (item as any).quantity;
  }
  lot.total_cost = Math.round(totalCost * 100) / 100;

  return ok({ lot });
});

/**
 * POST /api/lots
 * Create a new lot
 */
router.post('/api/lots', async (request, params, env: Env) => {
  const body = await parseJsonBody<any>(request);

  // Validate required fields
  validateRequired(body, ['name']);

  // Generate lot ID
  const lotId = generateId('lot');

  // Create lot
  const lotData = {
    id: lotId,
    name: body.name,
    notes: body.notes || null
  };

  const lot = await insert(env.DB, 'lots', lotData);

  // Add items if provided
  const lotItems = [];
  if (body.items && Array.isArray(body.items)) {
    for (const item of body.items) {
      if (!item.item_id || !item.quantity || item.quantity <= 0) {
        continue; // Skip invalid items
      }

      const lotItemId = generateId('li');
      const lotItemData = {
        id: lotItemId,
        lot_id: lotId,
        item_id: item.item_id,
        quantity: item.quantity
      };

      await insert(env.DB, 'lot_items', lotItemData);
      lotItems.push(lotItemData);
    }
  }

  (lot as any).items = lotItems;
  (lot as any).total_cost = 0; // Will be calculated on fetch

  return created({ lot });
});

/**
 * PUT /api/lots/:id
 * Update a lot (add/remove items)
 */
router.put('/api/lots/:id', async (request, params, env: Env) => {
  const body = await parseJsonBody<any>(request);

  // Check lot exists
  const lotExists = await exists(env.DB, 'lots', params.id);
  if (!lotExists) {
    return notFoundResponse('Lot not found');
  }

  // Update lot basic fields
  const updateData: Record<string, any> = {};
  if (body.name !== undefined) {
    updateData.name = body.name;
  }
  if (body.notes !== undefined) {
    updateData.notes = body.notes;
  }

  const lot = await update(env.DB, 'lots', params.id, updateData);

  // Update lot items if provided
  if (body.items && Array.isArray(body.items)) {
    // Delete existing lot items
    await env.DB.prepare('DELETE FROM lot_items WHERE lot_id = ?').bind(params.id).run();

    // Insert new lot items
    const lotItems = [];
    for (const item of body.items) {
      if (!item.item_id || !item.quantity || item.quantity <= 0) {
        continue; // Skip invalid items
      }

      const lotItemId = generateId('li');
      const lotItemData = {
        id: lotItemId,
        lot_id: params.id,
        item_id: item.item_id,
        quantity: item.quantity
      };

      await insert(env.DB, 'lot_items', lotItemData);
      lotItems.push(lotItemData);
    }
    (lot as any).items = lotItems;
  } else {
    // Fetch existing items
    const lotItems = await env.DB
      .prepare('SELECT * FROM lot_items WHERE lot_id = ?')
      .bind(params.id)
      .all();
    (lot as any).items = lotItems.results || [];
  }

  // Calculate rolled-up cost
  const itemsWithCost = await env.DB
    .prepare(`
      SELECT li.quantity, i.cost
      FROM lot_items li
      JOIN items i ON li.item_id = i.id
      WHERE li.lot_id = ?
    `)
    .bind(params.id)
    .all();

  let totalCost = 0;
  for (const item of itemsWithCost.results || []) {
    totalCost += (item as any).cost * (item as any).quantity;
  }
  (lot as any).total_cost = Math.round(totalCost * 100) / 100;

  return ok({ lot });
});

/**
 * DELETE /api/lots/:id
 * Delete a lot (cascades to lot_items)
 */
router.delete('/api/lots/:id', async (request, params, env: Env) => {
  const lotExists = await exists(env.DB, 'lots', params.id);
  if (!lotExists) {
    return notFoundResponse('Lot not found');
  }

  // Delete lot (cascade to lot_items via ON DELETE CASCADE)
  await deleteById(env.DB, 'lots', params.id);
  return noContent();
});

// ============================================================================
// PRICING DRAFTS CRUD
// ============================================================================

/**
 * GET /api/pricing-drafts
 * List all pricing drafts with optional filtering
 */
router.get('/api/pricing-drafts', async (request, params, env: Env) => {
  const query = getQueryParams(request);
  let sqlQuery = 'SELECT * FROM pricing_drafts';
  const sqlParams: any[] = [];
  const conditions: string[] = [];

  if (query.item_id) {
    conditions.push('item_id = ?');
    sqlParams.push(query.item_id);
  }

  if (query.lot_id) {
    conditions.push('lot_id = ?');
    sqlParams.push(query.lot_id);
  }

  if (conditions.length > 0) {
    sqlQuery += ' WHERE ' + conditions.join(' AND ');
  }

  sqlQuery += ' ORDER BY created_at DESC';

  const result = await env.DB.prepare(sqlQuery).bind(...sqlParams).all();
  return ok({ pricing_drafts: result.results || [] });
});

/**
 * GET /api/pricing-drafts/:id
 * Get a single pricing draft
 */
router.get('/api/pricing-drafts/:id', async (request, params, env: Env) => {
  const draft = await getById(env.DB, 'pricing_drafts', params.id);

  if (!draft) {
    return notFoundResponse('Pricing draft not found');
  }

  return ok({ pricing_draft: draft });
});

/**
 * POST /api/pricing-drafts
 * Create a new pricing draft (XOR: item_id OR lot_id)
 */
router.post('/api/pricing-drafts', async (request, params, env: Env) => {
  const body = await parseJsonBody<any>(request);

  // Validate XOR constraint: must have item_id OR lot_id, not both
  validateXOR(body, 'item_id', 'lot_id');

  // Validate positive numbers
  if (body.suggested_price !== undefined) {
    validatePositive(body.suggested_price, 'suggested_price');
  }

  // Validate confidence score
  if (body.confidence_score !== undefined) {
    validateConfidence(body.confidence_score);
  }

  // Check that referenced item or lot exists
  if (body.item_id) {
    const itemExists = await exists(env.DB, 'items', body.item_id);
    if (!itemExists) {
      return notFoundResponse('Item not found');
    }
  }

  if (body.lot_id) {
    const lotExists = await exists(env.DB, 'lots', body.lot_id);
    if (!lotExists) {
      return notFoundResponse('Lot not found');
    }
  }

  // Generate ID
  const id = generateId('pd');

  // Create pricing draft
  const draftData = {
    id,
    item_id: body.item_id || null,
    lot_id: body.lot_id || null,
    suggested_price: body.suggested_price || null,
    seo_title: body.seo_title || null,
    seo_description: body.seo_description || null,
    confidence_score: body.confidence_score || null,
    ai_generated: body.ai_generated || false,
    ai_keywords: body.ai_keywords || null
  };

  const draft = await insert(env.DB, 'pricing_drafts', draftData);
  return created({ pricing_draft: draft });
});

/**
 * PUT /api/pricing-drafts/:id
 * Update an existing pricing draft
 */
router.put('/api/pricing-drafts/:id', async (request, params, env: Env) => {
  const body = await parseJsonBody<any>(request);

  // Check draft exists
  const draftExists = await exists(env.DB, 'pricing_drafts', params.id);
  if (!draftExists) {
    return notFoundResponse('Pricing draft not found');
  }

  // Validate positive numbers if provided
  if (body.suggested_price !== undefined) {
    validatePositive(body.suggested_price, 'suggested_price');
  }

  // Validate confidence score if provided
  if (body.confidence_score !== undefined) {
    validateConfidence(body.confidence_score);
  }

  // Update draft
  const updateData: Record<string, any> = {};
  const allowedFields = [
    'suggested_price', 'seo_title', 'seo_description', 'confidence_score',
    'ai_generated', 'ai_keywords'
  ];

  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updateData[field] = body[field];
    }
  }

  const draft = await update(env.DB, 'pricing_drafts', params.id, updateData);
  return ok({ pricing_draft: draft });
});

/**
 * DELETE /api/pricing-drafts/:id
 * Delete a pricing draft
 */
router.delete('/api/pricing-drafts/:id', async (request, params, env: Env) => {
  const draftExists = await exists(env.DB, 'pricing_drafts', params.id);
  if (!draftExists) {
    return notFoundResponse('Pricing draft not found');
  }

  await deleteById(env.DB, 'pricing_drafts', params.id);
  return noContent();
});

/**
 * POST /api/pricing-drafts/:id/apply
 * Apply a pricing draft to its item/lot (update status to Listed)
 */
router.post('/api/pricing-drafts/:id/apply', async (request, params, env: Env) => {
  const draft = await getById<any>(env.DB, 'pricing_drafts', params.id);

  if (!draft) {
    return notFoundResponse('Pricing draft not found');
  }

  // Update item or lot status to Listed
  if (draft.item_id) {
    await update(env.DB, 'items', draft.item_id, {
      status: 'Listed',
      lifecycle_stage: 'Listed'
    });
  }

  // Note: Lots don't have a status field, so nothing to update for lots
  // The draft remains for reference but is marked as "applied"

  return ok({ message: 'Pricing draft applied successfully' });
});

// ============================================================================
// SETTINGS ENDPOINTS
// ============================================================================

/**
 * GET /api/settings
 * Get all settings as key-value map
 */
router.get('/api/settings', async (request, params, env: Env) => {
  const settings = await getAllSettings(env.DB);
  return okCachedLong({ settings }); // Cache for 1 hour - settings rarely change
});

/**
 * GET /api/settings/:key
 * Get a single setting by key
 */
router.get('/api/settings/:key', async (request, params, env: Env) => {
  const value = await getSetting(env.DB, params.key);

  if (value === null) {
    return notFoundResponse('Setting not found');
  }

  return okCachedLong({ key: params.key, value }); // Cache for 1 hour
});

/**
 * PUT /api/settings/:key
 * Update a setting value
 */
router.put('/api/settings/:key', async (request, params, env: Env) => {
  const body = await parseJsonBody<any>(request);

  validateRequired(body, ['value']);

  await updateSetting(env.DB, params.key, body.value);

  return ok({ key: params.key, value: body.value });
});

// ============================================================================
// REPORTS ENDPOINTS
// ============================================================================

/**
 * GET /api/reports/dashboard
 * Get dashboard summary (MTD profit, tax liability, ready drafts, next actions)
 */
router.get('/api/reports/dashboard', async (request, params, env: Env) => {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

  // MTD Profit
  const salesResult = await env.DB
    .prepare(`
      SELECT SUM(profit) as total_profit
      FROM sales
      WHERE sale_date >= ? AND sale_date <= ?
    `)
    .bind(monthStart, monthEnd)
    .first();

  const mtdProfit = (salesResult as any)?.total_profit || 0;

  // Sales tax liability (non-eBay only)
  const taxResult = await env.DB
    .prepare(`
      SELECT SUM(florida_tax_collected) as total_liability
      FROM sales
      WHERE sale_date >= ? AND sale_date <= ?
    `)
    .bind(monthStart, monthEnd)
    .first();

  const salesTaxLiability = (taxResult as any)?.total_liability || 0;

  // Ready drafts count (items with status 'Ready' or lifecycle 'Prepared')
  const draftsResult = await env.DB
    .prepare(`
      SELECT COUNT(*) as count
      FROM items
      WHERE lifecycle_stage = 'Prepared' OR status = 'Draft'
    `)
    .first();

  const readyDrafts = (draftsResult as any)?.count || 0;

  // Next actions
  const nextActions = [];

  // Check for items without photos
  const noPhotosResult = await env.DB
    .prepare(`SELECT COUNT(*) as count FROM items WHERE photos IS NULL AND status != 'Sold'`)
    .first();
  const noPhotos = (noPhotosResult as any)?.count || 0;
  if (noPhotos > 0) {
    nextActions.push(`Add photos to ${noPhotos} items`);
  }

  // Check for expenses without receipts
  const noReceiptsResult = await env.DB
    .prepare(`SELECT COUNT(*) as count FROM expenses WHERE receipt_key IS NULL`)
    .first();
  const noReceipts = (noReceiptsResult as any)?.count || 0;
  if (noReceipts > 0) {
    nextActions.push(`Upload ${noReceipts} missing receipts`);
  }

  // Check for ready drafts
  if (readyDrafts > 0) {
    nextActions.push(`${readyDrafts} items ready to list`);
  }

  return okCached({ // Cache for 5 minutes - reduces expensive aggregation queries
    mtd_profit: Math.round(mtdProfit * 100) / 100,
    sales_tax_liability: Math.round(salesTaxLiability * 100) / 100,
    ready_drafts: readyDrafts,
    next_actions: nextActions
  });
});

/**
 * GET /api/reports/profit-loss
 * Get profit & loss report for specified period
 */
router.get('/api/reports/profit-loss', async (request, params, env: Env) => {
  const query = getQueryParams(request);
  const startDate = query.start_date;
  const endDate = query.end_date;

  // Revenue (sales)
  const revenueResult = await env.DB
    .prepare(`
      SELECT
        SUM(gross_amount) as gross,
        SUM(platform_fees) as fees,
        SUM(promotion_discount) as discounts,
        SUM(profit) as profit
      FROM sales
      WHERE sale_date >= ? AND sale_date <= ?
    `)
    .bind(startDate, endDate)
    .first();

  // Expenses
  const expensesResult = await env.DB
    .prepare(`
      SELECT
        SUM(split_inventory) as inventory,
        SUM(split_operations) as operations,
        SUM(split_other) as other,
        SUM(amount) as total
      FROM expenses
      WHERE expense_date >= ? AND expense_date <= ?
    `)
    .bind(startDate, endDate)
    .first();

  return okCached({ // Cache for 5 minutes - report data changes infrequently
    revenue: {
      gross: (revenueResult as any)?.gross || 0,
      fees: (revenueResult as any)?.fees || 0,
      discounts: (revenueResult as any)?.discounts || 0,
      profit: (revenueResult as any)?.profit || 0
    },
    expenses: {
      inventory: (expensesResult as any)?.inventory || 0,
      operations: (expensesResult as any)?.operations || 0,
      other: (expensesResult as any)?.other || 0,
      total: (expensesResult as any)?.total || 0
    }
  });
});

/**
 * GET /api/reports/tax-summary
 * Get tax summary (federal estimate with drilldown)
 */
router.get('/api/reports/tax-summary', async (request, params, env: Env) => {
  const query = getQueryParams(request);
  const startDate = query.start_date;
  const endDate = query.end_date;

  // Federal tax estimate
  const federalResult = await env.DB
    .prepare(`
      SELECT SUM(federal_tax_estimate) as total
      FROM sales
      WHERE sale_date >= ? AND sale_date <= ?
    `)
    .bind(startDate, endDate)
    .first();

  const federalTaxEstimate = (federalResult as any)?.total || 0;

  // Florida sales tax liability
  const floridaResult = await env.DB
    .prepare(`
      SELECT SUM(florida_tax_collected) as total
      FROM sales
      WHERE sale_date >= ? AND sale_date <= ?
    `)
    .bind(startDate, endDate)
    .first();

  const floridaTaxLiability = (floridaResult as any)?.total || 0;

  return okCached({ // Cache for 5 minutes - tax calculations
    federal_tax_estimate: Math.round(federalTaxEstimate * 100) / 100,
    florida_sales_tax_liability: Math.round(floridaTaxLiability * 100) / 100
  });
});

/**
 * GET /api/reports/florida-sales-tax
 * Get Florida sales tax liability (non-eBay platforms)
 */
router.get('/api/reports/florida-sales-tax', async (request, params, env: Env) => {
  const query = getQueryParams(request);
  const startDate = query.start_date;
  const endDate = query.end_date;

  const result = await env.DB
    .prepare(`
      SELECT
        platform,
        SUM(florida_tax_collected) as tax_collected,
        COUNT(*) as sale_count
      FROM sales
      WHERE sale_date >= ? AND sale_date <= ?
      GROUP BY platform
    `)
    .bind(startDate, endDate)
    .all();

  return okCached({ breakdown: result.results || [] }); // Cache for 5 minutes
});

// ============================================================================
// ENHANCED EXPORTS
// ============================================================================

/**
 * GET /api/exports/items-csv
 * Export items to CSV
 */
router.get('/api/exports/items-csv', async (request, params, env: Env) => {
  const items = await env.DB
    .prepare('SELECT * FROM items ORDER BY created_at DESC')
    .all();

  const headers = ['id', 'sku', 'name', 'category', 'cost', 'status', 'bin_location', 'created_at'];
  const rows = (items.results || []).map((item: any) =>
    headers.map(h => `"${String(item[h] ?? '').replace(/"/g, '""')}"`)
  );

  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

  return new Response(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': 'attachment; filename=items-export.csv'
    }
  });
});

/**
 * GET /api/exports/sales-csv
 * Export sales to CSV
 */
router.get('/api/exports/sales-csv', async (request, params, env: Env) => {
  const sales = await env.DB
    .prepare('SELECT * FROM sales ORDER BY sale_date DESC')
    .all();

  const headers = ['id', 'order_number', 'platform', 'gross_amount', 'profit', 'sale_date'];
  const rows = (sales.results || []).map((sale: any) =>
    headers.map(h => `"${String(sale[h] ?? '').replace(/"/g, '""')}"`)
  );

  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

  return new Response(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': 'attachment; filename=sales-export.csv'
    }
  });
});

/**
 * GET /api/exports/expenses-csv
 * Export expenses to CSV
 */
router.get('/api/exports/expenses-csv', async (request, params, env: Env) => {
  const expenses = await env.DB
    .prepare('SELECT * FROM expenses ORDER BY expense_date DESC')
    .all();

  const headers = ['id', 'name', 'category', 'amount', 'split_inventory', 'split_operations', 'split_other', 'expense_date'];
  const rows = (expenses.results || []).map((expense: any) =>
    headers.map(h => `"${String(expense[h] ?? '').replace(/"/g, '""')}"`)
  );

  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

  return new Response(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': 'attachment; filename=expenses-export.csv'
    }
  });
});

/**
 * GET /api/exports/tax-year
 * Export complete tax year data as JSON
 */
router.get('/api/exports/tax-year', async (request, params, env: Env) => {
  const query = getQueryParams(request);
  const year = query.year || new Date().getFullYear().toString();
  const startDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;

  const sales = await env.DB
    .prepare('SELECT * FROM sales WHERE sale_date >= ? AND sale_date <= ?')
    .bind(startDate, endDate)
    .all();

  const expenses = await env.DB
    .prepare('SELECT * FROM expenses WHERE expense_date >= ? AND expense_date <= ?')
    .bind(startDate, endDate)
    .all();

  const data = {
    year,
    sales: sales.results || [],
    expenses: expenses.results || [],
    generated_at: new Date().toISOString()
  };

  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': `attachment; filename=tax-year-${year}.json`
    }
  });
});

// ============================================================================
// R2 PHOTO MANAGEMENT
// ============================================================================

/**
 * Validate image file based on magic bytes (file signature)
 * Security: Prevents uploading of malicious files disguised as images
 */
function validateImageFile(bytes: Uint8Array, filename: string): { valid: boolean; type?: string; error?: string } {
  // Check file size (must have at least 12 bytes for magic byte detection)
  if (bytes.length < 12) {
    return { valid: false, error: 'File too small to be a valid image' };
  }

  // JPEG: FF D8 FF
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
    return { valid: true, type: 'image/jpeg' };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
    return { valid: true, type: 'image/png' };
  }

  // GIF: 47 49 46 38 (GIF8)
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) {
    return { valid: true, type: 'image/gif' };
  }

  // WebP: RIFF ???? WEBP
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
    return { valid: true, type: 'image/webp' };
  }

  return { valid: false, error: `Invalid image format. Only JPEG, PNG, GIF, and WebP are supported.` };
}

/**
 * POST /api/photos/upload
 * Upload a photo to R2 storage
 */
router.post('/api/photos/upload', async (request, params, env: Env) => {
  const formData = await request.formData();
  const file = formData.get('file') as File;

  if (!file) {
    return badRequest('No file provided');
  }

  // Security: Validate file size (5MB limit)
  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
  if (file.size > MAX_FILE_SIZE) {
    return badRequest('File size exceeds 5MB limit');
  }

  // Security: Whitelist of allowed file extensions
  const allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  if (!allowedExtensions.includes(extension)) {
    return badRequest(`Invalid file extension. Allowed: ${allowedExtensions.join(', ')}`);
  }

  // Security: Read file buffer and validate magic bytes
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  const validation = validateImageFile(bytes, file.name);

  if (!validation.valid) {
    return badRequest(validation.error || 'Invalid image file');
  }

  // Use the detected content type from magic bytes (more secure than trusting client)
  const contentType = validation.type || 'image/jpeg';

  // Generate unique key with validated extension
  const timestamp = Date.now();
  const randomPart = Math.random().toString(36).substring(2, 15);
  const key = `photos/${timestamp}-${randomPart}.${extension}`;

  // Upload to R2
  await env.RECEIPTS.put(key, arrayBuffer, {
    httpMetadata: {
      contentType: contentType
    }
  });

  return created({ key, url: `/api/photos/${key}` });
});

/**
 * GET /api/photos/:key
 * Retrieve a photo from R2 storage
 */
router.get('/api/photos/:key', async (request, params, env: Env) => {
  // Handle nested paths (photos/timestamp-random.jpg)
  const url = new URL(request.url);
  const key = url.pathname.replace('/api/photos/', '');

  const object = await env.RECEIPTS.get(key);

  if (!object) {
    return notFoundResponse('Photo not found');
  }

  return new Response(object.body, {
    headers: {
      'content-type': object.httpMetadata?.contentType || 'image/jpeg',
      'cache-control': 'public, max-age=31536000'
    }
  });
});

/**
 * DELETE /api/photos/:key
 * Delete a photo from R2 storage
 */
router.delete('/api/photos/:key', async (request, params, env: Env) => {
  // Handle nested paths
  const url = new URL(request.url);
  const key = url.pathname.replace('/api/photos/', '');

  await env.RECEIPTS.delete(key);
  return noContent();
});

// ============================================================================
// AI-POWERED ENDPOINTS
// ============================================================================

/**
 * POST /api/ai/generate-seo
 * Generate SEO-optimized listing for item or lot
 */
router.post('/api/ai/generate-seo', async (request, params, env: Env) => {
  const body = await parseJsonBody<any>(request);
  const { canUseAI, logAIUsage, getEstimatedCost } = await import('./lib/ai-monitor');
  const { generateSEO } = await import('./lib/ai');

  // Check quota
  const quotaCheck = await canUseAI(env.DB, 'generate-seo');
  if (!quotaCheck.allowed) {
    return badRequest(quotaCheck.reason || 'AI quota exceeded', { usage: quotaCheck.usage });
  }

  // Get item or lot data
  let itemData: any;

  if (body.item_id) {
    itemData = await getById(env.DB, 'items', body.item_id);
    if (!itemData) {
      return notFoundResponse('Item not found');
    }
  } else if (body.lot_id) {
    const lot = await getById<any>(env.DB, 'lots', body.lot_id);
    if (!lot) {
      return notFoundResponse('Lot not found');
    }
    // Use lot name and notes as description
    itemData = {
      name: lot.name,
      description: lot.notes,
      category: 'Lot'
    };
  } else {
    return badRequest('Must provide item_id or lot_id');
  }

  // Generate SEO
  const result = await generateSEO(env.AI, {
    name: itemData.name,
    description: itemData.description,
    category: itemData.category
  });

  // Log usage
  await logAIUsage(env.DB, 'generate-seo', getEstimatedCost('generate-seo'));

  return ok(result);
});

/**
 * POST /api/ai/categorize
 * Suggest category for item or expense
 */
router.post('/api/ai/categorize', async (request, params, env: Env) => {
  const body = await parseJsonBody<any>(request);
  const { canUseAI, logAIUsage, getEstimatedCost } = await import('./lib/ai-monitor');
  const { suggestCategory } = await import('./lib/ai');

  validateRequired(body, ['text', 'type']);

  if (!['item', 'expense'].includes(body.type)) {
    return badRequest('Type must be "item" or "expense"');
  }

  // Check quota
  const quotaCheck = await canUseAI(env.DB, 'categorize');
  if (!quotaCheck.allowed) {
    return badRequest(quotaCheck.reason || 'AI quota exceeded', { usage: quotaCheck.usage });
  }

  // Categorize
  const result = await suggestCategory(env.AI, body.text, body.type);

  // Log usage
  await logAIUsage(env.DB, 'categorize', getEstimatedCost('categorize'));

  return ok(result);
});

/**
 * POST /api/ai/suggest-price
 * Get AI pricing suggestion for item
 */
router.post('/api/ai/suggest-price', async (request, params, env: Env) => {
  const body = await parseJsonBody<any>(request);
  const { canUseAI, logAIUsage, getEstimatedCost } = await import('./lib/ai-monitor');
  const { suggestPrice } = await import('./lib/ai');

  // Check quota
  const quotaCheck = await canUseAI(env.DB, 'suggest-price');
  if (!quotaCheck.allowed) {
    return badRequest(quotaCheck.reason || 'AI quota exceeded', { usage: quotaCheck.usage });
  }

  // Get item data if item_id provided
  let itemData: any;

  if (body.item_id) {
    itemData = await getById(env.DB, 'items', body.item_id);
    if (!itemData) {
      return notFoundResponse('Item not found');
    }
  } else {
    // Use provided data
    itemData = {
      name: body.name || 'Unknown Item',
      description: body.description,
      category: body.category,
      condition: body.condition
    };
  }

  // Suggest price
  const result = await suggestPrice(env.AI, itemData);

  // Log usage
  await logAIUsage(env.DB, 'suggest-price', getEstimatedCost('suggest-price'));

  return ok(result);
});

/**
 * POST /api/ai/analyze-photo
 * Analyze uploaded photo to detect item details
 */
router.post('/api/ai/analyze-photo', async (request, params, env: Env) => {
  const { canUseAI, logAIUsage, getEstimatedCost } = await import('./lib/ai-monitor');
  const { analyzePhoto } = await import('./lib/ai');

  // Check quota
  const quotaCheck = await canUseAI(env.DB, 'analyze-photo');
  if (!quotaCheck.allowed) {
    return badRequest(quotaCheck.reason || 'AI quota exceeded', { usage: quotaCheck.usage });
  }

  const formData = await request.formData();
  const file = formData.get('photo') as File;

  if (!file) {
    return badRequest('No photo provided');
  }

  if (!file.type.startsWith('image/')) {
    return badRequest('File must be an image');
  }

  // Convert to ArrayBuffer
  const photoData = await file.arrayBuffer();

  // Analyze photo
  const result = await analyzePhoto(env.AI, photoData);

  // Log usage
  await logAIUsage(env.DB, 'analyze-photo', getEstimatedCost('analyze-photo'));

  return ok(result);
});

/**
 * GET /api/ai/insights
 * Get AI-generated dashboard insights
 */
router.get('/api/ai/insights', async (request, params, env: Env) => {
  const { canUseAI, logAIUsage, getEstimatedCost } = await import('./lib/ai-monitor');
  const { generateInsights } = await import('./lib/ai');

  // Check quota
  const quotaCheck = await canUseAI(env.DB, 'generate-insights');
  if (!quotaCheck.allowed) {
    return badRequest(quotaCheck.reason || 'AI quota exceeded', { usage: quotaCheck.usage });
  }

  // Get recent data
  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const startDate = thirtyDaysAgo.toISOString().split('T')[0];
  const endDate = now.toISOString().split('T')[0];

  const sales = await env.DB
    .prepare('SELECT * FROM sales WHERE sale_date >= ? AND sale_date <= ? LIMIT 50')
    .bind(startDate, endDate)
    .all();

  const inventory = await env.DB
    .prepare('SELECT * FROM items WHERE status != ? LIMIT 100')
    .bind('Sold')
    .all();

  const expenses = await env.DB
    .prepare('SELECT * FROM expenses WHERE expense_date >= ? AND expense_date <= ? LIMIT 50')
    .bind(startDate, endDate)
    .all();

  // Generate insights
  const result = await generateInsights(env.AI, {
    recentSales: sales.results || [],
    inventory: inventory.results || [],
    expenses: expenses.results || []
  });

  // Log usage
  await logAIUsage(env.DB, 'generate-insights', getEstimatedCost('generate-insights'));

  return ok(result);
});

/**
 * POST /api/ai/suggest-split
 * Suggest expense split percentages
 */
router.post('/api/ai/suggest-split', async (request, params, env: Env) => {
  const body = await parseJsonBody<any>(request);
  const { canUseAI, logAIUsage, getEstimatedCost } = await import('./lib/ai-monitor');
  const { suggestExpenseSplit } = await import('./lib/ai');

  validateRequired(body, ['name', 'category', 'amount']);

  // Check quota
  const quotaCheck = await canUseAI(env.DB, 'suggest-split');
  if (!quotaCheck.allowed) {
    return badRequest(quotaCheck.reason || 'AI quota exceeded', { usage: quotaCheck.usage });
  }

  // Suggest split
  const result = await suggestExpenseSplit(env.AI, {
    name: body.name,
    category: body.category,
    amount: body.amount
  });

  // Log usage
  await logAIUsage(env.DB, 'suggest-split', getEstimatedCost('suggest-split'));

  return ok(result);
});

/**
 * POST /api/ai/enhance-description
 * Enhance item description with AI
 */
router.post('/api/ai/enhance-description', async (request, params, env: Env) => {
  const body = await parseJsonBody<any>(request);
  const { canUseAI, logAIUsage, getEstimatedCost } = await import('./lib/ai-monitor');
  const { enhanceDescription } = await import('./lib/ai');

  validateRequired(body, ['description']);

  // Check quota
  const quotaCheck = await canUseAI(env.DB, 'enhance-description');
  if (!quotaCheck.allowed) {
    return badRequest(quotaCheck.reason || 'AI quota exceeded', { usage: quotaCheck.usage });
  }

  // Enhance description
  const result = await enhanceDescription(env.AI, body.description);

  // Log usage
  await logAIUsage(env.DB, 'enhance-description', getEstimatedCost('enhance-description'));

  return ok(result);
});

/**
 * GET /api/ai/usage
 * Get AI usage statistics
 */
router.get('/api/ai/usage', async (request, params, env: Env) => {
  const { getUsageSummary } = await import('./lib/ai-monitor');

  const summary = await getUsageSummary(env.DB);

  return ok(summary);
});

// ============================================================================
// EBAY VALUATION ENDPOINTS
// ============================================================================

/**
 * POST /api/ebay/valuation/text
 * Get eBay market valuation (text-based, FREE)
 * Body: { itemName: string, category?: string }
 */
router.post('/api/ebay/valuation/text', async (request, params, env: Env) => {
  const body = await parseJsonBody<any>(request);
  validateRequired(body, ['itemName']);

  const { isEbayConnected, getTextValuation } = await import('./lib/ebay');

  // Check eBay connection
  const connected = await isEbayConnected(env.DB);
  if (!connected) {
    return badRequest('eBay not connected. Please connect eBay in Settings.');
  }

  try {
    const valuation = await getTextValuation(env.DB, env, body.itemName, body.category);
    return ok(valuation);
  } catch (error: any) {
    console.error('eBay text valuation failed:', error);
    return badRequest(`Valuation failed: ${error.message}`);
  }
});

/**
 * POST /api/ebay/valuation/photo
 * Get eBay market valuation (photo-based, 800 neurons)
 * Body: FormData with 'photo' file
 */
router.post('/api/ebay/valuation/photo', async (request, params, env: Env) => {
  const { canUseAI, logAIUsage } = await import('./lib/ai-monitor');

  // Check AI quota (800 neurons for photo analysis)
  const quotaCheck = await canUseAI(env.DB, 'ebay-photo-valuation', 800);
  if (!quotaCheck.allowed) {
    return badRequest(quotaCheck.reason || 'AI quota exceeded', { usage: quotaCheck.usage });
  }

  const { isEbayConnected, getPhotoValuation } = await import('./lib/ebay');

  // Check eBay connection
  const connected = await isEbayConnected(env.DB);
  if (!connected) {
    return badRequest('eBay not connected. Please connect eBay in Settings.');
  }

  // Parse photo from FormData
  const formData = await request.formData();
  const file = formData.get('photo') as File;

  if (!file) {
    return badRequest('No photo provided');
  }

  if (!file.type.startsWith('image/')) {
    return badRequest('File must be an image');
  }

  try {
    const photoData = await file.arrayBuffer();
    const valuation = await getPhotoValuation(env.DB, env, photoData);

    // Log AI usage
    await logAIUsage(env.DB, 'ebay-photo-valuation', 800);

    return ok(valuation);
  } catch (error: any) {
    console.error('eBay photo valuation failed:', error);
    return badRequest(`Valuation failed: ${error.message}`);
  }
});

/**
 * POST /api/ebay/create-draft
 * Create eBay draft listing
 * Body: { itemId: string, sku: string, title: string, price: number, quantity: number, condition: string, description?: string }
 */
router.post('/api/ebay/create-draft', async (request, params, env: Env) => {
  const body = await parseJsonBody<any>(request);
  validateRequired(body, ['itemId', 'sku', 'title', 'price', 'quantity', 'condition']);

  const { isEbayConnected, createEbayDraftListing } = await import('./lib/ebay');
  const { update } = await import('./lib/db');

  // Check eBay connection
  const connected = await isEbayConnected(env.DB);
  if (!connected) {
    return badRequest('eBay not connected. Please connect eBay in Settings.');
  }

  // Validate price and quantity
  validatePositive(body.price, 'price');
  validatePositive(body.quantity, 'quantity');

  // Validate condition
  const validConditions = ['NEW', 'USED_EXCELLENT', 'USED_GOOD', 'FOR_PARTS_OR_NOT_WORKING'];
  if (!validConditions.includes(body.condition)) {
    return badRequest(`Invalid condition. Must be one of: ${validConditions.join(', ')}`);
  }

  try {
    // Create eBay draft listing
    const result = await createEbayDraftListing(env.DB, env, {
      sku: body.sku,
      title: body.title.substring(0, 80), // Enforce eBay's 80 char limit
      price: body.price,
      quantity: body.quantity,
      condition: body.condition,
      description: body.description,
      categoryId: body.categoryId
    });

    if (!result.success) {
      return badRequest(`Failed to create eBay draft: ${result.error}`);
    }

    // Update local item with eBay listing info
    await update(env.DB, 'items', body.itemId, {
      ebay_listing_id: result.offerId || null,
      ebay_status: 'draft',
      status: 'Draft'
    });

    return created({
      message: 'eBay draft listing created successfully',
      listingId: result.listingId,
      offerId: result.offerId,
      draftUrl: result.draftUrl
    });
  } catch (error: any) {
    console.error('eBay draft creation failed:', error);
    return badRequest(`Draft creation failed: ${error.message}`);
  }
});

/**
 * POST /api/ebay/import-listings
 * Import active eBay listings to local database
 */
router.post('/api/ebay/import-listings', async (request, params, env: Env) => {
  try {
    // Check eBay connection
    const isConnected = await isEbayConnected(env.DB);
    if (!isConnected) {
      return badRequest('eBay not connected. Please authenticate first.');
    }

    // Fetch listings from eBay
    const result = await fetchEbayListings(env.DB, env);

    // Create items for new listings
    let imported = 0;
    const errors: string[] = [];

    for (const listing of result.listings) {
      try {
        await env.DB.prepare(`
          INSERT INTO items (
            id, sku, name, description, cost, category, status, bin_location,
            ebay_listing_id, ebay_status, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        `).bind(
          generateId('itm'),
          listing.sku,
          listing.name,
          listing.description,
          listing.cost,
          listing.category,
          listing.status,
          null,
          listing.ebay_listing_id,
          listing.ebay_status
        ).run();

        imported++;
      } catch (error: any) {
        errors.push(`Failed to import ${listing.name}: ${error.message}`);
      }
    }

    return created({
      imported,
      duplicates: result.duplicateCount,
      errors: errors.length,
      errorDetails: errors
    });

  } catch (error: any) {
    console.error('eBay listing import failed:', error);
    return badRequest(`Import failed: ${error.message}`);
  }
});

/**
 * POST /api/ebay/import-sales
 * Import eBay orders (sales) for a date range
 */
router.post('/api/ebay/import-sales', async (request, params, env: Env) => {
  try {
    // Check eBay connection
    const isConnected = await isEbayConnected(env.DB);
    if (!isConnected) {
      return badRequest('eBay not connected. Please authenticate first.');
    }

    // Parse date range from request body
    const body = await request.json() as { dateRange?: { start: string; end: string } };

    // Fetch orders from eBay
    const result = await fetchEbayOrders(env.DB, env, body.dateRange);

    // Create sales records
    let imported = 0;
    const errors: string[] = [];

    for (const sale of result.sales) {
      try {
        // Insert sale
        const saleResult = await env.DB.prepare(`
          INSERT INTO sales (
            order_number, sale_date, platform,
            gross_amount, platform_fees, shipping_cost, net_amount, profit,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        `).bind(
          sale.order_number,
          sale.sale_date,
          sale.platform,
          sale.gross_amount,
          sale.platform_fees,
          sale.shipping_cost,
          sale.net_amount,
          sale.profit
        ).run();

        const saleId = saleResult.meta.last_row_id;

        // Link sale to items via junction table
        for (const itemId of sale.item_ids) {
          await env.DB.prepare(`
            INSERT INTO sale_items (sale_id, item_id)
            VALUES (?, ?)
          `).bind(saleId, itemId).run();

          // Update item status to Sold
          await env.DB.prepare(`
            UPDATE items
            SET status = 'Sold', lifecycle_stage = 'Sold', updated_at = datetime('now')
            WHERE id = ?
          `).bind(itemId).run();
        }

        imported++;
      } catch (error: any) {
        errors.push(`Failed to import order ${sale.order_number}: ${error.message}`);
      }
    }

    return created({
      imported,
      matched: result.matchedCount,
      orphaned: result.orphanedCount,
      errors: errors.length,
      errorDetails: errors
    });

  } catch (error: any) {
    console.error('eBay sales import failed:', error);
    return badRequest(`Import failed: ${error.message}`);
  }
});

// ============================================================================
// EBAY OAUTH INTEGRATION
// ============================================================================

/**
 * GET /api/ebay/auth
 * Redirect to eBay OAuth authorization page
 */
router.get('/api/ebay/auth', async (request, params, env: Env) => {
  // eBay OAuth scopes for selling and inventory management
  const scopes = [
    'https://api.ebay.com/oauth/api_scope',
    'https://api.ebay.com/oauth/api_scope/sell.inventory',
    'https://api.ebay.com/oauth/api_scope/sell.account',
  ];

  // Build OAuth URL
  const authUrl = new URL('https://auth.ebay.com/oauth2/authorize');
  authUrl.searchParams.set('client_id', env.EBAY_APP_ID);
  authUrl.searchParams.set('redirect_uri', env.EBAY_RU_NAME);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', scopes.join(' '));

  // Redirect user to eBay
  return Response.redirect(authUrl.toString(), 302);
});

/**
 * GET /api/ebay/callback
 * Handle OAuth callback from eBay
 */
router.get('/api/ebay/callback', async (request, params, env: Env) => {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');

  // Build absolute redirect URLs
  const origin = url.origin; // e.g., https://app.markbrian5178.org
  const errorUrl = `${origin}/?screen=settings&status=ebay_error`;
  const successUrl = `${origin}/?screen=settings&status=ebay_connected`;

  // Check for errors
  if (error) {
    console.error('eBay OAuth error:', error);
    return Response.redirect(errorUrl, 302);
  }

  if (!code) {
    return badRequest('Missing authorization code');
  }

  try {
    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(env, code);

    // Save tokens to database
    const scopes = [
      'https://api.ebay.com/oauth/api_scope',
      'https://api.ebay.com/oauth/api_scope/sell.inventory',
      'https://api.ebay.com/oauth/api_scope/sell.account',
    ];
    await saveEbayTokens(env.DB, tokens, scopes);

    // Redirect back to settings with success status
    return Response.redirect(successUrl, 302);

  } catch (err) {
    console.error('Failed to exchange eBay code for tokens:', err);
    return Response.redirect(errorUrl, 302);
  }
});

/**
 * GET /api/ebay/status
 * Check if eBay is connected
 */
router.get('/api/ebay/status', async (request, params, env: Env) => {
  const connected = await isEbayConnected(env.DB);
  return ok({ connected });
});

/**
 * DELETE /api/ebay/disconnect
 * Disconnect eBay integration
 */
router.delete('/api/ebay/disconnect', async (request, params, env: Env) => {
  await disconnectEbay(env.DB);
  return ok({ message: 'eBay disconnected successfully' });
});

// ============================================================================
// BACKUP & RESTORE ENDPOINTS
// ============================================================================

/**
 * GET /api/backup/full
 * Create complete JSON backup of all data
 */
router.get('/api/backup/full', async (request, params, env: Env) => {
  // Fetch all data from all tables
  const items = await env.DB.prepare('SELECT * FROM items').all();
  const sales = await env.DB.prepare('SELECT * FROM sales').all();
  const saleItems = await env.DB.prepare('SELECT * FROM sale_items').all();
  const expenses = await env.DB.prepare('SELECT * FROM expenses').all();
  const lots = await env.DB.prepare('SELECT * FROM lots').all();
  const lotItems = await env.DB.prepare('SELECT * FROM lot_items').all();
  const pricingDrafts = await env.DB.prepare('SELECT * FROM pricing_drafts').all();
  const feeProfiles = await env.DB.prepare('SELECT * FROM fee_profiles').all();
  const settings = await env.DB.prepare('SELECT * FROM settings').all();
  const closedPeriods = await env.DB.prepare('SELECT * FROM closed_periods').all();

  const backup = {
    version: '0002',
    timestamp: new Date().toISOString(),
    tables: {
      items: items.results || [],
      sales: sales.results || [],
      sale_items: saleItems.results || [],
      expenses: expenses.results || [],
      lots: lots.results || [],
      lot_items: lotItems.results || [],
      pricing_drafts: pricingDrafts.results || [],
      fee_profiles: feeProfiles.results || [],
      settings: settings.results || [],
      closed_periods: closedPeriods.results || []
    }
  };

  const filename = `reseller-backup-${new Date().toISOString().split('T')[0]}.json`;

  return new Response(JSON.stringify(backup, null, 2), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': `attachment; filename=${filename}`
    }
  });
});

/**
 * POST /api/restore/full
 * Restore from JSON backup (WARNING: Overwrites existing data)
 */
router.post('/api/restore/full', async (request, params, env: Env) => {
  const body = await parseJsonBody<any>(request);

  if (!body.tables) {
    return badRequest('Invalid backup file format');
  }

  // Validate backup version
  if (body.version !== '0002') {
    return badRequest('Backup version mismatch. Expected version 0002.');
  }

  try {
    // Begin transaction-like operation (D1 doesn't support transactions, so we do best effort)
    // Clear existing data (except settings and fee_profiles which have defaults)
    await env.DB.prepare('DELETE FROM pricing_drafts').run();
    await env.DB.prepare('DELETE FROM lot_items').run();
    await env.DB.prepare('DELETE FROM lots').run();
    await env.DB.prepare('DELETE FROM sale_items').run();
    await env.DB.prepare('DELETE FROM sales').run();
    await env.DB.prepare('DELETE FROM expenses').run();
    await env.DB.prepare('DELETE FROM items').run();
    await env.DB.prepare('DELETE FROM closed_periods').run();

    // Restore items
    if (body.tables.items && Array.isArray(body.tables.items)) {
      for (const item of body.tables.items) {
        const keys = Object.keys(item);
        const values = Object.values(item);
        const placeholders = keys.map(() => '?').join(', ');
        await env.DB
          .prepare(`INSERT INTO items (${keys.join(', ')}) VALUES (${placeholders})`)
          .bind(...values)
          .run();
      }
    }

    // Restore sales
    if (body.tables.sales && Array.isArray(body.tables.sales)) {
      for (const sale of body.tables.sales) {
        const keys = Object.keys(sale);
        const values = Object.values(sale);
        const placeholders = keys.map(() => '?').join(', ');
        await env.DB
          .prepare(`INSERT INTO sales (${keys.join(', ')}) VALUES (${placeholders})`)
          .bind(...values)
          .run();
      }
    }

    // Restore sale_items
    if (body.tables.sale_items && Array.isArray(body.tables.sale_items)) {
      for (const saleItem of body.tables.sale_items) {
        const keys = Object.keys(saleItem);
        const values = Object.values(saleItem);
        const placeholders = keys.map(() => '?').join(', ');
        await env.DB
          .prepare(`INSERT INTO sale_items (${keys.join(', ')}) VALUES (${placeholders})`)
          .bind(...values)
          .run();
      }
    }

    // Restore expenses
    if (body.tables.expenses && Array.isArray(body.tables.expenses)) {
      for (const expense of body.tables.expenses) {
        const keys = Object.keys(expense);
        const values = Object.values(expense);
        const placeholders = keys.map(() => '?').join(', ');
        await env.DB
          .prepare(`INSERT INTO expenses (${keys.join(', ')}) VALUES (${placeholders})`)
          .bind(...values)
          .run();
      }
    }

    // Restore lots
    if (body.tables.lots && Array.isArray(body.tables.lots)) {
      for (const lot of body.tables.lots) {
        const keys = Object.keys(lot);
        const values = Object.values(lot);
        const placeholders = keys.map(() => '?').join(', ');
        await env.DB
          .prepare(`INSERT INTO lots (${keys.join(', ')}) VALUES (${placeholders})`)
          .bind(...values)
          .run();
      }
    }

    // Restore lot_items
    if (body.tables.lot_items && Array.isArray(body.tables.lot_items)) {
      for (const lotItem of body.tables.lot_items) {
        const keys = Object.keys(lotItem);
        const values = Object.values(lotItem);
        const placeholders = keys.map(() => '?').join(', ');
        await env.DB
          .prepare(`INSERT INTO lot_items (${keys.join(', ')}) VALUES (${placeholders})`)
          .bind(...values)
          .run();
      }
    }

    // Restore pricing_drafts
    if (body.tables.pricing_drafts && Array.isArray(body.tables.pricing_drafts)) {
      for (const draft of body.tables.pricing_drafts) {
        const keys = Object.keys(draft);
        const values = Object.values(draft);
        const placeholders = keys.map(() => '?').join(', ');
        await env.DB
          .prepare(`INSERT INTO pricing_drafts (${keys.join(', ')}) VALUES (${placeholders})`)
          .bind(...values)
          .run();
      }
    }

    // Restore closed_periods
    if (body.tables.closed_periods && Array.isArray(body.tables.closed_periods)) {
      for (const period of body.tables.closed_periods) {
        const keys = Object.keys(period);
        const values = Object.values(period);
        const placeholders = keys.map(() => '?').join(', ');
        await env.DB
          .prepare(`INSERT INTO closed_periods (${keys.join(', ')}) VALUES (${placeholders})`)
          .bind(...values)
          .run();
      }
    }

    // Restore settings (merge with existing)
    if (body.tables.settings && Array.isArray(body.tables.settings)) {
      for (const setting of body.tables.settings) {
        await env.DB
          .prepare('INSERT OR REPLACE INTO settings (id, key, value, updated_at) VALUES (?, ?, ?, ?)')
          .bind(setting.id, setting.key, setting.value, setting.updated_at)
          .run();
      }
    }

    return ok({
      message: 'Backup restored successfully',
      restored: {
        items: body.tables.items?.length || 0,
        sales: body.tables.sales?.length || 0,
        expenses: body.tables.expenses?.length || 0,
        lots: body.tables.lots?.length || 0
      }
    });
  } catch (error: any) {
    console.error('Restore failed:', error);
    return badRequest('Restore failed: ' + error.message);
  }
});

// ============================================================================
// CSV IMPORT ENDPOINTS
// ============================================================================

/**
 * POST /api/import/items
 * Import items from CSV
 */
router.post('/api/import/items', async (request, params, env: Env) => {
  const formData = await request.formData();
  const file = formData.get('file') as File;

  if (!file) {
    return badRequest('No file provided');
  }

  const text = await file.text();
  const lines = text.split('\n').filter(line => line.trim());

  if (lines.length === 0) {
    return badRequest('CSV file is empty');
  }

  // Parse header
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));

  // Validate required columns
  if (!headers.includes('name')) {
    return badRequest('CSV must include "name" column');
  }

  const imported = [];
  const errors = [];

  // Process data rows
  for (let i = 1; i < lines.length; i++) {
    try {
      const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
      const row: Record<string, any> = {};

      headers.forEach((header, index) => {
        row[header] = values[index] || null;
      });

      // Generate ID if not provided
      if (!row.id) {
        row.id = generateId('itm');
      }

      // Set defaults
      const itemData = {
        id: row.id,
        sku: row.sku || null,
        name: row.name,
        description: row.description || null,
        cost: parseFloat(row.cost) || 0,
        bin_location: row.bin_location || null,
        photos: row.photos || null,
        category: row.category || null,
        status: row.status || 'Unlisted',
        lifecycle_stage: row.lifecycle_stage || 'Captured',
        sold_price: row.sold_price ? parseFloat(row.sold_price) : null,
        sold_date: row.sold_date || null
      };

      await insert(env.DB, 'items', itemData);
      imported.push(itemData.id);
    } catch (error: any) {
      errors.push({ row: i + 1, error: error.message });
    }
  }

  return ok({
    imported: imported.length,
    errors: errors.length,
    errorDetails: errors.slice(0, 10) // Return first 10 errors
  });
});

/**
 * POST /api/import/expenses
 * Import expenses from CSV
 */
router.post('/api/import/expenses', async (request, params, env: Env) => {
  const formData = await request.formData();
  const file = formData.get('file') as File;

  if (!file) {
    return badRequest('No file provided');
  }

  const text = await file.text();
  const lines = text.split('\n').filter(line => line.trim());

  if (lines.length === 0) {
    return badRequest('CSV file is empty');
  }

  // Parse header
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));

  // Validate required columns
  const required = ['name', 'category', 'amount', 'expense_date'];
  const missing = required.filter(r => !headers.includes(r));
  if (missing.length > 0) {
    return badRequest(`CSV must include columns: ${missing.join(', ')}`);
  }

  const imported = [];
  const errors = [];

  // Process data rows
  for (let i = 1; i < lines.length; i++) {
    try {
      const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
      const row: Record<string, any> = {};

      headers.forEach((header, index) => {
        row[header] = values[index] || null;
      });

      // Generate ID if not provided
      if (!row.id) {
        row.id = generateId('exp');
      }

      const amount = parseFloat(row.amount);
      const inventory = parseFloat(row.split_inventory) || 0;
      const operations = parseFloat(row.split_operations) || 0;
      const other = parseFloat(row.split_other) || 0;

      // Auto-split if not provided
      let finalInventory = inventory;
      let finalOperations = operations;
      let finalOther = other;

      if (inventory === 0 && operations === 0 && other === 0) {
        // Default split based on category
        if (row.category === 'Inventory') {
          finalInventory = amount;
        } else {
          finalOperations = amount;
        }
      }

      const expenseData = {
        id: row.id,
        name: row.name,
        category: row.category,
        amount,
        split_inventory: finalInventory,
        split_operations: finalOperations,
        split_other: finalOther,
        receipt_key: row.receipt_key || null,
        vehicle_mileage: row.vehicle_mileage ? parseFloat(row.vehicle_mileage) : null,
        vehicle_actual: row.vehicle_actual ? parseFloat(row.vehicle_actual) : null,
        expense_date: row.expense_date,
        notes: row.notes || null
      };

      await insert(env.DB, 'expenses', expenseData);
      imported.push(expenseData.id);
    } catch (error: any) {
      errors.push({ row: i + 1, error: error.message });
    }
  }

  return ok({
    imported: imported.length,
    errors: errors.length,
    errorDetails: errors.slice(0, 10)
  });
});

/**
 * POST /api/import/chatgpt-items
 * Import items from ChatGPT-generated CSV
 * Accepts CSV with columns: name, description, category, cost, bin_location, sku (optional)
 */
router.post('/api/import/chatgpt-items', async (request, params, env: Env) => {
  const formData = await request.formData();
  const file = formData.get('file') as File;

  if (!file) {
    return badRequest('No file provided');
  }

  const text = await file.text();
  const lines = text.split('\n').filter(line => line.trim());

  if (lines.length === 0) {
    return badRequest('CSV file is empty');
  }

  // Parse header
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));

  // Validate required columns
  if (!headers.includes('name')) {
    return badRequest('CSV must include "name" column');
  }

  const imported = [];
  const errors = [];

  // Process data rows
  for (let i = 1; i < lines.length; i++) {
    try {
      const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
      const row: Record<string, any> = {};

      headers.forEach((header, index) => {
        row[header] = values[index] || null;
      });

      // Create item with ChatGPT data
      const itemData = {
        id: generateId('itm'),
        sku: row.sku || null,
        name: row.name,
        description: row.description || null,
        cost: parseFloat(row.cost) || 0,
        bin_location: row.bin_location || null,
        photos: null,
        category: row.category || null,
        status: 'Unlisted',
        lifecycle_stage: 'Captured',
        sold_price: null,
        sold_date: null,
        ai_suggested_category: null,
        ai_category_confidence: null,
        ebay_listing_id: null,
        ebay_status: null
      };

      await insert(env.DB, 'items', itemData);
      imported.push(itemData.id);
    } catch (error: any) {
      errors.push({ row: i + 1, error: error.message });
    }
  }

  return ok({
    imported: imported.length,
    errors: errors.length,
    errorDetails: errors.slice(0, 10)
  });
});

// ============================================================================
// VALIDATION & UTILITY ENDPOINTS
// ============================================================================

/**
 * GET /api/validate/sku
 * Check if SKU is available
 */
router.get('/api/validate/sku', async (request, params, env: Env) => {
  const query = getQueryParams(request);
  const sku = query.sku;

  if (!sku) {
    return badRequest('SKU parameter required');
  }

  const excludeId = query.exclude_id;

  const isUnique = await validateSKUUnique(env.DB, sku, excludeId);

  return ok({
    sku,
    available: isUnique,
    message: isUnique ? 'SKU is available' : 'SKU already exists'
  });
});

/**
 * GET /api/stats/summary
 * Get summary statistics for charts and dashboards
 */
router.get('/api/stats/summary', async (request, params, env: Env) => {
  const query = getQueryParams(request);
  const period = query.period || 'month'; // month, quarter, year

  let startDate: string;
  const now = new Date();

  if (period === 'month') {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  } else if (period === 'quarter') {
    const quarter = Math.floor(now.getMonth() / 3);
    startDate = new Date(now.getFullYear(), quarter * 3, 1).toISOString().split('T')[0];
  } else {
    startDate = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
  }

  const endDate = now.toISOString().split('T')[0];

  // Sales stats
  const salesStats = await env.DB
    .prepare(`
      SELECT
        COUNT(*) as count,
        SUM(gross_amount) as revenue,
        SUM(profit) as profit,
        AVG(profit) as avg_profit
      FROM sales
      WHERE sale_date >= ? AND sale_date <= ?
    `)
    .bind(startDate, endDate)
    .first();

  // Inventory stats
  const inventoryStats = await env.DB
    .prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'Unlisted' THEN 1 ELSE 0 END) as unlisted,
        SUM(CASE WHEN status = 'Draft' THEN 1 ELSE 0 END) as draft,
        SUM(CASE WHEN status = 'Listed' THEN 1 ELSE 0 END) as listed,
        SUM(CASE WHEN status = 'Sold' THEN 1 ELSE 0 END) as sold,
        SUM(cost) as total_cost
      FROM items
    `)
    .first();

  // Expense stats
  const expenseStats = await env.DB
    .prepare(`
      SELECT
        COUNT(*) as count,
        SUM(amount) as total,
        SUM(split_inventory) as inventory,
        SUM(split_operations) as operations,
        SUM(split_other) as other
      FROM expenses
      WHERE expense_date >= ? AND expense_date <= ?
    `)
    .bind(startDate, endDate)
    .first();

  // Sales by platform
  const platformBreakdown = await env.DB
    .prepare(`
      SELECT
        platform,
        COUNT(*) as count,
        SUM(profit) as profit
      FROM sales
      WHERE sale_date >= ? AND sale_date <= ?
      GROUP BY platform
    `)
    .bind(startDate, endDate)
    .all();

  return ok({
    period,
    start_date: startDate,
    end_date: endDate,
    sales: {
      count: (salesStats as any)?.count || 0,
      revenue: Math.round(((salesStats as any)?.revenue || 0) * 100) / 100,
      profit: Math.round(((salesStats as any)?.profit || 0) * 100) / 100,
      avg_profit: Math.round(((salesStats as any)?.avg_profit || 0) * 100) / 100
    },
    inventory: {
      total: (inventoryStats as any)?.total || 0,
      unlisted: (inventoryStats as any)?.unlisted || 0,
      draft: (inventoryStats as any)?.draft || 0,
      listed: (inventoryStats as any)?.listed || 0,
      sold: (inventoryStats as any)?.sold || 0,
      total_cost: Math.round(((inventoryStats as any)?.total_cost || 0) * 100) / 100
    },
    expenses: {
      count: (expenseStats as any)?.count || 0,
      total: Math.round(((expenseStats as any)?.total || 0) * 100) / 100,
      inventory: Math.round(((expenseStats as any)?.inventory || 0) * 100) / 100,
      operations: Math.round(((expenseStats as any)?.operations || 0) * 100) / 100,
      other: Math.round(((expenseStats as any)?.other || 0) * 100) / 100
    },
    platform_breakdown: platformBreakdown.results || []
  });
});

// ============================================================================
// LEGACY CSV EXPORT (kept for compatibility)
// ============================================================================

router.get('/api/exports/csv', async (request, params, env: Env) => {
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
});

// ============================================================================
// MAIN WORKER
// ============================================================================

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Allow eBay OAuth endpoints without authentication (needed for OAuth callback)
    // Note: /api/debug/env removed from public paths for security - requires authentication
    const publicPaths = ['/api/ebay/auth', '/api/ebay/callback', '/api/ebay/status', '/api/health'];
    const isPublicPath = publicPaths.some(path => url.pathname === path);

    // Fail closed: reject unauthenticated requests (except public paths)
    if (!isPublicPath && !isAuthorized(request)) {
      return unauthorized();
    }

    // Route API requests through router
    if (url.pathname.startsWith("/api/")) {
      return router.handle(request, env, ctx);
    }

    // Serve static assets
    return env.ASSETS.fetch(request);
  }
};
