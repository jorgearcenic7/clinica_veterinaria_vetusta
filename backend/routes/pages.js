import path from "node:path";
import { fileURLToPath } from "node:url";
import { Router } from "express";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const router = Router();
const frontendRoot = path.join(__dirname, "../../frontend");

const privateRoutes = new Set([
  "/auth",
  "/auth.html",
  "/area-privada",
  "/dashboard",
  "/dashboard.html",
  "/admin",
  "/admin.html",
  "/pet-detail.html",
]);

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
  "/image-sources.js": "image-sources.js",
  "/i18n.js": "i18n.js",
  "/supabase-client.js": "supabase-client.js",
  "/auth.js": "auth.js",
  "/dashboard.js": "dashboard.js",
  "/pet-detail.js": "pet-detail.js",
  "/admin.js": "admin.js",
  "/client-area.css": "client-area.css",
  "/google-logo.svg": "google-logo.svg",
  "/robots.txt": "robots.txt",
  "/sitemap.xml": "sitemap.xml",
  "/favicon.svg": "favicon.svg",
  "/favicon.ico": "favicon.svg",
};

Object.entries(publicFiles).forEach(([route, filename]) => {
  router.get(route, (request, response, next) => {
    if (privateRoutes.has(route)) {
      response.set("Cache-Control", "no-store");
    }

    response.sendFile(filename, { root: frontendRoot }, (error) => {
      if (error) {
        next(error);
      }
    });
  });
});

router.get("/dashboard/pets/:id", (_request, response, next) => {
  response.set("Cache-Control", "no-store");
  response.sendFile("pet-detail.html", { root: frontendRoot }, (error) => {
    if (error) {
      next(error);
    }
  });
});

export default router;
