# Đề xuất tối ưu tốc độ hệ thống

## 1. Backend – Đã xử lý

### 1.1 Admin Affiliate: getAllStats (N+1 → 1 query)
- **Trước:** Load tất cả user, sau đó gọi `getStats(userId)` cho **từng user** → 1 + N query (N = số user).
- **Sau:** Một query tổng hợp commission theo `userId` (GROUP BY), rồi join với danh sách user trong code → **2 query** cho cả trang.
- File: `affiliate.service.ts` + `commission.service.ts`.

---

## 2. Backend – Nên làm thêm

### 2.1 Database indexes
Thêm index cho các cột hay dùng trong WHERE/ORDER/JOIN để query nhanh hơn:

- **commissions:** `(userId)`, `(orderId)`, `(userId, status)`, `(createdAt)`
- **orders:** `(userId)`, `(status)`, `(createdAt)`
- **users:** `(parentId)`, `(packageType)`, `(referralUserId)`, `(createdAt)`

Ví dụ TypeORM (trong entity):

```ts
@Index(['userId', 'status'])
@Entity('commissions')
export class Commission { ... }
```

Sau đó chạy migration hoặc để synchronize tạo index.

### 2.2 Cache API thường dùng
- **Banking config** (`GET /admin/banking-config`): cache 5–15 phút (Redis hoặc in-memory), clear khi admin cập nhật.
- **Package list / config:** đã cache trong commission; có thể cache thêm ở auth (getReferralInfo, checkReconsumption) nếu gọi nhiều.
- **getReferralInfo:** cache per-user 1–2 phút để giảm tải DB khi user refresh nhiều.

### 2.3 Phân trang Admin Affiliate
- Không load toàn bộ user một lúc: dùng **phân trang** (page + limit) và filter (search).
- Chỉ tính stats (pending/paid) cho **trang hiện tại** (hoặc dùng luôn query tổng hợp có LIMIT/OFFSET theo page).

### 2.4 Nén response (gzip/brotli)
- Bật nén ở reverse proxy (Nginx/Caddy) hoặc NestJS middleware để giảm kích thước response.

---

## 3. Frontend (Next.js) – Đã xử lý & gợi ý thêm

### 3.1 Đã làm: Cache API (apiCache.ts)
- **getReferralInfo:** cache 90s; xóa cache khi logout/401.
- **getBankingConfig:** cache 5 phút. Logout gọi `invalidateCache('referralInfo')`.

### 3.2 Đã làm: Lazy load
- **Affiliate Tree:** `BinaryTreeView` dùng `React.lazy()` + `Suspense` → bundle react-d3-tree chỉ tải khi mở trang cây.

### 3.3 Code splitting & lazy load (gợi ý)
- Lazy load các trang nặng: affiliate tree, admin, profile: `dynamic(import(...), { ssr: false })` nếu cần.
- Đảm bảo không import cả bundle admin vào trang user.

### 3.3 Nên làm thêm (request, ảnh, bundle)
- Cache categories/sliders nếu cần; Next.js Image + WebP; npm run build xem First Load JS.


### 3.4 Gợi ý khác
- Chạy `npm run build` và xem phần “First Load JS”; cắt bớt thư viện nặng hoặc dynamic import cho màn ít dùng.

---

## 4. Hạ tầng

- **CDN:** Static (JS/CSS/images) qua CDN để giảm latency.
- **Database:** Đảm bảo connection pool phù hợp; nếu dùng MySQL/Postgres thì monitor slow query log và thêm index theo log đó.
- **Redis:** Dùng cho cache session, cache config, cache getReferralInfo nếu cần.

---

## Thứ tự ưu tiên gợi ý

1. **Đã làm (BE):** Tối ưu getAllStats (bỏ N+1).
2. **Đã làm (FE):** Cache getReferralInfo (90s) + getBankingConfig (5 phút); lazy load BinaryTreeView; xóa cache khi logout/401.
3. **Tiếp theo:** Thêm index DB cho `commissions`, `orders`, `users`.
4. **Sau đó:** Phân trang admin affiliate; cache categories/sliders (FE) nếu cần.
5. **Dài hạn:** CDN, Redis, nén response.
