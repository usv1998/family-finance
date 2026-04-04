import { useState, useEffect, useCallback, useRef } from "react";

// ─── Constants ──────────────────────────────────────────────────────
const MONTHS = ["Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec","Jan","Feb","Mar"];
const MONTH_FULL = ["April","May","June","July","August","September","October","November","December","January","February","March"];
const PERSONS = ["Selva","Akshaya"];
const STOCKS = ["MSFT","NVDA"];
const TABS = [
  { id:"income",      label:"Income",         active:true  },
  { id:"rsu",         label:"RSU Tracker",    active:true  },
  { id:"investments", label:"Investments",    active:true  }, // ← unlocked
  { id:"expenses",    label:"Expenses",       active:true  },
  { id:"portfolio",   label:"Portfolio",      active:false },
];

const EMPLOYER     = { Selva:"Microsoft", Akshaya:"Nvidia" };
const PERSON_STOCK = { Selva:"MSFT",      Akshaya:"NVDA"   };

// ─── Helpers ────────────────────────────────────────────────────────
const fmtINR = (n) => {
  if (n == null || isNaN(n)) return "₹0";
  const num = Math.round(Number(n));
  const s   = Math.abs(num).toString();
  let result = "";
  if (s.length <= 3) { result = s; }
  else {
    result = s.slice(-3);
    let rem = s.slice(0, -3);
    while (rem.length > 2) { result = rem.slice(-2) + "," + result; rem = rem.slice(0,-2); }
    if (rem.length > 0) result = rem + "," + result;
  }
  return (num < 0 ? "-₹" : "₹") + result;
};

const fmtUSD = (n) => {
  if (n == null || isNaN(n)) return "$0";
  return "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits:2, maximumFractionDigits:2 });
};

const getCurrentFY = () => {
  const now  = new Date();
  const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return `FY${year}-${(year + 1).toString().slice(2)}`;
};

const getFYOptions = () => {
  const opts = [];
  for (let y = 2023; y <= 2028; y++) opts.push(`FY${y}-${(y+1).toString().slice(2)}`);
  return opts;
};

const genId = () => Math.random().toString(36).slice(2, 10);

// ─── Seed Data (FY2026-27) ──────────────────────────────────────────
const SEED_DATA = {
  incomeData: {
    "FY2026-27": {
      // BUG FIX 1: ESPP field stores net stock value (not contribution)
      // BUG FIX 2: Bonus removed from ad_hoc — already baked into take_home
      // BUG FIX 3: Akshaya EPF steps up from 17198→17372 in Sep (post-hike)
      Selva: {
        0:  { take_home:133121, epf:16704, espp:118440, car_lease:50706, ad_hoc:[], notes:"Apr — MSFT ESPP vest: 3 shares @ $420×₹94 = ₹1,18,440" },
        1:  { take_home:133171, epf:16704, espp:0,      car_lease:50706, ad_hoc:[], notes:"May — MSFT RSU 14 shares vest" },
        2:  { take_home:133171, epf:16704, espp:0,      car_lease:50706, ad_hoc:[], notes:"" },
        3:  { take_home:133171, epf:16704, espp:118440, car_lease:50706, ad_hoc:[], notes:"Jul — MSFT ESPP vest: 3 shares @ $420×₹94 = ₹1,18,440" },
        4:  { take_home:133171, epf:16704, espp:0,      car_lease:50706, ad_hoc:[], notes:"Aug — MSFT RSU 14 shares vest" },
        5:  { take_home:425938, epf:17372, espp:0,      car_lease:50706, ad_hoc:[], notes:"Sep — 4% hike + bonus ₹3,62,158 included in take-home. TDS recalculated." },
        6:  { take_home:125648, epf:17372, espp:197400, car_lease:50706, ad_hoc:[], notes:"Oct — MSFT ESPP vest: 5 shares @ $420×₹94 = ₹1,97,400 (Sep bonus boosted ESPP base)" },
        7:  { take_home:125648, epf:17372, espp:0,      car_lease:50706, ad_hoc:[], notes:"Nov — MSFT RSU 14 shares vest" },
        8:  { take_home:113296, epf:17372, espp:0,      car_lease:50706, ad_hoc:[], notes:"Dec — Nov RSU recalc raises TDS" },
        9:  { take_home:113296, epf:17372, espp:118440, car_lease:50706, ad_hoc:[], notes:"Jan — MSFT ESPP vest: 3 shares @ $420×₹94 = ₹1,18,440" },
        10: { take_home:113196, epf:17372, espp:0,      car_lease:50706, ad_hoc:[], notes:"Feb — MSFT RSU 14 shares vest" },
        11: { take_home:5097,   epf:17372, espp:0,      car_lease:50706, ad_hoc:[], notes:"⚠ Mar — Surcharge catch-up. Feb RSU pushes income >₹50L. Only ₹5,097 cash take-home!" },
      },
      Akshaya: {
        0:  { take_home:147323, epf:17198, espp:0,      ad_hoc:[], notes:"" },
        1:  { take_home:147373, epf:17198, espp:0,      ad_hoc:[], notes:"" },
        2:  { take_home:219767, epf:17198, espp:0,      ad_hoc:[], notes:"Jun — NVDA RSU 160 shares vest" },
        3:  { take_home:156776, epf:17198, espp:0,      ad_hoc:[], notes:"" },
        4:  { take_home:156776, epf:17198, espp:0,      ad_hoc:[], notes:"" },
        5:  { take_home:332268, epf:17372, espp:795240, ad_hoc:[], notes:"Sep — NVDA RSU 101 shares + ESPP vest 47 shares @ $180×₹94 = ₹7,95,240" },
        6:  { take_home:128813, epf:17372, espp:0,      ad_hoc:[], notes:"⚠ Oct — Lowest cash month. OPD insurance deduction + elevated TDS." },
        7:  { take_home:146626, epf:17372, espp:0,      ad_hoc:[], notes:"" },
        8:  { take_home:191732, epf:17372, espp:0,      ad_hoc:[], notes:"Dec — NVDA RSU 100 shares vest" },
        9:  { take_home:164303, epf:17372, espp:0,      ad_hoc:[], notes:"" },
        10: { take_home:164203, epf:17372, espp:0,      ad_hoc:[], notes:"" },
        11: { take_home:132805, epf:17372, espp:795240, ad_hoc:[], notes:"Mar — NVDA RSU 100 shares + ESPP 47 shares @ $180×₹94 = ₹7,95,240. 15% surcharge!" },
      },
    },
  },
  rsuData: {
    "FY2026-27": [
      { id:"rsu-s1", person:"Selva",   stock:"MSFT", vest_date:"2026-05-15", units_vested:14,  stock_price_usd:420, usd_inr_rate:94, tax_withheld_units:4,  grant_id:"MSFT-FY27", month_idx:1,  fy:"FY2026-27" },
      { id:"rsu-s2", person:"Selva",   stock:"MSFT", vest_date:"2026-08-15", units_vested:14,  stock_price_usd:420, usd_inr_rate:94, tax_withheld_units:4,  grant_id:"MSFT-FY27", month_idx:4,  fy:"FY2026-27" },
      { id:"rsu-s3", person:"Selva",   stock:"MSFT", vest_date:"2026-11-15", units_vested:14,  stock_price_usd:420, usd_inr_rate:94, tax_withheld_units:4,  grant_id:"MSFT-FY27", month_idx:7,  fy:"FY2026-27" },
      { id:"rsu-s4", person:"Selva",   stock:"MSFT", vest_date:"2027-02-15", units_vested:14,  stock_price_usd:420, usd_inr_rate:94, tax_withheld_units:5,  grant_id:"MSFT-FY27", month_idx:10, fy:"FY2026-27" },
      { id:"rsu-a1", person:"Akshaya", stock:"NVDA", vest_date:"2026-06-15", units_vested:160, stock_price_usd:180, usd_inr_rate:94, tax_withheld_units:50, grant_id:"NVDA-FY27", month_idx:2,  fy:"FY2026-27" },
      { id:"rsu-a2", person:"Akshaya", stock:"NVDA", vest_date:"2026-09-15", units_vested:101, stock_price_usd:180, usd_inr_rate:94, tax_withheld_units:32, grant_id:"NVDA-FY27", month_idx:5,  fy:"FY2026-27" },
      { id:"rsu-a3", person:"Akshaya", stock:"NVDA", vest_date:"2026-12-15", units_vested:100, stock_price_usd:180, usd_inr_rate:94, tax_withheld_units:31, grant_id:"NVDA-FY27", month_idx:8,  fy:"FY2026-27" },
      { id:"rsu-a4", person:"Akshaya", stock:"NVDA", vest_date:"2027-03-15", units_vested:100, stock_price_usd:180, usd_inr_rate:94, tax_withheld_units:36, grant_id:"NVDA-FY27", month_idx:11, fy:"FY2026-27" },
    ],
  },
  investmentsData: {
    "FY2026-27": {
      // Opening EPF balances from FY26 March payslip YTD
      epfOpening: { Selva: 363580, Akshaya: 349612 },
      babyFund: {
        monthlyTarget: 50000,
        months: { 0:50000, 1:50000, 2:50000, 3:50000, 4:50000, 5:50000, 6:50000, 7:50000, 8:50000, 9:50000, 10:50000, 11:50000 },
      },
      debtFunds: [],
    },
  },
  expensesData: {
    "FY2026-27": {
      categories: [
        { id:"rent",      name:"Rent",       budget:48000, color:"#3B82F6" },
        { id:"parents",   name:"Parents",    budget:20000, color:"#F59E0B" },
        { id:"groceries", name:"Groceries",  budget:15000, color:"#22C55E" },
        { id:"dining",    name:"Dining Out", budget:6000,  color:"#14B8A6" },
        { id:"shopping",  name:"Shopping",   budget:10000, color:"#A855F7" },
        { id:"travel",    name:"Travel",     budget:8000,  color:"#EC4899" },
        { id:"utilities", name:"Utilities",  budget:3000,  color:"#8B96AD" },
        { id:"medical",   name:"Medical",    budget:3000,  color:"#EF4444" },
        { id:"misc",      name:"Misc",       budget:5000,  color:"#5A6580" },
      ],
      actuals: {},
    },
  },
};

