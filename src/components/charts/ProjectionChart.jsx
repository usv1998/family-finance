import { useState, useMemo } from "react";
import {
  ResponsiveContainer, ComposedChart, Bar, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Cell, Legend,
} from "recharts";
import { T } from "../../lib/theme";
import { fmtINR, getEsspINR, getCurrentFY } from "../../lib/formatters";
import { PERSONS } from "../../lib/constants";
import { generateVestSchedule } from "../../lib/grantUtils";

// ── helpers ───────────────────────────────────────────────────────────────────

const SEGMENTS = [
  { key:"salary", label:"Take-Home Salary", color:T.selva  },
  { key:"rsu",    label:"RSU (Projected)",  color:T.purple },
  { key:"espp",   label:"ESPP",             color:T.teal   },
  { key:"epf",    label:"EPF",              color:T.accent },
  { key:"car",    label:"Car Lease",        color:"#6366F1"},
];

// Annualized baseline for a person from their latest FY with data
function getBaseline(person, incomeData) {
  const fys = Object.keys(incomeData || {}).filter(k => k.startsWith("FY")).sort();
  for (let i = fys.length - 1; i >= 0; i--) {
    let salary = 0, epf = 0, espp = 0, car = 0, count = 0;
    for (let mi = 0; mi < 12; mi++) {
      const d = incomeData[fys[i]]?.[person]?.[mi] || {};
      if (d.take_home) {
        salary += Number(d.take_home || 0);
        epf    += Number(d.epf      || 0);
        espp   += getEsspINR(d);
        car    += person === "Selva" ? Number(d.car_lease || 0) : 0;
        count++;
      }
    }
    if (count > 0) {
      const f = 12 / count;
      return { salary: salary * f, epf: epf * f, espp: espp * f, car: car * f, baseFY: fys[i] };
    }
  }
  return { salary: 0, epf: 0, espp: 0, car: 0, baseFY: null };
}

// Sum RSU projected vests for a FY window from grant schedules
function projectedRSU(targetFY, grants, liveData) {
  const m = targetFY.match(/FY(\d{4})-\d{2}/);
  if (!m) return 0;
  const yr    = parseInt(m[1]);
  const start = new Date(`${yr}-04-01`).getTime();
  const end   = new Date(`${yr + 1}-03-31T23:59:59`).getTime();
  const now   = Date.now();
  let total = 0;
  for (const g of grants) {
    const price  = liveData?.[g.stock] || 0;
    const usdinr = liveData?.USDINR    || 85;
    if (!price) continue;
    for (const v of generateVestSchedule(g)) {
      const t = new Date(v.vest_date).getTime();
      if (t >= start && t <= end && t > now) {
        total += v.units * price * usdinr;
      }
    }
  }
  return total;
}

// Build list of FY strings following baseFY
function futureFYs(baseFY, count) {
  const m = (baseFY || "FY2025-26").match(/FY(\d{4})-\d{2}/);
  const yr = m ? parseInt(m[1]) : 2025;
  return Array.from({ length: count }, (_, i) => {
    const y = yr + i + 1;
    return `FY${y}-${(y + 1).toString().slice(2)}`;
  });
}

// Compute actual FY data — uses same sources as SummaryCards
function computeActual(fy, incomeData) {
  let salary = 0, rsu = 0, espp = 0, epf = 0, car = 0;
  for (const p of PERSONS) {
    for (let mi = 0; mi < 12; mi++) {
      const d = incomeData?.[fy]?.[p]?.[mi] || {};
      salary += Number(d.take_home || 0);
      espp   += getEsspINR(d);
      epf    += Number(d.epf || 0);
      car    += p === "Selva" ? Number(d.car_lease || 0) : 0;
      rsu    += (Number(d.rsu_net_shares)||0) * (Number(d.rsu_price_usd)||0) * (Number(d.rsu_usd_inr)||0);
    }
  }
  return { salary, rsu, espp, epf, car };
}

