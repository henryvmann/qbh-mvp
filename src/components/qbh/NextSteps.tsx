"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NextStep = {
  href: string;
  title: string;
  description: string;
};

const PAGE_NEXT_STEPS: Record<string, NextStep[]> = {
  "/providers": [
    { href: "/visits", title: "View Visits", description: "See upcoming and past appointments" },
    { href: "/settings", title: "Update Profile", description: "Health history, insurance, preferences" },
    { href: "/goals", title: "Set Goals", description: "Track what matters to your health" },
  ],
  "/visits": [
    { href: "/providers", title: "Manage Providers", description: "Add, edit, or review your care team" },
    { href: "/calendar-view", title: "Calendar", description: "See your health calendar" },
    { href: "/timeline", title: "Timeline", description: "Your full health story" },
  ],
  "/goals": [
    { href: "/providers", title: "Manage Providers", description: "Add providers to reach your goals" },
    { href: "/settings", title: "Your Profile", description: "Health history and preferences" },
    { href: "/dashboard", title: "Dashboard", description: "Back to your home base" },
  ],
  "/timeline": [
    { href: "/visits", title: "Visits", description: "Upcoming and past appointments" },
    { href: "/providers", title: "Providers", description: "Your care team" },
    { href: "/settings", title: "Settings", description: "Update your profile and preferences" },
  ],
  "/settings": [
    { href: "/providers", title: "Providers", description: "Manage your care team" },
    { href: "/goals", title: "Goals", description: "Set and track health goals" },
    { href: "/dashboard", title: "Dashboard", description: "Back to your home base" },
  ],
  "/calendar-view": [
    { href: "/visits", title: "Visits", description: "See all appointments" },
    { href: "/providers", title: "Providers", description: "Your care team" },
    { href: "/dashboard", title: "Dashboard", description: "Back to your home base" },
  ],
  "/medications": [
    { href: "/providers", title: "Providers", description: "Who prescribed what" },
    { href: "/settings", title: "Settings", description: "Update your health profile" },
    { href: "/dashboard", title: "Dashboard", description: "Back to your home base" },
  ],
  "/recordings": [
    { href: "/settings", title: "Settings", description: "Update your profile" },
    { href: "/providers", title: "Providers", description: "See provider details" },
    { href: "/dashboard", title: "Dashboard", description: "Back to your home base" },
  ],
};

export default function NextSteps() {
  const pathname = usePathname();
  const steps = PAGE_NEXT_STEPS[pathname];

  if (!steps) return null;

  return (
    <div className="mt-10 pb-8">
      <div className="text-xs font-bold uppercase tracking-widest text-[#B0B4BC] mb-4">
        What To Do Next
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {steps.map((step) => (
          <Link
            key={step.href}
            href={step.href}
            className="rounded-2xl bg-white border border-[#EBEDF0] p-4 shadow-sm transition hover:shadow-md"
          >
            <div className="text-sm font-semibold text-[#1A1D2E]">{step.title}</div>
            <div className="text-xs text-[#7A7F8A] mt-1">{step.description}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
