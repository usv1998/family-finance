// Price fetching for all holding types.
// Stocks: Yahoo Finance v8 via corsproxy.io
// MFs:    mfapi.in (free, CORS-enabled, AMFI official NAV)
// FD:     quarterly compound interest (calculated)
// EPF/PPF: manual balance, no fetch

import { fetchYahooChart } from "./yahooFinance";

const MF_BASE = "https://api.mfapi.in/mf";

// Fetch a stock price. US stocks return USD; Indian .NS/.BO stocks return INR.
export async function fetchStockPrice(symbol) {
  try {
    const json = await fetchYahooChart(symbol, "interval=1d&range=1d");
    if (!json) return null;
    return json?.chart?.result?.[0]?.meta?.regularMarketPrice ?? null;
  } catch { return null; }
}

// Fetch stock price + 1D change percent for a symbol.
// Returns { price, changePct, prevClose } or null.
//
// changePct = (yesterday close - day-before-yesterday close) / day-before-yesterday close
// This always shows the previous completed session's move, not today's intraday recovery.
// e.g. if NVDA crashed yesterday but is recovering today, this correctly shows the crash.
export async function fetchStockPriceWithChange(symbol) {
  try {
    const json   = await fetchYahooChart(symbol, "interval=1d&range=5d");
    if (!json) return null;
    const result = json?.chart?.result?.[0];
    if (!result) return null;

    const price  = result.meta?.regularMarketPrice ?? null;

    // Historical closing prices for last 5 trading days (null = market still open today)
    const allCloses = result.indicators?.quote?.[0]?.close ?? [];
    const closes    = allCloses.filter(c => c != null); // completed sessions only

    // Use the last two completed sessions: closes[-1] = yesterday, closes[-2] = day before
    // Skipping today's live price so we always show the previous session's actual move.
    const yesterday  = closes.length >= 1 ? closes[closes.length - 1] : null;
    const dayBefore  = closes.length >= 2 ? closes[closes.length - 2] : null;
    const changePct  = yesterday != null && dayBefore != null && dayBefore > 0
      ? (yesterday - dayBefore) / dayBefore * 100
      : null;

    return { price, changePct, prevClose: dayBefore };
  } catch { return null; }
}

// Fetch prices + 1D change for all stock+MF holdings.
// onProgress(fetched, total, label) called as each price resolves.
// Returns { priceMap, changeMap } where changeMap: { symbol: changePct% }
export async function fetchAllPricesWithChange(holdings, onProgress) {
  const stockSymbols = [...new Set(
    holdings
      .filter(h => h.type === "us_stock" || h.type === "in_stock")
      .map(h => {
        if (h.type === "in_stock" && h.symbol && !/\.(NS|BO)$/i.test(h.symbol)) {
          return h.symbol + ".NS";
        }
        return h.symbol;
      }).filter(Boolean)
  )];
  const mfCodes = [...new Set(
    holdings.filter(h => h.type === "mf").map(h => h.schemeCode).filter(Boolean)
  )];

  const total = stockSymbols.length + mfCodes.length;
  let fetched = 0;
  const tick = (label) => { fetched++; onProgress?.(fetched, total, label); };

  const [stockResults, mfResults] = await Promise.all([
    Promise.allSettled(stockSymbols.map(s =>
      fetchStockPriceWithChange(s)
        .then(r => { tick(s); return { k: s, price: r?.price, changePct: r?.changePct, prevClose: r?.prevClose }; })
        .catch(() => { tick(s); return { k: s, price: null }; })
    )),
    Promise.allSettled(mfCodes.map(c =>
      fetchMFNavWithChange(c)
        .then(r => { tick(String(c)); return { k: c, price: r?.price ?? null, changePct: r?.changePct ?? null }; })
        .catch(() => { tick(String(c)); return { k: c, price: null }; })
    )),
  ]);

  const priceMap    = {};
  const changeMap   = {};
  const prevCloseMap = {}; // { symbol: prevClose } — needed to re-derive changePct when price is overridden
  for (const r of [...stockResults, ...mfResults]) {
    if (r.status === "fulfilled" && r.value.price != null) {
      priceMap[r.value.k]  = r.value.price;
      if (r.value.changePct != null) changeMap[r.value.k]   = r.value.changePct;
      if (r.value.prevClose != null) prevCloseMap[r.value.k] = r.value.prevClose;
    }
  }
  return { priceMap, changeMap, prevCloseMap, total, fetched: Object.keys(priceMap).length };
}

