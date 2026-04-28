-- ============================================================
-- Migration: Add assigned_vendor_id to vendor_requests
-- Run in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- Add assigned_vendor_id column (references users table for vendor-type users)
ALTER TABLE vendor_requests
  ADD COLUMN IF NOT EXISTS assigned_vendor_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- Index for fast lookups by assigned vendor
CREATE INDEX IF NOT EXISTS idx_vendor_requests_assigned_vendor
  ON vendor_requests(assigned_vendor_id);

-- Index for fast lookups by status
CREATE INDEX IF NOT EXISTS idx_vendor_requests_status
  ON vendor_requests(status);
