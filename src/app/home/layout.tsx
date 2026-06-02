"use client";

import React, { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import BottomNav from "../components/BottomNav";
import AddToCartAnimation from "../components/AddToCartAnimation";
import { useShoppingCart } from "../contexts/ShoppingCartContext";

export default function HomeLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { animation } = useShoppingCart();
  const [hasToken, setHasToken] = useState(false);

  useEffect(() => {
    if (pathname === null) return; // Đợi Next.js router sẵn sàng để tránh lỗi null khi render/hydration

    const token = localStorage.getItem("token");
    setHasToken(!!token);
    
    // Không chuyển hướng khách vãng lai nếu họ đang truy cập các trang công khai (chi tiết sản phẩm, giỏ hàng, thanh toán)
    const isPublicPath = pathname.includes('/home/products/detail') || pathname.includes('/home/cart') || pathname.includes('/home/checkout');
    if (!token && !isPublicPath) {
      router.push("/");
      return;
    }
  }, [router, pathname]);

  // Putting BottomNav here makes it persistent across /home tabs.
  // All pages will have header (from each page) and bottom nav (from layout)
  // Bottom nav height: ~80px (pt-3 pb-5 + safe area)
  return (
    <div className="min-h-screen w-full bg-[#f3f4f6]">
      <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden max-w-md mx-auto shadow-2xl bg-white">
        {/* Content area - each page renders its own header */}
        <div className="flex-1 flex flex-col">
          {children}
        </div>
        {/* Bottom Navigation - chỉ hiển thị cho người dùng đã đăng nhập */}
        {hasToken && <BottomNav />}
      </div>
      {/* Add to Cart Animation */}
      {animation && <AddToCartAnimation animation={animation} />}
    </div>
  );
}


