export function fetchSupabaseConfig() {
  return fetch("/api/supabase-config");
}

export function fetchAvailability(monthKey) {
  return fetch(`/api/availability?month=${monthKey}`);
}

export function createReservation(payload) {
  return fetch("/api/reservations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function fetchGoogleReviews() {
  return fetch("/api/google-reviews");
}

export function fetchAdminClients(page, limit, token) {
  return fetch(`/api/admin/clients?page=${page}&limit=${limit}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

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
