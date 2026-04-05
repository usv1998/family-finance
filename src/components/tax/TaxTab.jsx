import { useState, useMemo } from "react";
import { T } from "../../lib/theme";
import { fmtINR } from "../../lib/formatters";
import { PERSONS } from "../../lib/constants";

// ── Tax slab definitions (FY 2025-26) ─────────────────────────────────────────

// New regime: Budget 2025 slabs
const NEW_SLABS = [
  { from:0,        upto:400000,   rate:0    },
  { from:400000,   upto:800000,   rate:0.05 },
  { from:800000,   upto:1200000,  rate:0.10 },
  { from:1200000,  upto:1600000,  rate:0.15 },
  { from:1600000,  upto:2000000,  rate:0.20 },
  { from:2000000,  upto:2400000,  rate:0.25 },
  { from:2400000,  upto:Infinity, rate:0.30 },
];

// Old regime slabs
const OLD_SLABS = [
  { from:0,        upto:250000,   rate:0    },
  { from:250000,   upto:500000,   rate:0.05 },
  { from:500000,   upto:1000000,  rate:0.20 },
  { from:1000000,  upto:Infinity, rate:0.30 },
];

function calcSlabTax(taxable, slabs) {
  let tax = 0;
  for (const s of slabs) {
    if (taxable <= s.from) break;
    tax += (Math.min(taxable, s.upto) - s.from) * s.rate;
  }
  return Math.round(tax);
}

function getSurcharge(tax, income, regime) {
  let rate = 0;
  if      (income > 50_000_000) rate = regime === "new" ? 0.25 : 0.37;
  else if (income > 20_000_000) rate = 0.25;
  else if (income > 10_000_000) rate = 0.15;
  else if (income >  5_000_000) rate = 0.10;
  return Math.round(tax * rate);
}

function computeTax(grossIncome, regime, ded) {
  const stdDed = regime === "new" ? 75_000 : 50_000;
  let taxable = Math.max(0, grossIncome - stdDed);

  if (regime === "old") {
    const dedTotal = Math.min(ded.sec80C, 150_000) + (ded.sec80D || 0) + (ded.hra || 0);
    taxable = Math.max(0, taxable - dedTotal);
  }

  const slabs = regime === "new" ? NEW_SLABS : OLD_SLABS;
  let tax = calcSlabTax(taxable, slabs);

  // 87A rebate
  if (regime === "new"  && taxable <= 1_200_000) tax = 0;       // Budget 2025: full rebate up to ₹12L
  if (regime === "old"  && taxable <= 500_000)   tax = Math.max(0, tax - 12_500);

  const surcharge = getSurcharge(tax, taxable, regime);
  const cess      = Math.round((tax + surcharge) * 0.04);
  const total     = tax + surcharge + cess;
  const effRate   = grossIncome > 0 ? total / grossIncome * 100 : 0;

  // Per-slab breakdown (for display)
  const breakdown = slabs.map(s => {
    if (taxable <= s.from) return null;
    const band  = Math.min(taxable, s.upto) - s.from;
    const tBand = Math.round(band * s.rate);
    if (s.rate === 0) return null;
    return { label:`₹${(s.from/100000).toFixed(0)}L – ${s.upto===Infinity?"above":`₹${(s.upto/100000).toFixed(0)}L`}`, rate:`${s.rate*100}%`, amount:tBand };
  }).filter(Boolean);

  return { tax, surcharge, cess, total, effRate, taxable, breakdown };
}

// ── Auto-fill income from tracked data ───────────────────────────────────────

function extractIncome(person, fy, incomeData, rsuData) {
  let espp = 0, bonus = 0, epf = 0;
  for (let mi = 0; mi < 12; mi++) {
    const d = incomeData?.[fy]?.[person]?.[mi] || {};
    espp  += Number(d.espp || 0);
    epf   += Number(d.epf  || 0);
    bonus += (d.ad_hoc || []).reduce((s, i) => s + Number(i.amount || 0), 0);
  }
  const rsuGross = (rsuData?.[fy] || [])
    .filter(e => e.person === person)
    .reduce((s, e) => s + e.units_vested * e.stock_price_usd * e.usd_inr_rate, 0);
  return { espp: Math.round(espp), bonus: Math.round(bonus), epf: Math.round(epf), rsuGross: Math.round(rsuGross) };
}

