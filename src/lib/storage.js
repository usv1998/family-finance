import { supabase } from "./supabase";
import { STORAGE_KEY } from "./constants";

export const loadData = async (userId) => {
  if (supabase && userId) {
    try {
      const { data, error } = await supabase
        .from("finance_data").select("data").eq("id", userId).single();
      if (!error && data?.data) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data.data));
        return data.data;
      }
    } catch {}
  }
  try { const raw = localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : null; }
  catch { return null; }
};

export const saveData = async (data, userId) => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {}
  if (supabase && userId) {
    try {
      await supabase.from("finance_data")
        .upsert({ id: userId, data, updated_at: new Date().toISOString() });
    } catch (e) { console.error("Supabase save failed:", e); }
  }
};
