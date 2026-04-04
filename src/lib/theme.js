export const T = {
  bg:"#0B1120", surface:"#131B2E", card:"#1A2340", cardHover:"#1F2B4D",
  border:"#2A3555", borderLight:"#354168",
  accent:"#22C55E", accentDim:"#166534", accentBg:"rgba(34,197,94,0.08)", accentGlow:"rgba(34,197,94,0.15)",
  text:"#E8ECF4", textDim:"#8B96AD", textMuted:"#5A6580", white:"#FFFFFF",
  red:"#EF4444", amber:"#F59E0B", blue:"#3B82F6", purple:"#A855F7", teal:"#14B8A6",
  selva:"#3B82F6", akshaya:"#EC4899",
};

export const sCard = (grand) => ({
  background: grand ? `linear-gradient(135deg,${T.accentDim},${T.card})` : T.card,
  border:`1px solid ${grand ? T.accent : T.border}`,
  borderRadius:"12px", padding:"16px",
  boxShadow: grand ? `0 0 20px ${T.accentGlow}` : "none",
});
