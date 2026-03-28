-- MySQL: thêm trạng thái cancelled cho bảng commissions (chạy tay trên VPS nếu TypeORM không sync enum).
-- Kiểm tra giá trị enum hiện tại: SHOW COLUMNS FROM commissions LIKE 'status';

ALTER TABLE commissions
  MODIFY COLUMN status ENUM('pending', 'paid', 'blocked', 'cancelled')
  NOT NULL DEFAULT 'pending';
