"use client";

/**
 * Public landing — Quarterback Health.
 *
 * v5 brand language: cream background, Quarterback Health wordmark
 * (Fraunces serif, electric-blue "Health"), Inter for body, glass
 * surfaces. Sections: nav, hero with phone mock, how it works, trust
 * pillars, pricing teaser, footer. Authed visitors get redirected
 * straight to /dashboard.
 *
 * The same content also lives at /preview-marketing for design review.
 * Keep them in sync until preview-marketing is retired.
 */

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Inter, Fraunces } from "next/font/google";
import { createClient } from "../lib/supabase/client";

const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "600", "700"] });
const austin = Fraunces({ subsets: ["latin"], weight: ["400", "500", "600"] });

const T = {
  navy: "#061225",
  cardNavy: "#0B2545",
  electric: "#1677FF",
  glow: "#2E8CFF",
  green: "#27C46B",
  lightBg: "#FAF8F4",
  white: "#FFFFFF",
  lightBorder: "#E5EAF2",
  lightText: "#071832",
  lightMuted: "#4F5F73",
};

export default function HomePage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    async function checkAuth() {
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          router.replace("/dashboard");
          return;
        }
      } catch {
        // Not authenticated — show landing
      }
      setChecking(false);
    }
    checkAuth();
  }, [router]);

  if (checking) {
    return (
      <main
        className={inter.className}
        style={{ minHeight: "100vh", background: T.lightBg }}
      />
    );
  }

  return (
    <main
      className={inter.className}
      style={{
        minHeight: "100vh",
        background: T.lightBg,
        color: T.lightText,
        WebkitFontSmoothing: "antialiased",
      }}
    >
      <Nav />
      <Hero />
      <WhatWeDo />
      <HowItWorks />
      <TrustBand />
      <PrivacyStrip />
      <Pricing />
      <Footer />
    </main>
  );
}

// ─────────────────────────────────────────────────────────────────
// Nav
// ─────────────────────────────────────────────────────────────────

function Nav() {
  return (
    <nav
      style={{
        position: "sticky",
        top: 0,
        zIndex: 40,
        background: "rgba(250,248,244,0.85)",
        backdropFilter: "blur(18px) saturate(140%)",
        WebkitBackdropFilter: "blur(18px) saturate(140%)",
        borderBottom: `1px solid ${T.lightBorder}`,
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "16px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Wordmark size={20} />
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link
            href="/login"
            style={{
              fontSize: 14,
              fontWeight: 500,
              color: T.lightText,
              padding: "8px 14px",
              textDecoration: "none",
            }}
          >
            Sign in
          </Link>
          <Link
            href="/onboarding"
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: T.white,
              background: T.electric,
              padding: "10px 18px",
              borderRadius: 12,
              textDecoration: "none",
              boxShadow: "0 4px 14px rgba(22,119,255,0.28)",
            }}
          >
            Start free
          </Link>
        </div>
      </div>
    </nav>
  );
}

