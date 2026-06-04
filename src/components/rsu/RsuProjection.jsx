import { useState, useMemo } from "react";
import { T } from "../../lib/theme";
import { generateVestSchedule, isConfirmed } from "../../lib/grantUtils";

const LAKH  = 100_000;
const CRORE = 10_000_000;

function fmtL(n) {
  if (!n || isNaN(n)) return "₹0";
  const abs = Math.abs(n);
  const s = n < 0 ? "−" : "";
  if (abs >= CRORE) return `${s}₹${(abs / CRORE).toFixed(2)} Cr`;
  if (abs >= LAKH)  return `${s}₹${(abs / LAKH).toFixed(2)} L`;
  return `${s}₹${Math.round(abs).toLocaleString("en-IN")}`;
}

const STOCK_COLORS = { MSFT: "#6366F1", NVDA: T.accent };
const STOCKS_ORDER = ["MSFT", "NVDA"];

const inpS = {
  padding: "7px 10px", background: T.bg, border: `1px solid ${T.border}`,
  borderRadius: "7px", color: T.text, fontSize: "12px", outline: "none",
  fontFamily: "'JetBrains Mono',monospace", width: "100%", boxSizing: "border-box",
};

function SliderRow({ label, value, min, max, step, fmt, onChange, sub }) {
  return (
    <div style={{ marginBottom: "12px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
        <span style={{ fontSize: "11px", color: T.textDim }}>{label}</span>
        <span style={{ fontSize: "12px", fontWeight: 700, color: T.accent, fontFamily: "'JetBrains Mono',monospace" }}>
          {fmt(value)}
        </span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: "100%", accentColor: T.accent }} />
      {sub && <div style={{ fontSize: "10px", color: T.textMuted, marginTop: "2px" }}>{sub}</div>}
    </div>
  );
}

// Indian FY helpers
// Apr 2025 – Mar 2026 → fyYear = 2025, label = "FY25-26"
function vestDateToFyYear(dateStr) {
  const d = new Date(dateStr);
  const m = d.getMonth() + 1; // 1-12
  const y = d.getFullYear();
  return m >= 4 ? y : y - 1;
}
function fyLabel(fyYear) {
  return `FY${String(fyYear).slice(2)}-${String(fyYear + 1).slice(2)}`;
}
function currentFyYear() {
  const now = new Date();
  const m = now.getMonth() + 1;
  return m >= 4 ? now.getFullYear() : now.getFullYear() - 1;
}

