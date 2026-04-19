import { useState, useEffect } from "react";
import { T } from "../lib/theme";
import { authenticateBiometric, clearBiometricEnrollment, isBiometricSupported } from "../lib/biometric";

export default function LockScreen({ onUnlock, onSignOut }) {
  const [state,  setState]  = useState("idle"); // "idle" | "prompting" | "error"
  const [errMsg, setErrMsg] = useState("");

  // Auto-prompt on mount so user doesn't need to tap
  useEffect(() => { tryUnlock(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const tryUnlock = async () => {
    setState("prompting");
    setErrMsg("");
    try {
      await authenticateBiometric();
      onUnlock();
    } catch (e) {
      // NotAllowedError = user cancelled or timed out; everything else is a real error
      const cancelled = e?.name === "NotAllowedError";
      setState("error");
      setErrMsg(cancelled ? "Cancelled. Tap to try again." : "Fingerprint didn't match. Try again.");
    }
  };

  const handleSignOut = () => {
    if (!window.confirm("Sign out and remove fingerprint lock?")) return;
    clearBiometricEnrollment();
    onSignOut();
  };

  const supported = isBiometricSupported();

  return (
    <div style={{ minHeight:"100vh", background:T.bg, display:"flex", alignItems:"center",
      justifyContent:"center", fontFamily:"'DM Sans',-apple-system,sans-serif" }}>
      <style>{`@keyframes pulse{0%,100%{opacity:1;}50%{opacity:0.3;}}`}</style>
      <div style={{ background:T.surface, borderRadius:"20px", padding:"44px 36px",
        border:`1px solid ${T.border}`, width:"100%", maxWidth:"320px", textAlign:"center" }}>

        {/* Logo */}
        <div style={{ width:"56px", height:"56px", borderRadius:"16px",
          background:`linear-gradient(135deg,${T.accent},${T.blue})`,
          display:"flex", alignItems:"center", justifyContent:"center",
          fontSize:"28px", fontWeight:800, color:T.bg, margin:"0 auto 20px" }}>₹</div>

        <h2 style={{ margin:"0 0 6px", fontSize:"20px", fontWeight:800, color:T.text }}>
          DudduKaasu
        </h2>
        <p style={{ margin:"0 0 32px", fontSize:"13px", color:T.textMuted }}>
          Unlock to continue
        </p>

        {/* Fingerprint button */}
        {supported ? (
          <button onClick={tryUnlock} disabled={state === "prompting"}
            style={{ width:"80px", height:"80px", borderRadius:"50%", border:"none",
              cursor: state === "prompting" ? "default" : "pointer",
              background: state === "error" ? `${T.red}22` : `${T.accent}18`,
              display:"flex", alignItems:"center", justifyContent:"center",
              margin:"0 auto 20px", transition:"background 0.2s",
              outline: `2px solid ${state === "error" ? T.red : T.accent}33` }}>
            <FingerprintIcon
              color={state === "error" ? T.red : state === "prompting" ? T.textMuted : T.accent}
              spinning={state === "prompting"}/>
          </button>
        ) : (
          <div style={{ fontSize:"13px", color:T.red, marginBottom:"20px" }}>
            Biometric auth not supported in this browser.
          </div>
        )}

        {state === "prompting" && (
          <p style={{ fontSize:"13px", color:T.textMuted, margin:"0 0 20px" }}>
            Waiting for fingerprint…
          </p>
        )}
        {state === "idle" && supported && (
          <p style={{ fontSize:"13px", color:T.textMuted, margin:"0 0 20px" }}>
            Tap the fingerprint icon
          </p>
        )}
        {state === "error" && (
          <p style={{ fontSize:"13px", color:T.red, margin:"0 0 20px" }}>{errMsg}</p>
        )}

        {/* Sign out fallback */}
        <button onClick={handleSignOut}
          style={{ background:"none", border:"none", color:T.textMuted, fontSize:"12px",
            cursor:"pointer", textDecoration:"underline", marginTop:"8px" }}>
          Sign out instead
        </button>
      </div>
    </div>
  );
}

function FingerprintIcon({ color, spinning }) {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
      style={{ transition:"stroke 0.2s", animation: spinning ? "pulse 1.2s ease-in-out infinite" : "none" }}>
      <path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4"/>
      <path d="M14 13.12c0 2.38 0 6.38-1 8.88"/>
      <path d="M17.29 21.02c.12-.6.43-2.3.5-3.02"/>
      <path d="M2 12a10 10 0 0 1 18-6"/>
      <path d="M2 17a10 10 0 0 0 2.81 5"/>
      <path d="M22 12a10 10 0 0 1-.32 2.61"/>
      <path d="M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2"/>
      <path d="M17.65 6A6 6 0 0 1 18 12c0 .86-.1 1.7-.3 2.5"/>
    </svg>
  );
}
