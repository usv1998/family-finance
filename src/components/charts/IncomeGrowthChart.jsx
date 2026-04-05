import { useState } from "react";
import { T } from "../../lib/theme";
import { fmtINR } from "../../lib/formatters";
import { MONTHS, PERSONS } from "../../lib/constants";

// ── data helpers ────────────────────────────────────────��────────────────────

const SEGMENTS = [
  { key:"salary", label:"Take-Home Salary", color:T.selva    },
  { key:"rsu",    label:"RSU (Net INR)",    color:T.purple   },
  { key:"espp",   label:"ESPP",             color:T.teal     },
  { key:"epf",    label:"EPF",              color:T.accent   },
  { key:"bonus",  label:"Bonus / Ad-hoc",   color:T.amber    },
];

function computeFYData(fy, incomeData, rsuData) {
  let salary = 0, rsu = 0, espp = 0, epf = 0, bonus = 0;
  for (const p of PERSONS) {
    for (let mi = 0; mi < 12; mi++) {
      const d = incomeData?.[fy]?.[p]?.[mi] || {};
      salary += Number(d.take_home || 0);
      espp   += Number(d.espp      || 0);
      epf    += Number(d.epf       || 0);
      bonus  += (d.ad_hoc || []).reduce((s, i) => s + Number(i.amount || 0), 0);
    }
    for (const e of (rsuData?.[fy] || []).filter(e => e.person === p)) {
      rsu += (e.units_vested - (e.tax_withheld_units || 0)) * e.stock_price_usd * e.usd_inr_rate;
    }
  }
  return { fy, salary, rsu, espp, epf, bonus, total: salary + rsu + espp + epf + bonus };
}

