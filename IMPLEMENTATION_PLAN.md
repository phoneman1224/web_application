# Implementation Plan - eBay Integration Features

**Last Updated:** 2025-12-29
**Status:** In Progress - Paused for continuation tomorrow

---

## ✅ Completed Today

### 1. eBay OAuth Integration ✅
- [x] Created `src/lib/ebay.ts` - Complete OAuth library (293 lines)
- [x] Added 4 API endpoints for OAuth flow
- [x] Created `integrations` table in database
- [x] Frontend Connect/Disconnect button in Settings
- [x] Successfully tested - eBay connected!

### 2. Color Theme System ✅
- [x] Added 5 switchable color themes to CSS
- [x] Created theme selector in Settings
- [x] Implemented theme switching logic
- [x] Themes: Peach (default), Blue, Purple, Teal, Green, Pink
- [x] Deployed and live

### 3. Infrastructure ✅
- [x] GitHub Actions workflow updated for eBay secrets
- [x] Secrets configured: EBAY_APP_ID, EBAY_CERT_ID, EBAY_RU_NAME
- [x] All deployments successful

---

## 🚧 Next: eBay Import & Market Research Features

### Phase 1: Import Features (NEXT SESSION)

#### Backend Work Needed:

**File: `src/lib/ebay.ts`** (add new functions)
- [ ] `fetchEbayListings(db, env)` - Get active listings from eBay Inventory API
- [ ] `fetchEbayOrders(db, env, dateRange)` - Get completed orders from eBay Orders API
- [ ] `mapEbayListingToItem(ebayListing)` - Convert eBay format to our items schema
- [ ] `mapEbayOrderToSale(ebayOrder)` - Convert eBay format to our sales schema
- [ ] `downloadEbayPhoto(photoUrl, env)` - Download photo and upload to R2

**File: `src/worker.ts`** (add new routes)
- [ ] `POST /api/ebay/import-listings` - Import listings endpoint
- [ ] `POST /api/ebay/import-orders` - Import orders endpoint
- [ ] Both routes should return count of imported items

**Database:**
- [ ] Create migration `0004_ebay_import_tables.sql` with:
  - `ebay_listings` cache table
  - `ebay_orders` cache table
  - `sync_history` tracking table

#### Frontend Work Needed:

**File: `public/index.html`**
- [ ] Add "Import from eBay" button to Inventory screen header
- [ ] Add "Import Sales from eBay" button to Sales screen header
- [ ] Add loading spinner for imports

**File: `public/app.js`**
- [ ] `async function importEbayListings()` - Call import API, show progress
- [ ] `async function importEbaySales()` - Call import API, show progress
- [ ] Event listeners for both buttons
- [ ] Success/error toast messages with counts

---

### Phase 2: Market Research Features (AFTER PHASE 1)

#### Backend Work Needed:

**File: `src/lib/ebay.ts`** (add research functions)
- [ ] `searchCompletedListings(query, filters)` - Search sold items on eBay
- [ ] `getCompetitivePricing(keywords)` - Get current market prices
- [ ] `calculateMarketStats(results)` - Average price, range, sell-through rate

**File: `src/worker.ts`** (add research routes)
- [ ] `POST /api/ebay/research/price` - Price research endpoint
- [ ] `POST /api/ebay/research/competition` - Competitive analysis
- [ ] `GET /api/ebay/research/trends` - Market trends

**Database:**
- [ ] Add to migration `0004_ebay_import_tables.sql`:
  - `market_research` cache table (30-day expiry)

#### Frontend Work Needed:

**File: `public/index.html`**
- [ ] Add "Market Research" tab or section
- [ ] Search form (item description, category filters)
- [ ] Results display (table with prices, stats)

**File: `public/app.js`**
- [ ] `async function researchPrice(query)` - Call research API
- [ ] Display results with charts/graphs
- [ ] Save research to cache

---

## 📋 Implementation Order (Tomorrow)

