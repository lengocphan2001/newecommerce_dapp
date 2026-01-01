# Hướng dẫn Deploy Backend lên Shared Hosting với Node.js Support

## Yêu cầu

- Shared hosting có hỗ trợ Node.js (cPanel Node.js Selector hoặc SSH access)
- Database (PostgreSQL hoặc MySQL) đã được tạo trên hosting
- FTP/SFTP access hoặc SSH access

---

## Bước 1: Chuẩn bị Backend

### 1.1. Build Backend trên máy local

```bash
cd backend
npm install
npm run build
```

### 1.2. Tạo file .env cho production

Tạo file `backend/.env.production`:

```env
PORT=3000
NODE_ENV=production
DATABASE_URL=postgresql://user:password@host:5432/dbname
JWT_SECRET=your-very-secure-secret-key-here-change-this
```

**Lưu ý:** Không commit file `.env` lên Git!

---

## Bước 2: Upload Backend lên Hosting

### 2.1. Chuẩn bị files để upload

Tạo thư mục `backend-deploy/` với các files sau:

```
backend-deploy/
├── dist/              # Build output (từ npm run build)
├── node_modules/      # Production dependencies
├── package.json
├── package-lock.json
├── ecosystem.config.js # PM2 config
├── .env               # Environment variables
└── logs/              # Tạo thư mục trống cho logs
```

**Lưu ý:** 
- Chỉ upload `node_modules` nếu hosting không có npm
- Nếu hosting có npm, chỉ upload source code và chạy `npm install --production` trên server

### 2.2. Upload qua FTP/SFTP

- Upload toàn bộ thư mục `backend/` lên hosting
- Thường upload vào thư mục như:
  - `public_html/backend/`
  - `nodejs/backend/`
  - `~/backend/` (home directory)

---

## Bước 3: Cấu hình trên Hosting

### Option A: Sử dụng cPanel Node.js Selector

1. **Đăng nhập cPanel**

2. **Tìm Node.js Selector** trong cPanel

3. **Tạo Node.js App mới:**
   - **Node.js version**: Chọn 18.x hoặc 20.x (LTS)
   - **Application root**: Chọn thư mục `backend/` bạn đã upload
   - **Application URL**: 
     - Tạo subdomain: `api.yourdomain.com`
     - Hoặc dùng port: `yourdomain.com:3000`
   - **Application startup file**: `dist/main.js`
   - **Application mode**: Production
   - **Load App URL**: Có thể để trống hoặc nhập URL API

4. **Cấu hình Environment Variables:**
   - Click vào app vừa tạo
   - Thêm các biến môi trường:
     ```
     PORT=3000
     DATABASE_URL=postgresql://user:password@host:5432/dbname
     JWT_SECRET=your-secret-key
     NODE_ENV=production
     ```

5. **Start Application:**
   - Click "Start" hoặc "Restart"
   - Kiểm tra logs để đảm bảo không có lỗi

### Option B: Sử dụng SSH

1. **SSH vào server:**
```bash
ssh username@yourdomain.com
```

2. **Di chuyển đến thư mục backend:**
```bash
cd ~/backend  # hoặc đường dẫn bạn đã upload
```

3. **Cài đặt dependencies (nếu chưa upload node_modules):**
```bash
npm install --production
```

4. **Build project (nếu chưa build):**
```bash
npm run build
```

5. **Cài đặt PM2 (Process Manager):**
```bash
npm install -g pm2
```

6. **Start backend với PM2:**
```bash
pm2 start ecosystem.config.js
# hoặc
pm2 start dist/main.js --name backend
```

7. **Lưu cấu hình PM2:**
```bash
pm2 save
```

8. **Cấu hình PM2 tự động start khi server reboot:**
```bash
pm2 startup
# Làm theo hướng dẫn để tạo systemd service
```

9. **Kiểm tra status:**
```bash
pm2 status
pm2 logs backend
```

---

## Bước 4: Cấu hình Database

### 4.1. Tạo Database trên Hosting

1. Vào cPanel → MySQL Databases
2. Tạo database mới (ví dụ: `ecommerce_db`)
3. Tạo user mới và gán quyền cho database
4. Lưu lại thông tin:
   - Database name
   - Username
   - Password
   - Host (thường là `localhost`)

### 4.2. Cập nhật DATABASE_URL

Cập nhật trong `.env` hoặc Environment Variables:

**PostgreSQL:**
```
DATABASE_URL=postgresql://username:password@localhost:5432/dbname
```

**MySQL:**
```
DATABASE_URL=mysql://username:password@localhost:3306/dbname
```

### 4.3. Chạy Migrations (nếu có)

Nếu bạn có TypeORM migrations:

```bash
# SSH vào server
cd ~/backend
npm run migration:run
# hoặc tạo migration script trong package.json
```

---

## Bước 5: Cấu hình CORS

Cập nhật file `backend/src/main.ts`:

```typescript
app.enableCors({
  origin: [
    'https://yourdomain.com',
    'https://www.yourdomain.com',
    'https://yourdomain.com/admin',
    'http://localhost:3000', // Cho development
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});
```

