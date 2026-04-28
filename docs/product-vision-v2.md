# QBH Product Vision V2: "Healthcare Changed for Good"

## The Feeling
Every time you open QBH, your life got a little more organized without you doing anything. The number goes up. The chaos goes down. You tell your friends.

---

## Phase 1: The Score + Dashboard Reset
**Impact: Highest | Effort: Medium | Dependencies: None**
**This is the emotional core. Everything else feeds into this.**

### 1A. Health Coordination Score Engine
- New `health_score` computed field on app_users (or computed on the fly)
- Scoring rules:
  - Provider added: +3
  - Overdue appointment booked: +10
  - Document uploaded: +5
  - Profile complete: +5 per section
  - Care recipient added: +3
  - Calendar connected: +5
  - Provider confirmed: +3
  - Zero overdue providers: +15 bonus
  - Provider overdue: -5/month
  - Care gap unaddressed: -2/month
  - Incomplete profile: -5
- Score range: 0-100 (capped)
- Score ring component: teal-to-gold gradient (matches logo), animated on change
- API: `/api/health-score` — computes and returns current score + breakdown

### 1B. Dashboard V3 — "Mission Control"
- **Top**: Greeting + Score Ring (big, center, animated)
- **Middle**: Kate's #1 suggestion (single card, not multiple)
- **Bottom**: Provider list (compact) + Week strip
- **Footer**: "What To Do Next" (2 cards max)
- Remove: multiple booking prompts, KateInsights cards, KateFollowUp, CareGaps as separate sections
- Consolidate: Kate's single suggestion incorporates the most important insight/gap/follow-up
- The dashboard should have breathing room — not feel like a newspaper

### 1C. Score Celebrations
- Score increase: subtle confetti or pulse animation
- Milestones: 50, 75, 90, 100 — each gets a unique Kate message
- Weekly summary push notification: "Your score: 87 (+12). 0 overdue."

---

## Phase 2: Conversational Onboarding
**Impact: Highest | Effort: High | Dependencies: None**
**This is the first impression. It determines if they stay.**

### 2A. Kate Chat Onboarding
Replace the 4-step survey with a conversational flow:

