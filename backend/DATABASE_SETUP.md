# Hướng dẫn Tạo Database Tables trên VPS

## Vấn đề
Khi deploy backend lên VPS production, bảng `users` và các bảng khác chưa được tạo vì `synchronize: false` trong production mode.

## Giải pháp

### Cách 1: Sử dụng Script (Khuyến nghị)

1. **SSH vào VPS**:
```bash
ssh user@your-vps-ip
```

2. **Di chuyển đến thư mục backend**:
```bash
cd /var/www/backend
```

3. **Chạy script init database**:
```bash
npm run db:init
```

Script này sẽ:
- Kết nối đến database
- Tự động tạo tất cả các bảng cần thiết
- Đóng kết nối sau khi hoàn thành

### Cách 2: Tạm thời bật Synchronize

1. **SSH vào VPS**:
```bash
ssh user@your-vps-ip
```

2. **Di chuyển đến thư mục backend**:
```bash
cd /var/www/backend
```

3. **Set environment variable và restart**:
```bash
# Thêm vào .env file
echo "FORCE_SYNC=true" >> .env

# Hoặc export trước khi start
export FORCE_SYNC=true

# Restart backend (nếu dùng PM2)
pm2 restart backend

# Hoặc start lại
npm run start:prod
```

4. **Sau khi tables đã được tạo, TẮT lại**:
```bash
# Xóa hoặc comment FORCE_SYNC trong .env
# Hoặc unset
unset FORCE_SYNC

# Restart lại
pm2 restart backend
```

### Cách 3: Sửa trực tiếp trong code (Tạm thời)

1. **Sửa file `src/app.module.ts`**:
```typescript
synchronize: true, // Tạm thời bật
```

2. **Build và restart**:
```bash
npm run build
pm2 restart backend
```

3. **Sau khi tables đã được tạo, sửa lại**:
```typescript
synchronize: configService.get<string>('NODE_ENV') !== 'production',
```

4. **Build và restart lại**:
```bash
npm run build
pm2 restart backend
```

## Kiểm tra

Sau khi chạy một trong các cách trên, kiểm tra logs:

```bash
# Xem logs
pm2 logs backend

# Hoặc
tail -f /var/www/backend/logs/out.log
```

Bạn sẽ thấy thông báo như:
- "Database connected successfully!"
- "Database tables created successfully!"

## Các bảng sẽ được tạo

1. `users` - Bảng người dùng
2. `addresses` - Địa chỉ người dùng
3. `products` - Sản phẩm
4. `orders` - Đơn hàng
5. `commissions` - Hoa hồng
6. `audit_logs` - Nhật ký audit
7. `commission_config` - Cấu hình hoa hồng (CTV/NPP)

## Lưu ý quan trọng

⚠️ **KHÔNG BAO GIỜ** để `synchronize: true` trong production lâu dài vì:
- Có thể mất dữ liệu khi schema thay đổi
- Không an toàn cho production
- Nên dùng migrations thay thế

✅ **Chỉ bật tạm thời** để tạo tables lần đầu, sau đó **TẮT NGAY**.

## Troubleshooting

### Lỗi: Cannot connect to database
- Kiểm tra database credentials trong `.env`
- Đảm bảo database service đang chạy
- Kiểm tra firewall/network

### Lỗi: Permission denied
- Kiểm tra quyền truy cập database user
- Đảm bảo database user có quyền CREATE TABLE

### Lỗi: Table already exists
- Nếu một số bảng đã tồn tại, script vẫn sẽ tạo các bảng còn thiếu
- Hoặc xóa database và tạo lại (⚠️ MẤT DỮ LIỆU)
