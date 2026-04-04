import { useState, useEffect, useCallback, useRef } from "react";

// ─── Constants ──────────────────────────────────────────────────────
const MONTHS = ["Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec","Jan","Feb","Mar"];
const MONTH_FULL = ["April","May","June","July","August","September","October","November","December","January","February","March"];
const PERSONS = ["Selva","Akshaya"];
const STOCKS = ["MSFT","NVDA"];
const TABS = [
  { id:"income", label:"Income", active:true },
  { id:"rsu", label:"US RSU Tracker", active:true },
  { id:"investments", label:"Investments", active:false },
  { id:"expenses", label:"Expenses", active:false },
  { id:"portfolio", label:"Portfolio", active:false },
];

const EMPLOYER = { Selva:"Microsoft", Akshaya:"Nvidia" };
const PERSON_STOCK = { Selva:"MSFT", Akshaya:"NVDA" };

// ─── Helpers ────────────────────────────────────────────────────────
const fmtINR = (n) => {
  if (n == null || isNaN(n)) return "₹0";
  const num = Math.round(Number(n));
  const s = Math.abs(num).toString();
  let result = "";
  if (s.length <= 3) { result = s; }
  else {
    result = s.slice(-3);
    let remaining = s.slice(0, -3);
    while (remaining.length > 2) {
      result = remaining.slice(-2) + "," + result;
      remaining = remaining.slice(0, -2);
    }
    if (remaining.length > 0) result = remaining + "," + result;
  }
  return (num < 0 ? "-₹" : "₹") + result;
};

const fmtUSD = (n) => {
  if (n == null || isNaN(n)) return "$0";
  return "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const getCurrentFY = () => {
  const now = new Date();
  const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return `FY${year}-${(year + 1).toString().slice(2)}`;
};

const getFYOptions = () => {
  const opts = [];
  for (let y = 2023; y <= 2028; y++) {
    opts.push(`FY${y}-${(y + 1).toString().slice(2)}`);
  }
  return opts;
};

const genId = () => Math.random().toString(36).slice(2, 10);

const emptyMonthly = (person) => ({
  id: genId(), person, take_home: "", epf: "", espp: "",
  car_lease: "", ad_hoc: [], notes: ""
});

// ─── Seed Data (FY2026-27) ──────────────────────────────────────────
// Pre-populated with Selva (Microsoft) + Akshaya (Nvidia) FY27 projections.
// Loaded only when storage is empty (first launch).
const SEED_DATA = {
  incomeData: {
    "FY2026-27": {
      Selva: {
        0:  { take_home: 133121, epf: 16704, espp: 118440, car_lease: 50706, ad_hoc: [], notes: "Apr — MSFT ESPP vest: 3 shares @ $420 × ₹94" },
        1:  { take_home: 133171, epf: 16704, espp: 0,      car_lease: 50706, ad_hoc: [], notes: "May — MSFT RSU 14 shares vest" },
        2:  { take_home: 133171, epf: 16704, espp: 0,      car_lease: 50706, ad_hoc: [], notes: "" },
        3:  { take_home: 133171, epf: 16704, espp: 118440, car_lease: 50706, ad_hoc: [], notes: "Jul — MSFT ESPP vest: 3 shares @ $420 × ₹94" },
        4:  { take_home: 133171, epf: 16704, espp: 0,      car_lease: 50706, ad_hoc: [], notes: "Aug — MSFT RSU 14 shares vest" },
        5:  { take_home: 425938, epf: 17372, espp: 0,      car_lease: 50706, ad_hoc: [{ id: "s-sep-1", label: "Performance Bonus", amount: 362158 }], notes: "Sep — 4% hike effective + bonus ₹3,62,158 (10% of CTC). TDS recalculated." },
        6:  { take_home: 125648, epf: 17372, espp: 197400, car_lease: 50706, ad_hoc: [], notes: "Oct — MSFT ESPP vest: 5 shares @ $420 × ₹94 (bonus inflated Sep contribution)" },
        7:  { take_home: 125648, epf: 17372, espp: 0,      car_lease: 50706, ad_hoc: [], notes: "Nov — MSFT RSU 14 shares vest" },
        8:  { take_home: 113296, epf: 17372, espp: 0,      car_lease: 50706, ad_hoc: [], notes: "Dec — Nov RSU recalc raises TDS" },
        9:  { take_home: 113296, epf: 17372, espp: 118440, car_lease: 50706, ad_hoc: [], notes: "Jan — MSFT ESPP vest: 3 shares @ $420 × ₹94" },
        10: { take_home: 113196, epf: 17372, espp: 0,      car_lease: 50706, ad_hoc: [], notes: "Feb — MSFT RSU 14 shares vest" },
        11: { take_home: 5097,   epf: 17372, espp: 0,      car_lease: 50706, ad_hoc: [], notes: "⚠ Mar — Surcharge catch-up! Feb RSU pushes income >₹50L. Only ₹5,097 cash take-home." },
      },
      Akshaya: {
        0:  { take_home: 147323, epf: 17198, espp: 0,      ad_hoc: [], notes: "" },
        1:  { take_home: 147373, epf: 17198, espp: 0,      ad_hoc: [], notes: "" },
        2:  { take_home: 219767, epf: 17198, espp: 0,      ad_hoc: [], notes: "Jun — NVDA RSU 160 shares vest (RSU refund boosts take-home)" },
        3:  { take_home: 156776, epf: 17198, espp: 0,      ad_hoc: [], notes: "" },
        4:  { take_home: 156776, epf: 17198, espp: 0,      ad_hoc: [], notes: "" },
        5:  { take_home: 332268, epf: 17372, espp: 795240, ad_hoc: [], notes: "Sep — NVDA RSU 101 shares + ESPP vest 47 shares @ $180 × ₹94" },
        6:  { take_home: 128813, epf: 17372, espp: 0,      ad_hoc: [], notes: "⚠ Oct — Lowest cash month. OPD insurance deduction + elevated TDS." },
        7:  { take_home: 146626, epf: 17372, espp: 0,      ad_hoc: [], notes: "" },
        8:  { take_home: 191732, epf: 17372, espp: 0,      ad_hoc: [], notes: "Dec — NVDA RSU 100 shares vest" },
        9:  { take_home: 164303, epf: 17372, espp: 0,      ad_hoc: [], notes: "" },
        10: { take_home: 164203, epf: 17372, espp: 0,      ad_hoc: [], notes: "" },
        11: { take_home: 132805, epf: 17372, espp: 795240, ad_hoc: [], notes: "Mar — NVDA RSU 100 shares + ESPP 47 shares. 15% surcharge kicks in (income >₹1Cr)." },
      },
    },
  },
  rsuData: {
    "FY2026-27": [
      // Selva — MSFT (56 shares, 14/vest, quarterly: May/Aug/Nov/Feb)
      { id: "rsu-s1", person: "Selva",   stock: "MSFT", vest_date: "2026-05-15", units_vested: 14,  stock_price_usd: 420, usd_inr_rate: 94, tax_withheld_units: 4,  grant_id: "MSFT-FY27", month_idx: 1,  fy: "FY2026-27" },
      { id: "rsu-s2", person: "Selva",   stock: "MSFT", vest_date: "2026-08-15", units_vested: 14,  stock_price_usd: 420, usd_inr_rate: 94, tax_withheld_units: 4,  grant_id: "MSFT-FY27", month_idx: 4,  fy: "FY2026-27" },
      { id: "rsu-s3", person: "Selva",   stock: "MSFT", vest_date: "2026-11-15", units_vested: 14,  stock_price_usd: 420, usd_inr_rate: 94, tax_withheld_units: 4,  grant_id: "MSFT-FY27", month_idx: 7,  fy: "FY2026-27" },
      { id: "rsu-s4", person: "Selva",   stock: "MSFT", vest_date: "2027-02-15", units_vested: 14,  stock_price_usd: 420, usd_inr_rate: 94, tax_withheld_units: 5,  grant_id: "MSFT-FY27", month_idx: 10, fy: "FY2026-27" },
      // Akshaya — NVDA (461 shares total: Jun 160 / Sep 101 / Dec 100 / Mar 100)
      { id: "rsu-a1", person: "Akshaya", stock: "NVDA", vest_date: "2026-06-15", units_vested: 160, stock_price_usd: 180, usd_inr_rate: 94, tax_withheld_units: 50, grant_id: "NVDA-FY27", month_idx: 2,  fy: "FY2026-27" },
      { id: "rsu-a2", person: "Akshaya", stock: "NVDA", vest_date: "2026-09-15", units_vested: 101, stock_price_usd: 180, usd_inr_rate: 94, tax_withheld_units: 32, grant_id: "NVDA-FY27", month_idx: 5,  fy: "FY2026-27" },
      { id: "rsu-a3", person: "Akshaya", stock: "NVDA", vest_date: "2026-12-15", units_vested: 100, stock_price_usd: 180, usd_inr_rate: 94, tax_withheld_units: 31, grant_id: "NVDA-FY27", month_idx: 8,  fy: "FY2026-27" },
      { id: "rsu-a4", person: "Akshaya", stock: "NVDA", vest_date: "2027-03-15", units_vested: 100, stock_price_usd: 180, usd_inr_rate: 94, tax_withheld_units: 36, grant_id: "NVDA-FY27", month_idx: 11, fy: "FY2026-27" },
    ],
  },
};