**Message 1 (Kate):**
> "Hey! I'm Kate, your care coordinator. Most people have 5-7 doctors and can't remember the last time they saw half of them. Sound familiar?"
> [Yeah, totally] [I'm pretty organized]

**Message 2 (Kate, based on response):**
> "No judgment — that's what I'm here for. I'll get everything organized and start handling the logistics. Who are you managing care for?"
> [Just me] [Me and my family]

**If family → Message 3:**
> "Got it! Tell me about your crew:"
> [+ Partner/Spouse] [+ Child] [+ Parent] [+ Someone else]
> [That's everyone →]

**Message 4 (Kate):**
> "Here's the cool part. I have three ways to find your doctors:"
>
> **Connect your bank** — I'll scan your co-pays and find every doctor you've seen. Secure, encrypted, read-only. (Powered by Plaid — used by 12,000+ banks.)
>
> **Connect your calendar** — I'll find past and future doctor appointments on your Google or Outlook calendar.
>
> **Add manually** — Know your doctors? Just type their names.
>
> [Connect bank] [Connect calendar] [Add manually] [I'll do all three]

**Message 5 (Kate, after selection):**
> "Almost there — let's create your account so I can save everything."
> [Name, email, password, DOB form — minimal, clean]

**Message 6 (Kate, during discovery):**
> "Scanning your records now..."
> ✓ Found: Dr. Eric Echelman, DDS — last co-pay 8 months ago
> ✓ Found: Vision Consultants of Wilton — last co-pay 11 months ago
> ✓ Found: Alma (Therapist) — last co-pay 2 weeks ago ✓ on track
>
> "I found 5 providers. 2 are overdue, 3 are on track."

**Message 7 (Kate, the reveal):**
> "Your Health Coordination Score: 34. Let's get that up."
> [Take me to my dashboard →]

### 2B. Discovery Reveal
- Providers appear one at a time with slide-in animation
- Each shows: name, credential, last visit, status (overdue/on track)
- Overdue items pulse amber, on-track glow green
- Score appears at the end with a dramatic counter animation (0 → 34)

### 2C. Provider Review (Simplified)
- Each discovered provider: name + "Is this a healthcare provider?" [Yes → assign person] [No → remove]
- Person assignment is one-click (tap "Me" or "Partner" etc. — no separate confirm button)
- No separate review page — inline in the chat flow

---

## Phase 3: Provider Hub
**Impact: High | Effort: High | Dependencies: Phase 1 (score)**
**This is the heart of the app. The thing they come back to.**

### 3A. Specialty-Based Grouping
- Providers grouped by specialty: Primary Care, Dental, Mental Health, Eye Care, Dermatology, Specialists, Pharmacy
- Each group is a collapsible section with the specialty color
- Within each section: clean provider cards (name, credential, last visit, status dot)
- Empty specialties show as "Add a [specialty]" placeholder

### 3B. Provider Detail Hub (tap to expand)
Each provider expands into a full hub with tabs or sections:
- **Overview**: name, phone, address, portal link, specialty
- **Visit History**: timeline of past visits with dates and Kate's notes
- **Documents**: uploaded labs, summaries, photos — stored in S3
- **Prep**: Kate's suggested questions for next visit (contextual, not generic)
- **Notes**: personal notes about this provider

### 3C. Per-Person View
- Care recipient pills at top (already exist)
- Clicking a person filters to ONLY their providers
- Shows that person's name: "Scarlett's Providers"
- Each person could have their own score sub-component

### 3D. Smart Provider Naming
- Auto-match transaction names to NPI/Google Places during discovery
- "We think this is Vision Consultants of Wilton. Is that right?" [Yes] [No, let me search]
- Show individual doctors at a practice: "Do you see Dr. Keneal or Dr. Ablamar?"
- Credentials after name: "Eric Echelman, DDS"

---

## Phase 4: Intelligence Layer
**Impact: High | Effort: Medium | Dependencies: Phase 3**
**This is what makes Kate feel like a genius.**

### 4A. Pre-Visit Prep (Contextual)
Before appointments, Kate generates prep based on:
- Previous visit notes (from after-visit prompts)
- Time since last visit
- Provider specialty
- Any uploaded documents since last visit
- Example: "Last time you saw Dr. Chen (March 15), you discussed lower back pain. You did 6 PT sessions after. Questions to consider: Has PT been enough? Do you need imaging?"

### 4B. Post-Visit Follow-up
After each appointment (detected via calendar or manual):
> "How did it go with Dr. Chen?"
> [Great, no follow-up needed]
> [New prescription] → "What was prescribed?"
> [Need to follow up] → "When should we book the next one?"
> [Add notes] → free text

This creates the data flywheel — each post-visit response makes the NEXT pre-visit prep better.

### 4C. Timeline as Narrative
Instead of a flat list by year, the timeline reads as prose:
> **2025**: You saw Dr. Chen 4 times for your back. She referred you to Dr. Park (orthopedic). After 6 PT sessions, you were cleared in September. You visited Dr. Echelman (dentist) in March — it's been 14 months.
>
> **2026**: Kate booked Dr. Echelman for May 3. Your therapy with Megan is on track (every 2 weeks). Vision Consultants is overdue.

### 4D. Smart Notifications
- "Your annual physical is coming up in 2 months — want me to book?"
- "Your dermatologist mentioned checking that mole in 6 months. That was 5 months ago."
- "You have an appointment with Dr. Chen tomorrow. Here's your prep."
- Weekly digest: "Score: 87 (+8). 1 appointment this week. 0 overdue."

---

## Phase 5: Growth & Evangelism
**Impact: Medium | Effort: Medium | Dependencies: Phase 1**
**This is what makes it spread.**

### 5A. Shareable Health Card
A beautiful card showing:
- Name, Score, provider count, overdue count
- "Healthcare Changed for Good"
- QBH branding
- One-tap share to Messages, Instagram story, etc.

### 5B. Family Dashboard
For family plan users:
- Overview showing all members with their scores
- "Jennifer: 92 ✓ | Steven: 67 ⚠ | Scarlett: 85 ✓"
- One-tap to switch between family member hubs

### 5C. Referral Flow
- "Know someone who needs this? Share QBH"
- Referral code for free month or extended trial
- "X people in your area use QBH"

### 5D. Weekly Email Digest
- Score change, upcoming appointments, achievements
- Beautiful email template matching app design
- One-click actions: "Book this" → opens app to booking

---

## Phase 6: Polish & Tier 1/2 Fixes
**Interleaved with above phases — quick wins done alongside big features**

All 52 items from Tier 1 + Tier 2 of the 75-item list, executed in batches between phases.

---

## Execution Sequence

### Sprint 1 (Now): Score + Dashboard
1. Build Health Coordination Score engine
2. Build Score Ring component (teal-gold animated)
3. Dashboard V3 — clean, score-centered
4. Tier 1 copy fixes (19 items, batch)

### Sprint 2: Conversational Onboarding
1. Kate chat onboarding flow
2. Discovery reveal (live feed, one-at-a-time)
3. Simplified provider review (one-click confirm)
4. Bank/Calendar/Manual options in conversation
5. Score reveal at end

### Sprint 3: Provider Hub
1. Specialty-based grouping
2. Provider detail hub (tabs: overview, history, documents, prep, notes)
3. Per-person filtering
4. Smart provider naming during discovery
5. Tier 2 fixes batch

### Sprint 4: Intelligence
1. Post-visit follow-up prompts
2. Pre-visit contextual prep
3. Timeline narrative view
4. Smart notifications (push)

### Sprint 5: Growth
1. Shareable health card
2. Family dashboard
3. Weekly email digest
4. Referral flow

---

## Success Metrics
- **Activation**: % of users who connect bank or add 3+ providers in first session
- **Score engagement**: % of users who increase score week-over-week
- **Booking conversion**: % of overdue providers that get booked via Kate
- **Retention**: weekly active users at 30/60/90 days
- **Virality**: referral rate, shareable card shares
- **NPS**: "How likely are you to recommend QBH?"

---

## The One-Liner Test
If a user can say this after 5 minutes with the app, we've won:

> "I connected my bank, it found all my doctors, told me which ones I'm overdue for, and offered to call and book them all. My health coordination score went from 34 to 87 in a week. I've never been this organized."
