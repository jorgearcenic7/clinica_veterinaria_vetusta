import { Router } from "express";
import {
  buildMonthAvailability,
  isBookableDateTime,
  reservationOverlaps,
} from "../lib/availability.js";
import {
  normalizeReservation,
  readReservations,
  saveReservation,
} from "../lib/reservations.js";
import { sendReservationEmailIfRequested } from "../lib/resend.js";
import { isValidMonthKey } from "../lib/utils.js";

const router = Router();

router.get("/availability", async (request, response) => {
  try {
    const month = String(request.query.month || "").trim();

    if (!isValidMonthKey(month)) {
      response.status(400).json({
        error: "Usa el parámetro month con formato YYYY-MM.",
      });
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

router.post("/reservations", async (request, response) => {
  try {
    const reservation = normalizeReservation(request.body);
    const reservations = await readReservations(
      reservation.datetime.slice(0, 7),
    );

    if (!isBookableDateTime(reservation.datetime, reservation.servicio)) {
      response.status(400).json({
        error:
          "La fecha u hora elegida no está dentro del horario de la clínica.",
      });
      return;
    }

    const alreadyReserved = reservations.some((item) =>
      reservationOverlaps(item, reservation),
    );

    if (alreadyReserved) {
      response.status(409).json({
        error: "Ese horario ya está reservado. Elige otro hueco.",
      });
      return;
    }

    const savedReservation = await saveReservation(reservation);
    const emailResult = await sendReservationEmailIfRequested(
      savedReservation,
      reservation.emailCopy,
    );
    response
      .status(201)
      .json({ ok: true, reservation: savedReservation, email: emailResult });
  } catch (error) {
    response
      .status(error.statusCode || 400)
      .json({ error: error.message || "No se pudo crear la reserva." });
  }
});

export default router;
