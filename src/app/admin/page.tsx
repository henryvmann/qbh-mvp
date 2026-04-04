"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "../../lib/api";

type AdminUser = {
  app_user_id: string;
  name: string | null;
  email: string | null;
  created_at: string;
  survey_answers: any | null;
  plaid_connected: boolean;
  calendar_connected: boolean;
  providers_total: number;
  providers_active: number;
  providers_dismissed: number;
  providers_review: number;
  visits_count: number;
  booking_attempts: number;
  last_activity: string | null;
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function Badge({ yes, label }: { yes: boolean; label: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 4,
        fontSize: 12,
        fontWeight: 600,
        backgroundColor: yes ? "rgba(212,168,67,0.2)" : "rgba(255,255,255,0.06)",
        color: yes ? "#7BA59A" : "#6B7280",
        border: `1px solid ${yes ? "rgba(212,168,67,0.3)" : "rgba(255,255,255,0.08)"}`,
      }}
    >
      {label}: {yes ? "Yes" : "No"}
    </span>
  );
}

function SurveyAnswers({ answers }: { answers: any }) {
  if (!answers || typeof answers !== "object") {
    return <span style={{ color: "#6B7280" }}>No survey data</span>;
  }

  const entries = Object.entries(answers);
  if (entries.length === 0) {
    return <span style={{ color: "#6B7280" }}>No survey data</span>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {entries.map(([key, value]) => (
        <div key={key} style={{ fontSize: 13 }}>
          <span style={{ color: "#9CA3AF" }}>{key}:</span>{" "}
          <span style={{ color: "#E5E7EB" }}>
            {typeof value === "object" ? JSON.stringify(value) : String(value)}
          </span>
        </div>
      ))}
    </div>
  );
}

function UserCard({ user }: { user: AdminUser }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      onClick={() => setExpanded(!expanded)}
      style={{
        backgroundColor: "rgba(255,255,255,0.05)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 8,
        padding: 16,
        cursor: "pointer",
        transition: "border-color 0.15s",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#7BA59A")}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)")}
    >
      {/* Collapsed row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto",
          gap: 12,
          alignItems: "center",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ color: "#F9FAFB", fontWeight: 600, fontSize: 15 }}>
              {user.name || "Unknown"}
            </span>
            <span style={{ color: "#6B7280", fontSize: 13 }}>
              {user.email || "no email"}
            </span>
          </div>
          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              marginTop: 8,
              alignItems: "center",
            }}
          >
            <span style={{ color: "#9CA3AF", fontSize: 12 }}>
              Signed up {formatDate(user.created_at)}
            </span>
            <span style={{ color: "#7BA59A", fontSize: 13, fontWeight: 600 }}>
              {user.providers_total} providers
            </span>
            <Badge yes={user.plaid_connected} label="Plaid" />
            <Badge yes={user.calendar_connected} label="Calendar" />
          </div>
        </div>
        <div style={{ color: "#6B7280", fontSize: 18 }}>
          {expanded ? "\u25B2" : "\u25BC"}
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div
          style={{
            marginTop: 16,
            paddingTop: 16,
            borderTop: "1px solid rgba(255,255,255,0.08)",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 16,
          }}
        >
          <div>
            <div style={{ color: "#9CA3AF", fontSize: 12, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>
              Provider Breakdown
            </div>
            <div style={{ color: "#E5E7EB", fontSize: 14, lineHeight: 1.6 }}>
              Active: {user.providers_active}<br />
              Dismissed: {user.providers_dismissed}<br />
              Review needed: {user.providers_review}<br />
              Total: {user.providers_total}
            </div>
          </div>

          <div>
            <div style={{ color: "#9CA3AF", fontSize: 12, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>
              Activity
            </div>
            <div style={{ color: "#E5E7EB", fontSize: 14, lineHeight: 1.6 }}>
              Visits: {user.visits_count}<br />
              Booking attempts: {user.booking_attempts}<br />
              Last activity: {formatDate(user.last_activity)}
            </div>
          </div>

          <div>
            <div style={{ color: "#9CA3AF", fontSize: 12, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>
              Connections
            </div>
            <div style={{ color: "#E5E7EB", fontSize: 14, lineHeight: 1.6 }}>
              Plaid: {user.plaid_connected ? "Connected" : "Not connected"}<br />
              Calendar: {user.calendar_connected ? "Connected" : "Not connected"}
            </div>
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <div style={{ color: "#9CA3AF", fontSize: 12, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>
              Survey Answers
            </div>
            <SurveyAnswers answers={user.survey_answers} />
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <div style={{ color: "#6B7280", fontSize: 11 }}>
              App User ID: {user.app_user_id}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminPage() {
  const router = useRouter();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await apiFetch("/api/admin/users");
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        if (!res.ok) {
          setError(`API error: ${res.status}`);
          return;
        }
        const json = await res.json();
        if (!json.ok) {
          setError(json.error || "Unknown error");
          return;
        }
        setUsers(json.users);
      } catch (err: any) {
        setError(err.message || "Failed to load data");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router]);

  const totalUsers = users.length;
  const usersWithPlaid = users.filter((u) => u.plaid_connected).length;
  const usersWithCalendar = users.filter((u) => u.calendar_connected).length;
  const totalBookings = users.reduce((sum, u) => sum + u.booking_attempts, 0);

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#1A1D23",
        color: "#F9FAFB",
        padding: "24px 16px",
      }}
    >
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
          <Link
            href="/dashboard"
            style={{
              color: "#7BA59A",
              textDecoration: "none",
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            &larr; Dashboard
          </Link>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>
            Admin — User Report
          </h1>
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: "center", padding: 60 }}>
            <div
              style={{
                width: 32,
                height: 32,
                border: "3px solid rgba(255,255,255,0.08)",
                borderTopColor: "#7BA59A",
                borderRadius: "50%",
                animation: "spin 0.8s linear infinite",
                margin: "0 auto 12px",
              }}
            />
            <div style={{ color: "#9CA3AF" }}>Loading user data...</div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div
            style={{
              backgroundColor: "rgba(239,68,68,0.1)",
              border: "1px solid rgba(239,68,68,0.3)",
              borderRadius: 8,
              padding: 16,
              color: "#FCA5A5",
              textAlign: "center",
            }}
          >
            {error}
          </div>
        )}

        {/* Content */}
        {!loading && !error && (
          <>
            {/* Summary stats */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                gap: 12,
                marginBottom: 24,
              }}
            >
              {[
                { label: "Total Users", value: totalUsers },
                { label: "Plaid Connected", value: usersWithPlaid },
                { label: "Calendar Connected", value: usersWithCalendar },
                { label: "Total Bookings", value: totalBookings },
              ].map((stat) => (
                <div
                  key={stat.label}
                  style={{
                    backgroundColor: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 8,
                    padding: "16px 20px",
                    textAlign: "center",
                  }}
                >
                  <div style={{ color: "#7BA59A", fontSize: 28, fontWeight: 700 }}>
                    {stat.value}
                  </div>
                  <div style={{ color: "#9CA3AF", fontSize: 13, marginTop: 4 }}>
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>

            {/* User list */}
            {users.length === 0 ? (
              <div style={{ textAlign: "center", color: "#6B7280", padding: 40 }}>
                No users found.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {users.map((user) => (
                  <UserCard key={user.app_user_id} user={user} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