Rebuild và restart:
```bash
npm run build
pm2 restart backend
```

---

## Bước 6: Cấu hình Firewall và Port

### 6.1. Mở Port (nếu cần)

Nếu backend chạy trên port tùy chỉnh (không phải 80/443):

1. Vào cPanel → Firewall
2. Mở port 3000 (hoặc port bạn đã cấu hình)

### 6.2. Cấu hình Reverse Proxy (Khuyến nghị)

Thay vì dùng port, nên dùng subdomain với reverse proxy:

1. Tạo subdomain `api.yourdomain.com` trong cPanel
2. Cấu hình reverse proxy trong `.htaccess` của subdomain:

```apache
<IfModule mod_proxy.c>
  ProxyPreserveHost On
  ProxyPass / http://localhost:3000/
  ProxyPassReverse / http://localhost:3000/
</IfModule>
```

Hoặc trong Apache config:
```apache
<VirtualHost *:80>
    ServerName api.yourdomain.com
    ProxyPreserveHost On
    ProxyPass / http://localhost:3000/
    ProxyPassReverse / http://localhost:3000/
</VirtualHost>
```

---

## Bước 7: Kiểm tra và Test

### 7.1. Kiểm tra Backend đang chạy

**Trong cPanel:**
- Vào Node.js Selector → xem status của app
- Click "View Logs" để xem logs

**Qua SSH:**
```bash
pm2 status
pm2 logs backend --lines 50
```

### 7.2. Test API

```bash
# Test health check
curl https://api.yourdomain.com/api

# Test với browser
https://api.yourdomain.com/api
```

### 7.3. Kiểm tra Database Connection

Xem logs để đảm bảo database kết nối thành công:
```bash
pm2 logs backend | grep -i database
```

---

## Bước 8: Cấu hình Frontend và Admin

### 8.1. Cập nhật API URL trong Frontend

Tạo file `.env.production` trong root:

```env
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
```

Rebuild frontend:
```bash
npm run build
```

### 8.2. Cập nhật API URL trong Admin

Tạo file `admin/.env.production`:

```env
REACT_APP_API_URL=https://api.yourdomain.com
```

Rebuild admin:
```bash
cd admin
npm run build
```

---

## Quản lý Backend sau khi Deploy

### Xem Logs

**cPanel:**
- Node.js Selector → View Logs

**SSH:**
```bash
pm2 logs backend
pm2 logs backend --lines 100  # Xem 100 dòng cuối
pm2 logs backend --err        # Chỉ xem errors
```

### Restart Backend

**cPanel:**
- Node.js Selector → Restart App

**SSH:**
```bash
pm2 restart backend
# hoặc
pm2 restart all
```

### Stop Backend

**cPanel:**
- Node.js Selector → Stop App

**SSH:**
```bash
pm2 stop backend
```

### Update Backend

1. Upload files mới
2. SSH vào server:
```bash
cd ~/backend
npm install --production
npm run build
pm2 restart backend
```

---

## Troubleshooting

### Backend không start được

1. Kiểm tra logs:
```bash
pm2 logs backend
```

2. Kiểm tra port đã được sử dụng:
```bash
netstat -tulpn | grep :3000
```

3. Kiểm tra file `.env` có đúng không:
```bash
cat .env
```

### Database connection failed

1. Kiểm tra DATABASE_URL trong `.env`
2. Kiểm tra database đã được tạo chưa
3. Kiểm tra user có quyền truy cập database
4. Kiểm tra firewall có chặn connection không

### CORS errors

1. Kiểm tra CORS config trong `main.ts`
2. Đảm bảo domain frontend đã được thêm vào origin list
3. Kiểm tra credentials: true nếu dùng cookies

### PM2 không tự động start sau reboot

```bash
pm2 startup
# Làm theo hướng dẫn để tạo systemd service
pm2 save
```

### Port đã được sử dụng

Thay đổi PORT trong `.env`:
```env
PORT=3001
```

Hoặc kill process đang dùng port:
```bash
lsof -ti:3000 | xargs kill -9
```

---

## Bảo mật

1. **Không commit `.env` lên Git**
2. **Sử dụng JWT_SECRET mạnh**
3. **Enable HTTPS cho API subdomain**
4. **Giới hạn CORS origins**
5. **Sử dụng firewall để giới hạn access**
6. **Regular backup database**

---

## Checklist

- [ ] Backend đã được build (`npm run build`)
- [ ] Files đã được upload lên hosting
- [ ] Node.js app đã được tạo trong cPanel (hoặc PM2 đã được cấu hình)
- [ ] Environment variables đã được cấu hình
- [ ] Database đã được tạo và kết nối thành công
- [ ] Backend đang chạy và accessible
- [ ] CORS đã được cấu hình đúng
- [ ] Frontend và Admin đã được cập nhật API URL
- [ ] HTTPS đã được cấu hình cho API subdomain
- [ ] Logs được monitor thường xuyên
