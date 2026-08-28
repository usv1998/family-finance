const TWELVE_DATA_BASE = import.meta.env.VITE_TWELVEDATA_BASE || "https://api.twelvedata.com";
const TWELVE_DATA_API_KEY = import.meta.env.VITE_TWELVEDATA_API_KEY;

function normalizeSymbol(symbol) {
  if (!symbol) return null;
  if (symbol === "USDINR=X") return "USD/INR";
  if (/\.NS$/i.test(symbol)) return `${symbol.slice(0, -3)}:NSE`;
  if (/\.BO$/i.test(symbol)) return `${symbol.slice(0, -3)}:BSE`;
  return symbol;
}

function parseNumber(value) {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : null;
}

async function fetchTwelveData(endpoint, params) {
  if (!TWELVE_DATA_API_KEY) return null;

  const url = new URL(`${TWELVE_DATA_BASE}/${endpoint}`);
  url.searchParams.set("apikey", TWELVE_DATA_API_KEY);

  for (const [key, value] of Object.entries(params)) {
    if (value != null && value !== "") url.searchParams.set(key, String(value));
  }

  const res = await fetch(url.toString(), {
    cache: "no-store",
    headers: { Accept: "application/json, text/plain, */*" },
  });
  if (!res.ok) return null;

  const json = await res.json();
  if (json?.status === "error" || json?.code) return null;
  return json;
}

export async function fetchStockPriceTD(symbol) {
  const normalized = normalizeSymbol(symbol);
  if (!normalized || normalized === "USD/INR") return null;

  const json = await fetchTwelveData("price", { symbol: normalized });
  return parseNumber(json?.price);
}

export async function fetchStockPriceWithChangeTD(symbol) {
  const normalized = normalizeSymbol(symbol);
  if (!normalized || normalized === "USD/INR") return null;

  const [priceJson, seriesJson] = await Promise.all([
    fetchTwelveData("price", { symbol: normalized }),
    fetchTwelveData("time_series", { symbol: normalized, interval: "1day", outputsize: 2 }),
  ]);

  const price = parseNumber(priceJson?.price);
  const values = Array.isArray(seriesJson?.values) ? seriesJson.values : [];
  const latestClose = parseNumber(values[0]?.close);
  const prevClose = parseNumber(values[1]?.close);
  const basePrice = price ?? latestClose;
  const changePct = latestClose != null && prevClose != null && prevClose > 0
    ? ((latestClose - prevClose) / prevClose) * 100
    : null;

  if (basePrice == null) return null;
  return { price: basePrice, changePct, prevClose };
}

export async function fetchStockPriceAtDateTD(symbol, targetDate) {
  const normalized = normalizeSymbol(symbol);
  if (!normalized || normalized === "USD/INR") return null;

  const json = await fetchTwelveData("time_series", {
    symbol: normalized,
    interval: "1day",
    end_date: targetDate,
    outputsize: 7,
  });
  const values = Array.isArray(json?.values) ? json.values : [];
  const row = values.find((entry) => entry?.datetime?.slice(0, 10) <= targetDate);
  return parseNumber(row?.close);
}

export async function fetchMonthlyStockHistoryTD(symbol) {
  const normalized = normalizeSymbol(symbol);
  if (!normalized || normalized === "USD/INR") return null;

  const json = await fetchTwelveData("time_series", {
    symbol: normalized,
    interval: "1month",
    outputsize: 120,
  });
  const values = Array.isArray(json?.values) ? json.values : [];
  if (!values.length) return null;

  const map = {};
  for (const entry of values) {
    const ym = entry?.datetime?.slice(0, 7);
    const close = parseNumber(entry?.close);
    if (ym && close != null && map[ym] == null) map[ym] = close;
  }
  return map;
}
