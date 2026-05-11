import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";
import express from "express";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicRoot = process.cwd();

const app = express();
const port = Number(process.env.PORT || 3000);
const cacheTtlSeconds = Number(process.env.REVIEWS_CACHE_TTL_SECONDS || 1800);
const dailyRequestLimit = Number(process.env.GOOGLE_DAILY_REQUEST_LIMIT || 25);
const liveReviewsEnabled = process.env.GOOGLE_ENABLE_LIVE_REVIEWS !== "false";
const defaultLatitude = 43.36443719850797;
const defaultLongitude = -5.833903884657452;
const usageFilePath = path.join(__dirname, ".google-usage.json");
const localReviewsFilePath = path.join(__dirname, "reviews.local.json");
const reservationsFilePath = process.env.VERCEL
  ? path.join(os.tmpdir(), "reservations.json")
  : path.join(__dirname, "reservations.json");
const supabaseUrl = cleanEnvValue(process.env.SUPABASE_URL);
const supabaseServiceRoleKey = cleanEnvValue(process.env.SUPABASE_SERVICE_ROLE_KEY);
const supabaseKey = cleanEnvValue(supabaseServiceRoleKey || process.env.SUPABASE_ANON_KEY);
const supabaseAnonKey = cleanEnvValue(process.env.SUPABASE_ANON_KEY);
const gaId = cleanEnvValue(process.env.NEXT_PUBLIC_GA_ID || process.env.VITE_GA_ID);
const googleCalendarId = cleanEnvValue(process.env.GOOGLE_CALENDAR_ID || "clinicavetusta@gmail.com");
const googleClientEmail = cleanEnvValue(process.env.GOOGLE_CLIENT_EMAIL);
const googlePrivateKey = cleanGooglePrivateKey(process.env.GOOGLE_PRIVATE_KEY);
const resendApiKey = cleanEnvValue(process.env.RESEND_API_KEY);
const reservationFromEmail = cleanEnvValue(process.env.RESERVATION_FROM_EMAIL || "Clínica Veterinaria Vetusta <reservas@clinicavetusta.com>");
const clinicPhone = cleanEnvValue(process.env.CLINIC_PHONE || "985 20 65 58");
let supabaseConfigError = null;
const supabase = supabaseUrl && supabaseKey
  ? createSupabaseClient()
  : null;