function fmtL(n) {
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(1)}Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(1)}L`;
  return fmtINR(n);
}

// ── chart component ───────────────────────────��───────────────────────────────

const W = 720, H = 300, PAD_L = 72, PAD_B = 40, PAD_T = 20, PAD_R = 20;
const CHART_W = W - PAD_L - PAD_R;
const CHART_H = H - PAD_T - PAD_B;

export default function IncomeGrowthChart({ incomeData, rsuData, viewMode }) {
  const [tooltip, setTooltip] = useState(null); // { x, y, data }
  const [filterSeg, setFilterSeg] = useState(null); // null = all

  // Build data for all available FYs
  const allFYs = [...new Set([
    ...Object.keys(incomeData || {}),
    ...Object.keys(rsuData   || {}),
  ])].filter(k => k.startsWith("FY")).sort();

  const data = allFYs.map(fy => computeFYData(fy, incomeData, rsuData));

  if (data.length === 0) return (
    <div style={{ textAlign:"center", padding:"60px", color:T.textMuted, fontSize:"14px" }}>
      No income data recorded yet.
    </div>
  );

  const visSegs = filterSeg ? SEGMENTS.filter(s => s.key === filterSeg) : SEGMENTS;
  const maxVal  = Math.max(...data.map(d => visSegs.reduce((s, seg) => s + d[seg.key], 0)));
  const yMax    = maxVal * 1.12 || 1;

  const barW   = Math.min(72, (CHART_W / data.length) * 0.55);
  const gap    = CHART_W / data.length;
  const barX   = (i) => PAD_L + i * gap + (gap - barW) / 2;
  const toY    = (v) => PAD_T + CHART_H - (v / yMax) * CHART_H;

  // Y axis ticks
  const ticks = 5;
  const yTicks = Array.from({ length: ticks + 1 }, (_, i) => (yMax / ticks) * i);

  return (
    <div>
      {/* Legend + filter */}
      <div style={{ display:"flex", flexWrap:"wrap", gap:"10px", marginBottom:"16px", alignItems:"center" }}>
        <span style={{ fontSize:"11px", color:T.textMuted, fontWeight:700 }}>FILTER:</span>
        <button onClick={()=>setFilterSeg(null)}
          style={{ padding:"4px 12px", borderRadius:"20px", border:`1px solid ${filterSeg===null?T.accent:T.border}`, background:filterSeg===null?T.accentBg:"transparent", color:filterSeg===null?T.accent:T.textDim, fontSize:"11px", fontWeight:600, cursor:"pointer" }}>
          All
        </button>
        {SEGMENTS.map(seg=>(
          <button key={seg.key} onClick={()=>setFilterSeg(filterSeg===seg.key?null:seg.key)}
            style={{ display:"flex", alignItems:"center", gap:"6px", padding:"4px 12px", borderRadius:"20px", border:`1px solid ${filterSeg===seg.key?seg.color:T.border}`, background:filterSeg===seg.key?seg.color+"22":"transparent", color:filterSeg===seg.key?seg.color:T.textDim, fontSize:"11px", fontWeight:600, cursor:"pointer" }}>
            <span style={{ width:"8px", height:"8px", borderRadius:"50%", background:seg.color, flexShrink:0 }}/>
            {seg.label}
          </button>
        ))}
      </div>

      {/* SVG chart */}
      <div style={{ position:"relative", overflowX:"auto" }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width:"100%", maxWidth:W, display:"block", overflow:"visible" }}>
          {/* Y grid + labels */}
          {yTicks.map((v, i) => {
            const y = toY(v);
            return (
              <g key={i}>
                <line x1={PAD_L} y1={y} x2={W - PAD_R} y2={y}
                  stroke={T.border} strokeWidth="0.5" strokeDasharray={i>0?"4,3":"none"}/>
                <text x={PAD_L - 6} y={y + 4} textAnchor="end" fontSize="10" fill={T.textMuted}>{fmtL(v)}</text>
              </g>
            );
          })}

          {/* X axis */}
          <line x1={PAD_L} y1={PAD_T + CHART_H} x2={W - PAD_R} y2={PAD_T + CHART_H} stroke={T.border} strokeWidth="1"/>

          {/* Bars */}
          {data.map((d, i) => {
            let cumY = PAD_T + CHART_H;
            const bx  = barX(i);
            const cx  = PAD_L + i * gap + gap / 2;

            return (
              <g key={d.fy}
                onMouseEnter={e => setTooltip({ i, d, cx, cy: toY(visSegs.reduce((s,seg)=>s+d[seg.key],0)) })}
                onMouseLeave={() => setTooltip(null)}
                style={{ cursor:"pointer" }}>
                {visSegs.map(seg => {
                  const val = d[seg.key];
                  const h   = (val / yMax) * CHART_H;
                  const y   = cumY - h;
                  cumY = y;
                  return (
                    <rect key={seg.key} x={bx} y={y} width={barW} height={Math.max(0, h)}
                      fill={seg.color} opacity={tooltip && tooltip.i !== i ? 0.45 : 0.9}
                      rx={seg.key === (visSegs[visSegs.length - 1]?.key) ? "3" : "0"}/>
                  );
                })}
                {/* Total label above bar */}
                {(!tooltip || tooltip.i === i) && (
                  <text x={bx + barW/2} y={toY(visSegs.reduce((s,seg)=>s+d[seg.key],0)) - 5}
                    textAnchor="middle" fontSize="10" fill={T.textDim} fontWeight="600">
                    {fmtL(visSegs.reduce((s,seg)=>s+d[seg.key],0))}
                  </text>
                )}
                {/* X label */}
                <text x={cx} y={PAD_T + CHART_H + 16} textAnchor="middle" fontSize="11" fill={T.textDim} fontWeight="600">
                  {d.fy.replace("FY","")}
                </text>
              </g>
            );
          })}

          {/* Total line */}
          {data.length > 1 && !filterSeg && (
            <polyline
              points={data.map((d, i) => `${barX(i) + barW/2},${toY(d.total)}`).join(" ")}
              fill="none" stroke={T.text} strokeWidth="1.5" strokeDasharray="5,3" opacity="0.4"/>
          )}
        </svg>

        {/* Hover tooltip */}
        {tooltip && (
          <div style={{
            position:"absolute",
            top: Math.max(0, (tooltip.cy / H) * 100) + "%",
            left: tooltip.i < data.length / 2 ? (barX(tooltip.i) + barW + 8) / W * 100 + "%" : "auto",
            right: tooltip.i >= data.length / 2 ? (W - barX(tooltip.i) + 8) / W * 100 + "%" : "auto",
            transform:"translateY(-50%)",
            background:T.card, border:`1px solid ${T.border}`, borderRadius:"10px",
            padding:"12px 14px", minWidth:"200px", pointerEvents:"none", zIndex:10,
          }}>
            <div style={{ fontSize:"12px", fontWeight:700, color:T.text, marginBottom:"8px" }}>{tooltip.d.fy}</div>
            {SEGMENTS.map(seg => (
              tooltip.d[seg.key] > 0 && (
                <div key={seg.key} style={{ display:"flex", justifyContent:"space-between", gap:"16px", marginBottom:"4px" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:"6px" }}>
                    <div style={{ width:"8px", height:"8px", borderRadius:"50%", background:seg.color, flexShrink:0 }}/>
                    <span style={{ fontSize:"11px", color:T.textDim }}>{seg.label}</span>
                  </div>
                  <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"11px", color:seg.color, fontWeight:700 }}>{fmtINR(tooltip.d[seg.key])}</span>
                </div>
              )
            ))}
            <div style={{ borderTop:`1px solid ${T.border}`, marginTop:"6px", paddingTop:"6px", display:"flex", justifyContent:"space-between" }}>
              <span style={{ fontSize:"11px", fontWeight:700, color:T.text }}>Total</span>
              <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"12px", fontWeight:800, color:T.accent }}>{fmtINR(tooltip.d.total)}</span>
            </div>
          </div>
        )}
      </div>

      {/* YoY growth row */}
      {data.length > 1 && (
        <div style={{ display:"flex", gap:"12px", flexWrap:"wrap", marginTop:"16px" }}>
          {data.slice(1).map((d, i) => {
            const prev   = data[i].total;
            const growth = prev > 0 ? ((d.total - prev) / prev * 100) : 0;
            const up     = growth >= 0;
            return (
              <div key={d.fy} style={{ padding:"8px 14px", background:T.card, borderRadius:"8px", border:`1px solid ${T.border}` }}>
                <div style={{ fontSize:"10px", color:T.textMuted, fontWeight:700 }}>{data[i].fy.replace("FY","")} → {d.fy.replace("FY","")}</div>
                <div style={{ fontSize:"16px", fontWeight:800, color:up?T.accent:T.red, fontFamily:"'JetBrains Mono',monospace" }}>
                  {up?"+":""}{growth.toFixed(1)}%
                </div>
                <div style={{ fontSize:"10px", color:T.textMuted, marginTop:"2px" }}>{fmtINR(d.total - prev)} absolute</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
