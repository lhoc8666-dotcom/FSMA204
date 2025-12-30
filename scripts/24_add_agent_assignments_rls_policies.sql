-- =====================================================
-- Script 24: Add RLS Policies for agent_assignments table
-- Purpose: Enable proper access control for US Agent assignments
-- =====================================================

-- Drop existing policies if any (just in case)
DROP POLICY IF EXISTS "Admins can view agent assignments" ON agent_assignments;
DROP POLICY IF EXISTS "Admins can insert agent assignments" ON agent_assignments;
DROP POLICY IF EXISTS "Admins can update agent assignments" ON agent_assignments;
DROP POLICY IF EXISTS "Admins can delete agent assignments" ON agent_assignments;

-- SELECT: System admins can see all, regular admins can see their company's assignments
CREATE POLICY "Admins can view agent assignments"
ON agent_assignments
FOR SELECT
USING (
  is_system_admin() OR
  EXISTS (
    SELECT 1 FROM fda_registrations fr
    WHERE fr.id = agent_assignments.fda_registration_id
    AND fr.company_id = user_company_id()
  )
);

-- INSERT: System admins can insert any, regular admins can insert for their company
CREATE POLICY "Admins can insert agent assignments"
ON agent_assignments
FOR INSERT
WITH CHECK (
  is_system_admin() OR
  EXISTS (
    SELECT 1 FROM fda_registrations fr
    WHERE fr.id = agent_assignments.fda_registration_id
    AND fr.company_id = user_company_id()
  )
);

-- UPDATE: System admins can update any, regular admins can update their company's assignments
CREATE POLICY "Admins can update agent assignments"
ON agent_assignments
FOR UPDATE
USING (
  is_system_admin() OR
  EXISTS (
    SELECT 1 FROM fda_registrations fr
    WHERE fr.id = agent_assignments.fda_registration_id
    AND fr.company_id = user_company_id()
  )
)
WITH CHECK (
  is_system_admin() OR
  EXISTS (
    SELECT 1 FROM fda_registrations fr
    WHERE fr.id = agent_assignments.fda_registration_id
    AND fr.company_id = user_company_id()
  )
);

-- DELETE: System admins can delete any, regular admins can delete their company's assignments
CREATE POLICY "Admins can delete agent assignments"
ON agent_assignments
FOR DELETE
USING (
  is_system_admin() OR
  EXISTS (
    SELECT 1 FROM fda_registrations fr
    WHERE fr.id = agent_assignments.fda_registration_id
    AND fr.company_id = user_company_id()
  )
);

-- Create indexes for better RLS performance
CREATE INDEX IF NOT EXISTS idx_agent_assignments_fda_registration 
ON agent_assignments(fda_registration_id);

CREATE INDEX IF NOT EXISTS idx_agent_assignments_us_agent 
ON agent_assignments(us_agent_id);

CREATE INDEX IF NOT EXISTS idx_agent_assignments_active 
ON agent_assignments(is_active) WHERE is_active = true;

-- Add comment
COMMENT ON TABLE agent_assignments IS 'Stores relationships between FDA registrations and US Agents with proper RLS policies';
