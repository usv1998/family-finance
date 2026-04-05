import { T } from "../lib/theme";
import { fmtUSD } from "../lib/formatters";

export default function LiveStrip({ liveData, onRefresh, refreshing }) {
  const { MSFT, NVDA, USDINR, fetchedAt, error, partial } = liveData;

  const age    = fetchedAt ? Math.floor((Date.now() - fetchedAt) / 60000) : null; // minutes
  const stale  = age !== null && age > 20;
  const dotCol = error ? T.red : stale ? T.amber : T.accent;
  const label  = error ? "STALE" : stale ? `${age}m ago` : "LIVE";

  return (
    <div style={{ display:"flex", gap:"14px", flexWrap:"wrap", alignItems:"center",
      padding:"8px 14px", background:T.card, borderRadius:"10px",
      border:`1px solid ${stale||error ? T.amber+"55" : T.border}`, fontSize:"13px" }}>

      {/* Status dot + label */}
      <div style={{ display:"flex", alignItems:"center", gap:"5px" }}>
        <span style={{ width:"6px", height:"6px", borderRadius:"50%", background:dotCol,
          flexShrink:0, animation: error||stale ? "none" : "pulse 2s infinite" }}/>
        <span style={{ color:dotCol, fontWeight:700, letterSpacing:"0.5px", fontSize:"10px" }}>{label}</span>
      </div>

      {/* Prices */}
      {[{ label:"MSFT",    value:MSFT   ? fmtUSD(MSFT)              : "—", color:T.blue   },
        { label:"NVDA",    value:NVDA   ? fmtUSD(NVDA)              : "—", color:T.accent },
        { label:"USD/INR", value:USDINR ? `₹${USDINR.toFixed(2)}`  : "—", color:T.amber  },
      ].map(d => (
        <div key={d.label} style={{ display:"flex", alignItems:"center", gap:"5px" }}>
          <span style={{ color:T.textDim, fontSize:"11px", fontWeight:600 }}>{d.label}</span>
          <span style={{ color:d.value==="—" ? T.textMuted : d.color, fontWeight:700,
            fontFamily:"'JetBrains Mono',monospace" }}>{d.value}</span>
        </div>
      ))}

      {/* Refresh button */}
      <button onClick={onRefresh} disabled={refreshing}
        title="Refresh market data"
        style={{ background:"none", border:"none", cursor:refreshing?"not-allowed":"pointer",
          color:T.textMuted, fontSize:"13px", padding:"0 2px", lineHeight:1,
          opacity:refreshing?0.4:1, transition:"opacity 0.2s",
          animation:refreshing?"spin 1s linear infinite":"none" }}>
        ↻
      </button>

      {/* Stale / error note */}
      {(stale || error) && (
        <span style={{ fontSize:"10px", color:T.amber }}>
          {error ? "fetch failed · defaults shown" : "data may be stale"}
        </span>
      )}

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
