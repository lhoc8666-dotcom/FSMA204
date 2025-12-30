-- ================================================
-- SEED DATA: Initial service packages and demo data
-- ================================================

-- ================================================
-- Insert Service Packages
-- ================================================
INSERT INTO service_packages (name, description, price_monthly, price_yearly, limits, features, display_order, is_active) VALUES
('Free', 'Gói miễn phí dùng thử', 0, 0, 
  '{"max_users": 2, "max_facilities": 1, "max_products": 5, "max_storage_gb": 1}'::jsonb,
  '{"cte_tracking": true, "fsma_204_report": false, "fda_registration": false, "us_agent": false, "api_access": false, "custom_branding": false, "priority_support": false}'::jsonb,
  1, TRUE),

('Starter', 'Gói khởi đầu cho doanh nghiệp nhỏ', 29, 290,
  '{"max_users": 5, "max_facilities": 3, "max_products": 20, "max_storage_gb": 5}'::jsonb,
  '{"cte_tracking": true, "fsma_204_report": true, "fda_registration": false, "us_agent": false, "api_access": false, "custom_branding": false, "priority_support": false}'::jsonb,
  2, TRUE),

('Professional', 'Gói chuyên nghiệp', 99, 990,
  '{"max_users": 20, "max_facilities": 10, "max_products": 100, "max_storage_gb": 50}'::jsonb,
  '{"cte_tracking": true, "fsma_204_report": true, "fda_registration": true, "us_agent": true, "api_access": true, "custom_branding": false, "priority_support": false}'::jsonb,
  3, TRUE),

('Business', 'Gói doanh nghiệp', 299, 2990,
  '{"max_users": 100, "max_facilities": 50, "max_products": 500, "max_storage_gb": 200}'::jsonb,
  '{"cte_tracking": true, "fsma_204_report": true, "fda_registration": true, "us_agent": true, "api_access": true, "custom_branding": true, "priority_support": true}'::jsonb,
  4, TRUE),

('Enterprise', 'Gói doanh nghiệp lớn', 999, 9990,
  '{"max_users": -1, "max_facilities": -1, "max_products": -1, "max_storage_gb": 1000}'::jsonb,
  '{"cte_tracking": true, "fsma_204_report": true, "fda_registration": true, "us_agent": true, "api_access": true, "custom_branding": true, "priority_support": true}'::jsonb,
  5, TRUE)
ON CONFLICT (name) DO NOTHING;

-- ================================================
-- Note: Demo company and user data should be created
-- through the application sign-up flow, not via SQL
-- This ensures proper auth.users creation
-- ================================================
