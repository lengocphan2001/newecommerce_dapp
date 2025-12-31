import React from "react";
import BottomNav from "../components/BottomNav";

export default function HomeLayout({ children }: { children: React.ReactNode }) {
  // Putting BottomNav here makes it persistent across /home tabs.
  return (
    <div className="flex min-h-screen flex-col bg-zinc-50">
      <div className="flex-1 pb-20">{children}</div>
      <BottomNav />
    </div>
  );
}


