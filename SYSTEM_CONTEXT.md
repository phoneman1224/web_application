# SYSTEM_CONTEXT.md

**Purpose:** This document serves as the absolute "Source of Truth" for any AI working on this codebase. It prevents refactoring of load-bearing logic and ensures architectural consistency.

**Last Updated:** 2025-12-29
**Project:** Reseller Ops - Cloudflare Workers PWA
**Tech Stack:** TypeScript (backend), Vanilla JS (frontend), Cloudflare D1 (SQLite), Cloudflare R2 (storage)

---

## Section 1: The "No-Go" Zones (Immutable Constraints)

### 1.1 Frontend Hard Constraint

**RULE:** This project uses **Vanilla JS/HTML/CSS only** for the frontend (`public/` directory).

**Why:** The frontend is served **unbundled** directly by Cloudflare Workers Assets binding. No compilation or bundling occurs for frontend code.

**Strictly FORBIDDEN:**
- ❌ React, Vue, Svelte, Angular, or any JS framework
- ❌ Tailwind, Bootstrap, or CSS frameworks
- ❌ Frontend build tools (Webpack, Rollup, esbuild for frontend)
- ❌ npm packages in `public/app.js` (it must run in browser as-is)
- ❌ TypeScript in frontend files
- ❌ JSX, TSX, or any templating syntax

**ALLOWED:**
- ✅ Backend uses TypeScript (`src/worker.ts`) compiled by Wrangler
- ✅ Vite for local development hot-reload (dev-only, not production)
- ✅ Vitest for testing
- ✅ Modern browser APIs (Fetch, LocalStorage, Service Workers)

**Current Frontend Files:**
- `public/index.html` - 817 lines of semantic HTML
- `public/app.js` - 2,352 lines of vanilla JavaScript
- `public/styles.css` - 1,621 lines of responsive CSS
- `public/sw.js` - Service Worker for offline caching
- `public/manifest.webmanifest` - PWA configuration

---

### 1.2 Security Core - Zero Trust Fail-Closed

**CRITICAL:** All API requests MUST pass through authentication checks.

**Authentication Function** (`src/worker.ts:44-58`):
```typescript
function isAuthorized(request: Request): boolean {
  const token = request.headers.get("cf-access-jwt-assertion");
  const identity = request.headers.get("cf-access-authenticated-user-email");
  return Boolean(token && identity);
}
```

**Implementation** (`src/worker.ts:2457`):
```typescript
// Authentication check before routing
if (!isAuthorized(request)) {
  return new Response('Unauthorized', { status: 401 });
}
```

**Security Requirements:**
- ⚠️ **NEVER** bypass `isAuthorized()` checks
- ⚠️ **NEVER** remove fail-closed logic (default deny)
- ⚠️ **NEVER** expose API endpoints without authentication
- ✅ Cloudflare Zero Trust provides headers automatically in production
- ✅ Local development uses fallback header `x-auth-user` (for testing only)

**Headers Required:**
- **Production:** `cf-access-jwt-assertion` + `cf-access-authenticated-user-email`
- **Development:** `x-auth-user` (fallback for local testing)

**Documented in:** `docs/ZERO_TRUST_SETUP.md` (6,281 bytes)

---

### 1.3 Infrastructure Limits - Cloudflare Workers

**Account Type:** PAID Cloudflare Plan
**Account ID:** `cb607d9f4c6359c4bcfc2ad808e4ca8a`

**AI Limits:**
- **Daily Quota:** 10,000 neurons/day
- **Warning Threshold:** 8,000 neurons (80%)
- **Enforcement:** `src/lib/ai-monitor.ts:217` - `canUseAI()` function
- **Storage:** `ai_usage` table tracks daily consumption

**AI Features (7 total):**
1. `generateSEO` - SEO-optimized titles/descriptions
2. `suggestCategory` - Item categorization with confidence scores
3. `suggestPrice` - Price suggestions based on market data
4. `analyzePhoto` - Extract item details from photos
5. `generateInsights` - Business intelligence from sales data
6. `suggestExpenseSplit` - Allocate expenses across items
7. `enhanceDescription` - Improve item descriptions

