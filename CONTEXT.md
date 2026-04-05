# Family Finance Tracker — Claude Code Context

This file gives Claude Code full context to continue development without re-explaining anything.
Read this file at the start of every session.

---

## App Overview

A personal family finance tracker built in React + Vite, deployed to GitHub Pages.
- **Live URL**: https://usv1998.github.io/family-finance
- **Repo**: https://github.com/usv1998/family-finance
- **Stack**: React 18, Vite 5, Recharts, vite-plugin-pwa (PWA), Supabase (Postgres) + localStorage fallback
- **Current version**: v1.5
- **Storage key**: `family-finance-v2` (bump to `v3` on next breaking data change)
- **Deploy**: `git push` → GitHub Actions auto-builds and deploys in ~2 min

---

## People

| Person | Company | Stock | Role |
|--------|---------|-------|------|
| Selva | Microsoft India (R&D) Pvt Ltd | MSFT | Software Engineer 2 |
| Akshaya | NVIDIA Graphics Pvt Ltd | NVDA | Engineer Sr, ASIC |

---

## Salary Details (FY2026-27)

### Selva (MSFT)
- Monthly take-home: ₹1,33,121–₹1,33,171 (Apr–Aug) → drops post-hike due to TDS
- Sep: ₹4,25,938 (includes 4% hike + ₹3,62,158 performance bonus)
- Oct–Feb: ₹1,25,648 → ₹1,13,296 → ₹1,13,196
- **Mar: ₹5,097 only** (surcharge catch-up month)
- EPF: ₹16,704/mo (Apr–Aug) → ₹17,372 (Sep–Mar)
- Car Lease: ₹50,706/mo (direct vendor payment, affects ESPP base)
- **ESPP** (quarterly Apr/Jul/Oct/Jan): 3 shares at $420 × ₹94 = ₹1,18,440 (Apr/Jul/Jan), 5 shares Oct = ₹1,97,400
- **RSU** (quarterly May/Aug/Nov/Feb): 14 shares/vest at $420 × ₹94, net 10 shares after tax withheld

### Akshaya (NVDA)
- Monthly take-home: ₹1,47,323–₹1,64,303 (varies by month)
- Sep: ₹3,32,268 (RSU 101 shares + ESPP vest); Mar: ₹1,32,805 (RSU 100 + ESPP + 15% surcharge)
- EPF: ₹17,198/mo (Apr–Aug) → ₹17,372 (Sep–Mar)
- **ESPP** (semi-annual Sep/Mar): 47 shares at $180 × ₹94 = ₹7,95,240 per vest
- **RSU** (Jun 160 / Sep 101 / Dec 100 / Mar 100 shares): ~31% tax withheld, except Mar 36% (15% surcharge)

### EPF Opening Balances (start of FY2026-27)
| Person | Total Corpus |
|--------|-------------|
| Selva | ₹3,63,580 |
| Akshaya | ₹3,49,612 |

---

## Current Tab Structure

| Tab ID | Label | Status |
|--------|-------|--------|
| income | Income | ✅ Live |
| rsu | RSU Tracker | ✅ Live — **pending merge into Portfolio** |
| investments | Investments | ✅ Live |
| expenses | Expenses | ✅ Live |
| portfolio | Net Worth | ✅ Live — being redesigned into Portfolio |
| tax | Tax | ✅ Live |

---

## Current Data Model

### localStorage key: `family-finance-v2`

