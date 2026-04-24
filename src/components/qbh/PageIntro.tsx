"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Image from "next/image";

type Slide = { title: string; body: string };

const PAGE_INTROS: Record<string, Slide[]> = {
  "/providers": [
    { title: "Your Care Team", body: "All your doctors, dentists, and specialists in one place." },
    { title: "Click Any Name", body: "Tap a provider to see their full details — contact info, visit history, and notes." },
    { title: "Build Your Team", body: "Missing a provider? Use the placeholder cards at the bottom to search and add." },
  ],
  "/visits": [
    { title: "Your Appointments", body: "See upcoming visits and past appointments all in one view." },
    { title: "Edit Anytime", body: "Past visits can be edited or removed. Future visits show prep options." },
  ],
  "/timeline": [
    { title: "Your Health Story", body: "See who you've visited, when, and how it all connects — organized by year." },
    { title: "Calendar Events", body: "Doctor appointments from your calendar show up here too. You can link them to providers." },
  ],
  "/goals": [
    { title: "Set Your Goals", body: "Tell Kate what you want to work on and she'll suggest specific goals." },
    { title: "Track Progress", body: "Goals update automatically as you book visits and add providers." },
  ],
  "/calendar-view": [
    { title: "Your Health Calendar", body: "See what's coming up and set your availability for booking." },
    { title: "Stay Conflict-Free", body: "Kate checks your calendar before scheduling so nothing overlaps." },
  ],
  "/settings": [
    { title: "Your Profile", body: "Keep your info up to date so Kate can give you the best experience." },
    { title: "Health History", body: "Tell Kate about your health background — she'll use it to make better suggestions." },
  ],
  "/analytics": [
    { title: "Your Progress", body: "Track providers, visits, and milestones in your health journey." },
    { title: "Earn Achievements", body: "Complete actions to earn badges and build your health profile." },
  ],
};

const STORAGE_PREFIX = "qbh_page_intro_seen_";

export default function PageIntro() {
  const pathname = usePathname();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const slides = PAGE_INTROS[pathname];
    if (!slides) return;

    const key = STORAGE_PREFIX + pathname;
    if (localStorage.getItem(key)) return;

    const timer = setTimeout(() => setVisible(true), 800);
    return () => clearTimeout(timer);
  }, [pathname]);

  const slides = PAGE_INTROS[pathname];
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

  return (
    <>
      <div className="fixed inset-0 z-[55] bg-black/30" onClick={handleSkip} />
      <div className="fixed inset-0 z-[56] flex items-center justify-center px-6 pointer-events-none">
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
