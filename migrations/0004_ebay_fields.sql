-- Migration 0004: Add eBay integration fields to items table
-- Date: 2025-12-30
-- Purpose: Enable eBay listing tracking with minimal schema changes (2 fields only)

-- Add eBay listing tracking fields
ALTER TABLE items ADD COLUMN ebay_listing_id TEXT;
ALTER TABLE items ADD COLUMN ebay_status TEXT CHECK (ebay_status IN (NULL, 'draft', 'active', 'ended', 'sold'));

-- Create indexes for performance on eBay queries
CREATE INDEX idx_items_ebay_listing ON items(ebay_listing_id) WHERE ebay_listing_id IS NOT NULL;
CREATE INDEX idx_items_ebay_status ON items(ebay_status) WHERE ebay_status IS NOT NULL;
