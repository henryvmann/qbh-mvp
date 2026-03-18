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
    <main className="min-h-screen bg-[#F5F1E8] text-neutral-900">
      <div className="mx-auto max-w-5xl px-6 pt-10 pb-16">
        <header className="flex items-center justify-between">
          <Link
            href="/"
            className="text-sm text-neutral-700 hover:text-neutral-900 underline underline-offset-4"
          >
            Back
          </Link>

          <div className="text-xs text-neutral-500">Step 1 of 3</div>
        </header>

        <section className="mt-10">
          <h1
            className="text-4xl sm:text-5xl tracking-tight"
            style={{ fontFamily: "Playfair Display, ui-serif, serif" }}
          >
            Who are we managing care for?
          </h1>

          <p className="mt-3 max-w-2xl text-base text-neutral-700">
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

          <div className="mt-8 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-medium text-neutral-900">Optional profiles</div>
                <div className="mt-1 text-sm text-neutral-600">
                  Add names to personalize the experience (you can skip this for the demo).
                </div>
              </div>

              <button
                type="button"
                onClick={addProfile}
                className="rounded-2xl bg-white px-4 py-2 text-sm text-neutral-800 shadow-sm ring-1 ring-black/5 hover:bg-white/90"
              >
                Add
              </button>
            </div>

            <div className="mt-4 flex flex-col gap-2">
              {profiles.length === 0 ? (
                <div className="text-sm text-neutral-500">No profiles added.</div>
              ) : (
                profiles.map((name, idx) => (
                  <ProfileRow
                    key={idx}
                    name={name}
                    onChange={(next) => updateProfile(idx, next)}
                    onRemove={() => removeProfile(idx)}
                    placeholder={household === "caregiving" ? "Person’s name" : "Name"}
                  />
                ))
              )}
            </div>
          </div>

          <div className="mt-10 flex items-center justify-between">
            <div className="text-xs text-neutral-500">
              Selected: <span className="text-neutral-700">{household}</span>
            </div>

            <Link
              aria-disabled={!canContinue}
              href={canContinue ? continueHref : "#"}
              className={[
                "inline-flex items-center justify-center rounded-2xl px-6 py-3 text-white shadow-sm transition",
                canContinue ? "bg-[#8B9D83] hover:brightness-95 active:brightness-90" : "bg-neutral-400 cursor-not-allowed",
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