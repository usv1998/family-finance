import { useState } from "react";
import { T } from "../../lib/theme";
import { fmtINR, fmtUSD, genId } from "../../lib/formatters";
import { PERSONS, STOCKS, PERSON_STOCK, EMPLOYER } from "../../lib/constants";

export default function RsuForm({ onAdd, liveData }) {
  const [form,setForm]=useState({person:"Selva",stock:"MSFT",vest_date:"",units_vested:"",stock_price_usd:"",usd_inr_rate:"",tax_withheld_units:"",grant_id:"",notes:""});
  const upd=(k,v)=>{const n={...form,[k]:v};if(k==="person")n.stock=PERSON_STOCK[v];setForm(n);};
  const useLive=()=>setForm(f=>({...f,stock_price_usd:liveData[f.stock]?.toString()||"",usd_inr_rate:liveData.USDINR?.toString()||""}));
  const gross=Number(form.units_vested)*Number(form.stock_price_usd);
  const grossINR=gross*Number(form.usd_inr_rate);
  const net=Number(form.units_vested)-(Number(form.tax_withheld_units)||0);
  const netINR=net*Number(form.stock_price_usd)*Number(form.usd_inr_rate);
  const submit=()=>{
    if(!form.vest_date||!form.units_vested||!form.stock_price_usd||!form.usd_inr_rate) return;
    const d=new Date(form.vest_date), vm=d.getMonth(), vy=d.getFullYear();
    const fyY=vm>=3?vy:vy-1;
    onAdd({id:genId(),...form,fy:`FY${fyY}-${(fyY+1).toString().slice(2)}`,month_idx:vm>=3?vm-3:vm+9,
      units_vested:Number(form.units_vested),stock_price_usd:Number(form.stock_price_usd),
      usd_inr_rate:Number(form.usd_inr_rate),tax_withheld_units:Number(form.tax_withheld_units)||0});
    setForm({person:"Selva",stock:"MSFT",vest_date:"",units_vested:"",stock_price_usd:"",usd_inr_rate:"",tax_withheld_units:"",grant_id:"",notes:""});
  };
  const inp={padding:"10px 12px",background:T.bg,border:`1px solid ${T.border}`,borderRadius:"8px",color:T.text,fontSize:"13px",outline:"none",width:"100%",boxSizing:"border-box"};
  const sel={...inp,appearance:"none",cursor:"pointer"};
  const lbl={fontSize:"11px",color:T.textDim,fontWeight:600,display:"block",marginBottom:"4px"};
  return (
    <div style={{ background:T.card, borderRadius:"12px", padding:"20px", border:`1px solid ${T.border}`, marginBottom:"20px" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"16px" }}>
        <h3 style={{ margin:0, fontSize:"14px", color:T.text, fontWeight:700 }}>Add RSU Vesting Event</h3>
        <button onClick={useLive} style={{ padding:"6px 14px", background:T.accentBg, border:`1px solid ${T.accent}44`, color:T.accent, borderRadius:"6px", fontSize:"11px", cursor:"pointer", fontWeight:600 }}>Use Live Prices</button>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))", gap:"12px" }}>
        <div><label style={lbl}>Person</label><select value={form.person} onChange={e=>upd("person",e.target.value)} style={sel}>{PERSONS.map(p=><option key={p} value={p}>{p}</option>)}</select></div>
        <div><label style={lbl}>Stock</label><select value={form.stock} onChange={e=>upd("stock",e.target.value)} style={sel}>{STOCKS.map(s=><option key={s} value={s}>{s}</option>)}</select></div>
        <div><label style={lbl}>Vest Date</label><input type="date" value={form.vest_date} onChange={e=>upd("vest_date",e.target.value)} style={inp}/></div>
        <div><label style={lbl}>Units Vested</label><input type="number" value={form.units_vested} onChange={e=>upd("units_vested",e.target.value)} placeholder="e.g. 25" style={{...inp,fontFamily:"'JetBrains Mono',monospace"}}/></div>
        <div><label style={lbl}>Stock Price (USD)</label><input type="number" step="0.01" value={form.stock_price_usd} onChange={e=>upd("stock_price_usd",e.target.value)} placeholder="e.g. 428.50" style={{...inp,fontFamily:"'JetBrains Mono',monospace"}}/></div>
        <div><label style={lbl}>USD/INR Rate</label><input type="number" step="0.01" value={form.usd_inr_rate} onChange={e=>upd("usd_inr_rate",e.target.value)} placeholder="e.g. 85.42" style={{...inp,fontFamily:"'JetBrains Mono',monospace"}}/></div>
        <div><label style={lbl}>Tax Withheld (Units)</label><input type="number" value={form.tax_withheld_units} onChange={e=>upd("tax_withheld_units",e.target.value)} placeholder="0" style={{...inp,fontFamily:"'JetBrains Mono',monospace"}}/></div>
        <div><label style={lbl}>Grant ID</label><input value={form.grant_id} onChange={e=>upd("grant_id",e.target.value)} placeholder="Optional" style={inp}/></div>
      </div>
      {gross>0&&(
        <div style={{ display:"flex", gap:"16px", flexWrap:"wrap", marginTop:"16px", padding:"12px 16px", background:T.bg, borderRadius:"8px" }}>
          {[{l:"Gross USD",v:fmtUSD(gross),c:T.blue},{l:"Gross INR",v:fmtINR(grossINR),c:T.accent},{l:"Net Units",v:net,c:T.text},{l:"Net INR",v:fmtINR(netINR),c:T.accent}].map(x=>(
            <div key={x.l}><span style={{ fontSize:"11px", color:T.textMuted }}>{x.l}</span><div style={{ fontFamily:"'JetBrains Mono',monospace", color:x.c, fontWeight:700 }}>{x.v}</div></div>
          ))}
        </div>
      )}
      <button onClick={submit} style={{ marginTop:"16px", padding:"10px 28px", background:T.accent, border:"none", borderRadius:"8px", color:T.bg, fontSize:"14px", fontWeight:700, cursor:"pointer", opacity:(!form.vest_date||!form.units_vested)?0.4:1 }}>Add Vesting Event</button>
    </div>
  );
}
