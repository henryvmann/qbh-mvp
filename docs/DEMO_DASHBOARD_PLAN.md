# QBH Demo Dashboard Plan

**Quarterback Health — Health OS Demo Expansion**

Owner: Henry Mann
Date: March 2026

---

# Objective

Expand the QBH dashboard to demonstrate both:

1. **Current working functionality**

   * Provider detection
   * AI scheduling agent
   * Live booking loop

2. **Future platform vision**

   * Health Memory
   * AI Intelligence
   * Care Coordination
   * Medication Management
   * Caregiver Network

The dashboard should feel like a **complete Health Operating System**, even if some sections use seeded demo data.

---

# Dashboard Architecture

The dashboard becomes the **control center for the Health OS**.

## Main Sections

1. Daily Brief
2. Goals
3. Upcoming Care
4. Providers
5. Timeline (Health Memory)
6. AI Insights
7. Medications
8. Caregivers

---

# Dashboard Layout

## Row 1 — Daily Brief (Hero)

Purpose: Immediate context for the user.

Example:

```
Daily Brief

You have 1 care task that needs attention.

Cardiology follow-up recommended.

[ Handle It ]
[ View Care Plan ]
```

Primary CTA: **Handle It**

This launches the **AI scheduling agent**.

---

## Row 2 — Goals + Upcoming Care

### Goals

Example:

```
Health Goals

• Complete annual physical
• Maintain healthy cholesterol
• Stay on top of preventive care
```

Purpose: Sell the long-term OS concept.

---

### Upcoming Care

Example:

```
Upcoming Care

Cardiology follow-up
Recommended window: next 2 weeks
Status: Not scheduled
```

CTA: **Handle It**

---

# Row 3 — Providers

Grid of provider cards.

Example card:

```
Stamford Health
Cardiology

Last visit: June 2025
Status: Follow-up recommended

[ Handle It ]
[ View Timeline ]

Portal: MyChart (Connected)
```

Sources of providers:

* Plaid transaction detection
* Portal connection
* Manual add

---

# Row 4 — Timeline + AI Insights

## Timeline Preview (Health Memory)

Example:

```
Mar 2026
Cardiology follow-up scheduled

Jan 2026
Blood panel — Quest Diagnostics

Nov 2025
Annual physical
```

CTA: **Open Timeline**

---

## AI Insights

Example:

```
Insights

• Your last cardiology visit was 9 months ago
• Cholesterol has increased 12% since last lab
• Follow-up recommended
```

CTA: **View Insights**

---

# Row 5 — Medications + Caregivers

## Medications

Example:

```
Atorvastatin
Vitamin D

Next refill: 18 days
```

CTA: **Open Medications**

---

## Caregivers

Example:

```
Jenny Mann
Appointment coordination

No additional caregivers added
```

CTA: **Manage Caregivers**

---

# Dashboard Routes

## Core Product Flow

```
/                → Home
/start           → Household Setup
/connect         → Financial + portal connection
/dashboard       → Main Health OS
```

---

## Future Platform Pages

```
/timeline        → Health Memory
/insights        → AI Intelligence
/care-plan       → Care Coordination
/medications     → Medication system
/caregivers      → Caregiver network
```

These pages can initially use **seeded demo data**.

---

# Component Structure

Recommended reusable components:

```
components/qbh/

DashboardHero.tsx
GoalCard.tsx
UpcomingCareCard.tsx
ProviderCard.tsx
TimelinePreview.tsx
InsightsPreview.tsx
MedicationPreview.tsx
CaregiverPreview.tsx
```

---

# Demo Data Strategy

Create a demo data file:

```
src/lib/QBH/demo/demoData.ts
```

Example structure:

```ts
export const demoTimeline = [
  {
    date: "2026-03-10",
    title: "Cardiology follow-up scheduled",
    provider: "Stamford Health"
  },
  {
    date: "2026-01-12",
    title: "Blood panel",
    provider: "Quest Diagnostics"
  }
]

export const demoInsights = [
  "Your last cardiology visit was 9 months ago",
  "Your LDL cholesterol has increased slightly",
  "A follow-up visit may be recommended"
]

export const demoMedications = [
  "Atorvastatin",
  "Vitamin D"
]
```

These power the **future platform sections**.

---

# Real Integrations

## Plaid (Provider Discovery)

Purpose:

Detect providers from healthcare transactions.

Example providers detected:

* Stamford Health
* CVS Pharmacy
* Quest Diagnostics
* Urgent Care

Outcome:

Provider cards automatically populate.

---

## MyChart Portal Connection

Target portal:

https://mychart.stamfordhealth.org/

Demo objective:

Show at least one real portal connection.

Possible surfaced data:

* upcoming appointment
* past visit
* lab result
* provider record

Even limited data is sufficient for demo credibility.

---

# Demo Illusions (Safe Fake Features)

Acceptable demo data:

* AI visit summaries
* health score
* medication list
* care tasks
* caregiver network
* timeline history

These should appear **consistent with real integrations**.

---

# Implementation Plan

## Phase 1 — Dashboard Layout

1. Redesign `/dashboard` page
2. Add sections:

   * Daily Brief
   * Goals
   * Upcoming Care
   * Providers
   * Timeline preview
   * AI Insights preview
   * Medications preview
   * Caregivers preview

---

## Phase 2 — Future Pages

Create shell routes:

```
/timeline
/insights
/care-plan
/medications
/caregivers
```

Populate with demo data.

---

## Phase 3 — Demo Data Layer

Create:

```
src/lib/QBH/demo/demoData.ts
```

Seed:

* timeline events
* insights
* medications
* caregivers
* care tasks

---

## Phase 4 — Plaid Integration

Once approved:

1. Implement account connection flow
2. Parse transactions
3. Infer providers
4. Populate provider cards

---

## Phase 5 — Portal Connection

Attempt Stamford Health MyChart connection.

Demo goal:

Display:

```
Portal Connected
Last Sync: Today
```

Even partial data is valuable.

---

# Demo Narrative

The demo should show:

1. Connect financial account
2. QBH detects providers
3. QBH builds health timeline
4. QBH identifies care gaps
5. QBH schedules appointment automatically
6. QBH explains health insights

---

# End State

The dashboard should communicate:

* QBH understands your providers
* QBH understands your health timeline
* QBH identifies care needs
* QBH takes action automatically

Quarterback Health becomes:

**The operating system that manages healthcare on behalf of the patient.**

---
