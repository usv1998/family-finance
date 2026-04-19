import { useState, useEffect } from "react";
import { T } from "../lib/theme";
import {
  authenticateBiometric, enrollBiometric, clearBiometricEnrollment,
  isBiometricEnrolled, isBiometricSupported,
} from "../lib/biometric";

// Phase flow:
//   "unsupported" → auto-unlock (WebAuthn not available on this browser)
//   "setup"       → first time: offer fingerprint/PIN enrollment
//   "enrolling"   → enrollBiometric() in progress
//   "idle"        → enrolled, waiting for user tap
//   "prompting"   → authenticateBiometric() in progress
//   "error"       → last attempt failed

function getInitialPhase() {
  if (!isBiometricSupported()) return "unsupported";
  if (!isBiometricEnrolled())  return "setup";
  return "idle";
}

export default function LockScreen({ userEmail, onUnlock, onSignOut }) {
  const [phase,  setPhase]  = useState(getInitialPhase);
  const [errMsg, setErrMsg] = useState("");

  // If WebAuthn not available in this browser → pass straight through
  useEffect(() => {
    if (phase === "unsupported") onUnlock();
  }, []); // eslint-disable-line

  // No auto-trigger: Chrome on Android requires a user gesture (tap) before showing
  // the biometric dialog — firing it from useEffect causes immediate NotAllowedError.

  // ── authenticate (unlock) ─────────────────────────────────────────────────
  const doUnlock = async () => {
    setPhase("prompting");
    setErrMsg("");
    try {
      await authenticateBiometric();
      onUnlock();
    } catch (e) {
      setPhase("error");
      setErrMsg(
        e?.name === "NotAllowedError"
          ? "Tap the fingerprint button to try again"
          : "Fingerprint didn't match. Try again."
      );
    }
  };

  // ── enroll then authenticate (first time) ─────────────────────────────────
  const doSetup = async () => {
    setPhase("enrolling");
    setErrMsg("");
    try {
      await enrollBiometric(userEmail || "user@duddukaasu");
      await authenticateBiometric();
      onUnlock();
    } catch (e) {
      setPhase("setup");
      setErrMsg(
        e?.name === "NotAllowedError"
          ? "Setup cancelled. Tap to try again."
          : "Setup failed. Try again or sign out."
      );
    }
  };

  const handleSignOut = () => {
    if (!window.confirm("Sign out? You'll need your password to log back in.")) return;
    clearBiometricEnrollment();
    onSignOut();
  };

  if (phase === "unsupported") return null; // will auto-unlock via useEffect

  const isSetup = phase === "setup" || phase === "enrolling";

  return (
    <div style={{ minHeight:"100dvh", background:T.bg, display:"flex", alignItems:"center",
      justifyContent:"center", fontFamily:"'DM Sans',-apple-system,sans-serif", padding:"24px" }}>
      <style>{`
        @keyframes pulse{0%,100%{opacity:1;}50%{opacity:0.3;}}
        @keyframes breathe{0%,100%{transform:scale(1);}50%{transform:scale(1.06);}}
      `}</style>

      <div style={{ background:T.surface, borderRadius:"28px", padding:"48px 32px",
        border:`1px solid ${T.border}`, width:"100%", maxWidth:"320px", textAlign:"center",
        boxShadow:"0 24px 64px rgba(0,0,0,0.5)" }}>

        {/* Logo */}
        <div style={{ width:"64px", height:"64px", borderRadius:"20px",
          background:`linear-gradient(135deg,${T.accent},${T.blue})`,
          display:"flex", alignItems:"center", justifyContent:"center",
          fontSize:"30px", fontWeight:800, color:T.bg, margin:"0 auto 18px" }}>₹</div>

        <h2 style={{ margin:"0 0 6px", fontSize:"21px", fontWeight:800, color:T.text }}>
          DudduKaasu
        </h2>

        {/* ── FIRST TIME: enrollment offer ── */}
        {isSetup && (
          <>
            <p style={{ margin:"0 0 10px", fontSize:"14px", fontWeight:600, color:T.text }}>
              Secure your app
            </p>
            <p style={{ margin:"0 0 28px", fontSize:"13px", color:T.textMuted, lineHeight:1.6 }}>
              Use your phone fingerprint or PIN to lock this app. Only you can access your finances.
            </p>

            <button onClick={doSetup} disabled={phase === "enrolling"}
              style={{ width:"100%", padding:"15px", background:T.accent, border:"none",
                borderRadius:"14px", color:T.bg, fontSize:"15px", fontWeight:700,
                cursor:phase==="enrolling"?"default":"pointer",
                opacity:phase==="enrolling"?0.7:1, marginBottom:"12px",
                display:"flex", alignItems:"center", justifyContent:"center", gap:"10px" }}>
              <FingerprintIcon color={T.bg} spinning={phase==="enrolling"} size={22}/>
              {phase === "enrolling" ? "Setting up…" : "Set up Fingerprint / PIN"}
            </button>

            {errMsg && (
              <p style={{ fontSize:"12px", color:T.red, margin:"0 0 12px",
                background:`${T.red}15`, padding:"8px 12px", borderRadius:"8px" }}>
                {errMsg}
              </p>
            )}

            <button onClick={handleSignOut}
              style={{ background:"none", border:"none", color:T.textMuted, fontSize:"12px",
                cursor:"pointer", textDecoration:"underline", marginTop:"4px" }}>
              Sign out instead
            </button>
          </>
        )}

        {/* ── ENROLLED: fingerprint unlock ── */}
        {!isSetup && (
          <>
            <p style={{ margin:"0 0 32px", fontSize:"13px", color:T.textMuted }}>
              {phase === "prompting" ? "Touch the fingerprint sensor…" : "Tap to unlock"}
            </p>

            {/* Big tap target */}
            <button onClick={doUnlock} disabled={phase === "prompting"}
              style={{ width:"100px", height:"100px", borderRadius:"50%", border:"none",
                cursor:phase==="prompting"?"default":"pointer",
                background:phase==="error" ? `${T.red}18` : `${T.accent}15`,
                display:"flex", alignItems:"center", justifyContent:"center",
                margin:"0 auto 20px", transition:"background 0.25s, transform 0.15s",
                outline:`3px solid ${phase==="error" ? T.red+"55" : T.accent+"44"}`,
                animation:phase==="idle"?"breathe 3s ease-in-out infinite":"none" }}>
              <FingerprintIcon
                color={phase==="error" ? T.red : phase==="prompting" ? T.textMuted : T.accent}
                spinning={phase==="prompting"}
                size={48}/>
            </button>

            {phase === "error" && (
              <p style={{ fontSize:"13px", color:T.red, margin:"0 0 20px",
                background:`${T.red}15`, padding:"8px 14px", borderRadius:"8px" }}>
                {errMsg}
              </p>
            )}

            <button onClick={handleSignOut}
              style={{ background:"none", border:"none", color:T.textMuted, fontSize:"12px",
                cursor:"pointer", textDecoration:"underline", marginTop:"4px" }}>
              Sign out instead
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function FingerprintIcon({ color, spinning, size = 40 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
      style={{ transition:"stroke 0.2s", flexShrink:0,
        animation:spinning ? "pulse 1.2s ease-in-out infinite" : "none" }}>
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
