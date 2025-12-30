-- Fix RLS policies for fda_registrations table
-- This script drops the problematic policy and creates proper policies with WITH CHECK clauses

-- Drop the existing problematic policy
DROP POLICY IF EXISTS "Admins can manage FDA registrations" ON public.fda_registrations;

-- Create separate policies for each operation with proper USING and WITH CHECK clauses

-- Policy for SELECT: Admins can view FDA registrations of their company
CREATE POLICY "Admins can view FDA registrations"
  ON public.fda_registrations
  FOR SELECT
  USING (
    auth.jwt() ->> 'role' = 'system_admin'
    OR (
      auth.jwt() ->> 'role' = 'admin'
      AND company_id = (auth.jwt() ->> 'company_id')::uuid
    )
  );

-- Policy for INSERT: Admins can create FDA registrations for their company
CREATE POLICY "Admins can create FDA registrations"
  ON public.fda_registrations
  FOR INSERT
  WITH CHECK (
    auth.jwt() ->> 'role' = 'system_admin'
    OR (
      auth.jwt() ->> 'role' = 'admin'
      AND (company_id = (auth.jwt() ->> 'company_id')::uuid OR company_id IS NULL)
    )
  );

-- Policy for UPDATE: Admins can update FDA registrations of their company
CREATE POLICY "Admins can update FDA registrations"
  ON public.fda_registrations
  FOR UPDATE
  USING (
    auth.jwt() ->> 'role' = 'system_admin'
    OR (
      auth.jwt() ->> 'role' = 'admin'
      AND company_id = (auth.jwt() ->> 'company_id')::uuid
    )
  )
  WITH CHECK (
    auth.jwt() ->> 'role' = 'system_admin'
    OR (
      auth.jwt() ->> 'role' = 'admin'
      AND (company_id = (auth.jwt() ->> 'company_id')::uuid OR company_id IS NULL)
    )
  );

-- Policy for DELETE: Admins can delete FDA registrations of their company
CREATE POLICY "Admins can delete FDA registrations"
  ON public.fda_registrations
  FOR DELETE
  USING (
    auth.jwt() ->> 'role' = 'system_admin'
    OR (
      auth.jwt() ->> 'role' = 'admin'
      AND company_id = (auth.jwt() ->> 'company_id')::uuid
    )
  );

-- Create indexes for better performance on RLS checks
CREATE INDEX IF NOT EXISTS idx_fda_registrations_company_id 
  ON public.fda_registrations(company_id);
  
CREATE INDEX IF NOT EXISTS idx_fda_registrations_status 
  ON public.fda_registrations(status);
