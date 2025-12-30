-- ================================================
-- Add missing columns to profiles table
-- ================================================

-- Add organization_type column to profiles table
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS organization_type TEXT 
CHECK (organization_type IN ('farm', 'packing_house', 'processor', 'distributor', 'retailer', 'importer', 'port'));

-- Add allowed_cte_types column to profiles table (used for restricting which CTE types a user can create)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS allowed_cte_types TEXT[];

-- Add comment to explain the columns
COMMENT ON COLUMN profiles.organization_type IS 'Type of organization the user belongs to, determines which CTE types they can create';
COMMENT ON COLUMN profiles.allowed_cte_types IS 'Array of CTE event types this user is allowed to create. NULL means all types allowed (backward compatibility)';

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_profiles_organization_type ON profiles(organization_type);
