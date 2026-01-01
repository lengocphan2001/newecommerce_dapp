# Quick Start - Deploy lên Shared Hosting

## Tóm tắt nhanh

### 1. Build Frontend & Admin (Static Files)

```bash
# Chạy script tự động
chmod +x build-and-deploy.sh
./build-and-deploy.sh
```

Hoặc build thủ công:

```bash
# 1. Build Frontend
# Uncomment các dòng trong next.config.ts:
# - output: 'export'
# - trailingSlash: true
# - images: { unoptimized: true }
npm run build

# 2. Build Admin
cd admin
npm run build
cd ..
```

### 2. Upload lên Shared Hosting

Upload tất cả files trong thư mục `out/` lên `public_html/` của hosting.

### 3. Deploy Backend lên Shared Hosting (Node.js Support)

Vì hosting của bạn hỗ trợ Node.js, deploy trực tiếp lên đó:

**Cách 1: Sử dụng cPanel Node.js Selector (Dễ nhất)**

1. Upload thư mục `backend/` lên hosting
2. Vào cPanel → Node.js Selector
3. Tạo Node.js App:
   - Application root: `backend/`
   - Startup file: `dist/main.js`
   - Application URL: `api.yourdomain.com` (tạo subdomain)
4. Thêm Environment Variables:
   - `DATABASE_URL`
   - `JWT_SECRET`
   - `NODE_ENV=production`
   - `PORT=3000`
5. Click "Start"

**Cách 2: Sử dụng SSH + PM2**

1. Upload `backend/` lên hosting
2. SSH vào server:
```bash
cd ~/backend
npm install --production
npm run build
npm install -g pm2
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # Làm theo hướng dẫn
```

**Xem chi tiết:** `DEPLOY_SHARED_HOSTING_NODEJS.md`

**Option B: Railway/Render (Nếu muốn dùng cloud riêng)**

1. Đăng ký tại https://railway.app hoặc https://render.com
2. Deploy từ GitHub → Chọn `backend/`
3. Thêm Environment Variables
4. Lấy URL API

### 4. Cấu hình Domain

Sau khi backend deploy xong, lấy URL (ví dụ: `https://your-app.railway.app`)

Cập nhật trong frontend:
- Tạo file `.env.production`:
```
NEXT_PUBLIC_API_URL=https://your-backend-url.com
```

Cập nhật trong admin:
- Tạo file `admin/.env.production`:
```
REACT_APP_API_URL=https://your-backend-url.com
```

Rebuild và upload lại.

### 5. Cấu hình CORS trong Backend

Cập nhật `backend/src/main.ts`:

```typescript
app.enableCors({
  origin: [
    'https://your-domain.com',
    'https://your-domain.com/admin',
  ],
  credentials: true,
});
```

Deploy lại backend.

---

## Checklist

- [ ] Frontend build thành công → `out/` folder
- [ ] Admin build thành công → `admin/build/` folder
- [ ] Upload frontend + admin lên shared hosting
- [ ] Upload `.htaccess` files
- [ ] Backend deploy lên Railway/Render
- [ ] Database được tạo và kết nối
- [ ] Environment variables đã cấu hình
- [ ] CORS đã cấu hình đúng domain
- [ ] Test frontend: `https://your-domain.com`
- [ ] Test admin: `https://your-domain.com/admin`
- [ ] Test API: `https://your-backend-url.com/api`

---

## Troubleshooting

**Frontend không load được:**
- Kiểm tra `.htaccess` đã upload chưa
- Kiểm tra `trailingSlash: true` trong next.config.ts

**Admin không load được:**
- Kiểm tra `.htaccess` trong thư mục `admin/`
- Kiểm tra đường dẫn trong `package.json` của admin

**Backend không kết nối được:**
- Kiểm tra CORS settings
- Kiểm tra DATABASE_URL
- Kiểm tra PORT (Railway/Render tự động set PORT)

**API calls fail:**
- Kiểm tra `NEXT_PUBLIC_API_URL` và `REACT_APP_API_URL`
- Kiểm tra CORS trong backend
- Kiểm tra network tab trong browser console
