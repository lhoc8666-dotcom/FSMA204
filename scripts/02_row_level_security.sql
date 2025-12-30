-- ================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Users only see data from their own company
-- ================================================

-- Enable RLS on all tables
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE facilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE traceability_lot_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE critical_tracking_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE key_data_elements ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE transformation_inputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE reference_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_balance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE fda_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE us_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE facility_update_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_subscription_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE file_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_queue ENABLE ROW LEVEL SECURITY;

-- ================================================
-- HELPER FUNCTION: Get user's company_id
-- moved from auth schema to public schema for permission access
-- ================================================
CREATE OR REPLACE FUNCTION public.user_company_id()
RETURNS UUID AS $$
  SELECT company_id FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- ================================================
-- HELPER FUNCTION: Check if user is system admin
-- moved from auth schema to public schema for permission access
-- ================================================
CREATE OR REPLACE FUNCTION public.is_system_admin()
RETURNS BOOLEAN AS $$
  SELECT role = 'system_admin' FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- ================================================
-- COMPANIES RLS POLICIES
-- updated function calls to use public schema
-- ================================================

-- System admins can see all companies
CREATE POLICY "System admins can view all companies"
  ON companies FOR SELECT
  USING (public.is_system_admin());

-- Users can view their own company
CREATE POLICY "Users can view own company"
  ON companies FOR SELECT
  USING (id = public.user_company_id());

-- System admins can insert companies
CREATE POLICY "System admins can insert companies"
  ON companies FOR INSERT
  WITH CHECK (public.is_system_admin());

-- System admins can update companies
CREATE POLICY "System admins can update companies"
  ON companies FOR UPDATE
  USING (public.is_system_admin());

-- ================================================
-- PROFILES RLS POLICIES
-- updated function calls to use public schema
-- ================================================

-- System admins can see all profiles
CREATE POLICY "System admins can view all profiles"
  ON profiles FOR SELECT
  USING (public.is_system_admin());

-- Users can view profiles in their company
CREATE POLICY "Users can view company profiles"
  ON profiles FOR SELECT
  USING (company_id = public.user_company_id());

-- Users can view their own profile
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (id = auth.uid());

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (id = auth.uid());

-- ================================================
-- FACILITIES RLS POLICIES
-- updated function calls to use public schema
-- ================================================

-- Users can view facilities in their company
CREATE POLICY "Users can view company facilities"
  ON facilities FOR SELECT
  USING (company_id = public.user_company_id() OR public.is_system_admin());

-- Managers and above can insert facilities
CREATE POLICY "Managers can insert facilities"
  ON facilities FOR INSERT
  WITH CHECK (company_id = public.user_company_id() AND EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager', 'system_admin')
  ));

-- Managers and above can update facilities
CREATE POLICY "Managers can update facilities"
  ON facilities FOR UPDATE
  USING (company_id = public.user_company_id() AND EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager', 'system_admin')
  ));

-- ================================================
-- PRODUCTS RLS POLICIES
-- updated function calls to use public schema
-- ================================================

-- Users can view products in their company
CREATE POLICY "Users can view company products"
  ON products FOR SELECT
  USING (company_id = public.user_company_id() OR public.is_system_admin());

-- Managers and above can insert products
CREATE POLICY "Managers can insert products"
  ON products FOR INSERT
  WITH CHECK (company_id = public.user_company_id() AND EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager', 'system_admin')
  ));

-- Managers and above can update products
CREATE POLICY "Managers can update products"
  ON products FOR UPDATE
  USING (company_id = public.user_company_id() AND EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager', 'system_admin')
  ));

-- ================================================
-- TRACEABILITY LOT CODES RLS POLICIES
-- updated function calls to use public schema
-- ================================================

-- Users can view TLCs in their company
CREATE POLICY "Users can view company TLCs"
  ON traceability_lot_codes FOR SELECT
  USING (company_id = public.user_company_id() OR public.is_system_admin());

-- Operators and above can insert TLCs
CREATE POLICY "Operators can insert TLCs"
  ON traceability_lot_codes FOR INSERT
  WITH CHECK (company_id = public.user_company_id() AND EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager', 'operator', 'system_admin')
  ));

-- Operators and above can update TLCs
CREATE POLICY "Operators can update TLCs"
  ON traceability_lot_codes FOR UPDATE
  USING (company_id = public.user_company_id() AND EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager', 'operator', 'system_admin')
  ));

-- ================================================
-- CRITICAL TRACKING EVENTS RLS POLICIES
-- updated function calls to use public schema
-- ================================================

-- Users can view CTEs in their company
CREATE POLICY "Users can view company CTEs"
  ON critical_tracking_events FOR SELECT
  USING (company_id = public.user_company_id() OR public.is_system_admin());

-- Operators and above can insert CTEs
CREATE POLICY "Operators can insert CTEs"
  ON critical_tracking_events FOR INSERT
  WITH CHECK (company_id = public.user_company_id() AND EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager', 'operator', 'system_admin')
  ));

-- Operators and above can update CTEs
CREATE POLICY "Operators can update CTEs"
  ON critical_tracking_events FOR UPDATE
  USING (company_id = public.user_company_id() AND EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager', 'operator', 'system_admin')
  ));

-- ================================================
-- KEY DATA ELEMENTS RLS POLICIES
-- updated function calls to use public schema
-- ================================================

-- Users can view KDEs for their company's CTEs
CREATE POLICY "Users can view company KDEs"
  ON key_data_elements FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM critical_tracking_events cte 
      WHERE cte.id = key_data_elements.cte_id 
      AND (cte.company_id = public.user_company_id() OR public.is_system_admin())
    )
  );