function createSupabaseClient() {
  try {
    return createClient(validateSupabaseUrl(supabaseUrl), supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  } catch (error) {
    supabaseConfigError = error;
    return null;
  }
}

let reviewsCache = null;
let resolvedPlaceCache = null;

app.use(express.json());

const publicFiles = {
  "/": "code.html",
  "/code.html": "code.html",
  "/servicios": "code.html",
  "/contacto": "code.html",
  "/auth": "auth.html",
  "/auth.html": "auth.html",
  "/area-privada": "auth.html",
  "/dashboard": "dashboard.html",
  "/dashboard.html": "dashboard.html",
  "/pet-detail.html": "pet-detail.html",
  "/admin": "admin.html",
  "/admin.html": "admin.html",
  "/terminos-legales": "terminos-legales.html",
  "/terminos-legales.html": "terminos-legales.html",
  "/condiciones-uso": "condiciones-uso.html",
  "/condiciones-uso.html": "condiciones-uso.html",
  "/politica-privacidad": "politica-privacidad.html",
  "/politica-privacidad.html": "politica-privacidad.html",
  "/aviso-legal.html": "aviso-legal.html",
  "/privacidad.html": "privacidad.html",
  "/cookies.html": "cookies.html",
  "/sitemap.html": "sitemap.html",
  "/booking.js": "booking.js",
  "/reviews.js": "reviews.js",
  "/i18n.js": "i18n.js",
  "/supabase-client.js": "supabase-client.js",
  "/auth.js": "auth.js",
  "/dashboard.js": "dashboard.js",
  "/pet-detail.js": "pet-detail.js",
  "/admin.js": "admin.js",
  "/client-area.css": "client-area.css",
  "/screen.png": "screen.png",
  "/google-logo.svg": "google-logo.svg",
  "/robots.txt": "robots.txt",
  "/sitemap.xml": "sitemap.xml",
  "/favicon.svg": "favicon.svg",
  "/favicon.ico": "favicon.svg",
};

Object.entries(publicFiles).forEach(([route, filename]) => {
  app.get(route, (request, response, next) => {
    if (["/auth", "/auth.html", "/area-privada", "/dashboard", "/dashboard.html", "/admin", "/admin.html", "/pet-detail.html"].includes(route)) {
      response.set("Cache-Control", "no-store");
    }

    response.sendFile(filename, { root: publicRoot }, (error) => {
      if (error) {
        next(error);
      }
    });
  });
});

app.get("/analytics.js", (_request, response) => {
  response.type("application/javascript");
  response.set("Cache-Control", "public, max-age=300");

  if (!gaId) {
    response.send("");
    return;
  }

  response.send(`
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${escapeJavaScript(gaId)}');
(function(){
  var script = document.createElement('script');
  script.async = true;
  script.src = 'https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaId)}';
  document.head.appendChild(script);
})();
`);
});

app.get("/dashboard/pets/:id", (_request, response, next) => {
  response.set("Cache-Control", "no-store");
  response.sendFile("pet-detail.html", { root: publicRoot }, (error) => {
    if (error) {
      next(error);
    }
  });
});

app.get("/api/google-reviews", async (_request, response) => {
  try {
    const now = Date.now();

    if (reviewsCache && reviewsCache.expiresAt > now) {
      response.json({ ...reviewsCache.data, cached: true });
      return;
    }

    const data = liveReviewsEnabled ? await fetchGoogleReviews() : await fetchLocalReviews();
    reviewsCache = {
      data,
      expiresAt: now + cacheTtlSeconds * 1000,
    };

    response.json({ ...data, cached: false });
  } catch (error) {
    console.error("Google reviews error:", error);
    response.status(error.statusCode || 500).json({
      error: "No se pudieron cargar las reseñas de Google.",
      detail: process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  }
});

app.get("/api/availability", async (request, response) => {
  try {
    const month = String(request.query.month || "").trim();

    if (!/^\d{4}-\d{2}$/.test(month)) {
      response.status(400).json({ error: "Usa el parametro month con formato YYYY-MM." });
      return;
    }

    const reservations = await readReservations(month);
    response.json(buildMonthAvailability(month, reservations));
  } catch (error) {
    console.error("Availability error:", error);
    response.status(error.statusCode || 500).json({
      error: "No se pudo cargar la disponibilidad.",
      detail: error.message,
    });
  }
});

app.get("/api/supabase-config", (_request, response) => {
  const publicSupabaseUrl = cleanEnvValue(process.env.SUPABASE_URL);
  const publicSupabaseAnonKey = cleanEnvValue(process.env.SUPABASE_ANON_KEY);

  if (!publicSupabaseUrl || !publicSupabaseAnonKey) {
    response.status(500).json({
      error: "Faltan SUPABASE_URL o SUPABASE_ANON_KEY en las variables de entorno.",
    });
    return;
  }

  try {
    response.json({
      supabaseUrl: validateSupabaseUrl(publicSupabaseUrl),
      supabaseAnonKey: publicSupabaseAnonKey,
    });
  } catch (error) {
    response.status(500).json({ error: error.message });
  }
});

app.post("/api/reservations", async (request, response) => {
  try {
    const reservation = normalizeReservation(request.body);
    const reservations = await readReservations(reservation.datetime.slice(0, 7));

    if (!isBookableDateTime(reservation.datetime, reservation.servicio)) {
      response.status(400).json({ error: "La fecha u hora elegida no esta dentro del horario de la clinica." });
      return;
    }

    const alreadyReserved = reservations.some((item) => reservationOverlaps(item, reservation));

    if (alreadyReserved) {
      response.status(409).json({ error: "Ese horario ya esta reservado. Elige otro hueco." });
      return;
    }

    const savedReservation = await saveReservation(reservation);
    const emailResult = await sendReservationEmailIfRequested(savedReservation, reservation.emailCopy);
    response.status(201).json({ ok: true, reservation: savedReservation, email: emailResult });
  } catch (error) {
    response.status(error.statusCode || 400).json({ error: error.message || "No se pudo crear la reserva." });
  }
});

app.patch("/api/admin/reservations/:id", async (request, response) => {
  try {
    const auth = await requireAdminRequest(request);
    const reservationId = String(request.params.id || "").trim();
    const changes = normalizeReservationUpdate(request.body);

    if (!reservationId) {
      response.status(400).json({ error: "Falta el id de la reserva." });
      return;
    }

    const updatedReservation = await updateReservationFromAdmin(auth.supabase, reservationId, changes);
    response.json({ ok: true, reservation: updatedReservation });
  } catch (error) {
    console.error("Reservation admin update error:", error);
    response.status(error.statusCode || 500).json({
      error: error.message || "No se pudo actualizar la reserva.",
    });
  }
});

async function fetchGoogleReviews() {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  const placeId = await getPlaceId(apiKey);
  const languageCode = process.env.GOOGLE_LANGUAGE_CODE || "es";

  if (!apiKey) {
    const error = new Error("Falta GOOGLE_PLACES_API_KEY en el archivo .env.");
    error.statusCode = 500;
    throw error;
  }

  const url = new URL(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`);
  url.searchParams.set("languageCode", languageCode);

  await registerGoogleRequest("placeDetails");

  const googleResponse = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "rating,userRatingCount,reviews,googleMapsUri",
    },
  });

  const payload = await googleResponse.json();

  if (!googleResponse.ok) {
    const error = new Error(payload?.error?.message || `Google Places respondió con ${googleResponse.status}.`);
    error.statusCode = googleResponse.status;
    throw error;
  }

  const reviews = (payload.reviews || [])
    .map((review) => ({
      author: review.authorAttribution?.displayName || "Cliente de Google",
      authorUrl: review.authorAttribution?.uri || null,
      rating: review.rating || null,
      text: review.text?.text || "",
      relativeTime: review.relativePublishTimeDescription || "",
      publishedAt: review.publishTime || null,
    }))
    .filter((review) => review.text)
    .sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0))
    .slice(0, 3);

  return {
    placeId,
    rating: payload.rating || null,
    reviewCount: payload.userRatingCount || 0,
    googleMapsUri: payload.googleMapsUri || null,
    reviews,
    updatedAt: new Date().toISOString(),
  };
}

async function fetchLocalReviews() {
  const raw = await fs.readFile(localReviewsFilePath, "utf8");
  const data = JSON.parse(raw);

  return {
    source: "local",
    rating: data.rating || null,
    reviewCount: data.reviewCount || 0,
    googleMapsUri: data.googleMapsUri || null,
    reviews: data.reviews || [],
    updatedAt: new Date().toISOString(),
  };
}

async function getPlaceId(apiKey) {
  if (!apiKey) {
    const error = new Error("Falta GOOGLE_PLACES_API_KEY en el archivo .env.");
    error.statusCode = 500;
    throw error;
  }

  if (process.env.GOOGLE_PLACE_ID) {
    return process.env.GOOGLE_PLACE_ID;
  }

  if (resolvedPlaceCache) {
    return resolvedPlaceCache.id;
  }

  const latitude = Number(process.env.GOOGLE_PLACE_LATITUDE || defaultLatitude);
  const longitude = Number(process.env.GOOGLE_PLACE_LONGITUDE || defaultLongitude);
  const radius = Number(process.env.GOOGLE_PLACE_SEARCH_RADIUS_METERS || 80);
  const languageCode = process.env.GOOGLE_LANGUAGE_CODE || "es";

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    const error = new Error("GOOGLE_PLACE_LATITUDE y GOOGLE_PLACE_LONGITUDE deben ser coordenadas validas.");
    error.statusCode = 500;
    throw error;
  }

  await registerGoogleRequest("nearbySearch");

  const googleResponse = await fetch("https://places.googleapis.com/v1/places:searchNearby", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "places.id,places.displayName,places.location,places.primaryType,places.types",
    },
    body: JSON.stringify({
      includedTypes: ["veterinary_care"],
      languageCode,
      maxResultCount: 5,
      rankPreference: "DISTANCE",
      locationRestriction: {
        circle: {
          center: { latitude, longitude },
          radius,
        },
      },
    }),
  });

  const payload = await googleResponse.json();

  if (!googleResponse.ok) {
    const error = new Error(payload?.error?.message || `Google Nearby Search respondio con ${googleResponse.status}.`);
    error.statusCode = googleResponse.status;
    throw error;
  }

  const place = (payload.places || [])[0];

  if (!place?.id) {
    const error = new Error(`No se encontro una clinica veterinaria cerca de ${latitude}, ${longitude}. Ajusta GOOGLE_PLACE_SEARCH_RADIUS_METERS o usa GOOGLE_PLACE_ID.`);
    error.statusCode = 404;
    throw error;
  }

  resolvedPlaceCache = {
    id: place.id,
    name: place.displayName?.text || null,
  };

  return resolvedPlaceCache.id;
}

async function registerGoogleRequest(type) {
  if (!liveReviewsEnabled) {
    const error = new Error("Las consultas reales a Google estan desactivadas con GOOGLE_ENABLE_LIVE_REVIEWS=false.");
    error.statusCode = 503;
    throw error;
  }

  const usage = await readUsage();
  const today = new Date().toISOString().slice(0, 10);

  if (usage.date !== today) {
    usage.date = today;
    usage.count = 0;
    usage.byType = {};
  }

  if (Number.isFinite(dailyRequestLimit) && dailyRequestLimit > 0 && usage.count >= dailyRequestLimit) {
    const error = new Error(`Limite diario local de Google alcanzado (${dailyRequestLimit}). Sube GOOGLE_DAILY_REQUEST_LIMIT o espera a manana.`);
    error.statusCode = 429;
    throw error;
  }

  usage.count += 1;
  usage.byType[type] = (usage.byType[type] || 0) + 1;
  usage.updatedAt = new Date().toISOString();

  await fs.writeFile(usageFilePath, JSON.stringify(usage, null, 2));
}

async function readUsage() {
  try {
    const raw = await fs.readFile(usageFilePath, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.warn("No se pudo leer .google-usage.json, se reinicia contador local.", error);
    }

    return {
      date: new Date().toISOString().slice(0, 10),
      count: 0,
      byType: {},
    };
  }
}

async function readReservations(month) {
  if (supabaseConfigError) {
    throw supabaseConfigError;
  }

  if (supabase) {
    return readSupabaseReservations(month);
  }

  try {
    const raw = await fs.readFile(reservationsFilePath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error.code === "ENOENT") {
      await fs.writeFile(reservationsFilePath, "[]");
      return [];
    }

    throw error;
  }
}

async function readSupabaseReservations(month) {
  if (!supabaseServiceRoleKey) {
    return readPublicSupabaseReservationSlots(month);
  }

  const [year, monthNumber] = month.split("-").map(Number);
  const startDate = `${month}-01T00:00`;
  const endDate = `${year}-${String(monthNumber + 1).padStart(2, "0")}-01T00:00`;
  const normalizedEndDate = monthNumber === 12
    ? `${year + 1}-01-01T00:00`
    : endDate;

  const { data, error } = await supabase
    .from("reservations")
    .select(reservationSelectFields())
    .gte("datetime", startDate)
    .lt("datetime", normalizedEndDate);

  if (error) {
    throw new Error(`Supabase no pudo leer reservas: ${error.message}`);
  }

  return data.map((reservation) => ({
    id: reservation.id,
    nombre: reservation.nombre,
    telefono: reservation.telefono,
    email: reservation.email,
    mascota: reservation.mascota,
    servicio: reservation.servicio,
    datetime: reservation.datetime,
    status: reservation.status || "confirmed",
    notes: reservation.notes,
    workerId: reservation.worker_id,
    googleEventId: reservation.google_event_id,
    googleSyncError: reservation.google_sync_error,
    googleSyncedAt: reservation.google_synced_at,
    startAt: reservation.start_at,
    endAt: reservation.end_at,
    clientId: reservation.client_id,
    updatedAt: reservation.updated_at,
    createdAt: reservation.created_at,
  }));
}

async function readPublicSupabaseReservationSlots(month) {
  const { data, error } = await supabase.rpc("get_reserved_reservation_slots", {
    p_month: month,
  });

  if (error) {
    throw new Error(
      "Supabase no pudo leer reservas. Anade SUPABASE_SERVICE_ROLE_KEY al backend/Vercel o vuelve a ejecutar supabase-reservations.sql para crear la funcion publica de disponibilidad: "
      + error.message,
    );
  }

  return (data || []).map((reservation) => ({
    datetime: reservation.datetime,
    status: reservation.status || "confirmed",
  }));
}

function reservationSelectFields() {
  return [
    "id",
    "nombre",
    "telefono",
    "email",
    "mascota",
    "servicio",
    "datetime",
    "status",
    "notes",
    "worker_id",
    "google_event_id",
    "google_sync_error",
    "google_synced_at",
    "start_at",
    "end_at",
    "client_id",
    "updated_at",
    "created_at",
  ].join(",");
}

async function requireAdminRequest(request) {
  const accessToken = getBearerToken(request);

  if (!accessToken) {
    const error = new Error("No autenticado.");
    error.statusCode = 401;
    throw error;
  }

  if (supabaseConfigError) {
    throw supabaseConfigError;
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    const error = new Error("Faltan SUPABASE_URL o SUPABASE_ANON_KEY.");
    error.statusCode = 500;
    throw error;
  }

  const requestSupabase = createClient(validateSupabaseUrl(supabaseUrl), supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });

  const { data: userData, error: userError } = await requestSupabase.auth.getUser(accessToken);

  if (userError || !userData.user) {
    const error = new Error("Sesion no valida.");
    error.statusCode = 401;
    throw error;
  }

  const { data: profile, error: profileError } = await requestSupabase
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .single();

  if (profileError || profile?.role !== "admin") {
    const error = new Error("No tienes permisos de administrador.");
    error.statusCode = 403;
    throw error;
  }

  return {
    supabase: requestSupabase,
    user: userData.user,
  };
}

function getBearerToken(request) {
  const header = request.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || "";
}

function normalizeReservationUpdate(body) {
  const changes = {};

  if (Object.hasOwn(body || {}, "status")) {
    const status = cleanText(body.status);

    if (!["pending", "confirmed", "cancelled"].includes(status)) {
      const error = new Error("Estado de reserva no valido.");
      error.statusCode = 400;
      throw error;
    }

    changes.status = status;
  }

  if (Object.hasOwn(body || {}, "datetime")) {
    const datetime = cleanText(body.datetime);

    if (!isBookableDateTime(datetime)) {
      const error = new Error("La fecha u hora elegida no esta dentro del horario de la clinica.");
      error.statusCode = 400;
      throw error;
    }

    changes.datetime = datetime;
    Object.assign(changes, buildReservationTimestamps(datetime));
  }

  if (Object.hasOwn(body || {}, "notes")) {
    changes.notes = cleanLongText(body.notes) || null;
  }

  if (Object.hasOwn(body || {}, "worker_id")) {
    changes.worker_id = cleanText(body.worker_id) || null;
  }

  if (Object.keys(changes).length === 0) {
    const error = new Error("No hay cambios para aplicar.");
    error.statusCode = 400;
    throw error;
  }

  return changes;
}

async function updateReservationFromAdmin(requestSupabase, reservationId, changes) {
  const { data: current, error: readError } = await requestSupabase
    .from("reservations")
    .select(reservationSelectFields())
    .eq("id", reservationId)
    .single();

  if (readError) {
    throw new Error(`Supabase no pudo leer la reserva: ${readError.message}`);
  }

  const next = {
    ...current,
    ...toDatabaseReservationChanges(changes),
  };

  if (Object.hasOwn(changes, "datetime")) {
    Object.assign(next, toDatabaseReservationChanges(buildReservationTimestamps(next.datetime, next.servicio)));

    if (!isBookableDateTime(next.datetime, next.servicio)) {
      const error = new Error("La fecha u hora elegida no esta dentro del horario de la clinica.");
      error.statusCode = 400;
      throw error;
    }

    const reservations = await readReservations(next.datetime.slice(0, 7));
    const alreadyReserved = reservations.some((item) => (
      item.id !== reservationId
      && reservationOverlaps(item, next)
    ));

    if (alreadyReserved) {
      const error = new Error("Ese horario ya esta reservado. Elige otro hueco.");
      error.statusCode = 409;
      throw error;
    }
  }

  const calendarSync = await syncReservationCalendar(current, next);
  const payload = {
    ...toDatabaseReservationChanges(changes),
    google_event_id: calendarSync.googleEventId,
    google_sync_error: calendarSync.error,
    google_synced_at: calendarSync.syncedAt,
  };

  const { data, error } = await requestSupabase
    .from("reservations")
    .update(payload)
    .eq("id", reservationId)
    .select(reservationSelectFields())
    .single();

  if (error) {
    throw new Error(`Supabase no pudo actualizar la reserva: ${error.message}`);
  }

  return mapReservationRow(data);
}

async function syncReservationCalendar(current, next) {
  try {
    if (next.status === "cancelled") {
      if (current.google_event_id) {
        console.log("Deleting Google event", current.id);
        await deleteCalendarEvent(current.google_event_id);
      }

      return {
        googleEventId: null,
        error: null,
        syncedAt: new Date().toISOString(),
      };
    }

    if (next.status !== "confirmed") {
      return {
        googleEventId: current.google_event_id || null,
        error: null,
        syncedAt: current.google_synced_at || null,
      };
    }

    validateReservationForCalendar(next);

    if (current.google_event_id) {
      if (hasCalendarRelevantChanges(current, next)) {
        console.log("Updating Google event", current.id);
        await updateCalendarEvent(current.google_event_id, next);
      }

      return {
        googleEventId: current.google_event_id,
        error: null,
        syncedAt: new Date().toISOString(),
      };
    }

    console.log("Creating Google event", current.id);
    const event = await createCalendarEvent(next);

    return {
      googleEventId: event.id,
      error: null,
      syncedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error("Google Calendar error", error);

    return {
      googleEventId: current.google_event_id || null,
      error: error.message || "No se pudo sincronizar con Google Calendar.",
      syncedAt: current.google_synced_at || null,
    };
  }
}

function validateReservationForCalendar(reservation) {
  if (!reservation.datetime) {
    throw new Error("La reserva no tiene fecha/hora para sincronizar.");
  }

  if (!reservation.nombre) {
    throw new Error("La reserva no tiene nombre para sincronizar.");
  }

  if (!reservation.telefono) {
    throw new Error("La reserva no tiene telefono para sincronizar.");
  }
}

function hasCalendarRelevantChanges(current, next) {
  return [
    "nombre",
    "telefono",
    "email",
    "mascota",
    "servicio",
    "datetime",
    "notes",
    "start_at",
    "end_at",
  ].some((key) => (current[key] || "") !== (next[key] || ""));
}

async function createCalendarEvent(reservation) {
  const response = await googleCalendarRequest("", {
    method: "POST",
    body: JSON.stringify(toCalendarEvent(reservation)),
  });

  return response;
}

async function updateCalendarEvent(eventId, reservation) {
  return googleCalendarRequest(`/${encodeURIComponent(eventId)}`, {
    method: "PUT",
    body: JSON.stringify(toCalendarEvent(reservation)),
  });
}

async function deleteCalendarEvent(eventId) {
  try {
    await googleCalendarRequest(`/${encodeURIComponent(eventId)}`, {
      method: "DELETE",
      expectJson: false,
    });
  } catch (error) {
    if (error.statusCode !== 404 && error.statusCode !== 410) {
      throw error;
    }
  }
}

async function googleCalendarRequest(pathSuffix, options = {}) {
  const token = await getGoogleCalendarAccessToken();
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(googleCalendarId)}/events${pathSuffix}`;
  const googleResponse = await fetch(url, {
    method: options.method || "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: options.body,
  });

  if (options.expectJson === false && googleResponse.ok) {
    return null;
  }

  const payload = await googleResponse.json().catch(() => ({}));

  if (!googleResponse.ok) {
    const error = new Error(payload?.error?.message || `Google Calendar respondio con ${googleResponse.status}.`);
    error.statusCode = googleResponse.status;
    throw error;
  }

  return payload;
}

async function getGoogleCalendarAccessToken() {
  if (!googleCalendarId || !googleClientEmail || !googlePrivateKey) {
    const error = new Error("Faltan GOOGLE_CALENDAR_ID, GOOGLE_CLIENT_EMAIL o GOOGLE_PRIVATE_KEY.");
    error.statusCode = 500;
    throw error;
  }

  const now = Math.floor(Date.now() / 1000);
  const header = {
    alg: "RS256",
    typ: "JWT",
  };
  const claimSet = {
    iss: googleClientEmail,
    scope: "https://www.googleapis.com/auth/calendar.events",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };
  const unsignedToken = `${base64UrlJson(header)}.${base64UrlJson(claimSet)}`;
  const signature = crypto
    .createSign("RSA-SHA256")
    .update(unsignedToken)
    .sign(googlePrivateKey, "base64url");
  const assertion = `${unsignedToken}.${signature}`;
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const payload = await tokenResponse.json().catch(() => ({}));

  if (!tokenResponse.ok) {
    const error = new Error(payload?.error_description || payload?.error || "Google no devolvio un access token.");
    error.statusCode = tokenResponse.status;
    throw error;
  }

  return payload.access_token;
}

function toCalendarEvent(reservation) {
  return {
    summary: `Cita veterinaria: ${reservation.nombre || "Cliente"}`,
    description: [
      `Cliente: ${reservation.nombre || "Sin nombre"}`,
      `Telefono: ${reservation.telefono || "Sin telefono"}`,
      reservation.email ? `Email: ${reservation.email}` : "",
      `Mascota: ${reservation.mascota || "Sin indicar"}`,
      `Servicio: ${formatReservationServiceForCalendar(reservation.servicio)}`,
      reservation.notes ? `Notas: ${reservation.notes}` : "",
    ].filter(Boolean).join("\n"),
    start: {
      dateTime: reservation.start_at || buildReservationTimestamps(reservation.datetime, reservation.servicio).startAt,
      timeZone: "Europe/Madrid",
    },
    end: {
      dateTime: reservation.end_at || buildReservationTimestamps(reservation.datetime, reservation.servicio).endAt,
      timeZone: "Europe/Madrid",
    },
    attendees: reservation.email ? [{ email: reservation.email }] : undefined,
  };
}

function formatReservationServiceForCalendar(value) {
  const labels = {
    consulta: "Consulta general",
    vacunacion: "Vacunacion",
    cirugia: "Cirugia",
    peluqueria: "Peluqueria",
    urgencia: "Urgencia",
  };

  return labels[value] || value || "Sin indicar";
}

function toDatabaseReservationChanges(changes) {
  const payload = { ...changes };

  if (Object.hasOwn(payload, "startAt")) {
    payload.start_at = payload.startAt;
    delete payload.startAt;
  }

  if (Object.hasOwn(payload, "endAt")) {
    payload.end_at = payload.endAt;
    delete payload.endAt;
  }

  return payload;
}

function mapReservationRow(reservation) {
  return {
    id: reservation.id,
    nombre: reservation.nombre,
    telefono: reservation.telefono,
    email: reservation.email,
    mascota: reservation.mascota,
    servicio: reservation.servicio,
    datetime: reservation.datetime,
    status: reservation.status || "confirmed",
    notes: reservation.notes,
    workerId: reservation.worker_id,
    googleEventId: reservation.google_event_id,
    googleSyncError: reservation.google_sync_error,
    googleSyncedAt: reservation.google_synced_at,
    startAt: reservation.start_at,
    endAt: reservation.end_at,
    clientId: reservation.client_id,
    updatedAt: reservation.updated_at,
    createdAt: reservation.created_at,
  };
}

async function saveReservation(reservation) {
  if (supabaseConfigError) {
    throw supabaseConfigError;
  }

  if (supabase) {
    return saveSupabaseReservation(reservation);
  }

  const reservations = await readReservations(reservation.datetime.slice(0, 7));
  const savedReservation = {
    ...reservation,
    id: reservation.id,
    status: "confirmed",
    ...buildReservationTimestamps(reservation.datetime, reservation.servicio),
    createdAt: new Date().toISOString(),
  };
  reservations.push(savedReservation);
  await fs.writeFile(reservationsFilePath, JSON.stringify(reservations, null, 2));
  return savedReservation;
}

async function saveSupabaseReservation(reservation) {
  const timestamps = buildReservationTimestamps(reservation.datetime, reservation.servicio);
  const databaseReservation = {
    id: reservation.id,
    nombre: reservation.nombre,
    telefono: reservation.telefono,
    email: reservation.email || null,
    mascota: reservation.mascota,
    servicio: reservation.servicio,
    datetime: reservation.datetime,
    status: "confirmed",
    start_at: timestamps.startAt,
    end_at: timestamps.endAt,
  };
  const { error } = await supabase
    .from("reservations")
    .insert(databaseReservation);

  if (error) {
    if (error.code === "23505") {
      const conflictError = new Error("Ese horario ya esta reservado. Elige otro hueco.");
      conflictError.statusCode = 409;
      throw conflictError;
    }

    throw new Error(`Supabase no pudo guardar la reserva: ${error.message}`);
  }

  const calendarSync = await syncNewConfirmedReservation(databaseReservation);

  return {
    id: reservation.id,
    code: reservation.code,
    nombre: reservation.nombre,
    telefono: reservation.telefono,
    email: reservation.email || null,
    mascota: reservation.mascota,
    servicio: reservation.servicio,
    datetime: reservation.datetime,
    status: "confirmed",
    notes: null,
    workerId: null,
    googleEventId: calendarSync.googleEventId,
    googleSyncError: calendarSync.error,
    googleSyncedAt: calendarSync.syncedAt,
    startAt: timestamps.startAt,
    endAt: timestamps.endAt,
    updatedAt: null,
    createdAt: new Date().toISOString(),
  };
}

async function syncNewConfirmedReservation(databaseReservation) {
  if (!supabaseServiceRoleKey) {
    return {
      googleEventId: null,
      error: null,
      syncedAt: null,
    };
  }

  const calendarSync = await syncReservationCalendar({
    ...databaseReservation,
    google_event_id: null,
    google_synced_at: null,
  }, databaseReservation);
  const { error } = await supabase
    .from("reservations")
    .update({
      google_event_id: calendarSync.googleEventId,
      google_sync_error: calendarSync.error,
      google_synced_at: calendarSync.syncedAt,
    })
    .eq("id", databaseReservation.id);

  if (error) {
    console.error("Reservation Google sync update error:", error);
    return {
      googleEventId: calendarSync.googleEventId,
      error: error.message || calendarSync.error,
      syncedAt: calendarSync.syncedAt,
    };
  }

  return calendarSync;
}

function buildMonthAvailability(month, reservations) {
  const [year, monthNumber] = month.split("-").map(Number);
  const daysInMonth = new Date(year, monthNumber, 0).getDate();
  const todayKey = toDateKey(new Date());
  const days = [];

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, monthNumber - 1, day);
    const dateKey = toDateKey(date);
    const schedule = getScheduleForDate(date);
    const slots = buildSlots(dateKey, schedule).map((slot) => ({
      ...slot,
      reserved: reservations.some((reservation) => reservationOccupiesSlot(reservation, slot.datetime)),
    }));

    days.push({
      date: dateKey,
      day,
      weekday: date.getDay(),
      isOpen: schedule.length > 0,
      isPast: dateKey < todayKey,
      fullyBooked: slots.length > 0 && slots.every((slot) => slot.reserved),
      slots,
    });
  }

  return { month, days };
}

function buildSlots(dateKey, schedule) {
  return schedule.flatMap(([start, end]) => {
    const slots = [];
    let current = toMinutes(start);
    const endMinutes = toMinutes(end);

    while (current < endMinutes) {
      const time = fromMinutes(current);
      slots.push({
        time,
        datetime: `${dateKey}T${time}`,
      });
      current += 30;
    }

    return slots;
  });
}

function getScheduleForDate(date) {
  const weekday = date.getDay();

  if (weekday >= 1 && weekday <= 5) {
    return [["10:30", "13:30"], ["17:00", "20:00"]];
  }

  if (weekday === 6) {
    return [["11:00", "13:30"]];
  }

  return [];
}

function isBookableDateTime(datetime, service = "consulta") {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(datetime)) {
    return false;
  }

  const [dateKey, time] = datetime.split("T");
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  const todayKey = toDateKey(new Date());

  if (dateKey < todayKey) {
    return false;
  }

  const duration = reservationDurationMinutes(service);
  const startMinutes = toMinutes(time);
  const endMinutes = startMinutes + duration;
  return getScheduleForDate(date).some(([start, end]) => (
    startMinutes >= toMinutes(start)
    && endMinutes <= toMinutes(end)
    && (startMinutes - toMinutes(start)) % 30 === 0
  ));
}

function reservationOverlaps(existingReservation, requestedReservation) {
  if (existingReservation.status === "cancelled") {
    return false;
  }

  const existingRange = reservationMinuteRange(existingReservation);
  const requestedRange = reservationMinuteRange(requestedReservation);
  return existingRange.dateKey === requestedRange.dateKey
    && existingRange.start < requestedRange.end
    && requestedRange.start < existingRange.end;
}

function reservationOccupiesSlot(reservation, slotDatetime) {
  if (reservation.status === "cancelled") {
    return false;
  }

  const slotRange = {
    dateKey: slotDatetime.slice(0, 10),
    start: toMinutes(slotDatetime.slice(11, 16)),
    end: toMinutes(slotDatetime.slice(11, 16)) + 30,
  };
  const reservationRange = reservationMinuteRange(reservation);

  return reservationRange.dateKey === slotRange.dateKey
    && reservationRange.start < slotRange.end
    && slotRange.start < reservationRange.end;
}

function reservationMinuteRange(reservation) {
  const datetime = reservation.datetime || reservation.startAt || reservation.start_at;
  const dateKey = String(datetime || "").slice(0, 10);
  const start = toMinutes(String(datetime || "T00:00").slice(11, 16));
  return {
    dateKey,
    start,
    end: start + reservationDurationMinutes(reservation.servicio),
  };
}

function normalizeReservation(body) {
  const emailCopy = Boolean(body?.emailCopy);
  const reservation = {
    id: crypto.randomUUID(),
    nombre: cleanText(body?.nombre),
    telefono: cleanText(body?.telefono),
    email: cleanText(body?.email),
    mascota: cleanText(body?.mascota),
    servicio: cleanText(body?.servicio),
    datetime: cleanText(body?.datetime),
    emailCopy,
  };
  reservation.code = reservation.id.slice(0, 8).toUpperCase();

  if (!reservation.nombre || !reservation.telefono || !reservation.email || !reservation.mascota || !reservation.servicio || !reservation.datetime) {
    const error = new Error("Nombre, telefono, email, mascota, servicio y fecha/hora son obligatorios.");
    error.statusCode = 400;
    throw error;
  }

  if (!isValidEmail(reservation.email)) {
    const error = new Error("Indica un email valido.");
    error.statusCode = 400;
    throw error;
  }

  if (!["consulta", "vacunacion", "cirugia", "peluqueria"].includes(reservation.servicio)) {
    const error = new Error("Servicio no valido. Para urgencias, llama directamente a la clinica.");
    error.statusCode = 400;
    throw error;
  }

  return reservation;
}

async function sendReservationEmailIfRequested(reservation, emailCopy) {
  if (!emailCopy) {
    return { requested: false, sent: false, pending: false };
  }

  if (!resendApiKey) {
    return {
      requested: true,
      sent: false,
      pending: true,
      message: "Reserva creada. No se ha enviado la copia por email porque falta configurar RESEND_API_KEY en el backend.",
    };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: reservationFromEmail,
        to: reservation.email,
        subject: `Reserva confirmada ${reservation.code} - Clínica Veterinaria Vetusta`,
        text: reservationEmailText(reservation),
        html: reservationEmailHtml(reservation),
      }),
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(payload?.message || `El proveedor de email respondio con ${response.status}.`);
    }

    return { requested: true, sent: true, pending: false };
  } catch (error) {
    console.error("Reservation email error:", error);
    return {
      requested: true,
      sent: false,
      pending: true,
      message: "Reserva creada. No se ha podido enviar la copia por email. Revisa RESEND_API_KEY, RESERVATION_FROM_EMAIL y el dominio verificado en Resend.",
    };
  }
}

