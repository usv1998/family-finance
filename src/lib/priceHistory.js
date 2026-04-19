/**
 * Monthly historical price cache.
 *
 * Sources:
 *   Stocks / indices: Yahoo Finance v8, 10-year monthly range, via corsproxy.io
 *   Mutual funds:     mfapi.in (full AMFI NAV history, CORS-enabled)
 *
 * Caching strategy:
 *   Past months' prices never change → store permanently in localStorage.
 *   Only the current calendar month is re-fetched on each call.
 *   Cache key per symbol: "ph1:<symbol>" → JSON { "YYYY-MM": price }
 */

const PROXY   = "https://corsproxy.io/?";
const YF_BASE = "https://query2.finance.yahoo.com/v8/finance/chart";
const MF_BASE = "https://api.mfapi.in/mf";

function nowYM() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}`;
}

function cacheKey(symbol) {
  return `ph1:${symbol}`;
}

function loadCache(symbol) {
  try { return JSON.parse(localStorage.getItem(cacheKey(symbol)) || "{}"); }
  catch { return {}; }
}

function saveCache(symbol, data) {
  try { localStorage.setItem(cacheKey(symbol), JSON.stringify(data)); } catch {}
}

async function fetchYFMonthly(symbol) {
  const url = PROXY + encodeURIComponent(`${YF_BASE}/${symbol}?interval=1mo&range=10y`);
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`YF ${symbol}: HTTP ${res.status}`);
  const json = await res.json();
  const result = json?.chart?.result?.[0];
  if (!result) throw new Error(`YF ${symbol}: empty result`);

  const timestamps = result.timestamp || [];
  // Prefer adjusted close (accounts for splits/dividends); fall back to raw close
  const prices =
    result.indicators?.adjclose?.[0]?.adjclose ||
    result.indicators?.quote?.[0]?.close || [];

  const map = {};
  timestamps.forEach((ts, i) => {
    if (prices[i] == null) return;
    const d   = new Date(ts * 1000);
    const ym  = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
    if (!map[ym]) map[ym] = prices[i];
  });
  return map;
}

async function fetchMFMonthly(schemeCode) {
  const res = await fetch(`${MF_BASE}/${schemeCode}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`MF ${schemeCode}: HTTP ${res.status}`);
  const json = await res.json();

  const map = {};
  // Data is newest-first: [{ date:"DD-MM-YYYY", nav:"123.45" }]
  for (const { date, nav } of (json.data || [])) {
    const parts = date.split("-");
    if (parts.length !== 3) continue;
    const [, m, y] = parts;
    const ym = `${y}-${m}`;
    // First entry per month = latest NAV for that month (data is newest-first)
    if (!map[ym]) map[ym] = parseFloat(nav);
  }
  return map;
}

/**
 * Return { "YYYY-MM": price } for a symbol, using cache where possible.
 *
 * @param {string}          symbol  Ticker (MSFT, RELIANCE.NS, ^NSEI) or MF scheme code
 * @param {"stock"|"mf"}    type
 */
export async function getMonthlyHistory(symbol, type = "stock") {
  const cached = loadCache(symbol);
  const ym     = nowYM();

  // Skip network if current month is already in cache
  if (Object.keys(cached).length > 0 && cached[ym] != null) return cached;

  let fresh;
  try {
    fresh = type === "mf"
      ? await fetchMFMonthly(symbol)
      : await fetchYFMonthly(symbol);
  } catch {
    return cached; // network failure → serve stale cache
  }

  // Merge: add any new data from fresh; for past months keep cached (more stable)
  const merged = { ...cached };
  for (const [k, v] of Object.entries(fresh)) {
    if (k >= ym || merged[k] == null) merged[k] = v;
  }

  saveCache(symbol, merged);
  return merged;
}

/** Clear all cached price history (call from dev console if needed). */
export function clearPriceHistoryCache() {
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith("ph1:")) localStorage.removeItem(key);
  }
}
