import { useState, useEffect, useRef } from "react";
import { T } from "../lib/theme";
import {
  authenticateBiometric, enrollBiometric, clearBiometricEnrollment,
  isBiometricEnrolled, isBiometricSupported,
} from "../lib/biometric";

// Phase flow:
//   "unsupported" → auto-unlock
//   "setup"       → first time: full-screen enroll prompt
//   "enrolling"   → enrollBiometric() in progress
//   "idle"        → enrolled, waiting for tap anywhere
//   "prompting"   → authenticateBiometric() in progress
//   "error"       → last attempt failed, tap to retry

function getInitialPhase() {
  if (!isBiometricSupported()) return "unsupported";
  if (!isBiometricEnrolled())  return "setup";
  return "idle";
}

export default function LockScreen({ userEmail, onUnlock, onSignOut }) {
  const [phase,  setPhase]  = useState(getInitialPhase);
  const [errMsg, setErrMsg] = useState("");
  const containerRef = useRef(null);

  useEffect(() => {
    if (phase === "unsupported") onUnlock();
  }, []); // eslint-disable-line

  // ── authenticate ──────────────────────────────────────────────────────────
  const doUnlock = async () => {
    if (phase === "prompting" || phase === "enrolling") return;
    setPhase("prompting");
    setErrMsg("");
    try {
      await authenticateBiometric();
      onUnlock();
    } catch (e) {
      setPhase("error");
      setErrMsg(
        e?.name === "NotAllowedError"
          ? "Tap anywhere to try again"
          : "Didn't match. Tap to retry."
      );
    }
  };

  // ── enroll (first time) ───────────────────────────────────────────────────
  const doSetup = async () => {
    if (phase === "enrolling") return;
    setPhase("enrolling");
    setErrMsg("");
    try {
      await enrollBiometric(userEmail || "user@duddukaasu");
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

  const handleSignOut = (e) => {
    e.stopPropagation();
    if (!window.confirm("Sign out? You'll need your password to log back in.")) return;
    clearBiometricEnrollment();
    onSignOut();
  };

  if (phase === "unsupported") return null;

  const isSetup = phase === "setup" || phase === "enrolling";
  const isActive = phase === "prompting" || phase === "enrolling";

  return (
    <div
      ref={containerRef}
      onClick={isSetup ? doSetup : doUnlock}
      style={{
        minHeight: "100dvh", background: T.bg,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        fontFamily: "'DM Sans',-apple-system,sans-serif",
        cursor: isActive ? "default" : "pointer",
        userSelect: "none", WebkitUserSelect: "none",
        position: "relative", overflow: "hidden",
      }}
    >
      <style>{`
        @keyframes ripple {
          0%   { transform: scale(0.8); opacity: 0.6; }
          100% { transform: scale(2.4); opacity: 0; }
        }
        @keyframes breathe {
          0%, 100% { transform: scale(1);    opacity: 1; }
          50%       { transform: scale(1.08); opacity: 0.75; }
        }
        @keyframes spinPulse {
          0%   { transform: rotate(0deg)   scale(1);    opacity: 1; }
          50%  { transform: rotate(180deg) scale(1.05); opacity: 0.7; }
          100% { transform: rotate(360deg) scale(1);    opacity: 1; }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes shake {
          0%,100% { transform: translateX(0); }
          20%,60% { transform: translateX(-6px); }
          40%,80% { transform: translateX(6px); }
        }
      `}</style>

      {/* Ambient glow background */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: isActive
          ? `radial-gradient(ellipse 60% 40% at 50% 60%, ${T.accent}18 0%, transparent 70%)`
          : phase === "error"
            ? `radial-gradient(ellipse 60% 40% at 50% 60%, ${T.red}12 0%, transparent 70%)`
            : `radial-gradient(ellipse 60% 40% at 50% 60%, ${T.accent}10 0%, transparent 70%)`,
        transition: "background 0.6s ease",
      }}/>

      {/* Content */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center",
        gap: "0", animation: "fadeUp 0.5s ease both", zIndex: 1 }}>

        {/* App logo */}
        <div style={{
          width: "60px", height: "60px", borderRadius: "18px",
          background: `linear-gradient(135deg, ${T.accent}, #16A34A)`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "28px", fontWeight: 800, color: "#fff",
          marginBottom: "20px",
          boxShadow: `0 8px 32px ${T.accent}40`,
        }}>₹</div>

        {/* Title */}
        <div style={{ fontSize: "22px", fontWeight: 800, color: T.text,
          marginBottom: "6px", letterSpacing: "-0.3px" }}>
          DudduKaasu
        </div>
        <div style={{ fontSize: "13px", color: T.textMuted, marginBottom: "56px" }}>
          {isSetup
            ? "Secure your finances"
            : phase === "prompting" ? "Verifying…"
            : phase === "error"    ? "Authentication failed"
            : "Your finances are locked"}
        </div>

        {/* Fingerprint icon with ripple rings */}
        <div style={{ position: "relative", width: "120px", height: "120px",
          display: "flex", alignItems: "center", justifyContent: "center" }}>

          {/* Ripple rings — only when active */}
          {isActive && [0, 1, 2].map(i => (
            <div key={i} style={{
              position: "absolute", inset: 0, borderRadius: "50%",
              border: `1.5px solid ${T.accent}`,
              animation: `ripple 2s ease-out ${i * 0.6}s infinite`,
            }}/>
          ))}

          {/* Icon background circle */}
          <div style={{
            width: "96px", height: "96px", borderRadius: "50%",
            background: phase === "error"
              ? `${T.red}15`
              : isActive ? `${T.accent}20` : `${T.accent}12`,
            border: `2px solid ${phase === "error"
              ? T.red + "50" : isActive ? T.accent + "80" : T.accent + "40"}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "background 0.3s, border-color 0.3s",
            animation: !isActive && phase !== "error"
              ? "breathe 3.5s ease-in-out infinite" : "none",
          }}>
            <FingerprintIcon
              color={phase === "error" ? T.red : isActive ? T.accent : T.accent}
              spinning={isActive}
              size={48}
            />
          </div>
        </div>

        {/* Status text */}
        <div style={{
          marginTop: "32px", fontSize: "14px", fontWeight: 500,
          color: phase === "error" ? T.red : isActive ? T.accent : T.textMuted,
          textAlign: "center", minHeight: "20px",
          animation: phase === "error" ? "shake 0.4s ease" : "none",
          transition: "color 0.3s",
        }}>
          {isSetup
            ? (phase === "enrolling" ? "Setting up…" : "Tap anywhere to set up fingerprint")
            : phase === "prompting" ? "Touch the sensor on your phone"
            : phase === "error"     ? errMsg
            : "Tap anywhere to unlock"}
        </div>
      </div>

      {/* Sign out — bottom, doesn't trigger main tap */}
      <button
        onClick={handleSignOut}
        style={{
          position: "absolute", bottom: "32px",
          background: "none", border: "none",
          color: T.textMuted, fontSize: "12px",
          cursor: "pointer", padding: "8px 16px",
          borderRadius: "8px", zIndex: 2,
          fontFamily: "inherit",
        }}
      >
        Sign out
      </button>
    </div>
  );
}

function FingerprintIcon({ color, spinning, size = 40 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
      style={{
        flexShrink: 0, transition: "stroke 0.3s",
        animation: spinning ? "spinPulse 1.8s ease-in-out infinite" : "none",
      }}>
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
