CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL,
  location TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pricing_drafts (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL,
  suggested_price REAL,
  seo_title TEXT,
  seo_description TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (item_id) REFERENCES items(id)
);

CREATE TABLE IF NOT EXISTS lots (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS lot_items (
  lot_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  PRIMARY KEY (lot_id, item_id),
  FOREIGN KEY (lot_id) REFERENCES lots(id),
  FOREIGN KEY (item_id) REFERENCES items(id)
);

CREATE TABLE IF NOT EXISTS sales (
  id TEXT PRIMARY KEY,
  order_number TEXT NOT NULL,
  platform TEXT NOT NULL,
  gross_amount REAL NOT NULL,
  platform_fees REAL NOT NULL,
  promotion_discount REAL NOT NULL,
  shipping_cost REAL NOT NULL,
  cost_of_goods REAL NOT NULL,
  florida_tax_collected REAL NOT NULL,
  ebay_tax_collected REAL NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  amount REAL NOT NULL,
  split_inventory REAL NOT NULL,
  split_operations REAL NOT NULL,
  split_other REAL NOT NULL,
  receipt_key TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS settings (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS closed_periods (
  id TEXT PRIMARY KEY,
  starts_on TEXT NOT NULL,
  ends_on TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
