/**
 * Google Calendar API v3 event shapes actually built/consumed by
 * backend/lib/googleCalendar.js. Not a general-purpose Google Calendar API
 * typing — only what this project sends and reads back.
 */

export interface GoogleCalendarEventDateTime {
  dateTime: string;
  timeZone: "Europe/Madrid";
}

export interface GoogleCalendarEventAttendee {
  email: string;
}

/** Exact payload built by `toCalendarEvent` for create/update calendar requests. */
export interface GoogleCalendarEventPayload {
  summary: string;
  description: string;
  start: GoogleCalendarEventDateTime;
  end: GoogleCalendarEventDateTime;
  attendees?: GoogleCalendarEventAttendee[];
}

/**
 * Result shape returned by `syncReservationCalendar` and
 * `syncNewConfirmedReservation` — always this exact shape, success or
 * failure (errors are caught and reported here, never thrown).
 */
export interface GoogleCalendarSyncResult {
  googleEventId: string | null;
  error: string | null;
  syncedAt: string | null;
}
