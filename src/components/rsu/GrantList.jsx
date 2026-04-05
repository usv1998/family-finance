import { useState, useMemo } from "react";
import { T } from "../../lib/theme";
import { fmtINR, fmtUSD } from "../../lib/formatters";
import { generateVestSchedule, isConfirmed, getConfirmedEvent } from "../../lib/grantUtils";

export default function GrantList({ grants, rsuData, liveData, onDelete }) {
  const [expanded, setExpanded] = useState({});
  const toggle = (id) => setExpanded(e => ({ ...e, [id]: !e[id] }));

  const schedules = useMemo(
    () => Object.fromEntries(grants.map(g => [g.id, generateVestSchedule(g)])),
    [grants]
  );

  if (!grants.length) return (
    <div style={{ textAlign:"center", padding:"40px", color:T.textMuted, fontSize:"14px" }}>
      No grants added yet. Add a grant above to generate a projected vest schedule.
    </div>
  );

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"14px" }}>
      {grants.map(grant => {
        const schedule   = schedules[grant.id] || [];
        const confirmed  = schedule.filter(v => isConfirmed(v.vest_date, grant.person, grant.stock, rsuData)).length;
        const total      = schedule.length;
        const remaining  = total - confirmed;
        const personCol  = grant.person === "Selva" ? T.selva : T.akshaya;
        const stockCol   = grant.stock === "MSFT" ? T.blue : T.akshaya;
        const livePrice  = liveData[grant.stock] || 0;
        const usdInr     = liveData.USDINR || 85;
        const unvested   = schedule.filter(v => !isConfirmed(v.vest_date, grant.person, grant.stock, rsuData))
                                   .reduce((s,v)=>s+v.units,0);
        const projVal    = unvested * livePrice * usdInr;

        return (
          <div key={grant.id} style={{ background:T.surface, borderRadius:"12px", border:`1px solid ${T.border}`, overflow:"hidden" }}>
            {/* Header */}
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"14px 20px" }}>
              <div style={{ display:"flex", alignItems:"center", gap:"16px", flexWrap:"wrap" }}>
                <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                  <div style={{ width:"8px", height:"8px", borderRadius:"50%", background:personCol }}/>
                  <span style={{ fontSize:"13px", fontWeight:700, color:personCol }}>{grant.person}</span>
                  <span style={{ fontSize:"13px", fontWeight:800, color:stockCol, fontFamily:"'JetBrains Mono',monospace" }}>{grant.stock}</span>
                </div>
                <span style={{ fontSize:"12px", color:T.textDim, fontWeight:600 }}>{grant.grant_id}</span>
                <span style={{ fontSize:"11px", color:T.textMuted }}>
                  Granted {new Date(grant.grant_date).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"})}
                </span>
                <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                  <span style={{ fontSize:"11px", color:T.textMuted }}>
                    <span style={{ color:T.accent, fontWeight:700 }}>{confirmed}</span>/{total} vests confirmed
                  </span>
                  {/* Progress bar */}
                  <div style={{ width:"80px", height:"5px", background:T.border, borderRadius:"3px", overflow:"hidden" }}>
                    <div style={{ height:"100%", width:`${total>0?confirmed/total*100:0}%`, background:T.accent, borderRadius:"3px", transition:"width 0.4s" }}/>
                  </div>
                </div>
                {remaining > 0 && (
                  <span style={{ fontSize:"11px", color:T.purple, fontWeight:600 }}>
                    {remaining} upcoming · {fmtINR(projVal)} projected
                  </span>
                )}
              </div>
              <div style={{ display:"flex", gap:"8px", alignItems:"center" }}>
                <button onClick={()=>toggle(grant.id)}
                  style={{ padding:"5px 12px", background:"transparent", border:`1px solid ${T.border}`, borderRadius:"7px", color:T.textDim, fontSize:"12px", fontWeight:600, cursor:"pointer" }}>
                  {expanded[grant.id] ? "▲ Hide" : "▼ Schedule"}
                </button>
                <button onClick={()=>onDelete(grant.id)}
                  style={{ background:"none", border:"none", color:T.red, cursor:"pointer", fontSize:"16px", opacity:0.5 }}>✕</button>
              </div>
            </div>

            {/* Expanded schedule */}
            {expanded[grant.id] && (
              <div style={{ borderTop:`1px solid ${T.border}`, overflowX:"auto" }}>
                <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"12px", minWidth:"600px" }}>
                  <thead>
                    <tr style={{ background:T.card }}>
                      {["#","Vest Date","Units","Status","Actual Price (USD)","Net Units","Net INR"].map(h=>(
                        <th key={h} style={{ padding:"8px 14px", textAlign:["#","Vest Date"].includes(h)?"left":h==="Status"?"center":"right", color:T.textDim, fontSize:"10px", fontWeight:700, borderBottom:`1px solid ${T.border}` }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {schedule.map((v, i) => {
                      const past      = new Date(v.vest_date) < new Date();
                      const confirmed = isConfirmed(v.vest_date, grant.person, grant.stock, rsuData);
                      const actual    = getConfirmedEvent(v.vest_date, grant.person, grant.stock, rsuData);
                      const netUnits  = actual ? actual.units_vested - (actual.tax_withheld_units||0) : null;
                      const netINR    = actual ? netUnits * actual.stock_price_usd * actual.usd_inr_rate : null;

                      return (
                        <tr key={i} style={{ borderBottom:`1px solid ${T.border}22`,
                          opacity: !confirmed && past ? 0.55 : 1,
                          background: confirmed ? T.accent+"08" : "transparent" }}>
                          <td style={{ padding:"9px 14px", color:T.textMuted, fontSize:"11px" }}>{i+1}</td>
                          <td style={{ padding:"9px 14px", fontFamily:"'JetBrains Mono',monospace", color:T.text }}>
                            {new Date(v.vest_date).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"})}
                          </td>
                          <td style={{ padding:"9px 14px", textAlign:"right", fontFamily:"'JetBrains Mono',monospace", color:T.textDim }}>
                            {v.units}
                          </td>
                          <td style={{ padding:"9px 14px", textAlign:"center" }}>
                            {confirmed
                              ? <span style={{ fontSize:"11px", color:T.accent, fontWeight:700 }}>✓ Confirmed</span>
                              : past
                                ? <span style={{ fontSize:"11px", color:T.amber, fontWeight:600 }}>⚠ Missed?</span>
                                : <span style={{ fontSize:"11px", color:T.textMuted }}>— Projected</span>}
                          </td>
                          <td style={{ padding:"9px 14px", textAlign:"right", fontFamily:"'JetBrains Mono',monospace", color:T.blue }}>
                            {actual ? fmtUSD(actual.stock_price_usd) : <span style={{ color:T.textMuted }}>—</span>}
                          </td>
                          <td style={{ padding:"9px 14px", textAlign:"right", fontFamily:"'JetBrains Mono',monospace", color:T.text }}>
                            {netUnits ?? <span style={{ color:T.textMuted }}>—</span>}
                          </td>
                          <td style={{ padding:"9px 14px", textAlign:"right", fontFamily:"'JetBrains Mono',monospace", color:T.accent, fontWeight:confirmed?700:400 }}>
                            {netINR !== null ? fmtINR(netINR) : <span style={{ color:T.textMuted }}>—</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {grant.notes && (
                  <div style={{ padding:"10px 16px", fontSize:"11px", color:T.textMuted, borderTop:`1px solid ${T.border}22` }}>
                    {grant.notes}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
