# DudduKaasu — Product & Design Roadmap

> Last updated: June 2025  
> Authors: Selva + Akshaya (via Claude PM/Design review)

---

## Executive Summary

DudduKaasu is a private family finance tracker for Selva (Microsoft/MSFT RSUs) and Akshaya (Nvidia/NVDA RSUs). It currently does a solid job of tracking holdings, income, expenses, and retirement planning. This roadmap captures identified gaps and improvements, ordered by impact and implementation effort.

**The north star:** On any given morning, opening DudduKaasu should answer "how are we doing?" in one glance — net worth trend, this month's pace, upcoming RSU cash, goal progress. Everything else is depth on demand.

---

## Current Tab Structure → Proposed Structure

### Current (6 flat tabs — all equal weight)
```
Daily Expenses | Income | Investments | Expenses | Portfolio | Retirement Plan
```

### Proposed (grouped, with clear hierarchy)
```
Dashboard  |  Spending (Transactions · Budget)  |  Wealth (Portfolio · Investments)  |  Future (Retirement)
```

**Also rename:**

| Current Name     | New Name        | Reason                                                                 |
|------------------|-----------------|------------------------------------------------------------------------|
| Daily Expenses   | Transactions    | "Daily" is misleading — entries can be for any date                   |
| Expenses         | Budget          | Signals intent — this is planning, not just logging                   |
| Retirement Plan  | Future          | Encompasses child education + goals, not just retirement              |

---

## Phase 0 — Quick Wins (No backend changes, < 1 day each)

These can be done in any order. They have zero risk and immediate UX payoff.

### 0-A · Tab Rename
Rename "Daily Expenses" → "Transactions" and "Expenses" → "Budget".  
Update `TABS` array in `src/lib/constants.js`. No data migration needed.

**Effort:** 30 min  
**Impact:** Eliminates the mental model confusion that caused the ₹6,800 sync bug

---

### 0-B · Persistent Person Filter Across Tabs
Currently the person filter (Selva / Akshaya / All) resets to "All" every time you switch tabs. It should be a single app-level state that persists.

- Lift `personFilter` state from PortfolioTab into `FamilyFinanceTracker.jsx`
- Pass as prop to Portfolio, Investments, RSU tabs
- Store in `localStorage` so it survives refresh

**Effort:** 2 hr  
**Impact:** Removes the friction of re-filtering every tab switch

---

### 0-C · Spending Pace Indicator in Transactions Header
Add one line to the top of the Transactions tab:

```
May 2025 · Day 18 of 31 · ₹67,400 spent · 71% of budget at 58% of month  ⚠ Slightly over
```

Colour: green (pace ≤ 90%), amber (90–110%), red (>110%).

**Effort:** 1 hr  
**Impact:** Instant visibility into whether this month is on track

---

### 0-D · Holdings Sort Options
Currently holdings are in insertion order. Add a sort control:  
Value (default) / 1D Change / Unrealised Gain % / Asset Type

**Effort:** 1 hr  
**Impact:** Makes the Portfolio tab much more scannable

---

### 0-E · RSU Vest Countdown Strip
In the RSU tab (and eventually Dashboard), surface the next 3 upcoming vests as a compact horizontal strip above the grant list:

```
┌─────────────────────────────────────────────────────────────────┐
│ Next Vests                                                      │
│ 🔵 MSFT 50u · Jun 15 · ~₹15.2L net  │  in 23 days             │
│ 🟣 NVDA 25u · Aug 01 · ~₹7.8L net   │  in 70 days             │
└─────────────────────────────────────────────────────────────────┘
```

**Effort:** 2 hr  
**Impact:** Cash flow planning — know when money is coming before it arrives

---

