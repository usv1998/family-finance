import { T, sCard } from "../../lib/theme";
import { fmtINR, getEsspINR } from "../../lib/formatters";
import { PERSONS, MONTHS } from "../../lib/constants";

export default function SummaryCards({ incomeData, rsuData, investmentsData, fy }) {
  const sum = (fn) => PERSONS.reduce((s,p)=>s+MONTHS.reduce((ss,_,mi)=>ss+(fn(p,mi)||0),0),0);
  const totalTH       = sum((p,mi)=>Number(incomeData?.[fy]?.[p]?.[mi]?.take_home));
  const empEPF        = sum((p,mi)=>Number(incomeData?.[fy]?.[p]?.[mi]?.epf));
  const epfOpening    = investmentsData?.[fy]?.epfOpening || { Selva:0, Akshaya:0 };
  const totalEPF      = (epfOpening.Selva + epfOpening.Akshaya) + empEPF;
  const totalESPPINR  = sum((p,mi)=>getEsspINR(incomeData?.[fy]?.[p]?.[mi]));
  const totalESPPSh   = sum((p,mi)=>Number(incomeData?.[fy]?.[p]?.[mi]?.espp_shares)||0);
  const totalRSUSh    = sum((p,mi)=>Number(incomeData?.[fy]?.[p]?.[mi]?.rsu_net_shares)||0);
  const totalRSUINR   = sum((p,mi)=>{ const d=incomeData?.[fy]?.[p]?.[mi]||{}; return (Number(d.rsu_net_shares)||0)*(Number(d.rsu_price_usd)||0)*(Number(d.rsu_usd_inr)||0); });
  const totalCar      = sum((p,mi)=>p==="Selva"?Number(incomeData?.[fy]?.[p]?.[mi]?.car_lease):0);
  const totalAH       = sum((p,mi)=>(incomeData?.[fy]?.[p]?.[mi]?.ad_hoc||[]).reduce((a,i)=>a+(Number(i.amount)||0),0));
  const grand         = totalTH + totalEPF + totalESPPINR + totalRSUINR + totalCar + totalAH;
  const cards = [
    {label:"Total Take-Home",  value:fmtINR(totalTH),                                color:T.accent},
    {label:"RSU Net Shares",   value:`${totalRSUSh} shares`, sub:fmtINR(totalRSUINR), color:T.purple},
    {label:"Total EPF Corpus", value:fmtINR(totalEPF),                               color:T.blue},
    {label:"ESPP Net Shares",  value:`${totalESPPSh} shares`, sub:fmtINR(totalESPPINR), color:T.teal},
    {label:"Grand Total",      value:fmtINR(grand),                                  color:T.white, grand:true},
  ];
  return (
    <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))", gap:"12px", marginBottom:"20px" }}>
      {cards.map(c=>(
        <div key={c.label} style={sCard(c.grand)}>
          <div style={{ fontSize:"11px", color:T.textMuted, textTransform:"uppercase", fontWeight:600, letterSpacing:"0.5px", marginBottom:"6px" }}>{c.label}</div>
          <div style={{ fontSize:c.grand?"22px":"20px", fontWeight:800, color:c.color, fontFamily:"'JetBrains Mono',monospace" }}>{c.value}</div>
          {c.sub && <div style={{ fontSize:"11px", color:T.textMuted, marginTop:"3px" }}>≈ {c.sub}</div>}
        </div>
      ))}
    </div>
  );
}
