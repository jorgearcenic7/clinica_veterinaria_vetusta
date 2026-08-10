/**
 * Raw Supabase persistence-layer shapes: table rows and write payloads that
 * are NOT already represented 1:1 by types/models.d.ts (Pet, PetRecord,
 * PetDocument and Profile already ARE their own raw rows and live there).
 *
 * Schema source of truth: supabase-reservations.sql, supabase-client-area.sql
 * and supabase-audit-log.sql at the repo root — every field here is taken
 * directly from those `create table` statements or from the exact object
 * literals built in backend/lib/reservations.js, backend/lib/auditLog.js and
 * frontend/modules/shared/storage.js (duplicated in frontend/supabase-client.js).
 */

import type { PetDocumentSource, ReservationStatus } from "./models";

// ─── Reservations (raw "reservations" table) ──────────────────────────────────

/**
 * Raw row from the "reservations" table (supabase-reservations.sql),
 * snake_case, as returned by `.select("*")` or by
 * `reservationSelectFields()` in backend/lib/reservations.js.
 *
 * Used directly (without camelCase mapping) by the admin dashboard
 * (frontend/modules/admin/reservations.js, utils.js) and by
 * backend/lib/googleCalendar.js. Contrast with `Reservation` in
 * types/models.d.ts, which is the camelCase shape returned by the
 * public API after `mapReservationRow`.
 *
 * `mascota` and `servicio` are nullable at the schema level (no `not null`
 * column constraint) even though the API always validates and sets them
 * before insert — see normalizeReservation in backend/lib/reservations.js.
 * `servicio` is kept as `string`, not `ServiceType`, because downstream
 * code (formatReservationServiceForCalendar, admin utils.js
 * formatReservationService) explicitly falls back for unrecognized values,
 * implying rows may hold values outside the current 4-item enum.
 */
export interface ReservationRow {
  id: string;
  nombre: string;
  telefono: string;
  email: string | null;
  mascota: string | null;
  servicio: string | null;
  /** "YYYY-MM-DDTHH:MM" — local Madrid time, no timezone suffix. */
  datetime: string;
  status: ReservationStatus;
  notes: string | null;
  worker_id: string | null;
  google_event_id: string | null;
  google_sync_error: string | null;
  google_synced_at: string | null;
  /** ISO 8601 with Madrid offset, e.g. "2025-03-03T10:30:00+01:00". */
  start_at: string | null;
  end_at: string | null;
  client_id: string | null;
  updated_at: string;
  created_at: string;
}

/**
 * Row returned by the `get_reserved_reservation_slots(p_month)` RPC
 * (supabase-reservations.sql) — the public, non-admin fallback used in
 * `readPublicSupabaseReservationSlots` when no SUPABASE_SERVICE_ROLE_KEY is
 * configured. Deliberately minimal: only enough to compute occupancy.
 */
export interface ReservationOccupancySlot {
  datetime: string;
  status: ReservationStatus;
}

/**
 * Exact insert payload built in `saveSupabaseReservation`
 * (backend/lib/reservations.js). Narrower than `ReservationRow`: columns
 * populated later (worker_id, google_*, client_id, updated_at) are absent,
 * and `status` is always the literal "confirmed" for this insert path.
 */
export interface ReservationInsertRow {
  id: string;
  nombre: string;
  telefono: string;
  email: string | null;
  mascota: string;
  servicio: string;
  datetime: string;
  notes: string | null;
  status: "confirmed";
  start_at: string;
  end_at: string;
}

/**
 * Exact update payload built in `updateReservationFromAdmin`
 * (backend/lib/reservations.js): the admin-provided changes
 * (`toDatabaseReservationChanges`) plus the Google Calendar sync result,
 * which is always written on every update.
 */
export interface ReservationUpdatePayload {
  status?: ReservationStatus;
  datetime?: string;
  start_at?: string;
  end_at?: string;
  notes?: string | null;
  worker_id?: string | null;
  google_event_id: string | null;
  google_sync_error: string | null;
  google_synced_at: string | null;
}

// ─── Audit log ("admin_audit_logs" table) ──────────────────────────────────────

/**
 * Allowed `action` values per the `admin_audit_logs_action_check` CHECK
 * constraint (supabase-audit-log.sql). Today's app code
 * (backend/lib/reservations.js) only ever inserts "update", "status_change"
 * or "cancel" — "create" and "delete" are reserved by the schema for
 * possible future use, not currently produced anywhere.
 */
export type AuditLogAction = "create" | "update" | "status_change" | "cancel" | "delete";

/**
 * Insert payload for "admin_audit_logs" (backend/lib/auditLog.js
 * `logAdminAction`). `id` and `created_at` are DB-generated defaults, not
 * part of the insert. `entity_type` is a plain `string` (defaults to
 * "reservation" in the schema, but has no CHECK constraint restricting it);
 * today's app code always passes "reservation".
 */
export interface AdminAuditLogInsert {
  admin_user_id: string | null;
  admin_email: string | null;
  action: AuditLogAction;
  entity_type: string;
  entity_id: string;
  /** jsonb — populated with a `ReservationRow` snapshot in today's only call site. */
  before_data: Record<string, unknown> | null;
  /** jsonb — populated with a `ReservationRow` snapshot in today's only call site. */
  after_data: Record<string, unknown> | null;
}

// ─── Document upload log ("document_upload_logs" table) ───────────────────────

/**
 * Insert payload for "document_upload_logs"
 * (frontend/modules/shared/storage.js `logDocumentUpload`, duplicated in
 * frontend/supabase-client.js). `id` and `created_at` are DB-generated
 * defaults. `pet_id` and `uploaded_by` are nullable at the schema level
 * (`on delete cascade` / `on delete set null` FKs), even though the app
 * always populates them from an already-inserted `pet_documents` row.
 */
export interface DocumentUploadLogInsert {
  document_id: string | null;
  pet_id: string | null;
  uploaded_by: string | null;
  source: PetDocumentSource;
  file_name: string | null;
  file_type: string | null;
  /** bytes — `File.size` at upload time (Postgres `bigint` column). */
  file_size: number;
}
