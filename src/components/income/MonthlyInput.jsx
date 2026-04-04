import { T } from "../../lib/theme";

export default function MonthlyInput({ data, onChange, person }) {
  const isSelva = person === "Selva";
  const fields = [
    { key:"take_home",  label:"Take-Home (\u20b9)",      placeholder:"e.g. 185000" },
    { key:"epf",        label:"EPF (\u20b9)",            placeholder:"e.g. 17200"  },
    { key:"espp",       label:"ESPP Net Stock (\u20b9)", placeholder:"e.g. 118440" },
    ...(isSelva ? [{ key:"car_lease", label:"Car Lease (\u20b9)", placeholder:"e.g. 50706" }] : []),
  ];
  const inp = { width:"100%", padding:"10px 12px", background:T.bg, border:`1px solid ${T.border}`,
    borderRadius:"8px", color:T.text, fontSize:"14px", fontFamily:"'JetBrains Mono',monospace",
    outline:"none", boxSizing:"border-box" };
  return (
    <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))", gap:"12px" }}>
      {fields.map(f=>(
        <div key={f.key}>
          <label style={{ fontSize:"11px", color:T.textDim, fontWeight:600, display:"block", marginBottom:"4px" }}>{f.label}</label>
          <input type="number" value={data?.[f.key]??""} placeholder={f.placeholder}
            onChange={e=>onChange({...data,[f.key]:e.target.value})}
            style={inp}
            onFocus={e=>e.target.style.borderColor=T.accent}
            onBlur={e=>e.target.style.borderColor=T.border}
          />
        </div>
      ))}
    </div>
  );
}
