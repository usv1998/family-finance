// Price fetching for all holding types.
// Stocks: Yahoo Finance v8 via corsproxy.io
// MFs:    mfapi.in (free, CORS-enabled, AMFI official NAV)
// FD:     quarterly compound interest (calculated)
// EPF/PPF: manual balance, no fetch

const PROXY   = "https://corsproxy.io/?";
const YF_BASE = "https://query2.finance.yahoo.com/v8/finance/chart";
const MF_BASE = "https://api.mfapi.in/mf";

// Fetch a stock price. US stocks return USD; Indian .NS/.BO stocks return INR.
export async function fetchStockPrice(symbol) {
  try {
    const url = PROXY + encodeURIComponent(`${YF_BASE}/${symbol}?interval=1d&range=1d`);
    const res  = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.chart?.result?.[0]?.meta?.regularMarketPrice ?? null;
  } catch { return null; }
}

// Fetch latest NAV for an AMFI scheme code.
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
