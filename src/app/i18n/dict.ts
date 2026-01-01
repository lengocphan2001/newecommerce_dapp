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
  | "langLabel";

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
  },
};