function reservationEmailText(reservation) {
  return [
    `Hola ${reservation.nombre},`,
    "",
    "Tu reserva esta confirmada en Clínica Veterinaria Vetusta.",
    `Codigo de reserva: ${reservation.code}`,
    `Fecha y hora: ${formatReservationDateTime(reservation.datetime)}`,
    `Mascota: ${formatPetType(reservation.mascota)}`,
    `Servicio: ${formatReservationServiceForCalendar(reservation.servicio)}`,
    `Telefono de la clinica: ${clinicPhone}`,
    "",
    "Tu cita queda confirmada. Si necesitamos ajustar algun detalle, te contactaremos lo antes posible.",
  ].join("\n");
}

function reservationEmailHtml(reservation) {
  return `
    <div style="font-family:Arial,sans-serif;color:#1b1c1c;line-height:1.5">
      <h1 style="color:#1b4332">Clínica Veterinaria Vetusta</h1>
      <p>Hola ${escapeHtmlText(reservation.nombre)}, tu reserva está confirmada.</p>
      <p><strong>Código de reserva:</strong> ${escapeHtmlText(reservation.code)}</p>
      <p><strong>Fecha y hora:</strong> ${escapeHtmlText(formatReservationDateTime(reservation.datetime))}</p>
      <p><strong>Mascota:</strong> ${escapeHtmlText(formatPetType(reservation.mascota))}</p>
      <p><strong>Servicio:</strong> ${escapeHtmlText(formatReservationServiceForCalendar(reservation.servicio))}</p>
      <p><strong>Teléfono de la clínica:</strong> ${escapeHtmlText(clinicPhone)}</p>
      <p>Tu cita queda confirmada. Si necesitamos ajustar algun detalle, te contactaremos lo antes posible.</p>
    </div>
  `;
}

