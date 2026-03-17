# Hướng dẫn Deploy lên Ubuntu VPS (Backend, Frontend, Admin)

Tài liệu này mô tả cách deploy cả 3 module **Backend (NestJS)**, **Frontend (Next.js)** và **Admin (React CRA)** lên một máy chủ Ubuntu (VPS).

---

## 1. Chuẩn bị VPS (Ubuntu)

### 1.1 Cập nhật hệ thống

```bash
sudo apt update && sudo apt upgrade -y
```

### 1.2 Cài đặt Node.js (LTS, khuyến nghị v20)

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v   # v20.x.x
npm -v
```

### 1.3 Cài đặt PM2 (process manager)

```bash
sudo npm install -g pm2
```

### 1.4 Cài đặt Nginx (reverse proxy + static files)

```bash
sudo apt install -y nginx
```

### 1.5 Cài đặt cơ sở dữ liệu (chọn một)

**PostgreSQL (mặc định trong code):**

```bash
sudo apt install -y postgresql postgresql-contrib
sudo -u postgres createuser -P your_db_user
sudo -u postgres createdb -O your_db_user ecommerce_dapp
```

**Hoặc MySQL:**

```bash
sudo apt install -y mysql-server
sudo mysql -e "CREATE USER 'your_db_user'@'localhost' IDENTIFIED BY 'your_password';"
sudo mysql -e "CREATE DATABASE ecommerce_dapp;"
sudo mysql -e "GRANT ALL ON ecommerce_dapp.* TO 'your_db_user'@'localhost'; FLUSH PRIVILEGES;"
```

### 1.6 (Tùy chọn) Cài đặt Certbot (SSL)

```bash
sudo apt install -y certbot python3-certbot-nginx
```

---

## 2. Clone code và cấu hình

### 2.1 Clone repository

```bash
cd /var/www
sudo mkdir -p shopii
sudo chown $USER:$USER shopii
cd shopii
git clone <URL_REPO_CUA_BAN> .
# hoặc upload code qua scp/rsync
```

### 2.2 Cấu trúc thư mục sau khi build

```
/var/www/shopii/
├── backend/          # NestJS API
├── admin/            # React Admin (build ra admin/build)
├── (root)/           # Next.js Frontend (build ra .next hoặc out nếu static)
├── .env              # env cho FE (Next)
├── backend/.env      # env cho Backend
└── admin/.env.production  # env cho Admin build
```

---

## 3. Deploy Backend (NestJS)

### 3.1 Tạo file `.env` trong `backend/`

```bash
cd /var/www/shopii/backend
nano .env
```

Nội dung mẫu (chỉnh theo VPS của bạn):

```env
NODE_ENV=production
PORT=3002

# Database (PostgreSQL mặc định)
DB_TYPE=postgres
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=your_db_user
DB_PASSWORD=your_db_password
DB_NAME=ecommerce_dapp

# JWT (tạo chuỗi bí mật mạnh)
JWT_SECRET=your_super_secret_jwt_key_change_this

# CORS – thêm domain thật của bạn
CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com,https://yourdomain.com/admin

# (Tùy chọn) Redis nếu dùng queue/cache
# REDIS_HOST=localhost
# REDIS_PORT=6379

# (Tùy chọn) SMTP nếu gửi mail
# SMTP_HOST=
# SMTP_PORT=587
# SMTP_USER=
# SMTP_PASS=
```

**Lưu ý:** Trên production nên đặt `FORCE_SYNC=false` hoặc không set (synchronize DB sẽ tắt khi `NODE_ENV=production` trong code).

### 3.2 Cài đặt, build và chạy

```bash
cd /var/www/shopii/backend
npm ci
npm run build
```

Tạo thư mục upload (nếu chưa có):

```bash
mkdir -p uploads
```

Chạy bằng PM2:

```bash
pm2 start dist/main.js --name "shopii-api"
# hoặc dùng script trong package.json:
pm2 start npm --name "shopii-api" -- run start:prod
```

Kiểm tra:

```bash
pm2 status
pm2 logs shopii-api
curl -s http://localhost:3002
```

Lưu cấu hình PM2 để tự chạy lại khi reboot:

```bash
pm2 save
pm2 startup
```

---

## 4. Deploy Frontend (Next.js)

Bạn có thể chạy Next ở chế độ server (`next start`) hoặc build static và chỉ serve file tĩnh qua Nginx.

### 4.1 File `.env` tại thư mục gốc (cùng cấp với `package.json` của Next)

```bash
cd /var/www/shopii
nano .env
```

Ví dụ:

```env
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
NEXT_PUBLIC_SITE_URL=https://yourdomain.com
NEXT_PUBLIC_PAYMENT_WALLET=0xYourPaymentWalletAddress
```

Nếu dùng **static export** (chỉ serve file tĩnh, không cần Node cho FE):

```bash
NEXT_PUBLIC_STATIC_EXPORT=true
```

### 4.2 Build và chạy

**Cách 1: Chạy Next server (SSR / API routes nếu có)**

```bash
cd /var/www/shopii
npm ci
npm run build
pm2 start npm --name "shopii-fe" -- start
```

**Cách 2: Static export (chỉ HTML/JS/CSS, Nginx serve)**

```bash
cd /var/www/shopii
npm ci
npm run build:static
# Output nằm trong thư mục out/
# Chỉ cần cấu hình Nginx trỏ root tới out/ (xem mục 6).
```

---

## 5. Deploy Admin (React)

Admin là ứng dụng React (CRA), build ra thư mục `admin/build`. Có thể serve qua Nginx tại path `/admin`.

### 5.1 File `admin/.env.production`

```bash
cd /var/www/shopii/admin
nano .env.production
```

Ví dụ:

```env
REACT_APP_API_URL=https://api.yourdomain.com
# Hoặc cùng domain với backend: https://yourdomain.com/api
```

`homepage` trong `admin/package.json` đã là `"/admin"`, nên build sẽ dùng base path `/admin`.

### 5.2 Build

```bash
cd /var/www/shopii/admin
npm ci
npm run build:prod
```

Sau bước này, file static nằm trong `admin/build/`.

---

## 6. Cấu hình Nginx

Giả sử:

- Domain chính (FE): `https://yourdomain.com`
- Admin: `https://yourdomain.com/admin`
- API Backend: `https://api.yourdomain.com` (hoặc `https://yourdomain.com/api`)

