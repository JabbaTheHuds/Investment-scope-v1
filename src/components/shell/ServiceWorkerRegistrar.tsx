"use client";
import { useEffect } from "react";

/** Registers the PWA service worker in production only. */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* PWA install is optional; the app works without it */
    });
  }, []);
  return null;
}
