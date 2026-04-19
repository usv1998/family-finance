const ENROLLED_KEY  = "biometric_enrolled";
const CRED_ID_KEY   = "biometric_cred_id";

// Encode/decode helpers for ArrayBuffer ↔ base64url
function bufToB64(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}
function b64ToBuf(b64) {
  const padded = b64.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(padded);
  return Uint8Array.from(bin, c => c.charCodeAt(0)).buffer;
}

export function isMobile() {
  if (navigator.userAgentData?.mobile != null) return navigator.userAgentData.mobile;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export function isBiometricSupported() {
  if (!isMobile()) return false; // desktop: skip lock entirely
  return !!(window.PublicKeyCredential && navigator.credentials);
}

export function isBiometricEnrolled() {
  return localStorage.getItem(ENROLLED_KEY) === "true";
}

export function clearBiometricEnrollment() {
  localStorage.removeItem(ENROLLED_KEY);
  localStorage.removeItem(CRED_ID_KEY);
}

// Register a new fingerprint credential. Call once after login.
export async function enrollBiometric(userEmail) {
  if (!isBiometricSupported()) throw new Error("WebAuthn not supported");

  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const userId    = crypto.getRandomValues(new Uint8Array(16));

  const cred = await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: "DudduKaasu", id: window.location.hostname },
      user: { id: userId, name: userEmail, displayName: userEmail },
      pubKeyCredParams: [
        { type: "public-key", alg: -7  },  // ES256
        { type: "public-key", alg: -257 }, // RS256 fallback
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform",  // built-in sensor only
        userVerification: "required",          // forces biometric/PIN
        residentKey: "preferred",
      },
      timeout: 60000,
    },
  });

  const credId = bufToB64(cred.rawId);
  localStorage.setItem(CRED_ID_KEY,  credId);
  localStorage.setItem(ENROLLED_KEY, "true");
  return credId;
}

// Verify fingerprint. Returns true on success, throws on failure/cancel.
export async function authenticateBiometric() {
  if (!isBiometricSupported()) throw new Error("WebAuthn not supported");

  const credIdB64 = localStorage.getItem(CRED_ID_KEY);
  const challenge = crypto.getRandomValues(new Uint8Array(32));

  const opts = {
    publicKey: {
      challenge,
      rpId: window.location.hostname,
      userVerification: "required",
      timeout: 60000,
    },
  };

  // If we have a stored credential id, hint at it so the OS picks the right key
  if (credIdB64) {
    opts.publicKey.allowCredentials = [{
      type: "public-key",
      id: b64ToBuf(credIdB64),
      transports: ["internal"],
    }];
  }

  await navigator.credentials.get(opts);
  return true;
}
