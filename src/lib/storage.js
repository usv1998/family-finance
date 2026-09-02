import { supabase } from "./supabase";
import { STORAGE_KEY } from "./constants";

const STORAGE_META_KEY = `${STORAGE_KEY}:meta`;

function loadLocalSnapshot() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const meta = JSON.parse(localStorage.getItem(STORAGE_META_KEY) || "{}");
    return {
      data: JSON.parse(raw),
      updatedAt: meta.updatedAt || null,
      source: "local",
    };
  } catch {
    return null;
  }
}

function saveLocalSnapshot(data, updatedAt) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    localStorage.setItem(STORAGE_META_KEY, JSON.stringify({ updatedAt }));
  } catch {}
}

export const loadData = async (userId, options = {}) => {
  const { remoteOnly = false } = options;
  if (supabase && userId) {
    try {
      const { data, error } = await supabase
        .from("finance_data").select("data, updated_at").eq("id", userId).maybeSingle();
      if (!error && data?.data) {
        saveLocalSnapshot(data.data, data.updated_at || null);
        return {
          data: data.data,
          updatedAt: data.updated_at || null,
          source: "cloud",
        };
      }
      if (error) {
        return remoteOnly ? { data: null, updatedAt: null, source: "error", error } : loadLocalSnapshot();
      }
    } catch {}
  }
  if (remoteOnly) return null;
  return loadLocalSnapshot();
};

export const saveData = async (data, userId) => {
  const updatedAt = new Date().toISOString();
  saveLocalSnapshot(data, updatedAt);
  if (supabase && userId) {
    try {
      const { error } = await supabase.from("finance_data")
        .upsert({ id: userId, data, updated_at: new Date().toISOString() });
      if (!error) return { updatedAt, source: "cloud" };
      return { updatedAt, source: "local", error };
    } catch (e) { console.error("Supabase save failed:", e); }
  }
  return { updatedAt, source: "local" };
};