export default function RsuProjection({ rsuGrants, rsuData, liveData, personFilter }) {
  const thisFY = currentFyYear(); // e.g. 2025 for FY25-26

  // ── Assumptions ──────────────────────────────────────────────────────────────
  const [msftPrice,    setMsftPrice]    = useState(Math.round(liveData?.MSFT || 420));
  const [nvdaPrice,    setNvdaPrice]    = useState(Math.round(liveData?.NVDA || 950));
  const [usdInr,       setUsdInr]       = useState(Math.round(liveData?.USDINR || 84));
  const [msftGrowth,   setMsftGrowth]   = useState(10);   // % per year
  const [nvdaGrowth,   setNvdaGrowth]   = useState(15);   // % per year
  const [projYears,    setProjYears]    = useState(5);
  const [showTable,    setShowTable]    = useState(true);

  const startPrices = { MSFT: msftPrice, NVDA: nvdaPrice };
  const growthPcts  = { MSFT: msftGrowth / 100, NVDA: nvdaGrowth / 100 };

  // ── Compute FY-by-FY projection ───────────────────────────────────────────────
  const yearData = useMemo(() => {
    const emptySlot = () => ({ MSFT: { grossUnits:0, netUnits:0, valueINR:0 },
                               NVDA: { grossUnits:0, netUnits:0, valueINR:0 } });

    // Pre-populate all FY slots so empty years still show
    const map = {};
    for (let i = 0; i < projYears; i++) map[thisFY + i] = emptySlot();

    for (const grant of rsuGrants || []) {
      if (personFilter && personFilter !== "all" && grant.person !== personFilter) continue;

      const taxPct  = grant.tax_pct ?? 35;
      const netFact = 1 - taxPct / 100;
      const stock   = grant.stock;
      if (!STOCK_COLORS[stock]) continue;

      for (const v of generateVestSchedule(grant)) {
        const fyYear = vestDateToFyYear(v.vest_date);
        if (fyYear < thisFY || fyYear >= thisFY + projYears) continue;
        if (isConfirmed(v.vest_date, grant.person, stock, rsuData)) continue;

        const grossUnits = v.units;
        const netUnits   = Math.round(grossUnits * netFact);
        // Price grows from today — 1 FY out = 1 year of compounding
        const yearsOut   = fyYear - thisFY;
        const projPrice  = startPrices[stock] * Math.pow(1 + growthPcts[stock], yearsOut);
        const valueINR   = netUnits * projPrice * usdInr;

        if (!map[fyYear]) map[fyYear] = emptySlot();
        map[fyYear][stock].grossUnits += grossUnits;
        map[fyYear][stock].netUnits   += netUnits;
        map[fyYear][stock].valueINR   += valueINR;
      }
    }

    return Object.entries(map)
      .map(([fyYr, byStock]) => ({
        fyYear: Number(fyYr),
        label:  fyLabel(Number(fyYr)),          // "FY25-26"
        byStock,
        total: Object.values(byStock).reduce((s, v) => s + v.valueINR, 0),
      }))
      .sort((a, b) => a.fyYear - b.fyYear);
  }, [rsuGrants, rsuData, personFilter, msftPrice, nvdaPrice, usdInr, msftGrowth, nvdaGrowth, projYears, thisFY]);

  // ── SVG stacked bar chart ─────────────────────────────────────────────────────
  const W = 680, H = 240, PAD_L = 60, PAD_R = 20, PAD_T = 20, PAD_B = 40;
  const chartW = W - PAD_L - PAD_R;
  const chartH = H - PAD_T - PAD_B;
  const maxVal = Math.max(...yearData.map(d => d.total), 1);
  const barW   = yearData.length > 0 ? (chartW / yearData.length) * 0.7 : 40;
  const barGap = yearData.length > 0 ? chartW / yearData.length : 60;

  const barX = (i) => PAD_L + i * barGap + (barGap - barW) / 2;
  const barY = (val) => PAD_T + chartH - (val / maxVal) * chartH;
  const barH = (val) => (val / maxVal) * chartH;

  // Grid lines
  const gridVals = [0, 0.25, 0.5, 0.75, 1].map(p => p * maxVal);

  const [hovered, setHovered] = useState(null);

  const totalAllYears = yearData.reduce((s, d) => s + d.total, 0);

  return (
    <div>
      {/* ── Header strip ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start",
        flexWrap: "wrap", gap: "12px", marginBottom: "20px" }}>
        <div>
          <div style={{ fontSize: "14px", fontWeight: 800, color: T.text }}>RSU Projection</div>
          <div style={{ fontSize: "11px", color: T.textMuted, marginTop: "2px" }}>
            Future unconfirmed vests · post-tax · {projYears}-year horizon
            {personFilter && personFilter !== "all" && (
              <span style={{ marginLeft: "8px", color: personFilter === "Selva" ? T.selva : T.akshaya,
                fontWeight: 700 }}>· {personFilter} only</span>
            )}
            <span style={{ marginLeft: "8px", color: T.textMuted }}>· Apr–Mar Indian FY</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button onClick={() => setShowTable(v => !v)}
            style={{ padding: "6px 14px", borderRadius: "7px", fontSize: "12px", fontWeight: 600,
              cursor: "pointer", border: `1px solid ${T.border}`,
              background: showTable ? T.accentBg : "transparent",
              color: showTable ? T.accent : T.textDim }}>
            {showTable ? "Hide Table" : "Show Table"}
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: "10px", marginBottom: "20px" }}>
        {[
          { label: `Total ${projYears}-FY RSU Value`, value: fmtL(totalAllYears), color: T.accent, featured: true },
          ...STOCKS_ORDER.map(s => ({
            label: `${s} Total`,
            value: fmtL(yearData.reduce((sum, d) => sum + d.byStock[s].valueINR, 0)),
            color: STOCK_COLORS[s],
          })),
          { label: "Avg / FY", value: fmtL(totalAllYears / Math.max(projYears, 1)), color: T.textDim },
        ].map((c, i) => (
          <div key={i} style={{
            background: c.featured ? `linear-gradient(135deg,rgba(34,197,94,0.08),${T.card})` : T.card,
            border: `1px solid ${c.featured ? T.accent : T.border}`, borderRadius: "12px", padding: "14px 16px",
          }}>
            <div style={{ fontSize: "10px", color: T.textMuted, marginBottom: "4px" }}>{c.label}</div>
            <div style={{ fontSize: "16px", fontWeight: 800, color: c.color, fontFamily: "'JetBrains Mono',monospace" }}>{c.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: "20px", alignItems: "start" }}>

        {/* ── Chart ── */}
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: "12px", padding: "18px" }}>
          {/* Legend */}
          <div style={{ display: "flex", gap: "16px", marginBottom: "12px", flexWrap: "wrap" }}>
            {STOCKS_ORDER.map(s => (
              <div key={s} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: T.textDim }}>
                <span style={{ width: "10px", height: "10px", borderRadius: "3px", background: STOCK_COLORS[s], flexShrink: 0 }}/>
                {s}
              </div>
            ))}
            <div style={{ fontSize: "10px", color: T.textMuted, marginLeft: "auto", alignSelf: "center" }}>
              hover a bar for details
            </div>
          </div>

          <div style={{ position: "relative" }}>
            <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible" }}
              onMouseLeave={() => setHovered(null)}>

              {/* Grid lines */}
              {gridVals.map((v, gi) => {
                const y = barY(v);
                return (
                  <g key={gi}>
                    <line x1={PAD_L} x2={W - PAD_R} y1={y} y2={y} stroke={T.border} strokeDasharray="4,4" strokeWidth="0.5"/>
                    <text x={PAD_L - 6} y={y + 4} textAnchor="end" fontSize="8" fill={T.textMuted}>
                      {fmtL(v)}
                    </text>
                  </g>
                );
              })}

              {/* Bars */}
              {yearData.map((d, i) => {
                const x       = barX(i);
                const isHov   = hovered === i;
                let   yOff    = PAD_T + chartH;

                return (
                  <g key={d.fyYear}
                    onMouseEnter={() => setHovered(i)}
                    style={{ cursor: "pointer" }}>

                    {/* Hover bg */}
                    {isHov && (
                      <rect x={x - 4} y={PAD_T} width={barW + 8} height={chartH}
                        fill="white" opacity="0.04" rx="4"/>
                    )}

                    {/* Stacked segments: MSFT bottom, NVDA top */}
                    {STOCKS_ORDER.map(stock => {
                      const val = d.byStock[stock].valueINR;
                      if (!val) return null;
                      const h = barH(val);
                      yOff -= h;
                      return (
                        <rect key={stock} x={x} y={yOff} width={barW} height={h}
                          fill={STOCK_COLORS[stock]} opacity={isHov ? 1 : 0.8}
                          rx={stock === STOCKS_ORDER[STOCKS_ORDER.length - 1] ? 3 : 0}/>
                      );
                    })}

                    {/* FY label */}
                    <text x={x + barW / 2} y={PAD_T + chartH + 14} textAnchor="middle"
                      fontSize="9" fill={T.textDim} fontWeight={isHov ? "700" : "400"}>{d.label}</text>

                    {/* Total label on top */}
                    {d.total > 0 && (
                      <text x={x + barW / 2} y={barY(d.total) - 5} textAnchor="middle"
                        fontSize="8" fill={T.textMuted}>{fmtL(d.total)}</text>
                    )}
                  </g>
                );
              })}

              {/* Y axis */}
              <line x1={PAD_L} x2={PAD_L} y1={PAD_T} y2={PAD_T + chartH} stroke={T.border} strokeWidth="1"/>
            </svg>

            {/* Hover tooltip */}
            {hovered !== null && yearData[hovered] && (() => {
              const d = yearData[hovered];
              return (
                <div style={{
                  position: "absolute",
                  left: `${(barX(hovered) + barW / 2) / W * 100}%`,
                  top: "0", transform: "translateX(-50%)",
                  background: T.surface, border: `1px solid ${T.borderLight}`,
                  borderRadius: "10px", padding: "10px 14px", fontSize: "12px",
                  zIndex: 20, pointerEvents: "none", minWidth: "180px",
                  boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
                }}>
                  <div style={{ fontWeight: 800, color: T.accent, marginBottom: "8px" }}>{d.label}</div>
                  {STOCKS_ORDER.map(s => {
                    const sd = d.byStock[s];
                    if (!sd.grossUnits) return null;
                    return (
                      <div key={s} style={{ marginBottom: "6px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "5px", marginBottom: "2px" }}>
                          <span style={{ width: "8px", height: "8px", borderRadius: "2px", background: STOCK_COLORS[s] }}/>
                          <span style={{ color: STOCK_COLORS[s], fontWeight: 700 }}>{s}</span>
                        </div>
                        <div style={{ paddingLeft: "14px", fontSize: "11px", color: T.textDim, lineHeight: 1.6 }}>
                          <div>{sd.grossUnits} gross → {sd.netUnits} net shares</div>
                          <div style={{ color: T.text, fontWeight: 600 }}>{fmtL(sd.valueINR)}</div>
                        </div>
                      </div>
                    );
                  })}
                  <div style={{ borderTop: `1px solid ${T.border}`, marginTop: "6px", paddingTop: "6px",
                    display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: T.textMuted }}>Total</span>
                    <span style={{ fontWeight: 800, color: T.accent, fontFamily: "'JetBrains Mono',monospace" }}>
                      {fmtL(d.total)}
                    </span>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        {/* ── Assumptions panel ── */}
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: "12px", padding: "18px" }}>
          <div style={{ fontSize: "12px", fontWeight: 700, color: T.text, marginBottom: "14px" }}>Assumptions</div>

          <div style={{ fontSize: "11px", fontWeight: 700, color: T.textMuted, marginBottom: "8px", letterSpacing: "0.5px" }}>
            STARTING PRICES (USD)
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "14px" }}>
            {[{ label: "MSFT", val: msftPrice, set: setMsftPrice, col: STOCK_COLORS.MSFT },
              { label: "NVDA", val: nvdaPrice, set: setNvdaPrice, col: STOCK_COLORS.NVDA }].map(f => (
              <div key={f.label}>
                <div style={{ fontSize: "10px", color: f.col, fontWeight: 700, marginBottom: "3px" }}>{f.label}</div>
                <input type="number" style={inpS} value={f.val}
                  onChange={e => f.set(Number(e.target.value))}
                  placeholder={f.label === "MSFT" ? "420" : "950"}/>
              </div>
            ))}
          </div>

          <div style={{ marginBottom: "8px" }}>
            <div style={{ fontSize: "11px", fontWeight: 700, color: T.textMuted, marginBottom: "4px", letterSpacing: "0.5px" }}>
              USD / INR RATE
            </div>
            <input type="number" style={inpS} value={usdInr}
              onChange={e => setUsdInr(Number(e.target.value))} placeholder="84"/>
          </div>

          <div style={{ borderTop: `1px solid ${T.border}`, margin: "14px 0" }}/>

          <SliderRow label="MSFT Annual Growth" value={msftGrowth} min={0} max={40} step={1}
            fmt={v => `${v}%/yr`} onChange={setMsftGrowth}
            sub={`$${msftPrice} → $${Math.round(msftPrice * Math.pow(1 + msftGrowth / 100, projYears))} by ${fyLabel(thisFY + projYears - 1)}`}/>
          <SliderRow label="NVDA Annual Growth" value={nvdaGrowth} min={0} max={60} step={1}
            fmt={v => `${v}%/yr`} onChange={setNvdaGrowth}
            sub={`$${nvdaPrice} → $${Math.round(nvdaPrice * Math.pow(1 + nvdaGrowth / 100, projYears))} by ${fyLabel(thisFY + projYears - 1)}`}/>
          <SliderRow label="Projection Horizon" value={projYears} min={1} max={8} step={1}
            fmt={v => `${v} FY`} onChange={setProjYears}
            sub={`${fyLabel(thisFY)} → ${fyLabel(thisFY + projYears - 1)}`}/>

          <div style={{ borderTop: `1px solid ${T.border}`, margin: "14px 0" }}/>
          <div style={{ fontSize: "10px", color: T.textMuted, lineHeight: 1.6 }}>
            <div style={{ fontWeight: 700, color: T.textDim, marginBottom: "4px" }}>How projection works</div>
            <div>• Future vests fetched from Grant Schedule (unconfirmed only)</div>
            <div>• Tax withheld per grant (default 35%) applied to get net units</div>
            <div>• Price grows at set % each year from today's base price</div>
            <div>• Value = net units × projected price × USD/INR</div>
          </div>
        </div>
      </div>

      {/* ── Table ── */}
      {showTable && (
        <div style={{ marginTop: "20px", background: T.card, border: `1px solid ${T.border}`,
          borderRadius: "12px", overflow: "hidden" }}>
          <div style={{ padding: "14px 18px", borderBottom: `1px solid ${T.border}`,
            fontSize: "12px", fontWeight: 700, color: T.text }}>
            Year-by-Year Breakdown
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", minWidth: "700px" }}>
              <thead>
                <tr style={{ background: T.surface }}>
                  {["FY",
                    "MSFT Gross", "MSFT Net", `MSFT Price ($)`, "MSFT Value",
                    "NVDA Gross", "NVDA Net", `NVDA Price ($)`, "NVDA Value",
                    "Total"].map((h, i) => (
                    <th key={h} style={{ padding: "9px 14px", textAlign: i === 0 ? "left" : "right",
                      color: T.textMuted, fontSize: "10px", fontWeight: 700,
                      borderBottom: `1px solid ${T.border}`,
                      color: h.startsWith("MSFT") ? STOCK_COLORS.MSFT
                           : h.startsWith("NVDA") ? STOCK_COLORS.NVDA : T.textMuted }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {yearData.map((d, ri) => {
                  const yearsOut    = d.fyYear - thisFY;
                  const msftProjPx  = Math.round(msftPrice * Math.pow(1 + msftGrowth / 100, yearsOut));
                  const nvdaProjPx  = Math.round(nvdaPrice * Math.pow(1 + nvdaGrowth / 100, yearsOut));
                  const isHov       = hovered === ri;
                  return (
                    <tr key={d.fyYear}
                      onMouseEnter={() => setHovered(ri)}
                      onMouseLeave={() => setHovered(null)}
                      style={{ borderBottom: `1px solid ${T.border}22`,
                        background: isHov ? `${T.accent}08` : "transparent",
                        cursor: "default" }}>
                      <td style={{ padding: "9px 14px", fontWeight: 700, color: T.text }}>{d.label}</td>
                      {/* MSFT */}
                      <td style={{ padding: "9px 14px", textAlign: "right", color: T.textDim, fontFamily: "monospace" }}>
                        {d.byStock.MSFT.grossUnits || "—"}
                      </td>
                      <td style={{ padding: "9px 14px", textAlign: "right", color: STOCK_COLORS.MSFT, fontFamily: "monospace", fontWeight: 600 }}>
                        {d.byStock.MSFT.netUnits || "—"}
                      </td>
                      <td style={{ padding: "9px 14px", textAlign: "right", color: T.textDim, fontFamily: "monospace" }}>
                        ${msftProjPx.toLocaleString()}
                      </td>
                      <td style={{ padding: "9px 14px", textAlign: "right", color: STOCK_COLORS.MSFT, fontFamily: "monospace", fontWeight: 600 }}>
                        {fmtL(d.byStock.MSFT.valueINR)}
                      </td>
                      {/* NVDA */}
                      <td style={{ padding: "9px 14px", textAlign: "right", color: T.textDim, fontFamily: "monospace" }}>
                        {d.byStock.NVDA.grossUnits || "—"}
                      </td>
                      <td style={{ padding: "9px 14px", textAlign: "right", color: STOCK_COLORS.NVDA, fontFamily: "monospace", fontWeight: 600 }}>
                        {d.byStock.NVDA.netUnits || "—"}
                      </td>
                      <td style={{ padding: "9px 14px", textAlign: "right", color: T.textDim, fontFamily: "monospace" }}>
                        ${nvdaProjPx.toLocaleString()}
                      </td>
                      <td style={{ padding: "9px 14px", textAlign: "right", color: STOCK_COLORS.NVDA, fontFamily: "monospace", fontWeight: 600 }}>
                        {fmtL(d.byStock.NVDA.valueINR)}
                      </td>
                      {/* Total */}
                      <td style={{ padding: "9px 14px", textAlign: "right", color: T.accent,
                        fontFamily: "'JetBrains Mono',monospace", fontWeight: 800, fontSize: "13px" }}>
                        {fmtL(d.total)}
                      </td>
                    </tr>
                  );
                })}
                {/* Totals row */}
                <tr style={{ borderTop: `2px solid ${T.border}`, background: T.surface }}>
                  <td style={{ padding: "10px 14px", fontWeight: 800, color: T.text }}>Total</td>
                  {["MSFT","NVDA"].flatMap(s => [
                    <td key={`${s}-g`} style={{ padding:"10px 14px",textAlign:"right",color:T.textDim,fontFamily:"monospace",fontWeight:700 }}>
                      {yearData.reduce((sum,d)=>sum+d.byStock[s].grossUnits,0) || "—"}
                    </td>,
                    <td key={`${s}-n`} style={{ padding:"10px 14px",textAlign:"right",color:STOCK_COLORS[s],fontFamily:"monospace",fontWeight:800 }}>
                      {yearData.reduce((sum,d)=>sum+d.byStock[s].netUnits,0) || "—"}
                    </td>,
                    <td key={`${s}-p`} style={{ padding:"10px 14px" }}/>,
                    <td key={`${s}-v`} style={{ padding:"10px 14px",textAlign:"right",color:STOCK_COLORS[s],fontFamily:"'JetBrains Mono',monospace",fontWeight:800 }}>
                      {fmtL(yearData.reduce((sum,d)=>sum+d.byStock[s].valueINR,0))}
                    </td>,
                  ])}
                  <td style={{ padding:"10px 14px",textAlign:"right",color:T.accent,fontFamily:"'JetBrains Mono',monospace",fontWeight:800,fontSize:"14px" }}>
                    {fmtL(totalAllYears)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