```javascript
{
  incomeData: {
    "FY2026-27": {
      "Selva": {
        0: {
          take_home: 133121,
          epf: 16704,
          // NEW ESPP model (replaces old espp: INR field)
          espp_shares: 3,          // net shares deposited
          espp_price_usd: 420,     // vest price in USD
          espp_usd_inr: 94,        // exchange rate on vest date
          // derived: espp_shares × espp_price_usd × espp_usd_inr = INR value
          car_lease: 50706,        // Selva only
          ad_hoc: [{ id, label, amount }],
          notes: ""
        },
        // months 0–11 (Apr=0 … Mar=11)
        // months without ESPP vest: no espp_shares field (defaults to 0)
      },
      "Akshaya": { /* same but no car_lease */ }
    }
  },

  rsuData: {
    "FY2026-27": [
      { id, person, stock, vest_date, units_vested, stock_price_usd,
        usd_inr_rate, tax_withheld_units, grant_id, month_idx, fy }
    ]
  },

  rsuGrants: [
    { id, grant_id, person, stock, grant_date, total_units, vesting_years,
      first_vest_date, vesting_type,  // "quarterly" | "custom"
      vesting_schedule: [{ vest_date, units }],  // only for custom
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
      actuals: { 0: { [catId]: amount }, ... }  // month index 0–11
    }
  },

  portfolioData: {
    // Legacy — kept for backward compat, not shown in UI anymore
    opening: { stocks, sipCorpus, epf, gold, debtFunds, babyFundCorpus, initialized }
  },

  holdingsData: [
    // Flat array — all manual Net Worth holdings
    // Manually added assets (stocks, MFs, FDs, EPF, PPF)
    {
      id,
      type,           // "us_stock" | "in_stock" | "mf" | "fd" | "epf" | "ppf"
      person,         // "Selva" | "Akshaya" | "Joint"
      name,
      symbol,         // for us_stock / in_stock (e.g. "MSFT", "RELIANCE.NS")
      schemeCode,     // for mf (AMFI scheme code)
      quantity,       // for stocks
      units,          // for mf
      costBasisINR,   // total purchase cost in INR
      principal,      // for fd
      interestRate,   // for fd (annual %, quarterly compounding)
      startDate,      // for fd
      maturityDate,   // for fd
      balance,        // for epf / ppf (manually updated)
      notes,
      addedAt
    }
  ]
}
```

**Month index**: Apr=0, May=1, Jun=2, Jul=3, Aug=4, Sep=5, Oct=6, Nov=7, Dec=8, Jan=9, Feb=10, Mar=11

---

## ESPP Data Model Change (important)

Old model (legacy, still supported via `getEsspINR()` fallback):
```js
{ espp: 118440 }  // stored as INR directly
```

New model (current):
```js
{ espp_shares: 3, espp_price_usd: 420, espp_usd_inr: 94 }
// INR = espp_shares × espp_price_usd × espp_usd_inr
```

The helper `getEsspINR(monthData)` in `src/lib/formatters.js` handles both old and new model.
All charts, tax, investments, and income components already use this helper.

---

## Key Helper Functions

```javascript
// src/lib/formatters.js
getEsspINR(monthData)         // ESPP INR — handles both old and new model
fmtINR(n)                     // Indian number format with ₹ prefix
fmtUSD(n)                     // USD format with $ prefix
getCurrentFY()                // "FY2026-27" etc
getCurrentMonthIdx()          // Apr=0 … Mar=11
getFYOptions()                // ["FY2025-26", "FY2026-27", ...]
genId()                       // random ID

// src/lib/priceService.js
fetchStockPrice(symbol)       // Yahoo Finance v8 via corsproxy.io → price (USD or INR)
fetchMFNav(schemeCode)        // mfapi.in → NAV in INR
searchMF(query)               // mfapi.in search → [{schemeCode, schemeName, fundHouse}]
calcFDValue(principal, rate, startDate)  // quarterly compound interest
getCurrentValueINR(holding, priceMap, usdinr)  // dispatch by holding type
getGainINR(holding, currentValue)
fetchAllPrices(holdings)      // parallel fetch all stocks + MFs → priceMap

// src/lib/grantUtils.js
generateVestSchedule(grant)   // produces vest dates + units from grant definition
getUpcomingVests(grants, n)   // next n vests across all grants
```

---

## File Structure

