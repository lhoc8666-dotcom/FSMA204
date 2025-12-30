-- ================================================
-- FoodTrace - Database Schema Setup for Supabase
-- FSMA 204 Food Traceability System
-- ================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ================================================
-- COMPANIES TABLE
-- ================================================
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  display_name TEXT,
  tax_code TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  organization_type TEXT CHECK (organization_type IN ('farm', 'packing_house', 'processor', 'distributor', 'retailer', 'importer', 'port')),
  stripe_customer_id TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================
-- PROFILES TABLE (User Accounts)
-- ================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('system_admin', 'admin', 'manager', 'operator', 'viewer')),
  phone TEXT,
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  mfa_enabled BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================
-- SERVICE PACKAGES TABLE
-- ================================================
CREATE TABLE IF NOT EXISTS service_packages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  price_monthly DECIMAL(10,2) NOT NULL DEFAULT 0,
  price_yearly DECIMAL(10,2) NOT NULL DEFAULT 0,
  limits JSONB DEFAULT '{}',
  features JSONB DEFAULT '{}',
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================
-- COMPANY SUBSCRIPTIONS TABLE
-- ================================================
CREATE TABLE IF NOT EXISTS company_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  package_id UUID NOT NULL REFERENCES service_packages(id),
  status TEXT NOT NULL DEFAULT 'trial' CHECK (status IN ('trial', 'active', 'expired', 'cancelled', 'suspended')),
  start_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_date TIMESTAMPTZ,
  trial_ends_at TIMESTAMPTZ,
  stripe_subscription_id TEXT UNIQUE,
  payment_method TEXT,
  auto_renew BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================
-- COMPANY SUBSCRIPTION OVERRIDES TABLE
-- ================================================
CREATE TABLE IF NOT EXISTS company_subscription_overrides (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  overridden_limits JSONB,
  overridden_features JSONB,
  notes TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  expires_at TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================
-- FACILITIES TABLE
-- ================================================
CREATE TABLE IF NOT EXISTS facilities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  facility_type TEXT NOT NULL CHECK (facility_type IN ('farm', 'packing_house', 'processor', 'distributor', 'warehouse', 'cold_storage', 'port')),
  address TEXT NOT NULL,
  city TEXT,
  state TEXT,
  country TEXT DEFAULT 'Vietnam',
  postal_code TEXT,
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),
  contact_person TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  fsis_establishment_number TEXT,
  fsma_compliance BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, name)
);

-- ================================================
-- PRODUCTS TABLE
-- ================================================
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  product_code TEXT NOT NULL,
  category TEXT,
  scientific_name TEXT,
  description TEXT,
  unit TEXT NOT NULL DEFAULT 'kg',
  shelf_life_days INTEGER,
  storage_temperature_min DECIMAL(5,2),
  storage_temperature_max DECIMAL(5,2),
  is_ftl_food BOOLEAN DEFAULT TRUE,
  gtin TEXT,
  image_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, product_code)
);

-- ================================================
-- TRACEABILITY LOT CODES TABLE
-- ================================================
CREATE TABLE IF NOT EXISTS traceability_lot_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  tlc TEXT NOT NULL UNIQUE,
  initial_quantity DECIMAL(12,3) NOT NULL,
  available_quantity DECIMAL(12,3) NOT NULL DEFAULT 0,
  shipped_quantity DECIMAL(12,3) NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'kg',
  harvest_date DATE,
  expiration_date DATE,
  origin_location TEXT,
  parent_tlc_id UUID REFERENCES traceability_lot_codes(id),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'expired', 'recalled')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================