// Fetch latest NAV + 1D change for an AMFI scheme code.
// mfapi.in returns data[] sorted newest-first — data[0]=today, data[1]=yesterday.
// Returns { price, changePct } or null.
export async function fetchMFNavWithChange(schemeCode) {
  try {
    const res  = await fetch(`${MF_BASE}/${schemeCode}`, { cache: "no-store" });
    if (!res.ok) return null;
    const json = await res.json();
    const data = json?.data;
    if (!data?.length) return null;
    const todayNav  = parseFloat(data[0]?.nav) || null;
    const prevNav   = data.length > 1 ? parseFloat(data[1]?.nav) || null : null;
    const changePct = todayNav != null && prevNav != null && prevNav > 0
      ? (todayNav - prevNav) / prevNav * 100
      : null;
    return { price: todayNav, changePct };
  } catch { return null; }
}

// ── Historical price fetching (for FY gain calculation) ──────────────────────

/**
 * Fetch closing price of a stock/index on or nearest to targetDate.
 * Uses Yahoo Finance range=1y&interval=1d (covers last 12 months).
 * Accepts at most ±5 trading days from targetDate.
 * Returns price or null.
 */
export async function fetchStockPriceAtDate(symbol, targetDate) {
  try {
    const json = await fetchYahooChart(symbol, "interval=1d&range=1y");
    if (!json) return null;
    const result = json?.chart?.result?.[0];
    if (!result) return null;

    const timestamps = result.timestamp || [];
    const closes     = result.indicators?.quote?.[0]?.close || [];
    const targetTs   = new Date(targetDate + "T00:00:00Z").getTime() / 1000;

    let bestIdx = -1, bestDiff = Infinity;
    for (let i = 0; i < timestamps.length; i++) {
      if (closes[i] == null) continue;
      const diff = Math.abs(timestamps[i] - targetTs);
      if (diff < bestDiff) { bestDiff = diff; bestIdx = i; }
    }
    // Accept only if within 5 calendar days
    return bestIdx >= 0 && bestDiff <= 5 * 86400 ? closes[bestIdx] : null;
  } catch { return null; }
}

/**
 * Fetch MF NAV on or nearest to targetDate from mfapi.in.
 * mfapi returns data[] sorted newest-first with date "DD-MM-YYYY".
 * Returns NAV or null.
 */
export async function fetchMFNavAtDate(schemeCode, targetDate) {
  try {
    const res = await fetch(`${MF_BASE}/${schemeCode}`, { cache: "no-store" });
    if (!res.ok) return null;
    const json = await res.json();
    const data = json?.data;
    if (!data?.length) return null;

    const targetTs = new Date(targetDate + "T00:00:00").getTime();
    let bestEntry = null, bestDiff = Infinity;

    for (const entry of data) {
      // mfapi date format: "DD-MM-YYYY"
      const [ed, em, ey] = entry.date.split("-");
      const entryTs = new Date(`${ey}-${em}-${ed}T00:00:00`).getTime();
      const diff = Math.abs(entryTs - targetTs);
      if (diff < bestDiff) { bestDiff = diff; bestEntry = entry; }
      // Stop once we've gone more than 7 days before the target
      if (entryTs < targetTs - 7 * 86400000) break;
    }
    return bestEntry && bestDiff <= 7 * 86400000 ? parseFloat(bestEntry.nav) || null : null;
  } catch { return null; }
}

/**
 * Fetch prices for all stock+MF holdings at a specific historical date.
 * Also fetches USD/INR on that date for accurate INR conversion.
 * Returns { priceMap, usdinr } keyed by symbol / schemeCode.
 */
export async function fetchAllPricesAtDate(holdings, targetDate) {
  const stockSymbols = [...new Set(
    holdings
      .filter(h => h.type === "us_stock" || h.type === "in_stock")
      .map(h => {
        if (h.type === "in_stock" && h.symbol && !/\.(NS|BO)$/i.test(h.symbol))
          return h.symbol + ".NS";
        return h.symbol;
      }).filter(Boolean)
  )];
  const mfCodes = [...new Set(
    holdings.filter(h => h.type === "mf").map(h => h.schemeCode).filter(Boolean)
  )];

  const [stockResults, mfResults, usdinrAtDate] = await Promise.all([
    Promise.allSettled(stockSymbols.map(s =>
      fetchStockPriceAtDate(s, targetDate).then(p => ({ k: s, v: p }))
    )),
    Promise.allSettled(mfCodes.map(c =>
      fetchMFNavAtDate(c, targetDate).then(n => ({ k: c, v: n }))
    )),
    fetchStockPriceAtDate("USDINR=X", targetDate), // USD/INR on that date
  ]);

  const priceMap = {};
  for (const r of [...stockResults, ...mfResults]) {
    if (r.status === "fulfilled" && r.value?.v != null) {
      priceMap[r.value.k] = r.value.v;
    }
  }

  return { priceMap, usdinr: usdinrAtDate || null };
}

