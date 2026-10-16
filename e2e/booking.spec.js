// @ts-check
import { test, expect } from "@playwright/test";
import { buildMonthAvailability } from "../backend/lib/availability.js";

// Fotos, fuentes, Google Maps y analítica no influyen en la reserva y hacen el
// test lento e inestable: se cortan todas las peticiones fuera del servidor local.
test.beforeEach(async ({ page }) => {
  await page.route(/^https?:\/\/(?!127\.0\.0\.1[:/])/, (route) => route.abort());
});

/**
 * Sirve la disponibilidad con la lógica real del backend (horario de la clínica,
 * días pasados, domingos cerrados) pero sin reservas, para no depender de Supabase.
 * @param {import("@playwright/test").Page} page
 */
async function mockAvailability(page) {
  await page.route("**/api/availability?*", (route) => {
    const month = new URL(route.request().url()).searchParams.get("month") || "";
    return route.fulfill({ json: buildMonthAvailability(month, []) });
  });
}

/**
 * Abre la home, quita el aviso de cookies y deja elegido el primer hueco libre
 * del mes siguiente (siempre tiene días abiertos, sea cual sea la fecha de hoy).
 * @param {import("@playwright/test").Page} page
 */
async function openBookingAndPickFirstSlot(page) {
  await page.goto("/#reserva", { waitUntil: "domcontentloaded" });
  await page.locator("[data-cookie-accept]").click();

  const form = page.locator("[data-booking-form]");
  await form.locator("#servicio").selectOption("consulta");
  await form.locator("#mascota").selectOption("gato");

  // Hay que esperar a que se pinte el mes nuevo: si se elige un día del mes
  // anterior, la recarga del calendario borra la selección.
  const calendarTitle = form.locator("[data-calendar-title]");
  await expect(form.locator("[data-calendar-days] button").first()).toBeVisible();
  const currentMonth = await calendarTitle.textContent();
  await form.locator("[data-calendar-next]").click();
  await expect(calendarTitle).not.toHaveText(currentMonth || "");
  await expect(form.locator("[data-calendar-days] button").first()).toBeVisible();
  await form.locator("[data-calendar-days] button:enabled").first().click();
  await form.locator("[data-time-slots] button:enabled").first().click();

  await form.locator("#nombre").fill("Lucía Fernández");
  await form.locator("#telefono").fill("600 123 456");
  await form.locator("#motivo").fill("Revisión anual");
  return form;
}

test("reservar cita: el formulario envía los datos y muestra la confirmación", async ({ page }) => {
  await mockAvailability(page);

  /** @type {Record<string, unknown> | null} */
  let sentPayload = null;
  await page.route("**/api/reservations", (route) => {
    sentPayload = route.request().postDataJSON();
    return route.fulfill({
      status: 201,
      json: {
        ok: true,
        reservation: { id: "a1b2c3d4-0000-4000-8000-000000000000", ...sentPayload },
        email: { pending: false },
      },
    });
  });

  const form = await openBookingAndPickFirstSlot(page);
  await form.getByRole("button", { name: "Registrar solicitud" }).click();

  await expect(page.getByRole("heading", { name: "Reserva registrada" })).toBeVisible();
  await expect(page.getByText("A1B2C3D4")).toBeVisible();

  expect(sentPayload).toMatchObject({
    nombre: "Lucía Fernández",
    telefono: "600 123 456",
    mascota: "gato",
    servicio: "consulta",
    notes: "Revisión anual",
  });
  expect(sentPayload?.datetime).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
});

test("reservar cita: si el hueco se ocupa mientras tanto, pide elegir otro", async ({ page }) => {
  await mockAvailability(page);
  await page.route("**/api/reservations", (route) =>
    route.fulfill({ status: 409, json: { error: "Ese horario ya esta reservado. Elige otro hueco." } }),
  );

  const form = await openBookingAndPickFirstSlot(page);
  await form.getByRole("button", { name: "Registrar solicitud" }).click();

  await expect(form.locator("[data-booking-status]")).toContainText("Ese hueco acaba de reservarse. Elige otro.");
  await expect(page.getByRole("heading", { name: "Reserva registrada" })).toHaveCount(0);
});
