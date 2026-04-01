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

      async function handleUrl(url: string) {
        if (url.startsWith("com.getquarterback.app://plaid")) {
          // Check localStorage first, then native preferences
          let linkToken = window.localStorage.getItem("qbh_plaid_link_token");
          if (!linkToken) {
            try {
              const { Preferences } = await import("@capacitor/preferences");
              const result = await Preferences.get({ key: "qbh_plaid_link_token" });
              if (result.value) {
                linkToken = result.value;
                // Restore to localStorage so plaid/oauth page can read it
                window.localStorage.setItem("qbh_plaid_link_token", result.value);
                const uid = await Preferences.get({ key: "qbh_user_id" });
                if (uid.value) window.localStorage.setItem("qbh_user_id", uid.value);
              }
            } catch {
              // ignore
            }
          }

          if (!linkToken) {
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
        await handleUrl(launchUrl.url);
      }

      const listener = await App.addListener("appUrlOpen", (event) => {
        if (event.url) void handleUrl(event.url);
      });

      cleanup = () => listener.remove();
    }

    setup();
    return () => cleanup?.();
  }, [router]);

  return null;
}
