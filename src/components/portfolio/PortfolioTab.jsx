import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
         Tooltip, ResponsiveContainer, Label } from "recharts";
import { T } from "../../lib/theme";
import { getDerivedHoldings } from "../../lib/derivedHoldings";
import { portfolioXIRR } from "../../lib/xirr";
import { fetchAllPricesWithChange, fetchAllPrices, getCurrentValueINR } from "../../lib/priceService";
import { fetchHistoricalUSDINR } from "../../lib/historicalFX";
import AddHoldingForm from "./AddHoldingForm";
import { genId } from "../../lib/formatters";
import HoldingCard from "./HoldingCard";
import CasImportModal from "./CasImportModal";
import TradebookImportModal from "./TradebookImportModal";
import RsuTab from "../rsu/RsuTab";
import PortfolioGrowthChart from "../charts/PortfolioGrowthChart";

// ── constants ─────────────────────────────────────────────────────────────────

const CATEGORY_MAP = {
  us_stock: "Equity",
  in_stock: "Equity",
  mf:       "Equity",
  fd:       "Debt",
  epf:      "Debt",
  ppf:      "Debt",
};
const CAT_COLORS  = { Equity: T.blue, Debt: T.amber, Gold: "#EAB308" };
const TYPE_LABELS = {
  us_stock: "US Stocks",
  in_stock: "Indian Stocks",
  mf:       "Mutual Funds / SIPs",
  fd:       "Fixed Deposits",
  epf:      "EPF",
  ppf:      "PPF",
};
const TYPE_COLORS = {
  us_stock: "#6366F1",
  in_stock: T.blue,
  mf:       "#A855F7",
  fd:       T.amber,
  epf:      "#F97316",
  ppf:      T.teal,
};
const PERSON_COLORS = { Selva: T.selva, Akshaya: T.akshaya, Joint: T.purple };

// ── helpers ───────────────────────────────────────────────────────────────────

function fmtL(n) {
  if (!n) return "₹0";
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)}Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(2)}L`;
  return `₹${Math.round(n / 1000)}K`;
}

function fmtXIRR(rate) {
  if (rate === null || rate === undefined || !isFinite(rate)) return null;
  return `${rate >= 0 ? "+" : ""}${(rate * 100).toFixed(1)}% p.a.`;
}

/**
 * Return current INR value of a holding.
 * Falls back to balance → costBasisINR → principal if no live price available.
 */
function getHoldingValue(h, priceMap, usdinr) {
  const live = getCurrentValueINR(h, priceMap, usdinr);
  if (live != null && live > 0) return live;
  return h.balance ?? h.costBasisINR ?? h.principal ?? 0;
}

// ── Chart tooltip components ──────────────────────────────────────────────────

function AllocTip({ active, payload, totalNW }) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:"10px",
      padding:"10px 14px", fontSize:"12px", minWidth:"150px" }}>
      <div style={{ color:d.payload.color, fontWeight:700, marginBottom:"6px" }}>{d.name}</div>
      <div style={{ display:"flex", justifyContent:"space-between", gap:"16px" }}>
        <span style={{ color:T.textMuted }}>Value</span>
        <span style={{ fontFamily:"monospace", fontWeight:700, color:T.text }}>{fmtL(d.value)}</span>
      </div>
      {totalNW > 0 && (
        <div style={{ display:"flex", justifyContent:"space-between", gap:"16px" }}>
          <span style={{ color:T.textMuted }}>Share</span>
          <span style={{ fontFamily:"monospace", color:T.textDim }}>{(d.value/totalNW*100).toFixed(1)}%</span>
        </div>
      )}
    </div>
  );
}

function TypeBarTip({ active, payload, label, typeData, totalNW }) {
  if (!active || !payload?.length) return null;
  const entry = typeData.find(d => d.name === label);
  if (!entry) return null;
  const gc = entry.gain >= 0 ? T.accent : T.red;
  return (
    <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:"10px",
      padding:"10px 14px", fontSize:"12px", minWidth:"170px" }}>
      <div style={{ color:entry.color, fontWeight:700, marginBottom:"6px" }}>{label}</div>
      <div style={{ display:"flex", justifyContent:"space-between", gap:"16px", marginBottom:"2px" }}>
        <span style={{ color:T.textMuted }}>Invested</span>
        <span style={{ fontFamily:"monospace", fontWeight:600, color:T.textDim }}>{fmtL(entry.cost)}</span>
      </div>
      <div style={{ display:"flex", justifyContent:"space-between", gap:"16px", marginBottom:"2px" }}>
        <span style={{ color:T.textMuted }}>Current</span>
        <span style={{ fontFamily:"monospace", fontWeight:700, color:T.text }}>{fmtL(entry.value)}</span>
      </div>
      <div style={{ display:"flex", justifyContent:"space-between", gap:"16px", marginBottom:"2px" }}>
        <span style={{ color:T.textMuted }}>Gain</span>
        <span style={{ fontFamily:"monospace", fontWeight:700, color:gc }}>
          {entry.gain>=0?"+":""}{fmtL(Math.abs(entry.gain))}
        </span>
      </div>
      <div style={{ display:"flex", justifyContent:"space-between", gap:"16px" }}>
        <span style={{ color:T.textMuted }}>Return</span>
        <span style={{ fontFamily:"monospace", fontWeight:700, color:gc }}>
          {entry.gainPct>=0?"+":""}{entry.gainPct.toFixed(1)}%
        </span>
      </div>
    </div>
  );
}

// ── Price fetch toast ─────────────────────────────────────────────────────────

function PriceFetchToast({ toast }) {
  // toast: null | { phase:"loading", fetched, total, label } | { phase:"done", count }
  const visible = toast !== null;

  const style = {
    position: "fixed", bottom: "24px", right: "24px", zIndex: 9999,
    background: toast?.phase === "done" ? "rgba(34,197,94,0.12)" : T.surface,
    border: `1px solid ${toast?.phase === "done" ? T.accent : T.border}`,
    borderRadius: "12px", padding: "12px 18px",
    display: "flex", alignItems: "center", gap: "12px",
    boxShadow: "0 8px 32px rgba(0,0,0,0.45)",
    minWidth: "220px", maxWidth: "300px",
    opacity: visible ? 1 : 0,
    transform: visible ? "translateY(0)" : "translateY(12px)",
    transition: "opacity 0.25s ease, transform 0.25s ease",
    pointerEvents: visible ? "auto" : "none",
  };

  if (!visible) return <div style={style}/>;

  if (toast.phase === "loading") {
    const pct = toast.total > 0 ? (toast.fetched / toast.total) * 100 : 0;
    return (
      <div style={style}>
        {/* Spinning ring */}
        <svg width="22" height="22" viewBox="0 0 22 22" style={{ flexShrink: 0 }}>
          <circle cx="11" cy="11" r="9" fill="none" stroke={T.border} strokeWidth="2.5"/>
          <circle cx="11" cy="11" r="9" fill="none" stroke={T.accent} strokeWidth="2.5"
            strokeDasharray={`${2 * Math.PI * 9}`}
            strokeDashoffset={`${2 * Math.PI * 9 * (1 - pct / 100)}`}
            strokeLinecap="round"
            transform="rotate(-90 11 11)"
            style={{ transition: "stroke-dashoffset 0.3s ease" }}/>
        </svg>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "12px", fontWeight: 700, color: T.text, marginBottom: "2px" }}>
            Fetching prices…
          </div>
          <div style={{ fontSize: "11px", color: T.textMuted, display: "flex", justifyContent: "space-between" }}>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "140px" }}>
              {toast.label || ""}
            </span>
            <span style={{ fontFamily: "'JetBrains Mono',monospace", flexShrink: 0, marginLeft: "8px" }}>
              {toast.fetched}/{toast.total}
            </span>
          </div>
          {/* thin progress bar */}
          <div style={{ height: "3px", background: T.border, borderRadius: "2px", marginTop: "6px", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${pct}%`, background: T.accent,
              borderRadius: "2px", transition: "width 0.3s ease" }}/>
          </div>
        </div>
      </div>
    );
  }

  // done
  return (
    <div style={style}>
      <span style={{ fontSize: "18px", lineHeight: 1 }}>✓</span>
      <div>
        <div style={{ fontSize: "12px", fontWeight: 700, color: T.accent }}>Prices updated</div>
        <div style={{ fontSize: "11px", color: T.textMuted, marginTop: "2px" }}>
          {toast.count} price{toast.count !== 1 ? "s" : ""} fetched
        </div>
      </div>
    </div>
  );
}

