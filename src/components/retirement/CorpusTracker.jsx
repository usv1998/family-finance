import { useState, useRef } from "react";
import { T } from "../../lib/theme";
import { fmtCr, LAKH, CRORE } from "./engine";
import { genId } from "../../lib/formatters";

// Quarter definitions from Apr-2024 to Apr-2026
const BASE_QUARTERS = [
  { id: "Q1-FY25", label: "Apr 2024", date: "2024-04-01", age: 26 },
  { id: "Q2-FY25", label: "Jul 2024", date: "2024-07-01", age: 26 },
  { id: "Q3-FY25", label: "Oct 2024", date: "2024-10-01", age: 26 },
  { id: "Q4-FY25", label: "Jan 2025", date: "2025-01-01", age: 26 },
  { id: "Q1-FY26", label: "Apr 2025", date: "2025-04-01", age: 27 },
  { id: "Q2-FY26", label: "Jul 2025", date: "2025-07-01", age: 27 },
  { id: "Q3-FY26", label: "Oct 2025", date: "2025-10-01", age: 27 },
  { id: "Q4-FY26", label: "Jan 2026", date: "2026-01-01", age: 27 },
  { id: "Q1-FY27", label: "Apr 2026", date: "2026-04-01", age: 28 },
];

const ASSET_CATS = [
  { key: "mf",     label: "Mutual Funds",  color: "#3B82F6" },
  { key: "stocks", label: "US Stocks",     color: "#A855F7" },
  { key: "epf",    label: "EPF",           color: "#22C55E" },
  { key: "ppf",    label: "PPF",           color: "#14B8A6" },
  { key: "fd",     label: "FD / Bonds",    color: "#F59E0B" },
  { key: "other",  label: "Other",         color: "#8B96AD" },
];

const emptyAssets = () => Object.fromEntries(ASSET_CATS.map(c => [c.key, ""]));

const totalAssets = (assets) =>
  ASSET_CATS.reduce((s, c) => s + (parseFloat(assets?.[c.key]) || 0), 0);

