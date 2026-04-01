// src/app/start/page.tsx

"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { HouseholdOptionCard } from "./components/HouseholdOptionCard";
import { ProfileRow } from "./components/ProfileRow";

type HouseholdType = "solo" | "couple" | "family" | "caregiving";

export default function StartHouseholdPage() {
  const [household, setHousehold] = useState<HouseholdType>("solo");
  const [profiles, setProfiles] = useState<string[]>([]);

  const canContinue = useMemo(() => !!household, [household]);

  function addProfile() {
    setProfiles((p) => [...p, ""]);
  }

  function updateProfile(idx: number, next: string) {
    setProfiles((p) => p.map((v, i) => (i === idx ? next : v)));
  }

  function removeProfile(idx: number) {
    setProfiles((p) => p.filter((_, i) => i !== idx));
  }

  const continueHref = `/connect?household=${encodeURIComponent(household)}`;

  return (
    <main className="min-h-screen bg-[#080C14] text-[#EFF4FF]">
      <div className="mx-auto max-w-5xl px-6 pt-10 pb-16">
        <header className="flex items-center justify-between">
          <Link
            href="/"
            className="text-sm text-[#6B85A8] hover:text-[#EFF4FF] underline underline-offset-4"
          >
            Back
          </Link>

          <div className="text-xs text-[#4D6480]">Step 1 of 3</div>
        </header>

        <section className="mt-10">
          <h1 className="text-4xl sm:text-5xl tracking-tight">
            Who are we managing care for?
          </h1>

          <p className="mt-3 max-w-2xl text-base text-[#6B85A8]">
            This helps Quarterback organize providers and scheduling. Profiles here are input only —
            booking truth still comes from the backend.
          </p>

          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <HouseholdOptionCard
              title="Solo"
              description="Just me."
              selected={household === "solo"}
              onClick={() => setHousehold("solo")}
            />
            <HouseholdOptionCard
              title="Couple"
              description="Me + partner."
              selected={household === "couple"}
              onClick={() => setHousehold("couple")}
            />
            <HouseholdOptionCard
              title="Family"
              description="Parents + kids."
              selected={household === "family"}
              onClick={() => setHousehold("family")}
            />
            <HouseholdOptionCard
              title="Caregiving"
              description="Managing care for someone else."
              selected={household === "caregiving"}
              onClick={() => setHousehold("caregiving")}
            />
          </div>

          <div className="mt-8 rounded-2xl bg-[#0F1520] p-6 ring-1 ring-white/8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-medium text-[#EFF4FF]">Optional profiles</div>
                <div className="mt-1 text-sm text-[#6B85A8]">
                  Add names to personalize the experience (you can skip this for the demo).
                </div>
              </div>

              <button
                type="button"
                onClick={addProfile}
                className="rounded-2xl bg-[#162030] px-4 py-2 text-sm text-[#EFF4FF] ring-1 ring-white/8 hover:bg-[#1E2D45]"
              >
                Add
              </button>
            </div>

            <div className="mt-4 flex flex-col gap-2">
              {profiles.length === 0 ? (
                <div className="text-sm text-[#4D6480]">No profiles added.</div>
              ) : (
                profiles.map((name, idx) => (
                  <ProfileRow
                    key={idx}
                    name={name}
                    onChange={(next) => updateProfile(idx, next)}
                    onRemove={() => removeProfile(idx)}
                    placeholder={household === "caregiving" ? "Person's name" : "Name"}
                  />
                ))
              )}
            </div>
          </div>

          <div className="mt-10 flex items-center justify-between">
            <div className="text-xs text-[#4D6480]">
              Selected: <span className="text-[#9AB0CC]">{household}</span>
            </div>

            <Link
              aria-disabled={!canContinue}
              href={canContinue ? continueHref : "#"}
              className={[
                "inline-flex items-center justify-center rounded-2xl px-6 py-3 font-medium shadow-sm transition",
                canContinue
                  ? "bg-[#5DE8C5] text-[#080C14] hover:brightness-95 active:brightness-90"
                  : "bg-white/10 text-[#4D6480] cursor-not-allowed",
              ].join(" ")}
            >
              Continue
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
