import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { T } from "../../lib/theme";
import { fmtINR, getCurrentFY, getCurrentMonthIdx, getEsspINR } from "../../lib/formatters";
import { PERSONS, MONTHS, MONTH_FULL } from "../../lib/constants";
import { getDerivedHoldings } from "../../lib/derivedHoldings";
import { fetchAllPricesWithChange, getCurrentValueINR, calcFDValue } from "../../lib/priceService";
import { getUpcomingVests } from "../../lib/grantUtils";
import { DEFAULT_CATEGORIES } from "../expenses/DailyExpensesTab";

// ── Income timing helper ──────────────────────────────────────────────────────
// Salary is paid at end of month M and funds month M+1's expenses.
// Returns the FY + month-index of the previous month.
function prevMonthFY(mi, fy) {
  if (mi === 0) {
    const fyYear = parseInt(fy.slice(2, 6), 10);
    return { prevMi: 11, prevFY: `FY${fyYear - 1}-${String(fyYear).slice(2)}` };
  }
  return { prevMi: mi - 1, prevFY: fy };
}

// ── formatters ────────────────────────────────────────────────────────────────

function fmtL(n) {
  if (!n && n !== 0) return "—";
  const abs = Math.abs(n);
  const sign = n < 0 ? "−" : "";
  if (abs >= 1e7) return `${sign}₹${(abs / 1e7).toFixed(2)}Cr`;
  if (abs >= 1e5) return `${sign}₹${(abs / 1e5).toFixed(1)}L`;
  if (abs >= 1e3) return `${sign}₹${Math.round(abs / 1000)}K`;
  return `${sign}₹${Math.round(abs)}`;
}

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"2-digit" });
}

// ── NW Sparkline ──────────────────────────────────────────────────────────────

function NwSparkline({ history }) {
  if (!history?.length) return null;
  const pts = history.slice(-12);
  if (pts.length < 2) return null;

  const W = 320, H = 52, padX = 4, padY = 6;
  const values = pts.map(p => p.value);
  const minV   = Math.min(...values);
  const maxV   = Math.max(...values);
  const range  = maxV - minV || 1;

  const toX = (i) => padX + (i / (pts.length - 1)) * (W - padX * 2);
  const toY = (v) => H - padY - ((v - minV) / range) * (H - padY * 2);

  const linePts = pts.map((p, i) => `${toX(i)},${toY(p.value)}`).join(" ");
  const areaPath = `M${toX(0)},${H} ` +
    pts.map((p, i) => `L${toX(i)},${toY(p.value)}`).join(" ") +
    ` L${toX(pts.length - 1)},${H} Z`;

  const last  = pts[pts.length - 1];
  const first = pts[0];
  const up    = last.value >= first.value;

  return (
    <div style={{ position:"relative" }}>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none"
        style={{ display:"block", overflow:"visible" }}>
        <defs>
          <linearGradient id="nwGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={up ? T.accent : T.red} stopOpacity="0.25"/>
            <stop offset="100%" stopColor={up ? T.accent : T.red} stopOpacity="0.02"/>
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#nwGrad)"/>
        <polyline points={linePts} fill="none"
          stroke={up ? T.accent : T.red} strokeWidth="2"
          strokeLinejoin="round" strokeLinecap="round"/>
        {/* Dot at latest value */}
        <circle cx={toX(pts.length-1)} cy={toY(last.value)} r="3.5"
          fill={up ? T.accent : T.red}/>
      </svg>
      {/* Date labels */}
      <div style={{ display:"flex", justifyContent:"space-between", marginTop:"2px" }}>
        <span style={{ fontSize:"9px", color:T.textMuted }}>{fmtDate(first.date)}</span>
        <span style={{ fontSize:"9px", color:T.textMuted }}>{fmtDate(last.date)}</span>
      </div>
    </div>
  );
}

// ── Goal Progress Ring ─────────────────────────────────────────────────────────

