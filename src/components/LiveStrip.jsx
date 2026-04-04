import { T } from "../lib/theme";
import { fmtUSD } from "../lib/formatters";

export default function LiveStrip({ liveData }) {
  return (
    <div style={{ display:"flex", gap:"16px", flexWrap:"wrap", alignItems:"center",
      padding:"8px 16px", background:T.card, borderRadius:"10px", border:`1px solid ${T.border}`, fontSize:"13px" }}>
      <span style={{ color:T.textMuted, fontWeight:600, letterSpacing:"0.5px", textTransform:"uppercase", fontSize:"10px" }}>LIVE</span>
      <span style={{ width:"6px", height:"6px", borderRadius:"50%", background:T.accent, animation:"pulse 2s infinite" }}/>
      {[{label:"MSFT",value:fmtUSD(liveData.MSFT),color:T.blue},{label:"NVDA",value:fmtUSD(liveData.NVDA),color:T.accent},{label:"USD/INR",value:`\u20b9${liveData.USDINR.toFixed(2)}`,color:T.amber}].map(d=>(
        <div key={d.label} style={{ display:"flex", alignItems:"center", gap:"6px" }}>
          <span style={{ color:T.textDim, fontSize:"11px", fontWeight:600 }}>{d.label}</span>
          <span style={{ color:d.color, fontWeight:700, fontFamily:"'JetBrains Mono',monospace" }}>{d.value}</span>
        </div>
      ))}
    </div>
  );
}
