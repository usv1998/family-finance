import { useState, useMemo } from "react";
import {
  ResponsiveContainer, ComposedChart, Bar, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  Cell,
} from "recharts";
import { T } from "../../lib/theme";
import { fmtINR, getEsspINR } from "../../lib/formatters";
import { PERSONS } from "../../lib/constants";

// ── data helpers ──────────────────────────────────────────────────────────────

const SEGMENTS = [
  { key:"salary", label:"Take-Home Salary", color:T.selva   },
  { key:"rsu",    label:"RSU (Net)",         color:T.purple  },
  { key:"espp",   label:"ESPP",              color:T.teal    },
  { key:"epf",    label:"EPF",               color:T.accent  },
  { key:"bonus",  label:"Bonus / Ad-hoc",    color:T.amber   },
];

function computeFYData(fy, incomeData, rsuData) {
  let salary = 0, rsu = 0, espp = 0, epf = 0, bonus = 0;
  for (const p of PERSONS) {
    for (let mi = 0; mi < 12; mi++) {
      const d = incomeData?.[fy]?.[p]?.[mi] || {};
      salary += Number(d.take_home || 0);
      espp   += getEsspINR(d);
      epf    += Number(d.epf       || 0);
      bonus  += (d.ad_hoc || []).reduce((s, i) => s + Number(i.amount || 0), 0);
    }
    for (const e of (rsuData?.[fy] || []).filter(e => e.person === p)) {
      rsu += (e.units_vested - (e.tax_withheld_units || 0)) * e.stock_price_usd * e.usd_inr_rate;
    }
  }
  const total = salary + rsu + espp + epf + bonus;
  return { fy, name: fy.replace("FY", ""), salary, rsu, espp, epf, bonus, total };
}