// ── UI helpers ────────────────────────────────────────────────────────────────

const NUM_INP_STYLE = {
  width:"100%", padding:"8px 10px",
  background:T.card, border:`1px solid ${T.border}`, borderRadius:"8px",
  color:T.text, fontSize:"13px", outline:"none",
  fontFamily:"'JetBrains Mono',monospace", textAlign:"right",
};

function Row({ label, value, color, bold, indent }) {
  return (
    <div style={{ display:"flex", justifyContent:"space-between", padding:"5px 0",
      borderBottom:`1px solid ${T.border}22`, marginLeft: indent ? "12px" : 0 }}>
      <span style={{ fontSize:"12px", color:indent?T.textMuted:T.textDim }}>{label}</span>
      <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"12px",
        fontWeight:bold?700:400, color:color||T.text }}>{value}</span>
    </div>
  );
}

function RegimeBox({ label, result, isBetter }) {
  return (
    <div style={{ flex:"1 1 200px", padding:"16px", background:T.card, borderRadius:"10px",
      border:`1px solid ${isBetter?T.accent:T.border}`, position:"relative" }}>
      {isBetter && (
        <div style={{ position:"absolute", top:"-10px", left:"50%", transform:"translateX(-50%)",
          background:T.accent, color:T.bg, fontSize:"10px", fontWeight:800,
          padding:"2px 10px", borderRadius:"10px", letterSpacing:"0.5px" }}>RECOMMENDED</div>
      )}
      <div style={{ fontSize:"12px", fontWeight:700, color:T.textDim, marginBottom:"10px" }}>{label}</div>
      <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"24px", fontWeight:800,
        color:isBetter?T.accent:T.textDim, marginBottom:"4px" }}>{fmtINR(result.total)}</div>
      <div style={{ fontSize:"11px", color:T.textMuted, marginBottom:"12px" }}>
        Effective rate: {result.effRate.toFixed(1)}%
      </div>
      <div style={{ fontSize:"11px", color:T.textMuted, marginBottom:"4px" }}>
        Taxable income: <span style={{ color:T.text, fontWeight:600 }}>{fmtINR(result.taxable)}</span>
      </div>
      {result.breakdown.map(b => (
        <div key={b.label} style={{ display:"flex", justifyContent:"space-between", padding:"3px 0",
          borderBottom:`1px solid ${T.border}22` }}>
          <span style={{ fontSize:"11px", color:T.textMuted }}>{b.label} @ {b.rate}</span>
          <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"11px", color:T.text }}>{fmtINR(b.amount)}</span>
        </div>
      ))}
      {result.surcharge > 0 && (
        <div style={{ display:"flex", justifyContent:"space-between", padding:"3px 0" }}>
          <span style={{ fontSize:"11px", color:T.textMuted }}>Surcharge</span>
          <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"11px", color:T.amber }}>{fmtINR(result.surcharge)}</span>
        </div>
      )}
      <div style={{ display:"flex", justifyContent:"space-between", padding:"3px 0" }}>
        <span style={{ fontSize:"11px", color:T.textMuted }}>Health & Ed. Cess (4%)</span>
        <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"11px", color:T.textDim }}>{fmtINR(result.cess)}</span>
      </div>
      <div style={{ borderTop:`2px solid ${T.border}`, marginTop:"8px", paddingTop:"8px",
        display:"flex", justifyContent:"space-between" }}>
        <span style={{ fontSize:"12px", fontWeight:700, color:T.text }}>Total Tax</span>
        <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"13px", fontWeight:800, color:isBetter?T.accent:T.textDim }}>
          {fmtINR(result.total)}
        </span>
      </div>
    </div>
  );
}

// ── PersonCard ────────────────────────────────────────────────────────────────

