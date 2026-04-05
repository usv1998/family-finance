import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "./lib/supabase";
import { TABS, EMPLOYER, LIVE_DEFAULTS } from "./lib/constants";
import { T } from "./lib/theme";
import { getCurrentFY, getFYOptions } from "./lib/formatters";
import { loadData, saveData } from "./lib/storage";
import { SEED_DATA } from "./lib/seed";
import { fetchLiveData } from "./lib/marketData";

import LiveStrip from "./components/LiveStrip";
import LoginScreen from "./components/LoginScreen";
import IncomeTab from "./components/income/IncomeTab";
import InvestmentsTab from "./components/investments/InvestmentsTab";
import ExpensesTab from "./components/expenses/ExpensesTab";
import PortfolioTab from "./components/portfolio/PortfolioTab";
import TaxTab from "./components/tax/TaxTab";

export default function FamilyFinanceTracker() {
  const [activeTab,      setActiveTab]      = useState("income");
  const [fy,             setFY]             = useState(getCurrentFY());
  const [incomeData,     setIncomeData]     = useState({});
  const [rsuData,        setRsuData]        = useState({});
  const [investmentsData,setInvestmentsData]= useState({});
  const [expensesData,   setExpensesData]   = useState({});
  const [portfolioData,  setPortfolioData]  = useState({});
  const [rsuGrants,      setRsuGrants]      = useState([]);
  const [holdingsData,   setHoldingsData]   = useState([]);
  const [liveData,       setLiveData]       = useState(LIVE_DEFAULTS);
  const [refreshing,     setRefreshing]     = useState(false);
  const [loading,        setLoading]        = useState(true);
  const [user,           setUser]           = useState(null);
  const [authReady,      setAuthReady]      = useState(!supabase); // true immediately if no supabase
  const [syncing,        setSyncing]        = useState(false);
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
      setAuthReady(true);
    });
    const { data:{ subscription } } = supabase.auth.onAuthStateChange((_e, session)=>{
      setUser(session?.user ?? null);
      userRef.current = session?.user ?? null;
    });
    return ()=>subscription.unsubscribe();
  },[]);

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
      } else {
        setIncomeData(SEED_DATA.incomeData);
        setRsuData(SEED_DATA.rsuData);
        setInvestmentsData(SEED_DATA.investmentsData);
        setExpensesData(SEED_DATA.expensesData);
        setPortfolioData(SEED_DATA.portfolioData);
        setRsuGrants(SEED_DATA.rsuGrants);
        await saveData({ incomeData:SEED_DATA.incomeData, rsuData:SEED_DATA.rsuData, investmentsData:SEED_DATA.investmentsData, expensesData:SEED_DATA.expensesData, portfolioData:SEED_DATA.portfolioData, rsuGrants:SEED_DATA.rsuGrants, holdingsData:[] }, userRef.current?.id);
      }
      setLoading(false);
    })();
  },[authReady]);

  const persist = useCallback((iD,rD,invD,expD,portD,rG,hD)=>{
    if(saveRef.current) clearTimeout(saveRef.current);
    setSyncing(true);
    saveRef.current = setTimeout(async()=>{
      await saveData({incomeData:iD, rsuData:rD, investmentsData:invD, expensesData:expD, portfolioData:portD, rsuGrants:rG, holdingsData:hD}, userRef.current?.id);
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
    persist(next, rsuData, investmentsData, expensesData, portfolioData, rsuGrants, holdingsData);
  };

  const addRsuEvent = (event) => {
    const next={...rsuData};
    if(!next[event.fy]) next[event.fy]=[];
    next[event.fy]=[...next[event.fy],event];
    setRsuData(next);
    persist(incomeData, next, investmentsData, expensesData, portfolioData, rsuGrants, holdingsData);
  };

  const deleteRsuEvent = (id) => {
    const next={...rsuData};
    Object.keys(next).forEach(k=>{next[k]=next[k].filter(e=>e.id!==id);});
    setRsuData(next);
    persist(incomeData, next, investmentsData, expensesData, portfolioData, rsuGrants, holdingsData);
  };

  const addRsuGrant = (grant) => {
    const next = [...rsuGrants, grant];
    setRsuGrants(next);
    persist(incomeData, rsuData, investmentsData, expensesData, portfolioData, next, holdingsData);
  };

  const deleteRsuGrant = (id) => {
    const next = rsuGrants.filter(g => g.id !== id);
    setRsuGrants(next);
    persist(incomeData, rsuData, investmentsData, expensesData, portfolioData, next, holdingsData);
  };

  const updateInvestments = (fyKey, data) => {
    const next={...investmentsData,[fyKey]:data};
    setInvestmentsData(next);
    persist(incomeData, rsuData, next, expensesData, portfolioData, rsuGrants, holdingsData);
  };

  const updateExpenses = (fyKey, data) => {
    const next={...expensesData,[fyKey]:data};
    setExpensesData(next);
    persist(incomeData, rsuData, investmentsData, next, portfolioData, rsuGrants, holdingsData);
  };

  const updatePortfolio = (fyKey, data) => {
    const next={...portfolioData,[fyKey]:data};
    setPortfolioData(next);
    persist(incomeData, rsuData, investmentsData, expensesData, next, rsuGrants, holdingsData);
  };

  const addHolding = (h) => {
    const next = [...holdingsData, h];
    setHoldingsData(next);
    persist(incomeData, rsuData, investmentsData, expensesData, portfolioData, rsuGrants, next);
  };

  const deleteHolding = (id) => {
    const next = holdingsData.filter(h => h.id !== id);
    setHoldingsData(next);
    persist(incomeData, rsuData, investmentsData, expensesData, portfolioData, rsuGrants, next);
  };

  const updateHolding = (id, changes) => {
    const next = holdingsData.map(h => h.id === id ? { ...h, ...changes } : h);
    setHoldingsData(next);
    persist(incomeData, rsuData, investmentsData, expensesData, portfolioData, rsuGrants, next);
  };

  if(!authReady || (supabase && !user)) return supabase && !user && authReady ? <LoginScreen/> : <div style={{ display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100vh",background:T.bg,color:T.accent,fontFamily:"'JetBrains Mono',monospace" }}>Loading…</div>;
  if(loading) return <div style={{ display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100vh",background:T.bg,color:T.accent,fontFamily:"'JetBrains Mono',monospace" }}>Loading…</div>;

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
                <h1 style={{ margin:0, fontSize:"18px", fontWeight:800, letterSpacing:"-0.3px" }}>Family Finance Tracker</h1>
                <p style={{ margin:0, fontSize:"11px", color:T.textMuted }}>Selva & Akshaya · {EMPLOYER.Selva} + {EMPLOYER.Akshaya}</p>
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
            onAddRsuEvent={addRsuEvent}
            onDeleteRsuEvent={deleteRsuEvent}
            onAddRsuGrant={addRsuGrant}
            onDeleteRsuGrant={deleteRsuGrant}
          />
        )}
        {activeTab==="tax"&&(
          <TaxTab incomeData={incomeData} rsuData={rsuData} fy={fy}/>
        )}
      </div>

      <div style={{ padding:"16px 20px", borderTop:`1px solid ${T.border}`, textAlign:"center", color:T.textMuted, fontSize:"11px" }}>
        Family Finance Tracker v1.6 · Portfolio: auto-derived + XIRR · Data synced across devices
      </div>
    </div>
  );
}
