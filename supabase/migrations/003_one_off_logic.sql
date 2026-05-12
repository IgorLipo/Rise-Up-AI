-- Migration: Add vendor research and first-seen tracking columns to vendor_intel
-- Supports: DeepSeek v4 Flash vendor research, 90-day cache, first-seen flags, income/expense direction

-- Add researched_at timestamp for vendor research caching (90-day freshness)
ALTER TABLE vendor_intel ADD COLUMN IF NOT EXISTS researched_at TIMESTAMPTZ;

-- Add research_data JSONB for storing DeepSeek research results
ALTER TABLE vendor_intel ADD COLUMN IF NOT EXISTS research_data JSONB DEFAULT '{}';

-- Add is_first_seen flag for first-time vendors (distinct from one-off)
ALTER TABLE vendor_intel ADD COLUMN IF NOT EXISTS is_first_seen BOOLEAN DEFAULT false;

-- Add direction column for income/expense/mixed tracking
ALTER TABLE vendor_intel ADD COLUMN IF NOT EXISTS direction TEXT CHECK (direction IN ('income', 'expense', 'mixed'));

-- Add index for first-seen queries
CREATE INDEX IF NOT EXISTS idx_vendor_intel_first_seen ON vendor_intel(company_id, is_first_seen) WHERE is_first_seen = true;
