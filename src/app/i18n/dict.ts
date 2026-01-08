export type Lang = "vi" | "en" | "ko";

export type I18nKey =
  | "appName"
  | "login"
  | "reload"
  | "nextToLogin"
  | "connectWallet"
  | "walletAddress"
  | "homeTitle"
  | "productsTitle"
  | "ordersTitle"
  | "profileTitle"
  | "searchProductsPlaceholder"
  | "navHome"
  | "navProducts"
  | "navOrders"
  | "navProfile"
  | "navAffiliate"
  | "navShopping"
  | "navWallets"
  | "navAccount"
  | "langLabel"
  | "affiliateLoading"
  | "affiliateError"
  | "affiliateNotFound"
  | "affiliateAccumulatedPurchases"
  | "affiliateBonusCommission"
  | "affiliateReferralCodeTitle"
  | "affiliateReferralCodeLabel"
  | "affiliateCopy"
  | "affiliateCopied"
  | "affiliateBranchLinksTitle"
  | "affiliateLeftBranch"
  | "affiliateRightBranch"
  | "affiliateGroupStatsTitle"
  | "affiliateTotal"
  | "affiliateMembersTitle"
  | "affiliateInstructionsTitle"
  | "affiliateInstruction1"
  | "affiliateInstruction2"
  | "affiliateInstruction3"
  | "affiliateReconsumptionWarning"
  | "affiliateReconsumptionRequiredCTV"
  | "affiliateReconsumptionRequiredNPP"
  | "affiliateLeftBranchLabel"
  | "affiliateRightBranchLabel"
  | "affiliateReconsumptionCurrent"
  | "affiliateReconsumptionRequired"
  | "affiliateReconsumptionMissing"
  | "loading"
  | "error"
  | "retry"
  | "add"
  | "remove"
  | "empty"
  | "noOrders"
  | "noProducts"
  | "cartEmpty"
  | "cartEmptyMessage"
  | "shopNow"
  | "all"
  | "processing"
  | "completed"
  | "orderId"
  | "viewTransaction"
  | "orderStatusPending"
  | "orderStatusConfirmed"
  | "orderStatusProcessing"
  | "orderStatusShipped"
  | "orderStatusDelivered"
  | "orderStatusCancelled"
  | "outOfStock"
  | "stockAvailable"
  | "items"
  | "total"
  | "checkout"
  | "continueShopping"
  | "productOutOfStock"
  | "failedToLoadOrders"
  | "failedToLoadProducts"
  | "addressTitle"
  | "addNewAddress"
  | "editAddress"
  | "defaultAddress"
  | "setAsDefault"
  | "confirmDeleteAddress"
  | "placeholderName"
  | "placeholderPhone"
  | "placeholderAddress"
  | "editProfileTitle"
  | "uploadAvatar"
  | "saveChanges"
  | "paymentMethod"
  | "transactionHash"
  | "copy"
  | "copied"
  | "processingTitle"
  | "processingMessage"
  | "confirmingTitle"
  | "confirmingMessage"
  | "creatingOrderTitle"
  | "creatingOrderMessage"
  | "paymentSuccessTitle"
  | "paymentSuccessMessage"
  | "paymentFailedTitle"
  | "close"
  | "back"
  | "change"
  | "addressList"
  | "noAddresses"
  | "confirm"
  | "confirmAddress"
  | "saveAddress"
  | "update";

export const DEFAULT_LANG: Lang = "vi";

