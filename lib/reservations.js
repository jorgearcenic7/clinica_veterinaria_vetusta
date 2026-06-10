import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import {
  buildReservationTimestamps,
  isBookableDateTime,
  reservationDurationMinutes,
  reservationOverlaps,
} from "./availability.js";
import { syncNewConfirmedReservation, syncReservationCalendar } from "./googleCalendar.js";
import {
  supabase,
  supabaseAdmin,
  supabaseAnonKey,
  supabaseConfigError,
  supabaseUrl,
} from "./supabase.js";
import {
  getBearerToken,
  isValidDateTimeKey,
  safeEmail,
  safeString,
  validateSupabaseUrl,
  isValidEmail,
} from "./utils.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, "..");
const reservationsFilePath = process.env.VERCEL
  ? path.join(os.tmpdir(), "reservations.json")
  : path.join(projectRoot, "reservations.json");

export function reservationSelectFields() {
  return [
    "id",
    "nombre",
    "telefono",
    "email",
    "mascota",
    "servicio",
    "datetime",
    "status",
    "notes",
    "worker_id",
    "google_event_id",
    "google_sync_error",
    "google_synced_at",
    "start_at",
    "end_at",
    "client_id",
    "updated_at",
    "created_at",
  ].join(",");
}

export function mapReservationRow(reservation) {
  return {
    id: reservation.id,
    nombre: reservation.nombre,
    telefono: reservation.telefono,
    email: reservation.email,
    mascota: reservation.mascota,
    servicio: reservation.servicio,
    datetime: reservation.datetime,
    status: reservation.status || "confirmed",
    notes: reservation.notes,
    workerId: reservation.worker_id,
    googleEventId: reservation.google_event_id,
    googleSyncError: reservation.google_sync_error,
    googleSyncedAt: reservation.google_synced_at,
    startAt: reservation.start_at,
    endAt: reservation.end_at,
    clientId: reservation.client_id,
    updatedAt: reservation.updated_at,
    createdAt: reservation.created_at,
  };
}

export function toDatabaseReservationChanges(changes) {
  const payload = { ...changes };

  if (Object.hasOwn(payload, "startAt")) {
    payload.start_at = payload.startAt;
    delete payload.startAt;
  }

  if (Object.hasOwn(payload, "endAt")) {
    payload.end_at = payload.endAt;
    delete payload.endAt;
  }

  return payload;
}