// ── Add Lot Inline (inside StockModal) ───────────────────────────────────────

const inpS = {
  padding:"7px 10px", background:"#1a2035", border:`1px solid ${T.border}`,
  borderRadius:"7px", color:T.text, fontSize:"12px", outline:"none",
  width:"100%", boxSizing:"border-box", fontFamily:"inherit",
};

function AddLotInline({ type, symbol, schemeCode, name, person, onAdd, onClose }) {
  const [qty,      setQty]      = useState(""); // shares (stocks) or units (MF)
  const [date,     setDate]     = useState("");
  const [price,    setPrice]    = useState(""); // USD for us_stock, ₹/unit for in_stock, NAV for mf
  const [usdInr,   setUsdInr]   = useState("");
  const [costINR,  setCostINR]  = useState("");
  const [fxFetch,  setFxFetch]  = useState(false);

  const isUS = type === "us_stock";
  const isMF = type === "mf";
  const isIN = type === "in_stock";

  const handleDate = async (d) => {
    setDate(d);
    if (!d || !isUS) return;
    setFxFetch(true);
    const rate = await fetchHistoricalUSDINR(d);
    if (rate) setUsdInr(rate.toFixed(2));
    setFxFetch(false);
  };

  // Auto-compute cost basis as you type
  const recompute = (newQty, newPrice, newUsdInr) => {
    const q = parseFloat(newQty  ?? qty);
    const p = parseFloat(newPrice ?? price);
    if (isUS) {
      const r = parseFloat(newUsdInr ?? usdInr);
      if (q > 0 && p > 0 && r > 0) setCostINR(Math.round(q * p * r).toString());
    } else if (isIN || isMF) {
      if (q > 0 && p > 0) setCostINR(Math.round(q * p).toString());
    }
  };

  const handleSubmit = () => {
    if (isMF && !qty) return;
    if (!isMF && !qty) return;

    const h = {
      id: genId(), type, person,
      addedAt: new Date().toISOString(),
      costBasisINR: Number(costINR) || 0,
    };

    if (date) h.acquisitionDate = date;

    if (isMF) {
      h.schemeCode = schemeCode;
      h.name       = name;
      h.units      = Number(qty);
      if (price) h.acquisitionPrice = Number(price); // NAV at purchase
    } else {
      h.symbol = symbol;
      h.name   = name || symbol;
      h.quantity = Number(qty);
      if (price) {
        h.acquisitionPrice    = Number(price);
        h.acquisitionCurrency = isUS ? "USD" : "INR";
      }
      if (isUS && usdInr) h.acquisitionUSDINR = Number(usdInr);
    }

    onAdd(h);
    onClose();
  };

  const lbl = (t) => (
    <div style={{ fontSize:"10px", color:T.textMuted, fontWeight:700, marginBottom:"3px" }}>{t}</div>
  );

  // Grid columns: US=4, IN=3, MF=3
  const cols = isUS ? "1fr 1fr 1fr 1fr" : "1fr 1fr 1fr";
  const pricePlaceholder = isUS ? "420" : isMF ? "NAV e.g. 58.23" : "₹ per share";
  const priceLabel = isUS ? "PRICE (USD)" : isMF ? "NAV AT PURCHASE (₹)" : "PRICE PER SHARE (₹)";
  const qtyLabel = isMF ? "UNITS" : "QUANTITY (SHARES)";

  return (
    <div style={{ background:"#1a2035", borderRadius:"10px", border:`1px solid ${T.accent}44`, padding:"14px 16px", margin:"0 4px 4px" }}>
      <div style={{ fontSize:"12px", fontWeight:700, color:T.accent, marginBottom:"10px" }}>
        + Add New Lot — {isMF ? name : symbol}
      </div>
      <div style={{ display:"grid", gridTemplateColumns:cols, gap:"8px", marginBottom:"10px" }}>
        <div>
          {lbl(qtyLabel)}
          <input type="number" style={inpS} placeholder={isMF ? "1234.567" : "10"} value={qty}
            onChange={e => { setQty(e.target.value); recompute(e.target.value, null, null); }}/>
        </div>
        <div>
          {lbl("PURCHASE DATE")}
          <input type="date" style={inpS} value={date} onChange={e => handleDate(e.target.value)}/>
        </div>
        <div>
          {lbl(priceLabel)}
          <input type="number" style={inpS} placeholder={pricePlaceholder} value={price}
            onChange={e => { setPrice(e.target.value); recompute(null, e.target.value, null); }}/>
        </div>
        {isUS && (
          <div style={{ position:"relative" }}>
            {lbl("USD/INR")}
            <input type="number" style={inpS} placeholder="84.5" value={usdInr}
              onChange={e => { setUsdInr(e.target.value); recompute(null, null, e.target.value); }}/>
            {fxFetch && <span style={{ position:"absolute", right:"8px", top:"26px", fontSize:"9px", color:T.textMuted }}>…</span>}
          </div>
        )}
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr auto auto", gap:"8px", alignItems:"flex-end" }}>
        <div>
          {lbl("TOTAL INVESTED (₹)")}
          <input type="number" style={inpS} placeholder="350000" value={costINR}
            onChange={e => setCostINR(e.target.value)}/>
        </div>
        <button onClick={handleSubmit}
          style={{ padding:"7px 16px", background:T.accent, border:"none", borderRadius:"7px",
            color:T.bg, fontSize:"12px", fontWeight:700, cursor:"pointer", whiteSpace:"nowrap" }}>
          Add Lot
        </button>
        <button onClick={onClose}
          style={{ padding:"7px 10px", background:"transparent", border:`1px solid ${T.border}`,
            borderRadius:"7px", color:T.textDim, fontSize:"12px", cursor:"pointer" }}>
          ✕
        </button>
      </div>
    </div>
  );
}

// ── Overview ──────────────────────────────────────────────────────────────────

