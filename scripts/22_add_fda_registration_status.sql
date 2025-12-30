-- Add registration_status column to fda_registrations table
-- This syncs with the existing 'status' column for backward compatibility

-- Add registration_status column
ALTER TABLE fda_registrations 
ADD COLUMN IF NOT EXISTS registration_status TEXT DEFAULT 'active';

-- Copy existing data from status to registration_status
UPDATE fda_registrations 
SET registration_status = status 
WHERE registration_status IS NULL OR registration_status = 'active';

-- Create trigger function to sync registration_status and status
CREATE OR REPLACE FUNCTION sync_fda_registration_status()
RETURNS TRIGGER AS $$
BEGIN
  -- If registration_status is updated, sync to status
  IF NEW.registration_status IS DISTINCT FROM OLD.registration_status THEN
    NEW.status := NEW.registration_status;
  END IF;
  
  -- If status is updated, sync to registration_status
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.registration_status := NEW.status;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and create new one
DROP TRIGGER IF EXISTS sync_fda_registration_status_trigger ON fda_registrations;
CREATE TRIGGER sync_fda_registration_status_trigger
  BEFORE UPDATE ON fda_registrations
  FOR EACH ROW
  EXECUTE FUNCTION sync_fda_registration_status();

-- Create index for registration_status
CREATE INDEX IF NOT EXISTS idx_fda_registrations_registration_status 
ON fda_registrations(registration_status);

-- Add comment
COMMENT ON COLUMN fda_registrations.registration_status IS 
'Registration status (active, expired, pending, cancelled) - synced with status column';
