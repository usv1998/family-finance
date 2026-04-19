import { useState } from "react";
import { supabase } from "../lib/supabase";
import { T } from "../lib/theme";

export default function LoginScreen() {
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  const login = async () => {
    if (!email || !password) return;
    setLoading(true); setError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    // On success: onAuthStateChange in FamilyFinanceTracker fires SIGNED_IN →
    // setUser() + setLocked(true) → LockScreen shows and handles biometric enrollment
    setLoading(false);
  };

  const inp = {
    padding:"10px 14px", background:T.card, border:`1px solid ${T.border}`,
    borderRadius:"8px", color:T.text, fontSize:"14px", outline:"none",
    width:"100%", boxSizing:"border-box",
  };

  return (
    <div style={{ minHeight:"100dvh", background:T.bg, display:"flex", alignItems:"center",
      justifyContent:"center", fontFamily:"'DM Sans',-apple-system,sans-serif", padding:"24px" }}>
      <div style={{ background:T.surface, borderRadius:"20px", padding:"40px 32px",
        border:`1px solid ${T.border}`, width:"100%", maxWidth:"360px" }}>
        <div style={{ textAlign:"center", marginBottom:"28px" }}>
          <div style={{ width:"52px", height:"52px", borderRadius:"14px",
            background:`linear-gradient(135deg,${T.accent},${T.blue})`,
            display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:"26px", fontWeight:800, color:T.bg, margin:"0 auto 14px" }}>₹</div>
          <h1 style={{ margin:0, fontSize:"20px", fontWeight:800, color:T.text, letterSpacing:"-0.3px" }}>
            DudduKaasu
          </h1>
          <p style={{ margin:"6px 0 0", fontSize:"13px", color:T.textMuted }}>
            Sign in to sync your data
          </p>
        </div>

        <div style={{ display:"flex", flexDirection:"column", gap:"12px" }}>
          <input type="email" value={email} onChange={e=>setEmail(e.target.value)}
            placeholder="Email" style={inp} onKeyDown={e=>e.key==="Enter"&&login()}/>
          <input type="password" value={password} onChange={e=>setPassword(e.target.value)}
            placeholder="Password" style={inp} onKeyDown={e=>e.key==="Enter"&&login()}/>
          {error && (
            <div style={{ color:T.red, fontSize:"12px", padding:"8px 10px",
              background:`${T.red}18`, borderRadius:"6px" }}>{error}</div>
          )}
          <button onClick={login} disabled={loading}
            style={{ padding:"13px", background:T.accent, border:"none", borderRadius:"10px",
              color:T.bg, fontSize:"15px", fontWeight:700,
              cursor:loading?"not-allowed":"pointer", opacity:loading?0.7:1, marginTop:"4px" }}>
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </div>
      </div>
    </div>
  );
}
