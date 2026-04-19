import { useState, useRef, useEffect } from "react";
import { T } from "../../lib/theme";
import { PERSONS } from "../../lib/constants";
import { genId } from "../../lib/formatters";

// ── parser ─────────────────────────────────────────────────────────────────

// Parse Zerodha tradebook CSV. Returns { stocks: [...], mfs: [...] }
// Stocks grouped by symbol, MFs grouped by ISIN (name varies per SIP row).
function parseTradebook(text) {
  const lines = text.trim().split("\n").map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) throw new Error("File appears empty.");

  const unquote = s => s.replace(/^"(.*)"$/, "$1").trim();
  const header  = lines[0].split(",").map(unquote).map(s => s.toLowerCase());

  const col = name => {
    const i = header.findIndex(h => h === name);
    if (i < 0) throw new Error(`Missing column "${name}" — is this a Zerodha tradebook CSV?`);
    return i;
  };

  const symCol     = col("symbol");
  const isinCol    = col("isin");
  const dateCol    = col("trade_date");
  const segCol     = col("segment");
  const typeCol    = col("trade_type");
  const qtyCol     = col("quantity");
  const priceCol   = col("price");
  const orderCol   = col("order_id");

  const stockOrders = {}; // key: orderId → { symbol, isin, date, qty, value }
  const mfByIsin    = {}; // key: isin    → { isin, name, lots[] }

  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(",").map(unquote);
    if (cells.length < 8) continue;
    if (cells[typeCol].toLowerCase() !== "buy") continue;

    const segment = (cells[segCol] || "").toUpperCase();
    const isin    = cells[isinCol];
    const date    = cells[dateCol].slice(0, 10);
    const qty     = parseFloat(cells[qtyCol])   || 0;
    const price   = parseFloat(cells[priceCol]) || 0;
    if (qty <= 0 || price <= 0 || !date) continue;

    if (segment === "MF") {
      // Each row is its own SIP lot (order_id = trade_id for MFs)
      const rawName = cells[symCol];
      if (!mfByIsin[isin]) mfByIsin[isin] = { isin, name: rawName, lots: [] };
      // Prefer the shortest clean name (later rows sometimes have cleaner names)
      if (rawName.length < mfByIsin[isin].name.length) mfByIsin[isin].name = rawName;
      mfByIsin[isin].lots.push({ date, qty, navPrice: price, costBasisINR: qty * price });
    } else {
      // EQ: aggregate fills within same order_id
      const symbol  = cells[symCol].toUpperCase();
      const orderId = cells[orderCol] || `${symbol}-${date}-${price}`;
      if (!stockOrders[orderId]) stockOrders[orderId] = { symbol, isin, date, totalQty:0, totalValue:0 };
      stockOrders[orderId].totalQty   += qty;
      stockOrders[orderId].totalValue += qty * price;
    }
  }

  // Build stock list grouped by symbol
  const bySymbol = {};
  for (const o of Object.values(stockOrders)) {
    if (!bySymbol[o.symbol]) bySymbol[o.symbol] = { symbol:o.symbol, isin:o.isin, lots:[] };
    bySymbol[o.symbol].lots.push({
      date: o.date, qty: o.totalQty,
      avgPrice: o.totalValue / o.totalQty,
      costBasisINR: o.totalValue,
    });
  }

  // Build MF list: sort lots by date, compute totals
  const mfList = Object.values(mfByIsin).map(f => {
    f.lots.sort((a,b) => a.date.localeCompare(b.date));
    return {
      ...f,
      totalUnits: f.lots.reduce((s,l) => s + l.qty, 0),
      totalCost:  f.lots.reduce((s,l) => s + l.costBasisINR, 0),
      schemeCode: null, // resolved async via mfapi
    };
  });

  const stocks = Object.values(bySymbol).map(s => {
    s.lots.sort((a,b) => a.date.localeCompare(b.date));
    s.totalQty  = s.lots.reduce((sum,l) => sum + l.qty, 0);
    s.totalCost = s.lots.reduce((sum,l) => sum + l.costBasisINR, 0);
    return s;
  });

  return { stocks, mfs: mfList };
}

