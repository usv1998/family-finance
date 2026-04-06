import { useState, useMemo, useEffect, useCallback } from "react";
import { T } from "../../lib/theme";
import { getDerivedHoldings } from "../../lib/derivedHoldings";
import { portfolioXIRR } from "../../lib/xirr";
import { fetchAllPrices, getCurrentValueINR } from "../../lib/priceService";
import AddHoldingForm from "./AddHoldingForm";
import HoldingCard from "./HoldingCard";
import RsuTab from "../rsu/RsuTab";

// ── constants ─────────────────────────────────────────────────────────────────

const CATEGORY_MAP = {
  us_stock: "Equity",
  in_stock: "Equity",
  mf:       "Equity",
  fd:       "Debt",
  epf:      "Debt",
  ppf:      "Debt",
};
const CAT_COLORS  = { Equity: T.blue, Debt: T.amber, Gold: T.accent };
const TYPE_LABELS = {
  us_stock: "US Stocks",
  in_stock: "Indian Stocks",
  mf:       "Mutual Funds / SIPs",
  fd:       "Fixed Deposits",
  epf:      "EPF",
  ppf:      "PPF",
};

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

// ── Overview ──────────────────────────────────────────────────────────────────

function OverviewView({ enriched, totalNW }) {
  const catData = useMemo(() => {
    const cats = {};
    for (const h of enriched) {
      const cat = h.category;
      if (!cats[cat]) cats[cat] = { value: 0, cost: 0, holdings: [] };
      cats[cat].value += h.currentValue || 0;
      cats[cat].cost  += h.costBasisINR || h.balance || 0;
      cats[cat].holdings.push(h);
    }
    for (const cat of Object.keys(cats)) {
      cats[cat].xirr = portfolioXIRR(cats[cat].holdings);
    }
    return cats;
  }, [enriched]);

  const personData = useMemo(() => {
    const p = { Selva: 0, Akshaya: 0, Joint: 0 };
    for (const h of enriched) p[h.person] = (p[h.person] || 0) + (h.currentValue || 0);
    return p;
  }, [enriched]);

  const portfolioRate = useMemo(() => portfolioXIRR(enriched), [enriched]);

  const { totalGain, gainPct } = useMemo(() => {
    const totalCost = enriched.reduce((s, h) => s + (h.costBasisINR || h.balance || 0), 0);
    const gain = totalNW - totalCost;
    return { totalGain: gain, gainPct: totalCost > 0 ? gain / totalCost * 100 : null };
  }, [enriched, totalNW]);

  const MetricCard = ({ title, value, sub, col }) => (
    <div style={{ background:T.card, borderRadius:"14px", border:`1px solid ${T.border}`, padding:"20px" }}>
      <div style={{ fontSize:"11px", color:T.textMuted, fontWeight:700, letterSpacing:"0.5px", marginBottom:"8px" }}>
        {title}
      </div>
      <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"26px", fontWeight:800, color:col||T.accent }}>
        {value}
      </div>
      {sub && <div style={{ fontSize:"11px", color:T.textMuted, marginTop:"4px" }}>{sub}</div>}
    </div>
  );

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"20px" }}>
      {/* KPI row */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))", gap:"14px" }}>
        <MetricCard title="TOTAL NET WORTH" value={fmtL(totalNW)}/>
        {portfolioRate !== null && (
          <MetricCard
            title="PORTFOLIO XIRR"
            value={fmtXIRR(portfolioRate)}
            sub="annualised return"
            col={portfolioRate >= 0 ? T.accent : T.red}/>
        )}
        {gainPct !== null && (
          <MetricCard
            title="TOTAL GAIN"
            value={`${totalGain >= 0 ? "+" : ""}${fmtL(Math.abs(totalGain))}`}
            sub={`${gainPct >= 0 ? "+" : ""}${gainPct.toFixed(1)}% on invested`}
            col={totalGain >= 0 ? T.accent : T.red}/>
        )}
        {Object.entries(personData).filter(([, v]) => v > 0).map(([person, val]) => (
          <MetricCard
            key={person}
            title={person.toUpperCase()}
            value={fmtL(val)}
            sub={`${totalNW > 0 ? (val / totalNW * 100).toFixed(1) : 0}% of portfolio`}
            col={person === "Selva" ? T.selva : person === "Akshaya" ? T.akshaya : T.purple}/>
        ))}
      </div>

      {/* Category breakdown */}
      <div style={{ background:T.card, borderRadius:"14px", border:`1px solid ${T.border}`, padding:"20px" }}>
        <div style={{ fontSize:"11px", color:T.textMuted, fontWeight:700, letterSpacing:"0.5px", marginBottom:"16px" }}>
          ASSET CLASS BREAKDOWN
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:"16px" }}>
          {["Equity","Debt","Gold"].map(cat => {
            const d = catData[cat];
            if (!d || d.value <= 0) return null;
            const pct     = totalNW > 0 ? d.value / totalNW * 100 : 0;
            const gain    = d.value - d.cost;
            const gainPct = d.cost > 0 ? gain / d.cost * 100 : 0;
            const col     = CAT_COLORS[cat] || T.textDim;
            return (
              <div key={cat}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
                  flexWrap:"wrap", gap:"8px", marginBottom:"6px" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
                    <span style={{ fontSize:"13px", fontWeight:700, color:col }}>{cat}</span>
                    {d.xirr !== null && (
                      <span style={{ fontSize:"11px", fontWeight:700, padding:"2px 8px", borderRadius:"6px",
                        color:d.xirr>=0?T.accent:T.red, background:`${d.xirr>=0?T.accent:T.red}18` }}>
                        XIRR {fmtXIRR(d.xirr)}
                      </span>
                    )}
                  </div>
                  <div style={{ display:"flex", gap:"16px", alignItems:"center" }}>
                    <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"14px", fontWeight:700, color:T.text }}>
                      {fmtL(d.value)}
                    </span>
                    <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"12px",
                      color:gain>=0?T.accent:T.red }}>
                      {gain>=0?"+":""}{fmtL(Math.abs(gain))} ({gainPct>=0?"+":""}{gainPct.toFixed(1)}%)
                    </span>
                    <span style={{ fontSize:"11px", color:T.textMuted }}>{pct.toFixed(1)}%</span>
                  </div>
                </div>
                <div style={{ height:"6px", borderRadius:"3px", background:T.border, overflow:"hidden" }}>
                  <div style={{ width:`${pct}%`, height:"100%", borderRadius:"3px",
                    background:col, transition:"width 0.5s ease" }}/>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Holdings ──────────────────────────────────────────────────────────────────

