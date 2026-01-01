# Deploy Backend lên Railway

## Bước 1: Chuẩn bị

1. Đăng ký tài khoản tại https://railway.app
2. Đăng nhập và tạo project mới

## Bước 2: Deploy từ GitHub

1. Click "New Project"
2. Chọn "Deploy from GitHub repo"
3. Chọn repository của bạn
4. Chọn thư mục `backend/` làm root directory

## Bước 3: Cấu hình Environment Variables

Trong Railway dashboard, thêm các biến môi trường:

```
PORT=3000
DATABASE_URL=postgresql://user:password@host:5432/dbname
JWT_SECRET=your-secret-key-here
NODE_ENV=production
```

## Bước 4: Cấu hình Database

1. Trong Railway project, click "New" → "Database" → "PostgreSQL"
2. Railway sẽ tự động tạo DATABASE_URL
3. Copy DATABASE_URL và thêm vào Environment Variables

## Bước 5: Cấu hình Build Settings

Railway sẽ tự động detect NestJS, nhưng bạn có thể cấu hình:

- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm run start:prod`

## Bước 6: Cấu hình Domain

1. Trong project settings, click "Generate Domain"
2. Railway sẽ tạo domain như: `your-app.railway.app`
3. Copy domain này để cấu hình CORS trong backend

## Bước 7: Cập nhật CORS trong Backend

Cập nhật file `backend/src/main.ts`:

```typescript
app.enableCors({
  origin: [
    'https://your-frontend-domain.com',
    'https://your-frontend-domain.com/admin',
    'https://your-app.railway.app', // Railway domain
  ],
  credentials: true,
});
```

## Bước 8: Deploy

Railway sẽ tự động deploy khi bạn push code lên GitHub.

## Kiểm tra

Sau khi deploy thành công, kiểm tra API:
- `https://your-app.railway.app/api` (hoặc endpoint bạn đã cấu hình)