**Worker Limits:**
- **CPU Time:** 50ms per request (Cloudflare Workers hard limit)
- **Memory:** 128MB per invocation
- **Request Size:** 100MB max
- **Subrequest Limit:** 50 subrequests per request

**D1 Database Limits:**
- **Storage:** 1GB on paid plan
- **Row Limit:** 25 million rows
- **Database Engine:** SQLite 3.x at the edge
- **Binding Name:** `DB`

**R2 Storage:**
- **Binding Name:** `RECEIPTS`
- **Bucket Name:** `reseller-app` (production)
- **Purpose:** Photo storage for inventory items
- **Storage Pattern:** R2 keys stored as JSON arrays in `items.photos` field

---

## Section 2: Critical Business Logic (The "Why")

### 2.1 Tax Logic - Three Distinct Tax Types

**File:** `src/lib/finance.ts:107`

#### Florida Sales Tax (Liability - MUST REMIT)
- **Database Field:** `florida_tax_collected` in `sales` table
- **Purpose:** Sales tax YOU collected from customers
- **Obligation:** Must be remitted to Florida Department of Revenue
- **Calculation:** `calculateFloridaSalesTaxLiability()` in `finance.ts`
- **Example:** Customer pays $107 ($100 item + $7 tax) → You owe Florida $7

#### Federal Tax Estimate (Informational - NOT REMITTED)
- **Database Field:** `federal_tax_estimate` in `sales` table
- **Purpose:** Estimate for income tax planning
- **Obligation:** Informational only (paid quarterly/annually)
- **Calculation:** `calculateFederalTaxEstimate(taxableIncome, effectiveRate)`
- **Example:** $10,000 profit × 22% = $2,200 estimated federal tax

#### eBay Tax (Informational - EBAY REMITS)
- **Database Field:** `ebay_tax_collected` in `sales` table
- **Purpose:** eBay collects and remits this tax on your behalf
- **Obligation:** None (eBay handles remittance)
- **Tracking:** For record-keeping and reconciliation only

**CRITICAL:** Do NOT confuse these three tax types. They have different legal obligations and accounting treatments.

---

### 2.2 AI Fallbacks & Quota Enforcement

**File:** `src/lib/ai-monitor.ts:217`

**Pattern:** ALWAYS check quota before AI calls

```typescript
const canUse = await canUseAI(env.DB);
if (!canUse.allowed) {
  return error(429, canUse.reason);
}
```

**Quota Checking Logic:**
1. Query `ai_usage` table for today's consumption
2. Sum `estimated_neurons` for current day
3. Compare against 10,000 neuron limit
4. Return `{ allowed: boolean, reason?: string }`

**Neuron Costs (Estimated):**
- `generateSEO`: 500 neurons
- `suggestCategory`: 300 neurons
- `suggestPrice`: 400 neurons
- `analyzePhoto`: 800 neurons (highest cost)
- `generateInsights`: 600 neurons
- `suggestExpenseSplit`: 350 neurons
- `enhanceDescription`: 450 neurons

**Cleanup:** Automatically removes ai_usage records older than 90 days

**Error Responses:**
- **429 Too Many Requests:** Quota exceeded
- **503 Service Unavailable:** AI service temporarily unavailable

**Documented in:** `docs/AI_FEATURES.md` (13,714 bytes)

---

### 2.3 Smart Defaults - LocalStorage State

**File:** `public/app.js:2352`

**Purpose:** Remember user inputs to speed up data entry

**Stored Values:**
- **Category** - Last used category for items
- **Location** - Last used bin_location (warehouse organization)
- **Platform** - Last used sales platform (eBay, Shopify, etc.)
- **Fee Profiles** - Default fee percentages for each platform
- **Form State** - Temporary form data during navigation

**Offline Sync:**
- **Mutation Queue Key:** `resellerOpsMutationQueue`
- **Purpose:** Queue API mutations when offline
- **Sync Pattern:** Automatic retry when connection restored
- **Storage Format:** JSON array of pending mutations

**State Management:**
```javascript
const appState = {
  items: [],
  sales: [],
  expenses: [],
  lots: [],
  settings: {},
  selectedDate: null,
  pendingMutations: []
};
```

