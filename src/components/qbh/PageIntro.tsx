"use client";

import { useState, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import Image from "next/image";

type Slide = {
  title: string;
  body: string;
  target: string; // data-tour attribute value, or "center"
  position: "above" | "below";
};

const PAGE_INTROS: Record<string, Slide[]> = {
  "/providers": [
    { title: "Your Care Team", body: "All your doctors, dentists, and specialists in one place.", target: "center", position: "below" },
    { title: "Click Any Name", body: "Tap a provider to see their full details — contact info, visit history, and notes.", target: "provider-list", position: "above" },
    { title: "Build Your Team", body: "Missing a provider? Use the + Add provider button to search and add.", target: "add-provider", position: "below" },
  ],
  "/visits": [
    { title: "Your Appointments", body: "See upcoming visits and past appointments all in one view.", target: "center", position: "below" },
    { title: "Upcoming Visits", body: "Confirmed appointments show here with dates and provider details.", target: "upcoming-visits", position: "below" },
    { title: "Follow-ups", body: "Providers that need booking show here. Kate can call and schedule for you.", target: "follow-ups", position: "above" },
  ],
  "/timeline": [
    { title: "Your Health Story", body: "See who you've visited, when, and how it all connects — organized by year.", target: "center", position: "below" },
    { title: "Upcoming Events", body: "Your next appointments are shown at the top so you always know what's coming.", target: "timeline-upcoming", position: "below" },
    { title: "Provider History", body: "Scroll down to see your providers grouped by year with visit dots.", target: "timeline-history", position: "above" },
  ],
  "/goals": [
    { title: "Set Your Goals", body: "Tell Kate what you want to work on and she'll suggest specific goals.", target: "center", position: "below" },
    { title: "What's Important", body: "Type a health topic and Kate will suggest actionable goals with the right provider types.", target: "goals-input", position: "below" },
    { title: "Track Progress", body: "Goals update automatically as you book visits and add providers.", target: "goals-sections", position: "above" },
  ],
  "/calendar-view": [
    { title: "Your Health Calendar", body: "See what's coming up and set your availability for booking.", target: "center", position: "below" },
    { title: "Your Calendar", body: "Click any date to see appointments. Health events are highlighted.", target: "calendar-grid", position: "below" },
    { title: "Availability", body: "Set your preferred days and times so Kate books when it works for you.", target: "availability", position: "above" },
  ],
  "/settings": [
    { title: "Your Profile", body: "Keep your info up to date so Kate can give you the best experience.", target: "center", position: "below" },
    { title: "Health History", body: "Tell Kate about your health background — she'll use it to make better suggestions.", target: "health-history", position: "below" },
    { title: "Kate Preferences", body: "Choose how Kate talks to you and how involved she should be.", target: "kate-preferences", position: "above" },
  ],
  "/analytics": [
    { title: "Your Progress", body: "Track providers, visits, and milestones in your health journey.", target: "center", position: "below" },
    { title: "Health Stats", body: "See your key numbers at a glance — providers, appointments, and past visits.", target: "stats-grid", position: "below" },
    { title: "Earn Achievements", body: "Complete actions to earn badges and build your health profile.", target: "achievements", position: "above" },
  ],
};

const STORAGE_PREFIX = "qbh_page_intro_seen_";

export default function PageIntro() {
  const pathname = usePathname();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [visible, setVisible] = useState(false);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    const slides = PAGE_INTROS[pathname];
    if (!slides) return;

    const key = STORAGE_PREFIX + pathname;
    if (localStorage.getItem(key)) return;

    setCurrentSlide(0);
    const timer = setTimeout(() => setVisible(true), 800);
    return () => clearTimeout(timer);
  }, [pathname]);

  const slides = PAGE_INTROS[pathname];

  const updateTargetRect = useCallback(() => {
    if (!slides) return;
    const slide = slides[currentSlide];
    if (!slide || slide.target === "center") {
      setTargetRect(null);
      return;
    }

    const el = document.querySelector(`[data-tour="${slide.target}"]`);
    if (el) {
      const rect = el.getBoundingClientRect();
      setTargetRect(rect);

      const scrollTarget = rect.top + window.scrollY - window.innerHeight / 3;
      window.scrollTo({ top: Math.max(0, scrollTarget), behavior: "smooth" });

      setTimeout(() => {
        const updated = el.getBoundingClientRect();
        setTargetRect(updated);
      }, 400);
    } else {
      setTargetRect(null);
    }
  }, [currentSlide, slides]);

  useEffect(() => {
    if (!visible || !slides) return;
    updateTargetRect();

    const handleResize = () => updateTargetRect();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [visible, currentSlide, updateTargetRect, slides]);

  if (!slides || !visible) return null;

  const slide = slides[currentSlide];
  const isLast = currentSlide === slides.length - 1;

  function handleNext() {
    if (isLast) {
      localStorage.setItem(STORAGE_PREFIX + pathname, "true");
      setVisible(false);
    } else {
      setCurrentSlide((prev) => prev + 1);
    }
  }

  function handleSkip() {
    localStorage.setItem(STORAGE_PREFIX + pathname, "true");
    setVisible(false);
  }

  const padding = 12;
  const hasTarget = targetRect && slide.target !== "center";

  const spotlightStyle = hasTarget
    ? {
        top: targetRect.top - padding,
        left: targetRect.left - padding,
        width: targetRect.width + padding * 2,
        height: targetRect.height + padding * 2,
      }
    : null;

  let tooltipStyle: React.CSSProperties = {};
  if (hasTarget) {
    const tooltipWidth = 340;
    const left = Math.max(16, Math.min(targetRect.left, window.innerWidth - tooltipWidth - 16));

    if (slide.position === "below") {
      tooltipStyle = {
        position: "fixed",
        top: targetRect.bottom + padding + 12,
        left,
        width: tooltipWidth,
        maxWidth: "calc(100vw - 32px)",
      };
    } else {
      tooltipStyle = {
        position: "fixed",
        bottom: window.innerHeight - targetRect.top + padding + 12,
        left,
        width: tooltipWidth,
        maxWidth: "calc(100vw - 32px)",
      };
    }
  }

  return (
    <>
      {/* Overlay with spotlight cutout */}
      <div
        className="fixed inset-0 z-[55] transition-all duration-300"
        onClick={handleSkip}
        style={
          spotlightStyle
            ? {
                background: "rgba(0,0,0,0.4)",
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
            : { background: "rgba(0,0,0,0.4)" }
        }
      />

      {/* Spotlight ring */}
      {spotlightStyle && (
        <div
          className="fixed z-[55] pointer-events-none rounded-2xl ring-2 ring-white/60 transition-all duration-300"
          style={{
            top: spotlightStyle.top,
            left: spotlightStyle.left,
            width: spotlightStyle.width,
            height: spotlightStyle.height,
          }}
        />
      )}

      {/* Tooltip */}
      <div
        className="z-[56] pointer-events-none"
        style={
          hasTarget
            ? { ...tooltipStyle, position: "fixed" as const }
            : { position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }
        }
      >
        <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl border border-[#EBEDF0] overflow-hidden pointer-events-auto">
          <div className="h-1.5 bg-[#EBEDF0]">
            <div
              className="h-1.5 bg-[#5C6B5C] transition-all duration-300"
              style={{ width: `${((currentSlide + 1) / slides.length) * 100}%` }}
            />
          </div>
          <div className="p-5">
            <div className="flex items-start gap-3">
              <Image src="/kate-avatar.png" alt="Kate" width={32} height={32} className="rounded-full shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="text-sm font-semibold text-[#1A1D2E]">{slide.title}</div>
                <p className="mt-1 text-xs text-[#7A7F8A] leading-relaxed">{slide.body}</p>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <button onClick={handleSkip} className="text-xs text-[#B0B4BC] hover:text-[#7A7F8A]">
                Got It
              </button>
              <div className="flex items-center gap-3">
                {currentSlide > 0 && (
                  <button onClick={() => setCurrentSlide((p) => p - 1)} className="text-xs text-[#7A7F8A]">
                    &larr; Previous
                  </button>
                )}
                <span className="text-[10px] text-[#B0B4BC]">{currentSlide + 1}/{slides.length}</span>
                <button
                  onClick={handleNext}
                  className="rounded-lg px-4 py-1.5 text-xs font-semibold text-white"
                  style={{ backgroundColor: "#5C6B5C" }}
                >
                  {isLast ? "Let's Go" : "Next"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
