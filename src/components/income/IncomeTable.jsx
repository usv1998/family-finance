import { T } from "../../lib/theme";
import { fmtINR, getEsspINR } from "../../lib/formatters";
import { MONTHS, MONTH_FULL, PERSONS } from "../../lib/constants";

export default function IncomeTable({ incomeData, rsuData, fy, viewMode, highlightMonth, onSelectMonth }) {
  const persons   = viewMode === "combined" ? PERSONS : [viewMode];
  const getMD     = (p, mi) => incomeData?.[fy]?.[p]?.[mi] || {};
  const getRSUINR = (p, mi) => {
    const d = incomeData?.[fy]?.[p]?.[mi] || {};
    return (Number(d.rsu_net_shares)||0) * (Number(d.rsu_price_usd)||0) * (Number(d.rsu_usd_inr)||0);
  };

  const getMonthTotal = (mi) => persons.reduce((s, p) => {
    const d = getMD(p, mi);
    return s
      + (Number(d.take_home)||0)
      + (Number(d.epf)||0)
      + getEsspINR(d)
      + (p==="Selva" ? Number(d.car_lease)||0 : 0)
      + getRSUINR(p, mi)
      + (d.ad_hoc||[]).reduce((a,i)=>a+(Number(i.amount)||0),0);
  }, 0);

  const fyTotal = MONTHS.reduce((s,_,mi) => s + getMonthTotal(mi), 0);

  // Per-component FY totals (for the summary row)
  const compTotal = (key) => persons.reduce((s,p) =>
    s + MONTHS.reduce((ss,_,mi)=>{
      const d = getMD(p,mi);
      if (key==="rsu")    return ss + getRSUINR(p,mi);
      if (key==="espp")   return ss + getEsspINR(d);
      if (key==="ad_hoc") return ss + (d.ad_hoc||[]).reduce((a,i)=>a+(Number(i.amount)||0),0);
      return ss + (Number(d[key])||0);
    }, 0)
  , 0);

  return (
    <div>
      {/* FY total banner */}
      <div style={{ background:T.accentBg, border:`1px solid ${T.accent}44`,
        borderRadius:"12px", padding:"14px 18px", marginBottom:"14px",
        display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <span style={{ fontSize:"13px", fontWeight:700, color:T.textDim }}>FY Total</span>
        <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"20px",
          fontWeight:800, color:T.accent }}>{fmtINR(fyTotal)}</span>
      </div>

      {/* Month cards */}
      <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
        {MONTHS.map((m, mi) => {
          const d0      = getMD(persons[0], mi);
          const total   = getMonthTotal(mi);
          const isCurr  = mi === highlightMonth;
          const hasData = total > 0;

          // Breakdown lines to show inside expanded card
          const lines = [];
          persons.forEach(p => {
            const d = getMD(p, mi);
            if (Number(d.take_home))   lines.push({ label: viewMode==="combined" ? `${p} Take-Home` : "Take-Home", value: fmtINR(Number(d.take_home)), color: T.text });
            if (Number(d.epf))         lines.push({ label: viewMode==="combined" ? `${p} EPF` : "EPF",             value: fmtINR(Number(d.epf)),       color: T.blue });
            const espp = getEsspINR(d);
            if (espp)                  lines.push({ label: viewMode==="combined" ? `${p} ESPP` : "ESPP",           value: fmtINR(espp),                 color: T.teal });
            const rsu = getRSUINR(p, mi);
            if (rsu)                   lines.push({ label: viewMode==="combined" ? `${p} RSU` : "RSU",             value: fmtINR(rsu),                  color: T.purple });
            if (p==="Selva" && Number(d.car_lease)) lines.push({ label:"Car Lease", value:fmtINR(Number(d.car_lease)), color:T.amber });
            (d.ad_hoc||[]).forEach(i => {
              if (Number(i.amount)) lines.push({ label: i.note||"Ad-hoc", value: fmtINR(Number(i.amount)), color: T.amber });
            });
          });

          return (
            <div key={m}
              onClick={() => onSelectMonth?.(mi)}
              style={{
                background: isCurr ? T.accentBg : T.surface,
                borderRadius:"12px",
                border:`1px solid ${isCurr ? T.accent+"66" : T.border}`,
                padding:"14px 16px",
                cursor: onSelectMonth ? "pointer" : "default",
              }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                  <span style={{ fontSize:"14px", fontWeight:700,
                    color: isCurr ? T.accent : T.text }}>{MONTH_FULL[mi]}</span>
                  {isCurr && (
                    <span style={{ fontSize:"9px", fontWeight:700, color:T.accent,
                      background:`${T.accent}22`, padding:"2px 6px", borderRadius:"4px",
                      letterSpacing:"0.5px" }}>NOW</span>
                  )}
                </div>
                <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"15px",
                  fontWeight:800, color: hasData ? (isCurr ? T.accent : T.text) : T.textMuted }}>
                  {hasData ? fmtINR(total) : "—"}
                </span>
              </div>
              {lines.length > 0 && (
                <div style={{ marginTop:"10px", display:"flex", flexDirection:"column", gap:"5px" }}>
                  {lines.map((l, i) => (
                    <div key={i} style={{ display:"flex", justifyContent:"space-between",
                      fontSize:"12px", color:T.textMuted }}>
                      <span>{l.label}</span>
                      <span style={{ fontFamily:"'JetBrains Mono',monospace",
                        color:l.color, fontWeight:600 }}>{l.value}</span>
                    </div>
                  ))}
                </div>
              )}
              {!hasData && (
                <div style={{ marginTop:"6px", fontSize:"11px", color:T.textMuted }}>
                  Tap to enter income
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
