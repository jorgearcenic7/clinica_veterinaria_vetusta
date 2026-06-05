import crypto from "node:crypto";
import { buildReservationTimestamps } from "./availability.js";
import { supabaseAdmin } from "./supabase.js";
import {
  base64UrlJson,
  cleanEnvValue,
  cleanGooglePrivateKey,
  formatReservationServiceForCalendar,
} from "./utils.js";

const googleCalendarId = cleanEnvValue(
  process.env.GOOGLE_CALENDAR_ID || "clinicavetusta@gmail.com",
);
const googleClientEmail = cleanEnvValue(process.env.GOOGLE_CLIENT_EMAIL);
const googlePrivateKey = cleanGooglePrivateKey(process.env.GOOGLE_PRIVATE_KEY);

export async function syncReservationCalendar(current, next) {
  try {
    if (next.status === "cancelled") {
      if (current.google_event_id) {
        console.log("Deleting Google event", current.id);
        await deleteCalendarEvent(current.google_event_id);
      }
      return {
        googleEventId: null,
        error: null,
        syncedAt: new Date().toISOString(),
      };
    }

    if (next.status !== "confirmed") {
      return {
        googleEventId: current.google_event_id || null,
        error: null,
        syncedAt: current.google_synced_at || null,
      };
    }

    validateReservationForCalendar(next);

    if (current.google_event_id) {
      if (hasCalendarRelevantChanges(current, next)) {
        console.log("Updating Google event", current.id);
        await updateCalendarEvent(current.google_event_id, next);
      }
      return {
        googleEventId: current.google_event_id,
        error: null,
        syncedAt: new Date().toISOString(),
      };
    }

    console.log("Creating Google event", current.id);
    const event = await createCalendarEvent(next);
    return {
      googleEventId: event.id,
      error: null,
      syncedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error("Google Calendar error", error);
    return {
      googleEventId: current.google_event_id || null,
      error: error.message || "No se pudo sincronizar con Google Calendar.",
      syncedAt: current.google_synced_at || null,
    };
  }
}

export async function syncNewConfirmedReservation(databaseReservation) {
  if (!supabaseAdmin) {
    return { googleEventId: null, error: null, syncedAt: null };
  }

  const calendarSync = await syncReservationCalendar(
    {
      ...databaseReservation,
      google_event_id: null,
      google_synced_at: null,
    },
    databaseReservation,
  );

  const { error } = await supabaseAdmin
    .from("reservations")
    .update({
      google_event_id: calendarSync.googleEventId,
      google_sync_error: calendarSync.error,
      google_synced_at: calendarSync.syncedAt,
    })
    .eq("id", databaseReservation.id);

  if (error) {
    console.error("Reservation Google sync update error:", error);
    return {
      googleEventId: calendarSync.googleEventId,
      error: error.message || calendarSync.error,
      syncedAt: calendarSync.syncedAt,
    };
  }

  return calendarSync;
}

export async function createCalendarEvent(reservation) {
  return googleCalendarRequest("", {
    method: "POST",
    body: JSON.stringify(toCalendarEvent(reservation)),
  });
}

export async function updateCalendarEvent(eventId, reservation) {
  return googleCalendarRequest(`/${encodeURIComponent(eventId)}`, {
    method: "PUT",
    body: JSON.stringify(toCalendarEvent(reservation)),
  });
}

export async function deleteCalendarEvent(eventId) {
  try {
    await googleCalendarRequest(`/${encodeURIComponent(eventId)}`, {
      method: "DELETE",
      expectJson: false,
    });
  } catch (error) {
    if (error.statusCode !== 404 && error.statusCode !== 410) {
      throw error;
    }
  }
}

async function googleCalendarRequest(pathSuffix, options = {}) {
  const token = await getGoogleCalendarAccessToken();
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(googleCalendarId)}/events${pathSuffix}`;
  const googleResponse = await fetch(url, {
    method: options.method || "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: options.body,
  });

  if (options.expectJson === false && googleResponse.ok) {
    return null;
  }

  const payload = await googleResponse.json().catch(() => ({}));

  if (!googleResponse.ok) {
    const error = new Error(
      payload?.error?.message
        || `Google Calendar respondió con ${googleResponse.status}.`,
    );
    error.statusCode = googleResponse.status;
    throw error;
  }

  return payload;
}

async function getGoogleCalendarAccessToken() {
  if (!googleCalendarId || !googleClientEmail || !googlePrivateKey) {
    const error = new Error(
      "Faltan GOOGLE_CALENDAR_ID, GOOGLE_CLIENT_EMAIL o GOOGLE_PRIVATE_KEY.",
    );
    error.statusCode = 500;
    throw error;
  }

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claimSet = {
    iss: googleClientEmail,
    scope: "https://www.googleapis.com/auth/calendar.events",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };
  const unsignedToken = `${base64UrlJson(header)}.${base64UrlJson(claimSet)}`;
  const signature = crypto
    .createSign("RSA-SHA256")
    .update(unsignedToken)
    .sign(googlePrivateKey, "base64url");
  const assertion = `${unsignedToken}.${signature}`;

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const payload = await tokenResponse.json().catch(() => ({}));

  if (!tokenResponse.ok) {
    const error = new Error(
      payload?.error_description
        || payload?.error
        || "Google no devolvio un access token.",
    );
    error.statusCode = tokenResponse.status;
    throw error;
  }

  return payload.access_token;
}

function toCalendarEvent(reservation) {
  const timestamps = buildReservationTimestamps(
    reservation.datetime,
    reservation.servicio,
  );
  return {
    summary: `Cita veterinaria: ${reservation.nombre || "Cliente"}`,
    description: [
      `Cliente: ${reservation.nombre || "Sin nombre"}`,
      `Teléfono: ${reservation.telefono || "Sin teléfono"}`,
      reservation.email ? `Email: ${reservation.email}` : "",
      `Mascota: ${reservation.mascota || "Sin indicar"}`,
      `Servicio: ${formatReservationServiceForCalendar(reservation.servicio)}`,
      reservation.notes ? `Notas: ${reservation.notes}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
    start: {
      dateTime: reservation.start_at || timestamps.startAt,
      timeZone: "Europe/Madrid",
    },
    end: {
      dateTime: reservation.end_at || timestamps.endAt,
      timeZone: "Europe/Madrid",
    },
    attendees: reservation.email
      ? [{ email: reservation.email }]
      : undefined,
  };
}

function validateReservationForCalendar(reservation) {
  if (!reservation.datetime) {
    throw new Error("La reserva no tiene fecha/hora para sincronizar.");
  }
  if (!reservation.nombre) {
    throw new Error("La reserva no tiene nombre para sincronizar.");
  }
  if (!reservation.telefono) {
    throw new Error("La reserva no tiene teléfono para sincronizar.");
  }
}

function hasCalendarRelevantChanges(current, next) {
  return [
    "nombre",
    "telefono",
    "email",
    "mascota",
    "servicio",
    "datetime",
    "notes",
    "start_at",
    "end_at",
  ].some((key) => (current[key] || "") !== (next[key] || ""));
}
