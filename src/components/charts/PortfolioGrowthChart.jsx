import { useState, useEffect, useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { T } from "../../lib/theme";
import { getMonthlyHistory } from "../../lib/priceHistory";

// ── Benchmarks ────────────────────────────────────────────────────────────────
// Gold:    GOLDBEES.NS  — Gold BeES ETF, INR-denominated, tracks MCX gold
// Nifty:   ^NSEI        — Nifty 50 index points (INR)
// S&P 500: ^GSPC (USD) × USDINR=X — converted to INR
const BENCHMARKS = [
  { key:"nifty", label:"Nifty 50",      symbol:"^NSEI",      color:T.blue,    type:"stock" },
  { key:"sp500", label:"S&P 500 (₹)",   symbol:"^GSPC",      color:T.purple,  type:"stock" },
  { key:"gold",  label:"Gold",           symbol:"GOLDBEES.NS", color:"#EAB308", type:"stock" },
];

const RANGES = [
  { label:"1M",  months:1  },
  { label:"3M",  months:3  },
  { label:"6M",  months:6  },
  { label:"YTD", ytd:true  },
  { label:"1Y",  months:12 },
  { label:"2Y",  months:24 },
  { label:"3Y",  months:36 },
  { label:"5Y",  months:60 },
  { label:"All"             },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function nowYM() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}`;
}

function subtractMonths(ym, n) {
  let [y, m] = ym.split("-").map(Number);
  m -= n;
  while (m <= 0) { m += 12; y--; }
  return `${y}-${String(m).padStart(2,"0")}`;
}

function monthRange(startYM, endYM) {
  const result = [];
  let [y, m] = startYM.split("-").map(Number);
  const [ey, em] = endYM.split("-").map(Number);
  while (y < ey || (y === ey && m <= em)) {
    result.push(`${y}-${String(m).padStart(2,"0")}`);
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return result;
}

function holdingYM(h) {
  if (!h.acquisitionDate) return null;
  const d = new Date(h.acquisitionDate);
  if (isNaN(d)) return null;
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
}

// Nearest available price for a month — look back up to 3 months for gaps
function nearestPrice(map, ym) {
  if (map[ym] != null) return map[ym];
  let [y, m] = ym.split("-").map(Number);
  for (let i = 1; i <= 3; i++) {
    m--; if (m <= 0) { m = 12; y--; }
    const k = `${y}-${String(m).padStart(2,"0")}`;
    if (map[k] != null) return map[k];
  }
  return null;
}

function fmtL(n) {
  if (n == null || isNaN(n) || n === 0) return "₹0";
  if (n >= 1e7) return `₹${(n/1e7).toFixed(2)}Cr`;
  if (n >= 1e5) return `₹${(n/1e5).toFixed(1)}L`;
  return `₹${Math.round(n/1000)}K`;
}

function fmtMonthLabel(ym) {
  const [y, m] = ym.split("-").map(Number);
  return ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][m-1]
    + "'" + String(y).slice(2);
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PortfolioGrowthChart({ equityHoldings, liveData }) {
  const [portfolioHistories, setPortfolioHistories] = useState(null); // null = loading
  const [usdinrHistory,      setUsdinrHistory]      = useState({});
  const [bmHistories,        setBmHistories]        = useState({});
  const [fetchError,         setFetchError]         = useState(null);
  const [range,              setRange]              = useState("All");

  // Unique symbols needed from portfolio
  const symbols = useMemo(() => {
    const m = new Map();
    for (const h of equityHoldings) {
      if (h.type === "us_stock" && h.symbol && (h.quantity||0) > 0)
        m.set(h.symbol, "stock");
      else if (h.type === "in_stock" && h.symbol && (h.quantity||0) > 0)
        m.set(/\.(NS|BO)$/i.test(h.symbol) ? h.symbol : h.symbol + ".NS", "stock");
      else if (h.type === "mf" && h.schemeCode && (h.units||0) > 0)
        m.set(String(h.schemeCode), "mf");
    }
    return [...m.entries()].map(([sym, type]) => ({ sym, type }));
  }, [equityHoldings]);

  const symKey = symbols.map(s => s.sym).sort().join(",");

  useEffect(() => {
    if (symbols.length === 0) { setPortfolioHistories({}); return; }
    setPortfolioHistories(null);
    setFetchError(null);

    (async () => {
      try {
        const [portResults, usdResult, bmResults] = await Promise.all([
          Promise.allSettled(
            symbols.map(({ sym, type }) =>
              getMonthlyHistory(sym, type).then(h => [sym, h])
            )
          ),
          getMonthlyHistory("USDINR=X", "stock").catch(() => ({})),
          Promise.allSettled(
            BENCHMARKS.map(b =>
              getMonthlyHistory(b.symbol, b.type).then(h => [b.key, h])
            )
          ),
        ]);

        const ph = {};
        for (const r of portResults)
          if (r.status === "fulfilled") { const [s, h] = r.value; ph[s] = h; }

        const bh = {};
        for (const r of bmResults)
          if (r.status === "fulfilled") { const [k, h] = r.value; bh[k] = h; }

        setPortfolioHistories(ph);
        setUsdinrHistory(usdResult);
        setBmHistories(bh);
      } catch {
        setFetchError("Could not fetch price history. Check your connection.");
      }
    })();
  }, [symKey]);

  // ── Compute chart data ──────────────────────────────────────────────────────
  const chartData = useMemo(() => {
    if (portfolioHistories === null || equityHoldings.length === 0) return null;

    const fallbackUSDINR = liveData?.USDINR || 85;
    const endYM   = nowYM();

    // Earliest acquisition month across all equity holdings
    const acqMonths = equityHoldings.map(holdingYM).filter(Boolean).sort();
    if (acqMonths.length === 0) return [];
    const startYM = acqMonths[0];
    const months  = monthRange(startYM, endYM);

    // ── Portfolio value per month ────────────────────────────────────────────
    const portVal = {};
    for (const ym of months) {
      let val = 0;
      for (const h of equityHoldings) {
        const acqYM = holdingYM(h);
        if (!acqYM || acqYM > ym) continue; // not yet acquired

        const fx = nearestPrice(usdinrHistory, ym) || fallbackUSDINR;

        if (h.type === "us_stock") {
          const p = nearestPrice(portfolioHistories[h.symbol] || {}, ym);
          val += p != null ? h.quantity * p * fx : (h.costBasisINR || 0);
        } else if (h.type === "in_stock") {
          const sym = /\.(NS|BO)$/i.test(h.symbol) ? h.symbol : h.symbol + ".NS";
          const p   = nearestPrice(portfolioHistories[sym] || {}, ym);
          val += p != null ? h.quantity * p : (h.costBasisINR || 0);
        } else if (h.type === "mf" && (h.units||0) > 0) {
          const nav = nearestPrice(portfolioHistories[String(h.schemeCode)] || {}, ym);
          val += nav != null ? h.units * nav : (h.costBasisINR || 0);
        }
      }
      portVal[ym] = Math.round(val);
    }

    // ── Benchmark portfolios ─────────────────────────────────────────────────
    // Investment events: each holding is a lump-sum at acquisition date
    const investEvents = equityHoldings
      .filter(h => holdingYM(h) && (h.costBasisINR || 0) > 0)
      .map(h => ({ ym: holdingYM(h), amountINR: h.costBasisINR }));

    // Group events by month for fast lookup
    const eventsByMonth = {};
    for (const ev of investEvents)
      eventsByMonth[ev.ym] = (eventsByMonth[ev.ym] || 0) + ev.amountINR;

    const bmVal = {};
    for (const bm of BENCHMARKS) {
      const hist = bmHistories[bm.key] || {};
      if (Object.keys(hist).length === 0) continue;

      let cumUnits = 0;
      const valByMonth = {};

      for (const ym of months) {
        // Buy benchmark units from new investments this month
        const invested = eventsByMonth[ym] || 0;
        if (invested > 0) {
          const bmP = nearestPrice(hist, ym);
          if (bmP != null && bmP > 0) {
            if (bm.key === "sp500") {
              // S&P is USD → convert INR to USD first
              const fx = nearestPrice(usdinrHistory, ym) || fallbackUSDINR;
              cumUnits += (invested / fx) / bmP;
            } else {
              // Gold, Nifty: INR-denominated price
              cumUnits += invested / bmP;
            }
          }
        }

        // Value at this month's price
        if (cumUnits > 0) {
          const bmP = nearestPrice(hist, ym);
          if (bmP != null) {
            if (bm.key === "sp500") {
              const fx = nearestPrice(usdinrHistory, ym) || fallbackUSDINR;
              valByMonth[ym] = Math.round(cumUnits * bmP * fx);
            } else {
              valByMonth[ym] = Math.round(cumUnits * bmP);
            }
          }
        }
      }
      bmVal[bm.key] = valByMonth;
    }

    // ── Assemble ─────────────────────────────────────────────────────────────
    return months.map(ym => ({
      ym,
      label:     fmtMonthLabel(ym),
      portfolio: portVal[ym] || null,
      nifty:     bmVal.nifty?.[ym] ?? null,
      sp500:     bmVal.sp500?.[ym] ?? null,
      gold:      bmVal.gold?.[ym]  ?? null,
    }));
  }, [portfolioHistories, usdinrHistory, bmHistories, equityHoldings, liveData]);

  // ── Slice full history to the selected time range ───────────────────────────
  const visibleData = useMemo(() => {
    if (!chartData || chartData.length === 0) return chartData;
    const cfg = RANGES.find(r => r.label === range);
    if (!cfg || (!cfg.months && !cfg.ytd)) return chartData; // "All"
    const endYM = nowYM();
    const startYM = cfg.ytd
      ? `${new Date().getFullYear()}-01`
      : subtractMonths(endYM, cfg.months);
    const sliced = chartData.filter(d => d.ym >= startYM);
    return sliced.length >= 2 ? sliced : chartData; // fall back to All if too short
  }, [chartData, range]);

  // ── Render ──────────────────────────────────────────────────────────────────
  const card = {
    background:T.card, borderRadius:"14px",
    border:`1px solid ${T.border}`, padding:"18px 16px",
  };

  if (portfolioHistories === null) {
    return (
      <div style={{ ...card, textAlign:"center", padding:"36px 20px" }}>
        <div style={{ color:T.accent, fontSize:"13px", fontWeight:700 }}>
          Fetching price history…
        </div>
        <div style={{ color:T.textMuted, fontSize:"11px", marginTop:"6px" }}>
          Historical prices are cached after the first load
        </div>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div style={{ ...card, textAlign:"center", color:T.red, fontSize:"13px" }}>
        {fetchError}
      </div>
    );
  }

  if (!chartData || chartData.length < 2) {
    return (
      <div style={{ ...card, textAlign:"center", color:T.textMuted, fontSize:"13px" }}>
        Add equity holdings with acquisition dates to see portfolio growth.
      </div>
    );
  }

  // Summary stats — computed from visible window
  const portPoints  = visibleData.filter(d => d.portfolio != null);
  const firstVal    = portPoints[0]?.portfolio;
  const lastVal     = portPoints[portPoints.length - 1]?.portfolio;
  const totalRetPct = firstVal && lastVal
    ? ((lastVal / firstVal - 1) * 100).toFixed(1)
    : null;

  const tickEvery = Math.max(1, Math.floor(visibleData.length / 8));

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    const sorted = [...payload].filter(p => p.value != null).sort((a,b) => b.value - a.value);
    return (
      <div style={{ background:T.surface, border:`1px solid ${T.border}`,
        borderRadius:"10px", padding:"10px 14px", fontSize:"12px", minWidth:"170px" }}>
        <div style={{ fontWeight:700, color:T.text, marginBottom:"8px" }}>{label}</div>
        {sorted.map(p => (
          <div key={p.dataKey}
            style={{ display:"flex", justifyContent:"space-between", gap:"16px", marginBottom:"3px" }}>
            <span style={{ color:p.color }}>{p.name}</span>
            <span style={{ fontFamily:"monospace", fontWeight:700, color:T.text }}>
              {fmtL(p.value)}
            </span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div style={card}>
      {/* Header row */}
      <div style={{ display:"flex", justifyContent:"space-between",
        alignItems:"flex-start", marginBottom:"16px", flexWrap:"wrap", gap:"8px" }}>
        <div>
          <div style={{ fontSize:"10px", color:T.textMuted, fontWeight:700,
            letterSpacing:"0.6px", textTransform:"uppercase", marginBottom:"4px" }}>
            Portfolio Growth vs Benchmarks
          </div>
          <div style={{ fontSize:"11px", color:T.textMuted }}>
            If same ₹ invested on same dates in Gold / Nifty / S&amp;P 500
          </div>
        </div>
        {totalRetPct !== null && (
          <div style={{ textAlign:"right", flexShrink:0 }}>
            <div style={{ fontSize:"10px", color:T.textMuted, marginBottom:"2px" }}>
              Portfolio return
            </div>
            <div style={{ fontFamily:"monospace", fontSize:"18px", fontWeight:800,
              color: Number(totalRetPct) >= 0 ? T.accent : T.red }}>
              {Number(totalRetPct) >= 0 ? "+" : ""}{totalRetPct}%
            </div>
            <div style={{ fontSize:"10px", color:T.textMuted }}>
              {fmtMonthLabel(portPoints[0].ym)} → now
            </div>
          </div>
        )}
      </div>

      {/* Time range selector */}
      <div style={{ display:"flex", gap:"4px", flexWrap:"wrap", marginBottom:"14px" }}>
        {RANGES.map(r => {
          const active = range === r.label;
          return (
            <button key={r.label} onClick={() => setRange(r.label)} style={{
              padding:"4px 10px", borderRadius:"6px", border:"none", cursor:"pointer",
              fontSize:"11px", fontWeight:700,
              background: active ? T.accent : T.surface,
              color:       active ? T.bg     : T.textMuted,
              transition:"background 0.15s",
            }}>{r.label}</button>
          );
        })}
      </div>

      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={visibleData} margin={{ top:4, right:6, left:0, bottom:0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false}/>
          <XAxis dataKey="label" tick={{ fill:T.textMuted, fontSize:10 }}
            axisLine={false} tickLine={false} interval={tickEvery - 1}/>
          <YAxis tickFormatter={fmtL} tick={{ fill:T.textMuted, fontSize:10 }}
            axisLine={false} tickLine={false} width={56}/>
          <Tooltip content={<CustomTooltip/>}/>
          <Legend wrapperStyle={{ fontSize:"11px", paddingTop:"10px" }}/>
          <Line type="monotone" dataKey="portfolio" name="My Portfolio"
            stroke={T.accent} strokeWidth={2.5} dot={false} connectNulls/>
          <Line type="monotone" dataKey="nifty" name="Nifty 50"
            stroke={T.blue} strokeWidth={1.5} dot={false} connectNulls strokeDasharray="5 3"/>
          <Line type="monotone" dataKey="sp500" name="S&P 500 (₹)"
            stroke={T.purple} strokeWidth={1.5} dot={false} connectNulls strokeDasharray="5 3"/>
          <Line type="monotone" dataKey="gold" name="Gold"
            stroke="#EAB308" strokeWidth={1.5} dot={false} connectNulls strokeDasharray="5 3"/>
        </LineChart>
      </ResponsiveContainer>

      <div style={{ fontSize:"10px", color:T.textMuted, marginTop:"10px", lineHeight:1.6 }}>
        Gold = GOLDBEES.NS · Nifty = ^NSEI · S&amp;P 500 via ^GSPC × USD/INR history
        · Prices cached locally after first fetch
      </div>
    </div>
  );
}
