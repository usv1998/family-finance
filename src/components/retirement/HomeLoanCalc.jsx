import { useMemo } from "react";
import { T } from "../../lib/theme";
import { computeHomeLoan, fmtCr, LAKH, CRORE } from "./engine";

function SliderRow({ label, value, min, max, step, unit, onChange, fmt }) {
  const display = fmt ? fmt(value) : value;
  return (
    <div style={{ marginBottom: "14px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
        <span style={{ fontSize: "12px", color: T.textDim }}>{label}</span>
        <span style={{ fontSize: "13px", fontWeight: 700, color: T.accent, fontFamily: "'JetBrains Mono',monospace" }}>{display}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: "100%", accentColor: T.accent }} />
    </div>
  );
}

function MetricCard({ label, value, sub, featured }) {
  return (
    <div style={{
      background: featured ? `linear-gradient(135deg,rgba(34,197,94,0.1),${T.card})` : T.card,
      border: `1px solid ${featured ? T.accent : T.border}`,
      borderRadius: "12px", padding: "16px",
    }}>
      <div style={{ fontSize: "11px", color: T.textMuted, marginBottom: "4px" }}>{label}</div>
      <div style={{ fontSize: "18px", fontWeight: 800, color: featured ? T.accent : T.text, fontFamily: "'JetBrains Mono',monospace" }}>{value}</div>
      {sub && <div style={{ fontSize: "11px", color: T.textMuted, marginTop: "2px" }}>{sub}</div>}
    </div>
  );
}

function BalanceCurve({ curve }) {
  if (!curve || curve.length < 2) return null;
  const W = 600, H = 160, PAD = 40;
  const max = curve[0] || 1;
  const pts = curve.map((v, i) => [PAD + (i / (curve.length - 1)) * (W - PAD * 2), H - PAD - (v / max) * (H - PAD * 1.2)]);
  const pathD = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0]},${p[1]}`).join(" ");
  const areaD = `${pathD} L${pts[pts.length - 1][0]},${H - PAD} L${PAD},${H - PAD} Z`;

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`}>
      <defs>
        <linearGradient id="loanGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={T.blue} stopOpacity="0.4" />
          <stop offset="100%" stopColor={T.blue} stopOpacity="0.03" />
        </linearGradient>
      </defs>
      {[0, 0.25, 0.5, 0.75, 1].map(pct => {
        const y = H - PAD - pct * (H - PAD * 1.2);
        return (
          <g key={pct}>
            <line x1={PAD} x2={W - PAD / 2} y1={y} y2={y} stroke={T.border} strokeDasharray="4,4" />
            <text x={PAD - 4} y={y + 4} textAnchor="end" fontSize="9" fill={T.textMuted}>{fmtCr(pct * max)}</text>
          </g>
        );
      })}
      <path d={areaD} fill="url(#loanGrad)" />
      <path d={pathD} stroke={T.blue} strokeWidth="2" fill="none" />
      {pts.map((p, i) => i % 5 === 0 && (
        <text key={i} x={p[0]} y={H - PAD + 14} textAnchor="middle" fontSize="9" fill={T.textMuted}>Yr{i}</text>
      ))}
    </svg>
  );
}

export default function HomeLoanCalc({ plan, onUpdatePlan }) {
  const a   = plan;
  const hl  = useMemo(() => computeHomeLoan(a), [a]);

  const set = (path, val) => {
    const [section, key] = path.split(".");
    onUpdatePlan({ ...a, [section]: { ...a[section], [key]: val } });
  };

  const pctFmt = v => `${(v * 100).toFixed(1)}%`;
  const yrFmt  = v => `${v} yr`;

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(280px,360px) 1fr", gap: "24px" }}>
        {/* Inputs */}
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: "12px", padding: "20px" }}>
          <div style={{ fontSize: "13px", fontWeight: 700, marginBottom: "16px", color: T.text }}>Home Details</div>
          <SliderRow label="Property Value" value={a.home.property_value} min={50 * LAKH} max={10 * CRORE} step={10 * LAKH}
            fmt={fmtCr} onChange={v => set("home.property_value", v)} />
          <SliderRow label="Down Payment" value={a.home.down_payment_pct} min={0.10} max={0.80} step={0.01}
            fmt={pctFmt} onChange={v => set("home.down_payment_pct", v)} />
          <SliderRow label="Stamp Duty" value={a.home.stamp_duty_pct} min={0.03} max={0.10} step={0.005}
            fmt={pctFmt} onChange={v => set("home.stamp_duty_pct", v)} />
          <SliderRow label="Interiors" value={a.home.interiors} min={0} max={50 * LAKH} step={LAKH}
            fmt={fmtCr} onChange={v => set("home.interiors", v)} />
          <SliderRow label="Loan Rate" value={a.home.loan_rate} min={0.065} max={0.13} step={0.0025}
            fmt={v => `${(v * 100).toFixed(2)}%`} onChange={v => set("home.loan_rate", v)} />
          <SliderRow label="Tenure" value={a.home.loan_tenure_years} min={5} max={30} step={1}
            fmt={yrFmt} onChange={v => set("home.loan_tenure_years", v)} />
          <SliderRow label="Annual Prepayment" value={a.home.annual_prepayment} min={0} max={50 * LAKH} step={LAKH}
            fmt={fmtCr} onChange={v => set("home.annual_prepayment", v)} />
        </div>

        {/* Outputs */}
        <div>
          {hl ? (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: "12px", marginBottom: "20px" }}>
                <MetricCard label="Upfront Cash Needed" value={fmtCr(hl.upfront_cash)} featured />
                <MetricCard label="Loan Amount" value={fmtCr(hl.loan_amount)} />
                <MetricCard label="Monthly EMI" value={fmtCr(hl.monthly_emi)} />
                <MetricCard label="EMI as % of Income" value={`${(hl.emi_as_pct_of_income * 100).toFixed(1)}%`}
                  sub={hl.emi_as_pct_of_income > 0.4 ? "⚠ High — consider larger down payment" : "✓ Within safe range"} />
                <MetricCard label="Loan Closes In" value={`${hl.effective_closure_years.toFixed(1)} yr`} />
                <MetricCard label="Total Interest Paid" value={fmtCr(hl.total_interest_paid)} />
                <MetricCard label="Monthly Surplus Yr-1" value={fmtCr(hl.surplus_year_1)}
                  sub={hl.surplus_year_1 < 0 ? "⚠ Negative — adjust" : undefined} />
                <MetricCard label="Monthly Surplus Yr-10" value={fmtCr(hl.surplus_year_10)} />
              </div>
              <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: "12px", padding: "20px" }}>
                <div style={{ fontSize: "13px", fontWeight: 700, marginBottom: "12px", color: T.text }}>Outstanding Loan Balance</div>
                <BalanceCurve curve={hl.balance_curve} />
              </div>
            </>
          ) : (
            <div style={{ color: T.textMuted, textAlign: "center", padding: "60px" }}>
              Set property value to see calculations
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
