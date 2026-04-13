"use client";

import { useState, useEffect } from "react";

const STORAGE_KEY = "qbh_admin_auth";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored === "true") {
      setAuthed(true);
    }
    setChecking(false);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(false);

    const res = await fetch("/api/admin/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (res.ok) {
      sessionStorage.setItem(STORAGE_KEY, "true");
      setAuthed(true);
    } else {
      setError(true);
    }
  }

  if (checking) {
    return <div className="min-h-screen" style={{ background: "linear-gradient(180deg, #D8E8F5 0%, #E8EFF5 40%, #F5F5F5 100%)" }} />;
  }

  if (!authed) {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        style={{ background: "linear-gradient(180deg, #D8E8F5 0%, #E8EFF5 40%, #F5F5F5 100%)" }}
      >
        <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-2xl bg-white border border-[#EBEDF0] shadow-sm p-8">
          <h1 className="text-xl font-semibold text-[#1A1D2E]">Admin Access</h1>
          <p className="mt-1 text-sm text-[#7A7F8A]">Enter the admin password to continue.</p>

          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoFocus
            className="mt-6 w-full rounded-xl bg-[#F0F2F5] border border-[#EBEDF0] px-4 py-3 text-sm text-[#1A1D2E] placeholder:text-[#B0B4BC] focus:outline-none focus:ring-1 focus:ring-[#5C6B5C]"
          />

          {error && (
            <div className="mt-2 text-xs text-red-600">Incorrect password</div>
          )}

          <button
            type="submit"
            className="mt-4 w-full rounded-xl px-4 py-3 text-sm font-semibold text-white"
            style={{ background: "linear-gradient(135deg, #5C6B5C, #4A5A4A)" }}
          >
            Enter
          </button>
        </form>
      </div>
    );
  }

  return <>{children}</>;
}
