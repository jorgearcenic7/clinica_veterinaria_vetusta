// Lógica pura de cálculo de slots y disponibilidad de reservas.
// Sin efectos secundarios: apta para tests unitarios.

import { isDigits, isValidDateTimeKey } from "./utils.js";

export function buildMonthAvailability(month, reservations) {
  const [year, monthNumber] = month.split("-").map(Number);
  const daysInMonth = new Date(year, monthNumber, 0).getDate();
  const nowDateTimeKey = getMadridNowDateTimeKey();
  const todayKey = nowDateTimeKey.slice(0, 10);
  const days = [];

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, monthNumber - 1, day);
    const dateKey = toDateKey(date);
    const schedule = getScheduleForDate(date);
    const slots = buildSlots(dateKey, schedule).map((slot) => ({
      ...slot,
      isPast: slot.datetime <= nowDateTimeKey,
      reserved: reservations.some((reservation) =>
        reservationOccupiesSlot(reservation, slot.datetime),
      ),
    }));

    days.push({
      date: dateKey,
      day,
      weekday: date.getDay(),
      isOpen: schedule.length > 0,
      isPast: dateKey < todayKey,
      fullyBooked:
        slots.length > 0 && slots.every((slot) => slot.reserved || slot.isPast),
      slots,
    });
  }

  return { month, days };
}

export function buildSlots(dateKey, schedule) {
  return schedule.flatMap(([start, end]) => {
    const slots = [];
    let current = toMinutes(start);
    const endMinutes = toMinutes(end);

    while (current < endMinutes) {
      const time = fromMinutes(current);
      slots.push({ time, datetime: `${dateKey}T${time}` });
      current += 30;
    }

    return slots;
  });
}

export function getScheduleForDate(date) {
  const weekday = date.getDay();

  if (weekday >= 1 && weekday <= 5) {
    return [
      ["10:30", "13:30"],
      ["17:00", "20:00"],
    ];
  }

  if (weekday === 6) {
    return [["11:00", "13:30"]];
  }

  return [];
}

export function isBookableDateTime(datetime, service = "consulta") {
  if (!isValidDateTimeKey(datetime)) {
    return false;
  }

  const [dateKey, time] = datetime.split("T");
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  if (datetime <= getMadridNowDateTimeKey()) {
    return false;
  }

  const duration = reservationDurationMinutes(service);
  const startMinutes = toMinutes(time);
  const endMinutes = startMinutes + duration;
  return getScheduleForDate(date).some(
    ([start, end]) =>
      startMinutes >= toMinutes(start)
      && endMinutes <= toMinutes(end)
      && (startMinutes - toMinutes(start)) % 30 === 0,
  );
}

export function getMadridNowDateTimeKey() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`;
}

export function reservationOverlaps(existingReservation, requestedReservation) {
  if (existingReservation.status === "cancelled") {
    return false;
  }

  const existingRange = reservationMinuteRange(existingReservation);
  const requestedRange = reservationMinuteRange(requestedReservation);
  return (
    existingRange.dateKey === requestedRange.dateKey
    && existingRange.start < requestedRange.end
    && requestedRange.start < existingRange.end
  );
}

export function reservationOccupiesSlot(reservation, slotDatetime) {
  if (reservation.status === "cancelled") {
    return false;
  }

  const slotRange = {
    dateKey: slotDatetime.slice(0, 10),
    start: toMinutes(slotDatetime.slice(11, 16)),
    end: toMinutes(slotDatetime.slice(11, 16)) + 30,
  };
  const reservationRange = reservationMinuteRange(reservation);

  return (
    reservationRange.dateKey === slotRange.dateKey
    && reservationRange.start < slotRange.end
    && slotRange.start < reservationRange.end
  );
}

export function reservationMinuteRange(reservation) {
  const datetime =
    reservation.datetime || reservation.startAt || reservation.start_at;
  const dateKey = String(datetime || "").slice(0, 10);
  const start = toMinutes(String(datetime || "T00:00").slice(11, 16));
  return {
    dateKey,
    start,
    end: start + reservationDurationMinutes(reservation.servicio),
  };
}

export function reservationDurationMinutes(service) {
  return service === "cirugia" ? 60 : 30;
}

export function buildReservationTimestamps(datetime, service = "consulta") {
  const endDatetime = addMinutesToDatetime(
    datetime,
    reservationDurationMinutes(service),
  );
  return {
    startAt: toMadridOffsetDateTime(datetime),
    endAt: toMadridOffsetDateTime(endDatetime),
  };
}

export function addMinutesToDatetime(datetime, minutesToAdd) {
  const [dateKey, time] = datetime.split("T");
  const [year, month, day] = dateKey.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);
  const date = new Date(
    Date.UTC(year, month - 1, day, hours, minutes + minutesToAdd),
  );

  return (
    [
      date.getUTCFullYear(),
      String(date.getUTCMonth() + 1).padStart(2, "0"),
      String(date.getUTCDate()).padStart(2, "0"),
    ].join("-")
    + `T${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")}`
  );
}

export function toMadridOffsetDateTime(datetime) {
  const [dateKey, time] = datetime.split("T");
  const [year, month, day] = dateKey.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);
  const probeDate = new Date(Date.UTC(year, month - 1, day, hours, minutes));
  const offset = madridOffset(probeDate);
  return `${dateKey}T${time}:00${offset}`;
}

export function madridOffset(date) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Madrid",
    timeZoneName: "shortOffset",
  });
  const timeZoneName =
    formatter.formatToParts(date).find((part) => part.type === "timeZoneName")
      ?.value || "GMT+1";
  const offset = parseGmtOffset(timeZoneName);
  return offset || "+01:00";
}

export function parseGmtOffset(value) {
  const text = String(value || "").slice(0, 12);

  if (!text.startsWith("GMT") || (text[3] !== "+" && text[3] !== "-")) {
    return "";
  }

  const sign = text[3];
  const rest = text.slice(4);
  const [rawHours, rawMinutes = "00"] = rest.split(":");

  if (
    !rawHours
    || rawHours.length > 2
    || rawMinutes.length !== 2
    || !isDigits(rawHours)
    || !isDigits(rawMinutes)
  ) {
    return "";
  }

  const hoursNumber = Number(rawHours);
  const minutesNumber = Number(rawMinutes);

  if (hoursNumber > 14 || minutesNumber > 59) {
    return "";
  }

  return `${sign}${String(hoursNumber).padStart(2, "0")}:${String(minutesNumber).padStart(2, "0")}`;
}

export function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function toMinutes(time) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export function fromMinutes(totalMinutes) {
  const hours = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
  const minutes = String(totalMinutes % 60).padStart(2, "0");
  return `${hours}:${minutes}`;
}
