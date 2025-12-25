CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

ALTER TABLE items ADD COLUMN bin_location TEXT;

CREATE TABLE IF NOT EXISTS bin_locations (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS item_photos (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (item_id) REFERENCES items(id)
);

CREATE TABLE IF NOT EXISTS expenses_allocations (
  id TEXT PRIMARY KEY,
  expense_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  amount REAL NOT NULL,
  FOREIGN KEY (expense_id) REFERENCES expenses(id),
  FOREIGN KEY (item_id) REFERENCES items(id)
);

CREATE TABLE IF NOT EXISTS receipts (
  id TEXT PRIMARY KEY,
  expense_id TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (expense_id) REFERENCES expenses(id)
);

CREATE TABLE IF NOT EXISTS vehicle_expenses (
  id TEXT PRIMARY KEY,
  expense_id TEXT NOT NULL,
  method TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (expense_id) REFERENCES expenses(id)
);

CREATE TABLE IF NOT EXISTS mileage_entries (
  id TEXT PRIMARY KEY,
  miles REAL NOT NULL,
  purpose TEXT,
  entry_date TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS platforms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS platform_fee_profiles (
  id TEXT PRIMARY KEY,
  platform_id TEXT NOT NULL,
  name TEXT NOT NULL,
  fee_rate REAL NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (platform_id) REFERENCES platforms(id)
);

CREATE TABLE IF NOT EXISTS sale_items (
  id TEXT PRIMARY KEY,
  sale_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  promotion_rate REAL DEFAULT 0,
  shipping_status TEXT,
  FOREIGN KEY (sale_id) REFERENCES sales(id),
  FOREIGN KEY (item_id) REFERENCES items(id)
);

CREATE TABLE IF NOT EXISTS seo_drafts (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL,
  seo_title TEXT,
  seo_description TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (item_id) REFERENCES items(id)
);

CREATE TABLE IF NOT EXISTS fee_profiles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  rate REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS tax_rates (
  id TEXT PRIMARY KEY,
  federal_rate REAL NOT NULL,
  florida_rate REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS reminder_preferences (
  id TEXT PRIMARY KEY,
  weekly_review INTEGER DEFAULT 1,
  draft_follow_up INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS appearance_preferences (
  id TEXT PRIMARY KEY,
  theme TEXT NOT NULL,
  accent TEXT NOT NULL,
  gradients_enabled INTEGER DEFAULT 0,
  density TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS smart_defaults (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL,
  value TEXT NOT NULL
);
