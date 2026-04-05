// Fetches live MSFT, NVDA prices and USD/INR rate.
// Uses Yahoo Finance v7 (no API key, CORS-open).
// Falls back to Frankfurter.app for forex if Yahoo fails.

const YF_URL   = "https://query1.finance.yahoo.com/v7/finance/quote?symbols=MSFT%2CNVDA%2CUSDINR%3DX&fields=regularMarketPrice";
const FOREX_URL = "https://api.frankfurter.app/latest?from=USD&to=INR";

export async function fetchLiveData() {
  // ── Run Yahoo and Frankfurter in parallel ────────────────────────────────
  const [yahooResult, forexResult] = await Promise.allSettled([
    fetch(YF_URL,   { cache: "no-store" }).then(r => r.ok ? r.json() : null),
    fetch(FOREX_URL,{ cache: "no-store" }).then(r => r.ok ? r.json() : null),
  ]);

  let msft = null, nvda = null, usdinr = null;

  if (yahooResult.status === "fulfilled" && yahooResult.value) {
    for (const r of yahooResult.value?.quoteResponse?.result || []) {
      const p = r.regularMarketPrice;
      if (r.symbol === "MSFT")          msft   = p;
      else if (r.symbol === "NVDA")     nvda   = p;
      else if (r.symbol === "USDINR=X") usdinr = p;
    }
  }

  // Prefer Yahoo's USDINR; fall back to Frankfurter
  if (!usdinr && forexResult.status === "fulfilled" && forexResult.value) {
    usdinr = forexResult.value?.rates?.INR ?? null;
  }

  return {
    MSFT:    msft,
    NVDA:    nvda,
    USDINR:  usdinr,
    fetchedAt: Date.now(),
    partial: !msft || !nvda || !usdinr,
    error:   !msft && !nvda && !usdinr,
  };
}
