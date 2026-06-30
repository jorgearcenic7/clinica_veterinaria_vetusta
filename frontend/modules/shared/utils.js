const maxImageUploadSize = 5 * 1024 * 1024;
const maxDocumentUploadSize = 10 * 1024 * 1024;
const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const allowedDocumentTypes = new Set([...allowedImageTypes, "application/pdf"]);

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
