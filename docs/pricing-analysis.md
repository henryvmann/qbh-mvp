# QBH Pricing Analysis

**Generated: 2026-04-21**
**Sources: measured voice-call data (43 test calls) + modeled assumptions**
**Re-run: `node scripts/pricing-scenarios.mjs`**
**Raw cost data: `node scripts/unit-economics.mjs`**

---

## Executive summary

At current cost structure, **QBH's COGS is $0.79–$4.09 per user per month** depending on tier. Voice (VAPI) is the dominant variable cost; OpenAI is meaningful but smaller; Plaid is the dominant fixed cost.

**Recommended launch pricing**: **Free / $24 Solo / $49 Family** (Option B).

At 10,000 users with a Realistic tier mix, Option B prints **$121k MRR and $94.8k gross profit per month (78.4% GM)**. Option A ($19/$39) prints **$96k MRR and $71.7k GP** — the $24 price point adds $23k/mo GP with no COGS change, enough to fund an additional engineer.

**The single most consequential decision in year 1 is the Solo price point.** $19 vs $29 is a **$46k/mo GP swing at 10k users** ($550k/yr). Don't guess — A/B test $19 / $24 / $29 in the onboarding paywall for the first 1000 paying users.

---

## Section 1 — Per-user monthly COGS by tier

Measured voice cost: **$0.1629 per connected VAPI call** (average of 43 test calls).

OpenAI models in use:
- **gpt-4o** ($2.50/1M in, $10.00/1M out): Kate chat (with tool calls), Kate prep
- **gpt-4o-mini** ($0.15/1M in, $0.60/1M out): insights, goals suggest, call-outcome classifier, transaction classifier, admin call-quality

| Tier | Voice | OpenAI | Plaid | Places | Infra | **TOTAL** |
|---|---|---|---|---|---|---|
| Free | $0.00 | $0.01 | $0.60 | $0.03 | $0.15 | **$0.79** |
| Solo (5 calls, 20 chat msgs/mo) | $0.81 | $0.32 | $0.60 | $0.03 | $0.15 | **$1.92** |
| Solo-heavy (12 calls, 50 chat msgs/mo) | $1.95 | $0.76 | $0.60 | $0.03 | $0.15 | **$3.50** |
| Family (15 calls, 5 recipients) | $2.44 | $0.61 | $0.60 | $0.14 | $0.30 | **$4.09** |

**Notes**:
- Free tier costs $0.79/user/mo — not zero. Plaid is the dominant line.
- Solo-heavy is the only tier under 80% margin at $19 price point — the edge case worth watching.
- Free numbers assume 3 insights/week (capped). Raising that ceiling increases free-user COGS.

---

## Section 2 — Gross margin per tier × price

Assumes blended payment rails: **60% Stripe web (2.9% + $0.30), 30% iOS (Apple 15%), 10% Android (Google 15%)**. Apple/Google Small Business Program applies (15% under $1M/yr).

| Option | Solo typical | Solo heavy | Family |
|---|---|---|---|
| **A: $19 / $39** | $15.43 GP (81.2%) | $13.85 GP (72.9%) | $31.71 GP (81.3%) |
| **B: $24 / $49** | $20.05 GP (83.5%) | $18.47 GP (76.9%) | $40.94 GP (83.5%) |
| **C: $29 / $59** | $24.66 GP (85.0%) | $23.08 GP (79.6%) | $50.16 GP (85.0%) |
| **D: $19 / $49** | $15.43 GP (81.2%) | $13.85 GP (72.9%) | $40.94 GP (83.5%) |

Every option prints strong margin. Solo-heavy is the lowest (73–80%) — watch if chat volumes run hotter than expected.

---

## Section 3 — MRR & Gross Profit at scale

### Realistic mix (60% Free / 30% Solo / 10% Family, ARPU in table)

| Users | A: $19/$39 | B: $24/$49 | C: $29/$59 | D: $19/$49 |
|---|---|---|---|---|
| 100 | $960 / $717 | $1.2k / $948 | $1.5k / $1.2k | $1.1k / $810 |
| 1,000 | $9.6k / $7.2k | $12.1k / $9.5k | $14.6k / $11.8k | $10.6k / $8.1k |
| 10,000 | $96k / $71.7k | $121k / $94.8k | **$146k / $117.9k** | $106k / $81.0k |
| 100,000 | $960k / $717k | $1.21M / $948k | **$1.46M / $1.18M** | $1.06M / $810k |

*Format: MRR / Gross Profit per month*

### Conservative mix (70% Free / 25% Solo / 5% Family)
10,000 users: MRR $67–102k, GP $47–80k depending on price option.

### Optimistic mix (50% Free / 36% Solo / 14% Family)
10,000 users: MRR $123–187k, GP $94–154k depending on price option.

**Interpretation**: at 100k users on Option C, QBH prints **$17.5M ARR at 81% GM**. Even conservative mix at $19/$39 is a real business — $670k MRR = $8M ARR at 100k users.

---

## Section 4 — Head-to-head GP impact (Realistic mix)

Additional GP per month vs. Option A ($19/$39) baseline:

| Scale | A → B (+$5 Solo, +$10 Family) | A → C (+$10 Solo, +$20 Family) | A → D (+$0 Solo, +$10 Family) |
|---|---|---|---|
| 1,000 users | +$2.3k/mo | +$4.6k/mo | +$0.9k/mo |
| 10,000 users | **+$23k/mo** | **+$46k/mo** | +$9k/mo |
| 100,000 users | +$231k/mo | +$463k/mo | +$92k/mo |