-- CRITICAL TRACKING EVENTS (CTE) TABLE
-- ================================================
CREATE TABLE IF NOT EXISTS critical_tracking_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  tlc_id UUID NOT NULL REFERENCES traceability_lot_codes(id) ON DELETE CASCADE,
  facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE RESTRICT,
  event_type TEXT NOT NULL CHECK (event_type IN ('harvest', 'cooling', 'packing', 'receiving', 'receiving_distributor', 'first_receiving', 'transformation', 'shipping')),
  event_date TIMESTAMPTZ NOT NULL,
  quantity_processed DECIMAL(12,3) NOT NULL,
  unit TEXT NOT NULL DEFAULT 'kg',
  location TEXT,
  operator_name TEXT,
  temperature DECIMAL(5,2),
  notes TEXT,
  waste_expected DECIMAL(12,3),
  waste_actual DECIMAL(12,3),
  waste_reason TEXT,
  status TEXT DEFAULT 'submitted' CHECK (status IN ('draft', 'submitted', 'approved', 'rejected')),
  submitted_at TIMESTAMPTZ,
  submitted_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================
-- KEY DATA ELEMENTS (KDE) TABLE
-- ================================================
CREATE TABLE IF NOT EXISTS key_data_elements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cte_id UUID NOT NULL REFERENCES critical_tracking_events(id) ON DELETE CASCADE,
  kde_code TEXT NOT NULL,
  kde_name TEXT NOT NULL,
  value TEXT NOT NULL,
  is_required BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(cte_id, kde_code)
);

-- ================================================
-- SHIPMENTS TABLE
-- ================================================
CREATE TABLE IF NOT EXISTS shipments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  tlc_id UUID NOT NULL REFERENCES traceability_lot_codes(id) ON DELETE RESTRICT,
  shipment_number TEXT NOT NULL UNIQUE,
  from_facility_id UUID REFERENCES facilities(id),
  to_facility_name TEXT NOT NULL,
  to_facility_address TEXT,
  carrier_name TEXT,
  vehicle_number TEXT,
  driver_name TEXT,
  driver_phone TEXT,
  quantity DECIMAL(12,3) NOT NULL,
  unit TEXT NOT NULL DEFAULT 'kg',
  ship_date TIMESTAMPTZ NOT NULL,
  expected_arrival TIMESTAMPTZ,
  actual_arrival TIMESTAMPTZ,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_transit', 'delivered', 'cancelled')),
  temperature_log JSONB,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================
-- TRANSFORMATION INPUTS TABLE
-- ================================================
CREATE TABLE IF NOT EXISTS transformation_inputs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transformation_cte_id UUID NOT NULL REFERENCES critical_tracking_events(id) ON DELETE CASCADE,
  input_tlc_id UUID NOT NULL REFERENCES traceability_lot_codes(id) ON DELETE RESTRICT,
  quantity_used DECIMAL(12,3) NOT NULL,
  unit TEXT NOT NULL DEFAULT 'kg',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(transformation_cte_id, input_tlc_id)
);

-- ================================================
-- REFERENCE DOCUMENTS TABLE
-- ================================================
CREATE TABLE IF NOT EXISTS reference_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cte_id UUID REFERENCES critical_tracking_events(id) ON DELETE CASCADE,
  shipment_id UUID REFERENCES shipments(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN ('invoice', 'packing_list', 'bill_of_lading', 'certificate', 'photo', 'other')),
  document_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size_bytes BIGINT,
  uploaded_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================
-- INVENTORY BALANCE LOG TABLE
-- ================================================
CREATE TABLE IF NOT EXISTS inventory_balance_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  tlc_id UUID NOT NULL REFERENCES traceability_lot_codes(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  quantity_change DECIMAL(12,3) NOT NULL,
  balance_before DECIMAL(12,3) NOT NULL,
  balance_after DECIMAL(12,3) NOT NULL,
  reference_id UUID,
  reference_type TEXT,
  flag_type TEXT CHECK (flag_type IN ('normal', 'abnormal', 'critical_violation')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================
-- SYSTEM LOGS TABLE
-- ================================================
CREATE TABLE IF NOT EXISTS system_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================
-- FDA REGISTRATIONS TABLE
-- ================================================
CREATE TABLE IF NOT EXISTS fda_registrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  facility_id UUID REFERENCES facilities(id) ON DELETE SET NULL,
  registration_number TEXT NOT NULL UNIQUE,
  facility_name TEXT NOT NULL,
  facility_address TEXT NOT NULL,
  registration_date DATE NOT NULL,
  valid_until DATE NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'suspended')),
  document_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================
