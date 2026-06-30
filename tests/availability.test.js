import { describe, expect, it } from "vitest";
import {
  buildMonthAvailability,
  buildSlots,
  getScheduleForDate,
  isBookableDateTime,
  reservationDurationMinutes,
  reservationOccupiesSlot,
  reservationOverlaps,
} from "../backend/lib/availability.js";

// 2025-03-03 es lunes, 2025-03-08 es sábado, 2025-03-09 es domingo.
const LUNES = new Date(2025, 2, 3);
const MARTES = new Date(2025, 2, 4);
const SABADO = new Date(2025, 2, 8);
const DOMINGO = new Date(2025, 2, 9);

describe("getScheduleForDate", () => {
  it("lunes-viernes devuelve dos franjas", () => {
    expect(getScheduleForDate(LUNES)).toEqual([
      ["10:30", "13:30"],
      ["17:00", "20:00"],
    ]);
  });

  it("martes devuelve las mismas franjas que lunes", () => {
    expect(getScheduleForDate(MARTES)).toEqual(getScheduleForDate(LUNES));
  });

  it("sábado devuelve una sola franja", () => {
    expect(getScheduleForDate(SABADO)).toEqual([["11:00", "13:30"]]);
  });

  it("domingo devuelve array vacío (cerrado)", () => {
    expect(getScheduleForDate(DOMINGO)).toEqual([]);
  });
});

describe("buildSlots — slots correctos por día", () => {
  it("lunes genera slots de 30 min en ambas franjas", () => {
    const slots = buildSlots("2025-03-03", getScheduleForDate(LUNES));
    const times = slots.map((s) => s.time);

    // Franja mañana: 10:30 … 13:00 (6 slots)
    expect(times).toContain("10:30");
    expect(times).toContain("11:00");
    expect(times).toContain("12:30");
    expect(times).toContain("13:00");
    expect(times).not.toContain("13:30"); // fin de franja, no incluido

    // Franja tarde: 17:00 … 19:30 (6 slots)
    expect(times).toContain("17:00");
    expect(times).toContain("19:30");
    expect(times).not.toContain("20:00");

    expect(slots).toHaveLength(12);
  });

  it("sábado genera slots solo de mañana", () => {
    const slots = buildSlots("2025-03-08", getScheduleForDate(SABADO));
    const times = slots.map((s) => s.time);

    expect(times).toContain("11:00");
    expect(times).toContain("13:00");
    expect(times).not.toContain("10:30");
    expect(times).not.toContain("17:00");
    expect(slots).toHaveLength(5); // 11:00 11:30 12:00 12:30 13:00
  });

  it("domingo no genera ningún slot", () => {
    const slots = buildSlots("2025-03-09", getScheduleForDate(DOMINGO));
    expect(slots).toHaveLength(0);
  });

  it("cada slot tiene datetime en formato YYYY-MM-DDTHH:MM", () => {
    const [slot] = buildSlots("2025-03-03", [["10:30", "11:00"]]);
    expect(slot.datetime).toBe("2025-03-03T10:30");
  });
});

describe("isBookableDateTime — validaciones de franja y pasado", () => {
  it("fecha pasada devuelve false", () => {
    expect(isBookableDateTime("2020-01-06T10:30")).toBe(false);
  });

  it("formato inválido devuelve false", () => {
    expect(isBookableDateTime("2025-03-03 10:30")).toBe(false);
    expect(isBookableDateTime("")).toBe(false);
  });

  it("domingo devuelve false aunque la hora sea válida", () => {
    // 2027-01-10 es domingo (verificado: 2027-01-01 = viernes, +9 días = domingo)
    expect(isBookableDateTime("2027-01-10T11:00")).toBe(false);
  });

  it("hora fuera de franja devuelve false", () => {
    // 2027-01-04 es lunes; 14:00 no está en horario (entre franjas)
    expect(isBookableDateTime("2027-01-04T14:00")).toBe(false);
  });

  it("cirugía que sobrepasa el fin de franja devuelve false", () => {
    // 13:00 + 60 min = 14:00 > 13:30 fin de franja mañana en lunes
    expect(isBookableDateTime("2027-01-04T13:00", "cirugia")).toBe(false);
  });

  it("consulta en horario válido futuro devuelve true", () => {
    // 2027-01-04 lunes, 11:00 dentro de la franja mañana
    expect(isBookableDateTime("2027-01-04T11:00", "consulta")).toBe(true);
  });

  it("cirugía con espacio suficiente devuelve true", () => {
    // 2027-01-04 lunes, 10:30 + 60 min = 11:30 ≤ 13:30
    expect(isBookableDateTime("2027-01-04T10:30", "cirugia")).toBe(true);
  });
});

