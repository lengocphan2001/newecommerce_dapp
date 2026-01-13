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
  title: "VinMall - Tương lai của Mua sắm Tạp hóa",
  description: "Mua sắm nhu yếu phẩm và gia tăng thu nhập thông qua mạng lưới phi tập trung. Kết nối ví SafePal để bắt đầu mua sắm ngay hôm nay.",
  keywords: ["VinMall", "Grocery DApp", "Mua sắm tạp hóa", "SafePal", "Web3", "Blockchain", "Decentralized"],
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
    title: "VinMall - Tương lai của Mua sắm Tạp hóa",
    description: "Mua sắm nhu yếu phẩm và gia tăng thu nhập thông qua mạng lưới phi tập trung. Kết nối ví SafePal để bắt đầu mua sắm ngay hôm nay.",
    url: "/",
    siteName: "VinMall",
    images: [
      {
        url: "/images/shopping-trolley.png",
        width: 1200,
        height: 630,
        alt: "VinMall - Grocery DApp",
      },
    ],
    locale: "vi_VN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "VinMall - Tương lai của Mua sắm Tạp hóa",
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
    icon: "/images/shopping-trolley.png",
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
        <link rel="icon" href="/images/shopping-trolley.png" type="image/png" />
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