-- US AGENTS TABLE
-- ================================================
CREATE TABLE IF NOT EXISTS us_agents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  agent_name TEXT NOT NULL,
  company_name TEXT NOT NULL,
  address TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  valid_from DATE NOT NULL,
  valid_until DATE NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'terminated')),
  contract_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================
-- AGENT ASSIGNMENTS TABLE
-- ================================================
CREATE TABLE IF NOT EXISTS agent_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fda_registration_id UUID NOT NULL REFERENCES fda_registrations(id) ON DELETE CASCADE,
  us_agent_id UUID NOT NULL REFERENCES us_agents(id) ON DELETE CASCADE,
  assigned_date DATE NOT NULL DEFAULT CURRENT_DATE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(fda_registration_id, us_agent_id)
);

-- ================================================
-- FACILITY UPDATE REQUESTS TABLE
-- ================================================
CREATE TABLE IF NOT EXISTS facility_update_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  requested_changes JSONB NOT NULL,
  reason TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================
-- PAYMENT TRANSACTIONS TABLE
-- ================================================
CREATE TABLE IF NOT EXISTS payment_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  package_id UUID REFERENCES service_packages(id),
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  payment_method TEXT NOT NULL,
  payment_gateway TEXT NOT NULL,
  transaction_id TEXT UNIQUE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================
-- FILE UPLOADS TABLE
-- ================================================
CREATE TABLE IF NOT EXISTS file_uploads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  uploaded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL,
  mime_type TEXT,
  entity_type TEXT,
  entity_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================
-- INVOICES TABLE
-- ================================================
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES company_subscriptions(id),
  invoice_number TEXT NOT NULL UNIQUE,
  amount DECIMAL(10,2) NOT NULL,
  tax DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),
  issue_date DATE NOT NULL,
  due_date DATE NOT NULL,
  paid_date DATE,
  pdf_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================
-- NOTIFICATION QUEUE TABLE
-- ================================================
CREATE TABLE IF NOT EXISTS notification_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================
-- CREATE INDEXES FOR PERFORMANCE
-- ================================================