function fmtL(n) {
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(1)}Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(1)}L`;
  return `₹${Math.round(n / 1000)}K`;
}

// ── tooltip ───────────────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div style={{ background:T.card, border:`1px solid ${d.projected?T.purple:T.border}`, borderRadius:"10px", padding:"14px 16px", minWidth:"220px" }}>
      <div style={{ fontSize:"13px", fontWeight:700, color:T.text, marginBottom:"4px" }}>{label}</div>
      {d.projected && (
        <div style={{ fontSize:"10px", color:T.purple, fontWeight:700, marginBottom:"8px", letterSpacing:"0.5px" }}>PROJECTED</div>
      )}
      {SEGMENTS.map(seg => d[seg.key] > 0 && (
        <div key={seg.key} style={{ display:"flex", justifyContent:"space-between", gap:"16px", marginBottom:"5px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:"7px" }}>
            <div style={{ width:"8px", height:"8px", borderRadius:"50%", background:seg.color, flexShrink:0 }}/>
            <span style={{ fontSize:"12px", color:T.textDim }}>{seg.label}</span>
          </div>
          <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"12px", color:seg.color, fontWeight:700 }}>
            {fmtINR(d[seg.key])}
          </span>
        </div>
      ))}
      <div style={{ borderTop:`1px solid ${T.border}`, marginTop:"8px", paddingTop:"8px", display:"flex", justifyContent:"space-between" }}>
        <span style={{ fontSize:"12px", fontWeight:700, color:T.text }}>Total</span>
        <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"13px", fontWeight:800, color:d.projected?T.purple:T.accent }}>
          {fmtINR(d.total)}
        </span>
      </div>
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────

export default function ProjectionChart({ incomeData, rsuData, rsuGrants, liveData }) {
  const [selvaGrowth,   setSelvaGrowth]   = useState(10);
  const [akshayaGrowth, setAkshayaGrowth] = useState(10);
  const [years,         setYears]         = useState(3);
  const [includeRsu,    setIncludeRsu]    = useState(true);

  const data = useMemo(() => {
    // ── Actuals ──
    const currFY = getCurrentFY();
    const actualFYs = [...new Set([
      ...Object.keys(incomeData || {}),
      ...Object.keys(rsuData    || {}),
    ])].filter(k => k.startsWith("FY") && k >= currFY).sort();

    const actuals = actualFYs.map(fy => {
      const c = computeActual(fy, incomeData);
      const total = c.salary + c.rsu + c.espp + c.epf + c.car;
      return { fy, name: fy.replace("FY",""), ...c, total, projected: false };
    }).filter(d => d.total > 0);

    if (!actuals.length) return [];

    // ── Baselines (per person, annualised) ──
    const growthMap = { Selva: selvaGrowth / 100, Akshaya: akshayaGrowth / 100 };
    const baselines = Object.fromEntries(
      PERSONS.map(p => [p, getBaseline(p, incomeData)])
    );
    const latestFY = actuals[actuals.length - 1].fy;
    const projFYs  = futureFYs(latestFY, years);

    const projections = projFYs.map((fy, i) => {
      const n = i + 1;
      let salary = 0, epf = 0, espp = 0, car = 0;
      for (const p of PERSONS) {
        const b = baselines[p];
        const g = growthMap[p];
        salary += b.salary * Math.pow(1 + g, n);
        epf    += b.epf    * Math.pow(1 + g, n);
        espp   += b.espp;  // flat assumption
        car    += b.car;   // flat assumption
      }
      const rsu   = includeRsu ? projectedRSU(fy, rsuGrants || [], liveData || {}) : 0;
      const total = salary + rsu + espp + epf + car;
      return { fy, name: fy.replace("FY","") + " ▸", salary, rsu, espp, epf, car, total, projected: true };
    });

    return [...actuals, ...projections];
  }, [incomeData, rsuData, rsuGrants, liveData, selvaGrowth, akshayaGrowth, years, includeRsu]);

  if (!data.length) return (
    <div style={{ textAlign:"center", padding:"60px", color:T.textMuted, fontSize:"14px" }}>
      No income data recorded yet.
    </div>
  );

  const inp = { width:"64px", padding:"5px 8px", background:T.card, border:`1px solid ${T.border}`,
    borderRadius:"7px", color:T.text, fontSize:"13px", fontWeight:700, textAlign:"center",
    outline:"none", fontFamily:"'JetBrains Mono',monospace" };

  return (
    <div>
      {/* Controls */}
      <div style={{ display:"flex", gap:"20px", flexWrap:"wrap", alignItems:"center",
        padding:"14px 18px", background:T.card, borderRadius:"10px", marginBottom:"20px", border:`1px solid ${T.border}` }}>
        <span style={{ fontSize:"11px", color:T.textMuted, fontWeight:700, letterSpacing:"0.5px" }}>ASSUMPTIONS</span>
        <label style={{ display:"flex", alignItems:"center", gap:"8px", fontSize:"12px", color:T.textDim }}>
          <span style={{ color:T.selva, fontWeight:700 }}>Selva</span> YoY
          <input type="number" min={0} max={50} value={selvaGrowth}
            onChange={e=>setSelvaGrowth(Math.max(0,Math.min(50,Number(e.target.value))))}
            style={inp}/>
          <span>%</span>
        </label>
        <label style={{ display:"flex", alignItems:"center", gap:"8px", fontSize:"12px", color:T.textDim }}>
          <span style={{ color:T.akshaya, fontWeight:700 }}>Akshaya</span> YoY
          <input type="number" min={0} max={50} value={akshayaGrowth}
            onChange={e=>setAkshayaGrowth(Math.max(0,Math.min(50,Number(e.target.value))))}
            style={inp}/>
          <span>%</span>
        </label>
        <label style={{ display:"flex", alignItems:"center", gap:"8px", fontSize:"12px", color:T.textDim }}>
          Years ahead
          <select value={years} onChange={e=>setYears(Number(e.target.value))}
            style={{ ...inp, width:"52px", cursor:"pointer" }}>
            {[1,2,3,4,5].map(n=><option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <label style={{ display:"flex", alignItems:"center", gap:"7px", fontSize:"12px", color:T.textDim, cursor:"pointer" }}>
          <input type="checkbox" checked={includeRsu} onChange={e=>setIncludeRsu(e.target.checked)}
            style={{ width:"14px", height:"14px", accentColor:T.purple }}/>
          RSU from grant schedules
          {includeRsu && !liveData?.MSFT && (
            <span style={{ fontSize:"10px", color:T.amber }}>(needs live prices)</span>
          )}
        </label>
      </div>

      <ResponsiveContainer width="100%" height={340}>
        <ComposedChart data={data} margin={{ top:20, right:20, left:20, bottom:5 }} barCategoryGap="28%">
          <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false}/>
          <XAxis dataKey="name" tick={{ fill:T.textDim, fontSize:12, fontWeight:600 }}
            axisLine={{ stroke:T.border }} tickLine={false}/>
          <YAxis tickFormatter={fmtL} tick={{ fill:T.textMuted, fontSize:11 }}
            axisLine={false} tickLine={false} width={60}/>
          <Tooltip content={<CustomTooltip/>} cursor={{ fill:T.border, opacity:0.3 }}/>

          {SEGMENTS.map((seg, si) => (
            <Bar key={seg.key} dataKey={seg.key} name={seg.label} stackId="income"
              fill={seg.color} radius={si === SEGMENTS.length - 1 ? [4,4,0,0] : [0,0,0,0]}>
              {data.map((entry, idx) => (
                <Cell key={idx} fill={seg.color} opacity={entry.projected ? 0.45 : 1}
                  strokeDasharray={entry.projected ? "4 2" : undefined}/>
              ))}
            </Bar>
          ))}

          {data.filter(d=>!d.projected).length > 1 && (
            <Line dataKey="total" name="Total (actual)" type="monotone"
              stroke={T.text} strokeWidth={2} strokeDasharray="6 3"
              dot={({ cx, cy, payload }) => payload.projected
                ? <circle key={cx} cx={cx} cy={cy} r={4} fill={T.purple} stroke={T.purple} strokeDasharray="3 2" opacity={0.5}/>
                : <circle key={cx} cx={cx} cy={cy} r={4} fill={T.text}/>}
              activeDot={{ r:6, fill:T.accent }}/>
          )}
        </ComposedChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div style={{ display:"flex", flexWrap:"wrap", gap:"8px", justifyContent:"center", marginTop:"8px" }}>
        {SEGMENTS.map(seg => (
          <div key={seg.key} style={{ display:"flex", alignItems:"center", gap:"6px", padding:"4px 12px",
            borderRadius:"20px", border:`1px solid ${seg.color}`, background:`${seg.color}18`,
            color:seg.color, fontSize:"11px", fontWeight:600 }}>
            <div style={{ width:"8px", height:"8px", borderRadius:"50%", background:seg.color, flexShrink:0 }}/>
            {seg.label}
          </div>
        ))}
        <div style={{ display:"flex", alignItems:"center", gap:"6px", padding:"4px 12px",
          borderRadius:"20px", border:`1px solid ${T.border}`, background:`${T.purple}18`,
          color:T.purple, fontSize:"11px", fontWeight:600 }}>
          <div style={{ width:"8px", height:"8px", borderRadius:"50%", background:T.purple, opacity:0.5, flexShrink:0 }}/>
          Projected (▸)
        </div>
      </div>

      {/* Projection summary cards */}
      {data.filter(d => d.projected).length > 0 && (
        <div style={{ display:"flex", gap:"12px", flexWrap:"wrap", marginTop:"20px" }}>
          {data.filter(d => d.projected).map(d => {
            const actual = data.find(a => !a.projected);
            const base   = actual ? actual.total : 0;
            const growth = base > 0 ? (d.total - base) / base * 100 : 0;
            return (
              <div key={d.fy} style={{ padding:"10px 16px", background:T.card, borderRadius:"10px",
                border:`1px solid ${T.purple}55` }}>
                <div style={{ fontSize:"10px", color:T.purple, fontWeight:700, marginBottom:"4px" }}>
                  {d.fy.replace("FY","")} ▸ projected
                </div>
                <div style={{ fontSize:"18px", fontWeight:800, fontFamily:"'JetBrains Mono',monospace", color:T.purple }}>
                  {fmtINR(d.total)}
                </div>
                <div style={{ fontSize:"11px", color:T.textMuted, marginTop:"2px" }}>
                  +{growth.toFixed(0)}% vs first actual
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
