/**
 * Ambient augmentation of NodeJS.ProcessEnv — every key here was confirmed by
 * grepping actual `process.env.X` reads in backend/**\/*.js (see .env.example
 * for the documented defaults). All optional: presence is validated at
 * runtime by `validateEnv()` in backend/server.js and by the individual
 * modules that consume them — this file does not replace that validation,
 * it only gives autocomplete/typo-safety once backend files start being
 * type-checked as .ts or with @ts-check.
 *
 * `NODE_ENV` is intentionally omitted: @types/node already declares it.
 */
declare namespace NodeJS {
  interface ProcessEnv {
    // Runtime / servidor (backend/server.js, backend/lib/reservations.js)
    PORT?: string;
    VERCEL?: string;

    // Supabase (backend/lib/supabase.js, backend/routes/config.js)
    SUPABASE_URL?: string;
    SUPABASE_ANON_KEY?: string;
    SUPABASE_SERVICE_ROLE_KEY?: string;

    // Rate limiting (backend/middleware/rateLimiter.js)
    API_RATE_LIMIT?: string;
    SENSITIVE_RATE_LIMIT?: string;
    AUTH_RATE_LIMIT?: string;

    // Email de confirmación de reserva (backend/lib/resend.js)
    RESEND_API_KEY?: string;
    RESERVATION_FROM_EMAIL?: string;
    CLINIC_PHONE?: string;

    // Reseñas de Google (backend/lib/reviews.js)
    GOOGLE_ENABLE_LIVE_REVIEWS?: string;
    GOOGLE_PLACES_API_KEY?: string;
    GOOGLE_PLACE_ID?: string;
    GOOGLE_PLACE_LATITUDE?: string;
    GOOGLE_PLACE_LONGITUDE?: string;
    GOOGLE_PLACE_SEARCH_RADIUS_METERS?: string;
    GOOGLE_LANGUAGE_CODE?: string;
    GOOGLE_DAILY_REQUEST_LIMIT?: string;
    REVIEWS_CACHE_TTL_SECONDS?: string;

    // Google Calendar (backend/lib/googleCalendar.js)
    GOOGLE_CALENDAR_ID?: string;
    GOOGLE_CLIENT_EMAIL?: string;
    GOOGLE_PRIVATE_KEY?: string;

    // Analytics (backend/routes/config.js)
    NEXT_PUBLIC_GA_ID?: string;
    VITE_GA_ID?: string;
  }
}
