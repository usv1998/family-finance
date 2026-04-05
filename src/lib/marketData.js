// Fetches live MSFT, NVDA prices and USD/INR rate.
// Primary: Yahoo Finance v8 chart (query2, no auth required).
// Fallback: Frankfurter.app for USD/INR if Yahoo fails.

const YF_CHART = (symbol) =>
  `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d&includePrePost=false`;

const FOREX_URL = "https://api.frankfurter.app/latest?from=USD&to=INR";

async function fetchYFPrice(symbol) {
  const res = await fetch(YF_CHART(symbol), { cache: "no-store" });
  if (!res.ok) return null;
  const json = await res.json();
  return json?.chart?.result?.[0]?.meta?.regularMarketPrice ?? null;
}

export async function fetchLiveData() {
  // Fetch all four in parallel
  const [msftRes, nvdaRes, usdinrRes, forexRes] = await Promise.allSettled([
    fetchYFPrice("MSFT"),
    fetchYFPrice("NVDA"),
    fetchYFPrice("USDINR=X"),
    fetch(FOREX_URL, { cache: "no-store" }).then(r => r.ok ? r.json() : null),
  ]);

  const msft   = msftRes.status   === "fulfilled" ? msftRes.value   : null;
  const nvda   = nvdaRes.status   === "fulfilled" ? nvdaRes.value   : null;
  // Prefer Yahoo's USDINR; fall back to Frankfurter
  let usdinr   = usdinrRes.status === "fulfilled" ? usdinrRes.value : null;
  if (!usdinr && forexRes.status === "fulfilled" && forexRes.value) {
    usdinr = forexRes.value?.rates?.INR ?? null;
  }

  return {
    MSFT:      msft,
    NVDA:      nvda,
    USDINR:    usdinr,
    fetchedAt: Date.now(),
    partial:   !msft || !nvda || !usdinr,
    error:     !msft && !nvda && !usdinr,
  };
}
