/**
 * Fetch historical USD/INR exchange rate from Frankfurter API.
 * Free, CORS-enabled, no auth required.
 * API: https://api.frankfurter.dev/v1/{YYYY-MM-DD}?from=USD&to=INR
 * Returns: { rates: { INR: 94.2 } }
 *
 * Weekends/holidays: Frankfurter returns the most recent business day's rate.
 */

const cache = new Map();

export async function fetchHistoricalUSDINR(dateStr) {
  if (!dateStr) return null;
  if (cache.has(dateStr)) return cache.get(dateStr);

  try {
    const res = await fetch(`https://api.frankfurter.dev/v1/${dateStr}?from=USD&to=INR`);
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

/**
 * Fetch EOD closing price for a US stock on or before the given date.
 * Uses Yahoo Finance v8 via corsproxy.io (same as live prices).
 * Looks back up to 5 days to handle weekends/holidays.
 */
const priceCache = new Map();

export async function fetchHistoricalStockPrice(symbol, dateStr) {
  if (!symbol || !dateStr) return null;
  const key = `${symbol}-${dateStr}`;
  if (priceCache.has(key)) return priceCache.get(key);

  try {
    const date = new Date(dateStr + "T00:00:00Z");
    const period2 = Math.floor(date.getTime() / 1000) + 86400;        // end = date + 1 day
    const period1 = period2 - 6 * 86400;                               // start = 6 days before
    const url = `https://corsproxy.io/?https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&period1=${period1}&period2=${period2}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    const closes = json?.chart?.result?.[0]?.indicators?.quote?.[0]?.close || [];
    // Take the last non-null close (most recent trading day on or before requested date)
    const price = [...closes].reverse().find(c => c != null) ?? null;
    if (price) priceCache.set(key, Math.round(price * 100) / 100);
    return priceCache.get(key) ?? null;
  } catch {
    return null;
  }
}

/** Format a JS Date as "YYYY-MM-DD" for the Frankfurter API. */
export function toDateStr(date) {
  const d = date instanceof Date ? date : new Date(date);
  return d.toISOString().slice(0, 10);
}
