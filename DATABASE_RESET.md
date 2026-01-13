# Hướng dẫn Xóa và Tạo lại Database trên VPS

## Phương pháp 1: Sử dụng MySQL/PostgreSQL Command Line (SSH)

### Bước 1: Kết nối SSH vào VPS

```bash
ssh user@your-vps-ip
# hoặc
ssh user@your-domain.com
```

### Bước 2: Kết nối vào Database

#### Nếu dùng MySQL:

```bash
mysql -u root -p
# Nhập password khi được hỏi
```

#### Nếu dùng PostgreSQL:

```bash
sudo -u postgres psql
# hoặc
psql -U postgres -h localhost
```

### Bước 3: Xóa Database cũ

#### MySQL:

```sql
-- Xem danh sách databases
SHOW DATABASES;

-- Xóa database (THẬN TRỌNG: Xóa tất cả dữ liệu!)
DROP DATABASE IF EXISTS ecommerce_dapp;

-- Xóa user cũ (nếu có)
DROP USER IF EXISTS 'ecommerce_user'@'localhost';

-- Tạo database mới
CREATE DATABASE ecommerce_dapp CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Tạo user mới (hoặc dùng user hiện có)
CREATE USER 'ecommerce_user'@'localhost' IDENTIFIED BY 'pass';
-- Hoặc nếu user đã tồn tại, chỉ cần grant quyền

-- Grant tất cả quyền cho user trên database
GRANT ALL PRIVILEGES ON ecommerce_dapp.* TO 'ecommerce_user'@'localhost';

-- Áp dụng thay đổi
FLUSH PRIVILEGES;

-- Kiểm tra database đã được tạo
SHOW DATABASES;

-- Kiểm tra user và quyền
SELECT User, Host FROM mysql.user WHERE User = 'ecommerce_user';
SHOW GRANTS FOR 'ecommerce_user'@'localhost';

-- Thoát
EXIT;
```

#### PostgreSQL:

```sql
-- Xem danh sách databases
\l

-- Kết nối vào database khác (không thể xóa database đang kết nối)
\c postgres

-- Xóa database (THẬN TRỌNG: Xóa tất cả dữ liệu!)
DROP DATABASE IF EXISTS ecommerce_dapp;

-- Xóa user cũ (nếu có, cần revoke quyền trước)
-- REVOKE ALL PRIVILEGES ON DATABASE ecommerce_dapp FROM ecommerce_user;
-- DROP USER IF EXISTS ecommerce_user;

-- Tạo user mới (hoặc dùng user hiện có)
CREATE USER ecommerce_user WITH PASSWORD 'your_secure_password';
-- Hoặc nếu user đã tồn tại, chỉ cần grant quyền

-- Tạo database mới
CREATE DATABASE ecommerce_dapp;

-- Grant tất cả quyền cho user trên database
GRANT ALL PRIVILEGES ON DATABASE ecommerce_dapp TO ecommerce_user;

-- Kết nối vào database mới và grant quyền trên schema
\c ecommerce_dapp
GRANT ALL ON SCHEMA public TO ecommerce_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ecommerce_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ecommerce_user;

-- Quay lại postgres để kiểm tra
\c postgres

-- Kiểm tra database đã được tạo
\l

-- Kiểm tra user
\du

-- Thoát
\q
```

### Bước 4: Cập nhật Environment Variables

Đảm bảo file `.env` trong backend có cấu hình đúng:

```env
DB_TYPE=mysql  # hoặc postgres
DB_HOST=localhost
DB_PORT=3306  # MySQL: 3306, PostgreSQL: 5432
DB_USERNAME=root  # hoặc username của bạn
DB_PASSWORD=your_password
DB_NAME=ecommerce_dapp
```

### Bước 5: Chạy Backend để tự động tạo lại Schema

TypeORM sẽ tự động tạo lại schema nếu `synchronize: true` hoặc `FORCE_SYNC=true`:

```bash
cd /path/to/backend

# Đảm bảo .env có FORCE_SYNC=true hoặc NODE_ENV=development
# (synchronize sẽ tự động true trong development mode)

# Chạy backend
npm run start:dev
# hoặc
npm run start:prod
```

Backend sẽ tự động tạo lại tất cả tables dựa trên entities.

---

## Phương pháp 2: Sử dụng cPanel (Nếu có)

### Bước 1: Đăng nhập cPanel

1. Truy cập `https://your-domain.com/cpanel`
2. Đăng nhập với thông tin của bạn

### Bước 2: Xóa Database

1. Vào **MySQL Databases** (hoặc **PostgreSQL Databases**)
2. Tìm database `ecommerce_dapp` trong danh sách
3. Click **Delete** hoặc **Drop Database**
4. Xác nhận xóa

### Bước 3: Tạo Database mới

1. Trong **MySQL Databases**:
   - Nhập tên database: `ecommerce_dapp`
   - Click **Create Database**