// ─── Storage ────────────────────────────────────────────────────────
// v2 — bumped to force re-seed with bug fixes + investments data
const STORAGE_KEY = "family-finance-v2";

const loadData = async () => {
  try { const raw = localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : null; }
  catch { return null; }
};

const saveData = async (data) => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
  catch (e) { console.error("Save failed:", e); }
};

// ─── Live Data Defaults ─────────────────────────────────────────────
const LIVE_DEFAULTS = { MSFT:428.50, NVDA:136.20, USDINR:85.42 };

// ─── Theme ──────────────────────────────────────────────────────────
const T = {
  bg:"#0B1120", surface:"#131B2E", card:"#1A2340", cardHover:"#1F2B4D",
  border:"#2A3555", borderLight:"#354168",
  accent:"#22C55E", accentDim:"#166534", accentBg:"rgba(34,197,94,0.08)", accentGlow:"rgba(34,197,94,0.15)",
  text:"#E8ECF4", textDim:"#8B96AD", textMuted:"#5A6580", white:"#FFFFFF",
  red:"#EF4444", amber:"#F59E0B", blue:"#3B82F6", purple:"#A855F7", teal:"#14B8A6",
  selva:"#3B82F6", akshaya:"#EC4899",
};
// keep backward-compat alias
const theme = T;

// ─── Shared UI helpers ───────────────────────────────────────────────
const sCard = (grand) => ({
  background: grand ? `linear-gradient(135deg,${T.accentDim},${T.card})` : T.card,
  border:`1px solid ${grand ? T.accent : T.border}`,
  borderRadius:"12px", padding:"16px",
  boxShadow: grand ? `0 0 20px ${T.accentGlow}` : "none",
});

// ─── Components ─────────────────────────────────────────────────────

function LiveStrip({ liveData }) {
  return (
    <div style={{ display:"flex", gap:"16px", flexWrap:"wrap", alignItems:"center",
      padding:"8px 16px", background:T.card, borderRadius:"10px", border:`1px solid ${T.border}`, fontSize:"13px" }}>
      <span style={{ color:T.textMuted, fontWeight:600, letterSpacing:"0.5px", textTransform:"uppercase", fontSize:"10px" }}>LIVE</span>
      <span style={{ width:"6px", height:"6px", borderRadius:"50%", background:T.accent, animation:"pulse 2s infinite" }}/>
      {[{label:"MSFT",value:fmtUSD(liveData.MSFT),color:T.blue},{label:"NVDA",value:fmtUSD(liveData.NVDA),color:T.accent},{label:"USD/INR",value:`₹${liveData.USDINR.toFixed(2)}`,color:T.amber}].map(d=>(
        <div key={d.label} style={{ display:"flex", alignItems:"center", gap:"6px" }}>
          <span style={{ color:T.textDim, fontSize:"11px", fontWeight:600 }}>{d.label}</span>
          <span style={{ color:d.color, fontWeight:700, fontFamily:"'JetBrains Mono',monospace" }}>{d.value}</span>
        </div>
      ))}
    </div>
  );
}

function SummaryCards({ incomeData, rsuData, investmentsData, fy }) {
  const sum = (fn) => PERSONS.reduce((s,p)=>s+MONTHS.reduce((ss,_,mi)=>ss+(fn(p,mi)||0),0),0);
  const totalTH  = sum((p,mi)=>Number(incomeData?.[fy]?.[p]?.[mi]?.take_home));
  const empEPF   = sum((p,mi)=>Number(incomeData?.[fy]?.[p]?.[mi]?.epf));
  const epfOpening = investmentsData?.[fy]?.epfOpening || { Selva:0, Akshaya:0 };
  const totalEPF = (epfOpening.Selva + epfOpening.Akshaya) + empEPF * 2; // opening + emp + employer (1:1 match)
  const totalESPP= sum((p,mi)=>Number(incomeData?.[fy]?.[p]?.[mi]?.espp));
  const totalRSU = (rsuData?.[fy]||[]).reduce((s,r)=>s+((r.units_vested-r.tax_withheld_units)*r.stock_price_usd*r.usd_inr_rate||0),0);
  const totalCar = sum((p,mi)=>p==="Selva"?Number(incomeData?.[fy]?.[p]?.[mi]?.car_lease):0);
  const totalAH  = sum((p,mi)=>(incomeData?.[fy]?.[p]?.[mi]?.ad_hoc||[]).reduce((a,i)=>a+(Number(i.amount)||0),0));
  const grand    = totalTH + totalEPF + totalESPP + totalRSU + totalCar + totalAH;
  const cards = [
    {label:"Total Take-Home",  value:fmtINR(totalTH),   color:T.accent},
    {label:"Total RSU Net (INR)", value:fmtINR(totalRSU),  color:T.purple},
    {label:"Total EPF Corpus",    value:fmtINR(totalEPF),  color:T.blue},
    {label:"Total ESPP Stocks",value:fmtINR(totalESPP), color:T.amber},
    {label:"Grand Total",      value:fmtINR(grand),     color:T.white, grand:true},
  ];
  return (
    <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))", gap:"12px", marginBottom:"20px" }}>
      {cards.map(c=>(
        <div key={c.label} style={sCard(c.grand)}>
          <div style={{ fontSize:"11px", color:T.textMuted, textTransform:"uppercase", fontWeight:600, letterSpacing:"0.5px", marginBottom:"6px" }}>{c.label}</div>
          <div style={{ fontSize:c.grand?"22px":"20px", fontWeight:800, color:c.color, fontFamily:"'JetBrains Mono',monospace" }}>{c.value}</div>
        </div>
      ))}
    </div>
  );
}