describe("reservationDurationMinutes", () => {
  it("cirugia dura 60 min", () => {
    expect(reservationDurationMinutes("cirugia")).toBe(60);
  });

  it("consulta dura 30 min", () => {
    expect(reservationDurationMinutes("consulta")).toBe(30);
  });

  it("cualquier otro servicio dura 30 min", () => {
    expect(reservationDurationMinutes("vacunacion")).toBe(30);
    expect(reservationDurationMinutes("peluqueria")).toBe(30);
  });
});

describe("reservationOccupiesSlot", () => {
  const makeReservation = (datetime, servicio = "consulta") => ({
    datetime,
    servicio,
    status: "confirmed",
  });

  it("reserva de 30 min ocupa su propio slot", () => {
    const r = makeReservation("2025-03-03T10:30");
    expect(reservationOccupiesSlot(r, "2025-03-03T10:30")).toBe(true);
  });

  it("reserva de 30 min no ocupa el slot siguiente", () => {
    const r = makeReservation("2025-03-03T10:30");
    expect(reservationOccupiesSlot(r, "2025-03-03T11:00")).toBe(false);
  });

  it("cirugía (60 min) bloquea el slot siguiente", () => {
    const r = makeReservation("2025-03-03T10:30", "cirugia");
    expect(reservationOccupiesSlot(r, "2025-03-03T10:30")).toBe(true);
    expect(reservationOccupiesSlot(r, "2025-03-03T11:00")).toBe(true);
    expect(reservationOccupiesSlot(r, "2025-03-03T11:30")).toBe(false);
  });

  it("reserva cancelada no ocupa ningún slot", () => {
    const r = { ...makeReservation("2025-03-03T10:30"), status: "cancelled" };
    expect(reservationOccupiesSlot(r, "2025-03-03T10:30")).toBe(false);
  });

  it("reserva de día diferente no ocupa el slot", () => {
    const r = makeReservation("2025-03-03T10:30");
    expect(reservationOccupiesSlot(r, "2025-03-04T10:30")).toBe(false);
  });
});

describe("reservationOverlaps", () => {
  const makeReservation = (datetime, servicio = "consulta", status = "confirmed") => ({
    datetime,
    servicio,
    status,
  });

  it("misma hora se solapa", () => {
    const existing = makeReservation("2025-03-03T10:30");
    const requested = makeReservation("2025-03-03T10:30");
    expect(reservationOverlaps(existing, requested)).toBe(true);
  });

  it("reservas consecutivas no se solapan", () => {
    const existing = makeReservation("2025-03-03T10:30");
    const requested = makeReservation("2025-03-03T11:00");
    expect(reservationOverlaps(existing, requested)).toBe(false);
  });

  it("cirugía solapa con la siguiente media hora", () => {
    const existing = makeReservation("2025-03-03T10:30", "cirugia");
    const requested = makeReservation("2025-03-03T11:00");
    expect(reservationOverlaps(existing, requested)).toBe(true);
  });

  it("reserva cancelada no se considera solapada", () => {
    const existing = makeReservation("2025-03-03T10:30", "consulta", "cancelled");
    const requested = makeReservation("2025-03-03T10:30");
    expect(reservationOverlaps(existing, requested)).toBe(false);
  });
});

describe("buildMonthAvailability — estructura de respuesta", () => {
  it("incluye todos los días del mes", () => {
    const result = buildMonthAvailability("2025-03", []);
    expect(result.month).toBe("2025-03");
    expect(result.days).toHaveLength(31);
  });

  it("domingo tiene isOpen false y slots vacíos", () => {
    const result = buildMonthAvailability("2025-03", []);
    const domingo = result.days.find((d) => d.weekday === 0); // 0 = domingo
    expect(domingo.isOpen).toBe(false);
    expect(domingo.slots).toHaveLength(0);
  });

  it("lunes tiene isOpen true y slots", () => {
    const result = buildMonthAvailability("2025-03", []);
    const lunes = result.days.find((d) => d.weekday === 1);
    expect(lunes.isOpen).toBe(true);
    expect(lunes.slots.length).toBeGreaterThan(0);
  });

  it("slot ocupado se marca como reserved", () => {
    const reservas = [{ datetime: "2025-03-03T10:30", servicio: "consulta", status: "confirmed" }];
    const result = buildMonthAvailability("2025-03", reservas);
    const lunes = result.days.find((d) => d.date === "2025-03-03");
    const slot = lunes.slots.find((s) => s.time === "10:30");
    expect(slot.reserved).toBe(true);
  });

  it("slot no ocupado se marca como no reserved", () => {
    const result = buildMonthAvailability("2025-03", []);
    const lunes = result.days.find((d) => d.date === "2025-03-03");
    const slot = lunes.slots.find((s) => s.time === "10:30");
    expect(slot.reserved).toBe(false);
  });

  it("zona horaria Europe/Madrid: getMadridNowDateTimeKey devuelve formato correcto", async () => {
    const { getMadridNowDateTimeKey } = await import("../backend/lib/availability.js");
    const key = getMadridNowDateTimeKey();
    expect(key).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });
});
