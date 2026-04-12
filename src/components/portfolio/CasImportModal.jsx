import { useState, useRef } from "react";
import { T } from "../../lib/theme";
import { PERSONS } from "../../lib/constants";
import { genId } from "../../lib/formatters";

// ── Parse casparser JSON → flat fund list ──────────────────────────────────

const BUY_TYPES = new Set([
  "PURCHASE", "ADDITIONAL_PURCHASE", "SWITCH_IN",
  "REINVEST_DIVIDEND", "DIVIDEND_REINVESTMENT", "NEW_FUND_OFFER_PURCHASE",
]);

function computeInvested(transactions = []) {
  return transactions.reduce((sum, t) => {
    const amt = Number(t.amount || 0);
    return BUY_TYPES.has(t.type) && amt > 0 ? sum + amt : sum;
  }, 0);
}

function extractFunds(data) {
  const funds = [];
  for (const folio of data.folios || []) {
    for (const fund of folio.funds || []) {
      const units = Number(fund.close ?? fund.close_calculated ?? 0);
      if (units <= 0) continue;           // fully redeemed / zero balance
      const invested = computeInvested(fund.transactions);
      // First purchase date
      const txDates = (fund.transactions || []).map(t => t.date).filter(Boolean).sort();
      funds.push({
        _key:         `${folio.folio}-${fund.amfi || fund.isin || fund.scheme}`,
        scheme:       fund.scheme || "—",
        amc:          folio.amc  || "—",
        amfi:         fund.amfi  || "",
        isin:         fund.isin  || "",
        units,
        invested,
        nav:          fund.valuation?.nav   ?? null,
        navDate:      fund.valuation?.date  ?? null,
        currentValue: fund.valuation?.value ?? null,
        firstTxDate:  txDates[0] ?? null,
      });
    }
  }
  return funds;
}

// ── helpers ────────────────────────────────────────────────────────────────

const fmt = n => n == null ? "—" : `₹${Math.round(n).toLocaleString("en-IN")}`;
const fmtU = n => n == null ? "—" : (n % 1 === 0 ? n : n.toFixed(3).replace(/0+$/, ""));

// ── Component ──────────────────────────────────────────────────────────────

