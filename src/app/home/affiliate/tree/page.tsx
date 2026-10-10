"use client";

import React, { Suspense, lazy } from "react";
import TreeSkeleton from "./components/TreeSkeleton";
import HiddenInfoScreen from "@/app/components/HiddenInfoScreen";
import { useI18n } from "@/app/i18n/I18nProvider";
import { useUserVisibility } from "@/app/utils/useUserVisibility";

const BinaryTreeView = lazy(() => import("./BinaryTreeView"));

export default function FullTreePage() {
  const visibility = useUserVisibility();
  const { t } = useI18n();

  if (!visibility) return <TreeSkeleton />;
  if (!visibility.userNetworkStructureVisible) {
    return <HiddenInfoScreen title={t("networkStructure")} />;
  }

  return (
    <Suspense fallback={<TreeSkeleton />}>
      <BinaryTreeView />
    </Suspense>
  );
}
