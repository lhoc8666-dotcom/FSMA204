-- ================================================
-- Add Missing Tables to Complete Database Schema
-- ================================================

-- ================================================
-- ACTIVITY LOGS TABLE
-- ================================================
CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  description TEXT,
  changes JSONB DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_company_id ON activity_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);

-- ================================================
-- ALERT RULES TABLE
-- ================================================
CREATE TABLE IF NOT EXISTS alert_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  rule_name TEXT NOT NULL,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('inventory_low', 'expiry_warning', 'temperature_alert', 'compliance_alert', 'custom')),
  conditions JSONB NOT NULL DEFAULT '{}',
  threshold_value DECIMAL(12,3),
  severity TEXT DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  notification_channels JSONB DEFAULT '["email"]',
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alert_rules_company_id ON alert_rules(company_id);
CREATE INDEX IF NOT EXISTS idx_alert_rules_type ON alert_rules(rule_type);

-- ================================================
-- ALERT LOGS TABLE
-- ================================================
CREATE TABLE IF NOT EXISTS alert_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  alert_rule_id UUID REFERENCES alert_rules(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  triggered_at TIMESTAMPTZ DEFAULT NOW(),
  alert_message TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  entity_type TEXT,
  entity_id UUID,
  is_resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES profiles(id),
  resolution_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alert_logs_rule_id ON alert_logs(alert_rule_id);
CREATE INDEX IF NOT EXISTS idx_alert_logs_company_id ON alert_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_alert_logs_triggered_at ON alert_logs(triggered_at DESC);

-- ================================================
-- AUDIT LOGS TABLE
-- ================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  old_values JSONB,
  new_values JSONB,
  changes_summary TEXT,
  ip_address TEXT,
  user_agent TEXT,
  session_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_company_id ON audit_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- ================================================
-- AUDIT REPORTS TABLE
-- ================================================
CREATE TABLE IF NOT EXISTS audit_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  report_name TEXT NOT NULL,
  report_type TEXT NOT NULL CHECK (report_type IN ('compliance', 'inventory', 'traceability', 'system', 'custom')),
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  generated_by UUID REFERENCES profiles(id),
  report_data JSONB NOT NULL DEFAULT '{}',
  summary TEXT,
  file_url TEXT,
  status TEXT DEFAULT 'completed' CHECK (status IN ('generating', 'completed', 'failed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_reports_company_id ON audit_reports(company_id);
CREATE INDEX IF NOT EXISTS idx_audit_reports_type ON audit_reports(report_type);
CREATE INDEX IF NOT EXISTS idx_audit_reports_created_at ON audit_reports(created_at DESC);

-- ================================================
-- CHRONOLOGICAL ORDER VALIDATIONS TABLE
-- ================================================
CREATE TABLE IF NOT EXISTS chronological_order_validations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  tlc_id UUID REFERENCES traceability_lot_codes(id) ON DELETE CASCADE,
  validation_date TIMESTAMPTZ DEFAULT NOW(),
  is_valid BOOLEAN NOT NULL,
  validation_errors JSONB DEFAULT '[]',
  validated_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chronological_validations_company ON chronological_order_validations(company_id);
CREATE INDEX IF NOT EXISTS idx_chronological_validations_tlc ON chronological_order_validations(tlc_id);

-- ================================================
-- DATA EXPORT LOGS TABLE
-- ================================================
CREATE TABLE IF NOT EXISTS data_export_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  exported_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  export_type TEXT NOT NULL CHECK (export_type IN ('csv', 'excel', 'pdf', 'json', 'xml')),
  entity_type TEXT NOT NULL,
  filters JSONB DEFAULT '{}',
  record_count INTEGER NOT NULL DEFAULT 0,
  file_url TEXT,
  file_size_bytes BIGINT,
  status TEXT DEFAULT 'completed' CHECK (status IN ('processing', 'completed', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_data_export_logs_company ON data_export_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_data_export_logs_created_at ON data_export_logs(created_at DESC);

-- ================================================
-- EXPORTER FACILITIES TABLE
-- ================================================
CREATE TABLE IF NOT EXISTS exporter_facilities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  facility_id UUID REFERENCES facilities(id) ON DELETE CASCADE,
  exporter_name TEXT NOT NULL,
  exporter_address TEXT NOT NULL,
  export_license_number TEXT,
  license_valid_from DATE,
  license_valid_until DATE,
  destination_countries TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(facility_id, exporter_name)
);

CREATE INDEX IF NOT EXISTS idx_exporter_facilities_company ON exporter_facilities(company_id);
CREATE INDEX IF NOT EXISTS idx_exporter_facilities_facility ON exporter_facilities(facility_id);

-- ================================================
-- KDE REQUIREMENTS TABLE
-- ================================================
CREATE TABLE IF NOT EXISTS kde_requirements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type TEXT NOT NULL,
  kde_code TEXT NOT NULL,
  kde_name TEXT NOT NULL,
  description TEXT,
  is_required BOOLEAN DEFAULT TRUE,
  data_type TEXT DEFAULT 'text' CHECK (data_type IN ('text', 'number', 'date', 'boolean', 'select')),
  validation_rules JSONB DEFAULT '{}',
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_type, kde_code)
);

CREATE INDEX IF NOT EXISTS idx_kde_requirements_event_type ON kde_requirements(event_type);

-- ================================================
-- NOTIFICATIONS TABLE (replacing notification_queue)
-- ================================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  entity_type TEXT,
  entity_id UUID,
  action_url TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_company_id ON notifications(company_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- ================================================
-- REPORT TEMPLATES TABLE
-- ================================================
CREATE TABLE IF NOT EXISTS report_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  template_name TEXT NOT NULL,
  report_type TEXT NOT NULL CHECK (report_type IN ('traceability', 'inventory', 'compliance', 'shipment', 'custom')),
  description TEXT,
  template_config JSONB NOT NULL DEFAULT '{}',
  fields_config JSONB NOT NULL DEFAULT '[]',
  is_system_template BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_report_templates_company ON report_templates(company_id);
CREATE INDEX IF NOT EXISTS idx_report_templates_type ON report_templates(report_type);

-- ================================================
-- SCHEDULED REPORTS TABLE
-- ================================================
CREATE TABLE IF NOT EXISTS scheduled_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  template_id UUID REFERENCES report_templates(id) ON DELETE CASCADE,
  report_name TEXT NOT NULL,
  schedule_config JSONB NOT NULL DEFAULT '{}',
  frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly', 'quarterly', 'yearly')),
  recipients TEXT[] NOT NULL DEFAULT '{}',
  filters JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scheduled_reports_company ON scheduled_reports(company_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_next_run ON scheduled_reports(next_run_at);

-- ================================================
-- SHIPMENT ITEMS TABLE
-- ================================================
CREATE TABLE IF NOT EXISTS shipment_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  tlc_id UUID NOT NULL REFERENCES traceability_lot_codes(id) ON DELETE RESTRICT,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity DECIMAL(12,3) NOT NULL,
  unit TEXT NOT NULL DEFAULT 'kg',
  package_count INTEGER,
  package_type TEXT,
  lot_code TEXT,
  expiration_date DATE,
  temperature_recorded DECIMAL(5,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shipment_items_shipment ON shipment_items(shipment_id);
CREATE INDEX IF NOT EXISTS idx_shipment_items_tlc ON shipment_items(tlc_id);
CREATE INDEX IF NOT EXISTS idx_shipment_items_product ON shipment_items(product_id);

-- ================================================
-- SUBSCRIPTION AUDIT LOGS TABLE
-- ================================================
CREATE TABLE IF NOT EXISTS subscription_audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subscription_id UUID REFERENCES company_subscriptions(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  old_status TEXT,
  new_status TEXT,
  old_package_id UUID,
  new_package_id UUID,
  changes JSONB DEFAULT '{}',
  performed_by UUID REFERENCES profiles(id),
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscription_audit_logs_subscription ON subscription_audit_logs(subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_audit_logs_company ON subscription_audit_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_subscription_audit_logs_created_at ON subscription_audit_logs(created_at DESC);

-- ================================================
-- SUBSCRIPTION OVERRIDE AUDIT LOGS TABLE
-- ================================================
CREATE TABLE IF NOT EXISTS subscription_override_audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  override_id UUID REFERENCES company_subscription_overrides(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  old_limits JSONB,
  new_limits JSONB,
  old_features JSONB,
  new_features JSONB,
  changes_summary TEXT,
  performed_by UUID REFERENCES profiles(id),
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscription_override_audit_logs_override ON subscription_override_audit_logs(override_id);
CREATE INDEX IF NOT EXISTS idx_subscription_override_audit_logs_company ON subscription_override_audit_logs(company_id);

-- ================================================
-- SYSTEM SETTINGS TABLE
-- ================================================
CREATE TABLE IF NOT EXISTS system_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  setting_key TEXT NOT NULL UNIQUE,
  setting_value JSONB NOT NULL,
  setting_type TEXT NOT NULL CHECK (setting_type IN ('system', 'company', 'user', 'feature')),
  description TEXT,
  is_public BOOLEAN DEFAULT FALSE,
  is_editable BOOLEAN DEFAULT TRUE,
  updated_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_settings_key ON system_settings(setting_key);
CREATE INDEX IF NOT EXISTS idx_system_settings_type ON system_settings(setting_type);

-- ================================================
-- TRANSFORMATION EVENTS TABLE
-- ================================================
CREATE TABLE IF NOT EXISTS transformation_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  cte_id UUID REFERENCES critical_tracking_events(id) ON DELETE CASCADE,
  transformation_type TEXT NOT NULL CHECK (transformation_type IN ('cutting', 'mixing', 'cooking', 'packing', 'processing', 'other')),
  input_tlcs UUID[] NOT NULL DEFAULT '{}',
  output_tlc_id UUID REFERENCES traceability_lot_codes(id) ON DELETE RESTRICT,
  yield_percentage DECIMAL(5,2),
  waste_percentage DECIMAL(5,2),
  transformation_date TIMESTAMPTZ NOT NULL,
  operator_name TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transformation_events_company ON transformation_events(company_id);
CREATE INDEX IF NOT EXISTS idx_transformation_events_cte ON transformation_events(cte_id);
CREATE INDEX IF NOT EXISTS idx_transformation_events_output_tlc ON transformation_events(output_tlc_id);

-- ================================================
-- RENAME notification_queue to notifications (if exists)
-- ================================================
-- Note: If notification_queue already exists, you may need to migrate data
-- DROP TABLE IF EXISTS notification_queue CASCADE;

COMMENT ON TABLE activity_logs IS 'Logs all user activities in the system';
COMMENT ON TABLE alert_rules IS 'Configurable alert rules for monitoring';
COMMENT ON TABLE alert_logs IS 'History of triggered alerts';
COMMENT ON TABLE audit_logs IS 'Detailed audit trail for all changes';
COMMENT ON TABLE audit_reports IS 'Generated audit reports';
COMMENT ON TABLE chronological_order_validations IS 'Validation of event chronological order';
COMMENT ON TABLE data_export_logs IS 'Track all data exports';
COMMENT ON TABLE exporter_facilities IS 'Export facilities and licenses';
COMMENT ON TABLE kde_requirements IS 'Key Data Element requirements by event type';
COMMENT ON TABLE notifications IS 'User notifications';
COMMENT ON TABLE report_templates IS 'Reusable report templates';
COMMENT ON TABLE scheduled_reports IS 'Automated scheduled reports';
COMMENT ON TABLE shipment_items IS 'Individual items in shipments';
COMMENT ON TABLE subscription_audit_logs IS 'Audit trail for subscription changes';
COMMENT ON TABLE subscription_override_audit_logs IS 'Audit trail for subscription override changes';
COMMENT ON TABLE system_settings IS 'System-wide and company-specific settings';
COMMENT ON TABLE transformation_events IS 'Product transformation events';