**CRITICAL:** Do NOT clear localStorage without user consent - it contains unsynced data.

---

### 2.4 Profit Calculation

**File:** `src/lib/finance.ts` - `calculateProfit()` function

**Formula:**
```typescript
grossRevenue = gross_amount
netRevenue = grossRevenue - platformFees - promotionDiscount
profit = netRevenue - costOfGoods - shippingCost
```

**Breakdown:**
1. **Gross Revenue** - Total amount received from customer
2. **Platform Fees** - eBay/Shopify/etc. fees (varies by platform)
3. **Promotion Discount** - Discounts/coupons applied
4. **Net Revenue** - What you actually keep
5. **Cost of Goods** - What you paid for the item
6. **Shipping Cost** - Your shipping expenses
7. **Profit** - Final profit (can be negative)

**Auto-Calculation:** Profit is automatically calculated on sale creation/update and stored in `sales.profit` field.

**Report Usage:** Dashboard, profit reports, and exports all use this calculated field.

---

## Section 3: Architecture & Data Flow

### 3.1 Backend - Custom Router Pattern

**File:** `src/lib/router.ts:272`

**Why Custom Router:** Lightweight regex-based routing without heavy frameworks (Express, Hono, Koa).

**Features:**
- HTTP methods: GET, POST, PUT, DELETE, PATCH
- Path parameter extraction: `/api/items/:id`
- Error handling with `ValidationError` support
- Consistent JSON response format
- Middleware support (authentication, CORS)

**Router Class:**
```typescript
class Router {
  routes: Route[] = [];

  get(path: string, handler: RouteHandler): void
  post(path: string, handler: RouteHandler): void
  put(path: string, handler: RouteHandler): void
  delete(path: string, handler: RouteHandler): void
  patch(path: string, handler: RouteHandler): void

  async handle(request: Request, env: Env): Promise<Response>
}
```

**54+ API Endpoints Across 14 Categories:**

1. **Items CRUD** (5 endpoints)
   - `GET /api/items` - List all items
   - `GET /api/items/:id` - Get single item
   - `POST /api/items` - Create item
   - `PUT /api/items/:id` - Update item
   - `DELETE /api/items/:id` - Delete item

2. **Sales CRUD** (5 endpoints)
   - `GET /api/sales` - List all sales
   - `GET /api/sales/:id` - Get single sale
   - `POST /api/sales` - Create sale
   - `PUT /api/sales/:id` - Update sale
   - `DELETE /api/sales/:id` - Delete sale

3. **Expenses CRUD** (5 endpoints)
   - `GET /api/expenses` - List all expenses
   - `GET /api/expenses/:id` - Get single expense
   - `POST /api/expenses` - Create expense
   - `PUT /api/expenses/:id` - Update expense
   - `DELETE /api/expenses/:id` - Delete expense

4. **Lots CRUD** (5 endpoints)
   - `GET /api/lots` - List all lots
   - `GET /api/lots/:id` - Get single lot
   - `POST /api/lots` - Create lot
   - `PUT /api/lots/:id` - Update lot
   - `DELETE /api/lots/:id` - Delete lot

5. **Pricing Drafts** (6 endpoints)
   - `GET /api/pricing-drafts` - List drafts
   - `GET /api/pricing-drafts/:id` - Get single draft
   - `POST /api/pricing-drafts` - Create draft
   - `PUT /api/pricing-drafts/:id` - Update draft
   - `DELETE /api/pricing-drafts/:id` - Delete draft
   - `POST /api/pricing-drafts/:id/apply` - Apply pricing to item

6. **Settings** (3 endpoints)
   - `GET /api/settings` - Get all settings
   - `GET /api/settings/:key` - Get single setting
   - `PUT /api/settings/:key` - Update setting

7. **Reports** (4 endpoints)
   - `GET /api/reports/profit-by-category` - Category breakdown
   - `GET /api/reports/sales-by-platform` - Platform breakdown
   - `GET /api/reports/inventory-summary` - Inventory status
   - `GET /api/reports/tax-summary` - Tax liability report

