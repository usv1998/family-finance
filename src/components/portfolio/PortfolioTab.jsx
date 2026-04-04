import { useState } from "react";
import { T } from "../../lib/theme";
import { fmtINR, fmtUSD, genId } from "../../lib/formatters";
import { PERSONS, MONTHS } from "../../lib/constants";

export default function PortfolioTab({ portfolioData, investmentsData, incomeData, rsuData, fy, onUpdate, liveData }) {
  const inv  = portfolioData?.[fy] || {};
  const stocks     = inv.stocks     || { MSFT:{ shares:0 }, NVDA:{ shares:0 } };
  const sips       = inv.sips       || [];
  const gold       = inv.gold       || { units:0, pricePerUnit:15100 };
  const otherEquity= inv.otherEquity|| [];

  const [editStocks,   setEditStocks]   = useState(false);
  const [stockDraft,   setStockDraft]   = useState({});
  const [editGold,     setEditGold]     = useState(false);
  const [goldDraft,    setGoldDraft]    = useState({});
  const [editSipMonth, setEditSipMonth] = useState(null);
  const [sipDraft,     setSipDraft]     = useState({});
  const [showAddOther, setShowAddOther] = useState(false);
  const [newOther,     setNewOther]     = useState({ name:"", amount:"", date:"", notes:"" });

  // EPF corpus from investmentsData (same logic as InvestmentsTab)
  const epfOpening = investmentsData?.[fy]?.epfOpening || { Selva:0, Akshaya:0 };
  const epfCorpus  = PERSONS.reduce((s,p) => {
    const monthly = MONTHS.map((_,mi)=>Number(incomeData?.[fy]?.[p]?.[mi]?.epf)||0);
    const empYTD  = monthly.reduce((a,v)=>a+v, 0);
    return s + (epfOpening[p]||0) + empYTD * 2;
  }, 0);

  // Debt funds from investmentsData
  const debtFunds  = investmentsData?.[fy]?.debtFunds || [];
  const debtTotal  = debtFunds.reduce((s,d)=>s+Number(d.amount||0), 0);

  // Baby fund
  const babyFund   = investmentsData?.[fy]?.babyFund || { months:{} };
  const babyTotal  = MONTHS.reduce((s,_,mi)=>s+(Number(babyFund.months?.[mi])||0), 0);

  // Stock values at live price
  const msftShares = Number(stocks.MSFT?.shares) || 0;
  const nvdaShares = Number(stocks.NVDA?.shares) || 0;
  const msftVal    = msftShares * liveData.MSFT * liveData.USDINR;
  const nvdaVal    = nvdaShares * liveData.NVDA * liveData.USDINR;
  const stockTotal = msftVal + nvdaVal;

  // SIP totals
  const sipTotal   = sips.reduce((s,sip)=>s+MONTHS.reduce((ss,_,mi)=>ss+(Number(sip.months?.[mi])||0),0), 0);

  // Gold value
  const goldVal    = Number(gold.units||0) * Number(gold.pricePerUnit||0);

  // Other equity
  const otherTotal = otherEquity.reduce((s,o)=>s+Number(o.amount||0), 0);

  // Corpus breakdown
  const corpus = [
    { label:"Stocks (MSFT+NVDA)", value:stockTotal,  color:T.purple },
    { label:"Equity SIP",         value:sipTotal,    color:T.accent },
    { label:"EPF",                 value:epfCorpus,   color:T.blue   },
    { label:"Debt Funds",          value:debtTotal,   color:T.teal   },
    { label:"Gold ETF",            value:goldVal,     color:T.amber  },
    { label:"Baby Fund",           value:babyTotal,   color:T.akshaya},
    { label:"Other",               value:otherTotal,  color:T.textDim},
  ].filter(c=>c.value>0);
  const total = corpus.reduce((s,c)=>s+c.value, 0);
  const equityVal = stockTotal + sipTotal + otherTotal;
  const debtVal   = epfCorpus + debtTotal + babyTotal;

  const updateInv = (patch) => onUpdate(fy, { stocks, sips, gold, otherEquity, ...inv, ...patch });

  const saveStocks = () => {
    updateInv({ stocks:{ MSFT:{ shares:Number(stockDraft.MSFT)||0 }, NVDA:{ shares:Number(stockDraft.NVDA)||0 } } });
    setEditStocks(false);
  };
  const saveGold = () => {
    updateInv({ gold:{ units:Number(goldDraft.units)||0, pricePerUnit:Number(goldDraft.pricePerUnit)||15100 } });
    setEditGold(false);
  };
  const saveSip = (mi) => {
    const updated = sips.map(sip=>({ ...sip, months:{ ...sip.months, [mi]:Number(sipDraft[sip.id])||0 } }));
    updateInv({ sips:updated });
    setEditSipMonth(null);
  };
  const addOther = () => {
    if(!newOther.name.trim()) return;
    updateInv({ otherEquity:[...otherEquity, { id:genId(), ...newOther, amount:Number(newOther.amount)||0 }] });
    setNewOther({ name:"", amount:"", date:"", notes:"" });
    setShowAddOther(false);
  };
  const deleteOther = (id) => updateInv({ otherEquity:otherEquity.filter(o=>o.id!==id) });

  const inp = { padding:"8px 12px", background:T.card, border:`1px solid ${T.border}`, borderRadius:"8px", color:T.text, fontSize:"13px", outline:"none", fontFamily:"'JetBrains Mono',monospace" };
  const SumCard = ({label,value,sub,color}) => (
    <div style={{ background:T.surface, borderRadius:"10px", padding:"14px 16px", border:`1px solid ${T.border}` }}>
      <div style={{ fontSize:"11px", color:T.textMuted, fontWeight:700, letterSpacing:"0.5px", marginBottom:"6px" }}>{label.toUpperCase()}</div>
      <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"18px", fontWeight:800, color }}>{fmtINR(value)}</div>
      {sub&&<div style={{ fontSize:"11px", color:T.textMuted, marginTop:"4px" }}>{sub}</div>}
    </div>
  );

  return (
    <div>
      {/* Summary */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:"12px", marginBottom:"24px" }}>
        <SumCard label="Total Corpus"  value={total}      color={T.accent} sub="All asset classes"/>
        <SumCard label="Equity"        value={equityVal}  color={T.purple} sub={total>0?`${Math.round(equityVal/total*100)}% of corpus`:""}/>
        <SumCard label="Debt / Safe"   value={debtVal}    color={T.blue}   sub={total>0?`${Math.round(debtVal/total*100)}% of corpus`:""}/>
        <SumCard label="Gold"          value={goldVal}    color={T.amber}  sub={gold.units?`${gold.units} units`:"Not entered"}/>
      </div>

      {/* Asset allocation bar */}
      {total > 0 && (
        <div style={{ background:T.surface, borderRadius:"12px", border:`1px solid ${T.border}`, padding:"16px 20px", marginBottom:"24px" }}>
          <div style={{ fontSize:"13px", fontWeight:700, color:T.text, marginBottom:"12px" }}>Asset Allocation</div>
          <div style={{ display:"flex", height:"10px", borderRadius:"5px", overflow:"hidden", gap:"1px" }}>
            {corpus.map(c=>(
              <div key={c.label} style={{ width:`${c.value/total*100}%`, background:c.color, transition:"width 0.5s" }}/>
            ))}
          </div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:"12px", marginTop:"12px" }}>
            {corpus.map(c=>(
              <div key={c.label} style={{ display:"flex", alignItems:"center", gap:"6px" }}>
                <div style={{ width:"8px", height:"8px", borderRadius:"50%", background:c.color, flexShrink:0 }}/>
                <span style={{ fontSize:"11px", color:T.textDim, fontWeight:600 }}>{c.label}</span>
                <span style={{ fontSize:"11px", fontFamily:"'JetBrains Mono',monospace", color:T.textMuted }}>{Math.round(c.value/total*100)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stock holdings */}
      <div style={{ background:T.surface, borderRadius:"12px", border:`1px solid ${T.border}`, marginBottom:"24px", overflow:"hidden" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"14px 20px", borderBottom:`1px solid ${T.border}` }}>
          <span style={{ fontSize:"14px", fontWeight:700, color:T.text }}>Stock Holdings</span>
          <div style={{ display:"flex", gap:"8px", alignItems:"center" }}>
            <span style={{ fontSize:"11px", color:T.textMuted }}>Live: MSFT {fmtUSD(liveData.MSFT)} · NVDA {fmtUSD(liveData.NVDA)} · ₹{liveData.USDINR.toFixed(2)}</span>
            <button onClick={()=>{ setStockDraft({ MSFT:msftShares, NVDA:nvdaShares }); setEditStocks(!editStocks); }}
              style={{ padding:"6px 14px", background:editStocks?T.card:T.accent, border:`1px solid ${editStocks?T.border:T.accent}`, borderRadius:"8px", color:editStocks?T.textDim:T.bg, fontSize:"12px", fontWeight:700, cursor:"pointer" }}>
              {editStocks?"Cancel":"Edit"}
            </button>
          </div>
        </div>
        <div style={{ padding:"16px 20px" }}>
          {[{ stock:"MSFT", shares:msftShares, val:msftVal, color:T.blue,   person:"Selva"   },
            { stock:"NVDA", shares:nvdaShares, val:nvdaVal, color:T.akshaya, person:"Akshaya" }].map(row=>(
            <div key={row.stock} style={{ display:"flex", alignItems:"center", gap:"16px", padding:"12px 0", borderBottom:`1px solid ${T.border}` }}>
              <div style={{ width:"40px", height:"40px", borderRadius:"10px", background:row.color+"22", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"13px", fontWeight:800, color:row.color, flexShrink:0 }}>{row.stock}</div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:"13px", fontWeight:600, color:T.text }}>{row.stock} · {row.person}</div>
                <div style={{ fontSize:"11px", color:T.textMuted, marginTop:"2px" }}>{row.shares} shares × {row.stock==="MSFT"?fmtUSD(liveData.MSFT):fmtUSD(liveData.NVDA)} × ₹{liveData.USDINR.toFixed(0)}</div>
              </div>
              {editStocks ? (
                <input type="number" value={stockDraft[row.stock]??""} onChange={e=>setStockDraft(d=>({...d,[row.stock]:e.target.value}))}
                  placeholder="shares" style={{ ...inp, width:"120px", textAlign:"right" }}/>
              ) : (
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"16px", fontWeight:800, color:row.color }}>{fmtINR(row.val)}</div>
                  <div style={{ fontSize:"11px", color:T.textMuted }}>{row.shares} shares</div>
                </div>
              )}
            </div>
          ))}
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", paddingTop:"12px" }}>
            <span style={{ fontSize:"13px", fontWeight:700, color:T.text }}>Total Stocks</span>
            <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"16px", fontWeight:800, color:T.purple }}>{fmtINR(stockTotal)}</span>
          </div>
          {editStocks && (
            <div style={{ marginTop:"12px", display:"flex", justifyContent:"flex-end" }}>
              <button onClick={saveStocks} style={{ padding:"8px 20px", background:T.accent, border:"none", borderRadius:"8px", color:T.bg, fontSize:"13px", fontWeight:700, cursor:"pointer" }}>Save</button>
            </div>
          )}
        </div>
      </div>

      {/* Equity SIP */}
      <div style={{ background:T.surface, borderRadius:"12px", border:`1px solid ${T.border}`, marginBottom:"24px", overflow:"hidden" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"14px 20px", borderBottom:`1px solid ${T.border}` }}>
          <span style={{ fontSize:"14px", fontWeight:700, color:T.text }}>Equity SIP</span>
          <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"14px", fontWeight:700, color:T.accent }}>{fmtINR(sipTotal)}</span>
        </div>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"12px" }}>
            <thead>
              <tr style={{ background:T.card }}>
                <th style={{ padding:"8px 16px", textAlign:"left", color:T.textMuted, fontWeight:700, fontSize:"11px", position:"sticky", left:0, background:T.card }}>FUND</th>
                <th style={{ padding:"8px 10px", textAlign:"right", color:T.textMuted, fontWeight:700, fontSize:"11px" }}>TARGET/MO</th>
                {MONTHS.map(m=><th key={m} style={{ padding:"8px 10px", textAlign:"right", color:T.textMuted, fontWeight:700, fontSize:"11px" }}>{m.toUpperCase()}</th>)}
                <th style={{ padding:"8px 12px", textAlign:"right", color:T.accent, fontWeight:700, fontSize:"11px" }}>FY TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {sips.map((sip,i)=>{
                const fyT = MONTHS.reduce((s,_,mi)=>s+(Number(sip.months?.[mi])||0),0);
                return (
                  <tr key={sip.id} style={{ borderTop:`1px solid ${T.border}`, background:i%2===0?"transparent":T.card+"44" }}>
                    <td style={{ padding:"8px 16px", position:"sticky", left:0, background:i%2===0?T.surface:T.card+"44" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                        <div style={{ width:"7px", height:"7px", borderRadius:"50%", background:T.accent }}/>
                        <span style={{ color:T.text, fontWeight:500 }}>{sip.name}</span>
                      </div>
                    </td>
                    <td style={{ padding:"8px 10px", textAlign:"right", fontFamily:"'JetBrains Mono',monospace", color:T.textDim }}>{fmtINR(sip.monthly)}</td>
                    {MONTHS.map((_,mi)=>{
                      const v = Number(sip.months?.[mi])||0;
                      return (
                        <td key={mi} style={{ padding:"8px 10px", textAlign:"right" }}>
                          {editSipMonth===mi ? (
                            <input type="number" value={sipDraft[sip.id]??""} onChange={e=>setSipDraft(d=>({...d,[sip.id]:e.target.value}))}
                              style={{ ...inp, width:"80px", padding:"3px 6px", textAlign:"right", fontSize:"11px" }}/>
                          ) : (
                            <span style={{ fontFamily:"'JetBrains Mono',monospace", color:v>0?T.accent:T.textMuted }}>{v>0?fmtINR(v):"—"}</span>
                          )}
                        </td>
                      );
                    })}
                    <td style={{ padding:"8px 12px", textAlign:"right", fontFamily:"'JetBrains Mono',monospace", color:fyT>0?T.text:T.textMuted, fontWeight:700 }}>{fyT>0?fmtINR(fyT):"—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {/* Month edit controls */}
        <div style={{ padding:"12px 20px", borderTop:`1px solid ${T.border}`, display:"flex", gap:"4px", flexWrap:"wrap", alignItems:"center" }}>
          <span style={{ fontSize:"11px", color:T.textMuted, fontWeight:600, marginRight:"4px" }}>ENTER SIP:</span>
          {MONTHS.map((m,mi)=>{
            const hasData = sips.some(s=>Number(s.months?.[mi])>0);
            return (
              <button key={m} onClick={()=>{
                if(editSipMonth===mi){ saveSip(mi); }
                else { setSipDraft(Object.fromEntries(sips.map(s=>[s.id, s.months?.[mi]||""]))); setEditSipMonth(mi); }
              }} style={{ padding:"5px 10px", borderRadius:"6px", border:"none", fontSize:"11px", fontWeight:600, cursor:"pointer",
                background:editSipMonth===mi?T.accent:hasData?T.card:"transparent",
                color:editSipMonth===mi?T.bg:hasData?T.accent:T.textMuted }}>
                {editSipMonth===mi?"Save":m}
              </button>
            );
          })}
        </div>
      </div>

      {/* EPF + Debt + Baby (read-only from investments) */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))", gap:"16px", marginBottom:"24px" }}>
        <div style={{ background:T.surface, borderRadius:"12px", border:`1px solid ${T.border}`, padding:"16px 20px" }}>
          <div style={{ fontSize:"12px", color:T.textMuted, fontWeight:700, marginBottom:"8px" }}>EPF CORPUS</div>
          <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"22px", fontWeight:800, color:T.blue }}>{fmtINR(epfCorpus)}</div>
          <div style={{ fontSize:"11px", color:T.textMuted, marginTop:"4px" }}>Opening ₹{fmtINR(epfOpening.Selva+epfOpening.Akshaya).replace("₹","")} + FY27 contributions</div>
        </div>
        <div style={{ background:T.surface, borderRadius:"12px", border:`1px solid ${T.border}`, padding:"16px 20px" }}>
          <div style={{ fontSize:"12px", color:T.textMuted, fontWeight:700, marginBottom:"8px" }}>DEBT FUNDS</div>
          <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"22px", fontWeight:800, color:T.teal }}>{fmtINR(debtTotal)}</div>
          <div style={{ fontSize:"11px", color:T.textMuted, marginTop:"4px" }}>{debtFunds.length} fund{debtFunds.length!==1?"s":""} · Manage in Investments tab</div>
        </div>
        <div style={{ background:T.surface, borderRadius:"12px", border:`1px solid ${T.border}`, padding:"16px 20px" }}>
          <div style={{ fontSize:"12px", color:T.textMuted, fontWeight:700, marginBottom:"8px" }}>BABY FUND</div>
          <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"22px", fontWeight:800, color:T.akshaya }}>{fmtINR(babyTotal)}</div>
          <div style={{ fontSize:"11px", color:T.textMuted, marginTop:"4px" }}>FY27 contributions · Manage in Investments tab</div>
        </div>
      </div>

      {/* Gold ETF */}
      <div style={{ background:T.surface, borderRadius:"12px", border:`1px solid ${T.border}`, marginBottom:"24px", overflow:"hidden" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"14px 20px", borderBottom:`1px solid ${T.border}` }}>
          <div>
            <span style={{ fontSize:"14px", fontWeight:700, color:T.text }}>Gold ETF</span>
            <span style={{ fontSize:"11px", color:T.textMuted, marginLeft:"10px" }}>Singapore trip fund target: ₹5,00,000 by Jan 2027</span>
          </div>
          <button onClick={()=>{ setGoldDraft({ units:gold.units, pricePerUnit:gold.pricePerUnit }); setEditGold(!editGold); }}
            style={{ padding:"6px 14px", background:editGold?T.card:T.accent, border:`1px solid ${editGold?T.border:T.accent}`, borderRadius:"8px", color:editGold?T.textDim:T.bg, fontSize:"12px", fontWeight:700, cursor:"pointer" }}>
            {editGold?"Cancel":"Edit"}
          </button>
        </div>
        <div style={{ padding:"16px 20px" }}>
          <div style={{ display:"flex", gap:"24px", flexWrap:"wrap", alignItems:"center" }}>
            <div>
              <div style={{ fontSize:"11px", color:T.textMuted, marginBottom:"4px" }}>Units Held</div>
              {editGold ? <input type="number" step="0.001" value={goldDraft.units} onChange={e=>setGoldDraft(d=>({...d,units:e.target.value}))} style={{ ...inp, width:"120px" }}/> : <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"20px", fontWeight:800, color:T.amber }}>{gold.units||0}</div>}
            </div>
            <div>
              <div style={{ fontSize:"11px", color:T.textMuted, marginBottom:"4px" }}>Price per gram (₹)</div>
              {editGold ? <input type="number" value={goldDraft.pricePerUnit} onChange={e=>setGoldDraft(d=>({...d,pricePerUnit:e.target.value}))} style={{ ...inp, width:"120px" }}/> : <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"20px", fontWeight:800, color:T.amber }}>{fmtINR(gold.pricePerUnit||0)}</div>}
            </div>
            <div>
              <div style={{ fontSize:"11px", color:T.textMuted, marginBottom:"4px" }}>Current Value</div>
              <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"20px", fontWeight:800, color:T.amber }}>{fmtINR(goldVal)}</div>
            </div>
            <div style={{ flex:1 }}>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:"11px", color:T.textMuted, marginBottom:"4px" }}><span>vs ₹5L target</span><span>{Math.min(100,Math.round(goldVal/500000*100))}%</span></div>
              <div style={{ height:"6px", background:T.border, borderRadius:"3px", overflow:"hidden" }}>
                <div style={{ height:"100%", width:`${Math.min(100,goldVal/500000*100)}%`, background:T.amber, borderRadius:"3px", transition:"width 0.5s" }}/>
              </div>
            </div>
          </div>
          {editGold && <div style={{ marginTop:"12px", display:"flex", justifyContent:"flex-end" }}><button onClick={saveGold} style={{ padding:"8px 20px", background:T.accent, border:"none", borderRadius:"8px", color:T.bg, fontSize:"13px", fontWeight:700, cursor:"pointer" }}>Save</button></div>}
        </div>
      </div>

      {/* Other equity */}
      <div style={{ background:T.surface, borderRadius:"12px", border:`1px solid ${T.border}`, overflow:"hidden" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"14px 20px", borderBottom:`1px solid ${T.border}` }}>
          <span style={{ fontSize:"14px", fontWeight:700, color:T.text }}>Other Equity / Instruments</span>
          <button onClick={()=>setShowAddOther(!showAddOther)} style={{ padding:"7px 16px", background:showAddOther?T.card:T.accent, border:`1px solid ${showAddOther?T.border:T.accent}`, borderRadius:"8px", color:showAddOther?T.textDim:T.bg, fontSize:"12px", fontWeight:700, cursor:"pointer" }}>
            {showAddOther?"Cancel":"+ Add"}
          </button>
        </div>
        {showAddOther && (
          <div style={{ padding:"16px 20px", borderBottom:`1px solid ${T.border}`, display:"flex", gap:"10px", flexWrap:"wrap", alignItems:"flex-end" }}>
            {[{k:"name",l:"NAME",ph:"e.g. Family Function Fund",t:"text"},{k:"amount",l:"AMOUNT (₹)",ph:"e.g. 200000",t:"number"},{k:"date",l:"DATE",ph:"",t:"date"},{k:"notes",l:"NOTES",ph:"Optional",t:"text"}].map(f=>(
              <div key={f.k} style={{ flex:"1 1 140px" }}>
                <label style={{ fontSize:"11px", color:T.textMuted, fontWeight:700, display:"block", marginBottom:"4px" }}>{f.l}</label>
                <input type={f.t} value={newOther[f.k]} onChange={e=>setNewOther(v=>({...v,[f.k]:e.target.value}))} placeholder={f.ph} style={{ ...inp, width:"100%" }}/>
              </div>
            ))}
            <button onClick={addOther} style={{ padding:"8px 20px", background:T.accent, border:"none", borderRadius:"8px", color:T.bg, fontSize:"13px", fontWeight:700, cursor:"pointer", height:"38px" }}>Add</button>
          </div>
        )}
        {otherEquity.length === 0 && !showAddOther ? (
          <div style={{ padding:"24px 20px", textAlign:"center", color:T.textMuted, fontSize:"13px" }}>No other instruments added. Use this for liquid funds, direct equity, etc.</div>
        ) : (
          <div style={{ padding:"12px 20px", display:"flex", flexDirection:"column", gap:"8px" }}>
            {otherEquity.map(o=>(
              <div key={o.id} style={{ display:"flex", alignItems:"center", gap:"12px", padding:"10px 14px", background:T.card, borderRadius:"10px", border:`1px solid ${T.border}` }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:"13px", fontWeight:600, color:T.text }}>{o.name}</div>
                  {(o.date||o.notes)&&<div style={{ fontSize:"11px", color:T.textMuted, marginTop:"2px" }}>{o.date&&new Date(o.date).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"})}{o.notes&&` · ${o.notes}`}</div>}
                </div>
                <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"15px", fontWeight:700, color:T.accent }}>{fmtINR(Number(o.amount)||0)}</span>
                <button onClick={()=>deleteOther(o.id)} style={{ background:"none", border:"none", color:T.red, cursor:"pointer", fontSize:"16px", opacity:0.6 }}>✕</button>
              </div>
            ))}
            {otherEquity.length>0&&<div style={{ display:"flex", justifyContent:"space-between", padding:"8px 14px", fontSize:"13px", fontWeight:700 }}><span style={{ color:T.text }}>Total</span><span style={{ fontFamily:"'JetBrains Mono',monospace", color:T.accent }}>{fmtINR(otherTotal)}</span></div>}
          </div>
        )}
      </div>
    </div>
  );
}