// ─── Storage (localStorage — works on MacBook, iPhone via LAN) ─────
const STORAGE_KEY = "family-finance-v1";

const loadData = async () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
};

const saveData = async (data) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) { console.error("Save failed:", e); }
};

// ─── Simulated Live Data ────────────────────────────────────────────
const LIVE_DEFAULTS = { MSFT: 428.50, NVDA: 136.20, USDINR: 85.42 };

// ─── Styles ─────────────────────────────────────────────────────────
const theme = {
  bg: "#0B1120",
  surface: "#131B2E",
  card: "#1A2340",
  cardHover: "#1F2B4D",
  border: "#2A3555",
  borderLight: "#354168",
  accent: "#22C55E",
  accentDim: "#166534",
  accentBg: "rgba(34,197,94,0.08)",
  accentGlow: "rgba(34,197,94,0.15)",
  text: "#E8ECF4",
  textDim: "#8B96AD",
  textMuted: "#5A6580",
  white: "#FFFFFF",
  red: "#EF4444",
  amber: "#F59E0B",
  blue: "#3B82F6",
  purple: "#A855F7",
  selva: "#3B82F6",
  akshaya: "#EC4899",
};

// ─── Components ─────────────────────────────────────────────────────

function LiveStrip({ liveData }) {
  return (
    <div style={{
      display:"flex", gap:"16px", flexWrap:"wrap", alignItems:"center",
      padding:"8px 16px", background: theme.card, borderRadius:"10px",
      border:`1px solid ${theme.border}`, fontSize:"13px"
    }}>
      <span style={{ color: theme.textMuted, fontWeight:600, letterSpacing:"0.5px", textTransform:"uppercase", fontSize:"10px" }}>LIVE</span>
      <span style={{ width:"6px", height:"6px", borderRadius:"50%", background: theme.accent, animation:"pulse 2s infinite", boxShadow:`0 0 6px ${theme.accent}` }}/>
      {[
        { label:"MSFT", value: fmtUSD(liveData.MSFT), color: theme.blue },
        { label:"NVDA", value: fmtUSD(liveData.NVDA), color: theme.accent },
        { label:"USD/INR", value: `₹${liveData.USDINR.toFixed(2)}`, color: theme.amber },
      ].map(d => (
        <div key={d.label} style={{ display:"flex", alignItems:"center", gap:"6px" }}>
          <span style={{ color: theme.textDim, fontSize:"11px", fontWeight:600 }}>{d.label}</span>
          <span style={{ color: d.color, fontWeight:700, fontFamily:"'JetBrains Mono', monospace" }}>{d.value}</span>
        </div>
      ))}
    </div>
  );
}

