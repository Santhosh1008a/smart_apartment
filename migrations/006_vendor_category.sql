-- Add vendor_category column to users for vendor-role users
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS vendor_category VARCHAR(50)
CHECK (vendor_category IN ('plumber','electrician','carpenter','painter','cleaner','security','other'));

-- Comment: vendor_category is only used for users with role = 'vendor'
-- It allows auto-routing vendor_requests to the right vendor by category
