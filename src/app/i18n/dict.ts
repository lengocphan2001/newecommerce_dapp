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
  | "failedToLoadProducts";

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
    navHome: "Home",
    navProducts: "Products",
    navOrders: "Orders",
    navProfile: "Profile",
    navAffiliate: "Affiliate",
    navShopping: "Shopping",
    navWallets: "Wallets",
    navAccount: "Account",
    langLabel: "Language",
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
    navAffiliate: "Affiliate",
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
    navAffiliate: "제휴",
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
  },
};