// Fetch AMFI NAV master file and build ISIN → schemeCode map.
// Format: SchemeCode;ISINGrowth;ISINDivReinvest;SchemeName;NAV;Date
let _amfiMapPromise = null;
async function getAmfiMap() {
  if (_amfiMapPromise) return _amfiMapPromise;
  _amfiMapPromise = (async () => {
    try {
      const res = await fetch("https://portal.amfiindia.com/spages/NAVAll.txt", { cache: "force-cache" });
      if (!res.ok) return {};
      const text = await res.text();
      const map = {};
      for (const line of text.split("\n")) {
        const parts = line.split(";");
        if (parts.length < 4) continue;
        const code  = parts[0].trim();
        const isin1 = parts[1].trim();
        const isin2 = parts[2].trim();
        if (!code || isNaN(Number(code))) continue;
        if (isin1 && isin1 !== "-") map[isin1] = code;
        if (isin2 && isin2 !== "-") map[isin2] = code;
      }
      return map;
    } catch { return {}; }
  })();
  return _amfiMapPromise;
}

async function resolveSchemeCode(isin) {
  const map = await getAmfiMap();
  return map[isin] || null;
}

// ── helpers ────────────────────────────────────────────────────────────────

const fmt    = n => n == null ? "—" : `₹${Math.round(n).toLocaleString("en-IN")}`;
const fmtPrc = n => n == null ? "—" : `₹${n.toLocaleString("en-IN", { minimumFractionDigits:2, maximumFractionDigits:2 })}`;
const fmtDate = d => new Date(d).toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" });
const fmtUnits = n => n == null ? "—" : (n % 1 === 0 ? String(n) : n.toFixed(3).replace(/0+$/,""));

// ── component ──────────────────────────────────────────────────────────────