8. **Exports** (5 endpoints)
   - `GET /api/exports/items` - Export items as CSV
   - `GET /api/exports/sales` - Export sales as CSV
   - `GET /api/exports/expenses` - Export expenses as CSV
   - `GET /api/exports/profit-loss` - P&L statement CSV
   - `GET /api/exports/tax-report` - Tax report CSV

9. **Photos** (3 endpoints)
   - `POST /api/photos/upload` - Upload photo to R2
   - `GET /api/photos/:key` - Retrieve photo from R2
   - `DELETE /api/photos/:key` - Delete photo from R2

10. **AI Features** (8 endpoints)
    - `POST /api/ai/generate-seo` - Generate SEO content
    - `POST /api/ai/suggest-category` - Suggest item category
    - `POST /api/ai/suggest-price` - Suggest item price
    - `POST /api/ai/analyze-photo` - Extract details from photo
    - `POST /api/ai/generate-insights` - Business insights
    - `POST /api/ai/suggest-expense-split` - Allocate expenses
    - `POST /api/ai/enhance-description` - Improve descriptions
    - `GET /api/ai/usage` - Get AI usage stats

11. **Backup/Restore** (2 endpoints)
    - `GET /api/backup` - Export full database as JSON
    - `POST /api/restore` - Restore database from JSON

12. **Import** (2 endpoints)
    - `POST /api/import/items` - Bulk import items from CSV
    - `POST /api/import/sales` - Bulk import sales from CSV

13. **Validation** (1 endpoint)
    - `POST /api/validate/fee-profile` - Validate fee profile structure

14. **Stats** (1 endpoint)
    - `GET /api/stats/dashboard` - Dashboard summary statistics

**Documented in:** `docs/API.md` (18,787 bytes)

---

### 3.2 Database - Cloudflare D1 (SQLite)

**Binding Name:** `DB`
**Migration File:** `migrations/0002_comprehensive_schema.sql`

**9 Core Tables:**

#### 1. `fee_profiles` - Platform Fee Configurations
```sql
CREATE TABLE fee_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  platform TEXT NOT NULL UNIQUE,
  percentage REAL NOT NULL
);
```
**Pre-populated Defaults:**
- eBay: 13.25%
- Shopify: 2.9%
- Facebook: 5%
- Mercari: 12.9%
- Poshmark: 20%

---

#### 2. `items` - Core Inventory Management
```sql
CREATE TABLE items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sku TEXT UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  cost REAL NOT NULL,
  bin_location TEXT,
  photos TEXT,  -- JSON array of R2 keys
  category TEXT,
  status TEXT DEFAULT 'Unlisted',
  lifecycle_stage TEXT DEFAULT 'New',
  sold_price REAL,
  sold_date TEXT,
  ai_suggested_category TEXT,
  ai_category_confidence REAL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
```

**Status Enum:** 'Unlisted', 'Draft', 'Listed', 'Sold'
**Lifecycle Enum:** 'New', 'In Stock', 'Listed', 'Sold', 'Archived'

**Indexes:**
```sql
CREATE INDEX idx_items_status ON items(status);
CREATE INDEX idx_items_lifecycle ON items(lifecycle_stage);
CREATE INDEX idx_items_category ON items(category);
CREATE INDEX idx_items_sku ON items(sku);
CREATE INDEX idx_items_created ON items(created_at);
```

---

#### 3. `sales` - Revenue Tracking with Auto-Calculated Profit
```sql
CREATE TABLE sales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_number TEXT,
  sale_date TEXT NOT NULL,
  platform TEXT NOT NULL,
  gross_amount REAL NOT NULL,
  platform_fees REAL DEFAULT 0,
  promotion_discount REAL DEFAULT 0,
  shipping_cost REAL DEFAULT 0,
  profit REAL,  -- Auto-calculated
  florida_tax_collected REAL DEFAULT 0,
  ebay_tax_collected REAL DEFAULT 0,
  federal_tax_estimate REAL DEFAULT 0,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
```

