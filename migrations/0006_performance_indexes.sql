-- Migration 0006: Performance Indexes
-- Add missing indexes to improve query performance

-- Index for sold items reporting (used in dashboard and reports)
CREATE INDEX IF NOT EXISTS idx_items_sold_date ON items(sold_date);

-- Index for expense receipt lookups
CREATE INDEX IF NOT EXISTS idx_expenses_receipt ON expenses(receipt_key);

-- Index for pricing draft sorting
CREATE INDEX IF NOT EXISTS idx_pricing_created ON pricing_drafts(created_at);

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_items_status_lifecycle ON items(status, lifecycle_stage);
CREATE INDEX IF NOT EXISTS idx_sales_platform_date ON sales(platform, sale_date);

-- Index for eBay integration queries
CREATE INDEX IF NOT EXISTS idx_items_ebay_status ON items(ebay_status);

-- Index for AI usage tracking
CREATE INDEX IF NOT EXISTS idx_ai_usage_created_at ON ai_usage(created_at);