```
family-finance-app/
├── src/
│   ├── FamilyFinanceTracker.jsx      ← root component, all state, tab routing
│   ├── App.jsx
│   ├── main.jsx
│   ├── lib/
│   │   ├── constants.js              ← TABS, MONTHS, PERSONS, STOCKS, LIVE_DEFAULTS, STORAGE_KEY
│   │   ├── theme.js                  ← T color palette (bg, surface, card, border, accent, etc.)
│   │   ├── formatters.js             ← fmtINR, fmtUSD, getCurrentFY, getCurrentMonthIdx, getFYOptions, genId, getEsspINR
│   │   ├── storage.js                ← loadData / saveData (Supabase + localStorage)
│   │   ├── supabase.js               ← Supabase client (null if env vars missing)
│   │   ├── seed.js                   ← SEED_DATA (full FY2026-27 income, RSU, grants, investments, expenses)
│   │   ├── marketData.js             ← fetchLiveData() — MSFT, NVDA, USD/INR via Yahoo v8 + open.er-api.com
│   │   ├── priceService.js           ← fetchStockPrice, fetchMFNav, searchMF, calcFDValue, getCurrentValueINR, getGainINR, fetchAllPrices
│   │   ├── grantUtils.js             ← dateToFY, generateVestSchedule, getUpcomingVests
│   │   └── csvExport.js              ← downloadCSV(filename, rows) — UTF-8 BOM for Excel
│   └── components/
│       ├── LiveStrip.jsx             ← MSFT / NVDA / USD/INR live bar, staleness indicator
│       ├── LoginScreen.jsx           ← Supabase email OTP auth
│       ├── income/
│       │   ├── IncomeTab.jsx         ← Table/Charts toggle; Chart sub-tabs: Income Growth / Savings Rate / Projection
│       │   ├── IncomeTable.jsx       ← 12-month grid; ESPP+RSU rows show share counts (teal); total row shows INR
│       │   ├── SummaryCards.jsx      ← FY summary: RSU/ESPP show shares + INR sub
│       │   ├── MonthlyInput.jsx      ← Monthly income entry; ESPP = 3 fields (shares, USD price, rate)
│       │   └── AdHocItems.jsx        ← ad-hoc/bonus items editor
│       ├── rsu/
│       │   ├── RsuTab.jsx            ← Vest Events / Grant Schedule toggle; upcoming vests banner
│       │   ├── RsuTable.jsx          ← vest events table + unrealized gain (live price)
│       │   ├── RsuForm.jsx           ← add vest event form
│       │   ├── GrantForm.jsx         ← add RSU grant (quarterly or custom)
│       │   └── GrantList.jsx         ← grant cards with vest schedule + progress bar
│       ├── investments/
│       │   └── InvestmentsTab.jsx    ← EPF (with opening balances), ESPP (shows shares + INR), Baby Fund, Debt Funds
│       ├── expenses/
│       │   └── ExpensesTab.jsx       ← budget vs actuals, categories, annual overview, CSV export
│       ├── portfolio/
│       │   ├── NetWorthTab.jsx       ← Current Net Worth tab: summary, filters, holding list
│       │   ├── AddHoldingForm.jsx    ← Add holding form (MF search, type-specific fields); exports TYPE_META
│       │   ├── HoldingCard.jsx       ← Individual holding: badges, value, gain/loss, inline EPF/PPF edit
│       │   └── PortfolioTab.jsx      ← Old portfolio tab (legacy, not in tabs anymore)
│       ├── tax/
│       │   └── TaxTab.jsx            ← Old vs New regime, per-person, auto-fills from income/RSU data
│       └── charts/
│           ├── IncomeGrowthChart.jsx ← stacked bar + trend line (lazy)
│           ├── SavingsRateChart.jsx  ← income vs expenses + savings rate % line (lazy)
│           └── ProjectionChart.jsx   ← actuals + projected FYs, RSU from grants at live prices (lazy)
├── public/                           ← PWA icons
├── .github/workflows/deploy.yml      ← auto-deploy on push to main
├── vite.config.js                    ← BASE_PATH="/family-finance/", manualChunks:{recharts}, PWA
├── package.json
└── CONTEXT.md                        ← this file
```

---

## State in FamilyFinanceTracker.jsx

```javascript
// All state at root level, passed as props
const [incomeData,      setIncomeData]      = useState({});
const [rsuData,         setRsuData]         = useState({});
const [investmentsData, setInvestmentsData] = useState({});
const [expensesData,    setExpensesData]    = useState({});
const [portfolioData,   setPortfolioData]   = useState({});  // legacy
const [rsuGrants,       setRsuGrants]       = useState([]);
const [holdingsData,    setHoldingsData]    = useState([]);  // Net Worth holdings
const [liveData,        setLiveData]        = useState(LIVE_DEFAULTS);

// persist(iD, rD, invD, expD, portD, rG, hD) — debounced 500ms saveData
```

---

## Live Market Data

- **Stocks** (MSFT, NVDA, individual holdings): Yahoo Finance v8 `/chart/{symbol}` via `corsproxy.io/?{encoded-url}`
  - corsproxy.io intentionally returns 403 to curl/server; works from browser (adds CORS headers)