**Indexes:**
```sql
CREATE INDEX idx_sales_date ON sales(sale_date);
CREATE INDEX idx_sales_platform ON sales(platform);
CREATE INDEX idx_sales_order ON sales(order_number);
CREATE INDEX idx_sales_created ON sales(created_at);
```

---

#### 4. `sale_items` - Junction Table (Many-to-Many)
```sql
CREATE TABLE sale_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id INTEGER NOT NULL,
  item_id INTEGER NOT NULL,
  quantity INTEGER DEFAULT 1,
  FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
  FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
);
```

---

#### 5. `expenses` - Expense Tracking with Split Allocation
```sql
CREATE TABLE expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  category TEXT NOT NULL,
  amount REAL NOT NULL,
  description TEXT,
  split_allocation TEXT,  -- JSON: {item_id: percentage}
  receipt_url TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
```

**Split Allocation Example:**
```json
{
  "item_123": 50,
  "item_456": 30,
  "item_789": 20
}
```
Percentages must sum to 100%.

**Indexes:**
```sql
CREATE INDEX idx_expenses_date ON expenses(date);
CREATE INDEX idx_expenses_category ON expenses(category);
CREATE INDEX idx_expenses_created ON expenses(created_at);
```

---

#### 6. `lots` - Bundled Items with Suggested Pricing
```sql
CREATE TABLE lots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  items TEXT NOT NULL,  -- JSON array of item IDs
  total_cost REAL NOT NULL,
  suggested_price REAL,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
```

---

#### 7. `pricing_drafts` - AI-Suggested Pricing
```sql
CREATE TABLE pricing_drafts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER NOT NULL,
  suggested_price REAL NOT NULL,
  confidence_score REAL,
  reasoning TEXT,
  applied BOOLEAN DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
);
```

**Index:**
```sql
CREATE INDEX idx_pricing_drafts_item ON pricing_drafts(item_id);
```

---

#### 8. `ai_usage` - Daily AI Neuron Consumption Tracking
```sql
CREATE TABLE ai_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  endpoint TEXT NOT NULL,
  estimated_neurons INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
```

**Index:**
```sql
CREATE INDEX idx_ai_usage_created ON ai_usage(created_at);
```

**Cleanup:** Records older than 90 days are automatically deleted.

---

#### 9. `settings` - Key-Value Configuration Store
```sql
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT DEFAULT (datetime('now'))
);
```

**Common Settings:**
- `default_tax_rate` - Florida sales tax rate (e.g., "7.0")
- `federal_tax_rate` - Estimated federal tax rate (e.g., "22.0")
- `business_name` - Legal business name
- `notification_email` - Alert email address

---

### 3.3 Storage - R2 Integration

**Binding:** `RECEIPTS` (R2Bucket)
**Bucket Name:** `reseller-app` (production)

**Pattern:**
1. Upload photo to R2 → Returns unique key
2. Store key in `items.photos` JSON array
3. Retrieve photo by key from R2
4. Delete from R2 when item deleted

**Example Photo Array in `items.photos`:**
```json
["photo_abc123.jpg", "photo_def456.jpg"]
```

**API Endpoints:**
- `POST /api/photos/upload` - Upload to R2, returns key
- `GET /api/photos/:key` - Retrieve from R2 (returns image bytes)
- `DELETE /api/photos/:key` - Delete from R2

**R2 Operations:**
```typescript
// Upload
await env.RECEIPTS.put(key, imageBytes, {
  httpMetadata: { contentType: 'image/jpeg' }
});

// Retrieve
const object = await env.RECEIPTS.get(key);
const bytes = await object.arrayBuffer();

// Delete
await env.RECEIPTS.delete(key);
```

---

### 3.4 Frontend - PWA with Offline Support

**Service Worker:** `public/sw.js`
**Manifest:** `public/manifest.webmanifest`
**State Management:** `public/app.js:2352`

**PWA Features:**
- **App Shell Caching** - HTML, CSS, JS cached for offline use
- **Installable** - Can be installed as standalone app
- **Offline-First** - Works without internet connection
- **Background Sync** - Syncs mutations when connection restored

