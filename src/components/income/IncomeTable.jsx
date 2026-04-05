import { T } from "../../lib/theme";
import { fmtINR, getEsspINR } from "../../lib/formatters";
import { MONTHS, PERSONS } from "../../lib/constants";

export default function IncomeTable({ incomeData, rsuData, fy, viewMode, highlightMonth }) {
  const persons = viewMode==="combined" ? PERSONS : [viewMode];
  const getMD        = (p,mi) => incomeData?.[fy]?.[p]?.[mi] || {};
  const getRSUShares = (p,mi) => (rsuData?.[fy]||[]).filter(r=>r.person===p&&r.month_idx===mi).reduce((s,r)=>s+(r.units_vested-(r.tax_withheld_units||0)),0);
  const getRSUINR    = (p,mi) => (rsuData?.[fy]||[]).filter(r=>r.person===p&&r.month_idx===mi).reduce((s,r)=>s+((r.units_vested-(r.tax_withheld_units||0))*r.stock_price_usd*r.usd_inr_rate||0),0);

  const rows = [
    {key:"take_home", label:"Take-Home Salary"},
    {key:"epf",       label:"EPF Contribution"},
    {key:"espp",      label:"ESPP Net Shares",   computed:true, isShares:true},
    {key:"car_lease", label:"Car Lease",          personFilter:"Selva"},
    {key:"rsu",       label:"RSU Net Shares",     computed:true, isShares:true},
    {key:"ad_hoc",    label:"Ad-hoc / Bonus",     computed:true},
    {key:"total",     label:"Monthly Total",      isTotal:true},
  ];

  const getVal=(row,p,mi)=>{
    const d=getMD(p,mi);
    if(row.key==="rsu")    return getRSUShares(p,mi);
    if(row.key==="espp")   return Number(d.espp_shares) || 0;
    if(row.key==="ad_hoc") return (d.ad_hoc||[]).reduce((s,i)=>s+(Number(i.amount)||0),0);
    if(row.key==="total")  return (Number(d.take_home)||0)+(Number(d.epf)||0)+getEsspINR(d)+(Number(d.car_lease)||0)+getRSUINR(p,mi)+(d.ad_hoc||[]).reduce((s,i)=>s+(Number(i.amount)||0),0);
    return Number(d[row.key])||0;
  };
  const getCombined=(row,mi)=>persons.reduce((s,p)=>s+getVal(row,p,mi),0);
  const getRowTotal=(row)=>MONTHS.reduce((s,_,mi)=>s+getCombined(row,mi),0);
  return (
    <div style={{ overflowX:"auto", borderRadius:"12px", border:`1px solid ${T.border}` }}>
      <table style={{ width:"100%", borderCollapse:"collapse", minWidth:"900px", fontSize:"13px" }}>
        <thead>
          <tr style={{ background:T.card }}>
            <th style={{ padding:"12px 16px", textAlign:"left", color:T.textDim, fontSize:"11px", fontWeight:700, letterSpacing:"0.5px", borderBottom:`1px solid ${T.border}`, position:"sticky", left:0, background:T.card, zIndex:1 }}>COMPONENT</th>
            {MONTHS.map((m,mi)=><th key={m} style={{ padding:"12px 8px", textAlign:"right", color:mi===highlightMonth?T.accent:T.textDim, fontSize:"11px", fontWeight:700, borderBottom:`1px solid ${T.border}`, background:mi===highlightMonth?T.accentBg:"transparent" }}>{m.toUpperCase()}{mi===highlightMonth&&<span style={{ display:"block", fontSize:"9px", color:T.accent, letterSpacing:"0.5px" }}>NOW</span>}</th>)}
            <th style={{ padding:"12px 16px", textAlign:"right", color:T.accent, fontSize:"11px", fontWeight:700, borderBottom:`1px solid ${T.border}` }}>FY TOTAL</th>
          </tr>
        </thead>
        <tbody>
          {rows.filter(r=>!r.personFilter||persons.includes(r.personFilter)).map(row=>(
            <tr key={row.key} style={{ background:row.isTotal?T.accentBg:"transparent", borderBottom:`1px solid ${row.isTotal?T.accent+"33":T.border}22` }}>
              <td style={{ padding:"10px 16px", color:row.isTotal?T.accent:T.text, fontWeight:row.isTotal?700:500, fontSize:"12px", position:"sticky", left:0, background:row.isTotal?T.accentBg:T.surface, zIndex:1 }}>{row.label}</td>
              {MONTHS.map((_,mi)=>{
                const val=getCombined(row,mi);
                const isCur = mi===highlightMonth;
                const disp = row.isShares ? (val>0?`${val} sh`:"—") : (val>0?fmtINR(val):"—");
                return <td key={mi} style={{ padding:"10px 8px", textAlign:"right", color:val>0?(row.isTotal?T.accent:row.isShares?T.teal:T.text):T.textMuted, fontFamily:"'JetBrains Mono',monospace", fontSize:"12px", fontWeight:row.isTotal?700:400, background:isCur?(row.isTotal?T.accent+"22":T.accentBg+"99"):"transparent", borderLeft:isCur?`1px solid ${T.accent}33`:"none", borderRight:isCur?`1px solid ${T.accent}33`:"none" }}>{disp}</td>;
              })}
              <td style={{ padding:"10px 16px", textAlign:"right", color:row.isTotal?T.accent:row.isShares?T.teal:T.white, fontFamily:"'JetBrains Mono',monospace", fontSize:"13px", fontWeight:700 }}>
                {row.isShares ? (getRowTotal(row)>0?`${getRowTotal(row)} sh`:"—") : fmtINR(getRowTotal(row))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
