# Hướng dẫn Deploy lên Shared Hosting

## Tổng quan

Shared hosting thường chỉ hỗ trợ static files và PHP. Để deploy hệ thống này:

1. **Frontend (Next.js)**: Build thành static export
2. **Admin (React)**: Build thành static files
3. **Backend (NestJS)**: Deploy lên service hỗ trợ Node.js (Railway, Render, hoặc nếu hosting hỗ trợ Node.js)

---

## Bước 1: Build Frontend (Next.js) thành Static Export

### 1.1. Cập nhật next.config.ts

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  // Nếu có API routes, cần comment lại hoặc xóa
};

export default nextConfig;
```

### 1.2. Build Frontend

```bash
cd /path/to/ecommerce_dapp
npm run build
```

Output sẽ ở thư mục `out/`

### 1.3. Upload lên Shared Hosting

- Upload tất cả files trong thư mục `out/` lên thư mục `public_html/` hoặc `www/` của hosting
- Đảm bảo file `.htaccess` được upload (xem file `.htaccess.example`)

---

## Bước 2: Build Admin (React) thành Static

### 2.1. Build Admin

```bash
cd admin
npm run build
```

Output sẽ ở thư mục `admin/build/`

### 2.2. Upload Admin

- Tạo thư mục `admin/` trên hosting
- Upload tất cả files trong `admin/build/` lên `public_html/admin/`
- Cấu hình `.htaccess` để redirect (xem file `.htaccess.admin.example`)

---

## Bước 3: Deploy Backend (NestJS)

### Option A: Deploy lên Shared Hosting với Node.js Support (Khuyến nghị cho bạn)

Vì shared hosting của bạn hỗ trợ Node.js, bạn c ó thể deploy trực tiếp lên đó:

#### 1. Upload Backend lên Hosting

- Upload toàn bộ thư mục `backend/` lên hosting (thường là `public_html/backend/` hoặc thư mục riêng)
- Hoặc upload qua FTP/SFTP vào thư mục như `nodejs/backend/` (tùy cấu hình hosting)

#### 2. Cấu hình Node.js trên Hosting

**Nếu dùng cPanel với Node.js Selector:**

1. Vào cPanel → Node.js Selector
2. Tạo Node.js App mới:
   - **Node.js version**: Chọn phiên bản 18.x hoặc 20.x
   - **Application root**: Chọn thư mục `backend/`
   - **Application URL**: Chọn domain/subdomain cho API (ví dụ: `api.yourdomain.com`)
   - **Application startup file**: `dist/main.js`
   - **Application mode**: Production

3. Cấu hình Environment Variables trong cPanel:
   ```
   PORT=3000
   DATABASE_URL=postgresql://user:password@host:5432/dbname
   JWT_SECRET=your-secret-key-here
   NODE_ENV=production
   ```

4. Click "Create" và chờ Node.js app được tạo

**Nếu dùng SSH:**

1. SSH vào server
2. Di chuyển đến thư mục backend:
```bash
cd ~/backend  # hoặc đường dẫn bạn đã upload
```

3. Cài đặt dependencies:
```bash
npm install --production
```

4. Build project:
```bash
npm run build
```

5. Sử dụng PM2 để quản lý process:
```bash
# Cài đặt PM2 (nếu chưa có)
npm install -g pm2

# Start backend
pm2 start dist/main.js --name backend

# Lưu cấu hình để tự động restart sau khi reboot
pm2 save
pm2 startup  # Làm theo hướng dẫn để cấu hình startup script
```

#### 3. Cấu hình Process Manager (PM2)

Tạo file `ecosystem.config.js` trong thư mục `backend/`:

```javascript
module.exports = {
  apps: [{
    name: 'backend',
    script: './dist/main.js',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    autorestart: true,
    max_memory_restart: '1G'
  }]
};
```

Sau đó chạy:
```bash
pm2 start ecosystem.config.js
pm2 save
```

#### 4. Kiểm tra Backend đang chạy

- Kiểm tra trong cPanel Node.js Selector → xem status
- Hoặc SSH: `pm2 status`
- Test API: `https://api.yourdomain.com/api` hoặc `https://yourdomain.com:3000/api`

### Option B: Deploy lên Railway/Render (Nếu cần)

Nếu bạn muốn dùng dịch vụ cloud riêng:

#### Railway:
1. Đăng ký tại https://railway.app
2. Tạo project mới
3. Connect GitHub repo
4. Chọn thư mục `backend/`
5. Railway sẽ tự động detect NestJS và deploy
6. Lấy URL API (ví dụ: `https://your-app.railway.app`)

#### Render:
1. Đăng ký tại https://render.com
2. Tạo Web Service mới
3. Connect GitHub repo
4. Chọn thư mục `backend/`
5. Build command: `npm install && npm run build`
6. Start command: `npm run start:prod`
7. Lấy URL API

---

## Bước 4: Cấu hình Environment Variables

### Frontend (.env.local hoặc .env.production)

```env
NEXT_PUBLIC_API_URL=https://your-backend-url.com
```

### Admin (admin/.env.production)

```env
REACT_APP_API_URL=https://your-backend-url.com
```

### Backend (.env)

```env
PORT=3000
DATABASE_URL=your_database_url
JWT_SECRET=your_jwt_secret
NODE_ENV=production
```

---

## Bước 5: Cấu hình Database

1. Tạo database trên hosting (MySQL/PostgreSQL)
2. Cập nhật `DATABASE_URL` trong backend `.env`
3. Chạy migrations (nếu có)

---

## Bước 6: Cấu hình CORS và Domain

### Backend - Cập nhật main.ts

```typescript
app.enableCors({
  origin: [
    'https://your-domain.com',
    'https://www.your-domain.com',
    'https://your-domain.com/admin',
  ],
  credentials: true,
});
```

---

## Cấu trúc thư mục trên Shared Hosting

```
public_html/
├── index.html (Next.js)
├── _next/
├── admin/
│   ├── index.html
│   ├── static/
│   └── ...
├── .htaccess
└── ...
```

---

## File .htaccess cho Frontend

Tạo file `.htaccess` trong `public_html/`:

```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  
  # Handle Next.js routes
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule ^(.*)$ /index.html [L]
</IfModule>
```

---

## File .htaccess cho Admin

Tạo file `.htaccess` trong `public_html/admin/`:

```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /admin/
  
  # Handle React Router
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule ^(.*)$ /admin/index.html [L]
</IfModule>
```

---

## Kiểm tra sau khi deploy

1. Frontend: `https://your-domain.com`
2. Admin: `https://your-domain.com/admin`
3. Backend API: `https://your-backend-url.com/api`

---

## Troubleshooting

### Lỗi 404 trên Next.js routes
- Đảm bảo `.htaccess` đã được cấu hình đúng
- Kiểm tra `trailingSlash: true` trong next.config.ts

### Admin không load được
- Kiểm tra đường dẫn trong `package.json` của admin có đúng không
- Đảm bảo `.htaccess` trong thư mục admin đã được cấu hình

### Backend không kết nối được
- Kiểm tra CORS settings
- Kiểm tra firewall của hosting
- Kiểm tra PORT và domain trong backend config

---

## Lưu ý quan trọng

1. **Backend phải deploy riêng** vì shared hosting thường không hỗ trợ Node.js runtime
2. **Database**: Đảm bảo database trên hosting hỗ trợ PostgreSQL hoặc MySQL
3. **SSL**: Cài đặt SSL certificate cho domain
4. **Backup**: Thường xuyên backup database và files
