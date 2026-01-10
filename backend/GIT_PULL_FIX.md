# Hướng dẫn Fix lỗi Git Pull

## Lỗi
```
error: The following untracked working tree files would be overwritten by merge:
        scripts/init-database.ts
Please move or remove them before you merge.
```

## Giải pháp

### Cách 1: Xóa file trên server và pull (Nhanh nhất)

```bash
# Trên VPS
cd /var/www/backend

# Xóa file (nó sẽ được pull từ git)
rm scripts/init-database.ts

# Pull lại
git pull
```

### Cách 2: Backup file trước, sau đó pull

```bash
# Trên VPS
cd /var/www/backend

# Backup file
cp scripts/init-database.ts scripts/init-database.ts.backup

# Xóa file
rm scripts/init-database.ts

# Pull
git pull

# So sánh nếu cần (thường giống nhau)
diff scripts/init-database.ts scripts/init-database.ts.backup
```

### Cách 3: Stash file và pull

```bash
# Trên VPS
cd /var/www/backend

# Add file vào staging (nếu chưa)
git add scripts/init-database.ts

# Stash
git stash

# Pull
git pull

# Apply stash nếu cần
git stash pop
```

## Sau khi pull thành công

1. **Kiểm tra file đã được pull**:
```bash
ls -la scripts/init-database.ts
```

2. **Chạy script để tạo database tables**:
```bash
npm run db:init
```

## Lưu ý

- File `scripts/init-database.ts` đã có trong git repository
- Nếu file trên server khác với file trong git, nên backup trước
- Sau khi pull, file sẽ được cập nhật từ git
