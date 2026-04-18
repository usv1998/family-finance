import { useState, useRef } from "react";
import { T } from "../../lib/theme";
import { genId } from "../../lib/formatters";
import { PERSONS } from "../../lib/constants";
import { searchMF } from "../../lib/priceService";
import { fetchHistoricalUSDINR } from "../../lib/historicalFX";

export const TYPE_META = {
  us_stock: { label: "US Stock",       color: T.blue   },
  in_stock: { label: "Indian Stock",   color: T.teal   },
  mf:       { label: "Mutual Fund",    color: T.purple },
  fd:       { label: "Fixed Deposit",  color: T.amber  },
  epf:      { label: "EPF",            color: T.accent },
  ppf:      { label: "PPF",            color: T.selva  },
};

const EMPTY = {
  type:"us_stock", person:"Selva", name:"", symbol:"",
  quantity:"", costBasisINR:"", schemeCode:"", units:"",
  principal:"", interestRate:"", startDate:"", maturityDate:"",
  balance:"", notes:"",
  acquisitionDate:"", acquisitionPrice:"", acquisitionUSDINR:"",
};

const inp = {
  padding:"8px 10px", background:T.card, border:`1px solid ${T.border}`,
  borderRadius:"8px", color:T.text, fontSize:"13px", outline:"none",
  width:"100%", fontFamily:"inherit",
};
const label = (text) => (
  <label style={{ fontSize:"11px", color:T.textMuted, fontWeight:700,
    display:"block", marginBottom:"4px", letterSpacing:"0.3px" }}>{text}</label>
);

