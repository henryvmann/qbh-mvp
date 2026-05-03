"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Inter, Fraunces } from "next/font/google";
import { createClient } from "../../lib/supabase/client";

const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "600", "700"] });
const austin = Fraunces({ subsets: ["latin"], weight: ["400", "500", "600"] });

const T = {
  electric: "#1677FF",
  green: "#27C46B",
  lightBg: "#FAF8F4",
  white: "#FFFFFF",
  lightBorder: "#E5EAF2",
  lightText: "#071832",
  lightMuted: "#4F5F73",
};

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;

    try {
      setSubmitting(true);
      setError(null);
      setInfo(null);

      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) throw error;

      // Verify session is set before navigating, then small delay to
      // let the browser client write cookies.
      await supabase.auth.getSession();
      await new Promise((r) => setTimeout(r, 500));

      window.location.href = "/dashboard";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid email or password.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleForgot() {
    if (!email.trim()) {
      setError("Enter your email address first, then click Forgot password.");
      return;
    }
    try {
      setError(null);
      setInfo(null);
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/account`,
      });
      if (error) throw error;
      setInfo("Password reset link sent. Check your email.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send reset link.");
    }
  }

  return (
    <main
      className={inter.className}
      style={{
        minHeight: "100vh",
        background: T.lightBg,
        color: T.lightText,
        WebkitFontSmoothing: "antialiased",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <header
        style={{
          padding: "20px 24px",
          borderBottom: `1px solid ${T.lightBorder}`,
        }}
      >
        <Link href="/" style={{ textDecoration: "none" }}>
          <Wordmark size={20} />
        </Link>
      </header>

      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "48px 24px",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 420,
            background: T.white,
            border: `1px solid ${T.lightBorder}`,
            borderRadius: 24,
            padding: 32,
            boxShadow: "0 12px 36px rgba(7,24,50,0.08)",
          }}
        >
          <h1
            className={austin.className}
            style={{
              fontSize: 34,
              fontWeight: 500,
              letterSpacing: -0.6,
              lineHeight: 1.05,
              margin: 0,
              color: T.lightText,
            }}
          >
            Welcome back.
          </h1>
          <p
            style={{
              fontSize: 14.5,
              color: T.lightMuted,
              marginTop: 10,
              marginBottom: 24,
              lineHeight: 1.5,
            }}
          >
            Sign in to pick up where Kate left off.
          </p>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Field>
              <Label htmlFor="login-email">Email</Label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoFocus
                style={inputStyle}
              />
            </Field>

            <Field>
              <Label htmlFor="login-password">Password</Label>
              <div style={{ position: "relative" }}>
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  style={{ ...inputStyle, paddingRight: 56 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: "absolute",
                    right: 12,
                    top: "50%",
                    transform: "translateY(-50%)",
                    border: "none",
                    background: "transparent",
                    color: T.lightMuted,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </Field>

            <button
              type="submit"
              disabled={submitting || !email.trim() || !password.trim()}
              style={{
                marginTop: 4,
                background: T.electric,
                color: T.white,
                fontSize: 15,
                fontWeight: 600,
                padding: "14px 16px",
                borderRadius: 14,
                border: "none",
                cursor: submitting || !email.trim() || !password.trim() ? "not-allowed" : "pointer",
                opacity: submitting || !email.trim() || !password.trim() ? 0.6 : 1,
                boxShadow: "0 6px 20px rgba(22,119,255,0.28)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              {submitting ? "Signing in…" : (
                <>
                  Sign in <span style={{ fontSize: 16 }}>→</span>
                </>
              )}
            </button>

            {error && <Banner kind="error">{error}</Banner>}
            {info && <Banner kind="info">{info}</Banner>}
          </form>

          <div style={{ textAlign: "center", marginTop: 18 }}>
            <button
              type="button"
              onClick={handleForgot}
              style={{
                background: "none",
                border: "none",
                color: T.electric,
                fontSize: 13.5,
                fontWeight: 500,
                cursor: "pointer",
                textDecoration: "underline",
                textUnderlineOffset: 4,
              }}
            >
              Forgot password?
            </button>
          </div>

          <div
            style={{
              marginTop: 24,
              paddingTop: 18,
              borderTop: `1px solid ${T.lightBorder}`,
              textAlign: "center",
              fontSize: 13.5,
              color: T.lightMuted,
            }}
          >
            First time here?{" "}
            <Link
              href="/onboarding"
              style={{
                color: T.electric,
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Create your account
            </Link>
          </div>
        </div>
      </div>
    </main>
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

function Field({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {children}
    </div>
  );
}

function Label({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label
      htmlFor={htmlFor}
      style={{
        fontSize: 12,
        fontWeight: 600,
        color: T.lightMuted,
        letterSpacing: 0.2,
      }}
    >
      {children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 46,
  borderRadius: 12,
  border: `1px solid ${T.lightBorder}`,
  background: T.white,
  padding: "0 14px",
  fontSize: 15,
  color: T.lightText,
  outline: "none",
  boxSizing: "border-box",
};

function Banner({
  kind,
  children,
}: {
  kind: "error" | "info";
  children: React.ReactNode;
}) {
  const palette =
    kind === "error"
      ? { bg: "rgba(224,64,48,0.08)", border: "rgba(224,64,48,0.25)", fg: "#9D2C20" }
      : { bg: "rgba(39,196,107,0.08)", border: "rgba(39,196,107,0.25)", fg: "#1B7B45" };
  return (
    <div
      style={{
        background: palette.bg,
        color: palette.fg,
        border: `1px solid ${palette.border}`,
        borderRadius: 12,
        padding: "10px 14px",
        fontSize: 13.5,
        lineHeight: 1.45,
      }}
    >
      {children}
    </div>
  );
}
