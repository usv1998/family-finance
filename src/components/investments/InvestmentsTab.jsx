import { useState } from "react";
import { T } from "../../lib/theme";
import { fmtINR, getEsspINR } from "../../lib/formatters";
import { genId } from "../../lib/formatters";
import { PERSONS, MONTHS, MONTH_FULL, EMPLOYER, PERSON_STOCK } from "../../lib/constants";

const EMPTY_GOAL = { name:"", targetAmount:"", targetDate:"", termType:"short", instrument:"", savedAmount:"", notes:"" };

export default function InvestmentsTab({ incomeData, rsuData, investmentsData, fy, onUpdateInvestments }) {
  const inv = investmentsData?.[fy] || {};
  const epfOpening = inv.epfOpening || { Selva:0, Akshaya:0 };
  const goals      = investmentsData?.goals || [];

  const [newGoal,      setNewGoal]      = useState(EMPTY_GOAL);
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [editGoalId,   setEditGoalId]   = useState(null);
  const [editGoalBal,  setEditGoalBal]  = useState(0);

  const updateInv   = (patch) => onUpdateInvestments(fy, { ...inv, ...patch });
  const updateGoals = (next)  => onUpdateInvestments("goals", next);

  const addGoal = () => {
    if (!newGoal.name || !newGoal.targetAmount) return;
    updateGoals([...goals, {
      id: genId(), ...newGoal,
      targetAmount: Number(newGoal.targetAmount),
      savedAmount:  Number(newGoal.savedAmount) || 0,
    }]);
    setNewGoal(EMPTY_GOAL);
    setShowGoalForm(false);
  };
  const removeGoal = (id) => updateGoals(goals.filter(g => g.id !== id));
  const saveGoalBalance = (id) => {
    updateGoals(goals.map(g => g.id === id ? { ...g, savedAmount: editGoalBal } : g));
    setEditGoalId(null);
  };

  // ── EPF calculations ──
  const epfByPerson = PERSONS.map(p => {
    const monthly = MONTHS.map((_,mi) => Number(incomeData?.[fy]?.[p]?.[mi]?.epf)||0);
    const empYTD  = monthly.reduce((s,v)=>s+v, 0);
    const emplYTD = empYTD;
    const opening = epfOpening[p] || 0;
    const running = MONTHS.map((_,mi) => {
      const cum = monthly.slice(0,mi+1).reduce((s,v)=>s+v,0);
      return opening + cum * 2;
    });
    return { person:p, monthly, empYTD, emplYTD, opening, total: opening + empYTD + emplYTD, running };
  });
  const epfGrand = epfByPerson.reduce((s,e)=>s+e.total, 0);

  // ── US Stocks calculations (RSU + ESPP) ──
  const usStocksByPerson = PERSONS.map(p => {
    const esppVests = MONTHS.map((_,mi) => {
      const d = incomeData?.[fy]?.[p]?.[mi] || {};
      const shares = Number(d.espp_shares) || 0;
      const inr = getEsspINR(d);
      if (!shares && !inr) return null;
      return { mi, kind:"ESPP", shares, inr, vestDate: d.espp_vest_date };
    }).filter(Boolean);

    const rsuVests = MONTHS.map((_,mi) => {
      const d = incomeData?.[fy]?.[p]?.[mi] || {};
      const shares = Number(d.rsu_net_shares) || 0;
      const inr = shares * (Number(d.rsu_price_usd)||0) * (Number(d.rsu_usd_inr)||0);
      if (!shares && !inr) return null;
      return { mi, kind:"RSU", shares, inr, vestDate: d.rsu_vest_date };
    }).filter(Boolean);

    const allVests = [...rsuVests, ...esppVests].sort((a,b)=>a.mi-b.mi);
    const total = allVests.reduce((s,v)=>s+v.inr, 0);
    return { person:p, vests:allVests, total };
  });
  const usStocksGrand = usStocksByPerson.reduce((s,e)=>s+e.total, 0);

  // shared styles
  const sec = { background:T.card, borderRadius:"14px", border:`1px solid ${T.border}`, padding:"20px", marginBottom:"20px" };
  const secH = { fontSize:"14px", fontWeight:700, color:T.text, marginBottom:"16px", display:"flex", justifyContent:"space-between", alignItems:"center" };
  const inp  = { padding:"9px 12px", background:T.bg, border:`1px solid ${T.border}`, borderRadius:"8px", color:T.text, fontSize:"13px", outline:"none", width:"100%", boxSizing:"border-box" };

  const SumCard = ({label,value,sub,color}) => (
    <div style={{ background:T.surface, borderRadius:"10px", padding:"14px 16px", border:`1px solid ${T.border}` }}>
      <div style={{ fontSize:"10px", color:T.textMuted, textTransform:"uppercase", fontWeight:600, letterSpacing:"0.5px", marginBottom:"4px" }}>{label}</div>
      <div style={{ fontSize:"18px", fontWeight:800, color:color||T.accent, fontFamily:"'JetBrains Mono',monospace" }}>{value}</div>
      {sub&&<div style={{ fontSize:"11px", color:T.textMuted, marginTop:"3px" }}>{sub}</div>}
    </div>
  );

  const PersonBadge = ({p}) => (
    <span style={{ fontSize:"11px", fontWeight:700, color:p==="Selva"?T.selva:T.akshaya, background:p==="Selva"?`${T.selva}22`:`${T.akshaya}22`, padding:"2px 8px", borderRadius:"20px", marginLeft:"8px" }}>{p}</span>
  );

  return (
    <div>
      {/* ── Top summary ── */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:"12px", marginBottom:"24px" }}>
        <SumCard label="EPF Corpus (FY)"  value={fmtINR(epfGrand)}  sub={`Opening ${fmtINR(epfOpening.Selva+epfOpening.Akshaya)}`} color={T.blue}   />
        <SumCard label="US Stocks (FY)"   value={fmtINR(usStocksGrand)} sub="RSU + ESPP net value at vest" color={T.amber}  />
        <SumCard label="Total Investments" value={fmtINR(epfGrand+usStocksGrand)} color={T.white} />
      </div>

      {/* ── EPF Section ── */}
      <div style={sec}>
        <div style={secH}>
          <span>Provident Fund (EPF)</span>
          <span style={{ fontSize:"11px", color:T.textMuted }}>Employee + Employer · 8.25% p.a.</span>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"12px", marginBottom:"16px", padding:"14px", background:T.bg, borderRadius:"10px" }}>
          <div style={{ fontSize:"11px", color:T.textDim, fontWeight:600, gridColumn:"1/-1", marginBottom:"4px" }}>OPENING BALANCE (Start of FY)</div>
          {PERSONS.map(p=>(
            <div key={p} style={{ display:"flex", alignItems:"center", gap:"10px" }}>
              <PersonBadge p={p}/>
              <input type="number" value={epfOpening[p]||""} placeholder="e.g. 363580"
                onChange={e=>updateInv({epfOpening:{...epfOpening,[p]:Number(e.target.value)}})}
                style={{...inp, fontFamily:"'JetBrains Mono',monospace", flex:1}}
                onFocus={e=>e.target.style.borderColor=T.accent} onBlur={e=>e.target.style.borderColor=T.border}
              />
            </div>
          ))}
        </div>

        {epfByPerson.map(e=>(
          <div key={e.person} style={{ marginBottom:"16px", padding:"14px", background:T.bg, borderRadius:"10px" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"12px" }}>
              <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                <span style={{ fontSize:"13px", fontWeight:700, color:e.person==="Selva"?T.selva:T.akshaya }}>{e.person}</span>
                <span style={{ fontSize:"11px", color:T.textMuted }}>{EMPLOYER[e.person]}</span>
              </div>
              <div style={{ display:"flex", gap:"12px" }}>
                <div style={{ textAlign:"right" }}><div style={{ fontSize:"10px", color:T.textMuted }}>FY Contributions</div><div style={{ fontFamily:"'JetBrains Mono',monospace", color:T.blue, fontWeight:700 }}>{fmtINR(e.empYTD+e.emplYTD)}</div></div>
                <div style={{ textAlign:"right" }}><div style={{ fontSize:"10px", color:T.textMuted }}>Corpus (incl. opening)</div><div style={{ fontFamily:"'JetBrains Mono',monospace", color:T.accent, fontWeight:700 }}>{fmtINR(e.total)}</div></div>
              </div>
            </div>
            <div style={{ overflowX:"auto" }}>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"11px", minWidth:"700px" }}>
                <thead>
                  <tr>
                    <td style={{ padding:"4px 8px", color:T.textMuted, fontWeight:600 }}>Component</td>
                    {MONTHS.map(m=><td key={m} style={{ padding:"4px 8px", textAlign:"right", color:T.textMuted, fontWeight:600 }}>{m}</td>)}
                    <td style={{ padding:"4px 8px", textAlign:"right", color:T.accent, fontWeight:600 }}>Total</td>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ padding:"4px 8px", color:T.textDim }}>Employee</td>
                    {e.monthly.map((v,i)=><td key={i} style={{ padding:"4px 8px", textAlign:"right", fontFamily:"'JetBrains Mono',monospace", color:v>0?T.text:T.textMuted }}>{v>0?fmtINR(v):"—"}</td>)}
                    <td style={{ padding:"4px 8px", textAlign:"right", fontFamily:"'JetBrains Mono',monospace", color:T.blue, fontWeight:700 }}>{fmtINR(e.empYTD)}</td>
                  </tr>
                  <tr>
                    <td style={{ padding:"4px 8px", color:T.textDim }}>Employer</td>
                    {e.monthly.map((v,i)=><td key={i} style={{ padding:"4px 8px", textAlign:"right", fontFamily:"'JetBrains Mono',monospace", color:v>0?T.text:T.textMuted }}>{v>0?fmtINR(v):"—"}</td>)}
                    <td style={{ padding:"4px 8px", textAlign:"right", fontFamily:"'JetBrains Mono',monospace", color:T.blue, fontWeight:700 }}>{fmtINR(e.emplYTD)}</td>
                  </tr>
                  <tr style={{ borderTop:`1px solid ${T.border}` }}>
                    <td style={{ padding:"4px 8px", color:T.accent, fontWeight:700 }}>Running Corpus</td>
                    {e.running.map((v,i)=><td key={i} style={{ padding:"4px 8px", textAlign:"right", fontFamily:"'JetBrains Mono',monospace", color:T.accent, fontWeight:600, fontSize:"10px" }}>{fmtINR(v)}</td>)}
                    <td style={{ padding:"4px 8px", textAlign:"right", fontFamily:"'JetBrains Mono',monospace", color:T.accent, fontWeight:700 }}>{fmtINR(e.total)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      {/* ── US Stocks (RSU + ESPP) ── */}
      <div style={sec}>
        <div style={secH}>
          <span>US Stocks — RSU &amp; ESPP</span>
          <span style={{ fontSize:"11px", color:T.textMuted }}>Net shares · value at vest date</span>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"16px" }}>
          {usStocksByPerson.map(e=>(
            <div key={e.person} style={{ padding:"14px", background:T.bg, borderRadius:"10px" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"12px" }}>
                <span style={{ fontSize:"13px", fontWeight:700, color:e.person==="Selva"?T.selva:T.akshaya }}>{e.person} · {PERSON_STOCK[e.person]}</span>
                <span style={{ fontFamily:"'JetBrains Mono',monospace", color:T.amber, fontWeight:700 }}>{fmtINR(e.total)}</span>
              </div>
              {e.vests.length===0
                ? <div style={{ color:T.textMuted, fontSize:"12px" }}>No vests recorded yet — enter in Income tab</div>
                : e.vests.map(v=>(
                  <div key={`${v.kind}-${v.mi}`} style={{ display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom:`1px solid ${T.border}33`, fontSize:"12px" }}>
                    <div>
                      <div style={{ display:"flex", alignItems:"center", gap:"6px" }}>
                        <span style={{ fontSize:"9px", fontWeight:700, padding:"1px 6px", borderRadius:"4px",
                          background:v.kind==="RSU"?`${T.purple}22`:`${T.teal}22`,
                          color:v.kind==="RSU"?T.purple:T.teal }}>{v.kind}</span>
                        <span style={{ color:T.textDim }}>{MONTH_FULL[v.mi]} vest</span>
                      </div>
                      {v.vestDate && <div style={{ fontSize:"10px", color:T.textMuted, marginTop:"2px" }}>{new Date(v.vestDate).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"})}</div>}
                    </div>
                    <div style={{ textAlign:"right" }}>
                      {v.shares > 0 && <div style={{ fontFamily:"'JetBrains Mono',monospace", color:T.teal, fontWeight:600 }}>{v.shares} sh</div>}
                      <div style={{ fontFamily:"'JetBrains Mono',monospace", color:T.amber, fontWeight:600, fontSize:"11px" }}>{fmtINR(v.inr)}</div>
                    </div>
                  </div>
                ))
              }
            </div>
          ))}
        </div>
        <div style={{ marginTop:"12px", padding:"10px 14px", background:T.accentBg, borderRadius:"8px", fontSize:"11px", color:T.textDim }}>
          RSU and ESPP values come from the Income tab monthly entries. Edit monthly income to update these.
        </div>
      </div>

      {/* ── Goals ── */}
      <div style={sec}>
        <div style={secH}>
          <span>Financial Goals</span>
          <button onClick={() => setShowGoalForm(!showGoalForm)}
            style={{ padding:"6px 14px", background:T.accentBg, border:`1px solid ${T.accent}44`,
              color:T.accent, borderRadius:"6px", fontSize:"11px", cursor:"pointer", fontWeight:600 }}>
            {showGoalForm ? "Cancel" : "+ Add Goal"}
          </button>
        </div>

        {showGoalForm && (
          <div style={{ padding:"16px", background:T.bg, borderRadius:"10px", marginBottom:"16px" }}>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))", gap:"10px", marginBottom:"12px" }}>
              {[
                { k:"name",         label:"Goal Name",          placeholder:"e.g. Singapore Trip" },
                { k:"targetAmount", label:"Target Amount (₹)",  placeholder:"500000",    num:true  },
                { k:"targetDate",   label:"Target Date",        placeholder:"",          date:true },
                { k:"instrument",   label:"Instrument",         placeholder:"Gold ETF, Liquid Fund…" },
                { k:"savedAmount",  label:"Already Saved (₹)",  placeholder:"0",         num:true  },
                { k:"notes",        label:"Notes",              placeholder:"Optional"             },
              ].map(f => (
                <div key={f.k}>
                  <label style={{ fontSize:"11px", color:T.textDim, fontWeight:600, display:"block", marginBottom:"4px" }}>{f.label}</label>
                  <input type={f.date?"date":f.num?"number":"text"}
                    value={newGoal[f.k]||""} placeholder={f.placeholder}
                    onChange={e => setNewGoal(g => ({ ...g, [f.k]: e.target.value }))}
                    style={{ ...inp, fontFamily:f.num?"'JetBrains Mono',monospace":undefined }}
                    onFocus={e=>e.target.style.borderColor=T.accent}
                    onBlur={e=>e.target.style.borderColor=T.border}/>
                </div>
              ))}
            </div>
            {/* Term type toggle */}
            <div style={{ marginBottom:"12px" }}>
              <div style={{ fontSize:"11px", color:T.textDim, fontWeight:600, marginBottom:"6px" }}>GOAL TERM</div>
              <div style={{ display:"flex", gap:"8px" }}>
                {[{v:"short",label:"Short-term",sub:"&lt;3 yrs · tracked here only"},{v:"long",label:"Long-term",sub:"3+ yrs · auto-tracked in Portfolio"}].map(opt=>(
                  <button key={opt.v} onClick={()=>setNewGoal(g=>({...g,termType:opt.v}))}
                    style={{ padding:"8px 16px", borderRadius:"8px", border:`1px solid ${newGoal.termType===opt.v?T.accent:T.border}`,
                      background:newGoal.termType===opt.v?T.accentBg:"transparent",
                      color:newGoal.termType===opt.v?T.accent:T.textDim, cursor:"pointer", textAlign:"left", fontSize:"12px", fontWeight:600 }}>
                    {opt.v === "long" ? "Long-term" : "Short-term"}
                    <div style={{ fontSize:"10px", fontWeight:400, marginTop:"2px", color:T.textMuted }}>
                      {opt.v === "long" ? "3+ yrs · auto-tracked in Portfolio" : "< 3 yrs · tracked here only"}
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <button onClick={addGoal}
              style={{ padding:"8px 24px", background:T.accent, border:"none", borderRadius:"8px",
                color:T.bg, fontSize:"13px", fontWeight:700, cursor:"pointer" }}>
              Add Goal
            </button>
          </div>
        )}

        {goals.length === 0 && !showGoalForm ? (
          <div style={{ textAlign:"center", padding:"32px", color:T.textMuted, fontSize:"13px" }}>
            No goals yet. Track savings towards a trip, event, or any financial milestone.
          </div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:"14px" }}>
            {goals.map(g => {
              const target   = Number(g.targetAmount) || 0;
              const saved    = Number(g.savedAmount)  || 0;
              const pct      = target > 0 ? Math.min(100, saved / target * 100) : 0;
              const remaining = Math.max(0, target - saved);
              const today    = new Date();
              const dueDate  = g.targetDate ? new Date(g.targetDate) : null;
              const msLeft   = dueDate ? dueDate - today : null;
              const daysLeft = msLeft ? Math.ceil(msLeft / 86400000) : null;
              const monthsLeft = msLeft ? Math.max(0, Math.round(msLeft / (30.44 * 86400000))) : null;
              const monthlyNeeded = monthsLeft > 0 ? remaining / monthsLeft : null;
              const overdue  = daysLeft !== null && daysLeft < 0;
              const urgent   = daysLeft !== null && daysLeft <= 60 && !overdue;
              const dateCol  = overdue ? T.red : urgent ? T.amber : T.textMuted;
              const isLong   = g.termType === "long";

              return (
                <div key={g.id} style={{ padding:"16px 20px", background:T.bg, borderRadius:"12px",
                  border:`1px solid ${pct>=100?T.accent:T.border}` }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start",
                    flexWrap:"wrap", gap:"8px", marginBottom:"10px" }}>
                    <div>
                      <div style={{ display:"flex", alignItems:"center", gap:"8px", flexWrap:"wrap" }}>
                        <span style={{ fontSize:"14px", fontWeight:700, color:T.text }}>{g.name}</span>
                        {pct >= 100 && (
                          <span style={{ fontSize:"10px", fontWeight:700, padding:"2px 8px", borderRadius:"10px",
                            background:`${T.accent}22`, color:T.accent }}>ACHIEVED</span>
                        )}
                        {isLong && (
                          <span style={{ fontSize:"10px", fontWeight:700, padding:"2px 8px", borderRadius:"10px",
                            background:`${T.blue}22`, color:T.blue }}>LONG-TERM · Portfolio tracked</span>
                        )}
                        {g.instrument && (
                          <span style={{ fontSize:"10px", fontWeight:600, padding:"2px 8px", borderRadius:"10px",
                            background:`${T.border}`, color:T.textDim }}>{g.instrument}</span>
                        )}
                      </div>
                      {dueDate && (
                        <div style={{ fontSize:"11px", color:dateCol, marginTop:"3px" }}>
                          {overdue
                            ? `Overdue by ${Math.abs(daysLeft)}d`
                            : `${dueDate.toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"})} · ${monthsLeft} month${monthsLeft!==1?"s":""} left`}
                        </div>
                      )}
                    </div>

                    <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                      {editGoalId === g.id ? (
                        <>
                          <input type="number" value={editGoalBal}
                            onChange={e => setEditGoalBal(Number(e.target.value))}
                            style={{ width:"120px", padding:"5px 8px", background:T.card,
                              border:`1px solid ${T.accent}`, borderRadius:"6px",
                              color:T.text, fontSize:"13px", fontFamily:"'JetBrains Mono',monospace", outline:"none", textAlign:"right" }}/>
                          <button onClick={() => saveGoalBalance(g.id)}
                            style={{ padding:"5px 12px", background:T.accent, border:"none",
                              borderRadius:"6px", color:T.bg, fontSize:"12px", fontWeight:700, cursor:"pointer" }}>
                            Save
                          </button>
                          <button onClick={() => setEditGoalId(null)}
                            style={{ padding:"5px 8px", background:"transparent", border:`1px solid ${T.border}`,
                              borderRadius:"6px", color:T.textDim, fontSize:"12px", cursor:"pointer" }}>✕</button>
                        </>
                      ) : (
                        <>
                          <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"16px",
                            fontWeight:800, color:pct>=100?T.accent:T.text }}>
                            {fmtINR(saved)}
                          </span>
                          <button onClick={() => { setEditGoalId(g.id); setEditGoalBal(saved); }}
                            style={{ background:"none", border:"none", color:T.textMuted,
                              cursor:"pointer", fontSize:"13px", padding:"2px 4px" }}
                            title="Update saved amount">✎</button>
                        </>
                      )}
                      <button onClick={() => { if (window.confirm("Remove this goal?")) removeGoal(g.id); }}
                        style={{ background:"none", border:"none", color:T.red, cursor:"pointer",
                          fontSize:"13px", opacity:0.5, padding:"2px 4px" }}
                        title="Remove goal">✕</button>
                    </div>
                  </div>

                  <div style={{ marginBottom:"8px" }}>
                    <div style={{ display:"flex", justifyContent:"space-between", fontSize:"11px",
                      color:T.textMuted, marginBottom:"5px" }}>
                      <span>{pct.toFixed(0)}% complete</span>
                      <span>{fmtINR(remaining)} remaining of {fmtINR(target)}</span>
                    </div>
                    <div style={{ height:"7px", background:T.border, borderRadius:"4px", overflow:"hidden" }}>
                      <div style={{ height:"100%", width:`${pct}%`, borderRadius:"4px",
                        background: pct>=100 ? T.accent : urgent ? T.amber : isLong ? T.blue : T.accent,
                        transition:"width 0.5s ease" }}/>
                    </div>
                  </div>

                  {monthlyNeeded !== null && monthlyNeeded > 0 && pct < 100 && (
                    <div style={{ fontSize:"11px", color:T.textMuted }}>
                      Need{" "}
                      <span style={{ fontFamily:"'JetBrains Mono',monospace", color:urgent?T.amber:T.textDim, fontWeight:700 }}>
                        {fmtINR(Math.ceil(monthlyNeeded))}
                      </span>
                      {" "}/ month to reach goal
                    </div>
                  )}
                  {g.notes && (
                    <div style={{ fontSize:"11px", color:T.textMuted, marginTop:"4px", fontStyle:"italic" }}>{g.notes}</div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
