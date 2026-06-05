import { Router } from "express";
import { getGoogleReviews } from "../lib/reviews.js";

const router = Router();

router.get("/google-reviews", async (_request, response) => {
  try {
    const data = await getGoogleReviews();
    response.json(data);
  } catch (error) {
    console.error("Google reviews error:", error);
    response.status(error.statusCode || 500).json({
      error: "No se pudieron cargar las reseñas de Google.",
      detail:
        process.env.NODE_ENV === "production" ? undefined : error.message,
    });
  }
});

export default router;