export default function CasImportModal({ holdingsData, onImport, onClose }) {
  const [funds,    setFunds]    = useState([]);
  const [person,   setPerson]   = useState("Selva");
  const [selected, setSelected] = useState(new Set());
  const [error,    setError]    = useState("");
  const [step,     setStep]     = useState("upload"); // "upload" | "preview"
  const fileRef = useRef(null);

  const handleFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data  = JSON.parse(e.target.result);
        const list  = extractFunds(data);
        if (!list.length) { setError("No active holdings found in this CAS file."); return; }
        setFunds(list);
        setSelected(new Set(list.map(f => f._key)));
        setError("");
        setStep("preview");
      } catch {
        setError("Invalid file — make sure you export casparser output as JSON (casparser.read_cas_pdf(..., output='dict') then json.dumps).");
      }
    };
    reader.readAsText(file);
  };

  const toggleAll = () =>
    setSelected(s => s.size === funds.length ? new Set() : new Set(funds.map(f => f._key)));

  const toggle = key =>
    setSelected(s => { const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n; });

  const doImport = () => {
    const items = funds
      .filter(f => selected.has(f._key))
      .map(f => ({
        id:           genId(),
        type:         "mf",
        person,
        name:         f.scheme,
        schemeCode:   f.amfi,
        units:        f.units,
        costBasisINR: f.invested || 0,
        acquisitionDate: f.firstTxDate ?? undefined,
        notes:        f.amc,
      }));
    onImport(person, items);
    onClose();
  };

  // ── styles ────────────────────────────────────────────────────────────────

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
          width:"100%", maxWidth:"760px", maxHeight:"88vh", overflow:"hidden",
          display:"flex", flexDirection:"column" }}>

        {/* Header */}
        <div style={{ padding:"16px 20px", borderBottom:`1px solid ${T.border}`,
          display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <span style={{ fontSize:"15px", fontWeight:700, color:T.text }}>Import MF Holdings from CAS</span>
            {step === "preview" && (
              <span style={{ fontSize:"11px", color:T.textMuted, marginLeft:"12px" }}>
                {selected.size} of {funds.length} selected
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
              <div style={{ fontWeight:700, color:T.text, marginBottom:"8px" }}>How to get your CAS JSON</div>
              <div>1. Install casparser: <code style={{ fontFamily:"'JetBrains Mono',monospace", color:T.accent }}>pip install casparser</code></div>
              <div>2. Run in Python:</div>
              <pre style={{ margin:"8px 0", padding:"12px", background:T.bg, borderRadius:"8px",
                fontFamily:"'JetBrains Mono',monospace", fontSize:"12px", color:T.text, overflowX:"auto" }}>{`import casparser, json
data = casparser.read_cas_pdf("your_cas.pdf", "your_password")
with open("cas.json", "w") as f:
    json.dump(data, f)`}</pre>
              <div>3. Upload the <code style={{ fontFamily:"'JetBrains Mono',monospace", color:T.accent }}>cas.json</code> file below.</div>
              <div style={{ marginTop:"8px", fontSize:"11px", color:T.textMuted }}>
                Password is usually PAN (uppercase) + DOB as DDMMYYYY, e.g. ABCDE1234F01011990
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
            <span style={{ fontSize:"11px", color:T.textMuted, marginLeft:"4px" }}>
              (run separately for each PAN)
            </span>
          </div>

          {/* File upload */}
          {step === "upload" && (
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); }}
              style={{ border:`2px dashed ${T.border}`, borderRadius:"12px", padding:"40px 20px",
                textAlign:"center", cursor:"pointer", transition:"border-color 0.15s" }}
              onMouseEnter={e => e.currentTarget.style.borderColor = T.accent}
              onMouseLeave={e => e.currentTarget.style.borderColor = T.border}>
              <div style={{ fontSize:"32px", marginBottom:"8px" }}>📂</div>
              <div style={{ fontSize:"14px", fontWeight:600, color:T.text }}>Click or drag cas.json here</div>
              <div style={{ fontSize:"11px", color:T.textMuted, marginTop:"4px" }}>JSON output from casparser</div>
              <input ref={fileRef} type="file" accept=".json,application/json" style={{ display:"none" }}
                onChange={e => handleFile(e.target.files[0])}/>
            </div>
          )}

          {error && (
            <div style={{ padding:"10px 14px", background:`${T.red}18`, border:`1px solid ${T.red}44`,
              borderRadius:"8px", fontSize:"12px", color:T.red }}>{error}</div>
          )}

          {/* Preview table */}
          {step === "preview" && (
            <>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <span style={{ fontSize:"12px", color:T.textMuted }}>
                  Existing holdings with the same scheme + person will be updated (units & cost).
                </span>
                <button onClick={toggleAll}
                  style={{ ...inp, fontSize:"11px", cursor:"pointer", padding:"4px 12px", width:"auto" }}>
                  {selected.size === funds.length ? "Deselect all" : "Select all"}
                </button>
              </div>

              <div style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
                {funds.map(f => {
                  const sel = selected.has(f._key);
                  const existing = holdingsData.find(h =>
                    h.type === "mf" && h.schemeCode === f.amfi && h.person === person
                  );
                  return (
                    <div key={f._key} onClick={() => toggle(f._key)}
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

                      {/* Fund info */}
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:"12px", fontWeight:700, color:T.text,
                          whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                          {f.scheme}
                        </div>
                        <div style={{ fontSize:"10px", color:T.textMuted, marginTop:"2px" }}>
                          {f.amc}
                          {f.amfi && <span style={{ marginLeft:"8px", color:T.textDim }}>AMFI {f.amfi}</span>}
                          {existing && (
                            <span style={{ marginLeft:"8px", color:T.amber, fontWeight:600 }}>⟳ will update</span>
                          )}
                        </div>
                      </div>

                      {/* Numbers */}
                      <div style={{ display:"flex", gap:"20px", flexShrink:0, textAlign:"right" }}>
                        <div>
                          <div style={{ fontSize:"10px", color:T.textMuted }}>Units</div>
                          <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"12px",
                            fontWeight:600, color:T.textDim }}>{fmtU(f.units)}</div>
                        </div>
                        <div>
                          <div style={{ fontSize:"10px", color:T.textMuted }}>Invested</div>
                          <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"12px",
                            fontWeight:600, color:T.textDim }}>{fmt(f.invested)}</div>
                        </div>
                        {f.currentValue != null && (
                          <div>
                            <div style={{ fontSize:"10px", color:T.textMuted }}>Value ({f.navDate})</div>
                            <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"12px",
                              fontWeight:700, color:T.accent }}>{fmt(f.currentValue)}</div>
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
              Import {selected.size} fund{selected.size !== 1 ? "s" : ""}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