-- Profiles indexes
CREATE INDEX IF NOT EXISTS idx_profiles_company_id ON profiles(company_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- Facilities indexes
CREATE INDEX IF NOT EXISTS idx_facilities_company_id ON facilities(company_id);
CREATE INDEX IF NOT EXISTS idx_facilities_type ON facilities(facility_type);

-- Products indexes
CREATE INDEX IF NOT EXISTS idx_products_company_id ON products(company_id);
CREATE INDEX IF NOT EXISTS idx_products_code ON products(product_code);

-- TLC indexes
CREATE INDEX IF NOT EXISTS idx_tlc_company_id ON traceability_lot_codes(company_id);
CREATE INDEX IF NOT EXISTS idx_tlc_product_id ON traceability_lot_codes(product_id);
CREATE INDEX IF NOT EXISTS idx_tlc_code ON traceability_lot_codes(tlc);
CREATE INDEX IF NOT EXISTS idx_tlc_status ON traceability_lot_codes(status);

-- CTE indexes
CREATE INDEX IF NOT EXISTS idx_cte_company_id ON critical_tracking_events(company_id);
CREATE INDEX IF NOT EXISTS idx_cte_tlc_id ON critical_tracking_events(tlc_id);
CREATE INDEX IF NOT EXISTS idx_cte_facility_id ON critical_tracking_events(facility_id);
CREATE INDEX IF NOT EXISTS idx_cte_event_type ON critical_tracking_events(event_type);
CREATE INDEX IF NOT EXISTS idx_cte_event_date ON critical_tracking_events(event_date);
CREATE INDEX IF NOT EXISTS idx_cte_status ON critical_tracking_events(status);

-- KDE indexes
CREATE INDEX IF NOT EXISTS idx_kde_cte_id ON key_data_elements(cte_id);
CREATE INDEX IF NOT EXISTS idx_kde_code ON key_data_elements(kde_code);

-- Shipments indexes
CREATE INDEX IF NOT EXISTS idx_shipments_company_id ON shipments(company_id);
CREATE INDEX IF NOT EXISTS idx_shipments_tlc_id ON shipments(tlc_id);
CREATE INDEX IF NOT EXISTS idx_shipments_status ON shipments(status);

-- System logs indexes
CREATE INDEX IF NOT EXISTS idx_logs_user_id ON system_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_logs_entity_type ON system_logs(entity_type);
CREATE INDEX IF NOT EXISTS idx_logs_created_at ON system_logs(created_at DESC);

-- Subscriptions indexes
CREATE INDEX IF NOT EXISTS idx_subscriptions_company_id ON company_subscriptions(company_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON company_subscriptions(status);

-- Inventory logs indexes
CREATE INDEX IF NOT EXISTS idx_inventory_logs_company_id ON inventory_balance_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_inventory_logs_tlc_id ON inventory_balance_logs(tlc_id);
CREATE INDEX IF NOT EXISTS idx_inventory_logs_created_at ON inventory_balance_logs(created_at DESC);

-- Add missing renewal_date column to fda_registrations table
-- This column tracks when FDA registrations need to be renewed

-- Add renewal_date column
ALTER TABLE fda_registrations 
ADD COLUMN IF NOT EXISTS renewal_date DATE;

-- Add comment for documentation
COMMENT ON COLUMN fda_registrations.renewal_date IS 'Date when the FDA registration needs to be renewed';

-- Create index for efficient querying by renewal date
CREATE INDEX IF NOT EXISTS idx_fda_registrations_renewal_date 
ON fda_registrations(renewal_date) 
WHERE renewal_date IS NOT NULL;

-- Update existing records: set renewal_date to valid_until date minus 30 days (reminder period)
-- This gives a 30-day warning before expiration
UPDATE fda_registrations 
SET renewal_date = (valid_until - INTERVAL '30 days')::DATE
WHERE renewal_date IS NULL AND valid_until IS NOT NULL;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Successfully added renewal_date column to fda_registrations table';
END $$;


-- ================================================
-- Add missing contact_person column to companies table
-- ================================================

-- Add contact_person column to companies table
ALTER TABLE companies 
ADD COLUMN IF NOT EXISTS contact_person TEXT;

-- Add comment
COMMENT ON COLUMN companies.contact_person IS 'Người liên hệ chính của công ty';

-- Add missing columns to companies table
-- These columns are required by the application code but missing from the current schema

-- Add registration_number column for company registration ID/tax ID
ALTER TABLE companies 
ADD COLUMN IF NOT EXISTS registration_number TEXT;

-- Add contact_person column for primary contact name
ALTER TABLE companies 
ADD COLUMN IF NOT EXISTS contact_person TEXT;

-- Add comments for documentation
COMMENT ON COLUMN companies.registration_number IS 'Company registration number or tax ID';
COMMENT ON COLUMN companies.contact_person IS 'Primary contact person name for the company';

-- Migration: Add package_code column to service_packages table
-- This column is used to identify service packages by code (FREE, STARTER, PROFESSIONAL, etc.)
-- Created: 2025-12-30

-- Add package_code column
ALTER TABLE service_packages 
ADD COLUMN IF NOT EXISTS package_code TEXT UNIQUE;

-- Update existing packages with their codes based on name
-- You should adjust these based on your actual package names
UPDATE service_packages 
SET package_code = CASE 
  WHEN LOWER(name) LIKE '%free%' OR LOWER(name) LIKE '%miễn phí%' THEN 'FREE'
  WHEN LOWER(name) LIKE '%starter%' OR LOWER(name) LIKE '%khởi đầu%' THEN 'STARTER'
  WHEN LOWER(name) LIKE '%professional%' OR LOWER(name) LIKE '%chuyên nghiệp%' THEN 'PROFESSIONAL'
  WHEN LOWER(name) LIKE '%business%' OR LOWER(name) LIKE '%doanh nghiệp%' THEN 'BUSINESS'
  WHEN LOWER(name) LIKE '%enterprise%' OR LOWER(name) LIKE '%tổ chức lớn%' THEN 'ENTERPRISE'
  ELSE 'CUSTOM'
END
WHERE package_code IS NULL;

-- Make package_code NOT NULL after populating existing data
ALTER TABLE service_packages 
ALTER COLUMN package_code SET NOT NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_service_packages_package_code 
ON service_packages(package_code);

-- Insert FREE package if it doesn't exist
INSERT INTO service_packages (
  package_code,
  name,
  description,
  price_monthly,
  price_yearly,
  limits,
  features,
  display_order,
  is_active
) VALUES (
  'FREE',
  'Free Plan',
  'Perfect for getting started with basic food traceability',
  0,
  0,
  '{
    "max_products": 10,
    "max_facilities": 2,
    "max_shipments_per_month": 20,
    "max_cte_per_month": 50,
    "max_users": 3,
    "storage_gb": 1
  }'::jsonb,
  '{
    "basic_traceability": true,
    "product_management": true,
    "facility_management": true,
    "shipment_tracking": true,
    "basic_reports": true,
    "email_support": false,
    "api_access": false,
    "custom_branding": false
  }'::jsonb,
  1,
  true
) ON CONFLICT (package_code) DO NOTHING;

