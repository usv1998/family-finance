import { useState } from "react";
import { T } from "../../lib/theme";
import { fmtINR, genId, getCurrentMonthIdx } from "../../lib/formatters";
import { MONTHS, MONTH_FULL } from "../../lib/constants";
import { SEED_DATA } from "../../lib/seed";
import { downloadCSV } from "../../lib/csvExport";

export default function ExpensesTab({ expensesData, fy, onUpdate }) {
  const inv       = expensesData?.[fy] || {};
  const categories= inv.categories || SEED_DATA.expensesData["FY2026-27"].categories;
  const actuals   = inv.actuals    || {};

  const [selMonth, setSelMonth] = useState(getCurrentMonthIdx);
  const [editVals, setEditVals] = useState({});
  const [editingMonth, setEditingMonth] = useState(null);
  const [showAddCat, setShowAddCat] = useState(false);
  const [newCat, setNewCat] = useState({ name:"", budget:"", color:"#22C55E" });
  const [editBudgets, setEditBudgets] = useState(false);
  const [budgetDraft, setBudgetDraft] = useState({});

  const getActual = (mi, catId) => Number(actuals?.[mi]?.[catId]) || 0;
  const monthTotal = (mi) => categories.reduce((s,c)=>s+getActual(mi,c.id),0);
  const monthBudget = () => categories.reduce((s,c)=>s+Number(c.budget||0),0);

  // YTD: only count months that have any actual entered
  const enteredMonths = MONTHS.map((_,mi)=>monthTotal(mi)>0);
  const ytdActual   = MONTHS.reduce((s,_,mi)=>s+monthTotal(mi),0);
  const ytdBudget   = enteredMonths.filter(Boolean).length * monthBudget();
  const ytdSurplus  = ytdBudget - ytdActual;
  const annualBudget= monthBudget() * 12;

  const updateInv = (patch) => onUpdate(fy, { categories, actuals, ...inv, ...patch });

  const exportExpenses = () => {
    const headers = ["Category", "Budget/Month", ...MONTHS, "FY Total Actual", "FY Budget", "Variance"];
    const rows = categories.map(c => {
      const monthly   = MONTHS.map((_,mi) => getActual(mi, c.id));
      const fyTotal   = monthly.reduce((s,v)=>s+v,0);
      const fyBudget  = Number(c.budget||0) * 12;
      return [c.name, c.budget, ...monthly, fyTotal, fyBudget, fyBudget - fyTotal];
    });
    const totals = ["TOTAL", monthBudget(), ...MONTHS.map((_,mi)=>monthTotal(mi)), ytdActual, annualBudget, annualBudget-ytdActual];
    downloadCSV(`expenses_${fy}.csv`, [headers, ...rows, totals]);
  };

  // start editing a month
  const startEdit = (mi) => {
    const draft = {};
    categories.forEach(c=>{ draft[c.id] = getActual(mi,c.id)||""; });
    setEditVals(draft);
    setEditingMonth(mi);
  };

  const saveEdit = () => {
    const newActuals = { ...actuals, [editingMonth]: {} };
    categories.forEach(c=>{ const v=Number(editVals[c.id])||0; if(v>0) newActuals[editingMonth][c.id]=v; });
    updateInv({ actuals: newActuals });
    setEditingMonth(null);
  };

  const addCategory = () => {
    if(!newCat.name.trim()) return;
    const cat = { id: genId(), name: newCat.name.trim(), budget: Number(newCat.budget)||0, color: newCat.color };
    updateInv({ categories: [...categories, cat] });
    setNewCat({ name:"", budget:"", color:"#22C55E" });
    setShowAddCat(false);
  };

  const deleteCategory = (id) => {
    updateInv({ categories: categories.filter(c=>c.id!==id) });
  };

  const saveBudgets = () => {
    const updated = categories.map(c=>({ ...c, budget: Number(budgetDraft[c.id]??c.budget)||0 }));
    updateInv({ categories: updated });
    setEditBudgets(false);
  };

  const inp = { padding:"8px 12px", background:T.card, border:`1px solid ${T.border}`, borderRadius:"8px", color:T.text, fontSize:"13px", outline:"none", width:"100%", fontFamily:"'JetBrains Mono',monospace" };

  const SumCard = ({label,value,sub,color,neg}) => (
    <div style={{ background:T.surface, borderRadius:"10px", padding:"14px 16px", border:`1px solid ${T.border}` }}>
      <div style={{ fontSize:"11px", color:T.textMuted, fontWeight:700, letterSpacing:"0.5px", marginBottom:"6px" }}>{label.toUpperCase()}</div>
      <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"18px", fontWeight:800, color:neg?(value<0?T.red:T.accent):color }}>{fmtINR(value)}</div>
      {sub&&<div style={{ fontSize:"11px", color:T.textMuted, marginTop:"4px" }}>{sub}</div>}
    </div>
  );

  return (
    <div>
      {/* Summary cards */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:"12px", marginBottom:"24px" }}>
        <SumCard label="Annual Budget"  value={annualBudget} color={T.textDim} sub={`${categories.length} categories`}/>
        <SumCard label="YTD Spent"      value={ytdActual}    color={T.amber}   sub={`${enteredMonths.filter(Boolean).length} months recorded`}/>
        <SumCard label="YTD Surplus"    value={ytdSurplus}   color={T.accent}  sub="vs budget months entered" neg/>
      </div>

      {/* Month selector */}
      <div style={{ display:"flex", gap:"4px", padding:"4px", background:T.card, borderRadius:"10px", overflowX:"auto", marginBottom:"20px" }}>
        {MONTHS.map((m,mi)=>{
          const hasData = monthTotal(mi) > 0;
          return (
            <button key={m} onClick={()=>setSelMonth(mi)} style={{
              ...{ padding:"6px 12px", borderRadius:"7px", border:"none", fontSize:"12px", fontWeight:600, cursor:"pointer", whiteSpace:"nowrap", transition:"all 0.15s", position:"relative" },
              background: selMonth===mi ? T.accent : "transparent",
              color: selMonth===mi ? T.bg : hasData ? T.text : T.textMuted,
            }}>
              {m}{hasData&&<span style={{ position:"absolute",top:2,right:2,width:4,height:4,borderRadius:"50%",background:selMonth===mi?T.bg:T.accent }}/>}
            </button>
          );
        })}
      </div>

      {/* Monthly breakdown */}
      <div style={{ background:T.surface, borderRadius:"12px", border:`1px solid ${T.border}`, marginBottom:"24px", overflow:"hidden" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"14px 20px", borderBottom:`1px solid ${T.border}` }}>
          <div>
            <span style={{ fontSize:"14px", fontWeight:700, color:T.text }}>{MONTH_FULL[selMonth]} Expenses</span>
            <span style={{ fontSize:"12px", color:T.textMuted, marginLeft:"10px" }}>
              {monthTotal(selMonth)>0 ? `Spent ${fmtINR(monthTotal(selMonth))} of ${fmtINR(monthBudget())} budget` : "No actuals entered"}
            </span>
          </div>
          <button onClick={()=>editingMonth===selMonth ? saveEdit() : startEdit(selMonth)} style={{ padding:"7px 16px", background:editingMonth===selMonth?T.accent:T.card, border:`1px solid ${editingMonth===selMonth?T.accent:T.border}`, borderRadius:"8px", color:editingMonth===selMonth?T.bg:T.text, fontSize:"12px", fontWeight:700, cursor:"pointer" }}>
            {editingMonth===selMonth ? "Save" : "Edit Month"}
          </button>
        </div>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"13px" }}>
            <thead>
              <tr style={{ background:T.card }}>
                <th style={{ padding:"10px 16px", textAlign:"left", color:T.textMuted, fontSize:"11px", fontWeight:700, letterSpacing:"0.5px" }}>CATEGORY</th>
                <th style={{ padding:"10px 12px", textAlign:"right", color:T.textMuted, fontSize:"11px", fontWeight:700 }}>BUDGET</th>
                <th style={{ padding:"10px 12px", textAlign:"right", color:T.textMuted, fontSize:"11px", fontWeight:700 }}>ACTUAL</th>
                <th style={{ padding:"10px 12px", textAlign:"right", color:T.textMuted, fontSize:"11px", fontWeight:700 }}>DIFF</th>
                <th style={{ padding:"10px 12px", textAlign:"right", color:T.textMuted, fontSize:"11px", fontWeight:700 }}>% USED</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((cat,i)=>{
                const budget = Number(cat.budget)||0;
                const actual = editingMonth===selMonth ? (Number(editVals[cat.id])||0) : getActual(selMonth,cat.id);
                const diff   = budget - actual;
                const pct    = budget>0 ? Math.round(actual/budget*100) : 0;
                const statusColor = actual===0 ? T.textMuted : pct<=100 ? T.accent : pct<=120 ? T.amber : T.red;
                return (
                  <tr key={cat.id} style={{ borderTop:`1px solid ${T.border}`, background:i%2===0?"transparent":T.card+"44" }}>
                    <td style={{ padding:"10px 16px" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                        <div style={{ width:"8px", height:"8px", borderRadius:"50%", background:cat.color, flexShrink:0 }}/>
                        <span style={{ color:T.text, fontWeight:500 }}>{cat.name}</span>
                      </div>
                    </td>
                    <td style={{ padding:"10px 12px", textAlign:"right", fontFamily:"'JetBrains Mono',monospace", color:T.textDim }}>{fmtINR(budget)}</td>
                    <td style={{ padding:"10px 12px", textAlign:"right" }}>
                      {editingMonth===selMonth ? (
                        <input type="number" value={editVals[cat.id]||""} placeholder="0"
                          onChange={e=>setEditVals(v=>({...v,[cat.id]:e.target.value}))}
                          style={{ ...inp, width:"110px", padding:"5px 8px", textAlign:"right" }}/>
                      ) : (
                        <span style={{ fontFamily:"'JetBrains Mono',monospace", color:actual>0?statusColor:T.textMuted }}>{actual>0?fmtINR(actual):"—"}</span>
                      )}
                    </td>
                    <td style={{ padding:"10px 12px", textAlign:"right", fontFamily:"'JetBrains Mono',monospace", color:actual===0?T.textMuted:diff>=0?T.accent:T.red, fontWeight:600 }}>
                      {actual===0?"—":diff>=0?`+${fmtINR(diff)}`:fmtINR(diff)}
                    </td>
                    <td style={{ padding:"10px 12px", textAlign:"right" }}>
                      {actual>0 && (
                        <div style={{ display:"flex", alignItems:"center", gap:"6px", justifyContent:"flex-end" }}>
                          <div style={{ width:"50px", height:"5px", background:T.border, borderRadius:"3px", overflow:"hidden" }}>
                            <div style={{ height:"100%", width:`${Math.min(100,pct)}%`, background:statusColor, borderRadius:"3px" }}/>
                          </div>
                          <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"11px", color:statusColor, fontWeight:700, minWidth:"32px", textAlign:"right" }}>{pct}%</span>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {/* Total row */}
              <tr style={{ borderTop:`2px solid ${T.border}`, background:T.card }}>
                <td style={{ padding:"10px 16px", color:T.accent, fontWeight:700 }}>Total</td>
                <td style={{ padding:"10px 12px", textAlign:"right", fontFamily:"'JetBrains Mono',monospace", color:T.textDim, fontWeight:700 }}>{fmtINR(monthBudget())}</td>
                <td style={{ padding:"10px 12px", textAlign:"right", fontFamily:"'JetBrains Mono',monospace", color:T.accent, fontWeight:700 }}>
                  {editingMonth===selMonth ? fmtINR(categories.reduce((s,c)=>s+(Number(editVals[c.id])||0),0)) : fmtINR(monthTotal(selMonth))}
                </td>
                <td style={{ padding:"10px 12px", textAlign:"right", fontFamily:"'JetBrains Mono',monospace", fontWeight:700, color:monthTotal(selMonth)===0?T.textMuted:monthBudget()-monthTotal(selMonth)>=0?T.accent:T.red }}>
                  {monthTotal(selMonth)===0?"—":fmtINR(monthBudget()-monthTotal(selMonth))}
                </td>
                <td/>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Annual overview */}
      <div style={{ background:T.surface, borderRadius:"12px", border:`1px solid ${T.border}`, marginBottom:"24px", overflow:"hidden" }}>
        <div style={{ padding:"14px 20px", borderBottom:`1px solid ${T.border}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <span style={{ fontSize:"14px", fontWeight:700, color:T.text }}>Annual Overview</span>
          <div style={{ display:"flex", gap:"8px" }}>
          <button onClick={exportExpenses} style={{ padding:"6px 13px", background:"transparent", border:`1px solid ${T.border}`, borderRadius:"8px", color:T.textDim, fontSize:"12px", fontWeight:600, cursor:"pointer" }}>Export CSV ↓</button>
          <button onClick={()=>{ setEditBudgets(!editBudgets); setBudgetDraft(Object.fromEntries(categories.map(c=>[c.id,c.budget]))); }}
            style={{ padding:"6px 14px", background:"transparent", border:`1px solid ${T.border}`, borderRadius:"8px", color:T.textDim, fontSize:"12px", fontWeight:600, cursor:"pointer" }}>
            {editBudgets?"Cancel":"Edit Budgets"}
          </button>
          </div>
        </div>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"12px" }}>
            <thead>
              <tr style={{ background:T.card }}>
                <th style={{ padding:"8px 16px", textAlign:"left", color:T.textMuted, fontWeight:700, letterSpacing:"0.5px", position:"sticky", left:0, background:T.card, zIndex:1 }}>CATEGORY</th>
                <th style={{ padding:"8px 10px", textAlign:"right", color:T.textMuted, fontWeight:700 }}>BUDGET/MO</th>
                {MONTHS.map(m=><th key={m} style={{ padding:"8px 10px", textAlign:"right", color:T.textMuted, fontWeight:700 }}>{m.toUpperCase()}</th>)}
                <th style={{ padding:"8px 12px", textAlign:"right", color:T.accent, fontWeight:700 }}>FY TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((cat,i)=>{
                const fyTotal = MONTHS.reduce((s,_,mi)=>s+getActual(mi,cat.id),0);
                return (
                  <tr key={cat.id} style={{ borderTop:`1px solid ${T.border}`, background:i%2===0?"transparent":T.card+"44" }}>
                    <td style={{ padding:"8px 16px", position:"sticky", left:0, background:i%2===0?T.surface:T.card+"44", zIndex:1 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                        <div style={{ width:"7px", height:"7px", borderRadius:"50%", background:cat.color, flexShrink:0 }}/>
                        <span style={{ color:T.text, fontWeight:500 }}>{cat.name}</span>
                      </div>
                    </td>
                    <td style={{ padding:"8px 10px", textAlign:"right", fontFamily:"'JetBrains Mono',monospace", color:T.textDim }}>
                      {editBudgets ? (
                        <input type="number" value={budgetDraft[cat.id]??cat.budget} onChange={e=>setBudgetDraft(d=>({...d,[cat.id]:e.target.value}))}
                          style={{ ...inp, width:"90px", padding:"3px 6px", textAlign:"right", fontSize:"11px" }}/>
                      ) : fmtINR(cat.budget)}
                    </td>
                    {MONTHS.map((_,mi)=>{
                      const v = getActual(mi,cat.id);
                      const pct = cat.budget>0 ? v/cat.budget*100 : 0;
                      const c = v===0 ? T.textMuted : pct<=100 ? T.accent : pct<=120 ? T.amber : T.red;
                      return <td key={mi} style={{ padding:"8px 10px", textAlign:"right", fontFamily:"'JetBrains Mono',monospace", color:c }}>{v>0?fmtINR(v):"—"}</td>;
                    })}
                    <td style={{ padding:"8px 12px", textAlign:"right", fontFamily:"'JetBrains Mono',monospace", color:fyTotal>0?T.text:T.textMuted, fontWeight:700 }}>{fyTotal>0?fmtINR(fyTotal):"—"}</td>
                  </tr>
                );
              })}
              {/* Total row */}
              <tr style={{ borderTop:`2px solid ${T.border}`, background:T.card }}>
                <td style={{ padding:"8px 16px", color:T.accent, fontWeight:700, position:"sticky", left:0, background:T.card, zIndex:1 }}>Total</td>
                <td style={{ padding:"8px 10px", textAlign:"right", fontFamily:"'JetBrains Mono',monospace", color:T.textDim, fontWeight:700 }}>{fmtINR(monthBudget())}</td>
                {MONTHS.map((_,mi)=>{
                  const v=monthTotal(mi);
                  return <td key={mi} style={{ padding:"8px 10px", textAlign:"right", fontFamily:"'JetBrains Mono',monospace", color:v>0?T.accent:T.textMuted, fontWeight:700 }}>{v>0?fmtINR(v):"—"}</td>;
                })}
                <td style={{ padding:"8px 12px", textAlign:"right", fontFamily:"'JetBrains Mono',monospace", color:T.accent, fontWeight:800 }}>{fmtINR(ytdActual)||"—"}</td>
              </tr>
            </tbody>
          </table>
        </div>
        {editBudgets && (
          <div style={{ padding:"12px 20px", borderTop:`1px solid ${T.border}`, display:"flex", gap:"8px", justifyContent:"flex-end" }}>
            <button onClick={saveBudgets} style={{ padding:"8px 20px", background:T.accent, border:"none", borderRadius:"8px", color:T.bg, fontSize:"13px", fontWeight:700, cursor:"pointer" }}>Save Budgets</button>
          </div>
        )}
      </div>

      {/* Manage categories */}
      <div style={{ background:T.surface, borderRadius:"12px", border:`1px solid ${T.border}`, overflow:"hidden" }}>
        <div style={{ padding:"14px 20px", borderBottom:`1px solid ${T.border}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <span style={{ fontSize:"14px", fontWeight:700, color:T.text }}>Manage Categories</span>
          <button onClick={()=>setShowAddCat(!showAddCat)} style={{ padding:"7px 16px", background:showAddCat?T.card:T.accent, border:`1px solid ${showAddCat?T.border:T.accent}`, borderRadius:"8px", color:showAddCat?T.textDim:T.bg, fontSize:"12px", fontWeight:700, cursor:"pointer" }}>
            {showAddCat ? "Cancel" : "+ Add Category"}
          </button>
        </div>
        {showAddCat && (
          <div style={{ padding:"16px 20px", borderBottom:`1px solid ${T.border}`, display:"flex", gap:"10px", flexWrap:"wrap", alignItems:"flex-end" }}>
            <div style={{ flex:"1 1 150px" }}><label style={{ fontSize:"11px", color:T.textMuted, fontWeight:700, display:"block", marginBottom:"4px" }}>NAME</label>
              <input value={newCat.name} onChange={e=>setNewCat(v=>({...v,name:e.target.value}))} placeholder="e.g. Subscriptions" style={inp}/>
            </div>
            <div style={{ flex:"1 1 120px" }}><label style={{ fontSize:"11px", color:T.textMuted, fontWeight:700, display:"block", marginBottom:"4px" }}>MONTHLY BUDGET</label>
              <input type="number" value={newCat.budget} onChange={e=>setNewCat(v=>({...v,budget:e.target.value}))} placeholder="e.g. 2000" style={inp}/>
            </div>
            <div><label style={{ fontSize:"11px", color:T.textMuted, fontWeight:700, display:"block", marginBottom:"4px" }}>COLOR</label>
              <input type="color" value={newCat.color} onChange={e=>setNewCat(v=>({...v,color:e.target.value}))} style={{ width:"44px", height:"38px", padding:"2px", borderRadius:"8px", border:`1px solid ${T.border}`, background:T.card, cursor:"pointer" }}/>
            </div>
            <button onClick={addCategory} style={{ padding:"8px 20px", background:T.accent, border:"none", borderRadius:"8px", color:T.bg, fontSize:"13px", fontWeight:700, cursor:"pointer", height:"38px" }}>Add</button>
          </div>
        )}
        <div style={{ padding:"12px 20px", display:"flex", flexWrap:"wrap", gap:"8px" }}>
          {categories.map(cat=>(
            <div key={cat.id} style={{ display:"flex", alignItems:"center", gap:"8px", padding:"7px 12px", background:T.card, borderRadius:"20px", border:`1px solid ${T.border}` }}>
              <div style={{ width:"8px", height:"8px", borderRadius:"50%", background:cat.color }}/>
              <span style={{ fontSize:"12px", fontWeight:600, color:T.text }}>{cat.name}</span>
              <span style={{ fontSize:"11px", fontFamily:"'JetBrains Mono',monospace", color:T.textMuted }}>{fmtINR(cat.budget)}/mo</span>
              <button onClick={()=>deleteCategory(cat.id)} style={{ background:"none", border:"none", color:T.textMuted, cursor:"pointer", fontSize:"14px", lineHeight:1, padding:"0 2px" }} title="Remove">×</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