- **USD/INR**: `open.er-api.com/v6/latest/USD` — free, genuinely CORS-enabled, returns ~₹93
- **Indian MF NAV**: `api.mfapi.in/mf/{schemeCode}` — AMFI official, free, CORS-enabled
- **MF search**: `api.mfapi.in/mf/search?q={query}`
- **FD**: quarterly compound interest calculated locally: `P × (1 + r/400)^(days/91.25)`

---

## Architecture Notes

- **Indian FY**: Apr=0 … Mar=11 throughout all data structures
- **Code splitting**: Recharts (157KB gz) in its own chunk. All chart components lazy-loaded with React.lazy + Suspense
- **CORS proxy**: all Yahoo Finance requests go through `corsproxy.io` — do NOT call Yahoo Finance directly from browser
- **Backward compat**: `getEsspINR()` supports both old `espp` field and new `espp_shares/price/rate` fields
- **RSU in Income table**: read-only row derived from `rsuData` — shows net shares (units_vested − tax_withheld)
- **Net Worth live prices**: fetched on mount + manual refresh; staleness shown in minutes (amber >15min)

---

## Theme Colors (`T` from `src/lib/theme.js`)

```javascript
bg:"#0B1120", surface:"#131B2E", card:"#1A2340",
border:"#2A3555", borderLight:"#3A4565",
accent:"#22C55E", accentBg:"#22C55E11",
text:"#E8ECF4", textDim:"#8B96AD", textMuted:"#5A6580", white:"#E8ECF4",
red:"#EF4444", amber:"#F59E0B", blue:"#3B82F6",
purple:"#A855F7", teal:"#14B8A6",
selva:"#3B82F6", akshaya:"#EC4899"
```

---

## Tax Details (FY2025-26, TaxTab.jsx)

**New regime (Budget 2025):** ₹75K std ded · Slabs: 0%→₹4L, 5%→₹8L, 10%→₹12L, 15%→₹16L, 20%→₹20L, 25%→₹24L, 30% above · Full 87A rebate if taxable ≤₹12L

**Old regime:** ₹50K std ded · Slabs: 0%→₹2.5L, 5%→₹5L, 20%→₹10L, 30% above · 87A rebate ≤₹12,500 (taxable ≤₹5L) · 80C (max ₹1.5L, EPF auto), 80D, HRA

**Both:** Surcharge 10% (>₹50L) / 15% (>₹1Cr) / 25% (>₹2Cr, new regime capped 25%) · 4% H&E Cess

---

## Goals / Financial Plan

| Goal | Amount | Instrument | Timeline |
|------|--------|------------|----------|
| Singapore trip (8 people) | ₹5,00,000 | Gold ETF | By Jan 2027 |
| Family function | ₹4,00,000 | Liquid fund | By Oct 25, 2026 |
| Baby education fund | ₹50,000/month | Long-term equity | Ongoing |
| Equity SIP (Selva) | ₹20,000/month | 70% Nifty 50 + 30% Midcap 150 | Ongoing |

---

## Pending Work — Portfolio Redesign

**The single biggest pending task.** Plan agreed, not yet implemented.

### What changes
1. **Remove RSU tab** from TABS — all its content moves into the Portfolio tab
2. **Portfolio tab** (id stays "portfolio", label "Portfolio") — 4 views: Overview · Holdings · Grants · History
3. **Investments tab** — gains Goals feature; no other major changes
4. **No FY filter** on Portfolio tab — it spans all years

