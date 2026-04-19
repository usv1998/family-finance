import { useState, useRef } from "react";
import { T } from "../../lib/theme";
import { PERSONS } from "../../lib/constants";
import { genId } from "../../lib/formatters";

// Parse Zerodha holdings CSV (exported from Console → Holdings)
// Columns: Instrument, Qty., Avg. cost, LTP, Invested, Cur. val, P&L, Net chg., Day chg.
function parseZerodhaCSV(text) {
  const lines = text.trim().split("\n").map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) throw new Error("File appears empty.");

  // Strip surrounding quotes from a cell value
  const unquote = s => s.replace(/^"(.*)"$/, "$1").trim();

  const header = lines[0].split(",").map(unquote).map(s => s.toLowerCase());
  const col = name => header.findIndex(h => h.includes(name));

  const iCol       = col("instrument");
  const qtyCol     = col("qty");
  const avgCol     = col("avg");
  const investedCol= col("invested");
  const curValCol  = col("cur. val");

  if (iCol < 0 || qtyCol < 0) throw new Error("Could not find Instrument/Qty columns. Make sure this is a Zerodha holdings CSV.");

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(",").map(unquote);
    const symbol = cells[iCol];
    if (!symbol) continue;
    const qty       = parseFloat(cells[qtyCol])      || 0;
    const avgCost   = parseFloat(cells[avgCol])      || 0;
    const invested  = parseFloat(cells[investedCol]) || (qty * avgCost);
    const curVal    = parseFloat(cells[curValCol])   || 0;
    if (qty <= 0) continue;
    rows.push({ symbol, qty, avgCost, invested, curVal });
  }
  if (!rows.length) throw new Error("No holdings rows found in file.");
  return rows;
}

const fmt    = n => n == null ? "—" : `₹${Math.round(n).toLocaleString("en-IN")}`;
const fmtAmt = n => n == null ? "—" : `₹${n.toLocaleString("en-IN", { minimumFractionDigits:2, maximumFractionDigits:2 })}`;

export default function ZerodhaImportModal({ holdingsData, onImport, onClose }) {
  const [rows,     setRows]     = useState([]);
  const [person,   setPerson]   = useState("Selva");
  const [selected, setSelected] = useState(new Set());
  const [error,    setError]    = useState("");
  const [step,     setStep]     = useState("upload");
  const fileRef = useRef(null);

  const handleFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = parseZerodhaCSV(e.target.result);
        setRows(parsed);
        setSelected(new Set(parsed.map(r => r.symbol)));
        setError("");
        setStep("preview");
      } catch (err) {
        setError(err.message);
      }
    };
    reader.readAsText(file);
  };

  const toggleAll = () =>
    setSelected(s => s.size === rows.length ? new Set() : new Set(rows.map(r => r.symbol)));

  const toggle = sym =>
    setSelected(s => { const n = new Set(s); n.has(sym) ? n.delete(sym) : n.add(sym); return n; });

  const doImport = () => {
    const items = rows
      .filter(r => selected.has(r.symbol))
      .map(r => ({
        id:           genId(),
        type:         "in_stock",
        person,
        name:         r.symbol,
        symbol:       r.symbol,
        quantity:     r.qty,
        costBasisINR: r.invested,
      }));
    onImport(person, items);
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
          width:"100%", maxWidth:"700px", maxHeight:"88vh", overflow:"hidden",
          display:"flex", flexDirection:"column" }}>

        {/* Header */}
        <div style={{ padding:"16px 20px", borderBottom:`1px solid ${T.border}`,
          display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <span style={{ fontSize:"15px", fontWeight:700, color:T.text }}>Import Indian Stocks from Zerodha</span>
            {step === "preview" && (
              <span style={{ fontSize:"11px", color:T.textMuted, marginLeft:"12px" }}>
                {selected.size} of {rows.length} selected
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
              <div>1. Open <strong style={{ color:T.text }}>Console → Holdings</strong></div>
              <div>2. Click the <strong style={{ color:T.text }}>↓ Download</strong> icon (top-right of the holdings table)</div>
              <div>3. Save the CSV file and upload it below.</div>
              <div style={{ marginTop:"8px", fontSize:"11px", color:T.textMuted }}>
                Works with the standard Zerodha Console holdings export format.
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
              <div style={{ fontSize:"14px", fontWeight:600, color:T.text }}>Click or drag holdings CSV here</div>
              <div style={{ fontSize:"11px", color:T.textMuted, marginTop:"4px" }}>Zerodha Console holdings export (.csv)</div>
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
                  Existing holdings with the same symbol + person will be updated (qty & cost).
                </span>
                <button onClick={toggleAll}
                  style={{ ...inp, fontSize:"11px", cursor:"pointer", padding:"4px 12px", width:"auto" }}>
                  {selected.size === rows.length ? "Deselect all" : "Select all"}
                </button>
              </div>

              <div style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
                {rows.map(r => {
                  const sel      = selected.has(r.symbol);
                  const existing = holdingsData.find(h =>
                    h.type === "in_stock" && h.symbol === r.symbol && h.person === person
                  );
                  const gain    = r.curVal - r.invested;
                  const gainPct = r.invested > 0 ? gain / r.invested * 100 : null;
                  const gc      = gain >= 0 ? T.accent : T.red;
                  return (
                    <div key={r.symbol} onClick={() => toggle(r.symbol)}
                      style={{ padding:"12px 14px", borderRadius:"10px", cursor:"pointer",
                        border:`1px solid ${sel ? T.accent + "66" : T.border}`,
                        background: sel ? T.card : T.bg,
                        display:"flex", alignItems:"center", gap:"12px", transition:"all 0.12s" }}>

                      {/* Checkbox */}
                      <div style={{ width:"18px", height:"18px", borderRadius:"5px", flexShrink:0,
                        border:`2px solid ${sel ? T.accent : T.border}`,
                        background: sel ? T.accent : "transparent",
                        display:"flex", alignItems:"center", justifyContent:"center" }}>
                        {sel && <span style={{ color:T.bg, fontSize:"11px", fontWeight:900 }}>✓</span>}
                      </div>

                      {/* Symbol + badge */}
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:"13px", fontWeight:700, color:T.text }}>{r.symbol}</div>
                        <div style={{ fontSize:"10px", color:T.textMuted, marginTop:"2px" }}>
                          {r.qty} shares · avg {fmtAmt(r.avgCost)}
                          {existing && (
                            <span style={{ marginLeft:"8px", color:T.amber, fontWeight:600 }}>⟳ will update</span>
                          )}
                        </div>
                      </div>

                      {/* Numbers */}
                      <div style={{ display:"flex", gap:"20px", flexShrink:0, textAlign:"right" }}>
                        <div>
                          <div style={{ fontSize:"10px", color:T.textMuted }}>Invested</div>
                          <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"12px",
                            fontWeight:600, color:T.textDim }}>{fmt(r.invested)}</div>
                        </div>
                        <div>
                          <div style={{ fontSize:"10px", color:T.textMuted }}>Cur. Value</div>
                          <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"12px",
                            fontWeight:700, color:T.accent }}>{fmt(r.curVal)}</div>
                        </div>
                        {gainPct !== null && (
                          <div>
                            <div style={{ fontSize:"10px", color:T.textMuted }}>P&amp;L</div>
                            <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"12px",
                              fontWeight:700, color:gc }}>
                              {gain >= 0 ? "+" : ""}{gainPct.toFixed(1)}%
                            </div>
                          </div>
                        )}
                      </div>
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
