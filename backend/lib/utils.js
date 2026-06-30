// Utilidades puras sin efectos secundarios: validación, escape y helpers de cadena.

export function safeString(value, maxLength = 160) {
  return String(value || "").trim().slice(0, maxLength);
}

export function safeEmail(value) {
  return safeString(value, 254).toLowerCase();
}

export function isValidEmail(value) {
  const email = safeEmail(value);
  const atIndex = email.indexOf("@");
  const lastDotIndex = email.lastIndexOf(".");
  return (
    email.length >= 6
    && email.length <= 254
    && !email.includes(" ")
    && atIndex > 0
    && atIndex === email.lastIndexOf("@")
    && lastDotIndex > atIndex + 1
    && lastDotIndex < email.length - 1
  );
}

export function isDigits(value) {
  return [...String(value || "")].every((char) => char >= "0" && char <= "9");
}

export function isValidMonthKey(value) {
  const month = safeString(value, 7);
  const [year, monthNumber] = month.split("-");
  return (
    month.length === 7
    && year?.length === 4
    && monthNumber?.length === 2
    && isDigits(year)
    && isDigits(monthNumber)
    && Number(monthNumber) >= 1
    && Number(monthNumber) <= 12
  );
}

export function isValidDateTimeKey(value) {
  const datetime = safeString(value, 16);
  if (
    datetime.length !== 16
    || datetime[4] !== "-"
    || datetime[7] !== "-"
    || datetime[10] !== "T"
    || datetime[13] !== ":"
  ) {
    return false;
  }
  const year = datetime.slice(0, 4);
  const month = datetime.slice(5, 7);
  const day = datetime.slice(8, 10);
  const hour = datetime.slice(11, 13);
  const minute = datetime.slice(14, 16);
  if (![year, month, day, hour, minute].every(isDigits)) {
    return false;
  }
  const parsed = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
  );
  return (
    Number(month) >= 1
    && Number(month) <= 12
    && Number(day) >= 1
    && Number(day) <= 31
    && Number(hour) >= 0
    && Number(hour) <= 23
    && Number(minute) >= 0
    && Number(minute) <= 59
    && parsed.getFullYear() === Number(year)
    && parsed.getMonth() === Number(month) - 1
    && parsed.getDate() === Number(day)
  );
}

export function cleanEnvValue(value) {
  return String(value || "").trim().replace(/^["']|["']$/g, "");
}

export function cleanGooglePrivateKey(value) {
  return cleanEnvValue(value).replace(/\\n/g, "\n");
}

export function escapeHtmlText(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function escapeJavaScript(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

export function base64UrlJson(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

export function getBearerToken(request) {
  const header = safeString(request.get("authorization"), 4096);
  const prefix = "bearer ";
  if (!header.toLowerCase().startsWith(prefix)) {
    return "";
  }
  return header.slice(prefix.length).trim();
}

export function validateSupabaseUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") {
      throw new Error("SUPABASE_URL debe empezar por https://");
    }
    return url.origin;
  } catch {
    throw new Error(
      "SUPABASE_URL no es valida. Debe tener formato https://TU-PROYECTO.supabase.co",
    );
  }
}

export function formatReservationServiceForCalendar(value) {
  const labels = {
    consulta: "Consulta general",
    vacunacion: "Vacunacion",
    cirugia: "Cirugia",
    peluqueria: "Peluqueria",
    urgencia: "Urgencia",
  };
  return labels[value] || value || "Sin indicar";
}
