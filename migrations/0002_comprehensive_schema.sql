-- ============================================================================
-- Migration 0002: Comprehensive Schema (Clean Slate)
-- Purpose: Drop old tables, create production-ready schema with AI support
-- Date: 2025-12-26
-- ============================================================================

-- ============================================================================
-- DROP EXISTING TABLES (Clean Slate Approach)
-- ============================================================================

DROP TABLE IF EXISTS pricing_drafts;
DROP TABLE IF EXISTS lot_items;
DROP TABLE IF EXISTS sale_items;
DROP TABLE IF EXISTS lots;
DROP TABLE IF EXISTS sales;
DROP TABLE IF EXISTS expenses;
DROP TABLE IF EXISTS closed_periods;
DROP TABLE IF EXISTS settings;
DROP TABLE IF EXISTS items;
DROP TABLE IF EXISTS fee_profiles;
DROP TABLE IF EXISTS ai_usage;

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- Fee Profiles (Platform configurations)
CREATE TABLE fee_profiles (
  id TEXT PRIMARY KEY,
  platform TEXT NOT NULL UNIQUE,
  fee_rate REAL NOT NULL CHECK (fee_rate >= 0 AND fee_rate <= 1),
  description TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Pre-populate with common platforms
INSERT INTO fee_profiles (id, platform, fee_rate, description) VALUES
  ('fp-ebay', 'eBay', 0.129, 'Standard eBay final value fee'),
  ('fp-shopify', 'Shopify', 0.029, 'Shopify payment processing'),
  ('fp-facebook', 'Facebook Marketplace', 0.05, 'Facebook selling fee'),
  ('fp-mercari', 'Mercari', 0.10, 'Mercari selling fee'),
  ('fp-poshmark', 'Poshmark', 0.20, 'Poshmark commission'),
  ('fp-other', 'Other', 0.0, 'Custom platform - adjust fee rate as needed');

-- Items (Core inventory with lifecycle tracking)
CREATE TABLE items (
  id TEXT PRIMARY KEY,
  sku TEXT,
  name TEXT NOT NULL,
  description TEXT,
  cost REAL NOT NULL DEFAULT 0 CHECK (cost >= 0),
  bin_location TEXT,
  photos TEXT, -- JSON array of R2 keys: ["photo1.jpg", "photo2.jpg"]
  category TEXT,
  status TEXT NOT NULL DEFAULT 'Unlisted' CHECK (status IN ('Unlisted', 'Draft', 'Listed', 'Sold')),
  lifecycle_stage TEXT NOT NULL DEFAULT 'Captured' CHECK (lifecycle_stage IN ('Captured', 'Prepared', 'Listed', 'Sold')),
  sold_price REAL CHECK (sold_price >= 0),
  sold_date TEXT,
  ai_suggested_category TEXT,
  ai_category_confidence REAL CHECK (ai_category_confidence >= 0 AND ai_category_confidence <= 1),
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_items_status ON items(status);
CREATE INDEX idx_items_lifecycle ON items(lifecycle_stage);
CREATE INDEX idx_items_category ON items(category);
CREATE INDEX idx_items_sku ON items(sku);
CREATE INDEX idx_items_created ON items(created_at);

-- Sales (Revenue tracking with auto-calculated profit/taxes)
CREATE TABLE sales (
  id TEXT PRIMARY KEY,
  order_number TEXT NOT NULL,
  platform TEXT NOT NULL,
  gross_amount REAL NOT NULL CHECK (gross_amount >= 0),
  platform_fees REAL NOT NULL DEFAULT 0 CHECK (platform_fees >= 0),
  promotion_discount REAL NOT NULL DEFAULT 0 CHECK (promotion_discount >= 0),
  shipping_cost REAL NOT NULL DEFAULT 0 CHECK (shipping_cost >= 0),
  cost_of_goods REAL NOT NULL CHECK (cost_of_goods >= 0),
  florida_tax_collected REAL NOT NULL DEFAULT 0 CHECK (florida_tax_collected >= 0), -- Tax YOU collected (non-eBay)
  ebay_tax_collected REAL NOT NULL DEFAULT 0 CHECK (ebay_tax_collected >= 0), -- Tax eBay collected (informational)
  federal_tax_estimate REAL NOT NULL DEFAULT 0 CHECK (federal_tax_estimate >= 0),
  profit REAL NOT NULL,
  sale_date TEXT NOT NULL,
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sales_date ON sales(sale_date);
CREATE INDEX idx_sales_platform ON sales(platform);
CREATE INDEX idx_sales_order ON sales(order_number);
CREATE INDEX idx_sales_created ON sales(created_at);

-- Sale Items (Many-to-Many: Sales <-> Items)
CREATE TABLE sale_items (
  id TEXT PRIMARY KEY,
  sale_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
  FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE RESTRICT
);

CREATE INDEX idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX idx_sale_items_item ON sale_items(item_id);

-- Expenses (Business expenses with splitting and vehicle deductions)
CREATE TABLE expenses (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  amount REAL NOT NULL,
  split_inventory REAL NOT NULL DEFAULT 0 CHECK (split_inventory >= 0),
  split_operations REAL NOT NULL DEFAULT 0 CHECK (split_operations >= 0),
  split_other REAL NOT NULL DEFAULT 0 CHECK (split_other >= 0),
  receipt_key TEXT, -- R2 object key for receipt photo
  vehicle_mileage REAL CHECK (vehicle_mileage >= 0), -- Mutually exclusive with vehicle_actual
  vehicle_actual REAL CHECK (vehicle_actual >= 0), -- Mutually exclusive with vehicle_mileage
  expense_date TEXT NOT NULL,
  notes TEXT,
  ai_suggested_category TEXT,
  ai_split_confidence REAL CHECK (ai_split_confidence >= 0 AND ai_split_confidence <= 1),
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  CHECK (
    (vehicle_mileage IS NULL OR vehicle_actual IS NULL) OR
    (vehicle_mileage IS NULL AND vehicle_actual IS NULL)
  )
);

CREATE INDEX idx_expenses_date ON expenses(expense_date);
CREATE INDEX idx_expenses_category ON expenses(category);
CREATE INDEX idx_expenses_created ON expenses(created_at);

-- Lots (Wrapper for multiple items, no pricing stored)
CREATE TABLE lots (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Lot Items (Many-to-Many: Lots <-> Items)
CREATE TABLE lot_items (
  id TEXT PRIMARY KEY,
  lot_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  FOREIGN KEY (lot_id) REFERENCES lots(id) ON DELETE CASCADE,
  FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
  UNIQUE(lot_id, item_id)
);

CREATE INDEX idx_lot_items_lot ON lot_items(lot_id);
CREATE INDEX idx_lot_items_item ON lot_items(item_id);

-- Pricing Drafts (SEO and pricing suggestions, never affects accounting)
CREATE TABLE pricing_drafts (
  id TEXT PRIMARY KEY,
  item_id TEXT,
  lot_id TEXT,
  suggested_price REAL CHECK (suggested_price >= 0),
  seo_title TEXT,
  seo_description TEXT,
  confidence_score REAL CHECK (confidence_score >= 0 AND confidence_score <= 1),
  ai_generated BOOLEAN DEFAULT FALSE,
  ai_keywords TEXT, -- JSON array: ["vintage", "camera", "collectible"]
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  CHECK (
    (item_id IS NOT NULL AND lot_id IS NULL) OR
    (item_id IS NULL AND lot_id IS NOT NULL)
  ),
  FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
  FOREIGN KEY (lot_id) REFERENCES lots(id) ON DELETE CASCADE
);

CREATE INDEX idx_pricing_drafts_item ON pricing_drafts(item_id);
CREATE INDEX idx_pricing_drafts_lot ON pricing_drafts(lot_id);

-- Settings (Key-Value store for app configuration)
CREATE TABLE settings (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Pre-populate with sensible defaults
INSERT INTO settings (id, key, value) VALUES
  ('set-federal-tax', 'federal_tax_rate', '0.22'),
  ('set-florida-sales-tax', 'florida_sales_tax_rate', '0.07'),
  ('set-vehicle-method', 'vehicle_deduction_method', 'mileage'),
  ('set-theme', 'theme', 'light'),
  ('set-accent', 'accent_color', '#5b5dff'),
  ('set-density', 'density', 'comfortable'),
  ('set-reminders-weekly', 'reminders_weekly', 'true'),
  ('set-reminders-draft', 'reminders_draft', 'true'),
  ('set-confirm-delete', 'confirm_delete', 'true'),
  ('set-confirm-closed-edit', 'confirm_closed_period_edit', 'true'),
  ('set-enable-gradients', 'enable_gradients', 'false');

-- Closed Periods (Tax periods that should warn on edits)
CREATE TABLE closed_periods (
  id TEXT PRIMARY KEY,
  starts_on TEXT NOT NULL,
  ends_on TEXT NOT NULL,
  description TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  CHECK (starts_on <= ends_on)
);

CREATE INDEX idx_closed_periods_dates ON closed_periods(starts_on, ends_on);

-- AI Usage Tracking (Monitor free tier limits)
CREATE TABLE ai_usage (
  id TEXT PRIMARY KEY,
  endpoint TEXT NOT NULL,
  tokens_used INTEGER NOT NULL CHECK (tokens_used >= 0),
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ai_usage_date ON ai_usage(created_at);
CREATE INDEX idx_ai_usage_endpoint ON ai_usage(endpoint);

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Schema version: 0002
-- Tables created: 11 (items, sales, sale_items, expenses, lots, lot_items,
--                      pricing_drafts, fee_profiles, settings, closed_periods, ai_usage)
-- Indexes created: 21
-- Default records: 6 fee profiles, 11 settings
-- ============================================================================