function MonthlyInput({ data, onChange, person }) {
  const isSelva = person === "Selva";
  // BUG FIX 1: ESPP label corrected to "ESPP Net Stock (₹)"
  const fields = [
    { key:"take_home",  label:"Take-Home (₹)",     placeholder:"e.g. 185000" },
    { key:"epf",        label:"EPF (₹)",           placeholder:"e.g. 17200"  },
    { key:"espp",       label:"ESPP Net Stock (₹)",placeholder:"e.g. 118440" },
    ...(isSelva ? [{ key:"car_lease", label:"Car Lease (₹)", placeholder:"e.g. 50706" }] : []),
  ];
  const inp = { width:"100%", padding:"10px 12px", background:T.bg, border:`1px solid ${T.border}`,
    borderRadius:"8px", color:T.text, fontSize:"14px", fontFamily:"'JetBrains Mono',monospace",
    outline:"none", boxSizing:"border-box" };
  return (
    <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))", gap:"12px" }}>
      {fields.map(f=>(
        <div key={f.key}>
          <label style={{ fontSize:"11px", color:T.textDim, fontWeight:600, display:"block", marginBottom:"4px" }}>{f.label}</label>
          <input type="number" value={data?.[f.key]??""} placeholder={f.placeholder}
            onChange={e=>onChange({...data,[f.key]:e.target.value})}
            style={inp}
            onFocus={e=>e.target.style.borderColor=T.accent}
            onBlur={e=>e.target.style.borderColor=T.border}
          />
        </div>
      ))}
    </div>
  );
}

function AdHocItems({ items=[], onChange }) {
  const add    = ()     => onChange([...items,{id:genId(),label:"",amount:""}]);
  const remove = (id)   => onChange(items.filter(i=>i.id!==id));
  const update = (id,f,v)=>onChange(items.map(i=>i.id===id?{...i,[f]:v}:i));
  return (
    <div style={{ marginTop:"12px" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"8px" }}>
        <span style={{ fontSize:"11px", color:T.textDim, fontWeight:600 }}>AD-HOC ITEMS (Bonus, Refunds etc.)</span>
        <button onClick={add} style={{ padding:"4px 12px", background:"transparent", border:`1px solid ${T.accent}`, color:T.accent, borderRadius:"6px", fontSize:"12px", cursor:"pointer", fontWeight:600 }}>+ Add</button>
      </div>
      {items.map(item=>(
        <div key={item.id} style={{ display:"flex", gap:"8px", marginBottom:"6px", alignItems:"center" }}>
          <input placeholder="Label" value={item.label} onChange={e=>update(item.id,"label",e.target.value)}
            style={{ flex:1, padding:"8px 10px", background:T.bg, border:`1px solid ${T.border}`, borderRadius:"6px", color:T.text, fontSize:"13px", outline:"none" }} />
          <input type="number" placeholder="Amount (₹)" value={item.amount} onChange={e=>update(item.id,"amount",e.target.value)}
            style={{ width:"140px", padding:"8px 10px", background:T.bg, border:`1px solid ${T.border}`, borderRadius:"6px", color:T.text, fontSize:"13px", fontFamily:"'JetBrains Mono',monospace", outline:"none" }} />
          <button onClick={()=>remove(item.id)} style={{ padding:"6px 10px", background:"transparent", border:`1px solid ${T.red}33`, color:T.red, borderRadius:"6px", fontSize:"12px", cursor:"pointer" }}>✕</button>
        </div>
      ))}
    </div>
  );
}

