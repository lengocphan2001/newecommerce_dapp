# Hệ thống Hoa hồng (Commission System)

## Tổng quan

Hệ thống hoa hồng tự động tính toán và phân phối hoa hồng khi có đơn hàng được xác nhận. Hệ thống hỗ trợ 3 loại hoa hồng:

1. **Hoa hồng trực tiếp** (Direct Commission)
2. **Hoa hồng nhóm** (Group Commission - Binary Tree)
3. **Hoa hồng quản lý nhóm** (Management Commission)

## Các loại gói User

### CTV (Cộng tác viên)
- **Điều kiện**: Mua sản phẩm có tổng giá trị ≥ $40
- **Tích lũy**: Có thể tích lũy để lên gói NPP

### NPP (Nhà phân phối)
- **Điều kiện**: Mua sản phẩm có tổng giá trị ≥ $400
- **Tích lũy**: Có thể tích lũy từ các đơn hàng trước đó

## 1. Hoa hồng Trực tiếp (Direct Commission)

Khi CTV hoặc NPP giới thiệu được 1 người dùng mới đăng ký gói user thì sẽ được thưởng hoa hồng trực tiếp:

- **CTV**: Nhận **20%** giá trị của gói mà người được giới thiệu đăng ký
- **NPP**: Nhận **25%** giá trị của gói mà người được giới thiệu đăng ký

**Ví dụ:**
- User A (CTV) giới thiệu User B mua gói $40 → User A nhận: $40 × 20% = $8
- User C (NPP) giới thiệu User D mua gói $400 → User C nhận: $400 × 25% = $100

## 2. Hoa hồng Nhóm (Group Commission - Binary Tree)

Nhóm hoạt động theo sơ đồ nhị phân, tự động sắp xếp chân. User sẽ nhận hoa hồng khi phát sinh giao dịch tại **nhánh yếu** (nhánh có tổng doanh số thấp hơn):

- **CTV**: Nhận **10%** giá trị đơn hàng
- **NPP**: Nhận **15%** giá trị đơn hàng

**Ví dụ:**
- User A có nhánh trái tổng doanh số $100, nhánh phải $50
- Nhánh yếu là nhánh phải ($50 < $100)
- Khi có đơn hàng $100 ở nhánh phải:
  - Nếu User A là CTV → Nhận: $100 × 10% = $10
  - Nếu User A là NPP → Nhận: $100 × 15% = $15

## 3. Hoa hồng Quản lý Nhóm (Management Commission)

User sẽ nhận thêm % hoa hồng dựa trên % hoa hồng nhóm mà F1/F2/F3 của user đó nhận được:

### CTV
- Nhận **15%** trên hoa hồng nhóm mà F1 nhận được

### NPP
- **F1**: Nhận **15%** trên hoa hồng nhóm F1
- **F2**: Nhận **10%** trên hoa hồng nhóm F2
- **F3**: Nhận **10%** trên hoa hồng nhóm F3

**Ví dụ:**
- User A (NPP) có F1 là User B (CTV)
- User B nhận hoa hồng nhóm $10 từ một đơn hàng
- User A nhận hoa hồng quản lý: $10 × 15% = $1.5

## 4. Tái tiêu dùng (Reconsumption)

Khi user nhận được tổng số tiền hoa hồng theo quy định với gói đăng ký thì phải phát sinh doanh số tái tiêu dùng nhất định thì user đó mới tiếp tục nhận thêm hoa hồng:

### CTV
- **Ngưỡng**: Khi hoa hồng đạt **$160**
- **Yêu cầu**: Phải tái tiêu dùng **$40**

### NPP
- **Ngưỡng**: Khi hoa hồng đạt **$1600**
- **Yêu cầu**: Phải tái tiêu dùng **$400**

**Ví dụ:**
- User A (CTV) đã nhận tổng cộng $160 hoa hồng
- Để tiếp tục nhận hoa hồng, User A phải mua thêm sản phẩm trị giá $40
- Sau khi tái tiêu dùng $40, User A có thể tiếp tục nhận hoa hồng cho đến khi đạt $320 (chu kỳ tiếp theo)

## Cơ chế hoạt động

### Khi tạo đơn hàng

1. **Tự động cập nhật package type**: Kiểm tra tổng giá trị mua và cập nhật package (CTV/NPP) nếu cần
2. **Tính hoa hồng trực tiếp**: Cho người giới thiệu trực tiếp (parent)
3. **Tính hoa hồng nhóm**: Cho tất cả ancestors trong binary tree khi giao dịch ở nhánh yếu
4. **Tính hoa hồng quản lý**: Cho F1/F2/F3 dựa trên hoa hồng nhóm họ nhận được
5. **Kiểm tra tái tiêu dùng**: Tự động đánh dấu đơn hàng là tái tiêu dùng nếu cần

### Database Schema

#### Commission Entity
- `id`: UUID
- `userId`: User nhận hoa hồng
- `orderId`: Đơn hàng phát sinh hoa hồng
- `fromUserId`: User tạo ra đơn hàng
- `type`: Loại hoa hồng (direct/group/management)
- `status`: Trạng thái (pending/paid/blocked)
- `amount`: Số tiền hoa hồng
- `orderAmount`: Giá trị đơn hàng
- `level`: Cấp độ (F1, F2, F3) cho hoa hồng quản lý
- `side`: Nhánh (left/right) cho hoa hồng nhóm

#### User Entity (các trường mới)
- `packageType`: Loại gói (NONE/CTV/NPP)
- `totalPurchaseAmount`: Tổng giá trị đã mua
- `totalCommissionReceived`: Tổng hoa hồng đã nhận
- `totalReconsumptionAmount`: Tổng doanh số tái tiêu dùng
- `leftBranchTotal`: Tổng doanh số nhánh trái
- `rightBranchTotal`: Tổng doanh số nhánh phải

## API Endpoints

### Xem thống kê hoa hồng
```
GET /affiliate/stats/:userId
```

Response:
```json
{
  "packageType": "NPP",
  "totalPurchaseAmount": 500,
  "totalCommissionReceived": 200,
  "totalReconsumptionAmount": 0,
  "leftBranchTotal": 300,
  "rightBranchTotal": 200,
  "commissions": {
    "direct": 50,
    "group": 100,
    "management": 50
  },
  "pending": 150,
  "paid": 50
}
```

### Xem lịch sử hoa hồng
```
GET /affiliate/commissions/:userId?type=direct&status=pending
```

Query parameters:
- `type`: direct | group | management
- `status`: pending | paid | blocked

## Lưu ý

1. Hoa hồng được tính toán **tự động** khi đơn hàng được xác nhận (status = CONFIRMED)
2. Hoa hồng được tính **ngay lập tức** khi có giao dịch
3. Hệ thống tự động kiểm tra điều kiện tái tiêu dùng trước khi tính hoa hồng
4. Binary tree tự động sắp xếp user vào nhánh yếu khi đăng ký (nếu không chỉ định nhánh)
