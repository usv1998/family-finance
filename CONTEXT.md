# Family Finance Tracker — Claude Code Context

This file gives Claude Code full context to continue development without re-explaining anything.

---

## App Overview

A personal family finance tracker built in React + Vite, deployed to GitHub Pages.
- **Live URL**: https://usv1998.github.io/family-finance
- **Repo**: https://github.com/usv1998/family-finance
- **Stack**: React 18, Vite 5, Recharts, vite-plugin-pwa (PWA), Supabase (Postgres) + localStorage fallback
- **Version**: v1.4
- **Storage key**: `family-finance-v2` (bump to `v3` on next breaking data change)

---

## People

| Person | Company | Stock | Role |
|--------|---------|-------|------|
| Selva | Microsoft India (R&D) Pvt Ltd | MSFT | Software Engineer 2 |
| Akshaya | NVIDIA Graphics Pvt Ltd | NVDA | Engineer Sr, ASIC |

---

## Selva — Salary Structure (FY2026-27)

- **Monthly CTC**: ₹2,94,917 (Apr–Aug), ₹3,06,714 (Sep–Mar after 4% hike)
- **Basic**: ₹1,39,201 / ₹1,44,769
- **HRA**: ₹69,601 / ₹72,385
- **Special Allowance**: ₹18,705 / ₹21,482 (balancing component)
- **Car EMI**: ₹50,706/month paid directly to vendor (not in payslip cash, but in ESPP base)
- **EPF**: 12% of Basic = ₹16,704 (Apr–Aug) / ₹17,372 (Sep–Mar)
- **Tax regime**: New Tax Regime
- **Performance Bonus**: ₹3,62,158 in September (10% of annual CTC, already in take_home)
- **Total tax FY27**: ~₹13,79,879
- **Surcharge**: 10% kicks in March (income crosses ₹50L when Feb RSU vest is known)

### Selva RSU (MSFT)
- 56 shares total, 14/vest, quarterly: **May / Aug / Nov / Feb**
- Price assumption: **$420/share × ₹94 = ₹39,480/share**
- Gross per vest: ₹5,52,720
- Tax withheld: 4 shares (May/Aug/Nov), 5 shares (Feb — surcharge month)
- Net per vest: ~10 shares = ~₹3,80,271 (May/Aug/Nov), ~₹3,62,946 (Feb)
- Tax rate: 31.2% (May/Aug/Nov), 34.32% (Feb)
- RSU tax collected outside payroll (from shares, not cash salary)

### Selva ESPP (MSFT)
- Quarterly vests: **Apr / Jul / Oct / Jan**
- Purchase price: $420 × 90% = $378/share × ₹94 = ₹35,532/share
- Shares per vest: 3 (Apr/Jul/Jan), 5 (Oct — bonus inflated Sep contribution)
- Net stock value at market ($420 × ₹94): ₹1,18,440 (Apr/Jul/Jan), ₹1,97,400 (Oct)
- ESPP deduction: 15% of (cash salary + car EMI + EPF) each month
- ESPP contribution base: ~₹2,98,213/mo pre-hike, ~₹3,09,342/mo post-hike, ~₹6,68,872 in Sep (incl bonus)

### Selva Monthly Take-Home
| Month | Take-Home | Notes |
|-------|-----------|-------|
| Apr | ₹1,33,121 | ESPP vest ₹1,18,440 |
| May | ₹1,33,171 | RSU vest |
| Jun | ₹1,33,171 | |
| Jul | ₹1,33,171 | ESPP vest ₹1,18,440 |
| Aug | ₹1,33,171 | RSU vest |
| Sep | ₹4,25,938 | Hike + bonus ₹3,62,158 |
| Oct | ₹1,25,648 | ESPP vest ₹1,97,400 |
| Nov | ₹1,25,648 | RSU vest |
| Dec | ₹1,13,296 | TDS elevated |
| Jan | ₹1,13,296 | ESPP vest ₹1,18,440 |
| Feb | ₹1,13,196 | RSU vest |
| Mar | ₹5,097 | ⚠ Surcharge catch-up — nearly zero cash! |

---

## Akshaya — Salary Structure (FY2026-27)

- **Monthly CTC**: ₹2,88,634 flat all 12 months (no hike assumed for FY27)
- **Basic**: ₹1,43,317 (50% of CTC)
- **HRA**: ₹57,327 (40% of Basic)
- **Special Allowance**: ₹76,473 (balancing component)
- **Conveyance**: ₹1,600 | **Medical**: ₹1,250 | **LTA**: ₹6,667 | **Broadband**: ₹2,000
- **EPF**: 12% of Basic = ₹17,198 (Apr–Aug) / ₹17,372 (Sep–Mar — post-hike basic)
- **Tax regime**: New Tax Regime
- **No performance bonus** for FY27
- **Total tax FY27**: ~₹37,75,806
- **Surcharge**: 15% (income crosses ₹1 crore) — kicks in March when last RSU vest is known

