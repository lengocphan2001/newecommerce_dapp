#!/bin/bash

# Script để build và chuẩn bị files cho shared hosting deployment

echo "🚀 Bắt đầu build cho shared hosting..."

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. Build Frontend (Next.js)
echo -e "${YELLOW}📦 Building Frontend (Next.js)...${NC}"
cd "$(dirname "$0")"

# Uncomment static export trong next.config.ts
sed -i.bak 's|// output: '\''export'\'',|output: '\''export'\'',|g' next.config.ts
sed -i.bak 's|// trailingSlash: true,|trailingSlash: true,|g' next.config.ts
sed -i.bak 's|// images: {|images: {|g' next.config.ts
sed -i.bak 's|//   unoptimized: true,|  unoptimized: true,|g' next.config.ts
sed -i.bak 's|// },|},|g' next.config.ts

npm run build

# Copy .htaccess cho frontend
if [ -f ".htaccess.example" ]; then
  cp .htaccess.example out/.htaccess
  echo -e "${GREEN}✅ Copied .htaccess for frontend${NC}"
fi

echo -e "${GREEN}✅ Frontend built successfully! Output: out/${NC}"

# 2. Build Admin (React)
echo -e "${YELLOW}📦 Building Admin (React)...${NC}"
cd admin

npm run build

# Copy .htaccess cho admin
if [ -f ".htaccess.example" ]; then
  cp .htaccess.example build/admin/.htaccess
  echo -e "${GREEN}✅ Copied .htaccess for admin${NC}"
fi

# Move admin build vào out folder
cd ..
if [ -d "admin/build" ]; then
  mkdir -p out/admin
  cp -r admin/build/* out/admin/
  echo -e "${GREEN}✅ Admin built and copied to out/admin/${NC}"
fi

# 3. Tạo thư mục deploy
echo -e "${YELLOW}📁 Creating deployment folder...${NC}"
DEPLOY_DIR="deploy-ready"
rm -rf "$DEPLOY_DIR"
mkdir -p "$DEPLOY_DIR"

# Copy frontend files
cp -r out/* "$DEPLOY_DIR/"

# Copy backend files (để upload riêng hoặc deploy lên Railway/Render)
mkdir -p "$DEPLOY_DIR/backend-files"
cp -r backend/* "$DEPLOY_DIR/backend-files/" 2>/dev/null || true

# Tạo file hướng dẫn
cat > "$DEPLOY_DIR/README-DEPLOY.txt" << EOF
HƯỚNG DẪN DEPLOY LÊN SHARED HOSTING
====================================

1. FRONTEND & ADMIN:
   - Upload tất cả files trong thư mục này lên public_html/ của hosting
   - Đảm bảo file .htaccess đã được upload

2. BACKEND:
   - Deploy thư mục backend-files/ lên Railway hoặc Render
   - Hoặc nếu hosting hỗ trợ Node.js, upload lên hosting và chạy:
     cd backend-files
     npm install --production
     npm run build
     npm run start:prod

3. CẤU HÌNH:
   - Cập nhật NEXT_PUBLIC_API_URL trong frontend
   - Cập nhật REACT_APP_API_URL trong admin
   - Cập nhật DATABASE_URL và các env vars khác trong backend

Xem file DEPLOY_SHARED_HOSTING.md để biết chi tiết.
EOF

echo -e "${GREEN}✅ Deployment package ready in: $DEPLOY_DIR/${NC}"
echo -e "${GREEN}📝 Xem README-DEPLOY.txt trong thư mục deploy-ready để biết hướng dẫn${NC}"

# Restore next.config.ts
if [ -f "next.config.ts.bak" ]; then
  mv next.config.ts.bak next.config.ts
  echo -e "${GREEN}✅ Restored next.config.ts${NC}"
fi

echo -e "${GREEN}🎉 Hoàn thành!${NC}"
