import { useState } from "react";
import { T } from "../../lib/theme";
import { PERSONS, STOCKS } from "../../lib/constants";
import { getUpcomingVests } from "../../lib/grantUtils";
import { downloadCSV } from "../../lib/csvExport";
import RsuForm from "./RsuForm";
import RsuTable from "./RsuTable";
import GrantForm from "./GrantForm";
import GrantList from "./GrantList";

export default function RsuTab({ rsuData, rsuGrants, fy, liveData, onAdd, onDelete, onAddGrant, onDeleteGrant }) {
  const [view,            setView]            = useState("events");
  const [rsuFilterPerson, setRsuFilterPerson] = useState("all");
  const [rsuFilterStock,  setRsuFilterStock]  = useState("all");

  const upcoming  = getUpcomingVests(rsuGrants || [], 3);
  const allEvents = Object.values(rsuData || {}).flat();

  const exportRSU = (allFYs) => {
    const events = allFYs ? allEvents : (rsuData[fy] || []);
    const hasLive = liveData && (liveData.MSFT || liveData.NVDA);
    const liveUSDINR = liveData?.USDINR || 85;
    const headers = ["Person","Stock","Vest Date","FY","Units Vested","Tax Withheld","Net Units",
      "Price USD","USD/INR","Net INR",
      ...(hasLive ? ["Current Value INR","Gain INR","Gain %"] : []),
      "Grant ID"];
    const rows = events
      .slice().sort((a,b) => new Date(a.vest_date)-new Date(b.vest_date))
      .map(e => {
        const netUnits = e.units_vested - (e.tax_withheld_units||0);
        const netINR   = netUnits * e.stock_price_usd * e.usd_inr_rate;
        const livePrice = hasLive ? (liveData[e.stock] || 0) : 0;
        const nowINR   = hasLive ? netUnits * livePrice * liveUSDINR : null;
        const gain     = nowINR !== null ? nowINR - netINR : null;
        const gainPct  = netINR > 0 && gain !== null ? (gain/netINR*100).toFixed(1) : "";
        return [e.person, e.stock,
          new Date(e.vest_date).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"}),
          e.fy, e.units_vested, e.tax_withheld_units||0, netUnits,
          e.stock_price_usd, e.usd_inr_rate, Math.round(netINR),
          ...(hasLive ? [Math.round(nowINR||0), Math.round(gain||0), gainPct] : []),
          e.grant_id||""];
      });
    downloadCSV(`rsu_${allFYs?"all":fy}.csv`, [headers, ...rows]);
  };

  const btnStyle = (active) => ({
    padding:"8px 18px", borderRadius:"8px", border:"none", fontSize:"13px", fontWeight:600,
    cursor:"pointer", transition:"all 0.2s",
    background: active ? T.accent : "transparent", color: active ? T.bg : T.textDim,
  });
  const selectStyle = { padding:"8px 14px", background:T.card, border:`1px solid ${T.border}`, borderRadius:"8px", color:T.text, fontSize:"13px", outline:"none", cursor:"pointer", appearance:"none", fontWeight:600 };

  return (
    <div>
      {/* View toggle */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:"12px", marginBottom:"20px" }}>
        <div style={{ display:"flex", gap:"4px", padding:"4px", background:T.card, borderRadius:"10px" }}>
          <button onClick={()=>setView("events")}  style={btnStyle(view==="events")}>Vest Events</button>
          <button onClick={()=>setView("grants")}  style={btnStyle(view==="grants")}>
            Grant Schedule
            {(rsuGrants||[]).length > 0 && (
              <span style={{ marginLeft:"6px", background:T.purple+"33", color:T.purple, borderRadius:"10px", padding:"1px 7px", fontSize:"11px", fontWeight:700 }}>
                {(rsuGrants||[]).length}
              </span>
            )}
          </button>
        </div>

        {/* Upcoming vests banner */}
        {upcoming.length > 0 && (
          <div style={{ display:"flex", gap:"8px", flexWrap:"wrap", alignItems:"center" }}>
            <span style={{ fontSize:"11px", color:T.textMuted, fontWeight:700 }}>UPCOMING:</span>
            {upcoming.map((v,i) => {
              const personCol = v.person === "Selva" ? T.selva : T.akshaya;
              const daysAway  = Math.ceil((new Date(v.vest_date) - Date.now()) / 86400000);
              return (
                <div key={i} style={{ display:"flex", alignItems:"center", gap:"6px", padding:"5px 10px",
                  background:T.card, borderRadius:"8px", border:`1px solid ${T.border}`, fontSize:"12px" }}>
                  <span style={{ color:personCol, fontWeight:700 }}>{v.stock}</span>
                  <span style={{ color:T.text }}>{v.units} units</span>
                  <span style={{ color:T.textMuted }}>
                    {new Date(v.vest_date).toLocaleDateString("en-IN",{day:"2-digit",month:"short"})}
                  </span>
                  <span style={{ color:daysAway<=30?T.amber:T.textMuted, fontSize:"10px", fontWeight:600 }}>
                    {daysAway}d
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Vest Events view ── */}
      {view === "events" && (
        <div>
          <RsuForm onAdd={onAdd} liveData={liveData}/>
          <div style={{ display:"flex", gap:"8px", marginBottom:"16px", flexWrap:"wrap", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ display:"flex", gap:"8px", flexWrap:"wrap", alignItems:"center" }}>
            <span style={{ fontSize:"11px", color:T.textMuted, fontWeight:600 }}>FILTER:</span>
            <select value={rsuFilterPerson} onChange={e=>setRsuFilterPerson(e.target.value)} style={selectStyle}>
              <option value="all">All Persons</option>
              {PERSONS.map(p=><option key={p} value={p}>{p}</option>)}
            </select>
            <select value={rsuFilterStock} onChange={e=>setRsuFilterStock(e.target.value)} style={selectStyle}>
              <option value="all">All Stocks</option>
              {STOCKS.map(s=><option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div style={{ display:"flex", gap:"6px" }}>
            <button onClick={()=>exportRSU(false)} style={{ padding:"7px 13px", background:"transparent", border:`1px solid ${T.border}`, borderRadius:"8px", color:T.textDim, fontSize:"12px", cursor:"pointer", fontWeight:600 }}>Export {fy} ↓</button>
            <button onClick={()=>exportRSU(true)}  style={{ padding:"7px 13px", background:"transparent", border:`1px solid ${T.border}`, borderRadius:"8px", color:T.textDim, fontSize:"12px", cursor:"pointer", fontWeight:600 }}>Export All FYs ↓</button>
          </div>
          </div>
          <RsuTable events={rsuData[fy]||[]} onDelete={onDelete} filterPerson={rsuFilterPerson} filterStock={rsuFilterStock} liveData={liveData}/>
        </div>
      )}

      {/* ── Grant Schedule view ── */}
      {view === "grants" && (
        <div>
          <GrantForm onAdd={onAddGrant}/>
          <GrantList grants={rsuGrants||[]} rsuData={rsuData} liveData={liveData} onDelete={onDeleteGrant}/>
        </div>
      )}
    </div>
  );
}