### 0-F · Semantic Colour Fix
Currently `T.accent` (green #22C55E) is used for: active tabs, CTA buttons, net worth numbers, gains, on-track states, chart bars. When everything is green, nothing stands out.

Proposed split in `src/lib/theme.js`:

```js
// Current
T.accent = "#22C55E"   // used for everything

// Proposed semantic split
T.positive = "#22C55E" // gains, on-track — green stays here ONLY
T.cta      = "#6366F1" // buttons, interactive states → indigo
T.info     = "#3B82F6" // informational highlights → existing blue (no change)
T.warn     = "#F59E0B" // caution states → existing amber (no change)
T.danger   = "#EF4444" // losses, over budget → existing red (no change)
```

Apply `T.cta` to all action buttons, `T.positive` only to gain/success states.

**Effort:** 2 hr  
**Impact:** Visual hierarchy becomes readable at a glance

---

### 0-G · Number Count-Up Animation on Price Load
When prices load, numbers jump from `—` to final value instantly. A 300ms count-up makes the app feel premium and alive.

```js
// Reusable hook — ~20 lines, zero dependencies
function useCountUp(target, duration = 300) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!target) return;
    const steps = 20;
    const inc = target / steps;
    let i = 0;
    const t = setInterval(() => {
      i++;
      setVal(Math.min(inc * i, target));
      if (i >= steps) clearInterval(t);
    }, duration / steps);
    return () => clearInterval(t);
  }, [target]);
  return val;
}
```

**Effort:** 2 hr  
**Impact:** Feels like a financial product, not a spreadsheet

---

### 0-H · Keyboard Shortcuts
```
Cmd/Ctrl + 1–6   → switch tabs
Cmd/Ctrl + N     → new transaction (on Transactions tab)
Cmd/Ctrl + ←/→  → prev/next FY
```

**Effort:** 1 hr  
**Impact:** Power-user quality of life

---

## Phase 1 — Dashboard (Week 1, ~2 days total)

**This is the highest-priority feature build.**  

The Dashboard answers every "how are we doing?" question in one screen. All the data already exists — this is purely a surfacing/composition task.

### What the Dashboard shows

```
┌─────────────────────────────────────────────────────────────────────┐
│  Good morning, Selva & Akshaya                     Jun 4, 2025      │
│                                                                     │
│  Net Worth            FY Change                 Today              │
│  ₹2.43 Cr             +₹59L (+32%)              ▼ −₹1.2L (−0.5%)  │
│  [───────────────────────────────────────────────────────] sparkline│
│  Apr ──── Jun ──── Aug ──── Oct ──── Dec ──── Feb ──── Apr          │
├─────────────────────────────────────────────────────────────────────┤
│  May 2025                                                           │
│  Earned ₹3.12L  │  Spent ₹87,400  │  Invested ₹1.2L  │  Saved 34%│
│  [═══════════════════════════════] Day 18 of 31 · Pace: ✓ on track  │
├─────────────────────────────────────────────────────────────────────┤
│  Goals                          │  Next RSU Vests                  │
│  ○ Child Edu    23% ▓▓░░░░░░    │  MSFT 50u · Jun 15 · ~₹15.2L   │
│  ○ Downpayment  61% ▓▓▓▓▓▓░░   │  NVDA 25u · Aug 01 · ~₹7.8L    │
└─────────────────────────────────────────────────────────────────────┘
```

### Implementation plan

**1-A · Net Worth History snapshots (backend first)**

Store a daily snapshot in Supabase (or `localStorage` fallback):
```js
// Add to retirementData or a new nw_history key in persisted data
nwHistory: [
  { date: "2025-04-01", value: 18400000 },
  { date: "2025-05-01", value: 21200000 },
  // ...
]
```
On app load, if today's snapshot doesn't exist, append one. Cap at 24 months.

**1-B · Dashboard component**

New file: `src/components/dashboard/DashboardTab.jsx`

Sections (each its own sub-component):
- `NetWorthHero` — big number + sparkline from nwHistory
- `MonthSummary` — income/spent/invested/saved for current month + pace bar
- `GoalProgressRings` — SVG rings for each active goal
- `UpcomingVests` — next 3 RSU vests (reuse logic from 0-E)
- `PortfolioPulse` — 1D change badge (reuse from PortfolioTab)

**1-C · Add Dashboard as first tab**

Update `TABS` in constants.js. Dashboard becomes the landing tab instead of Transactions.

**Effort:** 2 days  
**Files changed:** `constants.js`, `FamilyFinanceTracker.jsx`, new `src/components/dashboard/`  
**Risk:** Low — purely additive, no existing tabs touched

---

## Phase 2 — Budget Limits & Spending Intelligence (Week 2, ~1.5 days)

### 2-A · Per-Category Budget Caps

Add a `budgetLimits: { [categoryId]: amount }` field to expensesData (persisted).

In the Budget tab, each category row becomes:

```
Grocery    ▓▓▓▓▓▓▓▓░░  ₹12,400 / ₹15,000   83%  ✓
Shopping   ▓▓▓▓▓▓▓▓▓▓▓ ₹18,900 / ₹15,000  126%  ⚠ ₹3,900 over
Vacation   ▓░░░░░░░░░░  ₹3,200  / ₹20,000   16%  ✓
```

Budget limits are editable inline (click the limit number to edit).

**Effort:** 4 hr  
**Files:** `ExpensesTab.jsx`, `FamilyFinanceTracker.jsx` (persist)

---

### 2-B · Committed vs Discretionary Spending

Tag transactions as "committed" (rent, EMI, SIPs, subscriptions — recurring fixed costs). The Transactions header then shows:

```
Total Income ₹3.12L
  − Committed ₹1.45L  (Rent · SIPs · EMI — auto-detected or manually flagged)
  = Discretionary ₹1.67L  ← what you actually control
    Used so far: ₹42,400 (25%)
```

**Effort:** 4 hr  
**Files:** `DailyExpensesTab.jsx` (add `committed` boolean to tx schema), `FamilyFinanceTracker.jsx`

---

### 2-C · Monthly Financial Summary Card

At the end of each month (or on demand), auto-generate a summary:

```
May 2025 Summary
────────────────────────────────────────
Household Income     ₹3,12,000
  Expenses           ₹87,400    (28%)
  Invested           ₹1,20,000  (38%)
  Net Savings        ₹1,04,600  (34%)  ↑ +3% vs Apr
────────────────────────────────────────
Savings rate: 34%  │  FY avg: 31%  →  Best month this FY ✓
Best category:  Grocery  (₹2,100 under budget)
Watch:          Shopping (₹3,900 over budget)
```

Accessible from the Dashboard and Budget tab.

**Effort:** 3 hr  
**Files:** New `MonthSummary.jsx` component, shared between Dashboard and Budget tab

---

## Phase 3 — Goal Earmarking & Progress (Week 3, ~1 day)

This is the pending item from the original backlog (item 3 — earmark assets to goals).

### 3-A · Goal-to-Asset Earmarking

Add an optional `earmark` field to each holding: `null | "child_edu" | "downpayment" | "retirement"`.

In the Portfolio Holdings view, show a subtle tag on earmarked assets:
```
HDFC Mid Cap Fund   ₹4.8L   [🎓 Child Edu]
Kotak Equity        ₹6.2L   [🏠 Downpayment]
MSFT (150 units)    ₹38L    [🛡 Retirement]
```

### 3-B · Goal Progress Calculation

For each goal, compute:
```
goal_current  = sum of currentValue for all earmarked holdings
goal_target   = child_edu FV target / downpayment target / retirement corpus
goal_pct      = goal_current / goal_target
```

Show as rings on Dashboard + dedicated progress view in Investments tab.

### 3-C · Filter Portfolio by Goal

Add "Goal" as a filter option in Portfolio Holdings:
```
All | Selva | Akshaya | 🎓 Child Edu | 🏠 Downpayment | 🛡 Retirement
```

**Effort:** 1 day  
**Files:** `AddHoldingForm.jsx`, `HoldingCard.jsx`, `PortfolioTab.jsx`, `InvestmentsTab.jsx`, `DashboardTab.jsx`

---

## Phase 4 — Capital Gains & Tax Intelligence (Week 4, ~1.5 days)

This connects two things that already exist but don't talk to each other: the TaxTab (income tax slabs) and the Portfolio (cost basis + purchase dates).

### 4-A · STCG / LTCG Calculation

For each holding with known purchase date + cost basis, compute:
```
holding_age = today − purchase_date (days)
is_ltcg     = holding_age > 365

stcg_gain   = currentValue − costBasis  (where age < 365)
ltcg_gain   = currentValue − costBasis  (where age ≥ 365)

STCG tax  = stcg_gain × 15%  (flat rate, no exemption)
LTCG tax  = max(0, ltcg_gain − 100000) × 10%  (₹1L exemption for equity)
```

### 4-B · Tax-Loss Harvesting Opportunities

Surface holdings with unrealised losses that could be booked to offset gains:

```
Tax-Loss Harvesting  (FY closes Mar 31, 2026 — 300 days remaining)
─────────────────────────────────────────────────────────────────
Sell these to reduce tax burden:
  Parag Parikh Flexi   −₹12,400 loss  → offsets ₹12,400 of gains  → saves ₹1,240 tax
  HDFC Small Cap        −₹8,200 loss  → offsets ₹8,200 of gains   → saves ₹820 tax

Net LTCG exposure after harvesting: ₹43,200 (tax: ₹4,320 after ₹1L exemption)
```

### 4-C · Add to TaxTab

Add a "Capital Gains" section to TaxTab (after existing income tax calculation):
- STCG summary + estimated tax
- LTCG summary + ₹1L exemption + estimated tax
- Harvesting opportunities
- Total tax estimate (income tax + capital gains tax)

**Effort:** 1.5 days  
**Files:** `TaxTab.jsx`, new `src/lib/capitalGains.js`

---

## Phase 5 — Net Worth Completeness (Week 5, ~1 day)

### 5-A · Liabilities Tracking

Add a simple liabilities section to the Portfolio / Net Worth view:
```js
liabilities: [
  { name: "Home Loan", outstanding: 8200000, emi: 65000 },
  { name: "Car Loan",  outstanding: 0 },
]
```

True Net Worth = Assets − Liabilities. Currently the app only shows assets.

### 5-B · Insurance Coverage Tracker

Add a simple insurance register (not calculations — just awareness):
```js
insurance: [
  { person: "Selva",   type: "Life",   provider: "LIC",    cover: 10000000, premium: 24000 },
  { person: "Akshaya", type: "Life",   provider: "HDFC",   cover: 7500000,  premium: 18000 },
  { person: "Family",  type: "Health", provider: "Star",   cover: 1000000,  premium: 32000 },
]
```

Show in a dedicated section: coverage adequacy (common rule: 10× annual income for life), renewal dates, total annual premiums.

**Effort:** 1 day  
**Files:** New `InsuranceSection.jsx`, `FamilyFinanceTracker.jsx` (new state), `NetWorthTab.jsx`

---

## Phase 6 — Scenario Planning (Week 6, ~2 days)

### 6-A · What-If Simulator in Retirement Tab

Add a "Scenarios" sub-tab to Retirement with 4–6 preset shocks that re-run the lifetime plan:

| Scenario | What changes |
|---|---|
| MSFT/NVDA drops 30% (stays) | Portfolio value shock, RSU projection cut |
| Buy house 2026 vs 2028 | Change home loan start date, compare total interest + corpus |
| Second child | Add second child SIP, push goals 2 years |
| Sabbatical 1 year | Remove 1yr income from Selva |
| Retire 2 years early | Shift retirement date, see corpus gap |
| SIP increase +₹10K/mo | Show accelerated corpus build |

Each scenario shows: new verdict (closes/doesn't close), delta vs baseline, key tradeoffs.

### 6-B · Sensitivity Table

For the Lifetime Plan, add a 5×5 sensitivity grid:

```
                    Salary Growth
                 6%    8%    10%   12%   14%
Retire at 45 │ ✗     ✗     ⚠     ✓     ✓
Retire at 47 │ ✗     ⚠     ✓     ✓     ✓
Retire at 50 │ ⚠     ✓     ✓     ✓     ✓
Retire at 52 │ ✓     ✓     ✓     ✓     ✓
Retire at 55 │ ✓     ✓     ✓     ✓     ✓
```

Clicking any cell loads that scenario in full.

**Effort:** 2 days  
**Files:** `RetirementTab.jsx`, `engine.js`

---

## Phase 7 — Year-End Report (Week 7–8, ~2 days)

A shareable, printable annual summary generated at FY end (or any time):

```
DudduKaasu · FY 2025-26 Annual Report
══════════════════════════════════════════════════════════

HOUSEHOLD INCOME
  Selva (Microsoft)   ₹38.4L take-home + ₹24.2L RSU (net)  =  ₹62.6L
  Akshaya (Nvidia)    ₹29.8L take-home + ₹18.4L RSU (net)  =  ₹48.2L
  Total Household     ₹1,10,80,000

WEALTH BUILT
  Invested this FY    ₹24.8L   Savings Rate: 36%
  Net Worth Apr 25    ₹1.84Cr → Net Worth Mar 26   ₹2.43Cr   (+₹59L, +32%)

PORTFOLIO PERFORMANCE
  MSFT                +18.4%      NVDA   +24.1%
  Mutual Funds        +14.2%      EPF    +8.15%
  Portfolio XIRR      +16.8% p.a.

GOALS PROGRESS
  Child Education     23% funded  (₹4.8L of ₹21L target)
  Downpayment         61% funded  (₹18L of ₹30L target)

TAX
  Estimated Tax Paid  ₹18.2L
  Effective Rate      16.4%

══════════════════════════════════════════════════════════
Generated by DudduKaasu · Private & Confidential
```

**Effort:** 2 days  
**Files:** New `src/components/reports/YearEndReport.jsx`, print CSS

---

## Full Implementation Order

| Phase | Feature | Effort | Week |
|-------|---------|--------|------|
| **0-A** | Tab rename (Daily Expenses → Transactions, Expenses → Budget) | 30 min | 1 |
| **0-B** | Persistent person filter across tabs | 2 hr | 1 |
| **0-C** | Spending pace indicator in Transactions header | 1 hr | 1 |
| **0-D** | Holdings sort options | 1 hr | 1 |
| **0-E** | RSU vest countdown strip | 2 hr | 1 |
| **0-F** | Semantic colour fix (green overload) | 2 hr | 1 |
| **0-G** | Number count-up animation | 2 hr | 1 |
| **0-H** | Keyboard shortcuts | 1 hr | 1 |
| **1-A** | Net worth history snapshots | 3 hr | 2 |
| **1-B** | Dashboard component (hero + month summary + goals + vests) | 1 day | 2 |
| **1-C** | Dashboard as first tab | 1 hr | 2 |
| **2-A** | Per-category budget caps with progress bars | 4 hr | 3 |
| **2-B** | Committed vs discretionary spending | 4 hr | 3 |
| **2-C** | Monthly financial summary card | 3 hr | 3 |
| **3-A** | Goal-to-asset earmarking (tag holdings) | 4 hr | 4 |
| **3-B** | Goal progress rings + calculation | 3 hr | 4 |
| **3-C** | Filter portfolio by goal | 2 hr | 4 |
| **4-A** | STCG / LTCG calculation from portfolio | 4 hr | 5 |
| **4-B** | Tax-loss harvesting surface | 3 hr | 5 |
| **4-C** | Capital gains section in Tax tab | 3 hr | 5 |
| **5-A** | Liabilities tracking (true net worth) | 4 hr | 6 |
| **5-B** | Insurance coverage tracker | 4 hr | 6 |
| **6-A** | What-if scenario simulator | 1 day | 7 |
| **6-B** | Retirement sensitivity table | 1 day | 7 |
| **7** | Year-end annual report | 2 days | 8 |

**Total: ~8 weeks of part-time work**

---

## What We're NOT Building (Deliberately Out of Scope)

| Idea | Why skipped |
|---|---|
| Multi-family / invite-a-spouse collaboration | App is private; both persons share one login |
| Recurring expense auto-detection (ML) | Overkill for a 2-person family; manual flagging is sufficient |
| Push notifications / background alerts | Would require a backend service worker; not worth the infra |
| Bank account import (Plaid / AA) | Indian Account Aggregator integration is complex; manual TX is fine |
| Mobile app (React Native) | Web with responsive CSS is sufficient for this use case |

---

## Notes for Implementation

- All new state fields follow the existing Supabase `upsert` pattern via `persist()`
- New components go in appropriate subdirectory under `src/components/`
- No new npm dependencies unless absolutely necessary (stick to pure SVG + existing Recharts)
- All monetary calculations are INR-native; USD conversions use the existing `liveData.USDINR`
- Indian FY (Apr–Mar) convention is already established — all new date logic must follow it
- Dark theme tokens (`T.*`) are the single source of truth — no inline hex values in new components
