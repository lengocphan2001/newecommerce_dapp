import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Work_Sans } from "next/font/google";
import "./globals.css";
import { I18nProvider } from "@/app/i18n/I18nProvider";
import { ShoppingCartProvider } from "@/app/contexts/ShoppingCartContext";

// display: swap để không chặn render trên trình duyệt ví (SafePal, Binance)
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

const workSans = Work_Sans({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Shopii - Kết Nối Ví Tiêu Dùng Thông Minh Toàn Cầu",
  description:
    "Mua sắm nhu yếu phẩm và gia tăng thu nhập thông qua mạng lưới phi tập trung. Kết nối ví Shopii để bắt đầu mua sắm ngay hôm nay.",
  keywords: [
    "Shopii",
    "Shopii DApp",
    "Kết Nối Ví Tiêu Dùng Thông Minh Toàn Cầu",
    "Shopii",
    "Web3",
    "Blockchain",
    "Decentralized",
  ],
  authors: [{ name: "Shopii" }],
  creator: "Shopii",
  publisher: "Shopii",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "https://Shopii"
  ),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Shopii - Kết Nối Ví Tiêu Dùng Thông Minh Toàn Cầu",
    description:
      "Mua sắm nhu yếu phẩm và gia tăng thu nhập thông qua mạng lưới phi tập trung. Kết nối ví Shopii để bắt đầu mua sắm ngay hôm nay.",
    url: "/",
    siteName: "Shopii",
    images: [
      {
        url: "/images/14446125.png",
        width: 1200,
        height: 630,
        alt: "Shopii",
      },
    ],
    locale: "vi_VN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Shopii - Kết Nối Ví Tiêu Dùng Thông Minh Toàn Cầu",
    description:
      "Mua sắm nhu yếu phẩm và gia tăng thu nhập thông qua mạng lưới phi tập trung",
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
    apple: [
      { url: "/images/14446125.png", sizes: "180x180" },
      { url: "/images/14446125.png" },
    ],
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Shopii",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#F0B90B",
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
