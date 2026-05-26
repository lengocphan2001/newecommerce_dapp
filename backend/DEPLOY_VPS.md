# Hướng Dẫn Deploy Backend Lên VPS

Hướng dẫn chi tiết để deploy ứng dụng NestJS backend lên VPS (Ubuntu/Debian).

## 📋 Mục Lục

1. [Yêu Cầu Hệ Thống](#yêu-cầu-hệ-thống)
2. [Chuẩn Bị Server](#chuẩn-bị-server)
3. [Cài Đặt Dependencies](#cài-đặt-dependencies)
4. [Cấu Hình Database](#cấu-hình-database)
5. [Cấu Hình Redis](#cấu-hình-redis)
6. [Clone và Setup Project](#clone-và-setup-project)
7. [Cấu Hình Environment](#cấu-hình-environment)
8. [Build và Deploy](#build-và-deploy)
9. [Cấu Hình Nginx](#cấu-hình-nginx)
10. [Cài Đặt SSL (Let's Encrypt)](#cài-đặt-ssl-lets-encrypt)
11. [Quản Lý Process với PM2](#quản-lý-process-với-pm2)
12. [Monitoring và Maintenance](#monitoring-và-maintenance)
13. [Troubleshooting](#troubleshooting)

---

## 🖥️ Yêu Cầu Hệ Thống

- **OS**: Ubuntu 20.04+ hoặc Debian 11+
- **RAM**: Tối thiểu 2GB (khuyến nghị 4GB+)
- **CPU**: 2 cores trở lên
- **Disk**: 20GB+ dung lượng trống
- **Network**: Có domain name trỏ về IP VPS (cho SSL)

---

## 🚀 Chuẩn Bị Server

### 1. Kết nối SSH vào VPS

```bash
ssh root@your-vps-ip
# hoặc
ssh username@your-vps-ip
```

### 2. Cập nhật hệ thống

```bash
sudo apt update
sudo apt upgrade -y
```

### 3. Tạo user mới (tùy chọn, khuyến nghị)

```bash
# Tạo user mới
sudo adduser deploy

# Thêm vào nhóm sudo
sudo usermod -aG sudo deploy

# Chuyển sang user mới
su - deploy
```

---

## 📦 Cài Đặt Dependencies

### 1. Cài đặt Node.js (v18 hoặc v20)

```bash
# Cài đặt Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# Kiểm tra phiên bản
node --version
npm --version
```

### 2. Cài đặt MySQL

```bash
# Cài đặt MySQL
sudo apt install -y mysql-server

# Bảo mật MySQL
sudo mysql_secure_installation

# Đăng nhập MySQL
sudo mysql -u root -p
```

Trong MySQL console:

```sql
-- Tạo database
CREATE DATABASE ecommerce_dapp CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Tạo user và cấp quyền
CREATE USER 'ecommerce_user'@'localhost' IDENTIFIED BY 'password';
GRANT ALL PRIVILEGES ON ecommerce_dapp.* TO 'ecommerce_user'@'localhost';
FLUSH PRIVILEGES;

-- Thoát
EXIT;
```

### 3. Cài đặt Redis

```bash
# Cài đặt Redis
sudo apt install -y redis-server

# Khởi động Redis
sudo systemctl start redis-server
sudo systemctl enable redis-server

# Kiểm tra Redis
redis-cli ping
# Kết quả: PONG
```

### 4. Cài đặt PM2 (Process Manager)

```bash
# Cài đặt PM2 globally
sudo npm install -g pm2

# Khởi động PM2 khi boot
pm2 startup
# Chạy lệnh được hiển thị (thường là sudo env PATH=...)
```

### 5. Cài đặt Nginx

```bash
# Cài đặt Nginx
sudo apt install -y nginx

# Khởi động Nginx
sudo systemctl start nginx
sudo systemctl enable nginx

# Kiểm tra status
sudo systemctl status nginx
```

### 6. Cài đặt Git

```bash
sudo apt install -y git
```

---

## 🗄️ Cấu Hình Database

### Khởi tạo database schema

Sau khi clone project và cấu hình environment, chạy:

```bash
cd backend
npm run db:init
```

Hoặc import schema thủ công nếu có file SQL.

---

## 🔴 Cấu Hình Redis

### Kiểm tra Redis đang chạy

```bash
sudo systemctl status redis-server
```

### Cấu hình Redis (nếu cần)

File cấu hình: `/etc/redis/redis.conf`

```bash
sudo nano /etc/redis/redis.conf
```

Các thay đổi thường cần:
- `bind 127.0.0.1` (chỉ cho phép localhost)
- `maxmemory 256mb` (tùy chỉnh theo RAM)
- `maxmemory-policy allkeys-lru`

Sau đó restart:

```bash
sudo systemctl restart redis-server
```

---

## 📥 Clone và Setup Project

### 1. Clone repository

```bash
# Tạo thư mục cho ứng dụng
sudo mkdir -p /var/www
cd /var/www

# Clone repository (thay bằng URL repo của bạn)
sudo git clone https://github.com/your-username/newecommerce_dapp.git
# hoặc
sudo git clone git@github.com:your-username/newecommerce_dapp.git

# Cấp quyền cho user hiện tại
sudo chown -R $USER:$USER /var/www/newecommerce_dapp
```

### 2. Cài đặt dependencies

```bash
cd /var/www/newecommerce_dapp/backend
npm install --production
```

---

## ⚙️ Cấu Hình Environment

### 1. Tạo file .env

```bash
cd /var/www/newecommerce_dapp/backend
cp env.example .env
nano .env
```

### 2. Cấu hình các biến môi trường

```env
NODE_ENV=production
PORT=3002

## Frontend URL (for generating referral links)
FRONTEND_URL=https://safemall.org

## JWT
JWT_SECRET=your-very-strong-secret-key-here-change-this
JWT_EXPIRES_IN=24h

## Database
DB_TYPE=mysql
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=ecommerce_user
DB_PASSWORD=your_strong_password
DB_NAME=ecommerce_dapp

## Blockchain
BSC_NETWORK=mainnet
BSC_TESTNET_RPC=https://data-seed-prebsc-1-s1.binance.org:8545
BSC_MAINNET_RPC=https://bsc-dataseed.binance.org/
BLOCKCHAIN_PRIVATE_KEY=your_blockchain_private_key
TOKEN_ADDRESS=0x55d398326f99059fF775485246999027B3197955
PRIVATE_KEY=your_private_key
COMMISSION_PAYOUT_CONTRACT_ADDRESS=your_contract_address

## Auto Payout Configuration
AUTO_PAYOUT_ENABLED=true
AUTO_PAYOUT_BATCH_SIZE=50
AUTO_PAYOUT_MIN_AMOUNT=0.0001

## Google Sheets Configuration (nếu cần)
GOOGLE_SHEET_ID=your_google_sheet_id
GOOGLE_SERVICE_ACCOUNT_EMAIL=your_service_account@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

**⚠️ Lưu ý bảo mật:**
- Đặt quyền file .env chỉ cho owner đọc:
```bash
chmod 600 .env
```

---

## 🏗️ Build và Deploy

### 1. Build ứng dụng

```bash
cd /var/www/newecommerce_dapp/backend
npm run build
```

### 2. Tạo thư mục logs

```bash
mkdir -p logs
```

### 3. Khởi động với PM2

```bash
# Khởi động ứng dụng
pm2 start ecosystem.config.js

# Lưu cấu hình PM2
pm2 save

# Kiểm tra status
pm2 status
pm2 logs ecommerce-backend
```

### 4. Các lệnh PM2 hữu ích

```bash
# Xem logs
pm2 logs ecommerce-backend

# Restart
pm2 restart ecommerce-backend

# Stop
pm2 stop ecommerce-backend

# Xem thông tin chi tiết
pm2 info ecommerce-backend

# Monitor real-time
pm2 monit
```

---

## 🌐 Cấu Hình Nginx

### 1. Tạo file cấu hình Nginx

```bash
sudo nano /etc/nginx/sites-available/ecommerce-backend
```

### 2. Nội dung cấu hình

```nginx
server {
    listen 80;
    server_name vinmall.org;  # Thay bằng domain của bạn

    # Tăng limit cho upload file
    client_max_body_size 50M;
    client_body_timeout 300s;

    # Proxy settings cho backend
    location / {
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Tăng buffer size
        proxy_buffer_size 128k;
        proxy_buffers 4 256k;
        proxy_busy_buffers_size 256k;
        
        # Timeout settings
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }

    # Đặc biệt cho endpoint upload
    location /uploads/ {
        proxy_pass http://localhost:3002/uploads/;
        client_max_body_size 50M;
        client_body_timeout 300s;
        
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Health check endpoint
    location /health {
        proxy_pass http://localhost:3002/health;
        access_log off;
    }
}
```

### 3. Kích hoạt cấu hình

```bash
# Tạo symbolic link
sudo ln -s /etc/nginx/sites-available/ecommerce-backend /etc/nginx/sites-enabled/

# Xóa cấu hình mặc định (nếu không cần)
sudo rm /etc/nginx/sites-enabled/default

# Kiểm tra cấu hình
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

---

## 🔒 Cài Đặt SSL (Let's Encrypt)

### 1. Cài đặt Certbot

```bash
sudo apt install -y certbot python3-certbot-nginx
```

### 2. Cài đặt SSL certificate

```bash
sudo certbot --nginx -d vinmall.org
```

Certbot sẽ:
- Tự động cấu hình Nginx
- Tự động gia hạn certificate

### 3. Kiểm tra auto-renewal

```bash
# Test auto-renewal
sudo certbot renew --dry-run
```

---

## 🔄 Quản Lý Process với PM2

### Cấu hình PM2 ecosystem

File `ecosystem.config.js` đã được cấu hình sẵn. Nếu cần chỉnh sửa:

```bash
nano /var/www/newecommerce_dapp/backend/ecosystem.config.js
```

Sau đó restart:

```bash
pm2 delete ecommerce-backend
pm2 start ecosystem.config.js
pm2 save
```

### Auto-restart khi server reboot

```bash
# Đảm bảo PM2 startup đã được cấu hình
pm2 startup
# Chạy lệnh được hiển thị

# Lưu danh sách process
pm2 save
```

---

## 📊 Monitoring và Maintenance

### 1. Xem logs

```bash
# PM2 logs
pm2 logs ecommerce-backend

# Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# MySQL logs
sudo tail -f /var/log/mysql/error.log
```

### 2. Monitor resources

```bash
# CPU và Memory
htop
# hoặc
top

# Disk usage
df -h

# PM2 monitor
pm2 monit
```

### 3. Backup Database

Tạo script backup:

```bash
sudo nano /usr/local/bin/backup-db.sh
```

Nội dung:

```bash
#!/bin/bash
BACKUP_DIR="/var/backups/mysql"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="ecommerce_dapp"
DB_USER="ecommerce_user"
DB_PASS="your_password"

mkdir -p $BACKUP_DIR
mysqldump -u $DB_USER -p$DB_PASS $DB_NAME > $BACKUP_DIR/backup_$DATE.sql

# Xóa backup cũ hơn 7 ngày
find $BACKUP_DIR -name "backup_*.sql" -mtime +7 -delete
```

Cấp quyền và thêm vào crontab:

```bash
sudo chmod +x /usr/local/bin/backup-db.sh

# Thêm vào crontab (backup mỗi ngày lúc 2h sáng)
sudo crontab -e
# Thêm dòng:
0 2 * * * /usr/local/bin/backup-db.sh
```

### 4. Update ứng dụng

```bash
cd /var/www/newecommerce_dapp

# Pull code mới
git pull origin main

# Cài đặt dependencies mới (nếu có)
cd backend
npm install --production

# Build lại
npm run build

# Restart PM2
pm2 restart ecommerce-backend
```

---

## 🔧 Troubleshooting

### 1. Ứng dụng không khởi động

```bash
# Kiểm tra logs
pm2 logs ecommerce-backend --lines 100

# Kiểm tra port đã được sử dụng chưa
sudo netstat -tulpn | grep 3002

# Kiểm tra file .env
cat .env
```

### 2. Database connection error

```bash
# Kiểm tra MySQL đang chạy
sudo systemctl status mysql

# Test kết nối
mysql -u ecommerce_user -p ecommerce_dapp

# Kiểm tra firewall
sudo ufw status
```

### 3. Redis connection error

```bash
# Kiểm tra Redis đang chạy
sudo systemctl status redis-server

# Test kết nối
redis-cli ping
```

### 4. Nginx 502 Bad Gateway hoặc Connection Refused

**Lỗi:** `connect() failed (111: Connection refused) while connecting to upstream`

Lỗi này xảy ra khi Nginx không thể kết nối tới backend. Thực hiện các bước sau:

#### Bước 1: Kiểm tra backend có đang chạy không

```bash
# Kiểm tra PM2 status
pm2 status

# Nếu không thấy ecommerce-backend, khởi động lại
cd /var/www/newecommerce_dapp/backend
pm2 start ecosystem.config.js
pm2 save
```

#### Bước 2: Kiểm tra port 3002 có đang được sử dụng

```bash
# Kiểm tra port 3002
sudo netstat -tulpn | grep 3002
# hoặc
sudo ss -tulpn | grep 3002

# Kiểm tra process đang lắng nghe
sudo lsof -i :3002
```

#### Bước 3: Test kết nối trực tiếp tới backend

```bash
# Test từ localhost
curl http://localhost:3002
curl http://127.0.0.1:3002

# Test health endpoint (nếu có)
curl http://localhost:3002/health
```

#### Bước 4: Kiểm tra logs của backend

```bash
# Xem logs PM2
pm2 logs ecommerce-backend --lines 50

# Kiểm tra lỗi khởi động
pm2 logs ecommerce-backend --err --lines 100
```

#### Bước 5: Kiểm tra file .env và PORT

```bash
cd /var/www/newecommerce_dapp/backend

# Kiểm tra PORT trong .env
grep PORT .env

# Đảm bảo PORT=3002 (hoặc port bạn đã cấu hình)
```

#### Bước 6: Kiểm tra backend có lắng nghe trên đúng địa chỉ

```bash
# Backend mặc định lắng nghe trên 0.0.0.0 (tất cả interfaces)
# Kiểm tra xem có process nào đang chạy
ps aux | grep node

# Nếu backend không chạy, thử khởi động thủ công để xem lỗi
cd /var/www/newecommerce_dapp/backend
node dist/src/main.js
```

#### Bước 7: Restart backend

```bash
# Stop và start lại
pm2 stop ecommerce-backend
pm2 start ecosystem.config.js
pm2 save

# Hoặc restart
pm2 restart ecommerce-backend
```

#### Bước 8: Kiểm tra firewall (nếu có)

```bash
# Kiểm tra UFW
sudo ufw status

# Nếu firewall đang chặn, cho phép localhost (thường không cần)
# Backend chỉ cần lắng nghe trên localhost, không cần mở port ra ngoài
```

#### Bước 9: Kiểm tra Nginx cấu hình

```bash
# Kiểm tra cấu hình Nginx
sudo nginx -t

# Xem cấu hình proxy_pass
sudo cat /etc/nginx/sites-available/ecommerce-backend | grep proxy_pass

# Đảm bảo proxy_pass trỏ đúng tới http://localhost:3002
```

#### Bước 10: Kiểm tra build có thành công không

```bash
cd /var/www/newecommerce_dapp/backend

# Kiểm tra thư mục dist có tồn tại không
ls -la dist/

# Nếu không có, build lại
npm run build

# Sau đó restart PM2
pm2 restart ecommerce-backend
```

#### Giải pháp nhanh (Quick Fix)

```bash
# 1. Dừng PM2
pm2 stop ecommerce-backend
pm2 delete ecommerce-backend

# 2. Build lại (nếu cần)
cd /var/www/newecommerce_dapp/backend
npm run build

# 3. Khởi động lại với PM2
pm2 start ecosystem.config.js
pm2 save

# 4. Kiểm tra status
pm2 status
pm2 logs ecommerce-backend

# 5. Test kết nối
curl http://localhost:3002

# 6. Reload Nginx
sudo nginx -t
sudo systemctl reload nginx
```

### 5. Upload file bị lỗi 413

Xem file `NGINX_CONFIG.md` trong thư mục backend để cấu hình `client_max_body_size`.

### 6. Referral links vẫn hiển thị localhost

**Vấn đề:** Sau khi deploy, các referral links vẫn hiển thị `http://localhost:3000/...` thay vì domain production.

**Nguyên nhân:** Backend sử dụng biến môi trường `FRONTEND_URL` để tạo referral links, nhưng biến này chưa được cấu hình hoặc vẫn đang trỏ về localhost.

**Giải pháp:**

1. **Kiểm tra file .env của backend:**
```bash
cd /var/www/ecommerce_dapp_backend
grep FRONTEND_URL .env
```

2. **Thêm hoặc cập nhật biến FRONTEND_URL:**
```bash
nano .env
```

Thêm hoặc sửa dòng:
```env
FRONTEND_URL=https://vinmall.org
```
(Thay `https://vinmall.org` bằng domain thực tế của bạn)

3. **Restart backend để áp dụng thay đổi:**
```bash
pm2 restart ecommerce-backend
```

4. **Kiểm tra lại:**
- Đăng nhập vào frontend
- Vào trang Affiliate/Referral
- Kiểm tra các referral links đã hiển thị đúng domain chưa

**Lưu ý:**
- `FRONTEND_URL` phải là URL đầy đủ với protocol (http:// hoặc https://)
- Không có dấu `/` ở cuối URL
- Sau khi thay đổi, cần restart backend để áp dụng

### 7. Out of memory

```bash
# Kiểm tra memory usage
free -h
pm2 monit

# Tăng swap (nếu cần)
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

---

## 📝 Checklist Deploy

- [ ] Server đã được cập nhật
- [ ] Node.js đã được cài đặt
- [ ] MySQL đã được cài đặt và cấu hình
- [ ] Redis đã được cài đặt và chạy
- [ ] PM2 đã được cài đặt
- [ ] Nginx đã được cài đặt
- [ ] Repository đã được clone
- [ ] Dependencies đã được cài đặt
- [ ] File .env đã được cấu hình
- [ ] Database đã được khởi tạo
- [ ] Ứng dụng đã được build
- [ ] PM2 đã khởi động ứng dụng
- [ ] Nginx đã được cấu hình
- [ ] SSL đã được cài đặt
- [ ] Firewall đã được cấu hình
- [ ] Backup đã được thiết lập

---

## 🔐 Bảo Mật Bổ Sung

### 1. Cấu hình Firewall (UFW)

```bash
# Cho phép SSH
sudo ufw allow 22/tcp

# Cho phép HTTP và HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Kích hoạt firewall
sudo ufw enable

# Kiểm tra status
sudo ufw status
```

### 2. Fail2Ban (bảo vệ chống brute force)

```bash
sudo apt install -y fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

### 3. Cập nhật hệ thống định kỳ

```bash
# Tự động cập nhật security patches
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

---

## 📞 Hỗ Trợ

Nếu gặp vấn đề, kiểm tra:
1. Logs của PM2: `pm2 logs`
2. Logs của Nginx: `/var/log/nginx/error.log`
3. Logs của MySQL: `/var/log/mysql/error.log`
4. System logs: `journalctl -xe`

---

**Chúc bạn deploy thành công! 🎉**
function main(stream) {
  const data = stream.data;
  if (!data) return null;

  // Địa chỉ Smart Contract USDT mạng BSC
  const usdtAddress = "0x55d398326f99059fF775485246999027B3197955".toLowerCase();
  
  // Địa chỉ ví nhận tiền hệ thống của bạn (đã điền sẵn từ .env)
  const systemWallet = "0x65c03707C17EA9F7Dc1C1Eb2c0C12D3AfC3e7fe1".toLowerCase();
  
  // Hash signature của sự kiện Transfer
  const transferTopic = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
  
  const matchedLogs = [];
  let allReceipts = [];

  // Tự động nhận diện cấu trúc dữ liệu của QuickNode để bóc tách receipts
  if (Array.isArray(data)) {
    // Trường hợp data là mảng chứa các blocks
    data.forEach(blockItem => {
      const recs = blockItem.receipts || (blockItem.block && blockItem.block.receipts);
      if (Array.isArray(recs)) {
        allReceipts = allReceipts.concat(recs);
      }
    });
  } else if (data.receipts && Array.isArray(data.receipts)) {
    // Trường hợp data là đối tượng block chứa receipts trực tiếp
    allReceipts = data.receipts;
  } else if (data.block && data.block.receipts && Array.isArray(data.block.receipts)) {
    // Trường hợp data là đối tượng chứa block lồng nhau
    allReceipts = data.block.receipts;
  }

  // Tiến hành lọc các giao dịch khớp
  allReceipts.forEach(receipt => {
    // Trạng thái giao dịch thành công (status = 1 hoặc không có status)
    const isSuccess = receipt.status === undefined || receipt.status === 1 || receipt.status === "0x1" || receipt.status === true;
    if (!isSuccess) return;

    if (receipt.logs && Array.isArray(receipt.logs)) {
      receipt.logs.forEach(log => {
        if (
          log.address.toLowerCase() === usdtAddress &&
          log.topics[0] === transferTopic &&
          log.topics[2] && 
          // So khớp người nhận (topics[2]) trùng với ví nhận hệ thống
          "0x" + log.topics[2].slice(26).toLowerCase() === systemWallet
        ) {
          matchedLogs.push({
            txHash: receipt.transactionHash,
            blockNumber: receipt.blockNumber,
            from: "0x" + log.topics[1].slice(26),
            to: systemWallet,
            value: log.data
          });
        }
      });
    }
  });

  // Nếu tìm thấy giao dịch khớp thì gửi đi, ngược lại trả về null để bỏ qua
  return matchedLogs.length > 0 ? matchedLogs : null;
}