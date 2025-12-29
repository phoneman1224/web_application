-- Migration: eBay OAuth Integration
-- Created: 2025-12-29
-- Purpose: Add integrations table for external service OAuth tokens (eBay, Shopify, etc.)
-- CRITICAL: This is an ADDITIVE migration. DO NOT drop existing tables.

-- ============================================
-- INTEGRATIONS TABLE
-- ============================================
-- Stores OAuth tokens and credentials for external integrations

CREATE TABLE IF NOT EXISTS integrations (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  provider TEXT NOT NULL UNIQUE,  -- 'ebay', 'shopify', 'facebook', etc.
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expiry TEXT,  -- ISO 8601 timestamp
  scopes TEXT,  -- JSON array of granted scopes
  metadata TEXT,  -- JSON object for provider-specific data
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Index for quick lookup by provider
CREATE INDEX idx_integrations_provider ON integrations(provider);

-- ============================================
-- SAMPLE DATA (Optional - for development)
-- ============================================
-- Uncomment below to add a test record:
-- INSERT INTO integrations (provider, access_token, refresh_token, scopes)
-- VALUES ('ebay', 'test_token', 'test_refresh', '["https://api.ebay.com/oauth/api_scope", "https://api.ebay.com/oauth/api_scope/sell.inventory"]');
