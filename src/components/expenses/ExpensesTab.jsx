import { useState } from "react";
import { T } from "../../lib/theme";
import { fmtINR, getCurrentMonthIdx } from "../../lib/formatters";
import { MONTHS, MONTH_FULL } from "../../lib/constants";
import { DEFAULT_CATEGORIES } from "./DailyExpensesTab";
import { downloadCSV } from "../../lib/csvExport";

export default function ExpensesTab({ expensesData, fy, onUpdate }) {
  const inv     = expensesData?.[fy] || {};
  const actuals = inv.actuals || {};

  const savedBudgetById = Object.fromEntries(
    (inv.categories || []).map(c => [c.id, c.budget || 0])
  );
  const categories = DEFAULT_CATEGORIES.map(c => ({
    ...c,
    budget: savedBudgetById[c.id] ?? 0,
  }));

  const [selMonth,     setSelMonth]     = useState(getCurrentMonthIdx);
  const [editSheet,    setEditSheet]    = useState(false);
  const [editVals,     setEditVals]     = useState({});
  const [editBudgets,  setEditBudgets]  = useState(false);
  const [budgetDraft,  setBudgetDraft]  = useState({});

  const getActual  = (mi, catId) => Number(actuals?.[mi]?.[catId]) || 0;
  const monthTotal = (mi) => Object.values(actuals?.[mi] || {}).reduce((s,v)=>s+Number(v),0);
  const monthBudget= () => categories.reduce((s,c)=>s+Number(c.budget||0),0);

  const enteredMonths  = MONTHS.map((_,mi) => monthTotal(mi) > 0);
  const ytdActual      = MONTHS.reduce((s,_,mi) => s + monthTotal(mi), 0);
  const ytdBudget      = enteredMonths.filter(Boolean).length * monthBudget();
  const ytdSurplus     = ytdBudget - ytdActual;
  const annualBudget   = monthBudget() * 12;

  const updateInv = (patch) => onUpdate(fy, { ...inv, categories, actuals, ...patch });

  const exportExpenses = () => {
    const headers = ["Category", "Budget/Month", ...MONTHS, "FY Total Actual", "FY Budget", "Variance"];
    const rows = categories.map(c => {
      const monthly = MONTHS.map((_,mi) => getActual(mi, c.id));
      const fyTotal = monthly.reduce((s,v)=>s+v,0);
      const fyBudget = Number(c.budget||0) * 12;
      return [c.name, c.budget, ...monthly, fyTotal, fyBudget, fyBudget - fyTotal];
    });
    const totals = ["TOTAL", monthBudget(), ...MONTHS.map((_,mi)=>monthTotal(mi)), ytdActual, annualBudget, annualBudget-ytdActual];
    downloadCSV(`expenses_${fy}.csv`, [headers, ...rows, totals]);
  };

  const openEdit = () => {
    const draft = {};
    categories.forEach(c => { draft[c.id] = getActual(selMonth, c.id) || ""; });
    setEditVals(draft);
    setEditSheet(true);
  };

  const saveEdit = () => {
    const newActuals = { ...actuals, [selMonth]: {} };
    categories.forEach(c => { const v = Number(editVals[c.id])||0; if (v>0) newActuals[selMonth][c.id] = v; });
    updateInv({ actuals: newActuals });
    setEditSheet(false);
  };

  const saveBudgets = () => {
    const updated = categories.map(c => ({ ...c, budget: Number(budgetDraft[c.id]??c.budget)||0 }));
    updateInv({ categories: updated });
    setEditBudgets(false);
  };

  const inp = {
    padding:"12px 14px", background:T.card, border:`1px solid ${T.border}`,
    borderRadius:"10px", color:T.text, fontSize:"15px", outline:"none",
    width:"100%", boxSizing:"border-box", fontFamily:"'JetBrains Mono',monospace",
  };

  const total = monthTotal(selMonth);
  const budget = monthBudget();

  return (
    <div style={{ paddingBottom:"80px" }}>

      {/* ── Summary strip ── */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:"10px", marginBottom:"16px" }}>
        {[
          { label:"Annual Budget", value:fmtINR(annualBudget),  color:T.textDim },
          { label:"YTD Spent",     value:fmtINR(ytdActual),     color:T.amber },
          { label:"YTD Surplus",   value:fmtINR(ytdSurplus),    color:ytdSurplus>=0?T.accent:T.red },
        ].map(c => (
          <div key={c.label} style={{ background:T.surface, borderRadius:"12px",
            border:`1px solid ${T.border}`, padding:"12px" }}>
            <div style={{ fontSize:"9px", color:T.textMuted, fontWeight:700,
              letterSpacing:"0.5px", marginBottom:"6px", textTransform:"uppercase" }}>{c.label}</div>
            <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"13px",
              fontWeight:800, color:c.color, lineHeight:1 }}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* ── Month selector ── */}
      <div style={{ marginBottom:"16px" }}>
        <select value={selMonth} onChange={e => setSelMonth(Number(e.target.value))}
          style={{ width:"100%", padding:"10px 14px", borderRadius:"10px",
            background:T.card, border:`1px solid ${T.border}`,
            color:T.text, fontSize:"14px", fontWeight:700,
            outline:"none", cursor:"pointer", appearance:"none",
            fontFamily:"'DM Sans',-apple-system,sans-serif" }}>
          {MONTHS.map((m,mi) => (
            <option key={m} value={mi}>
              {MONTH_FULL[mi]}{monthTotal(mi)>0 ? ` · ${fmtINR(monthTotal(mi))}` : ""}
            </option>
          ))}
        </select>
      </div>

      {/* ── Month hero card ── */}
      <div style={{ background:`linear-gradient(135deg,${T.surface},${T.card})`,
        borderRadius:"16px", border:`1px solid ${T.border}`,
        padding:"18px", marginBottom:"16px" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"14px" }}>
          <div>
            <div style={{ fontSize:"11px", color:T.textMuted, fontWeight:700,
              letterSpacing:"0.5px", marginBottom:"4px" }}>
              {MONTH_FULL[selMonth].toUpperCase()} SPEND
            </div>
            <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"28px",
              fontWeight:800, color:T.text, lineHeight:1 }}>
              {total > 0 ? fmtINR(total) : "—"}
            </div>
            {budget > 0 && (
              <div style={{ fontSize:"11px", color:T.textMuted, marginTop:"4px" }}>
                of {fmtINR(budget)} budget
              </div>
            )}
          </div>
          <button onClick={openEdit}
            style={{ padding:"10px 18px", background:T.accent, border:"none",
              borderRadius:"10px", color:T.bg, fontSize:"13px", fontWeight:700,
              cursor:"pointer", whiteSpace:"nowrap" }}>
            Edit Month
          </button>
        </div>
        {/* Budget progress bar */}
        {budget > 0 && (
          <div style={{ height:"5px", background:T.card, borderRadius:"3px", overflow:"hidden" }}>
            <div style={{ height:"100%", borderRadius:"3px", transition:"width 0.4s",
              width:`${Math.min(100, total/budget*100)}%`,
              background: total/budget <= 1 ? T.accent : T.red }}/>
          </div>
        )}
      </div>

      {/* ── Category breakdown cards ── */}
      {total > 0 && (
        <div style={{ display:"flex", flexDirection:"column", gap:"8px", marginBottom:"16px" }}>
          {categories
            .map(cat => ({ ...cat, actual: getActual(selMonth, cat.id) }))
            .filter(c => c.actual > 0 || c.budget > 0)
            .sort((a,b) => b.actual - a.actual)
            .map(cat => {
              const pct = cat.budget > 0 ? Math.round(cat.actual / cat.budget * 100) : null;
              const statusColor = cat.actual === 0 ? T.textMuted
                : pct === null ? T.accent
                : pct <= 100 ? T.accent : pct <= 120 ? T.amber : T.red;
              return (
                <div key={cat.id} style={{ background:T.surface, borderRadius:"12px",
                  border:`1px solid ${T.border}`, padding:"14px" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
                    <div style={{ width:"10px", height:"10px", borderRadius:"50%",
                      background:cat.color, flexShrink:0 }}/>
                    <span style={{ fontSize:"14px", fontWeight:600, color:T.text, flex:1 }}>
                      {cat.name}
                    </span>
                    <div style={{ textAlign:"right" }}>
                      <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"14px",
                        fontWeight:800, color:cat.actual>0?statusColor:T.textMuted }}>
                        {cat.actual > 0 ? fmtINR(cat.actual) : "—"}
                      </div>
                      {cat.budget > 0 && (
                        <div style={{ fontSize:"10px", color:T.textMuted, marginTop:"1px" }}>
                          {fmtINR(cat.budget)} budget{pct!==null?` · ${pct}%`:""}
                        </div>
                      )}
                    </div>
                  </div>
                  {cat.budget > 0 && cat.actual > 0 && (
                    <div style={{ height:"3px", background:T.card, borderRadius:"2px",
                      overflow:"hidden", marginTop:"10px" }}>
                      <div style={{ height:"100%", borderRadius:"2px", transition:"width 0.4s",
                        width:`${Math.min(100,pct)}%`, background:statusColor }}/>
                    </div>
                  )}
                </div>
              );
            })
          }
        </div>
      )}

      {/* ── Action row ── */}
      <div style={{ display:"flex", gap:"10px", marginBottom:"16px" }}>
        <button onClick={()=>{ setEditBudgets(!editBudgets); setBudgetDraft(Object.fromEntries(categories.map(c=>[c.id,c.budget]))); }}
          style={{ flex:1, padding:"12px", background:T.card, border:`1px solid ${T.border}`,
            borderRadius:"10px", color:T.textDim, fontSize:"13px", fontWeight:600, cursor:"pointer" }}>
          {editBudgets ? "Cancel Budgets" : "Edit Budgets"}
        </button>
        <button onClick={exportExpenses}
          style={{ flex:1, padding:"12px", background:T.card, border:`1px solid ${T.border}`,
            borderRadius:"10px", color:T.textDim, fontSize:"13px", fontWeight:600, cursor:"pointer" }}>
          Export CSV ↓
        </button>
      </div>

      {/* ── Budget editor ── */}
      {editBudgets && (
        <div style={{ background:T.surface, borderRadius:"14px", border:`1px solid ${T.border}`,
          padding:"16px", marginBottom:"16px" }}>
          <div style={{ fontSize:"12px", fontWeight:700, color:T.textMuted,
            letterSpacing:"0.5px", marginBottom:"14px" }}>MONTHLY BUDGETS</div>
          <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
            {categories.map(cat => (
              <div key={cat.id} style={{ display:"flex", alignItems:"center", gap:"12px" }}>
                <div style={{ width:"8px", height:"8px", borderRadius:"50%",
                  background:cat.color, flexShrink:0 }}/>
                <span style={{ fontSize:"13px", fontWeight:600, color:T.text, flex:1 }}>
                  {cat.name}
                </span>
                <input type="number" value={budgetDraft[cat.id]??cat.budget}
                  onChange={e => setBudgetDraft(d=>({...d,[cat.id]:e.target.value}))}
                  placeholder="0" style={{ ...inp, width:"120px", fontSize:"14px", padding:"8px 10px" }}/>
              </div>
            ))}
          </div>
          <button onClick={saveBudgets}
            style={{ marginTop:"16px", width:"100%", padding:"14px", background:T.accent,
              border:"none", borderRadius:"10px", color:T.bg,
              fontSize:"15px", fontWeight:800, cursor:"pointer" }}>
            Save Budgets
          </button>
        </div>
      )}

      {/* ── Annual overview ── */}
      <div style={{ background:T.surface, borderRadius:"14px", border:`1px solid ${T.border}`,
        padding:"16px" }}>
        <div style={{ fontSize:"12px", fontWeight:700, color:T.textMuted,
          letterSpacing:"0.5px", marginBottom:"14px" }}>FY ANNUAL OVERVIEW</div>
        <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
          {categories.map(cat => {
            const fyTotal = MONTHS.reduce((s,_,mi) => s + getActual(mi,cat.id), 0);
            const fyBudget = (cat.budget||0) * 12;
            const months = MONTHS.filter((_,mi) => getActual(mi,cat.id)>0).length;
            if (fyTotal === 0 && fyBudget === 0) return null;
            const pct = fyBudget > 0 ? Math.round(fyTotal/fyBudget*100) : null;
            const gc = !pct ? T.accent : pct<=100?T.accent:pct<=120?T.amber:T.red;
            return (
              <div key={cat.id} style={{ display:"flex", alignItems:"center", gap:"10px" }}>
                <div style={{ width:"8px", height:"8px", borderRadius:"50%",
                  background:cat.color, flexShrink:0 }}/>
                <span style={{ fontSize:"13px", fontWeight:500, color:T.text, flex:1, minWidth:0,
                  whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                  {cat.name}
                </span>
                <div style={{ textAlign:"right", flexShrink:0 }}>
                  <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"12px",
                    fontWeight:700, color:fyTotal>0?gc:T.textMuted }}>
                    {fyTotal>0?fmtINR(fyTotal):"—"}
                    {pct!==null && fyTotal>0 && (
                      <span style={{ color:T.textMuted, fontWeight:400, fontSize:"10px" }}> {pct}%</span>
                    )}
                  </div>
                  {months>0 && (
                    <div style={{ fontSize:"10px", color:T.textMuted }}>{months} month{months!==1?"s":""}</div>
                  )}
                </div>
              </div>
            );
          })}
          <div style={{ borderTop:`1px solid ${T.border}`, paddingTop:"10px", marginTop:"4px",
            display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <span style={{ fontSize:"13px", fontWeight:700, color:T.accent }}>Total</span>
            <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"14px",
              fontWeight:800, color:T.accent }}>{fmtINR(ytdActual)}</span>
          </div>
        </div>
      </div>

      {/* ── Edit month bottom sheet ── */}
      {editSheet && (
        <>
          <div onClick={() => setEditSheet(false)}
            style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)",
              zIndex:100, backdropFilter:"blur(2px)" }}/>
          <div style={{ position:"fixed", bottom:0, left:0, right:0, zIndex:101,
            background:T.surface, borderRadius:"20px 20px 0 0",
            border:`1px solid ${T.border}`, borderBottom:"none",
            padding:"0 20px 32px", maxHeight:"90dvh", overflowY:"auto" }}>
            <div style={{ display:"flex", justifyContent:"center", padding:"12px 0 16px" }}>
              <div style={{ width:"36px", height:"4px", borderRadius:"2px", background:T.border }}/>
            </div>
            <div style={{ fontSize:"16px", fontWeight:800, color:T.text, marginBottom:"20px" }}>
              {MONTH_FULL[selMonth]} Actuals
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:"12px" }}>
              {categories.map(cat => (
                <div key={cat.id}>
                  <label style={{ fontSize:"11px", color:T.textMuted, fontWeight:700,
                    letterSpacing:"0.5px", display:"flex", alignItems:"center",
                    gap:"6px", marginBottom:"6px" }}>
                    <span style={{ width:"8px", height:"8px", borderRadius:"50%",
                      background:cat.color, display:"inline-block" }}/>
                    {cat.name.toUpperCase()}
                    {cat.budget>0 && (
                      <span style={{ color:T.textMuted, fontWeight:400, fontSize:"10px" }}>
                        · budget {fmtINR(cat.budget)}
                      </span>
                    )}
                  </label>
                  <input type="number" value={editVals[cat.id]||""} placeholder="0"
                    onChange={e => setEditVals(v=>({...v,[cat.id]:e.target.value}))}
                    style={{ ...inp, fontSize:"20px", fontWeight:700 }}/>
                </div>
              ))}
            </div>
            <button onClick={saveEdit}
              style={{ marginTop:"20px", width:"100%", padding:"16px", background:T.accent,
                border:"none", borderRadius:"12px", color:T.bg,
                fontSize:"16px", fontWeight:800, cursor:"pointer" }}>
              Save {MONTH_FULL[selMonth]} Actuals
            </button>
          </div>
        </>
      )}
    </div>
  );
}
