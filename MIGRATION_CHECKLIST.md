# Migration Checklist - Food Traceability System

Danh sách các migration scripts cần chạy theo thứ tự để khắc phục tất cả lỗi thiếu cột và RLS policies.

## Thứ tự chạy migration:

### 1. Profiles Table
- [x] `05_add_language_preference.sql` - Thêm cột language_preference
- [x] `06_add_missing_profile_columns.sql` - Thêm organization_type, allowed_cte_types
- [x] `07_fix_profile_insert_policy.sql` - Fix RLS INSERT policy cho profiles

### 2. Companies Table
- [x] `09_add_companies_missing_columns.sql` - Thêm registration_number, contact_person

### 3. Service Packages Table
- [x] `10_add_package_code_to_service_packages.sql` - Thêm package_code và tạo gói FREE

### 4. FDA Registrations Table
- [x] `11_add_fda_registration_renewal_date.sql` - Thêm renewal_date
- [x] `12_add_all_missing_fda_columns.sql` - Thêm 16 cột: facility_city, contact_name, etc.
- [x] `13_add_expiry_date_to_fda_registrations.sql` - Thêm expiry_date và sync với valid_until
- [x] `21_add_fda_registration_number.sql` - Thêm fda_registration_number và sync
- [x] `22_add_fda_registration_status.sql` - Thêm registration_status và sync
- [x] `23_fix_fda_registrations_rls_policies.sql` - Fix RLS policies (SELECT, INSERT, UPDATE, DELETE)

### 5. US Agents Table
- [x] `14_add_missing_us_agents_columns.sql` - Thêm agent_company_name, agent_type, contract_status, city, state, zip_code, country, expiry_date, is_primary, is_active
- [x] `15_add_street_address_to_us_agents.sql` - Thêm street_address và sync với address
- [x] `16_fix_us_agents_rls_policies.sql` - Fix RLS policies
- [x] `17_fix_us_agents_company_id_constraint.sql` - Cho phép company_id NULL
- [x] `18_sync_us_agents_company_name.sql` - Sync company_name và agent_company_name
- [x] `19_sync_us_agents_address.sql` - Sync address và street_address
- [x] `20_fix_all_us_agents_not_null_constraints.sql` - Fix tất cả NOT NULL constraints

### 6. Agent Assignments Table (QUAN TRỌNG!)
- [ ] `24_add_agent_assignments_rls_policies.sql` - Thêm RLS policies (SELECT, INSERT, UPDATE, DELETE)
- [ ] `25_add_missing_agent_assignment_columns.sql` - Thêm company_id, assignment_date, assignment_years, expiry_date, status

### 7. Facility Update Requests Table
- [ ] `26_add_facility_update_request_status.sql` - Thêm request_status và sync với status

### 8. Missing Tables (Nếu cần)
- [ ] `08_add_missing_tables.sql` - Thêm 17 bảng còn thiếu (activity_logs, alert_logs, etc.)

## Kiểm tra sau khi chạy migration:

### Kiểm tra Agent Assignment có hoạt động:
\`\`\`sql
-- 1. Kiểm tra bảng agent_assignments có đủ cột
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'agent_assignments' 
ORDER BY ordinal_position;

-- Cần có: id, us_agent_id, company_id, fda_registration_id, 
--         assigned_date, assignment_date, assignment_years, 
--         expiry_date, status, is_active, created_at

-- 2. Kiểm tra RLS policies
SELECT policyname, cmd 
FROM pg_policies 
WHERE tablename = 'agent_assignments';

-- Cần có: 4 policies (SELECT, INSERT, UPDATE, DELETE)

-- 3. Test insert agent assignment
INSERT INTO agent_assignments (
  us_agent_id, 
  company_id, 
  fda_registration_id, 
  assignment_date, 
  assignment_years, 
  expiry_date, 
  status
) VALUES (
  'uuid-of-agent',
  'uuid-of-company',
  'uuid-of-fda-registration',
  '2025-12-30',
  2,
  '2027-12-30',
  'active'
);
\`\`\`

## Các lỗi đã fix:

1. ✅ Profile creation - language_preference, organization_type missing
2. ✅ Company creation - contact_person, registration_number missing
3. ✅ FREE subscription - package_code missing
4. ✅ FDA Registration - nhiều cột thiếu và RLS policies
5. ✅ US Agent - nhiều cột thiếu và RLS policies
6. ⚠️ **Agent Assignment - ĐANG FIX** - thiếu RLS policies và các cột quan trọng
7. ✅ Facility Update Requests - request_status missing

## Lưu ý quan trọng:

**Tại sao Agent Assignment không lưu được?**
1. Bảng `agent_assignments` KHÔNG CÓ RLS policies → Script 24 phải chạy trước
2. Thiếu các cột: company_id, assignment_date, assignment_years, expiry_date, status → Script 25
3. Cả 2 scripts PHẢI chạy theo thứ tự: 24 → 25

**Cách kiểm tra:**
\`\`\`bash
# Chạy script 24 trước
psql -h <host> -U <user> -d <db> -f scripts/24_add_agent_assignments_rls_policies.sql

# Sau đó chạy script 25
psql -h <host> -U <user> -d <db> -f scripts/25_add_missing_agent_assignment_columns.sql

# Kiểm tra kết quả
psql -h <host> -U <user> -d <db> -c "SELECT policyname FROM pg_policies WHERE tablename='agent_assignments';"