function SummaryCards({ incomeData, rsuData, fy }) {
  const totalTakeHome = PERSONS.reduce((sum, p) =>
    sum + MONTHS.reduce((s, _, mi) => {
      const d = incomeData?.[fy]?.[p]?.[mi];
      return s + (Number(d?.take_home) || 0);
    }, 0), 0);

  const totalEPF = PERSONS.reduce((sum, p) =>
    sum + MONTHS.reduce((s, _, mi) => {
      const d = incomeData?.[fy]?.[p]?.[mi];
      return s + (Number(d?.epf) || 0);
    }, 0), 0);

  const totalESPP = PERSONS.reduce((sum, p) =>
    sum + MONTHS.reduce((s, _, mi) => {
      const d = incomeData?.[fy]?.[p]?.[mi];
      return s + (Number(d?.espp) || 0);
    }, 0), 0);

  const totalRSU = (rsuData?.[fy] || []).reduce((s, r) =>
    s + (Number(r.units_vested) * Number(r.stock_price_usd) * Number(r.usd_inr_rate) || 0), 0);

  const totalAdHoc = PERSONS.reduce((sum, p) =>
    sum + MONTHS.reduce((s, _, mi) => {
      const d = incomeData?.[fy]?.[p]?.[mi];
      const carLease = Number(d?.car_lease) || 0;
      const adHocSum = (d?.ad_hoc || []).reduce((a, item) => a + (Number(item.amount) || 0), 0);
      return s + carLease + adHocSum;
    }, 0), 0);

  const grandTotal = totalTakeHome + totalEPF + totalESPP + totalRSU + totalAdHoc;

  const cards = [
    { label: "Total Take-Home", value: fmtINR(totalTakeHome), color: theme.accent },
    { label: "Total RSU (INR)", value: fmtINR(totalRSU), color: theme.purple },
    { label: "Total EPF", value: fmtINR(totalEPF), color: theme.blue },
    { label: "Total ESPP", value: fmtINR(totalESPP), color: theme.amber },
    { label: "Grand Total Income", value: fmtINR(grandTotal), color: theme.white, grand: true },
  ];

  return (
    <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(180px, 1fr))", gap:"12px", marginBottom:"20px" }}>
      {cards.map(c => (
        <div key={c.label} style={{
          background: c.grand ? `linear-gradient(135deg, ${theme.accentDim}, ${theme.card})` : theme.card,
          border: `1px solid ${c.grand ? theme.accent : theme.border}`,
          borderRadius:"12px", padding:"16px",
          boxShadow: c.grand ? `0 0 20px ${theme.accentGlow}` : "none"
        }}>
          <div style={{ fontSize:"11px", color: theme.textMuted, textTransform:"uppercase", fontWeight:600, letterSpacing:"0.5px", marginBottom:"6px" }}>{c.label}</div>
          <div style={{ fontSize: c.grand ? "22px" : "20px", fontWeight:800, color: c.color, fontFamily:"'JetBrains Mono', monospace" }}>{c.value}</div>
        </div>
      ))}
    </div>
  );
}

function MonthlyInput({ data, onChange, person, monthIdx }) {
  const isSelva = person === "Selva";
  const fields = [
    { key:"take_home", label:"Take-Home (₹)", placeholder:"e.g. 185000" },
    { key:"epf", label:"EPF (₹)", placeholder:"e.g. 21600" },
    { key:"espp", label:"ESPP (₹)", placeholder:"e.g. 15000" },
    ...(isSelva ? [{ key:"car_lease", label:"Car Lease (₹)", placeholder:"e.g. 14000" }] : []),
  ];

  return (
    <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(200px, 1fr))", gap:"12px" }}>
      {fields.map(f => (
        <div key={f.key}>
          <label style={{ fontSize:"11px", color: theme.textDim, fontWeight:600, display:"block", marginBottom:"4px" }}>{f.label}</label>
          <input
            type="number"
            value={data?.[f.key] ?? ""}
            placeholder={f.placeholder}
            onChange={e => onChange({ ...data, [f.key]: e.target.value })}
            style={{
              width:"100%", padding:"10px 12px", background: theme.bg, border:`1px solid ${theme.border}`,
              borderRadius:"8px", color: theme.text, fontSize:"14px", fontFamily:"'JetBrains Mono', monospace",
              outline:"none", boxSizing:"border-box"
            }}
            onFocus={e => e.target.style.borderColor = theme.accent}
            onBlur={e => e.target.style.borderColor = theme.border}
          />
        </div>
      ))}
    </div>
  );
}

function AdHocItems({ items = [], onChange }) {
  const addItem = () => onChange([...items, { id: genId(), label: "", amount: "" }]);
  const removeItem = (id) => onChange(items.filter(i => i.id !== id));
  const updateItem = (id, field, val) => onChange(items.map(i => i.id === id ? { ...i, [field]: val } : i));

  return (
    <div style={{ marginTop:"12px" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"8px" }}>
        <span style={{ fontSize:"11px", color: theme.textDim, fontWeight:600 }}>AD-HOC ITEMS (Bonus, Refunds, etc.)</span>
        <button onClick={addItem} style={{
          padding:"4px 12px", background:"transparent", border:`1px solid ${theme.accent}`,
          color: theme.accent, borderRadius:"6px", fontSize:"12px", cursor:"pointer", fontWeight:600
        }}>+ Add</button>
      </div>
      {items.map(item => (
        <div key={item.id} style={{ display:"flex", gap:"8px", marginBottom:"6px", alignItems:"center" }}>
          <input
            placeholder="Label"
            value={item.label}
            onChange={e => updateItem(item.id, "label", e.target.value)}
            style={{
              flex:1, padding:"8px 10px", background: theme.bg, border:`1px solid ${theme.border}`,
              borderRadius:"6px", color: theme.text, fontSize:"13px", outline:"none"
            }}
          />
          <input
            type="number"
            placeholder="Amount (₹)"
            value={item.amount}
            onChange={e => updateItem(item.id, "amount", e.target.value)}
            style={{
              width:"140px", padding:"8px 10px", background: theme.bg, border:`1px solid ${theme.border}`,
              borderRadius:"6px", color: theme.text, fontSize:"13px", fontFamily:"'JetBrains Mono', monospace", outline:"none"
            }}
          />
          <button onClick={() => removeItem(item.id)} style={{
            padding:"6px 10px", background:"transparent", border:`1px solid ${theme.red}33`,
            color: theme.red, borderRadius:"6px", fontSize:"12px", cursor:"pointer"
          }}>✕</button>
        </div>
      ))}
    </div>
  );
}

