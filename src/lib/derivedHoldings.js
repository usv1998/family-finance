/**
 * Compute read-only "derived" holdings from stored income / RSU / investments data.
 *
 * Derived holdings are always in sync with the underlying data — they are
 * never stored in holdingsData and must NOT be saved to storage.
 *
 * Sources:
 *   rsuData        → RSU vest lots (one per vest event, net shares after tax)
 *   incomeData     → ESPP lots     (one per month with espp_shares > 0)
 *   incomeData +   → EPF balance   (one per person: opening + cumulative monthly × 2)
 *   investmentsData
 *   investmentsData → Long-term Goals (savedAmount as portfolio holding)
 */

import { PERSONS, PERSON_STOCK, MONTHS } from "./constants";
import { getEsspINR } from "./formatters";

// ── date guard ─────────────────────────────────────────────────────────────────

// Only include a derived holding if its date falls in the current month or earlier.
// Computed once on module load; refreshes on next full page load.
const _now = new Date();
const _todayYM = _now.getFullYear() * 100 + _now.getMonth(); // e.g. 202604 for April 2026

function atOrBeforeNow(dateStr) {
  const d = new Date(dateStr);
  return d.getFullYear() * 100 + d.getMonth() <= _todayYM;
}

// ── helpers ────────────────────────────────────────────────────────────────

/** Convert FY string + month index (0=Apr … 11=Mar) to "YYYY-MM-15" date string. */
function miToDate(fy, mi) {
  const yr = parseInt(fy.match(/FY(\d{4})/)?.[1] || "2026");
  // Apr=0 → calMonth=4, ..., Dec=8 → calMonth=12, Jan=9 → calMonth=1, ..., Mar=11 → calMonth=3
  const calMonth = mi < 9 ? mi + 4 : mi - 8;
  const calYear  = yr + (mi >= 9 ? 1 : 0);
  return `${calYear}-${String(calMonth).padStart(2, "0")}-15`;
}

// ── RSU lots ───────────────────────────────────────────────────────────────

function deriveRSULots(rsuData) {
  const lots = [];
  for (const fy of Object.keys(rsuData || {})) {
    for (const ev of rsuData[fy] || []) {
      if (!atOrBeforeNow(ev.vest_date)) continue;   // future vest — skip
      const netUnits = (ev.units_vested || 0) - (ev.tax_withheld_units || 0);
      if (netUnits <= 0) continue;
      lots.push({
        id:                  `derived-rsu-${ev.id}`,
        type:                "us_stock",
        person:              ev.person,
        name:                `${ev.stock} RSU ${MONTHS[ev.month_idx] || ""} ${fy.replace("FY", "")}`,
        symbol:              ev.stock,
        quantity:            netUnits,
        costBasisINR:        netUnits * (ev.stock_price_usd || 0) * (ev.usd_inr_rate || 0),
        acquisitionDate:     ev.vest_date,
        acquisitionPrice:    ev.stock_price_usd,
        acquisitionCurrency: "USD",
        acquisitionUSDINR:   ev.usd_inr_rate,
        derived:             true,
        source:              "rsu",
      });
    }
  }
  return lots;
}

// ── ESPP lots ──────────────────────────────────────────────────────────────

function deriveESPPLots(incomeData) {
  const lots = [];
  for (const fy of Object.keys(incomeData || {}).filter(k => k.startsWith("FY"))) {
    for (const person of PERSONS) {
      const months = incomeData[fy]?.[person] || {};
      for (const [miStr, d] of Object.entries(months)) {
        const mi = Number(miStr);
        if (!atOrBeforeNow(miToDate(fy, mi))) continue;  // future month — skip
        const shares = Number(d.espp_shares || 0);
        if (!shares) continue;
        const priceUSD = Number(d.espp_price_usd || 0);
        const rate     = Number(d.espp_usd_inr   || 0);
        lots.push({
          id:                  `derived-espp-${person}-${fy}-${mi}`,
          type:                "us_stock",
          person,
          name:                `${PERSON_STOCK[person]} ESPP ${MONTHS[mi] || ""} ${fy.replace("FY", "")}`,
          symbol:              PERSON_STOCK[person],
          quantity:            shares,
          costBasisINR:        getEsspINR(d),
          acquisitionDate:     d.espp_vest_date || miToDate(fy, mi),
          acquisitionPrice:    priceUSD,
          acquisitionCurrency: "USD",
          acquisitionUSDINR:   rate,
          derived:             true,
          source:              "espp",
        });
      }
    }
  }
  return lots;
}

// ── EPF ────────────────────────────────────────────────────────────────────

/**
 * EPF balance = opening (from the earliest FY's investmentsData) + cumulative monthly × 2
 * (monthly epf in incomeData = employee contribution; employer matches 1:1)
 */
function deriveEPF(incomeData, investmentsData) {
  return PERSONS.map(person => {
    // Opening balance: use the earliest FY that has epfOpening for this person
    let opening = 0;
    for (const fy of Object.keys(investmentsData || {}).filter(k => k.startsWith("FY")).sort()) {
      const val = investmentsData[fy]?.epfOpening?.[person];
      if (val != null) { opening = val; break; }
    }

    // Sum all monthly EPF contributions (employee share; employer = same, so ×2)
    let totalContrib = 0;
    for (const fy of Object.keys(incomeData || {}).filter(k => k.startsWith("FY"))) {
      const months = incomeData[fy]?.[person] || {};
      for (const [miStr, d] of Object.entries(months)) {
        if (!atOrBeforeNow(miToDate(fy, Number(miStr)))) continue;  // future month
        totalContrib += Number(d.epf || 0) * 2;
      }
    }

    return {
      id:      `derived-epf-${person}`,
      type:    "epf",
      person,
      name:    `EPF — ${person}`,
      balance: opening + totalContrib,
      derived: true,
      source:  "epf",
    };
  });
}

// ── Long-term Goals ────────────────────────────────────────────────────────

function deriveGoals(investmentsData) {
  return (investmentsData?.goals || [])
    .filter(g => g.termType === "long" && Number(g.savedAmount) > 0)
    .map(g => ({
      id:           `derived-goal-${g.id}`,
      type:         "mf",
      person:       "Joint",
      name:         g.name,
      units:        0,
      costBasisINR: Number(g.savedAmount) || 0,
      derived:      true,
      source:       "goal",
    }));
}

// ── Main export ────────────────────────────────────────────────────────────

/**
 * Returns a flat array of all derived holdings.
 * RSU lots sorted newest-first within each person.
 */
export function getDerivedHoldings(rsuData, incomeData, investmentsData) {
  return [
    ...deriveRSULots(rsuData),
    ...deriveESPPLots(incomeData),
    ...deriveEPF(incomeData, investmentsData),
    ...deriveGoals(investmentsData),
  ];
}
