import { describe, expect, it } from "vitest";
import { normalizeReservation } from "../backend/lib/reservations.js";
import { sendReservationEmailIfRequested } from "../backend/lib/resend.js";

// Lunes dentro de horario, en el futuro
const FUTURE_DATETIME = "2027-01-04T11:00";

const validBody = () => ({
  nombre: "María García",
  telefono: "985206558",
  mascota: "perro",
  servicio: "consulta",
  datetime: FUTURE_DATETIME,
});

function throwError(body) {
  let thrown = null;
  try {
    normalizeReservation(body);
  } catch (error) {
    thrown = error;
  }
  return thrown;
}

describe("normalizeReservation — campos obligatorios y formato", () => {
  it("acepta datos válidos y devuelve reserva normalizada", () => {
    const result = normalizeReservation(validBody());
    expect(result.nombre).toBe("María García");
    expect(result.telefono).toBe("985206558");
    expect(result.mascota).toBe("perro");
    expect(result.servicio).toBe("consulta");
    expect(result.datetime).toBe(FUTURE_DATETIME);
    expect(result.id).toBeTruthy();
    expect(result.code).toHaveLength(8);
    expect(result.emailCopy).toBe(false);
  });

  it("lanza error 400 si falta nombre", () => {
    const error = throwError({ ...validBody(), nombre: "" });
    expect(error).not.toBeNull();
    expect(error.statusCode).toBe(400);
  });

  it("lanza error 400 si falta teléfono", () => {
    const error = throwError({ ...validBody(), telefono: "" });
    expect(error).not.toBeNull();
    expect(error.statusCode).toBe(400);
  });

  it("lanza error 400 si el teléfono tiene menos de 6 caracteres", () => {
    const error = throwError({ ...validBody(), telefono: "123" });
    expect(error).not.toBeNull();
    expect(error.statusCode).toBe(400);
  });

  it("acepta teléfono con exactamente 6 dígitos", () => {
    const result = normalizeReservation({ ...validBody(), telefono: "123456" });
    expect(result.telefono).toBe("123456");
  });

  it("acepta teléfono con formato español con espacios", () => {
    const result = normalizeReservation({ ...validBody(), telefono: "985 20 65 58" });
    expect(result.telefono).toBe("985 20 65 58");
  });

  it("lanza error 400 si el teléfono solo tiene letras aunque sea largo", () => {
    const error = throwError({ ...validBody(), telefono: "aaaaaaaaa" });
    expect(error).not.toBeNull();
    expect(error.statusCode).toBe(400);
  });

  it("lanza error 400 si el servicio no está en la lista permitida", () => {
    const error = throwError({ ...validBody(), servicio: "masajes" });
    expect(error).not.toBeNull();
    expect(error.statusCode).toBe(400);
  });

  it("acepta todos los servicios válidos", () => {
    for (const servicio of ["consulta", "vacunacion", "cirugia", "peluqueria"]) {
      const result = normalizeReservation({ ...validBody(), servicio });
      expect(result.servicio).toBe(servicio);
    }
  });

  it("lanza error 400 si el email con copia tiene formato inválido", () => {
    const error = throwError({ ...validBody(), email: "notanemail", emailCopy: true });
    expect(error).not.toBeNull();
    expect(error.statusCode).toBe(400);
  });

  it("acepta email válido cuando se solicita copia", () => {
    const result = normalizeReservation({
      ...validBody(),
      email: "cliente@ejemplo.com",
      emailCopy: true,
    });
    expect(result.email).toBe("cliente@ejemplo.com");
    expect(result.emailCopy).toBe(true);
  });

  it("no valida email si no se solicita copia", () => {
    const result = normalizeReservation({ ...validBody(), email: "", emailCopy: false });
    expect(result.emailCopy).toBe(false);
  });

  it("trunca nombre al límite de 100 caracteres", () => {
    const result = normalizeReservation({ ...validBody(), nombre: "a".repeat(200) });
    expect(result.nombre.length).toBe(100);
  });

  it("trunca notas al límite de 1000 caracteres", () => {
    const result = normalizeReservation({ ...validBody(), notes: "x".repeat(1500) });
    expect(result.notes.length).toBe(1000);
  });
});

describe("sendReservationEmailIfRequested — email no bloquea la reserva", () => {
  it("devuelve {requested:false} si emailCopy es false", async () => {
    const result = await sendReservationEmailIfRequested({}, false);
    expect(result.requested).toBe(false);
    expect(result.sent).toBe(false);
    expect(result.pending).toBe(false);
  });

  it("devuelve {pending:true} si no hay email en la reserva", async () => {
    const result = await sendReservationEmailIfRequested({ email: "" }, true);
    expect(result.requested).toBe(true);
    expect(result.sent).toBe(false);
    expect(result.pending).toBe(true);
  });

  it("devuelve {pending:true} si RESEND_API_KEY no está configurada en el entorno de test", async () => {
    // En el entorno de test no hay RESEND_API_KEY, por lo que resendApiKey = ""
    const result = await sendReservationEmailIfRequested(
      { email: "test@ejemplo.com" },
      true,
    );
    expect(result.requested).toBe(true);
    expect(result.sent).toBe(false);
    expect(result.pending).toBe(true);
  });
});
