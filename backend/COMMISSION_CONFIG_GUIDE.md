# Hướng dẫn Sử dụng Commission Config

## Tổng quan

Hệ thống cho phép admin cấu hình các thông số hoa hồng và tái tiêu dùng thông qua giao diện admin thay vì phải sửa code.

## Cấu trúc

### Backend
- **Entity**: `CommissionConfig` - Lưu config trong database
- **Service**: `CommissionConfigService` - Quản lý CRUD config
- **Controller**: `CommissionConfigController` - API endpoints
- **Integration**: `CommissionService` đọc config từ database (có cache 5 phút)

### Frontend (Admin Panel)
- **Page**: `/admin/commission-config`
- **Service**: `commissionConfigService.ts`
- **UI**: Form với tabs cho CTV và NPP

## API Endpoints

### Get all configs
```
GET /admin/commission-config
```

### Get config by ID
```
GET /admin/commission-config/:id
```

### Get config by package type
```
GET /admin/commission-config/package/:packageType
```

### Update config by ID
```
PUT /admin/commission-config/:id
Body: {
  directRate?: number (0-1),
  groupRate?: number (0-1),
  managementRateF1?: number (0-1),
  managementRateF2?: number | null (0-1),
  managementRateF3?: number | null (0-1),
  packageValue?: number,
  reconsumptionThreshold?: number,
  reconsumptionRequired?: number
}
```

### Update config by package type
```
PUT /admin/commission-config/package/:packageType
Body: (same as above)
```

## Các thông số có thể config

### Commission Rates (Tỷ lệ hoa hồng)
- **directRate**: Tỷ lệ hoa hồng trực tiếp (0-1, ví dụ: 0.2 = 20%)
- **groupRate**: Tỷ lệ hoa hồng nhóm (0-1, ví dụ: 0.1 = 10%)
- **managementRateF1**: Tỷ lệ hoa hồng quản lý F1 (0-1, ví dụ: 0.15 = 15%)
- **managementRateF2**: Tỷ lệ hoa hồng quản lý F2 (chỉ NPP, có thể null)
- **managementRateF3**: Tỷ lệ hoa hồng quản lý F3 (chỉ NPP, có thể null)

### Package & Reconsumption
- **packageValue**: Giá trị gói tối thiểu để trở thành CTV/NPP ($)
- **reconsumptionThreshold**: Ngưỡng hoa hồng để yêu cầu tái tiêu dùng ($)
- **reconsumptionRequired**: Số tiền tái tiêu dùng cần thiết mỗi chu kỳ ($)

## Giá trị mặc định

### CTV
- Direct Rate: 20%
- Group Rate: 10%
- Management Rate F1: 15%
- Package Value: $0.0001
- Reconsumption Threshold: $0.001
- Reconsumption Required: $0.0001

### NPP
- Direct Rate: 25%
- Group Rate: 15%
- Management Rate F1: 15%
- Management Rate F2: 10%
- Management Rate F3: 10%
- Package Value: $0.001
- Reconsumption Threshold: $0.01
- Reconsumption Required: $0.001

## Cách sử dụng

### 1. Truy cập Admin Panel
- Vào `/admin/commission-config`
- Hoặc click "Commission Config" trong menu sidebar

### 2. Chọn Package Type
- Tab "CTV" để config cho Cộng tác viên
- Tab "NPP" để config cho Nhà phân phối

### 3. Cập nhật thông số
- Điền các giá trị vào form
- **Lưu ý**: 
  - Rates nhập theo % (ví dụ: 20 cho 20%)
  - Giá trị tiền nhập theo $ (ví dụ: 0.001)
- Click "Save" để lưu

### 4. Xác nhận
- Config được lưu vào database
- Cache trong `CommissionService` được clear tự động
- Config mới sẽ được áp dụng cho các đơn hàng tiếp theo

## Lưu ý quan trọng

1. **Cache**: Config được cache 5 phút trong `CommissionService` để tối ưu performance
2. **Auto Clear Cache**: Cache tự động được clear khi admin update config
3. **Fallback**: Nếu config không tìm thấy trong DB, hệ thống sẽ dùng giá trị mặc định
4. **Initialization**: Config mặc định được tự động tạo khi backend start lần đầu
5. **Validation**: 
   - Rates phải trong khoảng 0-1 (0% - 100%)
   - Giá trị tiền phải >= 0

## Troubleshooting

### Config không được áp dụng
1. Kiểm tra config đã được lưu trong database chưa
2. Clear cache: Restart backend hoặc đợi 5 phút
3. Kiểm tra logs để xem có lỗi không

### Lỗi khi update
1. Kiểm tra format dữ liệu (rates: 0-1, không phải 0-100)
2. Kiểm tra validation errors trong response
3. Kiểm tra quyền admin

## Database Schema

Table: `commission_config`
- `id`: UUID (Primary Key)
- `packageType`: ENUM('CTV', 'NPP') (Unique)
- `directRate`: DECIMAL(5,4)
- `groupRate`: DECIMAL(5,4)
- `managementRateF1`: DECIMAL(5,4)
- `managementRateF2`: DECIMAL(5,4) | NULL
- `managementRateF3`: DECIMAL(5,4) | NULL
- `packageValue`: DECIMAL(10,2)
- `reconsumptionThreshold`: DECIMAL(10,2)
- `reconsumptionRequired`: DECIMAL(10,2)
- `createdAt`: TIMESTAMP
- `updatedAt`: TIMESTAMP
