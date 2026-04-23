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
      style={{ color: "#1A1D2E" }}
      className={className || "font-medium underline decoration-[#5C6B5C]/30 underline-offset-2 hover:decoration-[#5C6B5C] transition"}
    >
      {providerName}
    </Link>
  );
}
