# Cấu hình Nginx cho Upload Avatar

## Vấn đề
Lỗi "request entity too large" hoặc "413 Request Entity Too Large" khi upload avatar.

## Nguyên nhân
Nginx có giới hạn `client_max_body_size` mặc định là 1MB. Khi upload file lớn hơn, nginx sẽ từ chối request trước khi đến backend.

## Giải pháp

### Cách 1: Cấu hình Nginx (Khuyến nghị)

Thêm vào file cấu hình nginx (thường ở `/etc/nginx/sites-available/your-site` hoặc trong cPanel):

```nginx
server {
    # ... các cấu hình khác ...
    
    # Tăng limit cho upload file
    client_max_body_size 50M;
    
    # Tăng timeout cho upload lớn
    client_body_timeout 300s;
    
    # Proxy settings cho backend
    location /api/ {
        proxy_pass http://localhost:3002/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        
        # Tăng buffer size
        proxy_buffer_size 128k;
        proxy_buffers 4 256k;
        proxy_busy_buffers_size 256k;
    }
    
    # Đặc biệt cho endpoint upload
    location /api/uploads/ {
        proxy_pass http://localhost:3002/uploads/;
        client_max_body_size 50M;
        client_body_timeout 300s;
        
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Sau đó reload nginx:
```bash
sudo nginx -t  # Kiểm tra cấu hình
sudo systemctl reload nginx  # Hoặc service nginx reload
```

### Cách 2: Cấu hình trong cPanel (Nếu dùng cPanel)

1. Vào **cPanel** → **Software** → **Select PHP Version** → **Options**
2. Tìm **upload_max_filesize** và set thành `50M`
3. Tìm **post_max_size** và set thành `50M`
4. Tìm **max_execution_time** và set thành `300`

Hoặc tạo file `.user.ini` trong thư mục backend:
```ini
upload_max_filesize = 50M
post_max_size = 50M
max_execution_time = 300
```

### Cách 3: Kiểm tra Apache (Nếu dùng Apache thay vì Nginx)

Thêm vào `.htaccess` hoặc `httpd.conf`:
```apache
php_value upload_max_filesize 50M
php_value post_max_size 50M
php_value max_execution_time 300
```

## Kiểm tra

Sau khi cấu hình, test upload:
```bash
curl -X POST http://your-domain.com/api/uploads/avatar \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@test-image.jpg"
```

## Lưu ý

- **Backend** đã được cấu hình để nhận file lên đến 10MB (multer limit)
- **Express body parser** đã được set 50MB
- Chỉ cần cấu hình **Nginx/Apache** để cho phép request lớn hơn
