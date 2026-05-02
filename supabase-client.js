import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

let cachedClient = null;

export async function getSupabase() {
  if (cachedClient) {
    return cachedClient;
  }

  const response = await fetch("/api/supabase-config");
  const config = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(config.error || "No se pudo cargar la configuracion de Supabase.");
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

export function formatDate(value) {
  if (!value) {
    return "Sin fecha";
  }

  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

export function todayKey() {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function calculateAge(birthDate) {
  if (!birthDate) {
    return "Sin fecha de nacimiento";
  }

  const today = new Date();
  const birth = new Date(`${birthDate}T00:00:00`);
  let years = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    years -= 1;
  }

  if (years <= 0) {
    return "Menos de 1 año";
  }

  return `${years} ${years === 1 ? "año" : "años"}`;
}

export async function uploadPetImage(supabase, petId, file) {
  const extension = getFileExtension(file.name);
  const filePath = `${petId}/photo-${Date.now()}.${extension}`;
  const { error } = await supabase.storage.from("pet-images").upload(filePath, file, {
    cacheControl: "3600",
    upsert: true,
  });

  if (error) {
    throw error;
  }

  return filePath;
}

export async function uploadPetDocumentFile(supabase, petId, file) {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  const filePath = `${petId}/${Date.now()}-${safeName}`;
  const { error } = await supabase.storage.from("pet-documents").upload(filePath, file, {
    cacheControl: "3600",
    upsert: false,
  });

  if (error) {
    throw error;
  }

  return { fileUrl: filePath, filePath };
}

export async function signedPetImageUrl(supabase, imagePath) {
  if (!imagePath) {
    return "";
  }

  if (imagePath.startsWith("http")) {
    return imagePath;
  }

  const { data, error } = await supabase.storage.from("pet-images").createSignedUrl(imagePath, 3600);

  if (error) {
    throw error;
  }

  return data.signedUrl;
}

export async function signedPetDocumentUrl(supabase, filePath) {
  if (!filePath) {
    return "";
  }

  if (filePath.startsWith("http")) {
    return filePath;
  }

  const { data, error } = await supabase.storage.from("pet-documents").createSignedUrl(filePath, 3600);

  if (error) {
    throw error;
  }

  return data.signedUrl;
}

export function formToObject(form) {
  return Object.fromEntries(new FormData(form).entries());
}

export function setStatus(element, message, isError = false) {
  element.textContent = message || "";
  element.classList.toggle("error", Boolean(isError));
}

export function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getFileExtension(fileName) {
  const extension = fileName.split(".").pop()?.toLowerCase();
  return extension && extension.length <= 8 ? extension : "bin";
}
