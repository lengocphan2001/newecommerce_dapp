"use client";

import { useEffect, useState } from "react";
import { api, UserVisibilityToggles } from "@/app/services/api";

const ALL_VISIBLE: UserVisibilityToggles = {
  userRewardHistoryVisible: true,
  userOrderHistoryVisible: true,
  userF1ListVisible: true,
  userSalesVisible: true,
};

/**
 * Admin toggles for what the user app shows. Returns null while loading, so
 * callers keep hidden sections hidden until the answer arrives. If the config
 * can't be loaded everything shows: the backend still withholds hidden data.
 */
export function useUserVisibility(): UserVisibilityToggles | null {
  const [toggles, setToggles] = useState<UserVisibilityToggles | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .getUserVisibilityToggles()
      .then((t) => !cancelled && setToggles(t))
      .catch(() => !cancelled && setToggles(ALL_VISIBLE));
    return () => {
      cancelled = true;
    };
  }, []);

  return toggles;
}
