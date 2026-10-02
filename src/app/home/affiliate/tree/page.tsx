"use client";

import React, { Suspense, lazy } from "react";
import TreeSkeleton from "./components/TreeSkeleton";

const BinaryTreeView = lazy(() => import("./BinaryTreeView"));

export default function FullTreePage() {
  return (
    <Suspense fallback={<TreeSkeleton />}>
      <BinaryTreeView />
    </Suspense>
  );
}
