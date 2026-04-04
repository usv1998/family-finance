# Family Finance Tracker — Claude Code Context

This file gives Claude Code full context to continue development without re-explaining anything.

---

## App Overview

A personal family finance tracker built in React + Vite, deployed to GitHub Pages.
- **Live URL**: https://usv1998.github.io/family-finance
- **Repo**: https://github.com/usv1998/family-finance
- **Stack**: React 18, Vite 5, vite-plugin-pwa (PWA), Supabase (Postgres) + localStorage fallback
- **Version**: v1.2
- **Storage key**: `family-finance-v2` (bump to v3 on next breaking data change)

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
        // ... months 0-11 (Apr=0, Mar=11)
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
  investmentsData: {
    "FY2026-27": {
      epfOpening: { Selva: 363580, Akshaya: 349612 },
      babyFund: {
        monthlyTarget: 50000,
        months: { 0: 50000, ... 11: 50000 }
      },
      debtFunds: [{ id, name, type, amount, date, notes }]
    }
  }
}
```

Month index mapping: Apr=0, May=1, Jun=2, Jul=3, Aug=4, Sep=5, Oct=6, Nov=7, Dec=8, Jan=9, Feb=10, Mar=11

---

## Known Bugs / Pending Fixes

### Already fixed in v1.1 (deploy pending)
1. ~~ESPP label said "Contribution" — should be "ESPP Net Stock (₹)"~~
2. ~~Selva Sep bonus ₹3,62,158 was in ad_hoc causing double-count~~
3. ~~Akshaya EPF was flat — now steps up 17198→17372 in Sep~~

### Fixed in v1.2
4. ~~RSU summary card shows gross — should show net (units_vested - tax_withheld_units) × price × rate~~
5. ~~EPF summary card — shows only Selva employee contribution. Should be both persons + employer match + opening balances~~

### Future features (tabs still locked)
- ~~**Expenses tab** — budget vs actuals (Rent ₹48k, Parents ₹20k, Baby, Groceries, Travel, etc.)~~ ✅ Done in v1.2
- **Portfolio tab** — live MSFT/NVDA stock valuations, total corpus, equity vs debt breakdown

### Expenses tab (v1.2)
- 9 default categories: Rent ₹48k, Parents ₹20k, Groceries ₹15k, Dining ₹6k, Shopping ₹10k, Travel ₹8k, Utilities ₹3k, Medical ₹3k, Misc ₹5k
- Month selector to enter actuals; inline edit per category
- Color-coded % bar (green ≤100%, amber ≤120%, red >120%)
- Annual overview table (all months × all categories)
- Edit budgets inline; add/remove custom categories
- expensesData stored in `family-finance-v2` localStorage key (no version bump needed — additive key)

---

## File Structure

```
family-finance-app/
├── src/
│   ├── family-finance-tracker.jsx   ← MAIN FILE — all components in one file
│   ├── App.jsx                       ← just re-exports the tracker
│   └── main.jsx                      ← React entry point
├── public/                           ← PWA icons
├── .github/workflows/deploy.yml      ← auto-deploys on git push to main
├── vite.config.js                    ← BASE_PATH = "/family-finance/"
├── package.json
└── CONTEXT.md                        ← this file
```

---

## Theme Colors (variable `T` or `theme`)

```javascript
bg:"#0B1120", surface:"#131B2E", card:"#1A2340",
border:"#2A3555", accent:"#22C55E", text:"#E8ECF4",
textDim:"#8B96AD", textMuted:"#5A6580",
red:"#EF4444", amber:"#F59E0B", blue:"#3B82F6",
purple:"#A855F7", teal:"#14B8A6",
selva:"#3B82F6", akshaya:"#EC4899"
```

---

## Deploy Command

```bash
git add .
git commit -m "describe change"
git push
```

GitHub Actions auto-builds and deploys to https://usv1998.github.io/family-finance in ~2 mins.

---

## Session History Summary

This app was built in a single Claude.ai conversation covering:
- Full FY26 tax computation from payslips (Microsoft + Nvidia)
- FY27 projected tax computation with RSU/ESPP/bonus modeling
- Monthly take-home simulation with front-loaded TDS logic
- Singapore trip savings plan (Gold ETF, ₹5L by Jan 2027)
- Family function savings plan (₹4L by Oct 25, 2026)
- Investment allocation: 70% Nifty 50 / 30% Midcap 150
- Household combined cashflow showing ₹1.12Cr wealth creation in FY27
