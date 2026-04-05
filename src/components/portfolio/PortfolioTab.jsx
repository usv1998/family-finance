import { useState } from "react";
import { T } from "../../lib/theme";
import { fmtINR, fmtUSD, genId } from "../../lib/formatters";
import { PERSONS, MONTHS } from "../../lib/constants";

// ── helpers ──────────────────────────────────────────────────────────────────

const TRACKED_FY_START = "FY2025-26";

function fyKeys(portfolioData) {
  return Object.keys(portfolioData || {})
    .filter(k => k !== "opening" && k.startsWith("FY"))
    .sort();
}

function defaultOpening() {
  return {
    stocks:        { MSFT: { shares: 0 }, NVDA: { shares: 0 } },
    sipCorpus:     0,
    epf:           { Selva: 0, Akshaya: 0 },
    gold:          { units: 0, pricePerUnit: 15100 },
    debtFunds:     [],
    babyFundCorpus:0,
    otherEquity:   [],
    initialized:   false,
  };
}

// ── main component ────────────────────────────────────────────────────────────

export default function PortfolioTab({ portfolioData, investmentsData, incomeData, rsuData, fy, onUpdate, liveData }) {
  const [viewMode,       setViewMode]       = useState("cumulative");
  const [showOpeningInit,setShowOpeningInit] = useState(false);
  const [openingDraft,   setOpeningDraft]   = useState(null);

  // ── FY-specific data ─────────────────────────────────────────────────────
  const inv         = portfolioData?.[fy] || {};
  const stocks      = inv.stocks      || { MSFT: { shares: 0 }, NVDA: { shares: 0 } };
  const sips        = inv.sips        || [];
  const gold        = inv.gold        || { units: 0, pricePerUnit: 15100 };
  const otherEquity = inv.otherEquity || [];

  const [editStocks,   setEditStocks]   = useState(false);
  const [stockDraft,   setStockDraft]   = useState({});
  const [editGold,     setEditGold]     = useState(false);
  const [goldDraft,    setGoldDraft]    = useState({});
  const [editSipMonth, setEditSipMonth] = useState(null);
  const [sipDraft,     setSipDraft]     = useState({});
  const [showAddOther, setShowAddOther] = useState(false);
  const [newOther,     setNewOther]     = useState({ name:"", amount:"", date:"", notes:"" });

  const opening = portfolioData?.opening || defaultOpening();

  // ── FY-view helpers ──────────────────────────────────────────────────────
  const epfOpening  = investmentsData?.[fy]?.epfOpening || { Selva: 0, Akshaya: 0 };
  const epfCorpus   = PERSONS.reduce((s, p) => {
    const monthly = MONTHS.map((_,mi) => Number(incomeData?.[fy]?.[p]?.[mi]?.epf) || 0);
    return s + (epfOpening[p] || 0) + monthly.reduce((a,v) => a+v, 0) * 2;
  }, 0);
  const debtFunds   = investmentsData?.[fy]?.debtFunds || [];
  const debtTotal   = debtFunds.reduce((s,d) => s + Number(d.amount||0), 0);
  const babyFund    = investmentsData?.[fy]?.babyFund || { months:{} };
  const babyTotal   = MONTHS.reduce((s,_,mi) => s + (Number(babyFund.months?.[mi]) || 0), 0);
  const msftShares  = Number(stocks.MSFT?.shares) || 0;
  const nvdaShares  = Number(stocks.NVDA?.shares) || 0;
  const msftVal     = msftShares * liveData.MSFT * liveData.USDINR;
  const nvdaVal     = nvdaShares * liveData.NVDA * liveData.USDINR;
  const stockTotal  = msftVal + nvdaVal;
  const sipTotal    = sips.reduce((s,sip) => s + MONTHS.reduce((ss,_,mi) => ss+(Number(sip.months?.[mi])||0), 0), 0);
  const goldVal     = Number(gold.units||0) * Number(gold.pricePerUnit||0);
  const otherTotal  = otherEquity.reduce((s,o) => s + Number(o.amount||0), 0);

  // ── Cumulative helpers ───────────────────────────────────────────────────
  const allFYs = fyKeys(portfolioData);
  // Stocks: use current FY share count (user keeps this as their running total)
  const cumStockTotal = stockTotal;
  // SIPs: opening corpus + sum of all FY monthly SIP amounts
  const cumSipInvested = Number(opening.sipCorpus||0) +
    allFYs.reduce((sum, fyK) => {
      const fyInv = portfolioData?.[fyK] || {};
      return sum + (fyInv.sips||[]).reduce((s,sip) => s + MONTHS.reduce((ss,_,mi)=>ss+(Number(sip.months?.[mi])||0),0), 0);
    }, 0);
  // EPF: opening + all FY contributions (emp+employer)
  const cumEPF = PERSONS.reduce((sum, p) => {
    const opEpf = Number(opening.epf?.[p]||0);
    const tracked = allFYs.reduce((s, fyK) => {
      const monthly = MONTHS.map((_,mi) => Number(incomeData?.[fyK]?.[p]?.[mi]?.epf)||0);
      return s + monthly.reduce((a,v)=>a+v,0)*2;
    }, 0);
    return sum + opEpf + tracked;
  }, 0);
  // Debt: opening debt + all FY debt funds
  const cumDebtFunds = [
    ...(opening.debtFunds||[]),
    ...allFYs.flatMap(fyK => investmentsData?.[fyK]?.debtFunds || []),
  ];
  const cumDebtTotal = cumDebtFunds.reduce((s,d) => s + Number(d.amount||0), 0);
  // Baby fund: opening + all FY months
  const cumBaby = Number(opening.babyFundCorpus||0) +
    allFYs.reduce((sum, fyK) => {
      const bf = investmentsData?.[fyK]?.babyFund || { months:{} };
      return sum + MONTHS.reduce((s,_,mi)=>s+(Number(bf.months?.[mi])||0),0);
    }, 0);
  // Gold: current FY value (shares accumulate, user keeps updated)
  const cumGoldVal = goldVal;
  // Other: opening + all FY other equity
  const cumOtherEquity = [
    ...(opening.otherEquity||[]),
    ...allFYs.flatMap(fyK => portfolioData?.[fyK]?.otherEquity || []),
  ];
  const cumOtherTotal = cumOtherEquity.reduce((s,o) => s + Number(o.amount||0), 0);

  // ── Corpus arrays ────────────────────────────────────────────────────────
  const buildCorpus = (stk, sipV, epfV, debt, gld, baby, other) =>
    [{ label:"Stocks (MSFT+NVDA)", value:stk,  color:T.purple },
     { label:"Equity SIP",         value:sipV,  color:T.accent },
     { label:"EPF",                 value:epfV,  color:T.blue   },
     { label:"Debt Funds",          value:debt,  color:T.teal   },
     { label:"Gold ETF",            value:gld,   color:T.amber  },
     { label:"Baby Fund",           value:baby,  color:T.akshaya},
     { label:"Other",               value:other, color:T.textDim},
    ].filter(c => c.value > 0);

  const fyCorpus  = buildCorpus(stockTotal, sipTotal,      epfCorpus, debtTotal,    goldVal,    babyTotal, otherTotal);
  const cumCorpus = buildCorpus(cumStockTotal, cumSipInvested, cumEPF,   cumDebtTotal, cumGoldVal, cumBaby,   cumOtherTotal);
  const corpus    = viewMode === "cumulative" ? cumCorpus : fyCorpus;

  const total      = corpus.reduce((s,c) => s+c.value, 0);
  const equityVal  = viewMode === "cumulative" ? cumStockTotal+cumSipInvested+cumOtherTotal : stockTotal+sipTotal+otherTotal;
  const debtSafeV  = viewMode === "cumulative" ? cumEPF+cumDebtTotal+cumBaby : epfCorpus+debtTotal+babyTotal;

  // ── Mutations ────────────────────────────────────────────────────────────
  const updateInv = (patch) => onUpdate(fy, { stocks, sips, gold, otherEquity, ...inv, ...patch });
  const saveStocks = () => {
    updateInv({ stocks: { MSFT: { shares: Number(stockDraft.MSFT)||0 }, NVDA: { shares: Number(stockDraft.NVDA)||0 } } });
    setEditStocks(false);
  };
  const saveGold = () => {
    updateInv({ gold: { units: Number(goldDraft.units)||0, pricePerUnit: Number(goldDraft.pricePerUnit)||15100 } });
    setEditGold(false);
  };
  const saveSip = (mi) => {
    const updated = sips.map(sip => ({ ...sip, months: { ...sip.months, [mi]: Number(sipDraft[sip.id])||0 } }));
    updateInv({ sips: updated });
    setEditSipMonth(null);
  };
  const addOther = () => {
    if (!newOther.name.trim()) return;
    updateInv({ otherEquity: [...otherEquity, { id:genId(), ...newOther, amount: Number(newOther.amount)||0 }] });
    setNewOther({ name:"", amount:"", date:"", notes:"" });
    setShowAddOther(false);
  };
  const deleteOther = (id) => updateInv({ otherEquity: otherEquity.filter(o => o.id!==id) });

  const saveOpening = () => {
    onUpdate("opening", { ...openingDraft, initialized: true });
    setShowOpeningInit(false);
    setOpeningDraft(null);
  };

  // ── Styles ───────────────────────────────────────────────────────────────
  const inp = { padding:"8px 12px", background:T.card, border:`1px solid ${T.border}`, borderRadius:"8px", color:T.text, fontSize:"13px", outline:"none", fontFamily:"'JetBrains Mono',monospace" };
  const SumCard = ({ label, value, sub, color }) => (
    <div style={{ background:T.surface, borderRadius:"10px", padding:"14px 16px", border:`1px solid ${T.border}` }}>
      <div style={{ fontSize:"11px", color:T.textMuted, fontWeight:700, letterSpacing:"0.5px", marginBottom:"6px" }}>{label.toUpperCase()}</div>
      <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"18px", fontWeight:800, color }}>{fmtINR(value)}</div>
      {sub && <div style={{ fontSize:"11px", color:T.textMuted, marginTop:"4px" }}>{sub}</div>}
    </div>
  );

  const btnStyle = (active) => ({
    padding:"8px 18px", borderRadius:"8px", border:"none", fontSize:"13px", fontWeight:600, cursor:"pointer", transition:"all 0.2s",
    background: active ? T.accent : "transparent", color: active ? T.bg : T.textDim,
  });

  // ── Opening Balances Init Form ───────────────────────────────────────────
  const renderOpeningInit = () => {
    const d = openingDraft || { ...defaultOpening(), ...opening };
    const upd = (k, v) => setOpeningDraft(prev => ({ ...(prev || d), [k]: v }));

    return (
      <div style={{ background:T.card, borderRadius:"12px", border:`1px solid ${T.amber}44`, padding:"20px", marginBottom:"24px" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"16px" }}>
          <div>
            <div style={{ fontSize:"14px", fontWeight:700, color:T.amber }}>Initialize Opening Balances</div>
            <div style={{ fontSize:"12px", color:T.textMuted, marginTop:"2px" }}>Portfolio state as of April 1, 2025 (start of FY2025-26)</div>
          </div>
          <button onClick={()=>{ setShowOpeningInit(false); setOpeningDraft(null); }} style={{ background:"none", border:"none", color:T.textMuted, cursor:"pointer", fontSize:"18px" }}>✕</button>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))", gap:"16px", marginBottom:"16px" }}>
          {/* Stocks */}
          <div>
            <div style={{ fontSize:"11px", color:T.textMuted, fontWeight:700, marginBottom:"8px" }}>STOCKS HELD</div>
            {["MSFT","NVDA"].map(s=>(
              <div key={s} style={{ marginBottom:"8px" }}>
                <label style={{ fontSize:"11px", color:T.textDim, display:"block", marginBottom:"3px" }}>{s} shares</label>
                <input type="number" value={d.stocks?.[s]?.shares||""} onChange={e=>upd("stocks",{...d.stocks,[s]:{shares:e.target.value}})} placeholder="0" style={{ ...inp, width:"100%" }}/>
              </div>
            ))}
          </div>

          {/* SIP / MF corpus */}
          <div>
            <div style={{ fontSize:"11px", color:T.textMuted, fontWeight:700, marginBottom:"8px" }}>MUTUAL FUND CORPUS (₹)</div>
            <input type="number" value={d.sipCorpus||""} onChange={e=>upd("sipCorpus",e.target.value)} placeholder="0" style={{ ...inp, width:"100%", marginBottom:"8px" }}/>
            <div style={{ fontSize:"11px", color:T.textMuted, fontWeight:700, marginBottom:"8px", marginTop:"8px" }}>BABY FUND CORPUS (₹)</div>
            <input type="number" value={d.babyFundCorpus||""} onChange={e=>upd("babyFundCorpus",e.target.value)} placeholder="0" style={{ ...inp, width:"100%" }}/>
          </div>

          {/* EPF */}
          <div>
            <div style={{ fontSize:"11px", color:T.textMuted, fontWeight:700, marginBottom:"8px" }}>EPF (TOTAL incl. employer)</div>
            {PERSONS.map(p=>(
              <div key={p} style={{ marginBottom:"8px" }}>
                <label style={{ fontSize:"11px", color:T.textDim, display:"block", marginBottom:"3px" }}>{p} EPF</label>
                <input type="number" value={d.epf?.[p]||""} onChange={e=>upd("epf",{...d.epf,[p]:e.target.value})} placeholder="0" style={{ ...inp, width:"100%" }}/>
              </div>
            ))}
          </div>

          {/* Gold */}
          <div>
            <div style={{ fontSize:"11px", color:T.textMuted, fontWeight:700, marginBottom:"8px" }}>GOLD ETF</div>
            <div style={{ marginBottom:"8px" }}>
              <label style={{ fontSize:"11px", color:T.textDim, display:"block", marginBottom:"3px" }}>Units held</label>
              <input type="number" step="0.001" value={d.gold?.units||""} onChange={e=>upd("gold",{...d.gold,units:e.target.value})} placeholder="0" style={{ ...inp, width:"100%" }}/>
            </div>
            <div>
              <label style={{ fontSize:"11px", color:T.textDim, display:"block", marginBottom:"3px" }}>Price/unit (₹)</label>
              <input type="number" value={d.gold?.pricePerUnit||15100} onChange={e=>upd("gold",{...d.gold,pricePerUnit:e.target.value})} style={{ ...inp, width:"100%" }}/>
            </div>
          </div>
        </div>

        <div style={{ display:"flex", justifyContent:"flex-end", gap:"10px" }}>
          <button onClick={()=>{ setShowOpeningInit(false); setOpeningDraft(null); }} style={{ padding:"8px 20px", background:"transparent", border:`1px solid ${T.border}`, borderRadius:"8px", color:T.textDim, fontSize:"13px", fontWeight:600, cursor:"pointer" }}>Cancel</button>
          <button onClick={saveOpening} style={{ padding:"8px 24px", background:T.amber, border:"none", borderRadius:"8px", color:T.bg, fontSize:"13px", fontWeight:700, cursor:"pointer" }}>Save Opening Balances</button>
        </div>
      </div>
    );
  };

  return (
    <div>
      {/* View toggle */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"20px", flexWrap:"wrap", gap:"12px" }}>
        <div style={{ display:"flex", gap:"4px", padding:"4px", background:T.card, borderRadius:"10px" }}>
          <button onClick={()=>setViewMode("cumulative")} style={btnStyle(viewMode==="cumulative")}>All-Time Corpus</button>
          <button onClick={()=>setViewMode("fy")} style={btnStyle(viewMode==="fy")}>FY View ({fy})</button>
        </div>
        {viewMode==="cumulative" && (
          <button onClick={()=>{ setOpeningDraft(null); setShowOpeningInit(true); }}
            style={{ padding:"8px 16px", background:"transparent", border:`1px solid ${T.amber}66`, borderRadius:"8px", color:T.amber, fontSize:"12px", fontWeight:600, cursor:"pointer" }}>
            {opening.initialized ? "Edit Opening Balances" : "⚠ Initialize Opening Balances"}
          </button>
        )}
      </div>

      {/* Opening init form */}
      {showOpeningInit && renderOpeningInit()}

      {/* Cumulative banner if not initialized */}
      {viewMode==="cumulative" && !opening.initialized && !showOpeningInit && (
        <div style={{ background:T.amber+"11", border:`1px solid ${T.amber}33`, borderRadius:"10px", padding:"12px 16px", marginBottom:"20px", display:"flex", justifyContent:"space-between", alignItems:"center", gap:"12px" }}>
          <div style={{ fontSize:"13px", color:T.amber }}>Opening balances not set. Cumulative figures show only tracked FY data — set your April 1, 2025 portfolio snapshot for accurate totals.</div>
          <button onClick={()=>setShowOpeningInit(true)} style={{ padding:"6px 14px", background:T.amber, border:"none", borderRadius:"8px", color:T.bg, fontSize:"12px", fontWeight:700, cursor:"pointer", whiteSpace:"nowrap" }}>Set Now</button>
        </div>
      )}

      {/* Summary cards */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:"12px", marginBottom:"24px" }}>
        <SumCard label={viewMode==="cumulative"?"Total Corpus":"FY Corpus"} value={total}     color={T.accent} sub={viewMode==="cumulative"?"All-time across FYs":`${fy} only`}/>
        <SumCard label="Equity"         value={equityVal}  color={T.purple} sub={total>0?`${Math.round(equityVal/total*100)}% of corpus`:""}/>
        <SumCard label="Debt / Safe"    value={debtSafeV}  color={T.blue}   sub={total>0?`${Math.round(debtSafeV/total*100)}% of corpus`:""}/>
        <SumCard label="Gold"           value={viewMode==="cumulative"?cumGoldVal:goldVal} color={T.amber} sub={(viewMode==="fy"?gold.units:opening.gold?.units+(gold.units||0))?`${viewMode==="fy"?(gold.units||0):((Number(opening.gold?.units)||0)+(Number(gold.units)||0))} units`:"Not entered"}/>
      </div>

      {/* Asset allocation bar */}
      {total > 0 && (
        <div style={{ background:T.surface, borderRadius:"12px", border:`1px solid ${T.border}`, padding:"16px 20px", marginBottom:"24px" }}>
          <div style={{ fontSize:"13px", fontWeight:700, color:T.text, marginBottom:"12px" }}>Asset Allocation</div>
          <div style={{ display:"flex", height:"10px", borderRadius:"5px", overflow:"hidden", gap:"1px" }}>
            {corpus.map(c => <div key={c.label} style={{ width:`${c.value/total*100}%`, background:c.color, transition:"width 0.5s" }}/>)}
          </div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:"12px", marginTop:"12px" }}>
            {corpus.map(c => (
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
          <div>
            <span style={{ fontSize:"14px", fontWeight:700, color:T.text }}>Stock Holdings</span>
            {viewMode==="cumulative" && <span style={{ fontSize:"11px", color:T.textMuted, marginLeft:"8px" }}>Enter current shares held (incl. all vests − sold)</span>}
          </div>
          <div style={{ display:"flex", gap:"8px", alignItems:"center" }}>
            <span style={{ fontSize:"11px", color:T.textMuted }}>Live: MSFT {fmtUSD(liveData.MSFT)} · NVDA {fmtUSD(liveData.NVDA)} · ₹{liveData.USDINR.toFixed(2)}</span>
            <button onClick={()=>{ setStockDraft({ MSFT:msftShares, NVDA:nvdaShares }); setEditStocks(!editStocks); }}
              style={{ padding:"6px 14px", background:editStocks?T.card:T.accent, border:`1px solid ${editStocks?T.border:T.accent}`, borderRadius:"8px", color:editStocks?T.textDim:T.bg, fontSize:"12px", fontWeight:700, cursor:"pointer" }}>
              {editStocks ? "Cancel" : "Edit"}
            </button>
          </div>
        </div>
        <div style={{ padding:"16px 20px" }}>
          {[{ stock:"MSFT", shares:msftShares, val:msftVal, color:T.blue,    person:"Selva"   },
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
          <div>
            <span style={{ fontSize:"14px", fontWeight:700, color:T.text }}>Equity SIP</span>
            {viewMode==="cumulative" && Number(opening.sipCorpus)>0 && (
              <span style={{ fontSize:"11px", color:T.textMuted, marginLeft:"8px" }}>Opening corpus {fmtINR(Number(opening.sipCorpus))} + FY contributions</span>
            )}
          </div>
          <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"14px", fontWeight:700, color:T.accent }}>{fmtINR(viewMode==="cumulative"?cumSipInvested:sipTotal)}</span>
        </div>
        {sips.length > 0 && (
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
        )}
        <div style={{ padding:"12px 20px", borderTop:`1px solid ${T.border}`, display:"flex", gap:"4px", flexWrap:"wrap", alignItems:"center" }}>
          <span style={{ fontSize:"11px", color:T.textMuted, fontWeight:600, marginRight:"4px" }}>ENTER SIP ({fy}):</span>
          {MONTHS.map((m,mi)=>{
            const hasData = sips.some(s=>Number(s.months?.[mi])>0);
            return (
              <button key={m} onClick={()=>{
                if(editSipMonth===mi){ saveSip(mi); }
                else { setSipDraft(Object.fromEntries(sips.map(s=>[s.id,s.months?.[mi]||""]))); setEditSipMonth(mi); }
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
          <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"22px", fontWeight:800, color:T.blue }}>{fmtINR(viewMode==="cumulative"?cumEPF:epfCorpus)}</div>
          <div style={{ fontSize:"11px", color:T.textMuted, marginTop:"4px" }}>
            {viewMode==="cumulative"
              ? `Opening ${fmtINR(Number(opening.epf?.Selva||0)+Number(opening.epf?.Akshaya||0))} + all FY contributions`
              : `Opening ${fmtINR(epfOpening.Selva+epfOpening.Akshaya)} + ${fy} contributions`}
          </div>
        </div>
        <div style={{ background:T.surface, borderRadius:"12px", border:`1px solid ${T.border}`, padding:"16px 20px" }}>
          <div style={{ fontSize:"12px", color:T.textMuted, fontWeight:700, marginBottom:"8px" }}>DEBT FUNDS</div>
          <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"22px", fontWeight:800, color:T.teal }}>{fmtINR(viewMode==="cumulative"?cumDebtTotal:debtTotal)}</div>
          <div style={{ fontSize:"11px", color:T.textMuted, marginTop:"4px" }}>
            {viewMode==="cumulative"
              ? `${cumDebtFunds.length} entries across all FYs`
              : `${debtFunds.length} fund${debtFunds.length!==1?"s":""} · Manage in Investments tab`}
          </div>
        </div>
        <div style={{ background:T.surface, borderRadius:"12px", border:`1px solid ${T.border}`, padding:"16px 20px" }}>
          <div style={{ fontSize:"12px", color:T.textMuted, fontWeight:700, marginBottom:"8px" }}>BABY FUND</div>
          <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"22px", fontWeight:800, color:T.akshaya }}>{fmtINR(viewMode==="cumulative"?cumBaby:babyTotal)}</div>
          <div style={{ fontSize:"11px", color:T.textMuted, marginTop:"4px" }}>
            {viewMode==="cumulative"
              ? `Opening ${fmtINR(Number(opening.babyFundCorpus||0))} + all FY months`
              : `${fy} contributions · Manage in Investments tab`}
          </div>
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
            {editGold ? "Cancel" : "Edit"}
          </button>
        </div>
        <div style={{ padding:"16px 20px" }}>
          <div style={{ display:"flex", gap:"24px", flexWrap:"wrap", alignItems:"center" }}>
            <div>
              <div style={{ fontSize:"11px", color:T.textMuted, marginBottom:"4px" }}>Units Held</div>
              {editGold
                ? <input type="number" step="0.001" value={goldDraft.units} onChange={e=>setGoldDraft(d=>({...d,units:e.target.value}))} style={{ ...inp, width:"120px" }}/>
                : <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"20px", fontWeight:800, color:T.amber }}>{gold.units||0}</div>}
            </div>
            <div>
              <div style={{ fontSize:"11px", color:T.textMuted, marginBottom:"4px" }}>Price per gram (₹)</div>
              {editGold
                ? <input type="number" value={goldDraft.pricePerUnit} onChange={e=>setGoldDraft(d=>({...d,pricePerUnit:e.target.value}))} style={{ ...inp, width:"120px" }}/>
                : <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"20px", fontWeight:800, color:T.amber }}>{fmtINR(gold.pricePerUnit||0)}</div>}
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
          <div>
            <span style={{ fontSize:"14px", fontWeight:700, color:T.text }}>Other Equity / Instruments</span>
            {viewMode==="cumulative" && <span style={{ fontSize:"11px", color:T.textMuted, marginLeft:"8px" }}>All FYs + opening</span>}
          </div>
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
        {(viewMode==="cumulative" ? cumOtherEquity : otherEquity).length === 0 && !showAddOther ? (
          <div style={{ padding:"24px 20px", textAlign:"center", color:T.textMuted, fontSize:"13px" }}>No other instruments added. Use this for liquid funds, direct equity, etc.</div>
        ) : (
          <div style={{ padding:"12px 20px", display:"flex", flexDirection:"column", gap:"8px" }}>
            {(viewMode==="cumulative" ? cumOtherEquity : otherEquity).map(o=>(
              <div key={o.id} style={{ display:"flex", alignItems:"center", gap:"12px", padding:"10px 14px", background:T.card, borderRadius:"10px", border:`1px solid ${T.border}` }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:"13px", fontWeight:600, color:T.text }}>{o.name}</div>
                  {(o.date||o.notes)&&<div style={{ fontSize:"11px", color:T.textMuted, marginTop:"2px" }}>{o.date&&new Date(o.date).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"})}{o.notes&&` · ${o.notes}`}</div>}
                </div>
                <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"15px", fontWeight:700, color:T.accent }}>{fmtINR(Number(o.amount)||0)}</span>
                {otherEquity.find(x=>x.id===o.id) && (
                  <button onClick={()=>deleteOther(o.id)} style={{ background:"none", border:"none", color:T.red, cursor:"pointer", fontSize:"16px", opacity:0.6 }}>✕</button>
                )}
              </div>
            ))}
            {(viewMode==="cumulative"?cumOtherEquity:otherEquity).length>0&&<div style={{ display:"flex", justifyContent:"space-between", padding:"8px 14px", fontSize:"13px", fontWeight:700 }}><span style={{ color:T.text }}>Total</span><span style={{ fontFamily:"'JetBrains Mono',monospace", color:T.accent }}>{fmtINR(viewMode==="cumulative"?cumOtherTotal:otherTotal)}</span></div>}
          </div>
        )}
      </div>
    </div>
  );
}