function cleanLongText(value) {
  return String(value || "").trim().slice(0, 2000);
}

function buildReservationTimestamps(datetime, service = "consulta") {
  const endDatetime = addMinutesToDatetime(datetime, reservationDurationMinutes(service));

  return {
    startAt: toMadridOffsetDateTime(datetime),
    endAt: toMadridOffsetDateTime(endDatetime),
  };
}

function reservationDurationMinutes(service) {
  return service === "cirugia" ? 60 : 30;
}

function addMinutesToDatetime(datetime, minutesToAdd) {
  const [dateKey, time] = datetime.split("T");
  const [year, month, day] = dateKey.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, hours, minutes + minutesToAdd));

  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-") + `T${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")}`;
}

function toMadridOffsetDateTime(datetime) {
  const [dateKey, time] = datetime.split("T");
  const [year, month, day] = dateKey.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);
  const probeDate = new Date(Date.UTC(year, month - 1, day, hours, minutes));
  const offset = madridOffset(probeDate);

  return `${dateKey}T${time}:00${offset}`;
}

function madridOffset(date) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Madrid",
    timeZoneName: "shortOffset",
  });
  const timeZoneName = formatter
    .formatToParts(date)
    .find((part) => part.type === "timeZoneName")?.value || "GMT+1";
  const match = timeZoneName.match(/^GMT([+-])(\d{1,2})(?::(\d{2}))?$/);

  if (!match) {
    return "+01:00";
  }

  const sign = match[1];
  const hours = String(Number(match[2])).padStart(2, "0");
  const minutes = match[3] || "00";

  return `${sign}${hours}:${minutes}`;
}

function cleanText(value) {
  return String(value || "").trim().slice(0, 160);
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function formatReservationDateTime(datetime) {
  if (!datetime) {
    return "Sin fecha";
  }

  const [dateKey, time] = datetime.split("T");
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  const dateLabel = new Intl.DateTimeFormat("es-ES", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);

  return `${dateLabel} a las ${time}`;
}

function formatPetType(value) {
  const labels = {
    perro: "Perro",
    gato: "Gato",
    otro: "Otro",
  };

  return labels[value] || value || "Sin indicar";
}

function escapeHtmlText(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toMinutes(time) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function fromMinutes(totalMinutes) {
  const hours = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
  const minutes = String(totalMinutes % 60).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function cleanEnvValue(value) {
  return String(value || "").trim().replace(/^["']|["']$/g, "");
}

function cleanGooglePrivateKey(value) {
  return cleanEnvValue(value).replace(/\\n/g, "\n");
}

function base64UrlJson(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function escapeJavaScript(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function validateSupabaseUrl(value) {
  try {
    const url = new URL(value);

    if (url.protocol !== "https:") {
      throw new Error("SUPABASE_URL debe empezar por https://");
    }

    return url.origin;
  } catch (error) {
    throw new Error("SUPABASE_URL no es valida. Debe tener formato https://TU-PROYECTO.supabase.co");
  }
}

if (!process.env.VERCEL) {
  app.listen(port, () => {
    console.log(`Vetusta web running at http://127.0.0.1:${port}`);
  });
}

export default app;
