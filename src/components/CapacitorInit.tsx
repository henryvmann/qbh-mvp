"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Capacitor } from "@capacitor/core";

export default function CapacitorInit() {
  const router = useRouter();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let cleanup: (() => void) | undefined;

    async function setup() {
      const { App } = await import("@capacitor/app");

      function handleUrl(url: string) {
        if (url.startsWith("com.getquarterback.app://plaid")) {
          const hasLinkToken = !!window.localStorage.getItem("qbh_plaid_link_token");
          if (!hasLinkToken) {
            // Stale deep link from a previous session — ignore it
            return;
          }
          window.localStorage.setItem("qbh_plaid_redirect_uri", url);
          if (!window.location.pathname.includes("/plaid/oauth")) {
            window.location.href = "/plaid/oauth";
          }
        }
      }

      // Check if the app was cold-launched via deep link (event fires before listener registers)
      const launchUrl = await App.getLaunchUrl();
      if (launchUrl?.url) {
        handleUrl(launchUrl.url);
      }

      const listener = await App.addListener("appUrlOpen", (event) => {
        if (event.url) handleUrl(event.url);
      });

      cleanup = () => listener.remove();
    }

    setup();
    return () => cleanup?.();
  }, [router]);

  return null;
}
