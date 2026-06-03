import { useState } from "react";
import { T } from "../../lib/theme";
import { DEFAULT_ASSUMPTIONS } from "./engine";
import CorpusTracker from "./CorpusTracker";
import HomeLoanCalc   from "./HomeLoanCalc";
import LifetimePlan   from "./LifetimePlan";

const GLOSSARY = [
  { term: "Corpus", def: "The total investable wealth earmarked for retirement — excludes primary home and consumables." },
  { term: "SIP (Systematic Investment Plan)", def: "Fixed monthly investment into a mutual fund. Automates rupee-cost averaging." },
  { term: "XIRR", def: "Extended Internal Rate of Return — the annualised return accounting for irregular cash flows. More accurate than simple CAGR for real investment histories." },
  { term: "EMI (Equated Monthly Instalment)", def: "Fixed monthly payment covering both principal and interest on a loan." },
  { term: "Prepayment", def: "Paying extra principal beyond the EMI to reduce outstanding balance and total interest." },
  { term: "Down Payment", def: "The upfront cash component of a home purchase. Higher down payment → lower loan → lower EMI." },
  { term: "Stamp Duty", def: "State government tax on property registration, typically 5–8% in most Indian states." },
  { term: "EPF (Employees' Provident Fund)", def: "Mandatory retirement saving — employer + employee each contribute 12% of basic salary monthly." },
  { term: "PPF (Public Provident Fund)", def: "Government-backed 15-year savings scheme offering ~7.1% tax-free returns (rate changes quarterly)." },
  { term: "Pre-retirement Return", def: "The assumed annualised return on your investment portfolio until you retire. Typically 10–12% for equity-heavy portfolios." },
  { term: "Growing Annuity", def: "A series of payments that grows at a fixed rate each period. Used here to model SIPs that increase every year." },
  { term: "Organic Corpus", def: "The retirement corpus you'd accumulate from existing investments growing at the assumed return rate, without any additional SIP contributions." },
  { term: "Verdict: Does Not Close", def: "The plan fails if your salary + RSU together cannot cover expenses + EMI + SIPs in at least one year of the plan horizon. Usually fixed by increasing income growth rate, delaying retirement, or reducing target lifestyle." },
  { term: "RSU (Restricted Stock Units)", def: "Company stock granted as compensation that vests over time. Treated as variable, post-tax income in this planner." },
  { term: "Net Worth", def: "Portfolio value + home value − outstanding loan balance. This is what you actually own." },
  { term: "CAGR", def: "Compound Annual Growth Rate — the constant annual return that would produce the same ending value from the starting value." },
];

function GlossaryTab() {
  return (
    <div>
      <p style={{ fontSize: "13px", color: T.textMuted, marginBottom: "20px", lineHeight: 1.6 }}>
        Key terms, formulas, and model assumptions used throughout this planner.
        All numbers are post-tax unless explicitly stated. Currency is always INR.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(320px,1fr))", gap: "12px" }}>
        {GLOSSARY.map(g => (
          <div key={g.term} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: "10px", padding: "14px 16px" }}>
            <div style={{ fontSize: "13px", fontWeight: 700, color: T.accent, marginBottom: "5px" }}>{g.term}</div>
            <div style={{ fontSize: "12px", color: T.textDim, lineHeight: 1.55 }}>{g.def}</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: "24px", background: T.surface, border: `1px solid ${T.border}`, borderRadius: "10px", padding: "16px" }}>
        <div style={{ fontSize: "12px", fontWeight: 700, color: T.text, marginBottom: "8px" }}>Model limitations</div>
        <ul style={{ fontSize: "12px", color: T.textMuted, margin: 0, paddingLeft: "20px", lineHeight: 1.8 }}>
          <li>All returns are nominal (before inflation). For inflation-adjusted figures, subtract ~6%.</li>
          <li>Tax regime, LTCG, and dividend taxation are NOT modelled — use post-tax income and expected post-tax returns.</li>
          <li>RSU grants are assumed to vest linearly and at predictable value — adjust for black-out / lock-in periods.</li>
          <li>Home appreciation is modelled as a constant rate — actual appreciation is lumpy and location-dependent.</li>
          <li>This planner is for illustrative purposes only and does not constitute financial advice.</li>
        </ul>
      </div>
    </div>
  );
}

