"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Capacitor } from "@capacitor/core";
import { apiFetch } from "../lib/api";

export default function CapacitorInit() {
  const router = useRouter();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let cleanup: (() => void) | undefined;

    async function setup() {
      const { App } = await import("@capacitor/app");

      async function handleUrl(url: string) {
        if (url.startsWith("com.getquarterback.app://plaid")) {
          console.log("[CapacitorInit] handleUrl triggered:", url);

          const queryStart = url.indexOf("?");
          const queryString = queryStart !== -1 ? url.slice(queryStart) : "";
          const httpsRedirectUri = `https://qbh-mvp.vercel.app/plaid/oauth${queryString}`;

          // Get link token from localStorage or native Preferences
          let linkToken = window.localStorage.getItem("qbh_plaid_link_token");
          console.log("[CapacitorInit] localStorage link token:", linkToken ? linkToken.slice(0, 25) : "missing");

          if (!linkToken) {
            try {
              const { Preferences } = await import("@capacitor/preferences");
              const result = await Preferences.get({ key: "qbh_plaid_link_token" });
              console.log("[CapacitorInit] Preferences link token:", result.value ? result.value.slice(0, 25) : "missing");
              if (result.value) {
                linkToken = result.value;
                window.localStorage.setItem("qbh_plaid_link_token", result.value);
                const uid = await Preferences.get({ key: "qbh_user_id" });
                if (uid.value) window.localStorage.setItem("qbh_user_id", uid.value);
              }
            } catch (e) {
              console.error("[CapacitorInit] Preferences error:", e);
            }
          }

          if (!linkToken) {
            console.log("[CapacitorInit] No link token — navigating to /plaid/oauth for error");
            window.localStorage.setItem("qbh_plaid_redirect_uri", httpsRedirectUri);
            router.push("/plaid/oauth");
            return;
          }

          console.log("[CapacitorInit] Resuming Plaid Link directly");
          console.log("[CapacitorInit] token:", linkToken.slice(0, 25));
          console.log("[CapacitorInit] receivedRedirectUri:", httpsRedirectUri);

          // Load Plaid Link JS and resume OAuth directly — bypasses react-plaid-link
          // lifecycle issues (token:null initial render, handler.destroy on unmount)
          const script = document.createElement("script");
          script.src = "https://cdn.plaid.com/link/v2/stable/link-initialize.js";
          script.onload = () => {
            console.log("[CapacitorInit] Plaid Link JS loaded, calling create()");
            const handler = (window as any).Plaid.create({
              token: linkToken,
              receivedRedirectUri: httpsRedirectUri,
              onSuccess: async (publicToken: string) => {
                console.log("[CapacitorInit] Plaid onSuccess");
                try {
                  const effectiveUserId =
                    window.localStorage.getItem("qbh_user_id") ||
                    window.sessionStorage.getItem("qbh_user_id") || "";

                  if (!effectiveUserId) throw new Error("Missing user_id");

                  // Exchange token immediately
                  const exchangeRes = await apiFetch("/api/plaid/exchange-token", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ app_user_id: effectiveUserId, public_token: publicToken }),
                  });
                  const exchangeData = await exchangeRes.json();
                  if (!exchangeRes.ok || !exchangeData?.ok) {
                    throw new Error(exchangeData?.error || "Failed to exchange token.");
                  }

                  // Signal onboarding that Plaid is connected
                  window.localStorage.setItem("qbh_plaid_connected", "1");
                  window.localStorage.removeItem("qbh_plaid_redirect_uri");
                  window.localStorage.removeItem("qbh_plaid_link_token");
                  console.log("[CapacitorInit] Token exchanged — navigating to onboarding");
                  router.push("/onboarding");
                } catch (err) {
                  console.error("[CapacitorInit] Post-success error:", err);
                }
              },
              onExit: (err: any, metadata: any) => {
                if (err) {
                  console.log("[CapacitorInit] Plaid onExit error:", JSON.stringify({
                    error_code: err.error_code,
                    error_message: err.error_message,
                    error_type: err.error_type,
                    request_id: err.request_id,
                    status: metadata?.status,
                    link_session_id: metadata?.link_session_id,
                  }));
                  // Navigate back to onboarding — Plaid failed but user can retry
                  router.push("/onboarding");
                } else {
                  console.log("[CapacitorInit] Plaid onExit (no error):", JSON.stringify(metadata));
                }
              },
            });
            console.log("[CapacitorInit] Calling handler.open()");
            handler.open();
          };
          script.onerror = () => {
            console.error("[CapacitorInit] Failed to load Plaid Link JS");
            router.push("/onboarding");
          };
          document.head.appendChild(script);
        }
      }

      const launchUrl = await App.getLaunchUrl();
      if (launchUrl?.url) {
        const qs = launchUrl.url.includes("?") ? launchUrl.url.split("?")[1] : "";
        const stateId = new URLSearchParams(qs).get("oauth_state_id");
        const handledKey = stateId ? `qbh_oauth_handled_${stateId}` : null;
        const alreadyHandled = handledKey && window.sessionStorage.getItem(handledKey);
        if (!alreadyHandled) {
          if (handledKey) window.sessionStorage.setItem(handledKey, "1");
          await handleUrl(launchUrl.url);
        } else {
          console.log("[CapacitorInit] getLaunchUrl: already handled, skipping");
        }
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