**State Management Pattern:**
```javascript
const appState = {
  items: [],           // In-memory item cache
  sales: [],           // In-memory sales cache
  expenses: [],        // In-memory expenses cache
  lots: [],            // In-memory lots cache
  settings: {},        // Settings cache
  selectedDate: null,  // Date filter for reports
  pendingMutations: [] // Offline mutation queue
};
```

**Offline Sync:**
1. User performs action (create/update/delete)
2. If offline: Add to `resellerOpsMutationQueue` in localStorage
3. If online: Execute immediately via Fetch API
4. Service worker detects connection: Replay queued mutations
5. Clear queue after successful sync

**Cache Version:** `v=7` (in `index.html`)
Incrementing this version forces browser to re-download assets.

**Documented in:** `docs/UX_FEATURES.md` (15,148 bytes)

---

## Section 4: Operational "Quirks"

### 4.1 Zero Trust Headers - Local Development

**Production Environment:**
- Cloudflare Zero Trust automatically injects headers
- `cf-access-jwt-assertion`: JWT token
- `cf-access-authenticated-user-email`: User email
- No manual configuration needed

**Local Development:**
- Zero Trust headers NOT present
- Fallback header: `x-auth-user` (e.g., `test@example.com`)
- Set manually in HTTP requests during local testing

**Example Local Request:**
```bash
curl -H "x-auth-user: jessica@example.com" \
     http://localhost:8787/api/items
```

**CRITICAL:** Do NOT use `x-auth-user` in production. It's a development-only fallback.

**Documented in:** `docs/ZERO_TRUST_SETUP.md`

---

### 4.2 Date Handling - ISO 8601 UTC

**Storage Format:** All dates stored as ISO 8601 strings in UTC
```
2024-01-15T18:30:00.000Z
```

**JavaScript Conversion:**
```javascript
// Parse UTC string to local time
const date = new Date("2024-01-15T18:30:00.000Z");
const localString = date.toLocaleDateString(); // "1/15/2024" (US locale)
const localTime = date.toLocaleTimeString();   // "1:30:00 PM" (US locale)
```

**SQL Queries:**
```sql
-- Filter by date range
WHERE DATE(sale_date) BETWEEN '2024-01-01' AND '2024-01-31'

-- Group by date
GROUP BY DATE(sale_date)

-- Sort by date
ORDER BY created_at DESC
```

**CRITICAL:** Always use UTC for storage, convert to local timezone only for display.

---

### 4.3 Validation Pattern

**File:** `src/lib/validation.ts:170+`

**Pattern:** Validate BEFORE database operations to prevent invalid data.

**Validation Functions:**
```typescript
validateRequired(data, ['name', 'amount']);      // Check required fields
validatePositive(data, ['cost', 'price']);       // Must be > 0
validateEnum(data.status, ['Draft', 'Listed']); // Must be in allowed list
validateEmail(data.email);                       // Valid email format
validateDateRange(startDate, endDate);           // Start before end
validatePercentage(data.tax_rate);               // Between 0-100
```

**Custom Error Class:**
```typescript
class ValidationError extends Error {
  constructor(
    public message: string,
    public details: Record<string, string> = {}
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}
```

**Usage Example:**
```typescript
try {
  validateRequired(data, ['name', 'cost']);
  validatePositive(data, ['cost']);

  // Proceed with database operation
  await env.DB.prepare("INSERT INTO items...").bind(...).run();

} catch (error) {
  if (error instanceof ValidationError) {
    return error(400, error.message, error.details);
  }
  throw error;
}
```

---

### 4.4 Error Response Format

**Consistent JSON Structure:**

**Success Response:**
```json
{
  "success": true,
  "data": { ... }
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Human-readable error message",
  "details": {
    "field_name": "Field-specific error"
  }
}
```

**HTTP Status Codes:**
- **200 OK** - Successful GET/PUT/DELETE
- **201 Created** - Successful POST
- **400 Bad Request** - Validation error
- **401 Unauthorized** - Missing/invalid authentication
- **404 Not Found** - Resource doesn't exist
- **429 Too Many Requests** - AI quota exceeded
- **500 Internal Server Error** - Unexpected error

