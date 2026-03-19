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
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
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

### 1.5 Cài đặt cơ sở dữ liệu (MySQL cho Backend)

**MySQL (dùng cho Backend):**

```bash
sudo apt install -y mysql-server
sudo mysql -e "CREATE USER 'shopiibiztest'@'localhost' IDENTIFIED BY 'paswotr123';"
sudo mysql -e "CREATE DATABASE shopiibiztest;"
sudo mysql -e "GRANT ALL ON shopiibiztest.* TO 'shopiibiztest'@'localhost'; FLUSH PRIVILEGES;"
```

**Hoặc PostgreSQL:**

```bash
sudo apt install -y postgresql postgresql-contrib
sudo -u postgres createuser -P your_db_user
sudo -u postgres createdb -O your_db_user ecommerce_dapp
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
├── ecosystem.config.js   # PM2: Backend + Frontend (khuyến nghị)
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

# Database (MySQL)
DB_TYPE=mysql
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=shopiibiztest
DB_PASSWORD=paswotr123
DB_NAME=shopiibiztest

# JWT (tạo chuỗi bí mật mạnh)
JWT_SECRET=your_super_secret_jwt_key_change_this

# CORS – domain của bạn
CORS_ORIGINS=https://shopiibiztest.top,https://www.shopiibiztest.top,https://shopiibiztest.top/admin

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

Chạy bằng PM2: dùng file **ecosystem** (mục 3.3 bên dưới) để tránh lỗi `MODULE_NOT_FOUND` do sai `cwd`.

### 3.3 PM2 ecosystem (Backend + Frontend)

Tạo **một file** ecosystem tại thư mục gốc repo, khai báo cả API và FE:

```bash
cd /var/www/shopii
cat > ecosystem.config.js <<'EOF'
module.exports = {
  apps: [
    {
      name: 'shopii-api',
      script: 'npm',
      args: 'run start:prod',
      cwd: '/var/www/shopii/backend',
      env: { NODE_ENV: 'production' }
    },
    {
      name: 'shopii-fe',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3001',
      cwd: '/var/www/shopii',
      env: { NODE_ENV: 'production' }
    }
  ]
};
EOF
```

**Lưu ý:** **Admin** không nằm trong ecosystem vì là ứng dụng React build ra file tĩnh (`admin/build/`). Nginx serve trực tiếp thư mục đó tại path `/admin`, không cần process Node/PM2.

**Lần đầu:** phải build Backend và Frontend trước, rồi mới chạy PM2 (nếu chưa build sẽ báo `Script not found: .../backend/dist/main.js`):

```bash
# Bước 1: Build Backend (bắt buộc trước khi start PM2)
# Build ra dist/src/main.js (không phải dist/main.js)
cd /var/www/shopii/backend
npm ci
npm run build

# Bước 2: Build Frontend (nếu dùng next start)
cd /var/www/shopii
npm ci
npm run build

# Bước 3: Khởi động PM2
cd /var/www/shopii
pm2 delete shopii-api shopii-fe 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save
pm2 startup
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
NEXT_PUBLIC_API_URL=https://shopiibiztest.top/api
NEXT_PUBLIC_SITE_URL=https://shopiibiztest.top
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
# Khởi động bằng ecosystem (đã cấu hình ở mục 3.3)
pm2 start ecosystem.config.js --only shopii-fe
# Hoặc khởi động cả API + FE: pm2 start ecosystem.config.js
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

Admin là ứng dụng React (CRA), build ra thư mục `admin/build`. **Không dùng PM2:** Nginx serve trực tiếp thư mục tĩnh tại path `/admin` (xem mục 6.2).

### 5.x Import sản phẩm từ CSV (Admin)

Trong trang **Products** của Admin:

- **Export Products**: tải file `products.csv`.
- **Import CSV**: upload lại `products.csv` (hoặc file CSV theo đúng header export). Backend sẽ **upsert**:
  - Có cột `ID`: nếu ID tồn tại thì update, không tồn tại thì tạo mới (giữ nguyên ID).
  - Bỏ qua ảnh (thumbnail/detail images) – bạn có thể chỉnh ảnh sau.

### 5.1 File `admin/.env.production`

```bash
cd /var/www/shopii/admin
nano .env.production
```