Raising Solo from $19 → $24 at 10k users = +$23k GP/mo with zero COGS change.

---

## Section 5 — Annual plan equivalents (20% discount)

Annual plans improve LTV/CAC, smooth churn, lock in users.

| Price Option | Solo annual | Equivalent monthly | Family annual | Equivalent monthly |
|---|---|---|---|---|
| A | $182/yr | $15.17/mo | $374/yr | $31.17/mo |
| **B (recommended)** | **$230/yr** | **$19.17/mo** | **$470/yr** | **$39.17/mo** |
| C | $278/yr | $23.17/mo | $566/yr | $47.17/mo |
| D | $182/yr | $15.17/mo | $470/yr | $39.17/mo |

---

## Section 6 — Break-even vs fixed team burn

Total users required (at Realistic 40% paid conversion) to cover monthly team burn.

| Team burn | Option A users | Option B | Option C | Option D |
|---|---|---|---|---|
| $20k/mo | 2,579 | 1,988 | 1,617 | 2,305 |
| $50k/mo (~4 person team + benefits) | 6,449 | 4,970 | 4,043 | 5,763 |
| $100k/mo | 12,897 | 9,940 | 8,086 | 11,526 |
| $200k/mo | 25,794 | 19,880 | 16,173 | 23,051 |

**Translation**: covering a $50k/mo team burn needs ~5k paying users on $24, ~6.5k on $19. Paying users = 40% of total → ~12–16k total users.

---

## Section 7 — Sensitivity (what moves the needle)

Base case: 10k users, $19/$39 Realistic mix. MRR = $96.0k, GP = $71.7k.

| Lever | Δ GP/mo |
|---|---|
| Solo $19 → $24 (+26% price) | **+$23k** |
| Solo $19 → $29 (+53% price) | **+$46k** |
| Conservative → Optimistic mix | +$23k |
| Optimistic → Conservative mix | −$24k |
| Kate chat doubles (20 → 40 msgs/mo) | **−$28k** (COGS rise from gpt-4o) |

**Two biggest levers: price and mix.** Chat volume is the biggest COGS risk — doubling chat erases most of a $19 → $24 price increase. Monitor chat usage closely after launch.

---

## Recommendation

### Launch structure
| Tier | Price | Annual | Includes |
|---|---|---|---|
| **Free** | $0 | — | Discovery, provider list, 3 insights/wk, calendar. No voice, no chat. |
| **Solo** | $24/mo | $230/yr ($19/mo eq.) | Unlimited Kate voice, full Kate chat, urgent care calling |
| **Family** | $49/mo | $470/yr ($39/mo eq.) | Up to 5 care recipients, priority booking queue |

### Why these prices (not $19/$39)

1. **Apple/Google fees bite.** 30% of users paying 15% platform fees means ~9% blended payment processing, not 3%. $24 absorbs this comfortably; $19 gets tight on Solo-heavy users (73% margin).
2. **QBH is a concierge, not a utility.** $19 is consumer-utility territory (RocketMoney $12, Copilot Money $13). QBH's value ("we handle the phone calls") warrants premium positioning at $24.
3. **$23k/mo GP lift at 10k users** funds an additional engineer or meaningful paid marketing spend.
4. **$24 stays below the "do I really need this?" $29 threshold** common in consumer healthcare-adjacent.
5. **Family buyers have higher willingness-to-pay** (managing partner/kids/parents is acute pain). $49 aligns with established family-plan pricing (Apple Family $23, Spotify Family $17, etc. — healthcare concierge for 5 people clears $39 easily).

### What to validate fast post-launch

- **A/B test $19 / $24 / $29 Solo** in onboarding paywall for first ~1000 paying users. The $46k/mo GP swing between $19 and $29 is the most consequential decision in year 1.
- **Measure Kate chat volume per paying user.** If median users run 40+ msgs/mo, GPT-4o COGS erodes margin meaningfully. Consider capping or moving some chat traffic to gpt-4o-mini.
- **Track Free → paid conversion rate** by week. If <25%, reconsider free tier depth; if >50%, you're leaving pricing power on the table.

### What's NOT yet in this model

- Churn & LTV (CAC payback requires this — recommend modeling next)
- Annual plan uptake mix (upfront revenue recognition)
- Customer support cost per ticket
- Stripe-to-Apple migration fees if users switch rails
- Potential B2B/employer tier (different sales motion, deferred)

---

## How to re-run this analysis

**Measured voice costs** (pulls from VAPI + Supabase):
```
node scripts/unit-economics.mjs
```

**Pricing scenarios** (uses measured voice cost + modeled assumptions):
```
node scripts/pricing-scenarios.mjs
```

All assumptions are in the top `ASSUMPTIONS` block of `scripts/pricing-scenarios.mjs` — edit to test your own scenarios (different chat volumes, different rail mix, different tier mix, etc.).

---

## Status

- [x] Cost model built with real voice data + current OpenAI models (gpt-4o for chat/prep, gpt-4o-mini for classifiers)
- [x] Four pricing options compared across three tier-mix scenarios
- [x] Break-even analysis done
- [ ] Pricing decision made (pending founder decision)
- [ ] Launch price implemented in checkout flow
- [ ] A/B test framework built for onboarding paywall
- [ ] Churn/LTV model (next step)
