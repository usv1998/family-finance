import { T } from "../../lib/theme";
import { genId } from "../../lib/formatters";

export default function AdHocItems({ items=[], onChange }) {
  const add    = ()      => onChange([...items,{id:genId(),label:"",amount:""}]);
  const remove = (id)    => onChange(items.filter(i=>i.id!==id));
  const update = (id,f,v)=> onChange(items.map(i=>i.id===id?{...i,[f]:v}:i));
  return (
    <div style={{ marginTop:"12px" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"8px" }}>
        <span style={{ fontSize:"11px", color:T.textDim, fontWeight:600 }}>AD-HOC ITEMS (Bonus, Refunds etc.)</span>
        <button onClick={add} style={{ padding:"4px 12px", background:"transparent", border:`1px solid ${T.accent}`, color:T.accent, borderRadius:"6px", fontSize:"12px", cursor:"pointer", fontWeight:600 }}>+ Add</button>
      </div>
      {items.map(item=>(
        <div key={item.id} style={{ display:"flex", gap:"8px", marginBottom:"6px", alignItems:"center" }}>
          <input placeholder="Label" value={item.label} onChange={e=>update(item.id,"label",e.target.value)}
            style={{ flex:1, padding:"8px 10px", background:T.bg, border:`1px solid ${T.border}`, borderRadius:"6px", color:T.text, fontSize:"13px", outline:"none" }} />
          <input type="number" placeholder="Amount (\u20b9)" value={item.amount} onChange={e=>update(item.id,"amount",e.target.value)}
            style={{ width:"140px", padding:"8px 10px", background:T.bg, border:`1px solid ${T.border}`, borderRadius:"6px", color:T.text, fontSize:"13px", fontFamily:"'JetBrains Mono',monospace", outline:"none" }} />
          <button onClick={()=>remove(item.id)} style={{ padding:"6px 10px", background:"transparent", border:`1px solid ${T.red}33`, color:T.red, borderRadius:"6px", fontSize:"12px", cursor:"pointer" }}>\u2715</button>
        </div>
      ))}
    </div>
  );
}
