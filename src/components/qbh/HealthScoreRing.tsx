"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";

type ScoreFactor = { label: string; points: number; earned: boolean };

type ScoreData = {
  score: number;
  level: string;
  levelLabel: string;
  factors: ScoreFactor[];
};

const LEVEL_COLORS: Record<string, { start: string; end: string; text: string }> = {
  "excellent":       { start: "#0FA5A5", end: "#D4A44C", text: "#0FA5A5" },
  "on-track":        { start: "#0FA5A5", end: "#5C7B5C", text: "#5C7B5C" },
  "building":        { start: "#D4A44C", end: "#C89B3C", text: "#D4A44C" },
  "getting-started": { start: "#B0B4BC", end: "#7A7F8A", text: "#7A7F8A" },
};

export default function HealthScoreRing({ compact }: { compact?: boolean }) {
  const [data, setData] = useState<ScoreData | null>(null);
  const [animatedScore, setAnimatedScore] = useState(0);
  const [showBreakdown, setShowBreakdown] = useState(false);

  useEffect(() => {
    apiFetch("/api/health-score")
      .then((r) => r.json())
      .then((d) => { if (d.ok) setData(d); })
      .catch(() => {});
  }, []);

  // Animate score counting up
  useEffect(() => {
    if (!data) return;
    const target = data.score;
    const duration = 1200;
    const startTime = Date.now();

    function tick() {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimatedScore(Math.round(eased * target));
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }, [data]);

  if (!data) return null;

  const colors = LEVEL_COLORS[data.level] || LEVEL_COLORS["getting-started"];
  const size = compact ? 80 : 140;
  const strokeWidth = compact ? 5 : 7;
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (animatedScore / 100) * circumference;

  return (
    <div className={compact ? "" : "flex flex-col items-center"}>
      <button
        onClick={() => !compact && setShowBreakdown(!showBreakdown)}
        className="relative flex items-center justify-center group"
        style={{ width: size, height: size }}
      >
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="transform -rotate-90">
          {/* Background track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgba(0,0,0,0.06)"
            strokeWidth={strokeWidth}
          />
          {/* Gradient definition */}
          <defs>
            <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={colors.start} />
              <stop offset="100%" stopColor={colors.end} />
            </linearGradient>
          </defs>
          {/* Progress arc */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="url(#scoreGradient)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${progress} ${circumference - progress}`}
            className="transition-all duration-1000"
          />
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className={`font-light ${compact ? "text-xl" : "text-4xl"}`}
            style={{ color: colors.text }}
          >
            {animatedScore}
          </span>
          {!compact && (
            <span className="text-[10px] font-semibold uppercase tracking-wider mt-0.5" style={{ color: "#7A7F8A" }}>
              {data.levelLabel}
            </span>
          )}
        </div>
      </button>

      {/* Breakdown (non-compact only) */}
      {!compact && showBreakdown && (
        <div className="mt-4 w-full max-w-xs rounded-2xl bg-white/60 backdrop-blur-sm border border-white/70 p-4 shadow-sm">
          <div className="text-[10px] font-bold uppercase tracking-wider text-[#7A7F8A] mb-2">
            Score Breakdown
          </div>
          <div className="space-y-1.5">
            {data.factors.map((f, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className={f.earned ? "text-[#1A2E1A]" : "text-[#B0B4BC]"}>
                  {f.earned ? "✓" : "○"} {f.label}
                </span>
                <span
                  className="font-semibold"
                  style={{ color: f.points > 0 ? "#5C7B5C" : f.points < 0 ? "#E04030" : "#B0B4BC" }}
                >
                  {f.points > 0 ? `+${f.points}` : f.points}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
