import { state, cb, statusEl, reservationsCalendarEl, reservationDetailEl, calendarRangeEl } from "./state.js";
import { escapeHtml, formatReservationDateTime, formatReservationTitle, formatReservationService, formatReservationTimeRange, formatWeekRange, formatWeekday, statusClass, statusLabel, syncStatusMarkup, reservationDateKey, reservationStartMinutes, toDateKey, addDays } from "./utils.js";
import { setStatus, friendlyError, formatDate } from "../../supabase-client.js";
import { patchAdminReservationStatus } from "../shared/api.js";

export function loadReservations() {
  const weekStart = toDateKey(state.visibleWeekStart);
  const weekEnd = toDateKey(addDays(state.visibleWeekStart, 7));
  return state.supabase
    .from("reservations")
    .select("*")
    .gte("datetime", weekStart)
    .lt("datetime", weekEnd)
    .order("datetime", { ascending: true });
}

export function renderReservations() {
  reservationsCalendarEl.replaceChildren();
  calendarRangeEl.textContent = formatWeekRange(state.visibleWeekStart);

  const weekDays = Array.from({ length: 7 }, (_, index) => addDays(state.visibleWeekStart, index));
  const weekReservations = state.reservations.filter((reservation) => {
    const dateKey = reservationDateKey(reservation);
    return weekDays.some((day) => toDateKey(day) === dateKey);
  });

  reservationsCalendarEl.append(...weekDays.map((day) => createCalendarDay(day, weekReservations)));

  if (weekReservations.length === 0) {
    const empty = document.createElement("p");
    empty.className = "calendar-empty muted";
    empty.textContent = "No hay reservas esta semana.";
    reservationsCalendarEl.append(empty);
  }

  renderReservationDetail();
}

export function createCalendarDay(day, weekReservations) {
  const dayKey = toDateKey(day);
  const column = document.createElement("article");
  column.className = "calendar-day";
  column.innerHTML = `
    <div class="calendar-day-header">
      <strong>${escapeHtml(formatWeekday(day))}</strong>
      <span>${escapeHtml(formatDate(dayKey))}</span>
    </div>
  `;

  const dayReservations = weekReservations
    .filter((reservation) => reservationDateKey(reservation) === dayKey)
    .sort((a, b) => reservationStartMinutes(a) - reservationStartMinutes(b));

  if (dayReservations.length === 0) {
    const empty = document.createElement("p");
    empty.className = "calendar-day-empty";
    empty.textContent = "Sin citas";
    column.append(empty);
    return column;
  }

  dayReservations.forEach((reservation) => {
    column.append(createCalendarEvent(reservation));
  });

  return column;
}

export function createCalendarEvent(reservation) {
  const status = reservation.status || "confirmed";
  const button = document.createElement("button");
  button.type = "button";
  button.className = `calendar-event calendar-event-${status} ${reservation.id === state.selectedReservationId ? "active" : ""}`;
  button.innerHTML = `
    <strong>${escapeHtml(formatReservationTitle(reservation))}</strong>
    <span>${escapeHtml(formatReservationService(reservation.servicio))}</span>
    <time>${escapeHtml(formatReservationTimeRange(reservation))}</time>
  `;
  button.addEventListener("click", () => {
    state.selectedReservationId = reservation.id;
    renderReservations();
  });

  return button;
}

export function renderReservationDetail() {
  const reservation = state.reservations.find((item) => item.id === state.selectedReservationId);
  reservationDetailEl.replaceChildren();

  if (!reservation) {
    reservationDetailEl.classList.add("hidden");
    return;
  }

  const status = reservation.status || "confirmed";
  reservationDetailEl.classList.remove("hidden");
  reservationDetailEl.innerHTML = `
    <div>
      <p class="muted small">Detalle rápido</p>
      <h3>${escapeHtml(formatReservationTitle(reservation))}</h3>
      <p>${escapeHtml(formatReservationService(reservation.servicio))}</p>
      <p class="muted">${escapeHtml(formatReservationDateTime(reservation.datetime))} · ${escapeHtml(formatReservationTimeRange(reservation))}</p>
      <p class="muted">${escapeHtml(reservation.telefono || "Sin teléfono")}</p>
      <span class="badge ${statusClass(status)}">${escapeHtml(statusLabel(status))}</span>
      ${syncStatusMarkup(reservation)}
    </div>
    <div class="nav-actions">
      ${status === "cancelled" ? "" : `<button class="danger" type="button" data-cancel-reservation="${reservation.id}">Cancelar</button>`}
    </div>
  `;

  reservationDetailEl.querySelectorAll("[data-cancel-reservation]").forEach((button) => {
    button.addEventListener("click", () => updateReservationStatus(button.dataset.cancelReservation, "cancelled"));
  });
}

export async function updateReservationStatus(id, status) {
  try {
    setStatus(statusEl, "Actualizando reserva...");
    const { data: sessionData, error: sessionError } = await state.supabase.auth.getSession();

    if (sessionError || !sessionData.session?.access_token) {
      throw sessionError || new Error("Sesión no válida.");
    }

    const response = await patchAdminReservationStatus(id, status, sessionData.session.access_token);

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || "No se pudo actualizar la reserva.");
    }

    await cb.loadAll();
    const syncError = data.reservation?.googleSyncError || data.reservation?.google_sync_error;
    setStatus(
      statusEl,
      syncError ? "Reserva cancelada. Error de sincronización con Google Calendar." : "Reserva cancelada.",
      Boolean(syncError),
    );
  } catch (error) {
    setStatus(statusEl, friendlyError(error) || "No se pudo actualizar la reserva.", true);
  }
}

export async function changeCalendarWeek(offset) {
  try {
    state.visibleWeekStart = addDays(state.visibleWeekStart, offset * 7);
    setStatus(statusEl, "Cargando citas...");
    const reservationsResult = await loadReservations();

    if (reservationsResult.error) {
      throw reservationsResult.error;
    }

    state.reservations = reservationsResult.data || [];
    setStatus(statusEl, "");
    renderReservations();
  } catch (error) {
    setStatus(
      statusEl,
      "No se pudieron cargar las reservas de la semana.",
      true,
    );
  }
}
