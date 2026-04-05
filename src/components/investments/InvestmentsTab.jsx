import { useState } from "react";
import { T } from "../../lib/theme";
import { fmtINR, getEsspINR } from "../../lib/formatters";
import { genId } from "../../lib/formatters";
import { PERSONS, MONTHS, MONTH_FULL, EMPLOYER, PERSON_STOCK } from "../../lib/constants";

export default function InvestmentsTab({ incomeData, rsuData, investmentsData, fy, onUpdateInvestments }) {
  const inv = investmentsData?.[fy] || {};
  const epfOpening = inv.epfOpening || { Selva:0, Akshaya:0 };
  const babyFund   = inv.babyFund   || { monthlyTarget:50000, months:{} };
  const debtFunds  = inv.debtFunds  || [];

  const [newDebt, setNewDebt] = useState({ name:"", type:"", amount:"", date:"", notes:"" });
  const [showDebtForm, setShowDebtForm] = useState(false);

  const updateInv = (patch) => onUpdateInvestments(fy, { ...inv, ...patch });

  // ── EPF calculations ──
  const epfByPerson = PERSONS.map(p => {
    const monthly = MONTHS.map((_,mi) => Number(incomeData?.[fy]?.[p]?.[mi]?.epf)||0);
    const empYTD  = monthly.reduce((s,v)=>s+v, 0);
    const emplYTD = empYTD; // employer matches 1:1
    const opening = epfOpening[p] || 0;
    const running = MONTHS.map((_,mi) => {
      const cum = monthly.slice(0,mi+1).reduce((s,v)=>s+v,0);
      return opening + cum * 2; // emp + employer
    });
    return { person:p, monthly, empYTD, emplYTD, opening, total: opening + empYTD + emplYTD, running };
  });
  const epfGrand = epfByPerson.reduce((s,e)=>s+e.total, 0);

  // ── ESPP calculations ──
  const esppByPerson = PERSONS.map(p => {
    const vests = MONTHS.map((_,mi) => {
      const d = incomeData?.[fy]?.[p]?.[mi] || {};
      return { mi, shares: Number(d.espp_shares) || 0, inr: getEsspINR(d) };
    }).filter(v => v.shares > 0 || v.inr > 0);
    const total = vests.reduce((s,v) => s + v.inr, 0);
    return { person:p, vests, total };
  });
  const esppGrand = esppByPerson.reduce((s,e)=>s+e.total, 0);

  // ── Baby Fund calculations ──
  const babyMonthly = MONTHS.map((_,mi)=>Number(babyFund.months?.[mi])||0);
  const babyYTD     = babyMonthly.reduce((s,v)=>s+v, 0);
  const babyTarget  = Number(babyFund.monthlyTarget||0) * 12;

  // ── Debt Fund totals ──
  const debtTotal = debtFunds.reduce((s,d)=>s+Number(d.amount||0), 0);

  const addDebt = () => {
    if(!newDebt.name||!newDebt.amount) return;
    updateInv({ debtFunds:[...debtFunds,{id:genId(),...newDebt}] });
    setNewDebt({name:"",type:"",amount:"",date:"",notes:""});
    setShowDebtForm(false);
  };
  const removeDebt = (id) => updateInv({ debtFunds: debtFunds.filter(d=>d.id!==id) });

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
        <SumCard label="EPF Corpus (FY)"  value={fmtINR(epfGrand)}  sub={`Opening ₹${Math.round((epfOpening.Selva+epfOpening.Akshaya)/100000)*100000/100000}L`} color={T.blue}   />
        <SumCard label="ESPP Stocks (FY)" value={fmtINR(esppGrand)} sub="Net stock value at vest"   color={T.amber}  />
        <SumCard label="Baby Fund (FY)"   value={fmtINR(babyYTD)}   sub={`${Math.round(babyYTD/babyTarget*100)}% of ₹${fmtINR(babyTarget)} target`} color={T.akshaya}/>
        <SumCard label="Debt Funds"       value={fmtINR(debtTotal)} sub={`${debtFunds.length} fund${debtFunds.length!==1?"s":""}`} color={T.teal}   />
        <SumCard label="Total Investments" value={fmtINR(epfGrand+esppGrand+babyYTD+debtTotal)} color={T.white} />
      </div>

      {/* ── EPF Section ── */}
      <div style={sec}>
        <div style={secH}>
          <span>Provident Fund (EPF)</span>
          <span style={{ fontSize:"11px", color:T.textMuted }}>Employee + Employer · 8.25% p.a.</span>
        </div>

        {/* Opening balance editors */}
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

        {/* Per-person EPF details */}
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
            {/* Monthly table */}
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

      {/* ── ESPP Section ── */}
      <div style={sec}>
        <div style={secH}>
          <span>ESPP — Employee Stock Purchase Plan</span>
          <span style={{ fontSize:"11px", color:T.textMuted }}>Net stock value at each vest</span>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"16px" }}>
          {esppByPerson.map(e=>(
            <div key={e.person} style={{ padding:"14px", background:T.bg, borderRadius:"10px" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"12px" }}>
                <span style={{ fontSize:"13px", fontWeight:700, color:e.person==="Selva"?T.selva:T.akshaya }}>{e.person} · {PERSON_STOCK[e.person]}</span>
                <span style={{ fontFamily:"'JetBrains Mono',monospace", color:T.amber, fontWeight:700 }}>{fmtINR(e.total)}</span>
              </div>
              {e.vests.length===0
                ? <div style={{ color:T.textMuted, fontSize:"12px" }}>No ESPP vests recorded yet</div>
                : e.vests.map(v=>(
                  <div key={v.mi} style={{ display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom:`1px solid ${T.border}33`, fontSize:"12px" }}>
                    <span style={{ color:T.textDim }}>{MONTH_FULL[v.mi]} vest</span>
                    <div style={{ textAlign:"right" }}>
                      {v.shares > 0 && <div style={{ fontFamily:"'JetBrains Mono',monospace", color:T.teal, fontWeight:600 }}>{v.shares} shares</div>}
                      <div style={{ fontFamily:"'JetBrains Mono',monospace", color:T.amber, fontWeight:600, fontSize:"11px" }}>{fmtINR(v.inr)}</div>
                    </div>
                  </div>
                ))
              }
            </div>
          ))}
        </div>
        <div style={{ marginTop:"12px", padding:"10px 14px", background:T.accentBg, borderRadius:"8px", fontSize:"11px", color:T.textDim }}>
          ESPP values come from the Income tab (ESPP Net Stock field). Edit monthly income to update these.
        </div>
      </div>

      {/* ── Baby Education Fund ── */}
      <div style={sec}>
        <div style={secH}>
          <span>Baby Education Fund</span>
          <PersonBadge p="Akshaya"/>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))", gap:"12px", marginBottom:"16px" }}>
          <SumCard label="YTD Contributed" value={fmtINR(babyYTD)} color={T.akshaya}/>
          <SumCard label="Annual Target"   value={fmtINR(babyTarget)} color={T.textDim}/>
          <SumCard label="Remaining"       value={fmtINR(Math.max(0,babyTarget-babyYTD))} color={T.amber}/>
        </div>

        {/* Progress bar */}
        <div style={{ marginBottom:"16px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", fontSize:"11px", color:T.textMuted, marginBottom:"6px" }}>
            <span>Progress</span><span>{Math.min(100,Math.round(babyYTD/babyTarget*100))}%</span>
          </div>
          <div style={{ height:"8px", background:T.border, borderRadius:"4px", overflow:"hidden" }}>
            <div style={{ height:"100%", width:`${Math.min(100,babyYTD/babyTarget*100)}%`, background:T.akshaya, borderRadius:"4px", transition:"width 0.5s" }}/>
          </div>
        </div>

        {/* Monthly target editor */}
        <div style={{ display:"flex", alignItems:"center", gap:"12px", padding:"12px", background:T.bg, borderRadius:"10px", marginBottom:"14px" }}>
          <label style={{ fontSize:"11px", color:T.textDim, fontWeight:600, whiteSpace:"nowrap" }}>Monthly Target</label>
          <input type="number" value={babyFund.monthlyTarget||""} placeholder="50000"
            onChange={e=>updateInv({babyFund:{...babyFund,monthlyTarget:Number(e.target.value)}})}
            style={{...inp,fontFamily:"'JetBrains Mono',monospace",maxWidth:"160px"}}
            onFocus={e=>e.target.style.borderColor=T.akshaya} onBlur={e=>e.target.style.borderColor=T.border}
          />
        </div>

        {/* Monthly actuals */}
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"12px", minWidth:"700px" }}>
            <thead>
              <tr>{["Month","Actual","vs Target"].map(h=><th key={h} style={{ padding:"6px 10px", textAlign:h==="Month"?"left":"right", color:T.textMuted, fontWeight:600, fontSize:"10px", borderBottom:`1px solid ${T.border}` }}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {MONTHS.map((m,mi)=>{
                const actual=Number(babyFund.months?.[mi])||0;
                const tgt=Number(babyFund.monthlyTarget)||0;
                const diff=actual-tgt;
                return (
                  <tr key={mi} style={{ borderBottom:`1px solid ${T.border}22` }}>
                    <td style={{ padding:"6px 10px", color:T.textDim }}>{MONTH_FULL[mi]}</td>
                    <td style={{ padding:"6px 10px", textAlign:"right" }}>
                      <input type="number" value={babyFund.months?.[mi]||""} placeholder={String(babyFund.monthlyTarget||50000)}
                        onChange={e=>updateInv({babyFund:{...babyFund,months:{...babyFund.months,[mi]:Number(e.target.value)}}})}
                        style={{ width:"110px", padding:"4px 8px", background:T.bg, border:`1px solid ${T.border}`, borderRadius:"6px", color:T.text, fontSize:"12px", fontFamily:"'JetBrains Mono',monospace", outline:"none", textAlign:"right" }}
                        onFocus={e=>e.target.style.borderColor=T.akshaya} onBlur={e=>e.target.style.borderColor=T.border}
                      />
                    </td>
                    <td style={{ padding:"6px 10px", textAlign:"right", fontFamily:"'JetBrains Mono',monospace", fontSize:"11px", color:actual===0?T.textMuted:diff>=0?T.accent:T.red }}>
                      {actual===0?"—":diff>=0?`+${fmtINR(diff)}`:fmtINR(diff)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Debt Funds ── */}
      <div style={sec}>
        <div style={secH}>
          <span>Debt Funds & Fixed Income</span>
          <button onClick={()=>setShowDebtForm(!showDebtForm)} style={{ padding:"6px 14px", background:T.accentBg, border:`1px solid ${T.accent}44`, color:T.accent, borderRadius:"6px", fontSize:"11px", cursor:"pointer", fontWeight:600 }}>
            {showDebtForm?"Cancel":"+ Add Fund"}
          </button>
        </div>

        {showDebtForm&&(
          <div style={{ padding:"16px", background:T.bg, borderRadius:"10px", marginBottom:"16px" }}>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))", gap:"10px", marginBottom:"12px" }}>
              {[
                {k:"name",    label:"Fund Name",      placeholder:"e.g. Edelweiss PPDAAF"},
                {k:"type",    label:"Type",            placeholder:"e.g. Debt / FD / PPF"},
                {k:"amount",  label:"Amount (₹)",      placeholder:"e.g. 500000",  num:true},
                {k:"date",    label:"Investment Date", placeholder:"",              date:true},
                {k:"notes",   label:"Notes",           placeholder:"Optional"},
              ].map(f=>(
                <div key={f.k}>
                  <label style={{ fontSize:"11px", color:T.textDim, fontWeight:600, display:"block", marginBottom:"4px" }}>{f.label}</label>
                  <input type={f.date?"date":f.num?"number":"text"} value={newDebt[f.k]||""} placeholder={f.placeholder}
                    onChange={e=>setNewDebt(d=>({...d,[f.k]:e.target.value}))}
                    style={{...inp, fontFamily:f.num?"'JetBrains Mono',monospace":undefined}}
                    onFocus={e=>e.target.style.borderColor=T.teal} onBlur={e=>e.target.style.borderColor=T.border}
                  />
                </div>
              ))}
            </div>
            <button onClick={addDebt} style={{ padding:"8px 24px", background:T.teal, border:"none", borderRadius:"8px", color:"#000", fontSize:"13px", fontWeight:700, cursor:"pointer" }}>Add Fund</button>
          </div>
        )}

        {debtFunds.length===0
          ? <div style={{ textAlign:"center", padding:"32px", color:T.textMuted, fontSize:"13px" }}>No debt funds added yet. Click "+ Add Fund" to start.</div>
          : (
            <div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))", gap:"12px" }}>
                {debtFunds.map(d=>(
                  <div key={d.id} style={{ padding:"14px 16px", background:T.bg, borderRadius:"10px", border:`1px solid ${T.border}`, position:"relative" }}>
                    <button onClick={()=>removeDebt(d.id)} style={{ position:"absolute", top:"8px", right:"8px", background:"transparent", border:"none", color:T.red, cursor:"pointer", fontSize:"14px", opacity:0.6 }}>✕</button>
                    <div style={{ fontSize:"13px", fontWeight:700, color:T.text, marginBottom:"4px", paddingRight:"20px" }}>{d.name}</div>
                    <div style={{ fontSize:"11px", color:T.teal, marginBottom:"8px", fontWeight:600 }}>{d.type}</div>
                    <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"18px", fontWeight:800, color:T.teal }}>{fmtINR(Number(d.amount)||0)}</div>
                    {d.date&&<div style={{ fontSize:"10px", color:T.textMuted, marginTop:"4px" }}>{new Date(d.date).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"})}</div>}
                    {d.notes&&<div style={{ fontSize:"11px", color:T.textMuted, marginTop:"4px" }}>{d.notes}</div>}
                  </div>
                ))}
              </div>
              <div style={{ marginTop:"14px", padding:"12px 16px", background:T.bg, borderRadius:"10px", display:"flex", justifyContent:"space-between" }}>
                <span style={{ fontSize:"13px", fontWeight:700, color:T.text }}>Total Debt Funds</span>
                <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"16px", fontWeight:800, color:T.teal }}>{fmtINR(debtTotal)}</span>
              </div>
            </div>
          )
        }
      </div>
    </div>
  );
}
