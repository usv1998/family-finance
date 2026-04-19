import { useState, useRef } from "react";
import { T } from "../../lib/theme";
import { PERSONS } from "../../lib/constants";
import { genId } from "../../lib/formatters";

// Parse Zerodha tradebook CSV → lots grouped by symbol
// Columns: symbol,isin,trade_date,exchange,segment,series,trade_type,auction,quantity,price,trade_id,order_id,order_execution_time
function parseTradebook(text) {
  const lines = text.trim().split("\n").map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) throw new Error("File appears empty.");

  const unquote = s => s.replace(/^"(.*)"$/, "$1").trim();
  const header  = lines[0].split(",").map(unquote).map(s => s.toLowerCase());

  const col = name => {
    const i = header.findIndex(h => h === name);
    if (i < 0) throw new Error(`Missing column "${name}" — make sure this is a Zerodha tradebook CSV.`);
    return i;
  };

  const symCol     = col("symbol");
  const isinCol    = col("isin");
  const dateCol    = col("trade_date");
  const typeCol    = col("trade_type");
  const qtyCol     = col("quantity");
  const priceCol   = col("price");
  const orderCol   = col("order_id");

  // Aggregate rows by order_id (fills from same order share price, sum qty)
  const orderMap = {};
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(",").map(unquote);
    if (cells.length < 8) continue;
    const tradeType = cells[typeCol].toLowerCase();
    if (tradeType !== "buy") continue; // only buys become lots

    const symbol  = cells[symCol].toUpperCase();
    const isin    = cells[isinCol];
    const date    = cells[dateCol].slice(0, 10); // YYYY-MM-DD
    const qty     = parseFloat(cells[qtyCol])   || 0;
    const price   = parseFloat(cells[priceCol]) || 0;
    const orderId = cells[orderCol];

    if (qty <= 0 || price <= 0 || !symbol || !date) continue;

    const key = orderId || `${symbol}-${date}-${price}`;
    if (!orderMap[key]) {
      orderMap[key] = { symbol, isin, date, totalQty: 0, totalValue: 0 };
    }
    orderMap[key].totalQty   += qty;
    orderMap[key].totalValue += qty * price;
  }

  // Build lots, group by symbol
  const bySymbol = {};
  for (const lot of Object.values(orderMap)) {
    if (lot.totalQty <= 0) continue;
    const avgPrice = lot.totalValue / lot.totalQty;
    if (!bySymbol[lot.symbol]) bySymbol[lot.symbol] = { symbol: lot.symbol, isin: lot.isin, lots: [] };
    bySymbol[lot.symbol].lots.push({
      date:        lot.date,
      qty:         lot.totalQty,
      avgPrice,
      costBasisINR: lot.totalValue,
    });
  }

  // Sort lots by date within each symbol
  for (const s of Object.values(bySymbol)) {
    s.lots.sort((a, b) => a.date.localeCompare(b.date));
    s.totalQty  = s.lots.reduce((sum, l) => sum + l.qty,          0);
    s.totalCost = s.lots.reduce((sum, l) => sum + l.costBasisINR, 0);
  }

  const result = Object.values(bySymbol);
  if (!result.length) throw new Error("No buy trades found in this file.");
  return result;
}

const fmt    = n => n == null ? "—" : `₹${Math.round(n).toLocaleString("en-IN")}`;
const fmtPrc = n => n == null ? "—" : `₹${n.toLocaleString("en-IN", { minimumFractionDigits:2, maximumFractionDigits:2 })}`;
const fmtDate = d => new Date(d).toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" });