-- Verify the FREE package exists
DO $$
DECLARE
  free_package_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO free_package_count
  FROM service_packages
  WHERE package_code = 'FREE';
  
  IF free_package_count > 0 THEN
    RAISE NOTICE 'FREE package verified: % record(s) found', free_package_count;
  ELSE
    RAISE WARNING 'FREE package not found after migration!';
  END IF;
END $$;
-- Add all missing columns to fda_registrations table
-- This fixes the schema mismatch between code and database

-- Add location details
ALTER TABLE fda_registrations 
ADD COLUMN IF NOT EXISTS facility_city TEXT,
ADD COLUMN IF NOT EXISTS facility_state TEXT,
ADD COLUMN IF NOT EXISTS facility_zip_code TEXT,
ADD COLUMN IF NOT EXISTS facility_country TEXT DEFAULT 'Vietnam';

-- Add owner/operator information
ALTER TABLE fda_registrations 
ADD COLUMN IF NOT EXISTS owner_operator_name TEXT;

-- Add FDA specific identifiers
ALTER TABLE fda_registrations 
ADD COLUMN IF NOT EXISTS fei_number TEXT,
ADD COLUMN IF NOT EXISTS duns_number TEXT;

-- Add facility and product classification
ALTER TABLE fda_registrations 
ADD COLUMN IF NOT EXISTS facility_type_fda TEXT[],
ADD COLUMN IF NOT EXISTS food_product_categories TEXT[];

-- Add contact information
ALTER TABLE fda_registrations 
ADD COLUMN IF NOT EXISTS contact_name TEXT NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS contact_email TEXT NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS contact_phone TEXT NOT NULL DEFAULT '';

-- Add inspection tracking
ALTER TABLE fda_registrations 
ADD COLUMN IF NOT EXISTS last_inspection_date DATE,
ADD COLUMN IF NOT EXISTS next_inspection_date DATE;

-- Add notification settings
ALTER TABLE fda_registrations 
ADD COLUMN IF NOT EXISTS notification_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS notification_days_before INTEGER DEFAULT 30;

