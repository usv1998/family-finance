import { useState, useMemo } from "react";
import { T } from "../../lib/theme";
import { fmtINR, genId } from "../../lib/formatters";
import { PERSONS } from "../../lib/constants";

// ── Category colours shared with ExpensesTab seed ─────────────────────────
const DEFAULT_CATEGORIES = [
  { id:"rent",      name:"Rent",       color:"#3B82F6" },
  { id:"parents",   name:"Parents",    color:"#F59E0B" },
  { id:"groceries", name:"Groceries",  color:"#22C55E" },
  { id:"dining",    name:"Dining Out", color:"#14B8A6" },
  { id:"shopping",  name:"Shopping",   color:"#A855F7" },
  { id:"travel",    name:"Travel",     color:"#EC4899" },
  { id:"utilities", name:"Utilities",  color:"#8B96AD" },
  { id:"medical",   name:"Medical",    color:"#EF4444" },
  { id:"misc",      name:"Misc",       color:"#5A6580" },
];

// ── Helpers ────────────────────────────────────────────────────────────────

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function calMonths(txList) {
  // Return sorted list of "YYYY-MM" strings that have transactions
  const set = new Set(txList.map(t => t.date.slice(0, 7)));
  return [...set].sort().reverse();
}

function displayDate(iso) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function displayMonth(ym) {
  const [y, m] = ym.split("-");
  return new Date(Number(y), Number(m) - 1).toLocaleString("en-IN", { month: "long", year: "numeric" });
}