export default function TradebookImportModal({ holdingsData, onReplaceStockLots, onClose }) {
  const [stocks,   setStocks]   = useState([]);
  const [person,   setPerson]   = useState("Selva");
  const [selected, setSelected] = useState(new Set());
  const [expanded, setExpanded] = useState(new Set());
  const [error,    setError]    = useState("");
  const [step,     setStep]     = useState("upload");
  const fileRef = useRef(null);

  const handleFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = parseTradebook(e.target.result);
        setStocks(parsed);
        setSelected(new Set(parsed.map(s => s.symbol)));
        setExpanded(new Set());
        setError("");
        setStep("preview");
      } catch (err) {
        setError(err.message);
      }
    };
    reader.readAsText(file);
  };

  const toggleAll = () =>
    setSelected(s => s.size === stocks.length ? new Set() : new Set(stocks.map(s => s.symbol)));

  const toggle = sym =>
    setSelected(s => { const n = new Set(s); n.has(sym) ? n.delete(sym) : n.add(sym); return n; });

  const toggleExpand = sym =>
    setExpanded(s => { const n = new Set(s); n.has(sym) ? n.delete(sym) : n.add(sym); return n; });

  const doImport = () => {
    const toImport = stocks.filter(s => selected.has(s.symbol));
    onReplaceStockLots(person, toImport);
    onClose();
  };

  const inp = {
    padding:"8px 12px", background:T.bg, border:`1px solid ${T.border}`,
    borderRadius:"8px", color:T.text, fontSize:"13px", outline:"none",
  };

  return (
    <div onClick={onClose}
      style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.78)", zIndex:2000,
        display:"flex", alignItems:"center", justifyContent:"center", padding:"20px" }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background:T.surface, borderRadius:"16px", border:`1px solid ${T.border}`,
          width:"100%", maxWidth:"720px", maxHeight:"88vh", overflow:"hidden",
          display:"flex", flexDirection:"column" }}>

        {/* Header */}
        <div style={{ padding:"16px 20px", borderBottom:`1px solid ${T.border}`,
          display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <span style={{ fontSize:"15px", fontWeight:700, color:T.text }}>Import Indian Stocks from Zerodha Tradebook</span>
            {step === "preview" && (
              <span style={{ fontSize:"11px", color:T.textMuted, marginLeft:"12px" }}>
                {selected.size} of {stocks.length} stocks selected
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
              <div>2. Select segment <strong style={{ color:T.text }}>Equity</strong>, set the date range</div>
              <div>3. Click <strong style={{ color:T.text }}>Download</strong> → save the CSV</div>
              <div style={{ marginTop:"8px", fontSize:"11px", color:T.textMuted }}>
                All buy trades are grouped into lots by order. Existing lots for selected stocks will be replaced.
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
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); }}
              style={{ border:`2px dashed ${T.border}`, borderRadius:"12px", padding:"40px 20px",
                textAlign:"center", cursor:"pointer", transition:"border-color 0.15s" }}
              onMouseEnter={e => e.currentTarget.style.borderColor = T.accent}
              onMouseLeave={e => e.currentTarget.style.borderColor = T.border}>
              <div style={{ fontSize:"32px", marginBottom:"8px" }}>📊</div>
              <div style={{ fontSize:"14px", fontWeight:600, color:T.text }}>Click or drag tradebook CSV here</div>
              <div style={{ fontSize:"11px", color:T.textMuted, marginTop:"4px" }}>
                Zerodha Console → Reports → Tradebook → Download
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
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <span style={{ fontSize:"12px", color:T.textMuted }}>
                  All lots for selected stocks will replace existing holdings for that symbol + person.
                </span>
                <button onClick={toggleAll}
                  style={{ ...inp, fontSize:"11px", cursor:"pointer", padding:"4px 12px", width:"auto" }}>
                  {selected.size === stocks.length ? "Deselect all" : "Select all"}
                </button>
              </div>

              <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
                {stocks.map(s => {
                  const sel      = selected.has(s.symbol);
                  const open     = expanded.has(s.symbol);
                  const existing = holdingsData.filter(h =>
                    h.type === "in_stock" && h.symbol === s.symbol && h.person === person
                  );
                  return (
                    <div key={s.symbol}
                      style={{ borderRadius:"10px", border:`1px solid ${sel ? T.accent + "66" : T.border}`,
                        background: sel ? T.card : T.bg, overflow:"hidden", transition:"all 0.12s" }}>

                      {/* Stock row */}
                      <div style={{ padding:"12px 14px", display:"flex", alignItems:"center", gap:"12px" }}>
                        {/* Checkbox */}
                        <div onClick={() => toggle(s.symbol)} style={{ width:"18px", height:"18px",
                          borderRadius:"5px", flexShrink:0, cursor:"pointer",
                          border:`2px solid ${sel ? T.accent : T.border}`,
                          background: sel ? T.accent : "transparent",
                          display:"flex", alignItems:"center", justifyContent:"center" }}>
                          {sel && <span style={{ color:T.bg, fontSize:"11px", fontWeight:900 }}>✓</span>}
                        </div>

                        {/* Symbol + lot count */}
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                            <span style={{ fontSize:"13px", fontWeight:700, color:T.text }}>{s.symbol}</span>
                            <span style={{ fontSize:"10px", color:T.textMuted, background:T.bg,
                              border:`1px solid ${T.border}`, borderRadius:"4px", padding:"1px 6px" }}>
                              {s.lots.length} lot{s.lots.length !== 1 ? "s" : ""}
                            </span>
                            {existing.length > 0 && (
                              <span style={{ fontSize:"10px", color:T.amber, fontWeight:600 }}>
                                ⟳ replaces {existing.length} existing
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize:"11px", color:T.textMuted, marginTop:"2px" }}>
                            {s.totalQty} shares · invested {fmt(s.totalCost)}
                          </div>
                        </div>

                        {/* Expand lots */}
                        <button onClick={() => toggleExpand(s.symbol)}
                          style={{ background:"none", border:"none", color:T.textMuted,
                            cursor:"pointer", fontSize:"12px", padding:"4px 8px", flexShrink:0 }}>
                          {open ? "▲ hide" : "▼ lots"}
                        </button>
                      </div>

                      {/* Lot detail rows */}
                      {open && (
                        <div style={{ borderTop:`1px solid ${T.border}33`, padding:"8px 14px 12px 44px",
                          display:"flex", flexDirection:"column", gap:"6px" }}>
                          {s.lots.map((lot, i) => (
                            <div key={i} style={{ display:"flex", alignItems:"center", gap:"16px",
                              fontSize:"12px", color:T.textDim }}>
                              <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"11px",
                                color:T.textMuted, minWidth:"90px" }}>{fmtDate(lot.date)}</span>
                              <span style={{ fontFamily:"'JetBrains Mono',monospace", fontWeight:600,
                                color:T.text }}>{lot.qty} shares</span>
                              <span style={{ color:T.textMuted }}>@ {fmtPrc(lot.avgPrice)}</span>
                              <span style={{ marginLeft:"auto", fontFamily:"'JetBrains Mono',monospace",
                                fontWeight:600, color:T.textDim }}>{fmt(lot.costBasisINR)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
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
          {step === "preview" && selected.size > 0 && (
            <button onClick={doImport}
              style={{ padding:"9px 24px", background:T.accent, border:"none",
                borderRadius:"8px", color:T.bg, fontSize:"13px", fontWeight:700, cursor:"pointer" }}>
              Import {selected.size} stock{selected.size !== 1 ? "s" : ""}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