-- Add comments for documentation
COMMENT ON COLUMN fda_registrations.facility_city IS 'City where the facility is located';
COMMENT ON COLUMN fda_registrations.facility_state IS 'State/Province where the facility is located';
COMMENT ON COLUMN fda_registrations.facility_zip_code IS 'Postal/ZIP code of the facility';
COMMENT ON COLUMN fda_registrations.facility_country IS 'Country where the facility is located';
COMMENT ON COLUMN fda_registrations.owner_operator_name IS 'Legal name of the facility owner/operator';
COMMENT ON COLUMN fda_registrations.fei_number IS 'FDA Facility Establishment Identifier (10 digits)';
COMMENT ON COLUMN fda_registrations.duns_number IS 'Dun & Bradstreet DUNS number (9 digits)';
COMMENT ON COLUMN fda_registrations.facility_type_fda IS 'FDA facility type classifications';
COMMENT ON COLUMN fda_registrations.food_product_categories IS 'Categories of food products handled';
COMMENT ON COLUMN fda_registrations.contact_name IS 'Primary contact person name';
COMMENT ON COLUMN fda_registrations.contact_email IS 'Primary contact email address';
COMMENT ON COLUMN fda_registrations.contact_phone IS 'Primary contact phone number';
COMMENT ON COLUMN fda_registrations.last_inspection_date IS 'Date of last FDA inspection';
COMMENT ON COLUMN fda_registrations.next_inspection_date IS 'Scheduled date for next inspection';
COMMENT ON COLUMN fda_registrations.notification_enabled IS 'Whether to send renewal reminder notifications';
COMMENT ON COLUMN fda_registrations.notification_days_before IS 'Days before expiry to send notifications';

-- Update existing records with default contact info from company if available
UPDATE fda_registrations fr
SET 
  contact_email = COALESCE(fr.contact_email, c.email, ''),
  contact_phone = COALESCE(fr.contact_phone, c.phone, ''),
  contact_name = COALESCE(fr.contact_name, c.contact_person, '')
FROM companies c
WHERE fr.company_id = c.id
  AND (fr.contact_email IS NULL OR fr.contact_email = '' OR 
       fr.contact_phone IS NULL OR fr.contact_phone = '' OR
       fr.contact_name IS NULL OR fr.contact_name = '');

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_fda_registrations_facility_country ON fda_registrations(facility_country);
CREATE INDEX IF NOT EXISTS idx_fda_registrations_fei_number ON fda_registrations(fei_number) WHERE fei_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_fda_registrations_notification ON fda_registrations(notification_enabled, renewal_date) WHERE notification_enabled = true;
CREATE INDEX IF NOT EXISTS idx_fda_registrations_contact_email ON fda_registrations(contact_email);

-- Log the migration
DO $$
BEGIN
  RAISE NOTICE 'Successfully added all missing columns to fda_registrations table';
  RAISE NOTICE 'Added location fields: facility_city, facility_state, facility_zip_code, facility_country';
  RAISE NOTICE 'Added owner info: owner_operator_name';
  RAISE NOTICE 'Added FDA IDs: fei_number, duns_number';
  RAISE NOTICE 'Added classifications: facility_type_fda, food_product_categories';
  RAISE NOTICE 'Added contact fields: contact_name, contact_email, contact_phone';
  RAISE NOTICE 'Added inspection tracking: last_inspection_date, next_inspection_date';
  RAISE NOTICE 'Added notification settings: notification_enabled, notification_days_before';
END $$;

-- Add expiry_date column to fda_registrations table
-- This is used throughout the codebase (106 references) while the database has valid_until
-- We'll add expiry_date and sync it with valid_until

-- Add the expiry_date column
ALTER TABLE fda_registrations 
ADD COLUMN IF NOT EXISTS expiry_date DATE;

-- Copy existing valid_until data to expiry_date
UPDATE fda_registrations 
SET expiry_date = valid_until 
WHERE expiry_date IS NULL;

-- Create a trigger to keep expiry_date and valid_until in sync
CREATE OR REPLACE FUNCTION sync_fda_expiry_date()
RETURNS TRIGGER AS $$
BEGIN
  -- If expiry_date is updated, sync to valid_until
  IF NEW.expiry_date IS DISTINCT FROM OLD.expiry_date THEN
    NEW.valid_until := NEW.expiry_date;
  END IF;
  
  -- If valid_until is updated, sync to expiry_date
  IF NEW.valid_until IS DISTINCT FROM OLD.valid_until THEN
    NEW.expiry_date := NEW.valid_until;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS sync_fda_expiry_date_trigger ON fda_registrations;
CREATE TRIGGER sync_fda_expiry_date_trigger
  BEFORE INSERT OR UPDATE ON fda_registrations
  FOR EACH ROW
  EXECUTE FUNCTION sync_fda_expiry_date();

