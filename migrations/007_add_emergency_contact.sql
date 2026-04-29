-- Migration 007: Add emergency_contact column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS emergency_contact VARCHAR(255);

-- Verify
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'users' AND column_name = 'emergency_contact';
