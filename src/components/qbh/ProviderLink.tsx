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
      className={className || "text-[#1A1D2E] underline decoration-[#5C6B5C]/30 underline-offset-2 hover:decoration-[#5C6B5C] transition"}
    >
      {providerName}
    </Link>
  );
}