-- Add index for expiry_date queries
CREATE INDEX IF NOT EXISTS idx_fda_registrations_expiry_date ON fda_registrations(expiry_date);

-- Add comment
COMMENT ON COLUMN fda_registrations.expiry_date IS 'FDA registration expiration date (synced with valid_until)';

-- Add missing columns to us_agents table to match the application code

-- Add agent_company_name (separate from company_name which is the US Agent company)
ALTER TABLE us_agents ADD COLUMN IF NOT EXISTS agent_company_name TEXT;

-- Add agent_type to specify if the agent is Individual or Company
ALTER TABLE us_agents ADD COLUMN IF NOT EXISTS agent_type TEXT NOT NULL DEFAULT 'individual' 
  CHECK (agent_type IN ('individual', 'company'));

-- Add contract_status (more descriptive than just 'status')
ALTER TABLE us_agents ADD COLUMN IF NOT EXISTS contract_status TEXT NOT NULL DEFAULT 'active' 
  CHECK (contract_status IN ('active', 'expired', 'terminated', 'pending', 'cancelled'));

-- Add city, state, zip_code for more detailed address information
ALTER TABLE us_agents ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE us_agents ADD COLUMN IF NOT EXISTS state TEXT;
ALTER TABLE us_agents ADD COLUMN IF NOT EXISTS zip_code TEXT;

-- Add country column (typically 'USA' for US agents)
ALTER TABLE us_agents ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'USA';

-- Add expiry_date to match the pattern used in FDA registrations
ALTER TABLE us_agents ADD COLUMN IF NOT EXISTS expiry_date DATE;

-- Add is_primary to mark primary US agent for a company
ALTER TABLE us_agents ADD COLUMN IF NOT EXISTS is_primary BOOLEAN NOT NULL DEFAULT false;

-- Add is_active to track active status separately from contract_status
ALTER TABLE us_agents ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- Sync existing data
-- Copy status to contract_status for existing records
UPDATE us_agents SET contract_status = status WHERE contract_status = 'active';

-- Copy valid_until to expiry_date for existing records
UPDATE us_agents SET expiry_date = valid_until WHERE expiry_date IS NULL;

-- Set default country to USA for existing records
UPDATE us_agents SET country = 'USA' WHERE country IS NULL;

-- Set is_active based on contract_status for existing records
UPDATE us_agents SET is_active = (contract_status = 'active') WHERE is_active = true;

-- Create trigger to keep expiry_date and valid_until in sync
CREATE OR REPLACE FUNCTION sync_us_agent_expiry_date()
RETURNS TRIGGER AS $$
BEGIN
  -- If expiry_date is updated, update valid_until
  IF NEW.expiry_date IS DISTINCT FROM OLD.expiry_date THEN
    NEW.valid_until := NEW.expiry_date;
  END IF;
  
  -- If valid_until is updated, update expiry_date
  IF NEW.valid_until IS DISTINCT FROM OLD.valid_until THEN
    NEW.expiry_date := NEW.valid_until;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_us_agent_expiry_date_trigger ON us_agents;
CREATE TRIGGER sync_us_agent_expiry_date_trigger
  BEFORE UPDATE ON us_agents
  FOR EACH ROW
  EXECUTE FUNCTION sync_us_agent_expiry_date();

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_us_agents_contract_status ON us_agents(contract_status);
CREATE INDEX IF NOT EXISTS idx_us_agents_agent_type ON us_agents(agent_type);
CREATE INDEX IF NOT EXISTS idx_us_agents_expiry_date ON us_agents(expiry_date);
CREATE INDEX IF NOT EXISTS idx_us_agents_country ON us_agents(country);
-- Add indexes for new boolean columns
CREATE INDEX IF NOT EXISTS idx_us_agents_is_primary ON us_agents(is_primary);
CREATE INDEX IF NOT EXISTS idx_us_agents_is_active ON us_agents(is_active);

