export const state = {
  supabase: null,
  clients: [],
  pets: [],
  reservations: [],
  records: [],
  documents: [],
  selectedClientId: null,
  selectedPetId: null,
  selectedReservationId: null,
  visibleWeekStart: null,
  clientsPage: 1,
  clientsTotalPages: 1,
  clientsTotal: 0,
};

export const CLIENTS_LIMIT = 20;
export const cb = { render: null, loadAll: null };

export const statusEl = document.querySelector("[data-status]");
export const clientsListEl = document.querySelector("[data-clients-list]");
export const petsListEl = document.querySelector("[data-pets-list]");
export const reservationsCalendarEl = document.querySelector("[data-reservations-calendar]");
export const reservationDetailEl = document.querySelector("[data-reservation-detail]");
export const calendarRangeEl = document.querySelector("[data-calendar-range]");
export const calendarPrevButton = document.querySelector("[data-calendar-prev]");
export const calendarNextButton = document.querySelector("[data-calendar-next]");
export const clientDetailEl = document.querySelector("[data-client-detail]");
export const recordsTitleEl = document.querySelector("[data-records-title]");
export const recordsTableEl = document.querySelector("[data-records-table]");
export const petForm = document.querySelector("[data-pet-form]");
export const recordForm = document.querySelector("[data-record-form]");
export const documentForm = document.querySelector("[data-document-form]");
export const documentsTitleEl = document.querySelector("[data-documents-title]");
export const documentsListEl = document.querySelector("[data-documents-list]");
export const clearPetButton = document.querySelector("[data-clear-pet]");
export const clearRecordButton = document.querySelector("[data-clear-record]");
export const logoutButton = document.querySelector("[data-logout]");
export const cancelModalEl = document.querySelector("[data-cancel-modal]");
export const cancelModalDismissButton = document.querySelector("[data-cancel-modal-dismiss]");
export const cancelModalConfirmButton = document.querySelector("[data-cancel-modal-confirm]");

export function getSelectedClient() {
  return state.clients.find(
    (client) => client.id === state.selectedClientId && client.role === "client",
  ) || null;
}