function HoldingsView({ grouped, priceMap, usdinr, onDelete, onUpdateBalance }) {
  const [expanded, setExpanded] = useState({});
  const toggle = key => setExpanded(e => ({ ...e, [key]: !e[key] }));

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"12px" }}>
      {["Equity","Debt","Gold"].map(cat => {
        const typeMap = grouped[cat];
        if (!typeMap) return null;
        const catHoldings = Object.values(typeMap).flat();
        const catValue    = catHoldings.reduce((s, h) => s + (h.currentValue || 0), 0);
        const catKey      = `cat-${cat}`;
        const catOpen     = expanded[catKey] !== false; // default open

        return (
          <div key={cat} style={{ background:T.surface, borderRadius:"12px",
            border:`1px solid ${T.border}`, overflow:"hidden" }}>

            {/* Category header */}
            <div onClick={() => toggle(catKey)}
              style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
                padding:"14px 18px", cursor:"pointer", userSelect:"none",
                borderBottom: catOpen ? `1px solid ${T.border}` : "none" }}>
              <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
                <span style={{ fontSize:"14px", fontWeight:700, color:CAT_COLORS[cat]||T.text }}>{cat}</span>
                <span style={{ fontSize:"11px", color:T.textMuted }}>
                  {catHoldings.length} holding{catHoldings.length!==1?"s":""}
                </span>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:"12px" }}>
                <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"15px",
                  fontWeight:700, color:T.text }}>{fmtL(catValue)}</span>
                <span style={{ color:T.textMuted, fontSize:"13px" }}>{catOpen?"▲":"▼"}</span>
              </div>
            </div>

            {catOpen && Object.entries(typeMap).map(([type, holdings]) => {
              const typeKey  = `type-${cat}-${type}`;
              const typeOpen = expanded[typeKey] !== false;
              const typeVal  = holdings.reduce((s, h) => s + (h.currentValue || 0), 0);
              const typeXirr = portfolioXIRR(holdings);
              return (
                <div key={type}>
                  <div onClick={() => toggle(typeKey)}
                    style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
                      padding:"9px 18px 9px 28px", cursor:"pointer", userSelect:"none",
                      background:T.card, borderBottom:`1px solid ${T.border}33` }}>
                    <span style={{ fontSize:"12px", fontWeight:600, color:T.textDim }}>
                      {TYPE_LABELS[type] || type}
                    </span>
                    <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
                      {typeXirr !== null && (
                        <span style={{ fontSize:"10px", fontWeight:700,
                          color:typeXirr>=0?T.accent:T.red }}>
                          XIRR {fmtXIRR(typeXirr)}
                        </span>
                      )}
                      <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"12px",
                        color:T.textDim }}>{fmtL(typeVal)}</span>
                      <span style={{ color:T.textMuted, fontSize:"12px" }}>{typeOpen?"▲":"▼"}</span>
                    </div>
                  </div>
                  {typeOpen && (
                    <div style={{ display:"flex", flexDirection:"column", gap:"8px", padding:"10px 14px" }}>
                      {holdings.map(h => (
                        <HoldingCard key={h.id} holding={h} priceMap={priceMap} usdinr={usdinr}
                          onDelete={onDelete} onUpdateBalance={onUpdateBalance}/>
                      ))}
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
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PortfolioTab({
  holdingsData, rsuData, incomeData, investmentsData, rsuGrants, liveData, fy,
  onAddHolding, onDeleteHolding, onUpdateHolding,
  onAddRsuGrant, onDeleteRsuGrant, onAddRsuEvent, onDeleteRsuEvent,
}) {
  const [view,        setView]        = useState("overview");
  const [showAddForm, setShowAddForm] = useState(false);
  const [priceMap,    setPriceMap]    = useState({});
  const [fetching,    setFetching]    = useState(false);
  const [fetchedAt,   setFetchedAt]   = useState(null);

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
    const map = await fetchAllPrices(allHoldings);
    if (liveData?.MSFT) map.MSFT = liveData.MSFT;
    if (liveData?.NVDA) map.NVDA = liveData.NVDA;
    setPriceMap(map);
    setFetchedAt(new Date());
    setFetching(false);
  }, [allHoldings, liveData]);

  // Fetch on mount and when holdings count changes
  useEffect(() => { fetchPrices(); }, [allHoldings.length]);

  // Sync liveData price updates (MSFT/NVDA) without a full refetch
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
      : (CATEGORY_MAP[h.type] || "Other"),
  })), [allHoldings, priceMap, usdinr]);

  const totalNW = enriched.reduce((s, h) => s + (h.currentValue || 0), 0);

  const grouped = useMemo(() => {
    const g = {};
    for (const h of enriched) {
      if (!g[h.category])        g[h.category] = {};
      if (!g[h.category][h.type]) g[h.category][h.type] = [];
      g[h.category][h.type].push(h);
    }
    return g;
  }, [enriched]);

  const staleMins = fetchedAt ? Math.round((Date.now() - fetchedAt) / 60000) : null;

  const NavBtn = ({ id, label }) => (
    <button onClick={() => setView(id)} style={{
      padding:"8px 18px", borderRadius:"8px", border:"none", cursor:"pointer",
      fontSize:"13px", fontWeight:600,
      background: view===id ? T.accent : "transparent",
      color:      view===id ? T.bg     : T.textDim,
    }}>{label}</button>
  );

  return (
    <div>
      {/* Sub-nav */}
      <div style={{ display:"flex", alignItems:"center", gap:"4px", marginBottom:"20px",
        borderBottom:`1px solid ${T.border}`, paddingBottom:"12px", flexWrap:"wrap", rowGap:"8px" }}>
        <NavBtn id="overview" label="Overview"/>
        <NavBtn id="holdings" label="Holdings"/>
        <NavBtn id="grants"   label="Grants"/>
        <div style={{ flex:1 }}/>
        <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
          {staleMins !== null && (
            <span style={{ fontSize:"11px", color:staleMins>15?T.amber:T.textMuted }}>
              prices {staleMins}m ago
            </span>
          )}
          <button onClick={fetchPrices} disabled={fetching}
            style={{ padding:"6px 14px", background:T.card, border:`1px solid ${T.border}`,
              borderRadius:"8px", color:T.textDim, fontSize:"12px", fontWeight:600, cursor:"pointer" }}>
            {fetching ? "…" : "↻ Refresh"}
          </button>
          {view==="holdings" && (
            <button onClick={() => setShowAddForm(v => !v)}
              style={{ padding:"6px 14px", background:T.accent, border:"none",
                borderRadius:"8px", color:T.bg, fontSize:"12px", fontWeight:700, cursor:"pointer" }}>
              {showAddForm ? "✕ Cancel" : "+ Add Holding"}
            </button>
          )}
        </div>
      </div>

      {showAddForm && view==="holdings" && (
        <AddHoldingForm
          onAdd={h => { onAddHolding(h); setShowAddForm(false); }}
          onClose={() => setShowAddForm(false)}/>
      )}

      {view==="overview" && <OverviewView enriched={enriched} totalNW={totalNW}/>}
      {view==="holdings" && (
        <HoldingsView grouped={grouped} priceMap={priceMap} usdinr={usdinr}
          onDelete={onDeleteHolding}
          onUpdateBalance={(id, bal) => onUpdateHolding(id, { balance: bal })}/>
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
          onDeleteGrant={onDeleteRsuGrant}/>
      )}
    </div>
  );
}
