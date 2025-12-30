# Hướng dẫn Kiểm toán Luồng Đăng ký FDA (Phòng ngừa Rủi ro Nghiệp vụ)

Tài liệu này cung cấp hướng dẫn cho kiểm toán viên để kiểm tra tính chính xác và tuân thủ của luồng đăng ký FDA trong hệ thống FoodTrace.

## 1. Nguyên tắc Nghiệp vụ Cốt lõi (Audit Baseline)

Để đảm bảo tính toàn vẹn của dữ liệu và tuân thủ quy định FDA, hệ thống được thiết kế dựa trên các nguyên tắc không thể thay đổi sau:

1.  **Chủ thể Đăng ký (Owner/Operator):** FDA đăng ký cho **Pháp nhân (Company)** được System Admin tạo ra, không phải cho các cơ sở sản xuất (Facilities) do User tự tạo để quản lý truy xuất nguồn gốc (CTE).
2.  **US Agent (Đại diện tại Mỹ):** Là một thực thể độc lập, không thuộc quyền sở hữu của bất kỳ doanh nghiệp Việt Nam nào. Hệ thống quản lý US Agent như một danh mục dùng chung.
3.  **Dữ liệu Bất biến (Immutable Data):** Các mốc thời gian đăng ký (FDA Date, Agent Date) và Tên doanh nghiệp đăng ký là dữ liệu pháp lý, không được phép chỉnh sửa tùy tiện bởi User.

## 2. Danh mục Kiểm tra (Audit Checklist)

### 2.1. Kiểm tra Phân quyền (Authorization)
- [ ] **System Admin:** Có quyền tạo mới Công ty, Đăng ký FDA và US Agent.
- [ ] **Company Admin:** Chỉ có quyền XEM thông tin FDA, không có quyền tạo mới hoặc chỉnh sửa trực tiếp.
- [ ] **Hành động Chỉnh sửa:** User chỉ được thực hiện thông qua "Yêu cầu Cập nhật" (Request for Change) và phải được System Admin phê duyệt.

### 2.2. Kiểm tra Luồng Dữ liệu (Data Flow)
- [ ] **Nguồn dữ liệu:** Khi tạo Đăng ký FDA, hệ thống phải cho phép chọn từ danh mục Công ty (`companies`), không phải danh mục Cơ sở (`facilities`).
- [ ] **Lịch sử thay đổi (Audit Trail):** Mọi hành động phê duyệt thay đổi phải được ghi lại trong `system_logs` hoặc bảng Audit chuyên dụng, bao gồm: Người thực hiện, Nội dung cũ, Nội dung mới, Thời điểm.

### 2.3. Kiểm tra Tính Hợp lệ (Validity & Expiry)
- [ ] **Chu kỳ FDA:** Hệ thống phải tự động tính toán ngày hết hạn FDA vào cuối năm chẵn tiếp theo (theo quy định FDA).
- [ ] **US Agent Expiry:** Ngày hết hạn của Agent phải khớp với số năm đăng ký dịch vụ.
- [ ] **Cảnh báo:** Kiểm tra xem các thông báo sắp hết hạn có được gửi đúng 30-60 ngày trước khi hết hạn không.

## 3. Các Điểm Kiểm soát Quan trọng (Control Points)

| Vấn đề | Điểm kiểm soát (Control Point) | Cách kiểm tra |
| :--- | :--- | :--- |
| **Bypass Approval** | Chỉnh sửa FDA trực tiếp | Thử đăng nhập bằng tài khoản Company Admin và truy cập `/admin/fda-registrations` (phải bị chặn). |
| **Sai lệch Ngày** | Thay đổi ngày hết hạn | Kiểm tra logic code tại `calculateFdaExpiryDate` để đảm bảo không thể nhập tay ngày hết hạn sai quy luật. |
| **Mạo danh Agent** | Gán Agent không tồn tại | Kiểm tra khóa ngoại (Foreign Key) giữa `agent_assignments` và `us_agents`. |

## 4. Truy xuất Dữ liệu Kiểm toán (SQL Queries)

Sử dụng các câu lệnh SQL sau để trích xuất dữ liệu phục vụ hậu kiểm:

\`\`\`sql
-- Xem lịch sử các yêu cầu cập nhật thông tin cơ sở
SELECT * FROM facility_update_requests ORDER BY created_at DESC;

-- Kiểm tra các đăng ký FDA sắp hết hạn nhưng chưa có cảnh báo
SELECT * FROM fda_registrations 
WHERE expiry_date < CURRENT_DATE + INTERVAL '30 days' 
AND notification_enabled = true;

-- Truy vết hành động của System Admin
SELECT * FROM system_logs WHERE role = 'system_admin' ORDER BY created_at DESC;