function GoalRing({ goal, size = 80 }) {
  const target  = Number(goal.targetAmount) || 0;
  const saved   = Number(goal.savedAmount)  || 0;
  const pct     = target > 0 ? Math.min(100, saved / target * 100) : 0;

  const today    = new Date();
  const dueDate  = goal.targetDate ? new Date(goal.targetDate) : null;
  const daysLeft = dueDate ? Math.ceil((dueDate - today) / 86400000) : null;
  const overdue  = daysLeft !== null && daysLeft < 0;

  const r    = (size / 2) - 7;
  const circ = 2 * Math.PI * r;
  const dash = pct / 100 * circ;

  const color = overdue ? T.red
    : pct >= 100 ? T.accent
    : pct >= 60  ? T.blue
    : T.purple;

  return (
    <div style={{ textAlign:"center", minWidth: size + 20 }}>
      <div style={{ position:"relative", display:"inline-block" }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {/* Track */}
          <circle cx={size/2} cy={size/2} r={r}
            fill="none" stroke={T.border} strokeWidth="5"/>
          {/* Progress */}
          <circle cx={size/2} cy={size/2} r={r}
            fill="none" stroke={color} strokeWidth="5"
            strokeDasharray={`${dash} ${circ - dash}`}
            strokeDashoffset={circ / 4}
            strokeLinecap="round"
            style={{ transition:"stroke-dasharray 0.6s ease" }}/>
          {/* Center % */}
          <text x={size/2} y={size/2 - 4} textAnchor="middle"
            fill={T.text} fontSize={size < 70 ? "10" : "13"} fontWeight="800">
            {Math.round(pct)}%
          </text>
          <text x={size/2} y={size/2 + 10} textAnchor="middle"
            fill={T.textMuted} fontSize="8">
            {pct >= 100 ? "done" : "saved"}
          </text>
        </svg>
      </div>
      <div style={{ fontSize:"11px", fontWeight:700, color:T.text,
        marginTop:"6px", maxWidth: size + 20,
        overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
        {goal.name}
      </div>
      <div style={{ fontSize:"10px", color:T.textMuted, marginTop:"1px" }}>
        {fmtL(saved)} / {fmtL(target)}
      </div>
      {daysLeft !== null && (
        <div style={{ fontSize:"9px", fontWeight:700, marginTop:"2px",
          color: overdue ? T.red : daysLeft <= 60 ? T.amber : T.textMuted }}>
          {overdue ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d left`}
        </div>
      )}
    </div>
  );
}

// ── Month Summary mini card ───────────────────────────────────────────────────

function MonthSummaryCard({ mi, fy, incomeData, txData, expensesData }) {
  const inv       = expensesData?.[fy] || {};
  const txActuals = inv.txActuals || {};
  const actuals   = inv.actuals   || {};
  const isTxMonth = !!txActuals[mi] && Object.keys(txActuals[mi]).length > 0;
  const monthData = isTxMonth ? (txActuals[mi] || {}) : (actuals?.[mi] || {});

  // Use PREVIOUS month's salary — paid at end of month, funds the next month
  const { prevMi, prevFY } = prevMonthFY(mi, fy);
  const takeHome  = PERSONS.reduce((s, p) =>
    s + (Number(incomeData?.[prevFY]?.[p]?.[prevMi]?.take_home) || 0), 0);
  const epf       = PERSONS.reduce((s, p) =>
    s + (Number(incomeData?.[prevFY]?.[p]?.[prevMi]?.epf) || 0), 0);
  const totalIncome = takeHome + epf;
  const totalSpent  = Object.values(monthData).reduce((s, v) => s + Number(v), 0);
  const saved       = totalIncome - totalSpent;
  const savingsRate = totalIncome > 0 ? saved / totalIncome * 100 : null;
  const incomeSrcLabel = MONTH_FULL[prevMi]; // e.g. "May salary funds June"

  // Spending pace for current month
  const today      = new Date().toISOString().slice(0, 10);
  const curMonth   = today.slice(0, 7);
  const selMonthStr = (() => {
    // convert FY month idx back to calendar month string
    const fyYear = parseInt(fy.slice(2, 6), 10);
    const calMon = mi < 9 ? mi + 4 : mi - 8; // Apr=0→4, Mar=11→3
    const calYear = calMon >= 4 ? fyYear : fyYear + 1;
    return `${calYear}-${String(calMon).padStart(2,"0")}`;
  })();
  const isCurrent = selMonthStr === curMonth;

  // Spending pace
  const dayOfMonth  = isCurrent ? parseInt(today.slice(8, 10), 10) : null;
  const daysInMonth = dayOfMonth
    ? new Date(parseInt(selMonthStr.slice(0,4)), parseInt(selMonthStr.slice(5,7)), 0).getDate()
    : null;
  const pctDay   = dayOfMonth && daysInMonth ? dayOfMonth / daysInMonth : null;
  const projected = dayOfMonth && totalSpent > 0
    ? Math.round(totalSpent / dayOfMonth * daysInMonth) : null;
  const pctSpend = projected && totalIncome > 0 ? projected / totalIncome : null;

  const rateColor = savingsRate == null ? T.textDim
    : savingsRate >= 30 ? T.accent
    : savingsRate >= 15 ? T.amber
    : T.red;

  return (
    <div style={{ background:T.surface, borderRadius:"16px",
      border:`1px solid ${T.border}`, padding:"18px", height:"100%" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:"14px" }}>
        <div style={{ fontSize:"10px", color:T.textMuted, fontWeight:700, letterSpacing:"0.6px" }}>
          {MONTH_FULL[mi].toUpperCase()} {isCurrent ? `· Day ${dayOfMonth} of ${daysInMonth}` : ""}
        </div>
        <div style={{ fontSize:"9px", color:T.textMuted }}>
          income from {incomeSrcLabel}
        </div>
      </div>

      {/* Income / Spent / Saved row */}
      <div style={{ display:"flex", gap:"0", borderRadius:"10px",
        overflow:"hidden", border:`1px solid ${T.border}`, marginBottom:"12px" }}>
        {[
          { label:"Available", value:totalIncome, color:T.blue,
            note: totalIncome > 0 ? `${incomeSrcLabel} salary` : "no data" },
          { label:"Spent",  value:totalSpent,  color:T.amber },
          { label:"Saved",  value:Math.abs(saved), color:saved>=0?T.accent:T.red,
            prefix: saved < 0 ? "−" : "" },
        ].map((item, i) => (
          <div key={item.label} style={{
            flex:1, padding:"10px 6px", textAlign:"center",
            borderRight: i < 2 ? `1px solid ${T.border}` : "none",
            background: i === 2 && saved >= 0 ? `${T.accent}08` : "transparent",
          }}>
            <div style={{ fontSize:"8px", color:T.textMuted, fontWeight:700,
              letterSpacing:"0.4px", marginBottom:"3px" }}>{item.label.toUpperCase()}</div>
            <div style={{ fontFamily:"'JetBrains Mono',monospace",
              fontSize:"13px", fontWeight:800, color:item.color, lineHeight:1 }}>
              {item.value ? `${item.prefix||""}${fmtL(item.value)}` : "—"}
            </div>
            {item.note && (
              <div style={{ fontSize:"8px", color:T.textMuted, marginTop:"2px" }}>
                {item.note}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Savings rate */}
      {savingsRate !== null && (
        <div style={{ marginBottom:"10px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"4px" }}>
            <span style={{ fontSize:"10px", color:T.textMuted }}>Savings rate</span>
            <span style={{ fontSize:"11px", fontWeight:800, color:rateColor,
              fontFamily:"'JetBrains Mono',monospace" }}>
              {Math.round(savingsRate)}%
            </span>
          </div>
          <div style={{ height:"4px", background:T.border, borderRadius:"2px", overflow:"hidden" }}>
            <div style={{ height:"100%",
              width:`${Math.max(0, Math.min(100, savingsRate))}%`,
              background:rateColor, borderRadius:"2px" }}/>
          </div>
        </div>
      )}

      {/* Spending pace bar (current month only) */}
      {isCurrent && pctDay && totalSpent > 0 && (
        <div>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"4px" }}>
            <span style={{ fontSize:"10px", color:T.textMuted }}>Spending pace</span>
            {projected && (
              <span style={{ fontSize:"10px", color:T.textDim }}>
                projected {fmtL(projected)}
              </span>
            )}
          </div>
          <div style={{ height:"4px", background:T.border, borderRadius:"2px",
            overflow:"hidden", position:"relative" }}>
            {/* Days elapsed (dim) */}
            <div style={{ position:"absolute", left:0, top:0, bottom:0,
              width:`${pctDay * 100}%`, background:`${T.blue}35`, borderRadius:"2px" }}/>
            {/* Money spent vs income */}
            {pctSpend && (
              <div style={{ position:"absolute", left:0, top:0, bottom:0,
                width:`${Math.min(100, pctSpend * 100)}%`,
                background: pctSpend > 0.9 ? T.amber : T.blue,
                borderRadius:"2px" }}/>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── RSU Vest Card ─────────────────────────────────────────────────────────────

function VestCard({ vest, rsuGrants, liveData }) {
  const grant     = (rsuGrants||[]).find(g => g.grant_id === vest.grantId);
  const taxPct    = grant?.tax_pct ?? 35;
  const livePrice = liveData?.[vest.stock] ?? 0;
  const usdinr    = liveData?.USDINR ?? 85;
  const netUnits  = Math.round(vest.units * (1 - taxPct / 100));
  const estINR    = livePrice > 0 ? Math.round(netUnits * livePrice * usdinr) : null;
  const daysAway  = Math.ceil((new Date(vest.vest_date) - Date.now()) / 86400000);

  const personCol = vest.person === "Selva" ? T.selva : T.akshaya;
  const urgent    = daysAway <= 30;

  return (
    <div style={{
      background:T.card, borderRadius:"12px",
      border:`1px solid ${urgent ? T.amber + "55" : T.border}`,
      padding:"14px 16px",
      display:"flex", alignItems:"center", gap:"14px",
    }}>
      {/* Stock badge */}
      <div style={{
        width:"44px", height:"44px", borderRadius:"10px", flexShrink:0,
        background: vest.stock === "MSFT" ? `${T.selva}20` : `${T.akshaya}20`,
        display:"flex", alignItems:"center", justifyContent:"center",
        fontSize:"11px", fontWeight:800, color:personCol,
      }}>
        {vest.stock}
      </div>

      {/* Details */}
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:"6px", marginBottom:"3px" }}>
          <span style={{ fontSize:"13px", fontWeight:700, color:T.text }}>
            {vest.units} units
          </span>
          <span style={{ fontSize:"10px", color:T.textMuted }}>
            → {netUnits} net ({100 - taxPct}% after tax)
          </span>
        </div>
        <div style={{ fontSize:"11px", color:T.textMuted }}>
          {new Date(vest.vest_date).toLocaleDateString("en-IN",
            { day:"2-digit", month:"short", year:"numeric" })}
          <span style={{ color:vest.person === "Selva" ? T.selva : T.akshaya,
            fontWeight:600, marginLeft:"8px" }}>{vest.person}</span>
        </div>
      </div>

      {/* Value + days */}
      <div style={{ textAlign:"right", flexShrink:0 }}>
        {estINR && (
          <div style={{ fontFamily:"'JetBrains Mono',monospace",
            fontSize:"15px", fontWeight:800, color:T.accent }}>
            ~{fmtL(estINR)}
          </div>
        )}
        <div style={{
          fontSize:"11px", fontWeight:700,
          color: daysAway <= 7 ? T.red : urgent ? T.amber : T.textMuted,
          marginTop:"2px",
        }}>
          {daysAway === 0 ? "Today!" : daysAway === 1 ? "Tomorrow!" : `in ${daysAway} days`}
        </div>
      </div>
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────

export default function DashboardTab({
  holdingsData, rsuData, incomeData, investmentsData, expensesData,
  txData, rsuGrants, liveData, fy,
  nwHistory, onSaveNwSnapshot,
  personFilter, onPersonFilterChange,
}) {
  const [priceMap,  setPriceMap]  = useState({});
  const [changeMap, setChangeMap] = useState({});
  const [fetching,  setFetching]  = useState(true);
  const [fetchedAt, setFetchedAt] = useState(null);
  const snapshotSaved = useRef(false);

  const usdinr = liveData?.USDINR || 85;

  // All holdings (derived + manual)
  const allHoldings = useMemo(() => {
    const derived = getDerivedHoldings(rsuData, incomeData, investmentsData);
    return [...derived, ...(holdingsData || [])];
  }, [rsuData, incomeData, investmentsData, holdingsData]);

  // Fetch prices on mount
  const fetchPrices = useCallback(async () => {
    setFetching(true);
    const { priceMap: pm, changeMap: cm } = await fetchAllPricesWithChange(allHoldings);
    // Override MSFT/NVDA with live data for current valuation
    if (liveData?.MSFT) pm.MSFT = liveData.MSFT;
    if (liveData?.NVDA) pm.NVDA = liveData.NVDA;
    setPriceMap(pm);
    setChangeMap(cm);
    setFetchedAt(new Date());
    setFetching(false);
  }, [allHoldings.length, liveData?.MSFT, liveData?.NVDA]);

  useEffect(() => { fetchPrices(); }, []);

  // Sync liveData MSFT/NVDA updates
  useEffect(() => {
    setPriceMap(prev => {
      const next = { ...prev };
      if (liveData?.MSFT) next.MSFT = liveData.MSFT;
      if (liveData?.NVDA) next.NVDA = liveData.NVDA;
      return next;
    });
  }, [liveData?.MSFT, liveData?.NVDA]);

  // Compute net worth
  const { totalNW, dayChangeINR, dayChangePct } = useMemo(() => {
    const filtered = personFilter && personFilter !== "all"
      ? allHoldings.filter(h => h.person === personFilter || h.person === "Joint")
      : allHoldings;

    let nw = 0, change = 0, base = 0;
    for (const h of filtered) {
      const val = getCurrentValueINR(h, priceMap, usdinr);
      if (val == null) continue;
      nw += val;

      const sym = h.type === "us_stock" ? h.symbol
                : h.type === "in_stock" ? (h.symbol && !/\.(NS|BO)$/i.test(h.symbol) ? h.symbol + ".NS" : h.symbol)
                : h.type === "mf"       ? h.schemeCode
                : null;
      const pct = sym ? changeMap[sym] : null;
      if (pct != null) { change += val * (pct / 100); base += val; }
    }

    return {
      totalNW:      nw,
      dayChangeINR: change,
      dayChangePct: base > 0 ? change / base * 100 : null,
    };
  }, [allHoldings, priceMap, changeMap, usdinr, personFilter]);

  // Save today's NW snapshot once per session after prices load
  useEffect(() => {
    if (!fetching && totalNW > 0 && !snapshotSaved.current) {
      snapshotSaved.current = true;
      onSaveNwSnapshot?.(totalNW);
    }
  }, [fetching, totalNW]);

  // FY NW change: compare today vs first snapshot in this FY
  const fyNwChange = useMemo(() => {
    if (!nwHistory?.length || totalNW === 0) return null;
    const fyStart = fy.slice(2, 6); // "2025" from "FY2025-26"
    const fyStartDate = `${fyStart}-04-01`; // Apr 1
    const fySnaps = nwHistory.filter(s => s.date >= fyStartDate);
    if (!fySnaps.length) return null;
    const first = fySnaps[0].value;
    return { abs: totalNW - first, pct: (totalNW - first) / first * 100 };
  }, [nwHistory, totalNW, fy]);

  // Goals from investmentsData
  const goals = investmentsData?.goals || [];

  // Upcoming RSU vests (next 5 for dashboard)
  const upcoming = useMemo(() =>
    getUpcomingVests(rsuGrants || [], 5),
    [rsuGrants]
  );

  // Current FY month index for month summary
  const curMonthIdx = getCurrentMonthIdx();

  // Stale indicator
  const staleMins = fetchedAt ? Math.round((Date.now() - fetchedAt) / 60000) : null;

  const PERSON_COLORS = { Selva: T.selva, Akshaya: T.akshaya };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"16px", paddingBottom:"40px" }}>

      {/* ── Top bar: greeting + person filter ── */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:"10px" }}>
        <div>
          <h2 style={{ margin:0, fontSize:"20px", fontWeight:800, color:T.text }}>
            Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 17 ? "afternoon" : "evening"} 👋
          </h2>
          <p style={{ margin:"3px 0 0", fontSize:"12px", color:T.textMuted }}>
            {new Date().toLocaleDateString("en-IN", { weekday:"long", day:"numeric", month:"long", year:"numeric" })}
          </p>
        </div>
        {/* Person filter */}
        <div style={{ display:"flex", background:T.card, borderRadius:"8px", padding:"2px", gap:"2px" }}>
          {["all","Selva","Akshaya"].map(p => (
            <button key={p} onClick={() => onPersonFilterChange?.(p)} style={{
              padding:"5px 14px", border:"none", borderRadius:"6px",
              fontSize:"12px", fontWeight:600, cursor:"pointer", transition:"all 0.15s",
              background: personFilter === p ? T.cta : "transparent",
              color: personFilter === p ? "#fff"
                   : p === "Selva"   ? T.selva
                   : p === "Akshaya" ? T.akshaya
                   : T.textDim,
            }}>{p === "all" ? "All" : p}</button>
          ))}
        </div>
      </div>

      {/* ── Section 1: Net Worth Hero ── */}
      <div style={{ background:`linear-gradient(135deg, ${T.surface}, ${T.card})`,
        borderRadius:"20px", border:`1px solid ${T.border}`, padding:"24px",
        display:"grid", gridTemplateColumns:"1fr auto", gap:"20px", alignItems:"start" }}>

        {/* Left: numbers */}
        <div>
          <div style={{ fontSize:"11px", color:T.textMuted, fontWeight:700,
            letterSpacing:"0.7px", marginBottom:"8px" }}>
            NET WORTH{personFilter !== "all" ? ` · ${personFilter.toUpperCase()}` : ""}
          </div>

          {/* Big NW number */}
          <div style={{ fontFamily:"'JetBrains Mono',monospace",
            fontSize:"clamp(28px,4vw,40px)", fontWeight:800, color:T.text, lineHeight:1 }}>
            {fetching && totalNW === 0 ? (
              <span style={{ color:T.textMuted }}>Loading…</span>
            ) : fmtL(totalNW)}
          </div>

          {/* FY change + 1D change row */}
          <div style={{ display:"flex", gap:"10px", marginTop:"10px", flexWrap:"wrap" }}>
            {fyNwChange && (
              <span style={{
                fontSize:"12px", fontWeight:700, padding:"3px 10px", borderRadius:"6px",
                background: fyNwChange.abs >= 0 ? `${T.accent}15` : `${T.red}15`,
                color:      fyNwChange.abs >= 0 ? T.accent : T.red,
                fontFamily:"'JetBrains Mono',monospace",
              }}>
                {fyNwChange.abs >= 0 ? "+" : ""}{fmtL(fyNwChange.abs)}
                {" "}({fyNwChange.pct >= 0 ? "+" : ""}{fyNwChange.pct.toFixed(1)}%) FY
              </span>
            )}
            {dayChangePct !== null && (
              <span style={{
                fontSize:"12px", fontWeight:700, padding:"3px 10px", borderRadius:"6px",
                background: dayChangeINR >= 0 ? `${T.accent}15` : `${T.red}15`,
                color:      dayChangeINR >= 0 ? T.accent : T.red,
                fontFamily:"'JetBrains Mono',monospace",
              }}>
                {dayChangeINR >= 0 ? "+" : ""}{fmtL(dayChangeINR)}
                {" "}({dayChangePct >= 0 ? "+" : ""}{dayChangePct.toFixed(2)}%) 1D
              </span>
            )}
            {fetching && (
              <span style={{ fontSize:"11px", color:T.textMuted, padding:"3px 0",
                display:"flex", alignItems:"center", gap:"4px" }}>
                <span style={{ width:"8px", height:"8px", borderRadius:"50%",
                  border:`2px solid ${T.textMuted}`, borderTopColor:T.accent,
                  display:"inline-block",
                  animation:"spin 0.8s linear infinite" }}/>
                Fetching prices…
              </span>
            )}
            {!fetching && staleMins !== null && (
              <span style={{ fontSize:"10px", color:T.textMuted, padding:"3px 0" }}>
                Prices {staleMins === 0 ? "just updated" : `${staleMins}m ago`}
                <button onClick={fetchPrices} style={{
                  marginLeft:"6px", background:"none", border:"none",
                  color:T.cta, fontSize:"10px", cursor:"pointer", fontWeight:700,
                }}>↻ Refresh</button>
              </span>
            )}
          </div>
        </div>

        {/* Right: sparkline */}
        <div style={{ minWidth:"160px", maxWidth:"280px", width:"100%" }}>
          {nwHistory?.length >= 2 ? (
            <>
              <div style={{ fontSize:"9px", color:T.textMuted, marginBottom:"4px",
                textAlign:"right" }}>
                Last {Math.min(nwHistory.length, 12)} snapshots
              </div>
              <NwSparkline history={nwHistory}/>
            </>
          ) : (
            <div style={{ textAlign:"center", padding:"16px 8px",
              fontSize:"11px", color:T.textMuted, lineHeight:1.5 }}>
              Sparkline builds over time.<br/>
              <span style={{ fontSize:"10px" }}>Come back tomorrow ✓</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Section 2: Month Summary + Goals ── */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"16px" }}>

        {/* Month Summary */}
        <MonthSummaryCard
          mi={curMonthIdx} fy={fy}
          incomeData={incomeData}
          txData={txData}
          expensesData={expensesData}
        />

        {/* Goal Progress Rings */}
        <div style={{ background:T.surface, borderRadius:"16px",
          border:`1px solid ${T.border}`, padding:"18px" }}>
          <div style={{ fontSize:"10px", color:T.textMuted, fontWeight:700,
            letterSpacing:"0.6px", marginBottom:"16px" }}>GOALS PROGRESS</div>

          {goals.length === 0 ? (
            <div style={{ textAlign:"center", padding:"24px 16px", color:T.textMuted, fontSize:"12px", lineHeight:1.7 }}>
              No goals yet.<br/>
              Add goals in the <strong style={{ color:T.cta }}>Investments</strong> tab.
            </div>
          ) : (
            <div style={{ display:"flex", gap:"16px", flexWrap:"wrap", justifyContent:"center" }}>
              {goals.slice(0, 4).map(g => (
                <GoalRing key={g.id} goal={g} size={goals.length === 1 ? 100 : 82}/>
              ))}
            </div>
          )}

          {goals.length > 4 && (
            <div style={{ textAlign:"center", marginTop:"10px",
              fontSize:"10px", color:T.textMuted }}>
              +{goals.length - 4} more in Investments tab
            </div>
          )}
        </div>
      </div>

      {/* ── Section 3: Upcoming RSU Vests ── */}
      <div style={{ background:T.surface, borderRadius:"16px",
        border:`1px solid ${T.border}`, padding:"18px" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
          marginBottom:"14px" }}>
          <div style={{ fontSize:"10px", color:T.textMuted, fontWeight:700,
            letterSpacing:"0.6px" }}>UPCOMING RSU VESTS</div>
          {upcoming.length > 0 && (
            <div style={{ fontSize:"10px", color:T.textMuted }}>
              {upcoming.length} vest{upcoming.length !== 1 ? "s" : ""} scheduled
            </div>
          )}
        </div>

        {upcoming.length === 0 ? (
          <div style={{ textAlign:"center", padding:"20px", color:T.textMuted, fontSize:"12px" }}>
            No upcoming vests found. Add grant schedules in the Portfolio → Grants tab.
          </div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
            {upcoming.map((v, i) => (
              <VestCard key={i} vest={v} rsuGrants={rsuGrants} liveData={liveData}/>
            ))}
          </div>
        )}
      </div>

      {/* ── Section 4: Quick nav tiles ── */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))", gap:"10px" }}>
        {[
          { icon:"📊", label:"Portfolio",    id:"portfolio",   sub:"Holdings + RSU" },
          { icon:"💰", label:"Income",       id:"income",      sub:"Salary + ESPP" },
          { icon:"🧾", label:"Transactions", id:"daily",       sub:"Daily spend" },
          { icon:"📋", label:"Budget",       id:"expenses",    sub:"Category limits" },
          { icon:"🏦", label:"Investments",  id:"investments", sub:"EPF + Goals" },
          { icon:"🎯", label:"Retirement",   id:"retirement",  sub:"Lifetime plan" },
        ].map(t => (
          <button key={t.id}
            onClick={() => {
              // Dispatch a custom event to switch tabs — FamilyFinanceTracker listens
              window.dispatchEvent(new CustomEvent("dk-switch-tab", { detail: t.id }));
            }}
            style={{
              background:T.card, border:`1px solid ${T.border}`, borderRadius:"12px",
              padding:"14px 12px", cursor:"pointer", textAlign:"left",
              transition:"border-color 0.15s",
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = T.ctaBorder}
            onMouseLeave={e => e.currentTarget.style.borderColor = T.border}>
            <div style={{ fontSize:"20px", marginBottom:"6px" }}>{t.icon}</div>
            <div style={{ fontSize:"12px", fontWeight:700, color:T.text }}>{t.label}</div>
            <div style={{ fontSize:"10px", color:T.textMuted, marginTop:"2px" }}>{t.sub}</div>
          </button>
        ))}
      </div>

      {/* Spin animation */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
