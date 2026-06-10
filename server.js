import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { apiLimiter, sensitiveLimiter } from "./middleware/rateLimiter.js";
import adminRouter from "./routes/admin.js";
import configRouter from "./routes/config.js";
import pagesRouter from "./routes/pages.js";
import reservationsRouter from "./routes/reservations.js";
import reviewsRouter from "./routes/reviews.js";

validateEnv();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const publicRoot = process.cwd();
const port = Number(process.env.PORT || 3000);

// Necesario para que req.ip sea la IP real del cliente detrás de Vercel/proxy.
// Sin esto, todos los clientes comparten la IP interna del proxy y el rate limiter es inútil.
app.set("trust proxy", 1);

app.use(express.json());

app.use((_request, response, next) => {
  response.setHeader("X-Frame-Options", "SAMEORIGIN");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      // El proyecto usa varios bloques <script> inline en los HTML (pricing, nav, i18n init,
      // cookies consent, etc.) — 'unsafe-inline' es necesario para no romper la web.
      // GA4 se inyecta vía /analytics.js (self) y carga desde googletagmanager.
      "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com",
      // Los HTML tienen bloques <style> internos: requiere 'unsafe-inline'.
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      // Imágenes locales + Supabase Storage + Pexels + data URIs.
      "img-src 'self' data: https: blob:",
      // Supabase HTTP + WebSocket (Auth, DB, Storage, Realtime futuro).
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://www.google-analytics.com https://www.googletagmanager.com",
      // Google Maps embed en la sección de contacto.
      "frame-src https://www.google.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  );
  next();
});

// Sirve public/tailwind.css con ruta absoluta para que Vercel lo encuentre siempre.
app.use("/public", express.static(path.join(__dirname, "public"), {
  maxAge: "1d",
  immutable: true,
}));

app.use(
  express.static(publicRoot, {
    dotfiles: "ignore",
    index: false,
    maxAge: "5m",
  }),
);

app.use("/api", apiLimiter);
app.use(
  [
    "/auth",
    "/area-privada",
    "/api/reservations",
    "/api/admin",
    "/api/supabase-config",
  ],
  sensitiveLimiter,
);

app.use("/", pagesRouter);
app.use("/", configRouter);
app.use("/api", reviewsRouter);
app.use("/api", reservationsRouter);
app.use("/api/admin", adminRouter);

if (!process.env.VERCEL) {
  app.listen(port, () => {
    console.log(`Vetusta web running at http://127.0.0.1:${port}`);
  });
}

// Captura errores no controlados en cualquier ruta.
// Sin esto, Express devuelve una página HTML de error que rompe los clientes JSON.
app.use((error, request, response, _next) => {
  const status = error.statusCode || error.status || 500;
  if (status >= 500) {
    console.error(
      JSON.stringify({
        level: "error",
        method: request.method,
        path: request.path,
        status,
        message: error.message,
        stack: error.stack,
      }),
    );
  }
  response
    .status(status)
    .json({ error: error.message || "Error interno del servidor." });
});

export default app;

function validateEnv() {
  const required = [
    "PORT",
    "SUPABASE_URL",
    "SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
  ];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.error(
      `✗ Faltan variables de entorno obligatorias: ${missing.join(", ")}`,
    );
    process.exit(1);
  }

  console.log("✓ Variables de entorno validadas");
}
