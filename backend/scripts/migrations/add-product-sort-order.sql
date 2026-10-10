-- Add sortOrder column to products table
ALTER TABLE `products` ADD COLUMN `sortOrder` INT DEFAULT 0;
