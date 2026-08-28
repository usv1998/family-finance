// Fetches live MSFT, NVDA prices and USD/INR rate.
// Stocks: Twelve Data.
// Forex:  open.er-api.com (free, CORS-enabled, no auth).

import { fetchStockPriceTD } from "./twelveData";

const FOREX_URL = "https://open.er-api.com/v6/latest/USD";

async function fetchYFPrice(symbol) {
  return fetchStockPriceTD(symbol);
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
