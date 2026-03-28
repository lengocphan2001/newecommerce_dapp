-- MySQL: thêm trạng thái cancelled cho commissions.status
-- Chạy tay trên DB production nếu không dùng TypeORM synchronize.
-- Kiểm tra cột: SHOW COLUMNS FROM commissions LIKE 'status';

ALTER TABLE commissions
  MODIFY COLUMN status ENUM('pending', 'paid', 'blocked', 'cancelled')
  NOT NULL DEFAULT 'pending';

-- PostgreSQL (nếu dùng enum type riêng — điều chỉnh tên type theo DB thực tế):
-- ALTER TYPE commissions_status_enum ADD VALUE IF NOT EXISTS 'cancelled';
