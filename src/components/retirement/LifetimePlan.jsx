import { useState, useMemo, useRef, useCallback } from "react";
import { T } from "../../lib/theme";
import { computeLifetimePlan, computeApproaches, fmtCr, LAKH, CRORE } from "./engine";

const SCENARIOS = [
  { key: "50k",  label: "₹50k/mo",  desc: "Modest retirement" },
  { key: "75k",  label: "₹75k/mo",  desc: "Comfortable" },
  { key: "1L",   label: "₹1L/mo",   desc: "Affluent" },
  { key: "1.5L", label: "₹1.5L/mo", desc: "Wealthy" },
];

function SliderRow({ label, value, min, max, step, fmt, onChange }) {
  return (
    <div style={{ marginBottom: "12px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
        <span style={{ fontSize: "11px", color: T.textDim }}>{label}</span>
        <span style={{ fontSize: "12px", fontWeight: 700, color: T.accent, fontFamily: "'JetBrains Mono',monospace" }}>{fmt(value)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))} style={{ width: "100%", accentColor: T.accent }} />
    </div>
  );
}

function VerdictBanner({ verdict, peak_rsu_pct, peak_rsu_needed }) {
  const cfg = {
    covered_by_salary: { bg: "rgba(34,197,94,0.1)", border: T.accent, color: T.accent, icon: "✓",
      msg: "Your salary alone covers all expenses, EMI, and SIPs every year. No RSU required." },
    covered_with_rsu: { bg: "rgba(59,130,246,0.1)", border: T.blue, color: T.blue, icon: "↑",
      msg: `Plan closes using ${(peak_rsu_pct * 100).toFixed(0)}% of RSU (${fmtCr(peak_rsu_needed)}/yr peak) to bridge the gap.` },
    tight: { bg: "rgba(245,158,11,0.1)", border: T.amber, color: T.amber, icon: "⚠",
      msg: `Tight — you need ${(peak_rsu_pct * 100).toFixed(0)}% of RSU (${fmtCr(peak_rsu_needed)}/yr) to close. Consider reducing expenses or pushing retirement later.` },
    does_not_close: { bg: "rgba(239,68,68,0.1)", border: T.red, color: T.red, icon: "✗",
      msg: `Plan does not close — shortfall exceeds available RSU. Increase salary growth, reduce target corpus, or delay retirement.` },
  }[verdict] || {};

  return (
    <div style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: "10px", padding: "14px 18px",
      display: "flex", gap: "10px", alignItems: "flex-start" }}>
      <span style={{ fontSize: "18px", lineHeight: 1 }}>{cfg.icon}</span>
      <p style={{ margin: 0, fontSize: "13px", color: cfg.color, lineHeight: 1.5 }}>{cfg.msg}</p>
    </div>
  );
}

