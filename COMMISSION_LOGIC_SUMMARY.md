# Tổng hợp Logic Tính Hoa Hồng Các Cấp

## 📋 Tổng quan

Hệ thống tính hoa hồng tự động khi có đơn hàng được xác nhận (`CONFIRMED`). Có **3 loại hoa hồng** được tính theo thứ tự:

1. **Hoa hồng Trực tiếp** (Direct Commission)
2. **Hoa hồng Nhóm** (Group Commission - Binary Tree)
3. **Hoa hồng Quản lý Nhóm** (Management Commission)

---

## 🎯 Điều kiện để nhận hoa hồng

### Package Type (Loại gói)
- **CTV (Cộng tác viên)**: Mua đủ **$0.0001** (TEST: giảm từ $40)
- **NPP (Nhà phân phối)**: Mua đủ **$0.001** (TEST: giảm từ $400)
- **NONE**: Chưa đủ điều kiện → không nhận hoa hồng

### Tái tiêu dùng (Reconsumption)
- **CTV**: 
  - Ngưỡng: Khi nhận được **$0.001** hoa hồng (TEST: giảm từ $160)
  - Yêu cầu: Phải tái tiêu dùng **$0.0001** mỗi chu kỳ (TEST: giảm từ $40)
- **NPP**: 
  - Ngưỡng: Khi nhận được **$0.01** hoa hồng (TEST: giảm từ $1600)
  - Yêu cầu: Phải tái tiêu dùng **$0.001** mỗi chu kỳ (TEST: giảm từ $400)

**Logic**: 
- Chưa đạt ngưỡng → có thể nhận hoa hồng bình thường
- Đã đạt ngưỡng → phải kiểm tra tái tiêu dùng:
  - Đã đủ tái tiêu dùng → có thể nhận hoa hồng
  - Chưa đủ tái tiêu dùng → KHÔNG thể nhận hoa hồng

---

## 1️⃣ Hoa hồng Trực tiếp (Direct Commission)

### Đối tượng nhận
- Người giới thiệu ban đầu của buyer (`buyer.referralUserId`)
- **KHÔNG phụ thuộc vào binary tree** (không phụ thuộc `parentId`)

### Tỷ lệ
- **CTV**: **20%** giá trị đơn hàng
- **NPP**: **25%** giá trị đơn hàng

### Điều kiện
- ✅ Buyer có `referralUserId` (có người giới thiệu ban đầu)
- ✅ Người giới thiệu có package CTV hoặc NPP
- ✅ Người giới thiệu đủ điều kiện tái tiêu dùng (nếu đã đạt ngưỡng)
- ✅ **TẤT CẢ giao dịch** của buyer đều tính hoa hồng trực tiếp (không phụ thuộc nhánh yếu)

### Ví dụ
```
User A (CTV) giới thiệu User B
User B mua hàng $100
→ User A nhận: $100 × 20% = $20 (hoa hồng trực tiếp)
```

---

## 2️⃣ Hoa hồng Nhóm (Group Commission - Binary Tree)

### Đối tượng nhận
- Tất cả **ancestors** của buyer trong binary tree (các cấp trên trong cây nhị phân)
- Tính từ `parentId` của buyer lên đến root

### Tỷ lệ
- **CTV**: **10%** giá trị đơn hàng
- **NPP**: **15%** giá trị đơn hàng

### Điều kiện
- ✅ Buyer có `parentId` (có parent trong binary tree)
- ✅ Ancestor có package CTV hoặc NPP
- ✅ Ancestor đủ điều kiện tái tiêu dùng (nếu đã đạt ngưỡng)
- ✅ **Giao dịch phải ở NHÁNH YẾU** của ancestor
  - Nhánh yếu = nhánh có tổng doanh số (`leftBranchTotal` hoặc `rightBranchTotal`) thấp hơn
  - Nếu cả hai nhánh đều = 0 → mặc định chọn nhánh trái (`left`)

### Cập nhật dữ liệu
- Cập nhật `totalCommissionReceived` của ancestor
- Cập nhật `leftBranchTotal` hoặc `rightBranchTotal` của ancestor:
  - Nếu ở nhánh yếu → cập nhật nhánh yếu và tính hoa hồng
  - Nếu ở nhánh mạnh → chỉ cập nhật nhánh mạnh (không tính hoa hồng)

### Ví dụ
```
Binary Tree:
        A (NPP)
       / \
      B   C
     / \ / \
    D  E F  G

User D mua hàng $100 ở nhánh trái của A
- Nhánh trái của A: $50 (yếu)
- Nhánh phải của A: $200 (mạnh)
→ A nhận: $100 × 15% = $15 (hoa hồng nhóm)
→ Cập nhật leftBranchTotal của A: $50 + $100 = $150
```

---

## 3️⃣ Hoa hồng Quản lý Nhóm (Management Commission)

### Định nghĩa F1, F2, F3
- **F1 của User A** = các user trực tiếp dưới A trong binary tree (left child và right child)
- **F2 của User A** = các user ở cấp thứ 2 dưới A (con của F1)
- **F3 của User A** = các user ở cấp thứ 3 dưới A (con của F2)

### Ví dụ cấu trúc
```
        A
       / \
      B   C    ← B và C là F1 của A
     / \ / \
    D  E F  G  ← D, E, F, G là F2 của A
   /| |\ | |\
  H I J K L M N O  ← H, I, J, K, L, M, N, O là F3 của A
```

