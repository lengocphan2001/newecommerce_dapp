# Cấu hình CORS cho Backend

## Vấn đề
Lỗi CORS khi frontend từ `https://vinmall.org` gọi API đến `https://mon88.click`.

## Giải pháp

### Bước 1: Cấu hình Environment Variable

Thêm vào file `.env` của backend:

```env
CORS_ORIGINS=https://vinmall.org,https://www.vinmall.org,https://mon88.click
NODE_ENV=production
```

Hoặc nếu muốn cho phép tất cả trong development:
```env
CORS_ORIGINS=https://vinmall.org,https://www.vinmall.org
NODE_ENV=production
```

### Bước 2: Rebuild và Restart Backend

```bash
cd /var/www/backend
npm run build
pm2 restart backend
```

### Bước 3: Kiểm tra CORS Headers

Test bằng curl:
```bash
curl -X OPTIONS https://mon88.click/uploads/avatar \
  -H "Origin: https://vinmall.org" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: authorization" \
  -v
```

Phải thấy headers:
```
Access-Control-Allow-Origin: https://vinmall.org
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, PATCH, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With
Access-Control-Allow-Credentials: true
```

### Bước 4: Cấu hình Nginx (Nếu dùng Reverse Proxy)

Nếu backend chạy sau Nginx, thêm vào cấu hình Nginx:

```nginx
server {
    # ... các cấu hình khác ...
    
    location / {
        proxy_pass http://localhost:3002;
        
        # CORS headers (nếu backend không set)
        add_header 'Access-Control-Allow-Origin' 'https://vinmall.org' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, PATCH, OPTIONS' always;
        add_header 'Access-Control-Allow-Headers' 'Content-Type, Authorization, X-Requested-With' always;
        add_header 'Access-Control-Allow-Credentials' 'true' always;
        
        # Handle preflight requests
        if ($request_method = 'OPTIONS') {
            add_header 'Access-Control-Allow-Origin' 'https://vinmall.org' always;
            add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, PATCH, OPTIONS' always;
            add_header 'Access-Control-Allow-Headers' 'Content-Type, Authorization, X-Requested-With' always;
            add_header 'Access-Control-Allow-Credentials' 'true' always;
            add_header 'Access-Control-Max-Age' 86400;
            add_header 'Content-Type' 'text/plain; charset=utf-8';
            add_header 'Content-Length' 0;
            return 204;
        }
        
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

**Lưu ý**: Nếu backend đã set CORS headers, không cần thêm trong Nginx (tránh duplicate headers).

### Bước 5: Kiểm tra trong Browser

Mở Developer Tools → Network tab:
1. Tìm request đến `/uploads/avatar`
2. Kiểm tra Response Headers có:
   - `Access-Control-Allow-Origin: https://vinmall.org`
   - `Access-Control-Allow-Credentials: true`

## Troubleshooting

### Nếu vẫn gặp lỗi CORS:

1. **Kiểm tra backend logs:**
   ```bash
   pm2 logs backend
   ```
   Tìm lỗi liên quan đến CORS.

2. **Kiểm tra environment variable:**
   ```bash
   # Trong backend
   echo $CORS_ORIGINS
   ```

3. **Test trực tiếp backend (bỏ qua Nginx):**
   ```bash
   curl -X OPTIONS http://localhost:3002/uploads/avatar \
     -H "Origin: https://vinmall.org" \
     -H "Access-Control-Request-Method: POST" \
     -v
   ```

4. **Kiểm tra Nginx có chặn CORS headers không:**
   - Tạm thời comment out các `add_header` trong Nginx
   - Để backend tự xử lý CORS

5. **Kiểm tra firewall/security groups:**
   - Đảm bảo port backend (3002) được mở

## Cấu hình Production

### Recommended `.env`:

```env
NODE_ENV=production
PORT=3002
CORS_ORIGINS=https://vinmall.org,https://www.vinmall.org,https://mon88.click
```

### Multiple Origins:

```env
CORS_ORIGINS=https://vinmall.org,https://www.vinmall.org,https://mon88.click,https://www.mon88.click
```

## Lưu ý

- **Security**: Chỉ cho phép các origins cần thiết, không dùng `*` trong production
- **Credentials**: Khi dùng `credentials: true`, không thể dùng `origin: '*'`
- **Preflight**: Browser tự động gửi OPTIONS request trước POST/PUT/DELETE, backend phải xử lý đúng
