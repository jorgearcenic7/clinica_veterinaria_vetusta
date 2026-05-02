import "dotenv/config";
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

let reviewsCache = null;
let resolvedPlaceCache = null;

app.use(express.json());

const publicFiles = {
  "/": "code.html",
  "/code.html": "code.html",
  "/aviso-legal.html": "aviso-legal.html",
  "/privacidad.html": "privacidad.html",
  "/cookies.html": "cookies.html",
  "/sitemap.html": "sitemap.html",
  "/booking.js": "booking.js",
  "/reviews.js": "reviews.js",
  "/screen.png": "screen.png",
};

Object.entries(publicFiles).forEach(([route, filename]) => {
  app.get(route, (request, response, next) => {
    response.sendFile(filename, { root: publicRoot }, (error) => {
      if (error) {
        next(error);
      }
    });
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

    const reservations = await readReservations();
    response.json(buildMonthAvailability(month, reservations));
  } catch (error) {
    console.error("Availability error:", error);
    response.status(500).json({ error: "No se pudo cargar la disponibilidad." });
  }
});

app.post("/api/reservations", async (request, response) => {
  try {
    const reservation = normalizeReservation(request.body);
    const reservations = await readReservations();

    if (!isBookableDateTime(reservation.datetime)) {
      response.status(400).json({ error: "La fecha u hora elegida no esta dentro del horario de la clinica." });
      return;
    }

    const alreadyReserved = reservations.some((item) => item.datetime === reservation.datetime);

    if (alreadyReserved) {
      response.status(409).json({ error: "Ese horario ya esta reservado. Elige otro hueco." });
      return;
    }

    reservations.push({
      ...reservation,
      createdAt: new Date().toISOString(),
    });

    await fs.writeFile(reservationsFilePath, JSON.stringify(reservations, null, 2));
    response.status(201).json({ ok: true, reservation });
  } catch (error) {
    response.status(error.statusCode || 400).json({ error: error.message || "No se pudo crear la reserva." });
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

async function readReservations() {
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

function buildMonthAvailability(month, reservations) {
  const [year, monthNumber] = month.split("-").map(Number);
  const daysInMonth = new Date(year, monthNumber, 0).getDate();
  const todayKey = toDateKey(new Date());
  const reservedTimes = new Set(reservations.map((reservation) => reservation.datetime));
  const days = [];

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, monthNumber - 1, day);
    const dateKey = toDateKey(date);
    const schedule = getScheduleForDate(date);
    const slots = buildSlots(dateKey, schedule).map((slot) => ({
      ...slot,
      reserved: reservedTimes.has(slot.datetime),
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

function isBookableDateTime(datetime) {
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

  return buildSlots(dateKey, getScheduleForDate(date)).some((slot) => slot.time === time);
}

function normalizeReservation(body) {
  const reservation = {
    nombre: cleanText(body?.nombre),
    telefono: cleanText(body?.telefono),
    mascota: cleanText(body?.mascota),
    servicio: cleanText(body?.servicio),
    datetime: cleanText(body?.datetime),
  };

  if (!reservation.nombre || !reservation.telefono || !reservation.datetime) {
    const error = new Error("Nombre, telefono y fecha/hora son obligatorios.");
    error.statusCode = 400;
    throw error;
  }

  return reservation;
}

function cleanText(value) {
  return String(value || "").trim().slice(0, 160);
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

if (!process.env.VERCEL) {
  app.listen(port, () => {
    console.log(`Vetusta web running at http://127.0.0.1:${port}`);
  });
}

export default app;
