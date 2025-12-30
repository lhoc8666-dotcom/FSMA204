-- ================================================
-- DATABASE FUNCTIONS AND TRIGGERS
-- ================================================

-- ================================================
-- FUNCTION: Update updated_at timestamp
-- ================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ================================================
-- TRIGGERS: Auto-update updated_at on all tables
-- ================================================
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_facilities_updated_at BEFORE UPDATE ON facilities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tlc_updated_at BEFORE UPDATE ON traceability_lot_codes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cte_updated_at BEFORE UPDATE ON critical_tracking_events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON company_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ================================================
-- FUNCTION: Validate chronological order of CTEs
-- ================================================
CREATE OR REPLACE FUNCTION check_tlc_chronological(
  p_tlc_id UUID,
  p_event_type TEXT,
  p_event_date TIMESTAMPTZ
)
RETURNS TABLE(is_valid BOOLEAN, message TEXT) AS $$
DECLARE
  v_last_event RECORD;
BEGIN
  -- Get the last CTE for this TLC
  SELECT event_type, event_date INTO v_last_event
  FROM critical_tracking_events
  WHERE tlc_id = p_tlc_id
  ORDER BY event_date DESC, created_at DESC
  LIMIT 1;

  -- If no previous events, always valid
  IF v_last_event IS NULL THEN
    RETURN QUERY SELECT TRUE, 'No previous events'::TEXT;
    RETURN;
  END IF;

  -- Check if new event is after last event
  IF p_event_date < v_last_event.event_date THEN
    RETURN QUERY SELECT 
      FALSE, 
      format('Event date %s is before last event %s on %s', 
        p_event_date, 
        v_last_event.event_type, 
        v_last_event.event_date
      );
    RETURN;
  END IF;

  RETURN QUERY SELECT TRUE, 'Chronological order is valid'::TEXT;
END;
$$ LANGUAGE plpgsql;

-- ================================================
-- FUNCTION: Calculate company storage usage
-- ================================================
CREATE OR REPLACE FUNCTION get_company_storage_usage(p_company_id UUID)
RETURNS BIGINT AS $$
  SELECT COALESCE(SUM(file_size_bytes), 0)
  FROM file_uploads
  WHERE company_id = p_company_id;
$$ LANGUAGE SQL STABLE;

-- ================================================
-- FUNCTION: Get company active user count
-- ================================================
CREATE OR REPLACE FUNCTION get_company_user_count(p_company_id UUID)
RETURNS INTEGER AS $$
  SELECT COUNT(*)::INTEGER
  FROM profiles
  WHERE company_id = p_company_id AND is_active = TRUE;
$$ LANGUAGE SQL STABLE;

-- ================================================
-- MATERIALIZED VIEW: Company Dashboard Metrics
-- ================================================
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_company_dashboard_metrics AS
SELECT 
  c.id AS company_id,
  c.name AS company_name,
  COUNT(DISTINCT f.id) AS total_facilities,
  COUNT(DISTINCT p.id) AS total_products,
  COUNT(DISTINCT tlc.id) AS total_tlcs,
  COUNT(DISTINCT cte.id) AS total_ctes,
  COUNT(DISTINCT CASE WHEN cte.created_at >= NOW() - INTERVAL '30 days' THEN cte.id END) AS ctes_last_30_days,
  MAX(cte.created_at) AS last_cte_date
FROM companies c
LEFT JOIN facilities f ON f.company_id = c.id AND f.is_active = TRUE
LEFT JOIN products p ON p.company_id = c.id AND p.is_active = TRUE
LEFT JOIN traceability_lot_codes tlc ON tlc.company_id = c.id
LEFT JOIN critical_tracking_events cte ON cte.company_id = c.id
GROUP BY c.id, c.name;

-- Create index on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS mv_company_dashboard_metrics_company_id 
  ON mv_company_dashboard_metrics(company_id);

-- ================================================
-- MATERIALIZED VIEW: Compliance Alerts
-- ================================================
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_compliance_alerts AS
SELECT
  c.id AS company_id,
  'missing_kde' AS alert_type,
  'high' AS severity,
  format('CTE %s is missing required KDEs', cte.id) AS message,
  cte.id AS reference_id,
  'critical_tracking_event' AS reference_type,
  cte.created_at
FROM companies c
JOIN critical_tracking_events cte ON cte.company_id = c.id
WHERE cte.status = 'submitted'
AND (
  SELECT COUNT(*) FROM key_data_elements kde 
  WHERE kde.cte_id = cte.id AND kde.is_required = TRUE
) < 5

UNION ALL

SELECT
  c.id AS company_id,
  'inventory_negative' AS alert_type,
  'critical' AS severity,
  format('TLC %s has negative inventory', tlc.tlc) AS message,
  tlc.id AS reference_id,
  'traceability_lot' AS reference_type,
  tlc.updated_at AS created_at
FROM companies c
JOIN traceability_lot_codes tlc ON tlc.company_id = c.id
WHERE tlc.available_quantity < 0

UNION ALL

-- Fixed EXTRACT function - cast timestamp to date first, then subtract to get interval
SELECT
  c.id AS company_id,
  'fda_expiring' AS alert_type,
  'medium' AS severity,
  format('FDA Registration %s expires in %s days', fda.registration_number, 
    (fda.valid_until::date - CURRENT_DATE)::text) AS message,
  fda.id AS reference_id,
  'fda_registration' AS reference_type,
  fda.created_at
FROM companies c
JOIN fda_registrations fda ON fda.company_id = c.id
WHERE fda.status = 'active'
AND fda.valid_until::date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days';

-- Create index on materialized view
CREATE INDEX IF NOT EXISTS mv_compliance_alerts_company_id 
  ON mv_compliance_alerts(company_id);

-- ================================================
-- FUNCTION: Refresh materialized views
-- ================================================
CREATE OR REPLACE FUNCTION refresh_materialized_views()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_company_dashboard_metrics;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_compliance_alerts;
END;
$$ LANGUAGE plpgsql;
