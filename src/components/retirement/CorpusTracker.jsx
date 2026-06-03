import { useState, useRef, useMemo } from "react";
import { T } from "../../lib/theme";
import { fmtCr } from "./engine";
import { getDerivedHoldings } from "../../lib/derivedHoldings";
import { getMonthlyHistory } from "../../lib/priceHistory";
import { getCurrentValueINR, calcFDValue } from "../../lib/priceService";

// ── Quarter definitions ────────────────────────────────────────────────────────
const BASE_QUARTERS = [
  { id: "Q1-FY25", label: "Apr 2024", qYM: "2024-04", date: "2024-04-01", age: 26 },
  { id: "Q2-FY25", label: "Jul 2024", qYM: "2024-07", date: "2024-07-01", age: 26 },
  { id: "Q3-FY25", label: "Oct 2024", qYM: "2024-10", date: "2024-10-01", age: 26 },
  { id: "Q4-FY25", label: "Jan 2025", qYM: "2025-01", date: "2025-01-01", age: 26 },
  { id: "Q1-FY26", label: "Apr 2025", qYM: "2025-04", date: "2025-04-01", age: 27 },
  { id: "Q2-FY26", label: "Jul 2025", qYM: "2025-07", date: "2025-07-01", age: 27 },
  { id: "Q3-FY26", label: "Oct 2025", qYM: "2025-10", date: "2025-10-01", age: 27 },
  { id: "Q4-FY26", label: "Jan 2026", qYM: "2026-01", date: "2026-01-01", age: 27 },
  { id: "Q1-FY27", label: "Apr 2026", qYM: "2026-04", date: "2026-04-01", age: 28, isCurrent: true },
];

// ── Asset categories ──────────────────────────────────────────────────────────
export const ASSET_CATS = [
  { key: "mf",       label: "Mutual Funds",  color: "#A855F7" },
  { key: "us_stock", label: "US Stocks",     color: "#6366F1" },
  { key: "in_stock", label: "Indian Stocks", color: T.blue    },
  { key: "epf",      label: "EPF",           color: "#F97316" },
  { key: "ppf",      label: "PPF",           color: T.teal    },
  { key: "fd",       label: "FD / Bonds",    color: T.amber   },
  { key: "other",    label: "Other",         color: "#8B96AD" },
];

const emptyAssets = () => Object.fromEntries(ASSET_CATS.map(c => [c.key, ""]));
export const totalAssets = (assets) =>
  ASSET_CATS.reduce((s, c) => s + (parseFloat(assets?.[c.key]) || 0), 0);

