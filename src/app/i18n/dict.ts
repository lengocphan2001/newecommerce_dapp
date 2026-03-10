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
  | "affiliatePayoutReady"
  | "affiliatePendingPayout"
  | "affiliatePayoutReadyMessage"
  | "affiliatePayoutPendingMessage"
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
  | "soldOut"
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
  | "confirmDeleteAddressMessage"
  | "delete"
  | "deleting"
  | "cancel"
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
  | "pleaseDoNotCloseBrowser"
  | "close"
  | "back"
  | "change"
  | "addressList"
  | "noAddresses"
  | "confirm"
  | "confirmAddress"
  | "saveAddress"
  | "update"
  | "popularGoods"
  | "countries"
  | "myNetwork"
  | "earn5Back"
  | "binarySystem"
  | "sale"
  | "binaryXP"
  | "productNotFound"
  | "stockRemaining"
  | "itemsInCart"
  | "quantity"
  | "productDescription"
  | "addedToCart"
  | "addToCart"
  | "buyNow"
  | "cartTitle"
  | "clearAll"
  | "cashback2Percent"
  | "affiliateLevel"
  | "details"
  | "unit"
  | "enterPromoCode"
  | "apply"
  | "subtotal"
  | "totalPayment"
  | "proceedToPayment"
  | "securePayment"
  | "shippingInfo"
  | "connected"
  | "connect"
  | "paymentAsset"
  | "paymentDetails"
  | "productPrice"
  | "confirmPurchase"
  | "processingPayment"
  | "orderHistory"
  | "allOrders"
  | "processingOrders"
  | "deliveredOrders"
  | "cancelledOrders"
  | "orderStatusProcessing"
  | "orderStatusDelivered"
  | "orderStatusCancelled"
  | "orderDetails"
  | "orderStatus"
  | "lastUpdated"
  | "orderPlaced"
  | "orderConfirmed"
  | "orderShipping"
  | "binaryCommission"
  | "productList"
  | "shippingPaymentInfo"
  | "deliveryAddress"
  | "paymentMethodSafePal"
  | "orderCode"
  | "shippingFee"
  | "support"
  | "rebuyOrder"
  | "profileTitle"
  | "editProfile"
  | "shippingAddress"
  | "orderHistoryNav"
  | "security"
  | "security2FA"
  | "logout"
  | "changeAvatar"
  | "displayName"
  | "enterYourName"
  | "email"
  | "phoneNumber"
  | "enterPhone"
  | "safePalWalletLinked"
  | "saving"
  | "profileUpdated"
  | "updateFailed"
  | "addNewAddressTitle"
  | "fullName"
  | "enterFullName"
  | "enterPhoneNumber"
  | "detailAddress"
  | "setAsDefaultAddress"
  | "savingAddress"
  | "saveAddressButton"
  | "pleaseFillAllFields"
  | "errorOccurred"
  | "totalEarnings"
  | "thisWeek"
  | "pendingRewards"
  | "claim"
  | "networkStructure"
  | "viewFullTree"
  | "leftBranchLink"
  | "rightBranchLink"
  | "shareOnSocial"
  | "recentActivity"
  | "directCommission"
  | "groupCommission"
  | "managementCommission"
  | "commissionReceived"
  | "fromDirectReferral"
  | "fromBinaryNetwork"
  | "fromTeamPerformance"
  | "justNow"
  | "minutesAgo"
  | "hoursAgo"
  | "daysAgo"
  | "noRecentActivity"
  | "totalNetWorth"
  | "connectedToSafePal"
  | "shopping"
  | "affiliate"
  | "assets"
  | "recentActivityTitle"
  | "seeAll"
  | "orderPurchase"
  | "noRecentTransactions"
  | "accountInfo"
  | "viewEditAccountInfo"
  | "redirecting"
  | "registerAccount"
  | "completeInfoToCreateAccount"
  | "checkingRegistration"
  | "alreadyRegistered"
  | "alreadyRegisteredMessage"
  | "redirectingToLogin"
  | "seconds"
  | "goToLoginNow"
  | "walletInfoAutoFill"
  | "walletAddressLabel"
  | "chainIdLabel"
  | "walletInfoCannotChange"
  | "username"
  | "enterUsername"
  | "country"
  | "selectCountry"
  | "address"
  | "enterAddress"
  | "referralCodeOptional"
  | "referralCode"
  | "enterReferralCode"
  | "registering"
  | "register"
  | "activityHistory"
  | "system"
  | "today"
  | "yesterday"
  | "successfulTransaction"
  | "orderNumber"
  | "added"
  | "fromMember"
  | "walletConnect"
  | "verified"
  | "profileUpdate"
  | "passwordChanged"
  | "referralReward"
  | "newMember"
  | "filter"
  | "notConnected"
  | "groceryCoin"
  | "tether"
  | "pending"
  | "gold"
  | "silver"
  | "bronze"
  | "platinum"
  | "rank"
  | "balance"
  | "you"
  | "partners"
  | "vol"
  | "nextRank"
  | "complete"
  | "activeUsers"
  | "newToday"
  | "referralTools"
  | "imageTooLarge"
  | "commission"
  | "organic"
  | "bestSeller"
  | "lowStock"
  | "soldPercentage"
  | "highCommission"
  | "highCommissionDesc"
  | "fastDelivery"
  | "fastDeliveryDesc"
  | "freeShippingFrom"
  | "linkSafePal"
  | "cashback5Percent"
  | "freeGasFeeLifetime"
  | "viewDetails"
  | "collapse"
  | "viewOnChain"
  | "reviews"
  | "viewAllReviews"
  | "relatedProducts"
  | "share"
  | "tokenReward"
  | "pleaseLogin"
  | "failedToLoadAddresses"
  | "failedToDeleteAddress"
  | "failedToSaveAddress"
  | "goToProfile"
  | "avatarUploaded"
  | "avatarUploadFailed"
  | "uploading"
  | "searchMemberId"
  | "search"
  | "members"
  | "memberId"
  | "addMember"
  | "blocked"
  | "reconsumptionRequired"
  | "maxCommission"
  | "totalCommissionCanReceive"
  | "received"
  | "maximum"
  | "scanToRegister"
  | "loginTitle"
  | "loginSubtitle"
  | "loginDescription"
  | "connectSafePalWallet"
  | "whatIsSafePal"
  | "securedByWeb3"
  | "walletNotFound"
  | "cannotConnectWallet"
  | "favorite"
  | "sold"
  | "commissionRateLabel"
  | "productDetails"
  | "category"
  | "brand"
  | "origin"
  | "clothingType"
  | "viewMore"
  | "chatNow"
  | "addToCartButton"
  | "buyNowButton"
  | "usernameHelper"
  | "usernameInvalid"
  | "usernameTooShort"
  | "usernameTooLong"
  | "verifying"
  | "verifyEmailSuccess"
  | "verifyEmailFailed"
  | "verifyEmailMissingToken"
  | "backToAccount"
  | "sendVerificationEmail"
  | "emailVerification"
  | "emailVerified"
  | "emailNotVerified"
  | "enterVerificationCode"
  | "verifyCode"
  | "resendCode"
  | "identityVerification"
  | "identityVerificationDesc"
  | "goToKyc"
  | "enter6DigitCode"
  | "usernameInvalidNoSpecial"
  | "selectSide"
  | "milestoneReward"
  | "reconsumptionRequiredDesc"
  | "maxCommissionReached"
  | "whyLocked"
  | "reconsumptionExplanation"
  | "buyPackageNow"
  | "kycTitle"
  | "kycDesc"
  | "kycStatusUnverified"
  | "kycStatusPending"
  | "kycStatusPendingDesc"
  | "kycStatusApproved"
  | "kycStatusApprovedDesc"
  | "kycStatusRejected"
  | "kycStatusRejectedDesc"
  | "kycAdminNote"
  | "kycPleaseResubmit"
  | "kycDocumentType"
  | "kycIdCard"
  | "kycPassport"
  | "kycDriversLicense"
  | "kycDocumentNumber"
  | "kycDocumentNumberPlaceholder"
  | "kycFrontImage"
  | "kycUploadFrontSide"
  | "kycBackImage"
  | "kycUploadBackSide"
  | "kycSubmitRequest"
  | "kycSubmitting"
  | "kycPleaseEnterDocNumber"
  | "kycPleaseUploadBothImages"
  | "kycSubmittedSuccess"
  | "kycImageTooLarge"
  | "kycUploadFailed"
  | "kycSubmissionFailed"
  | "kycBankingInfo"
  | "kycBankName"
  | "kycBankAccountNumber"
  | "kycBankAccountHolder"
  | "kycBankBranch"
  | "packagesSectionTitle"
  | "packagesPendingLabel"
  | "packagesPendingWaitAdmin"
  | "packagesLoading"
  | "packagesNoneAvailable"
  | "packagesBuy";

