import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cleanEnvValue } from "./utils.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, "../..");

const cacheTtlSeconds = Number(
  process.env.REVIEWS_CACHE_TTL_SECONDS || 1800,
);
const dailyRequestLimit = Number(
  process.env.GOOGLE_DAILY_REQUEST_LIMIT || 25,
);
const liveReviewsEnabled =
  process.env.GOOGLE_ENABLE_LIVE_REVIEWS !== "false";
const defaultLatitude = 43.36443719850797;
const defaultLongitude = -5.833903884657452;
const usageFilePath = path.join(projectRoot, ".google-usage.json");
const localReviewsFilePath = path.join(projectRoot, "reviews.local.json");

let reviewsCache = null;
let resolvedPlaceCache = null;

export async function getGoogleReviews() {
  const now = Date.now();

  if (reviewsCache && reviewsCache.expiresAt > now) {
    return { ...reviewsCache.data, cached: true };
  }

  const data = liveReviewsEnabled
    ? await fetchGoogleReviews()
    : await fetchLocalReviews();

  reviewsCache = { data, expiresAt: now + cacheTtlSeconds * 1000 };
  return { ...data, cached: false };
}

async function fetchGoogleReviews() {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  const placeId = await getPlaceId(apiKey);
  const languageCode = cleanEnvValue(
    process.env.GOOGLE_LANGUAGE_CODE || "es",
  );

  if (!apiKey) {
    const error = new Error(
      "Falta GOOGLE_PLACES_API_KEY en el archivo .env.",
    );
    error.statusCode = 500;
    throw error;
  }

  const url = new URL(
    `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`,
  );
  url.searchParams.set("languageCode", languageCode);
  await registerGoogleRequest("placeDetails");

  const googleResponse = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask":
        "rating,userRatingCount,reviews,googleMapsUri",
    },
  });

  const payload = await googleResponse.json();

  if (!googleResponse.ok) {
    const error = new Error(
      payload?.error?.message
        || `Google Places respondió con ${googleResponse.status}.`,
    );
    error.statusCode = googleResponse.status;
    throw error;
  }

  const reviews = (payload.reviews || [])
    .map((review) => ({
      author:
        review.authorAttribution?.displayName || "Cliente de Google",
      authorUrl: review.authorAttribution?.uri || null,
      rating: review.rating || null,
      text: review.text?.text || "",
      relativeTime: review.relativePublishTimeDescription || "",
      publishedAt: review.publishTime || null,
    }))
    .filter((review) => review.text)
    .sort(
      (a, b) =>
        new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0),
    )
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
    const error = new Error(
      "Falta GOOGLE_PLACES_API_KEY en el archivo .env.",
    );
    error.statusCode = 500;
    throw error;
  }

  if (process.env.GOOGLE_PLACE_ID) {
    return process.env.GOOGLE_PLACE_ID;
  }

  if (resolvedPlaceCache) {
    return resolvedPlaceCache.id;
  }

  const latitude = Number(
    process.env.GOOGLE_PLACE_LATITUDE || defaultLatitude,
  );
  const longitude = Number(
    process.env.GOOGLE_PLACE_LONGITUDE || defaultLongitude,
  );
  const radius = Number(
    process.env.GOOGLE_PLACE_SEARCH_RADIUS_METERS || 80,
  );
  const languageCode = cleanEnvValue(
    process.env.GOOGLE_LANGUAGE_CODE || "es",
  );

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    const error = new Error(
      "GOOGLE_PLACE_LATITUDE y GOOGLE_PLACE_LONGITUDE deben ser coordenadas validas.",
    );
    error.statusCode = 500;
    throw error;
  }

  await registerGoogleRequest("nearbySearch");

  const googleResponse = await fetch(
    "https://places.googleapis.com/v1/places:searchNearby",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.location,places.primaryType,places.types",
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
    },
  );

  const payload = await googleResponse.json();

  if (!googleResponse.ok) {
    const error = new Error(
      payload?.error?.message
        || `Google Nearby Search respondió con ${googleResponse.status}.`,
    );
    error.statusCode = googleResponse.status;
    throw error;
  }

  const place = (payload.places || [])[0];

  if (!place?.id) {
    const error = new Error(
      `No se encontró una clínica veterinaria cerca de ${latitude}, ${longitude}. Ajusta GOOGLE_PLACE_SEARCH_RADIUS_METERS o usa GOOGLE_PLACE_ID.`,
    );
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
    const error = new Error(
      "Las consultas reales a Google estan desactivadas con GOOGLE_ENABLE_LIVE_REVIEWS=false.",
    );
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

  if (
    Number.isFinite(dailyRequestLimit)
    && dailyRequestLimit > 0
    && usage.count >= dailyRequestLimit
  ) {
    const error = new Error(
      `Limite diario local de Google alcanzado (${dailyRequestLimit}). Sube GOOGLE_DAILY_REQUEST_LIMIT o espera a manana.`,
    );
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
      console.warn(
        "No se pudo leer .google-usage.json, se reinicia contador local.",
        error,
      );
    }
    return {
      date: new Date().toISOString().slice(0, 10),
      count: 0,
      byType: {},
    };
  }
}