// Bar chart via SVG
function CorpusChart({ snapshots }) {
  const valid = snapshots.filter(s => totalAssets(s.assets) > 0);
  if (valid.length < 2) return (
    <div style={{ textAlign: "center", color: T.textMuted, padding: "40px 0", fontSize: "13px" }}>
      Add at least 2 quarters of data to see the chart
    </div>
  );

  const W = 700, H = 220, PAD = 48, BAR_W = Math.min(40, (W - PAD * 2) / valid.length - 8);
  const maxVal = Math.max(...valid.map(s => totalAssets(s.assets)));
  const xStep  = (W - PAD * 2) / (valid.length - 1 || 1);

  const yScale = v => H - PAD - (v / maxVal) * (H - PAD * 1.4);

  // Stacked bar values
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible" }}>
      {/* Y axis grid */}
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

      {/* Stacked bars */}
      {valid.map((s, i) => {
        const cx = PAD + i * xStep;
        const x  = cx - BAR_W / 2;
        let yBottom = H - PAD;
        return (
          <g key={s.id}>
            {ASSET_CATS.map(cat => {
              const val = parseFloat(s.assets?.[cat.key]) || 0;
              if (!val) return null;
              const barH = (val / maxVal) * (H - PAD * 1.4);
              const y    = yBottom - barH;
              yBottom   -= barH;
              return <rect key={cat.key} x={x} y={y} width={BAR_W} height={barH} fill={cat.color} rx="2" opacity="0.85" />;
            })}
            <text x={cx} y={H - PAD + 14} textAnchor="middle" fontSize="9" fill={T.textMuted}>{s.label}</text>
            <text x={cx} y={yBottom - 4} textAnchor="middle" fontSize="9" fill={T.text} fontWeight="600">
              {fmtCr(totalAssets(s.assets))}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// Individual quarter card
function QuarterCard({ q, snapshot, onSave, isCurrent }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm]       = useState(emptyAssets());
  const [note, setNote]       = useState("");
  const fileRef               = useRef();
  const [imgPreview, setImgPreview] = useState(null);

  const snap = snapshot || null;
  const total = snap ? totalAssets(snap.assets) : 0;

  const startEdit = () => {
    setForm(snap ? { ...emptyAssets(), ...snap.assets } : emptyAssets());
    setNote(snap?.note || "");
    setImgPreview(snap?.screenshot || null);
    setEditing(true);
  };

  const handleSave = () => {
    const assets = {};
    ASSET_CATS.forEach(c => { assets[c.key] = parseFloat(form[c.key]) || 0; });
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

  const inpStyle = {
    width: "100%", padding: "6px 10px", background: T.bg, border: `1px solid ${T.border}`,
    borderRadius: "6px", color: T.text, fontSize: "13px", fontFamily: "'JetBrains Mono',monospace",
  };

  return (
    <div style={{
      background: isCurrent ? T.card : T.surface,
      border: `1px solid ${isCurrent ? T.accent : (snap ? T.border : T.border)}`,
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
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {ASSET_CATS.map(cat => (
            <div key={cat.key} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: cat.color, flexShrink: 0 }} />
              <span style={{ fontSize: "12px", color: T.textDim, width: "100px", flexShrink: 0 }}>{cat.label}</span>
              <input type="number" placeholder="0" value={form[cat.key]}
                onChange={e => setForm(p => ({ ...p, [cat.key]: e.target.value }))}
                style={inpStyle} />
            </div>
          ))}
          <textarea placeholder="Note (optional)" value={note}
            onChange={e => setNote(e.target.value)}
            style={{ ...inpStyle, height: "52px", resize: "none", marginTop: "4px" }} />
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px" }}>
            <button onClick={() => fileRef.current?.click()} style={{
              padding: "5px 12px", background: "transparent", border: `1px solid ${T.border}`,
              borderRadius: "6px", color: T.textDim, fontSize: "11px", cursor: "pointer" }}>
              📷 Attach Screenshot
            </button>
            {imgPreview && <span style={{ fontSize: "10px", color: T.accent }}>✓ Image attached</span>}
            <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFile} />
          </div>
          <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
            <button onClick={handleSave} style={{ flex: 1, padding: "8px", background: T.accent, border: "none",
              borderRadius: "8px", color: T.bg, fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>Save</button>
            <button onClick={() => setEditing(false)} style={{ padding: "8px 16px", background: "transparent",
              border: `1px solid ${T.border}`, borderRadius: "8px", color: T.textDim, fontSize: "13px", cursor: "pointer" }}>Cancel</button>
          </div>
        </div>
      ) : snap ? (
        <div>
          {ASSET_CATS.filter(c => snap.assets?.[c.key] > 0).map(cat => (
            <div key={cat.key} style={{ display: "flex", justifyContent: "space-between", fontSize: "12px",
              color: T.textDim, marginBottom: "3px" }}>
              <span style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: cat.color }} />
                {cat.label}
              </span>
              <span style={{ fontFamily: "'JetBrains Mono',monospace", color: T.text }}>{fmtCr(snap.assets[cat.key])}</span>
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
          No data — click "Add Data" to record this quarter
        </div>
      )}
    </div>
  );
}

export default function CorpusTracker({ retirementData, onUpdate, holdingsData, liveData }) {
  const snapshots = retirementData?.snapshots || {};

  // Compute current portfolio value from live holdings
  const USDINR = liveData?.USDINR || 85.42;
  const MSFT   = liveData?.MSFT   || 428.5;
  const NVDA   = liveData?.NVDA   || 136.2;

  const liveCorpus = (() => {
    let mf = 0, stocks = 0, epf = 0, ppf = 0;
    (holdingsData || []).forEach(h => {
      if (h.type === "mf") {
        const nav = h.currentNav || h.costBasisINR / (h.units || 1);
        mf += (h.units || 0) * nav;
      } else if (h.type === "in_stock") {
        const price = h.symbol === "MSFT" ? MSFT : h.symbol === "NVDA" ? NVDA : 0;
        stocks += (h.quantity || 0) * price * USDINR;
      } else if (h.type === "epf") {
        epf += h.value || 0;
      } else if (h.type === "ppf") {
        ppf += h.value || 0;
      }
    });
    return { mf: Math.round(mf), stocks: Math.round(stocks), epf: Math.round(epf), ppf: Math.round(ppf) };
  })();

  const handleSave = (quarterId, data) => {
    const next = { ...snapshots, [quarterId]: { ...data, id: quarterId } };
    onUpdate({ ...retirementData, snapshots: next });
  };

  // Build chart data with current auto-snapshot for Q1-FY27
  const chartSnapshots = BASE_QUARTERS.map(q => {
    const snap = snapshots[q.id];
    const assets = q.id === "Q1-FY27" && !snap ? liveCorpus : snap?.assets;
    return { id: q.id, label: q.label, assets: assets || {} };
  });

  const allTotal = chartSnapshots.reduce((s, q) => s + totalAssets(q.assets), 0);
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
        {[
          { label: "Current Corpus (Live)", value: fmtCr(Object.values(liveCorpus).reduce((a, b) => a + b, 0)), color: T.accent },
          { label: "Target by 45", value: "₹21.16 Cr", color: T.blue },
          growth && { label: `Growth ${growth.firstLabel}–${growth.lastLabel}`, value: `+${fmtCr(growth.abs)} (${growth.pct}%)`, color: T.amber },
        ].filter(Boolean).map((card, i) => (
          <div key={i} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: "12px", padding: "16px" }}>
            <div style={{ fontSize: "11px", color: T.textMuted, marginBottom: "4px" }}>{card.label}</div>
            <div style={{ fontSize: "20px", fontWeight: 800, color: card.color, fontFamily: "'JetBrains Mono',monospace" }}>{card.value}</div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "12px" }}>
        {ASSET_CATS.map(c => (
          <div key={c.key} style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "11px", color: T.textDim }}>
            <span style={{ width: "8px", height: "8px", borderRadius: "2px", background: c.color }} />
            {c.label}
          </div>
        ))}
      </div>

      {/* Chart */}
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: "12px", padding: "20px", marginBottom: "24px" }}>
        <div style={{ fontSize: "13px", fontWeight: 700, marginBottom: "12px", color: T.text }}>Corpus Growth — Apr 2024 to Apr 2026</div>
        <CorpusChart snapshots={chartSnapshots} />
      </div>

      {/* Quarter cards */}
      <div style={{ fontSize: "13px", fontWeight: 700, color: T.text, marginBottom: "12px" }}>
        Quarterly Snapshots
        <span style={{ fontSize: "11px", fontWeight: 400, color: T.textMuted, marginLeft: "8px" }}>
          Click "Add Data" to record values for each quarter. Apr 2026 is auto-filled from your current holdings.
        </span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: "12px" }}>
        {BASE_QUARTERS.map(q => {
          const isCurrentQ = q.id === "Q1-FY27";
          let snap = snapshots[q.id];
          // Auto-populate current quarter from live holdings if not manually set
          if (isCurrentQ && !snap) {
            snap = { assets: liveCorpus, note: "Auto-derived from current holdings", screenshot: null };
          }
          return (
            <QuarterCard key={q.id} q={q} snapshot={snap} onSave={handleSave} isCurrent={isCurrentQ} />
          );
        })}
      </div>

      <div style={{ marginTop: "20px", padding: "16px", background: T.surface, borderRadius: "10px", border: `1px solid ${T.border}` }}>
        <div style={{ fontSize: "12px", fontWeight: 700, color: T.textDim, marginBottom: "6px" }}>How to back-fill past quarters</div>
        <ul style={{ fontSize: "12px", color: T.textMuted, margin: 0, paddingLeft: "20px", lineHeight: "1.7" }}>
          <li>For MF: check your Zerodha / Groww / CAMS statement for the NAV × units on that date</li>
          <li>For US Stocks: use the stock price on that date × quantity × USDINR rate at the time</li>
          <li>For EPF: check your UAN passbook for the balance at end of that quarter</li>
          <li>Attach a screenshot of the statement for audit trail</li>
        </ul>
      </div>
    </div>
  );
}
