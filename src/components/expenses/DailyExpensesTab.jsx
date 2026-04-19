import { useState, useMemo, useEffect, useRef } from "react";
import { T } from "../../lib/theme";
import { fmtINR, genId } from "../../lib/formatters";

export const DEFAULT_CATEGORIES = [
  { id:"baby",          name:"Baby",             color:"#F472B6" },
  { id:"food",          name:"Food",             color:"#14B8A6" },
  { id:"gifts",         name:"Gifts for People", color:"#A855F7" },
  { id:"grocery",       name:"Grocery",          color:"#22C55E" },
  { id:"medical",       name:"Medical",          color:"#EF4444" },
  { id:"non_recurring", name:"Non Recurring",    color:"#FB923C" },
  { id:"parents",       name:"Parents",          color:"#F59E0B" },
  { id:"rent",          name:"Rent",             color:"#3B82F6" },
  { id:"shopping",      name:"Shopping",         color:"#8B5CF6" },
  { id:"transport",     name:"Transportation",   color:"#0EA5E9" },
  { id:"utilities",     name:"Utilities",        color:"#8B96AD" },
  { id:"vacation",      name:"Vacation",         color:"#EC4899" },
  { id:"weekend_fun",   name:"Weekend Fun",      color:"#F97316" },
];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function displayDate(iso) {
  const today = todayISO();
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (iso === today) return "Today";
  if (iso === yesterday) return "Yesterday";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-IN", { weekday:"short", day:"2-digit", month:"short" });
}

function displayMonth(ym) {
  const [y, m] = ym.split("-");
  return new Date(Number(y), Number(m) - 1).toLocaleString("en-IN", { month:"short", year:"numeric" });
}

function daysInMonth(ym) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

// FY months for a given April-start fiscal year
function fyMonths(ym) {
  const [y, m] = ym.split("-").map(Number);
  const fyStartYear = m >= 4 ? y : y - 1;
  const months = [];
  for (let i = 0; i < 12; i++) {
    const mo = ((3 + i) % 12) + 1;
    const yr = i < 9 ? fyStartYear : fyStartYear + 1;
    months.push(`${yr}-${String(mo).padStart(2,"0")}`);
  }
  return months;
}

// ── Donut ring ─────────────────────────────────────────────────────────────
function DonutChart({ data, total, size = 120 }) {
  const r = 42, cx = 60, cy = 60, circ = 2 * Math.PI * r;
  let offset = 0;
  const slices = data.map(d => {
    const pct = total > 0 ? d.value / total : 0;
    const dash = pct * circ;
    const slice = { ...d, dash, offset };
    offset += dash;
    return slice;
  });
  return (
    <svg width={size} height={size} viewBox="0 0 120 120">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={T.card} strokeWidth="16"/>
      {slices.map((s, i) => (
        <circle key={i} cx={cx} cy={cy} r={r} fill="none"
          stroke={s.color} strokeWidth="16"
          strokeDasharray={`${s.dash} ${circ - s.dash}`}
          strokeDashoffset={-s.offset + circ / 4}
          strokeLinecap="butt"/>
      ))}
      <text x={cx} y={cy - 6} textAnchor="middle" fill={T.text} fontSize="11" fontWeight="800">
        {fmtINR(total)}
      </text>
      <text x={cx} y={cy + 9} textAnchor="middle" fill={T.textMuted} fontSize="8">
        total
      </text>
    </svg>
  );
}

