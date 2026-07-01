/**
 * Core domain types for Clínica Veterinaria Vetusta.
 * Type-only definitions — no runtime code.
 */

// ─── Literal unions ───────────────────────────────────────────────────────────

export type ReservationStatus = "pending" | "confirmed" | "cancelled";
export type ServiceType = "consulta" | "vacunacion" | "cirugia" | "peluqueria";
export type UserRole = "admin" | "client";
export type PetDocumentSource = "clinic" | "client";

// ─── Users / Profiles ─────────────────────────────────────────────────────────

/** Row from the "profiles" Supabase table. */
export interface ClientProfile {
  id: string;
  full_name: string | null;
  phone: string | null;
  role: UserRole;
  created_at: string;
}

// ─── Pets ─────────────────────────────────────────────────────────────────────

/** Row from the "pets" Supabase table. */
export interface Pet {
  id: string;
  owner_id: string;
  name: string;
  species: string | null;
  breed: string | null;
  /** "YYYY-MM-DD" */
  birth_date: string | null;
  image_url: string | null;
  created_at: string;
  /** Signed Supabase Storage URL — populated on the frontend, not stored in DB. */
  signedImageUrl?: string;
}

/** Row from the "pet_records" Supabase table. */
export interface PetRecord {
  id: string;
  pet_id: string;
  title: string;
  record_type: string | null;
  /** "YYYY-MM-DD" */
  record_date: string | null;
  notes: string | null;
  /** "YYYY-MM-DD" */
  next_due_date: string | null;
  created_at: string;
}

/** Row from the "pet_documents" Supabase table. */
export interface PetDocument {
  id: string;
  pet_id: string;
  uploaded_by: string;
  title: string;
  description: string | null;
  file_url: string;
  file_name: string | null;
  file_type: string | null;
  source: PetDocumentSource;
  created_at: string;
  /** Signed Supabase Storage URL — populated on the frontend, not stored in DB. */
  signedUrl?: string;
}

// ─── Reservations ─────────────────────────────────────────────────────────────

/** Reservation as returned by the API (camelCase, mapped from DB snake_case). */
export interface Reservation {
  id: string;
  /** 8-character uppercase code shown to the client. */
  code?: string;
  nombre: string;
  telefono: string;
  email: string | null;
  mascota: string;
  servicio: ServiceType;
  /** "YYYY-MM-DDTHH:MM" — local Madrid time, no timezone suffix. */
  datetime: string;
  status: ReservationStatus;
  notes: string | null;
  emailCopy?: boolean;
  workerId?: string | null;
  googleEventId?: string | null;
  googleSyncError?: string | null;
  googleSyncedAt?: string | null;
  /** ISO 8601 with Madrid offset, e.g. "2025-03-03T10:30:00+01:00". */
  startAt?: string | null;
  endAt?: string | null;
  clientId?: string | null;
  updatedAt?: string | null;
  createdAt?: string | null;
}

// ─── Availability ─────────────────────────────────────────────────────────────

/** A single 30-minute bookable slot. */
export interface AvailabilitySlot {
  /** "HH:MM" */
  time: string;
  /** "YYYY-MM-DDTHH:MM" */
  datetime: string;
  isPast?: boolean;
  reserved?: boolean;
}

/** One calendar day with open/closed state and its slot list. */
export interface AvailabilityDay {
  /** "YYYY-MM-DD" */
  date: string;
  day: number;
  /** 0 = Sunday … 6 = Saturday */
  weekday: number;
  isOpen: boolean;
  isPast: boolean;
  fullyBooked: boolean;
  slots: AvailabilitySlot[];
}

/** Full availability response for a calendar month from GET /api/availability. */
export interface MonthAvailability {
  /** "YYYY-MM" */
  month: string;
  days: AvailabilityDay[];
}

// ─── Reviews ──────────────────────────────────────────────────────────────────

/** A single Google review entry. */
export interface GoogleReview {
  author: string;
  authorUrl: string | null;
  rating: number;
  text: string;
  relativeTime: string | null;
}

/** Full response from GET /api/google-reviews. */
export interface GoogleReviewsResponse {
  rating: number | null;
  reviewCount: number;
  googleMapsUri: string | null;
  reviews: GoogleReview[];
}

// ─── Shared response helpers ──────────────────────────────────────────────────

/** Result of an email send attempt returned alongside a new reservation. */
export interface EmailResult {
  requested: boolean;
  sent: boolean;
  pending: boolean;
  message?: string;
}

/** Generic paginated list response used by admin endpoints. */
export interface PaginatedResponse<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
