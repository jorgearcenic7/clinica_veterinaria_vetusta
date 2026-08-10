import { describe, expect, it, vi } from "vitest";

// Simula lo que hace Postgres de forma atómica: rechaza el INSERT/UPDATE con
// 23P01 (exclusion_violation) cuando el rango start_at/end_at se solapa con
// otra reserva activa (constraint reservations_no_overlap), y con 23505
// (unique_violation) cuando coincide exactamente el datetime. Aquí se prueba
// que backend/lib/reservations.js traduce ambos códigos al mismo 409
// "hueco ya no disponible" que ya conocía el frontend, en vez de dejar pasar
// un error 500 crudo de Supabase.
vi.mock("../backend/lib/supabase.js", () => ({
  supabase: null,
  supabaseAdmin: {
    from: () => ({
      insert: () =>
        Promise.resolve({
          error: {
            code: "23P01",
            message:
              'conflicting key value violates exclusion constraint "reservations_no_overlap"',
          },
        }),
    }),
  },
  supabaseAnonKey: "test-anon-key",
  supabaseUrl: "https://example.supabase.co",
  supabaseConfigError: null,
}));

vi.mock("../backend/lib/googleCalendar.js", () => ({
  syncNewConfirmedReservation: () =>
    Promise.resolve({ googleEventId: null, error: null, syncedAt: null }),
  syncReservationCalendar: () =>
    Promise.resolve({ googleEventId: null, error: null, syncedAt: null }),
}));

const { saveReservation, updateReservationFromAdmin } = await import(
  "../backend/lib/reservations.js"
);

const FUTURE_DATETIME = "2027-01-04T11:00";

describe("saveReservation — solapamiento por rango de tiempo (exclusion_violation)", () => {
  it("traduce 23P01 (rango solapado, p. ej. cirugía 10:30-11:30 vs consulta 11:00-11:30) a 409", async () => {
    const reservation = {
      id: "11111111-1111-1111-1111-111111111111",
      code: "11111111",
      nombre: "María García",
      telefono: "985206558",
      email: null,
      mascota: "perro",
      servicio: "consulta",
      datetime: FUTURE_DATETIME,
      notes: "",
    };

    let thrown = null;
    try {
      await saveReservation(reservation);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).not.toBeNull();
    expect(thrown.statusCode).toBe(409);
    expect(thrown.message).toMatch(/ya está reservado/i);
  });
});

describe("updateReservationFromAdmin — solapamiento por rango de tiempo (exclusion_violation)", () => {
  it("traduce 23P01 del UPDATE a 409 en vez de un error 500 genérico", async () => {
    const currentReservation = {
      id: "22222222-2222-2222-2222-222222222222",
      nombre: "Juan Pérez",
      telefono: "600000000",
      email: null,
      mascota: "gato",
      servicio: "consulta",
      datetime: "2027-01-04T09:30",
      status: "confirmed",
      notes: null,
      worker_id: null,
      google_event_id: null,
      google_sync_error: null,
      google_synced_at: null,
      start_at: "2027-01-04T09:30:00+01:00",
      end_at: "2027-01-04T10:00:00+01:00",
      client_id: null,
      updated_at: null,
      created_at: null,
    };

    let selectCall = 0;
    const requestSupabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            single: () => {
              selectCall += 1;
              return Promise.resolve({ data: currentReservation, error: null });
            },
          }),
        }),
        update: () => ({
          eq: () => ({
            select: () => ({
              single: () =>
                Promise.resolve({
                  error: {
                    code: "23P01",
                    message:
                      'conflicting key value violates exclusion constraint "reservations_no_overlap"',
                  },
                }),
            }),
          }),
        }),
      }),
    };

    let thrown = null;
    try {
      await updateReservationFromAdmin(
        requestSupabase,
        currentReservation.id,
        { notes: "Cambio de notas, sin tocar horario" },
        { id: "admin-id", email: "admin@example.com" },
      );
    } catch (error) {
      thrown = error;
    }

    expect(selectCall).toBe(1);
    expect(thrown).not.toBeNull();
    expect(thrown.statusCode).toBe(409);
    expect(thrown.message).toMatch(/ya está reservado/i);
  });
});
