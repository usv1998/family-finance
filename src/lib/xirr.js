/**
 * Newton-Raphson XIRR solver.
 *
 * cashFlows: Array of { amount: number, date: Date | string }
 *   - negative amount = investment (outflow)
 *   - positive amount = return / current value (inflow)
 *
 * Returns annualized rate as a decimal (e.g. 0.15 = 15%), or null if
 * the solver doesn't converge or inputs are invalid.
 */
export function xirr(cashFlows, guess = 0.1) {
  if (!cashFlows || cashFlows.length < 2) return null;

  const flows = cashFlows.map(cf => ({
    amount: cf.amount,
    t: cf.date instanceof Date ? cf.date : new Date(cf.date),
  }));

  // Reference date = first cash flow date
  const t0 = flows[0].t.getTime();

  function yearFraction(t) {
    return (t.getTime() - t0) / (365.25 * 24 * 60 * 60 * 1000);
  }

  function npv(rate) {
    return flows.reduce((sum, cf) => {
      const yr = yearFraction(cf.t);
      return sum + cf.amount / Math.pow(1 + rate, yr);
    }, 0);
  }

  function dnpv(rate) {
    return flows.reduce((sum, cf) => {
      const yr = yearFraction(cf.t);
      if (yr === 0) return sum;
      return sum - yr * cf.amount / Math.pow(1 + rate, yr + 1);
    }, 0);
  }

  let rate = guess;
  for (let i = 0; i < 200; i++) {
    const f  = npv(rate);
    const df = dnpv(rate);
    if (!isFinite(f) || !isFinite(df) || Math.abs(df) < 1e-12) break;
    const delta = f / df;
    rate -= delta;
    if (Math.abs(delta) < 1e-8) return rate;
  }
  return null;
}

/**
 * Compute XIRR for a single holding with two cash flows:
 *   outflow = -costBasisINR on acquisitionDate
 *   inflow  = +currentValueINR today
 *
 * Returns null if acquisitionDate, costBasisINR, or currentValueINR is missing/zero.
 */
export function holdingXIRR(holding, currentValueINR) {
  if (!holding?.acquisitionDate || !(holding.costBasisINR > 0) || !(currentValueINR > 0)) return null;
  const acqDate = new Date(holding.acquisitionDate);
  const today   = new Date();
  // XIRR is only meaningful for holding periods >= 1 year
  if ((today - acqDate) < 365 * 24 * 60 * 60 * 1000) return null;
  return xirr([
    { amount: -holding.costBasisINR, date: acqDate },
    { amount: currentValueINR,       date: today   },
  ]);
}

/**
 * Compute portfolio-level XIRR from an array of enriched holdings
 * (each holding must have acquisitionDate, costBasisINR, currentValue).
 *
 * Combines all purchase outflows at their dates + total current value today.
 */
export function portfolioXIRR(enrichedHoldings) {
  const flows = [];
  let totalValue = 0;
  const today = new Date();

  for (const h of enrichedHoldings) {
    if (!h.acquisitionDate || !(h.costBasisINR > 0)) continue;
    flows.push({ amount: -h.costBasisINR, date: new Date(h.acquisitionDate) });
    totalValue += h.currentValue || 0;
  }

  if (flows.length === 0 || totalValue <= 0) return null;

  flows.sort((a, b) => a.date - b.date);
  // Only show XIRR when oldest holding is >= 1 year old
  if ((today - flows[0].date) < 365 * 24 * 60 * 60 * 1000) return null;

  flows.push({ amount: totalValue, date: today });
  return xirr(flows);
}