### 6.1 Backend (API) – subdomain hoặc path

Tạo file cấu hình:

```bash
sudo nano /etc/nginx/sites-available/shopii
```

**Ví dụ 1: API qua subdomain `api.yourdomain.com`**

```nginx
# Backend API
server {
    listen 80;
    server_name api.yourdomain.com;
    location / {
        proxy_pass http://127.0.0.1:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        client_max_body_size 50M;
    }
}
```

**Ví dụ 2: API qua path `https://yourdomain.com/api`** (cùng domain với FE)

Dùng trong block `server` của `yourdomain.com` (xem 6.2):

```nginx
location /api {
    rewrite ^/api/?(.*) /$1 break;
    proxy_pass http://127.0.0.1:3002;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    client_max_body_size 50M;
}
```

Khi đó `NEXT_PUBLIC_API_URL` và `REACT_APP_API_URL` có thể là `https://yourdomain.com/api`.

### 6.2 Frontend + Admin (cùng domain)

**Nếu FE chạy bằng `next start` (PM2) – ví dụ port 3000:**

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    location /admin {
        alias /var/www/shopii/admin/build;
        try_files $uri $uri/ /admin/index.html;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

**Nếu FE dùng static export (thư mục `out/`):**

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    root /var/www/shopii/out;

    location /admin {
        alias /var/www/shopii/admin/build;
        try_files $uri $uri/ /admin/index.html;
    }

    location / {
        try_files $uri $uri/ $uri.html /index.html;
    }
}
```

### 6.3 Bật site và reload Nginx

```bash
sudo ln -sf /etc/nginx/sites-available/shopii /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 6.4 SSL với Certbot

```bash
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com -d api.yourdomain.com
sudo certbot renew --dry-run
```

Sau khi có SSL, trong `.env` FE/Admin dùng `https://...` cho API URL và Site URL.

---

## 7. Tóm tắt lệnh deploy (sau lần đầu cấu hình)

```bash
# 1. Backend
cd /var/www/shopii/backend
git pull
npm ci
npm run build
pm2 restart shopii-api

# 2. Frontend (nếu dùng next start)
cd /var/www/shopii
git pull
npm ci
npm run build
pm2 restart shopii-fe

# Hoặc static:
# npm run build:static  → Nginx đã trỏ root tới out/

# 3. Admin
cd /var/www/shopii/admin
git pull
npm ci
npm run build:prod
# Nginx serve admin/build tại /admin → không cần restart PM2
```

---

## 8. Biến môi trường cần nhớ

| Module   | File env                | Biến quan trọng |
|----------|-------------------------|------------------|
| Backend  | `backend/.env`          | `PORT`, `DB_*`, `JWT_SECRET`, `CORS_ORIGINS` |
| Frontend | `.env` (root)           | `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SITE_URL` |
| Admin    | `admin/.env.production` | `REACT_APP_API_URL` |

Đảm bảo `CORS_ORIGINS` ở Backend có đủ domain FE và Admin (ví dụ `https://yourdomain.com`, `https://yourdomain.com/admin` nếu cùng origin).

---

## 9. Xử lý sự cố nhanh

- **API 502:** Kiểm tra Backend có chạy: `pm2 status`, `pm2 logs shopii-api`. Kiểm tra `backend/.env` (DB, PORT).
- **FE/Admin trắng hoặc 404:** Kiểm tra Nginx `root`/`alias`, đường dẫn `out/` và `admin/build/`. Base path Admin phải là `/admin`.
- **CORS:** Thêm đúng domain vào `CORS_ORIGINS` trong `backend/.env` và restart Backend.
- **Upload file:** Backend serve upload tại `/files`. Đảm bảo thư mục `backend/uploads` tồn tại và Nginx không chặn body size (`client_max_body_size 50M;`).

Nếu bạn dùng domain/path khác (ví dụ API tại `https://yourdomain.com/api`), chỉ cần chỉnh lại `proxy_pass` và các biến `*_API_URL` cho đúng.
