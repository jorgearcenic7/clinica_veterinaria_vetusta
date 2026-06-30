import { formatDate } from "../shared/utils.js";

export function formatReservationDateTime(value) {
  if (!value) {
    return "Sin fecha";
  }

  const [dateKey, time = ""] = String(value).split("T");
  const formattedDate = formatDate(dateKey);
  return time ? `${formattedDate} ${time}` : formattedDate;
}

export function formatReservationService(value) {
  const labels = {
    consulta: "Consulta general",
    vacunacion: "Vacunación",
    cirugia: "Cirugía",
    peluqueria: "Peluquería",
    urgencia: "Urgencia",
  };

  return labels[value] || value || "Sin indicar";
}

export function statusLabel(status) {
  const labels = {
    pending: "Pendiente",
    confirmed: "Confirmada",
    cancelled: "Cancelada",
  };

  return labels[status] || status;
}

export function statusClass(status) {
  return `badge-${status || "confirmed"}`;
}

export function syncStatusMarkup(reservation) {
  if (reservation.google_sync_error) {
    return `<div class="sync-status sync-status-error" title="${escapeHtml(reservation.google_sync_error)}">Error de sincronización</div>`;
  }

  if (
    (reservation.status === "confirmed" && reservation.google_event_id)
    || (reservation.status === "cancelled" && reservation.google_synced_at)
  ) {
    return `<div class="sync-status sync-status-ok">Sincronizado con Google Calendar</div>`;
  }

  return "";
}

export function formatReservationTitle(reservation) {
  const petName = reservation.mascota || "Mascota";
  const clientName = reservation.nombre || "Cliente";
  return `${petName} (${clientName})`;
}

export function formatReservationTimeRange(reservation) {
  const start = reservationStartTime(reservation);
  const end = reservationEndTime(reservation);
  return `${start} - ${end}`;
}

export function formatWeekRange(startDate) {
  const endDate = addDays(startDate, 6);
  return `${formatDate(toDateKey(startDate))} - ${formatDate(toDateKey(endDate))}`;
}

export function formatWeekday(date) {
  return new Intl.DateTimeFormat("es-ES", { weekday: "short" }).format(date);
}

export function reservationDateKey(reservation) {
  return String(reservation.datetime || madridDateTimeParts(reservation.start_at).date || "").slice(0, 10);
}

export function reservationStartTime(reservation) {
  if (reservation.datetime) {
    return String(reservation.datetime).slice(11, 16) || "00:00";
  }

  return madridDateTimeParts(reservation.start_at).time || "00:00";
}

export function reservationEndTime(reservation) {
  if (reservation.datetime) {
    return addMinutesToTime(reservationStartTime(reservation), 30);
  }

  return madridDateTimeParts(reservation.end_at).time || addMinutesToTime(reservationStartTime(reservation), 30);
}

export function reservationStartMinutes(reservation) {
  const [hours, minutes] = reservationStartTime(reservation).split(":").map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

export function madridDateTimeParts(value) {
  if (!value) {
    return { date: "", time: "" };
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    const text = String(value);
    return {
      date: text.slice(0, 10),
      time: text.slice(11, 16),
    };
  }

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return {
    date: `${byType.year}-${byType.month}-${byType.day}`,
    time: `${byType.hour}:${byType.minute}`,
  };
}

export function addMinutesToTime(time, minutesToAdd) {
  const [hours, minutes] = time.split(":").map(Number);
  const total = (hours || 0) * 60 + (minutes || 0) + minutesToAdd;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function startOfWeek(date) {
  const weekStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const mondayOffset = (weekStart.getDay() + 6) % 7;
  weekStart.setDate(weekStart.getDate() - mondayOffset);
  return weekStart;
}

export function addDays(date, days) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

export function toDateKey(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export function emptyMessage(text) {
  const item = document.createElement("p");
  item.className = "muted";
  item.textContent = text;
  return item;
}

export function tableMessage(text, colSpan = 6) {
  const row = document.createElement("tr");
  const cell = document.createElement("td");
  cell.colSpan = colSpan;
  cell.className = "muted";
  cell.textContent = text;
  row.append(cell);
  return row;
}

export function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function normalizeEmptyDates(values) {
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value === "" ? null : value]));
}
