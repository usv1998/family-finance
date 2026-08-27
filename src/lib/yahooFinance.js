const CORS_PROXY_BASE = "https://corsproxy.io/?url=";
const YAHOO_CHART_BASES = [
  "https://query2.finance.yahoo.com/v8/finance/chart",
  "https://query1.finance.yahoo.com/v8/finance/chart",
];

function buildYahooUrl(base, symbol, query) {
  return `${base}/${encodeURIComponent(symbol)}?${query}`;
}

async function fetchJson(url) {
  const res = await fetch(url, {
    cache: "no-store",
    headers: { Accept: "application/json, text/plain, */*" },
  });
  if (!res.ok) return null;
  return res.json();
}

export async function fetchYahooChart(symbol, query) {
  for (const base of YAHOO_CHART_BASES) {
    const targetUrl = buildYahooUrl(base, symbol, query);
    const proxiedUrl = `${CORS_PROXY_BASE}${encodeURIComponent(targetUrl)}`;

    try {
      const json = await fetchJson(proxiedUrl);
      if (json?.chart?.result?.[0]) return json;
    } catch {
      // Try the next Yahoo host before giving up.
    }
  }

  return null;
}
