// Fetches live MSFT, NVDA prices and USD/INR rate.
// Uses Yahoo Finance v7 (no API key, CORS-open).
// Falls back to Frankfurter.app for forex if Yahoo fails.

const YF_URL   = "https://query1.finance.yahoo.com/v7/finance/quote?symbols=MSFT%2CNVDA%2CUSDINR%3DX&fields=regularMarketPrice";
const FOREX_URL = "https://api.frankfurter.app/latest?from=USD&to=INR";

export async function fetchLiveData() {
  let msft = null, nvda = null, usdinr = null;

  // ── Try Yahoo Finance (all three in one call) ───────────────────────────
  try {
    const res = await fetch(YF_URL, { cache: "no-store" });
    if (res.ok) {
      const json = await res.json();
      const results = json?.quoteResponse?.result || [];
      for (const r of results) {
        const p = r.regularMarketPrice;
        if (r.symbol === "MSFT")      msft   = p;
        else if (r.symbol === "NVDA") nvda   = p;
        else if (r.symbol === "USDINR=X") usdinr = p;
      }
    }
  } catch (_) {
    // Yahoo blocked or network error — fall through to forex fallback
  }

  // ── Frankfurter fallback for USD/INR if Yahoo didn't return it ──────────
  if (!usdinr) {
    try {
      const res = await fetch(FOREX_URL, { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        usdinr = json?.rates?.INR ?? null;
      }
    } catch (_) { /* ignore */ }
  }

  // Return whatever we got; null means "use previous / default"
  return {
    MSFT:    msft,
    NVDA:    nvda,
    USDINR:  usdinr,
    fetchedAt: Date.now(),
    partial: !msft || !nvda || !usdinr,
    error:   !msft && !nvda && !usdinr,
  };
}