export default function TradebookImportModal({ holdingsData, onReplaceStockLots, onReplaceMFLots, onClose }) {
  const [stocks,    setStocks]    = useState([]);
  const [mfs,       setMFs]       = useState([]);
  const [person,    setPerson]    = useState("Selva");
  const [selStocks, setSelStocks] = useState(new Set());
  const [selMFs,    setSelMFs]    = useState(new Set());
  const [expanded,  setExpanded]  = useState(new Set());
  const [resolving, setResolving] = useState(false);
  const [error,     setError]     = useState("");
  const [step,      setStep]      = useState("upload");
  const fileRef = useRef(null);

  const handleFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const { stocks: s, mfs: m } = parseTradebook(e.target.result);
        setStocks(s);
        setMFs(m);
        setSelStocks(new Set(s.map(x => x.symbol)));
        setSelMFs(new Set(m.map(x => x.isin)));
        setExpanded(new Set());
        setError("");
        setStep("preview");

        // Async: resolve ISIN → schemeCode for each MF
        if (m.length > 0) {
          setResolving(true);
          const resolved = await Promise.all(
            m.map(async f => ({ ...f, schemeCode: await resolveSchemeCode(f.isin) }))
          );
          setMFs(resolved);
          setResolving(false);
        }
      } catch (err) {
        setError(err.message);
      }
    };
    reader.readAsText(file);
  };

  const toggleExpand = key =>
    setExpanded(s => { const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n; });

  const toggleStock = sym =>
    setSelStocks(s => { const n = new Set(s); n.has(sym) ? n.delete(sym) : n.add(sym); return n; });

  const toggleMF = isin =>
    setSelMFs(s => { const n = new Set(s); n.has(isin) ? n.delete(isin) : n.add(isin); return n; });

  const totalSelected = selStocks.size + selMFs.size;

  const doImport = () => {
    if (selStocks.size > 0) {
      onReplaceStockLots(person, stocks.filter(s => selStocks.has(s.symbol)));
    }
    if (selMFs.size > 0) {
      onReplaceMFLots(person, mfs.filter(f => selMFs.has(f.isin)));
    }
    onClose();
  };

  const inp = { padding:"8px 12px", background:T.bg, border:`1px solid ${T.border}`,
    borderRadius:"8px", color:T.text, fontSize:"13px", outline:"none" };

  const SectionHeader = ({ label, count }) => (
    <div style={{ fontSize:"11px", fontWeight:700, color:T.textMuted, letterSpacing:"0.6px",
      textTransform:"uppercase", padding:"4px 0 6px", borderBottom:`1px solid ${T.border}`,
      marginBottom:"6px" }}>
      {label} <span style={{ color:T.textDim, fontWeight:400 }}>({count})</span>
    </div>
  );

  return (
    <div onClick={onClose}
      style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.78)", zIndex:2000,
        display:"flex", alignItems:"center", justifyContent:"center", padding:"20px" }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background:T.surface, borderRadius:"16px", border:`1px solid ${T.border}`,
          width:"100%", maxWidth:"740px", maxHeight:"88vh", overflow:"hidden",
          display:"flex", flexDirection:"column" }}>

        {/* Header */}
        <div style={{ padding:"16px 20px", borderBottom:`1px solid ${T.border}`,
          display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <span style={{ fontSize:"15px", fontWeight:700, color:T.text }}>Import from Zerodha Tradebook</span>
            {step === "preview" && (
              <span style={{ fontSize:"11px", color:T.textMuted, marginLeft:"12px" }}>
                {totalSelected} item{totalSelected !== 1 ? "s" : ""} selected
                {resolving && <span style={{ color:T.amber, marginLeft:"8px" }}>· resolving fund codes…</span>}
              </span>
            )}
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none", color:T.textMuted,
            fontSize:"22px", cursor:"pointer", padding:"0 4px" }}>×</button>
        </div>

        <div style={{ overflowY:"auto", padding:"20px", display:"flex", flexDirection:"column", gap:"16px" }}>

          {/* Instructions */}
          {step === "upload" && (
            <div style={{ background:T.card, borderRadius:"10px", padding:"16px",
              border:`1px solid ${T.border}`, fontSize:"13px", color:T.textDim, lineHeight:1.7 }}>
              <div style={{ fontWeight:700, color:T.text, marginBottom:"8px" }}>How to export from Zerodha</div>
              <div>1. Open <strong style={{ color:T.text }}>Console → Reports → Tradebook</strong></div>
              <div>2. Select segment <strong style={{ color:T.text }}>Equity</strong> or <strong style={{ color:T.text }}>Mutual Fund</strong>, set date range</div>
              <div>3. Click <strong style={{ color:T.text }}>Download</strong> → upload the CSV here</div>
              <div style={{ marginTop:"8px", fontSize:"11px", color:T.textMuted }}>
                Works with EQ and MF tradebook files. Upload one at a time or combine by copying rows.
                Existing holdings for selected symbols/funds will be fully replaced.
              </div>
            </div>
          )}

          {/* Person selector */}
          <div style={{ display:"flex", alignItems:"center", gap:"12px" }}>
            <span style={{ fontSize:"12px", color:T.textMuted, fontWeight:600 }}>Import as:</span>
            {PERSONS.map(p => (
              <button key={p} onClick={() => setPerson(p)}
                style={{ padding:"6px 16px", borderRadius:"8px", border:"none", cursor:"pointer",
                  fontSize:"12px", fontWeight:600,
                  background: person === p ? T.accent : T.card,
                  color:      person === p ? T.bg     : T.textDim }}>
                {p}
              </button>
            ))}
          </div>

          {/* Drop zone */}
          {step === "upload" && (
            <div onClick={() => fileRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); }}
              style={{ border:`2px dashed ${T.border}`, borderRadius:"12px", padding:"40px 20px",
                textAlign:"center", cursor:"pointer", transition:"border-color 0.15s" }}
              onMouseEnter={e => e.currentTarget.style.borderColor = T.accent}
              onMouseLeave={e => e.currentTarget.style.borderColor = T.border}>
              <div style={{ fontSize:"32px", marginBottom:"8px" }}>📊</div>
              <div style={{ fontSize:"14px", fontWeight:600, color:T.text }}>Click or drag tradebook CSV here</div>
              <div style={{ fontSize:"11px", color:T.textMuted, marginTop:"4px" }}>
                Zerodha Console → Reports → Tradebook (EQ or MF)
              </div>
              <input ref={fileRef} type="file" accept=".csv,text/csv" style={{ display:"none" }}
                onChange={e => handleFile(e.target.files[0])}/>
            </div>
          )}

          {error && (
            <div style={{ padding:"10px 14px", background:`${T.red}18`, border:`1px solid ${T.red}44`,
              borderRadius:"8px", fontSize:"12px", color:T.red }}>{error}</div>
          )}

          {/* Preview */}
          {step === "preview" && (
            <>
              {/* Indian Stocks */}
              {stocks.length > 0 && (
                <div>
                  <SectionHeader label="Indian Stocks" count={stocks.length}/>
                  <div style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
                    {stocks.map(s => {
                      const sel      = selStocks.has(s.symbol);
                      const open     = expanded.has(s.symbol);
                      const existing = holdingsData.filter(h =>
                        h.type === "in_stock" && h.symbol === s.symbol && h.person === person);
                      return (
                        <div key={s.symbol}
                          style={{ borderRadius:"10px", border:`1px solid ${sel ? T.accent+"66" : T.border}`,
                            background: sel ? T.card : T.bg, overflow:"hidden", transition:"all 0.12s" }}>
                          <div style={{ padding:"11px 14px", display:"flex", alignItems:"center", gap:"12px" }}>
                            <div onClick={() => toggleStock(s.symbol)} style={{ width:"18px", height:"18px",
                              borderRadius:"5px", flexShrink:0, cursor:"pointer",
                              border:`2px solid ${sel ? T.accent : T.border}`,
                              background: sel ? T.accent : "transparent",
                              display:"flex", alignItems:"center", justifyContent:"center" }}>
                              {sel && <span style={{ color:T.bg, fontSize:"11px", fontWeight:900 }}>✓</span>}
                            </div>
                            <div style={{ flex:1, minWidth:0 }}>
                              <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                                <span style={{ fontSize:"13px", fontWeight:700, color:T.text }}>{s.symbol}</span>
                                <span style={{ fontSize:"10px", color:T.textMuted, background:T.bg,
                                  border:`1px solid ${T.border}`, borderRadius:"4px", padding:"1px 6px" }}>
                                  {s.lots.length} lot{s.lots.length!==1?"s":""}
                                </span>
                                {existing.length > 0 && (
                                  <span style={{ fontSize:"10px", color:T.amber, fontWeight:600 }}>
                                    ⟳ replaces {existing.length}
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize:"11px", color:T.textMuted, marginTop:"2px" }}>
                                {s.totalQty} shares · invested {fmt(s.totalCost)}
                              </div>
                            </div>
                            <button onClick={() => toggleExpand(s.symbol)}
                              style={{ background:"none", border:"none", color:T.textMuted,
                                cursor:"pointer", fontSize:"11px", padding:"4px 8px" }}>
                              {open ? "▲ hide" : "▼ lots"}
                            </button>
                          </div>
                          {open && (
                            <div style={{ borderTop:`1px solid ${T.border}33`, padding:"8px 14px 10px 44px",
                              display:"flex", flexDirection:"column", gap:"5px" }}>
                              {s.lots.map((lot, i) => (
                                <div key={i} style={{ display:"flex", gap:"14px", fontSize:"11px", color:T.textDim }}>
                                  <span style={{ fontFamily:"'JetBrains Mono',monospace", color:T.textMuted, minWidth:"88px" }}>{fmtDate(lot.date)}</span>
                                  <span style={{ fontFamily:"'JetBrains Mono',monospace", fontWeight:600, color:T.text }}>{lot.qty} sh</span>
                                  <span>@ {fmtPrc(lot.avgPrice)}</span>
                                  <span style={{ marginLeft:"auto", fontFamily:"'JetBrains Mono',monospace", fontWeight:600 }}>{fmt(lot.costBasisINR)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Mutual Funds */}
              {mfs.length > 0 && (
                <div>
                  <SectionHeader label="Mutual Funds" count={mfs.length}/>
                  <div style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
                    {mfs.map(f => {
                      const sel      = selMFs.has(f.isin);
                      const open     = expanded.has(f.isin);
                      const existing = holdingsData.filter(h =>
                        h.type === "mf" && h.person === person &&
                        (h.isin === f.isin || (f.schemeCode && h.schemeCode === f.schemeCode)));
                      return (
                        <div key={f.isin}
                          style={{ borderRadius:"10px", border:`1px solid ${sel ? T.accent+"66" : T.border}`,
                            background: sel ? T.card : T.bg, overflow:"hidden", transition:"all 0.12s" }}>
                          <div style={{ padding:"11px 14px", display:"flex", alignItems:"center", gap:"12px" }}>
                            <div onClick={() => toggleMF(f.isin)} style={{ width:"18px", height:"18px",
                              borderRadius:"5px", flexShrink:0, cursor:"pointer",
                              border:`2px solid ${sel ? T.accent : T.border}`,
                              background: sel ? T.accent : "transparent",
                              display:"flex", alignItems:"center", justifyContent:"center" }}>
                              {sel && <span style={{ color:T.bg, fontSize:"11px", fontWeight:900 }}>✓</span>}
                            </div>
                            <div style={{ flex:1, minWidth:0 }}>
                              <div style={{ display:"flex", alignItems:"center", gap:"8px", flexWrap:"wrap" }}>
                                <span style={{ fontSize:"12px", fontWeight:700, color:T.text,
                                  whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", maxWidth:"340px" }}>
                                  {f.name}
                                </span>
                                <span style={{ fontSize:"10px", color:T.textMuted, background:T.bg,
                                  border:`1px solid ${T.border}`, borderRadius:"4px", padding:"1px 6px", flexShrink:0 }}>
                                  {f.lots.length} SIP{f.lots.length!==1?"s":""}
                                </span>
                                {f.schemeCode
                                  ? <span style={{ fontSize:"10px", color:T.accent, fontFamily:"'JetBrains Mono',monospace" }}>
                                      #{f.schemeCode}
                                    </span>
                                  : resolving
                                    ? <span style={{ fontSize:"10px", color:T.textMuted }}>resolving…</span>
                                    : <span style={{ fontSize:"10px", color:T.amber }}>⚠ scheme code not found</span>
                                }
                                {existing.length > 0 && (
                                  <span style={{ fontSize:"10px", color:T.amber, fontWeight:600 }}>
                                    ⟳ replaces {existing.length}
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize:"11px", color:T.textMuted, marginTop:"2px" }}>
                                {fmtUnits(f.totalUnits)} units · invested {fmt(f.totalCost)}
                              </div>
                            </div>
                            <button onClick={() => toggleExpand(f.isin)}
                              style={{ background:"none", border:"none", color:T.textMuted,
                                cursor:"pointer", fontSize:"11px", padding:"4px 8px" }}>
                              {open ? "▲ hide" : "▼ lots"}
                            </button>
                          </div>
                          {open && (
                            <div style={{ borderTop:`1px solid ${T.border}33`, padding:"8px 14px 10px 44px",
                              display:"flex", flexDirection:"column", gap:"5px" }}>
                              {f.lots.map((lot, i) => (
                                <div key={i} style={{ display:"flex", gap:"14px", fontSize:"11px", color:T.textDim }}>
                                  <span style={{ fontFamily:"'JetBrains Mono',monospace", color:T.textMuted, minWidth:"88px" }}>{fmtDate(lot.date)}</span>
                                  <span style={{ fontFamily:"'JetBrains Mono',monospace", fontWeight:600, color:T.text }}>{fmtUnits(lot.qty)} units</span>
                                  <span>@ NAV {fmtPrc(lot.navPrice)}</span>
                                  <span style={{ marginLeft:"auto", fontFamily:"'JetBrains Mono',monospace", fontWeight:600 }}>{fmt(lot.costBasisINR)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding:"14px 20px", borderTop:`1px solid ${T.border}`,
          display:"flex", justifyContent:"flex-end", gap:"10px" }}>
          {step === "preview" && (
            <button onClick={() => setStep("upload")}
              style={{ padding:"9px 20px", background:"transparent", border:`1px solid ${T.border}`,
                borderRadius:"8px", color:T.textDim, fontSize:"13px", fontWeight:600, cursor:"pointer" }}>
              ← Back
            </button>
          )}
          <button onClick={onClose}
            style={{ padding:"9px 20px", background:"transparent", border:`1px solid ${T.border}`,
              borderRadius:"8px", color:T.textDim, fontSize:"13px", fontWeight:600, cursor:"pointer" }}>
            Cancel
          </button>
          {step === "preview" && totalSelected > 0 && (
            <button onClick={doImport} disabled={resolving}
              style={{ padding:"9px 24px", background:T.accent, border:"none",
                borderRadius:"8px", color:T.bg, fontSize:"13px", fontWeight:700,
                cursor: resolving ? "not-allowed" : "pointer", opacity: resolving ? 0.6 : 1 }}>
              {resolving ? "Resolving…" : `Import ${totalSelected} item${totalSelected!==1?"s":""}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