### Đối tượng nhận
- Tất cả **ancestors** của buyer trong binary tree
- Chỉ tính khi buyer đã nhận hoa hồng nhóm từ đơn hàng này

### Tỷ lệ
- **CTV**: 
  - **15%** trên hoa hồng nhóm mà **F1** nhận được
  - Chỉ nhận từ F1 (không nhận từ F2, F3)
- **NPP**: 
  - **15%** trên hoa hồng nhóm mà **F1** nhận được
  - **10%** trên hoa hồng nhóm mà **F2** nhận được
  - **10%** trên hoa hồng nhóm mà **F3** nhận được

### Điều kiện
- ✅ Buyer có `parentId` (có parent trong binary tree)
- ✅ Buyer đã nhận hoa hồng nhóm từ đơn hàng này
- ✅ Ancestor có package CTV hoặc NPP
- ✅ Ancestor đủ điều kiện tái tiêu dùng (nếu đã đạt ngưỡng)
- ✅ Buyer là F1/F2/F3 của ancestor (trong 3 cấp đầu)

### Logic tính toán
1. Tìm hoa hồng nhóm mà buyer nhận được từ đơn hàng này
2. Nếu buyer đã nhận hoa hồng nhóm:
   - Tìm tất cả ancestors của buyer
   - Với mỗi ancestor:
     - Xác định buyer là F1/F2/F3 của ancestor bằng cách đếm số cấp từ buyer lên ancestor
     - Nếu buyer là F1/F2/F3 của ancestor:
       - CTV: chỉ tính nếu buyer là F1
       - NPP: tính nếu buyer là F1/F2/F3
     - Tính hoa hồng quản lý = hoa hồng nhóm của buyer × tỷ lệ tương ứng

### Ví dụ
```
Binary Tree:
        A (NPP)
       / \
      B   C
     / \ / \
    D  E F  G

User D mua hàng $100 và nhận hoa hồng nhóm $15 từ A
- D là F1 của B → B nhận: $15 × 15% = $2.25 (nếu B là NPP)
- D là F2 của A → A nhận: $15 × 10% = $1.5 (A là NPP)
```

---

## 🔄 Quy trình tính hoa hồng khi có đơn hàng mới

### Bước 1: Kiểm tra điều kiện
- ✅ Đơn hàng có status = `CONFIRMED`
- ✅ Chưa tính hoa hồng cho đơn hàng này (tránh duplicate)

### Bước 2: Cập nhật Package Type
- Kiểm tra tổng giá trị mua của buyer (`totalPurchaseAmount`)
- Cập nhật `packageType` nếu đạt ngưỡng:
  - ≥ $0.001 → NPP
  - ≥ $0.0001 → CTV

### Bước 3: Tính hoa hồng Trực tiếp
- Tìm người giới thiệu ban đầu (`buyer.referralUserId`)
- Tính hoa hồng trực tiếp cho người giới thiệu (20% hoặc 25%)

### Bước 4: Tính hoa hồng Nhóm
- Tìm tất cả ancestors của buyer trong binary tree
- Với mỗi ancestor:
  - Kiểm tra giao dịch có ở nhánh yếu không
  - Nếu có → tính hoa hồng nhóm (10% hoặc 15%)
  - Cập nhật `leftBranchTotal` hoặc `rightBranchTotal`

### Bước 5: Tính hoa hồng Quản lý Nhóm
- Kiểm tra buyer đã nhận hoa hồng nhóm chưa
- Nếu có:
  - Tìm tất cả ancestors của buyer
  - Với mỗi ancestor:
    - Xác định buyer là F1/F2/F3 của ancestor
    - Tính hoa hồng quản lý dựa trên hoa hồng nhóm mà buyer nhận được

---

## 📊 Tóm tắt Tỷ lệ Hoa hồng

| Loại Hoa hồng | CTV | NPP |
|--------------|-----|-----|
| **Trực tiếp** | 20% | 25% |
| **Nhóm** | 10% | 15% |
| **Quản lý F1** | 15% | 15% |
| **Quản lý F2** | - | 10% |
| **Quản lý F3** | - | 10% |

---

## ⚠️ Lưu ý quan trọng

1. **Hoa hồng trực tiếp**: Tính cho **TẤT CẢ giao dịch** của người được giới thiệu, không phụ thuộc nhánh yếu
2. **Hoa hồng nhóm**: Chỉ tính khi giao dịch ở **NHÁNH YẾU**
3. **Hoa hồng quản lý**: Chỉ tính khi buyer đã nhận hoa hồng nhóm từ đơn hàng này
4. **Tái tiêu dùng**: Áp dụng cho TẤT CẢ loại hoa hồng sau khi đạt ngưỡng
5. **F1, F2, F3**: Được định nghĩa dựa trên binary tree (cây nhị phân), không phải referral chain

---

## 🔍 Debugging

Code có logging chi tiết cho từng bước:
- `[Commission Calculation]`: Log tổng quan
- `[Direct Commission]`: Log hoa hồng trực tiếp
- `[Group Commission]`: Log hoa hồng nhóm
- `[Management Commission]`: Log hoa hồng quản lý
- `[Reconsumption Check]`: Log kiểm tra tái tiêu dùng
