// Fetches live MSFT, NVDA prices and USD/INR rate.
// Stocks: Yahoo Finance v8 via corsproxy.io (adds CORS headers).
// Forex:  open.er-api.com (free, CORS-enabled, no auth).

const PROXY   = "https://corsproxy.io/?";
const YF_BASE = "https://query2.finance.yahoo.com/v8/finance/chart";
const FOREX_URL = "https://open.er-api.com/v6/latest/USD";

async function fetchYFPrice(symbol) {
  const url = PROXY + encodeURIComponent(`${YF_BASE}/${symbol}?interval=1d&range=1d`);
  const res  = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;
  const json = await res.json();
  return json?.chart?.result?.[0]?.meta?.regularMarketPrice ?? null;
}

export async function fetchLiveData() {
  const [msftRes, nvdaRes, forexRes] = await Promise.allSettled([
    fetchYFPrice("MSFT"),
    fetchYFPrice("NVDA"),
    fetch(FOREX_URL, { cache: "no-store" }).then(r => r.ok ? r.json() : null),
  ]);

  const msft   = msftRes.status  === "fulfilled" ? msftRes.value  : null;
  const nvda   = nvdaRes.status  === "fulfilled" ? nvdaRes.value  : null;
  const usdinr = forexRes.status === "fulfilled" && forexRes.value
    ? (forexRes.value?.rates?.INR ?? null)
    : null;

  return {
    MSFT:      msft,
    NVDA:      nvda,
    USDINR:    usdinr,
    fetchedAt: Date.now(),
    partial:   !msft || !nvda || !usdinr,
    error:     !msft && !nvda && !usdinr,
  };
}