export default function AddHoldingForm({ onAdd, onClose }) {
  const [form, setForm]         = useState(EMPTY);
  const [mfQuery, setMfQuery]   = useState("");
  const [mfResults, setMfResults] = useState([]);
  const [mfSearching, setMfSearching] = useState(false);
  const [mfSelected, setMfSelected]   = useState(null);
  const [fxFetching, setFxFetching]   = useState(false);
  const timerRef = useRef(null);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Auto-fetch USD/INR rate when acquisition date is entered for US stocks
  const handleAcqDate = async (dateStr) => {
    set("acquisitionDate", dateStr);
    if (!dateStr || form.type !== "us_stock") return;
    setFxFetching(true);
    const rate = await fetchHistoricalUSDINR(dateStr);
    if (rate) set("acquisitionUSDINR", rate.toFixed(2));
    setFxFetching(false);
  };

  const handleMFSearch = (q) => {
    setMfQuery(q);
    setMfSelected(null);
    setMfResults([]);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!q.trim()) return;
    timerRef.current = setTimeout(async () => {
      setMfSearching(true);
      const res = await searchMF(q);
      setMfResults(res.slice(0, 8));
      setMfSearching(false);
    }, 400);
  };

  const selectFund = (fund) => {
    setMfSelected(fund);
    setMfQuery(fund.schemeName);
    setMfResults([]);
    set("schemeCode", String(fund.schemeCode));
    set("name", fund.schemeName);
  };

  const handleSubmit = () => {
    const h = { id: genId(), type: form.type, person: form.person,
      name: form.name, notes: form.notes, addedAt: new Date().toISOString() };
    // Acquisition info (applies to stocks + MFs)
    if (form.acquisitionDate) {
      h.acquisitionDate = form.acquisitionDate;
      if (form.acquisitionPrice) {
        h.acquisitionPrice    = Number(form.acquisitionPrice);
        h.acquisitionCurrency = form.type === "us_stock" ? "USD" : "INR";
        if (form.type === "us_stock" && form.acquisitionUSDINR) {
          h.acquisitionUSDINR = Number(form.acquisitionUSDINR);
        }
      }
    }
    switch (form.type) {
      case "us_stock":
      case "in_stock":
        if (!form.symbol || !form.quantity) return;
        h.symbol = form.symbol.toUpperCase();
        h.quantity = Number(form.quantity);
        h.costBasisINR = Number(form.costBasisINR) || 0;
        if (!h.name) h.name = h.symbol;
        break;
      case "mf":
        if (!form.schemeCode || !form.units) return;
        h.schemeCode = form.schemeCode;
        h.units = Number(form.units);
        h.costBasisINR = Number(form.costBasisINR) || 0;
        break;
      case "fd":
        if (!form.principal || !form.interestRate || !form.startDate) return;
        h.name = form.name || "Fixed Deposit";
        h.principal = Number(form.principal);
        h.interestRate = Number(form.interestRate);
        h.startDate = form.startDate;
        h.maturityDate = form.maturityDate;
        break;
      case "epf":
      case "ppf":
        if (!form.balance) return;
        h.name = form.name || (form.type.toUpperCase() + " — " + form.person);
        h.balance = Number(form.balance);
        break;
    }
    onAdd(h);
    // Keep all fields except quantity/units and date so the next lot can be added quickly
    setForm(f => ({ ...f, quantity: "", units: "", acquisitionDate: "" }));
  };

  const selStyle = { ...inp, cursor:"pointer", appearance:"none",
    backgroundImage:"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238B96AD' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")",
    backgroundRepeat:"no-repeat", backgroundPosition:"right 10px center", paddingRight:"30px" };

  return (
    <div style={{ background:T.surface, borderRadius:"12px", border:`1px solid ${T.accent}44`,
      padding:"20px", marginBottom:"20px" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"16px" }}>
        <span style={{ fontSize:"14px", fontWeight:700, color:T.text }}>Add Holding</span>
        <button onClick={onClose} style={{ background:"none", border:"none", color:T.textMuted, cursor:"pointer", fontSize:"18px" }}>×</button>
      </div>

      {/* Type + Person */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"12px", marginBottom:"14px" }}>
        <div>
          {label("ASSET TYPE")}
          <select value={form.type} onChange={e => { setForm({...EMPTY, type:e.target.value, person:form.person}); setMfQuery(""); setMfResults([]); setMfSelected(null); }} style={selStyle}>
            {Object.entries(TYPE_META).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <div>
          {label("PERSON")}
          <select value={form.person} onChange={e => set("person", e.target.value)} style={selStyle}>
            {PERSONS.map(p => <option key={p} value={p}>{p}</option>)}
            <option value="Joint">Joint</option>
          </select>
        </div>
      </div>

      {/* Type-specific fields */}
      <div style={{ display:"flex", flexDirection:"column", gap:"12px" }}>

        {/* US Stock */}
        {form.type === "us_stock" && (<>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"12px" }}>
            <div>
              {label("SYMBOL (e.g. MSFT)")}
              <input style={inp} value={form.symbol} onChange={e=>set("symbol",e.target.value)} placeholder="MSFT"/>
            </div>
            <div>
              {label("NAME (optional)")}
              <input style={inp} value={form.name} onChange={e=>set("name",e.target.value)} placeholder="Microsoft"/>
            </div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"12px" }}>
            <div>
              {label("QUANTITY (shares)")}
              <input type="number" style={inp} value={form.quantity} onChange={e=>set("quantity",e.target.value)} placeholder="10"/>
            </div>
            <div>
              {label("TOTAL COST BASIS (₹)")}
              <input type="number" style={inp} value={form.costBasisINR} onChange={e=>set("costBasisINR",e.target.value)} placeholder="350000"/>
            </div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:"12px" }}>
            <div>
              {label("PURCHASE DATE (for XIRR)")}
              <input type="date" style={inp} value={form.acquisitionDate} onChange={e=>handleAcqDate(e.target.value)}/>
            </div>
            <div>
              {label("PRICE PER SHARE (USD)")}
              <input type="number" style={inp} value={form.acquisitionPrice} onChange={e=>set("acquisitionPrice",e.target.value)} placeholder="420"/>
            </div>
            <div style={{ position:"relative" }}>
              {label("USD/INR ON THAT DATE")}
              <input type="number" style={inp} value={form.acquisitionUSDINR} onChange={e=>set("acquisitionUSDINR",e.target.value)} placeholder="94.2"/>
              {fxFetching && (
                <span style={{ position:"absolute", right:"10px", top:"30px", fontSize:"10px", color:T.textMuted }}>
                  fetching…
                </span>
              )}
            </div>
          </div>
        </>)}

        {/* Indian Stock */}
        {form.type === "in_stock" && (<>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"12px" }}>
            <div>
              {label("NSE SYMBOL (e.g. RELIANCE.NS)")}
              <input style={inp} value={form.symbol} onChange={e=>set("symbol",e.target.value)} placeholder="RELIANCE.NS"/>
            </div>
            <div>
              {label("NAME (optional)")}
              <input style={inp} value={form.name} onChange={e=>set("name",e.target.value)} placeholder="Reliance Industries"/>
            </div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:"12px" }}>
            <div>
              {label("QUANTITY (shares)")}
              <input type="number" style={inp} value={form.quantity} onChange={e=>set("quantity",e.target.value)} placeholder="50"/>
            </div>
            <div>
              {label("TOTAL COST BASIS (₹)")}
              <input type="number" style={inp} value={form.costBasisINR} onChange={e=>set("costBasisINR",e.target.value)} placeholder="150000"/>
            </div>
            <div>
              {label("PURCHASE DATE (for XIRR)")}
              <input type="date" style={inp} value={form.acquisitionDate} onChange={e=>set("acquisitionDate",e.target.value)}/>
            </div>
          </div>
        </>)}

        {/* Mutual Fund */}
        {form.type === "mf" && (<>
          <div style={{ position:"relative" }}>
            {label("SEARCH FUND BY NAME")}
            <input style={inp} value={mfQuery} onChange={e=>handleMFSearch(e.target.value)}
              placeholder="e.g. Nifty 50 Index, Mirae, HDFC Mid Cap…"/>
            {mfSearching && (
              <div style={{ position:"absolute", right:"10px", top:"30px", fontSize:"11px", color:T.textMuted }}>
                Searching…
              </div>
            )}
            {mfResults.length > 0 && (
              <div style={{ position:"absolute", top:"100%", left:0, right:0, background:T.card,
                border:`1px solid ${T.border}`, borderRadius:"8px", zIndex:10,
                maxHeight:"200px", overflowY:"auto", marginTop:"4px" }}>
                {mfResults.map(f => (
                  <div key={f.schemeCode} onClick={() => selectFund(f)}
                    style={{ padding:"8px 12px", cursor:"pointer", borderBottom:`1px solid ${T.border}22`,
                      fontSize:"12px", color:T.text }}
                    onMouseEnter={e=>e.currentTarget.style.background=T.surface}
                    onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                    <div style={{ fontWeight:600 }}>{f.schemeName}</div>
                    <div style={{ fontSize:"10px", color:T.textMuted }}>{f.fundHouse} · Code: {f.schemeCode}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          {mfSelected && (
            <div style={{ padding:"8px 12px", background:T.card, borderRadius:"8px",
              border:`1px solid ${T.purple}44`, fontSize:"12px" }}>
              <span style={{ color:T.purple, fontWeight:700 }}>Selected: </span>
              <span style={{ color:T.text }}>{mfSelected.schemeName}</span>
              <span style={{ color:T.textMuted, marginLeft:"8px" }}>Code: {mfSelected.schemeCode}</span>
            </div>
          )}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:"12px" }}>
            <div>
              {label("UNITS HELD")}
              <input type="number" style={inp} value={form.units} onChange={e=>set("units",e.target.value)} placeholder="1234.567"/>
            </div>
            <div>
              {label("TOTAL INVESTED (₹)")}
              <input type="number" style={inp} value={form.costBasisINR} onChange={e=>set("costBasisINR",e.target.value)} placeholder="500000"/>
            </div>
            <div>
              {label("FIRST SIP DATE (for XIRR)")}
              <input type="date" style={inp} value={form.acquisitionDate} onChange={e=>set("acquisitionDate",e.target.value)}/>
            </div>
          </div>
        </>)}

        {/* Fixed Deposit */}
        {form.type === "fd" && (<>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"12px" }}>
            <div>
              {label("BANK / LABEL")}
              <input style={inp} value={form.name} onChange={e=>set("name",e.target.value)} placeholder="HDFC Bank FD"/>
            </div>
            <div>
              {label("PRINCIPAL (₹)")}
              <input type="number" style={inp} value={form.principal} onChange={e=>set("principal",e.target.value)} placeholder="500000"/>
            </div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:"12px" }}>
            <div>
              {label("ANNUAL RATE (%)")}
              <input type="number" style={inp} value={form.interestRate} onChange={e=>set("interestRate",e.target.value)} placeholder="7.5"/>
            </div>
            <div>
              {label("START DATE")}
              <input type="date" style={inp} value={form.startDate} onChange={e=>set("startDate",e.target.value)}/>
            </div>
            <div>
              {label("MATURITY DATE")}
              <input type="date" style={inp} value={form.maturityDate} onChange={e=>set("maturityDate",e.target.value)}/>
            </div>
          </div>
        </>)}

        {/* EPF / PPF */}
        {(form.type === "epf" || form.type === "ppf") && (<>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"12px" }}>
            <div>
              {label("LABEL (optional)")}
              <input style={inp} value={form.name} onChange={e=>set("name",e.target.value)}
                placeholder={`${form.type.toUpperCase()} — ${form.person}`}/>
            </div>
            <div>
              {label("CURRENT BALANCE (₹)")}
              <input type="number" style={inp} value={form.balance} onChange={e=>set("balance",e.target.value)} placeholder="500000"/>
            </div>
          </div>
        </>)}

        {/* Notes — all types */}
        <div>
          {label("NOTES (optional)")}
          <input style={inp} value={form.notes} onChange={e=>set("notes",e.target.value)} placeholder="Any notes…"/>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display:"flex", gap:"10px", justifyContent:"flex-end", marginTop:"16px" }}>
        <button onClick={onClose}
          style={{ padding:"8px 18px", background:"transparent", border:`1px solid ${T.border}`,
            borderRadius:"8px", color:T.textDim, fontSize:"13px", fontWeight:600, cursor:"pointer" }}>
          Cancel
        </button>
        <button onClick={handleSubmit}
          style={{ padding:"8px 20px", background:T.accent, border:"none",
            borderRadius:"8px", color:T.bg, fontSize:"13px", fontWeight:700, cursor:"pointer" }}>
          Add Holding
        </button>
      </div>
    </div>
  );
}
