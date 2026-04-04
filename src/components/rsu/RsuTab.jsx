import { useState } from "react";
import { T } from "../../lib/theme";
import { PERSONS, STOCKS } from "../../lib/constants";
import RsuForm from "./RsuForm";
import RsuTable from "./RsuTable";

export default function RsuTab({ rsuData, fy, liveData, onAdd, onDelete }) {
  const [rsuFilterPerson, setRsuFilterPerson] = useState("all");
  const [rsuFilterStock,  setRsuFilterStock]  = useState("all");

  const selectStyle={padding:"8px 14px",background:T.card,border:`1px solid ${T.border}`,borderRadius:"8px",color:T.text,fontSize:"13px",outline:"none",cursor:"pointer",appearance:"none",fontWeight:600};

  return (
    <div>
      <RsuForm onAdd={onAdd} liveData={liveData}/>
      <div style={{ display:"flex", gap:"8px", marginBottom:"16px", flexWrap:"wrap", alignItems:"center" }}>
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
      <RsuTable events={rsuData[fy]||[]} onDelete={onDelete} filterPerson={rsuFilterPerson} filterStock={rsuFilterStock}/>
    </div>
  );
}