-- Operators and above can insert KDEs
CREATE POLICY "Operators can insert KDEs"
  ON key_data_elements FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM critical_tracking_events cte
      JOIN profiles p ON p.id = auth.uid()
      WHERE cte.id = key_data_elements.cte_id 
      AND cte.company_id = public.user_company_id()
      AND p.role IN ('admin', 'manager', 'operator', 'system_admin')
    )
  );

-- ================================================
-- SHIPMENTS RLS POLICIES
-- updated function calls to use public schema
-- ================================================

-- Users can view shipments in their company
CREATE POLICY "Users can view company shipments"
  ON shipments FOR SELECT
  USING (company_id = public.user_company_id() OR public.is_system_admin());

-- Operators and above can insert shipments
CREATE POLICY "Operators can insert shipments"
  ON shipments FOR INSERT
  WITH CHECK (company_id = public.user_company_id() AND EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager', 'operator', 'system_admin')
  ));

-- Operators and above can update shipments
CREATE POLICY "Operators can update shipments"
  ON shipments FOR UPDATE
  USING (company_id = public.user_company_id() AND EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager', 'operator', 'system_admin')
  ));

-- ================================================
-- TRANSFORMATION INPUTS RLS POLICIES
-- updated function calls to use public schema
-- ================================================

-- Users can view transformation inputs for their company's CTEs
CREATE POLICY "Users can view company transformation inputs"
  ON transformation_inputs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM critical_tracking_events cte 
      WHERE cte.id = transformation_inputs.transformation_cte_id 
      AND (cte.company_id = public.user_company_id() OR public.is_system_admin())
    )
  );

-- ================================================
-- REFERENCE DOCUMENTS RLS POLICIES
-- updated function calls to use public schema
-- ================================================

-- Users can view reference documents for their company
CREATE POLICY "Users can view company reference documents"
  ON reference_documents FOR SELECT
  USING (
    (cte_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM critical_tracking_events cte 
      WHERE cte.id = reference_documents.cte_id 
      AND (cte.company_id = public.user_company_id() OR public.is_system_admin())
    ))
    OR
    (shipment_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM shipments s
      WHERE s.id = reference_documents.shipment_id 
      AND (s.company_id = public.user_company_id() OR public.is_system_admin())
    ))
  );

-- ================================================
-- INVENTORY BALANCE LOGS RLS POLICIES
-- updated function calls to use public schema
-- ================================================

-- Users can view inventory logs in their company
CREATE POLICY "Users can view company inventory logs"
  ON inventory_balance_logs FOR SELECT
  USING (company_id = public.user_company_id() OR public.is_system_admin());

-- ================================================
-- SYSTEM LOGS RLS POLICIES
-- ================================================

-- Admins can view all logs in their company
CREATE POLICY "Admins can view company logs"
  ON system_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p1
      JOIN profiles p2 ON p2.id = system_logs.user_id
      WHERE p1.id = auth.uid()
      AND p1.role IN ('admin', 'system_admin')
      AND (p2.company_id = p1.company_id OR p1.role = 'system_admin')
    )
  );

-- Users can view their own logs
CREATE POLICY "Users can view own logs"
  ON system_logs FOR SELECT
  USING (user_id = auth.uid());

-- ================================================
-- FDA REGISTRATIONS RLS POLICIES
-- updated function calls to use public schema
-- ================================================

-- Users can view FDA registrations in their company
CREATE POLICY "Users can view company FDA registrations"
  ON fda_registrations FOR SELECT
  USING (company_id = public.user_company_id() OR public.is_system_admin());

-- Admins can manage FDA registrations
CREATE POLICY "Admins can manage FDA registrations"
  ON fda_registrations FOR ALL
  USING (company_id = public.user_company_id() AND EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'system_admin')
  ));

-- ================================================
-- US AGENTS RLS POLICIES
-- updated function calls to use public schema
-- ================================================

-- Users can view US agents in their company
CREATE POLICY "Users can view company US agents"
  ON us_agents FOR SELECT
  USING (company_id = public.user_company_id() OR public.is_system_admin());

-- Admins can manage US agents
CREATE POLICY "Admins can manage US agents"
  ON us_agents FOR ALL
  USING (company_id = public.user_company_id() AND EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'system_admin')
  ));

-- ================================================
-- COMPANY SUBSCRIPTIONS RLS POLICIES
-- updated function calls to use public schema
-- ================================================

-- System admins can view all subscriptions
CREATE POLICY "System admins can view all subscriptions"
  ON company_subscriptions FOR SELECT
  USING (public.is_system_admin());

-- Admins can view their company's subscriptions
CREATE POLICY "Admins can view company subscriptions"
  ON company_subscriptions FOR SELECT
  USING (company_id = public.user_company_id() AND EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'system_admin')
  ));

-- ================================================
-- FILE UPLOADS RLS POLICIES
-- updated function calls to use public schema
-- ================================================

-- Users can view files uploaded by their company
CREATE POLICY "Users can view company files"
  ON file_uploads FOR SELECT
  USING (company_id = public.user_company_id() OR public.is_system_admin());

-- Users can upload files for their company
CREATE POLICY "Users can upload files"
  ON file_uploads FOR INSERT
  WITH CHECK (company_id = public.user_company_id());

-- ================================================
-- NOTIFICATION QUEUE RLS POLICIES
-- updated function calls to use public schema
-- ================================================

-- Users can view their own notifications
CREATE POLICY "Users can view own notifications"
  ON notification_queue FOR SELECT
  USING (user_id = auth.uid() OR company_id = public.user_company_id());
