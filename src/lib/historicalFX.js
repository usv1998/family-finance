/**
 * Fetch historical USD/INR exchange rate from Frankfurter API.
 * Free, CORS-enabled, no auth required.
 * API: https://api.frankfurter.app/{YYYY-MM-DD}?from=USD&to=INR
 * Returns: { rates: { INR: 94.2 } }
 *
 * Weekends/holidays: Frankfurter returns the most recent business day's rate.
 */

const cache = new Map();

export async function fetchHistoricalUSDINR(dateStr) {
  if (!dateStr) return null;
  if (cache.has(dateStr)) return cache.get(dateStr);

  try {
    const res = await fetch(`https://api.frankfurter.app/${dateStr}?from=USD&to=INR`);
    if (!res.ok) return null;
    const data = await res.json();
    const rate = data?.rates?.INR;
    if (rate) {
      cache.set(dateStr, rate);
      // Also cache the actual date returned (may differ from requested for holidays)
      if (data.date && data.date !== dateStr) cache.set(data.date, rate);
    }
    return rate ?? null;
  } catch {
    return null;
  }
}

/** Format a JS Date as "YYYY-MM-DD" for the Frankfurter API. */
export function toDateStr(date) {
  const d = date instanceof Date ? date : new Date(date);
  return d.toISOString().slice(0, 10);
}