**Example Validation Error:**
```json
{
  "success": false,
  "error": "Validation failed",
  "details": {
    "cost": "Must be a positive number",
    "category": "Required field"
  }
}
```

---

## Section 5: Future AI Instruction Set

### Pre-Flight Checklist

Before writing ANY code, the AI MUST verify:

#### 1. Runtime Compatibility
- ✅ Does this solution work within Cloudflare Workers runtime?
- ✅ No Node.js-specific APIs (fs, path, crypto.createHash)?
- ✅ Uses Web Standard APIs (fetch, crypto.subtle, etc.)?
- ✅ Respects 50ms CPU time limit per request?
- ✅ Fits within 128MB memory limit?

#### 2. Frontend Constraints
- ✅ Is frontend code pure Vanilla JS/HTML/CSS?
- ✅ Does it run in browser without build step?
- ✅ No npm imports in `public/app.js`?
- ✅ No JSX, TSX, or framework syntax?
- ✅ Compatible with modern browsers (Chrome, Firefox, Safari)?

#### 3. Backend Build
- ✅ Is TypeScript used ONLY in `src/` directory?
- ✅ Is Wrangler handling the compilation/bundling?
- ✅ No frontend TypeScript files?

#### 4. Database Operations
- ✅ Using D1 database (SQLite syntax)?
- ✅ Proper indexes for query performance?
- ✅ Foreign keys maintained for data integrity?
- ✅ Transactions used for multi-table operations?
- ✅ Parameterized queries to prevent SQL injection?

#### 5. AI Usage
- ✅ Quota checked before AI call (`canUseAI()`)?
- ✅ Estimated neuron cost documented?
- ✅ Fallback behavior if quota exceeded?
- ✅ Usage tracked in `ai_usage` table?

#### 6. Authentication
- ✅ API endpoint protected by `isAuthorized()` check?
- ✅ No bypass of Zero Trust authentication?
- ✅ Proper 401 response for unauthenticated requests?

#### 7. Testing
- ✅ Can this be tested with Vitest?
- ✅ Cloudflare-specific bindings mocked properly?
- ✅ Edge cases covered?

#### 8. Performance
- ✅ Avoid N+1 query problems?
- ✅ Use indexes for filtered/sorted queries?
- ✅ Minimize subrequest count (max 50)?
- ✅ Cache expensive computations?

---

### Rejection Criteria (AUTO-REJECT if ANY of these)

The AI MUST reject proposals that:

- ❌ Introduce React, Vue, Svelte, Angular, or any frontend framework
- ❌ Add frontend build step (Webpack, Rollup, esbuild for frontend)
- ❌ Use Node.js APIs (fs, path, crypto.createHash, Buffer)
- ❌ Bypass authentication checks or remove `isAuthorized()`
- ❌ Exceed AI quota without checking `canUseAI()` first
- ❌ Use Express, Koa, Fastify, or any server framework
- ❌ Break existing foreign key relationships
- ❌ Remove fail-closed security logic
- ❌ Store sensitive data in localStorage (passwords, tokens, PII)
- ❌ Use synchronous blocking APIs that exceed CPU time limit
- ❌ Hard-code credentials or API keys in code
- ❌ Disable CORS or security headers without justification
- ❌ Use `eval()` or `Function()` constructor
- ❌ Violate Cloudflare Workers runtime constraints

---

### Verification Commands

Before submitting a PR, run:

```bash
# TypeScript compilation check
npm run check

# Run all tests
npm test

# Local development server
npm run dev

# Deploy to production (after approval)
npm run deploy
```

---

## Section 6: File Organization Reference

### Quick Directory Map

