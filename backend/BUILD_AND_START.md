# Hướng dẫn Build và Start Backend

## Vấn đề
Lỗi `Script not found: /var/www/backend/dist/main.js` khi chạy PM2.

## Nguyên nhân
Backend chưa được build, thư mục `dist/` chưa tồn tại hoặc chưa có file `main.js`.

## Giải pháp

### Bước 1: Kiểm tra thư mục hiện tại

```bash
cd /var/www/backend
pwd  # Phải hiển thị /var/www/backend
ls -la  # Kiểm tra có file package.json
```

### Bước 2: Cài đặt Dependencies (nếu chưa có)

```bash
npm install
```

**Lưu ý**: Nếu dùng production, có thể dùng:
```bash
npm install --production
```

Nhưng để build, cần devDependencies, nên dùng:
```bash
npm install
```

### Bước 3: Build Backend

```bash
npm run build
```

Lệnh này sẽ:
- Compile TypeScript sang JavaScript
- Tạo thư mục `dist/` với các file đã build
- Tạo file `dist/main.js` (entry point)

### Bước 4: Kiểm tra Build thành công

```bash
ls -la dist/
# Phải thấy file main.js
ls -la dist/main.js
```

### Bước 5: Tạo thư mục logs (nếu chưa có)

```bash
mkdir -p logs
```

### Bước 6: Start với PM2

```bash
pm2 start ecosystem.config.js
```

Hoặc nếu muốn start trực tiếp:
```bash
pm2 start dist/main.js --name ecommerce-backend
```

### Bước 7: Kiểm tra Status

```bash
pm2 status
pm2 logs ecommerce-backend
```

## Quy trình đầy đủ (Copy & Paste)

```bash
# 1. Vào thư mục backend
cd /var/www/backend

# 2. Pull code mới (nếu dùng git)
git pull origin master

# 3. Cài dependencies
npm install

# 4. Build
npm run build

# 5. Tạo thư mục logs
mkdir -p logs

# 6. Stop PM2 nếu đang chạy
pm2 stop ecommerce-backend || true
pm2 delete ecommerce-backend || true

# 7. Start với PM2
pm2 start ecosystem.config.js

# 8. Kiểm tra
pm2 status
pm2 logs ecommerce-backend --lines 50
```

## Troubleshooting

### Nếu build bị lỗi:

1. **Kiểm tra TypeScript errors:**
   ```bash
   npm run build 2>&1 | tee build.log
   cat build.log
   ```

2. **Kiểm tra dependencies:**
   ```bash
   npm list --depth=0
   ```

3. **Xóa node_modules và cài lại:**
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   npm run build
   ```

### Nếu PM2 vẫn không start:

1. **Kiểm tra file tồn tại:**
   ```bash
   ls -la dist/main.js
   file dist/main.js  # Kiểm tra file type
   ```

2. **Test chạy trực tiếp:**
   ```bash
   node dist/main.js
   ```
   Nếu chạy được, có thể là vấn đề PM2 config.

3. **Kiểm tra ecosystem.config.js:**
   ```bash
   cat ecosystem.config.js
   ```

4. **Start với absolute path:**
   ```bash
   pm2 start /var/www/backend/dist/main.js --name ecommerce-backend
   ```

### Nếu thiếu environment variables:

Tạo file `.env` trong thư mục backend:
```bash
nano .env
```

Thêm các biến cần thiết:
```env
NODE_ENV=production
PORT=3002
DB_TYPE=postgres
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=your_username
DB_PASSWORD=your_password
DB_NAME=your_database
JWT_SECRET=your_jwt_secret
CORS_ORIGINS=https://vinmall.org,https://www.vinmall.org
```

## Lưu ý

- **Build phải chạy trước khi start PM2**
- **Sau mỗi lần thay đổi code, cần rebuild:**
  ```bash
  npm run build
  pm2 restart ecommerce-backend
  ```

- **Kiểm tra logs thường xuyên:**
  ```bash
  pm2 logs ecommerce-backend --lines 100
  ```

- **Save PM2 process list:**
  ```bash
  pm2 save
  pm2 startup  # Tạo startup script (chạy 1 lần)
  ```