export const DICT: Record<Lang, Record<I18nKey, string>> = {
  vi: {
    appName: "VinMall",
    login: "Đăng nhập",
    reload: "Tải lại",
    nextToLogin: "Vào trang chủ",
    connectWallet: "Kết nối ví",
    walletAddress: "Địa chỉ ví",
    homeTitle: "Vinmall",
    productsTitle: "Sản phẩm",
    ordersTitle: "Đơn hàng của tôi",
    profileTitle: "Cá nhân",
    searchProductsPlaceholder: "Tìm kiếm sản phẩm...",
    navHome: "Trang chủ",
    navProducts: "Sản phẩm",
    navOrders: "Đơn hàng",
    navProfile: "Cá nhân",
    navAffiliate: "Đội nhóm",
    navShopping: "Mua sắm",
    navWallets: "Ví",
    navAccount: "Tài khoản",
    langLabel: "Ngôn ngữ",
    affiliateLoading: "Đang tải...",
    affiliateError: "Không thể tải thông tin giới thiệu",
    affiliateNotFound: "Không tìm thấy thông tin giới thiệu",
    affiliateAccumulatedPurchases: "Tích lũy mua hàng",
    affiliateBonusCommission: "Hoa hồng thưởng",
    affiliateReferralCodeTitle: "Mã giới thiệu của bạn",
    affiliateReferralCodeLabel: "Mã giới thiệu (Username)",
    affiliateCopy: "Sao chép",
    affiliateCopied: "Đã copy!",
    affiliateBranchLinksTitle: "Link giới thiệu nhánh",
    affiliateLeftBranch: "Link nhánh trái",
    affiliateRightBranch: "Link nhánh phải",
    affiliateGroupStatsTitle: "Thống kê nhóm",
    affiliateTotal: "Tổng cộng",
    affiliateMembersTitle: "Thành viên nhóm",
    affiliateInstructionsTitle: "Hướng dẫn sử dụng",
    affiliateInstruction1: "Chia sẻ link giới thiệu hoặc mã giới thiệu cho người bạn muốn giới thiệu",
    affiliateInstruction2: "Khi người được giới thiệu đăng ký và mua gói, bạn sẽ nhận được hoa hồng",
    affiliateInstruction3: "Hoa hồng sẽ được tính tự động khi có giao dịch phát sinh",
    affiliateReconsumptionWarning: "Bạn cần tái tiêu dùng để tiếp tục nhận hoa hồng",
    affiliateReconsumptionRequiredCTV: "CTV cần tái tiêu dùng $40 để tiếp tục nhận hoa hồng",
    affiliateReconsumptionRequiredNPP: "NPP cần tái tiêu dùng $400 để tiếp tục nhận hoa hồng",
    affiliateReconsumptionCurrent: "Đã tái tiêu dùng",
    affiliateReconsumptionRequired: "Cần tái tiêu dùng",
    affiliateReconsumptionMissing: "Còn thiếu",
    affiliateLeftBranchLabel: "Nhánh trái",
    affiliateRightBranchLabel: "Nhánh phải",
    loading: "Đang tải...",
    error: "Lỗi",
    retry: "Thử lại",
    add: "Thêm",
    remove: "Xóa",
    empty: "Trống",
    noOrders: "Chưa có đơn hàng nào",
    noProducts: "Không tìm thấy sản phẩm",
    cartEmpty: "Giỏ hàng trống",
    cartEmptyMessage: "Hãy thêm sản phẩm vào giỏ hàng để tiếp tục mua sắm",
    shopNow: "Mua sắm ngay",
    all: "Tất cả",
    processing: "Đang xử lý",
    completed: "Đã giao",
    orderId: "Mã đơn",
    viewTransaction: "Xem giao dịch",
    orderStatusPending: "Chờ duyệt",
    orderStatusConfirmed: "Đã xác nhận",
    orderStatusProcessing: "Đang xử lý",
    orderStatusShipped: "Đang vận chuyển",
    orderStatusDelivered: "Đã giao",
    orderStatusCancelled: "Đã hủy",
    outOfStock: "Hết hàng",
    stockAvailable: "Còn {count} sản phẩm",
    items: "Sản phẩm",
    total: "Tổng cộng",
    checkout: "Thanh toán",
    continueShopping: "Tiếp tục mua sắm",
    productOutOfStock: "Sản phẩm đã hết hàng",
    failedToLoadOrders: "Không thể tải danh sách đơn hàng",
    failedToLoadProducts: "Không thể tải danh sách sản phẩm",
    addressTitle: "Địa chỉ giao hàng",
    addNewAddress: "Thêm địa chỉ mới",
    editAddress: "Chỉnh sửa địa chỉ",
    defaultAddress: "Mặc định",
    setAsDefault: "Đặt làm mặc định",
    confirmDeleteAddress: "Bạn có chắc chắn muốn xóa địa chỉ này?",
    placeholderName: "Họ và tên",
    placeholderPhone: "Số điện thoại",
    placeholderAddress: "Địa chỉ chi tiết (Số nhà, đường, phường/xã...)",
    editProfileTitle: "Chỉnh sửa hồ sơ",
    uploadAvatar: "Tải ảnh đại diện",
    saveChanges: "Lưu thay đổi",
    paymentMethod: "Phương thức thanh toán",
    transactionHash: "Mã giao dịch",
    copy: "Sao chép",
    copied: "Đã sao chép",
    processingTitle: "Đang xử lý",
    processingMessage: "Giao dịch đang được ghi nhận trên Blockchain...",
    confirmingTitle: "Xác nhận thanh toán",
    confirmingMessage: "Vui lòng xác nhận giao dịch trên ví của bạn",
    creatingOrderTitle: "Đang tạo đơn hàng",
    creatingOrderMessage: "Hệ thống đang hoàn tất đơn hàng của bạn...",
    paymentSuccessTitle: "Thanh toán thành công!",
    paymentSuccessMessage: "Đang chuyển hướng đến đơn hàng của bạn...",
    paymentFailedTitle: "Thanh toán thất bại",
    close: "Đóng",
    back: "Quay lại",
    change: "Thay đổi",
    addressList: "Danh sách địa chỉ",
    noAddresses: "Chưa có địa chỉ nào",
    confirm: "Xác nhận",
    confirmAddress: "Xác nhận địa chỉ này",
    saveAddress: "Lưu địa chỉ",
    update: "Cập nhật"
  },
  en: {
    appName: "VinMall",
    login: "Login",
    reload: "Reload",
    nextToLogin: "Go to Home",
    connectWallet: "Connect Wallet",
    walletAddress: "Wallet Address",
    homeTitle: "Vinmall",
    productsTitle: "Products",
    ordersTitle: "My Orders",
    profileTitle: "Profile",
    searchProductsPlaceholder: "Search products...",
    navHome: "Home",
    navProducts: "Products",
    navOrders: "Orders",
    navProfile: "Profile",
    navAffiliate: "Team",
    navShopping: "Shopping",
    navWallets: "Wallets",
    navAccount: "Account",
    langLabel: "Language",
    affiliateLoading: "Loading...",
    affiliateError: "Failed to load referral information",
    affiliateNotFound: "Referral information not found",
    affiliateAccumulatedPurchases: "Accumulated Purchases",
    affiliateBonusCommission: "Bonus Commission",
    affiliateReferralCodeTitle: "Your Referral Code",
    affiliateReferralCodeLabel: "Referral Code (Username)",
    affiliateCopy: "Copy",
    affiliateCopied: "Copied!",
    affiliateBranchLinksTitle: "Branch Referral Links",
    affiliateLeftBranch: "Left Branch",
    affiliateRightBranch: "Right Branch",
    affiliateGroupStatsTitle: "Group Statistics",
    affiliateTotal: "Total",
    affiliateMembersTitle: "Group Members",
    affiliateInstructionsTitle: "Usage Instructions",
    affiliateInstruction1: "Share referral link or referral code to people you want to refer",
    affiliateInstruction2: "When referred users register and purchase packages, you will receive commission",
    affiliateInstruction3: "Commission will be calculated automatically when transactions occur",
    affiliateReconsumptionWarning: "You need to reconsume to continue receiving commission",
    affiliateReconsumptionRequiredCTV: "CTV needs to reconsume $40 to continue receiving commission",
    affiliateReconsumptionRequiredNPP: "NPP needs to reconsume $400 to continue receiving commission",
    affiliateReconsumptionCurrent: "Reconsumed",
    affiliateReconsumptionRequired: "Required",
    affiliateReconsumptionMissing: "Missing",
    affiliateLeftBranchLabel: "Left Branch",
    affiliateRightBranchLabel: "Right Branch",
    loading: "Loading...",
    error: "Error",
    retry: "Retry",
    add: "Add",
    remove: "Remove",
    empty: "Empty",
    noOrders: "No orders yet",
    noProducts: "No products found",
    cartEmpty: "Cart is empty",
    cartEmptyMessage: "Add products to your cart to continue shopping",
    shopNow: "Shop Now",
    all: "All",
    processing: "Processing",
    completed: "Completed",
    orderId: "Order ID",
    viewTransaction: "View Transaction",
    orderStatusPending: "Pending",
    orderStatusConfirmed: "Confirmed",
    orderStatusProcessing: "Processing",
    orderStatusShipped: "Shipped",
    orderStatusDelivered: "Delivered",
    orderStatusCancelled: "Cancelled",
    outOfStock: "Out of Stock",
    stockAvailable: "{count} items available",
    items: "Items",
    total: "Total",
    checkout: "Checkout",
    continueShopping: "Continue Shopping",
    productOutOfStock: "Product is out of stock",
    failedToLoadOrders: "Failed to load orders",
    failedToLoadProducts: "Failed to load products",
    addressTitle: "Shipping Address",
    addNewAddress: "Add New Address",
    editAddress: "Edit Address",
    defaultAddress: "Default",
    setAsDefault: "Set as Default",
    confirmDeleteAddress: "Are you sure you want to delete this address?",
    placeholderName: "Full Name",
    placeholderPhone: "Phone Number",
    placeholderAddress: "Detail Address",
    editProfileTitle: "Edit Profile",
    uploadAvatar: "Upload Avatar",
    saveChanges: "Save Changes",
    paymentMethod: "Payment Method",
    transactionHash: "Transaction Hash",
    copy: "Copy",
    copied: "Copied",
    processingTitle: "Processing",
    processingMessage: "Transaction is being recorded on Blockchain...",
    confirmingTitle: "Confirm Payment",
    confirmingMessage: "Please confirm transaction in your wallet",
    creatingOrderTitle: "Creating Order",
    creatingOrderMessage: "System is creating your order...",
    paymentSuccessTitle: "Payment Successful!",
    paymentSuccessMessage: "Redirecting to your order...",
    paymentFailedTitle: "Payment Failed",
    close: "Close",
    back: "Back",
    change: "Change",
    addressList: "Address List",
    noAddresses: "No addresses found",
    confirm: "Confirm",
    confirmAddress: "Confirm this address",
    saveAddress: "Save Address",
    update: "Update"
  },
  ko: {
    appName: "VinMall",
    login: "로그인",
    reload: "새로고침",
    nextToLogin: "홈으로",
    connectWallet: "지갑 연결",
    walletAddress: "지갑 주소",
    homeTitle: "Vinmall",
    productsTitle: "상품",
    ordersTitle: "내 주문",
    profileTitle: "프로필",
    searchProductsPlaceholder: "상품 검색...",
    navHome: "홈",
    navProducts: "상품",
    navOrders: "주문",
    navProfile: "프로필",
    navAffiliate: "팀",
    navShopping: "쇼핑",
    navWallets: "지갑",
    navAccount: "계정",
    langLabel: "언어",
    affiliateLoading: "로딩 중...",
    affiliateError: "추천 정보를 불러올 수 없습니다",
    affiliateNotFound: "추천 정보를 찾을 수 없습니다",
    affiliateAccumulatedPurchases: "누적 구매",
    affiliateBonusCommission: "보너스 커미션",
    affiliateReferralCodeTitle: "추천 코드",
    affiliateReferralCodeLabel: "추천 코드 (사용자명)",
    affiliateCopy: "복사",
    affiliateCopied: "복사됨!",
    affiliateBranchLinksTitle: "브랜치 추천 링크",
    affiliateLeftBranch: "왼쪽 브랜치 링크",
    affiliateRightBranch: "오른쪽 브랜치 링크",
    affiliateGroupStatsTitle: "그룹 통계",
    affiliateTotal: "전체",
    affiliateMembersTitle: "그룹 멤버",
    affiliateInstructionsTitle: "사용 안내",
    affiliateInstruction1: "추천하고 싶은 사람에게 추천 링크나 추천 코드를 공유하세요",
    affiliateInstruction2: "추천받은 사용자가 등록하고 패키지를 구매하면 커미션을 받게 됩니다",
    affiliateInstruction3: "거래가 발생하면 커미션이 자동으로 계산됩니다",
    affiliateReconsumptionWarning: "커미션을 계속 받으려면 재소비가 필요합니다",
    affiliateReconsumptionRequiredCTV: "CTV는 커미션을 계속 받으려면 $40 재소비가 필요합니다",
    affiliateReconsumptionRequiredNPP: "NPP는 커미션을 계속 받으려면 $400 재소비가 필요합니다",
    affiliateReconsumptionCurrent: "재소비 완료",
    affiliateReconsumptionRequired: "필요한 재소비",
    affiliateReconsumptionMissing: "부족한 금액",
    affiliateLeftBranchLabel: "왼쪽 브랜치",
    affiliateRightBranchLabel: "오른쪽 브랜치",
    loading: "로딩 중...",
    error: "오류",
    retry: "다시 시도",
    add: "추가",
    remove: "삭제",
    empty: "비어 있음",
    noOrders: "주문이 없습니다",
    noProducts: "상품을 찾을 수 없습니다",
    cartEmpty: "장바구니가 비어 있습니다",
    cartEmptyMessage: "쇼핑을 계속하려면 장바구니에 상품을 추가하세요",
    shopNow: "지금 쇼핑하기",
    all: "전체",
    processing: "처리 중",
    completed: "완료됨",
    orderId: "주문 ID",
    viewTransaction: "거래 보기",
    orderStatusPending: "대기 중",
    orderStatusConfirmed: "확인됨",
    orderStatusProcessing: "처리 중",
    orderStatusShipped: "배송 중",
    orderStatusDelivered: "배송 완료",
    orderStatusCancelled: "취소됨",
    outOfStock: "품절",
    stockAvailable: "{count}개 남음",
    items: "상품",
    total: "총계",
    checkout: "결제",
    continueShopping: "쇼핑 계속하기",
    productOutOfStock: "상품이 품절되었습니다",
    failedToLoadOrders: "주문 목록을 불러올 수 없습니다",
    failedToLoadProducts: "상품 목록을 불러올 수 없습니다",
    addressTitle: "배송 주소",
    addNewAddress: "새 주소 추가",
    editAddress: "주소 수정",
    defaultAddress: "기본",
    setAsDefault: "기본으로 설정",
    confirmDeleteAddress: "이 주소를 삭제하시겠습니까?",
    placeholderName: "이름",
    placeholderPhone: "전화번호",
    placeholderAddress: "상세 주소",
    editProfileTitle: "프로필 수정",
    uploadAvatar: "아바타 업로드",
    saveChanges: "변경 사항 저장",
    paymentMethod: "결제 방법",
    transactionHash: "거래 해시",
    copy: "복사",
    copied: "복사됨",
    processingTitle: "처리 중",
    processingMessage: "블록체인에 거래를 기록 중입니다...",
    confirmingTitle: "결제 확인",
    confirmingMessage: "지갑에서 거래를 확인해주세요",
    creatingOrderTitle: "주문 생성 중",
    creatingOrderMessage: "주문을 완료하는 중입니다...",
    paymentSuccessTitle: "결제 성공!",
    paymentSuccessMessage: "주문 페이지로 이동 중...",
    paymentFailedTitle: "결제 실패",
    close: "닫기",
    back: "뒤로",
    change: "변경",
    addressList: "배송 주소 목록",
    noAddresses: "주소가 없습니다",
    confirm: "확인",
    confirmAddress: "이 주소 사용",
    saveAddress: "주소 저장",
    update: "업데이트"
  },
};
