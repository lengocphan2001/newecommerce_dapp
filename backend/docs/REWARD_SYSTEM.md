# Hệ thống trả thưởng (Commission & Reward)

## Tổng quan luồng

1. **Admin duyệt đơn** (PENDING → CONFIRMED) → gọi `approveOrder(order)`.
2. **Trong `approveOrder`:**
   - Trừ tồn kho (stock).
   - Cập nhật `totalPurchaseAmount`, kiểm tra tái tiêu dùng (`isReconsumption`), cập nhật `totalReconsumptionAmount` nếu có.
   - **Milestone:** `milestoneRewardService.checkAndProcessMilestones(buyer.referralUserId)` (chạy bất đồng bộ, lỗi chỉ log).
   - **Commission + Payout:** `commissionService.calculateCommissions(order.id)` → đợi 1 giây → `commissionPayoutService.payoutOrderCommissions(order.id)` (chạy bất đồng bộ, lỗi chỉ log).

---

## Các bước tính hoa hồng (`calculateCommissions`)

| Bước | Mô tả |
|------|--------|
| 1 | **Hoa hồng trực tiếp (direct):** Người giới thiệu (referrer) nhận % theo gói (`directCommissionRate`) trên `order.totalAmount`. Bị **BLOCKED** nếu đã đạt ngưỡng hoa hồng mà chưa tái tiêu dùng. |
| 1b | **Hoa hồng sản phẩm (product):** Theo % TV/CTV/NPP của từng sản phẩm, cho referrer. Cũng kiểm tra tái tiêu dùng. |
| 2 | **Hoa hồng nhóm (group):** Cây nhị phân (binary). Mỗi ancestor có đủ 2 nhánh trái/phải và đạt doanh số tối thiểu mỗi nhánh mới được tính. Chỉ trả khi đơn nằm ở **nhánh yếu** (hoặc 2 nhánh bằng nhau). Bị BLOCKED nếu chưa tái tiêu dùng. |
| 3 | **Cập nhật volume:** Cộng `order.totalAmount` vào `leftBranchTotal` hoặc `rightBranchTotal` của tất cả ancestor (theo nhánh của buyer). |
| 4 | **Hoa hồng quản lý (management):** F1/F2/F3 nhận % trên hoa hồng nhóm của cấp dưới. Cũng kiểm tra tái tiêu dùng. |

---

## Payout (chi trả)

- **Ngưỡng (minPayoutThreshold):** Lấy từ bảng `system_config` (key `minPayoutThreshold`). Chỉ áp dụng cho hoa hồng **nhóm / sản phẩm / quản lý** (không áp dụng cho direct).
- **Hoa hồng trực tiếp (direct):** Được trả **ngay** khi đơn được duyệt, không cộng dồn, không cần đạt ngưỡng.
- **Hoa hồng nhóm và loại khác (group, product, management):** Cộng dồn. Khi **tổng PENDING (không tính direct) của user ≥ minPayoutThreshold** → gom tất cả PENDING không-phải-direct của user đó và gọi **blockchain batch payout** (USDT). Commission chuyển sang PAID.
- **Milestone:** Sau khi tạo commission MILESTONE (với `orderId = null`, `milestoneRef = 'milestone-{id}'`), gọi `singlePayout(userId, wallet, amount, 'milestone-{id}')`; singlePayout tìm commission theo `milestoneRef` và type MILESTONE rồi trả.

---

## Tái tiêu dùng (Reconsumption)

- User có gói (packageType ≠ NONE) khi **tổng hoa hồng nhận được ≥ reconsumptionThreshold** (của gói) → mọi commission mới bị **BLOCKED** cho đến khi user **mua thêm** (đơn có tổng trị giá ≥ package value) → khi đó `packageType` được set về NONE (hoặc logic tương ứng) và có thể nhận commission lại.
- `checkReconsumption(user, config)` trả về `false` khi đã đạt ngưỡng và chưa tái tiêu dùng → commission ghi với status BLOCKED.

---

## Các lỗi thường gặp và hướng xử lý

| Lỗi / Triệu chứng | Nguyên nhân có thể | Cách xử lý |
|-------------------|--------------------|------------|
| `Table 'xxx.system_config' doesn't exist` | Chưa tạo bảng khi deploy production | Chạy `npm run db:init` (đã thêm SystemConfig entity) hoặc chạy script SQL trong `backend/scripts/migrations/create-system-config-table.sql`. |
| Commission không được tính | Đơn chưa CONFIRMED; buyer không có referrer; ancestor không đủ 2 nhánh; không có package config (gói); lỗi trong bước trước làm throw. | Kiểm tra log backend khi admin duyệt đơn. Đảm bảo có gói active, user có referralUserId/parentId/position đúng. |
| Payout không chạy / không lên blockchain | `getMinPayoutThreshold()` lỗi (thiếu system_config); user không có walletAddress; contract/RPC lỗi; số dư contract không đủ. | Tạo bảng system_config, kiểm tra wallet user, log blockchain service, kiểm tra số dư contract. |
| Milestone không trả / "No pending commission found" | Commission MILESTONE phải có `milestoneRef = 'milestone-{id}'`; singlePayout tìm theo milestoneRef. Đảm bảo bảng `commissions` có cột `milestoneRef` (chạy `npm run db:init` hoặc migration). | Đã sửa trong code: awardMilestoneReward set milestoneRef; singlePayout tìm theo milestoneRef khi orderId bắt đầu bằng 'milestone-'. |
| Hoa hồng nhóm sai nhánh / volume sai | `getBuyerSide()` trả về undefined khi user.position null. | Trong `getBuyerSide` return `current.position ?? 'left'` (hoặc xử lý null tương đương) để không dùng undefined khi update volume. |
| BLOCKED quá nhiều | Đã đạt ngưỡng reconsumption nhưng chưa mua đủ để “tái tiêu dùng”. | Giải thích cho user quy định tái tiêu dùng; kiểm tra config gói (reconsumptionThreshold, giá gói). |

---

## File quan trọng

- `backend/src/order/order.service.ts` – duyệt đơn, gọi approveOrder → commission + payout.
- `backend/src/affiliate/commission.service.ts` – tính direct, product, group, management; reconsumption; milestone award.
- `backend/src/affiliate/commission-payout.service.ts` – threshold, batch payout, singlePayout (milestone).
- `backend/src/admin/milestone-reward.service.ts` – đếm referral, tính milestone, gọi awardMilestoneReward + singlePayout.
- `backend/src/admin/admin.service.ts` – getMinPayoutThreshold (đọc system_config).
