"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Image from "next/image";

const WIZARD_STEPS = [
  {
    title: "Welcome to Your Dashboard",
    body: "This is your home base. You'll see what needs attention, your providers, and what Kate recommends you do next.",
  },
  {
    title: "Kate's Suggestions",
    body: "Kate watches your health data and makes suggestions. Tap any suggestion to take action — or dismiss it.",
  },
  {
    title: "Your Providers",
    body: "See all your doctors below. Each provider name is clickable — tap it for full details, notes, and visit history.",
  },
  {
    title: "Chat With Kate",
    body: "Tap the chat bubble in the bottom right anytime. Kate can search for new providers, help you prep for visits, and answer questions.",
  },
  {
    title: "What To Do Next",
    body: "Every page ends with suggestions for where to go next. No dead ends — you'll always know the next step.",
  },
];

const STORAGE_KEY = "qbh_wizard_completed";

export default function SetupWizard() {
  const pathname = usePathname();
  const [currentStep, setCurrentStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (pathname !== "/dashboard") return;
    const done = localStorage.getItem(STORAGE_KEY);
    if (done) return;
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
      {/* Dark overlay */}
      <div className="fixed inset-0 z-[60] bg-black/40" onClick={handleSkip} />

      {/* Centered tooltip card */}
      <div className="fixed inset-0 z-[61] flex items-center justify-center px-6 pointer-events-none">
        <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-[#EBEDF0] overflow-hidden pointer-events-auto">
          {/* Progress bar */}
          <div className="h-1.5 bg-[#EBEDF0]">
            <div
              className="h-1.5 bg-[#5C6B5C] transition-all duration-300"
              style={{ width: `${((currentStep + 1) / WIZARD_STEPS.length) * 100}%` }}
            />
          </div>

          <div className="p-6">
            <div className="flex items-start gap-3">
              <Image
                src="/kate-avatar.png"
                alt="Kate"
                width={40}
                height={40}
                className="rounded-full shrink-0 mt-0.5"
              />
              <div className="flex-1">
                <div className="text-base font-semibold text-[#1A1D2E]">{step.title}</div>
                <p className="mt-1.5 text-sm text-[#7A7F8A] leading-relaxed">{step.body}</p>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between">
              <button
                onClick={handleSkip}
                className="text-sm text-[#B0B4BC] hover:text-[#7A7F8A] transition"
              >
                Skip Tour
              </button>
              <div className="flex items-center gap-3">
                <span className="text-xs text-[#B0B4BC]">
                  {currentStep + 1} of {WIZARD_STEPS.length}
                </span>
                <button
                  onClick={handleNext}
                  className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white"
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
