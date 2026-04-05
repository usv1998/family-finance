import { T } from "../../lib/theme";
export default function MonthlyInput({ data, onChange, person }) {
  const isSelva = person === "Selva";
  const fields = [
    { key:"take_home",      label:"Take-Home (₹)",    placeholder:"e.g. 185000" },
    { key:"epf",            label:"EPF (₹)",          placeholder:"e.g. 17200"  },
    { key:"espp_shares",    label:"ESPP Net Shares",  placeholder:"e.g. 3"      },
    { key:"espp_price_usd", label:"ESPP Price ($)",   placeholder:"e.g. 420"    },
    { key:"espp_usd_inr",   label:"USD/INR (ESPP)",   placeholder:"e.g. 94"     },
    ...(isSelva ? [{ key:"car_lease", label:"Car Lease (₹)", placeholder:"e.g. 50706" }] : []),
  ];
  const inp = { width:"100%", padding:"10px 12px", background:T.bg, border:`1px solid ${T.border}`,
    borderRadius:"8px", color:T.text, fontSize:"14px", fontFamily:"'JetBrains Mono',monospace",
    outline:"none", boxSizing:"border-box" };

  return (
    <div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))", gap:"12px" }}>
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
    </div>
  );
}
