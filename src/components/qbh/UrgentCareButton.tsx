"use client";

import { useState } from "react";
import { Phone, MapPin, AlertTriangle, Heart, X } from "lucide-react";

const ACCENT = "#5C6B5C";
const CARD_BG = "#FFFFFF";
const URGENT_RED = "#DC2626";

export default function UrgentCareButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Compact trigger button */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 rounded-2xl border px-5 py-3.5 transition hover:shadow-sm"
        style={{
          backgroundColor: CARD_BG,
          borderColor: "#F0D0CC",
        }}
      >
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: "#FEE2E2" }}
        >
          <Heart size={16} className="text-red-600" />
        </div>
        <span className="text-sm font-semibold" style={{ color: URGENT_RED }}>
          I need help now
        </span>
      </button>

      {/* Expanded panel */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
          onClick={() => setOpen(false)}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40" />

          {/* Panel */}
          <div
            className="relative z-10 w-full max-w-lg rounded-t-3xl bg-white px-6 pb-8 pt-5 shadow-xl sm:rounded-3xl sm:mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute right-4 top-4 rounded-full p-1 text-[#B0B4BC] transition hover:bg-[#F0F2F5]"
            >
              <X size={20} />
            </button>

            {/* Header */}
            <div className="flex items-center gap-2 mb-5">
              <AlertTriangle size={20} className="text-red-600" />
              <h2 className="text-lg font-semibold text-[#1A1D2E]">
                Need help right now?
              </h2>
            </div>

            <div className="space-y-3">
              {/* 911 */}
              <a
                href="tel:911"
                className="flex items-center gap-4 rounded-2xl border border-red-200 px-5 py-4 transition hover:bg-red-50"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100">
                  <Phone size={18} className="text-red-600" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-red-700">
                    Call 911 for emergencies
                  </div>
                  <div className="text-xs text-red-400">
                    Life-threatening situations
                  </div>
                </div>
              </a>

              {/* Urgent Care */}
              <a
                href="https://www.google.com/maps/search/urgent+care+near+me"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-4 rounded-2xl border px-5 py-4 transition hover:bg-[#F8FAF8]"
                style={{ borderColor: "#D0DDD0" }}
              >
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                  style={{ backgroundColor: "#E8F0E8" }}
                >
                  <MapPin size={18} style={{ color: ACCENT }} />
                </div>
                <div>
                  <div className="text-sm font-semibold" style={{ color: ACCENT }}>
                    Find urgent care near you
                  </div>
                  <div className="text-xs text-[#7A7F8A]">
                    Walk-in clinics for non-emergency care
                  </div>
                </div>
              </a>

              {/* ER */}
              <a
                href="https://www.google.com/maps/search/emergency+room+near+me"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-4 rounded-2xl border px-5 py-4 transition hover:bg-[#F5F0F8]"
                style={{ borderColor: "#D8D0E0" }}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EDE8F5]">
                  <MapPin size={18} className="text-[#5C4A8A]" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-[#5C4A8A]">
                    Find your nearest ER
                  </div>
                  <div className="text-xs text-[#7A7F8A]">
                    Emergency rooms for serious conditions
                  </div>
                </div>
              </a>

              {/* Kate quick action */}
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  // Dispatch a custom event that KateChatButton can listen for
                  window.dispatchEvent(
                    new CustomEvent("kate-quick-action", {
                      detail: { message: "I'm sick \u2014 what should I do?" },
                    })
                  );
                }}
                className="flex w-full items-center gap-4 rounded-2xl border px-5 py-4 text-left transition hover:bg-[#F0F8FF]"
                style={{ borderColor: "#C0D8E8" }}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#E0F0FF]">
                  <Heart size={18} className="text-[#2A6090]" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-[#2A6090]">
                    Ask Kate: &ldquo;I&apos;m sick &mdash; what should I do?&rdquo;
                  </div>
                  <div className="text-xs text-[#7A7F8A]">
                    Get guidance from your health assistant
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