### Session Start:
1. Review this plan
2. Review completed eBay OAuth integration
3. Test color themes are working

### Phase 1A: Backend Import (1 hour)
1. Add eBay listing/order fetch functions to `ebay.ts`
2. Create migration `0004_ebay_import_tables.sql`
3. Add import API routes to `worker.ts`
4. Test with Postman or curl

### Phase 1B: Frontend Import (30 min)
1. Add import buttons to Inventory and Sales screens
2. Add JavaScript functions and event listeners
3. Test end-to-end import flow

### Phase 2A: Backend Research (1 hour)
1. Add market research functions to `ebay.ts`
2. Add research API routes to `worker.ts`
3. Test research endpoints

### Phase 2B: Frontend Research (1 hour)
1. Create market research UI
2. Add search form and results display
3. Test full research flow

### Final Steps:
1. Increment cache version (v=9 → v=10)
2. Commit and deploy
3. Test on production

---

## 🔑 Important Context for Tomorrow

### eBay API Endpoints We'll Use:

**Inventory API (for listings):**
```
GET /sell/inventory/v1/inventory_item
GET /sell/inventory/v1/offer
```

**Orders API (for sales):**
```
GET /sell/fulfillment/v1/order
```

**Browse API (for research):**
```
GET /buy/browse/v1/item_summary/search?q={query}&filter=buyingOptions:{FIXED_PRICE},conditionIds:{1000|1500|2000|2500|3000}
```

### Authentication:
All eBay API calls use `fetchFromEbay(db, env, path, method, body)` which automatically:
- Retrieves OAuth tokens from `integrations` table
- Adds Bearer token to request
- Auto-refreshes expired tokens
- Retries on 401 errors

### Data Mapping:

**eBay Listing → Our Item:**
```javascript
{
  sku: ebayListing.sku,
  name: ebayListing.product.title,
  description: ebayListing.product.description,
  cost: 0, // eBay doesn't provide cost
  photos: ebayListing.product.imageUrls, // Download to R2
  category: ebayListing.product.category,
  status: 'Listed',
  lifecycle_stage: 'Listed'
}
```

**eBay Order → Our Sale:**
```javascript
{
  order_number: ebayOrder.orderId,
  sale_date: ebayOrder.creationDate,
  platform: 'eBay',
  gross_amount: ebayOrder.pricingSummary.total.value,
  platform_fees: calculateEbayFees(order),
  profit: calculateProfit(order)
}
```

---

## 📁 Files Modified Today

```
public/styles.css          (added 5 color themes)
public/index.html          (theme selector, eBay connect button)
public/app.js              (theme switching, eBay OAuth handlers)
src/worker.ts              (eBay OAuth routes)
src/lib/ebay.ts            (NEW - complete OAuth library)
migrations/0003_ebay_integration.sql  (NEW - integrations table)
.github/workflows/deploy.yml  (eBay secret management)
```

---

## 🎯 Success Criteria

When complete, you should be able to:
- [x] Connect eBay account (DONE)
- [x] Switch between 5 color themes (DONE)
- [ ] Click "Import from eBay" and see your listings appear in Inventory
- [ ] Click "Import Sales from eBay" and see completed orders in Sales
- [ ] Search for any item and see real eBay sold prices
- [ ] Get competitive pricing analysis before listing items
- [ ] See market trends for categories you sell in

---

## 🚀 Quick Start Tomorrow

1. Open terminal:
   ```bash
   cd /home/jessica/web_application
   git pull origin main  # Get latest
   ```

2. Reference this file:
   ```bash
   cat IMPLEMENTATION_PLAN.md
   ```

3. Start Claude Code and say:
   > "Continue implementing Phase 1 of the eBay import features from IMPLEMENTATION_PLAN.md"

4. I'll pick up exactly where we left off!

---

**Questions or blockers?** Add them here:
- None yet

**Notes for tomorrow:**
- All eBay OAuth is working
- Color themes deployed and tested
- Database ready for new tables
- Focus on Phase 1A first (backend import functions)