### Akshaya RSU (NVDA)
- 461 shares total across 4 vests: **Jun 160 / Sep 101 / Dec 100 / Mar 100**
- Price assumption: **$180/share × ₹94 = ₹16,920/share**
- Gross RSU: ₹78,01,080 total
- Tax withheld units: 50 (Jun), 32 (Sep), 31 (Dec), 36 (Mar — 15% surcharge)
- Tax rates: 31.2% (Jun/Sep/Dec), 35.88% (Mar)
- Net shares to broker: 110 (Jun), 69 (Sep), 69 (Dec), 64 (Mar) = 312 net shares
- Net value to broker: ₹52,87,957 total
- RSU Refund: ~37% of gross vest value credited as cash in payslip same month

### Akshaya ESPP (NVDA)
- Semi-annual vests: **Sep / Mar**
- Purchase price: **$96.96/share × ₹94 = ₹9,114/share**
- 6-month contributions: ₹72,159/month × 6 = ₹4,32,954 per period
- Shares purchased per vest: ~47 shares
- Net stock value at market ($180 × ₹94 = ₹16,920): ₹7,95,240 per vest
- Total annual ESPP value: ₹15,90,480
- ESPP Tax Refund also credited in Sep and Mar payslips

### Akshaya Monthly Take-Home
| Month | Take-Home | Notes |
|-------|-----------|-------|
| Apr | ₹1,47,323 | |
| May | ₹1,47,373 | |
| Jun | ₹2,19,767 | RSU 160 shares — refund boosts take-home |
| Jul | ₹1,56,776 | |
| Aug | ₹1,56,776 | |
| Sep | ₹3,32,268 | RSU 101 shares + ESPP vest 47 shares |
| Oct | ₹1,28,813 | ⚠ Lowest month — OPD insurance + elevated TDS |
| Nov | ₹1,46,626 | |
| Dec | ₹1,91,732 | RSU 100 shares |
| Jan | ₹1,64,303 | |
| Feb | ₹1,64,203 | |
| Mar | ₹1,32,805 | RSU 100 shares + ESPP vest 47 shares + 15% surcharge |

---

## EPF Opening Balances (from FY26 March payslip YTD)

| Person | Employee | Employer | Total |
|--------|----------|----------|-------|
| Selva | ₹1,81,790 | ₹1,81,790 | ₹3,63,580 |
| Akshaya | ₹1,74,806 | ₹1,74,806 | ₹3,49,612 |

FY27 EPF contributions:
- Selva: ₹16,704 × 5 (Apr–Aug) + ₹17,372 × 7 (Sep–Mar) = ₹2,05,124 employee
- Akshaya: ₹17,198 × 5 + ₹17,372 × 7 = ₹2,07,494 employee
- Employer matches 1:1 for both

---

## Household Combined (FY2026-27)

| Component | Amount |
|-----------|--------|
| Combined cash take-home | ₹37,76,689 |
| RSU net to broker | ₹67,91,797 |
| ESPP net stock value | ₹21,43,200 |
| EPF (emp + employer, both) | ₹8,23,000 |
| Baby Education Fund | ₹6,00,000 |
| Free surplus (investable) | ₹6,20,689 |
| **Total wealth created FY27** | **₹1,12,18,686** |

---

## Goals / Savings Plan

| Goal | Amount | Instrument | Timeline |
|------|--------|------------|----------|
| Singapore trip (8 people) | ₹5,00,000 | Gold ETF | By Jan 2027 |
| Family function | ₹4,00,000 | Liquid fund | By Oct 25, 2026 |
| Baby education fund | ₹50,000/month | Long-term | Ongoing |
| Equity SIP (Selva) | ₹20,000/month | 70% Nifty 50 + 30% Midcap 150 | Ongoing |
| Free surplus | ₹6,20,689 | Same 70/30 | Oct–Feb deployable |

### Investment Rationale
- Nifty 50 PE at ~19.62 (April 2026) — attractive entry, below 7Y median of 22.72
- Midcap 150 PE at ~33 — fair value, good long-term SIP
- Gold at ₹1,51,000/10g — near all-time high, not ideal for long-term but used for Singapore fund (capital protection, fixed deadline)

