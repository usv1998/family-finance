import { useState, useRef, lazy, Suspense } from "react";
import { T } from "../../lib/theme";
import { getCurrentFY, getCurrentMonthIdx, getEsspINR } from "../../lib/formatters";
import { PERSONS, MONTHS, MONTH_FULL, EMPLOYER } from "../../lib/constants";
import { downloadCSV } from "../../lib/csvExport";
import SummaryCards from "./SummaryCards";
import IncomeTable from "./IncomeTable";
import MonthlyInput from "./MonthlyInput";
import AdHocItems from "./AdHocItems";

const IncomeGrowthChart  = lazy(() => import("../charts/IncomeGrowthChart"));
const SavingsRateChart   = lazy(() => import("../charts/SavingsRateChart"));
const ProjectionChart    = lazy(() => import("../charts/ProjectionChart"));

const CURR_FY  = getCurrentFY();
const CURR_MI  = getCurrentMonthIdx();

export default function IncomeTab({ incomeData, rsuData, investmentsData, expensesData, rsuGrants, liveData, fy, onUpdateIncome }) {
  const [section,    setSection]    = useState("table");   // "table" | "charts"
  const [chartView,  setChartView]  = useState("income");  // "income" | "savings" | "projection"
  const [viewMode,   setViewMode]   = useState("combined");
  const [editMonth,  setEditMonth]  = useState(null);
  const [editPerson, setEditPerson] = useState("Selva");
  const editRef = useRef(null);
  const highlightMonth = fy === CURR_FY ? CURR_MI : null;

  const exportCSV = () => {
    const headers = ["Component", "Person", ...MONTHS, "FY Total"];
    const rows = [];
    PERSONS.forEach(p => {
      ["take_home","epf","car_lease"].forEach(c => {
        if (c === "car_lease" && p !== "Selva") return;
        const vals = MONTHS.map((_,mi) => Number(incomeData?.[fy]?.[p]?.[mi]?.[c]) || 0);
        rows.push([c, p, ...vals, vals.reduce((s,v)=>s+v, 0)]);
      });
      // ESPP: export shares, price, rate, and derived INR
      ["espp_shares","espp_price_usd","espp_usd_inr"].forEach(c => {
        const vals = MONTHS.map((_,mi) => Number(incomeData?.[fy]?.[p]?.[mi]?.[c]) || 0);
        rows.push([c, p, ...vals, vals.reduce((s,v)=>s+v, 0)]);
      });
      const esppINRVals = MONTHS.map((_,mi) => Math.round(getEsspINR(incomeData?.[fy]?.[p]?.[mi])));
      rows.push(["espp_inr", p, ...esppINRVals, esppINRVals.reduce((s,v)=>s+v, 0)]);
    });
    downloadCSV(`income_${fy}.csv`, [headers, ...rows]);
  };

  const btnStyle=(active)=>({padding:"8px 16px",borderRadius:"8px",border:"none",fontSize:"13px",fontWeight:600,cursor:"pointer",transition:"all 0.2s",background:active?T.accent:"transparent",color:active?T.bg:T.textDim});
  const selectStyle={padding:"8px 14px",background:T.card,border:`1px solid ${T.border}`,borderRadius:"8px",color:T.text,fontSize:"13px",outline:"none",cursor:"pointer",appearance:"none",fontWeight:600};

  return (
    <div>
      {/* Top toolbar */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:"12px", marginBottom:"20px" }}>
        <div style={{ display:"flex", gap:"8px", flexWrap:"wrap" }}>
          {/* Section toggle */}
          <div style={{ display:"flex", gap:"4px", padding:"4px", background:T.card, borderRadius:"10px" }}>
            <button onClick={()=>setSection("table")}  style={btnStyle(section==="table")}>Table</button>
            <button onClick={()=>setSection("charts")} style={btnStyle(section==="charts")}>Charts</button>
          </div>
          {/* Person/view toggle — only in table view */}
          {section === "table" && (
            <div style={{ display:"flex", gap:"4px", padding:"4px", background:T.card, borderRadius:"10px" }}>
              {[{value:"combined",label:"Combined"},{value:"Selva",label:"Selva"},{value:"Akshaya",label:"Akshaya"}].map(v=>(
                <button key={v.value} onClick={()=>setViewMode(v.value)} style={btnStyle(viewMode===v.value)}>{v.label}</button>
              ))}
            </div>
          )}
        </div>
        {section === "table" && (
          <button onClick={exportCSV} style={{ padding:"8px 16px", background:"transparent", border:`1px solid ${T.border}`, borderRadius:"8px", color:T.textDim, fontSize:"12px", cursor:"pointer", fontWeight:600 }}>Export CSV ↓</button>
        )}
      </div>

      <SummaryCards incomeData={incomeData} rsuData={rsuData} investmentsData={investmentsData} fy={fy}/>

      {/* ── Table section ── */}
      {section === "table" && (
        <>
          <IncomeTable incomeData={incomeData} rsuData={rsuData} fy={fy} viewMode={viewMode} highlightMonth={highlightMonth}
            onSelectMonth={mi=>{ setEditMonth(mi); if(viewMode!=="combined") setEditPerson(viewMode); setTimeout(()=>editRef.current?.scrollIntoView({behavior:"smooth",block:"start"}),50); }}/>
          <div ref={editRef} style={{ marginTop:"24px" }}>
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
        </>
      )}

      {/* ── Charts section ── */}
      {section === "charts" && (
        <div style={{ background:T.surface, borderRadius:"12px", border:`1px solid ${T.border}`, padding:"20px" }}>
          {/* Chart toggle */}
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:"12px", marginBottom:"20px" }}>
            <div>
              {{
              income: (
                <>
                  <div style={{ fontSize:"14px", fontWeight:700, color:T.text, marginBottom:"4px" }}>Income Growth — All Financial Years</div>
                  <div style={{ fontSize:"12px", color:T.textMuted }}>Stacked by component · Hover for breakdown · Click legend to hide/show · Dashed line = total trend</div>
                </>
              ),
              savings: (
                <>
                  <div style={{ fontSize:"14px", fontWeight:700, color:T.text, marginBottom:"4px" }}>Savings Rate — All Financial Years</div>
                  <div style={{ fontSize:"12px", color:T.textMuted }}>Income vs Expenses bars · Dashed line = savings rate % · Right axis = %</div>
                </>
              ),
              projection: (
                <>
                  <div style={{ fontSize:"14px", fontWeight:700, color:T.text, marginBottom:"4px" }}>Income Projection</div>
                  <div style={{ fontSize:"12px", color:T.textMuted }}>Actuals + projected FYs · Faded bars = projection · RSU from grant schedules at live prices</div>
                </>
              ),
            }[chartView]}
            </div>
            <div style={{ display:"flex", gap:"4px", padding:"4px", background:T.card, borderRadius:"10px" }}>
              <button onClick={()=>setChartView("income")}     style={btnStyle(chartView==="income")}>Income Growth</button>
              <button onClick={()=>setChartView("savings")}    style={btnStyle(chartView==="savings")}>Savings Rate</button>
              <button onClick={()=>setChartView("projection")} style={btnStyle(chartView==="projection")}>Projection</button>
            </div>
          </div>
          <Suspense fallback={<div style={{ textAlign:"center", padding:"60px", color:T.textMuted }}>Loading chart…</div>}>
            {chartView === "income"     && <IncomeGrowthChart incomeData={incomeData} rsuData={rsuData}/>}
            {chartView === "savings"    && <SavingsRateChart  incomeData={incomeData} rsuData={rsuData} expensesData={expensesData}/>}
            {chartView === "projection" && <ProjectionChart   incomeData={incomeData} rsuData={rsuData} rsuGrants={rsuGrants} liveData={liveData}/>}
          </Suspense>
        </div>
      )}
    </div>
  );
}