export async function readReservations(month) {
  if (supabaseConfigError) {
    throw supabaseConfigError;
  }

  // Con service role key el cliente admin hace SELECT sin restricción RLS.
  if (supabaseAdmin) {
    return readSupabaseReservations(month);
  }

  // Sin service role key, la función RPC pública devuelve solo los slots ocupados.
  if (supabase) {
    return readPublicSupabaseReservationSlots(month);
  }

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

async function readSupabaseReservations(month) {
  const [year, monthNumber] = month.split("-").map(Number);
  const startDate = `${month}-01T00:00`;
  const normalizedEndDate =
    monthNumber === 12
      ? `${year + 1}-01-01T00:00`
      : `${year}-${String(monthNumber + 1).padStart(2, "0")}-01T00:00`;

  const { data, error } = await supabaseAdmin
    .from("reservations")
    .select(reservationSelectFields())
    .gte("datetime", startDate)
    .lt("datetime", normalizedEndDate);

  if (error) {
    if (error.code === "42501" || error.message?.includes("permission denied")) {
      console.warn("supabaseAdmin sin permisos de lectura, usando RPC público:", error.message);
      return readPublicSupabaseReservationSlots(month);
    }
    throw new Error(`Supabase no pudo leer reservas: ${error.message}`);
  }

  return data.map((reservation) => ({
    id: reservation.id,
    nombre: reservation.nombre,
    telefono: reservation.telefono,
    email: reservation.email,
    mascota: reservation.mascota,
    servicio: reservation.servicio,
    datetime: reservation.datetime,
    status: reservation.status || "confirmed",
    notes: reservation.notes,
    workerId: reservation.worker_id,
    googleEventId: reservation.google_event_id,
    googleSyncError: reservation.google_sync_error,
    googleSyncedAt: reservation.google_synced_at,
    startAt: reservation.start_at,
    endAt: reservation.end_at,
    clientId: reservation.client_id,
    updatedAt: reservation.updated_at,
    createdAt: reservation.created_at,
  }));
}

async function readPublicSupabaseReservationSlots(month) {
  const { data, error } = await supabase.rpc(
    "get_reserved_reservation_slots",
    { p_month: month },
  );

  if (error) {
    throw new Error(
      "Supabase no pudo leer reservas. Añade SUPABASE_SERVICE_ROLE_KEY al backend/Vercel o vuelve a ejecutar supabase-reservations.sql para crear la función pública de disponibilidad: "
        + error.message,
    );
  }

  return (data || []).map((reservation) => ({
    datetime: reservation.datetime,
    status: reservation.status || "confirmed",
  }));
}

export async function saveReservation(reservation) {
  if (supabaseConfigError) {
    throw supabaseConfigError;
  }

  // supabaseAdmin bypass RLS; si no está disponible, anon puede hacer INSERT según RLS.
  if (supabaseAdmin || supabase) {
    return saveSupabaseReservation(reservation);
  }

  const reservations = await readReservations(
    reservation.datetime.slice(0, 7),
  );
  const savedReservation = {
    ...reservation,
    id: reservation.id,
    status: "confirmed",
    ...buildReservationTimestamps(reservation.datetime, reservation.servicio),
    createdAt: new Date().toISOString(),
  };
  reservations.push(savedReservation);
  await fs.writeFile(
    reservationsFilePath,
    JSON.stringify(reservations, null, 2),
  );
  return savedReservation;
}

async function saveSupabaseReservation(reservation) {
  const client = supabaseAdmin || supabase;
  const timestamps = buildReservationTimestamps(
    reservation.datetime,
    reservation.servicio,
  );
  const databaseReservation = {
    id: reservation.id,
    nombre: reservation.nombre,
    telefono: reservation.telefono,
    email: reservation.email || null,
    mascota: reservation.mascota,
    servicio: reservation.servicio,
    datetime: reservation.datetime,
    notes: reservation.notes || null,
    status: "confirmed",
    start_at: timestamps.startAt,
    end_at: timestamps.endAt,
  };

  const { error } = await client
    .from("reservations")
    .insert(databaseReservation);

  if (error) {
    if (error.code === "23505") {
      const conflictError = new Error(
        "Ese horario ya está reservado. Elige otro hueco.",
      );
      conflictError.statusCode = 409;
      throw conflictError;
    }
    throw new Error(
      `Supabase no pudo guardar la reserva: ${error.message}`,
    );
  }

  const calendarSync = await syncNewConfirmedReservation(databaseReservation);

  return {
    id: reservation.id,
    code: reservation.code,
    nombre: reservation.nombre,
    telefono: reservation.telefono,
    email: reservation.email || null,
    mascota: reservation.mascota,
    servicio: reservation.servicio,
    datetime: reservation.datetime,
    status: "confirmed",
    notes: reservation.notes || null,
    workerId: null,
    googleEventId: calendarSync.googleEventId,
    googleSyncError: calendarSync.error,
    googleSyncedAt: calendarSync.syncedAt,
    startAt: timestamps.startAt,
    endAt: timestamps.endAt,
    updatedAt: null,
    createdAt: new Date().toISOString(),
  };
}

export function normalizeReservation(body) {
  const emailCopy = Boolean(body?.emailCopy);
  const reservation = {
    id: crypto.randomUUID(),
    nombre: safeString(body?.nombre, 100),
    telefono: safeString(body?.telefono, 30),
    email: safeEmail(body?.email),
    mascota: safeString(body?.mascota, 80),
    servicio: safeString(body?.servicio, 30),
    notes: safeString(body?.notes || body?.motivo, 1000),
    datetime: safeString(body?.datetime, 16),
    emailCopy,
  };
  reservation.code = reservation.id.slice(0, 8).toUpperCase();

  if (
    !reservation.nombre
    || !reservation.telefono
    || !reservation.mascota
    || !reservation.servicio
    || !reservation.datetime
  ) {
    const error = new Error(
      "Nombre, teléfono, mascota, servicio y fecha/hora son obligatorios.",
    );
    error.statusCode = 400;
    throw error;
  }

  if (reservation.telefono.length < 6) {
    const error = new Error("Indica un teléfono de contacto válido.");
    error.statusCode = 400;
    throw error;
  }

  if (reservation.email && !isValidEmail(reservation.email)) {
    const error = new Error("Indica un email válido.");
    error.statusCode = 400;
    throw error;
  }

  if (
    !["consulta", "vacunacion", "cirugia", "peluqueria"].includes(
      reservation.servicio,
    )
  ) {
    const error = new Error(
      "Servicio no válido. Para urgencias, llama directamente a la clínica.",
    );
    error.statusCode = 400;
    throw error;
  }

  return reservation;
}

export function normalizeReservationUpdate(body) {
  const changes = {};

  if (Object.hasOwn(body || {}, "status")) {
    const status = safeString(body.status, 20);
    if (!["pending", "confirmed", "cancelled"].includes(status)) {
      const error = new Error("Estado de reserva no válido.");
      error.statusCode = 400;
      throw error;
    }
    changes.status = status;
  }

  if (Object.hasOwn(body || {}, "datetime")) {
    const datetime = safeString(body.datetime, 16);
    if (!isBookableDateTime(datetime)) {
      const error = new Error(
        "La fecha u hora elegida no está dentro del horario de la clínica.",
      );
      error.statusCode = 400;
      throw error;
    }
    changes.datetime = datetime;
    Object.assign(changes, buildReservationTimestamps(datetime));
  }

  if (Object.hasOwn(body || {}, "notes")) {
    changes.notes = safeString(body.notes, 2000) || null;
  }

  if (Object.hasOwn(body || {}, "worker_id")) {
    changes.worker_id = safeString(body.worker_id, 80) || null;
  }

  if (Object.keys(changes).length === 0) {
    const error = new Error("No hay cambios para aplicar.");
    error.statusCode = 400;
    throw error;
  }

  return changes;
}

export async function updateReservationFromAdmin(
  requestSupabase,
  reservationId,
  changes,
) {
  const { data: current, error: readError } = await requestSupabase
    .from("reservations")
    .select(reservationSelectFields())
    .eq("id", reservationId)
    .single();

  if (readError) {
    throw new Error(
      `Supabase no pudo leer la reserva: ${readError.message}`,
    );
  }

  const next = {
    ...current,
    ...toDatabaseReservationChanges(changes),
  };

  if (Object.hasOwn(changes, "datetime")) {
    Object.assign(
      next,
      toDatabaseReservationChanges(
        buildReservationTimestamps(next.datetime, next.servicio),
      ),
    );

    if (!isBookableDateTime(next.datetime, next.servicio)) {
      const error = new Error(
        "La fecha u hora elegida no está dentro del horario de la clínica.",
      );
      error.statusCode = 400;
      throw error;
    }

    const reservations = await readReservations(next.datetime.slice(0, 7));
    const alreadyReserved = reservations.some(
      (item) =>
        item.id !== reservationId && reservationOverlaps(item, next),
    );

    if (alreadyReserved) {
      const error = new Error("Ese horario ya está reservado. Elige otro hueco.");
      error.statusCode = 409;
      throw error;
    }
  }

  const calendarSync = await syncReservationCalendar(current, next);
  const payload = {
    ...toDatabaseReservationChanges(changes),
    google_event_id: calendarSync.googleEventId,
    google_sync_error: calendarSync.error,
    google_synced_at: calendarSync.syncedAt,
  };

  const { data, error } = await requestSupabase
    .from("reservations")
    .update(payload)
    .eq("id", reservationId)
    .select(reservationSelectFields())
    .single();

  if (error) {
    throw new Error(
      `Supabase no pudo actualizar la reserva: ${error.message}`,
    );
  }

  return mapReservationRow(data);
}

export async function requireAdminRequest(request) {
  const accessToken = getBearerToken(request);

  if (!accessToken) {
    const error = new Error("No autenticado.");
    error.statusCode = 401;
    throw error;
  }

  if (supabaseConfigError) {
    throw supabaseConfigError;
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    const error = new Error("Faltan SUPABASE_URL o SUPABASE_ANON_KEY.");
    error.statusCode = 500;
    throw error;
  }

  const requestSupabase = createClient(
    validateSupabaseUrl(supabaseUrl),
    supabaseAnonKey,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    },
  );

  const { data: userData, error: userError } =
    await requestSupabase.auth.getUser(accessToken);

  if (userError || !userData.user) {
    const error = new Error("Sesión no válida.");
    error.statusCode = 401;
    throw error;
  }

  const { data: profile, error: profileError } = await requestSupabase
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .single();

  if (profileError || profile?.role !== "admin") {
    const error = new Error("No tienes permisos de administrador.");
    error.statusCode = 403;
    throw error;
  }

  return { supabase: requestSupabase, user: userData.user };
}