function IncomeTable({ incomeData, rsuData, fy, viewMode }) {
  const persons = viewMode==="combined" ? PERSONS : [viewMode];
  const getMD   = (p,mi)=>incomeData?.[fy]?.[p]?.[mi]||{};
  const getRSU  = (p,mi)=>(rsuData?.[fy]||[]).filter(r=>r.person===p&&r.month_idx===mi).reduce((s,r)=>s+(r.units_vested*r.stock_price_usd*r.usd_inr_rate||0),0);
  const rows = [
    {key:"take_home", label:"Take-Home Salary"},
    {key:"epf",       label:"EPF Contribution"},
    {key:"espp",      label:"ESPP Net Stock"},     // BUG FIX 1: label
    {key:"car_lease", label:"Car Lease", personFilter:"Selva"},
    {key:"rsu",       label:"RSU Vesting (INR)", computed:true},
    {key:"ad_hoc",    label:"Ad-hoc / Bonus",   computed:true},
    {key:"total",     label:"Monthly Total",     isTotal:true},
  ];
  const getVal=(row,p,mi)=>{
    const d=getMD(p,mi);
    if(row.key==="rsu")    return getRSU(p,mi);
    if(row.key==="ad_hoc") return (d.ad_hoc||[]).reduce((s,i)=>s+(Number(i.amount)||0),0);
    if(row.key==="total")  return (Number(d.take_home)||0)+(Number(d.epf)||0)+(Number(d.espp)||0)+(Number(d.car_lease)||0)+getRSU(p,mi)+(d.ad_hoc||[]).reduce((s,i)=>s+(Number(i.amount)||0),0);
    return Number(d[row.key])||0;
  };
  const getCombined=(row,mi)=>persons.reduce((s,p)=>s+getVal(row,p,mi),0);
  const getRowTotal=(row)=>MONTHS.reduce((s,_,mi)=>s+getCombined(row,mi),0);
  return (
    <div style={{ overflowX:"auto", borderRadius:"12px", border:`1px solid ${T.border}` }}>
      <table style={{ width:"100%", borderCollapse:"collapse", minWidth:"900px", fontSize:"13px" }}>
        <thead>
          <tr style={{ background:T.card }}>
            <th style={{ padding:"12px 16px", textAlign:"left", color:T.textDim, fontSize:"11px", fontWeight:700, letterSpacing:"0.5px", borderBottom:`1px solid ${T.border}`, position:"sticky", left:0, background:T.card, zIndex:1 }}>COMPONENT</th>
            {MONTHS.map(m=><th key={m} style={{ padding:"12px 8px", textAlign:"right", color:T.textDim, fontSize:"11px", fontWeight:700, borderBottom:`1px solid ${T.border}` }}>{m.toUpperCase()}</th>)}
            <th style={{ padding:"12px 16px", textAlign:"right", color:T.accent, fontSize:"11px", fontWeight:700, borderBottom:`1px solid ${T.border}` }}>FY TOTAL</th>
          </tr>
        </thead>
        <tbody>
          {rows.filter(r=>!r.personFilter||persons.includes(r.personFilter)).map(row=>(
            <tr key={row.key} style={{ background:row.isTotal?T.accentBg:"transparent", borderBottom:`1px solid ${row.isTotal?T.accent+"33":T.border}22` }}>
              <td style={{ padding:"10px 16px", color:row.isTotal?T.accent:T.text, fontWeight:row.isTotal?700:500, fontSize:"12px", position:"sticky", left:0, background:row.isTotal?T.accentBg:T.surface, zIndex:1 }}>{row.label}</td>
              {MONTHS.map((_,mi)=>{
                const val=getCombined(row,mi);
                return <td key={mi} style={{ padding:"10px 8px", textAlign:"right", color:val>0?(row.isTotal?T.accent:T.text):T.textMuted, fontFamily:"'JetBrains Mono',monospace", fontSize:"12px", fontWeight:row.isTotal?700:400 }}>{val>0?fmtINR(val):"—"}</td>;
              })}
              <td style={{ padding:"10px 16px", textAlign:"right", color:row.isTotal?T.accent:T.white, fontFamily:"'JetBrains Mono',monospace", fontSize:"13px", fontWeight:700 }}>{fmtINR(getRowTotal(row))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RsuForm({ onAdd, liveData }) {
  const [form,setForm]=useState({person:"Selva",stock:"MSFT",vest_date:"",units_vested:"",stock_price_usd:"",usd_inr_rate:"",tax_withheld_units:"",grant_id:"",notes:""});
  const upd=(k,v)=>{const n={...form,[k]:v};if(k==="person")n.stock=PERSON_STOCK[v];setForm(n);};
  const useLive=()=>setForm(f=>({...f,stock_price_usd:liveData[f.stock]?.toString()||"",usd_inr_rate:liveData.USDINR?.toString()||""}));
  const gross=Number(form.units_vested)*Number(form.stock_price_usd);
  const grossINR=gross*Number(form.usd_inr_rate);
  const net=Number(form.units_vested)-(Number(form.tax_withheld_units)||0);
  const netINR=net*Number(form.stock_price_usd)*Number(form.usd_inr_rate);
  const submit=()=>{
    if(!form.vest_date||!form.units_vested||!form.stock_price_usd||!form.usd_inr_rate) return;
    const d=new Date(form.vest_date), vm=d.getMonth(), vy=d.getFullYear();
    const fyY=vm>=3?vy:vy-1;
    onAdd({id:genId(),...form,fy:`FY${fyY}-${(fyY+1).toString().slice(2)}`,month_idx:vm>=3?vm-3:vm+9,
      units_vested:Number(form.units_vested),stock_price_usd:Number(form.stock_price_usd),
      usd_inr_rate:Number(form.usd_inr_rate),tax_withheld_units:Number(form.tax_withheld_units)||0});
    setForm({person:"Selva",stock:"MSFT",vest_date:"",units_vested:"",stock_price_usd:"",usd_inr_rate:"",tax_withheld_units:"",grant_id:"",notes:""});
  };
  const inp={padding:"10px 12px",background:T.bg,border:`1px solid ${T.border}`,borderRadius:"8px",color:T.text,fontSize:"13px",outline:"none",width:"100%",boxSizing:"border-box"};
  const sel={...inp,appearance:"none",cursor:"pointer"};
  const lbl={fontSize:"11px",color:T.textDim,fontWeight:600,display:"block",marginBottom:"4px"};
  return (
    <div style={{ background:T.card, borderRadius:"12px", padding:"20px", border:`1px solid ${T.border}`, marginBottom:"20px" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"16px" }}>
        <h3 style={{ margin:0, fontSize:"14px", color:T.text, fontWeight:700 }}>Add RSU Vesting Event</h3>
        <button onClick={useLive} style={{ padding:"6px 14px", background:T.accentBg, border:`1px solid ${T.accent}44`, color:T.accent, borderRadius:"6px", fontSize:"11px", cursor:"pointer", fontWeight:600 }}>Use Live Prices</button>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))", gap:"12px" }}>
        <div><label style={lbl}>Person</label><select value={form.person} onChange={e=>upd("person",e.target.value)} style={sel}>{PERSONS.map(p=><option key={p} value={p}>{p}</option>)}</select></div>
        <div><label style={lbl}>Stock</label><select value={form.stock} onChange={e=>upd("stock",e.target.value)} style={sel}>{STOCKS.map(s=><option key={s} value={s}>{s}</option>)}</select></div>
        <div><label style={lbl}>Vest Date</label><input type="date" value={form.vest_date} onChange={e=>upd("vest_date",e.target.value)} style={inp}/></div>
        <div><label style={lbl}>Units Vested</label><input type="number" value={form.units_vested} onChange={e=>upd("units_vested",e.target.value)} placeholder="e.g. 25" style={{...inp,fontFamily:"'JetBrains Mono',monospace"}}/></div>
        <div><label style={lbl}>Stock Price (USD)</label><input type="number" step="0.01" value={form.stock_price_usd} onChange={e=>upd("stock_price_usd",e.target.value)} placeholder="e.g. 428.50" style={{...inp,fontFamily:"'JetBrains Mono',monospace"}}/></div>
        <div><label style={lbl}>USD/INR Rate</label><input type="number" step="0.01" value={form.usd_inr_rate} onChange={e=>upd("usd_inr_rate",e.target.value)} placeholder="e.g. 85.42" style={{...inp,fontFamily:"'JetBrains Mono',monospace"}}/></div>
        <div><label style={lbl}>Tax Withheld (Units)</label><input type="number" value={form.tax_withheld_units} onChange={e=>upd("tax_withheld_units",e.target.value)} placeholder="0" style={{...inp,fontFamily:"'JetBrains Mono',monospace"}}/></div>
        <div><label style={lbl}>Grant ID</label><input value={form.grant_id} onChange={e=>upd("grant_id",e.target.value)} placeholder="Optional" style={inp}/></div>
      </div>
      {gross>0&&(
        <div style={{ display:"flex", gap:"16px", flexWrap:"wrap", marginTop:"16px", padding:"12px 16px", background:T.bg, borderRadius:"8px" }}>
          {[{l:"Gross USD",v:fmtUSD(gross),c:T.blue},{l:"Gross INR",v:fmtINR(grossINR),c:T.accent},{l:"Net Units",v:net,c:T.text},{l:"Net INR",v:fmtINR(netINR),c:T.accent}].map(x=>(
            <div key={x.l}><span style={{ fontSize:"11px", color:T.textMuted }}>{x.l}</span><div style={{ fontFamily:"'JetBrains Mono',monospace", color:x.c, fontWeight:700 }}>{x.v}</div></div>
          ))}
        </div>
      )}
      <button onClick={submit} style={{ marginTop:"16px", padding:"10px 28px", background:T.accent, border:"none", borderRadius:"8px", color:T.bg, fontSize:"14px", fontWeight:700, cursor:"pointer", opacity:(!form.vest_date||!form.units_vested)?0.4:1 }}>Add Vesting Event</button>
    </div>
  );
}

function RsuTable({ events, onDelete, filterPerson, filterStock }) {
  let fil=[...events];
  if(filterPerson!=="all") fil=fil.filter(e=>e.person===filterPerson);
  if(filterStock!=="all")  fil=fil.filter(e=>e.stock===filterStock);
  fil.sort((a,b)=>new Date(a.vest_date)-new Date(b.vest_date));
  const totUnits=fil.reduce((s,e)=>s+e.units_vested,0);
  const totUSD  =fil.reduce((s,e)=>s+e.units_vested*e.stock_price_usd,0);
  const totINR  =fil.reduce((s,e)=>s+e.units_vested*e.stock_price_usd*e.usd_inr_rate,0);
  if(!fil.length) return <div style={{ textAlign:"center", padding:"40px", color:T.textMuted, fontSize:"14px" }}>No RSU vesting events recorded yet.</div>;
  return (
    <div>
      <div style={{ display:"flex", gap:"16px", flexWrap:"wrap", marginBottom:"16px" }}>
        {[{l:"Total Units",v:totUnits.toLocaleString(),c:T.text},{l:"Gross USD",v:fmtUSD(totUSD),c:T.blue},{l:"Gross INR",v:fmtINR(totINR),c:T.accent}].map(x=>(
          <div key={x.l} style={{ padding:"12px 20px", background:T.card, borderRadius:"10px", border:`1px solid ${T.border}` }}>
            <div style={{ fontSize:"10px", color:T.textMuted, fontWeight:600, textTransform:"uppercase" }}>{x.l}</div>
            <div style={{ fontSize:"18px", fontWeight:800, color:x.c, fontFamily:"'JetBrains Mono',monospace" }}>{x.v}</div>
          </div>
        ))}
      </div>
      <div style={{ overflowX:"auto", borderRadius:"10px", border:`1px solid ${T.border}` }}>
        <table style={{ width:"100%", borderCollapse:"collapse", minWidth:"800px", fontSize:"12px" }}>
          <thead>
            <tr style={{ background:T.card }}>
              {["Person","Stock","Vest Date","Units","Price (USD)","USD/INR","Gross INR","Tax Units","Net INR","Grant ID",""].map(h=>(
                <th key={h} style={{ padding:"10px 12px", textAlign:h==="Person"||h==="Stock"?"left":"right", color:T.textDim, fontSize:"10px", fontWeight:700, borderBottom:`1px solid ${T.border}` }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {fil.map(e=>(
              <tr key={e.id} style={{ borderBottom:`1px solid ${T.border}22` }}>
                <td style={{ padding:"10px 12px", color:e.person==="Selva"?T.selva:T.akshaya, fontWeight:600 }}>{e.person}</td>
                <td style={{ padding:"10px 12px", color:T.text, fontWeight:600 }}>{e.stock}</td>
                <td style={{ padding:"10px 12px", textAlign:"right", color:T.text, fontFamily:"'JetBrains Mono',monospace" }}>{new Date(e.vest_date).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"})}</td>
                <td style={{ padding:"10px 12px", textAlign:"right", fontFamily:"'JetBrains Mono',monospace", color:T.text }}>{e.units_vested}</td>
                <td style={{ padding:"10px 12px", textAlign:"right", fontFamily:"'JetBrains Mono',monospace", color:T.blue }}>{fmtUSD(e.stock_price_usd)}</td>
                <td style={{ padding:"10px 12px", textAlign:"right", fontFamily:"'JetBrains Mono',monospace", color:T.amber }}>₹{e.usd_inr_rate}</td>
                <td style={{ padding:"10px 12px", textAlign:"right", fontFamily:"'JetBrains Mono',monospace", color:T.accent, fontWeight:600 }}>{fmtINR(e.units_vested*e.stock_price_usd*e.usd_inr_rate)}</td>
                <td style={{ padding:"10px 12px", textAlign:"right", fontFamily:"'JetBrains Mono',monospace", color:T.textDim }}>{e.tax_withheld_units||"—"}</td>
                <td style={{ padding:"10px 12px", textAlign:"right", fontFamily:"'JetBrains Mono',monospace", color:T.accent }}>{fmtINR((e.units_vested-(e.tax_withheld_units||0))*e.stock_price_usd*e.usd_inr_rate)}</td>
                <td style={{ padding:"10px 12px", textAlign:"right", color:T.textMuted, fontSize:"11px" }}>{e.grant_id||"—"}</td>
                <td style={{ padding:"10px 12px", textAlign:"right" }}><button onClick={()=>onDelete(e.id)} style={{ background:"transparent", border:"none", color:T.red, cursor:"pointer", fontSize:"14px", opacity:0.6 }}>✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── INVESTMENTS TAB ────────────────────────────────────────────────

function InvestmentsTab({ incomeData, rsuData, investmentsData, fy, onUpdateInvestments }) {
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
    const vests = MONTHS.map((_,mi)=>({ mi, val:Number(incomeData?.[fy]?.[p]?.[mi]?.espp)||0 })).filter(v=>v.val>0);
    const total = vests.reduce((s,v)=>s+v.val, 0);
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
                    <span style={{ fontFamily:"'JetBrains Mono',monospace", color:T.amber, fontWeight:600 }}>{fmtINR(v.val)}</span>
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

// ─── Expenses Tab ────────────────────────────────────────────────────
function ExpensesTab({ expensesData, fy, onUpdate }) {
  const inv       = expensesData?.[fy] || {};
  const categories= inv.categories || SEED_DATA.expensesData["FY2026-27"].categories;
  const actuals   = inv.actuals    || {};

  const now = new Date();
  const curMI = now.getMonth() >= 3 ? now.getMonth() - 3 : now.getMonth() + 9;
  const [selMonth, setSelMonth] = useState(curMI);
  const [editVals, setEditVals] = useState({});
  const [editingMonth, setEditingMonth] = useState(null);
  const [showAddCat, setShowAddCat] = useState(false);
  const [newCat, setNewCat] = useState({ name:"", budget:"", color:"#22C55E" });
  const [editBudgets, setEditBudgets] = useState(false);
  const [budgetDraft, setBudgetDraft] = useState({});

  const getActual = (mi, catId) => Number(actuals?.[mi]?.[catId]) || 0;
  const monthTotal = (mi) => categories.reduce((s,c)=>s+getActual(mi,c.id),0);
  const monthBudget = () => categories.reduce((s,c)=>s+Number(c.budget||0),0);

  // YTD: only count months that have any actual entered
  const enteredMonths = MONTHS.map((_,mi)=>monthTotal(mi)>0);
  const ytdActual   = MONTHS.reduce((s,_,mi)=>s+monthTotal(mi),0);
  const ytdBudget   = enteredMonths.filter(Boolean).length * monthBudget();
  const ytdSurplus  = ytdBudget - ytdActual;
  const annualBudget= monthBudget() * 12;

  const updateInv = (patch) => onUpdate(fy, { categories, actuals, ...inv, ...patch });

  // start editing a month
  const startEdit = (mi) => {
    const draft = {};
    categories.forEach(c=>{ draft[c.id] = getActual(mi,c.id)||""; });
    setEditVals(draft);
    setEditingMonth(mi);
  };

  const saveEdit = () => {
    const newActuals = { ...actuals, [editingMonth]: {} };
    categories.forEach(c=>{ const v=Number(editVals[c.id])||0; if(v>0) newActuals[editingMonth][c.id]=v; });
    updateInv({ actuals: newActuals });
    setEditingMonth(null);
  };

  const addCategory = () => {
    if(!newCat.name.trim()) return;
    const cat = { id: genId(), name: newCat.name.trim(), budget: Number(newCat.budget)||0, color: newCat.color };
    updateInv({ categories: [...categories, cat] });
    setNewCat({ name:"", budget:"", color:"#22C55E" });
    setShowAddCat(false);
  };

  const deleteCategory = (id) => {
    updateInv({ categories: categories.filter(c=>c.id!==id) });
  };

  const saveBudgets = () => {
    const updated = categories.map(c=>({ ...c, budget: Number(budgetDraft[c.id]??c.budget)||0 }));
    updateInv({ categories: updated });
    setEditBudgets(false);
  };

  const inp = { padding:"8px 12px", background:T.card, border:`1px solid ${T.border}`, borderRadius:"8px", color:T.text, fontSize:"13px", outline:"none", width:"100%", fontFamily:"'JetBrains Mono',monospace" };

  const SumCard = ({label,value,sub,color,neg}) => (
    <div style={{ background:T.surface, borderRadius:"10px", padding:"14px 16px", border:`1px solid ${T.border}` }}>
      <div style={{ fontSize:"11px", color:T.textMuted, fontWeight:700, letterSpacing:"0.5px", marginBottom:"6px" }}>{label.toUpperCase()}</div>
      <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"18px", fontWeight:800, color:neg?(value<0?T.red:T.accent):color }}>{fmtINR(value)}</div>
      {sub&&<div style={{ fontSize:"11px", color:T.textMuted, marginTop:"4px" }}>{sub}</div>}
    </div>
  );

  return (
    <div>
      {/* Summary cards */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:"12px", marginBottom:"24px" }}>
        <SumCard label="Annual Budget"  value={annualBudget} color={T.textDim} sub={`${categories.length} categories`}/>
        <SumCard label="YTD Spent"      value={ytdActual}    color={T.amber}   sub={`${enteredMonths.filter(Boolean).length} months recorded`}/>
        <SumCard label="YTD Surplus"    value={ytdSurplus}   color={T.accent}  sub="vs budget months entered" neg/>
      </div>

      {/* Month selector */}
      <div style={{ display:"flex", gap:"4px", padding:"4px", background:T.card, borderRadius:"10px", overflowX:"auto", marginBottom:"20px" }}>
        {MONTHS.map((m,mi)=>{
          const hasData = monthTotal(mi) > 0;
          return (
            <button key={m} onClick={()=>setSelMonth(mi)} style={{
              ...{ padding:"6px 12px", borderRadius:"7px", border:"none", fontSize:"12px", fontWeight:600, cursor:"pointer", whiteSpace:"nowrap", transition:"all 0.15s", position:"relative" },
              background: selMonth===mi ? T.accent : "transparent",
              color: selMonth===mi ? T.bg : hasData ? T.text : T.textMuted,
            }}>
              {m}{hasData&&<span style={{ position:"absolute",top:2,right:2,width:4,height:4,borderRadius:"50%",background:selMonth===mi?T.bg:T.accent }}/>}
            </button>
          );
        })}
      </div>

      {/* Monthly breakdown */}
      <div style={{ background:T.surface, borderRadius:"12px", border:`1px solid ${T.border}`, marginBottom:"24px", overflow:"hidden" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"14px 20px", borderBottom:`1px solid ${T.border}` }}>
          <div>
            <span style={{ fontSize:"14px", fontWeight:700, color:T.text }}>{MONTH_FULL[selMonth]} Expenses</span>
            <span style={{ fontSize:"12px", color:T.textMuted, marginLeft:"10px" }}>
              {monthTotal(selMonth)>0 ? `Spent ${fmtINR(monthTotal(selMonth))} of ${fmtINR(monthBudget())} budget` : "No actuals entered"}
            </span>
          </div>
          <button onClick={()=>editingMonth===selMonth ? saveEdit() : startEdit(selMonth)} style={{ padding:"7px 16px", background:editingMonth===selMonth?T.accent:T.card, border:`1px solid ${editingMonth===selMonth?T.accent:T.border}`, borderRadius:"8px", color:editingMonth===selMonth?T.bg:T.text, fontSize:"12px", fontWeight:700, cursor:"pointer" }}>
            {editingMonth===selMonth ? "Save" : "Edit Month"}
          </button>
        </div>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"13px" }}>
            <thead>
              <tr style={{ background:T.card }}>
                <th style={{ padding:"10px 16px", textAlign:"left", color:T.textMuted, fontSize:"11px", fontWeight:700, letterSpacing:"0.5px" }}>CATEGORY</th>
                <th style={{ padding:"10px 12px", textAlign:"right", color:T.textMuted, fontSize:"11px", fontWeight:700 }}>BUDGET</th>
                <th style={{ padding:"10px 12px", textAlign:"right", color:T.textMuted, fontSize:"11px", fontWeight:700 }}>ACTUAL</th>
                <th style={{ padding:"10px 12px", textAlign:"right", color:T.textMuted, fontSize:"11px", fontWeight:700 }}>DIFF</th>
                <th style={{ padding:"10px 12px", textAlign:"right", color:T.textMuted, fontSize:"11px", fontWeight:700 }}>% USED</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((cat,i)=>{
                const budget = Number(cat.budget)||0;
                const actual = editingMonth===selMonth ? (Number(editVals[cat.id])||0) : getActual(selMonth,cat.id);
                const diff   = budget - actual;
                const pct    = budget>0 ? Math.round(actual/budget*100) : 0;
                const statusColor = actual===0 ? T.textMuted : pct<=100 ? T.accent : pct<=120 ? T.amber : T.red;
                return (
                  <tr key={cat.id} style={{ borderTop:`1px solid ${T.border}`, background:i%2===0?"transparent":T.card+"44" }}>
                    <td style={{ padding:"10px 16px" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                        <div style={{ width:"8px", height:"8px", borderRadius:"50%", background:cat.color, flexShrink:0 }}/>
                        <span style={{ color:T.text, fontWeight:500 }}>{cat.name}</span>
                      </div>
                    </td>
                    <td style={{ padding:"10px 12px", textAlign:"right", fontFamily:"'JetBrains Mono',monospace", color:T.textDim }}>{fmtINR(budget)}</td>
                    <td style={{ padding:"10px 12px", textAlign:"right" }}>
                      {editingMonth===selMonth ? (
                        <input type="number" value={editVals[cat.id]||""} placeholder="0"
                          onChange={e=>setEditVals(v=>({...v,[cat.id]:e.target.value}))}
                          style={{ ...inp, width:"110px", padding:"5px 8px", textAlign:"right" }}/>
                      ) : (
                        <span style={{ fontFamily:"'JetBrains Mono',monospace", color:actual>0?statusColor:T.textMuted }}>{actual>0?fmtINR(actual):"—"}</span>
                      )}
                    </td>
                    <td style={{ padding:"10px 12px", textAlign:"right", fontFamily:"'JetBrains Mono',monospace", color:actual===0?T.textMuted:diff>=0?T.accent:T.red, fontWeight:600 }}>
                      {actual===0?"—":diff>=0?`+${fmtINR(diff)}`:fmtINR(diff)}
                    </td>
                    <td style={{ padding:"10px 12px", textAlign:"right" }}>
                      {actual>0 && (
                        <div style={{ display:"flex", alignItems:"center", gap:"6px", justifyContent:"flex-end" }}>
                          <div style={{ width:"50px", height:"5px", background:T.border, borderRadius:"3px", overflow:"hidden" }}>
                            <div style={{ height:"100%", width:`${Math.min(100,pct)}%`, background:statusColor, borderRadius:"3px" }}/>
                          </div>
                          <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"11px", color:statusColor, fontWeight:700, minWidth:"32px", textAlign:"right" }}>{pct}%</span>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {/* Total row */}
              <tr style={{ borderTop:`2px solid ${T.border}`, background:T.card }}>
                <td style={{ padding:"10px 16px", color:T.accent, fontWeight:700 }}>Total</td>
                <td style={{ padding:"10px 12px", textAlign:"right", fontFamily:"'JetBrains Mono',monospace", color:T.textDim, fontWeight:700 }}>{fmtINR(monthBudget())}</td>
                <td style={{ padding:"10px 12px", textAlign:"right", fontFamily:"'JetBrains Mono',monospace", color:T.accent, fontWeight:700 }}>
                  {editingMonth===selMonth ? fmtINR(categories.reduce((s,c)=>s+(Number(editVals[c.id])||0),0)) : fmtINR(monthTotal(selMonth))}
                </td>
                <td style={{ padding:"10px 12px", textAlign:"right", fontFamily:"'JetBrains Mono',monospace", fontWeight:700, color:monthTotal(selMonth)===0?T.textMuted:monthBudget()-monthTotal(selMonth)>=0?T.accent:T.red }}>
                  {monthTotal(selMonth)===0?"—":fmtINR(monthBudget()-monthTotal(selMonth))}
                </td>
                <td/>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Annual overview */}
      <div style={{ background:T.surface, borderRadius:"12px", border:`1px solid ${T.border}`, marginBottom:"24px", overflow:"hidden" }}>
        <div style={{ padding:"14px 20px", borderBottom:`1px solid ${T.border}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <span style={{ fontSize:"14px", fontWeight:700, color:T.text }}>Annual Overview</span>
          <button onClick={()=>{ setEditBudgets(!editBudgets); setBudgetDraft(Object.fromEntries(categories.map(c=>[c.id,c.budget]))); }}
            style={{ padding:"6px 14px", background:"transparent", border:`1px solid ${T.border}`, borderRadius:"8px", color:T.textDim, fontSize:"12px", fontWeight:600, cursor:"pointer" }}>
            {editBudgets?"Cancel":"Edit Budgets"}
          </button>
        </div>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"12px" }}>
            <thead>
              <tr style={{ background:T.card }}>
                <th style={{ padding:"8px 16px", textAlign:"left", color:T.textMuted, fontWeight:700, letterSpacing:"0.5px", position:"sticky", left:0, background:T.card, zIndex:1 }}>CATEGORY</th>
                <th style={{ padding:"8px 10px", textAlign:"right", color:T.textMuted, fontWeight:700 }}>BUDGET/MO</th>
                {MONTHS.map(m=><th key={m} style={{ padding:"8px 10px", textAlign:"right", color:T.textMuted, fontWeight:700 }}>{m.toUpperCase()}</th>)}
                <th style={{ padding:"8px 12px", textAlign:"right", color:T.accent, fontWeight:700 }}>FY TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((cat,i)=>{
                const fyTotal = MONTHS.reduce((s,_,mi)=>s+getActual(mi,cat.id),0);
                return (
                  <tr key={cat.id} style={{ borderTop:`1px solid ${T.border}`, background:i%2===0?"transparent":T.card+"44" }}>
                    <td style={{ padding:"8px 16px", position:"sticky", left:0, background:i%2===0?T.surface:T.card+"44", zIndex:1 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                        <div style={{ width:"7px", height:"7px", borderRadius:"50%", background:cat.color, flexShrink:0 }}/>
                        <span style={{ color:T.text, fontWeight:500 }}>{cat.name}</span>
                      </div>
                    </td>
                    <td style={{ padding:"8px 10px", textAlign:"right", fontFamily:"'JetBrains Mono',monospace", color:T.textDim }}>
                      {editBudgets ? (
                        <input type="number" value={budgetDraft[cat.id]??cat.budget} onChange={e=>setBudgetDraft(d=>({...d,[cat.id]:e.target.value}))}
                          style={{ ...inp, width:"90px", padding:"3px 6px", textAlign:"right", fontSize:"11px" }}/>
                      ) : fmtINR(cat.budget)}
                    </td>
                    {MONTHS.map((_,mi)=>{
                      const v = getActual(mi,cat.id);
                      const pct = cat.budget>0 ? v/cat.budget*100 : 0;
                      const c = v===0 ? T.textMuted : pct<=100 ? T.accent : pct<=120 ? T.amber : T.red;
                      return <td key={mi} style={{ padding:"8px 10px", textAlign:"right", fontFamily:"'JetBrains Mono',monospace", color:c }}>{v>0?fmtINR(v):"—"}</td>;
                    })}
                    <td style={{ padding:"8px 12px", textAlign:"right", fontFamily:"'JetBrains Mono',monospace", color:fyTotal>0?T.text:T.textMuted, fontWeight:700 }}>{fyTotal>0?fmtINR(fyTotal):"—"}</td>
                  </tr>
                );
              })}
              {/* Total row */}
              <tr style={{ borderTop:`2px solid ${T.border}`, background:T.card }}>
                <td style={{ padding:"8px 16px", color:T.accent, fontWeight:700, position:"sticky", left:0, background:T.card, zIndex:1 }}>Total</td>
                <td style={{ padding:"8px 10px", textAlign:"right", fontFamily:"'JetBrains Mono',monospace", color:T.textDim, fontWeight:700 }}>{fmtINR(monthBudget())}</td>
                {MONTHS.map((_,mi)=>{
                  const v=monthTotal(mi);
                  return <td key={mi} style={{ padding:"8px 10px", textAlign:"right", fontFamily:"'JetBrains Mono',monospace", color:v>0?T.accent:T.textMuted, fontWeight:700 }}>{v>0?fmtINR(v):"—"}</td>;
                })}
                <td style={{ padding:"8px 12px", textAlign:"right", fontFamily:"'JetBrains Mono',monospace", color:T.accent, fontWeight:800 }}>{fmtINR(ytdActual)||"—"}</td>
              </tr>
            </tbody>
          </table>
        </div>
        {editBudgets && (
          <div style={{ padding:"12px 20px", borderTop:`1px solid ${T.border}`, display:"flex", gap:"8px", justifyContent:"flex-end" }}>
            <button onClick={saveBudgets} style={{ padding:"8px 20px", background:T.accent, border:"none", borderRadius:"8px", color:T.bg, fontSize:"13px", fontWeight:700, cursor:"pointer" }}>Save Budgets</button>
          </div>
        )}
      </div>

      {/* Manage categories */}
      <div style={{ background:T.surface, borderRadius:"12px", border:`1px solid ${T.border}`, overflow:"hidden" }}>
        <div style={{ padding:"14px 20px", borderBottom:`1px solid ${T.border}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <span style={{ fontSize:"14px", fontWeight:700, color:T.text }}>Manage Categories</span>
          <button onClick={()=>setShowAddCat(!showAddCat)} style={{ padding:"7px 16px", background:showAddCat?T.card:T.accent, border:`1px solid ${showAddCat?T.border:T.accent}`, borderRadius:"8px", color:showAddCat?T.textDim:T.bg, fontSize:"12px", fontWeight:700, cursor:"pointer" }}>
            {showAddCat ? "Cancel" : "+ Add Category"}
          </button>
        </div>
        {showAddCat && (
          <div style={{ padding:"16px 20px", borderBottom:`1px solid ${T.border}`, display:"flex", gap:"10px", flexWrap:"wrap", alignItems:"flex-end" }}>
            <div style={{ flex:"1 1 150px" }}><label style={{ fontSize:"11px", color:T.textMuted, fontWeight:700, display:"block", marginBottom:"4px" }}>NAME</label>
              <input value={newCat.name} onChange={e=>setNewCat(v=>({...v,name:e.target.value}))} placeholder="e.g. Subscriptions" style={inp}/>
            </div>
            <div style={{ flex:"1 1 120px" }}><label style={{ fontSize:"11px", color:T.textMuted, fontWeight:700, display:"block", marginBottom:"4px" }}>MONTHLY BUDGET</label>
              <input type="number" value={newCat.budget} onChange={e=>setNewCat(v=>({...v,budget:e.target.value}))} placeholder="e.g. 2000" style={inp}/>
            </div>
            <div><label style={{ fontSize:"11px", color:T.textMuted, fontWeight:700, display:"block", marginBottom:"4px" }}>COLOR</label>
              <input type="color" value={newCat.color} onChange={e=>setNewCat(v=>({...v,color:e.target.value}))} style={{ width:"44px", height:"38px", padding:"2px", borderRadius:"8px", border:`1px solid ${T.border}`, background:T.card, cursor:"pointer" }}/>
            </div>
            <button onClick={addCategory} style={{ padding:"8px 20px", background:T.accent, border:"none", borderRadius:"8px", color:T.bg, fontSize:"13px", fontWeight:700, cursor:"pointer", height:"38px" }}>Add</button>
          </div>
        )}
        <div style={{ padding:"12px 20px", display:"flex", flexWrap:"wrap", gap:"8px" }}>
          {categories.map(cat=>(
            <div key={cat.id} style={{ display:"flex", alignItems:"center", gap:"8px", padding:"7px 12px", background:T.card, borderRadius:"20px", border:`1px solid ${T.border}` }}>
              <div style={{ width:"8px", height:"8px", borderRadius:"50%", background:cat.color }}/>
              <span style={{ fontSize:"12px", fontWeight:600, color:T.text }}>{cat.name}</span>
              <span style={{ fontSize:"11px", fontFamily:"'JetBrains Mono',monospace", color:T.textMuted }}>{fmtINR(cat.budget)}/mo</span>
              <button onClick={()=>deleteCategory(cat.id)} style={{ background:"none", border:"none", color:T.textMuted, cursor:"pointer", fontSize:"14px", lineHeight:1, padding:"0 2px" }} title="Remove">×</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Placeholder ─────────────────────────────────────────────────────
function PlaceholderTab({ title, description, icon }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"60px 20px", textAlign:"center" }}>
      <div style={{ fontSize:"48px", marginBottom:"16px", opacity:0.3 }}>{icon}</div>
      <h2 style={{ color:T.textDim, fontSize:"20px", fontWeight:700, marginBottom:"8px" }}>{title}</h2>
      <p style={{ color:T.textMuted, fontSize:"14px", maxWidth:"400px", lineHeight:1.6 }}>{description}</p>
      <div style={{ marginTop:"20px", padding:"8px 20px", background:T.card, borderRadius:"20px", border:`1px solid ${T.border}`, color:T.textMuted, fontSize:"12px", fontWeight:600 }}>Coming in v2.0</div>
    </div>
  );
}

// ─── Main App ────────────────────────────────────────────────────────
export default function FamilyFinanceTracker() {
  const [activeTab,      setActiveTab]      = useState("income");
  const [fy,             setFY]             = useState(getCurrentFY());
  const [viewMode,       setViewMode]       = useState("combined");
  const [incomeData,     setIncomeData]     = useState({});
  const [rsuData,        setRsuData]        = useState({});
  const [investmentsData,setInvestmentsData]= useState({});
  const [expensesData,   setExpensesData]   = useState({});
  const [liveData,       setLiveData]       = useState(LIVE_DEFAULTS);
  const [editMonth,      setEditMonth]      = useState(null);
  const [editPerson,     setEditPerson]     = useState("Selva");
  const [loading,        setLoading]        = useState(true);
  const [rsuFilterPerson,setRsuFilterPerson]= useState("all");
  const [rsuFilterStock, setRsuFilterStock] = useState("all");
  const saveRef = useRef(null);

  // Load on mount — seed if storage empty (v2 forces re-seed with bug fixes)
  useEffect(()=>{
    (async()=>{
      const saved = await loadData();
      if(saved){
        if(saved.incomeData)      setIncomeData(saved.incomeData);
        if(saved.rsuData)         setRsuData(saved.rsuData);
        if(saved.investmentsData) setInvestmentsData(saved.investmentsData);
        if(saved.expensesData)    setExpensesData(saved.expensesData);
        else { setExpensesData(SEED_DATA.expensesData); }
      } else {
        setIncomeData(SEED_DATA.incomeData);
        setRsuData(SEED_DATA.rsuData);
        setInvestmentsData(SEED_DATA.investmentsData);
        setExpensesData(SEED_DATA.expensesData);
        await saveData({ incomeData:SEED_DATA.incomeData, rsuData:SEED_DATA.rsuData, investmentsData:SEED_DATA.investmentsData, expensesData:SEED_DATA.expensesData });
      }
      setLoading(false);
    })();
  },[]);

  const persist = useCallback((iD,rD,invD,expD)=>{
    if(saveRef.current) clearTimeout(saveRef.current);
    saveRef.current = setTimeout(()=>saveData({incomeData:iD, rsuData:rD, investmentsData:invD, expensesData:expD}), 500);
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
    persist(next, rsuData, investmentsData, expensesData);
  };

  const addRsuEvent = (event) => {
    const next={...rsuData};
    if(!next[event.fy]) next[event.fy]=[];
    next[event.fy]=[...next[event.fy],event];
    setRsuData(next);
    persist(incomeData, next, investmentsData, expensesData);
  };

  const deleteRsuEvent = (id) => {
    const next={...rsuData};
    Object.keys(next).forEach(k=>{next[k]=next[k].filter(e=>e.id!==id);});
    setRsuData(next);
    persist(incomeData, next, investmentsData, expensesData);
  };

  const updateInvestments = (fyKey, data) => {
    const next={...investmentsData,[fyKey]:data};
    setInvestmentsData(next);
    persist(incomeData, rsuData, next, expensesData);
  };

  const updateExpenses = (fyKey, data) => {
    const next={...expensesData,[fyKey]:data};
    setExpensesData(next);
    persist(incomeData, rsuData, investmentsData, next);
  };

  const exportCSV = () => {
    let csv="Component,Person,"+MONTHS.join(",")+",FY Total\n";
    PERSONS.forEach(p=>{
      ["take_home","epf","espp","car_lease"].forEach(c=>{
        if(c==="car_lease"&&p!=="Selva") return;
        const vals=MONTHS.map((_,mi)=>Number(incomeData?.[fy]?.[p]?.[mi]?.[c])||0);
        csv+=`${c},${p},${vals.join(",")},${vals.reduce((s,v)=>s+v,0)}\n`;
      });
    });
    const url=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));
    Object.assign(document.createElement("a"),{href:url,download:`income_${fy}.csv`}).click();
    URL.revokeObjectURL(url);
  };

  if(loading) return <div style={{ display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100vh",background:T.bg,color:T.accent,fontFamily:"'JetBrains Mono',monospace" }}>Loading...</div>;

  const btnStyle=(active)=>({padding:"8px 16px",borderRadius:"8px",border:"none",fontSize:"13px",fontWeight:600,cursor:"pointer",transition:"all 0.2s",background:active?T.accent:"transparent",color:active?T.bg:T.textDim});
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
              <LiveStrip liveData={liveData}/>
              <select value={fy} onChange={e=>setFY(e.target.value)} style={{...selectStyle,fontFamily:"'JetBrains Mono',monospace",fontWeight:700,color:T.accent}}>
                {getFYOptions().map(f=><option key={f} value={f}>{f}</option>)}
              </select>
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

        {/* ── INCOME TAB ── */}
        {activeTab==="income"&&(
          <div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:"12px", marginBottom:"20px" }}>
              <div style={{ display:"flex", gap:"4px", padding:"4px", background:T.card, borderRadius:"10px" }}>
                {[{value:"combined",label:"Combined"},{value:"Selva",label:"Selva"},{value:"Akshaya",label:"Akshaya"}].map(v=>(
                  <button key={v.value} onClick={()=>setViewMode(v.value)} style={btnStyle(viewMode===v.value)}>{v.label}</button>
                ))}
              </div>
              <button onClick={exportCSV} style={{ padding:"8px 16px", background:"transparent", border:`1px solid ${T.border}`, borderRadius:"8px", color:T.textDim, fontSize:"12px", cursor:"pointer", fontWeight:600 }}>Export CSV ↓</button>
            </div>
            <SummaryCards incomeData={incomeData} rsuData={rsuData} investmentsData={investmentsData} fy={fy}/>
            <IncomeTable  incomeData={incomeData} rsuData={rsuData} fy={fy} viewMode={viewMode}/>
            <div style={{ marginTop:"24px" }}>
              <h3 style={{ fontSize:"14px", fontWeight:700, color:T.text, marginBottom:"12px" }}>Enter Monthly Income</h3>
              <div style={{ display:"flex", gap:"8px", flexWrap:"wrap", marginBottom:"16px" }}>
                <select value={editPerson} onChange={e=>setEditPerson(e.target.value)} style={selectStyle}>
                  {PERSONS.map(p=><option key={p} value={p}>{p} ({EMPLOYER[p]})</option>)}
                </select>
                <div style={{ display:"flex", gap:"4px", padding:"4px", background:T.card, borderRadius:"10px", overflowX:"auto" }}>
                  {MONTHS.map((m,i)=>{
                    const hasData=incomeData?.[fy]?.[editPerson]?.[i]?.take_home;
                    return (
                      <button key={m} onClick={()=>setEditMonth(editMonth===i?null:i)}
                        style={{...btnStyle(editMonth===i),padding:"6px 10px",fontSize:"12px",position:"relative",...(hasData&&editMonth!==i?{color:T.accent}:{})}}>
                        {m}{hasData&&<span style={{ position:"absolute",top:2,right:2,width:4,height:4,borderRadius:"50%",background:T.accent }}/>}
                      </button>
                    );
                  })}
                </div>
              </div>
              {editMonth!==null&&(
                <div style={{ background:T.card, borderRadius:"12px", padding:"20px", border:`1px solid ${T.border}` }}>
                  <h4 style={{ margin:"0 0 16px", fontSize:"14px", color:T.text }}>
                    <span style={{ color:editPerson==="Selva"?T.selva:T.akshaya, fontWeight:700 }}>{editPerson}</span>{" · "}{MONTH_FULL[editMonth]} Income
                  </h4>
                  <MonthlyInput data={incomeData?.[fy]?.[editPerson]?.[editMonth]||{}} onChange={d=>updateMonthlyIncome(editPerson,editMonth,d)} person={editPerson} monthIdx={editMonth}/>
                  <AdHocItems items={incomeData?.[fy]?.[editPerson]?.[editMonth]?.ad_hoc||[]}
                    onChange={items=>{const cur=incomeData?.[fy]?.[editPerson]?.[editMonth]||{};updateMonthlyIncome(editPerson,editMonth,{...cur,ad_hoc:items});}}/>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── RSU TAB ── */}
        {activeTab==="rsu"&&(
          <div>
            <RsuForm onAdd={addRsuEvent} liveData={liveData}/>
            <div style={{ display:"flex", gap:"8px", marginBottom:"16px", flexWrap:"wrap", alignItems:"center" }}>
              <span style={{ fontSize:"11px", color:T.textMuted, fontWeight:600 }}>FILTER:</span>
              <select value={rsuFilterPerson} onChange={e=>setRsuFilterPerson(e.target.value)} style={selectStyle}>
                <option value="all">All Persons</option>
                {PERSONS.map(p=><option key={p} value={p}>{p}</option>)}
              </select>
              <select value={rsuFilterStock} onChange={e=>setRsuFilterStock(e.target.value)} style={selectStyle}>
                <option value="all">All Stocks</option>
                {STOCKS.map(s=><option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <RsuTable events={rsuData[fy]||[]} onDelete={deleteRsuEvent} filterPerson={rsuFilterPerson} filterStock={rsuFilterStock}/>
          </div>
        )}

        {/* ── INVESTMENTS TAB ── */}
        {activeTab==="investments"&&(
          <InvestmentsTab
            incomeData={incomeData}
            rsuData={rsuData}
            investmentsData={investmentsData}
            fy={fy}
            onUpdateInvestments={updateInvestments}
          />
        )}

        {/* ── PLACEHOLDER TABS ── */}
        {activeTab==="expenses"&&<ExpensesTab expensesData={expensesData} fy={fy} onUpdate={updateExpenses}/>}
        {activeTab==="portfolio"&&<PlaceholderTab title="Portfolio" description="Live valuation of MSFT & NVDA holdings, EPF balance, debt fund balances, and total corpus view with equity vs debt breakdown." icon="💼"/>}
      </div>

      <div style={{ padding:"16px 20px", borderTop:`1px solid ${T.border}`, textAlign:"center", color:T.textMuted, fontSize:"11px" }}>
        Family Finance Tracker v1.1 · Investments tab unlocked · Data persists across sessions
      </div>
    </div>
  );
}
