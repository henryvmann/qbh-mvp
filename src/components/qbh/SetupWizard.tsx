"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Image from "next/image";

const WIZARD_STEPS = [
  {
    title: "Welcome to Your Dashboard",
    body: "This is your home base. You'll see your providers, what's overdue, and what Kate recommends next.",
    page: "/dashboard",
  },
  {
    title: "Your Providers",
    body: "Tap any provider card to see their full details — contact info, visit history, notes, and more. Missing a doctor? Use the placeholder cards to add one.",
    page: "/providers",
  },
  {
    title: "Chat With Kate",
    body: "Kate is your care coordinator. Tap the chat bubble in the bottom right to ask her anything — find a provider, prep for a visit, or organize your health.",
    page: "/dashboard",
  },
  {
    title: "Your Health Timeline",
    body: "Everything lives here — past visits, upcoming appointments, and provider history. It builds automatically as you use QB.",
    page: "/timeline",
  },
  {
    title: "Settings & Health History",
    body: "Head to Settings to tell Kate your health background, update your insurance, and customize how Kate works for you.",
    page: "/settings",
  },
];

const STORAGE_KEY = "qbh_wizard_completed";

export default function SetupWizard() {
  const pathname = usePathname();
  const [currentStep, setCurrentStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Only show on dashboard, only if not completed
    if (pathname !== "/dashboard") return;
    const done = localStorage.getItem(STORAGE_KEY);
    if (done) return;
    // Small delay so the page renders first
    const timer = setTimeout(() => setVisible(true), 1500);
    return () => clearTimeout(timer);
  }, [pathname]);

  if (!visible || dismissed) return null;

  const step = WIZARD_STEPS[currentStep];
  const isLast = currentStep === WIZARD_STEPS.length - 1;

  function handleNext() {
    if (isLast) {
      localStorage.setItem(STORAGE_KEY, "true");
      setDismissed(true);
    } else {
      setCurrentStep((prev) => prev + 1);
    }
  }

  function handleSkip() {
    localStorage.setItem(STORAGE_KEY, "true");
    setDismissed(true);
  }

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-[60] bg-black/30" />

      {/* Tooltip card */}
      <div className="fixed inset-x-0 bottom-24 z-[61] flex justify-center px-6">
        <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-[#EBEDF0] overflow-hidden">
          {/* Progress bar */}
          <div className="h-1 bg-[#EBEDF0]">
            <div
              className="h-1 bg-[#5C6B5C] transition-all duration-300"
              style={{ width: `${((currentStep + 1) / WIZARD_STEPS.length) * 100}%` }}
            />
          </div>

          <div className="p-5">
            <div className="flex items-start gap-3">
              <Image
                src="/kate-avatar.png"
                alt="Kate"
                width={36}
                height={36}
                className="rounded-full shrink-0 mt-0.5"
              />
              <div className="flex-1">
                <div className="text-sm font-semibold text-[#1A1D2E]">{step.title}</div>
                <p className="mt-1 text-xs text-[#7A7F8A] leading-relaxed">{step.body}</p>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <button
                onClick={handleSkip}
                className="text-xs text-[#B0B4BC] hover:text-[#7A7F8A] transition"
              >
                Skip Tour
              </button>
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-[#B0B4BC]">
                  {currentStep + 1} of {WIZARD_STEPS.length}
                </span>
                <button
                  onClick={handleNext}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-white"
                  style={{ backgroundColor: "#5C6B5C" }}
                >
                  {isLast ? "Got It" : "Next"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
