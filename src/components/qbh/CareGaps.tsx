"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";
import { Stethoscope, SmilePlus, Eye, Microscope, Heart, Search } from "lucide-react";

type CareGap = {
  type: string;
  label: string;
  description: string;
  iconKey: string;
};

const careGapIconMap: Record<string, React.ComponentType<any>> = {
  pcp: Stethoscope,
  dentist: SmilePlus,
  eye: Eye,
  dermatologist: Microscope,
  obgyn: Heart,
};

const CARE_GAP_TYPES: (CareGap & { searchTerm: string })[] = [
  {
    type: "pcp",
    label: "Primary Care",
    description: "Your go-to doctor for checkups and general health",
    iconKey: "pcp",
    searchTerm: "primary care physician",
  },
  {
    type: "dentist",
    label: "Dentist",
    description: "Cleanings, checkups, and dental care",
    iconKey: "dentist",
    searchTerm: "dentist",
  },
  {
    type: "eye",
    label: "Eye Doctor",
    description: "Vision exams and eye health",
    iconKey: "eye",
    searchTerm: "optometrist",
  },
  {
    type: "dermatologist",
    label: "Dermatologist",
    description: "Skin checks and dermatology care",
    iconKey: "dermatologist",
    searchTerm: "dermatologist",
  },
  {
    type: "obgyn",
    label: "OB/GYN",
    description: "Gynecological exams and reproductive health",
    iconKey: "obgyn",
    searchTerm: "obgyn",
  },
];

export default function CareGaps() {
  const [gaps, setGaps] = useState<CareGap[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const checkGaps = useCallback(async () => {
    try {
      const res = await apiFetch("/api/dashboard/data");
      const data = await res.json();
      if (!data?.ok) return;

      const providers = (data.snapshots || []).map((s: any) => s.provider);
      const providerText = providers
        .map((p: any) =>
          [p.name, p.specialty, p.provider_type].filter(Boolean).join(" ").toLowerCase()
        )
        .join(" ");

      const detected: CareGap[] = [];

      for (const gap of CARE_GAP_TYPES) {
        let found = false;
        switch (gap.type) {
          case "pcp":
            found = /primary|pcp|internal medicine|family medicine|general practice|family practice/.test(providerText);
            break;
          case "dentist":
            found = /dental|dentist|orthodon/.test(providerText);
            break;
          case "eye":
            found = /eye|vision|optom|ophthalm/.test(providerText);
            break;
          case "dermatologist":
            found = /derma|skin/.test(providerText);
            break;
          case "obgyn":
            found = /obgyn|ob\/gyn|gynecol|obstet|women.*health/.test(providerText);
            break;
        }
        if (!found) {
          detected.push(gap);
        }
      }

      setGaps(detected);
    } catch {
      // Non-critical
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkGaps();
  }, [checkGaps]);

  const visibleGaps = gaps.filter((g) => !dismissed.has(g.type));

  if (loading || visibleGaps.length === 0) return null;

  return (
    <div className="mt-6 px-7">
      <div className="text-xs font-bold uppercase tracking-widest text-[#B0B4BC] mb-3">
        Care Gaps
      </div>
      <div className="space-y-2">
        {visibleGaps.slice(0, 3).map((gap) => (
          <div
            key={gap.type}
            className="flex items-center justify-between gap-3 rounded-xl bg-white border border-[#EBEDF0] shadow-sm p-4"
          >
            <div className="flex items-center gap-3">
              <span className="shrink-0">
                {(() => {
                  const IconComp = careGapIconMap[gap.type] || Stethoscope;
                  return <IconComp size={20} strokeWidth={1.5} color="#5C6B5C" />;
                })()}
              </span>
              <div>
                <div className="text-sm font-medium text-[#1A1D2E]">
                  No {gap.label} on file
                </div>
                <div className="text-xs text-[#7A7F8A]">{gap.description}</div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  window.location.href = '/providers?add=true&search=' + encodeURIComponent(gap.label.toLowerCase());
                }}
                className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
                style={{ background: "linear-gradient(135deg, #5C6B5C, #4A5A4A)" }}
              >
                <Search size={12} />
                Find one
              </button>
              <button
                onClick={() => setDismissed((prev) => new Set([...prev, gap.type]))}
                className="text-xs text-[#B0B4BC] hover:text-[#7A7F8A]"
              >
                Dismiss
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
