"use client";

import Link from "next/link";

export default function ProviderLink({
  providerId,
  providerName,
  className,
}: {
  providerId: string;
  providerName: string;
  className?: string;
}) {
  return (
    <Link
      href={`/providers/${providerId}`}
      style={{ color: "#071832" }}
      className={className || "font-medium underline decoration-[#1677FF]/30 underline-offset-2 hover:decoration-[#1677FF] transition"}
    >
      {providerName}
    </Link>
  );
}
