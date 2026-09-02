import { useState } from "react";
import { T } from "../../lib/theme";
import { PERSON_STOCK } from "../../lib/constants";
import { fetchHistoricalStockPrice, fetchHistoricalUSDINR } from "../../lib/historicalFX";

export default function MonthlyInput({ data, onChange, person, onCopyFieldToAll }) {
  const isSelva = person === "Selva";
  const [fetchingField, setFetchingField] = useState("");
  const [pendingDates, setPendingDates] = useState({});
  const fields = [
    { key:"take_home",      label:"Take-Home (₹)",    placeholder:"e.g. 185000" },
    { key:"epf",            label:"EPF (₹)",          placeholder:"e.g. 17200"  },
    { key:"espp_shares",    label:"ESPP Net Shares",  placeholder:"e.g. 3"      },
    { key:"espp_price_usd", label:"ESPP Price ($)",   placeholder:"e.g. 420"    },
    { key:"espp_usd_inr",   label:"USD/INR (ESPP)",   placeholder:"e.g. 94"     },
    { key:"espp_vest_date",  label:"ESPP Vest Date",   placeholder:"",  date:true },
    { key:"rsu_net_shares",  label:"RSU Net Shares",   placeholder:"e.g. 10"     },
    { key:"rsu_price_usd",   label:"RSU Price ($)",    placeholder:"e.g. 420"    },
    { key:"rsu_usd_inr",     label:"USD/INR (RSU)",    placeholder:"e.g. 94"     },
    { key:"rsu_vest_date",   label:"RSU Vest Date",    placeholder:"",  date:true },
    ...(isSelva ? [{ key:"car_lease", label:"Car Lease (₹)", placeholder:"e.g. 50706" }] : []),
  ];
  const inp = { width:"100%", padding:"10px 12px", background:T.bg, border:`1px solid ${T.border}`,
    borderRadius:"8px", color:T.text, fontSize:"14px", fontFamily:"'JetBrains Mono',monospace",
    outline:"none", boxSizing:"border-box" };

  const updateWithHistorical = async (dateKey, dateValue, snapshot) => {
    if (!dateValue || !/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) return;
    if (new Date(dateValue) >= new Date()) return;

    const stock = PERSON_STOCK[person];
    if (!stock) return;

    setFetchingField(dateKey);
    try {
      const [price, fx] = await Promise.all([
        fetchHistoricalStockPrice(stock, dateValue),
        fetchHistoricalUSDINR(dateValue),
      ]);

      const patch = { [dateKey]: dateValue };
      if (dateKey === "rsu_vest_date") {
        if (price) patch.rsu_price_usd = price.toString();
        if (fx) patch.rsu_usd_inr = (Math.round(fx * 100) / 100).toString();
      }
      if (dateKey === "espp_vest_date") {
        if (price) patch.espp_price_usd = price.toString();
        if (fx) patch.espp_usd_inr = (Math.round(fx * 100) / 100).toString();
      }
      onChange({ ...snapshot, ...patch });
    } finally {
      setFetchingField("");
    }
  };

  return (
    <div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))", gap:"12px" }}>
        {fields.map(f=>(
          <div key={f.key}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"4px" }}>
              <label style={{ fontSize:"11px", color:T.textDim, fontWeight:600 }}>
                {f.label}
                {fetchingField === f.key && <span style={{ color:T.textMuted, fontWeight:400 }}> fetching…</span>}
              </label>
              {onCopyFieldToAll && data?.[f.key] != null && data?.[f.key] !== "" && (
                <button onClick={()=>onCopyFieldToAll(f.key, data[f.key])}
                  style={{ fontSize:"10px", color:T.textMuted, background:"none", border:"none", cursor:"pointer", padding:"0 2px", fontWeight:600 }}
                  title={`Copy this value to all months`}>→ all</button>
              )}
            </div>
            <input type={f.date?"date":"number"} value={data?.[f.key]??""} placeholder={f.placeholder}
              onChange={e=>{
                if (f.key === "rsu_vest_date" || f.key === "espp_vest_date") {
                  setPendingDates(prev => ({ ...prev, [f.key]: e.target.value }));
                  onChange({...data,[f.key]:e.target.value});
                  return;
                }
                onChange({...data,[f.key]:e.target.value});
              }}
              onFocus={e=>e.target.style.borderColor=T.accent}
              onBlur={e=>{
                e.target.style.borderColor=T.border;
                if (f.key === "rsu_vest_date" || f.key === "espp_vest_date") {
                  const dateValue = pendingDates[f.key] ?? data?.[f.key] ?? "";
                  const snapshot = { ...data, [f.key]: dateValue };
                  updateWithHistorical(f.key, dateValue, snapshot);
                }
              }}
              style={{ ...inp, borderColor: fetchingField === f.key ? T.accent : T.border }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
