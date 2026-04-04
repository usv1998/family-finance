import { T } from "../../lib/theme";
import { fmtINR, fmtUSD } from "../../lib/formatters";
import { MONTHS } from "../../lib/constants";

export default function RsuTable({ events, onDelete, filterPerson, filterStock }) {
  let fil=[...events];
  if(filterPerson!=="all") fil=fil.filter(e=>e.person===filterPerson);
  if(filterStock!=="all")  fil=fil.filter(e=>e.stock===filterStock);
  fil.sort((a,b)=>new Date(a.vest_date)-new Date(b.vest_date));
  const totUnits=fil.reduce((s,e)=>s+e.units_vested,0);
  const totUSD  =fil.reduce((s,e)=>s+e.units_vested*e.stock_price_usd,0);
  const totINR  =fil.reduce((s,e)=>s+e.units_vested*e.stock_price_usd*e.usd_inr_rate,0);
  if(!fil.length) return <div style={{ textAlign:"center", padding:"40px", color:T.textMuted, fontSize:"14px" }}>No RSU vesting events recorded yet.</div>;
  return (
    <div>
      <div style={{ display:"flex", gap:"16px", flexWrap:"wrap", marginBottom:"16px" }}>
        {[{l:"Total Units",v:totUnits.toLocaleString(),c:T.text},{l:"Gross USD",v:fmtUSD(totUSD),c:T.blue},{l:"Gross INR",v:fmtINR(totINR),c:T.accent}].map(x=>(
          <div key={x.l} style={{ padding:"12px 20px", background:T.card, borderRadius:"10px", border:`1px solid ${T.border}` }}>
            <div style={{ fontSize:"10px", color:T.textMuted, fontWeight:600, textTransform:"uppercase" }}>{x.l}</div>
            <div style={{ fontSize:"18px", fontWeight:800, color:x.c, fontFamily:"'JetBrains Mono',monospace" }}>{x.v}</div>
          </div>
        ))}
      </div>
      <div style={{ overflowX:"auto", borderRadius:"10px", border:`1px solid ${T.border}` }}>
        <table style={{ width:"100%", borderCollapse:"collapse", minWidth:"800px", fontSize:"12px" }}>
          <thead>
            <tr style={{ background:T.card }}>
              {["Person","Stock","Vest Date","Units","Price (USD)","USD/INR","Gross INR","Tax Units","Net INR","Grant ID",""].map(h=>(
                <th key={h} style={{ padding:"10px 12px", textAlign:h==="Person"||h==="Stock"?"left":"right", color:T.textDim, fontSize:"10px", fontWeight:700, borderBottom:`1px solid ${T.border}` }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {fil.map(e=>(
              <tr key={e.id} style={{ borderBottom:`1px solid ${T.border}22` }}>
                <td style={{ padding:"10px 12px", color:e.person==="Selva"?T.selva:T.akshaya, fontWeight:600 }}>{e.person}</td>
                <td style={{ padding:"10px 12px", color:T.text, fontWeight:600 }}>{e.stock}</td>
                <td style={{ padding:"10px 12px", textAlign:"right", color:T.text, fontFamily:"'JetBrains Mono',monospace" }}>{new Date(e.vest_date).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"})}</td>
                <td style={{ padding:"10px 12px", textAlign:"right", fontFamily:"'JetBrains Mono',monospace", color:T.text }}>{e.units_vested}</td>
                <td style={{ padding:"10px 12px", textAlign:"right", fontFamily:"'JetBrains Mono',monospace", color:T.blue }}>{fmtUSD(e.stock_price_usd)}</td>
                <td style={{ padding:"10px 12px", textAlign:"right", fontFamily:"'JetBrains Mono',monospace", color:T.amber }}>₹{e.usd_inr_rate}</td>
                <td style={{ padding:"10px 12px", textAlign:"right", fontFamily:"'JetBrains Mono',monospace", color:T.accent, fontWeight:600 }}>{fmtINR(e.units_vested*e.stock_price_usd*e.usd_inr_rate)}</td>
                <td style={{ padding:"10px 12px", textAlign:"right", fontFamily:"'JetBrains Mono',monospace", color:T.textDim }}>{e.tax_withheld_units||"—"}</td>
                <td style={{ padding:"10px 12px", textAlign:"right", fontFamily:"'JetBrains Mono',monospace", color:T.accent }}>{fmtINR((e.units_vested-(e.tax_withheld_units||0))*e.stock_price_usd*e.usd_inr_rate)}</td>
                <td style={{ padding:"10px 12px", textAlign:"right", color:T.textMuted, fontSize:"11px" }}>{e.grant_id||"—"}</td>
                <td style={{ padding:"10px 12px", textAlign:"right" }}><button onClick={()=>onDelete(e.id)} style={{ background:"transparent", border:"none", color:T.red, cursor:"pointer", fontSize:"14px", opacity:0.6 }}>✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