function IncomeTable({ incomeData, rsuData, fy, viewMode }) {
  const persons = viewMode === "combined" ? PERSONS : [viewMode];

  const getMonthData = (person, mi) => incomeData?.[fy]?.[person]?.[mi] || {};
  const getMonthRSU = (person, mi) =>
    (rsuData?.[fy] || []).filter(r => r.person === person && r.month_idx === mi)
      .reduce((s, r) => s + (Number(r.units_vested) * Number(r.stock_price_usd) * Number(r.usd_inr_rate) || 0), 0);

  const rows = [
    { key:"take_home", label:"Take-Home Salary" },
    { key:"epf", label:"EPF Contribution" },
    { key:"espp", label:"ESPP Contribution" },
    { key:"car_lease", label:"Car Lease", personFilter:"Selva" },
    { key:"rsu", label:"RSU Vesting (INR)", computed: true },
    { key:"ad_hoc", label:"Ad-hoc / Bonus", computed: true },
    { key:"total", label:"Monthly Total", isTotal: true },
  ];

  const getVal = (row, person, mi) => {
    const d = getMonthData(person, mi);
    if (row.key === "rsu") return getMonthRSU(person, mi);
    if (row.key === "ad_hoc") {
      const carLease = person === "Selva" ? 0 : 0;
      return (d.ad_hoc || []).reduce((s, i) => s + (Number(i.amount) || 0), 0);
    }
    if (row.key === "total") {
      return (Number(d.take_home) || 0) + (Number(d.epf) || 0) + (Number(d.espp) || 0)
        + (Number(d.car_lease) || 0) + getMonthRSU(person, mi)
        + (d.ad_hoc || []).reduce((s, i) => s + (Number(i.amount) || 0), 0);
    }
    return Number(d[row.key]) || 0;
  };

  const getCombinedVal = (row, mi) => persons.reduce((s, p) => s + getVal(row, p, mi), 0);
  const getRowTotal = (row) => MONTHS.reduce((s, _, mi) => s + getCombinedVal(row, mi), 0);

  return (
    <div style={{ overflowX:"auto", borderRadius:"12px", border:`1px solid ${theme.border}` }}>
      <table style={{ width:"100%", borderCollapse:"collapse", minWidth:"900px", fontSize:"13px" }}>
        <thead>
          <tr style={{ background: theme.card }}>
            <th style={{ padding:"12px 16px", textAlign:"left", color: theme.textDim, fontSize:"11px", fontWeight:700, letterSpacing:"0.5px", borderBottom:`1px solid ${theme.border}`, position:"sticky", left:0, background: theme.card, zIndex:1 }}>COMPONENT</th>
            {MONTHS.map(m => (
              <th key={m} style={{ padding:"12px 8px", textAlign:"right", color: theme.textDim, fontSize:"11px", fontWeight:700, borderBottom:`1px solid ${theme.border}` }}>{m.toUpperCase()}</th>
            ))}
            <th style={{ padding:"12px 16px", textAlign:"right", color: theme.accent, fontSize:"11px", fontWeight:700, borderBottom:`1px solid ${theme.border}` }}>FY TOTAL</th>
          </tr>
        </thead>
        <tbody>
          {rows.filter(r => !r.personFilter || persons.includes(r.personFilter)).map(row => (
            <tr key={row.key} style={{
              background: row.isTotal ? theme.accentBg : "transparent",
              borderBottom: `1px solid ${row.isTotal ? theme.accent + "33" : theme.border}22`
            }}>
              <td style={{
                padding:"10px 16px", color: row.isTotal ? theme.accent : theme.text,
                fontWeight: row.isTotal ? 700 : 500, fontSize:"12px",
                position:"sticky", left:0, background: row.isTotal ? theme.accentBg : theme.surface, zIndex:1
              }}>{row.label}</td>
              {MONTHS.map((_, mi) => {
                const val = getCombinedVal(row, mi);
                return (
                  <td key={mi} style={{
                    padding:"10px 8px", textAlign:"right",
                    color: val > 0 ? (row.isTotal ? theme.accent : theme.text) : theme.textMuted,
                    fontFamily:"'JetBrains Mono', monospace", fontSize:"12px",
                    fontWeight: row.isTotal ? 700 : 400
                  }}>{val > 0 ? fmtINR(val) : "—"}</td>
                );
              })}
              <td style={{
                padding:"10px 16px", textAlign:"right",
                color: row.isTotal ? theme.accent : theme.white,
                fontFamily:"'JetBrains Mono', monospace", fontSize:"13px", fontWeight:700
              }}>{fmtINR(getRowTotal(row))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RsuForm({ onAdd, liveData }) {
  const [form, setForm] = useState({
    person:"Selva", stock:"MSFT", vest_date:"", units_vested:"",
    stock_price_usd: "", usd_inr_rate: "", tax_withheld_units:"", grant_id:"", notes:""
  });

  const updateField = (k, v) => {
    const next = { ...form, [k]: v };
    if (k === "person") next.stock = PERSON_STOCK[v];
    setForm(next);
  };

  const useLive = () => {
    setForm(f => ({
      ...f,
      stock_price_usd: liveData[f.stock]?.toString() || "",
      usd_inr_rate: liveData.USDINR?.toString() || ""
    }));
  };

  const grossUSD = (Number(form.units_vested) || 0) * (Number(form.stock_price_usd) || 0);
  const grossINR = grossUSD * (Number(form.usd_inr_rate) || 0);
  const netUnits = (Number(form.units_vested) || 0) - (Number(form.tax_withheld_units) || 0);
  const netINR = netUnits * (Number(form.stock_price_usd) || 0) * (Number(form.usd_inr_rate) || 0);

  const handleSubmit = () => {
    if (!form.vest_date || !form.units_vested || !form.stock_price_usd || !form.usd_inr_rate) return;
    const vestDate = new Date(form.vest_date);
    const vestMonth = vestDate.getMonth();
    const vestYear = vestDate.getFullYear();
    const fyYear = vestMonth >= 3 ? vestYear : vestYear - 1;
    const fy = `FY${fyYear}-${(fyYear + 1).toString().slice(2)}`;
    const monthIdx = vestMonth >= 3 ? vestMonth - 3 : vestMonth + 9;

    onAdd({
      id: genId(), ...form, fy, month_idx: monthIdx,
      units_vested: Number(form.units_vested),
      stock_price_usd: Number(form.stock_price_usd),
      usd_inr_rate: Number(form.usd_inr_rate),
      tax_withheld_units: Number(form.tax_withheld_units) || 0,
    });
    setForm({ person:"Selva", stock:"MSFT", vest_date:"", units_vested:"", stock_price_usd:"", usd_inr_rate:"", tax_withheld_units:"", grant_id:"", notes:"" });
  };

  const inputStyle = {
    padding:"10px 12px", background: theme.bg, border:`1px solid ${theme.border}`,
    borderRadius:"8px", color: theme.text, fontSize:"13px", outline:"none", width:"100%", boxSizing:"border-box"
  };
  const selectStyle = { ...inputStyle, appearance:"none", cursor:"pointer" };
  const labelStyle = { fontSize:"11px", color: theme.textDim, fontWeight:600, display:"block", marginBottom:"4px" };

  return (
    <div style={{ background: theme.card, borderRadius:"12px", padding:"20px", border:`1px solid ${theme.border}`, marginBottom:"20px" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"16px" }}>
        <h3 style={{ margin:0, fontSize:"14px", color: theme.text, fontWeight:700 }}>Add RSU Vesting Event</h3>
        <button onClick={useLive} style={{
          padding:"6px 14px", background: theme.accentBg, border:`1px solid ${theme.accent}44`,
          color: theme.accent, borderRadius:"6px", fontSize:"11px", cursor:"pointer", fontWeight:600
        }}>Use Live Prices</button>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(180px, 1fr))", gap:"12px" }}>
        <div>
          <label style={labelStyle}>Person</label>
          <select value={form.person} onChange={e => updateField("person", e.target.value)} style={selectStyle}>
            {PERSONS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Stock</label>
          <select value={form.stock} onChange={e => updateField("stock", e.target.value)} style={selectStyle}>
            {STOCKS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Vest Date</label>
          <input type="date" value={form.vest_date} onChange={e => updateField("vest_date", e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Units Vested</label>
          <input type="number" value={form.units_vested} onChange={e => updateField("units_vested", e.target.value)} placeholder="e.g. 25" style={{...inputStyle, fontFamily:"'JetBrains Mono', monospace"}} />
        </div>
        <div>
          <label style={labelStyle}>Stock Price (USD)</label>
          <input type="number" step="0.01" value={form.stock_price_usd} onChange={e => updateField("stock_price_usd", e.target.value)} placeholder="e.g. 428.50" style={{...inputStyle, fontFamily:"'JetBrains Mono', monospace"}} />
        </div>
        <div>
          <label style={labelStyle}>USD/INR Rate</label>
          <input type="number" step="0.01" value={form.usd_inr_rate} onChange={e => updateField("usd_inr_rate", e.target.value)} placeholder="e.g. 85.42" style={{...inputStyle, fontFamily:"'JetBrains Mono', monospace"}} />
        </div>
        <div>
          <label style={labelStyle}>Tax Withheld (Units)</label>
          <input type="number" value={form.tax_withheld_units} onChange={e => updateField("tax_withheld_units", e.target.value)} placeholder="0" style={{...inputStyle, fontFamily:"'JetBrains Mono', monospace"}} />
        </div>
        <div>
          <label style={labelStyle}>Grant ID</label>
          <input value={form.grant_id} onChange={e => updateField("grant_id", e.target.value)} placeholder="Optional" style={inputStyle} />
        </div>
      </div>

      {grossUSD > 0 && (
        <div style={{ display:"flex", gap:"16px", flexWrap:"wrap", marginTop:"16px", padding:"12px 16px", background: theme.bg, borderRadius:"8px" }}>
          <div><span style={{ fontSize:"11px", color: theme.textMuted }}>Gross USD</span><div style={{ fontFamily:"'JetBrains Mono', monospace", color: theme.blue, fontWeight:700 }}>{fmtUSD(grossUSD)}</div></div>
          <div><span style={{ fontSize:"11px", color: theme.textMuted }}>Gross INR</span><div style={{ fontFamily:"'JetBrains Mono', monospace", color: theme.accent, fontWeight:700 }}>{fmtINR(grossINR)}</div></div>
          <div><span style={{ fontSize:"11px", color: theme.textMuted }}>Net Units</span><div style={{ fontFamily:"'JetBrains Mono', monospace", color: theme.text, fontWeight:700 }}>{netUnits}</div></div>
          <div><span style={{ fontSize:"11px", color: theme.textMuted }}>Net INR</span><div style={{ fontFamily:"'JetBrains Mono', monospace", color: theme.accent, fontWeight:700 }}>{fmtINR(netINR)}</div></div>
        </div>
      )}

      <button onClick={handleSubmit} style={{
        marginTop:"16px", padding:"10px 28px", background: theme.accent, border:"none",
        borderRadius:"8px", color: theme.bg, fontSize:"14px", fontWeight:700, cursor:"pointer",
        opacity: (!form.vest_date || !form.units_vested) ? 0.4 : 1
      }}>Add Vesting Event</button>
    </div>
  );
}

function RsuTable({ events, onDelete, filterPerson, filterStock }) {
  let filtered = events;
  if (filterPerson !== "all") filtered = filtered.filter(e => e.person === filterPerson);
  if (filterStock !== "all") filtered = filtered.filter(e => e.stock === filterStock);
  filtered = [...filtered].sort((a, b) => new Date(a.vest_date) - new Date(b.vest_date));

  const totalUnits = filtered.reduce((s, e) => s + e.units_vested, 0);
  const totalGrossUSD = filtered.reduce((s, e) => s + e.units_vested * e.stock_price_usd, 0);
  const totalGrossINR = filtered.reduce((s, e) => s + e.units_vested * e.stock_price_usd * e.usd_inr_rate, 0);

  if (filtered.length === 0) return (
    <div style={{ textAlign:"center", padding:"40px", color: theme.textMuted, fontSize:"14px" }}>
      No RSU vesting events recorded yet. Add one above.
    </div>
  );

  return (
    <div>
      <div style={{ display:"flex", gap:"16px", flexWrap:"wrap", marginBottom:"16px" }}>
        {[
          { label:"Total Units", value: totalUnits.toLocaleString(), color: theme.text },
          { label:"Total Gross USD", value: fmtUSD(totalGrossUSD), color: theme.blue },
          { label:"Total Gross INR", value: fmtINR(totalGrossINR), color: theme.accent },
        ].map(c => (
          <div key={c.label} style={{ padding:"12px 20px", background: theme.card, borderRadius:"10px", border:`1px solid ${theme.border}` }}>
            <div style={{ fontSize:"10px", color: theme.textMuted, fontWeight:600, textTransform:"uppercase" }}>{c.label}</div>
            <div style={{ fontSize:"18px", fontWeight:800, color: c.color, fontFamily:"'JetBrains Mono', monospace" }}>{c.value}</div>
          </div>
        ))}
      </div>

      <div style={{ overflowX:"auto", borderRadius:"10px", border:`1px solid ${theme.border}` }}>
        <table style={{ width:"100%", borderCollapse:"collapse", minWidth:"800px", fontSize:"12px" }}>
          <thead>
            <tr style={{ background: theme.card }}>
              {["Person","Stock","Vest Date","Units","Price (USD)","USD/INR","Gross INR","Tax Units","Net INR","Grant ID",""].map(h => (
                <th key={h} style={{ padding:"10px 12px", textAlign: h === "Person" || h === "Stock" ? "left" : "right", color: theme.textDim, fontSize:"10px", fontWeight:700, letterSpacing:"0.5px", borderBottom:`1px solid ${theme.border}` }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(e => (
              <tr key={e.id} style={{ borderBottom:`1px solid ${theme.border}22` }}>
                <td style={{ padding:"10px 12px", color: e.person === "Selva" ? theme.selva : theme.akshaya, fontWeight:600 }}>{e.person}</td>
                <td style={{ padding:"10px 12px", color: theme.text, fontWeight:600 }}>{e.stock}</td>
                <td style={{ padding:"10px 12px", textAlign:"right", color: theme.text, fontFamily:"'JetBrains Mono', monospace" }}>
                  {new Date(e.vest_date).toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" })}
                </td>
                <td style={{ padding:"10px 12px", textAlign:"right", fontFamily:"'JetBrains Mono', monospace", color: theme.text }}>{e.units_vested}</td>
                <td style={{ padding:"10px 12px", textAlign:"right", fontFamily:"'JetBrains Mono', monospace", color: theme.blue }}>{fmtUSD(e.stock_price_usd)}</td>
                <td style={{ padding:"10px 12px", textAlign:"right", fontFamily:"'JetBrains Mono', monospace", color: theme.amber }}>₹{e.usd_inr_rate}</td>
                <td style={{ padding:"10px 12px", textAlign:"right", fontFamily:"'JetBrains Mono', monospace", color: theme.accent, fontWeight:600 }}>{fmtINR(e.units_vested * e.stock_price_usd * e.usd_inr_rate)}</td>
                <td style={{ padding:"10px 12px", textAlign:"right", fontFamily:"'JetBrains Mono', monospace", color: theme.textDim }}>{e.tax_withheld_units || "—"}</td>
                <td style={{ padding:"10px 12px", textAlign:"right", fontFamily:"'JetBrains Mono', monospace", color: theme.accent }}>{fmtINR((e.units_vested - (e.tax_withheld_units || 0)) * e.stock_price_usd * e.usd_inr_rate)}</td>
                <td style={{ padding:"10px 12px", textAlign:"right", color: theme.textMuted, fontSize:"11px" }}>{e.grant_id || "—"}</td>
                <td style={{ padding:"10px 12px", textAlign:"right" }}>
                  <button onClick={() => onDelete(e.id)} style={{ background:"transparent", border:"none", color: theme.red, cursor:"pointer", fontSize:"14px", opacity:0.6 }}>✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PlaceholderTab({ title, description, icon }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"60px 20px", textAlign:"center" }}>
      <div style={{ fontSize:"48px", marginBottom:"16px", opacity:0.3 }}>{icon}</div>
      <h2 style={{ color: theme.textDim, fontSize:"20px", fontWeight:700, marginBottom:"8px" }}>{title}</h2>
      <p style={{ color: theme.textMuted, fontSize:"14px", maxWidth:"400px", lineHeight:1.6 }}>{description}</p>
      <div style={{ marginTop:"20px", padding:"8px 20px", background: theme.card, borderRadius:"20px", border:`1px solid ${theme.border}`, color: theme.textMuted, fontSize:"12px", fontWeight:600 }}>Coming in v2.0</div>
    </div>
  );
}

// ─── Main App ───────────────────────────────────────────────────────
export default function FamilyFinanceTracker() {
  const [activeTab, setActiveTab] = useState("income");
  const [fy, setFY] = useState(getCurrentFY());
  const [viewMode, setViewMode] = useState("combined");
  const [incomeData, setIncomeData] = useState({});
  const [rsuData, setRsuData] = useState({});
  const [liveData, setLiveData] = useState(LIVE_DEFAULTS);
  const [editMonth, setEditMonth] = useState(null);
  const [editPerson, setEditPerson] = useState("Selva");
  const [loading, setLoading] = useState(true);
  const [rsuFilterPerson, setRsuFilterPerson] = useState("all");
  const [rsuFilterStock, setRsuFilterStock] = useState("all");
  const saveTimeoutRef = useRef(null);

  // Load data on mount — seed with FY2026-27 projections if storage is empty
  useEffect(() => {
    (async () => {
      const saved = await loadData();
      if (saved) {
        if (saved.incomeData) setIncomeData(saved.incomeData);
        if (saved.rsuData) setRsuData(saved.rsuData);
      } else {
        setIncomeData(SEED_DATA.incomeData);
        setRsuData(SEED_DATA.rsuData);
        await saveData({ incomeData: SEED_DATA.incomeData, rsuData: SEED_DATA.rsuData });
      }
      setLoading(false);
    })();
  }, []);

  // Auto-save with debounce
  const persistData = useCallback((iData, rData) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveData({ incomeData: iData, rsuData: rData });
    }, 500);
  }, []);

  const updateMonthlyIncome = (person, monthIdx, data) => {
    const next = { ...incomeData };
    if (!next[fy]) next[fy] = {};
    if (!next[fy][person]) next[fy][person] = {};
    next[fy][person][monthIdx] = data;

    // Sticky EPF/ESPP: propagate forward
    if (data.epf || data.espp) {
      for (let i = monthIdx + 1; i < 12; i++) {
        if (!next[fy][person][i]) next[fy][person][i] = {};
        const existing = next[fy][person][i];
        if (!existing.epf && data.epf) existing.epf = data.epf;
        if (!existing.espp && data.espp) existing.espp = data.espp;
        if (person === "Selva" && !existing.car_lease && data.car_lease) existing.car_lease = data.car_lease;
      }
    }
    setIncomeData(next);
    persistData(next, rsuData);
  };

  const addRsuEvent = (event) => {
    const next = { ...rsuData };
    if (!next[event.fy]) next[event.fy] = [];
    next[event.fy] = [...next[event.fy], event];
    setRsuData(next);
    persistData(incomeData, next);
  };

  const deleteRsuEvent = (id) => {
    const next = { ...rsuData };
    Object.keys(next).forEach(key => {
      next[key] = next[key].filter(e => e.id !== id);
    });
    setRsuData(next);
    persistData(incomeData, next);
  };

  const exportCSV = () => {
    let csv = "Component,Person," + MONTHS.join(",") + ",FY Total\n";
    const components = ["take_home","epf","espp","car_lease"];
    const labels = { take_home:"Take-Home", epf:"EPF", espp:"ESPP", car_lease:"Car Lease" };
    PERSONS.forEach(p => {
      components.forEach(c => {
        if (c === "car_lease" && p !== "Selva") return;
        const vals = MONTHS.map((_, mi) => Number(incomeData?.[fy]?.[p]?.[mi]?.[c]) || 0);
        const total = vals.reduce((s, v) => s + v, 0);
        csv += `${labels[c]},${p},${vals.join(",")},${total}\n`;
      });
    });
    const blob = new Blob([csv], { type:"text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `income_${fy}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div style={{ display:"flex", alignItems:"center", justifyContent:"center", minHeight:"100vh", background: theme.bg, color: theme.accent, fontFamily:"'JetBrains Mono', monospace" }}>
        Loading...
      </div>
    );
  }

  const btnStyle = (active) => ({
    padding:"8px 16px", borderRadius:"8px", border:"none", fontSize:"13px", fontWeight:600,
    cursor:"pointer", transition:"all 0.2s",
    background: active ? theme.accent : "transparent",
    color: active ? theme.bg : theme.textDim,
  });

  const selectStyle = {
    padding:"8px 14px", background: theme.card, border:`1px solid ${theme.border}`,
    borderRadius:"8px", color: theme.text, fontSize:"13px", outline:"none", cursor:"pointer",
    appearance:"none", fontWeight:600
  };

  return (
    <div style={{ minHeight:"100vh", background: theme.bg, color: theme.text, fontFamily:"'DM Sans', -apple-system, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width:6px; height:6px; }
        ::-webkit-scrollbar-track { background: ${theme.bg}; }
        ::-webkit-scrollbar-thumb { background: ${theme.border}; border-radius:3px; }
        ::-webkit-scrollbar-thumb:hover { background: ${theme.borderLight}; }
        @keyframes pulse { 0%, 100% { opacity:1; } 50% { opacity:0.3; } }
        input[type=number]::-webkit-inner-spin-button, input[type=number]::-webkit-outer-spin-button { -webkit-appearance:none; }
        input[type=number] { -moz-appearance:textfield; }
        select { background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238B96AD' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E"); background-repeat:no-repeat; background-position:right 10px center; padding-right:30px !important; }
        option { background: ${theme.card}; color: ${theme.text}; }
      `}</style>

      {/* Header */}
      <div style={{ padding:"16px 20px", borderBottom:`1px solid ${theme.border}` }}>
        <div style={{ maxWidth:"1400px", margin:"0 auto" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:"12px", marginBottom:"12px" }}>
            <div style={{ display:"flex", alignItems:"center", gap:"12px" }}>
              <div style={{ width:"36px", height:"36px", borderRadius:"10px", background:`linear-gradient(135deg, ${theme.accent}, ${theme.blue})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"18px", fontWeight:800, color: theme.bg }}>₹</div>
              <div>
                <h1 style={{ margin:0, fontSize:"18px", fontWeight:800, letterSpacing:"-0.3px" }}>Family Finance Tracker</h1>
                <p style={{ margin:0, fontSize:"11px", color: theme.textMuted }}>Selva & Akshaya · {EMPLOYER.Selva} + {EMPLOYER.Akshaya}</p>
              </div>
            </div>
            <div style={{ display:"flex", gap:"10px", alignItems:"center", flexWrap:"wrap" }}>
              <LiveStrip liveData={liveData} />
              <select value={fy} onChange={e => setFY(e.target.value)} style={{ ...selectStyle, fontFamily:"'JetBrains Mono', monospace", fontWeight:700, color: theme.accent }}>
                {getFYOptions().map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
          </div>

          {/* Tab Bar */}
          <div style={{ display:"flex", gap:"4px", overflowX:"auto", paddingBottom:"4px" }}>
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => tab.active && setActiveTab(tab.id)}
                style={{
                  padding:"10px 18px", borderRadius:"8px 8px 0 0", border:"none",
                  fontSize:"13px", fontWeight:600, cursor: tab.active ? "pointer" : "not-allowed",
                  whiteSpace:"nowrap", transition:"all 0.2s",
                  background: activeTab === tab.id ? theme.surface : "transparent",
                  color: !tab.active ? theme.textMuted : activeTab === tab.id ? theme.accent : theme.textDim,
                  opacity: tab.active ? 1 : 0.5,
                  borderBottom: activeTab === tab.id ? `2px solid ${theme.accent}` : "2px solid transparent"
                }}
              >{tab.label}{!tab.active && " 🔒"}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth:"1400px", margin:"0 auto", padding:"20px" }}>

        {/* ─── INCOME TAB ─── */}
        {activeTab === "income" && (
          <div>
            {/* View toggle + Export */}
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:"12px", marginBottom:"20px" }}>
              <div style={{ display:"flex", gap:"4px", padding:"4px", background: theme.card, borderRadius:"10px" }}>
                {[
                  { value:"combined", label:"Combined" },
                  { value:"Selva", label:"Selva" },
                  { value:"Akshaya", label:"Akshaya" },
                ].map(v => (
                  <button key={v.value} onClick={() => setViewMode(v.value)} style={btnStyle(viewMode === v.value)}>{v.label}</button>
                ))}
              </div>
              <button onClick={exportCSV} style={{
                padding:"8px 16px", background:"transparent", border:`1px solid ${theme.border}`,
                borderRadius:"8px", color: theme.textDim, fontSize:"12px", cursor:"pointer", fontWeight:600
              }}>Export CSV ↓</button>
            </div>

            <SummaryCards incomeData={incomeData} rsuData={rsuData} fy={fy} />
            <IncomeTable incomeData={incomeData} rsuData={rsuData} fy={fy} viewMode={viewMode} />

            {/* Monthly Data Entry */}
            <div style={{ marginTop:"24px" }}>
              <h3 style={{ fontSize:"14px", fontWeight:700, color: theme.text, marginBottom:"12px" }}>Enter Monthly Income</h3>
              <div style={{ display:"flex", gap:"8px", flexWrap:"wrap", marginBottom:"16px" }}>
                <select value={editPerson} onChange={e => setEditPerson(e.target.value)} style={selectStyle}>
                  {PERSONS.map(p => <option key={p} value={p}>{p} ({EMPLOYER[p]})</option>)}
                </select>
                <div style={{ display:"flex", gap:"4px", padding:"4px", background: theme.card, borderRadius:"10px", overflowX:"auto" }}>
                  {MONTHS.map((m, i) => {
                    const hasData = incomeData?.[fy]?.[editPerson]?.[i]?.take_home;
                    return (
                      <button
                        key={m}
                        onClick={() => setEditMonth(editMonth === i ? null : i)}
                        style={{
                          ...btnStyle(editMonth === i),
                          padding:"6px 10px", fontSize:"12px", position:"relative",
                          ...(hasData && editMonth !== i ? { color: theme.accent } : {})
                        }}
                      >
                        {m}
                        {hasData && <span style={{ position:"absolute", top:2, right:2, width:4, height:4, borderRadius:"50%", background: theme.accent }} />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {editMonth !== null && (
                <div style={{ background: theme.card, borderRadius:"12px", padding:"20px", border:`1px solid ${theme.border}` }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"16px" }}>
                    <h4 style={{ margin:0, fontSize:"14px", color: theme.text }}>
                      <span style={{ color: editPerson === "Selva" ? theme.selva : theme.akshaya, fontWeight:700 }}>{editPerson}</span>
                      {" · "}{MONTH_FULL[editMonth]} Income
                    </h4>
                  </div>
                  <MonthlyInput
                    data={incomeData?.[fy]?.[editPerson]?.[editMonth] || {}}
                    onChange={(data) => updateMonthlyIncome(editPerson, editMonth, data)}
                    person={editPerson}
                    monthIdx={editMonth}
                  />
                  <AdHocItems
                    items={incomeData?.[fy]?.[editPerson]?.[editMonth]?.ad_hoc || []}
                    onChange={(items) => {
                      const current = incomeData?.[fy]?.[editPerson]?.[editMonth] || {};
                      updateMonthlyIncome(editPerson, editMonth, { ...current, ad_hoc: items });
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── RSU TAB ─── */}
        {activeTab === "rsu" && (
          <div>
            <RsuForm onAdd={addRsuEvent} liveData={liveData} />
            <div style={{ display:"flex", gap:"8px", marginBottom:"16px", flexWrap:"wrap", alignItems:"center" }}>
              <span style={{ fontSize:"11px", color: theme.textMuted, fontWeight:600 }}>FILTER:</span>
              <select value={rsuFilterPerson} onChange={e => setRsuFilterPerson(e.target.value)} style={selectStyle}>
                <option value="all">All Persons</option>
                {PERSONS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <select value={rsuFilterStock} onChange={e => setRsuFilterStock(e.target.value)} style={selectStyle}>
                <option value="all">All Stocks</option>
                {STOCKS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <RsuTable events={rsuData[fy] || []} onDelete={deleteRsuEvent} filterPerson={rsuFilterPerson} filterStock={rsuFilterStock} />
          </div>
        )}

        {/* ─── PLACEHOLDER TABS ─── */}
        {activeTab === "investments" && (
          <PlaceholderTab title="Investments" description="Track EPF corpus, ESPP purchases, debt funds (Edelweiss, PPDAAF), Baby Education Fund, and PPF with target vs actual tracking." icon="📊" />
        )}
        {activeTab === "expenses" && (
          <PlaceholderTab title="Expenses" description="Monthly budget vs actuals across categories: Rent, Groceries, Shopping, Parents, Travel, Baby, and more with colour-coded budget indicators." icon="💸" />
        )}
        {activeTab === "portfolio" && (
          <PlaceholderTab title="Portfolio" description="Live valuation of MSFT & NVDA holdings, EPF balance, debt fund balances, and total corpus view with equity vs debt breakdown." icon="💼" />
        )}
      </div>

      {/* Footer */}
      <div style={{ padding:"16px 20px", borderTop:`1px solid ${theme.border}`, textAlign:"center", color: theme.textMuted, fontSize:"11px" }}>
        Family Finance Tracker v1.0 · Data persists across sessions
      </div>
    </div>
  );
}
