import { useState, useMemo } from "react";
import { T } from "../../lib/theme";
import { fmtINR, getCurrentMonthIdx, getEsspINR } from "../../lib/formatters";
import { MONTHS, MONTH_FULL, PERSONS } from "../../lib/constants";
import { DEFAULT_CATEGORIES } from "./DailyExpensesTab";
import { downloadCSV } from "../../lib/csvExport";

// Categories pre-marked committed by default (fixed monthly costs)
const DEFAULT_COMMITTED_IDS = new Set(["rent", "utilities"]);

// ── helpers ───────────────────────────────────────────────────────────────────

function fmtL(n) {
  if (!n || n === 0) return "₹0";
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)}Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(1)}L`;
  return `₹${Math.round(n / 1000)}K`;
}

/**
 * Salary is paid at end of month M and funds expenses in month M+1.
 * Returns the FY + month-index of the PREVIOUS month relative to (mi, fy).
 * Example: mi=2 (June), fy="FY2025-26" → { prevMi:1, prevFY:"FY2025-26" }  (May)
 *          mi=0 (April), fy="FY2025-26" → { prevMi:11, prevFY:"FY2024-25" } (March)
 */
function prevMonthFY(mi, fy) {
  if (mi === 0) {
    const fyYear = parseInt(fy.slice(2, 6), 10);
    return { prevMi: 11, prevFY: `FY${fyYear - 1}-${String(fyYear).slice(2)}` };
  }
  return { prevMi: mi - 1, prevFY: fy };
}

function BudgetBar({ actual, budget, color }) {
  if (!budget) return null;
  const pct      = Math.min(actual / budget * 100, 100);
  const over     = actual > budget;
  const overPct  = over ? Math.min((actual - budget) / budget * 100, 100) : 0;
  const barColor = over ? T.red : actual / budget > 0.85 ? T.amber : T.accent;

  return (
    <div>
      <div style={{ height:"6px", background:T.border, borderRadius:"3px", overflow:"hidden", position:"relative" }}>
        <div style={{
          position:"absolute", left:0, top:0, bottom:0,
          width:`${pct}%`, background:barColor,
          borderRadius:"3px", transition:"width 0.4s ease",
        }}/>
      </div>
      {over && (
        <div style={{
          marginTop:"4px", fontSize:"10px", fontWeight:700, color:T.red,
          display:"flex", justifyContent:"space-between",
        }}>
          <span>Over by {fmtINR(actual - budget)}</span>
          <span>+{Math.round((actual - budget) / budget * 100)}%</span>
        </div>
      )}
    </div>
  );
}

// ── Monthly summary card ───────────────────────────────────────────────────────
function MonthlySummaryCard({ mi, fy, incomeData, txActuals, actuals, isTxMonth, categories }) {
  // Salary is paid at end of previous month and funds THIS month's expenses.
  // So: June spending → use May's take-home as "available income".
  const { prevMi, prevFY } = prevMonthFY(mi, fy);
  const takeHome = PERSONS.reduce((s, p) => {
    return s + (Number(incomeData?.[prevFY]?.[p]?.[prevMi]?.take_home) || 0);
  }, 0);
  const epf = PERSONS.reduce((s, p) => {
    return s + (Number(incomeData?.[prevFY]?.[p]?.[prevMi]?.epf) || 0);
  }, 0);
  const espp = PERSONS.reduce((s, p) => {
    return s + (getEsspINR(incomeData?.[prevFY]?.[p]?.[prevMi]) || 0);
  }, 0);
  const totalIncome = takeHome + epf + espp;
  const incomeSrcLabel = MONTH_FULL[prevMi]; // "May salary funds June expenses"

  // Spending this month
  const monthData = isTxMonth(mi) ? txActuals[mi] || {} : actuals?.[mi] || {};
  const totalSpent = Object.values(monthData).reduce((s, v) => s + Number(v), 0);

  // Committed vs discretionary from categories
  const committedSpent = categories
    .filter(c => c.committed)
    .reduce((s, c) => s + (Number(monthData[c.id]) || 0), 0);
  const discretionarySpent = totalSpent - committedSpent;

  const saved = totalIncome - totalSpent;
  const savingsRate = totalIncome > 0 ? saved / totalIncome * 100 : null;

  if (takeHome === 0 && totalSpent === 0) return null;

  const rateColor = savingsRate == null ? T.textDim
    : savingsRate >= 30 ? T.accent
    : savingsRate >= 15 ? T.amber
    : T.red;

  return (
    <div style={{
      background: `linear-gradient(135deg, ${T.surface}, ${T.card})`,
      borderRadius:"16px", border:`1px solid ${T.border}`,
      padding:"18px", marginBottom:"16px",
    }}>
      <div style={{ fontSize:"10px", color:T.textMuted, fontWeight:700,
        letterSpacing:"0.6px", marginBottom:"14px" }}>
        {MONTH_FULL[mi].toUpperCase()} SUMMARY
      </div>

      {/* Three-way flow: Income → Spent → Saved */}
      <div style={{ display:"flex", gap:"0", marginBottom:"14px", borderRadius:"10px", overflow:"hidden", border:`1px solid ${T.border}` }}>
        {[
          { label:"Available", value:totalIncome, color:T.blue,   note: `${incomeSrcLabel} salary` },
          { label:"Spent",     value:totalSpent,  color:T.amber,  note: null },
          { label:"Saved",     value:Math.abs(saved), color:saved >= 0 ? T.accent : T.red,
            note: savingsRate != null ? `${Math.round(savingsRate)}% rate` : null, negative: saved < 0 },
        ].map((item, i) => (
          <div key={item.label} style={{
            flex:1, padding:"12px", textAlign:"center",
            borderRight: i < 2 ? `1px solid ${T.border}` : "none",
            background: i === 2 && saved >= 0 ? `${T.accent}08` : "transparent",
          }}>
            <div style={{ fontSize:"9px", color:T.textMuted, fontWeight:700,
              letterSpacing:"0.5px", marginBottom:"4px" }}>{item.label.toUpperCase()}</div>
            <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"15px",
              fontWeight:800, color:item.color, lineHeight:1 }}>
              {item.negative ? "−" : ""}{fmtL(item.value)}
            </div>
            {item.note && (
              <div style={{ fontSize:"9px", color:T.textMuted, marginTop:"3px" }}>{item.note}</div>
            )}
          </div>
        ))}
      </div>

      {/* Savings rate bar */}
      {savingsRate !== null && (
        <div>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"4px" }}>
            <span style={{ fontSize:"10px", color:T.textMuted }}>Savings rate</span>
            <span style={{ fontSize:"11px", fontWeight:800, color:rateColor, fontFamily:"'JetBrains Mono',monospace" }}>
              {Math.round(savingsRate)}%
              {savingsRate >= 30 ? " ✓ Great" : savingsRate >= 15 ? " ⚠ Moderate" : " ✗ Low"}
            </span>
          </div>
          <div style={{ height:"5px", background:T.border, borderRadius:"3px", overflow:"hidden" }}>
            <div style={{
              height:"100%", width:`${Math.max(0, Math.min(100, savingsRate))}%`,
              background:rateColor, borderRadius:"3px", transition:"width 0.5s ease",
            }}/>
          </div>
        </div>
      )}

      {/* Committed vs Discretionary breakdown */}
      {committedSpent > 0 && discretionarySpent > 0 && (
        <div style={{
          marginTop:"12px", paddingTop:"12px", borderTop:`1px solid ${T.border}`,
          display:"flex", gap:"16px",
        }}>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:"9px", color:T.textMuted, fontWeight:700,
              letterSpacing:"0.5px", marginBottom:"2px" }}>COMMITTED (FIXED)</div>
            <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"13px",
              fontWeight:700, color:T.textDim }}>{fmtL(committedSpent)}</div>
            <div style={{ fontSize:"9px", color:T.textMuted, marginTop:"1px" }}>rent, utilities…</div>
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:"9px", color:T.textMuted, fontWeight:700,
              letterSpacing:"0.5px", marginBottom:"2px" }}>DISCRETIONARY</div>
            <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"13px",
              fontWeight:700, color:T.text }}>{fmtL(discretionarySpent)}</div>
            <div style={{ fontSize:"9px", color:T.textMuted, marginTop:"1px" }}>what you control</div>
          </div>
          {totalIncome > 0 && (
            <div style={{ flex:1 }}>
              <div style={{ fontSize:"9px", color:T.textMuted, fontWeight:700,
                letterSpacing:"0.5px", marginBottom:"2px" }}>DISCRETIONARY LEFT</div>
              <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"13px",
                fontWeight:700, color: saved >= 0 ? T.accent : T.red }}>
                {fmtL(Math.max(0, totalIncome - committedSpent - discretionarySpent))}
              </div>
              <div style={{ fontSize:"9px", color:T.textMuted, marginTop:"1px" }}>this month</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main tab ──────────────────────────────────────────────────────────────────
export default function ExpensesTab({ expensesData, fy, onUpdate, incomeData, txData, investmentsData }) {
  const inv       = expensesData?.[fy] || {};
  const actuals   = inv.actuals   || {};
  const txActuals = inv.txActuals || {};

  // Build categories with saved budget + committed flag
  const savedCatMap = Object.fromEntries(
    (inv.categories || []).map(c => [c.id, c])
  );
  const categories = DEFAULT_CATEGORIES.map(c => ({
    ...c,
    budget:    savedCatMap[c.id]?.budget    ?? 0,
    committed: savedCatMap[c.id]?.committed ?? DEFAULT_COMMITTED_IDS.has(c.id),
  }));

  const [selMonth,    setSelMonth]    = useState(getCurrentMonthIdx);
  const [editSheet,   setEditSheet]   = useState(false);
  const [editVals,    setEditVals]    = useState({});
  const [editBudgets, setEditBudgets] = useState(false);
  const [budgetDraft, setBudgetDraft] = useState({});

  const isTxMonth  = (mi) => !!txActuals[mi] && Object.keys(txActuals[mi]).length > 0;
  const getActual  = (mi, catId) => isTxMonth(mi)
    ? Number(txActuals[mi]?.[catId]) || 0
    : Number(actuals?.[mi]?.[catId]) || 0;
  const monthTotal = (mi) => isTxMonth(mi)
    ? Object.values(txActuals[mi]).reduce((s,v)=>s+Number(v),0)
    : Object.values(actuals?.[mi] || {}).reduce((s,v)=>s+Number(v),0);
  const monthBudget = () => categories.reduce((s,c)=>s+Number(c.budget||0),0);
  const committedBudget = () => categories.filter(c=>c.committed).reduce((s,c)=>s+Number(c.budget||0),0);
  const discretionaryBudget = () => monthBudget() - committedBudget();

  const enteredMonths = MONTHS.map((_,mi) => monthTotal(mi) > 0);
  const ytdActual     = MONTHS.reduce((s,_,mi) => s + monthTotal(mi), 0);
  const ytdBudget     = enteredMonths.filter(Boolean).length * monthBudget();
  const ytdSurplus    = ytdBudget - ytdActual;
  const annualBudget  = monthBudget() * 12;

  // Committed vs discretionary this month
  const committedSpent = useMemo(() => categories
    .filter(c => c.committed)
    .reduce((s,c) => s + getActual(selMonth, c.id), 0),
    [selMonth, inv, categories]
  );
  const discretionarySpent = monthTotal(selMonth) - committedSpent;

  const updateInv = (patch) => onUpdate(fy, { ...inv, categories, actuals, ...patch });

  const exportExpenses = () => {
    const headers = ["Category", "Budget/Month", "Committed", ...MONTHS, "FY Total Actual", "FY Budget", "Variance"];
    const rows = categories.map(c => {
      const monthly = MONTHS.map((_,mi) => getActual(mi, c.id));
      const fyTotal = monthly.reduce((s,v)=>s+v,0);
      const fyBudget = Number(c.budget||0) * 12;
      return [c.name, c.budget, c.committed?"Yes":"No", ...monthly, fyTotal, fyBudget, fyBudget - fyTotal];
    });
    const totals = ["TOTAL", monthBudget(), "", ...MONTHS.map((_,mi)=>monthTotal(mi)), ytdActual, annualBudget, annualBudget-ytdActual];
    downloadCSV(`expenses_${fy}.csv`, [headers, ...rows, totals]);
  };

  const openEdit = () => {
    if (isTxMonth(selMonth)) return;
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
    const updated = categories.map(c => ({
      ...c,
      budget:    Number(budgetDraft[c.id]?.budget    ?? c.budget)    || 0,
      committed: budgetDraft[c.id]?.committed ?? c.committed,
    }));
    updateInv({ categories: updated });
    setEditBudgets(false);
  };

  const inp = {
    padding:"12px 14px", background:T.card, border:`1px solid ${T.border}`,
    borderRadius:"10px", color:T.text, fontSize:"15px", outline:"none",
    width:"100%", boxSizing:"border-box", fontFamily:"'JetBrains Mono',monospace",
  };

  const total  = monthTotal(selMonth);
  const budget = monthBudget();
  const overBudget = budget > 0 && total > budget;

  // Category rows for selected month, enriched
  const catRows = useMemo(() => categories
    .map(cat => ({ ...cat, actual: getActual(selMonth, cat.id) }))
    .filter(c => c.actual > 0 || c.budget > 0)
    .sort((a,b) => {
      // committed first, then by actual descending
      if (a.committed !== b.committed) return a.committed ? -1 : 1;
      return b.actual - a.actual;
    }),
    [selMonth, inv, categories]
  );

  return (
    <div style={{ paddingBottom:"80px" }}>

      {/* ── Top summary cards ── */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))", gap:"10px", marginBottom:"16px" }}>
        {[
          { label:"Annual Budget",       value:fmtINR(annualBudget),  color:T.textDim },
          { label:"YTD Spent",           value:fmtINR(ytdActual),     color:T.amber },
          { label:"YTD Surplus",         value:fmtINR(Math.abs(ytdSurplus)), color:ytdSurplus>=0?T.accent:T.red, prefix:ytdSurplus<0?"−":"" },
          { label:"Committed / Month",   value:fmtINR(committedBudget()),  color:T.blue, sub:"fixed costs" },
          { label:"Discretionary / Month", value:fmtINR(discretionaryBudget()), color:T.purple, sub:"flexible spend" },
        ].map(c => (
          <div key={c.label} style={{ background:T.surface, borderRadius:"12px",
            border:`1px solid ${T.border}`, padding:"12px 14px" }}>
            <div style={{ fontSize:"9px", color:T.textMuted, fontWeight:700,
              letterSpacing:"0.5px", marginBottom:"6px", textTransform:"uppercase" }}>{c.label}</div>
            <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"14px",
              fontWeight:800, color:c.color, lineHeight:1 }}>
              {c.prefix||""}{c.value}
            </div>
            {c.sub && <div style={{ fontSize:"9px", color:T.textMuted, marginTop:"3px" }}>{c.sub}</div>}
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
              {isTxMonth(mi) ? " ✓" : ""}
            </option>
          ))}
        </select>
      </div>

      {/* ── 2-C: Monthly financial summary (needs income data) ── */}
      {incomeData && (
        <MonthlySummaryCard
          mi={selMonth} fy={fy}
          incomeData={incomeData}
          txActuals={txActuals} actuals={actuals}
          isTxMonth={isTxMonth}
          categories={categories}
        />
      )}

      {/* ── Month hero card ── */}
      <div style={{
        background: overBudget
          ? `linear-gradient(135deg, rgba(239,68,68,0.08), ${T.card})`
          : `linear-gradient(135deg, ${T.surface}, ${T.card})`,
        borderRadius:"16px",
        border:`1px solid ${overBudget ? T.red + "66" : T.border}`,
        padding:"18px", marginBottom:"16px",
      }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"14px" }}>
          <div>
            <div style={{ fontSize:"11px", color:T.textMuted, fontWeight:700,
              letterSpacing:"0.5px", marginBottom:"4px" }}>
              {MONTH_FULL[selMonth].toUpperCase()} SPEND
            </div>
            <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"28px",
              fontWeight:800, color: overBudget ? T.red : T.text, lineHeight:1 }}>
              {total > 0 ? fmtINR(total) : "—"}
            </div>
            {budget > 0 && (
              <div style={{ fontSize:"11px", marginTop:"4px",
                color: overBudget ? T.red : T.textMuted }}>
                {overBudget
                  ? `Over budget by ${fmtINR(total - budget)}`
                  : `${fmtINR(budget - total)} remaining of ${fmtINR(budget)}`}
              </div>
            )}
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:"6px", alignItems:"flex-end" }}>
            {/* Committed vs discretionary mini badges */}
            {committedSpent > 0 && (
              <div style={{ fontSize:"10px", color:T.blue, fontWeight:700,
                background:`${T.blue}15`, padding:"3px 8px", borderRadius:"6px" }}>
                🔒 Committed {fmtINR(committedSpent)}
              </div>
            )}
            {discretionarySpent > 0 && (
              <div style={{ fontSize:"10px", color:T.purple, fontWeight:700,
                background:`${T.purple}15`, padding:"3px 8px", borderRadius:"6px" }}>
                ✦ Flexible {fmtINR(discretionarySpent)}
              </div>
            )}
            {isTxMonth(selMonth) ? (
              <div style={{ padding:"6px 12px", background:"rgba(34,197,94,0.08)", border:`1px solid ${T.accent}`,
                borderRadius:"8px", fontSize:"11px", color:T.accent, fontWeight:600 }}>
                ✓ Synced
              </div>
            ) : (
              <button onClick={openEdit}
                style={{ padding:"8px 16px", background:T.cta, border:"none",
                  borderRadius:"8px", color:"#fff", fontSize:"12px", fontWeight:700, cursor:"pointer" }}>
                Edit Month
              </button>
            )}
          </div>
        </div>

        {/* Total budget progress bar */}
        {budget > 0 && (
          <div>
            {/* Segmented bar: committed (blue) + discretionary (purple) stacked */}
            <div style={{ height:"8px", background:T.border, borderRadius:"4px",
              overflow:"hidden", position:"relative", display:"flex" }}>
              <div style={{
                height:"100%",
                width:`${Math.min(100, committedSpent/budget*100)}%`,
                background:T.blue, borderRadius:"4px 0 0 4px",
                transition:"width 0.4s",
              }}/>
              <div style={{
                height:"100%",
                width:`${Math.min(100 - Math.min(100, committedSpent/budget*100), discretionarySpent/budget*100)}%`,
                background: overBudget ? T.red : T.purple,
                transition:"width 0.4s",
              }}/>
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", marginTop:"4px" }}>
              <div style={{ display:"flex", gap:"10px", fontSize:"9px" }}>
                <span style={{ color:T.blue }}>▬ Committed</span>
                <span style={{ color:overBudget ? T.red : T.purple }}>▬ Flexible</span>
              </div>
              <span style={{ fontSize:"10px", color:overBudget?T.red:T.textMuted, fontWeight:600 }}>
                {Math.round(total/budget*100)}% used
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ── 2-A: Category breakdown cards ── */}
      {catRows.length > 0 && (
        <div style={{ display:"flex", flexDirection:"column", gap:"8px", marginBottom:"16px" }}>
          {catRows.map(cat => {
            const pct = cat.budget > 0 ? Math.round(cat.actual / cat.budget * 100) : null;
            const over = cat.budget > 0 && cat.actual > cat.budget;
            const borderColor = over ? T.red + "66"
              : cat.budget > 0 && cat.actual / cat.budget > 0.85 ? T.amber + "44"
              : T.border;
            const valueColor = cat.actual === 0 ? T.textMuted
              : over ? T.red
              : cat.budget > 0 && cat.actual / cat.budget > 0.85 ? T.amber
              : T.text;

            return (
              <div key={cat.id} style={{
                background:T.surface, borderRadius:"12px",
                border:`1px solid ${borderColor}`,
                padding:"14px",
              }}>
                <div style={{ display:"flex", alignItems:"center", gap:"10px", marginBottom: cat.budget > 0 && cat.actual > 0 ? "10px" : "0" }}>
                  {/* Color dot + committed indicator */}
                  <div style={{ position:"relative", flexShrink:0 }}>
                    <div style={{ width:"10px", height:"10px", borderRadius:"50%", background:cat.color }}/>
                    {cat.committed && (
                      <div style={{
                        position:"absolute", top:"-4px", right:"-4px",
                        width:"7px", height:"7px", borderRadius:"50%",
                        background:T.blue, border:`1px solid ${T.surface}`,
                      }}/>
                    )}
                  </div>

                  <div style={{ flex:1, display:"flex", alignItems:"center", gap:"6px" }}>
                    <span style={{ fontSize:"14px", fontWeight:600, color:T.text }}>{cat.name}</span>
                    {cat.committed && (
                      <span style={{ fontSize:"9px", color:T.blue, fontWeight:700,
                        background:`${T.blue}15`, padding:"1px 5px", borderRadius:"4px" }}>
                        FIXED
                      </span>
                    )}
                  </div>

                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"15px",
                      fontWeight:800, color:cat.actual>0?valueColor:T.textMuted }}>
                      {cat.actual > 0 ? fmtINR(cat.actual) : "—"}
                    </div>
                    {cat.budget > 0 && (
                      <div style={{ fontSize:"10px", color:T.textMuted, marginTop:"1px" }}>
                        of {fmtINR(cat.budget)}
                        {pct !== null ? (
                          <span style={{ color:valueColor, fontWeight:700 }}> · {pct}%</span>
                        ) : ""}
                      </div>
                    )}
                  </div>
                </div>

                {/* 2-A: Improved progress bar */}
                {cat.budget > 0 && cat.actual > 0 && (
                  <BudgetBar actual={cat.actual} budget={cat.budget} color={cat.color}/>
                )}

                {/* No budget set — show share of total */}
                {cat.budget === 0 && cat.actual > 0 && total > 0 && (
                  <div style={{ height:"4px", background:T.border, borderRadius:"2px", overflow:"hidden" }}>
                    <div style={{ height:"100%", width:`${cat.actual/total*100}%`,
                      background:cat.color, borderRadius:"2px", transition:"width 0.4s", opacity:0.7 }}/>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Action row ── */}
      <div style={{ display:"flex", gap:"10px", marginBottom:"16px" }}>
        <button onClick={() => {
          setEditBudgets(!editBudgets);
          setBudgetDraft(Object.fromEntries(categories.map(c => [c.id, { budget: c.budget, committed: c.committed }])));
        }}
          style={{ flex:1, padding:"12px", background:editBudgets?T.ctaDim:T.card,
            border:`1px solid ${editBudgets?T.ctaBorder:T.border}`,
            borderRadius:"10px", color:editBudgets?T.cta:T.textDim,
            fontSize:"13px", fontWeight:600, cursor:"pointer" }}>
          {editBudgets ? "✕ Cancel" : "⚙ Edit Budgets"}
        </button>
        <button onClick={exportExpenses}
          style={{ flex:1, padding:"12px", background:T.card, border:`1px solid ${T.border}`,
            borderRadius:"10px", color:T.textDim, fontSize:"13px", fontWeight:600, cursor:"pointer" }}>
          Export CSV ↓
        </button>
      </div>

      {/* ── 2-B: Budget + committed editor ── */}
      {editBudgets && (
        <div style={{ background:T.surface, borderRadius:"14px", border:`1px solid ${T.border}`,
          padding:"16px", marginBottom:"16px" }}>
          <div style={{ fontSize:"12px", fontWeight:700, color:T.textMuted,
            letterSpacing:"0.5px", marginBottom:"6px" }}>MONTHLY BUDGETS + COMMITTED</div>
          <div style={{ fontSize:"11px", color:T.textMuted, marginBottom:"14px", lineHeight:1.5 }}>
            Toggle <span style={{ color:T.blue, fontWeight:700 }}>🔒 Fixed</span> for categories that recur every month
            regardless (rent, utilities, EMI). These are separated in the monthly summary.
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
            {categories.map(cat => (
              <div key={cat.id} style={{
                display:"flex", alignItems:"center", gap:"10px",
                padding:"10px 12px", background:T.card, borderRadius:"8px",
                border:`1px solid ${budgetDraft[cat.id]?.committed ? T.blue + "44" : T.border}`,
              }}>
                <div style={{ width:"8px", height:"8px", borderRadius:"50%",
                  background:cat.color, flexShrink:0 }}/>
                <span style={{ fontSize:"13px", fontWeight:600, color:T.text, flex:1 }}>
                  {cat.name}
                </span>
                {/* Committed toggle */}
                <button onClick={() =>
                  setBudgetDraft(d => ({ ...d, [cat.id]: { ...d[cat.id], committed: !d[cat.id]?.committed } }))
                } style={{
                  padding:"4px 10px", border:"none", borderRadius:"6px", cursor:"pointer",
                  fontSize:"10px", fontWeight:700, transition:"all 0.15s",
                  background: budgetDraft[cat.id]?.committed ? T.blue : T.border,
                  color: budgetDraft[cat.id]?.committed ? "#fff" : T.textMuted,
                }}>
                  🔒 Fixed
                </button>
                <input type="number"
                  value={budgetDraft[cat.id]?.budget ?? cat.budget}
                  onChange={e => setBudgetDraft(d => ({ ...d, [cat.id]: { ...d[cat.id], budget: e.target.value } }))}
                  placeholder="0"
                  style={{ ...inp, width:"110px", fontSize:"14px", padding:"8px 10px" }}/>
              </div>
            ))}
          </div>
          {/* Budget total preview */}
          <div style={{ marginTop:"14px", padding:"10px 12px", background:T.card, borderRadius:"8px",
            display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <span style={{ fontSize:"12px", color:T.textMuted }}>Monthly budget total</span>
            <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"15px",
              fontWeight:800, color:T.text }}>
              {fmtINR(Object.values(budgetDraft).reduce((s,v) => s + (Number(v?.budget) || 0), 0))}
            </span>
          </div>
          <button onClick={saveBudgets}
            style={{ marginTop:"12px", width:"100%", padding:"14px", background:T.cta,
              border:"none", borderRadius:"10px", color:"#fff",
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
            const fyTotal  = MONTHS.reduce((s,_,mi) => s + getActual(mi,cat.id), 0);
            const fyBudget = (cat.budget||0) * 12;
            const months   = MONTHS.filter((_,mi) => getActual(mi,cat.id)>0).length;
            if (fyTotal === 0 && fyBudget === 0) return null;
            const pct = fyBudget > 0 ? Math.round(fyTotal/fyBudget*100) : null;
            const gc  = !pct ? T.text : pct<=100?T.accent:pct<=120?T.amber:T.red;
            return (
              <div key={cat.id}>
                <div style={{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"4px" }}>
                  <div style={{ position:"relative", flexShrink:0 }}>
                    <div style={{ width:"8px", height:"8px", borderRadius:"50%", background:cat.color }}/>
                    {cat.committed && (
                      <div style={{ position:"absolute", top:"-3px", right:"-3px",
                        width:"5px", height:"5px", borderRadius:"50%",
                        background:T.blue, border:`1px solid ${T.surface}` }}/>
                    )}
                  </div>
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
                      <div style={{ fontSize:"10px", color:T.textMuted }}>{months} mo</div>
                    )}
                  </div>
                </div>
                {fyBudget > 0 && fyTotal > 0 && (
                  <div style={{ marginLeft:"18px", height:"3px", background:T.border,
                    borderRadius:"2px", overflow:"hidden" }}>
                    <div style={{ height:"100%", width:`${Math.min(100,pct)}%`,
                      background:gc, borderRadius:"2px", transition:"width 0.4s" }}/>
                  </div>
                )}
              </div>
            );
          })}
          <div style={{ borderTop:`1px solid ${T.border}`, paddingTop:"10px", marginTop:"4px",
            display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <span style={{ fontSize:"13px", fontWeight:700, color:T.text }}>YTD Total</span>
            <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"14px",
              fontWeight:800, color: ytdSurplus >= 0 ? T.accent : T.red }}>
              {fmtINR(ytdActual)}
              {ytdBudget > 0 && (
                <span style={{ fontSize:"10px", color:T.textMuted, fontWeight:400, marginLeft:"6px" }}>
                  of {fmtINR(ytdBudget)} budget
                </span>
              )}
            </span>
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
                    {cat.committed && <span style={{ color:T.blue }}>🔒</span>}
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
              style={{ marginTop:"20px", width:"100%", padding:"16px", background:T.cta,
                border:"none", borderRadius:"12px", color:"#fff",
                fontSize:"16px", fontWeight:800, cursor:"pointer" }}>
              Save {MONTH_FULL[selMonth]} Actuals
            </button>
          </div>
        </>
      )}
    </div>
  );
}
