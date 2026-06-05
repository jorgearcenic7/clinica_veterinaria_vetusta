import { Router } from "express";
import {
  normalizeReservationUpdate,
  requireAdminRequest,
  updateReservationFromAdmin,
} from "../lib/reservations.js";
import { safeString } from "../lib/utils.js";

const router = Router();

// --- Reservas ---

router.patch("/reservations/:id", async (request, response) => {
  try {
    const auth = await requireAdminRequest(request);
    const reservationId = String(request.params.id || "").trim();
    const changes = normalizeReservationUpdate(request.body);

    if (!reservationId) {
      response.status(400).json({ error: "Falta el id de la reserva." });
      return;
    }

    const updatedReservation = await updateReservationFromAdmin(
      auth.supabase,
      reservationId,
      changes,
    );
    response.json({ ok: true, reservation: updatedReservation });
  } catch (error) {
    console.error("Reservation admin update error:", error);
    response
      .status(error.statusCode || 500)
      .json({ error: error.message || "No se pudo actualizar la reserva." });
  }
});

// --- Listados paginados (MEJORA 5) ---

router.get("/clients", async (request, response) => {
  try {
    const auth = await requireAdminRequest(request);
    const { page, limit, from, to } = parsePagination(request.query);

    const { data, error, count } = await auth.supabase
      .from("profiles")
      .select("id,full_name,phone,role,created_at", { count: "exact" })
      .eq("role", "client")
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) {
      throw Object.assign(new Error(`Supabase error: ${error.message}`), {
        statusCode: 500,
      });
    }

    const total = count || 0;
    response.json({
      data,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    });
  } catch (error) {
    console.error("Admin clients error:", error);
    response
      .status(error.statusCode || 500)
      .json({ error: error.message || "No se pudieron cargar los clientes." });
  }
});

router.get("/pets", async (request, response) => {
  try {
    const auth = await requireAdminRequest(request);
    const { page, limit, from, to } = parsePagination(request.query);
    const clientId = safeString(request.query.client_id, 80) || null;

    let query = auth.supabase
      .from("pets")
      .select("id,owner_id,name,species,breed,birth_date,image_url,created_at", {
        count: "exact",
      })
      .order("name", { ascending: true });

    if (clientId) {
      query = query.eq("owner_id", clientId);
    }

    const { data, error, count } = await query.range(from, to);

    if (error) {
      throw Object.assign(new Error(`Supabase error: ${error.message}`), {
        statusCode: 500,
      });
    }

    const total = count || 0;
    response.json({
      data,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    });
  } catch (error) {
    console.error("Admin pets error:", error);
    response
      .status(error.statusCode || 500)
      .json({ error: error.message || "No se pudieron cargar las mascotas." });
  }
});

router.get("/reservations", async (request, response) => {
  try {
    const auth = await requireAdminRequest(request);
    const { page, limit, from, to } = parsePagination(request.query);

    const { data, error, count } = await auth.supabase
      .from("reservations")
      .select("*", { count: "exact" })
      .order("datetime", { ascending: false })
      .range(from, to);

    if (error) {
      throw Object.assign(new Error(`Supabase error: ${error.message}`), {
        statusCode: 500,
      });
    }

    const total = count || 0;
    response.json({
      data,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    });
  } catch (error) {
    console.error("Admin reservations error:", error);
    response
      .status(error.statusCode || 500)
      .json({ error: error.message || "No se pudieron cargar las reservas." });
  }
});

function parsePagination(query) {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 20));
  const from = (page - 1) * limit;
  const to = from + limit - 1;
  return { page, limit, from, to };
}

export default router;
