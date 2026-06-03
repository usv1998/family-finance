import { T } from "../../lib/theme";

export const ASSET_CATS = [
  { key: "mf",       label: "Mutual Funds",  color: "#A855F7" },
  { key: "us_stock", label: "US Stocks",     color: "#6366F1" },
  { key: "in_stock", label: "Indian Stocks", color: T.blue    },
  { key: "epf",      label: "EPF",           color: "#F97316" },
  { key: "ppf",      label: "PPF",           color: T.teal    },
  { key: "fd",       label: "FD / Bonds",    color: T.amber   },
  { key: "other",    label: "Other",         color: "#8B96AD" },
];

export const totalAssets = (assets) =>
  ASSET_CATS.reduce((s, c) => s + (parseFloat(assets?.[c.key]) || 0), 0);

export const emptyAssets = () =>
  Object.fromEntries(ASSET_CATS.map(c => [c.key, ""]));

// Backward compat: old snapshots may have "stocks" instead of "us_stock"
export function normaliseAssets(assets) {
  if (!assets) return {};
  const a = { ...assets };
  if (a.stocks !== undefined && a.us_stock === undefined) {
    a.us_stock = a.stocks;
    delete a.stocks;
  }
  return a;
}