**History view**: all past RSU vest events across all FYs (moved from RSU tab's Vest Events view), with filtering by person/stock and CSV export.

### New holdings data model additions
```javascript
// Additional fields to add to each holding in holdingsData:
acquisitionDate:     "2024-08-15",   // date purchased
acquisitionPrice:    420,            // in USD or INR depending on asset
acquisitionCurrency: "USD" | "INR",
acquisitionUSDINR:   94.2,           // auto-fetched from Frankfurter for that date
// costBasisINR is already there — verify it equals qty × price × rate
```

### Historical USD/INR fetch
Use `api.frankfurter.app/{YYYY-MM-DD}?from=USD&to=INR` — free, CORS-enabled, no auth.
Returns: `{ "rates": { "INR": 94.2 } }`

### Auto-derived holdings (computed, NOT stored — always in sync)
| Source | Derived as | Key fields |
|--------|-----------|------------|
| `rsuData` vest events | US Stock lots (read-only) | net units = vested − withheld; cost = net × USD_price × rate |
| `incomeData` ESPP fields | US Stock lots (read-only) | shares = espp_shares; cost = espp_shares × espp_price_usd × espp_usd_inr |
| `incomeData` EPF + `investmentsData` opening | EPF balance (read-only) | opening + cumulative monthly × 2 |
| `investmentsData` Baby Fund | Debt holding (read-only) | YTD contributed |
| `investmentsData` Debt Funds | Debt holdings (read-only) | amount per fund |

### XIRR
Newton-Raphson on cash flows: `-costBasisINR on acquisitionDate` + `+currentValue on today`.
Show per holding, per asset type group, per category (Equity/Debt), and total portfolio.

### Asset category mapping
| Type | Category |
|------|---------|
| us_stock, in_stock, mf (equity) | Equity |
| fd, epf, ppf, debt fund | Debt |
| Gold MF / SGB (future) | Gold |

### Portfolio tab layout
```
[ Overview ] [ Holdings ] [ Grants ]

Overview: Total NW | Portfolio XIRR | Total Gain
          Selva / Akshaya / Joint cards
          EQUITY ████ ₹X (Y%) XIRR Z%
          DEBT   ████ ₹X (Y%) XIRR Z%

Holdings (grouped, collapsible):
  ▾ EQUITY  ₹X | XIRR Y%
    ▾ US Stocks ₹X | XIRR Y%
        MSFT RSU May-26 · 10 sh · cost ₹X · now ₹Y · +Z% · XIRR W%
        MSFT (manual) · ...
    ▾ Indian Stocks ...
    ▾ Mutual Funds ...
  ▾ DEBT  ₹X | XIRR Y%
    ▾ EPF | FD | PPF | Debt Funds ...

Grants: (moved from RSU tab — grant schedule + upcoming vests)
```

### Goals in Investments tab
```javascript
// New state: goals (array in investmentsData or separate goalsData)
{ id, name, targetAmount, targetDate, notes, linkedTo: "babyFund" | null }
// Display: progress bar, % complete, ₹ remaining, months remaining
```

### Files to create/modify
| File | Action |
|------|--------|
| `src/lib/xirr.js` | NEW — Newton-Raphson XIRR solver |
| `src/lib/historicalFX.js` | NEW — fetch historical USD/INR from Frankfurter |
| `src/lib/derivedHoldings.js` | NEW — compute RSU/ESPP/EPF/BabyFund holdings from stored data |
| `src/components/portfolio/PortfolioTab.jsx` | NEW — replaces NetWorthTab as main component |
| `src/components/portfolio/AddHoldingForm.jsx` | MODIFY — add acquisitionDate/price/currency + FX auto-fetch |
| `src/components/portfolio/HoldingCard.jsx` | MODIFY — add XIRR display, acquisition date |
| `src/components/investments/InvestmentsTab.jsx` | MODIFY — add Goals section |
| `src/FamilyFinanceTracker.jsx` | MODIFY — remove RSU tab, pass rsuData+investmentsData to Portfolio |
| `src/lib/constants.js` | MODIFY — remove RSU from TABS |

### Implementation order
1. `xirr.js` + `historicalFX.js` + `derivedHoldings.js` (foundations — no UI)
2. New `PortfolioTab.jsx` — Overview + Holdings sections
3. Update `AddHoldingForm` — acquisition date/price + FX fetch
4. Move Grants into Portfolio, remove RSU tab from nav
5. Goals in Investments tab

---

## Version History

| Version | Key Changes |
|---------|-------------|
| v1.0 | Initial deploy — income tracker, RSU vest events, investments tab |
| v1.1 | ESPP label fix, Selva Sep bonus fix, Akshaya EPF step-up fix |
| v1.2 | Full modular refactor, Expenses tab, Portfolio tab, live market data, RSU grant schedule, CSV export, income growth chart |
| v1.3 | Savings rate chart, RSU appreciation (unrealized gain), income projection chart |
| v1.4 | Tax estimation tab (Old vs New regime, FY2025-26) |
| v1.5 | Net Worth tab (replaces Portfolio): 6 asset classes, per-person, MF search, FD compounding, live prices. ESPP tracked as net shares + price + rate. getEsspINR() helper. |
