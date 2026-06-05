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

app.use(express.json());

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