```
/home/jessica/web_application/
├── src/                           # Backend (TypeScript)
│   ├── worker.ts                  # 2,471 lines - Main entry point
│   │                              # Lines 44-58: isAuthorized()
│   │                              # Line 2457: Authentication check
│   └── lib/
│       ├── router.ts              # 272 lines - Custom router
│       ├── db.ts                  # 353 lines - D1 helpers
│       ├── ai.ts                  # 493 lines - 7 AI features
│       ├── ai-monitor.ts          # 217 lines - Quota tracking
│       ├── validation.ts          # 170+ lines - Input validation
│       └── finance.ts             # 107 lines - Profit/tax calculations
│
├── public/                        # Frontend (Vanilla JS/HTML/CSS)
│   ├── index.html                 # 817 lines - Semantic HTML
│   ├── app.js                     # 2,352 lines - State management
│   ├── styles.css                 # 1,621 lines - Responsive CSS
│   ├── sw.js                      # Service Worker (offline caching)
│   └── manifest.webmanifest       # PWA configuration
│
├── migrations/                    # Database schema
│   └── 0002_comprehensive_schema.sql  # 9 tables with indexes
│
├── docs/                          # Documentation
│   ├── API.md                     # 18,787 bytes - 54+ endpoints
│   ├── AI_FEATURES.md             # 13,714 bytes - 7 AI features
│   ├── UX_FEATURES.md             # 15,148 bytes - Frontend features
│   └── ZERO_TRUST_SETUP.md        # 6,281 bytes - Auth setup
│
├── tests/                         # Vitest test suite (123+ tests)
│   ├── router.test.ts
│   ├── finance.test.ts
│   ├── validation.test.ts
│   └── ai-monitor.test.ts
│
├── scripts/                       # Automation scripts
│   ├── provision.sh               # Create D1 database + R2 bucket
│   └── generate-wrangler-config.mjs  # Generate wrangler.toml
│
├── wrangler.toml                  # Development configuration
├── wrangler.generated.toml        # Production configuration (auto-generated)
├── package.json                   # Dependencies + scripts
├── tsconfig.json                  # TypeScript configuration
├── vite.config.ts                 # Vite dev server config
└── vitest.config.ts               # Vitest test config
```

---

### Key File Purposes

**Backend Entry Point:**
- `src/worker.ts` - Handles all HTTP requests, authentication, routing

**Core Libraries:**
- `src/lib/router.ts` - Regex-based routing (no Express)
- `src/lib/db.ts` - D1 database query helpers
- `src/lib/ai.ts` - 7 AI features (SEO, categorization, pricing, etc.)
- `src/lib/ai-monitor.ts` - Quota enforcement (10,000 neurons/day)
- `src/lib/validation.ts` - Input validation before DB operations
- `src/lib/finance.ts` - Profit and tax calculations

**Frontend:**
- `public/index.html` - Single-page app shell
- `public/app.js` - State management, API calls, offline sync
- `public/styles.css` - Responsive design with CSS variables
- `public/sw.js` - Service Worker for offline caching
- `public/manifest.webmanifest` - PWA installation metadata

**Database:**
- `migrations/0002_comprehensive_schema.sql` - Schema with 9 tables
- Uses Cloudflare D1 (SQLite at the edge)

**Configuration:**
- `wrangler.generated.toml` - Production config (DO NOT EDIT MANUALLY)
- `wrangler.toml` - Development config
- Generated by `scripts/generate-wrangler-config.mjs`

**Documentation:**
- `docs/API.md` - Complete API reference for 54+ endpoints
- `docs/AI_FEATURES.md` - AI feature documentation
- `docs/UX_FEATURES.md` - Frontend patterns and features
- `docs/ZERO_TRUST_SETUP.md` - Authentication setup guide

---

## Summary

This document serves as the **immutable source of truth** for the Reseller Ops codebase. Any AI working on this project MUST:

1. ✅ **Preserve** Vanilla JS frontend (no frameworks)
2. ✅ **Maintain** Zero Trust fail-closed security
3. ✅ **Respect** AI quota limits (10,000 neurons/day)
4. ✅ **Follow** custom router pattern (no Express)
5. ✅ **Validate** inputs before database operations
6. ✅ **Use** TypeScript only for backend (`src/`)
7. ✅ **Document** all changes in relevant docs
8. ✅ **Test** with Vitest before deployment

**Questions?** Refer to:
- `docs/API.md` for endpoint details
- `docs/AI_FEATURES.md` for AI integration
- `docs/ZERO_TRUST_SETUP.md` for authentication
- This file for architectural constraints

**Last Updated:** 2025-12-29
**Maintained By:** Principal Software Architect (AI-assisted)
