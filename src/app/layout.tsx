import type { Metadata } from "next";
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
  title: "VinMall",
  description: "Mua sắm nhu yếu phẩm và gia tăng thu nhập thông qua mạng lưới phi tập trung. Kết nối ví SafePal để bắt đầu mua sắm ngay hôm nay.",
  keywords: ["VinMall", "Vinmall DApp", "Kết Nối Ví Tiêu Dùng Thông Minh Toàn Cầu", "SafePal", "Web3", "Blockchain", "Decentralized"],
  authors: [{ name: "VinMall" }],
  creator: "VinMall",
  publisher: "VinMall",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://vinmall.org"),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "VinMall",
    description: "Mua sắm nhu yếu phẩm và gia tăng thu nhập thông qua mạng lưới phi tập trung. Kết nối ví SafePal để bắt đầu mua sắm ngay hôm nay.",
    url: "/",
    siteName: "VinMall",
    images: [
      {
        url: "/images/shopping-trolley.png",
        width: 1200,
        height: 630,
        alt: "VinMall",
      },
    ],
    locale: "vi_VN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "VinMall",
    description: "Mua sắm nhu yếu phẩm và gia tăng thu nhập thông qua mạng lưới phi tập trung",
    images: ["/images/shopping-trolley.png"],
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
      { url: "/images/shopping-trolley.png", type: "image/png" },
      { url: "/icon.png", type: "image/png" },
    ],
    shortcut: "/images/shopping-trolley.png",
    apple: "/images/shopping-trolley.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
        {/* Explicit Open Graph Meta Tags */}
        <meta property="og:title" content="VinMall - Kết Nối Ví Tiêu Dùng Thông Minh Toàn Cầu" />
        <meta property="og:description" content="Mua sắm nhu yếu phẩm và gia tăng thu nhập thông qua mạng lưới phi tập trung. Kết nối ví SafePal để bắt đầu mua sắm ngay hôm nay." />
        <meta property="og:image" content={`${process.env.NEXT_PUBLIC_SITE_URL || "https://vinmall.org"}/images/shopping-trolley.png`} />
        <meta property="og:url" content={`${process.env.NEXT_PUBLIC_SITE_URL || "https://vinmall.org"}/`} />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="VinMall" />
        <meta property="og:locale" content="vi_VN" />
        {/* Twitter Card Meta Tags */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="VinMall - Kết Nối Ví Tiêu Dùng Thông Minh Toàn Cầu" />
        <meta name="twitter:description" content="Mua sắm nhu yếu phẩm và gia tăng thu nhập thông qua mạng lưới phi tập trung" />
        <meta name="twitter:image" content={`${process.env.NEXT_PUBLIC_SITE_URL || "https://vinmall.org"}/images/shopping-trolley.png`} />
        {/* Favicon and App Icons - Must be first to override defaults */}
        <link rel="icon" type="image/png" sizes="32x32" href="/images/shopping-trolley.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/images/shopping-trolley.png" />
        <link rel="icon" href="/images/shopping-trolley.png" type="image/png" sizes="any" />
        <link rel="shortcut icon" href="/images/shopping-trolley.png" type="image/png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/images/shopping-trolley.png" />
        <link rel="apple-touch-icon" href="/images/shopping-trolley.png" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#13ec5b" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="VinMall" />
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