-- Add comment for documentation
COMMENT ON COLUMN us_agents.agent_company_name IS 'Company name of the agent (if agent_type is company)';
COMMENT ON COLUMN us_agents.agent_type IS 'Type of agent: individual or company';
COMMENT ON COLUMN us_agents.contract_status IS 'Contract status: active, expired, terminated, pending, cancelled';
COMMENT ON COLUMN us_agents.country IS 'Country where the agent is located (typically USA for US agents)';
COMMENT ON COLUMN us_agents.expiry_date IS 'Date when the agent contract expires (synced with valid_until)';
-- Add comments for new columns
COMMENT ON COLUMN us_agents.is_primary IS 'Indicates if this is the primary US agent for a company';
COMMENT ON COLUMN us_agents.is_active IS 'Indicates if the agent is currently active';
-- Add street_address column to us_agents table
-- This fixes the schema mismatch where code uses 'street_address' but DB has 'address'

-- Add street_address column
ALTER TABLE us_agents
ADD COLUMN IF NOT EXISTS street_address text;

-- Copy data from existing 'address' column to 'street_address'
UPDATE us_agents
SET street_address = address
WHERE street_address IS NULL;

-- Make street_address NOT NULL now that data is populated
ALTER TABLE us_agents
ALTER COLUMN street_address SET NOT NULL;

-- Create trigger to keep 'address' and 'street_address' in sync
-- This ensures backward compatibility if any code still uses 'address'
CREATE OR REPLACE FUNCTION sync_us_agents_address()
RETURNS TRIGGER AS $$
BEGIN
  -- If street_address is updated, sync to address
  IF NEW.street_address IS DISTINCT FROM OLD.street_address THEN
    NEW.address := NEW.street_address;
  END IF;
  
  -- If address is updated, sync to street_address
  IF NEW.address IS DISTINCT FROM OLD.address THEN
    NEW.street_address := NEW.address;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_us_agents_address_trigger ON us_agents;
CREATE TRIGGER sync_us_agents_address_trigger
  BEFORE UPDATE ON us_agents
  FOR EACH ROW
  EXECUTE FUNCTION sync_us_agents_address();

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_us_agents_street_address ON us_agents(street_address);

-- Log completion
DO $$
BEGIN
  RAISE NOTICE 'Successfully added street_address column to us_agents table';
  RAISE NOTICE 'Created trigger to sync address and street_address';
END $$;

-- Add fda_registration_number column and sync with registration_number
-- This maintains backward compatibility while supporting the new column name used in code

-- Add fda_registration_number column (nullable to avoid NOT NULL constraint issues)
ALTER TABLE fda_registrations 
ADD COLUMN IF NOT EXISTS fda_registration_number TEXT;

-- Copy existing data from registration_number to fda_registration_number
UPDATE fda_registrations 
SET fda_registration_number = registration_number
WHERE fda_registration_number IS NULL;

-- Create trigger to keep both columns synchronized
CREATE OR REPLACE FUNCTION sync_fda_registration_number()
RETURNS TRIGGER AS $$
BEGIN
  -- When fda_registration_number is updated, sync to registration_number
  IF NEW.fda_registration_number IS DISTINCT FROM OLD.fda_registration_number THEN
    NEW.registration_number = COALESCE(NEW.fda_registration_number, NEW.registration_number);
  END IF;
  
  -- When registration_number is updated, sync to fda_registration_number
  IF NEW.registration_number IS DISTINCT FROM OLD.registration_number THEN
    NEW.fda_registration_number = COALESCE(NEW.registration_number, NEW.fda_registration_number);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS sync_fda_registration_number_trigger ON fda_registrations;
CREATE TRIGGER sync_fda_registration_number_trigger
  BEFORE INSERT OR UPDATE ON fda_registrations
  FOR EACH ROW
  EXECUTE FUNCTION sync_fda_registration_number();

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_fda_registrations_fda_registration_number 
ON fda_registrations(fda_registration_number);

-- Make registration_number nullable for flexibility (since we have fda_registration_number now)
ALTER TABLE fda_registrations 
ALTER COLUMN registration_number DROP NOT NULL;

-- Add comment
COMMENT ON COLUMN fda_registrations.fda_registration_number IS 'FDA Registration Number (synced with registration_number for backward compatibility)';

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
