import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

let cachedClient = null;

export async function getSupabase() {
  if (cachedClient) {
    return cachedClient;
  }

  const response = await fetch("/api/supabase-config");
  const config = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(config.error || "No se pudo cargar la configuración de Supabase.");
  }

  cachedClient = createClient(config.supabaseUrl, config.supabaseAnonKey);
  return cachedClient;
}

export async function requireSession() {
  const supabase = await getSupabase();
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    throw error;
  }

  if (!data.session) {
    window.location.replace(`/auth?redirect=${encodeURIComponent(window.location.pathname)}`);
    return null;
  }

  return { supabase, session: data.session };
}

export async function requireAdmin() {
  const auth = await requireSession();

  if (!auth) {
    return null;
  }

  const profile = await getProfile(auth.supabase, auth.session.user.id);

  if (profile.role !== "admin") {
    window.location.replace("/dashboard");
    return null;
  }

  return { ...auth, profile };
}

export async function getProfile(supabase, userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id,full_name,phone,role,created_at")
    .eq("id", userId)
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function signOut() {
  const supabase = await getSupabase();
  await supabase.auth.signOut();
  window.location.replace("/auth");
}