Ví dụ:

```env
REACT_APP_API_URL=https://shopiibiztest.top/api
```

`homepage` trong `admin/package.json` đã là `"/admin"`, nên build sẽ dùng base path `/admin`.

### 5.2 Build

```bash
cd /var/www/shopii/admin
npm ci
npm run build:prod
```

Sau bước này, file static nằm trong `admin/build/`.

**Nếu build bị thoát sớm / "exited too early":** thường do VPS hết RAM (OOM). Thử theo thứ tự:

1. **Tăng swap** (khuyến nghị trên VPS RAM thấp):

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

2. **Giới hạn bộ nhớ Node** rồi build lại:

```bash
cd /var/www/shopii/admin
NODE_OPTIONS=--max-old-space-size=2048 npm run build:prod
# VPS 512MB: dùng 1536; 1GB: 2048; 2GB: 3072
```

3. **Build trên máy local** rồi đẩy thư mục `build` lên VPS:

```bash
# Trên máy local (Windows/Mac), trong repo:
cd admin
npm ci
npm run build:prod
# Đẩy admin/build lên VPS:
scp -r build root@your-vps-ip:/var/www/shopii/admin/
```

---

## 6. Cấu hình Nginx

Giả sử:

- Domain chính (FE): `https://shopiibiztest.top`
- Admin: `https://shopiibiztest.top/admin`
- API Backend: `https://shopiibiztest.top/api` (cùng domain, path `/api`)

### 6.0 Nhiều domain trên cùng VPS (shopiibiztest.top bị trùng nội dung domain khác)

Khi bạn đã có một domain khác chạy trên VPS, truy cập **shopiibiztest.top** có thể thấy nội dung của domain kia vì:

- Nginx dùng **`server_name`** để chọn server block. Nếu không có block nào khớp `shopiibiztest.top`, Nginx dùng **default server** (block có `listen 80 default_server` hoặc block đọc đầu tiên).
- Cần có **một file cấu hình riêng** cho Shopii, **chỉ** `server_name shopiibiztest.top www.shopiibiztest.top`, không trùng với domain kia.

**Cách xử lý:**

1. **Xem site nào đang là default và các file đang bật:**
   ```bash
   ls -la /etc/nginx/sites-enabled/
   sudo nginx -T 2>/dev/null | grep -E "server_name|listen|default_server"
   ```
   Ghi nhớ domain nào đang dùng `default_server` (nếu có).

2. **Tạo file cấu hình chỉ cho Shopii** (tên file riêng, ví dụ `shopiibiztest` hoặc `shopii`):
   ```bash
   sudo nano /etc/nginx/sites-available/shopiibiztest
   ```
   Dán **đúng** một trong hai block `server` ở mục 6.2 (PM2 port 3001 hoặc static `out/`). Trong block đó **bắt buộc** có:
   ```nginx
   server_name shopiibiztest.top www.shopiibiztest.top;
   ```
   Không thêm domain khác vào dòng này.

3. **Bật site Shopii và kiểm tra:**
   ```bash
   sudo ln -sf /etc/nginx/sites-available/shopiibiztest /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl reload nginx
   ```

4. **Nếu domain kia đang dùng `default_server`:** mở file config của domain đó (trong `sites-available`), tìm `listen 80 default_server;` và **bỏ** `default_server` (chỉ để `listen 80;`), đồng thời đảm bảo trong đó có `server_name domain-kia.com www.domain-kia.com;`. Reload Nginx lại. Như vậy mỗi domain chỉ nhận đúng host của nó.

5. **Kiểm tra DNS:** `shopiibiztest.top` và `www.shopiibiztest.top` phải trỏ A record về đúng IP VPS.

Sau khi sửa, truy cập `http://shopiibiztest.top` sẽ vào đúng FE Shopii, không còn hiện nội dung domain kia.

### 6.1 Backend (API) – subdomain hoặc path

Tạo file cấu hình:

```bash
sudo nano /etc/nginx/sites-available/shopii
```

**API qua path `https://shopiibiztest.top/api`** (cùng domain với FE) – khuyến nghị

Thêm vào block `server` của `shopiibiztest.top` (xem 6.2):

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

