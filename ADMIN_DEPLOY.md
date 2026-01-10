# Hướng dẫn Deploy Admin Panel lên Shared Hosting

## Vấn đề
Sau khi deploy lên shared hosting, không thể truy cập trang admin tại `/admin`.

## Giải pháp

### Bước 1: Cấu hình Environment Variables cho Admin

1. Tạo file `.env.production` trong thư mục `admin/`:

```bash
cd admin
```

Tạo file `.env.production` với nội dung:

```env
REACT_APP_API_URL=https://your-backend-url.com
```

**Lưu ý**: Thay `https://your-backend-url.com` bằng URL backend thực tế của bạn (ví dụ: `https://api.yourdomain.com` hoặc `https://yourdomain.com:3000`)

### Bước 2: Build Admin

Chạy lệnh build admin:

```bash
# Từ thư mục root của project
cd admin
npm install  # Nếu chưa cài dependencies
npm run build:prod
```

Hoặc từ thư mục root:

```bash
npm run build:all
```

Sau khi build, thư mục `admin/build/` sẽ chứa các file static cần deploy.

### Bước 3: Upload Admin lên Hosting

1. **Tạo thư mục `admin/` trên hosting**:
   - Vào File Manager trong cPanel (hoặc dùng FTP)
   - Tạo thư mục `admin/` trong `public_html/` (hoặc `www/`)

2. **Upload files**:
   - Upload **TẤT CẢ** files và thư mục từ `admin/build/` lên `public_html/admin/`
   - Đảm bảo cấu trúc như sau:
     ```
     public_html/
     ├── index.html (Next.js)
     ├── _next/
     ├── admin/
     │   ├── index.html
     │   ├── static/
     │   │   ├── css/
     │   │   ├── js/
     │   │   └── media/
     │   ├── .htaccess  ← QUAN TRỌNG!
     │   └── ...
     └── .htaccess (root)
     ```

3. **Upload file `.htaccess` cho admin**:
   - File `.htaccess` đã được tạo sẵn trong `admin/.htaccess`
   - Upload file này lên `public_html/admin/.htaccess`

### Bước 4: Kiểm tra cấu hình .htaccess

#### File `.htaccess` ở root (`public_html/.htaccess`):

Đảm bảo file này đã được cập nhật để không chặn admin routes:

```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  
  # Exclude admin directory from Next.js routing
  RewriteCond %{REQUEST_URI} ^/admin
  RewriteRule ^admin/(.*)$ /admin/$1 [L]
  
  # Handle Next.js routes (only if not admin)
  RewriteCond %{REQUEST_URI} !^/admin
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule ^(.*)$ /index.html [L]
</IfModule>
```

#### File `.htaccess` trong admin (`public_html/admin/.htaccess`):

```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /admin/
  
  # Handle React Router
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule ^(.*)$ /admin/index.html [L]
</IfModule>
```

### Bước 5: Kiểm tra quyền truy cập file

Đảm bảo các file có quyền đọc đúng:
- Files: `644`
- Folders: `755`

### Bước 6: Truy cập Admin

Sau khi deploy xong, truy cập:
- **URL**: `https://yourdomain.com/admin`
- **Login page**: `https://yourdomain.com/admin/login`

## Troubleshooting

### Lỗi 404 khi truy cập `/admin`

1. **Kiểm tra file `.htaccess`**:
   - Đảm bảo file `.htaccess` đã được upload vào `public_html/admin/`
   - Kiểm tra quyền file (644)

2. **Kiểm tra cấu trúc thư mục**:
   - Đảm bảo `index.html` có trong `public_html/admin/`
   - Kiểm tra các file static trong `public_html/admin/static/`

3. **Kiểm tra .htaccess ở root**:
   - Đảm bảo rule exclude admin đã được thêm

### Admin load nhưng không kết nối được API

1. **Kiểm tra `REACT_APP_API_URL`**:
   - File `.env.production` phải có URL backend đúng
   - Rebuild admin sau khi thay đổi `.env.production`

2. **Kiểm tra CORS trên backend**:
   - Backend phải cho phép domain của bạn trong CORS settings

### Admin hiển thị trang trắng

1. **Mở Developer Console** (F12) để xem lỗi
2. **Kiểm tra Network tab** để xem file nào không load được
3. **Kiểm tra đường dẫn static files** trong `index.html`

## Cấu trúc thư mục sau khi deploy

```
public_html/
├── .htaccess                    # Root .htaccess (Next.js + exclude admin)
├── index.html                   # Next.js entry point
├── _next/                       # Next.js static files
├── home/                        # Next.js routes
├── register/
├── safepal/
├── images/
├── ... (các file Next.js khác)
│
└── admin/                       # Admin panel
    ├── .htaccess               # Admin .htaccess (React Router)
    ├── index.html              # Admin entry point
    ├── static/
    │   ├── css/
    │   ├── js/
    │   └── media/
    └── ... (các file admin khác)
```

## Lưu ý quan trọng

1. **Rebuild admin** mỗi khi thay đổi `.env.production`
2. **Upload lại file `.htaccess`** nếu bị ghi đè
3. **Kiểm tra URL backend** trong `.env.production` phải đúng
4. **Clear browser cache** sau khi deploy để tránh load file cũ