// ── Mini bar chart (pure CSS) ──────────────────────────────────────────────
function BarChart({ data, total }) {
  // data: [{ label, value, color }]
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
      {data.map(d => (
        <div key={d.label} style={{ display:"flex", alignItems:"center", gap:"10px" }}>
          <div style={{ width:"90px", fontSize:"11px", color:T.textDim, fontWeight:600,
            whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", flexShrink:0 }}>{d.label}</div>
          <div style={{ flex:1, height:"10px", background:T.card, borderRadius:"5px", overflow:"hidden" }}>
            <div style={{ height:"100%", width:`${(d.value / max) * 100}%`,
              background:d.color, borderRadius:"5px", transition:"width 0.3s" }}/>
          </div>
          <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"11px",
            color:T.textDim, fontWeight:700, minWidth:"70px", textAlign:"right", flexShrink:0 }}>
            {fmtINR(d.value)}
            {total > 0 && (
              <span style={{ color:T.textMuted, fontWeight:400 }}> {Math.round(d.value/total*100)}%</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Daily timeline chart (sparkline bars) ─────────────────────────────────
function DailyChart({ txList, month }) {
  const days = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    const count = new Date(y, m, 0).getDate();
    const map = {};
    txList.forEach(t => {
      if (t.date.slice(0, 7) !== month) return;
      const d = Number(t.date.slice(8, 10));
      map[d] = (map[d] || 0) + Number(t.amount);
    });
    return Array.from({ length: count }, (_, i) => ({ day: i + 1, val: map[i + 1] || 0 }));
  }, [txList, month]);

  const max = Math.max(...days.map(d => d.val), 1);

  return (
    <div style={{ display:"flex", alignItems:"flex-end", gap:"2px", height:"48px" }}>
      {days.map(({ day, val }) => (
        <div key={day} title={`${day}: ${fmtINR(val)}`}
          style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"flex-end", height:"100%" }}>
          <div style={{ width:"100%", borderRadius:"2px 2px 0 0",
            background: val > 0 ? T.accent : T.border,
            height: `${Math.max(val > 0 ? 8 : 2, (val / max) * 44)}px`,
            opacity: val > 0 ? 0.85 : 0.3 }}/>
        </div>
      ))}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export default function DailyExpensesTab({ txData, expensesData, onAddTx, onDeleteTx }) {
  const categories = expensesData?.["FY2026-27"]?.categories || DEFAULT_CATEGORIES;

  const [form, setForm] = useState({
    date: todayISO(),
    amount: "",
    categoryId: categories[0]?.id || "misc",
    name: "",
    person: "Selva",
  });
  const [showForm, setShowForm] = useState(false);
  const [selMonth, setSelMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [filterCat, setFilterCat] = useState("");

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Transactions for selected month
  const monthTx = useMemo(() =>
    txData
      .filter(t => t.date.slice(0, 7) === selMonth && (!filterCat || t.categoryId === filterCat))
      .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)),
    [txData, selMonth, filterCat]
  );

  // All months that have data (+ current month always present)
  const months = useMemo(() => {
    const set = new Set(txData.map(t => t.date.slice(0, 7)));
    set.add(selMonth);
    return [...set].sort().reverse();
  }, [txData, selMonth]);

  // Monthly totals by category for chart
  const catTotals = useMemo(() => {
    const map = {};
    txData.filter(t => t.date.slice(0, 7) === selMonth).forEach(t => {
      map[t.categoryId] = (map[t.categoryId] || 0) + Number(t.amount);
    });
    return categories
      .map(c => ({ label: c.name, value: map[c.id] || 0, color: c.color }))
      .filter(d => d.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [txData, selMonth, categories]);

  const monthTotal = catTotals.reduce((s, d) => s + d.value, 0);

  // Group txns by date for the list
  const grouped = useMemo(() => {
    const g = {};
    monthTx.forEach(t => {
      if (!g[t.date]) g[t.date] = [];
      g[t.date].push(t);
    });
    return Object.entries(g).sort((a, b) => b[0].localeCompare(a[0]));
  }, [monthTx]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.amount || !form.name.trim()) return;
    onAddTx({
      id: genId(),
      date: form.date,
      amount: Number(form.amount),
      categoryId: form.categoryId,
      name: form.name.trim(),
      person: form.person,
    });
    setForm(f => ({ ...f, amount: "", name: "" }));
  };

  const catById = Object.fromEntries(categories.map(c => [c.id, c]));

  const inp = {
    padding: "9px 12px", background: T.card, border: `1px solid ${T.border}`,
    borderRadius: "8px", color: T.text, fontSize: "13px", outline: "none",
    fontFamily: "'DM Sans',-apple-system,sans-serif",
  };

  const budgetForMonth = useMemo(() => {
    const cats = expensesData?.["FY2026-27"]?.categories || DEFAULT_CATEGORIES;
    return cats.reduce((s, c) => s + Number(c.budget || 0), 0);
  }, [expensesData]);

  return (
    <div>
      {/* Summary strip */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))", gap:"12px", marginBottom:"20px" }}>
        <div style={{ background:T.surface, borderRadius:"10px", padding:"14px 16px", border:`1px solid ${T.border}` }}>
          <div style={{ fontSize:"10px", color:T.textMuted, fontWeight:700, letterSpacing:"0.5px", marginBottom:"6px" }}>THIS MONTH SPENT</div>
          <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"20px", fontWeight:800, color:T.accent }}>{fmtINR(monthTotal)}</div>
          <div style={{ fontSize:"11px", color:T.textMuted, marginTop:"4px" }}>{displayMonth(selMonth)}</div>
        </div>
        <div style={{ background:T.surface, borderRadius:"10px", padding:"14px 16px", border:`1px solid ${T.border}` }}>
          <div style={{ fontSize:"10px", color:T.textMuted, fontWeight:700, letterSpacing:"0.5px", marginBottom:"6px" }}>VS BUDGET</div>
          <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"20px", fontWeight:800,
            color: budgetForMonth > 0 ? (monthTotal <= budgetForMonth ? T.accent : T.red) : T.textDim }}>
            {budgetForMonth > 0 ? fmtINR(budgetForMonth - monthTotal) : "—"}
          </div>
          <div style={{ fontSize:"11px", color:T.textMuted, marginTop:"4px" }}>
            {budgetForMonth > 0 ? `of ${fmtINR(budgetForMonth)} budget` : "no budget set"}
          </div>
        </div>
        <div style={{ background:T.surface, borderRadius:"10px", padding:"14px 16px", border:`1px solid ${T.border}` }}>
          <div style={{ fontSize:"10px", color:T.textMuted, fontWeight:700, letterSpacing:"0.5px", marginBottom:"6px" }}>TRANSACTIONS</div>
          <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"20px", fontWeight:800, color:T.textDim }}>{monthTx.length}</div>
          <div style={{ fontSize:"11px", color:T.textMuted, marginTop:"4px" }}>this month</div>
        </div>
        <div style={{ background:T.surface, borderRadius:"10px", padding:"14px 16px", border:`1px solid ${T.border}` }}>
          <div style={{ fontSize:"10px", color:T.textMuted, fontWeight:700, letterSpacing:"0.5px", marginBottom:"6px" }}>TOP CATEGORY</div>
          <div style={{ fontSize:"14px", fontWeight:700, color:catTotals[0]?.color || T.textMuted }}>
            {catTotals[0] ? catTotals[0].label : "—"}
          </div>
          <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"11px", color:T.textMuted, marginTop:"4px" }}>
            {catTotals[0] ? fmtINR(catTotals[0].value) : "no data"}
          </div>
        </div>
      </div>

      {/* Month selector + Add button */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:"12px", marginBottom:"16px", flexWrap:"wrap" }}>
        <div style={{ display:"flex", gap:"4px", padding:"4px", background:T.card, borderRadius:"10px", overflowX:"auto" }}>
          {months.map(m => (
            <button key={m} onClick={() => setSelMonth(m)} style={{
              padding:"6px 14px", borderRadius:"7px", border:"none", fontSize:"12px", fontWeight:600,
              cursor:"pointer", whiteSpace:"nowrap",
              background: selMonth === m ? T.accent : "transparent",
              color: selMonth === m ? T.bg : T.textDim,
            }}>{displayMonth(m)}</button>
          ))}
        </div>
        <button onClick={() => setShowForm(f => !f)} style={{
          padding:"9px 20px", background:showForm ? T.card : T.accent,
          border:`1px solid ${showForm ? T.border : T.accent}`,
          borderRadius:"8px", color:showForm ? T.textDim : T.bg,
          fontSize:"13px", fontWeight:700, cursor:"pointer", flexShrink:0,
        }}>{showForm ? "Cancel" : "+ Add Transaction"}</button>
      </div>

      {/* Add transaction form */}
      {showForm && (
        <form onSubmit={handleSubmit} style={{ background:T.surface, borderRadius:"12px",
          border:`1px solid ${T.border}`, padding:"20px", marginBottom:"20px" }}>
          <div style={{ fontSize:"13px", fontWeight:700, color:T.text, marginBottom:"14px" }}>New Transaction</div>
          <div style={{ display:"flex", gap:"12px", flexWrap:"wrap" }}>
            <div style={{ flex:"0 0 150px" }}>
              <label style={{ fontSize:"11px", color:T.textMuted, fontWeight:700, display:"block", marginBottom:"4px" }}>DATE</label>
              <input type="date" value={form.date} onChange={e => set("date", e.target.value)}
                style={{ ...inp, width:"100%", colorScheme:"dark" }}/>
            </div>
            <div style={{ flex:"1 1 130px" }}>
              <label style={{ fontSize:"11px", color:T.textMuted, fontWeight:700, display:"block", marginBottom:"4px" }}>AMOUNT (₹)</label>
              <input type="number" min="1" step="1" value={form.amount} onChange={e => set("amount", e.target.value)}
                placeholder="e.g. 500" required style={{ ...inp, width:"100%", fontFamily:"'JetBrains Mono',monospace" }}/>
            </div>
            <div style={{ flex:"1 1 150px" }}>
              <label style={{ fontSize:"11px", color:T.textMuted, fontWeight:700, display:"block", marginBottom:"4px" }}>CATEGORY</label>
              <select value={form.categoryId} onChange={e => set("categoryId", e.target.value)}
                style={{ ...inp, width:"100%", cursor:"pointer" }}>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div style={{ flex:"2 1 200px" }}>
              <label style={{ fontSize:"11px", color:T.textMuted, fontWeight:700, display:"block", marginBottom:"4px" }}>DESCRIPTION</label>
              <input type="text" value={form.name} onChange={e => set("name", e.target.value)}
                placeholder="e.g. Swiggy order" required style={{ ...inp, width:"100%" }}/>
            </div>
            <div style={{ flex:"0 0 130px" }}>
              <label style={{ fontSize:"11px", color:T.textMuted, fontWeight:700, display:"block", marginBottom:"4px" }}>PERSON</label>
              <div style={{ display:"flex", gap:"6px" }}>
                {PERSONS.map(p => (
                  <button key={p} type="button" onClick={() => set("person", p)} style={{
                    flex:1, padding:"9px 8px", borderRadius:"8px", border:"none", cursor:"pointer",
                    fontSize:"12px", fontWeight:600,
                    background: form.person === p ? (p === "Selva" ? T.selva : T.akshaya) : T.card,
                    color: form.person === p ? "#fff" : T.textDim,
                  }}>{p}</button>
                ))}
              </div>
            </div>
          </div>
          <div style={{ display:"flex", justifyContent:"flex-end", marginTop:"14px" }}>
            <button type="submit" style={{ padding:"9px 28px", background:T.accent, border:"none",
              borderRadius:"8px", color:T.bg, fontSize:"13px", fontWeight:700, cursor:"pointer" }}>
              Add
            </button>
          </div>
        </form>
      )}

      {/* Charts row */}
      {catTotals.length > 0 && (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"16px", marginBottom:"20px" }}>
          {/* Category bar chart */}
          <div style={{ background:T.surface, borderRadius:"12px", border:`1px solid ${T.border}`, padding:"18px 20px" }}>
            <div style={{ fontSize:"12px", fontWeight:700, color:T.text, marginBottom:"14px" }}>Spending by Category</div>
            <BarChart data={catTotals} total={monthTotal}/>
          </div>
          {/* Daily chart */}
          <div style={{ background:T.surface, borderRadius:"12px", border:`1px solid ${T.border}`, padding:"18px 20px" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"14px" }}>
              <div style={{ fontSize:"12px", fontWeight:700, color:T.text }}>Daily Spending</div>
              <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"11px", color:T.textMuted }}>
                avg {fmtINR(monthTotal / Math.max(1, new Date(selMonth.slice(0,4), selMonth.slice(5,7), 0).getDate()))}/day
              </div>
            </div>
            <DailyChart txList={txData} month={selMonth}/>
            <div style={{ display:"flex", justifyContent:"space-between", marginTop:"6px" }}>
              <div style={{ fontSize:"10px", color:T.textMuted }}>1</div>
              <div style={{ fontSize:"10px", color:T.textMuted }}>{new Date(selMonth.slice(0,4), selMonth.slice(5,7), 0).getDate()}</div>
            </div>
          </div>
        </div>
      )}

      {/* Category filter chips */}
      {monthTx.length > 0 && (
        <div style={{ display:"flex", gap:"6px", flexWrap:"wrap", marginBottom:"14px" }}>
          <button onClick={() => setFilterCat("")} style={{
            padding:"4px 12px", borderRadius:"20px", border:"none", cursor:"pointer",
            fontSize:"11px", fontWeight:600,
            background: !filterCat ? T.accent : T.card,
            color: !filterCat ? T.bg : T.textDim,
          }}>All</button>
          {categories.filter(c => monthTx.some(t => t.categoryId === c.id)).map(c => (
            <button key={c.id} onClick={() => setFilterCat(f => f === c.id ? "" : c.id)} style={{
              padding:"4px 12px", borderRadius:"20px", border:"none", cursor:"pointer",
              fontSize:"11px", fontWeight:600,
              background: filterCat === c.id ? c.color : T.card,
              color: filterCat === c.id ? "#fff" : T.textDim,
            }}>{c.name}</button>
          ))}
        </div>
      )}

      {/* Transaction list grouped by date */}
      {grouped.length === 0 ? (
        <div style={{ background:T.surface, borderRadius:"12px", border:`1px solid ${T.border}`,
          padding:"40px 20px", textAlign:"center", color:T.textMuted, fontSize:"13px" }}>
          No transactions recorded for {displayMonth(selMonth)}.
          {!showForm && <span style={{ marginLeft:"6px", color:T.accent, cursor:"pointer" }}
            onClick={() => setShowForm(true)}>Add one →</span>}
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:"12px" }}>
          {grouped.map(([date, txns]) => {
            const dayTotal = txns.reduce((s, t) => s + Number(t.amount), 0);
            return (
              <div key={date} style={{ background:T.surface, borderRadius:"12px",
                border:`1px solid ${T.border}`, overflow:"hidden" }}>
                {/* Date header */}
                <div style={{ padding:"10px 16px", background:T.card,
                  display:"flex", justifyContent:"space-between", alignItems:"center",
                  borderBottom:`1px solid ${T.border}` }}>
                  <div style={{ fontSize:"12px", fontWeight:700, color:T.text }}>{displayDate(date)}</div>
                  <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"12px",
                    color:T.textDim, fontWeight:700 }}>{fmtINR(dayTotal)}</div>
                </div>
                {/* Transactions */}
                {txns.map((tx, i) => {
                  const cat = catById[tx.categoryId];
                  return (
                    <div key={tx.id} style={{
                      padding:"11px 16px", display:"flex", alignItems:"center", gap:"12px",
                      borderTop: i > 0 ? `1px solid ${T.border}` : "none",
                    }}>
                      {/* Category dot */}
                      <div style={{ width:"8px", height:"8px", borderRadius:"50%",
                        background:cat?.color || T.textMuted, flexShrink:0 }}/>
                      {/* Name + category */}
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:"13px", fontWeight:600, color:T.text,
                          whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{tx.name}</div>
                        <div style={{ fontSize:"11px", color:T.textMuted, marginTop:"1px" }}>
                          {cat?.name || tx.categoryId}
                          {tx.person && (
                            <span style={{ marginLeft:"8px", color:tx.person === "Selva" ? T.selva : T.akshaya,
                              fontWeight:600 }}>{tx.person}</span>
                          )}
                        </div>
                      </div>
                      {/* Amount */}
                      <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"14px",
                        fontWeight:700, color:T.text, flexShrink:0 }}>{fmtINR(tx.amount)}</div>
                      {/* Delete */}
                      <button onClick={() => { if (window.confirm("Remove this transaction?")) onDeleteTx(tx.id); }}
                        style={{ background:"none", border:"none", color:T.textMuted, cursor:"pointer",
                          fontSize:"16px", lineHeight:1, padding:"0 2px", opacity:0.5, flexShrink:0 }}
                        title="Delete">×</button>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