function LifetimeChart({ yearData, loanStartOffset = 0 }) {
  const [hovered, setHovered] = useState(null); // { idx, x, y, data }
  const svgRef = useRef();

  if (!yearData?.length) return null;
  const W = 720, H = 220, PAD = 50;
  const items = yearData.slice(0, 19);
  const maxV  = Math.max(...items.map(y => Math.max(y.total_outflow_monthly, y.projected_salary_monthly)));
  const xW    = (W - PAD * 2) / items.length;

  const stackOrder = [
    { key: "exp_monthly",            color: T.red,      label: "Expenses" },
    { key: "dp_saving_monthly",      color: "#8B5CF6",  label: "DP Saving" },
    { key: "emi_monthly",            color: T.amber,    label: "EMI" },
    { key: "prepay_monthly",         color: "#F97316",  label: "Prepay" },
    { key: "child_sip_monthly",      color: T.teal,     label: "Child SIP" },
    { key: "retirement_sip_monthly", color: T.blue,     label: "Ret SIP" },
  ];

  const lineY = (v) => H - PAD - (v / maxV) * (H - PAD * 1.3);
  const salaryPts = items.map((y, i) => `${PAD + i * xW + xW / 2},${lineY(y.projected_salary_monthly)}`).join(" ");
  const totalPts  = items.map((y, i) => `${PAD + i * xW + xW / 2},${lineY(y.total_outflow_monthly)}`).join(" ");

  const handleMouseMove = useCallback((e) => {
    const svg  = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    // Map client x to viewBox x
    const scaleX  = W / rect.width;
    const vbX     = (e.clientX - rect.left) * scaleX;
    const idx     = Math.round((vbX - PAD - xW / 2) / xW);
    if (idx < 0 || idx >= items.length) { setHovered(null); return; }
    setHovered({ idx, clientX: e.clientX, clientY: e.clientY, data: items[idx] });
  }, [items, xW]);

  const TIP_W = 210;
  let tipLeft = hovered ? hovered.clientX + 14 : 0;
  let tipTop  = hovered ? hovered.clientY - 10 : 0;
  // Clamp so tooltip doesn't go off the right edge
  if (typeof window !== "undefined" && tipLeft + TIP_W > window.innerWidth - 8) {
    tipLeft = hovered.clientX - TIP_W - 14;
  }

  return (
    <div style={{ position: "relative" }}>
      <svg ref={svgRef} width="100%" viewBox={`0 0 ${W} ${H}`}
        style={{ overflow: "visible", cursor: "crosshair" }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHovered(null)}>

        {/* Grid */}
        {[0, 0.25, 0.5, 0.75, 1].map(pct => {
          const y = lineY(pct * maxV);
          return (
            <g key={pct}>
              <line x1={PAD} x2={W - PAD / 2} y1={y} y2={y} stroke={T.border} strokeDasharray="4,4" />
              <text x={PAD - 4} y={y + 4} textAnchor="end" fontSize="8" fill={T.textMuted}>{fmtCr(pct * maxV)}</text>
            </g>
          );
        })}

        {/* Stacked bars */}
        {items.map((y, i) => {
          const x        = PAD + i * xW;
          const isActive = hovered?.idx === i;
          let yBot = H - PAD;
          return (
            <g key={y.age}>
              {stackOrder.map(s => {
                const v = y[s.key] || 0;
                if (!v) return null;
                const barH = (v / maxV) * (H - PAD * 1.3);
                const barY = yBot - barH;
                yBot -= barH;
                return (
                  <rect key={s.key} x={x + 2} y={barY} width={xW - 4} height={barH}
                    fill={s.color} opacity={isActive ? 1 : 0.75} />
                );
              })}
              {/* Hover highlight overlay */}
              {isActive && (
                <rect x={x + 1} y={lineY(maxV)} width={xW - 2}
                  height={H - PAD - lineY(maxV)}
                  fill="white" opacity="0.06" rx="2" />
              )}
              {i % 3 === 0 && (
                <text x={x + xW / 2} y={H - PAD + 13} textAnchor="middle" fontSize="8" fill={T.textMuted}>{y.age}</text>
              )}
            </g>
          );
        })}

        {/* Loan-start divider: vertical dashed line at the age EMI begins */}
        {loanStartOffset > 0 && loanStartOffset < items.length && (() => {
          const lx = PAD + loanStartOffset * xW;
          const loanAge = items[loanStartOffset]?.age;
          return (
            <g>
              <line x1={lx} x2={lx} y1={lineY(maxV) - 4} y2={H - PAD}
                stroke="#8B5CF6" strokeWidth="1.5" strokeDasharray="5,3" opacity="0.8" />
              <rect x={lx - 30} y={lineY(maxV) - 18} width={60} height={14}
                fill="#8B5CF6" opacity="0.15" rx="3" />
              <text x={lx} y={lineY(maxV) - 7} textAnchor="middle"
                fontSize="8" fontWeight="700" fill="#8B5CF6">
                Loan @ {loanAge}
              </text>
            </g>
          );
        })()}

        {/* Salary line */}
        <polyline points={salaryPts} stroke={T.accent} strokeWidth="2" fill="none" />
        {/* Total outflow (need) dashed line */}
        <polyline points={totalPts} stroke={T.red} strokeWidth="1.5" fill="none" strokeDasharray="4,2" />

        {/* Hovered dot on salary line */}
        {hovered && (() => {
          const cx = PAD + hovered.idx * xW + xW / 2;
          return (
            <>
              <circle cx={cx} cy={lineY(hovered.data.projected_salary_monthly)} r="3.5" fill={T.accent} />
              <circle cx={cx} cy={lineY(hovered.data.total_outflow_monthly)}    r="3.5" fill={T.red} />
            </>
          );
        })()}
      </svg>

      {/* Floating tooltip — rendered outside SVG so it can overflow */}
      {hovered && (
        <div style={{
          position: "fixed", left: tipLeft, top: tipTop,
          background: T.surface, border: `1px solid ${T.borderLight}`,
          borderRadius: "10px", padding: "10px 14px",
          fontSize: "12px", zIndex: 9999, pointerEvents: "none",
          boxShadow: "0 4px 20px rgba(0,0,0,0.5)", minWidth: `${TIP_W}px`,
        }}>
          <div style={{ fontWeight: 700, color: T.accent, marginBottom: "6px", fontSize: "13px" }}>
            Age {hovered.data.age}
          </div>
          {/* Stacked segments */}
          {stackOrder.map(s => {
            const v = hovered.data[s.key] || 0;
            if (!v) return null;
            return (
              <div key={s.key} style={{ display: "flex", justifyContent: "space-between", gap: "12px", marginBottom: "3px" }}>
                <span style={{ display: "flex", alignItems: "center", gap: "5px", color: T.textDim }}>
                  <span style={{ width: "7px", height: "7px", borderRadius: "2px", background: s.color, flexShrink: 0 }} />
                  {s.label}
                </span>
                <span style={{ fontFamily: "'JetBrains Mono',monospace", color: T.text, fontWeight: 600 }}>{fmtCr(v)}/mo</span>
              </div>
            );
          })}
          <div style={{ borderTop: `1px solid ${T.border}`, margin: "6px 0 4px" }} />
          {/* Lines */}
          {[
            { label: "Total Need",   value: hovered.data.total_outflow_monthly,   color: T.red },
            { label: "Salary",       value: hovered.data.projected_salary_monthly, color: T.accent },
            { label: "Gap (needs RSU)", value: hovered.data.gap_monthly,           color: T.amber, hide: !hovered.data.gap_monthly },
          ].filter(r => !r.hide).map(r => (
            <div key={r.label} style={{ display: "flex", justifyContent: "space-between", gap: "12px", marginBottom: "3px" }}>
              <span style={{ color: r.color, fontWeight: 600 }}>{r.label}</span>
              <span style={{ fontFamily: "'JetBrains Mono',monospace", color: r.color, fontWeight: 700 }}>{fmtCr(r.value)}/mo</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ApproachesComparison({ plan }) {
  const [yearN, setYearN] = useState(10);
  const result = useMemo(() => computeApproaches(plan, yearN), [plan, yearN]);

  const colors = { aggressive: T.accent, balanced: T.blue, max_leverage: T.purple };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
        <span style={{ fontSize: "12px", color: T.textDim }}>Compare at year</span>
        <input type="range" min={3} max={25} step={1} value={yearN}
          onChange={e => setYearN(Number(e.target.value))} style={{ accentColor: T.accent }} />
        <span style={{ fontFamily: "'JetBrains Mono',monospace", color: T.accent, fontWeight: 700 }}>Yr {yearN}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: "12px" }}>
        {result.approaches.map(ap => {
          const isWinner = ap.key === result.winner_key;
          const pt = ap.at_year_n;
          return (
            <div key={ap.key} style={{
              background: T.card, border: `1px solid ${isWinner ? colors[ap.key] : T.border}`,
              borderRadius: "12px", padding: "16px", position: "relative",
            }}>
              {isWinner && <div style={{ position: "absolute", top: "-10px", left: "50%", transform: "translateX(-50%)",
                background: colors[ap.key], color: T.bg, fontSize: "10px", fontWeight: 700,
                padding: "2px 10px", borderRadius: "99px" }}>WINNER</div>}
              <div style={{ fontWeight: 700, fontSize: "14px", color: colors[ap.key], marginBottom: "8px" }}>{ap.name}</div>
              <div style={{ fontSize: "11px", color: T.textMuted, marginBottom: "8px" }}>
                {(ap.dp_pct * 100).toFixed(0)}% down · {ap.tenure_years}yr · {fmtCr(ap.annual_prepay)}/yr prepay
              </div>
              {[
                ["Net Worth", pt?.net_worth],
                ["Portfolio", pt?.portfolio],
                ["Home Value", pt?.home_value],
                ["Loan Balance", pt?.loan_balance],
              ].map(([label, val]) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "3px" }}>
                  <span style={{ color: T.textDim }}>{label}</span>
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", color: T.text, fontWeight: 600 }}>{fmtCr(val)}</span>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function LifetimePlan({ plan, onUpdatePlan, onConfirmPlan, confirmedAt }) {
  const [scenario, setScenario] = useState("1L");
  const [subTab, setSubTab]     = useState("lifetime");

  const result = useMemo(() => computeLifetimePlan(plan, scenario), [plan, scenario]);

  const set = (section, key, val) =>
    onUpdatePlan({ ...plan, [section]: { ...plan[section], [key]: val } });

  const pctFmt = v => `${(v * 100).toFixed(1)}%`;
  const yrFmt  = v => `${v} yr`;

  const subTabs = [
    { id: "lifetime", label: "Lifetime Plan" },
    { id: "approaches", label: "Approaches" },
    { id: "assumptions", label: "Assumptions" },
  ];

  return (
    <div>
      {/* Sub-tab bar */}
      <div style={{ display: "flex", gap: "4px", marginBottom: "20px", borderBottom: `1px solid ${T.border}`, paddingBottom: "0" }}>
        {subTabs.map(st => (
          <button key={st.id} onClick={() => setSubTab(st.id)} style={{
            padding: "8px 16px", border: "none", borderRadius: "8px 8px 0 0",
            fontSize: "12px", fontWeight: 600, cursor: "pointer",
            background: subTab === st.id ? T.card : "transparent",
            color: subTab === st.id ? T.accent : T.textDim,
            borderBottom: subTab === st.id ? `2px solid ${T.accent}` : "2px solid transparent",
          }}>{st.label}</button>
        ))}
      </div>

      {subTab === "lifetime" && (
        <div>
          {/* Scenario selector */}
          <div style={{ display: "flex", gap: "8px", marginBottom: "20px", flexWrap: "wrap" }}>
            {SCENARIOS.map(s => (
              <button key={s.key} onClick={() => setScenario(s.key)} style={{
                padding: "8px 16px", borderRadius: "8px", border: `1px solid ${scenario === s.key ? T.accent : T.border}`,
                background: scenario === s.key ? T.accentBg : "transparent",
                color: scenario === s.key ? T.accent : T.textDim,
                fontSize: "12px", fontWeight: 600, cursor: "pointer",
              }}>
                <div>{s.label}</div>
                <div style={{ fontSize: "10px", color: T.textMuted }}>{s.desc}</div>
              </button>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(190px,1fr))", gap: "12px", marginBottom: "20px" }}>
            {[
              { label: `Target Corpus at ${plan.profile.retirement_age}`, value: fmtCr(result.target_corpus), featured: true },
              { label: `Organic Corpus at ${plan.profile.retirement_age}`, value: fmtCr(result.organic_corpus_at_retirement) },
              { label: "First-Year Retirement SIP", value: result.is_overfunded ? "₹0 (over-funded)" : fmtCr(result.retirement_sip_year_1) + "/mo" },
              { label: "Home Loan Starts", value: `Age ${result.loan_start_age}`,
                sub: result.dp_gap > 0
                  ? `DP: ${fmtCr(result.upfront_cash)} · Save ${fmtCr(result.dp_gap)} more`
                  : `DP: ${fmtCr(result.upfront_cash)} · Corpus covers it ✓`,
                highlight: true },
              { label: "Child Education FV Target", value: fmtCr(result.child_sip_fv_target), sub: `in ${plan.child.years_until_college}yr at ${((plan.child.education_inflation ?? 0.08)*100).toFixed(0)}% inflation` },
              { label: "Child SIP Year 1 (step-up)", value: fmtCr(result.child_sip_year_1) + "/mo", sub: `+${((plan.child.sip_growth ?? 0.05)*100).toFixed(0)}%/yr` },
              { label: "Peak Need", value: `${fmtCr(result.summary.peak_min_salary)}/mo at age ${result.summary.peak_age}` },
            ].map((c, i) => (
              <div key={i} style={{
                background: c.featured   ? `linear-gradient(135deg,rgba(34,197,94,0.1),${T.card})`
                          : c.highlight  ? `linear-gradient(135deg,rgba(139,92,246,0.1),${T.card})`
                          : T.card,
                border: `1px solid ${c.featured ? T.accent : c.highlight ? "#8B5CF6" : T.border}`,
                borderRadius: "12px", padding: "16px",
              }}>
                <div style={{ fontSize: "11px", color: T.textMuted, marginBottom: "4px" }}>{c.label}</div>
                <div style={{ fontSize: "15px", fontWeight: 800, fontFamily: "'JetBrains Mono',monospace",
                  color: c.featured ? T.accent : c.highlight ? "#8B5CF6" : T.text }}>{c.value}</div>
                {c.sub && <div style={{ fontSize: "10px", color: T.textMuted, marginTop: "3px" }}>{c.sub}</div>}
              </div>
            ))}
          </div>

          <div style={{ marginBottom: "16px" }}>
            <VerdictBanner verdict={result.verdict} peak_rsu_pct={result.peak_rsu_pct} peak_rsu_needed={result.peak_rsu_needed} />
          </div>

          {/* ── Confirm Plan → sync to Dashboard goals ── */}
          {onConfirmPlan && (
            <div style={{ background:"rgba(99,102,241,0.06)", border:"1px solid rgba(99,102,241,0.25)",
              borderRadius:"12px", padding:"16px 20px", marginBottom:"16px",
              display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:"12px" }}>
              <div>
                <div style={{ fontSize:"13px", fontWeight:700, color:"#818CF8", marginBottom:"4px" }}>
                  Lock in this plan
                </div>
                <div style={{ fontSize:"11px", color:T.textMuted, lineHeight:1.5 }}>
                  Syncs <strong style={{ color:T.textDim }}>Retirement</strong> ({fmtCr(result.target_corpus)}),{" "}
                  <strong style={{ color:T.textDim }}>Child Education</strong> ({fmtCr(result.child_sip_fv_target)}),{" "}
                  <strong style={{ color:T.textDim }}>House Downpayment</strong> ({fmtCr(plan.home?.property_value * (plan.home?.down_payment_pct + (plan.home?.stamp_duty_pct || 0)) + (plan.home?.interiors || 0))}){" "}
                  targets to Dashboard goals.
                </div>
                {confirmedAt && (
                  <div style={{ fontSize:"10px", color:T.textMuted, marginTop:"4px" }}>
                    Last confirmed {new Date(confirmedAt).toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" })}
                  </div>
                )}
              </div>
              <button
                onClick={() => {
                  const retirementYear = new Date().getFullYear() + (plan.profile.retirement_age - plan.profile.current_age);
                  const childCollegeYear = new Date().getFullYear() + plan.child.years_until_college;
                  onConfirmPlan({
                    retirement: {
                      targetAmount: Math.round(result.target_corpus),
                      targetDate: `${retirementYear}-04-01`,
                      monthlySIP: Math.round(result.retirement_sip_year_1),
                    },
                    childEducation: {
                      targetAmount: Math.round(result.child_sip_fv_target),
                      targetDate: `${childCollegeYear}-06-01`,
                      monthlySIP: Math.round(result.child_sip_year_1),
                    },
                    downpayment: {
                      targetAmount: Math.round(
                        plan.home.property_value * (plan.home.down_payment_pct + (plan.home.stamp_duty_pct || 0))
                        + (plan.home.interiors || 0)
                      ),
                      targetDate: `${new Date().getFullYear() + 3}-04-01`,
                    },
                    scenario: scenario,
                    confirmedAt: new Date().toISOString(),
                  });
                }}
                style={{ padding:"10px 22px", background:"#6366F1", border:"none", borderRadius:"8px",
                  color:"#fff", fontSize:"13px", fontWeight:700, cursor:"pointer", flexShrink:0 }}>
                ✓ Confirm Plan
              </button>
            </div>
          )}

          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: "12px", padding: "20px" }}>
            <div style={{ fontSize: "13px", fontWeight: 700, marginBottom: "8px", color: T.text }}>
              Monthly Cashflow Plan (Age {plan.profile.current_age}–{plan.profile.retirement_age - 1})
            </div>
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "12px" }}>
              {[
                { label: "Expenses", color: T.red },
                { label: "DP Saving", color: "#8B5CF6" },
                { label: "EMI", color: T.amber },
                { label: "Child SIP", color: T.teal },
                { label: "Ret SIP", color: T.blue },
                { label: "Salary (line)", color: T.accent },
                { label: "Need (dashed)", color: T.red },
              ].map(l => (
                <div key={l.label} style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "11px", color: T.textDim }}>
                  <span style={{ width: "8px", height: "8px", borderRadius: "2px", background: l.color }} />{l.label}
                </div>
              ))}
            </div>
            <LifetimeChart yearData={result.year_data} loanStartOffset={result.loan_start_offset} />
          </div>
        </div>
      )}

      {subTab === "approaches" && (
        <ApproachesComparison plan={plan} />
      )}

      {subTab === "assumptions" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: "20px" }}>
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: "12px", padding: "20px" }}>
            <div style={{ fontSize: "13px", fontWeight: 700, marginBottom: "14px", color: T.text }}>Profile</div>
            <SliderRow label="Current Age" value={plan.profile.current_age} min={22} max={50} step={1}
              fmt={v => `${v} yrs`} onChange={v => set("profile", "current_age", v)} />
            <SliderRow label="Retirement Age" value={plan.profile.retirement_age} min={35} max={65} step={1}
              fmt={v => `${v} yrs`} onChange={v => set("profile", "retirement_age", v)} />
          </div>
          {/* Home Purchase — loan timing + property details */}
          <div style={{ background: T.card, border: `1px solid #8B5CF644`, borderRadius: "12px", padding: "20px" }}>
            <div style={{ fontSize: "13px", fontWeight: 700, marginBottom: "4px", color: T.text }}>Home Purchase</div>
            <div style={{ fontSize: "11px", color: T.textMuted, marginBottom: "14px", lineHeight: 1.4 }}>
              Before loan start: only Child SIP + Retirement SIP run.
              Salary surplus during this phase saves for the downpayment.
            </div>
            <SliderRow label="Home Loan Start Age" value={plan.home.loan_start_age ?? plan.profile.current_age}
              min={plan.profile.current_age} max={plan.profile.retirement_age - 5} step={1}
              fmt={v => `${v} yrs`} onChange={v => set("home", "loan_start_age", v)} />
            <SliderRow label="Property Value" value={plan.home.property_value} min={50 * LAKH} max={10 * CRORE} step={10 * LAKH}
              fmt={fmtCr} onChange={v => set("home", "property_value", v)} />
            <SliderRow label="Down Payment %" value={plan.home.down_payment_pct} min={0.10} max={0.60} step={0.05}
              fmt={v => `${(v * 100).toFixed(0)}%`} onChange={v => set("home", "down_payment_pct", v)} />
            <SliderRow label="Loan Tenure" value={plan.home.loan_tenure_years} min={5} max={30} step={1}
              fmt={v => `${v} yr`} onChange={v => set("home", "loan_tenure_years", v)} />
            <SliderRow label="Loan Rate" value={plan.home.loan_rate} min={0.065} max={0.12} step={0.0025}
              fmt={pctFmt} onChange={v => set("home", "loan_rate", v)} />
            <SliderRow label="Annual Prepayment" value={plan.home.annual_prepayment} min={0} max={50 * LAKH} step={LAKH}
              fmt={fmtCr} onChange={v => set("home", "annual_prepayment", v)} />
          </div>
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: "12px", padding: "20px" }}>
            <div style={{ fontSize: "13px", fontWeight: 700, marginBottom: "14px", color: T.text }}>Income</div>
            <SliderRow label="Monthly Take-home" value={plan.income.salary_monthly} min={LAKH} max={20 * LAKH} step={10000}
              fmt={fmtCr} onChange={v => set("income", "salary_monthly", v)} />
            <SliderRow label="Salary Growth" value={plan.income.salary_growth} min={0.03} max={0.25} step={0.01}
              fmt={pctFmt} onChange={v => set("income", "salary_growth", v)} />
            <SliderRow label="RSU Annual (post-tax)" value={plan.income.rsu_annual_post_tax} min={0} max={2 * CRORE} step={LAKH}
              fmt={fmtCr} onChange={v => set("income", "rsu_annual_post_tax", v)} />
          </div>
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: "12px", padding: "20px" }}>
            <div style={{ fontSize: "13px", fontWeight: 700, marginBottom: "14px", color: T.text }}>Expenses</div>
            <SliderRow label="Monthly Expenses" value={plan.expenses.monthly} min={30000} max={10 * LAKH} step={10000}
              fmt={fmtCr} onChange={v => set("expenses", "monthly", v)} />
            <SliderRow label="Expense Growth" value={plan.expenses.growth} min={0.04} max={0.15} step={0.005}
              fmt={pctFmt} onChange={v => set("expenses", "growth", v)} />
          </div>
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: "12px", padding: "20px" }}>
            <div style={{ fontSize: "13px", fontWeight: 700, marginBottom: "4px", color: T.text }}>Starting Position</div>
            <div style={{ fontSize: "11px", color: T.textMuted, marginBottom: "14px", lineHeight: 1.4 }}>
              Split your current liquid corpus between retirement and home downpayment.
              Both portions grow at the pre-retirement return until they're needed.
            </div>
            <SliderRow label="Corpus → Retirement"
              value={plan.starting_position.corpus_for_retirement ?? 40 * LAKH}
              min={0} max={5 * CRORE} step={LAKH}
              fmt={fmtCr} onChange={v => set("starting_position", "corpus_for_retirement", v)} />
            <SliderRow label="Corpus → Home DP"
              value={plan.starting_position.corpus_for_dp ?? 10 * LAKH}
              min={0} max={5 * CRORE} step={LAKH}
              fmt={fmtCr} onChange={v => set("starting_position", "corpus_for_dp", v)} />
            <SliderRow label="EPF / PPF (→ Retirement)"
              value={plan.starting_position.epf_ppf ?? 0}
              min={0} max={CRORE} step={LAKH}
              fmt={fmtCr} onChange={v => set("starting_position", "epf_ppf", v)} />
          </div>
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: "12px", padding: "20px" }}>
            <div style={{ fontSize: "13px", fontWeight: 700, marginBottom: "14px", color: T.text }}>Retirement</div>
            <SliderRow label="Pre-retirement Return" value={plan.retirement.pre_retirement_return} min={0.06} max={0.20} step={0.005}
              fmt={pctFmt} onChange={v => set("retirement", "pre_retirement_return", v)} />
            <SliderRow label="SIP Growth Rate" value={plan.retirement.sip_growth} min={0.02} max={0.15} step={0.005}
              fmt={pctFmt} onChange={v => set("retirement", "sip_growth", v)} />
          </div>
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: "12px", padding: "20px" }}>
            <div style={{ fontSize: "13px", fontWeight: 700, marginBottom: "14px", color: T.text }}>Child Education</div>
            <SliderRow label="Education Goal (present value today)" value={plan.child.education_target_pv ?? plan.child.education_target ?? CRORE}
              min={LAKH * 10} max={5 * CRORE} step={LAKH * 5}
              fmt={fmtCr} onChange={v => set("child", "education_target_pv", v)} />
            <SliderRow label="Education Inflation" value={plan.child.education_inflation ?? 0.08} min={0.04} max={0.15} step={0.005}
              fmt={pctFmt} onChange={v => set("child", "education_inflation", v)} />
            <SliderRow label="Years to College" value={plan.child.years_until_college} min={1} max={22} step={1}
              fmt={yrFmt} onChange={v => set("child", "years_until_college", v)} />
            <SliderRow label="Expected Return (equity)" value={plan.child.expected_return} min={0.06} max={0.18} step={0.005}
              fmt={pctFmt} onChange={v => set("child", "expected_return", v)} />
            <SliderRow label="SIP Annual Step-up" value={plan.child.sip_growth ?? 0.05} min={0.0} max={0.15} step={0.005}
              fmt={pctFmt} onChange={v => set("child", "sip_growth", v)} />
          </div>
        </div>
      )}
    </div>
  );
}
