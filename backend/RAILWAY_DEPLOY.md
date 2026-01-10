# 🚂 Deploy Backend lên Railway

## 📋 Yêu cầu

1. Tài khoản Railway: https://railway.app
2. GitHub repository (hoặc GitLab/Bitbucket)
3. Database (MySQL/PostgreSQL) - có thể dùng Railway MySQL/PostgreSQL service

## 🚀 Bước 1: Chuẩn bị Repository

### 1.1. Đảm bảo code đã commit và push lên Git

```bash
git add .
git commit -m "Prepare for Railway deployment"
git push origin main
```

## 🚀 Bước 2: Tạo Project trên Railway

### 2.1. Đăng nhập Railway

1. Truy cập https://railway.app
2. Đăng nhập bằng GitHub/GitLab/Bitbucket
3. Click **"New Project"**

### 2.2. Deploy từ GitHub

1. Chọn **"Deploy from GitHub repo"**
2. Chọn repository của bạn
3. Railway sẽ tự động detect và setup

### 2.3. Chọn Service

Railway sẽ tự động detect:
- **Root Directory**: `backend` (nếu deploy từ root) hoặc để trống nếu deploy từ `backend/`
- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm run start:prod`

## 🚀 Bước 3: Setup Database

### 3.1. Tạo MySQL/PostgreSQL Service

1. Trong Railway project, click **"+ New"**
2. Chọn **"Database"** → **"MySQL"** hoặc **"PostgreSQL"**
3. Railway sẽ tự động tạo database và cung cấp connection string

### 3.2. Lấy Database Connection String

1. Click vào Database service
2. Vào tab **"Variables"**
3. Copy các biến:
   - `MYSQLDATABASE` hoặc `PGDATABASE`
   - `MYSQLUSER` hoặc `PGUSER`
   - `MYSQLPASSWORD` hoặc `PGPASSWORD`
   - `MYSQLHOST` hoặc `PGHOST`
   - `MYSQLPORT` hoặc `PGPORT`

## 🚀 Bước 4: Cấu hình Environment Variables

### 4.1. Vào Service Settings

1. Click vào Backend service
2. Vào tab **"Variables"**
3. Thêm các biến môi trường sau:

### 4.2. Database Variables

```env
# Database (chọn một trong hai)
# MySQL
DB_TYPE=mysql
DB_HOST=${{MySQL.MYSQLHOST}}
DB_PORT=${{MySQL.MYSQLPORT}}
DB_USERNAME=${{MySQL.MYSQLUSER}}
DB_PASSWORD=${{MySQL.MYSQLPASSWORD}}
DB_DATABASE=${{MySQL.MYSQLDATABASE}}

# Hoặc PostgreSQL
DB_TYPE=postgres
DB_HOST=${{Postgres.PGHOST}}
DB_PORT=${{Postgres.PGPORT}}
DB_USERNAME=${{Postgres.PGUSER}}
DB_PASSWORD=${{Postgres.PGPASSWORD}}
DB_DATABASE=${{Postgres.PGDATABASE}}
```

### 4.3. JWT & Security

```env
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=7d
```

### 4.4. Blockchain Configuration

```env
# Commission Payout Contract
COMMISSION_PAYOUT_CONTRACT_ADDRESS=0xCC5457C8717cd7fc722A012694F7aE388357811f

# Blockchain Network
BSC_NETWORK=mainnet
BSC_MAINNET_RPC=https://bsc-dataseed.binance.org/

# Private Key (QUAN TRỌNG - Bảo mật kỹ!)
BLOCKCHAIN_PRIVATE_KEY=your_private_key_without_0x_prefix