`NEXT_PUBLIC_API_URL` và `REACT_APP_API_URL` đặt là `https://shopiibiztest.top/api` (đã cấu hình ở mục 4.1 và 5.1).

### 6.2 Frontend + Admin (cùng domain)

**Nếu FE chạy bằng `next start` (PM2) – port 3001:**

```nginx
server {
    listen 80;
    server_name shopiibiztest.top www.shopiibiztest.top;

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

    location /admin {
        alias /var/www/shopii/admin/build;
        try_files $uri $uri/ /admin/index.html;
    }

    location / {
        proxy_pass http://127.0.0.1:3001;
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
    server_name shopiibiztest.top www.shopiibiztest.top;
    root /var/www/shopii/out;

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

Dùng đúng tên file bạn đã tạo (ví dụ `shopii` hoặc `shopiibiztest`):

```bash
sudo ln -sf /etc/nginx/sites-available/shopii /etc/nginx/sites-enabled/
# Hoặc nếu bạn đặt tên file shopiibiztest:
# sudo ln -sf /etc/nginx/sites-available/shopiibiztest /etc/nginx/sites-enabled/

sudo nginx -t
sudo systemctl reload nginx
```

### 6.4 SSL với Certbot

```bash
sudo certbot --nginx -d shopiibiztest.top -d www.shopiibiztest.top
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

# 2. Frontend (nếu dùng next start)
cd /var/www/shopii
git pull
npm ci
npm run build

# 3. Khởi động lại cả API + FE qua ecosystem (một lệnh)
cd /var/www/shopii
pm2 reload ecosystem.config.js
# Hoặc chỉ một app: pm2 reload ecosystem.config.js --only shopii-api

# Hoặc static FE:
# npm run build:static  → Nginx đã trỏ root tới out/

# 4. Admin
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

Đảm bảo `CORS_ORIGINS` ở Backend có đủ domain FE và Admin (ví dụ `https://shopiibiztest.top`, `https://shopiibiztest.top/admin` nếu cùng origin).

---

## 9. Xử lý sự cố nhanh

- **Admin build "exited too early" / thoát sớm:** VPS thiếu RAM. Thêm swap (mục 5.2), hoặc chạy `NODE_OPTIONS=--max-old-space-size=2048 npm run build:prod`, hoặc build Admin trên máy local rồi scp thư mục `admin/build` lên VPS.
- **`Script not found: .../backend/dist/main.js` / API không start:** Backend build ra `dist/src/main.js` (không phải `dist/main.js`). Đảm bảo `package.json` có `"start:prod": "node dist/src/main.js"`. Sau khi sửa: `cd /var/www/shopii/backend && npm run build && ls dist/src/main.js`, rồi `pm2 restart shopii-api`.
- **API 502:** Kiểm tra Backend có chạy: `pm2 status`, `pm2 logs shopii-api`. Kiểm tra `backend/.env` (DB, PORT).
- **MySQL báo `ER_NO_SUCH_TABLE` (thiếu bảng):** Chạy script tạo bảng: `cd /var/www/shopii/backend && npm run db:init`. Script này dùng `.env` để kết nối và sẽ `synchronize` để tạo các table cần thiết (bao gồm `wallet_deposit_requests`). Sau đó restart API: `pm2 restart shopii-api`.  
- **shopiibiztest.top hiện nội dung domain khác:** Cần server block riêng chỉ với `server_name shopiibiztest.top www.shopiibiztest.top` (mục 6.0). Kiểm tra `sites-enabled`, bỏ `default_server` khỏi config domain kia nếu cần.
- **FE/Admin trắng hoặc 404:** Kiểm tra Nginx `root`/`alias`, đường dẫn `out/` và `admin/build/`. Base path Admin phải là `/admin`.
- **CORS:** Thêm đúng domain vào `CORS_ORIGINS` trong `backend/.env` và restart Backend.
- **Upload file:** Backend serve upload tại `/files`. Đảm bảo thư mục `backend/uploads` tồn tại và Nginx không chặn body size (`client_max_body_size 50M;`).

Nếu bạn dùng domain/path khác (ví dụ API tại `https://shopiibiztest.top/api`), chỉ cần chỉnh lại `proxy_pass` và các biến `*_API_URL` cho đúng.