function fmtL(n) {
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(1)}Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(1)}L`;
  return `₹${Math.round(n / 1000)}K`;
}

// ── custom tooltip ────────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:"10px", padding:"14px 16px", minWidth:"210px" }}>
      <div style={{ fontSize:"13px", fontWeight:700, color:T.text, marginBottom:"10px" }}>{label}</div>
      {SEGMENTS.map(seg => d[seg.key] > 0 && (
        <div key={seg.key} style={{ display:"flex", justifyContent:"space-between", gap:"16px", marginBottom:"5px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:"7px" }}>
            <div style={{ width:"9px", height:"9px", borderRadius:"50%", background:seg.color, flexShrink:0 }}/>
            <span style={{ fontSize:"12px", color:T.textDim }}>{seg.label}</span>
          </div>
          <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"12px", color:seg.color, fontWeight:700 }}>
            {fmtINR(d[seg.key])}
          </span>
        </div>
      ))}
      <div style={{ borderTop:`1px solid ${T.border}`, marginTop:"8px", paddingTop:"8px", display:"flex", justifyContent:"space-between" }}>
        <span style={{ fontSize:"12px", fontWeight:700, color:T.text }}>Total</span>
        <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"13px", fontWeight:800, color:T.accent }}>
          {fmtINR(d.total)}
        </span>
      </div>
    </div>
  );
}

// ── custom legend ─────────────────────────────────────────────────────────────

function CustomLegend({ hiddenKeys, onToggle }) {
  return (
    <div style={{ display:"flex", flexWrap:"wrap", gap:"8px", justifyContent:"center", marginTop:"8px" }}>
      {[...SEGMENTS, { key:"total", label:"Total (trend)", color:T.text }].map(seg => {
        const hidden = hiddenKeys.has(seg.key);
        return (
          <button key={seg.key} onClick={() => onToggle(seg.key)}
            style={{ display:"flex", alignItems:"center", gap:"6px", padding:"4px 12px", borderRadius:"20px",
              border:`1px solid ${hidden ? T.border : seg.color}`,
              background: hidden ? "transparent" : seg.color + "18",
              color: hidden ? T.textMuted : seg.color,
              fontSize:"11px", fontWeight:600, cursor:"pointer", opacity: hidden ? 0.5 : 1, transition:"all 0.15s" }}>
            <span style={{ width:"8px", height:"8px", borderRadius: seg.key==="total" ? "2px" : "50%",
              flexShrink:0,
              borderTop: seg.key==="total" ? `2px dashed ${hidden?T.textMuted:seg.color}` : "none",
              background: seg.key==="total" ? "none" : (hidden ? T.textMuted : seg.color) }}/>
            {seg.label}
          </button>
        );
      })}
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────

export default function IncomeGrowthChart({ incomeData, rsuData }) {
  const [hiddenKeys, setHiddenKeys] = useState(new Set());

  const toggle = (key) => setHiddenKeys(prev => {
    const next = new Set(prev);
    next.has(key) ? next.delete(key) : next.add(key);
    return next;
  });

  const data = useMemo(() => {
    const allFYs = [...new Set([
      ...Object.keys(incomeData || {}),
      ...Object.keys(rsuData   || {}),
    ])].filter(k => k.startsWith("FY")).sort();
    return allFYs.map(fy => computeFYData(fy, incomeData, rsuData));
  }, [incomeData, rsuData]);

  if (!data.length) return (
    <div style={{ textAlign:"center", padding:"60px", color:T.textMuted, fontSize:"14px" }}>
      No income data recorded yet.
    </div>
  );

  // YoY growth cards
  const growthCards = data.slice(1).map((d, i) => {
    const prev = data[i].total;
    const pct  = prev > 0 ? (d.total - prev) / prev * 100 : 0;
    return { from: data[i].name, to: d.name, pct, abs: d.total - prev };
  });

  return (
    <div>
      <ResponsiveContainer width="100%" height={340}>
        <ComposedChart data={data} margin={{ top:20, right:20, left:20, bottom:5 }}
          barCategoryGap="28%">
          <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false}/>
          <XAxis dataKey="name" tick={{ fill:T.textDim, fontSize:12, fontWeight:600 }}
            axisLine={{ stroke:T.border }} tickLine={false}/>
          <YAxis tickFormatter={fmtL} tick={{ fill:T.textMuted, fontSize:11 }}
            axisLine={false} tickLine={false} width={60}/>
          <Tooltip content={<CustomTooltip/>} cursor={{ fill:T.border, opacity:0.3 }}/>

          {/* Stacked bars */}
          {SEGMENTS.map(seg => !hiddenKeys.has(seg.key) && (
            <Bar key={seg.key} dataKey={seg.key} name={seg.label}
              stackId="income" fill={seg.color} radius={seg.key==="bonus"?[4,4,0,0]:[0,0,0,0]}/>
          ))}

          {/* Total trend line */}
          {!hiddenKeys.has("total") && data.length > 1 && (
            <Line dataKey="total" name="Total" type="monotone"
              stroke={T.text} strokeWidth={2} strokeDasharray="6 3" dot={{ fill:T.text, r:4 }}
              activeDot={{ r:6, fill:T.accent }}/>
          )}
        </ComposedChart>
      </ResponsiveContainer>

      <CustomLegend hiddenKeys={hiddenKeys} onToggle={toggle}/>

      {/* YoY growth cards */}
      {growthCards.length > 0 && (
        <div style={{ display:"flex", gap:"12px", flexWrap:"wrap", marginTop:"20px" }}>
          {growthCards.map(g => (
            <div key={g.to} style={{ padding:"10px 16px", background:T.card, borderRadius:"10px", border:`1px solid ${T.border}` }}>
              <div style={{ fontSize:"10px", color:T.textMuted, fontWeight:700, marginBottom:"4px" }}>
                {g.from} → {g.to}
              </div>
              <div style={{ fontSize:"18px", fontWeight:800, fontFamily:"'JetBrains Mono',monospace",
                color: g.pct >= 0 ? T.accent : T.red }}>
                {g.pct >= 0 ? "+" : ""}{g.pct.toFixed(1)}%
              </div>
              <div style={{ fontSize:"11px", color:T.textMuted, marginTop:"2px" }}>
                {g.abs >= 0 ? "+" : ""}{fmtINR(g.abs)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
