import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

let cachedClient = null;
const maxImageUploadSize = 5 * 1024 * 1024;
const maxDocumentUploadSize = 10 * 1024 * 1024;
const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const allowedDocumentTypes = new Set([...allowedImageTypes, "application/pdf"]);

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

export async function uploadPetImage(supabase, ownerId, petId, file) {
  console.log("selected file", file);
  validateUploadFile(file, "image");
  const safeName = safeFileName(file.name);
  const filePath = `${ownerId}/${petId}/${Date.now()}-${safeName}`;
  console.log("upload path", filePath);
  const { data, error } = await supabase.storage.from("pet-images").upload(filePath, file, {
    cacheControl: "3600",
    contentType: file.type,
    upsert: false,
  });
  console.log("upload result", data, error);

  if (error) {
    console.error("upload image error", error);
    throw error;
  }

  const signedUrl = await signedPetImageUrl(supabase, filePath);

  if (!signedUrl) {
    throw new Error("La imagen se subió, pero Supabase no permite leerla. Revisa las políticas del bucket pet-images.");
  }

  return filePath;
}

export async function uploadPetDocumentFile(supabase, petId, file) {
  validateUploadFile(file, "document");
  const safeName = safeFileName(file.name);
  const filePath = `${petId}/${Date.now()}-${safeName}`;
  const { error } = await supabase.storage.from("pet-documents").upload(filePath, file, {
    cacheControl: "3600",
    contentType: file.type,
    upsert: false,
  });

  if (error) {
    throw error;
  }

  return { fileUrl: filePath, filePath };
}

export async function logDocumentUpload(supabase, documentItem, file) {
  const { error } = await supabase.from("document_upload_logs").insert({
    document_id: documentItem.id,
    pet_id: documentItem.pet_id,
    uploaded_by: documentItem.uploaded_by,
    source: documentItem.source,
    file_name: file.name,
    file_type: file.type || null,
    file_size: file.size,
  });

  if (error) {
    console.warn("Document upload log error:", error.message);
  }
}

export async function removePetDocumentFile(supabase, filePath) {
  if (!filePath || filePath.startsWith("http")) {
    return;
  }

  const { error } = await supabase.storage.from("pet-documents").remove([filePath]);

  if (error) {
    console.warn("Document file delete error:", error.message);
  }
}

export async function signedPetImageUrl(supabase, imagePath) {
  if (!imagePath) {
    return "";
  }

  if (imagePath.startsWith("http")) {
    console.error("signed url error", new Error("pets.image_url debe ser un path relativo del bucket pet-images, no una URL publica."));
    return "";
  }

  const candidates = candidatePetImagePaths(imagePath);

  for (const candidate of candidates) {
    const { data, error } = await supabase.storage.from("pet-images").createSignedUrl(candidate, 3600);

    if (!error && data?.signedUrl) {
      return data.signedUrl;
    }

    if (error) {
      console.error("signed url error", error);
    }
  }

  return "";
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

export function validateStrongPassword(password) {
  const value = String(password || "");

  if (value.length < 12) {
    return "La contraseña debe tener al menos 12 caracteres.";
  }

  if (!/[a-z]/.test(value)) {
    return "La contraseña debe incluir al menos una letra minúscula.";
  }

  if (!/[A-Z]/.test(value)) {
    return "La contraseña debe incluir al menos una letra mayúscula.";
  }

  if (!/[0-9]/.test(value)) {
    return "La contraseña debe incluir al menos un número.";
  }

  if (!/[^A-Za-z0-9]/.test(value)) {
    return "La contraseña debe incluir al menos un símbolo.";
  }

  return "";
}

export function validateUploadFile(file, kind = "document") {
  if (!file) {
    throw new Error("Selecciona un archivo.");
  }

  const maxSize = kind === "image" ? maxImageUploadSize : maxDocumentUploadSize;
  const maxSizeLabel = kind === "image" ? "5MB" : "10MB";

  if (file.size > maxSize) {
    throw new Error(`El archivo supera el tamaño máximo de ${maxSizeLabel}.`);
  }

  const allowedTypes = kind === "image" ? allowedImageTypes : allowedDocumentTypes;
  const allowedLabel = kind === "image" ? "JPG, PNG o WEBP" : "JPG, PNG, WEBP o PDF";

  if (!allowedTypes.has(file.type)) {
    throw new Error(`Formato no permitido. Sube un archivo ${allowedLabel}.`);
  }
}

export function friendlyError(error) {
  const message = error?.message || "No se pudo completar la operación.";

  if (message.includes("row-level security")) {
    return "No tienes permisos para realizar esta acción.";
  }

  if (message.includes("new row violates row-level security policy")) {
    return "No tienes permisos para guardar esta información.";
  }

  if (message.includes("The resource already exists")) {
    return "Ese archivo ya existe. Cambia el nombre o vuelve a intentarlo.";
  }

  if (message.includes("JWT") || message.includes("session")) {
    return "Tu sesión ha caducado. Vuelve a iniciar sesión.";
  }

  return message;
}

export function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeFileName(fileName) {
  return String(fileName || "archivo")
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120) || "archivo";
}

function candidatePetImagePaths(imagePath) {
  const value = String(imagePath || "").trim();

  if (!value) {
    return [];
  }

  const candidates = [value];
  const parts = value.split("/");

  if (parts.length === 3) {
    candidates.push(`pets/${parts[1]}/${parts[2]}`);
  }

  if (!value.startsWith("pets/") && parts.length >= 2) {
    candidates.push(`pets/${value}`);
  }

  if (value.startsWith("pets/")) {
    candidates.push(value.replace(/^pets\//, ""));
  }

  return [...new Set(candidates)];
}
