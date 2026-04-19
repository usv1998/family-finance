import { useState, useRef, useEffect, useCallback } from "react";
import { T } from "../../lib/theme";
import { PERSONS } from "../../lib/constants";
import { genId } from "../../lib/formatters";

// ── parser ─────────────────────────────────────────────────────────────────

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

  const symCol   = col("symbol");
  const isinCol  = col("isin");
  const dateCol  = col("trade_date");
  const segCol   = col("segment");
  const typeCol  = col("trade_type");
  const qtyCol   = col("quantity");
  const priceCol = col("price");
  const orderCol = col("order_id");

  const stockOrders = {};
  const mfByIsin    = {};

  // Collect buys and sells separately
  const stockBuyOrders = {}; // orderId → aggregated buy lot
  const stockSells     = {}; // symbol  → [{ date, qty }]
  const mfBuyByIsin    = {}; // isin    → { name, lots[] }
  const mfSellByIsin   = {}; // isin    → [{ date, qty }]

  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(",").map(unquote);
    if (cells.length < 8) continue;

    const tradeType = cells[typeCol].toLowerCase();
    if (tradeType !== "buy" && tradeType !== "sell") continue;

    const segment = (cells[segCol] || "").toUpperCase();
    const isin    = cells[isinCol];
    const date    = cells[dateCol].slice(0, 10);
    const qty     = parseFloat(cells[qtyCol])   || 0;
    const price   = parseFloat(cells[priceCol]) || 0;
    if (qty <= 0 || !date) continue;

    if (segment === "MF") {
      const rawName = cells[symCol];
      if (tradeType === "buy") {
        if (!mfBuyByIsin[isin]) mfBuyByIsin[isin] = { isin, name: rawName, lots: [] };
        if (rawName.length < mfBuyByIsin[isin].name.length) mfBuyByIsin[isin].name = rawName;
        mfBuyByIsin[isin].lots.push({ date, qty, navPrice: price, costBasisINR: qty * price });
      } else {
        if (!mfSellByIsin[isin]) mfSellByIsin[isin] = [];
        mfSellByIsin[isin].push({ date, qty });
      }
    } else {
      const symbol  = cells[symCol].toUpperCase();
      const orderId = cells[orderCol] || `${symbol}-${date}-${price}`;
      if (tradeType === "buy") {
        if (!stockBuyOrders[orderId]) stockBuyOrders[orderId] = { symbol, isin, date, totalQty:0, totalValue:0 };
        stockBuyOrders[orderId].totalQty   += qty;
        stockBuyOrders[orderId].totalValue += qty * price;
      } else {
        if (!stockSells[symbol]) stockSells[symbol] = [];
        stockSells[symbol].push({ date, qty });
      }
    }
  }

  const bySymbol = {};
  for (const o of Object.values(stockBuyOrders)) {
    if (!bySymbol[o.symbol]) bySymbol[o.symbol] = { symbol:o.symbol, isin:o.isin, lots:[], sells:[] };
    bySymbol[o.symbol].lots.push({
      date: o.date, qty: o.totalQty,
      avgPrice: o.totalValue / o.totalQty,
      costBasisINR: o.totalValue,
    });
  }
  for (const [sym, sells] of Object.entries(stockSells)) {
    if (!bySymbol[sym]) bySymbol[sym] = { symbol:sym, isin:"", lots:[], sells:[] };
    bySymbol[sym].sells.push(...sells);
  }

  const mfList = Object.values(mfBuyByIsin).map(f => {
    f.lots.sort((a,b) => a.date.localeCompare(b.date));
    return { ...f,
      sells: mfSellByIsin[f.isin] || [],
      totalUnits: f.lots.reduce((s,l) => s + l.qty, 0),
      totalCost:  f.lots.reduce((s,l) => s + l.costBasisINR, 0),
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

// Search mfapi by query string → [{schemeCode, schemeName}]
async function searchMFApi(query) {
  try {
    const res = await fetch(`https://api.mfapi.in/mf/search?q=${encodeURIComponent(query)}`);
    if (!res.ok) return [];
    return await res.json();
  } catch { return []; }
}

// Auto-resolve: pick best keywords from fund name and search
async function autoResolve(name) {
  // Strip common trailing suffixes, take first meaningful chunk
  const cleaned = name
    .replace(/[-–]\s*(direct plan|regular plan|growth|idcw|dividend).*/gi, "")
    .trim();
  const words = cleaned.split(/\s+/).slice(0, 4).join(" ");
  const results = await searchMFApi(words);
  // Prefer Direct Plan Growth match
  const direct = results.find(r => /direct/i.test(r.schemeName) && /growth/i.test(r.schemeName));
  return { results, picked: direct || results[0] || null };
}

// ── helpers ────────────────────────────────────────────────────────────────

const fmt     = n => n == null ? "—" : `₹${Math.round(n).toLocaleString("en-IN")}`;
const fmtPrc  = n => n == null ? "—" : `₹${n.toLocaleString("en-IN", { minimumFractionDigits:2, maximumFractionDigits:2 })}`;
const fmtDate = d => new Date(d).toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" });
const fmtU    = n => n == null ? "—" : (n % 1 === 0 ? String(n) : n.toFixed(3).replace(/0+$/,""));

// ── MF scheme resolver row ─────────────────────────────────────────────────

function MFResolveRow({ fund, mapping, onSetMapping }) {
  const [query,   setQuery]   = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [open,    setOpen]    = useState(false);
  const debounceRef = useRef(null);

  // Run initial auto-resolve once
  useEffect(() => {
    autoResolve(fund.name).then(({ results: r, picked }) => {
      setResults(r);
      if (picked && !mapping) onSetMapping({ schemeCode: String(picked.schemeCode), schemeName: picked.schemeName });
    });
  }, [fund.isin]);

  const handleSearch = (q) => {
    setQuery(q);
    clearTimeout(debounceRef.current);
    if (!q.trim()) { setResults([]); return; }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      const r = await searchMFApi(q);
      setResults(r);
      setSearching(false);
      setOpen(true);
    }, 350);
  };

  const pick = (r) => {
    onSetMapping({ schemeCode: String(r.schemeCode), schemeName: r.schemeName });
    setOpen(false);
    setQuery("");
  };

  const matched = mapping;

  return (
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"12px", alignItems:"start",
      padding:"10px 0", borderBottom:`1px solid ${T.border}33` }}>

      {/* Left: tradebook name */}
      <div>
        <div style={{ fontSize:"12px", fontWeight:600, color:T.text, lineHeight:1.4 }}>{fund.name}</div>
        <div style={{ fontSize:"10px", color:T.textMuted, marginTop:"3px" }}>
          {fmtU(fund.totalUnits)} units · {fmt(fund.totalCost)} · {fund.lots.length} SIP{fund.lots.length!==1?"s":""}
        </div>
        <div style={{ fontSize:"10px", color:T.textMuted, fontFamily:"'JetBrains Mono',monospace", marginTop:"1px" }}>{fund.isin}</div>
      </div>

      {/* Right: matched fund + search override */}
      <div style={{ position:"relative" }}>
        {matched ? (
          <div style={{ padding:"8px 10px", borderRadius:"8px", background:T.card,
            border:`1px solid ${T.accent}44`, marginBottom:"6px" }}>
            <div style={{ fontSize:"11px", fontWeight:600, color:T.accent, lineHeight:1.4 }}>{matched.schemeName}</div>
            <div style={{ fontSize:"10px", color:T.textMuted, fontFamily:"'JetBrains Mono',monospace", marginTop:"2px" }}>
              #{matched.schemeCode}
            </div>
          </div>
        ) : (
          <div style={{ padding:"8px 10px", borderRadius:"8px", background:`${T.amber}12`,
            border:`1px solid ${T.amber}44`, marginBottom:"6px", fontSize:"11px", color:T.amber }}>
            No match found — search below
          </div>
        )}

        {/* Search box */}
        <div style={{ position:"relative" }}>
          <input
            value={query}
            onChange={e => handleSearch(e.target.value)}
            onFocus={() => results.length > 0 && setOpen(true)}
            placeholder="Search to change…"
            style={{ width:"100%", padding:"6px 10px", background:T.bg, border:`1px solid ${T.border}`,
              borderRadius:"7px", color:T.text, fontSize:"11px", outline:"none", boxSizing:"border-box" }}/>
          {searching && (
            <span style={{ position:"absolute", right:"8px", top:"7px", fontSize:"10px", color:T.textMuted }}>…</span>
          )}
        </div>

        {/* Dropdown */}
        {open && results.length > 0 && (
          <div style={{ position:"absolute", top:"100%", left:0, right:0, zIndex:100,
            background:T.surface, border:`1px solid ${T.border}`, borderRadius:"8px",
            maxHeight:"180px", overflowY:"auto", marginTop:"2px", boxShadow:"0 8px 24px rgba(0,0,0,0.4)" }}>
            {results.slice(0, 20).map(r => (
              <div key={r.schemeCode} onClick={() => pick(r)}
                style={{ padding:"8px 12px", cursor:"pointer", borderBottom:`1px solid ${T.border}22`,
                  fontSize:"11px", color:T.text, lineHeight:1.4 }}
                onMouseEnter={e => e.currentTarget.style.background = T.card}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                <div>{r.schemeName}</div>
                <div style={{ fontSize:"10px", color:T.textMuted, fontFamily:"'JetBrains Mono',monospace" }}>
                  #{r.schemeCode}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── main component ─────────────────────────────────────────────────────────

export default function TradebookImportModal({ holdingsData, onReplaceStockLots, onReplaceMFLots, onClose }) {
  const [stocks,    setStocks]    = useState([]);
  const [mfs,       setMFs]       = useState([]);
  const [person,    setPerson]    = useState("Selva");
  const [selStocks, setSelStocks] = useState(new Set());
  const [selMFs,    setSelMFs]    = useState(new Set());
  const [expanded,  setExpanded]  = useState(new Set());
  // mfMappings: { [isin]: { schemeCode, schemeName } }
  const [mfMappings, setMfMappings] = useState({});
  const [error,     setError]     = useState("");
  // steps: "upload" | "resolve" (MF mapping table) | "preview"
  const [step,      setStep]      = useState("upload");
  const fileRef = useRef(null);

  const handleFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const { stocks: s, mfs: m } = parseTradebook(e.target.result);
        setStocks(s);
        setMFs(m);
        setSelStocks(new Set(s.map(x => x.symbol)));
        setSelMFs(new Set(m.map(x => x.isin)));
        setMfMappings({});
        setExpanded(new Set());
        setError("");
        // If MFs present, go to resolve step first; else straight to preview
        setStep(m.length > 0 ? "resolve" : "preview");
      } catch (err) {
        setError(err.message);
      }
    };
    reader.readAsText(file);
  };

  const setMapping = (isin, mapping) =>
    setMfMappings(prev => ({ ...prev, [isin]: mapping }));

  const toggleExpand = key =>
    setExpanded(s => { const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n; });

  const toggleStock = sym =>
    setSelStocks(s => { const n = new Set(s); n.has(sym) ? n.delete(sym) : n.add(sym); return n; });

  const toggleMF = isin =>
    setSelMFs(s => { const n = new Set(s); n.has(isin) ? n.delete(isin) : n.add(isin); return n; });

  const totalSelected = selStocks.size + selMFs.size;

  const doImport = () => {
    if (selStocks.size > 0)
      onReplaceStockLots(person, stocks.filter(s => selStocks.has(s.symbol)));
    if (selMFs.size > 0) {
      const toImport = mfs
        .filter(f => selMFs.has(f.isin))
        .map(f => ({ ...f, ...(mfMappings[f.isin] || {}) }));
      onReplaceMFLots(person, toImport);
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

  const stepLabel = { upload:"Upload", resolve:"Match Funds", preview:"Confirm" };

  return (
    <div onClick={onClose}
      style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.78)", zIndex:2000,
        display:"flex", alignItems:"center", justifyContent:"center", padding:"20px" }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background:T.surface, borderRadius:"16px", border:`1px solid ${T.border}`,
          width:"100%", maxWidth:"820px", maxHeight:"90vh", overflow:"hidden",
          display:"flex", flexDirection:"column" }}>

        {/* Header */}
        <div style={{ padding:"16px 20px", borderBottom:`1px solid ${T.border}`,
          display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div style={{ display:"flex", alignItems:"center", gap:"16px" }}>
            <span style={{ fontSize:"15px", fontWeight:700, color:T.text }}>Import from Zerodha Tradebook</span>
            {/* Step pills */}
            <div style={{ display:"flex", gap:"4px" }}>
              {["upload","resolve","preview"].map((s, i) => (
                <span key={s} style={{ fontSize:"10px", fontWeight:600, padding:"2px 8px", borderRadius:"4px",
                  background: step === s ? T.accent : T.card,
                  color:      step === s ? T.bg     : T.textMuted }}>
                  {i+1}. {stepLabel[s]}
                </span>
              ))}
            </div>
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none", color:T.textMuted,
            fontSize:"22px", cursor:"pointer", padding:"0 4px" }}>×</button>
        </div>

        <div style={{ overflowY:"auto", padding:"20px", display:"flex", flexDirection:"column", gap:"16px", flex:1 }}>

          {/* Person selector — always visible */}
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

          {/* ── STEP 1: Upload ── */}
          {step === "upload" && (
            <>
              <div style={{ background:T.card, borderRadius:"10px", padding:"14px 16px",
                border:`1px solid ${T.border}`, fontSize:"12px", color:T.textDim, lineHeight:1.7 }}>
                <div style={{ fontWeight:700, color:T.text, marginBottom:"6px" }}>How to export from Zerodha</div>
                <div>Console → Reports → Tradebook → select <strong style={{ color:T.text }}>Equity</strong> or <strong style={{ color:T.text }}>Mutual Fund</strong> → Download</div>
              </div>
              <div onClick={() => fileRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); }}
                style={{ border:`2px dashed ${T.border}`, borderRadius:"12px", padding:"40px 20px",
                  textAlign:"center", cursor:"pointer", transition:"border-color 0.15s" }}
                onMouseEnter={e => e.currentTarget.style.borderColor = T.accent}
                onMouseLeave={e => e.currentTarget.style.borderColor = T.border}>
                <div style={{ fontSize:"32px", marginBottom:"8px" }}>📊</div>
                <div style={{ fontSize:"14px", fontWeight:600, color:T.text }}>Click or drag tradebook CSV here</div>
                <input ref={fileRef} type="file" accept=".csv,text/csv" style={{ display:"none" }}
                  onChange={e => handleFile(e.target.files[0])}/>
              </div>
            </>
          )}

          {error && (
            <div style={{ padding:"10px 14px", background:`${T.red}18`, border:`1px solid ${T.red}44`,
              borderRadius:"8px", fontSize:"12px", color:T.red }}>{error}</div>
          )}

          {/* ── STEP 2: MF Fund Matching ── */}
          {step === "resolve" && (
            <>
              <div style={{ background:`${T.amber}10`, border:`1px solid ${T.amber}33`, borderRadius:"10px",
                padding:"10px 14px", fontSize:"12px", color:T.textDim, lineHeight:1.5 }}>
                <strong style={{ color:T.amber }}>Verify fund matches</strong> — auto-matched using fund name keywords.
                Search and pick the correct fund if the match looks wrong.
              </div>

              {/* Column headers */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"12px",
                padding:"6px 0", borderBottom:`1px solid ${T.border}` }}>
                <div style={{ fontSize:"10px", fontWeight:700, color:T.textMuted, letterSpacing:"0.5px" }}>
                  TRADEBOOK FUND NAME
                </div>
                <div style={{ fontSize:"10px", fontWeight:700, color:T.textMuted, letterSpacing:"0.5px" }}>
                  MATCHED FUND (tap to change)
                </div>
              </div>

              {mfs.map(f => (
                <MFResolveRow
                  key={f.isin}
                  fund={f}
                  mapping={mfMappings[f.isin]}
                  onSetMapping={m => setMapping(f.isin, m)}/>
              ))}
            </>
          )}

          {/* ── STEP 3: Preview ── */}
          {step === "preview" && (
            <>
              {stocks.length > 0 && (
                <div>
                  <SectionHeader label="Indian Stocks" count={stocks.length}/>
                  <div style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
                    {stocks.map(s => {
                      const sel  = selStocks.has(s.symbol);
                      const open = expanded.has(s.symbol);
                      const existing = holdingsData.filter(h =>
                        h.type === "in_stock" && h.symbol === s.symbol && h.person === person);
                      return (
                        <div key={s.symbol}
                          style={{ borderRadius:"10px", border:`1px solid ${sel ? T.accent+"66" : T.border}`,
                            background: sel ? T.card : T.bg, overflow:"hidden" }}>
                          <div style={{ padding:"11px 14px", display:"flex", alignItems:"center", gap:"12px" }}>
                            <div onClick={() => toggleStock(s.symbol)}
                              style={{ width:"18px", height:"18px", borderRadius:"5px", flexShrink:0,
                                cursor:"pointer", border:`2px solid ${sel ? T.accent : T.border}`,
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
                                  <span style={{ fontSize:"10px", color:T.amber, fontWeight:600 }}>+ merges with {existing.length} existing</span>
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

              {mfs.length > 0 && (
                <div>
                  <SectionHeader label="Mutual Funds" count={mfs.length}/>
                  <div style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
                    {mfs.map(f => {
                      const sel     = selMFs.has(f.isin);
                      const open    = expanded.has(f.isin);
                      const mapped  = mfMappings[f.isin];
                      const existing = holdingsData.filter(h =>
                        h.type === "mf" && h.person === person &&
                        (h.isin === f.isin || (mapped?.schemeCode && h.schemeCode === mapped.schemeCode)));
                      return (
                        <div key={f.isin}
                          style={{ borderRadius:"10px", border:`1px solid ${sel ? T.accent+"66" : T.border}`,
                            background: sel ? T.card : T.bg, overflow:"hidden" }}>
                          <div style={{ padding:"11px 14px", display:"flex", alignItems:"center", gap:"12px" }}>
                            <div onClick={() => toggleMF(f.isin)}
                              style={{ width:"18px", height:"18px", borderRadius:"5px", flexShrink:0,
                                cursor:"pointer", border:`2px solid ${sel ? T.accent : T.border}`,
                                background: sel ? T.accent : "transparent",
                                display:"flex", alignItems:"center", justifyContent:"center" }}>
                              {sel && <span style={{ color:T.bg, fontSize:"11px", fontWeight:900 }}>✓</span>}
                            </div>
                            <div style={{ flex:1, minWidth:0 }}>
                              <div style={{ display:"flex", alignItems:"center", gap:"8px", flexWrap:"wrap" }}>
                                <span style={{ fontSize:"12px", fontWeight:700, color:T.text }}>
                                  {mapped?.schemeName || f.name}
                                </span>
                                {mapped?.schemeCode && (
                                  <span style={{ fontSize:"10px", color:T.accent, fontFamily:"'JetBrains Mono',monospace" }}>
                                    #{mapped.schemeCode}
                                  </span>
                                )}
                                {!mapped && (
                                  <span style={{ fontSize:"10px", color:T.amber }}>⚠ unmatched</span>
                                )}
                                <span style={{ fontSize:"10px", color:T.textMuted, background:T.bg,
                                  border:`1px solid ${T.border}`, borderRadius:"4px", padding:"1px 6px" }}>
                                  {f.lots.length} SIP{f.lots.length!==1?"s":""}
                                </span>
                                {existing.length > 0 && (
                                  <span style={{ fontSize:"10px", color:T.amber, fontWeight:600 }}>+ merges with {existing.length} existing</span>
                                )}
                              </div>
                              <div style={{ fontSize:"11px", color:T.textMuted, marginTop:"2px" }}>
                                {fmtU(f.totalUnits)} units · invested {fmt(f.totalCost)}
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
                                  <span style={{ fontFamily:"'JetBrains Mono',monospace", fontWeight:600, color:T.text }}>{fmtU(lot.qty)} units</span>
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
          display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            {step === "resolve" && (
              <button onClick={() => setStep("upload")}
                style={{ padding:"9px 18px", background:"transparent", border:`1px solid ${T.border}`,
                  borderRadius:"8px", color:T.textDim, fontSize:"13px", fontWeight:600, cursor:"pointer" }}>
                ← Back
              </button>
            )}
            {step === "preview" && (
              <button onClick={() => setStep(mfs.length > 0 ? "resolve" : "upload")}
                style={{ padding:"9px 18px", background:"transparent", border:`1px solid ${T.border}`,
                  borderRadius:"8px", color:T.textDim, fontSize:"13px", fontWeight:600, cursor:"pointer" }}>
                ← Back
              </button>
            )}
          </div>
          <div style={{ display:"flex", gap:"10px" }}>
            <button onClick={onClose}
              style={{ padding:"9px 18px", background:"transparent", border:`1px solid ${T.border}`,
                borderRadius:"8px", color:T.textDim, fontSize:"13px", fontWeight:600, cursor:"pointer" }}>
              Cancel
            </button>
            {step === "resolve" && (
              <button onClick={() => setStep("preview")}
                style={{ padding:"9px 24px", background:T.accent, border:"none",
                  borderRadius:"8px", color:T.bg, fontSize:"13px", fontWeight:700, cursor:"pointer" }}>
                Looks good →
              </button>
            )}
            {step === "preview" && totalSelected > 0 && (
              <button onClick={doImport}
                style={{ padding:"9px 24px", background:T.accent, border:"none",
                  borderRadius:"8px", color:T.bg, fontSize:"13px", fontWeight:700, cursor:"pointer" }}>
                Import {totalSelected} item{totalSelected!==1?"s":""}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
