# Hướng dẫn Deploy Endpoint Upload Avatar

## Vấn đề
Lỗi `404 (Not Found)` khi gọi `POST https://mon88.click/uploads/avatar`

## Nguyên nhân
Backend chưa được rebuild và deploy với code mới có endpoint `/uploads/avatar`.

## Giải pháp

### Bước 1: Rebuild Backend

SSH vào server hoặc vào thư mục backend trên VPS:

```bash
cd /var/www/backend  # hoặc đường dẫn backend của bạn
```

Pull code mới nhất:
```bash
git pull origin master
```

Cài đặt dependencies (nếu có thay đổi):
```bash
npm install
```

Build lại backend:
```bash
npm run build
```

### Bước 2: Restart Backend

**Nếu dùng PM2:**
```bash
pm2 restart backend
# hoặc
pm2 restart all
```

**Nếu dùng cPanel Node.js Selector:**
1. Vào cPanel → Node.js Selector
2. Tìm app backend của bạn
3. Click "Restart App"

**Nếu dùng systemd service:**
```bash
sudo systemctl restart backend
```

### Bước 3: Kiểm tra Endpoint

Test endpoint bằng curl:
```bash
curl -X POST https://mon88.click/uploads/avatar \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@test-image.jpg"
```

Hoặc kiểm tra trong browser console:
```javascript
fetch('https://mon88.click/uploads/avatar', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN'
  },
  body: formData
})
```

### Bước 4: Kiểm tra Logs

**Nếu dùng PM2:**
```bash
pm2 logs backend
```

**Nếu dùng cPanel:**
- Vào Node.js Selector → Logs

**Nếu dùng systemd:**
```bash
sudo journalctl -u backend -f
```

### Bước 5: Xác nhận Route đã được đăng ký

Kiểm tra trong code backend:
- File `backend/src/upload/upload.controller.ts` có `@Post('avatar')`
- File `backend/src/app.module.ts` có import `UploadModule`

## Kiểm tra nhanh

1. **Kiểm tra backend đang chạy:**
   ```bash
   pm2 status
   # hoặc
   ps aux | grep node
   ```

2. **Kiểm tra port backend:**
   ```bash
   netstat -tulpn | grep :3002
   # hoặc
   lsof -i :3002
   ```

3. **Test health endpoint:**
   ```bash
   curl https://mon88.click/
   ```

## Lưu ý

- Đảm bảo `UploadModule` đã được import trong `AppModule`
- Đảm bảo file `backend/dist/upload/upload.controller.js` tồn tại sau khi build
- Kiểm tra CORS settings nếu vẫn gặp lỗi
- Kiểm tra firewall/security groups nếu backend chạy trên port riêng

## Troubleshooting

### Nếu vẫn 404 sau khi rebuild:

1. **Kiểm tra file build:**
   ```bash
   ls -la backend/dist/upload/
   # Phải có upload.controller.js
   ```

2. **Kiểm tra route trong NestJS:**
   - Route đầy đủ là: `POST /uploads/avatar`
   - Controller: `@Controller('uploads')`
   - Method: `@Post('avatar')`

3. **Kiểm tra middleware/guards:**
   - Endpoint cần JWT token: `@UseGuards(JwtAuthGuard)`
   - Đảm bảo token được gửi trong header

4. **Kiểm tra reverse proxy (Nginx/Apache):**
   - Nếu dùng reverse proxy, đảm bảo route `/uploads` được proxy đúng
   - Kiểm tra file cấu hình nginx/apache
