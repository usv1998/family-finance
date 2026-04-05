import { T } from "../../lib/theme";
import { fmtINR, fmtUSD } from "../../lib/formatters";
import { MONTHS } from "../../lib/constants";

export default function RsuTable({ events, onDelete, filterPerson, filterStock, liveData }) {
  let fil=[...events];
  if(filterPerson!=="all") fil=fil.filter(e=>e.person===filterPerson);
  if(filterStock!=="all")  fil=fil.filter(e=>e.stock===filterStock);
  fil.sort((a,b)=>new Date(a.vest_date)-new Date(b.vest_date));

  const totUnits   = fil.reduce((s,e)=>s+e.units_vested,0);
  const totUSD     = fil.reduce((s,e)=>s+e.units_vested*e.stock_price_usd,0);
  const totNetINR  = fil.reduce((s,e)=>s+(e.units_vested-(e.tax_withheld_units||0))*e.stock_price_usd*e.usd_inr_rate,0);

  // Appreciation (if held since vest)
  const hasLive = liveData && (liveData.MSFT || liveData.NVDA);
  const liveUSDINR = liveData?.USDINR || 85;
  const totCurrentVal = hasLive
    ? fil.reduce((s,e) => {
        const livePrice = liveData[e.stock] || 0;
        return s + (e.units_vested-(e.tax_withheld_units||0)) * livePrice * liveUSDINR;
      }, 0)
    : null;
  const totGain = totCurrentVal !== null ? totCurrentVal - totNetINR : null;
  const totGainPct = totNetINR > 0 && totGain !== null ? totGain / totNetINR * 100 : null;

  if(!fil.length) return <div style={{ textAlign:"center", padding:"40px", color:T.textMuted, fontSize:"14px" }}>No RSU vesting events recorded yet.</div>;

  const gainColor = (g) => g >= 0 ? T.accent : T.red;

  return (
    <div>
      {/* Summary cards */}
      <div style={{ display:"flex", gap:"12px", flexWrap:"wrap", marginBottom:"16px" }}>
        {[
          { l:"Total Units",    v:totUnits.toLocaleString(),  c:T.text   },
          { l:"Net Cost Basis", v:fmtINR(totNetINR),          c:T.accent },
        ].map(x=>(
          <div key={x.l} style={{ padding:"12px 20px", background:T.card, borderRadius:"10px", border:`1px solid ${T.border}` }}>
            <div style={{ fontSize:"10px", color:T.textMuted, fontWeight:600, textTransform:"uppercase" }}>{x.l}</div>
            <div style={{ fontSize:"18px", fontWeight:800, color:x.c, fontFamily:"'JetBrains Mono',monospace" }}>{x.v}</div>
          </div>
        ))}
        {totCurrentVal !== null && (
          <>
            <div style={{ padding:"12px 20px", background:T.card, borderRadius:"10px", border:`1px solid ${T.border}` }}>
              <div style={{ fontSize:"10px", color:T.textMuted, fontWeight:600, textTransform:"uppercase" }}>Current Value <span style={{ color:T.textMuted, fontWeight:400 }}>(if held)</span></div>
              <div style={{ fontSize:"18px", fontWeight:800, color:T.blue, fontFamily:"'JetBrains Mono',monospace" }}>{fmtINR(totCurrentVal)}</div>
            </div>
            <div style={{ padding:"12px 20px", background:T.card, borderRadius:"10px", border:`1px solid ${gainColor(totGain)}33` }}>
              <div style={{ fontSize:"10px", color:T.textMuted, fontWeight:600, textTransform:"uppercase" }}>Unrealized Gain</div>
              <div style={{ fontSize:"18px", fontWeight:800, color:gainColor(totGain), fontFamily:"'JetBrains Mono',monospace" }}>
                {totGain >= 0 ? "+" : ""}{fmtINR(totGain)}
              </div>
              {totGainPct !== null && (
                <div style={{ fontSize:"11px", color:gainColor(totGain), fontWeight:600, marginTop:"2px" }}>
                  {totGainPct >= 0 ? "+" : ""}{totGainPct.toFixed(1)}%
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <div style={{ overflowX:"auto", borderRadius:"10px", border:`1px solid ${T.border}` }}>
        <table style={{ width:"100%", borderCollapse:"collapse", minWidth:"900px", fontSize:"12px" }}>
          <thead>
            <tr style={{ background:T.card }}>
              {["Person","Stock","Vest Date","Units","Price (USD)","USD/INR","Net INR","Tax Units",
                ...(hasLive ? ["Now (INR)","Gain / Loss"] : []),
                "Grant ID",""].map(h=>(
                <th key={h} style={{ padding:"10px 12px", textAlign:h==="Person"||h==="Stock"?"left":"right",
                  color:h==="Now (INR)"||h==="Gain / Loss"?T.blue:T.textDim,
                  fontSize:"10px", fontWeight:700, borderBottom:`1px solid ${T.border}` }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {fil.map(e=>{
              const netUnits   = e.units_vested-(e.tax_withheld_units||0);
              const netINR     = netUnits*e.stock_price_usd*e.usd_inr_rate;
              const livePrice  = liveData?.[e.stock] || 0;
              const nowINR     = hasLive ? netUnits*livePrice*liveUSDINR : null;
              const gain       = nowINR !== null ? nowINR - netINR : null;
              const gainPct    = netINR > 0 && gain !== null ? gain/netINR*100 : null;
              return (
                <tr key={e.id} style={{ borderBottom:`1px solid ${T.border}22` }}>
                  <td style={{ padding:"10px 12px", color:e.person==="Selva"?T.selva:T.akshaya, fontWeight:600 }}>{e.person}</td>
                  <td style={{ padding:"10px 12px", color:T.text, fontWeight:600 }}>{e.stock}</td>
                  <td style={{ padding:"10px 12px", textAlign:"right", color:T.text, fontFamily:"'JetBrains Mono',monospace" }}>{new Date(e.vest_date).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"})}</td>
                  <td style={{ padding:"10px 12px", textAlign:"right", fontFamily:"'JetBrains Mono',monospace", color:T.text }}>{e.units_vested}</td>
                  <td style={{ padding:"10px 12px", textAlign:"right", fontFamily:"'JetBrains Mono',monospace", color:T.blue }}>{fmtUSD(e.stock_price_usd)}</td>
                  <td style={{ padding:"10px 12px", textAlign:"right", fontFamily:"'JetBrains Mono',monospace", color:T.amber }}>₹{e.usd_inr_rate}</td>
                  <td style={{ padding:"10px 12px", textAlign:"right", fontFamily:"'JetBrains Mono',monospace", color:T.accent }}>{fmtINR(netINR)}</td>
                  <td style={{ padding:"10px 12px", textAlign:"right", fontFamily:"'JetBrains Mono',monospace", color:T.textDim }}>{e.tax_withheld_units||"—"}</td>
                  {hasLive && (
                    <>
                      <td style={{ padding:"10px 12px", textAlign:"right", fontFamily:"'JetBrains Mono',monospace", color:T.blue }}>
                        {livePrice > 0 ? fmtINR(nowINR) : <span style={{ color:T.textMuted }}>—</span>}
                      </td>
                      <td style={{ padding:"10px 12px", textAlign:"right", fontFamily:"'JetBrains Mono',monospace",
                        color: gain !== null ? gainColor(gain) : T.textMuted, fontWeight:600 }}>
                        {gain !== null && livePrice > 0 ? (
                          <span title={`${gainPct>=0?"+":""}${gainPct.toFixed(1)}%`}>
                            {gain>=0?"+":""}{fmtINR(gain)}{" "}
                            <span style={{ fontSize:"10px", opacity:0.8 }}>({gainPct>=0?"+":""}{gainPct.toFixed(0)}%)</span>
                          </span>
                        ) : "—"}
                      </td>
                    </>
                  )}
                  <td style={{ padding:"10px 12px", textAlign:"right", color:T.textMuted, fontSize:"11px" }}>{e.grant_id||"—"}</td>
                  <td style={{ padding:"10px 12px", textAlign:"right" }}><button onClick={()=>onDelete(e.id)} style={{ background:"transparent", border:"none", color:T.red, cursor:"pointer", fontSize:"14px", opacity:0.6 }}>✕</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
