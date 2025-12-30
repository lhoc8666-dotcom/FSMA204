-- Fix US Agents company_id constraint
-- US Agents are independent entities and should not require a company_id

-- Remove NOT NULL constraint from company_id
ALTER TABLE us_agents 
ALTER COLUMN company_id DROP NOT NULL;

-- Add comment explaining the design
COMMENT ON COLUMN us_agents.company_id IS 'Foreign key to companies table. NULL for independent US agents (system-wide). Set when agent is assigned to specific company.';

-- Create index for performance when querying by company
CREATE INDEX IF NOT EXISTS idx_us_agents_company_id ON us_agents(company_id);

-- Log the change
DO $$
BEGIN
  RAISE NOTICE 'US Agents company_id constraint updated: now allows NULL for independent agents';
END $$;
-- Fix company_name NOT NULL constraint and sync with agent_company_name
-- This ensures backward compatibility while supporting the new agent_company_name column

-- Step 1: Make company_name nullable (it was NOT NULL before)
ALTER TABLE us_agents 
ALTER COLUMN company_name DROP NOT NULL;

-- Step 2: Sync existing data from company_name to agent_company_name if needed
UPDATE us_agents
SET agent_company_name = company_name
WHERE agent_company_name IS NULL AND company_name IS NOT NULL;

-- Step 3: Create trigger function to keep company_name and agent_company_name in sync
CREATE OR REPLACE FUNCTION sync_us_agents_company_name()
RETURNS TRIGGER AS $$
BEGIN
  -- If agent_company_name is set, sync to company_name
  IF NEW.agent_company_name IS NOT NULL THEN
    NEW.company_name := NEW.agent_company_name;
  END IF;
  
  -- If company_name is set but agent_company_name is not, sync the other way
  IF NEW.company_name IS NOT NULL AND NEW.agent_company_name IS NULL THEN
    NEW.agent_company_name := NEW.company_name;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Create trigger to auto-sync on INSERT or UPDATE
DROP TRIGGER IF EXISTS trigger_sync_us_agents_company_name ON us_agents;
CREATE TRIGGER trigger_sync_us_agents_company_name
  BEFORE INSERT OR UPDATE ON us_agents
  FOR EACH ROW
  EXECUTE FUNCTION sync_us_agents_company_name();

-- Step 5: Add comment explaining the dual columns
COMMENT ON COLUMN us_agents.company_name IS 'Legacy column, synced with agent_company_name for backward compatibility';
COMMENT ON COLUMN us_agents.agent_company_name IS 'Current column for US agent company name, synced with company_name';

-- Script 19: Sync address and street_address columns in us_agents table
-- Purpose: Fix NOT NULL constraint on address column and sync with street_address

-- Drop constraint on address to allow NULL values
ALTER TABLE public.us_agents 
ALTER COLUMN address DROP NOT NULL;

-- Sync existing data from street_address to address
UPDATE public.us_agents
SET address = street_address
WHERE street_address IS NOT NULL AND (address IS NULL OR address = '');

-- Sync existing data from address to street_address
UPDATE public.us_agents
SET street_address = address
WHERE address IS NOT NULL AND address != '' AND (street_address IS NULL OR street_address = '');

-- Create trigger function to sync address columns
CREATE OR REPLACE FUNCTION sync_us_agents_address()
RETURNS TRIGGER AS $$
BEGIN
  -- When street_address is updated, sync to address
  IF NEW.street_address IS DISTINCT FROM OLD.street_address THEN
    NEW.address := NEW.street_address;
  END IF;
  
  -- When address is updated, sync to street_address
  IF NEW.address IS DISTINCT FROM OLD.address THEN
    NEW.street_address := NEW.address;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for syncing address columns
DROP TRIGGER IF EXISTS sync_us_agents_address_trigger ON public.us_agents;
CREATE TRIGGER sync_us_agents_address_trigger
  BEFORE INSERT OR UPDATE ON public.us_agents
  FOR EACH ROW
  EXECUTE FUNCTION sync_us_agents_address();

-- Add comment
COMMENT ON COLUMN public.us_agents.address IS 'Legacy address column, synced with street_address for backward compatibility';
COMMENT ON COLUMN public.us_agents.street_address IS 'Primary address column, synced with address for backward compatibility';

-- Migration: Fix all NOT NULL constraints in us_agents table
-- This script makes all problematic NOT NULL columns nullable or adds proper defaults
-- to prevent INSERT failures

-- Step 1: Make valid_from and valid_until nullable
-- These dates may not be known when first creating a US Agent record
ALTER TABLE us_agents 
  ALTER COLUMN valid_from DROP NOT NULL;

ALTER TABLE us_agents 
  ALTER COLUMN valid_until DROP NOT NULL;

-- Step 2: Make street_address nullable (already done in script 15 but ensuring here)
ALTER TABLE us_agents 
  ALTER COLUMN street_address DROP NOT NULL;

-- Step 3: Update expiry_date to sync with valid_until for existing records
UPDATE us_agents 
SET expiry_date = valid_until 
WHERE expiry_date IS NULL AND valid_until IS NOT NULL;

-- Step 4: Create indexes for date-based queries
CREATE INDEX IF NOT EXISTS idx_us_agents_valid_from ON us_agents(valid_from);
CREATE INDEX IF NOT EXISTS idx_us_agents_valid_until ON us_agents(valid_until);
CREATE INDEX IF NOT EXISTS idx_us_agents_expiry_date ON us_agents(expiry_date);

-- Step 5: Add comments for documentation
COMMENT ON COLUMN us_agents.valid_from IS 'Contract start date - nullable for agents without active contracts';
COMMENT ON COLUMN us_agents.valid_until IS 'Contract end date - nullable for agents without active contracts';
COMMENT ON COLUMN us_agents.expiry_date IS 'Expiry date for notifications - synced with valid_until';

-- Verification query (commented out - for manual verification)
-- SELECT column_name, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'us_agents' 
--   AND column_name IN ('valid_from', 'valid_until', 'street_address')
-- ORDER BY column_name;
