"use client";

import { usePathname } from "next/navigation";
import KateChatButton from "./KateChatButton";

const HIDE_ON = ["/login", "/onboarding", "/start", "/auth"];

export default function KateChatWrapper() {
  const pathname = usePathname();
  if (HIDE_ON.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return null;
  }
  return <KateChatButton />;
}
