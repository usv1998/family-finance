import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "./lib/supabase";
import { TABS, EMPLOYER, LIVE_DEFAULTS } from "./lib/constants";
import { clearBiometricEnrollment } from "./lib/biometric";
import { T } from "./lib/theme";
import { getCurrentFY, getFYOptions, genId } from "./lib/formatters";
import { loadData, saveData } from "./lib/storage";
import { SEED_DATA } from "./lib/seed";
import { IMPORTED_TX } from "./lib/importedExpenses";
import { fetchLiveData } from "./lib/marketData";

import LiveStrip from "./components/LiveStrip";
import LoginScreen from "./components/LoginScreen";
import LockScreen from "./components/LockScreen";
import IncomeTab from "./components/income/IncomeTab";
import InvestmentsTab from "./components/investments/InvestmentsTab";
import ExpensesTab from "./components/expenses/ExpensesTab";
import DailyExpensesTab from "./components/expenses/DailyExpensesTab";
import PortfolioTab from "./components/portfolio/PortfolioTab";

export default function FamilyFinanceTracker() {
  const [activeTab,      setActiveTab]      = useState("daily");
  const [fy,             setFY]             = useState(getCurrentFY());
  const [incomeData,     setIncomeData]     = useState({});
  const [rsuData,        setRsuData]        = useState({});
  const [investmentsData,setInvestmentsData]= useState({});
  const [expensesData,   setExpensesData]   = useState({});
  const [portfolioData,  setPortfolioData]  = useState({});
  const [rsuGrants,      setRsuGrants]      = useState([]);
  const [holdingsData,   setHoldingsData]   = useState([]);
  const [txData,         setTxData]         = useState([]);
  const [liveData,       setLiveData]       = useState(LIVE_DEFAULTS);
  const [refreshing,     setRefreshing]     = useState(false);
  const [loading,        setLoading]        = useState(true);
  const [user,           setUser]           = useState(null);
  const [authReady,      setAuthReady]      = useState(!supabase); // true immediately if no supabase
  const [syncing,        setSyncing]        = useState(false);
  const [locked,         setLocked]         = useState(false);
  const saveRef = useRef(null);
  const userRef = useRef(null);

  const refreshMarket = useCallback(async () => {
    setRefreshing(true);
    try {
      const result = await fetchLiveData();
      setLiveData(prev => ({
        MSFT:    result.MSFT    ?? prev.MSFT,
        NVDA:    result.NVDA    ?? prev.NVDA,
        USDINR:  result.USDINR  ?? prev.USDINR,
        fetchedAt: result.fetchedAt,
        error:   result.error,
        partial: result.partial,
      }));
    } catch (_) { /* leave previous data intact */ }
    setRefreshing(false);
  }, []);

  // Fetch on mount + every 15 minutes
  useEffect(() => {
    refreshMarket();
    const id = setInterval(refreshMarket, 15 * 60 * 1000);
    return () => clearInterval(id);
  }, [refreshMarket]);

  // Auth state listener
  useEffect(()=>{
    if(!supabase){ setAuthReady(true); return; }
    supabase.auth.getSession().then(({ data:{ session } })=>{
      setUser(session?.user ?? null);
      userRef.current = session?.user ?? null;
      // Always lock when a session is found — LockScreen handles enrollment if needed
      if (session?.user) setLocked(true);
      setAuthReady(true);
    });
    const { data:{ subscription } } = supabase.auth.onAuthStateChange((_e, session)=>{
      setUser(session?.user ?? null);
      userRef.current = session?.user ?? null;
      // Lock on new sign-in so LockScreen can prompt for fingerprint enrollment
      if (_e === "SIGNED_IN") setLocked(true);
    });
    return ()=>subscription.unsubscribe();
  },[]);

  // Lock when app comes back from background after >30 s
  useEffect(()=>{
    let hiddenAt = 0;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
      } else if (document.visibilityState === "visible" && hiddenAt > 0) {
        if (Date.now() - hiddenAt > 30_000 && userRef.current) setLocked(true);
        hiddenAt = 0;
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  },[]); // userRef keeps this fresh without re-subscribing

  // Load data once auth is ready
  useEffect(()=>{
    if(!authReady) return;
    (async()=>{
      const saved = await loadData(userRef.current?.id);
      if(saved){
        if(saved.incomeData)      setIncomeData(saved.incomeData);
        if(saved.rsuData)         setRsuData(saved.rsuData);
        if(saved.investmentsData) setInvestmentsData(saved.investmentsData);
        if(saved.expensesData)    setExpensesData(saved.expensesData);
        else                      setExpensesData(SEED_DATA.expensesData);
        if(saved.portfolioData)   setPortfolioData(saved.portfolioData);
        else                      setPortfolioData(SEED_DATA.portfolioData);
        if(saved.rsuGrants)       setRsuGrants(saved.rsuGrants);
        else                      setRsuGrants(SEED_DATA.rsuGrants);
        if(saved.holdingsData)    setHoldingsData(saved.holdingsData);
        // Seed imported transactions once if txData is empty
        if(saved.txData?.length > 0) {
          setTxData(saved.txData);
        } else {
          setTxData(IMPORTED_TX);
          persist(
            saved.incomeData || SEED_DATA.incomeData,
            saved.rsuData || SEED_DATA.rsuData,
            saved.investmentsData || SEED_DATA.investmentsData,
            saved.expensesData || SEED_DATA.expensesData,
            saved.portfolioData || SEED_DATA.portfolioData,
            saved.rsuGrants || SEED_DATA.rsuGrants,
            saved.holdingsData || [],
            IMPORTED_TX,
          );
        }
      } else {
        setIncomeData(SEED_DATA.incomeData);
        setRsuData(SEED_DATA.rsuData);
        setInvestmentsData(SEED_DATA.investmentsData);
        setExpensesData(SEED_DATA.expensesData);
        setPortfolioData(SEED_DATA.portfolioData);
        setRsuGrants(SEED_DATA.rsuGrants);
        setTxData(IMPORTED_TX);
        await saveData({ incomeData:SEED_DATA.incomeData, rsuData:SEED_DATA.rsuData, investmentsData:SEED_DATA.investmentsData, expensesData:SEED_DATA.expensesData, portfolioData:SEED_DATA.portfolioData, rsuGrants:SEED_DATA.rsuGrants, holdingsData:[], txData:IMPORTED_TX }, userRef.current?.id);
      }
      setLoading(false);
    })();
  },[authReady]);

  const persist = useCallback((iD,rD,invD,expD,portD,rG,hD,tD)=>{
    if(saveRef.current) clearTimeout(saveRef.current);
    setSyncing(true);
    saveRef.current = setTimeout(async()=>{
      await saveData({incomeData:iD, rsuData:rD, investmentsData:invD, expensesData:expD, portfolioData:portD, rsuGrants:rG, holdingsData:hD, txData:tD}, userRef.current?.id);
      setSyncing(false);
    }, 500);
  },[]);

  const updateMonthlyIncome = (person, mi, data) => {
    const next={...incomeData};
    if(!next[fy])         next[fy]={};
    if(!next[fy][person]) next[fy][person]={};
    next[fy][person][mi]=data;
    // sticky EPF/ESPP/car propagation
    if(data.epf||data.car_lease){
      for(let i=mi+1;i<12;i++){
        if(!next[fy][person][i]) next[fy][person][i]={};
        const ex=next[fy][person][i];
        if(!ex.epf && data.epf) ex.epf=data.epf;
        if(person==="Selva"&&!ex.car_lease&&data.car_lease) ex.car_lease=data.car_lease;
      }
    }
    setIncomeData(next);
    persist(next, rsuData, investmentsData, expensesData, portfolioData, rsuGrants, holdingsData, txData);
  };

  const addRsuEvent = (event) => {
    const next={...rsuData};
    if(!next[event.fy]) next[event.fy]=[];
    next[event.fy]=[...next[event.fy],event];
    setRsuData(next);
    persist(incomeData, next, investmentsData, expensesData, portfolioData, rsuGrants, holdingsData, txData);
  };

  const deleteRsuEvent = (id) => {
    const next={...rsuData};
    Object.keys(next).forEach(k=>{next[k]=next[k].filter(e=>e.id!==id);});
    setRsuData(next);
    persist(incomeData, next, investmentsData, expensesData, portfolioData, rsuGrants, holdingsData, txData);
  };

  const addRsuGrant = (grant) => {
    const next = [...rsuGrants, grant];
    setRsuGrants(next);
    persist(incomeData, rsuData, investmentsData, expensesData, portfolioData, next, holdingsData, txData);
  };

  const deleteRsuGrant = (id) => {
    const next = rsuGrants.filter(g => g.id !== id);
    setRsuGrants(next);
    persist(incomeData, rsuData, investmentsData, expensesData, portfolioData, next, holdingsData, txData);
  };

  const updateInvestments = (fyKey, data) => {
    const next={...investmentsData,[fyKey]:data};
    setInvestmentsData(next);
    persist(incomeData, rsuData, next, expensesData, portfolioData, rsuGrants, holdingsData, txData);
  };

  const updateExpenses = (fyKey, data) => {
    const next={...expensesData,[fyKey]:data};
    setExpensesData(next);
    persist(incomeData, rsuData, investmentsData, next, portfolioData, rsuGrants, holdingsData, txData);
  };

  const updatePortfolio = (fyKey, data) => {
    const next={...portfolioData,[fyKey]:data};
    setPortfolioData(next);
    persist(incomeData, rsuData, investmentsData, expensesData, next, rsuGrants, holdingsData, txData);
  };

  const addHolding = (h) => {
    const next = [...holdingsData, h];
    setHoldingsData(next);
    persist(incomeData, rsuData, investmentsData, expensesData, portfolioData, rsuGrants, next, txData);
  };

  const deleteHolding = (id) => {
    const next = holdingsData.filter(h => h.id !== id);
    setHoldingsData(next);
    persist(incomeData, rsuData, investmentsData, expensesData, portfolioData, rsuGrants, next, txData);
  };

  const updateHolding = (id, changes) => {
    const next = holdingsData.map(h => h.id === id ? { ...h, ...changes } : h);
    setHoldingsData(next);
    persist(incomeData, rsuData, investmentsData, expensesData, portfolioData, rsuGrants, next, txData);
  };

  const updateHoldingsBatch = (updates) => {
    // updates: array of { id, changes }
    const next = holdingsData.map(h => {
      const u = updates.find(u => u.id === h.id);
      return u ? { ...h, ...u.changes } : h;
    });
    setHoldingsData(next);
    persist(incomeData, rsuData, investmentsData, expensesData, portfolioData, rsuGrants, next, txData);
  };

  // Apply FIFO sells against a mutable lot array (sorted oldest-first).
  // Mutates lots in place, removes fully-sold lots.
  const applyFifoSells = (lots, sells, qtyKey) => {
    // Sort sells by date so they're applied chronologically
    const sortedSells = [...sells].sort((a, b) => a.date.localeCompare(b.date));
    for (const sell of sortedSells) {
      let remaining = sell.qty;
      for (const lot of lots) {
        if (remaining <= 0) break;
        if (lot.date > sell.date) break; // can only sell lots bought before sell date
        const before = lot[qtyKey];
        const deduct = Math.min(before, remaining);
        lot[qtyKey]      = before - deduct;
        lot.costBasisINR = before > 0 ? lot.costBasisINR * (lot[qtyKey] / before) : 0;
        remaining -= deduct;
      }
    }
    return lots.filter(l => l[qtyKey] > 0.0001);
  };

  // Merge new stock lots into existing, dedup by (date+qty+avgPrice), apply FIFO sells.
  const mergeStockLots = (person, stocks) => {
    let next = [...holdingsData];
    for (const stock of stocks) {
      // Existing lots for this symbol+person as mutable objects
      const existing = next
        .filter(h => h.type === "in_stock" && h.person === person && h.symbol === stock.symbol)
        .map(h => ({ ...h }));
      next = next.filter(h => !(h.type === "in_stock" && h.person === person && h.symbol === stock.symbol));

      // Merge new buy lots — skip if same (date, qty, avgPrice) already exists
      for (const lot of stock.lots) {
        const isDup = existing.some(e =>
          e.acquisitionDate === lot.date &&
          Math.abs(e.quantity - lot.qty) < 0.001 &&
          Math.abs((e.costBasisINR / e.quantity) - lot.avgPrice) < 0.01
        );
        if (!isDup) {
          existing.push({
            id: genId(), type: "in_stock", person,
            name: stock.symbol, symbol: stock.symbol,
            quantity: lot.qty, costBasisINR: lot.costBasisINR,
            acquisitionDate: lot.date,
          });
        }
      }

      // Sort oldest-first, apply FIFO sells, push survivors back
      existing.sort((a, b) => a.acquisitionDate.localeCompare(b.acquisitionDate));
      const survivors = applyFifoSells(existing, stock.sells || [], "quantity");
      next = [...next, ...survivors];
    }
    setHoldingsData(next);
    persist(incomeData, rsuData, investmentsData, expensesData, portfolioData, rsuGrants, next, txData);
  };

  // Merge new MF SIP lots into existing, dedup by (date, units, navPrice), apply FIFO sells.
  const mergeMFLots = (person, funds) => {
    let next = [...holdingsData];
    for (const fund of funds) {
      const matchKey = h =>
        h.type === "mf" && h.person === person &&
        ((fund.schemeCode && h.schemeCode === fund.schemeCode) || h.isin === fund.isin);

      const existing = next.filter(matchKey).map(h => ({ ...h }));
      next = next.filter(h => !matchKey(h));

      for (const lot of fund.lots) {
        const isDup = existing.some(e =>
          e.acquisitionDate === lot.date &&
          Math.abs(e.units - lot.qty) < 0.001
        );
        if (!isDup) {
          existing.push({
            id: genId(), type: "mf", person,
            name: fund.schemeName || fund.name,
            schemeCode: fund.schemeCode || "",
            isin: fund.isin,
            units: lot.qty, costBasisINR: lot.costBasisINR,
            acquisitionDate: lot.date,
          });
        }
      }

      existing.sort((a, b) => a.acquisitionDate.localeCompare(b.acquisitionDate));
      const survivors = applyFifoSells(existing, fund.sells || [], "units");
      next = [...next, ...survivors];
    }
    setHoldingsData(next);
    persist(incomeData, rsuData, investmentsData, expensesData, portfolioData, rsuGrants, next, txData);
  };

  // Bulk upsert: match by schemeCode (mf) + person → update; else add new.
  const upsertHoldings = (person, items) => {
    let next = [...holdingsData];
    for (const item of items) {
      const idx = next.findIndex(h =>
        h.person === person && h.type === "mf" && h.schemeCode === item.schemeCode
      );
      if (idx >= 0) {
        next[idx] = { ...next[idx], units: item.units, costBasisINR: item.costBasisINR };
      } else {
        next = [...next, item];
      }
    }
    setHoldingsData(next);
    persist(incomeData, rsuData, investmentsData, expensesData, portfolioData, rsuGrants, next, txData);
  };

  // ── Daily transaction handlers ──────────────────────────────────────────
  const addTx = (tx) => {
    const next = [...txData, tx];
    setTxData(next);
    // Auto-roll: recompute expensesData actuals for the tx's FY month
    rollTxIntoExpenses(next);
    persist(incomeData, rsuData, investmentsData, expensesData, portfolioData, rsuGrants, holdingsData, next);
  };

  const deleteTx = (id) => {
    const next = txData.filter(t => t.id !== id);
    setTxData(next);
    rollTxIntoExpenses(next);
    persist(incomeData, rsuData, investmentsData, expensesData, portfolioData, rsuGrants, holdingsData, next);
  };

  const editTx = (tx) => {
    const next = txData.map(t => t.id === tx.id ? tx : t);
    setTxData(next);
    rollTxIntoExpenses(next);
    persist(incomeData, rsuData, investmentsData, expensesData, portfolioData, rsuGrants, holdingsData, next);
  };

  // Recompute expensesData actuals from txList for all FY months.
  // FY months: Apr=0..Mar=11. A date in YYYY-MM maps to FY month index.
  const rollTxIntoExpenses = (txList) => {
    // Build map: { fyKey: { monthIdx: { catId: total } } }
    const fyMap = {};
    for (const tx of txList) {
      const [y, m] = tx.date.split("-").map(Number); // m = 1-12
      // FY: Apr(m=4)..Mar(m=3 next year). FY starts in Apr.
      const fyYear = m >= 4 ? y : y - 1;
      const fyKey  = `FY${fyYear}-${String(fyYear + 1).slice(2)}`;
      const mi     = m >= 4 ? m - 4 : m + 8; // Apr=0, Mar=11
      if (!fyMap[fyKey])           fyMap[fyKey]           = {};
      if (!fyMap[fyKey][mi])       fyMap[fyKey][mi]       = {};
      const catId = tx.categoryId;
      fyMap[fyKey][mi][catId] = (fyMap[fyKey][mi][catId] || 0) + Number(tx.amount);
    }
    setExpensesData(prev => {
      const next = { ...prev };
      for (const [fyKey, months] of Object.entries(fyMap)) {
        const existing = next[fyKey] || {};
        const actuals  = { ...(existing.actuals || {}) };
        for (const [mi, cats] of Object.entries(months)) {
          // Merge: keep non-tx actuals, overwrite tx-sourced categories
          actuals[mi] = { ...(actuals[mi] || {}), ...cats };
        }
        next[fyKey] = { ...existing, actuals };
      }
      return next;
    });
  };

  if(!authReady || (supabase && !user)) return supabase && !user && authReady ? <LoginScreen/> : <div style={{ display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100vh",background:T.bg,color:T.accent,fontFamily:"'JetBrains Mono',monospace" }}>Loading…</div>;
  if(loading) return <div style={{ display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100vh",background:T.bg,color:T.accent,fontFamily:"'JetBrains Mono',monospace" }}>Loading…</div>;
  if(locked) return (
    <LockScreen
      userEmail={user?.email}
      onUnlock={() => setLocked(false)}
      onSignOut={() => {
        clearBiometricEnrollment();
        supabase?.auth.signOut();
      }}/>
  );

  const selectStyle={padding:"8px 14px",background:T.card,border:`1px solid ${T.border}`,borderRadius:"8px",color:T.text,fontSize:"13px",outline:"none",cursor:"pointer",appearance:"none",fontWeight:600};

  return (
    <div style={{ minHeight:"100vh", background:T.bg, color:T.text, fontFamily:"'DM Sans',-apple-system,sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700;800&display=swap');
        *{box-sizing:border-box;}
        ::-webkit-scrollbar{width:6px;height:6px;}
        ::-webkit-scrollbar-track{background:${T.bg};}
        ::-webkit-scrollbar-thumb{background:${T.border};border-radius:3px;}
        ::-webkit-scrollbar-thumb:hover{background:${T.borderLight};}
        @keyframes pulse{0%,100%{opacity:1;}50%{opacity:0.3;}}
        input[type=number]::-webkit-inner-spin-button,input[type=number]::-webkit-outer-spin-button{-webkit-appearance:none;}
        input[type=number]{-moz-appearance:textfield;}
        select{background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238B96AD' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 10px center;padding-right:30px!important;}
        option{background:${T.card};color:${T.text};}
      `}</style>

      {/* Header */}
      <div style={{ padding:"16px 20px", borderBottom:`1px solid ${T.border}` }}>
        <div style={{ maxWidth:"1400px", margin:"0 auto" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:"12px", marginBottom:"12px" }}>
            <div style={{ display:"flex", alignItems:"center", gap:"12px" }}>
              <div style={{ width:"36px", height:"36px", borderRadius:"10px", background:`linear-gradient(135deg,${T.accent},${T.blue})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"18px", fontWeight:800, color:T.bg }}>₹</div>
              <div>
                <h1 style={{ margin:0, fontSize:"18px", fontWeight:800, letterSpacing:"-0.3px" }}>DudduKaasu</h1>
                <p style={{ margin:0, fontSize:"11px", color:T.textMuted }}>One Stop Finance App</p>
              </div>
            </div>
            <div style={{ display:"flex", gap:"10px", alignItems:"center", flexWrap:"wrap" }}>
              <LiveStrip liveData={liveData} onRefresh={refreshMarket} refreshing={refreshing}/>
              {supabase && (
                <div style={{ display:"flex", alignItems:"center", gap:"6px", fontSize:"11px", color:syncing?T.amber:T.accent, fontWeight:600 }}>
                  <span style={{ width:"6px", height:"6px", borderRadius:"50%", background:syncing?T.amber:T.accent, display:"inline-block", animation:syncing?"pulse 1s infinite":"none" }}/>
                  {syncing ? "Saving…" : "Synced"}
                </div>
              )}
              <select value={fy} onChange={e=>setFY(e.target.value)} style={{...selectStyle,fontFamily:"'JetBrains Mono',monospace",fontWeight:700,color:T.accent}}>
                {getFYOptions().map(f=><option key={f} value={f}>{f}</option>)}
              </select>
              {supabase && user && (
                <button onClick={()=>supabase.auth.signOut()} style={{ padding:"7px 14px", background:"transparent", border:`1px solid ${T.border}`, borderRadius:"8px", color:T.textMuted, fontSize:"12px", fontWeight:600, cursor:"pointer" }}>
                  Sign Out
                </button>
              )}
            </div>
          </div>
          <div style={{ display:"flex", gap:"4px", overflowX:"auto", paddingBottom:"4px" }}>
            {TABS.map(tab=>(
              <button key={tab.id} onClick={()=>tab.active&&setActiveTab(tab.id)} style={{
                padding:"10px 18px", borderRadius:"8px 8px 0 0", border:"none",
                fontSize:"13px", fontWeight:600, cursor:tab.active?"pointer":"not-allowed",
                whiteSpace:"nowrap", transition:"all 0.2s",
                background:activeTab===tab.id?T.surface:"transparent",
                color:!tab.active?T.textMuted:activeTab===tab.id?T.accent:T.textDim,
                opacity:tab.active?1:0.5,
                borderBottom:activeTab===tab.id?`2px solid ${T.accent}`:"2px solid transparent"
              }}>{tab.label}{!tab.active&&" 🔒"}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth:"1400px", margin:"0 auto", padding:"20px" }}>
        {activeTab==="income"&&(
          <IncomeTab
            incomeData={incomeData}
            rsuData={rsuData}
            investmentsData={investmentsData}
            expensesData={expensesData}
            rsuGrants={rsuGrants}
            liveData={liveData}
            fy={fy}
            onUpdateIncome={updateMonthlyIncome}
          />
        )}
        {activeTab==="investments"&&(
          <InvestmentsTab
            incomeData={incomeData}
            rsuData={rsuData}
            investmentsData={investmentsData}
            fy={fy}
            onUpdateInvestments={updateInvestments}
          />
        )}
        {activeTab==="expenses"&&(
          <ExpensesTab expensesData={expensesData} fy={fy} onUpdate={updateExpenses}/>
        )}
        {activeTab==="daily"&&(
          <DailyExpensesTab
            txData={txData}
            onAddTx={addTx}
            onDeleteTx={deleteTx}
            onEditTx={editTx}
          />
        )}
        {activeTab==="portfolio"&&(
          <PortfolioTab
            holdingsData={holdingsData}
            rsuData={rsuData}
            incomeData={incomeData}
            investmentsData={investmentsData}
            rsuGrants={rsuGrants}
            liveData={liveData}
            fy={fy}
            onAddHolding={addHolding}
            onDeleteHolding={deleteHolding}
            onUpdateHolding={updateHolding}
            onUpdateHoldingsBatch={updateHoldingsBatch}
            onUpsertHoldings={upsertHoldings}
            onMergeStockLots={mergeStockLots}
            onMergeMFLots={mergeMFLots}
            onAddRsuEvent={addRsuEvent}
            onDeleteRsuEvent={deleteRsuEvent}
            onAddRsuGrant={addRsuGrant}
            onDeleteRsuGrant={deleteRsuGrant}
          />
        )}
      </div>

      <div style={{ padding:"16px 20px", borderTop:`1px solid ${T.border}`, textAlign:"center", color:T.textMuted, fontSize:"11px" }}>
        DudduKaasu v1.6 · Portfolio: auto-derived + XIRR · Data synced across devices
      </div>
    </div>
  );
}