2. Tạo user và gán quyền:
   - Tạo user mới:
     - Username: `ecommerce_user` (hoặc tên bạn muốn)
     - Password: Nhập password mạnh
     - Click **Create User**
   - Gán quyền:
     - Chọn user `ecommerce_user`
     - Chọn database `ecommerce_dapp`
     - Chọn quyền **ALL PRIVILEGES**
     - Click **Add** hoặc **Make Changes**

### Bước 4: Cập nhật .env và chạy Backend

Giống như Bước 4-5 ở Phương pháp 1.

---

## Phương pháp 3: Sử dụng Script tự động (Khuyến nghị)

Tạo file script để tự động hóa quá trình:

### Tạo file `reset-database.sh`:

```bash
#!/bin/bash

# Cấu hình database
DB_TYPE="${DB_TYPE:-mysql}"  # hoặc postgres
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-3306}"
DB_USERNAME="${DB_USERNAME:-root}"
DB_PASSWORD="${DB_PASSWORD:-password}"
DB_NAME="${DB_NAME:-ecommerce_dapp}"

echo "⚠️  WARNING: This will DELETE all data in database: $DB_NAME"
read -p "Are you sure? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Cancelled."
    exit 1
fi

if [ "$DB_TYPE" = "mysql" ]; then
    echo "Dropping MySQL database..."
    mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USERNAME" -p"$DB_PASSWORD" -e "DROP DATABASE IF EXISTS $DB_NAME;"
    
    echo "Creating MySQL database..."
    mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USERNAME" -p"$DB_PASSWORD" -e "CREATE DATABASE $DB_NAME CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
    
    echo "✅ Database $DB_NAME has been reset!"
    
elif [ "$DB_TYPE" = "postgres" ]; then
    echo "Dropping PostgreSQL database..."
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USERNAME" -d postgres -c "DROP DATABASE IF EXISTS $DB_NAME;"
    
    echo "Creating PostgreSQL database..."
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USERNAME" -d postgres -c "CREATE DATABASE $DB_NAME;"
    
    echo "✅ Database $DB_NAME has been reset!"
else
    echo "❌ Unsupported database type: $DB_TYPE"
    exit 1
fi

echo ""
echo "Next steps:"
echo "1. Update .env file with correct database credentials"
echo "2. Set FORCE_SYNC=true or NODE_ENV=development in .env"
echo "3. Run: npm run start:dev (backend will auto-create schema)"
```

### Sử dụng script:

```bash
# Cấp quyền thực thi
chmod +x reset-database.sh

# Chạy script (sẽ hỏi xác nhận)
./reset-database.sh

# Hoặc set environment variables trước
export DB_TYPE=mysql
export DB_HOST=localhost
export DB_USERNAME=root
export DB_PASSWORD=your_password
export DB_NAME=ecommerce_dapp
./reset-database.sh
```

---

## Phương pháp 4: Sử dụng TypeORM CLI (Nếu có migrations)

Nếu project có migrations, có thể dùng TypeORM CLI:

### Cài đặt TypeORM CLI:

```bash
cd backend
npm install -g typeorm
```

### Reset database với migrations:

```bash
# Drop tất cả tables
npm run typeorm schema:drop

# Chạy migrations để tạo lại
npm run typeorm migration:run
```

---

## Lưu ý quan trọng

### ⚠️ BACKUP TRƯỚC KHI XÓA!

1. **Backup database trước khi xóa:**

#### MySQL:
```bash
mysqldump -u root -p ecommerce_dapp > backup_$(date +%Y%m%d_%H%M%S).sql
```

#### PostgreSQL:
```bash
pg_dump -U postgres ecommerce_dapp > backup_$(date +%Y%m%d_%H%M%S).sql
```

2. **Kiểm tra Environment Variables:**
   - Đảm bảo `.env` có cấu hình đúng
   - Đặc biệt: `FORCE_SYNC=true` hoặc `NODE_ENV=development` để tự động tạo schema

3. **Sau khi reset:**
   - Backend sẽ tự động tạo lại tất cả tables
   - Cần tạo lại admin user và dữ liệu ban đầu (nếu có seed data)

---

## Khôi phục từ Backup

### MySQL:
```bash
mysql -u root -p ecommerce_dapp < backup_20260113_120000.sql
```

### PostgreSQL:
```bash
psql -U postgres ecommerce_dapp < backup_20260113_120000.sql
```

---

## Troubleshooting

### Lỗi: "Access denied"
- Kiểm tra username và password trong `.env`
- Đảm bảo user có quyền CREATE và DROP database

### Lỗi: "Database does not exist"
- Database đã bị xóa, chỉ cần tạo lại

### Lỗi: "Cannot drop database because it is currently in use"
- Đóng tất cả connections đến database
- Hoặc dùng `DROP DATABASE ... WITH (FORCE);` (PostgreSQL)

### Schema không được tạo tự động
- Kiểm tra `synchronize: true` trong TypeORM config
- Hoặc set `FORCE_SYNC=true` trong `.env`
- Kiểm tra entities đã được import đúng trong `app.module.ts`
