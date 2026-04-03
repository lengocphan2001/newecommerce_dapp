"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const registerServiceWorker = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
        });

        // Khi SW mới được install (skipWaiting đã gọi), reload trang để dùng SW mới.
        // Điều này đảm bảo sau deploy, user không dùng cache cũ.
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (!newWorker) return;
          newWorker.addEventListener("statechange", () => {
            if (
              newWorker.state === "activated" &&
              navigator.serviceWorker.controller
            ) {
              // SW mới đã active — reload để dùng assets/data mới nhất
              window.location.reload();
            }
          });
        });
      } catch (error) {
        console.error("Failed to register service worker:", error);
      }
    };

    registerServiceWorker();
  }, []);

  return null;
}
