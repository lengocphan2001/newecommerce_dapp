# Hallmark Design Rules & Guidelines

Tài liệu này tích hợp bộ tiêu chuẩn **Hallmark** (anti-AI-slop design skill) vào dự án mới để định hướng và bắt buộc mọi tác vụ phát triển giao diện người dùng (FE) phải tuân thủ nghiêm ngặt các quy tắc thiết kế chuyên nghiệp, loại bỏ thẩm mỹ rập khuôn của AI.

---

## 🚫 Danh sách Anti-Patterns bắt buộc tránh (The Slop Tells)

### 1. The Purple-Gradient Hero / Headlines (Gradient Tím/Hồng)
* **Lỗi**: Sử dụng nền hoặc tiêu đề gradient màu tím sang hồng (`background-clip: text` với tím/hồng/cyan). Đây là dấu hiệu nhận biết AI rõ ràng nhất.
* **Cách sửa**: Dùng màu thuần (solid ink). Sử dụng các sắc độ sáng tối (weight) hoặc kiểu font trưng bày (display font) để tạo chiều sâu thay vì dùng gradient lòe loẹt.

### 2. Inter-Everywhere (Một font cho toàn trang)
* **Lỗi**: Sử dụng duy nhất một font (như Inter, Roboto) cho cả tiêu đề lẫn nội dung.
* **Cách sửa**: Ghép cặp tối thiểu 2 font khác nhau (ví dụ: Work Sans hoặc Serif cho tiêu đề và Geist/Inter cho nội dung body).

### 3. Card-in-Card (Thẻ lồng thẻ)
* **Lỗi**: Sử dụng các thẻ con có viền nằm bên trong một khung thẻ lớn có viền khác một cách vô tội vạ.
* **Cách sửa**: Chọn một lớp chứa duy nhất (thường là bỏ khung viền bao ngoài hoặc thay bằng khoảng đệm khoảng cách).

### 4. Centred Everything (Căn giữa toàn bộ)
* **Lỗi**: Tiêu đề căn giữa, nút căn giữa, các khối tính năng tiếp theo đều căn giữa lặp đi lặp lại.
* **Cách sửa**: Thiết kế lệch (asymmetric layout). Đẩy lề trái rộng hơn lề phải hoặc ngược lại để tạo chuyển động thị giác.

---

## ⚡ Tiêu chuẩn Tương tác và Trạng thái (The 8-State Rule)

Mọi component tương tác (nút bấm, input, card) phải được thiết kế và viết code CSS/Tailwind rõ ràng cho **đủ 8 trạng thái**:
1. **Default** (Mặc định)
2. **Hover** (Di chuột qua - đối với desktop)
3. **Focus-visible** (Tập trung qua bàn phím Tab)
4. **Active** (Nhấp chuột/Chạm - co giãn nhẹ `active:scale-95 transition-all`)
5. **Disabled** (Bị vô hiệu hóa)
6. **Loading** (Đang tải - hiển thị Shimmer hoặc Skeleton thay vì spinner tròn đơn điệu)
7. **Error** (Lỗi)
8. **Success** (Thành công)

---

## 📱 Thiết kế Responsive Di động (Mobile-First Non-Negotiables)
* Không được có thanh cuộn ngang ngoài ý muốn (`overflow-x: clip` trên cả `html` và `body`).
* Không để chữ của các nút điều hướng chính bị xuống dòng làm hai dòng trên màn hình hẹp (320px/375px).
* Sử dụng `minmax(0, 1fr)` cho grid chứa ảnh thay vì `1fr` trống để tránh tràn cột.
* Các tiêu đề dài phải có thuộc tính `overflow-wrap: anywhere` để tự động ngắt dòng thông minh khi hiển thị trên màn hình di động nhỏ.
