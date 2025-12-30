-- ================================================
-- Add language_preference column to profiles table
-- Migration to fix PGRST204 error
-- ================================================

-- Add language_preference column to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS language_preference TEXT DEFAULT 'vi';

-- Add comment to document the column
COMMENT ON COLUMN profiles.language_preference IS 'User preferred language (vi for Vietnamese, en for English)';

-- Add index for better query performance if needed
CREATE INDEX IF NOT EXISTS idx_profiles_language_preference ON profiles(language_preference);
