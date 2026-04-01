"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";

export default function CapacitorInit() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let cleanup: (() => void) | undefined;

    async function setup() {
      const { App } = await import("@capacitor/app");

      const listener = await App.addListener("appUrlOpen", (event) => {
        const url = event.url;
        if (!url) return;

        // Store the full deep link URL so the plaid/oauth page can use it
        // as the receivedRedirectUri to resume the Plaid OAuth flow
        if (url.startsWith("com.getquarterback.app://plaid")) {
          window.localStorage.setItem("qbh_plaid_redirect_uri", url);
          window.location.href = "/plaid/oauth";
        }
      });

      cleanup = () => listener.remove();
    }

    setup();
    return () => cleanup?.();
  }, []);

  return null;
}
