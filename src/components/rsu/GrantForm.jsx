import { useState } from "react";
import { T } from "../../lib/theme";
import { genId } from "../../lib/formatters";
import { PERSONS, PERSON_STOCK } from "../../lib/constants";

const BLANK = {
  person:"Selva", stock:"MSFT", grant_date:"", grant_id:"", total_units:"",
  vesting_type:"quarterly", vesting_years:"4", first_vest_date:"",
  notes:"",
  // custom schedule rows (vesting_type === "custom")
  vesting_schedule:[{ vest_date:"", units:"" }],
};

export default function GrantForm({ onAdd }) {
  const [form, setForm]   = useState(BLANK);
  const [open, setOpen]   = useState(false);

  const upd = (k, v) => {
    setForm(f => {
      const n = { ...f, [k]: v };
      if (k === "person") n.stock = PERSON_STOCK[v];
      return n;
    });
  };

  const addCustomRow    = () => setForm(f => ({ ...f, vesting_schedule: [...f.vesting_schedule, { vest_date:"", units:"" }] }));
  const removeCustomRow = (i) => setForm(f => ({ ...f, vesting_schedule: f.vesting_schedule.filter((_,j)=>j!==i) }));
  const updCustomRow    = (i, k, v) => setForm(f => ({ ...f, vesting_schedule: f.vesting_schedule.map((r,j)=>j===i?{...r,[k]:v}:r) }));

  const submit = () => {
    if (!form.grant_date || !form.total_units || !form.grant_id) return;
    if (form.vesting_type === "quarterly" && !form.first_vest_date) return;
    const grant = {
      id: genId(),
      person:          form.person,
      stock:           form.stock,
      grant_date:      form.grant_date,
      grant_id:        form.grant_id,
      total_units:     Number(form.total_units),
      vesting_type:    form.vesting_type,
      vesting_years:   Number(form.vesting_years),
      first_vest_date: form.first_vest_date,
      vesting_schedule: form.vesting_type === "custom"
        ? form.vesting_schedule.map(r => ({ vest_date: r.vest_date, units: Number(r.units)||0 }))
        : [],
      notes: form.notes,
    };
    onAdd(grant);
    setForm(BLANK);
    setOpen(false);
  };

  const inp = { padding:"8px 12px", background:T.card, border:`1px solid ${T.border}`, borderRadius:"8px", color:T.text, fontSize:"13px", outline:"none", fontFamily:"'JetBrains Mono',monospace", width:"100%" };
  const sel = { ...inp, appearance:"none", cursor:"pointer" };

  return (
    <div style={{ marginBottom:"20px" }}>
      <button onClick={()=>setOpen(o=>!o)}
        style={{ padding:"8px 18px", background:open?T.card:T.accent, border:`1px solid ${open?T.border:T.accent}`,
          borderRadius:"8px", color:open?T.textDim:T.bg, fontSize:"13px", fontWeight:700, cursor:"pointer" }}>
        {open ? "Cancel" : "+ Add RSU Grant"}
      </button>

      {open && (
        <div style={{ marginTop:"14px", background:T.surface, borderRadius:"12px", border:`1px solid ${T.border}`, padding:"20px" }}>
          <div style={{ fontSize:"14px", fontWeight:700, color:T.text, marginBottom:"16px" }}>New RSU Grant</div>

          {/* Row 1 */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:"12px", marginBottom:"12px" }}>
            <div>
              <label style={{ fontSize:"11px", color:T.textMuted, fontWeight:700, display:"block", marginBottom:"4px" }}>PERSON</label>
              <select value={form.person} onChange={e=>upd("person",e.target.value)} style={sel}>
                {PERSONS.map(p=><option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize:"11px", color:T.textMuted, fontWeight:700, display:"block", marginBottom:"4px" }}>STOCK</label>
              <input value={form.stock} readOnly style={{ ...inp, color:T.textDim, cursor:"not-allowed" }}/>
            </div>
            <div>
              <label style={{ fontSize:"11px", color:T.textMuted, fontWeight:700, display:"block", marginBottom:"4px" }}>GRANT ID / LABEL</label>
              <input value={form.grant_id} onChange={e=>upd("grant_id",e.target.value)} placeholder="e.g. MSFT-FY27-Refresh" style={inp}/>
            </div>
            <div>
              <label style={{ fontSize:"11px", color:T.textMuted, fontWeight:700, display:"block", marginBottom:"4px" }}>GRANT DATE</label>
              <input type="date" value={form.grant_date} onChange={e=>upd("grant_date",e.target.value)} style={inp}/>
            </div>
            <div>
              <label style={{ fontSize:"11px", color:T.textMuted, fontWeight:700, display:"block", marginBottom:"4px" }}>TOTAL UNITS</label>
              <input type="number" value={form.total_units} onChange={e=>upd("total_units",e.target.value)} placeholder="e.g. 56" style={inp}/>
            </div>
          </div>

          {/* Vesting type */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:"12px", marginBottom:"12px" }}>
            <div>
              <label style={{ fontSize:"11px", color:T.textMuted, fontWeight:700, display:"block", marginBottom:"4px" }}>VESTING TYPE</label>
              <select value={form.vesting_type} onChange={e=>upd("vesting_type",e.target.value)} style={sel}>
                <option value="quarterly">Equal Quarterly</option>
                <option value="custom">Custom Schedule</option>
              </select>
            </div>
            {form.vesting_type === "quarterly" && <>
              <div>
                <label style={{ fontSize:"11px", color:T.textMuted, fontWeight:700, display:"block", marginBottom:"4px" }}>VESTING YEARS</label>
                <select value={form.vesting_years} onChange={e=>upd("vesting_years",e.target.value)} style={sel}>
                  {[1,2,3,4,5].map(n=><option key={n} value={n}>{n} yr ({n*4} vests)</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize:"11px", color:T.textMuted, fontWeight:700, display:"block", marginBottom:"4px" }}>FIRST VEST DATE</label>
                <input type="date" value={form.first_vest_date} onChange={e=>upd("first_vest_date",e.target.value)} style={inp}/>
              </div>
            </>}
            <div>
              <label style={{ fontSize:"11px", color:T.textMuted, fontWeight:700, display:"block", marginBottom:"4px" }}>NOTES</label>
              <input value={form.notes} onChange={e=>upd("notes",e.target.value)} placeholder="Optional" style={inp}/>
            </div>
          </div>

          {/* Custom schedule rows */}
          {form.vesting_type === "custom" && (
            <div style={{ marginBottom:"12px" }}>
              <div style={{ fontSize:"11px", color:T.textMuted, fontWeight:700, marginBottom:"8px" }}>VEST SCHEDULE</div>
              {form.vesting_schedule.map((r,i) => (
                <div key={i} style={{ display:"flex", gap:"8px", marginBottom:"6px", alignItems:"center" }}>
                  <input type="date" value={r.vest_date} onChange={e=>updCustomRow(i,"vest_date",e.target.value)} style={{ ...inp, width:"160px" }}/>
                  <input type="number" value={r.units} onChange={e=>updCustomRow(i,"units",e.target.value)} placeholder="units" style={{ ...inp, width:"100px" }}/>
                  {form.vesting_schedule.length > 1 &&
                    <button onClick={()=>removeCustomRow(i)} style={{ background:"none", border:"none", color:T.red, cursor:"pointer", fontSize:"16px" }}>✕</button>}
                </div>
              ))}
              <button onClick={addCustomRow} style={{ fontSize:"12px", color:T.accent, background:"none", border:"none", cursor:"pointer", fontWeight:600 }}>+ Add vest</button>
            </div>
          )}

          <div style={{ display:"flex", justifyContent:"flex-end", gap:"10px" }}>
            <button onClick={()=>{setOpen(false);setForm(BLANK);}} style={{ padding:"8px 20px", background:"transparent", border:`1px solid ${T.border}`, borderRadius:"8px", color:T.textDim, fontSize:"13px", fontWeight:600, cursor:"pointer" }}>Cancel</button>
            <button onClick={submit} style={{ padding:"8px 24px", background:T.accent, border:"none", borderRadius:"8px", color:T.bg, fontSize:"13px", fontWeight:700, cursor:"pointer" }}>Save Grant</button>
          </div>
        </div>
      )}
    </div>
  );
}