// Backward compat: old snapshots may have "stocks" instead of "us_stock"
function normaliseAssets(assets) {
  if (!assets) return {};
  const a = { ...assets };
  if (a.stocks !== undefined && a.us_stock === undefined) {
    a.us_stock = a.stocks;
    delete a.stocks;
  }
  return a;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Given all holdings + derived + price histories, compute corpus breakdown
 * as of a specific quarter date.
 * @param {string} qDate  "YYYY-MM-DD" first day of quarter
 * @param {string} qYM    "YYYY-MM"
 * @param {Array}  allHoldings  stored + derived combined
 * @param {Object} priceHistories  { [symbolOrSchemeCode]: { "YYYY-MM": price } }
 */
function computeHistoricalCorpus(qDate, qYM, allHoldings, priceHistories) {
  const qTs = new Date(qDate).getTime();
  const corpus = Object.fromEntries(ASSET_CATS.map(c => [c.key, 0]));
  const usdinrMap = priceHistories["USDINR=X"] || {};
  const usdinr = usdinrMap[qYM] || usdinrMap[Object.keys(usdinrMap).sort().reverse().find(k => k <= qYM)] || 85;

  for (const h of allHoldings) {
    // Filter to holdings that existed as of qDate
    const acqDate = h.acquisitionDate || h.startDate || "2000-01-01";
    if (new Date(acqDate).getTime() > qTs) continue;

    // Skip derived EPF — we recompute it historically below
    if (h.derived && h.source === "epf") continue;
    // Skip derived goal (no historical price)
    if (h.derived && h.source === "goal") {
      corpus.mf += h.costBasisINR || 0;
      continue;
    }

    switch (h.type) {
      case "mf": {
        const hist = priceHistories[h.schemeCode];
        const nav  = hist?.[qYM] || hist?.[Object.keys(hist || {}).sort().reverse().find(k => k <= qYM)];
        corpus.mf += nav && h.units ? h.units * nav : (h.costBasisINR || 0);
        break;
      }
      case "us_stock": {
        const sym  = h.symbol;
        const hist = priceHistories[sym];
        const price = hist?.[qYM] || hist?.[Object.keys(hist || {}).sort().reverse().find(k => k <= qYM)];
        corpus.us_stock += price && h.quantity ? h.quantity * price * usdinr : (h.costBasisINR || 0);
        break;
      }
      case "in_stock": {
        const sym  = h.symbol && !/\.(NS|BO)$/i.test(h.symbol) ? h.symbol + ".NS" : h.symbol;
        const hist = priceHistories[sym] || priceHistories[h.symbol];
        const price = hist?.[qYM] || hist?.[Object.keys(hist || {}).sort().reverse().find(k => k <= qYM)];
        corpus.in_stock += price && h.quantity ? h.quantity * price : (h.costBasisINR || 0);
        break;
      }
      case "fd": {
        const days = Math.max(0, Math.floor((new Date(qDate) - new Date(h.startDate)) / 86400000));
        corpus.fd += h.principal * Math.pow(1 + (h.interestRate || 0.07) / 400, days / 91.25);
        break;
      }
      case "epf":
      case "ppf":
        // Handled below via linear interpolation — skip raw balance here
        break;
      default:
        corpus.other += h.costBasisINR || h.balance || 0;
    }
  }

  // EPF + PPF: linear interpolation from 0 → current balance across Apr 2024–Apr 2026.
  // Assumption: equal monthly contributions each month to reach today's corpus.
  const APR_2024_MS = new Date("2024-04-01").getTime();
  const APR_2026_MS = new Date("2026-04-01").getTime();
  const fraction    = Math.max(0, Math.min((qTs - APR_2024_MS) / (APR_2026_MS - APR_2024_MS), 1));

  // Prefer derived EPF (already aggregates both persons from income data).
  // Only fall back to manually-stored EPF holdings if no derived ones exist.
  let currentEPF = 0, currentPPF = 0;
  const derivedEPF = allHoldings.filter(h => h.type === "epf" && h.derived);
  if (derivedEPF.length > 0) {
    derivedEPF.forEach(h => { currentEPF += h.balance || 0; });
  } else {
    allHoldings.filter(h => h.type === "epf" && !h.derived).forEach(h => { currentEPF += h.balance || 0; });
  }
  allHoldings.filter(h => h.type === "ppf").forEach(h => { currentPPF += h.balance || 0; });
  corpus.epf = Math.round(currentEPF * fraction);
  corpus.ppf = Math.round(currentPPF * fraction);

  // Round everything
  ASSET_CATS.forEach(c => { corpus[c.key] = Math.round(corpus[c.key]); });
  return corpus;
}

// ── SVG Stacked Bar Chart ─────────────────────────────────────────────────────
function CorpusChart({ snapshots }) {
  const valid = snapshots.filter(s => totalAssets(s.assets) > 0);
  if (valid.length < 2) return (
    <div style={{ textAlign: "center", color: T.textMuted, padding: "40px 0", fontSize: "13px" }}>
      Add or auto-fill at least 2 quarters of data to see the chart
    </div>
  );

  const W = 720, H = 220, PAD = 52, barW = Math.min(44, (W - PAD * 2) / valid.length - 10);
  const maxVal = Math.max(...valid.map(s => totalAssets(s.assets)));
  const xStep  = (W - PAD * 2) / Math.max(valid.length - 1, 1);
  const yScale = v => H - PAD - (v / maxVal) * (H - PAD * 1.4);

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible" }}>
      {[0, 0.25, 0.5, 0.75, 1].map(pct => {
        const y = yScale(pct * maxVal);
        return (
          <g key={pct}>
            <line x1={PAD} x2={W - PAD / 2} y1={y} y2={y} stroke={T.border} strokeDasharray="4,4" strokeWidth="1" />
            <text x={PAD - 6} y={y + 4} textAnchor="end" fontSize="9" fill={T.textMuted}>
              {fmtCr(pct * maxVal)}
            </text>
          </g>
        );
      })}
      {valid.map((s, i) => {
        const cx = PAD + i * xStep;
        const x  = cx - barW / 2;
        let yBot = H - PAD;
        const topY = yScale(totalAssets(s.assets));
        return (
          <g key={s.id}>
            {ASSET_CATS.map(cat => {
              const val = parseFloat(s.assets?.[cat.key]) || 0;
              if (!val) return null;
              const bH  = (val / maxVal) * (H - PAD * 1.4);
              const bY  = yBot - bH;
              yBot -= bH;
              return <rect key={cat.key} x={x} y={bY} width={barW} height={bH} fill={cat.color} rx="2" opacity="0.85" />;
            })}
            <text x={cx} y={H - PAD + 14} textAnchor="middle" fontSize="9" fill={T.textMuted}>{s.label}</text>
            <text x={cx} y={topY - 5} textAnchor="middle" fontSize="9" fill={T.text} fontWeight="600">
              {fmtCr(totalAssets(s.assets))}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Individual Quarter Card ───────────────────────────────────────────────────
function QuarterCard({ q, snapshot, onSave, isCurrent, allHoldings, incomeData, investmentsData }) {
  const [editing,    setEditing]    = useState(false);
  const [form,       setForm]       = useState(emptyAssets());
  const [note,       setNote]       = useState("");
  const [imgPreview, setImgPreview] = useState(null);
  const [fetching,   setFetching]   = useState(false);
  const [fetchErr,   setFetchErr]   = useState(null);
  const fileRef = useRef();

  const snap  = snapshot || null;
  const total = snap ? totalAssets(normaliseAssets(snap.assets)) : 0;

  const startEdit = () => {
    setForm(snap ? { ...emptyAssets(), ...normaliseAssets(snap.assets) } : emptyAssets());
    setNote(snap?.note || "");
    setImgPreview(snap?.screenshot || null);
    setFetchErr(null);
    setEditing(true);
  };

  // Auto-fetch historical prices and pre-fill the form
  const autoFill = async () => {
    setFetching(true);
    setFetchErr(null);
    try {
      // Collect all symbols / scheme codes from holdings that existed by this quarter
      const qTs = new Date(q.date).getTime();
      const relevant = allHoldings.filter(h => {
        const acq = new Date(h.acquisitionDate || h.startDate || "2000-01-01").getTime();
        return acq <= qTs && !(h.derived && h.source === "epf");
      });

      const stockSymbols = [...new Set(relevant.filter(h => h.type === "us_stock" || h.type === "in_stock").map(h => {
        if (h.type === "in_stock" && h.symbol && !/\.(NS|BO)$/i.test(h.symbol)) return h.symbol + ".NS";
        return h.symbol;
      }).filter(Boolean))];
      const mfCodes = [...new Set(relevant.filter(h => h.type === "mf").map(h => h.schemeCode).filter(Boolean))];

      // Fetch all histories in parallel including USDINR
      const histFetches = [
        ...stockSymbols.map(s => getMonthlyHistory(s, "stock").then(h => [s, h])),
        ...mfCodes.map(c =>     getMonthlyHistory(c, "mf").then(h    => [c, h])),
        getMonthlyHistory("USDINR=X", "stock").then(h => ["USDINR=X", h]),
      ];
      const results = await Promise.allSettled(histFetches);
      const priceHistories = {};
      for (const r of results) {
        if (r.status === "fulfilled") priceHistories[r.value[0]] = r.value[1];
      }

      const corpus = computeHistoricalCorpus(q.date, q.qYM, allHoldings, priceHistories);
      setForm(prev => ({
        ...prev,
        ...Object.fromEntries(ASSET_CATS.map(c => [c.key, corpus[c.key] > 0 ? String(corpus[c.key]) : prev[c.key]])),
      }));
      setNote(prev => prev || `Auto-filled from holdings as of ${q.label}`);
    } catch (e) {
      setFetchErr(`Auto-fill failed: ${e.message}`);
    }
    setFetching(false);
  };

  const handleSave = () => {
    const assets = {};
    ASSET_CATS.forEach(c => { assets[c.key] = Math.round(parseFloat(form[c.key]) || 0); });
    onSave(q.id, { assets, note, screenshot: imgPreview });
    setEditing(false);
  };

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setImgPreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const inpS = { width: "100%", padding: "5px 8px", background: T.bg, border: `1px solid ${T.border}`,
    borderRadius: "6px", color: T.text, fontSize: "12px", fontFamily: "'JetBrains Mono',monospace" };

  const normAssets = normaliseAssets(snap?.assets);

  return (
    <div style={{
      background: isCurrent ? T.card : T.surface,
      border: `1px solid ${isCurrent ? T.accent : (snap ? T.borderLight : T.border)}`,
      borderRadius: "12px", padding: "16px", position: "relative",
      boxShadow: isCurrent ? `0 0 16px rgba(34,197,94,0.12)` : "none",
    }}>
      {isCurrent && (
        <div style={{ position: "absolute", top: "10px", right: "10px", fontSize: "10px", fontWeight: 700,
          background: T.accentDim, color: T.accent, padding: "2px 8px", borderRadius: "99px" }}>CURRENT</div>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px" }}>
        <div>
          <div style={{ fontSize: "14px", fontWeight: 700, color: T.text }}>{q.label}</div>
          <div style={{ fontSize: "11px", color: T.textMuted }}>Age {q.age} · {q.id}</div>
        </div>
        {!editing && (
          <button onClick={startEdit} style={{ padding: "4px 12px", background: "transparent", border: `1px solid ${T.border}`,
            borderRadius: "6px", color: T.textDim, fontSize: "11px", fontWeight: 600, cursor: "pointer" }}>
            {snap ? "Edit" : "Add Data"}
          </button>
        )}
      </div>

      {editing ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
          {/* Auto-fill button for past quarters */}
          {!isCurrent && (
            <button onClick={autoFill} disabled={fetching} style={{
              padding: "7px", background: T.surface, border: `1px solid ${T.accent}`,
              borderRadius: "7px", color: T.accent, fontSize: "12px", fontWeight: 700,
              cursor: fetching ? "wait" : "pointer", marginBottom: "4px",
            }}>
              {fetching ? "⏳ Fetching historical prices…" : "✦ Auto-fill from historical prices"}
            </button>
          )}
          {fetchErr && <div style={{ fontSize: "11px", color: T.red, marginBottom: "4px" }}>{fetchErr}</div>}

          {ASSET_CATS.map(cat => (
            <div key={cat.key} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: cat.color, flexShrink: 0 }} />
              <span style={{ fontSize: "11px", color: T.textDim, width: "100px", flexShrink: 0 }}>{cat.label}</span>
              <input type="number" placeholder="0" value={form[cat.key]}
                onChange={e => setForm(p => ({ ...p, [cat.key]: e.target.value }))}
                style={inpS} />
            </div>
          ))}
          <textarea placeholder="Note (optional)" value={note}
            onChange={e => setNote(e.target.value)}
            style={{ ...inpS, height: "48px", resize: "none", marginTop: "2px" }} />
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button onClick={() => fileRef.current?.click()} style={{
              padding: "4px 10px", background: "transparent", border: `1px solid ${T.border}`,
              borderRadius: "6px", color: T.textDim, fontSize: "11px", cursor: "pointer" }}>
              📷 Screenshot
            </button>
            {imgPreview && <span style={{ fontSize: "10px", color: T.accent }}>✓ attached</span>}
            <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFile} />
          </div>
          <div style={{ display: "flex", gap: "8px", marginTop: "2px" }}>
            <button onClick={handleSave} style={{ flex: 1, padding: "7px", background: T.accent, border: "none",
              borderRadius: "8px", color: T.bg, fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>Save</button>
            <button onClick={() => setEditing(false)} style={{ padding: "7px 14px", background: "transparent",
              border: `1px solid ${T.border}`, borderRadius: "8px", color: T.textDim, fontSize: "12px", cursor: "pointer" }}>Cancel</button>
          </div>
        </div>
      ) : snap ? (
        <div>
          {ASSET_CATS.filter(c => normAssets[c.key] > 0).map(cat => (
            <div key={cat.key} style={{ display: "flex", justifyContent: "space-between", fontSize: "12px",
              color: T.textDim, marginBottom: "3px" }}>
              <span style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: cat.color }} />
                {cat.label}
              </span>
              <span style={{ fontFamily: "'JetBrains Mono',monospace", color: T.text }}>{fmtCr(normAssets[cat.key])}</span>
            </div>
          ))}
          <div style={{ borderTop: `1px solid ${T.border}`, marginTop: "8px", paddingTop: "8px",
            display: "flex", justifyContent: "space-between", fontSize: "14px", fontWeight: 700 }}>
            <span style={{ color: T.textDim }}>Total Corpus</span>
            <span style={{ color: T.accent, fontFamily: "'JetBrains Mono',monospace" }}>{fmtCr(total)}</span>
          </div>
          {snap.note && <div style={{ fontSize: "11px", color: T.textMuted, marginTop: "6px", fontStyle: "italic" }}>{snap.note}</div>}
          {snap.screenshot && (
            <img src={snap.screenshot} alt="snapshot"
              style={{ width: "100%", borderRadius: "8px", marginTop: "8px", border: `1px solid ${T.border}`, cursor: "pointer" }}
              onClick={() => window.open(snap.screenshot, "_blank")} />
          )}
        </div>
      ) : (
        <div style={{ color: T.textMuted, fontSize: "12px", textAlign: "center", padding: "8px 0" }}>
          No data — click "Add Data" to record or auto-fill this quarter
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function CorpusTracker({
  retirementData, onUpdate,
  holdingsData, liveData,
  rsuData, incomeData, investmentsData,
}) {
  const snapshots = retirementData?.snapshots || {};

  // Combine stored + derived holdings
  const allHoldings = useMemo(() => {
    const derived = getDerivedHoldings(rsuData || {}, incomeData || {}, investmentsData || {});
    return [...(holdingsData || []), ...derived];
  }, [holdingsData, rsuData, incomeData, investmentsData]);

  // Live corpus — current state using live prices from liveData
  const liveCorpus = useMemo(() => {
    const USDINR = liveData?.USDINR || 85.42;
    const priceMap = {};
    if (liveData?.MSFT)   priceMap["MSFT"]  = liveData.MSFT;
    if (liveData?.NVDA)   priceMap["NVDA"]  = liveData.NVDA;
    // Add any other live prices stored in liveData
    Object.entries(liveData || {}).forEach(([k, v]) => {
      if (typeof v === "number" && !["USDINR", "fetchedAt"].includes(k)) priceMap[k] = v;
    });

    const corpus = Object.fromEntries(ASSET_CATS.map(c => [c.key, 0]));

    for (const h of allHoldings) {
      if (h.derived && h.source === "epf") {
        // Use derived EPF balance directly (already up-to-date)
        corpus.epf += h.balance || 0;
        continue;
      }
      if (h.derived && h.source === "goal") {
        corpus.mf += h.costBasisINR || 0;
        continue;
      }
      switch (h.type) {
        case "us_stock": {
          const live = getCurrentValueINR(h, priceMap, USDINR);
          corpus.us_stock += live ?? (h.costBasisINR || 0);
          break;
        }
        case "in_stock": {
          const live = getCurrentValueINR(h, priceMap, USDINR);
          corpus.in_stock += live ?? (h.costBasisINR || 0);
          break;
        }
        case "mf": {
          // Use stored units × best-known NAV, or fallback to costBasis
          const nav = priceMap[h.schemeCode];
          corpus.mf += nav && h.units ? h.units * nav : (h.costBasisINR || 0);
          break;
        }
        case "fd":
          corpus.fd += calcFDValue(h.principal, h.interestRate, h.startDate);
          break;
        case "epf":
          corpus.epf += h.balance || 0;
          break;
        case "ppf":
          corpus.ppf += h.balance || 0;
          break;
        default:
          corpus.other += h.costBasisINR || h.balance || 0;
      }
    }
    ASSET_CATS.forEach(c => { corpus[c.key] = Math.round(corpus[c.key]); });
    return corpus;
  }, [allHoldings, liveData]);

  const liveTotal = totalAssets(liveCorpus);

  const handleSave = (quarterId, data) => {
    const next = { ...snapshots, [quarterId]: { ...data, id: quarterId } };
    onUpdate({ ...retirementData, snapshots: next });
  };

  // Build chart data — current quarter auto-uses liveCorpus if not manually saved
  const chartSnapshots = BASE_QUARTERS.map(q => {
    const snap   = snapshots[q.id];
    const assets = q.isCurrent && !snap ? liveCorpus : normaliseAssets(snap?.assets);
    return { id: q.id, label: q.label, assets: assets || {} };
  });

  const growth = (() => {
    const first = chartSnapshots.find(q => totalAssets(q.assets) > 0);
    const last  = [...chartSnapshots].reverse().find(q => totalAssets(q.assets) > 0);
    if (!first || !last || first.id === last.id) return null;
    const f = totalAssets(first.assets), l = totalAssets(last.assets);
    return { abs: l - f, pct: ((l - f) / f * 100).toFixed(1), firstLabel: first.label, lastLabel: last.label };
  })();

  return (
    <div>
      {/* Summary header */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: "12px", marginBottom: "24px" }}>
        <div style={{ background: T.card, border: `1px solid ${T.accent}`, borderRadius: "12px", padding: "16px",
          boxShadow: `0 0 16px rgba(34,197,94,0.08)` }}>
          <div style={{ fontSize: "11px", color: T.textMuted, marginBottom: "4px" }}>Current Corpus (Live)</div>
          <div style={{ fontSize: "22px", fontWeight: 800, color: T.accent, fontFamily: "'JetBrains Mono',monospace" }}>{fmtCr(liveTotal)}</div>
        </div>
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: "12px", padding: "16px" }}>
          <div style={{ fontSize: "11px", color: T.textMuted, marginBottom: "4px" }}>Target Corpus at 45</div>
          <div style={{ fontSize: "22px", fontWeight: 800, color: T.blue, fontFamily: "'JetBrains Mono',monospace" }}>₹21.16 Cr</div>
        </div>
        {growth && (
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: "12px", padding: "16px" }}>
            <div style={{ fontSize: "11px", color: T.textMuted, marginBottom: "4px" }}>Growth {growth.firstLabel}–{growth.lastLabel}</div>
            <div style={{ fontSize: "18px", fontWeight: 800, color: T.amber, fontFamily: "'JetBrains Mono',monospace" }}>
              +{fmtCr(growth.abs)}<span style={{ fontSize: "13px", marginLeft: "4px" }}>({growth.pct}%)</span>
            </div>
          </div>
        )}
        {/* Live breakdown mini pills */}
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: "12px", padding: "12px 16px",
          display: "flex", flexDirection: "column", gap: "4px" }}>
          {ASSET_CATS.filter(c => liveCorpus[c.key] > 0).map(c => (
            <div key={c.key} style={{ display: "flex", justifyContent: "space-between", fontSize: "11px" }}>
              <span style={{ display: "flex", alignItems: "center", gap: "5px", color: T.textDim }}>
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: c.color }} />{c.label}
              </span>
              <span style={{ fontFamily: "'JetBrains Mono',monospace", color: T.text }}>{fmtCr(liveCorpus[c.key])}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "10px" }}>
        {ASSET_CATS.map(c => (
          <div key={c.key} style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "11px", color: T.textDim }}>
            <span style={{ width: "8px", height: "8px", borderRadius: "2px", background: c.color }} />{c.label}
          </div>
        ))}
      </div>

      {/* Chart */}
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: "12px", padding: "20px", marginBottom: "24px" }}>
        <div style={{ fontSize: "13px", fontWeight: 700, marginBottom: "4px", color: T.text }}>Corpus Growth — Apr 2024 to Apr 2026</div>
        <div style={{ fontSize: "11px", color: T.textMuted, marginBottom: "12px" }}>
          Click "Add Data" → "Auto-fill from historical prices" to compute past quarter values automatically
        </div>
        <CorpusChart snapshots={chartSnapshots} />
      </div>

      {/* Quarter cards */}
      <div style={{ fontSize: "13px", fontWeight: 700, color: T.text, marginBottom: "12px" }}>
        Quarterly Snapshots
        <span style={{ fontSize: "11px", fontWeight: 400, color: T.textMuted, marginLeft: "8px" }}>
          Apr 2026 auto-derived from live holdings · Past quarters: use "Auto-fill" or enter manually
        </span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: "12px" }}>
        {BASE_QUARTERS.map(q => {
          let snap = snapshots[q.id];
          if (q.isCurrent && !snap) {
            snap = { assets: liveCorpus, note: "Auto-derived from current holdings", screenshot: null };
          }
          return (
            <QuarterCard
              key={q.id} q={q} snapshot={snap} onSave={handleSave}
              isCurrent={!!q.isCurrent}
              allHoldings={allHoldings}
              incomeData={incomeData || {}}
              investmentsData={investmentsData || {}}
            />
          );
        })}
      </div>

      {/* Back-fill guide */}
      <div style={{ marginTop: "20px", padding: "16px", background: T.surface, borderRadius: "10px", border: `1px solid ${T.border}` }}>
        <div style={{ fontSize: "12px", fontWeight: 700, color: T.textDim, marginBottom: "6px" }}>How historical auto-fill works</div>
        <ul style={{ fontSize: "12px", color: T.textMuted, margin: 0, paddingLeft: "20px", lineHeight: "1.8" }}>
          <li><b style={{ color: T.text }}>US/Indian Stocks</b> — Yahoo Finance monthly price on the 1st of the quarter × quantity held at that date</li>
          <li><b style={{ color: T.text }}>Mutual Funds</b> — AMFI NAV history via mfapi.in for that month × units held</li>
          <li><b style={{ color: T.text }}>EPF</b> — Opening balance + cumulative monthly contributions entered in the Income tab up to that date</li>
          <li><b style={{ color: T.text }}>USD/INR</b> — Historical rate from Yahoo Finance for that month</li>
          <li><b style={{ color: T.text }}>Fallback</b> — If historical price unavailable, cost basis is used. You can manually correct any field.</li>
        </ul>
      </div>
    </div>
  );
}
