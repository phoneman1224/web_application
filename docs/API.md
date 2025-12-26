# Reseller Ops API Documentation

Complete REST API reference for the Reseller Ops application.

**Base URL:** `https://app.reseller.example.com`
**Authentication:** Cloudflare Zero Trust (automatic via browser session)

---

## Table of Contents

- [Items API](#items-api)
- [Sales API](#sales-api)
- [Expenses API](#expenses-api)
- [Lots API](#lots-api)
- [Pricing Drafts API](#pricing-drafts-api)
- [Settings API](#settings-api)
- [Reports API](#reports-api)
- [Export API](#export-api)
- [Photos API](#photos-api)
- [AI API](#ai-api)
- [Backup & Restore API](#backup--restore-api)
- [Import API](#import-api)
- [Validation API](#validation-api)
- [Statistics API](#statistics-api)

---

## Items API

Manage inventory items through their lifecycle: Acquired → In Stock → Listed → Sold

### List Items

```http
GET /api/items
```

**Query Parameters:**
- `status` - Filter by status (optional): `In Stock`, `Listed`, `Sold`, etc.
- `lifecycle` - Filter by lifecycle stage (optional)
- `category` - Filter by category (optional)

**Response:**
```json
[
  {
    "id": "item-123",
    "sku": "SONY-WM-001",
    "name": "Vintage Sony Walkman WM-10",
    "description": "Rare cassette player in excellent condition",
    "cost": 45.00,
    "bin_location": "A2",
    "photos": ["photo-key-1.jpg", "photo-key-2.jpg"],
    "category": "Electronics",
    "status": "In Stock",
    "lifecycle_stage": "Acquired",
    "sold_price": null,
    "sold_date": null,
    "created_at": "2025-12-26T10:00:00Z",
    "updated_at": "2025-12-26T10:00:00Z"
  }
]
```

### Get Item

```http
GET /api/items/:id
```

**Response:** Single item object (same structure as list)

### Create Item

```http
POST /api/items
```

**Request Body:**
```json
{
  "name": "Vintage Sony Walkman WM-10",
  "sku": "SONY-WM-001",
  "cost": 45.00,
  "description": "Rare cassette player",
  "bin_location": "A2",
  "category": "Electronics",
  "status": "In Stock"
}
```

**Notes:**
- Only `name` is required
- `sku` must be unique if provided
- `cost` defaults to 0 if not provided

**Response:** Created item object with generated `id`

### Update Item

```http
PUT /api/items/:id
```

**Request Body:** Same as create (partial updates supported)

**Response:** Updated item object

### Delete Item

```http
DELETE /api/items/:id
```

**Response:**
```json
{
  "success": true,
  "message": "Item deleted"
}
```

---

## Sales API

Record sales with one or more items, platform fees, and tax handling.

### List Sales

```http
GET /api/sales
```

**Query Parameters:**
- `start_date` - Filter sales after this date (ISO 8601)
- `end_date` - Filter sales before this date (ISO 8601)
- `platform` - Filter by platform: `eBay`, `Shopify`, `Facebook`, etc.

**Response:**
```json
[
  {
    "id": "sale-456",
    "order_number": "ORD-2025-001",
    "platform": "eBay",
    "gross_amount": 125.00,
    "platform_fees": 15.00,
    "promotion_discount": 5.00,
    "shipping_cost": 10.00,
    "cost_of_goods": 45.00,
    "florida_tax_collected": 0.00,
    "ebay_tax_collected": 8.75,
    "federal_tax_estimate": 11.00,
    "profit": 50.00,
    "sale_date": "2025-12-20",
    "created_at": "2025-12-20T14:30:00Z",
    "items": [
      {
        "item_id": "item-123",
        "quantity": 1
      }
    ]
  }
]
```

### Get Sale

```http
GET /api/sales/:id
```

**Response:** Single sale object with items array

### Create Sale

```http
POST /api/sales
```

**Request Body:**
```json
{
  "order_number": "ORD-2025-001",
  "platform": "eBay",
  "gross_amount": 125.00,
  "platform_fees": 15.00,
  "promotion_discount": 5.00,
  "shipping_cost": 10.00,
  "florida_tax_collected": 0.00,
  "ebay_tax_collected": 8.75,
  "sale_date": "2025-12-20",
  "items": [
    {
      "item_id": "item-123",
      "quantity": 1
    }
  ]
}
```

**Auto-Calculated Fields:**
- `cost_of_goods` - Sum of item costs
- `profit` - Gross - fees - costs - shipping
- `federal_tax_estimate` - Based on profit and tax rate setting

**Notes:**
- `items` array must contain at least one item
- Platform-specific tax handling:
  - **eBay:** `ebay_tax_collected` is informational (eBay remits)
  - **Other platforms:** `florida_tax_collected` is your liability

**Response:** Created sale object with calculated fields

### Update Sale

```http
PUT /api/sales/:id
```

**Request Body:** Same as create (partial updates supported)

**Response:** Updated sale object

### Delete Sale

```http
DELETE /api/sales/:id
```

**Notes:** Cascade deletes `sale_items` junction records

**Response:**
```json
{
  "success": true,
  "message": "Sale deleted"
}
```

---

## Expenses API

Track business expenses with split allocation across inventory, operations, and other categories.

### List Expenses

```http
GET /api/expenses
```

**Query Parameters:**
- `start_date` - Filter by date range
- `end_date` - Filter by date range
- `category` - Filter by category

**Response:**
```json
[
  {
    "id": "exp-789",
    "name": "Storage unit rental",
    "category": "Storage",
    "amount": 100.00,
    "split_inventory": 70.00,
    "split_operations": 20.00,
    "split_other": 10.00,
    "receipt_key": "receipt-123.pdf",
    "vehicle_mileage": null,
    "vehicle_actual": null,
    "expense_date": "2025-12-01",
    "created_at": "2025-12-01T09:00:00Z"
  }
]
```

### Get Expense

```http
GET /api/expenses/:id
```

**Response:** Single expense object

### Create Expense

```http
POST /api/expenses
```

**Request Body:**
```json
{
  "name": "Storage unit rental",
  "category": "Storage",
  "amount": 100.00,
  "split_inventory": 70.00,
  "split_operations": 20.00,
  "split_other": 10.00,
  "expense_date": "2025-12-01"
}
```

**Validation:**
- Splits must sum to `amount` (±$0.01 tolerance)
- `vehicle_mileage` and `vehicle_actual` are mutually exclusive

**Response:** Created expense object

### Update Expense

```http
PUT /api/expenses/:id
```

**Request Body:** Same as create

**Response:** Updated expense object

### Delete Expense

```http
DELETE /api/expenses/:id
```

**Response:**
```json
{
  "success": true,
  "message": "Expense deleted"
}
```

---

## Lots API

Group multiple items into lots for bundled pricing and listing.

### List Lots

```http
GET /api/lots
```

**Response:**
```json
[
  {
    "id": "lot-101",
    "name": "Vintage Electronics Bundle",
    "notes": "3 items from estate sale",
    "total_cost": 120.00,
    "created_at": "2025-12-15T08:00:00Z",
    "items": [
      {
        "item_id": "item-123",
        "quantity": 1
      },
      {
        "item_id": "item-124",
        "quantity": 2
      }
    ]
  }
]
```

### Get Lot

```http
GET /api/lots/:id
```

**Response:** Single lot object with `total_cost` calculated from items

### Create Lot

```http
POST /api/lots
```

**Request Body:**
```json
{
  "name": "Vintage Electronics Bundle",
  "notes": "3 items from estate sale",
  "items": [
    {
      "item_id": "item-123",
      "quantity": 1
    },
    {
      "item_id": "item-124",
      "quantity": 2
    }
  ]
}
```

**Notes:**
- `total_cost` is auto-calculated from item costs
- Lots are wrappers only - no pricing stored on lot

**Response:** Created lot object

### Update Lot

```http
PUT /api/lots/:id
```

**Request Body:** Same as create

**Response:** Updated lot object

### Delete Lot

```http
DELETE /api/lots/:id
```

**Notes:** Cascade deletes `lot_items` junction records

**Response:**
```json
{
  "success": true,
  "message": "Lot deleted"
}
```

---

## Pricing Drafts API

Create pricing suggestions for items or lots with AI-generated SEO and confidence scores.

### List Pricing Drafts

```http
GET /api/pricing-drafts
```

**Query Parameters:**
- `item_id` - Filter by item
- `lot_id` - Filter by lot

**Response:**
```json
[
  {
    "id": "draft-202",
    "item_id": "item-123",
    "lot_id": null,
    "suggested_price": 75.00,
    "seo_title": "Vintage Sony Walkman WM-10 Cassette Player - Tested & Working",
    "seo_description": "Rare vintage Sony Walkman in excellent condition...",
    "confidence_score": 0.85,
    "created_at": "2025-12-26T12:00:00Z"
  }
]
```

### Get Pricing Draft

```http
GET /api/pricing-drafts/:id
```

**Response:** Single pricing draft object

### Create Pricing Draft

```http
POST /api/pricing-drafts
```

**Request Body:**
```json
{
  "item_id": "item-123",
  "suggested_price": 75.00,
  "seo_title": "Vintage Sony Walkman WM-10...",
  "seo_description": "Rare vintage Sony Walkman...",
  "confidence_score": 0.85
}
```

**Validation:**
- Must provide either `item_id` OR `lot_id` (not both)
- `confidence_score` must be between 0 and 1

**Response:** Created pricing draft object

### Update Pricing Draft

```http
PUT /api/pricing-drafts/:id
```

**Request Body:** Same as create

**Response:** Updated pricing draft object

### Apply Pricing Draft

```http
POST /api/pricing-drafts/:id/apply
```

**Effect:**
- Updates associated item/lot status to `Listed`
- Pricing draft is NOT deleted (for record keeping)

**Response:**
```json
{
  "success": true,
  "message": "Pricing applied to item"
}
```

### Delete Pricing Draft

```http
DELETE /api/pricing-drafts/:id
```

**Response:**
```json
{
  "success": true,
  "message": "Pricing draft deleted"
}
```

---

## Settings API

Manage application settings (tax rates, fee profiles, etc.)

### Get All Settings

```http
GET /api/settings
```

**Response:**
```json
{
  "federal_tax_rate": "0.22",
  "florida_sales_tax_rate": "0.07",
  "default_fee_profile": "eBay"
}
```

### Get Setting

```http
GET /api/settings/:key
```

**Response:**
```json
{
  "key": "federal_tax_rate",
  "value": "0.22",
  "updated_at": "2025-12-26T10:00:00Z"
}
```

### Update Setting

```http
PUT /api/settings/:key
```

**Request Body:**
```json
{
  "value": "0.24"
}
```

**Response:** Updated setting object

---

## Reports API

Generate business intelligence reports.

### Dashboard Report

```http
GET /api/reports/dashboard
```

**Response:**
```json
{
  "mtd_profit": 1250.75,
  "tax_liability": 127.50,
  "ready_drafts": 15,
  "next_actions": [
    "5 items need pricing",
    "3 sales need recording"
  ]
}
```

### Profit & Loss Report

```http
GET /api/reports/profit-loss
```

**Query Parameters:**
- `period` - `month`, `quarter`, `year`, or `all-time`

**Response:**
```json
{
  "period": "month",
  "revenue": 5000.00,
  "cost_of_goods": 2000.00,
  "expenses": 500.00,
  "profit": 2500.00,
  "profit_margin": 0.50
}
```

### Tax Summary Report

```http
GET /api/reports/tax-summary
```

**Response:**
```json
{
  "federal_tax_estimate": 550.00,
  "federal_tax_breakdown": {
    "taxable_income": 2500.00,
    "tax_rate": 0.22,
    "estimated_tax": 550.00
  }
}
```

### Florida Sales Tax Report

```http
GET /api/reports/florida-sales-tax
```

**Response:**
```json
{
  "total_liability": 127.50,
  "by_platform": {
    "Shopify": 75.25,
    "Facebook": 52.25,
    "eBay": 0.00
  }
}
```

---

## Export API

Export data in CSV or JSON format.

### Export Items CSV

```http
GET /api/exports/items-csv
```

**Response:** CSV file with all items

### Export Sales CSV

```http
GET /api/exports/sales-csv
```

**Response:** CSV file with all sales

### Export Expenses CSV

```http
GET /api/exports/expenses-csv
```

**Response:** CSV file with all expenses

### Export Tax Year JSON

```http
GET /api/exports/tax-year
```

**Query Parameters:**
- `year` - Tax year (default: current year)

**Response:** Complete JSON export of all data for the year

---

## Photos API

Upload and manage photos stored in Cloudflare R2.

### Upload Photo

```http
POST /api/photos/upload
```

**Request:** `multipart/form-data` with `photo` field

**Response:**
```json
{
  "key": "photo-abc123.jpg",
  "url": "/api/photos/photo-abc123.jpg"
}
```

### Get Photo

```http
GET /api/photos/:key
```

**Response:** Image file (JPEG, PNG, etc.) with caching headers

### Delete Photo

```http
DELETE /api/photos/:key
```

**Response:**
```json
{
  "success": true,
  "message": "Photo deleted"
}
```

---

## AI API

AI-powered features using Cloudflare Workers AI.

### Generate SEO

```http
POST /api/ai/generate-seo
```

**Request Body:**
```json
{
  "item_id": "item-123"
}
```

**Response:**
```json
{
  "title": "Vintage Sony Walkman WM-10 Personal Cassette Player - Tested & Working",
  "description": "Rare vintage Sony Walkman WM-10 in excellent condition...",
  "keywords": ["vintage", "sony", "walkman", "cassette", "player"],
  "confidence": 0.85
}
```

**Notes:** Title is truncated to 80 characters for eBay compliance

### Suggest Category

```http
POST /api/ai/categorize
```

**Request Body:**
```json
{
  "text": "iPhone 13 Pro Max smartphone",
  "type": "item"
}
```

**Response:**
```json
{
  "category": "Electronics",
  "confidence": 0.92
}
```

### Suggest Price

```http
POST /api/ai/suggest-price
```

**Request Body:**
```json
{
  "name": "Vintage Sony Walkman",
  "description": "Cassette player in working condition",
  "category": "Electronics",
  "condition": "Used - Excellent"
}
```

**Response:**
```json
{
  "min": 45.00,
  "max": 75.00,
  "suggested": 59.99,
  "confidence": 0.75,
  "reasoning": "Based on recent eBay sales of similar items..."
}
```

### Analyze Photo

```http
POST /api/ai/analyze-photo
```

**Request:** `multipart/form-data` with `photo` field

**Response:**
```json
{
  "itemType": "Portable cassette player",
  "condition": "Used",
  "suggestedCategory": "Electronics",
  "confidence": 0.88
}
```

### Get Insights

```http
GET /api/ai/insights
```

**Response:**
```json
{
  "insights": [
    "Your average profit margin is 47%, above industry average"
  ],
  "warnings": [
    "5 items have been in inventory for over 90 days"
  ],
  "opportunities": [
    "15 items are ready to list - could generate ~$450 in sales"
  ]
}
```

### Suggest Expense Split

```http
POST /api/ai/suggest-split
```

**Request Body:**
```json
{
  "name": "Storage unit rental",
  "category": "Storage",
  "amount": 100.00
}
```

**Response:**
```json
{
  "inventory": 70.00,
  "operations": 20.00,
  "other": 10.00,
  "confidence": 0.82
}
```

**Notes:** Returns dollar amounts (not percentages)

### Enhance Description

```http
POST /api/ai/enhance-description
```

**Request Body:**
```json
{
  "description": "Sony Walkman, works good"
}
```

**Response:**
```json
{
  "enhanced": "Beautiful vintage Sony Walkman in excellent working condition...",
  "improvements": [
    "Added descriptive adjectives",
    "Emphasized working condition",
    "Included collector appeal"
  ]
}
```

### Get AI Usage

```http
GET /api/ai/usage
```

**Response:**
```json
{
  "daily_usage": 6500,
  "daily_limit": 10000,
  "percentage_used": 65,
  "breakdown": {
    "/api/ai/generate-seo": 2500,
    "/api/ai/suggest-price": 1500,
    "/api/ai/categorize": 1000,
    "/api/ai/analyze-photo": 1500
  }
}
```

---

## Backup & Restore API

Complete database backup and restore functionality.

### Create Backup

```http
GET /api/backup/full
```

**Response:** JSON file with complete database backup

```json
{
  "version": "0002",
  "timestamp": "2025-12-26T15:00:00Z",
  "items": [...],
  "sales": [...],
  "expenses": [...],
  "lots": [...],
  "pricing_drafts": [...],
  "settings": [...],
  "fee_profiles": [...]
}
```

### Restore from Backup

```http
POST /api/restore/full
```

**Request Body:** JSON backup file (same structure as backup response)

**Notes:**
- Validates version compatibility
- Replaces ALL data (destructive operation)
- Preserves settings and fee profiles

**Response:**
```json
{
  "success": true,
  "message": "Backup restored successfully",
  "stats": {
    "items": 150,
    "sales": 75,
    "expenses": 30
  }
}
```

---

## Import API

Bulk import data from CSV files.

### Import Items

```http
POST /api/import/items
```

**Request:** `multipart/form-data` with `file` field (CSV)

**CSV Format:**
```csv
name,sku,cost,description,category,status,bin_location
"Vintage Walkman",SONY-001,45.00,"Rare item","Electronics","In Stock","A2"
```

**Response:**
```json
{
  "success": true,
  "imported": 25,
  "failed": 2,
  "errors": [
    {
      "row": 5,
      "error": "Duplicate SKU: SONY-001"
    }
  ]
}
```

### Import Expenses

```http
POST /api/import/expenses
```

**Request:** `multipart/form-data` with `file` field (CSV)

**CSV Format:**
```csv
name,category,amount,split_inventory,split_operations,split_other,expense_date
"Storage",Storage,100.00,70.00,20.00,10.00,"2025-12-01"
```

**Response:** Same structure as items import

---

## Validation API

Real-time validation endpoints.

### Validate SKU

```http
GET /api/validate/sku
```

**Query Parameters:**
- `sku` - SKU to check
- `exclude_id` - Exclude this item ID (for updates)

**Response:**
```json
{
  "available": true
}
```

---

## Statistics API

Business intelligence statistics.

### Get Summary Stats

```http
GET /api/stats/summary
```

**Query Parameters:**
- `period` - `month`, `quarter`, `year`

**Response:**
```json
{
  "sales_count": 75,
  "total_revenue": 5000.00,
  "total_profit": 2500.00,
  "avg_sale_price": 66.67,
  "inventory_by_status": {
    "In Stock": 50,
    "Listed": 25,
    "Sold": 75
  },
  "expense_allocation": {
    "inventory": 1500.00,
    "operations": 500.00,
    "other": 200.00
  },
  "platform_profit": {
    "eBay": 1800.00,
    "Shopify": 500.00,
    "Facebook": 200.00
  }
}
```

---

## Error Responses

All endpoints return consistent error responses:

**400 Bad Request:**
```json
{
  "error": "Validation failed",
  "details": {
    "missing": ["name", "amount"]
  }
}
```

**404 Not Found:**
```json
{
  "error": "Item not found"
}
```

**409 Conflict:**
```json
{
  "error": "SKU already exists",
  "details": {
    "sku": "SONY-001",
    "existing_item_id": "item-123"
  }
}
```

**500 Internal Server Error:**
```json
{
  "error": "Database error",
  "details": "Connection timeout"
}
```

---

## Rate Limits

Cloudflare Workers free tier limits:
- **100,000 requests/day**
- **AI:** 10,000 neurons/day

Monitor AI usage via `/api/ai/usage` endpoint.

---

## Best Practices

1. **Always validate** before submitting (use validation endpoints)
2. **Check AI usage** before heavy AI operations
3. **Backup regularly** using `/api/backup/full`
4. **Use bulk imports** for efficiency (CSV imports)
5. **Monitor error responses** for debugging
6. **Cache photo URLs** to reduce R2 requests
7. **Use query parameters** to filter large datasets

---

## Changelog

**Version 0002** (2025-12-26)
- Initial comprehensive API release
- 54+ endpoints across 14 categories
- AI integration with 8 AI-powered features
- Backup/restore functionality
- CSV import/export
- Real-time validation

---

For implementation questions, see:
- [AI Features Guide](./AI_FEATURES.md)
- [Zero Trust Setup](./ZERO_TRUST_SETUP.md)
- [UX Features](./UX_FEATURES.md)
