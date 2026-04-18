import { useState } from "react";
import { T } from "../../lib/theme";
import { fmtINR, fmtUSD } from "../../lib/formatters";
import { getCurrentValueINR, getGainINR, calcFDValue } from "../../lib/priceService";
import { holdingXIRR } from "../../lib/xirr";
import { TYPE_META } from "./AddHoldingForm";

function Badge({ label, color }) {
  return (
    <span style={{ fontSize:"10px", fontWeight:700, padding:"2px 8px", borderRadius:"10px",
      background:`${color}22`, color, letterSpacing:"0.3px" }}>{label}</span>
  );
}

export default function HoldingCard({ holding, priceMap, usdinr, onDelete, onUpdateBalance, onDeleteDerived }) {
  const [editBal, setEditBal] = useState(false);
  const [balDraft, setBalDraft] = useState(holding.balance || 0);

  const currentValue = getCurrentValueINR(holding, priceMap, usdinr);
  const gain         = getGainINR(holding, currentValue);
  const gainPct      = gain !== null && holding.costBasisINR > 0
    ? (gain / holding.costBasisINR) * 100 : null;
  const xirrRate     = holdingXIRR(holding, currentValue);

  const personColor  = holding.person === "Selva" ? T.selva : holding.person === "Akshaya" ? T.akshaya : T.purple;
  const typeColor    = TYPE_META[holding.type]?.color || T.textDim;
  const typeLabel    = TYPE_META[holding.type]?.label || holding.type;
  const gainColor    = gain !== null ? (gain >= 0 ? T.accent : T.red) : T.textMuted;
  const isLiveType   = holding.type === "us_stock" || holding.type === "in_stock" || holding.type === "mf";
  const hasLive      = isLiveType && currentValue !== null;
  const isLoading    = isLiveType && currentValue === null;

  // Display name stripped of .NS/.BO for Indian stocks
  const displaySymbol = holding.symbol?.replace(/\.(NS|BO)$/i, "") || "";

  return (
    <div style={{ background:T.surface, borderRadius:"12px", border:`1px solid ${T.border}`,
      padding:"16px 20px", display:"flex", justifyContent:"space-between",
      alignItems:"flex-start", flexWrap:"wrap", gap:"12px" }}>

      {/* Left: identity + details */}
      <div style={{ flex:"1 1 200px", minWidth:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:"8px", flexWrap:"wrap", marginBottom:"6px" }}>
          <Badge label={holding.person} color={personColor}/>
          <Badge label={typeLabel} color={typeColor}/>
          {holding.derived && (
            <Badge label={holding.source === "rsu" ? "RSU" : holding.source === "espp" ? "ESPP" : "AUTO"} color={T.purple}/>
          )}
          {holding.type === "fd" && holding.maturityDate && (
            <Badge label={`Matures ${new Date(holding.maturityDate).toLocaleDateString("en-IN",{month:"short",year:"numeric"})}`} color={T.textMuted}/>
          )}
        </div>
        <div style={{ fontSize:"14px", fontWeight:700, color:T.text, marginBottom:"2px" }}>
          {holding.name}
          {displaySymbol && holding.name !== displaySymbol && (
            <span style={{ fontSize:"12px", color:T.textMuted, marginLeft:"6px", fontFamily:"'JetBrains Mono',monospace" }}>
              {displaySymbol}
            </span>
          )}
        </div>

        {/* Details line */}
        <div style={{ fontSize:"11px", color:T.textMuted, marginTop:"4px" }}>
          {(holding.type === "us_stock" || holding.type === "in_stock") && (
            <span>{holding.quantity} shares
              {priceMap?.[holding.symbol] && (
                <span style={{ marginLeft:"6px" }}>
                  @ {holding.type === "us_stock"
                    ? fmtUSD(priceMap[holding.symbol])
                    : fmtINR(priceMap[holding.symbol])}
                  {holding.type === "us_stock" && (
                    <span style={{ color:T.textMuted }}> × ₹{usdinr?.toFixed(2)}</span>
                  )}
                </span>
              )}
            </span>
          )}
          {holding.type === "mf" && (
            <span>{holding.units?.toLocaleString("en-IN", {maximumFractionDigits:3})} units
              {priceMap?.[holding.schemeCode] && (
                <span style={{ marginLeft:"6px" }}>@ NAV {fmtINR(priceMap[holding.schemeCode])}</span>
              )}
            </span>
          )}
          {holding.type === "fd" && (
            <span>{fmtINR(holding.principal)} @ {holding.interestRate}% p.a. (quarterly compounding)</span>
          )}
          {(holding.type === "epf" || holding.type === "ppf") && (
            <span>Balance updated manually</span>
          )}
        </div>

        {holding.acquisitionDate && (
          <div style={{ fontSize:"11px", color:T.textMuted, marginTop:"4px" }}>
            acquired {new Date(holding.acquisitionDate).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"})}
            {holding.acquisitionPrice && holding.acquisitionCurrency && (
              <span style={{ marginLeft:"6px" }}>
                @ {holding.acquisitionCurrency === "USD"
                  ? `$${holding.acquisitionPrice}`
                  : `₹${Number(holding.acquisitionPrice).toLocaleString("en-IN")}`}
                {holding.acquisitionCurrency === "USD" && holding.acquisitionUSDINR && (
                  <span style={{ color:T.textMuted }}> × ₹{holding.acquisitionUSDINR}</span>
                )}
              </span>
            )}
          </div>
        )}
        {holding.notes && (
          <div style={{ fontSize:"11px", color:T.textMuted, marginTop:"4px", fontStyle:"italic" }}>
            {holding.notes}
          </div>
        )}
      </div>

      {/* Right: value + gain + actions */}
      <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:"4px", flexShrink:0 }}>
        {/* Current value */}
        {(holding.type === "epf" || holding.type === "ppf") ? (
          editBal ? (
            <div style={{ display:"flex", gap:"6px", alignItems:"center" }}>
              <input type="number" value={balDraft} onChange={e=>setBalDraft(Number(e.target.value))}
                style={{ width:"110px", padding:"4px 8px", background:T.card, border:`1px solid ${T.accent}`,
                  borderRadius:"6px", color:T.text, fontSize:"13px", fontFamily:"'JetBrains Mono',monospace",
                  outline:"none", textAlign:"right" }}/>
              <button onClick={()=>{ onUpdateBalance(holding.id, balDraft); setEditBal(false); }}
                style={{ padding:"4px 10px", background:T.accent, border:"none", borderRadius:"6px",
                  color:T.bg, fontSize:"12px", fontWeight:700, cursor:"pointer" }}>Save</button>
              <button onClick={()=>setEditBal(false)}
                style={{ padding:"4px 8px", background:"transparent", border:`1px solid ${T.border}`,
                  borderRadius:"6px", color:T.textDim, fontSize:"12px", cursor:"pointer" }}>✕</button>
            </div>
          ) : (
            <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
              <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"18px",
                fontWeight:800, color:T.accent }}>{fmtINR(holding.balance || 0)}</span>
              <button onClick={()=>{ setBalDraft(holding.balance||0); setEditBal(true); }}
                style={{ background:"none", border:"none", color:T.textMuted, cursor:"pointer",
                  fontSize:"13px", padding:"2px 4px" }} title="Update balance">✎</button>
            </div>
          )
        ) : isLoading ? (
          <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"18px",
            fontWeight:800, color:T.textMuted }}>—</span>
        ) : (
          <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"18px",
            fontWeight:800, color:T.accent }}>{fmtINR(currentValue)}</span>
        )}

        {/* Gain/loss */}
        {gain !== null && (
          <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"12px", color:gainColor, fontWeight:600 }}>
            {gain >= 0 ? "+" : ""}{fmtINR(gain)}
            {gainPct !== null && (
              <span style={{ marginLeft:"6px", fontSize:"11px" }}>
                ({gainPct >= 0 ? "+" : ""}{gainPct.toFixed(1)}%)
              </span>
            )}
          </div>
        )}

        {/* Cost basis */}
        {holding.costBasisINR > 0 && (
          <div style={{ fontSize:"10px", color:T.textMuted }}>
            invested {fmtINR(holding.costBasisINR)}
          </div>
        )}
        {holding.type === "fd" && (
          <div style={{ fontSize:"10px", color:T.textMuted }}>
            interest earned so far
          </div>
        )}
        {isLoading && isLiveType && (
          <div style={{ fontSize:"10px", color:T.textMuted }}>fetching price…</div>
        )}

        {/* XIRR */}
        {xirrRate !== null && isFinite(xirrRate) && (
          <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"11px", fontWeight:700,
            color:xirrRate>=0?T.accent:T.red, marginTop:"2px" }}>
            XIRR {xirrRate>=0?"+":""}{(xirrRate*100).toFixed(1)}% p.a.
          </div>
        )}

        {/* Delete — only for manually added holdings */}
        {!holding.derived && (
          <button onClick={() => { if(window.confirm("Remove this holding?")) onDelete(holding.id); }}
            style={{ background:"none", border:"none", color:T.red, cursor:"pointer",
              fontSize:"13px", opacity:0.5, marginTop:"4px", padding:"2px 4px" }}
            title="Remove holding">✕ Remove</button>
        )}
        {holding.derived && holding.source === "rsu" && onDeleteDerived ? (
          <button onClick={() => { if(window.confirm("Remove this RSU lot from portfolio?")) onDeleteDerived(holding); }}
            style={{ background:"none", border:"none", color:T.red, cursor:"pointer",
              fontSize:"13px", opacity:0.5, marginTop:"4px", padding:"2px 4px" }}
            title="Remove RSU lot">✕ Remove</button>
        ) : holding.derived ? (
          <div style={{ fontSize:"10px", color:T.textMuted, marginTop:"4px", fontStyle:"italic" }}>
            auto-computed
          </div>
        ) : null}
      </div>
    </div>
  );
}
