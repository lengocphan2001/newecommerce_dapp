import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Work_Sans } from "next/font/google";
import "./globals.css";
import { I18nProvider } from "@/app/i18n/I18nProvider";
import { ShoppingCartProvider } from "@/app/contexts/ShoppingCartContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const workSans = Work_Sans({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "BinanMall",
  description: "Mua sắm nhu yếu phẩm và gia tăng thu nhập thông qua mạng lưới phi tập trung. Kết nối ví BinanMall để bắt đầu mua sắm ngay hôm nay.",
  keywords: ["BinanMall", "BinanMall DApp", "Kết Nối Ví Tiêu Dùng Thông Minh Toàn Cầu", "BinanMall", "Web3", "Blockchain", "Decentralized"],
  authors: [{ name: "BinanMall" }],
  creator: "BinanMall",
  publisher: "BinanMall",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://binanmall.com"), // Assuming URL change for consistency in metadata even if route is same
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "BinanMall",
    description: "Mua sắm nhu yếu phẩm và gia tăng thu nhập thông qua mạng lưới phi tập trung. Kết nối ví BinanMall để bắt đầu mua sắm ngay hôm nay.",
    url: "/",
    siteName: "BinanMall",
    images: [
      {
        url: "/images/14446125.png",
        width: 1200,
        height: 630,
        alt: "BinanMall",
      },
    ],
    locale: "vi_VN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "BinanMall",
    description: "Mua sắm nhu yếu phẩm và gia tăng thu nhập thông qua mạng lưới phi tập trung",
    images: ["/images/14446125.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: [
      { url: "/images/14446125.png", type: "image/png" },
      { url: "/icon.png", type: "image/png" },
    ],
    shortcut: "/images/14446125.png",
    apple: "/images/14446125.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
        {/* Explicit Open Graph Meta Tags */}
        <meta property="og:title" content="BinanMall - Kết Nối Ví Tiêu Dùng Thông Minh Toàn Cầu" />
        <meta property="og:description" content="Mua sắm nhu yếu phẩm và gia tăng thu nhập thông qua mạng lưới phi tập trung. Kết nối ví BinanMall để bắt đầu mua sắm ngay hôm nay." />
        <meta property="og:image" content={`${process.env.NEXT_PUBLIC_SITE_URL || "https://binanmall.com"}/images/14446125.png`} />
        <meta property="og:url" content={`${process.env.NEXT_PUBLIC_SITE_URL || "https://binanmall.com"}/`} />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="BinanMall" />
        <meta property="og:locale" content="vi_VN" />
        {/* Twitter Card Meta Tags */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="BinanMall - Kết Nối Ví Tiêu Dùng Thông Minh Toàn Cầu" />
        <meta name="twitter:description" content="Mua sắm nhu yếu phẩm và gia tăng thu nhập thông qua mạng lưới phi tập trung" />
        <meta name="twitter:image" content={`${process.env.NEXT_PUBLIC_SITE_URL || "https://binanmall.com"}/images/14446125.png`} />
        {/* Favicon and App Icons - Must be first to override defaults */}
        <link rel="icon" href="/images/14446125.png" type="image/png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/images/14446125.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/images/14446125.png" />
        <link rel="icon" href="/images/14446125.png" type="image/png" sizes="any" />
        <link rel="shortcut icon" href="/images/14446125.png" type="image/png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/images/14446125.png" />
        <link rel="apple-touch-icon" href="/images/14446125.png" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#F0B90B" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="BinanMall" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${workSans.variable} antialiased font-display`}
      >
        <I18nProvider>
          <ShoppingCartProvider>{children}</ShoppingCartProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
