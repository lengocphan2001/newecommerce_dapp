"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function SafePalPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to home page (which is now the safepal page)
    router.replace("/");
  }, [router]);

  return null;
}
