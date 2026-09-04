"use client";

import React from "react";
import { CARD_H, CARD_W } from "./treeUtils";

/** Khung chờ giữ đúng hình dạng cây để không nhảy layout khi dữ liệu về. */
export default function TreeSkeleton() {
  const box = { width: CARD_W, height: CARD_H };

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="mx-auto animate-pulse rounded-xl bg-slate-200" style={box} />
      <div className="flex justify-center gap-6">
        <div className="animate-pulse rounded-xl bg-slate-200" style={box} />
        <div className="animate-pulse rounded-xl bg-slate-200" style={box} />
      </div>
      <div className="flex justify-center gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse rounded-xl bg-slate-100" style={box} />
        ))}
      </div>
    </div>
  );
}