# Hoặc nếu có 0x prefix
# BLOCKCHAIN_PRIVATE_KEY=0xyour_private_key
```

### 4.5. Commission Payout

**📌 Lưu ý về Payout:**
- **Immediate Payout**: Commission được trả ngay lập tức khi admin duyệt order (PENDING → CONFIRMED)
- **Scheduled Payout**: Đã được disable vì không cần thiết nữa
- Admin có thể trigger manual payout từ admin panel nếu cần

### 4.6. Server Configuration

```env
PORT=3002
NODE_ENV=production
```

### 4.7. CORS & Frontend URL

```env
# Frontend URL (để CORS hoạt động)
FRONTEND_URL=https://your-frontend-domain.com
```

### 4.8. File Upload (Optional - nếu dùng S3)

```env
# AWS S3 (nếu dùng S3 cho file upload)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_S3_BUCKET=your-bucket-name
```

## 🚀 Bước 5: Deploy

### 5.1. Railway sẽ tự động deploy

1. Railway sẽ tự động:
   - Clone code từ GitHub
   - Chạy `npm install`
   - Chạy `npm run build`
   - Chạy `npm run start:prod`

### 5.2. Kiểm tra Logs

1. Vào tab **"Deployments"**
2. Click vào deployment mới nhất
3. Xem logs để đảm bảo không có lỗi

### 5.3. Kiểm tra Health

1. Vào tab **"Settings"** → **"Networking"**
2. Railway sẽ cung cấp public URL (ví dụ: `https://your-app.railway.app`)
3. Test API: `https://your-app.railway.app/api` (hoặc endpoint bạn đã setup)

## 🔧 Bước 6: Setup Custom Domain (Optional)

### 6.1. Thêm Custom Domain

1. Vào **"Settings"** → **"Networking"**
2. Click **"Generate Domain"** hoặc **"Custom Domain"**
3. Thêm domain của bạn và setup DNS records

## 📝 Bước 7: Run Database Migrations

### 7.1. TypeORM sẽ tự động sync schema

TypeORM sẽ tự động tạo tables khi app start (nếu `synchronize: true` trong config).

**⚠️ Lưu ý**: Trong production, nên dùng migrations thay vì `synchronize: true`.

### 7.2. Manual Migration (nếu cần)

Nếu cần chạy migrations thủ công:

```bash
# SSH vào Railway service (nếu có)
npm run migration:run
```

## ✅ Checklist

- [ ] Code đã push lên GitHub
- [ ] Railway project đã tạo
- [ ] Database service đã tạo
- [ ] Tất cả environment variables đã set
- [ ] Build thành công
- [ ] App đã start và chạy
- [ ] API endpoint hoạt động
- [ ] Database connection thành công
- [ ] Blockchain connection thành công (nếu cần)

## 🐛 Troubleshooting

### Lỗi: Build failed

**Nguyên nhân**: Thiếu dependencies hoặc lỗi TypeScript

**Giải pháp**:
1. Kiểm tra logs trong Railway
2. Đảm bảo `npm run build` chạy thành công local
3. Kiểm tra `package.json` và `tsconfig.json`

### Lỗi: Database connection failed

**Nguyên nhân**: Sai connection string hoặc database chưa ready

**Giải pháp**:
1. Kiểm tra database variables
2. Đảm bảo database service đã deploy xong
3. Kiểm tra network connectivity

### Lỗi: Port already in use

**Nguyên nhân**: PORT variable không được set

**Giải pháp**:
1. Railway tự động set PORT, không cần set manual
2. Đảm bảo `main.ts` dùng `process.env.PORT`

### Lỗi: JWT_SECRET not set

**Nguyên nhân**: Thiếu JWT_SECRET

**Giải pháp**:
1. Thêm `JWT_SECRET` vào environment variables
2. Dùng strong random string

### Lỗi: Blockchain connection failed

**Nguyên nhân**: Sai RPC URL hoặc private key

**Giải pháp**:
1. Kiểm tra `BSC_MAINNET_RPC`
2. Kiểm tra `BLOCKCHAIN_PRIVATE_KEY` format
3. Đảm bảo private key không có `0x` prefix (hoặc có, tùy config)

## 📚 Tài liệu tham khảo

- Railway Docs: https://docs.railway.app
- NestJS Deployment: https://docs.nestjs.com/deployment
- TypeORM Configuration: https://typeorm.io/data-source-options

## 🎉 Hoàn thành!

Sau khi deploy thành công, bạn sẽ có:
- ✅ Backend API chạy trên Railway
- ✅ Database được quản lý bởi Railway
- ✅ Auto-deploy khi push code mới
- ✅ Logs và monitoring
- ✅ Custom domain (nếu setup)

---

**💡 Tip**: Railway có free tier với $5 credit mỗi tháng, đủ cho development và testing!
