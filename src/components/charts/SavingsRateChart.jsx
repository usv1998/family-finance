import { useMemo } from "react";
import {
  ResponsiveContainer, ComposedChart, Bar,
  Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import { T } from "../../lib/theme";
import { fmtINR, getEsspINR } from "../../lib/formatters";
import { PERSONS, MONTHS } from "../../lib/constants";

// ── data helpers ──────────────────────────────────────────────────────────────

function computeFYIncome(fy, incomeData, rsuData) {
  let total = 0;
  for (const p of PERSONS) {
    for (let mi = 0; mi < 12; mi++) {
      const d = incomeData?.[fy]?.[p]?.[mi] || {};
      total += Number(d.take_home || 0) + getEsspINR(d)
             + Number(d.epf || 0)
             + (d.ad_hoc || []).reduce((s, i) => s + Number(i.amount || 0), 0);
    }
    for (const e of (rsuData?.[fy] || []).filter(e => e.person === p)) {
      total += (e.units_vested - (e.tax_withheld_units || 0)) * e.stock_price_usd * e.usd_inr_rate;
    }
  }
  return total;
}

function computeFYExpenses(fy, expensesData) {
  const actuals = expensesData?.[fy]?.actuals || {};
  let total = 0;
  for (let mi = 0; mi < 12; mi++) {
    const month = actuals[mi] || {};
    for (const v of Object.values(month)) total += Number(v) || 0;
  }
  return total;
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
      {[
        { label:"Total Income",   val:d.income,   color:T.accent },
        { label:"Total Expenses", val:d.expenses, color:T.amber  },
        { label:"Savings",        val:d.savings,  color:d.savings>=0?T.teal:T.red },
      ].map(r => (
        <div key={r.label} style={{ display:"flex", justifyContent:"space-between", gap:"16px", marginBottom:"5px" }}>
          <span style={{ fontSize:"12px", color:T.textDim }}>{r.label}</span>
          <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"12px", color:r.color, fontWeight:700 }}>
            {fmtINR(r.val)}
          </span>
        </div>
      ))}
      <div style={{ borderTop:`1px solid ${T.border}`, marginTop:"8px", paddingTop:"8px", display:"flex", justifyContent:"space-between" }}>
        <span style={{ fontSize:"12px", fontWeight:700, color:T.text }}>Savings Rate</span>
        <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"13px", fontWeight:800,
          color: d.rate >= 40 ? T.accent : d.rate >= 20 ? T.amber : T.red }}>
          {d.rate.toFixed(1)}%
        </span>
      </div>
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────

export default function SavingsRateChart({ incomeData, rsuData, expensesData }) {
  const data = useMemo(() => {
    const allFYs = [...new Set([
      ...Object.keys(incomeData   || {}),
      ...Object.keys(rsuData      || {}),
      ...Object.keys(expensesData || {}),
    ])].filter(k => k.startsWith("FY")).sort();

    return allFYs.map(fy => {
      const income   = computeFYIncome(fy, incomeData, rsuData);
      const expenses = computeFYExpenses(fy, expensesData);
      const savings  = income - expenses;
      const rate     = income > 0 ? (savings / income) * 100 : 0;
      return { fy, name: fy.replace("FY", ""), income, expenses, savings, rate };
    }).filter(d => d.income > 0 || d.expenses > 0);
  }, [incomeData, rsuData, expensesData]);

  if (!data.length) return (
    <div style={{ textAlign:"center", padding:"60px", color:T.textMuted, fontSize:"14px" }}>
      No data recorded yet.
    </div>
  );

  return (
    <div>
      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={data} margin={{ top:20, right:60, left:20, bottom:5 }} barCategoryGap="28%">
          <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false}/>
          <XAxis dataKey="name" tick={{ fill:T.textDim, fontSize:12, fontWeight:600 }}
            axisLine={{ stroke:T.border }} tickLine={false}/>
          <YAxis yAxisId="inr" tickFormatter={fmtL} tick={{ fill:T.textMuted, fontSize:11 }}
            axisLine={false} tickLine={false} width={60}/>
          <YAxis yAxisId="pct" orientation="right" tickFormatter={v=>`${v}%`}
            tick={{ fill:T.textMuted, fontSize:11 }} axisLine={false} tickLine={false} width={44}
            domain={[0, 100]}/>
          <Tooltip content={<CustomTooltip/>} cursor={{ fill:T.border, opacity:0.3 }}/>
          <Legend
            formatter={(value) => <span style={{ fontSize:"11px", fontWeight:600, color:T.textDim }}>{value}</span>}
            wrapperStyle={{ paddingTop:"8px" }}
          />
          <Bar yAxisId="inr" dataKey="income"   name="Total Income"   fill={T.accent} radius={[4,4,0,0]} opacity={0.85}/>
          <Bar yAxisId="inr" dataKey="expenses" name="Total Expenses" fill={T.amber}  radius={[4,4,0,0]} opacity={0.85}/>
          <Line yAxisId="pct" dataKey="rate" name="Savings Rate %" type="monotone"
            stroke={T.teal} strokeWidth={2.5} strokeDasharray="6 3"
            dot={{ fill:T.teal, r:4 }} activeDot={{ r:6, fill:T.accent }}/>
        </ComposedChart>
      </ResponsiveContainer>

      {/* Summary cards */}
      {data.length > 0 && (
        <div style={{ display:"flex", gap:"12px", flexWrap:"wrap", marginTop:"20px" }}>
          {data.map(d => (
            <div key={d.fy} style={{ padding:"10px 16px", background:T.card, borderRadius:"10px", border:`1px solid ${T.border}` }}>
              <div style={{ fontSize:"10px", color:T.textMuted, fontWeight:700, marginBottom:"4px" }}>{d.name}</div>
              <div style={{ fontSize:"18px", fontWeight:800, fontFamily:"'JetBrains Mono',monospace",
                color: d.rate >= 40 ? T.accent : d.rate >= 20 ? T.amber : T.red }}>
                {d.rate.toFixed(1)}%
              </div>
              <div style={{ fontSize:"11px", color:T.textMuted, marginTop:"2px" }}>
                saved {fmtINR(d.savings)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
