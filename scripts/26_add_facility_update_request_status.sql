-- Migration 26: Add request_status column to facility_update_requests
-- This fixes the issue where code uses request_status but database has status

-- Add request_status column (nullable to avoid breaking existing data)
ALTER TABLE facility_update_requests
ADD COLUMN IF NOT EXISTS request_status TEXT;

-- Copy data from status to request_status
UPDATE facility_update_requests
SET request_status = status
WHERE request_status IS NULL;

-- Create trigger to sync status and request_status
CREATE OR REPLACE FUNCTION sync_facility_update_status()
RETURNS TRIGGER AS $$
BEGIN
  -- If request_status changed, update status
  IF NEW.request_status IS DISTINCT FROM OLD.request_status THEN
    NEW.status := NEW.request_status;
  END IF;
  
  -- If status changed, update request_status
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.request_status := NEW.status;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_facility_update_status_trigger ON facility_update_requests;
CREATE TRIGGER sync_facility_update_status_trigger
  BEFORE UPDATE ON facility_update_requests
  FOR EACH ROW
  EXECUTE FUNCTION sync_facility_update_status();

-- Create index for request_status queries
CREATE INDEX IF NOT EXISTS idx_facility_update_requests_request_status 
ON facility_update_requests(request_status);

COMMENT ON COLUMN facility_update_requests.request_status IS 'Status of the update request (synced with status column for backward compatibility)';