function PersonCard({ person, fy, incomeData, rsuData }) {
  const auto = useMemo(
    () => extractIncome(person, fy, incomeData, rsuData),
    [person, fy, incomeData, rsuData]
  );

  const personColor = person === "Selva" ? T.selva : T.akshaya;

  // Income inputs
  const [grossSalary, setGrossSalary] = useState(0);
  const [rsuOverride, setRsuOverride] = useState("");   // blank = use auto

  // Old regime deductions
  const [sec80C, setSec80C] = useState(0);
  const [sec80D, setSec80D] = useState(0);
  const [hra,    setHra]    = useState(0);
  const [showDed,setShowDed]= useState(false);

  const rsuIncome  = rsuOverride !== "" ? Number(rsuOverride) : auto.rsuGross;
  const totalGross = Number(grossSalary) + rsuIncome + auto.espp + auto.bonus;

  const ded = { sec80C: Number(sec80C) + auto.epf, sec80D: Number(sec80D), hra: Number(hra) };

  const newResult = useMemo(() => computeTax(totalGross, "new", ded), [totalGross]);
  const oldResult = useMemo(() => computeTax(totalGross, "old", ded), [totalGross, ded.sec80C, ded.sec80D, ded.hra]);

  const newIsBetter = newResult.total <= oldResult.total;
  const saving      = Math.abs(newResult.total - oldResult.total);

  return (
    <div style={{ background:T.surface, borderRadius:"12px", border:`1px solid ${T.border}`, overflow:"hidden", marginBottom:"24px" }}>
      {/* Header */}
      <div style={{ padding:"14px 20px", borderBottom:`1px solid ${T.border}`,
        display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:"8px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
          <div style={{ width:"10px", height:"10px", borderRadius:"50%", background:personColor }}/>
          <span style={{ fontSize:"14px", fontWeight:700, color:personColor }}>{person}</span>
          <span style={{ fontSize:"12px", color:T.textMuted }}>{fy}</span>
        </div>
        {totalGross > 0 && (
          <div style={{ fontSize:"12px", color:T.textMuted }}>
            Save <span style={{ color:T.accent, fontWeight:700 }}>{fmtINR(saving)}</span>{" "}
            by choosing <span style={{ color:T.accent, fontWeight:700 }}>{newIsBetter?"New":"Old"} Regime</span>
          </div>
        )}
      </div>

      <div style={{ display:"flex", gap:"24px", padding:"20px", flexWrap:"wrap" }}>
        {/* Left: Income inputs */}
        <div style={{ flex:"0 0 260px", minWidth:"220px" }}>
          <div style={{ fontSize:"11px", color:T.textMuted, fontWeight:700, letterSpacing:"0.5px", marginBottom:"12px" }}>INCOME</div>
          <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
            <div>
              <label style={{ fontSize:"11px", color:T.textDim, fontWeight:600, display:"block", marginBottom:"4px" }}>
                Gross Salary (pre-tax) — from Form 16
              </label>
              <input type="number" min={0} value={grossSalary||""} placeholder="e.g. 3000000"
                onChange={e=>setGrossSalary(e.target.value)}
                style={NUM_INP_STYLE}/>
            </div>
            <div>
              <label style={{ fontSize:"11px", color:T.textDim, fontWeight:600, display:"block", marginBottom:"4px" }}>
                RSU (gross at vest) <span style={{ color:T.textMuted, fontWeight:400 }}>auto from {fy}</span>
              </label>
              <input type="number" min={0} value={rsuOverride !== "" ? rsuOverride : auto.rsuGross}
                onChange={e=>setRsuOverride(e.target.value)}
                style={NUM_INP_STYLE}/>
            </div>
            {auto.espp > 0 && (
              <Row label="ESPP (auto)" value={fmtINR(auto.espp)} color={T.teal}/>
            )}
            {auto.bonus > 0 && (
              <Row label="Bonus / Ad-hoc (auto)" value={fmtINR(auto.bonus)} color={T.amber}/>
            )}
            <div style={{ borderTop:`2px solid ${T.border}`, paddingTop:"8px" }}>
              <Row label="Total Gross" value={fmtINR(totalGross)} bold color={T.accent}/>
            </div>
          </div>

          {/* Old regime deductions toggle */}
          <div style={{ marginTop:"16px" }}>
            <button onClick={()=>setShowDed(!showDed)}
              style={{ background:"transparent", border:`1px solid ${T.border}`, borderRadius:"8px",
                color:T.textDim, fontSize:"11px", fontWeight:600, padding:"5px 12px", cursor:"pointer", width:"100%" }}>
              {showDed?"▲ Hide":"▼ Old Regime Deductions"}
            </button>
            {showDed && (
              <div style={{ marginTop:"10px", display:"flex", flexDirection:"column", gap:"8px" }}>
                <div>
                  <label style={{ fontSize:"11px", color:T.textDim, fontWeight:600, display:"block", marginBottom:"3px" }}>
                    Sec 80C (max ₹1.5L · EPF ₹{(auto.epf/1000).toFixed(0)}K auto-included)
                  </label>
                  <input type="number" min={0} max={150000} value={sec80C||""} placeholder="other 80C investments"
                    onChange={e=>setSec80C(e.target.value)} style={NUM_INP_STYLE}/>
                </div>
                <div>
                  <label style={{ fontSize:"11px", color:T.textDim, fontWeight:600, display:"block", marginBottom:"3px" }}>
                    Sec 80D (health insurance premium)
                  </label>
                  <input type="number" min={0} value={sec80D||""} placeholder="0"
                    onChange={e=>setSec80D(e.target.value)} style={NUM_INP_STYLE}/>
                </div>
                <div>
                  <label style={{ fontSize:"11px", color:T.textDim, fontWeight:600, display:"block", marginBottom:"3px" }}>
                    HRA Exemption
                  </label>
                  <input type="number" min={0} value={hra||""} placeholder="0"
                    onChange={e=>setHra(e.target.value)} style={NUM_INP_STYLE}/>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Regime comparison */}
        <div style={{ flex:1, minWidth:"300px" }}>
          <div style={{ fontSize:"11px", color:T.textMuted, fontWeight:700, letterSpacing:"0.5px", marginBottom:"12px" }}>REGIME COMPARISON</div>
          {totalGross === 0 ? (
            <div style={{ padding:"40px", textAlign:"center", color:T.textMuted, fontSize:"13px", background:T.card, borderRadius:"10px" }}>
              Enter gross salary above to see tax estimate
            </div>
          ) : (
            <div style={{ display:"flex", gap:"12px", flexWrap:"wrap" }}>
              <RegimeBox label="🆕 New Regime (FY25-26)" result={newResult} isBetter={newIsBetter}/>
              <RegimeBox label="📋 Old Regime"           result={oldResult} isBetter={!newIsBetter}/>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main TaxTab ───────────────────────────────────────────────────────────────

export default function TaxTab({ incomeData, rsuData, fy }) {
  return (
    <div>
      {/* Info banner */}
      <div style={{ padding:"12px 16px", background:T.card, borderRadius:"10px",
        border:`1px solid ${T.border}`, marginBottom:"24px",
        display:"flex", gap:"10px", alignItems:"flex-start" }}>
        <span style={{ fontSize:"16px" }}>ℹ️</span>
        <div style={{ fontSize:"12px", color:T.textMuted, lineHeight:"1.6" }}>
          <strong style={{ color:T.text }}>FY 2025-26 estimates only.</strong>
          {" "}RSU/ESPP/bonus are auto-filled from tracked data.
          Gross salary must be entered manually (see <em>Form 16 Part B → Gross Salary</em>).
          EPF employee contribution is auto-included in 80C for old regime.
          This is an <strong style={{ color:T.amber }}>estimate</strong> — consult a CA for filing.
        </div>
      </div>

      {PERSONS.map(person => (
        <PersonCard key={person} person={person} fy={fy} incomeData={incomeData} rsuData={rsuData}/>
      ))}

      {/* Notes */}
      <div style={{ padding:"12px 16px", background:T.card, borderRadius:"10px",
        border:`1px solid ${T.border}`, fontSize:"11px", color:T.textMuted, lineHeight:"1.8" }}>
        <strong style={{ color:T.textDim, display:"block", marginBottom:"4px" }}>Notes</strong>
        <div>• New regime std. deduction ₹75,000 · Old regime ₹50,000</div>
        <div>• New regime: 87A rebate — zero tax if taxable income ≤ ₹12L (Budget 2025)</div>
        <div>• Old regime: 87A rebate up to ₹12,500 if taxable income ≤ ₹5L</div>
        <div>• Surcharge: 10% (₹50L–1Cr) · 15% (₹1–2Cr) · 25% (₹2Cr+) · New regime capped at 25%</div>
        <div>• Health & Education Cess: 4% on (tax + surcharge)</div>
        <div>• RSU at vest is taxed as salary perquisite; capital gains on sale are separate</div>
      </div>
    </div>
  );
}