export const DEFAULT_LANG: Lang = "vi";

export const DICT: Record<Lang, Record<I18nKey, string>> = {
  vi: {
    appName: "Shopii",
    login: "Đăng nhập",
    reload: "Tải lại",
    nextToLogin: "Vào trang chủ",
    connectWallet: "Kết nối ví",
    walletAddress: "Địa chỉ ví",
    homeTitle: "Shopii",
    productsTitle: "Sản phẩm",
    ordersTitle: "Đơn hàng của tôi",
    profileTitle: "Cá nhân",
    searchProductsPlaceholder: "Tìm kiếm sản phẩm...",
    navHome: "Trang chủ",
    navProducts: "Sản phẩm",
    navOrders: "Đơn hàng",
    navProfile: "Cá nhân",
    navAffiliate: "Đội nhóm",
    navShopping: "Giỏ hàng",
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
    affiliateBranchLinksTitle: "Link giới thiệu team",
    affiliateLeftBranch: "Link team 1",
    affiliateRightBranch: "Link team 2",
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
    affiliatePayoutReady: "Sẵn sàng chi trả!",
    affiliatePendingPayout: "Đang chờ chi trả",
    affiliatePayoutReadyMessage: "Bạn đã tích lũy {{amount}} hoa hồng. Chi trả sẽ được xử lý tự động.",
    affiliatePayoutPendingMessage: "Tích lũy thêm {{remaining}} để đạt ngưỡng chi trả {{threshold}}.",
    affiliateLeftBranchLabel: "Team 1",
    affiliateRightBranchLabel: "Team 2",
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
    soldOut: "Hết hàng",
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
    confirmDeleteAddressMessage: "Bạn có chắc chắn muốn xóa địa chỉ này? Hành động này không thể hoàn tác.",
    delete: "Xóa",
    deleting: "Đang xóa...",
    cancel: "Hủy",
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
    pleaseDoNotCloseBrowser: "Vui lòng không tắt trình duyệt",
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
    update: "Cập nhật",
    popularGoods: "Sản phẩm phổ biến",
    countries: "Quốc gia",
    myNetwork: "Mạng lưới của tôi",
    earn5Back: "Nhận lại 5%",
    binarySystem: "Hệ thống nhị phân",
    sale: "KHUYẾN MÃI",
    binaryXP: "Binary XP",
    productNotFound: "Không tìm thấy sản phẩm",
    stockRemaining: "Còn {count} sản phẩm",
    itemsInCart: "Đã có {count} sản phẩm trong giỏ hàng",
    quantity: "Số lượng:",
    productDescription: "Mô tả sản phẩm",
    addedToCart: "Đã thêm {quantity} sản phẩm vào giỏ hàng!",
    addToCart: "Thêm",
    buyNow: "Mua ngay",
    cartTitle: "Giỏ hàng",
    clearAll: "Xóa hết",
    cashback2Percent: "Hoàn tiền 2% + 0.5 Token",
    affiliateLevel: "Cấp độ liên kết:",
    details: "Chi tiết",
    unit: "Đơn vị: 1kg",
    enterPromoCode: "Nhập mã giảm giá",
    apply: "Áp dụng",
    subtotal: "Tạm tính",
    totalPayment: "Tổng thanh toán",
    proceedToPayment: "Tiến hành thanh toán",
    securePayment: "Thanh toán an toàn qua ví Shopii",
    shippingInfo: "Thông tin giao hàng",
    connected: "Đã kết nối",
    connect: "Kết nối",
    paymentAsset: "Tài sản thanh toán",
    paymentDetails: "Chi tiết thanh toán",
    productPrice: "Tiền hàng",
    confirmPurchase: "Xác nhận mua hàng",
    processingPayment: "Đang xử lý...",
    orderHistory: "Lịch sử Đơn hàng",
    allOrders: "Tất cả",
    processingOrders: "Đang xử lý",
    deliveredOrders: "Đã giao",
    cancelledOrders: "Đã hủy",
    orderDetails: "Chi tiết đơn hàng",
    orderStatus: "Trạng thái",
    lastUpdated: "Cập nhật:",
    orderPlaced: "Đã đặt",
    orderConfirmed: "Đã xác nhận",
    orderShipping: "Đang giao",
    binaryCommission: "Hoa hồng nhị phân",
    productList: "Danh sách sản phẩm",
    shippingPaymentInfo: "Thông tin vận chuyển",
    deliveryAddress: "Địa chỉ nhận hàng",
    paymentMethodSafePal: "Phương thức thanh toán",
    orderCode: "Mã đơn hàng",
    shippingFee: "Phí vận chuyển",
    support: "Hỗ trợ",
    rebuyOrder: "Mua lại đơn này",
    editProfile: "Chỉnh sửa hồ sơ",
    shippingAddress: "Địa chỉ giao hàng",
    orderHistoryNav: "Lịch sử đơn hàng",
    security: "Bảo mật",
    security2FA: "2FA, Quyền truy cập ví",
    logout: "Đăng xuất",
    changeAvatar: "Thay đổi ảnh đại diện",
    displayName: "Tên hiển thị",
    enterYourName: "Nhập tên của bạn",
    email: "Email",
    phoneNumber: "Số điện thoại",
    enterPhone: "09xx xxx xxx",
    safePalWalletLinked: "Ví Shopii đã liên kết",
    saving: "Đang lưu...",
    profileUpdated: "Cập nhật hồ sơ thành công!",
    updateFailed: "Cập nhật thất bại. Vui lòng thử lại.",
    addNewAddressTitle: "Thêm địa chỉ mới",
    fullName: "Họ và tên",
    enterFullName: "Nhập họ tên người nhận",
    enterPhoneNumber: "Nhập số điện thoại",
    detailAddress: "Địa chỉ chi tiết",
    setAsDefaultAddress: "Đặt làm địa chỉ mặc định",
    savingAddress: "Đang lưu...",
    saveAddressButton: "Lưu địa chỉ",
    pleaseFillAllFields: "Vui lòng điền đầy đủ thông tin.",
    errorOccurred: "Có lỗi xảy ra",
    totalEarnings: "Tổng thu nhập",
    thisWeek: "tuần này",
    pendingRewards: "Phần thưởng đang chờ",
    claim: "Nhận",
    networkStructure: "Cấu trúc mạng lưới",
    viewFullTree: "Xem cây đầy đủ",
    leftBranchLink: "Link team 1",
    rightBranchLink: "Link team 2",
    shareOnSocial: "Chia sẻ trên mạng xã hội",
    recentActivity: "Hoạt động gần đây",
    directCommission: "Hoa hồng trực tiếp",
    groupCommission: "Hoa hồng nhóm",
    managementCommission: "Hoa hồng quản lý",
    milestoneReward: "Thưởng cột mốc",
    commissionReceived: "Đã nhận hoa hồng",
    fromDirectReferral: "Từ giới thiệu trực tiếp",
    fromBinaryNetwork: "Từ mạng lưới nhị phân",
    fromTeamPerformance: "Từ hiệu suất nhóm",
    justNow: "Vừa xong",
    minutesAgo: "phút trước",
    hoursAgo: "giờ trước",
    daysAgo: "ngày trước",
    noRecentActivity: "Không có hoạt động gần đây",
    totalNetWorth: "Tổng tài sản",
    connectedToSafePal: "Đã kết nối ví Shopii",
    shopping: "Giỏ hàng",
    affiliate: "Liên kết",
    assets: "Tài sản",
    recentActivityTitle: "Hoạt động gần đây",
    seeAll: "Xem tất cả",
    orderPurchase: "Mua hàng",
    noRecentTransactions: "Không có giao dịch gần đây",
    accountInfo: "Thông tin cá nhân",
    viewEditAccountInfo: "Xem và chỉnh sửa thông tin tài khoản",
    redirecting: "Đang chuyển hướng...",
    registerAccount: "Đăng ký tài khoản",
    completeInfoToCreateAccount: "Hoàn tất thông tin để tạo tài khoản",
    checkingRegistration: "Đang kiểm tra đăng ký...",
    alreadyRegistered: "Tài khoản đã được đăng ký",
    alreadyRegisteredMessage: "Ví của bạn đã được đăng ký trong hệ thống. Bạn sẽ được chuyển đến trang đăng nhập.",
    redirectingToLogin: "Đang chuyển đến trang đăng nhập sau",
    seconds: "giây",
    goToLoginNow: "Đăng nhập ngay",
    walletInfoAutoFill: "Thông tin ví (tự động điền)",
    walletAddressLabel: "Địa chỉ ví:",
    chainIdLabel: "Chain ID:",
    walletInfoCannotChange: "Thông tin này được lấy từ ví của bạn và không thể thay đổi",
    username: "Tên người dùng",
    enterUsername: "Nhập tên người dùng",
    country: "Quốc gia",
    selectCountry: "Chọn quốc gia",
    address: "Địa chỉ",
    enterAddress: "Nhập địa chỉ",
    referralCodeOptional: "Mã giới thiệu (tùy chọn)",
    referralCode: "Mã giới thiệu",
    enterReferralCode: "Nhập mã giới thiệu",
    registering: "Đang đăng ký...",
    register: "Đăng ký",
    activityHistory: "Hoạt động gần đây",
    system: "Hệ thống",
    today: "Hôm nay",
    yesterday: "Hôm qua",
    successfulTransaction: "Giao dịch thành công",
    orderNumber: "Đơn hàng",
    added: "Đã cộng",
    fromMember: "Từ thành viên",
    walletConnect: "Kết nối ví Shopii",
    verified: "Xác thực",
    profileUpdate: "Cập nhật hồ sơ",
    passwordChanged: "Đã đổi mật khẩu cấp 2",
    referralReward: "Thưởng giới thiệu (Direct)",
    newMember: "Thành viên mới",
    filter: "Lọc",
    notConnected: "Chưa kết nối",
    groceryCoin: "Grocery Coin",
    tether: "Tether",
    pending: "Đang chờ",
    gold: "Vàng",
    silver: "Bạc",
    bronze: "Đồng",
    platinum: "Bạch kim",
    rank: "Cấp bậc",
    balance: "Số dư",
    you: "Bạn",
    partners: "Đối tác",
    vol: "Khối lượng",
    nextRank: "Cấp bậc tiếp theo",
    complete: "Hoàn thành",
    activeUsers: "Người dùng hoạt động",
    newToday: "Mới hôm nay",
    referralTools: "Công cụ giới thiệu",
    imageTooLarge: "Ảnh quá lớn (Max 5MB)",
    commission: "Hoa hồng",
    organic: "Organic",
    bestSeller: "Best Seller",
    lowStock: "Sắp hết hàng: {count} túi",
    soldPercentage: "Lượt bán {percentage}%",
    highCommission: "Hoa hồng cao",
    highCommissionDesc: "Nhận tới {percentage}% cho mỗi đơn",
    fastDelivery: "Giao nhanh 2h",
    fastDeliveryDesc: "Miễn phí ship từ ${amount}",
    freeShippingFrom: "Miễn phí ship từ ${amount}",
    linkSafePal: "Liên kết Shopii",
    cashback5Percent: "Hoàn tiền 5% + Miễn phí gas fee trọn đời",
    freeGasFeeLifetime: "Miễn phí gas fee trọn đời",
    viewDetails: "Xem chi tiết",
    collapse: "Thu gọn",
    viewOnChain: "View on Chain",
    reviews: "Đánh giá",
    viewAllReviews: "Xem tất cả ({count})",
    relatedProducts: "Sản phẩm liên quan",
    share: "Chia sẻ",
    tokenReward: "{amount} TKN",
    pleaseLogin: "Vui lòng đăng nhập",
    failedToLoadAddresses: "Không thể tải địa chỉ",
    failedToDeleteAddress: "Không thể xóa địa chỉ",
    failedToSaveAddress: "Không thể lưu địa chỉ",
    goToProfile: "Đi tới trang cá nhân",
    avatarUploaded: "Tải ảnh đại diện thành công",
    avatarUploadFailed: "Tải ảnh đại diện thất bại",
    uploading: "Đang tải lên...",
    searchMemberId: "Tìm kiếm ID thành viên...",
    search: "Tìm",
    members: "Thành viên",
    memberId: "ID:",
    addMember: "Thêm",
    blocked: "Bị chặn",
    reconsumptionRequired: "Cần tái tiêu dùng",
    maxCommission: "Hoa hồng tối đa",
    totalCommissionCanReceive: "Tổng hoa hồng có thể nhận",
    received: "Đã nhận",
    maximum: "Tối đa",
    scanToRegister: "Quét để đăng ký",
    loginTitle: "Tương lai của",
    loginSubtitle: "Ví Tiêu Dùng Thông Minh Toàn Cầu",
    loginDescription: "Mua sắm nhu yếu phẩm và gia tăng thu nhập thông qua mạng lưới phi tập trung.",
    connectSafePalWallet: "Kết nối Ví Shopii",
    whatIsSafePal: "Shopii    là gì?",
    securedByWeb3: "Bảo mật bởi Công nghệ Web3",
    walletNotFound: "Không tìm thấy ví. Vui lòng cài đặt Shopii Wallet.",
    cannotConnectWallet: "Không thể kết nối ví",
    favorite: "Yêu Thích",
    sold: "Lượt bán",
    commissionRateLabel: "Tỉ lệ hoa hồng",
    productDetails: "Chi tiết sản phẩm",
    category: "Danh mục",
    brand: "Thương hiệu",
    origin: "Xuất xứ",
    clothingType: "Loại trang phục",
    viewMore: "Xem thêm",
    chatNow: "Chat ngay",
    addToCartButton: "Thêm vào giỏ hàng",
    buyNowButton: "Mua ngay",
    usernameHelper: "Chỉ được dùng chữ cái và số. Độ dài: 3-20 ký tự",
    usernameInvalid: "Tên người dùng chỉ được chứa chữ cái, số (không có dấu cách hoặc ký tự đặc biệt)",
    usernameInvalidNoSpecial: "Tên người dùng chỉ được chứa chữ cái và số (không có dấu cách hoặc ký tự đặc biệt)",
    usernameTooShort: "Tên người dùng phải có ít nhất 3 ký tự",
    usernameTooLong: "Tên người dùng không được quá 20 ký tự",
    verifying: "Đang xác thực...",
    verifyEmailSuccess: "Xác thực email thành công",
    verifyEmailFailed: "Xác thực email thất bại",
    verifyEmailMissingToken: "Thiếu link xác thực.",
    backToAccount: "Về tài khoản",
    sendVerificationEmail: "Gửi email xác thực",
    emailVerification: "Xác thực email",
    emailVerified: "Đã xác thực email",
    emailNotVerified: "Email chưa được xác thực. Nhấn nút bên dưới để nhận mã 6 số.",
    enterVerificationCode: "Nhập mã 6 số đã gửi đến email của bạn:",
    verifyCode: "Xác thực",
    resendCode: "Gửi lại mã",
    identityVerification: "Xác minh danh tính",
    identityVerificationDesc: "Xác minh danh tính của bạn qua KYC để sử dụng đầy đủ tính năng.",
    goToKyc: "Đến trang xác minh",
    enter6DigitCode: "Vui lòng nhập đủ 6 số.",
    selectSide: "Chọn team",
    reconsumptionRequiredDesc: "Bạn đã đạt ngưỡng hoa hồng tối đa. Vui lòng mua thêm gói để tiếp tục nhận thưởng.",
    maxCommissionReached: "Giới Hạn Hoa Hồng",
    whyLocked: "Tại sao bị khóa?",
    reconsumptionExplanation: "Để đảm bảo tính bền vững của hệ thống, bạn cần tái tiêu dùng (mua sản phẩm) để mở khóa hoa hồng mới.",
    buyPackageNow: "Mua Gói Ngay",
    packagesSectionTitle: "Gói (CTV, NPP, TV)",
    packagesPendingLabel: "Đang chờ",
    packagesPendingWaitAdmin: "Chờ admin xác nhận.",
    packagesLoading: "Đang tải...",
    packagesNoneAvailable: "Chưa có gói nào.",
    packagesBuy: "Mua",
    kycTitle: "Xác minh danh tính",
    kycDesc: "Xác minh danh tính của bạn",
    kycStatusUnverified: "Chưa xác minh",
    kycStatusPending: "Đang chờ xác minh",
    kycStatusPendingDesc: "Tài liệu của bạn đã được gửi và đang chờ xét duyệt. Vui lòng chờ quản trị viên xác minh.",
    kycStatusApproved: "Đã xác minh danh tính",
    kycStatusApprovedDesc: "Chúc mừng! Danh tính của bạn đã được xác minh thành công.",
    kycStatusRejected: "Xác minh bị từ chối",
    kycStatusRejectedDesc: "Yêu cầu trước đó của bạn đã bị từ chối.",
    kycAdminNote: "Ghi chú của Admin:",
    kycPleaseResubmit: "Vui lòng gửi lại tài liệu của bạn.",
    kycDocumentType: "Loại giấy tờ",
    kycIdCard: "Căn cước công dân (CMND)",
    kycPassport: "Hộ chiếu",
    kycDriversLicense: "Giấy phép lái xe",
    kycDocumentNumber: "Số giấy tờ",
    kycDocumentNumberPlaceholder: "VD: 0123456789",
    kycFrontImage: "Ảnh mặt trước",
    kycUploadFrontSide: "Tải lên mặt trước",
    kycBackImage: "Ảnh mặt sau",
    kycUploadBackSide: "Tải lên mặt sau",
    kycSubmitRequest: "Gửi yêu cầu KYC",
    kycSubmitting: "Đang gửi...",
    kycPleaseEnterDocNumber: "Vui lòng nhập số giấy tờ",
    kycPleaseUploadBothImages: "Vui lòng tải lên cả ảnh mặt trước và mặt sau",
    kycSubmittedSuccess: "Gửi KYC thành công",
    kycImageTooLarge: "Ảnh quá lớn (tối đa 5MB)",
    kycUploadFailed: "Tải ảnh thất bại",
    kycSubmissionFailed: "Gửi yêu cầu thất bại",
    kycBankingInfo: "Thông tin ngân hàng",
    kycBankName: "Tên ngân hàng",
    kycBankAccountNumber: "Số tài khoản",
    kycBankAccountHolder: "Chủ tài khoản",
    kycBankBranch: "Chi nhánh"
  },
  en: {
    appName: "Shopii",
    login: "Login",
    reload: "Reload",
    nextToLogin: "Go to Home",
    connectWallet: "Connect Wallet",
    walletAddress: "Wallet Address",
    homeTitle: "Shopii",
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
    affiliateAccumulatedPurchases: "Accumulated",
    affiliateBonusCommission: "Bonus Commission",
    affiliateReferralCodeTitle: "Your Referral Code",
    affiliateReferralCodeLabel: "Referral Code (Username)",
    affiliateCopy: "Copy",
    affiliateCopied: "Copied!",
    affiliateBranchLinksTitle: "Team Referral Links",
    affiliateLeftBranch: "Team 1 Link",
    affiliateRightBranch: "Team 2 Link",
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
    affiliatePayoutReady: "Payout Ready!",
    affiliatePendingPayout: "Pending Payout",
    affiliatePayoutReadyMessage: "You have accumulated {{amount}} in commissions. Your payout will be processed automatically.",
    affiliatePayoutPendingMessage: "Accumulate {{remaining}} more to reach the {{threshold}} payout threshold.",
    affiliateLeftBranchLabel: "Team 1",
    affiliateRightBranchLabel: "Team 2",
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
    soldOut: "Sold Out",
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
    confirmDeleteAddressMessage: "Are you sure you want to delete this address? This action cannot be undone.",
    delete: "Delete",
    deleting: "Deleting...",
    cancel: "Cancel",
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
    pleaseDoNotCloseBrowser: "Please do not close the browser",
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
    update: "Update",
    popularGoods: "Popular Goods",
    countries: "Countries",
    myNetwork: "My Network",
    earn5Back: "Earn 5% Back",
    binarySystem: "Binary System",
    sale: "SALE",
    binaryXP: "Binary XP",
    productNotFound: "Product not found",
    stockRemaining: "{count} items remaining",
    itemsInCart: "{count} items in cart",
    quantity: "Quantity:",
    productDescription: "Product Description",
    addedToCart: "Added {quantity} items to cart!",
    addToCart: "Add",
    buyNow: "Buy Now",
    cartTitle: "Cart",
    clearAll: "Clear All",
    cashback2Percent: "2% Cashback + 0.5 Token",
    affiliateLevel: "Affiliate Level:",
    details: "Details",
    unit: "Unit: 1kg",
    enterPromoCode: "Enter promo code",
    apply: "Apply",
    subtotal: "Subtotal",
    totalPayment: "Total Payment",
    proceedToPayment: "Proceed to Payment",
    securePayment: "Secure payment via Shopii wallet",
    shippingInfo: "Shipping Information",
    connected: "Connected",
    connect: "Connect",
    paymentAsset: "Payment Asset",
    paymentDetails: "Payment Details",
    productPrice: "Product Price",
    confirmPurchase: "Confirm Purchase",
    processingPayment: "Processing...",
    orderHistory: "Order History",
    allOrders: "All",
    processingOrders: "Processing",
    deliveredOrders: "Delivered",
    cancelledOrders: "Cancelled",
    orderDetails: "Order Details",
    orderStatus: "Status",
    lastUpdated: "Last Updated:",
    orderPlaced: "Placed",
    orderConfirmed: "Confirmed",
    orderShipping: "Shipping",
    binaryCommission: "Binary Commission",
    productList: "Product List",
    shippingPaymentInfo: "Shipping & Payment Info",
    deliveryAddress: "Delivery Address",
    paymentMethodSafePal: "Payment Method",
    orderCode: "Order Code",
    shippingFee: "Shipping Fee",
    support: "Support",
    rebuyOrder: "Rebuy This Order",
    editProfile: "Edit Profile",
    shippingAddress: "Shipping Address",
    orderHistoryNav: "Order History",
    security: "Security",
    security2FA: "2FA, Wallet Access",
    logout: "Logout",
    changeAvatar: "Change Avatar",
    displayName: "Display Name",
    enterYourName: "Enter your name",
    email: "Email",
    phoneNumber: "Phone Number",
    enterPhone: "09xx xxx xxx",
    safePalWalletLinked: "Shopii Wallet Linked",
    saving: "Saving...",
    profileUpdated: "Profile updated successfully!",
    updateFailed: "Update failed. Please try again.",
    addNewAddressTitle: "Add New Address",
    fullName: "Full Name",
    enterFullName: "Enter recipient name",
    enterPhoneNumber: "Enter phone number",
    detailAddress: "Detail Address",
    setAsDefaultAddress: "Set as default address",
    savingAddress: "Saving...",
    saveAddressButton: "Save Address",
    pleaseFillAllFields: "Please fill in all fields.",
    errorOccurred: "An error occurred",
    totalEarnings: "Total Earnings",
    thisWeek: "this week",
    pendingRewards: "Pending Rewards",
    claim: "Claim",
    networkStructure: "Network Structure",
    viewFullTree: "View Full Tree",
    leftBranchLink: "Team 1 Link",
    rightBranchLink: "Team 2 Link",
    shareOnSocial: "Share on Social Media",
    recentActivity: "Recent Activity",
    directCommission: "Direct Commission",
    groupCommission: "Group Commission",
    managementCommission: "Management Commission",
    milestoneReward: "Milestone Reward",
    commissionReceived: "Commission Received",
    fromDirectReferral: "From Direct Referral",
    fromBinaryNetwork: "From Binary Network",
    fromTeamPerformance: "From Team Performance",
    justNow: "Just now",
    minutesAgo: "minutes ago",
    hoursAgo: "hours ago",
    daysAgo: "days ago",
    noRecentActivity: "No recent activity",
    totalNetWorth: "Total Net Worth",
    connectedToSafePal: "Connected to Shopii",
    shopping: "Shopping",
    affiliate: "Affiliate",
    assets: "Assets",
    recentActivityTitle: "Recent Activity",
    seeAll: "See All",
    orderPurchase: "Order Purchase",
    noRecentTransactions: "No recent transactions",
    accountInfo: "Account Information",
    viewEditAccountInfo: "View and edit account information",
    redirecting: "Redirecting...",
    registerAccount: "Register Account",
    completeInfoToCreateAccount: "Complete information to create account",
    checkingRegistration: "Checking registration...",
    alreadyRegistered: "Account Already Registered",
    alreadyRegisteredMessage: "Your wallet has already been registered in the system. You will be redirected to the login page.",
    redirectingToLogin: "Redirecting to login page in",
    seconds: "seconds",
    goToLoginNow: "Go to Login Now",
    walletInfoAutoFill: "Wallet Info (Auto-filled)",
    walletAddressLabel: "Wallet Address:",
    chainIdLabel: "Chain ID:",
    walletInfoCannotChange: "This information is retrieved from your wallet and cannot be changed",
    username: "Username",
    enterUsername: "Enter username",
    country: "Country",
    selectCountry: "Select country",
    address: "Address",
    enterAddress: "Enter address",
    referralCodeOptional: "Referral Code (Optional)",
    referralCode: "Referral Code",
    enterReferralCode: "Enter referral code",
    registering: "Registering...",
    register: "Register",
    activityHistory: "Recent Activity",
    system: "System",
    today: "Today",
    yesterday: "Yesterday",
    successfulTransaction: "Successful Transaction",
    orderNumber: "Order",
    added: "Added",
    fromMember: "From member",
    walletConnect: "Connect Shopii Wallet",
    verified: "Verified",
    profileUpdate: "Profile Update",
    passwordChanged: "Changed level 2 password",
    referralReward: "Referral Reward (Direct)",
    newMember: "New member",
    filter: "Filter",
    notConnected: "Not Connected",
    groceryCoin: "Grocery Coin",
    tether: "Tether",
    pending: "Pending",
    gold: "Gold",
    silver: "Silver",
    bronze: "Bronze",
    platinum: "Platinum",
    rank: "Rank",
    balance: "Balance",
    you: "You",
    partners: "Partners",
    vol: "Vol",
    nextRank: "Next Rank",
    complete: "Complete",
    activeUsers: "Active Users",
    newToday: "New today",
    referralTools: "Referral Tools",
    imageTooLarge: "Image too large (Max 5MB)",
    commission: "Commission",
    organic: "Organic",
    bestSeller: "Best Seller",
    lowStock: "Low stock: {count} bags",
    soldPercentage: "Sold {percentage}%",
    highCommission: "High Commission",
    highCommissionDesc: "Earn up to {percentage}% per order",
    fastDelivery: "Fast 2h Delivery",
    fastDeliveryDesc: "Free shipping from ${amount}",
    freeShippingFrom: "Free shipping from ${amount}",
    linkSafePal: "Link Shopii",
    cashback5Percent: "5% Cashback + Free gas fee for life",
    freeGasFeeLifetime: "Free gas fee for life",
    viewDetails: "View Details",
    collapse: "Collapse",
    viewOnChain: "View on Chain",
    reviews: "Reviews",
    viewAllReviews: "View all ({count})",
    relatedProducts: "Related Products",
    share: "Share",
    tokenReward: "{amount} TKN",
    pleaseLogin: "Please login",
    failedToLoadAddresses: "Failed to load addresses",
    failedToDeleteAddress: "Failed to delete address",
    failedToSaveAddress: "Failed to save address",
    goToProfile: "Go to Profile",
    avatarUploaded: "Avatar uploaded successfully",
    avatarUploadFailed: "Failed to upload avatar",
    uploading: "Uploading...",
    searchMemberId: "Search member ID...",
    search: "Search",
    members: "Members",
    memberId: "ID:",
    addMember: "Add",
    blocked: "Blocked",
    reconsumptionRequired: "Reconsumption required",
    maxCommission: "Maximum Commission",
    totalCommissionCanReceive: "Total Commission Can Receive",
    received: "Received",
    maximum: "Maximum",
    scanToRegister: "Scan to register",
    loginTitle: "The Future of",
    loginSubtitle: "Global Smart Consumption Wallet",
    loginDescription: "Shop for groceries and increase your income through a decentralized network.",
    connectSafePalWallet: "Connect Shopii Wallet",
    whatIsSafePal: "What is Shopii?",
    securedByWeb3: "Secured by Web3 Technology",
    walletNotFound: "Wallet not found. Please install Shopii Wallet.",
    cannotConnectWallet: "Cannot connect wallet",
    favorite: "Favorite",
    sold: "Sold",
    commissionRateLabel: "Commission rate",
    productDetails: "Product Details",
    category: "Category",
    brand: "Brand",
    origin: "Origin",
    clothingType: "Clothing Type",
    viewMore: "View More",
    chatNow: "Chat Now",
    addToCartButton: "Add to Cart",
    buyNowButton: "Buy Now",
    usernameHelper: "Only letters and numbers allowed. Length: 3-20 characters",
    usernameInvalid: "Username can only contain letters and numbers (no spaces or special characters)",
    usernameInvalidNoSpecial: "Username can only contain letters and numbers (no spaces or special characters)",
    usernameTooShort: "Username must be at least 3 characters",
    usernameTooLong: "Username cannot exceed 20 characters",
    verifying: "Verifying...",
    verifyEmailSuccess: "Email verified successfully",
    verifyEmailFailed: "Email verification failed",
    verifyEmailMissingToken: "Missing verification link.",
    backToAccount: "Back to account",
    sendVerificationEmail: "Send verification email",
    emailVerification: "Email verification",
    emailVerified: "Email verified",
    emailNotVerified: "Email not verified. Click the button below to receive a 6-digit code.",
    enterVerificationCode: "Enter the 6-digit code sent to your email:",
    verifyCode: "Verify",
    resendCode: "Resend code",
    identityVerification: "Identity verification",
    identityVerificationDesc: "Verify your identity via KYC to access all features.",
    goToKyc: "Go to verification",
    enter6DigitCode: "Please enter 6 digits.",
    selectSide: "Select Team",
    reconsumptionRequiredDesc: "You have reached the maximum commission threshold. Please purchase more packages to continue receiving rewards.",
    maxCommissionReached: "Maximum Commission Reached",
    whyLocked: "Why is it locked?",
    reconsumptionExplanation: "To ensure system sustainability, you need to reconsume (buy products) to unlock new commissions.",
    buyPackageNow: "Buy Package Now",
    packagesSectionTitle: "Packages (CTV, NPP, TV)",
    packagesPendingLabel: "Pending",
    packagesPendingWaitAdmin: "Wait for admin confirmation.",
    packagesLoading: "Loading...",
    packagesNoneAvailable: "No packages available.",
    packagesBuy: "Buy",
    kycTitle: "Identity Verification",
    kycDesc: "Verify your identity",
    kycStatusUnverified: "Unverified",
    kycStatusPending: "Verification Pending",
    kycStatusPendingDesc: "Your documents have been submitted and are currently under review. Please wait for an admin to verify them.",
    kycStatusApproved: "Identity Verified",
    kycStatusApprovedDesc: "Congratulations! Your identity has been successfully verified.",
    kycStatusRejected: "Verification Rejected",
    kycStatusRejectedDesc: "Your previous submission was rejected.",
    kycAdminNote: "Admin Note:",
    kycPleaseResubmit: "Please submit your documents again.",
    kycDocumentType: "Document Type",
    kycIdCard: "ID Card (Citizen Identity Card)",
    kycPassport: "Passport",
    kycDriversLicense: "Driver's License",
    kycDocumentNumber: "Document Number",
    kycDocumentNumberPlaceholder: "e.g. 0123456789",
    kycFrontImage: "Front Image",
    kycUploadFrontSide: "Upload Front Side",
    kycBackImage: "Back Image",
    kycUploadBackSide: "Upload Back Side",
    kycSubmitRequest: "Submit KYC Request",
    kycSubmitting: "Submitting...",
    kycPleaseEnterDocNumber: "Please enter document number",
    kycPleaseUploadBothImages: "Please upload both front and back images",
    kycSubmittedSuccess: "KYC Submitted successfully",
    kycImageTooLarge: "Image too large (max 5MB)",
    kycUploadFailed: "Failed to upload image",
    kycSubmissionFailed: "Submission failed",
    kycBankingInfo: "Banking information",
    kycBankName: "Bank name",
    kycBankAccountNumber: "Account number",
    kycBankAccountHolder: "Account holder name",
    kycBankBranch: "Branch"
  },
  ko: {
    appName: "Shopii",
    login: "로그인",
    reload: "새로고침",
    nextToLogin: "홈으로",
    connectWallet: "지갑 연결",
    walletAddress: "지갑 주소",
    homeTitle: "Shopii",
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
    affiliateBranchLinksTitle: "팀 추천 링크",
    affiliateLeftBranch: "팀 1 링크",
    affiliateRightBranch: "팀 2 링크",
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
    affiliatePayoutReady: "지급 준비 완료!",
    affiliatePendingPayout: "지급 대기 중",
    affiliatePayoutReadyMessage: "{{amount}} 커미션을 적립했습니다. 자동으로 지급 처리됩니다.",
    affiliatePayoutPendingMessage: "{{remaining}} 더 적립하면 {{threshold}} 지급 기준에 도달합니다.",
    affiliateLeftBranchLabel: "팀 1",
    affiliateRightBranchLabel: "팀 2",
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
    soldOut: "품절",
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
    confirmDeleteAddressMessage: "이 주소를 삭제하시겠습니까? 이 작업은 취소할 수 없습니다.",
    delete: "삭제",
    deleting: "삭제 중...",
    cancel: "취소",
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
    pleaseDoNotCloseBrowser: "브라우저를 닫지 마세요",
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
    update: "업데이트",
    popularGoods: "인기 상품",
    countries: "국가",
    myNetwork: "내 네트워크",
    earn5Back: "5% 환급",
    binarySystem: "바이너리 시스템",
    sale: "세일",
    binaryXP: "바이너리 XP",
    productNotFound: "상품을 찾을 수 없습니다",
    stockRemaining: "{count}개 남음",
    itemsInCart: "장바구니에 {count}개 있음",
    quantity: "수량:",
    productDescription: "상품 설명",
    addedToCart: "장바구니에 {quantity}개 추가되었습니다!",
    addToCart: "장바구니에 추가",
    buyNow: "지금 구매",
    cartTitle: "장바구니",
    clearAll: "전체 삭제",
    cashback2Percent: "2% 캐시백 + 0.5 토큰",
    affiliateLevel: "제휴 레벨:",
    details: "세부정보",
    unit: "단위: 1kg",
    enterPromoCode: "프로모션 코드 입력",
    apply: "적용",
    subtotal: "소계",
    totalPayment: "총 결제금액",
    proceedToPayment: "결제 진행",
    securePayment: "Shopii 지갑을 통한 안전한 결제",
    shippingInfo: "배송 정보",
    connected: "연결됨",
    connect: "연결",
    paymentAsset: "결제 자산",
    paymentDetails: "결제 세부정보",
    productPrice: "상품 가격",
    confirmPurchase: "구매 확인",
    processingPayment: "처리 중...",
    orderHistory: "주문 내역",
    allOrders: "전체",
    processingOrders: "처리 중",
    deliveredOrders: "배송 완료",
    cancelledOrders: "취소됨",
    orderDetails: "주문 세부정보",
    orderStatus: "상태",
    lastUpdated: "마지막 업데이트:",
    orderPlaced: "주문됨",
    orderConfirmed: "확인됨",
    orderShipping: "배송 중",
    binaryCommission: "바이너리 커미션",
    productList: "상품 목록",
    shippingPaymentInfo: "배송 및 결제 정보",
    deliveryAddress: "배송 주소",
    paymentMethodSafePal: "결제 방법",
    orderCode: "주문 코드",
    shippingFee: "배송비",
    support: "지원",
    rebuyOrder: "이 주문 다시 구매",
    editProfile: "프로필 수정",
    shippingAddress: "배송 주소",
    orderHistoryNav: "주문 내역",
    security: "보안",
    security2FA: "2FA, 지갑 접근",
    logout: "로그아웃",
    changeAvatar: "아바타 변경",
    displayName: "표시 이름",
    enterYourName: "이름을 입력하세요",
    email: "이메일",
    phoneNumber: "전화번호",
    enterPhone: "09xx xxx xxx",
    safePalWalletLinked: "Shopii 지갑 연결됨",
    saving: "저장 중...",
    profileUpdated: "프로필이 성공적으로 업데이트되었습니다!",
    updateFailed: "업데이트 실패. 다시 시도해주세요.",
    addNewAddressTitle: "새 주소 추가",
    fullName: "성명",
    enterFullName: "수령인 이름 입력",
    enterPhoneNumber: "전화번호 입력",
    detailAddress: "상세 주소",
    setAsDefaultAddress: "기본 주소로 설정",
    savingAddress: "저장 중...",
    saveAddressButton: "주소 저장",
    pleaseFillAllFields: "모든 필드를 입력해주세요.",
    errorOccurred: "오류가 발생했습니다",
    totalEarnings: "총 수익",
    thisWeek: "이번 주",
    pendingRewards: "대기 중인 보상",
    claim: "받기",
    networkStructure: "네트워크 구조",
    viewFullTree: "전체 트리 보기",
    leftBranchLink: "팀 1 링크",
    rightBranchLink: "팀 2 링크",
    shareOnSocial: "소셜 미디어에 공유",
    recentActivity: "최근 활동",
    directCommission: "직접 커미션",
    groupCommission: "그룹 커미션",
    managementCommission: "관리 커미션",
    milestoneReward: "마일스톤 보상",
    commissionReceived: "커미션 수령",
    fromDirectReferral: "직접 추천에서",
    fromBinaryNetwork: "바이너리 네트워크에서",
    fromTeamPerformance: "팀 성과에서",
    justNow: "방금",
    minutesAgo: "분 전",
    hoursAgo: "시간 전",
    daysAgo: "일 전",
    noRecentActivity: "최근 활동 없음",
    totalNetWorth: "총 순자산",
    connectedToSafePal: "Shopii에 연결됨",
    shopping: "쇼핑",
    affiliate: "제휴",
    assets: "자산",
    recentActivityTitle: "최근 활동",
    seeAll: "모두 보기",
    orderPurchase: "주문 구매",
    noRecentTransactions: "최근 거래 없음",
    accountInfo: "계정 정보",
    viewEditAccountInfo: "계정 정보 보기 및 수정",
    redirecting: "리디렉션 중...",
    registerAccount: "계정 등록",
    completeInfoToCreateAccount: "계정 생성을 위해 정보 완성",
    checkingRegistration: "등록 확인 중...",
    alreadyRegistered: "이미 등록된 계정",
    alreadyRegisteredMessage: "귀하의 지갑이 이미 시스템에 등록되어 있습니다. 로그인 페이지로 리디렉션됩니다.",
    redirectingToLogin: "로그인 페이지로 리디렉션 중",
    seconds: "초",
    goToLoginNow: "지금 로그인하기",
    walletInfoAutoFill: "지갑 정보 (자동 입력)",
    walletAddressLabel: "지갑 주소:",
    chainIdLabel: "체인 ID:",
    walletInfoCannotChange: "이 정보는 지갑에서 가져온 것으로 변경할 수 없습니다",
    username: "사용자명",
    enterUsername: "사용자명 입력",
    country: "국가",
    selectCountry: "국가 선택",
    address: "주소",
    enterAddress: "주소 입력",
    referralCodeOptional: "추천 코드 (선택사항)",
    referralCode: "추천 코드",
    enterReferralCode: "추천 코드 입력",
    registering: "등록 중...",
    register: "등록",
    activityHistory: "최근 활동",
    system: "시스템",
    today: "오늘",
    yesterday: "어제",
    successfulTransaction: "성공적인 거래",
    orderNumber: "주문",
    added: "추가됨",
    fromMember: "회원으로부터",
    walletConnect: "Shopii 지갑 연결",
    verified: "인증됨",
    profileUpdate: "프로필 업데이트",
    passwordChanged: "2단계 비밀번호 변경",
    referralReward: "추천 보상 (직접)",
    newMember: "신규 회원",
    filter: "필터",
    notConnected: "연결되지 않음",
    groceryCoin: "Grocery Coin",
    tether: "Tether",
    pending: "대기 중",
    gold: "골드",
    silver: "실버",
    bronze: "브론즈",
    platinum: "플래티넘",
    rank: "등급",
    balance: "잔액",
    you: "당신",
    partners: "파트너",
    vol: "거래량",
    nextRank: "다음 등급",
    complete: "완료",
    activeUsers: "활성 사용자",
    newToday: "오늘 신규",
    referralTools: "추천 도구",
    imageTooLarge: "이미지가 너무 큽니다 (최대 5MB)",
    commission: "수수료",
    organic: "유기농",
    bestSeller: "베스트셀러",
    lowStock: "재고 부족: {count}개",
    soldPercentage: "{percentage}% 판매됨",
    highCommission: "높은 수수료",
    highCommissionDesc: "주문당 최대 {percentage}% 획득",
    fastDelivery: "2시간 빠른 배송",
    fastDeliveryDesc: "${amount}부터 무료 배송",
    freeShippingFrom: "${amount}부터 무료 배송",
    linkSafePal: "Shopii 연결",
    cashback5Percent: "5% 캐시백 + 평생 무료 가스비",
    freeGasFeeLifetime: "평생 무료 가스비",
    viewDetails: "자세히 보기",
    collapse: "접기",
    viewOnChain: "체인에서 보기",
    reviews: "리뷰",
    viewAllReviews: "전체 보기 ({count})",
    relatedProducts: "관련 상품",
    share: "공유",
    tokenReward: "{amount} TKN",
    pleaseLogin: "로그인해주세요",
    failedToLoadAddresses: "주소를 불러올 수 없습니다",
    failedToDeleteAddress: "주소를 삭제할 수 없습니다",
    failedToSaveAddress: "주소를 저장할 수 없습니다",
    goToProfile: "프로필로 이동",
    avatarUploaded: "아바타 업로드 성공",
    avatarUploadFailed: "아바타 업로드 실패",
    uploading: "업로드 중...",
    searchMemberId: "회원 ID 검색...",
    search: "검색",
    members: "회원",
    memberId: "ID:",
    addMember: "추가",
    blocked: "차단됨",
    reconsumptionRequired: "재소비 필요",
    maxCommission: "최대 커미션",
    totalCommissionCanReceive: "받을 수 있는 총 커미션",
    received: "받음",
    maximum: "최대",
    scanToRegister: "스캔하여 등록",
    loginTitle: "의 미래",
    loginSubtitle: "전세계 스마트 소비 지갑",
    loginDescription: "식료품을 쇼핑하고 분산 네트워크를 통해 수입을 늘리세요.",
    connectSafePalWallet: "Shopii 지갑 연결",
    whatIsSafePal: "SafePal이란?",
    securedByWeb3: "Web3 기술로 보호됨",
    walletNotFound: "지갑을 찾을 수 없습니다. Shopii 지갑을 설치해주세요.",
    cannotConnectWallet: "지갑을 연결할 수 없습니다",
    favorite: "즐겨찾기",
    sold: "판매됨",
    commissionRateLabel: "커미션 비율",
    productDetails: "제품 세부정보",
    category: "카테고리",
    brand: "브랜드",
    origin: "원산지",
    clothingType: "의류 종류",
    viewMore: "더 보기",
    chatNow: "지금 채팅",
    addToCartButton: "장바구니에 추가",
    buyNowButton: "지금 구매",
    usernameHelper: "문자 및 숫자만 사용 가능. 길이: 3-20자",
    usernameInvalid: "사용자명은 문자와 숫자만 포함할 수 있습니다 (공백이나 특수문자 불가)",
    usernameInvalidNoSpecial: "사용자명은 문자와 숫자만 포함할 수 있습니다 (공백이나 특수문자 불가)",
    usernameTooShort: "사용자명은 최소 3자 이상이어야 합니다",
    usernameTooLong: "사용자명은 20자를 초과할 수 없습니다",
    verifying: "확인 중...",
    verifyEmailSuccess: "이메일 인증 성공",
    verifyEmailFailed: "이메일 인증 실패",
    verifyEmailMissingToken: "인증 링크가 없습니다.",
    backToAccount: "계정으로 돌아가기",
    sendVerificationEmail: "인증 이메일 보내기",
    emailVerification: "이메일 인증",
    emailVerified: "이메일 인증됨",
    emailNotVerified: "이메일이 인증되지 않았습니다. 아래 버튼을 눌러 6자리 코드를 받으세요.",
    enterVerificationCode: "이메일로 받은 6자리 코드를 입력하세요:",
    verifyCode: "인증",
    resendCode: "코드 다시 받기",
    identityVerification: "신원 확인",
    identityVerificationDesc: "KYC를 통해 신원을 확인하고 모든 기능을 이용하세요.",
    goToKyc: "인증 페이지로",
    enter6DigitCode: "6자리를 입력하세요.",
    selectSide: "팀 선택",
    reconsumptionRequiredDesc: "최대 커미션 기준에 도달했습니다. 보상을 계속 받으려면 패키지를 추가로 구매하십시오.",
    maxCommissionReached: "최대 커미션 도달",
    whyLocked: "왜 잠겼나요?",
    reconsumptionExplanation: "시스템 지속 가능성을 보장하기 위해, 새로운 커미션을 잠금 해제하려면 재소비(상품 구매)가 필요합니다.",
    buyPackageNow: "지금 패키지 구매",
    packagesSectionTitle: "패키지 (CTV, NPP, TV)",
    packagesPendingLabel: "대기 중",
    packagesPendingWaitAdmin: "관리자 확인을 기다려 주세요.",
    packagesLoading: "로딩 중...",
    packagesNoneAvailable: "이용 가능한 패키지가 없습니다.",
    packagesBuy: "구매",
    kycTitle: "본인 인증",
    kycDesc: "본인 인증을 완료하세요",
    kycStatusUnverified: "미인증",
    kycStatusPending: "인증 대기 중",
    kycStatusPendingDesc: "서류가 제출되었으며 현재 검토 중입니다. 관리자가 확인할 때까지 기다려 주세요.",
    kycStatusApproved: "인증 완료",
    kycStatusApprovedDesc: "축하합니다! 신원 확인이 성공적으로 완료되었습니다.",
    kycStatusRejected: "인증 거절됨",
    kycStatusRejectedDesc: "이전 인증 요청이 거절되었습니다.",
    kycAdminNote: "관리자 메모:",
    kycPleaseResubmit: "서류를 다시 제출해 주세요.",
    kycDocumentType: "신분증 종류",
    kycIdCard: "주민등록증",
    kycPassport: "여권",
    kycDriversLicense: "운전면허증",
    kycDocumentNumber: "신분증 번호",
    kycDocumentNumberPlaceholder: "예: 0123456789",
    kycFrontImage: "앞면 사진",
    kycUploadFrontSide: "앞면 업로드",
    kycBackImage: "뒷면 사진",
    kycUploadBackSide: "뒷면 업로드",
    kycSubmitRequest: "KYC 요청 제출",
    kycSubmitting: "제출 중...",
    kycPleaseEnterDocNumber: "신분증 번호를 입력하세요",
    kycPleaseUploadBothImages: "앞면과 뒷면 사진을 모두 업로드하세요",
    kycSubmittedSuccess: "KYC 요청이 성공적으로 제출되었습니다",
    kycImageTooLarge: "이미지가 너무 큽니다 (최대 5MB)",
    kycUploadFailed: "이미지 업로드에 실패했습니다",
    kycSubmissionFailed: "제출에 실패했습니다",
    kycBankingInfo: "계좌 정보",
    kycBankName: "은행명",
    kycBankAccountNumber: "계좌번호",
    kycBankAccountHolder: "예금주",
    kycBankBranch: "지점"
  },
};
