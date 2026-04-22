"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { usePathname } from "next/navigation";
import Image from "next/image";

type WizardStep = {
  title: string;
  body: string;
  targetSelector: string; // CSS selector for the element to highlight
  position: "top" | "bottom" | "center"; // where tooltip appears relative to target
};

const WIZARD_STEPS: WizardStep[] = [
  {
    title: "Welcome to Your Dashboard",
    body: "This is your home base. You'll see what needs attention, your providers, and what Kate recommends you do next.",
    targetSelector: "[data-wizard='hero']",
    position: "bottom",
  },
  {
    title: "Kate's Suggestions",
    body: "Kate watches your health data and makes suggestions here. Tap any suggestion to take action — or dismiss it.",
    targetSelector: "[data-wizard='best-next-step']",
    position: "bottom",
  },
  {
    title: "Your Providers",
    body: "See all your doctors below. Each provider name is clickable — tap it for full details, notes, and visit history.",
    targetSelector: "[data-wizard='providers']",
    position: "top",
  },
  {
    title: "Chat With Kate",
    body: "Tap this bubble anytime to chat. Kate can search for new providers, help you prep for visits, and answer questions about your health care.",
    targetSelector: "[data-wizard='kate-chat']",
    position: "top",
  },
  {
    title: "What To Do Next",
    body: "Every page ends with suggestions for where to go next. No dead ends — you'll always know the next step.",
    targetSelector: "[data-wizard='next-steps']",
    position: "top",
  },
];

const STORAGE_KEY = "qbh_wizard_completed";

export default function SetupWizard() {
  const pathname = usePathname();
  const [currentStep, setCurrentStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
  const [highlightStyle, setHighlightStyle] = useState<React.CSSProperties>({});
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (pathname !== "/dashboard") return;
    const done = localStorage.getItem(STORAGE_KEY);
    if (done) return;
    const timer = setTimeout(() => setVisible(true), 1500);
    return () => clearTimeout(timer);
  }, [pathname]);

  const positionTooltip = useCallback(() => {
    if (!visible || dismissed) return;
    const step = WIZARD_STEPS[currentStep];
    const target = document.querySelector(step.targetSelector);

    if (!target) {
      // Element not found — show centered
      setHighlightStyle({ display: "none" });
      setTooltipStyle({
        position: "fixed",
        bottom: "100px",
        left: "50%",
        transform: "translateX(-50%)",
      });
      return;
    }

    const rect = target.getBoundingClientRect();
    const padding = 8;

    // Highlight the target element
    setHighlightStyle({
      position: "fixed",
      top: rect.top - padding,
      left: rect.left - padding,
      width: rect.width + padding * 2,
      height: rect.height + padding * 2,
      borderRadius: "16px",
      boxShadow: "0 0 0 4000px rgba(0,0,0,0.35)",
      zIndex: 60,
      pointerEvents: "none" as const,
    });

    // Scroll target into view
    target.scrollIntoView({ behavior: "smooth", block: "center" });

    // Position tooltip
    if (step.position === "bottom" || rect.top > window.innerHeight / 2) {
      // Show above the element
      setTooltipStyle({
        position: "fixed",
        bottom: `${window.innerHeight - rect.top + 16}px`,
        left: "50%",
        transform: "translateX(-50%)",
      });
    } else {
      // Show below the element
      setTooltipStyle({
        position: "fixed",
        top: `${rect.bottom + 16}px`,
        left: "50%",
        transform: "translateX(-50%)",
      });
    }
  }, [currentStep, visible, dismissed]);

  useEffect(() => {
    positionTooltip();
    window.addEventListener("resize", positionTooltip);
    return () => window.removeEventListener("resize", positionTooltip);
  }, [positionTooltip]);

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
      {/* Highlight cutout */}
      <div style={highlightStyle} />

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className="z-[61] w-[calc(100%-48px)] max-w-md"
        style={tooltipStyle}
      >
        <div className="rounded-2xl bg-white shadow-2xl border border-[#EBEDF0] overflow-hidden">
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
