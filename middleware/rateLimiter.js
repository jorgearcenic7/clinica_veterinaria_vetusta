import rateLimit from "express-rate-limit";

// Límite general para todos los endpoints /api.
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.API_RATE_LIMIT || 300),
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    error: "Demasiadas peticiones. Espera unos minutos antes de intentarlo de nuevo.",
  },
});

// Límite estricto para rutas con datos personales o acciones sensibles.
export const sensitiveLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.SENSITIVE_RATE_LIMIT || 30),
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    error: "Demasiados intentos. Espera unos minutos antes de volver a intentarlo.",
  },
});
