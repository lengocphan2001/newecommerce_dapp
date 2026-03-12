"use client";

import React, { Suspense, lazy } from "react";

const BinaryTreeView = lazy(() => import("./BinaryTreeView"));

export default function FullTreePage() {
  return (
    <Suspense fallback={<div className="flex min-h-[50vh] items-center justify-center text-slate-500">Đang tải cây...</div>}>
      <BinaryTreeView />
    </Suspense>
  );
}
