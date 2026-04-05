import { useState, useEffect, useCallback } from "react";
import { T } from "../../lib/theme";
import { fmtINR } from "../../lib/formatters";
import { fetchAllPrices, getCurrentValueINR } from "../../lib/priceService";
import AddHoldingForm, { TYPE_META } from "./AddHoldingForm";
import HoldingCard from "./HoldingCard";

const PERSONS_EXT = ["Selva", "Akshaya", "Joint"];

function SumCard({ label, value, color, sub }) {
  return (
    <div style={{ background:T.card, borderRadius:"10px", padding:"14px 16px",
      border:`1px solid ${T.border}`, flex:"1 1 140px" }}>
      <div style={{ fontSize:"10px", color:T.textMuted, fontWeight:700,
        letterSpacing:"0.5px", marginBottom:"6px" }}>{label.toUpperCase()}</div>
      <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"18px",
        fontWeight:800, color: color || T.accent }}>{value}</div>
      {sub && <div style={{ fontSize:"10px", color:T.textMuted, marginTop:"3px" }}>{sub}</div>}
    </div>
  );
}

export default function NetWorthTab({ holdings, liveData, onAddHolding, onDeleteHolding, onUpdateHolding }) {
  const [priceMap,     setPriceMap]    = useState({});
  const [pricesLoading,setPricesLoading] = useState(false);
  const [pricesFetchedAt, setPricesFetchedAt] = useState(null);
  const [showAdd,      setShowAdd]     = useState(false);
  const [filterPerson, setFilterPerson]= useState("All");
  const [filterType,   setFilterType]  = useState("All");

  const usdinr = liveData?.USDINR || 85;

  const refreshPrices = useCallback(async () => {
    if (!holdings.length) return;
    setPricesLoading(true);
    const map = await fetchAllPrices(holdings);
    setPriceMap(map);
    setPricesFetchedAt(Date.now());
    setPricesLoading(false);
  }, [holdings]);

  // Fetch prices on mount and when holdings count changes
  useEffect(() => { refreshPrices(); }, [refreshPrices]);

  // Compute values for all holdings
  const valued = holdings.map(h => ({
    ...h,
    currentValue: getCurrentValueINR(h, priceMap, usdinr),
  }));

  // Totals
  const total = valued.reduce((s, h) => s + (h.currentValue || 0), 0);

  const byPerson = PERSONS_EXT.reduce((acc, p) => {
    acc[p] = valued.filter(h => h.person === p).reduce((s, h) => s + (h.currentValue || 0), 0);
    return acc;
  }, {});

  const byType = Object.keys(TYPE_META).reduce((acc, t) => {
    acc[t] = valued.filter(h => h.type === t).reduce((s, h) => s + (h.currentValue || 0), 0);
    return acc;
  }, {});

  // Filter
  const filtered = valued.filter(h =>
    (filterPerson === "All" || h.person === filterPerson) &&
    (filterType   === "All" || h.type   === filterType)
  );

  const btnStyle = (active) => ({
    padding:"5px 12px", borderRadius:"20px", border:"none", fontSize:"12px",
    fontWeight:600, cursor:"pointer", transition:"all 0.15s",
    background: active ? T.accent : "transparent",
    color: active ? T.bg : T.textDim,
  });

  const staleMin = pricesFetchedAt
    ? Math.floor((Date.now() - pricesFetchedAt) / 60000) : null;

  return (
    <div>
      {/* Total Net Worth */}
      <div style={{ background:T.surface, borderRadius:"12px", border:`1px solid ${T.border}`,
        padding:"20px", marginBottom:"20px" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start",
          flexWrap:"wrap", gap:"12px", marginBottom:"16px" }}>
          <div>
            <div style={{ fontSize:"12px", color:T.textMuted, fontWeight:700,
              letterSpacing:"0.5px", marginBottom:"6px" }}>TOTAL NET WORTH</div>
            <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"32px",
              fontWeight:800, color:T.accent }}>{fmtINR(total)}</div>
            {pricesFetchedAt && (
              <div style={{ fontSize:"11px", color:staleMin > 15 ? T.amber : T.accent, marginTop:"4px" }}>
                {staleMin === 0 ? "Prices just updated" : `Prices ${staleMin}m ago`}
                {" · "}USD/INR ₹{usdinr.toFixed(2)}
              </div>
            )}
          </div>
          <button onClick={refreshPrices} disabled={pricesLoading}
            style={{ padding:"8px 16px", background:"transparent", border:`1px solid ${T.border}`,
              borderRadius:"8px", color:pricesLoading?T.textMuted:T.textDim,
              fontSize:"12px", fontWeight:600, cursor:"pointer" }}>
            {pricesLoading ? "Fetching…" : "⟳ Refresh Prices"}
          </button>
        </div>

        {/* By person */}
        <div style={{ display:"flex", gap:"12px", flexWrap:"wrap", marginBottom:"14px" }}>
          {PERSONS_EXT.map(p => (
            <SumCard key={p} label={p}
              value={byPerson[p] > 0 ? fmtINR(byPerson[p]) : "—"}
              color={p==="Selva"?T.selva:p==="Akshaya"?T.akshaya:T.purple}
              sub={total > 0 && byPerson[p] > 0 ? `${(byPerson[p]/total*100).toFixed(0)}% of total` : null}/>
          ))}
        </div>

        {/* By type */}
        <div style={{ display:"flex", gap:"10px", flexWrap:"wrap" }}>
          {Object.entries(TYPE_META).filter(([t]) => byType[t] > 0).map(([t, meta]) => (
            <div key={t} style={{ padding:"8px 14px", background:T.bg, borderRadius:"8px",
              border:`1px solid ${meta.color}44` }}>
              <div style={{ fontSize:"10px", color:meta.color, fontWeight:700,
                marginBottom:"3px" }}>{meta.label.toUpperCase()}</div>
              <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"14px",
                fontWeight:700, color:T.text }}>{fmtINR(byType[t])}</div>
              {total > 0 && (
                <div style={{ fontSize:"10px", color:T.textMuted, marginTop:"1px" }}>
                  {(byType[t]/total*100).toFixed(0)}%
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Filter bar + Add */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
        flexWrap:"wrap", gap:"10px", marginBottom:"16px" }}>
        <div style={{ display:"flex", gap:"6px", flexWrap:"wrap" }}>
          {/* Person filter */}
          <div style={{ display:"flex", gap:"3px", padding:"3px", background:T.card, borderRadius:"10px" }}>
            {["All", ...PERSONS_EXT].map(p => (
              <button key={p} onClick={()=>setFilterPerson(p)} style={btnStyle(filterPerson===p)}>{p}</button>
            ))}
          </div>
          {/* Type filter */}
          <div style={{ display:"flex", gap:"3px", padding:"3px", background:T.card, borderRadius:"10px" }}>
            <button onClick={()=>setFilterType("All")} style={btnStyle(filterType==="All")}>All</button>
            {Object.entries(TYPE_META).map(([t,m]) => (
              <button key={t} onClick={()=>setFilterType(t)} style={{
                ...btnStyle(filterType===t),
                color: filterType===t ? T.bg : m.color,
              }}>{m.label}</button>
            ))}
          </div>
        </div>
        <button onClick={()=>setShowAdd(v=>!v)}
          style={{ padding:"8px 18px", background:showAdd?T.card:T.accent,
            border:`1px solid ${showAdd?T.border:T.accent}`,
            borderRadius:"8px", color:showAdd?T.textDim:T.bg,
            fontSize:"13px", fontWeight:700, cursor:"pointer" }}>
          {showAdd ? "Cancel" : "+ Add Holding"}
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <AddHoldingForm
          onAdd={(h) => { onAddHolding(h); setShowAdd(false); }}
          onClose={() => setShowAdd(false)}
        />
      )}

      {/* Holdings list */}
      {holdings.length === 0 ? (
        <div style={{ textAlign:"center", padding:"60px", color:T.textMuted, fontSize:"14px",
          background:T.surface, borderRadius:"12px", border:`1px solid ${T.border}` }}>
          No holdings yet — click "+ Add Holding" to get started.
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign:"center", padding:"40px", color:T.textMuted, fontSize:"13px" }}>
          No holdings match the current filter.
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:"12px" }}>
          {filtered.map(h => (
            <HoldingCard
              key={h.id}
              holding={h}
              priceMap={priceMap}
              usdinr={usdinr}
              onDelete={onDeleteHolding}
              onUpdateBalance={(id, bal) => onUpdateHolding(id, { balance: bal })}
            />
          ))}
        </div>
      )}
    </div>
  );
}
