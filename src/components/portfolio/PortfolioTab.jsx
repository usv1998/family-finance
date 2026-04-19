import { useState, useMemo, useEffect, useCallback } from "react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
         Tooltip, ResponsiveContainer, Label } from "recharts";
import { T } from "../../lib/theme";
import { getDerivedHoldings } from "../../lib/derivedHoldings";
import { portfolioXIRR } from "../../lib/xirr";
import { fetchAllPrices, getCurrentValueINR } from "../../lib/priceService";
import AddHoldingForm from "./AddHoldingForm";
import HoldingCard from "./HoldingCard";
import CasImportModal from "./CasImportModal";
import TradebookImportModal from "./TradebookImportModal";
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
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:"12px" }}>
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
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(270px,1fr))", gap:"16px" }}>

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

      {/* ── 3. Person split + category performance ────────────────────────── */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(270px,1fr))", gap:"16px" }}>

        {/* Person donut */}
        {personDonut.length >= 1 && (
          <SectionCard title="Portfolio by Member">
            <ResponsiveContainer width="100%" height={170}>
              <PieChart>
                <Pie data={personDonut} cx="50%" cy="50%" innerRadius={52} outerRadius={75}
                  paddingAngle={4} dataKey="value" strokeWidth={0}>
                  {personDonut.map((e, i) => <Cell key={i} fill={e.color}/>)}
                </Pie>
                <Tooltip content={(props) => <AllocTip {...props} totalNW={totalNW}/>}/>
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display:"flex", gap:"12px", justifyContent:"center",
              flexWrap:"wrap", marginTop:"8px" }}>
              {personDonut.map(d => (
                <div key={d.name} style={{ textAlign:"center", background:T.surface,
                  borderRadius:"10px", padding:"8px 16px", border:`1px solid ${d.color}33` }}>
                  <div style={{ display:"flex", alignItems:"center", gap:"5px",
                    marginBottom:"4px", justifyContent:"center" }}>
                    <div style={{ width:"8px", height:"8px", borderRadius:"50%", background:d.color }}/>
                    <span style={{ fontSize:"11px", fontWeight:700, color:d.color }}>{d.name}</span>
                  </div>
                  <div style={{ fontFamily:"monospace", fontSize:"15px", fontWeight:800, color:T.text }}>
                    {fmtL(d.value)}
                  </div>
                  <div style={{ fontSize:"10px", color:T.textMuted, marginTop:"2px" }}>
                    {(d.value/totalNW*100).toFixed(1)}%
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        )}

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

function StockModal({ modal, priceMap, usdinr, onDelete, onUpdateBalance, onDeleteDerived, onClose }) {
  if (!modal) return null;
  const { label, holdings } = modal;
  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", zIndex:1000,
      display:"flex", alignItems:"center", justifyContent:"center", padding:"20px" }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:T.surface, borderRadius:"16px",
        border:`1px solid ${T.border}`, width:"100%", maxWidth:"720px", maxHeight:"85vh",
        overflow:"hidden", display:"flex", flexDirection:"column" }}>
        <div style={{ padding:"16px 20px", borderBottom:`1px solid ${T.border}`,
          display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <span style={{ fontSize:"15px", fontWeight:700, color:T.text }}>{label}</span>
          <button onClick={onClose} style={{ background:"none", border:"none", color:T.textMuted,
            fontSize:"22px", cursor:"pointer", lineHeight:1, padding:"0 4px" }}>×</button>
        </div>
        <div style={{ overflowY:"auto", padding:"14px", display:"flex", flexDirection:"column", gap:"10px" }}>
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

function HoldingsView({ grouped, priceMap, usdinr, onDelete, onUpdateBalance, onUpdateFundCategory, onDeleteDerived }) {
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
        onDeleteDerived={handleDeleteDerived} onClose={()=>setModalSym(null)}/>

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
                        {Object.entries(byStock).map(([sym, lots]) => {
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
  onAddHolding, onDeleteHolding, onUpdateHolding, onUpdateHoldingsBatch, onUpsertHoldings,
  onMergeStockLots, onMergeMFLots,
  onAddRsuGrant, onDeleteRsuGrant, onAddRsuEvent, onDeleteRsuEvent,
}) {
  const [view,          setView]          = useState("holdings");
  const [showAddForm,   setShowAddForm]   = useState(false);
  const [showCasImport,     setShowCasImport]     = useState(false);
  const [showTradebookImport, setShowTradebookImport] = useState(false);
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
      : h.categoryOverride || CATEGORY_MAP[h.type] || "Other",
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
            <>
              <button onClick={() => setShowTradebookImport(true)}
                style={{ padding:"6px 14px", background:T.card, border:`1px solid ${T.border}`,
                  borderRadius:"8px", color:T.textDim, fontSize:"12px", fontWeight:600, cursor:"pointer" }}>
                ⬆ Tradebook
              </button>
              <button onClick={() => setShowAddForm(v => !v)}
                style={{ padding:"6px 14px", background:T.accent, border:"none",
                  borderRadius:"8px", color:T.bg, fontSize:"12px", fontWeight:700, cursor:"pointer" }}>
                {showAddForm ? "✕ Cancel" : "+ Add Holding"}
              </button>
            </>
          )}
        </div>
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

      {view==="overview" && <OverviewView enriched={enriched} totalNW={totalNW}/>}
      {view==="holdings" && (
        <HoldingsView grouped={grouped} priceMap={priceMap} usdinr={usdinr}
          onDelete={onDeleteHolding}
          onUpdateBalance={(id, bal) => onUpdateHolding(id, { balance: bal })}
          onUpdateFundCategory={(schemeCode, person, cat) => {
            const updates = holdingsData
              .filter(h => h.type === "mf" && h.schemeCode === schemeCode && h.person === person)
              .map(h => ({ id: h.id, changes: { categoryOverride: cat || undefined } }));
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
          onDeleteGrant={onDeleteRsuGrant}/>
      )}
    </div>
  );
}