function Wordmark({ size = 18 }: { size?: number }) {
  return (
    <span
      className={austin.className}
      style={{
        fontSize: size,
        fontWeight: 500,
        letterSpacing: -0.2,
        lineHeight: 1,
      }}
    >
      <span style={{ color: T.lightText }}>Quarterback</span>{" "}
      <span style={{ color: T.electric }}>Health</span>
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────
// Hero
// ─────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section
      style={{
        maxWidth: 1200,
        margin: "0 auto",
        padding: "64px 24px 80px",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr",
          gap: 48,
          alignItems: "center",
        }}
        className="hero-grid"
      >
        <div>
          <h1
            className={austin.className}
            style={{
              fontSize: "clamp(40px, 6vw, 68px)",
              fontWeight: 500,
              letterSpacing: -1.2,
              lineHeight: 1.02,
              margin: 0,
              color: T.lightText,
            }}
          >
            Healthcare,
            <br />
            <span style={{ color: T.electric }}>handled.</span>
          </h1>
          <p
            style={{
              fontSize: 19,
              color: T.lightMuted,
              lineHeight: 1.5,
              maxWidth: 520,
              marginTop: 22,
            }}
          >
            Kate is your AI care coordinator. She tracks your providers, books
            your appointments, and follows up on the details — so you don&rsquo;t
            have to.
          </p>
          <div
            style={{
              marginTop: 32,
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <Link
              href="/onboarding"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                background: T.electric,
                color: T.white,
                padding: "16px 28px",
                borderRadius: 14,
                fontSize: 16,
                fontWeight: 600,
                textDecoration: "none",
                boxShadow: "0 8px 24px rgba(22,119,255,0.32)",
              }}
            >
              Start free <span style={{ fontSize: 18 }}>→</span>
            </Link>
            <Link
              href="#how"
              style={{
                display: "inline-flex",
                alignItems: "center",
                background: T.white,
                color: T.lightText,
                border: `1px solid ${T.lightBorder}`,
                padding: "16px 28px",
                borderRadius: 14,
                fontSize: 16,
                fontWeight: 500,
                textDecoration: "none",
              }}
            >
              See how it works
            </Link>
          </div>
          <p
            style={{
              fontSize: 13,
              color: T.lightMuted,
              marginTop: 18,
            }}
          >
            Free for 14 days. No card required.
          </p>
        </div>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <PhoneMock />
        </div>
      </div>
      <style>{`
        @media (min-width: 900px) {
          .hero-grid { grid-template-columns: 1.1fr 1fr; gap: 56px; }
        }
      `}</style>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────
// Phone mock
// ─────────────────────────────────────────────────────────────────

function PhoneMock() {
  return (
    <div
      style={{
        width: 360,
        maxWidth: "100%",
        height: 720,
        borderRadius: 44,
        background: T.lightBg,
        boxShadow: "0 30px 80px rgba(7,24,50,0.18), 0 0 0 8px #E0DAD0",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        position: "relative",
      }}
    >
      <div
        style={{
          height: 44,
          padding: "0 28px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: 13,
          fontWeight: 600,
          flexShrink: 0,
        }}
      >
        <span>9:41</span>
        <span style={{ display: "flex", gap: 6, opacity: 0.85, fontSize: 11 }}>
          <span>•••</span>
          <span>◐</span>
          <span>▮▮▮</span>
        </span>
      </div>

      <div
        style={{
          flex: 1,
          padding: "8px 22px 90px",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Wordmark size={18} />
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              overflow: "hidden",
              border: `1.5px solid ${T.lightBorder}`,
            }}
          >
            <Image
              src="/kate-avatar.png"
              alt="You"
              width={32}
              height={32}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "12px 14px",
            background: "rgba(255,255,255,0.85)",
            backdropFilter: "blur(18px)",
            border: `1px solid ${T.lightBorder}`,
            borderRadius: 18,
            boxShadow: "0 4px 14px rgba(7,24,50,0.04)",
          }}
        >
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 19,
              overflow: "hidden",
              flexShrink: 0,
            }}
          >
            <Image
              src="/kate-avatar.png"
              alt="Kate"
              width={38}
              height={38}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              Kate is active
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 4,
                  background: T.green,
                  boxShadow: "0 0 0 3px rgba(39,196,107,0.18)",
                }}
              />
            </div>
            <div style={{ fontSize: 12, color: T.lightMuted, marginTop: 1 }}>
              Monitoring and ready to help.
            </div>
          </div>
          <span style={{ color: T.lightMuted, fontSize: 16 }}>›</span>
        </div>

        <div style={{ padding: "0 4px", marginTop: 4 }}>
          <h2
            className={austin.className}
            style={{
              fontSize: 34,
              fontWeight: 500,
              letterSpacing: -0.7,
              lineHeight: 1.05,
              margin: 0,
              color: T.lightText,
            }}
          >
            Health,
            <br />
            organized.
          </h2>
          <p
            style={{
              fontSize: 13,
              color: T.lightMuted,
              marginTop: 8,
              lineHeight: 1.45,
            }}
          >
            Clear next steps.
            <br />
            Less to manage.
          </p>
        </div>

        <div
          style={{
            background: "rgba(255,255,255,0.85)",
            backdropFilter: "blur(18px)",
            border: `1px solid ${T.lightBorder}`,
            borderRadius: 22,
            padding: 16,
            boxShadow: "0 4px 18px rgba(7,24,50,0.06)",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                background: "rgba(22,119,255,0.10)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <CalendarPlusIcon color={T.electric} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: 1,
                  textTransform: "uppercase",
                  color: T.lightMuted,
                }}
              >
                Next Step
              </div>
              <div
                className={austin.className}
                style={{
                  fontSize: 20,
                  fontWeight: 500,
                  marginTop: 2,
                  letterSpacing: -0.3,
                  lineHeight: 1.15,
                }}
              >
                Dermatology follow-up
              </div>
              <div style={{ fontSize: 13, fontWeight: 500, marginTop: 6 }}>
                Dr. Patel
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: T.lightMuted,
                  marginTop: 4,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <CalendarSmallIcon color={T.lightMuted} /> May 21 at 10:00 AM
              </div>
            </div>
          </div>
          <div
            style={{
              marginTop: 12,
              background: T.electric,
              color: T.white,
              fontSize: 14,
              fontWeight: 600,
              padding: "12px 16px",
              borderRadius: 14,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              boxShadow: "0 4px 14px rgba(22,119,255,0.28)",
            }}
          >
            Approve &amp; handle <span style={{ fontSize: 14 }}>→</span>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "12px 14px",
            background: "rgba(255,255,255,0.85)",
            backdropFilter: "blur(18px)",
            border: `1px solid ${T.lightBorder}`,
            borderRadius: 16,
            boxShadow: "0 4px 14px rgba(7,24,50,0.04)",
          }}
        >
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: 12,
              background: "rgba(39,196,107,0.16)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <CheckIcon color={T.green} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>
              Everything else is on track
            </div>
            <div style={{ fontSize: 11, color: T.lightMuted, marginTop: 1 }}>
              You&rsquo;re doing great.
            </div>
          </div>
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          background: "rgba(255,255,255,0.85)",
          backdropFilter: "blur(24px)",
          borderTop: `1px solid ${T.lightBorder}`,
          padding: "10px 4px 22px",
          display: "flex",
          justifyContent: "space-around",
        }}
      >
        {["Home", "Timeline", "Insights", "Kate", "You"].map((l, i) => (
          <div
            key={l}
            style={{
              fontSize: 9.5,
              fontWeight: 600,
              color: i === 0 ? T.electric : T.lightMuted,
            }}
          >
            {l}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// What we do — the manifesto / "why QBH" between hero and how-it-works.
// Sits above the steps so a first-time visitor understands what kind
// of product this is before they see the mechanics.
// ─────────────────────────────────────────────────────────────────

function WhatWeDo() {
  return (
    <section
      style={{
        background: T.lightBg,
        borderTop: `1px solid ${T.lightBorder}`,
        padding: "72px 24px",
      }}
    >
      <div style={{ maxWidth: 880, margin: "0 auto" }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: 1.2,
            textTransform: "uppercase",
            color: T.electric,
            marginBottom: 14,
          }}
        >
          What Quarterback Health does
        </div>
        <h2
          className={austin.className}
          style={{
            fontSize: "clamp(28px, 4vw, 42px)",
            fontWeight: 500,
            letterSpacing: -0.6,
            lineHeight: 1.1,
            margin: 0,
            color: T.lightText,
          }}
        >
          The invisible work of healthcare, carried for you.
        </h2>
        <div
          style={{
            marginTop: 22,
            display: "grid",
            gridTemplateColumns: "1fr",
            gap: 18,
            fontSize: 17,
            color: T.lightMuted,
            lineHeight: 1.6,
          }}
        >
          <p style={{ margin: 0 }}>
            Quarterback Health helps patients and caregivers manage the invisible work of healthcare.
            One secure hub for providers, appointments, records, lab results, portal messages, and
            next steps — for yourself and the people you care for.
          </p>
          <p style={{ margin: 0 }}>
            At the center is Kate, your AI care coordinator. She connects the dots across fragmented
            care, surfaces what matters, and helps you understand your health as a whole person —
            mind and body, not disconnected symptoms or siloed provider notes.
          </p>
          <p style={{ margin: 0 }}>
            Built from the inside out by a therapist who knows what it&rsquo;s like to navigate this
            for a family. QBH helps people carry less of the mental load and stay ahead of their care
            with clarity, support, and control.
          </p>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────
// How it works
// ─────────────────────────────────────────────────────────────────

function HowItWorks() {
  const steps = [
    {
      num: "01",
      title: "Connect once.",
      body: "Kate learns your care team from your booked appointments and copay history — no forms, no manual entry. She&rsquo;s working on day one.",
      icon: <BankIcon color={T.electric} />,
    },
    {
      num: "02",
      title: "Kate handles it.",
      body: "She calls offices, books appointments, chases prescriptions, confirms insurance. You approve the action — she does the work.",
      icon: <SparkleIcon color={T.electric} />,
    },
    {
      num: "03",
      title: "Stay on track.",
      body: "Your dashboard shows what&rsquo;s done, what&rsquo;s next, and your care coordination score — so you always know what&rsquo;s coming up and what&rsquo;s already taken care of.",
      icon: <ChartIcon color={T.electric} />,
    },
  ];
  return (
    <section
      id="how"
      style={{
        background: T.white,
        borderTop: `1px solid ${T.lightBorder}`,
        borderBottom: `1px solid ${T.lightBorder}`,
        padding: "80px 24px",
      }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ maxWidth: 640 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: 1.2,
              textTransform: "uppercase",
              color: T.electric,
              marginBottom: 12,
            }}
          >
            How it works
          </div>
          <h2
            className={austin.className}
            style={{
              fontSize: "clamp(32px, 4.5vw, 48px)",
              fontWeight: 500,
              letterSpacing: -0.8,
              lineHeight: 1.05,
              margin: 0,
            }}
          >
            One coordinator.
            <br />
            Everything in one place.
          </h2>
        </div>

        <div
          style={{
            marginTop: 48,
            display: "grid",
            gridTemplateColumns: "1fr",
            gap: 20,
          }}
          className="steps-grid"
        >
          {steps.map((s) => (
            <div
              key={s.num}
              style={{
                background: T.lightBg,
                border: `1px solid ${T.lightBorder}`,
                borderRadius: 22,
                padding: 28,
              }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 14,
                  background: "rgba(22,119,255,0.10)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 18,
                }}
              >
                {s.icon}
              </div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: 1.5,
                  color: T.lightMuted,
                  marginBottom: 8,
                }}
              >
                {s.num}
              </div>
              <div
                className={austin.className}
                style={{
                  fontSize: 24,
                  fontWeight: 500,
                  letterSpacing: -0.4,
                  lineHeight: 1.1,
                  marginBottom: 10,
                }}
              >
                {s.title}
              </div>
              <p
                style={{
                  fontSize: 15,
                  color: T.lightMuted,
                  lineHeight: 1.55,
                  margin: 0,
                }}
              >
                {s.body}
              </p>
            </div>
          ))}
        </div>
      </div>
      <style>{`
        @media (min-width: 800px) {
          .steps-grid { grid-template-columns: repeat(3, 1fr); }
        }
      `}</style>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────
// Trust band
// ─────────────────────────────────────────────────────────────────

function TrustBand() {
  const pillars = [
    {
      icon: <ShieldIcon color={T.electric} />,
      title: "You stay in control.",
      body: "We recommend. You decide.",
    },
    {
      icon: <StethoscopeIcon color={T.electric} />,
      title: "Therapist-founded.",
      body: "Built by a clinician who&rsquo;s lived this — for herself and her family.",
    },
    {
      icon: <SparkleIcon color={T.electric} />,
      title: "Fewer headaches.",
      body: "We coordinate, follow up, and keep everything moving.",
    },
    {
      icon: <ChartIcon color={T.electric} />,
      title: "Better outcomes.",
      body: "Smarter care. Early action. Stronger results.",
    },
  ];
  return (
    <section style={{ padding: "80px 24px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 24,
          }}
          className="trust-grid"
        >
          {pillars.map((p) => (
            <div key={p.title} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  background: "rgba(22,119,255,0.10)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {p.icon}
              </div>
              <div style={{ minWidth: 0 }}>
                <div
                  className={austin.className}
                  style={{
                    fontSize: 19,
                    fontWeight: 500,
                    letterSpacing: -0.2,
                    marginBottom: 4,
                  }}
                >
                  {p.title}
                </div>
                <div style={{ fontSize: 14, color: T.lightMuted, lineHeight: 1.5 }}>
                  {p.body}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <style>{`
        @media (min-width: 800px) {
          .trust-grid { grid-template-columns: repeat(4, 1fr); gap: 32px; }
        }
      `}</style>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────
// Privacy strip — concrete, plain-English trust statements
// ─────────────────────────────────────────────────────────────────

function PrivacyStrip() {
  const points = [
    {
      title: "Your data is yours.",
      body: "We never sell it, and our AI partners are contractually barred from training on it. You can export or delete everything any time.",
    },
    {
      title: "Encrypted everywhere.",
      body: "Your data is locked at rest and in transit using the same standards banks use. Health documents are stored without your name attached.",
    },
    {
      title: "Vendor agreements in place.",
      body: "Every vendor handling your health data has signed a Business Associate Agreement — OpenAI, Anthropic, VAPI, Twilio, and AWS.",
    },
    {
      title: "Two-factor authentication.",
      body: "Optional but recommended. Adds an authenticator-app code on top of your password for an extra layer of security.",
    },
  ];
  return (
    <section
      style={{
        background: T.lightBg,
        borderTop: `1px solid ${T.lightBorder}`,
        padding: "72px 24px",
      }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ maxWidth: 640, marginBottom: 36 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: 1.2,
              textTransform: "uppercase",
              color: T.electric,
              marginBottom: 12,
            }}
          >
            Privacy &amp; security
          </div>
          <h2
            className={austin.className}
            style={{
              fontSize: "clamp(28px, 4vw, 40px)",
              fontWeight: 500,
              letterSpacing: -0.6,
              lineHeight: 1.1,
              margin: 0,
              color: T.lightText,
            }}
          >
            Healthcare data, treated like healthcare data.
          </h2>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr",
            gap: 18,
          }}
          className="privacy-grid"
        >
          {points.map((p) => (
            <div
              key={p.title}
              style={{
                background: T.white,
                border: `1px solid ${T.lightBorder}`,
                borderRadius: 18,
                padding: 22,
              }}
            >
              <div
                className={austin.className}
                style={{
                  fontSize: 18,
                  fontWeight: 500,
                  letterSpacing: -0.2,
                  color: T.lightText,
                  marginBottom: 8,
                }}
              >
                {p.title}
              </div>
              <p
                style={{
                  fontSize: 14,
                  color: T.lightMuted,
                  lineHeight: 1.55,
                  margin: 0,
                }}
              >
                {p.body}
              </p>
            </div>
          ))}
        </div>
      </div>
      <style>{`
        @media (min-width: 800px) {
          .privacy-grid { grid-template-columns: repeat(2, 1fr); gap: 24px; }
        }
      `}</style>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────
// Pricing
// ─────────────────────────────────────────────────────────────────

function Pricing() {
  return (
    <section
      style={{
        padding: "80px 24px",
        background: T.navy,
        color: T.white,
      }}
    >
      <div style={{ maxWidth: 800, margin: "0 auto", textAlign: "center" }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: 1.2,
            textTransform: "uppercase",
            color: T.glow,
            marginBottom: 14,
          }}
        >
          Pricing
        </div>
        <h2
          className={austin.className}
          style={{
            fontSize: "clamp(34px, 5vw, 52px)",
            fontWeight: 500,
            letterSpacing: -0.8,
            lineHeight: 1.05,
            margin: 0,
          }}
        >
          Start free for 14 days.
        </h2>
        <p
          style={{
            fontSize: 17,
            color: "#C9D6EA",
            lineHeight: 1.55,
            marginTop: 20,
            marginBottom: 36,
          }}
        >
          Try Kate with your real providers and appointments. No card required.
          When you&rsquo;re ready, plans start at $24/mo.
        </p>
        <Link
          href="/onboarding"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            background: T.electric,
            color: T.white,
            padding: "18px 32px",
            borderRadius: 14,
            fontSize: 16,
            fontWeight: 600,
            textDecoration: "none",
            boxShadow: "0 8px 28px rgba(46,140,255,0.5)",
          }}
        >
          Start free <span style={{ fontSize: 18 }}>→</span>
        </Link>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────
// Footer
// ─────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer
      style={{
        padding: "32px 24px 40px",
        borderTop: `1px solid ${T.lightBorder}`,
        background: T.lightBg,
      }}
    >
      <div
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <Wordmark size={16} />
        <div style={{ display: "flex", gap: 18, fontSize: 13, color: T.lightMuted }}>
          <Link href="/privacy" style={{ color: T.lightMuted, textDecoration: "none" }}>
            Privacy
          </Link>
          <Link href="/terms" style={{ color: T.lightMuted, textDecoration: "none" }}>
            Terms
          </Link>
          <a
            href="mailto:henry@getquarterback.com"
            style={{ color: T.lightMuted, textDecoration: "none" }}
          >
            Contact
          </a>
        </div>
      </div>
    </footer>
  );
}

// ─────────────────────────────────────────────────────────────────
// Icons
// ─────────────────────────────────────────────────────────────────

function CalendarPlusIcon({ color }: { color: string }) {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x={3} y={5} width={18} height={16} rx={2.5} />
      <line x1={3} y1={10} x2={21} y2={10} />
      <line x1={8} y1={3} x2={8} y2={7} />
      <line x1={16} y1={3} x2={16} y2={7} />
      <line x1={12} y1={13} x2={12} y2={18} />
      <line x1={9.5} y1={15.5} x2={14.5} y2={15.5} />
    </svg>
  );
}

function CalendarSmallIcon({ color }: { color: string }) {
  return (
    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x={3} y={5} width={18} height={16} rx={2.5} />
      <line x1={3} y1={10} x2={21} y2={10} />
      <line x1={8} y1={3} x2={8} y2={7} />
      <line x1={16} y1={3} x2={16} y2={7} />
    </svg>
  );
}

function CheckIcon({ color }: { color: string }) {
  return (
    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 12 10 18 20 6" />
    </svg>
  );
}

function BankIcon({ color }: { color: string }) {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 10 12 4 21 10" />
      <line x1={3} y1={10} x2={21} y2={10} />
      <line x1={5} y1={10} x2={5} y2={20} />
      <line x1={9} y1={10} x2={9} y2={20} />
      <line x1={15} y1={10} x2={15} y2={20} />
      <line x1={19} y1={10} x2={19} y2={20} />
      <line x1={3} y1={20} x2={21} y2={20} />
    </svg>
  );
}

function SparkleIcon({ color }: { color: string }) {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill={color} stroke="none">
      <path d="M12 2 L13.6 9.6 L21 11.5 L13.6 13.4 L12 21 L10.4 13.4 L3 11.5 L10.4 9.6 Z" />
      <path d="M19 3 L19.7 5.4 L22 6 L19.7 6.6 L19 9 L18.3 6.6 L16 6 L18.3 5.4 Z" opacity={0.7} />
    </svg>
  );
}

function ChartIcon({ color }: { color: string }) {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <line x1={4} y1={20} x2={4} y2={12} />
      <line x1={10} y1={20} x2={10} y2={6} />
      <line x1={16} y1={20} x2={16} y2={14} />
      <line x1={22} y1={20} x2={22} y2={9} />
    </svg>
  );
}

function ShieldIcon({ color }: { color: string }) {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2 L20 5 V12 c0 5-3.5 8.5-8 10 c-4.5-1.5-8-5-8-10 V5 Z" />
    </svg>
  );
}

function StethoscopeIcon({ color }: { color: string }) {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 3v6a5 5 0 0 0 10 0V3" />
      <path d="M5 3h2M13 3h2" />
      <path d="M10 14v3a4 4 0 0 0 8 0v-2" />
      <circle cx={18} cy={11} r={2} />
    </svg>
  );
}
