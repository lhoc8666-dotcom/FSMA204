-- Add missing columns to agent_assignments table
-- This fixes the issue where code tries to insert assignment_date, assignment_years, expiry_date, status, company_id

-- Add company_id column which is required by the code
ALTER TABLE agent_assignments 
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);

-- Add assignment_date column (code uses this name instead of assigned_date)
ALTER TABLE agent_assignments 
ADD COLUMN IF NOT EXISTS assignment_date DATE;

-- Add missing columns
ALTER TABLE agent_assignments 
ADD COLUMN IF NOT EXISTS assignment_years INTEGER;

ALTER TABLE agent_assignments 
ADD COLUMN IF NOT EXISTS expiry_date DATE;

ALTER TABLE agent_assignments 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- Sync data from assigned_date to assignment_date
UPDATE agent_assignments 
SET assignment_date = assigned_date
WHERE assignment_date IS NULL;

-- Create trigger to keep assigned_date and assignment_date in sync
CREATE OR REPLACE FUNCTION sync_agent_assignment_dates()
RETURNS TRIGGER AS $$
BEGIN
  -- When assignment_date is updated, update assigned_date
  IF NEW.assignment_date IS DISTINCT FROM OLD.assignment_date THEN
    NEW.assigned_date := NEW.assignment_date;
  END IF;
  
  -- When assigned_date is updated, update assignment_date
  IF NEW.assigned_date IS DISTINCT FROM OLD.assigned_date THEN
    NEW.assignment_date := NEW.assigned_date;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_assignment_dates_trigger ON agent_assignments;
CREATE TRIGGER sync_assignment_dates_trigger
  BEFORE UPDATE ON agent_assignments
  FOR EACH ROW
  EXECUTE FUNCTION sync_agent_assignment_dates();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_agent_assignments_company_id ON agent_assignments(company_id);
CREATE INDEX IF NOT EXISTS idx_agent_assignments_assignment_date ON agent_assignments(assignment_date);
CREATE INDEX IF NOT EXISTS idx_agent_assignments_expiry_date ON agent_assignments(expiry_date);
CREATE INDEX IF NOT EXISTS idx_agent_assignments_status ON agent_assignments(status);

COMMENT ON COLUMN agent_assignments.company_id IS 'Company that owns this agent assignment';
COMMENT ON COLUMN agent_assignments.assignment_date IS 'Date when the agent was assigned (synced with assigned_date)';
COMMENT ON COLUMN agent_assignments.assignment_years IS 'Number of years for the agent assignment';
COMMENT ON COLUMN agent_assignments.expiry_date IS 'Date when the agent assignment expires';
COMMENT ON COLUMN agent_assignments.status IS 'Status of the agent assignment (active, expired, etc.)';
