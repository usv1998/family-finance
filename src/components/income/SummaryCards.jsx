import { T, sCard } from "../../lib/theme";
import { fmtINR } from "../../lib/formatters";
import { PERSONS, MONTHS } from "../../lib/constants";

export default function SummaryCards({ incomeData, rsuData, investmentsData, fy }) {
  const sum = (fn) => PERSONS.reduce((s,p)=>s+MONTHS.reduce((ss,_,mi)=>ss+(fn(p,mi)||0),0),0);
  const totalTH    = sum((p,mi)=>Number(incomeData?.[fy]?.[p]?.[mi]?.take_home));
  const empEPF     = sum((p,mi)=>Number(incomeData?.[fy]?.[p]?.[mi]?.epf));
  const epfOpening = investmentsData?.[fy]?.epfOpening || { Selva:0, Akshaya:0 };
  const totalEPF   = (epfOpening.Selva + epfOpening.Akshaya) + empEPF * 2;
  const totalESPP  = sum((p,mi)=>Number(incomeData?.[fy]?.[p]?.[mi]?.espp));
  const totalRSU   = (rsuData?.[fy]||[]).reduce((s,r)=>s+((r.units_vested-r.tax_withheld_units)*r.stock_price_usd*r.usd_inr_rate||0),0);
  const totalCar   = sum((p,mi)=>p==="Selva"?Number(incomeData?.[fy]?.[p]?.[mi]?.car_lease):0);
  const totalAH    = sum((p,mi)=>(incomeData?.[fy]?.[p]?.[mi]?.ad_hoc||[]).reduce((a,i)=>a+(Number(i.amount)||0),0));
  const grand      = totalTH + totalEPF + totalESPP + totalRSU + totalCar + totalAH;
  const cards = [
    {label:"Total Take-Home",     value:fmtINR(totalTH),   color:T.accent},
    {label:"Total RSU Net (INR)", value:fmtINR(totalRSU),  color:T.purple},
    {label:"Total EPF Corpus",    value:fmtINR(totalEPF),  color:T.blue},
    {label:"Total ESPP Stocks",   value:fmtINR(totalESPP), color:T.amber},
    {label:"Grand Total",         value:fmtINR(grand),     color:T.white, grand:true},
  ];
  return (
    <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))", gap:"12px", marginBottom:"20px" }}>
      {cards.map(c=>(
        <div key={c.label} style={sCard(c.grand)}>
          <div style={{ fontSize:"11px", color:T.textMuted, textTransform:"uppercase", fontWeight:600, letterSpacing:"0.5px", marginBottom:"6px" }}>{c.label}</div>
          <div style={{ fontSize:c.grand?"22px":"20px", fontWeight:800, color:c.color, fontFamily:"'JetBrains Mono',monospace" }}>{c.value}</div>
        </div>
      ))}
    </div>
  );
}