// ── Sparkline bar chart ────────────────────────────────────────────────────
function SparkBars({ txList, month }) {
  const days = useMemo(() => {
    const count = daysInMonth(month);
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
    <div style={{ display:"flex", alignItems:"flex-end", gap:"2px", height:"40px", flex:1 }}>
      {days.map(({ day, val }) => (
        <div key={day} title={`${day}: ${fmtINR(val)}`}
          style={{ flex:1, height:"100%", display:"flex", alignItems:"flex-end" }}>
          <div style={{
            width:"100%", borderRadius:"2px 2px 0 0",
            background: val > 0 ? T.accent : T.border,
            height:`${Math.max(val > 0 ? 12 : 2, (val / max) * 38)}px`,
            opacity: val > 0 ? 0.9 : 0.25, transition:"height 0.2s",
          }}/>
        </div>
      ))}
    </div>
  );
}

// ── Add/Edit bottom sheet ─────────────────────────────────────────────────
function TxSheet({ categories, initial, onSave, onClose }) {
  const isEdit = !!initial;
  const [form, setForm] = useState({
    date:       initial?.date       ?? todayISO(),
    amount:     initial?.amount     ? String(initial.amount) : "",
    categoryId: initial?.categoryId ?? categories[0]?.id ?? "food",
    note:       initial?.note       ?? "",
  });
  const amountRef = useRef(null);
  useEffect(() => { amountRef.current?.focus(); }, []);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.amount || Number(form.amount) <= 0) return;
    onSave({
      id:         initial?.id ?? genId(),
      date:       form.date,
      amount:     Number(form.amount),
      categoryId: form.categoryId,
      note:       form.note.trim(),
    });
    onClose();
  };

  const inp = {
    width:"100%", boxSizing:"border-box",
    padding:"12px 14px", background:T.card, border:`1px solid ${T.border}`,
    borderRadius:"10px", color:T.text, fontSize:"15px", outline:"none",
    fontFamily:"'DM Sans',-apple-system,sans-serif",
  };

  return (
    <>
      <div onClick={onClose} style={{
        position:"fixed", inset:0, background:"rgba(0,0,0,0.6)",
        zIndex:100, backdropFilter:"blur(2px)",
      }}/>
      <div style={{
        position:"fixed", bottom:0, left:0, right:0, zIndex:101,
        background:T.surface, borderRadius:"20px 20px 0 0",
        border:`1px solid ${T.border}`, borderBottom:"none",
        padding:"0 20px 32px",
        maxHeight:"90dvh", overflowY:"auto",
      }}>
        <div style={{ display:"flex", justifyContent:"center", padding:"12px 0 16px" }}>
          <div style={{ width:"36px", height:"4px", borderRadius:"2px", background:T.border }}/>
        </div>
        <div style={{ fontSize:"16px", fontWeight:800, color:T.text, marginBottom:"20px" }}>
          {isEdit ? "Edit Expense" : "Add Expense"}
        </div>
        <form onSubmit={handleSubmit} style={{ display:"flex", flexDirection:"column", gap:"14px" }}>
          <div>
            <label style={{ fontSize:"11px", color:T.textMuted, fontWeight:700, letterSpacing:"0.5px", display:"block", marginBottom:"6px" }}>AMOUNT (₹)</label>
            <input ref={amountRef} type="number" min="1" inputMode="numeric" value={form.amount}
              onChange={e => set("amount", e.target.value)} placeholder="0"
              required style={{ ...inp, fontSize:"28px", fontWeight:800, fontFamily:"'JetBrains Mono',monospace" }}/>
          </div>

          <div>
            <label style={{ fontSize:"11px", color:T.textMuted, fontWeight:700, letterSpacing:"0.5px", display:"block", marginBottom:"8px" }}>CATEGORY</label>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:"8px" }}>
              {categories.map(c => (
                <button key={c.id} type="button" onClick={() => set("categoryId", c.id)} style={{
                  padding:"10px 6px", borderRadius:"10px", border:"none", cursor:"pointer",
                  background: form.categoryId === c.id ? c.color + "30" : T.card,
                  outline: form.categoryId === c.id ? `2px solid ${c.color}` : `1px solid ${T.border}`,
                  display:"flex", flexDirection:"column", alignItems:"center", gap:"4px",
                }}>
                  <div style={{ width:"8px", height:"8px", borderRadius:"50%", background:c.color }}/>
                  <span style={{ fontSize:"10px", fontWeight:600,
                    color: form.categoryId === c.id ? c.color : T.textDim,
                    lineHeight:1.2, textAlign:"center" }}>{c.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={{ fontSize:"11px", color:T.textMuted, fontWeight:700, letterSpacing:"0.5px", display:"block", marginBottom:"6px" }}>NOTE</label>
            <input type="text" value={form.note} onChange={e => set("note", e.target.value)}
              placeholder="What was this for?" style={inp}/>
          </div>

          <div>
            <label style={{ fontSize:"11px", color:T.textMuted, fontWeight:700, letterSpacing:"0.5px", display:"block", marginBottom:"6px" }}>DATE</label>
            <input type="date" value={form.date} onChange={e => set("date", e.target.value)}
              style={{ ...inp, colorScheme:"dark" }}/>
          </div>

          <button type="submit" style={{
            width:"100%", padding:"16px", background:T.accent, border:"none",
            borderRadius:"12px", color:T.bg, fontSize:"16px", fontWeight:800,
            cursor:"pointer", marginTop:"4px",
          }}>{isEdit ? "Save Changes" : "Add Expense"}</button>
        </form>
      </div>
    </>
  );
}

// ── Main tab ───────────────────────────────────────────────────────────────
export default function DailyExpensesTab({ txData, onAddTx, onDeleteTx, onEditTx }) {
  const categories = DEFAULT_CATEGORIES;
  const catById = Object.fromEntries(categories.map(c => [c.id, c]));

  const [sheet, setSheet]         = useState(null); // null | "add" | tx object (edit)
  const [filterCat, setFilterCat] = useState("");
  const [selMonth, setSelMonth]   = useState(() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}`;
  });

  // All FY months for the current selected month's fiscal year
  const months = useMemo(() => fyMonths(selMonth), [selMonth]);

  const monthTx = useMemo(() =>
    txData
      .filter(t => t.date.slice(0,7) === selMonth && (!filterCat || t.categoryId === filterCat))
      .sort((a,b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)),
    [txData, selMonth, filterCat]);

  const allMonthTx = useMemo(() =>
    txData.filter(t => t.date.slice(0,7) === selMonth),
    [txData, selMonth]);

  const catTotals = useMemo(() => {
    const map = {};
    allMonthTx.forEach(t => {
      map[t.categoryId] = (map[t.categoryId] || 0) + Number(t.amount);
    });
    const allIds = new Set([...categories.map(c => c.id), ...Object.keys(map)]);
    return [...allIds]
      .map(id => {
        const cat = categories.find(c => c.id === id);
        return { id, label: cat?.name || id, value: map[id] || 0, color: cat?.color || T.textMuted };
      })
      .filter(d => d.value > 0)
      .sort((a,b) => b.value - a.value);
  }, [allMonthTx, categories]);

  const monthTotal = catTotals.reduce((s, d) => s + d.value, 0);

  const grouped = useMemo(() => {
    const g = {};
    monthTx.forEach(t => { if (!g[t.date]) g[t.date] = []; g[t.date].push(t); });
    return Object.entries(g).sort((a,b) => b[0].localeCompare(a[0]));
  }, [monthTx]);

  const avgPerDay = monthTotal / Math.max(1, daysInMonth(selMonth));

  const handleSave = (tx) => {
    if (sheet && typeof sheet === "object") {
      onEditTx(tx);
    } else {
      onAddTx(tx);
    }
  };

  return (
    <div style={{ paddingBottom:"100px" }}>

      {/* ── Hero: month total ── */}
      <div style={{ background:`linear-gradient(135deg,${T.surface},${T.card})`,
        borderRadius:"16px", border:`1px solid ${T.border}`,
        padding:"20px", marginBottom:"16px" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
          <div>
            <div style={{ fontSize:"11px", color:T.textMuted, fontWeight:700, letterSpacing:"0.5px", marginBottom:"6px" }}>
              {displayMonth(selMonth).toUpperCase()} SPEND
            </div>
            <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"32px", fontWeight:800, color:T.text, lineHeight:1 }}>
              {fmtINR(monthTotal)}
            </div>
            <div style={{ fontSize:"12px", color:T.textMuted, marginTop:"6px" }}>
              avg {fmtINR(Math.round(avgPerDay))}/day · {allMonthTx.length} transactions
            </div>
          </div>
          {catTotals.length > 0 && (
            <DonutChart data={catTotals.slice(0,6)} total={monthTotal} size={90}/>
          )}
        </div>
        {allMonthTx.length > 0 && (
          <div style={{ marginTop:"16px" }}>
            <SparkBars txList={txData} month={selMonth}/>
          </div>
        )}
      </div>

      {/* ── Month selector ── */}
      <div style={{ marginBottom:"16px" }}>
        <select
          value={selMonth}
          onChange={e => { setSelMonth(e.target.value); setFilterCat(""); }}
          style={{
            width:"100%", padding:"10px 14px", borderRadius:"10px",
            background:T.card, border:`1px solid ${T.border}`,
            color:T.text, fontSize:"14px", fontWeight:700,
            outline:"none", cursor:"pointer", appearance:"none",
            fontFamily:"'DM Sans',-apple-system,sans-serif",
          }}
        >
          {months.map(m => {
            const hasTx = txData.some(t => t.date.slice(0,7) === m);
            const isFuture = m > todayISO().slice(0,7);
            return (
              <option key={m} value={m}>
                {displayMonth(m)}{hasTx ? "" : isFuture ? " (upcoming)" : " (no data)"}
              </option>
            );
          })}
        </select>
      </div>

      {/* ── Filter chips ── */}
      {catTotals.length > 0 && (
        <div style={{ display:"flex", gap:"6px", flexWrap:"wrap", marginBottom:"14px" }}>
          <button onClick={() => setFilterCat("")} style={{
            padding:"6px 14px", borderRadius:"20px", border:"none", cursor:"pointer",
            fontSize:"12px", fontWeight:700,
            background: !filterCat ? T.accent : T.card,
            color: !filterCat ? T.bg : T.textMuted,
          }}>All</button>
          {catTotals.map(c => (
            <button key={c.id} onClick={() => setFilterCat(f => f === c.id ? "" : c.id)} style={{
              padding:"6px 14px", borderRadius:"20px", border:"none", cursor:"pointer",
              fontSize:"12px", fontWeight:700,
              background: filterCat === c.id ? c.color : T.card,
              color: filterCat === c.id ? "#fff" : T.textMuted,
            }}>{c.label}</button>
          ))}
        </div>
      )}

      {/* ── Transaction list ── */}
      {grouped.length === 0 ? (
        <div style={{ background:T.surface, borderRadius:"14px", border:`1px solid ${T.border}`,
          padding:"40px 20px", textAlign:"center" }}>
          <div style={{ fontSize:"32px", marginBottom:"10px" }}>🧾</div>
          <div style={{ fontSize:"14px", color:T.textMuted }}>No transactions for {displayMonth(selMonth)}</div>
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
          {grouped.map(([date, txns]) => {
            const dayTotal = txns.reduce((s,t) => s + Number(t.amount), 0);
            return (
              <div key={date} style={{ background:T.surface, borderRadius:"14px",
                border:`1px solid ${T.border}`, overflow:"hidden" }}>
                <div style={{ padding:"10px 16px", background:T.card,
                  display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <div style={{ fontSize:"13px", fontWeight:700, color:T.text }}>{displayDate(date)}</div>
                  <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"13px",
                    color:T.textMuted, fontWeight:600 }}>{fmtINR(dayTotal)}</div>
                </div>
                {txns.map(tx => {
                  const cat = catById[tx.categoryId];
                  return (
                    <div key={tx.id}
                      onClick={() => setSheet(tx)}
                      style={{
                        padding:"14px 16px", display:"flex", alignItems:"center", gap:"12px",
                        borderTop:`1px solid ${T.border}`, cursor:"pointer",
                      }}>
                      <div style={{ width:"36px", height:"36px", borderRadius:"10px", flexShrink:0,
                        background:(cat?.color || T.textMuted) + "20",
                        display:"flex", alignItems:"center", justifyContent:"center" }}>
                        <div style={{ width:"10px", height:"10px", borderRadius:"50%", background:cat?.color || T.textMuted }}/>
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:"14px", fontWeight:600, color:T.text,
                          whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                          {tx.note || cat?.name || tx.categoryId}
                        </div>
                        <div style={{ fontSize:"11px", color:T.textMuted, marginTop:"2px" }}>
                          <span style={{ color:cat?.color || T.textMuted, fontWeight:600 }}>{cat?.name || tx.categoryId}</span>
                        </div>
                      </div>
                      <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"15px",
                        fontWeight:800, color:T.text, flexShrink:0 }}>{fmtINR(tx.amount)}</div>
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          if (window.confirm("Remove this transaction?")) onDeleteTx(tx.id);
                        }}
                        style={{ background:"none", border:"none", color:T.textMuted, cursor:"pointer",
                          fontSize:"18px", lineHeight:1, padding:"4px 6px", opacity:0.5, flexShrink:0 }}>×</button>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Category breakdown ── */}
      {catTotals.length > 0 && (
        <div style={{ background:T.surface, borderRadius:"14px", border:`1px solid ${T.border}`,
          padding:"16px", marginTop:"16px" }}>
          <div style={{ fontSize:"12px", fontWeight:700, color:T.textMuted, letterSpacing:"0.5px", marginBottom:"12px" }}>
            BY CATEGORY
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
            {catTotals.map(c => (
              <div key={c.id} style={{ display:"flex", alignItems:"center", gap:"10px" }}>
                <div style={{ width:"8px", height:"8px", borderRadius:"50%", background:c.color, flexShrink:0 }}/>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"4px" }}>
                    <span style={{ fontSize:"13px", fontWeight:600, color:T.text }}>{c.label}</span>
                    <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"12px", fontWeight:700, color:T.text }}>
                      {fmtINR(c.value)}
                      <span style={{ color:T.textMuted, fontWeight:400, fontSize:"11px" }}> {Math.round(c.value/monthTotal*100)}%</span>
                    </span>
                  </div>
                  <div style={{ height:"4px", background:T.card, borderRadius:"2px", overflow:"hidden" }}>
                    <div style={{ height:"100%", width:`${(c.value/monthTotal)*100}%`, background:c.color, borderRadius:"2px" }}/>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── FAB ── */}
      <button onClick={() => setSheet("add")} style={{
        position:"fixed", bottom:"80px", right:"20px", zIndex:50,
        width:"56px", height:"56px", borderRadius:"50%",
        background:T.accent, border:"none", cursor:"pointer",
        fontSize:"28px", color:T.bg, fontWeight:300,
        boxShadow:`0 4px 20px ${T.accent}60`,
        display:"flex", alignItems:"center", justifyContent:"center",
      }}>+</button>

      {/* ── Add/Edit sheet ── */}
      {sheet && (
        <TxSheet
          categories={categories}
          initial={typeof sheet === "object" ? sheet : null}
          onSave={handleSave}
          onClose={() => setSheet(null)}
        />
      )}
    </div>
  );
}
