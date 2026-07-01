// @ts-check
/** @typedef {import('../../../types/api').ReservationRequestBody} ReservationRequestBody */
/** @typedef {import('../../../types/api').ReservationStatus} ReservationStatus */

/** @returns {Promise<Response>} */
export function fetchSupabaseConfig() {
  return fetch("/api/supabase-config");
}

/**
 * @param {string} monthKey - "YYYY-MM"
 * @returns {Promise<Response>}
 */
export function fetchAvailability(monthKey) {
  return fetch(`/api/availability?month=${monthKey}`);
}

/**
 * @param {ReservationRequestBody} payload
 * @returns {Promise<Response>}
 */
export function createReservation(payload) {
  return fetch("/api/reservations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

/** @returns {Promise<Response>} */
export function fetchGoogleReviews() {
  return fetch("/api/google-reviews");
}

/**
 * @param {number} page
 * @param {number} limit
 * @param {string} token - Bearer auth token
 * @returns {Promise<Response>}
 */
export function fetchAdminClients(page, limit, token) {
  return fetch(`/api/admin/clients?page=${page}&limit=${limit}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

/**
 * @param {string} id - Reservation UUID
 * @param {ReservationStatus} status
 * @param {string} token - Bearer auth token
 * @returns {Promise<Response>}
 */
export function patchAdminReservationStatus(id, status, token) {
  return fetch(`/api/admin/reservations/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ status }),
  });
}
