# 🚀 Railway Quick Start Guide

## Bước 1: Tạo Railway Project

1. Đăng nhập https://railway.app
2. Click **"New Project"**
3. Chọn **"Deploy from GitHub repo"**
4. Chọn repository của bạn

## Bước 2: Setup Database

1. Trong project, click **"+ New"** → **"Database"** → **"PostgreSQL"** (hoặc MySQL)
2. Railway sẽ tự động tạo database

## Bước 3: Configure Backend Service

### 3.1. Set Root Directory (nếu deploy từ root repo)

1. Vào Backend service → **"Settings"**
2. Set **"Root Directory"** = `backend`
3. Hoặc để trống nếu deploy từ `backend/` folder

### 3.2. Set Environment Variables

Vào **"Variables"** tab và thêm:

#### Database (dùng Railway variable references)

```env
DB_TYPE=postgres
DB_HOST=${{Postgres.PGHOST}}
DB_PORT=${{Postgres.PGPORT}}
DB_USERNAME=${{Postgres.PGUSER}}
DB_PASSWORD=${{Postgres.PGPASSWORD}}
DB_NAME=${{Postgres.PGDATABASE}}
```

#### Required Variables

```env
NODE_ENV=production
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
COMMISSION_PAYOUT_CONTRACT_ADDRESS=0xCC5457C8717cd7fc722A012694F7aE388357811f
BSC_NETWORK=mainnet
BSC_MAINNET_RPC=https://bsc-dataseed.binance.org/
BLOCKCHAIN_PRIVATE_KEY=your_private_key
# AUTO_PAYOUT_ENABLED is no longer needed - payout happens immediately on order approval
```

## Bước 4: Deploy

Railway sẽ tự động:
1. ✅ Clone code
2. ✅ Run `npm install`
3. ✅ Run `npm run build`
4. ✅ Run `npm run start:prod`

## Bước 5: Get Public URL

1. Vào **"Settings"** → **"Networking"**
2. Click **"Generate Domain"**
3. Copy URL (ví dụ: `https://your-app.railway.app`)

## ✅ Done!

Backend đã deploy thành công! 🎉

---

**📚 Xem chi tiết**: `RAILWAY_DEPLOY.md`