---

## App Data Model

### localStorage key: `family-finance-v2`
Bump to `v3` on next breaking change.

```javascript
{
  incomeData: {
    "FY2026-27": {
      "Selva": {
        0: { take_home, epf, espp, car_lease, ad_hoc: [{id, label, amount}], notes },
        // months 0–11 (Apr=0, Mar=11)
      },
      "Akshaya": { /* same but no car_lease */ }
    }
  },
  rsuData: {
    "FY2026-27": [
      { id, person, stock, vest_date, units_vested, stock_price_usd, usd_inr_rate,
        tax_withheld_units, grant_id, month_idx, fy }
    ]
  },
  rsuGrants: [
    { id, grant_id, person, stock, grant_date, total_units, vesting_years,
      first_vest_date, vesting_type,  // "equal_quarterly" | "custom"
      vesting_schedule: [{vest_date, units}],  // only for custom
      notes }
  ],
  investmentsData: {
    "FY2026-27": {
      epfOpening: { Selva: 363580, Akshaya: 349612 },
      babyFund: { monthlyTarget: 50000, months: { 0: 50000, ... } },
      debtFunds: [{ id, name, type, amount, date, notes }]
    }
  },
  expensesData: {
    "FY2026-27": {
      categories: [{ id, name, budget, color }],
      actuals: { 0: { [catId]: amount }, ... }  // month 0–11
    }
  },
  portfolioData: {
    "opening": {
      sip: { Selva: 0, Akshaya: 0 },
      epf: { Selva: 363580, Akshaya: 349612 },
      debt: 0, babyFund: 0
    },
    "FY2025-26": { sip, epf, debt, babyFund }
  }
}
```

Month index: Apr=0, May=1, Jun=2, Jul=3, Aug=4, Sep=5, Oct=6, Nov=7, Dec=8, Jan=9, Feb=10, Mar=11

---

## File Structure

```
family-finance-app/
├── src/
│   ├── FamilyFinanceTracker.jsx      ← root component, state, routing
│   ├── App.jsx                        ← mounts FamilyFinanceTracker
│   ├── main.jsx                       ← React entry point
│   ├── lib/
│   │   ├── constants.js               ← TABS, MONTHS, PERSONS, STOCKS, LIVE_DEFAULTS
│   │   ├── theme.js                   ← T color palette
│   │   ├── formatters.js              ← fmtINR, fmtUSD, getCurrentFY, getCurrentMonthIdx, getFYOptions
│   │   ├── storage.js                 ← loadData / saveData (Supabase + localStorage)
│   │   ├── supabase.js                ← Supabase client
│   │   ├── seed.js                    ← SEED_DATA (incomeData, rsuData, rsuGrants, investmentsData, expensesData, portfolioData)
│   │   ├── marketData.js              ← fetchLiveData() — Yahoo Finance v7 + Frankfurter fallback (parallel)
│   │   ├── grantUtils.js              ← dateToFY, generateVestSchedule, isConfirmed, getConfirmedEvent, getUpcomingVests
│   │   └── csvExport.js               ← downloadCSV(filename, rows) — shared, adds BOM for Excel
│   └── components/
│       ├── LiveStrip.jsx              ← live MSFT/NVDA/USDINR bar with staleness indicator
│       ├── LoginScreen.jsx            ← Supabase auth
│       ├── income/
│       │   ├── IncomeTab.jsx          ← Table/Charts toggle; Chart sub-tabs: Income Growth / Savings Rate / Projection
│       │   ├── IncomeTable.jsx        ← 12-month grid, combined/per-person view, highlight current month
│       │   ├── SummaryCards.jsx       ← FY summary cards
│       │   ├── MonthlyInput.jsx       ← per-month income entry form
│       │   └── AdHocItems.jsx         ← ad-hoc/bonus items editor
│       ├── rsu/
│       │   ├── RsuTab.jsx             ← Vest Events / Grant Schedule toggle; upcoming vests banner; CSV export
│       │   ├── RsuTable.jsx           ← vest events table + unrealized gain columns (live-price dependent)
│       │   ├── RsuForm.jsx            ← add vest event form
│       │   ├── GrantForm.jsx          ← add RSU grant (equal quarterly or custom)
│       │   └── GrantList.jsx          ← grant cards with progress bar + expandable vest schedule
│       ├── investments/
│       │   └── InvestmentsTab.jsx
│       ├── expenses/
│       │   └── ExpensesTab.jsx        ← budget vs actuals, categories, annual overview, CSV export
│       ├── portfolio/
│       │   └── PortfolioTab.jsx       ← all-time corpus + FY view, opening balances init, CSV export
│       ├── tax/
│       │   └── TaxTab.jsx             ← FY2025-26 Old vs New regime estimator, per-person, auto-fills RSU/ESPP/bonus
│       └── charts/
│           ├── IncomeGrowthChart.jsx  ← stacked bar + trend line (lazy)
│           ├── SavingsRateChart.jsx   ← income vs expenses bars + savings rate % line (lazy)
│           └── ProjectionChart.jsx   ← actuals + projected FYs, per-person growth %, RSU from grants (lazy)
├── public/                            ← PWA icons (pwa-192, pwa-512, apple-touch-icon, favicon)
├── .github/workflows/deploy.yml       ← auto-deploy on push to main (Vite build → gh-pages)
├── vite.config.js                     ← BASE_PATH="/family-finance/", manualChunks:{recharts}, PWA config
├── package.json
└── CONTEXT.md                         ← this file
```

