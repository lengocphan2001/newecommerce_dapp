import React from "react";
import BottomNav from "../components/BottomNav";

export default function HomeLayout({ children }: { children: React.ReactNode }) {
  // Putting BottomNav here makes it persistent across /home tabs.
  return (
    <div className="flex min-h-screen flex-col bg-[#f6f8f6] dark:bg-[#102216]">
      <div className="flex-1 pb-20 safe-area-inset-bottom">{children}</div>
      <BottomNav />
      <div className="h-safe-bottom bg-[#f6f8f6] dark:bg-[#102216]"></div>
    </div>
  );
}


