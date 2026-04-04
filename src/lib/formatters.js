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

export const getFYOptions = () => {
  const opts = [];
  for (let y = 2023; y <= 2028; y++) opts.push(`FY${y}-${(y+1).toString().slice(2)}`);
  return opts;
};

export const genId = () => Math.random().toString(36).slice(2, 10);