function OverviewView({ enriched, totalNW }) {
  // ── data derivations ────────────────────────────────────────────────────────
  const catData = useMemo(() => {
    const cats = {};
    for (const h of enriched) {
      const cat = h.category;
      if (!cats[cat]) cats[cat] = { value:0, cost:0, holdings:[] };
      cats[cat].value    += h.currentValue || 0;
      cats[cat].cost     += h.costBasisINR || h.principal || h.balance || 0;
      cats[cat].holdings.push(h);
    }
    for (const cat of Object.keys(cats)) cats[cat].xirr = portfolioXIRR(cats[cat].holdings);
    return cats;
  }, [enriched]);

  const typeData = useMemo(() => {
    const types = {};
    for (const h of enriched) {
      const t = h.type;
      if (!types[t]) types[t] = { value:0, cost:0 };
      types[t].value += h.currentValue || 0;
      types[t].cost  += h.costBasisINR || h.principal || h.balance || 0;
    }
    return Object.entries(types)
      .filter(([, d]) => d.value > 0)
      .map(([type, d]) => ({
        type,
        name:    TYPE_LABELS[type] || type,
        value:   d.value,
        cost:    d.cost,
        gain:    d.value - d.cost,
        gainPct: d.cost > 0 ? (d.value - d.cost) / d.cost * 100 : 0,
        color:   TYPE_COLORS[type] || T.textDim,
        pct:     totalNW > 0 ? d.value / totalNW * 100 : 0,
      }))
      .sort((a, b) => b.value - a.value);
  }, [enriched, totalNW]);

  const personData = useMemo(() => {
    const p = {};
    for (const h of enriched) {
      const name = h.person || "Joint";
      p[name] = (p[name] || 0) + (h.currentValue || 0);
    }
    return p;
  }, [enriched]);

  const portfolioRate = useMemo(() => portfolioXIRR(enriched), [enriched]);

  const { totalCost, totalGain, gainPct } = useMemo(() => {
    const cost = enriched.reduce((s, h) => s + (h.costBasisINR || h.principal || h.balance || 0), 0);
    const gain = totalNW - cost;
    return { totalCost: cost, totalGain: gain, gainPct: cost > 0 ? gain / cost * 100 : null };
  }, [enriched, totalNW]);

  // ── chart datasets ──────────────────────────────────────────────────────────
  const catDonut = ["Equity","Debt","Gold"]
    .map(cat => ({ name:cat, value:catData[cat]?.value||0, color:CAT_COLORS[cat] }))
    .filter(d => d.value > 0);

  const personDonut = Object.entries(personData)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name, value, color: PERSON_COLORS[name] || T.purple }));

  // ── sub-components ──────────────────────────────────────────────────────────
  const MetricCard = ({ title, value, sub, col, badge }) => (
    <div style={{ background:T.card, borderRadius:"14px", border:`1px solid ${T.border}`, padding:"18px 20px" }}>
      <div style={{ fontSize:"10px", color:T.textMuted, fontWeight:700, letterSpacing:"0.6px",
        textTransform:"uppercase", marginBottom:"8px" }}>{title}</div>
      <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"22px", fontWeight:800,
        color:col||T.accent, lineHeight:1.15 }}>{value}</div>
      {badge && (
        <span style={{ display:"inline-block", marginTop:"5px", padding:"2px 8px", borderRadius:"6px",
          background:`${col||T.accent}22`, color:col||T.accent, fontSize:"11px", fontWeight:700 }}>
          {badge}
        </span>
      )}
      {sub && <div style={{ fontSize:"11px", color:T.textMuted, marginTop:"5px" }}>{sub}</div>}
    </div>
  );

  const SectionCard = ({ title, children, style }) => (
    <div style={{ background:T.card, borderRadius:"14px", border:`1px solid ${T.border}`,
      padding:"18px 20px", ...style }}>
      <div style={{ fontSize:"10px", color:T.textMuted, fontWeight:700, letterSpacing:"0.6px",
        textTransform:"uppercase", marginBottom:"16px" }}>{title}</div>
      {children}
    </div>
  );

  const barHeight = Math.max(160, typeData.length * 42);

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"16px" }}>

      {/* ── 1. KPI hero strip ──────────────────────────────────────────────── */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))", gap:"10px" }}>
        <MetricCard title="Net Worth" value={fmtL(totalNW)}
          sub={`${enriched.length} holding${enriched.length!==1?"s":""}`}/>
        {portfolioRate !== null && (
          <MetricCard title="Portfolio XIRR" value={fmtXIRR(portfolioRate)}
            sub="annualised return" col={portfolioRate>=0?T.accent:T.red}/>
        )}
        {gainPct !== null && (
          <MetricCard title="Total Return"
            value={`${totalGain>=0?"+":""}${fmtL(Math.abs(totalGain))}`}
            sub={`invested ${fmtL(totalCost)}`}
            col={totalGain>=0?T.accent:T.red}
            badge={`${gainPct>=0?"+":""}${gainPct.toFixed(1)}%`}/>
        )}
        {Object.entries(personData).filter(([, v]) => v > 0).map(([person, val]) => (
          <MetricCard key={person} title={person} value={fmtL(val)}
            sub={`${totalNW>0?(val/totalNW*100).toFixed(1):0}% of portfolio`}
            col={PERSON_COLORS[person]||T.purple}/>
        ))}
      </div>

      {/* ── 2. Asset allocation donut + type breakdown bar ─────────────────── */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))", gap:"16px" }}>

        {/* Donut: Equity / Debt / Gold */}
        <SectionCard title="Asset Allocation">
          <ResponsiveContainer width="100%" height={190}>
            <PieChart>
              <Pie data={catDonut} cx="50%" cy="50%" innerRadius={62} outerRadius={88}
                paddingAngle={3} dataKey="value" strokeWidth={0}>
                {catDonut.map((e, i) => <Cell key={i} fill={e.color}/>)}
                <Label content={({ viewBox }) => {
                  const { cx, cy } = viewBox;
                  return (
                    <g>
                      <text x={cx} y={cy-10} textAnchor="middle" fill={T.textMuted}
                        fontSize="9" fontWeight="600" letterSpacing="1">NET WORTH</text>
                      <text x={cx} y={cy+12} textAnchor="middle" fill={T.text}
                        fontSize="16" fontWeight="800" fontFamily="monospace">{fmtL(totalNW)}</text>
                    </g>
                  );
                }} position="center"/>
              </Pie>
              <Tooltip content={(props) => <AllocTip {...props} totalNW={totalNW}/>}/>
            </PieChart>
          </ResponsiveContainer>
          {/* Legend */}
          <div style={{ display:"flex", gap:"8px", flexWrap:"wrap", justifyContent:"center", marginTop:"4px" }}>
            {catDonut.map(d => {
              const gain    = (catData[d.name]?.value||0) - (catData[d.name]?.cost||0);
              const gainPct = catData[d.name]?.cost > 0 ? gain/catData[d.name].cost*100 : 0;
              const gc      = gain >= 0 ? T.accent : T.red;
              return (
                <div key={d.name} style={{ display:"flex", alignItems:"center", gap:"8px",
                  background:T.surface, borderRadius:"8px", padding:"6px 10px" }}>
                  <div style={{ width:"9px", height:"9px", borderRadius:"3px",
                    background:d.color, flexShrink:0 }}/>
                  <div>
                    <div style={{ fontSize:"12px", fontWeight:700, color:T.text }}>{d.name}</div>
                    <div style={{ fontSize:"10px", color:T.textMuted }}>
                      {totalNW>0?(d.value/totalNW*100).toFixed(1):0}%
                      <span style={{ color:gc, marginLeft:"6px", fontWeight:600 }}>
                        {gain>=0?"+":""}{gainPct.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <div style={{ fontFamily:"monospace", fontSize:"12px", fontWeight:700,
                    color:T.text, marginLeft:"4px" }}>{fmtL(d.value)}</div>
                </div>
              );
            })}
          </div>
        </SectionCard>

        {/* Horizontal bars: by asset type */}
        <SectionCard title="Portfolio by Asset Type">
          <ResponsiveContainer width="100%" height={barHeight}>
            <BarChart data={typeData} layout="vertical"
              margin={{ top:0, right:60, left:0, bottom:0 }}>
              <XAxis type="number" hide/>
              <YAxis type="category" dataKey="name" width={90}
                tick={{ fill:T.textDim, fontSize:11 }} axisLine={false} tickLine={false}/>
              <Bar dataKey="value" name="Current Value" radius={[0,4,4,0]} maxBarSize={16}
                label={{ position:"right", formatter:v=>fmtL(v),
                  fill:T.textDim, fontSize:11, fontFamily:"monospace" }}>
                {typeData.map((e, i) => <Cell key={i} fill={e.color}/>)}
              </Bar>
              <Tooltip content={(props) =>
                <TypeBarTip {...props} typeData={typeData} totalNW={totalNW}/>}/>
            </BarChart>
          </ResponsiveContainer>
          {/* Gain row per type */}
          <div style={{ display:"flex", flexDirection:"column", gap:"3px", marginTop:"6px",
            borderTop:`1px solid ${T.border}`, paddingTop:"10px" }}>
            {typeData.map(d => {
              const gc = d.gain>=0?T.accent:T.red;
              return (
                <div key={d.name} style={{ display:"flex", justifyContent:"space-between",
                  alignItems:"center", fontSize:"10px" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:"6px" }}>
                    <div style={{ width:"7px", height:"7px", borderRadius:"2px", background:d.color }}/>
                    <span style={{ color:T.textMuted }}>{d.name}</span>
                  </div>
                  <div style={{ display:"flex", gap:"10px", alignItems:"center" }}>
                    <span style={{ color:gc, fontWeight:700 }}>
                      {d.gain>=0?"+":""}{d.gainPct.toFixed(1)}%
                    </span>
                    <span style={{ color:T.textMuted }}>{d.pct.toFixed(1)}% of NW</span>
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>
      </div>

      {/* ── 3. Category performance ──────────────────────────────────────── */}
      <div>

        {/* Category performance cards */}
        <SectionCard title="Category Performance">
          <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
            {["Equity","Debt","Gold"].map(cat => {
              const d = catData[cat];
              if (!d || d.value <= 0) return null;
              const gain    = d.value - d.cost;
              const gPct    = d.cost > 0 ? gain/d.cost*100 : 0;
              const col     = CAT_COLORS[cat];
              const gc      = gain>=0?T.accent:T.red;
              const allocPct = totalNW>0 ? d.value/totalNW*100 : 0;
              return (
                <div key={cat} style={{ borderRadius:"10px", border:`1px solid ${col}33`,
                  background:T.surface, overflow:"hidden" }}>
                  {/* Top strip with category color */}
                  <div style={{ height:"3px", background:col }}/>
                  <div style={{ padding:"10px 14px" }}>
                    <div style={{ display:"flex", justifyContent:"space-between",
                      alignItems:"center", marginBottom:"6px" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:"7px" }}>
                        <span style={{ fontSize:"13px", fontWeight:800, color:col }}>{cat}</span>
                        {d.xirr !== null && (
                          <span style={{ fontSize:"10px", fontWeight:700, padding:"1px 6px",
                            borderRadius:"4px", color:d.xirr>=0?T.accent:T.red,
                            background:`${d.xirr>=0?T.accent:T.red}18` }}>
                            XIRR {fmtXIRR(d.xirr)}
                          </span>
                        )}
                      </div>
                      <span style={{ fontFamily:"monospace", fontSize:"15px", fontWeight:800,
                        color:T.text }}>{fmtL(d.value)}</span>
                    </div>

                    <div style={{ display:"flex", justifyContent:"space-between",
                      alignItems:"center", marginBottom:"8px" }}>
                      <span style={{ fontSize:"10px", color:T.textMuted }}>
                        Invested <span style={{ color:T.textDim, fontFamily:"monospace" }}>{fmtL(d.cost)}</span>
                      </span>
                      <span style={{ fontSize:"11px", fontWeight:700, color:gc }}>
                        {gain>=0?"+":""}{fmtL(Math.abs(gain))}
                        <span style={{ fontSize:"10px", marginLeft:"5px", opacity:0.8 }}>
                          ({gPct>=0?"+":""}{gPct.toFixed(1)}%)
                        </span>
                      </span>
                    </div>

                    {/* Allocation bar */}
                    <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                      <div style={{ flex:1, height:"3px", borderRadius:"2px",
                        background:T.border, overflow:"hidden" }}>
                        <div style={{ width:`${allocPct}%`, height:"100%", borderRadius:"2px",
                          background:col, transition:"width 0.6s ease" }}/>
                      </div>
                      <span style={{ fontSize:"10px", color:T.textMuted, flexShrink:0, fontFamily:"monospace" }}>
                        {allocPct.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>
      </div>

    </div>
  );
}

// ── Holdings ──────────────────────────────────────────────────────────────────

const fmtINR = n => n == null ? "—" : `₹${Math.abs(Math.round(n)).toLocaleString("en-IN")}`;

function StockModal({ modal, priceMap, usdinr, onDelete, onUpdateBalance, onDeleteDerived, onAdd, onClose }) {
  const [showAddLot, setShowAddLot] = useState(false);
  if (!modal) return null;
  const { label, holdings } = modal;
  // Infer type/person/symbol from first non-derived holding (or any holding)
  const ref = holdings.find(h => !h.derived) || holdings[0];
  const canAddLot = ref && (ref.type === "us_stock" || ref.type === "in_stock" || ref.type === "mf");

  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", zIndex:1000,
      display:"flex", alignItems:"center", justifyContent:"center", padding:"20px" }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:T.surface, borderRadius:"16px",
        border:`1px solid ${T.border}`, width:"100%", maxWidth:"720px", maxHeight:"85vh",
        overflow:"hidden", display:"flex", flexDirection:"column" }}>
        <div style={{ padding:"16px 20px", borderBottom:`1px solid ${T.border}`,
          display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <span style={{ fontSize:"15px", fontWeight:700, color:T.text }}>{label}</span>
          <div style={{ display:"flex", gap:"8px", alignItems:"center" }}>
            {canAddLot && (
              <button onClick={() => setShowAddLot(v => !v)}
                style={{ padding:"5px 12px", background: showAddLot ? T.accentBg : T.card,
                  border:`1px solid ${showAddLot ? T.accent : T.border}`,
                  borderRadius:"7px", color: showAddLot ? T.accent : T.textDim,
                  fontSize:"12px", fontWeight:600, cursor:"pointer" }}>
                {showAddLot ? "✕ Cancel" : "+ Add Lot"}
              </button>
            )}
            <button onClick={onClose} style={{ background:"none", border:"none", color:T.textMuted,
              fontSize:"22px", cursor:"pointer", lineHeight:1, padding:"0 4px" }}>×</button>
          </div>
        </div>
        <div style={{ overflowY:"auto", padding:"14px", display:"flex", flexDirection:"column", gap:"10px" }}>
          {showAddLot && (
            <AddLotInline
              type={ref.type} symbol={ref.symbol}
              schemeCode={ref.schemeCode} name={ref.name}
              person={ref.person}
              onAdd={onAdd}
              onClose={() => setShowAddLot(false)}/>
          )}
          {holdings.map(h => (
            <HoldingCard key={h.id} holding={h} priceMap={priceMap} usdinr={usdinr}
              onDelete={onDelete} onUpdateBalance={onUpdateBalance}
              onDeleteDerived={onDeleteDerived}/>
          ))}
        </div>
      </div>
    </div>
  );
}

function HoldingsView({ grouped, priceMap, usdinr, sortBy = "value", changeMap = {}, onDelete, onUpdateBalance, onUpdateFundCategory, onUpdateHoldingGoal, goals = [], onDeleteDerived, onAdd }) {
  const [expanded,  setExpanded]  = useState({});
  const [modalSym,  setModalSym]  = useState(null); // track by symbol key, not snapshot
  const toggle = key => setExpanded(e => ({ ...e, [key]: !e[key] }));

  // Derive live holdings for the open modal from current grouped data
  const allHoldings = Object.values(grouped).flatMap(typeMap => Object.values(typeMap).flat());
  const modalHoldings = modalSym
    ? allHoldings.filter(h => (h.symbol || h.name || h.id) === modalSym)
    : [];
  // Auto-close modal when all lots removed
  useEffect(() => { if (modalSym && modalHoldings.length === 0) setModalSym(null); }, [modalHoldings.length]);

  const modal = modalSym ? { label: `${modalSym} · ${modalHoldings.length} lot${modalHoldings.length !== 1 ? "s" : ""}`, holdings: modalHoldings } : null;

  const handleDelete = (id) => {
    onDelete(id);
  };

  const handleDeleteDerived = (h) => {
    onDeleteDerived(h);
  };

  return (
    <>
      <StockModal modal={modal} priceMap={priceMap} usdinr={usdinr}
        onDelete={handleDelete} onUpdateBalance={onUpdateBalance}
        onDeleteDerived={handleDeleteDerived} onAdd={onAdd} onClose={()=>setModalSym(null)}/>

      <div style={{ display:"flex", flexDirection:"column", gap:"12px" }}>
        {["Equity","Debt","Gold"].map(cat => {
          const typeMap = grouped[cat];
          if (!typeMap) return null;
          const catHoldings = Object.values(typeMap).flat();
          const catValue    = catHoldings.reduce((s, h) => s + (h.currentValue || 0), 0);
          const catCost     = catHoldings.reduce((s, h) => s + (h.costBasisINR || h.principal || h.balance || 0), 0);
          const catGain     = catValue - catCost;
          const catGainPct  = catCost > 0 ? catGain / catCost * 100 : null;
          const catXirr     = portfolioXIRR(catHoldings);
          const catGc       = catGain >= 0 ? T.accent : T.red;
          const catCol      = CAT_COLORS[cat] || T.text;
          const catKey      = `cat-${cat}`;
          const catOpen     = expanded[catKey] !== false;

          return (
            <div key={cat} style={{ background:T.surface, borderRadius:"12px",
              border:`1px solid ${T.border}`, overflow:"hidden" }}>

              {/* Category header — rich roll-up */}
              <div onClick={() => toggle(catKey)}
                style={{ padding:"16px 18px", cursor:"pointer", userSelect:"none",
                  borderBottom: catOpen ? `1px solid ${T.border}` : "none" }}>

                {/* Top row: label + current value + chevron */}
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"10px" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
                    <span style={{ fontSize:"14px", fontWeight:800, color:catCol }}>{cat}</span>
                    <span style={{ fontSize:"11px", color:T.textMuted }}>
                      {catHoldings.length} holding{catHoldings.length!==1?"s":""}
                    </span>
                    {catXirr !== null && (
                      <span style={{ fontSize:"10px", fontWeight:700, padding:"2px 7px", borderRadius:"5px",
                        color:catXirr>=0?T.accent:T.red, background:`${catXirr>=0?T.accent:T.red}18` }}>
                        XIRR {fmtXIRR(catXirr)}
                      </span>
                    )}
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:"14px" }}>
                    <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"18px",
                      fontWeight:800, color:T.text }}>{fmtL(catValue)}</span>
                    <span style={{ color:T.textMuted, fontSize:"13px" }}>{catOpen?"▲":"▼"}</span>
                  </div>
                </div>

                {/* Stats row: invested · gain · gain% */}
                <div style={{ display:"flex", gap:"24px", flexWrap:"wrap", alignItems:"center" }}>
                  <div>
                    <div style={{ fontSize:"10px", color:T.textMuted, marginBottom:"2px" }}>Invested</div>
                    <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"12px",
                      fontWeight:600, color:T.textDim }}>{fmtL(catCost)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize:"10px", color:T.textMuted, marginBottom:"2px" }}>Abs. Gain</div>
                    <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"12px",
                      fontWeight:700, color:catGc }}>
                      {catGain>=0?"+":""}{fmtL(Math.abs(catGain))}
                      {catGainPct!==null && (
                        <span style={{ fontSize:"11px", marginLeft:"5px", opacity:0.85 }}>
                          ({catGainPct>=0?"+":""}{catGainPct.toFixed(1)}%)
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {catOpen && Object.entries(typeMap).map(([type, holdings]) => {
                const typeKey  = `type-${cat}-${type}`;
                const typeOpen = expanded[typeKey] === true;
                const typeVal  = holdings.reduce((s, h) => s + (h.currentValue || 0), 0);
                const typeCost = holdings.reduce((s, h) => s + (h.costBasisINR || h.principal || h.balance || 0), 0);
                const typeGain = typeVal - typeCost;
                const typeGainPct = typeCost > 0 ? typeGain / typeCost * 100 : null;
                const typeXirr = portfolioXIRR(holdings);
                const typeGc   = typeGain >= 0 ? T.accent : T.red;

                // Group by stock symbol / name
                const byStock = {};
                for (const h of holdings) {
                  const k = h.symbol || h.name || h.id;
                  if (!byStock[k]) byStock[k] = [];
                  byStock[k].push(h);
                }

                // Sort stock groups by selected sort key
                const sortedByStock = Object.entries(byStock).sort(([, aLots], [, bLots]) => {
                  const aVal  = aLots.reduce((s,h)=>s+(h.currentValue||0), 0);
                  const bVal  = bLots.reduce((s,h)=>s+(h.currentValue||0), 0);
                  if (sortBy === "gain_pct") {
                    const aCost = aLots.reduce((s,h)=>s+(h.costBasisINR||h.principal||h.balance||0), 0);
                    const bCost = bLots.reduce((s,h)=>s+(h.costBasisINR||h.principal||h.balance||0), 0);
                    const aGp = aCost > 0 ? (aVal - aCost) / aCost * 100 : 0;
                    const bGp = bCost > 0 ? (bVal - bCost) / bCost * 100 : 0;
                    return bGp - aGp;
                  }
                  if (sortBy === "day_change") {
                    const getSym = (lots) => {
                      const h = lots[0];
                      if (!h) return null;
                      if (h.type === "us_stock") return h.symbol;
                      if (h.type === "in_stock") return h.symbol && !/\.(NS|BO)$/i.test(h.symbol) ? h.symbol + ".NS" : h.symbol;
                      if (h.type === "mf")       return h.schemeCode;
                      return null;
                    };
                    const aPct = changeMap[getSym(aLots)] ?? 0;
                    const bPct = changeMap[getSym(bLots)] ?? 0;
                    return bPct - aPct;
                  }
                  // default: by value descending
                  return bVal - aVal;
                });

                return (
                  <div key={type}>
                    <div onClick={() => toggle(typeKey)}
                      style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
                        padding:"9px 18px 9px 28px", cursor:"pointer", userSelect:"none",
                        background:T.card, borderBottom:`1px solid ${T.border}33`, flexWrap:"wrap", gap:"6px" }}>
                      <span style={{ fontSize:"12px", fontWeight:600, color:T.textDim }}>
                        {TYPE_LABELS[type] || type}
                      </span>
                      <div style={{ display:"flex", alignItems:"center", gap:"12px", marginLeft:"auto" }}>
                        {typeCost > 0 && (
                          <span style={{ fontSize:"10px", color:T.textMuted }}>
                            {fmtL(typeCost)} invested
                          </span>
                        )}
                        {typeGainPct !== null && (
                          <span style={{ fontSize:"10px", fontWeight:700, color:typeGc }}>
                            {typeGain>=0?"+":""}{typeGainPct.toFixed(1)}%
                          </span>
                        )}
                        {typeXirr !== null && (
                          <span style={{ fontSize:"10px", fontWeight:700, color:typeXirr>=0?T.accent:T.red,
                            padding:"1px 6px", borderRadius:"4px", background:`${typeXirr>=0?T.accent:T.red}15` }}>
                            XIRR {fmtXIRR(typeXirr)}
                          </span>
                        )}
                        <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"12px",
                          fontWeight:700, color:T.text }}>{fmtL(typeVal)}</span>
                        <span style={{ color:T.textMuted, fontSize:"12px" }}>{typeOpen?"▲":"▼"}</span>
                      </div>
                    </div>

                    {typeOpen && (
                      <div style={{ display:"flex", flexDirection:"column", gap:"8px", padding:"10px 14px" }}>
                        {sortedByStock.map(([sym, lots]) => {
                          const totalQty  = lots.reduce((s,h)=>s+(Number(h.quantity)||0), 0);
                          const totalCost = lots.reduce((s,h)=>s+(h.costBasisINR||h.principal||h.balance||0), 0);
                          const totalVal  = lots.reduce((s,h)=>s+(h.currentValue||0), 0);
                          const gain      = totalVal - totalCost;
                          const gainPct   = totalCost > 0 ? gain/totalCost*100 : null;
                          const xirr      = portfolioXIRR(lots);
                          const gc        = gain >= 0 ? T.accent : T.red;
                          return (
                            <div key={sym}
                              onClick={()=>setModalSym(sym)}
                              onMouseEnter={e=>e.currentTarget.style.borderColor=T.accent+"88"}
                              onMouseLeave={e=>e.currentTarget.style.borderColor=T.border}
                              style={{ padding:"14px 16px", background:T.bg, borderRadius:"10px",
                                border:`1px solid ${T.border}`, cursor:"pointer", transition:"border-color 0.15s" }}>
                              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                                <div>
                                  <div style={{ fontSize:"15px", fontWeight:700, color:T.text }}>{sym}</div>
                                  {totalQty>0 && <div style={{ fontSize:"11px", color:T.textMuted, marginTop:"2px" }}>
                                    {totalQty % 1===0 ? totalQty : totalQty.toFixed(4).replace(/0+$/,"")} shares · {lots.length} lot{lots.length!==1?"s":""}
                                  </div>}
                                </div>
                                <div style={{ textAlign:"right" }}>
                                  <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"17px", fontWeight:800, color:T.text }}>{fmtL(totalVal)}</div>
                                  <div style={{ fontSize:"12px", color:gc, fontWeight:600, marginTop:"2px" }}>
                                    {gain>=0?"+":"-"}{fmtINR(gain)}{gainPct!==null?` (${gainPct>=0?"+":""}${gainPct.toFixed(1)}%)`:""}
                                  </div>
                                </div>
                              </div>
                              <div style={{ display:"flex", gap:"20px", marginTop:"10px", flexWrap:"wrap", alignItems:"flex-end" }}>
                                <div>
                                  <div style={{ fontSize:"10px", color:T.textMuted, marginBottom:"2px" }}>Invested</div>
                                  <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"12px", color:T.textDim, fontWeight:600 }}>{fmtL(totalCost)}</div>
                                </div>
                                <div>
                                  <div style={{ fontSize:"10px", color:T.textMuted, marginBottom:"2px" }}>Abs. Gain/Loss</div>
                                  <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"12px", color:gc, fontWeight:600 }}>{gain>=0?"+":"-"}{fmtL(Math.abs(gain))}</div>
                                </div>
                                {xirr!==null && (
                                  <div>
                                    <div style={{ fontSize:"10px", color:T.textMuted, marginBottom:"2px" }}>XIRR</div>
                                    <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"12px", color:xirr>=0?T.accent:T.red, fontWeight:700 }}>{fmtXIRR(xirr)}</div>
                                  </div>
                                )}
                                {/* MF-only: fund-level category override */}
                                {type === "mf" && !lots.every(l => l.derived) && onUpdateFundCategory && (
                                  <div onClick={e => e.stopPropagation()}
                                    style={{ display:"flex", gap:"4px", alignItems:"center", marginLeft:"4px" }}>
                                    {["Equity","Debt","Gold"].map(cat => {
                                      const current = lots[0]?.categoryOverride || "Equity";
                                      const active = current === cat;
                                      return (
                                        <button key={cat}
                                          onClick={() => onUpdateFundCategory(lots[0]?.schemeCode, lots[0]?.person, active ? "" : cat)}
                                          style={{ padding:"2px 8px", borderRadius:"5px", border:"none", cursor:"pointer",
                                            fontSize:"10px", fontWeight:700,
                                            background: active ? T.amber : T.card,
                                            color:      active ? T.bg    : T.textMuted }}>
                                          {cat}
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}
                                {/* Goal earmarking — all holding types */}
                                {goals.length > 0 && !lots.every(l => l.derived) && onUpdateHoldingGoal && (
                                  <div onClick={e => e.stopPropagation()}
                                    style={{ display:"flex", gap:"4px", alignItems:"center", flexWrap:"wrap" }}>
                                    <span style={{ fontSize:"9px", color:T.textMuted, fontWeight:700, letterSpacing:"0.3px" }}>GOAL</span>
                                    {goals.filter(g => g.termType === "long").map(g => {
                                      const currentTag = lots[0]?.goalTag;
                                      const active = currentTag === g.id;
                                      return (
                                        <button key={g.id}
                                          onClick={() => onUpdateHoldingGoal(sym, lots[0]?.person, active ? null : g.id)}
                                          title={active ? `Remove from ${g.name}` : `Tag to ${g.name}`}
                                          style={{ padding:"2px 7px", borderRadius:"5px", border:`1px solid ${active ? T.cta : T.border}`,
                                            cursor:"pointer", fontSize:"10px", fontWeight:700,
                                            background: active ? T.ctaDim : "transparent",
                                            color:      active ? T.cta    : T.textMuted }}>
                                          {active ? "✓ " : ""}{g.name}
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}
                                <div style={{ marginLeft:"auto", fontSize:"10px", color:T.textMuted, alignSelf:"flex-end" }}>
                                  tap for lots →
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}

        {Object.keys(grouped).length === 0 && (
          <div style={{ textAlign:"center", padding:"60px 20px", color:T.textMuted, fontSize:"14px" }}>
            No holdings yet. Add one with the "+ Add Holding" button above.
          </div>
        )}
      </div>
    </>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PortfolioTab({
  holdingsData, rsuData, incomeData, investmentsData, rsuGrants, liveData, fy,
  personFilter: personFilterProp, onPersonFilterChange,
  onAddHolding, onDeleteHolding, onUpdateHolding, onUpdateHoldingsBatch, onUpsertHoldings,
  onMergeStockLots, onMergeMFLots,
  onAddRsuGrant, onDeleteRsuGrant, onAddRsuEvent, onDeleteRsuEvent,
}) {
  const [view,          setView]          = useState("overview");
  // Use prop if provided (persisted across tabs), else fall back to local state
  const [personFilterLocal, setPersonFilterLocal] = useState("all");
  const personFilter    = personFilterProp ?? personFilterLocal;
  const setPersonFilter = (v) => { onPersonFilterChange?.(v); setPersonFilterLocal(v); };
  const [showAddForm,   setShowAddForm]   = useState(false);
  const [showCasImport,     setShowCasImport]     = useState(false);
  const [showTradebookImport, setShowTradebookImport] = useState(false);
  const [priceMap,     setPriceMap]     = useState({});
  const [changeMap,    setChangeMap]    = useState({}); // { symbol: 1D changePct }
  const [prevCloseMap, setPrevCloseMap] = useState({}); // { symbol: prevClose } for re-deriving change
  const [fetching,     setFetching]     = useState(false);
  const [fetchedAt,    setFetchedAt]    = useState(null);
  const [toast,        setToast]        = useState(null);
  const [showDayBreakdown, setShowDayBreakdown] = useState(false);
  const [holdingSort, setHoldingSort] = useState("value"); // "value" | "gain_pct" | "day_change"
  const toastTimerRef = useRef(null);

  const usdinr = liveData?.USDINR || 85;

  const derivedHoldings = useMemo(
    () => getDerivedHoldings(rsuData, incomeData, investmentsData),
    [rsuData, incomeData, investmentsData],
  );
  const allHoldings = useMemo(
    () => [...derivedHoldings, ...(holdingsData || [])],
    [derivedHoldings, holdingsData],
  );

  const fetchPrices = useCallback(async () => {
    setFetching(true);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ phase: "loading", fetched: 0, total: 0, label: "" });

    const onProgress = (fetched, total, label) =>
      setToast({ phase: "loading", fetched, total, label });

    const { priceMap: map, changeMap: chg, prevCloseMap: pcm, fetched: count } =
      await fetchAllPricesWithChange(allHoldings, onProgress);

    // Override MSFT/NVDA prices with liveData for correct current valuation.
    // Do NOT recompute changePct from liveData — 1D change is the previous session's
    // move (yesterday vs day-before-yesterday) and is independent of today's live price.
    for (const sym of ["MSFT", "NVDA"]) {
      const livePrice = liveData?.[sym];
      if (livePrice) map[sym] = livePrice;
    }
    setPriceMap(map);
    setChangeMap(chg);
    setPrevCloseMap(pcm);
    setFetchedAt(new Date());
    setFetching(false);

    // Transition to success toast, then fade out
    setToast({ phase: "done", count });
    toastTimerRef.current = setTimeout(() => setToast(null), 3000);
  }, [allHoldings, liveData]);

  // Fetch on mount and when holdings count changes
  useEffect(() => { fetchPrices(); }, [allHoldings.length]);

  // Close 1D breakdown on outside click
  useEffect(() => {
    if (!showDayBreakdown) return;
    const handler = () => setShowDayBreakdown(false);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [showDayBreakdown]);

  // Sync liveData price updates (MSFT/NVDA) for portfolio valuation only.
  // changeMap is NOT updated here — 1D change is the previous session's historical move.
  useEffect(() => {
    setPriceMap(prev => {
      const next = { ...prev };
      if (liveData?.MSFT) next.MSFT = liveData.MSFT;
      if (liveData?.NVDA) next.NVDA = liveData.NVDA;
      return next;
    });
  }, [liveData?.MSFT, liveData?.NVDA]);

  const enriched = useMemo(() => allHoldings.map(h => ({
    ...h,
    currentValue: getHoldingValue(h, priceMap, usdinr),
    // Baby Fund and Debt Funds are Debt regardless of their mf type
    category: h.source === "goal"
      ? "Debt"
      : h.categoryOverride || CATEGORY_MAP[h.type] || "Other",
  })), [allHoldings, priceMap, usdinr]);

  // Apply person filter — Joint holdings appear in both Selva and Akshaya views
  const filteredEnriched = useMemo(() => {
    if (personFilter === "all") return enriched;
    return enriched.filter(h => h.person === personFilter || h.person === "Joint");
  }, [enriched, personFilter]);

  const totalNW = filteredEnriched.reduce((s, h) => s + (h.currentValue || 0), 0);

  // 1D portfolio change: sum (currentValue × changePct) for all holdings with known change
  const { dayChangeINR, dayChangePct, dayBreakdown } = useMemo(() => {
    let change = 0;
    let base   = 0;
    const bySymbol = {}; // { sym: { label, changePct, changeINR, value } }

    for (const h of filteredEnriched) {
      const sym = h.type === "us_stock" ? h.symbol
                : h.type === "in_stock" ? (h.symbol && !/\.(NS|BO)$/i.test(h.symbol) ? h.symbol + ".NS" : h.symbol)
                : h.type === "mf"       ? h.schemeCode
                : null;
      const pct = sym ? changeMap[sym] : null;
      if (pct != null && h.currentValue) {
        const contrib = h.currentValue * (pct / 100);
        change += contrib;
        base   += h.currentValue;
        const label = h.symbol || h.name || String(sym);
        if (!bySymbol[sym]) bySymbol[sym] = { label, changePct: pct, changeINR: 0, value: 0 };
        bySymbol[sym].changeINR += contrib;
        bySymbol[sym].value     += h.currentValue;
      }
    }

    // Top contributors sorted by absolute INR impact
    const breakdown = Object.values(bySymbol)
      .sort((a, b) => Math.abs(b.changeINR) - Math.abs(a.changeINR))
      .slice(0, 8);

    return {
      dayChangeINR: change,
      dayChangePct: base > 0 ? change / base * 100 : null,
      dayBreakdown: breakdown,
    };
  }, [filteredEnriched, changeMap]);

  const grouped = useMemo(() => {
    const g = {};
    for (const h of filteredEnriched) {
      if (!g[h.category])        g[h.category] = {};
      if (!g[h.category][h.type]) g[h.category][h.type] = [];
      g[h.category][h.type].push(h);
    }
    return g;
  }, [filteredEnriched]);

  const staleMins = fetchedAt ? Math.round((Date.now() - fetchedAt) / 60000) : null;

  const NavBtn = ({ id, label }) => (
    <button onClick={() => setView(id)} style={{
      padding:"8px 18px", borderRadius:"8px", border:"none", cursor:"pointer",
      fontSize:"13px", fontWeight:600,
      background: view===id ? T.cta : "transparent",
      color:      view===id ? "#fff" : T.textDim,
    }}>{label}</button>
  );

  return (
    <div>
      {/* Sub-nav — two rows on mobile */}
      <div style={{ marginBottom:"20px", borderBottom:`1px solid ${T.border}`, paddingBottom:"12px" }}>
        {/* Row 1: view tabs + person filter + refresh */}
        <div style={{ display:"flex", alignItems:"center", gap:"4px", flexWrap:"wrap", rowGap:"8px" }}>
          <NavBtn id="overview" label="Overview"/>
          <NavBtn id="holdings" label="Holdings"/>
          <NavBtn id="grants"   label="Grants"/>
          <div style={{ flex:1 }}/>
          {/* Person filter */}
          <div style={{ display:"flex", background:T.card, borderRadius:"8px", padding:"2px", gap:"2px" }}>
            {["all","Selva","Akshaya"].map(p => (
              <button key={p} onClick={() => setPersonFilter(p)} style={{
                padding:"5px 12px", border:"none", borderRadius:"6px", fontSize:"12px", fontWeight:600,
                cursor:"pointer",
                background: personFilter === p ? T.cta : "transparent",
                color: personFilter === p ? "#fff"
                     : p === "Selva" ? T.selva
                     : p === "Akshaya" ? T.akshaya
                     : T.textDim,
              }}>{p === "all" ? "All" : p}</button>
            ))}
          </div>
          {/* 1D change badge — click to expand per-asset breakdown */}
          {dayChangePct !== null && (
            <div style={{ position:"relative", flexShrink:0 }}>
              <button onClick={() => setShowDayBreakdown(v => !v)} style={{
                padding:"5px 10px", borderRadius:"7px", fontSize:"12px", fontWeight:700,
                background: dayChangeINR >= 0 ? `${T.accent}18` : `${T.red}18`,
                color: dayChangeINR >= 0 ? T.accent : T.red, fontFamily:"'JetBrains Mono',monospace",
                border: `1px solid ${dayChangeINR >= 0 ? T.accent : T.red}44`,
                cursor:"pointer",
              }}>
                {dayChangeINR >= 0 ? "+" : ""}{fmtL(dayChangeINR)} ({dayChangePct >= 0 ? "+" : ""}{dayChangePct.toFixed(2)}%) 1D ▾
              </button>

              {showDayBreakdown && (
                <div onClick={e => e.stopPropagation()}
                  style={{
                    position:"absolute", top:"calc(100% + 6px)", right:0, zIndex:200,
                    background:T.surface, border:`1px solid ${T.border}`,
                    borderRadius:"12px", padding:"14px 16px", minWidth:"280px",
                    boxShadow:"0 8px 32px rgba(0,0,0,0.5)",
                  }}>
                  <div style={{ fontSize:"11px", fontWeight:700, color:T.text, marginBottom:"10px",
                    display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <span>1D Change Breakdown</span>
                    <button onClick={() => setShowDayBreakdown(false)}
                      style={{ background:"none", border:"none", color:T.textMuted, cursor:"pointer", fontSize:"14px", lineHeight:1 }}>×</button>
                  </div>
                  {dayBreakdown.map(d => {
                    const gc = d.changeINR >= 0 ? T.accent : T.red;
                    return (
                      <div key={d.label} style={{ display:"flex", justifyContent:"space-between",
                        alignItems:"center", padding:"5px 0",
                        borderBottom:`1px solid ${T.border}22`, gap:"12px" }}>
                        <div style={{ minWidth:0 }}>
                          <div style={{ fontSize:"12px", color:T.text, fontWeight:600,
                            overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:"140px" }}>
                            {d.label}
                          </div>
                          <div style={{ fontSize:"10px", color:T.textMuted }}>{fmtL(d.value)}</div>
                        </div>
                        <div style={{ textAlign:"right", flexShrink:0 }}>
                          <div style={{ fontSize:"12px", fontWeight:700, color:gc,
                            fontFamily:"'JetBrains Mono',monospace" }}>
                            {d.changeINR >= 0 ? "+" : ""}{fmtL(d.changeINR)}
                          </div>
                          <div style={{ fontSize:"10px", color:gc, fontFamily:"'JetBrains Mono',monospace" }}>
                            {d.changePct >= 0 ? "+" : ""}{d.changePct.toFixed(2)}%
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div style={{ marginTop:"10px", padding:"8px 0 0",
                    display:"flex", justifyContent:"space-between", fontSize:"12px" }}>
                    <span style={{ color:T.textMuted, fontSize:"11px" }}>
                      Stocks + MFs with live data · EPF/PPF/FD excluded
                    </span>
                  </div>
                  <div style={{ marginTop:"8px", padding:"8px", background:T.card, borderRadius:"8px",
                    fontSize:"10px", color:T.textMuted, lineHeight:1.6 }}>
                    <b style={{ color:T.textDim }}>Shows previous session's move:</b><br/>
                    Stocks: (yesterday close − day-before close) / day-before<br/>
                    MFs: (yesterday NAV − day-before NAV) / day-before NAV<br/>
                    A crash yesterday stays visible even if recovering today
                  </div>
                </div>
              )}
            </div>
          )}
          {staleMins !== null && (
            <span style={{ fontSize:"11px", color:staleMins>15?T.amber:T.textMuted, flexShrink:0 }}>
              {staleMins}m ago
            </span>
          )}
          <button onClick={fetchPrices} disabled={fetching}
            style={{ padding:"6px 14px", background:T.card, border:`1px solid ${T.border}`,
              borderRadius:"8px", color:T.textDim, fontSize:"12px", fontWeight:600, cursor:"pointer", flexShrink:0 }}>
            {fetching ? "…" : "↻"}
          </button>
        </div>
        {/* Row 2: sort + action buttons (holdings only) */}
        {view==="holdings" && (
          <div style={{ display:"flex", gap:"8px", marginTop:"10px", flexWrap:"wrap", alignItems:"center" }}>
            {/* Sort toggle */}
            <div style={{ display:"flex", background:T.card, borderRadius:"8px", padding:"2px", gap:"2px", flexShrink:0 }}>
              {[
                ["value",      "Sort: Value",   "Largest position first"],
                ["gain_pct",   "Sort: Gain %",  "Best return first"],
                ["day_change", "Sort: 1D Move", "Biggest yesterday mover first"],
              ].map(([k, lbl, tip]) => (
                <button key={k} onClick={() => setHoldingSort(k)} title={tip} style={{
                  padding:"5px 11px", border:"none", borderRadius:"6px", fontSize:"11px", fontWeight:600,
                  cursor:"pointer", transition:"all 0.15s",
                  background: holdingSort === k ? T.cta : "transparent",
                  color:      holdingSort === k ? "#fff" : T.textDim,
                }}>{lbl}</button>
              ))}
            </div>
            <div style={{ flex:1 }}/>
            <button onClick={() => setShowTradebookImport(true)}
              style={{ padding:"8px 14px", background:T.card, border:`1px solid ${T.border}`,
                borderRadius:"8px", color:T.textDim, fontSize:"12px", fontWeight:600, cursor:"pointer" }}>
              ⬆ Tradebook
            </button>
            <button onClick={() => setShowAddForm(v => !v)}
              style={{ padding:"8px 16px", background:T.cta, border:"none",
                borderRadius:"8px", color:"#fff", fontSize:"12px", fontWeight:700, cursor:"pointer" }}>
              {showAddForm ? "✕ Cancel" : "+ Add Holding"}
            </button>
          </div>
        )}
      </div>

      {showAddForm && view==="holdings" && (
        <AddHoldingForm
          onAdd={h => { onAddHolding(h); }}
          onClose={() => setShowAddForm(false)}/>
      )}

      {showTradebookImport && (
        <TradebookImportModal
          holdingsData={holdingsData}
          onReplaceStockLots={onMergeStockLots}
          onReplaceMFLots={onMergeMFLots}
          onClose={() => setShowTradebookImport(false)}/>
      )}

      {showCasImport && (
        <CasImportModal
          holdingsData={holdingsData}
          onImport={onUpsertHoldings}
          onClose={() => setShowCasImport(false)}/>
      )}

      {view==="overview" && (
        <>
          <OverviewView enriched={filteredEnriched} totalNW={totalNW}/>
          <div style={{ marginTop:"16px" }}>
            <PortfolioGrowthChart
              equityHoldings={filteredEnriched.filter(h =>
                ["us_stock","in_stock","mf"].includes(h.type) &&
                h.acquisitionDate &&
                h.source !== "goal"
              )}
              liveData={liveData}
            />
          </div>
        </>
      )}
      {view==="holdings" && (
        <HoldingsView grouped={grouped} priceMap={priceMap} usdinr={usdinr}
          sortBy={holdingSort} changeMap={changeMap}
          goals={investmentsData?.goals || []}
          onDelete={onDeleteHolding}
          onAdd={onAddHolding}
          onUpdateBalance={(id, bal) => onUpdateHolding(id, { balance: bal })}
          onUpdateFundCategory={(schemeCode, person, cat) => {
            const updates = holdingsData
              .filter(h => h.type === "mf" && h.schemeCode === schemeCode && h.person === person)
              .map(h => ({ id: h.id, changes: { categoryOverride: cat || undefined } }));
            if (updates.length > 0) onUpdateHoldingsBatch(updates);
          }}
          onUpdateHoldingGoal={(sym, person, goalId) => {
            // Tag all lots of this symbol (or schemeCode for MFs) to the goal
            const updates = holdingsData
              .filter(h => (h.symbol === sym || h.schemeCode === sym) && h.person === person)
              .map(h => ({ id: h.id, changes: { goalTag: goalId ?? null } }));
            if (updates.length > 0) onUpdateHoldingsBatch(updates);
          }}
          onDeleteDerived={h => {
            if (h.source === "rsu") onDeleteRsuEvent(h.id.replace("derived-rsu-", ""));
          }}/>
      )}
      {view==="grants" && (
        <RsuTab
          rsuData={rsuData}
          rsuGrants={rsuGrants}
          fy={fy}
          liveData={liveData}
          onAdd={onAddRsuEvent}
          onDelete={onDeleteRsuEvent}
          onAddGrant={onAddRsuGrant}
          onDeleteGrant={onDeleteRsuGrant}
          personFilter={personFilter}/>
      )}

      <PriceFetchToast toast={toast}/>
    </div>
  );
}