const SUB_TABS = [
  { id: "corpus",   label: "Corpus Journey" },
  { id: "homeloan", label: "Home Loan" },
  { id: "lifetime", label: "Lifetime Plan" },
  { id: "glossary", label: "Glossary" },
];

export default function RetirementTab({ retirementData, onUpdate, holdingsData, liveData, rsuData, incomeData, investmentsData }) {
  const [subTab, setSubTab] = useState("corpus");

  // Financial plan state
  const plan = retirementData?.plan || DEFAULT_ASSUMPTIONS;
  const updatePlan = (next) => onUpdate({ ...retirementData, plan: next });

  return (
    <div>
      {/* Sub-tab nav */}
      <div style={{ display: "flex", gap: "4px", marginBottom: "24px", borderBottom: `1px solid ${T.border}`,
        overflowX: "auto", paddingBottom: "0" }}>
        {SUB_TABS.map(st => (
          <button key={st.id} onClick={() => setSubTab(st.id)} style={{
            padding: "10px 20px", border: "none", borderRadius: "8px 8px 0 0",
            fontSize: "13px", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap",
            background: subTab === st.id ? T.card : "transparent",
            color: subTab === st.id ? T.accent : T.textDim,
            borderBottom: subTab === st.id ? `2px solid ${T.accent}` : "2px solid transparent",
          }}>{st.label}</button>
        ))}
      </div>

      {/* Section header */}
      <div style={{ marginBottom: "20px" }}>
        {subTab === "corpus" && (
          <>
            <h2 style={{ margin: "0 0 4px", fontSize: "18px", fontWeight: 800, color: T.text }}>Corpus Journey</h2>
            <p style={{ margin: 0, fontSize: "12px", color: T.textMuted }}>
              Quarter-by-quarter retirement corpus tracker · Apr 2024 (age 26) → Apr 2026 (age 28)
            </p>
          </>
        )}
        {subTab === "homeloan" && (
          <>
            <h2 style={{ margin: "0 0 4px", fontSize: "18px", fontWeight: 800, color: T.text }}>Home Loan Calculator</h2>
            <p style={{ margin: 0, fontSize: "12px", color: T.textMuted }}>
              Model upfront costs, EMI, and surplus for different down-payment and tenure scenarios
            </p>
          </>
        )}
        {subTab === "lifetime" && (
          <>
            <h2 style={{ margin: "0 0 4px", fontSize: "18px", fontWeight: 800, color: T.text }}>Lifetime Financial Plan</h2>
            <p style={{ margin: 0, fontSize: "12px", color: T.textMuted }}>
              Does salary cover EMI + expenses + SIPs every year until retirement?
            </p>
          </>
        )}
        {subTab === "glossary" && (
          <>
            <h2 style={{ margin: "0 0 4px", fontSize: "18px", fontWeight: 800, color: T.text }}>Glossary & Model Notes</h2>
            <p style={{ margin: 0, fontSize: "12px", color: T.textMuted }}>Definitions, formulas, and model limitations</p>
          </>
        )}
      </div>

      {subTab === "corpus"   && <CorpusTracker retirementData={retirementData} onUpdate={onUpdate} holdingsData={holdingsData} liveData={liveData} rsuData={rsuData} incomeData={incomeData} investmentsData={investmentsData} />}
      {subTab === "homeloan" && <HomeLoanCalc plan={plan} onUpdatePlan={updatePlan} />}
      {subTab === "lifetime" && <LifetimePlan plan={plan} onUpdatePlan={updatePlan} />}
      {subTab === "glossary" && <GlossaryTab />}
    </div>
  );
}
