import { createClient } from "@supabase/supabase-js";
import { cleanEnvValue, validateSupabaseUrl } from "./utils.js";

export const supabaseUrl = cleanEnvValue(process.env.SUPABASE_URL);
export const supabaseServiceRoleKey = cleanEnvValue(process.env.SUPABASE_SERVICE_ROLE_KEY);
export const supabaseAnonKey = cleanEnvValue(process.env.SUPABASE_ANON_KEY);

// Clave efectiva: service role si está disponible, anon como fallback.
const supabaseKey = supabaseServiceRoleKey || supabaseAnonKey;

export let supabaseConfigError = null;

// Cliente general (anon key o service role según env). Se usa como guard
// para saber si Supabase está configurado y en el fallback de operaciones anon.
export const supabase = supabaseUrl && supabaseKey ? createSupabaseClient(supabaseKey) : null;

// Cliente administrador — usa SUPABASE_SERVICE_ROLE_KEY exclusivamente.
// Bypass de RLS: emplear solo en código de servidor, nunca exponer al cliente.
export const supabaseAdmin = supabaseUrl && supabaseServiceRoleKey
  ? createSupabaseClient(supabaseServiceRoleKey, {
      Authorization: `Bearer ${supabaseServiceRoleKey}`,
    })
  : null;

function createSupabaseClient(key, extraHeaders = {}) {
  try {
    return createClient(validateSupabaseUrl(supabaseUrl), key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      global: {
        headers: extraHeaders,
      },
    });
  } catch (error) {
    supabaseConfigError = error;
    return null;
  }
}
