-- Fix RLS policies for profiles table to allow user self-registration
-- This allows users to create their own profile during signup

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

-- Allow users to insert their own profile during signup
CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Verify all policies are in place
COMMENT ON POLICY "Users can insert own profile" ON profiles IS 
  'Allows authenticated users to create their own profile during signup';