---

## Key Architecture Notes

- **Indian Financial Year**: Apr=0 … Mar=11. `getCurrentMonthIdx()` and `getCurrentFY()` in `formatters.js`.
- **Live market data**: Yahoo Finance v7 (MSFT, NVDA, USDINR=X) + Frankfurter.app fallback, fetched in parallel via `Promise.allSettled`. Auto-refresh every 15 min + manual ↻ button. Staleness shown as LIVE/amber/STALE.
- **RSU grants**: flat array (all FYs). `generateVestSchedule()` produces equal-quarterly or custom schedules. Confirmed vests matched to actual `rsuData` events via ±7 day tolerance.
- **Code splitting**: Recharts (157KB gz) in its own chunk via `manualChunks`. All three chart components lazy-loaded with `React.lazy` + `Suspense`. Initial bundle ~78KB gz.
- **CSV export**: shared `downloadCSV(filename, rows)` utility with UTF-8 BOM for Excel. Used in Income, RSU, Expenses, Portfolio tabs.

---

## Bundle Sizes (approximate, gzip)

| Chunk | Size |
|-------|------|
| index.js (app) | ~78KB |
| recharts.js | ~157KB (on-demand) |
| IncomeGrowthChart.js | ~2KB (lazy) |
| SavingsRateChart.js | ~2KB (lazy) |
| ProjectionChart.js | ~3KB (lazy) |

---

## Theme Colors (`T` from `src/lib/theme.js`)

```javascript
bg:"#0B1120", surface:"#131B2E", card:"#1A2340",
border:"#2A3555", accent:"#22C55E", text:"#E8ECF4",
textDim:"#8B96AD", textMuted:"#5A6580",
red:"#EF4444", amber:"#F59E0B", blue:"#3B82F6",
purple:"#A855F7", teal:"#14B8A6",
selva:"#3B82F6", akshaya:"#EC4899"
```

---

## Tax Estimation (FY 2025-26, `TaxTab.jsx`)

**New regime slabs (Budget 2025):** 0% → ₹4L · 5% → ₹8L · 10% → ₹12L · 15% → ₹16L · 20% → ₹20L · 25% → ₹24L · 30% above
- Std deduction ₹75,000 · 87A full rebate if taxable ≤ ₹12L
**Old regime slabs:** 0% → ₹2.5L · 5% → ₹5L · 20% → ₹10L · 30% above
- Std deduction ₹50,000 · 87A rebate ≤ ₹12,500 if taxable ≤ ₹5L
- Deductions: 80C (max ₹1.5L, EPF auto-included), 80D, HRA
**Both:** Surcharge 10%/15%/25% (new: capped 25%) · 4% H&E Cess

---

## Deploy

```bash
git add .
git commit -m "describe change"
git push
```

GitHub Actions auto-builds and deploys to https://usv1998.github.io/family-finance in ~2 mins.

---

## Version History

| Version | Key Changes |
|---------|-------------|
| v1.0 | Initial deploy — income tracker, RSU vest events, investments tab |
| v1.1 | ESPP label fix, Selva Sep bonus double-count fix, Akshaya EPF step-up fix |
| v1.2 | Full modular refactor (src/lib + src/components), Expenses tab, Portfolio tab, live market data, current month highlighting, RSU grant schedule modelling, CSV export (all tabs), multi-year income growth chart (Recharts, code-split) |
| v1.3 | Savings rate chart, RSU appreciation tracking (unrealized gain columns), Income Projection chart |
| v1.4 | Tax estimation tab (Old vs New regime, FY2025-26 slabs, per-person, auto-fills from data) |
