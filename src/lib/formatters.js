export const fmtINR = (n) => {
  if (n == null || isNaN(n)) return "₹0";
  const num = Math.round(Number(n));
  const s   = Math.abs(num).toString();
  let result = "";
  if (s.length <= 3) { result = s; }
  else {
    result = s.slice(-3);
    let rem = s.slice(0, -3);
    while (rem.length > 2) { result = rem.slice(-2) + "," + result; rem = rem.slice(0,-2); }
    if (rem.length > 0) result = rem + "," + result;
  }
  return (num < 0 ? "-₹" : "₹") + result;
};

export const fmtUSD = (n) => {
  if (n == null || isNaN(n)) return "$0";
  return "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits:2, maximumFractionDigits:2 });
};

export const getCurrentFY = () => {
  const now  = new Date();
  const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return `FY${year}-${(year + 1).toString().slice(2)}`;
};

// Returns Apr=0 … Mar=11 for today's month, regardless of FY
export const getCurrentMonthIdx = () => {
  const m = new Date().getMonth(); // 0=Jan … 11=Dec
  return m >= 3 ? m - 3 : m + 9;
};

export const getFYOptions = () => {
  const opts = [];
  for (let y = 2026; y <= 2028; y++) opts.push(`FY${y}-${(y+1).toString().slice(2)}`);
  return opts;
};

export const genId = () => Math.random().toString(36).slice(2, 10);

// Derive ESPP INR value from month data — supports both new model (espp_shares × price × rate)
// and legacy model (espp field stored directly as INR).
export const getEsspINR = (d) => {
  if (!d) return 0;
  if (d.espp_shares != null)
    return (Number(d.espp_shares) || 0) * (Number(d.espp_price_usd) || 0) * (Number(d.espp_usd_inr) || 0);
  return Number(d.espp) || 0;
};
