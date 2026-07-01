/**
 * HTTP API request bodies and response shapes.
 * Describes what goes over the wire between frontend and backend.
 */

import type {
  ClientProfile,
  EmailResult,
  GoogleReviewsResponse,
  MonthAvailability,
  PaginatedResponse,
  Reservation,
  ReservationStatus,
} from "./models";

// ─── Request bodies ───────────────────────────────────────────────────────────

/** Body for POST /api/reservations */
export interface ReservationRequestBody {
  nombre: string;
  telefono: string;
  email?: string;
  emailCopy?: boolean;
  mascota: string;
  servicio: string;
  /** Free-text reason / notes (also accepted as "motivo"). */
  notes?: string;
  /** "YYYY-MM-DDTHH:MM" */
  datetime: string;
}

/** Body for PATCH /api/admin/reservations/:id */
export interface ReservationUpdateBody {
  status?: ReservationStatus;
  /** "YYYY-MM-DDTHH:MM" */
  datetime?: string;
  notes?: string;
  worker_id?: string | null;
}

// ─── Response bodies ──────────────────────────────────────────────────────────

/** GET /api/supabase-config */
export interface SupabaseConfigResponse {
  supabaseUrl: string;
  supabaseAnonKey: string;
}

/** POST /api/reservations → 200 */
export interface ReservationCreatedResponse {
  reservation: Reservation;
  email: EmailResult;
}

/** PATCH /api/admin/reservations/:id → 200 */
export interface AdminReservationUpdateResponse {
  ok: boolean;
  reservation: Reservation;
}

/** GET /api/admin/clients → 200 */
export type AdminClientsResponse = PaginatedResponse<ClientProfile>;

// Re-exports so callers only need one import
export type {
  MonthAvailability,
  GoogleReviewsResponse,
  PaginatedResponse,
  ClientProfile,
  Reservation,
  ReservationStatus,
  EmailResult,
};
