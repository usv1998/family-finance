import { useState } from "react";
import { T } from "../../lib/theme";
import { getCurrentFY, getCurrentMonthIdx } from "../../lib/formatters";
import { PERSONS, MONTHS, MONTH_FULL, EMPLOYER } from "../../lib/constants";
import SummaryCards from "./SummaryCards";
import IncomeTable from "./IncomeTable";
import MonthlyInput from "./MonthlyInput";
import AdHocItems from "./AdHocItems";

const CURR_FY  = getCurrentFY();
const CURR_MI  = getCurrentMonthIdx();

export default function IncomeTab({ incomeData, rsuData, investmentsData, fy, onUpdateIncome }) {
  const [viewMode,   setViewMode]   = useState("combined");
  const [editMonth,  setEditMonth]  = useState(null);
  const [editPerson, setEditPerson] = useState("Selva");
  const highlightMonth = fy === CURR_FY ? CURR_MI : null;

  const exportCSV = () => {
    let csv="Component,Person,"+MONTHS.join(",")+",FY Total\n";
    PERSONS.forEach(p=>{
      ["take_home","epf","espp","car_lease"].forEach(c=>{
        if(c==="car_lease"&&p!=="Selva") return;
        const vals=MONTHS.map((_,mi)=>Number(incomeData?.[fy]?.[p]?.[mi]?.[c])||0);
        csv+=`${c},${p},${vals.join(",")},${vals.reduce((s,v)=>s+v,0)}\n`;
      });
    });
    const url=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));
    Object.assign(document.createElement("a"),{href:url,download:`income_${fy}.csv`}).click();
    URL.revokeObjectURL(url);
  };

  const btnStyle=(active)=>({padding:"8px 16px",borderRadius:"8px",border:"none",fontSize:"13px",fontWeight:600,cursor:"pointer",transition:"all 0.2s",background:active?T.accent:"transparent",color:active?T.bg:T.textDim});
  const selectStyle={padding:"8px 14px",background:T.card,border:`1px solid ${T.border}`,borderRadius:"8px",color:T.text,fontSize:"13px",outline:"none",cursor:"pointer",appearance:"none",fontWeight:600};

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:"12px", marginBottom:"20px" }}>
        <div style={{ display:"flex", gap:"4px", padding:"4px", background:T.card, borderRadius:"10px" }}>
          {[{value:"combined",label:"Combined"},{value:"Selva",label:"Selva"},{value:"Akshaya",label:"Akshaya"}].map(v=>(
            <button key={v.value} onClick={()=>setViewMode(v.value)} style={btnStyle(viewMode===v.value)}>{v.label}</button>
          ))}
        </div>
        <button onClick={exportCSV} style={{ padding:"8px 16px", background:"transparent", border:`1px solid ${T.border}`, borderRadius:"8px", color:T.textDim, fontSize:"12px", cursor:"pointer", fontWeight:600 }}>Export CSV ↓</button>
      </div>
      <SummaryCards incomeData={incomeData} rsuData={rsuData} investmentsData={investmentsData} fy={fy}/>
      <IncomeTable  incomeData={incomeData} rsuData={rsuData} fy={fy} viewMode={viewMode} highlightMonth={highlightMonth}/>
      <div style={{ marginTop:"24px" }}>
        <h3 style={{ fontSize:"14px", fontWeight:700, color:T.text, marginBottom:"12px" }}>Enter Monthly Income</h3>
        <div style={{ display:"flex", gap:"8px", flexWrap:"wrap", marginBottom:"16px" }}>
          <select value={editPerson} onChange={e=>setEditPerson(e.target.value)} style={selectStyle}>
            {PERSONS.map(p=><option key={p} value={p}>{p} ({EMPLOYER[p]})</option>)}
          </select>
          <div style={{ display:"flex", gap:"4px", padding:"4px", background:T.card, borderRadius:"10px", overflowX:"auto" }}>
            {MONTHS.map((m,i)=>{
              const hasData=incomeData?.[fy]?.[editPerson]?.[i]?.take_home;
              const isCurr = i === highlightMonth;
              return (
                <button key={m} onClick={()=>setEditMonth(editMonth===i?null:i)}
                  style={{...btnStyle(editMonth===i),padding:"6px 10px",fontSize:"12px",position:"relative",
                    ...(hasData&&editMonth!==i?{color:T.accent}:{}),
                    ...(isCurr&&editMonth!==i?{outline:`2px solid ${T.accent}`,outlineOffset:"2px"}:{})}}>
                  {m}
                  {hasData&&<span style={{ position:"absolute",top:2,right:2,width:4,height:4,borderRadius:"50%",background:T.accent }}/>}
                </button>
              );
            })}
          </div>
        </div>
        {editMonth!==null&&(
          <div style={{ background:T.card, borderRadius:"12px", padding:"20px", border:`1px solid ${T.border}` }}>
            <h4 style={{ margin:"0 0 16px", fontSize:"14px", color:T.text }}>
              <span style={{ color:editPerson==="Selva"?T.selva:T.akshaya, fontWeight:700 }}>{editPerson}</span>{" · "}{MONTH_FULL[editMonth]} Income
            </h4>
            <MonthlyInput data={incomeData?.[fy]?.[editPerson]?.[editMonth]||{}} onChange={d=>onUpdateIncome(editPerson,editMonth,d)} person={editPerson} monthIdx={editMonth}/>
            <AdHocItems items={incomeData?.[fy]?.[editPerson]?.[editMonth]?.ad_hoc||[]}
              onChange={items=>{const cur=incomeData?.[fy]?.[editPerson]?.[editMonth]||{};onUpdateIncome(editPerson,editMonth,{...cur,ad_hoc:items});}}/>
          </div>
        )}
      </div>
    </div>
  );
}