// Fetch latest NAV for an AMFI scheme code (price only, no change).
export async function fetchMFNav(schemeCode) {
  try {
    const res  = await fetch(`${MF_BASE}/${schemeCode}`, { cache: "no-store" });
    if (!res.ok) return null;
    const json = await res.json();
    return parseFloat(json?.data?.[0]?.nav) || null;
  } catch { return null; }
}

// Search mutual funds by name. Returns [{schemeCode, schemeName, fundHouse}]
export async function searchMF(query) {
  try {
    const res = await fetch(`${MF_BASE}/search?q=${encodeURIComponent(query)}`);
    if (!res.ok) return [];
    return await res.json();
  } catch { return []; }
}

// FD current value: quarterly compounding (standard Indian bank FDs)
export function calcFDValue(principal, annualRate, startDate) {
  const days = Math.max(0, Math.floor((Date.now() - new Date(startDate)) / 86400000));
  if (days === 0) return principal;
  return principal * Math.pow(1 + annualRate / 400, days / 91.25);
}

// Compute current value in INR for any holding type.
// priceMap: { [symbol]: priceUSD_or_INR, [schemeCode]: nav }
export function getCurrentValueINR(holding, priceMap, usdinr = 85) {
  switch (holding.type) {
    case "us_stock": {
      const p = priceMap?.[holding.symbol];
      return p != null ? holding.quantity * p * usdinr : null;
    }
    case "in_stock": {
      // Stored without suffix; price map keyed with .NS appended for Yahoo
      const key = holding.symbol && !/\.(NS|BO)$/i.test(holding.symbol)
        ? holding.symbol + ".NS" : holding.symbol;
      const p = priceMap?.[key] ?? priceMap?.[holding.symbol];
      return p != null ? holding.quantity * p : null;
    }
    case "mf": {
      const nav = priceMap?.[holding.schemeCode];
      return nav != null ? holding.units * nav : null;
    }
    case "fd":
      return calcFDValue(holding.principal, holding.interestRate, holding.startDate);
    case "epf":
    case "ppf":
      return holding.balance || 0;
    default:
      return null;
  }
}

// Compute unrealised gain in INR (null if unknown).
export function getGainINR(holding, currentValue) {
  if (currentValue === null) return null;
  switch (holding.type) {
    case "us_stock":
    case "in_stock":
    case "mf":
      return holding.costBasisINR ? currentValue - holding.costBasisINR : null;
    case "fd":
      return currentValue - (holding.principal || 0);
    default:
      return null;
  }
}

// Fetch prices for all holdings in one parallel batch.
// Returns priceMap keyed by symbol (stocks) or schemeCode (MFs).
// Indian stocks are stored without suffix; Yahoo requires .NS for NSE.
export async function fetchAllPrices(holdings) {
  const stockSymbols = [...new Set(
    holdings
      .filter(h => h.type === "us_stock" || h.type === "in_stock")
      .map(h => {
        if (h.type === "in_stock" && h.symbol && !/\.(NS|BO)$/i.test(h.symbol)) {
          return h.symbol + ".NS";
        }
        return h.symbol;
      }).filter(Boolean)
  )];
  const mfCodes = [...new Set(
    holdings.filter(h => h.type === "mf").map(h => h.schemeCode).filter(Boolean)
  )];

  const results = await Promise.allSettled([
    ...stockSymbols.map(s => fetchStockPrice(s).then(p => ({ k: s,     v: p }))),
    ...mfCodes.map(c =>     fetchMFNav(c).then(n =>     ({ k: c,     v: n }))),
  ]);

  const priceMap = {};
  for (const r of results) {
    if (r.status === "fulfilled" && r.value.v != null) {
      priceMap[r.value.k] = r.value.v;
    }
  }
  return priceMap;
}
