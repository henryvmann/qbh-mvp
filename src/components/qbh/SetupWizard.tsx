"use client";

import { useState, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import Image from "next/image";

type WizardStep = {
  title: string;
  body: string;
  target: string; // data-wizard attribute value, or "center" for no target
  position: "above" | "below"; // tooltip above or below the target
};

const WIZARD_STEPS: WizardStep[] = [
  {
    title: "Welcome to Your Dashboard",
    body: "This is your home base. You'll see what needs attention, your providers, and what Kate recommends you do next.",
    target: "center",
    position: "below",
  },
  {
    title: "Kate's Suggestions",
    body: "Kate watches your health data and makes suggestions. Tap any suggestion to take action — or dismiss it.",
    target: "best-next-step",
    position: "below",
  },
  {
    title: "Your Providers",
    body: "See all your doctors below. Each provider name is clickable — tap it for full details, notes, and visit history.",
    target: "providers",
    position: "above",
  },
  {
    title: "What To Do Next",
    body: "Every page ends with suggestions for where to go next. No dead ends — you'll always know the next step.",
    target: "next-steps",
    position: "above",
  },
];

const STORAGE_KEY = "qbh_wizard_completed";

export default function SetupWizard() {
  const pathname = usePathname();
  const [currentStep, setCurrentStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (pathname !== "/dashboard") return;
    const done = localStorage.getItem(STORAGE_KEY);
    if (done) return;
    // Wait long enough for /api/dashboard/data to land + render the
    // data-wizard targets. The previous 1500ms fired before content
    // mounted, so every step fell back to a centered tooltip.
    const timer = setTimeout(() => setVisible(true), 3000);
    return () => clearTimeout(timer);
  }, [pathname]);

  const updateTargetRect = useCallback(() => {
    const step = WIZARD_STEPS[currentStep];
    if (!step || step.target === "center") {
      setTargetRect(null);
      return;
    }

    function tryFindTarget(attempts: number) {
      const el = document.querySelector(`[data-wizard="${step.target}"]`);
      if (el) {
        const rect = el.getBoundingClientRect();
        setTargetRect(rect);

        // Scroll element into view
        const elTop = rect.top + window.scrollY;
        const viewportHeight = window.innerHeight;
        const scrollTarget = elTop - viewportHeight / 3;
        window.scrollTo({
          top: Math.max(0, scrollTarget),
          behavior: "smooth",
        });

        // Update rect after scroll settles
        setTimeout(() => {
          const updatedRect = el.getBoundingClientRect();
          setTargetRect(updatedRect);
        }, 400);
      } else if (attempts < 8) {
        // Target hasn't mounted yet — retry every 250ms up to 2s.
        setTimeout(() => tryFindTarget(attempts + 1), 250);
      } else {
        // Genuinely missing — fall back to centered.
        setTargetRect(null);
      }
    }
    tryFindTarget(0);
  }, [currentStep]);

  useEffect(() => {
    if (!visible || dismissed) return;
    updateTargetRect();

    const handleResize = () => updateTargetRect();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [visible, dismissed, currentStep, updateTargetRect]);

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

  // Calculate spotlight cutout and tooltip position
  const padding = 12;
  const hasTarget = targetRect && step.target !== "center";

  const spotlightStyle = hasTarget
    ? {
        top: targetRect.top - padding,
        left: targetRect.left - padding,
        width: targetRect.width + padding * 2,
        height: targetRect.height + padding * 2,
        borderRadius: "16px",
      }
    : null;

  // Position tooltip relative to target
  let tooltipStyle: React.CSSProperties = {};
  if (hasTarget) {
    const tooltipWidth = 360;
    const left = Math.max(16, Math.min(targetRect.left, window.innerWidth - tooltipWidth - 16));

    if (step.position === "below") {
      tooltipStyle = {
        position: "fixed",
        top: targetRect.bottom + padding + 20,
        left,
        width: tooltipWidth,
        maxWidth: "calc(100vw - 32px)",
      };
    } else {
      tooltipStyle = {
        position: "fixed",
        bottom: window.innerHeight - targetRect.top + padding + 20,
        left,
        width: tooltipWidth,
        maxWidth: "calc(100vw - 32px)",
      };
    }
  }

  return (
    <>
      {/* Dark overlay with spotlight cutout using clip-path */}
      <div
        className="fixed inset-0 z-[60] transition-all duration-300"
        onClick={handleSkip}
        style={
          spotlightStyle
            ? {
                background: "rgba(0,0,0,0.45)",
                clipPath: `polygon(
                  0% 0%, 100% 0%, 100% 100%, 0% 100%,
                  0% ${spotlightStyle.top}px,
                  ${spotlightStyle.left}px ${spotlightStyle.top}px,
                  ${spotlightStyle.left}px ${spotlightStyle.top + spotlightStyle.height}px,
                  ${spotlightStyle.left + spotlightStyle.width}px ${spotlightStyle.top + spotlightStyle.height}px,
                  ${spotlightStyle.left + spotlightStyle.width}px ${spotlightStyle.top}px,
                  0% ${spotlightStyle.top}px
                )`,
              }
            : { background: "rgba(0,0,0,0.45)" }
        }
      />

      {/* Spotlight border glow */}
      {spotlightStyle && (
        <div
          className="fixed z-[60] pointer-events-none rounded-2xl ring-2 ring-white/60 transition-all duration-300"
          style={{
            top: spotlightStyle.top,
            left: spotlightStyle.left,
            width: spotlightStyle.width,
            height: spotlightStyle.height,
          }}
        />
      )}

      {/* Tooltip card */}
      <div
        className="z-[61] pointer-events-none"
        style={
          hasTarget
            ? { ...tooltipStyle, position: "fixed" as const }
            : { position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }
        }
      >
        <div
          className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-[#E5EAF2] overflow-hidden pointer-events-auto"
          style={hasTarget ? { width: "100%" } : {}}
        >
          {/* Progress bar */}
          <div className="h-1.5 bg-[#E5EAF2]">
            <div
              className="h-1.5 bg-[#1677FF] transition-all duration-300"
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
                <div className="text-sm font-semibold text-[#071832]">{step.title}</div>
                <p className="mt-1 text-xs text-[#4F5F73] leading-relaxed">{step.body}</p>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <button
                onClick={handleSkip}
                className="text-xs text-[#4F5F73] hover:text-[#4F5F73] transition"
              >
                Skip Tour
              </button>
              <div className="flex items-center gap-3">
                {currentStep > 0 && (
                  <button
                    onClick={() => setCurrentStep((prev) => prev - 1)}
                    className="text-xs text-[#4F5F73] hover:text-[#071832] transition"
                  >
                    &larr; Previous
                  </button>
                )}
                <span className="text-[10px] text-[#4F5F73]">
                  {currentStep + 1}/{WIZARD_STEPS.length}
                </span>
                <button
                  onClick={handleNext}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-white"
                  style={{ backgroundColor: "#1677FF" }}
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
