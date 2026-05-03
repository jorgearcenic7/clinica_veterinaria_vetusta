const localeByLanguage = {
  es: "es-ES",
  en: "en-GB",
  fr: "fr-FR",
  pt: "pt-PT",
};

const bookingState = {
  visibleMonth: startOfMonth(new Date()),
  availability: null,
  selectedDay: null,
  selectedSlot: null,
};

const bookingForm = document.querySelector("[data-booking-form]");
const calendarTitle = document.querySelector("[data-calendar-title]");
const calendarWeekdays = document.querySelector("[data-calendar-weekdays]");
const calendarDays = document.querySelector("[data-calendar-days]");
const previousButton = document.querySelector("[data-calendar-prev]");
const nextButton = document.querySelector("[data-calendar-next]");
const selectedDateTitle = document.querySelector("[data-selected-date-title]");
const timeSlots = document.querySelector("[data-time-slots]");
const bookingStatus = document.querySelector("[data-booking-status]");
const hiddenDateInput = document.querySelector("#fecha");
const selectedTimeStatus = document.querySelector("[data-selected-time-status]");
const confirmationContainer = document.querySelector("[data-booking-confirmation]");
const emailCopyToggle = document.querySelector("[data-email-copy-toggle]");
const emailFieldWrapper = document.querySelector("[data-email-field-wrapper]");
const emailInput = document.querySelector("[data-email-input]");

if (bookingForm) {
  initBookingCalendar();
}

function initBookingCalendar() {
  previousButton.addEventListener("click", () => changeMonth(-1));
  nextButton.addEventListener("click", () => changeMonth(1));
  bookingForm.addEventListener("submit", submitBooking);
  emailCopyToggle?.addEventListener("change", updateEmailField);
  confirmationContainer?.addEventListener("click", handleConfirmationAction);
  document.addEventListener("vetusta:languagechange", renderBookingTexts);
  updateEmailField();
  loadAvailability();
}

function currentLanguage() {
  return window.VetustaI18n?.getLanguage?.() || "es";
}

function translate(key) {
  return window.VetustaI18n?.t?.(key) || key;
}

function currentLocale() {
  return localeByLanguage[currentLanguage()] || localeByLanguage.es;
}

async function loadAvailability() {
  setStatus(translate("booking.loading"));
  const monthKey = toMonthKey(bookingState.visibleMonth);

  try {
    const response = await fetch(`/api/availability?month=${monthKey}`);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || errorData.error || `Error ${response.status}`);
    }

    bookingState.availability = await response.json();
  } catch (error) {
    console.error("Availability load error:", error);
    setStatus(`${translate("booking.loadError")} ${error.message}`);
    return;
  }

  bookingState.selectedDay = null;
  bookingState.selectedSlot = null;
  hiddenDateInput.value = "";
  renderCalendar();
  renderSlots();
  setStatus("");
}

function renderCalendar() {
  renderWeekdays();

  const year = bookingState.visibleMonth.getFullYear();
  const month = bookingState.visibleMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const mondayOffset = (firstDay.getDay() + 6) % 7;
  const cells = [];

  calendarTitle.textContent = capitalize(new Intl.DateTimeFormat(currentLocale(), {
    month: "long",
    year: "numeric",
  }).format(bookingState.visibleMonth));

  for (let index = 0; index < mondayOffset; index += 1) {
    cells.push(createEmptyDay());
  }

  bookingState.availability.days.forEach((day) => {
    cells.push(createDayButton(day));
  });

  while (cells.length % 7 !== 0) {
    cells.push(createEmptyDay());
  }

  calendarDays.replaceChildren(...cells);
}

function createEmptyDay() {
  const item = document.createElement("div");
  item.className = "min-h-[96px] rounded-xl bg-surface-container-low opacity-60";
  return item;
}

function createDayButton(day) {
  const button = document.createElement("button");
  const isDisabled = day.isPast || !day.isOpen;
  const isSelected = bookingState.selectedDay?.date === day.date;
  const isToday = day.date === toDateKey(new Date());

  button.type = "button";
  button.disabled = isDisabled;
  button.className = [
    "min-h-[96px] rounded-xl border p-4 text-left transition-all flex flex-col justify-between",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
    isSelected ? "border-primary bg-primary text-white shadow-lg shadow-primary/20 scale-[1.01]" : "",
    !isSelected && !isDisabled ? "border-outline-variant bg-white text-on-background hover:border-primary hover:bg-primary-fixed hover:-translate-y-0.5" : "",
    isDisabled ? "border-surface-container bg-surface-container text-outline cursor-not-allowed" : "",
    day.fullyBooked && !isDisabled && !isSelected ? "border-error/40 bg-error-container text-on-error-container" : "",
  ].join(" ");

  const number = document.createElement("span");
  number.className = [
    "text-[26px] leading-none font-bold",
    isToday && !isSelected ? "text-primary" : "",
  ].join(" ");
  number.textContent = day.day;

  const label = document.createElement("span");
  label.className = [
    "w-fit rounded-full px-3 py-1 text-[12px] font-label-caps",
    isSelected ? "bg-white/15 text-white" : "",
    !isSelected && !isDisabled && !day.fullyBooked ? "bg-primary-fixed text-primary" : "",
    !isSelected && isDisabled ? "bg-white/60 text-outline" : "",
    !isSelected && day.fullyBooked && !isDisabled ? "bg-error text-white" : "",
  ].join(" ");
  label.textContent = day.isPast
    ? translate("booking.past")
    : day.fullyBooked
      ? translate("booking.full")
      : day.isOpen
        ? translate("booking.free")
        : translate("booking.closed");

  button.append(number, label);
  button.addEventListener("click", () => {
    bookingState.selectedDay = day;
    bookingState.selectedSlot = null;
    hiddenDateInput.value = "";
    renderCalendar();
    renderSlots();
  });

  return button;
}

function renderSlots() {
  timeSlots.replaceChildren();
  renderSelectedTimeStatus();

  if (!bookingState.selectedDay) {
    selectedDateTitle.textContent = translate("booking.chooseDay");
    timeSlots.append(createMessage(translate("booking.selectAvailable")));
    return;
  }

  selectedDateTitle.textContent = capitalize(new Intl.DateTimeFormat(currentLocale(), {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(parseDateKey(bookingState.selectedDay.date)));

  if (bookingState.selectedDay.slots.length === 0) {
    timeSlots.append(createMessage(translate("booking.clinicClosed")));
    return;
  }

  bookingState.selectedDay.slots.forEach((slot) => {
    const button = document.createElement("button");
    const isSelected = bookingState.selectedSlot?.datetime === slot.datetime;

    button.type = "button";
    button.disabled = slot.reserved;
    button.className = [
      "rounded-xl border px-4 py-4 text-base font-label-caps transition-all",
      slot.reserved ? "bg-error-container border-error/40 text-on-error-container cursor-not-allowed" : "bg-white border-outline-variant text-primary hover:border-primary hover:bg-primary-fixed hover:-translate-y-0.5",
      isSelected ? "!bg-primary !text-white !border-primary ring-2 ring-primary shadow-md shadow-primary/20 scale-[1.02]" : "",
    ].join(" ");
    button.textContent = slot.reserved ? `${slot.time} ${translate("booking.reserved")}` : slot.time;

    button.addEventListener("click", () => {
      bookingState.selectedSlot = slot;
      hiddenDateInput.value = slot.datetime;
      renderSlots();
      setStatus("");
    });

    timeSlots.append(button);
  });
}

function renderSelectedTimeStatus() {
  if (!selectedTimeStatus) {
    return;
  }

  if (!bookingState.selectedSlot) {
    selectedTimeStatus.textContent = "Selecciona una hora disponible para continuar.";
    selectedTimeStatus.className = "rounded-xl bg-surface-container-low p-4 text-sm font-label-caps text-primary";
    return;
  }

  selectedTimeStatus.textContent = `Hora seleccionada: ${bookingState.selectedSlot.time}`;
  selectedTimeStatus.className = "rounded-xl bg-primary p-4 text-sm font-label-caps text-white";
}

function createMessage(text) {
  const message = document.createElement("p");
  message.className = "col-span-full rounded-xl bg-surface-container-low p-4 text-sm text-on-surface-variant";
  message.textContent = text;
  return message;
}

async function submitBooking(event) {
  event.preventDefault();

  if (!bookingState.selectedSlot) {
    setStatus(translate("booking.selectSlot"));
    return;
  }

  const formData = new FormData(bookingForm);
  const payload = {
    nombre: formData.get("nombre"),
    telefono: formData.get("telefono"),
    email: formData.get("email"),
    emailCopy: formData.get("email_copy") === "on",
    mascota: formData.get("mascota"),
    servicio: formData.get("servicio"),
    datetime: bookingState.selectedSlot.datetime,
  };

  setStatus(translate("booking.saving"));
  const response = await fetch("/api/reservations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (response.status === 409) {
    setStatus(translate("booking.slotTaken"));
    await loadAvailability();
    return;
  }

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    setStatus(data.error || translate("booking.saveError"));
    return;
  }

  const data = await response.json();
  showBookingConfirmation(data.reservation, data.email);
  bookingForm.reset();
  updateEmailField();
  await loadAvailability();
}

function updateEmailField() {
  if (!emailCopyToggle || !emailFieldWrapper || !emailInput) {
    return;
  }

  const enabled = emailCopyToggle.checked;
  emailFieldWrapper.classList.toggle("hidden", !enabled);
  emailFieldWrapper.classList.toggle("flex", enabled);
  emailInput.required = enabled;

  if (!enabled) {
    emailInput.value = "";
  }
}

function showBookingConfirmation(reservation, emailResult = {}) {
  if (!confirmationContainer) {
    setStatus(translate("booking.saved"));
    return;
  }

  const code = reservation?.code || String(reservation?.id || "").slice(0, 8).toUpperCase();
  const emailMessage = emailResult?.pending
    ? `<p class="rounded-lg bg-tertiary-fixed/40 p-3 text-sm text-on-surface-variant">${emailResult.message || "Reserva creada. El envío por email está pendiente de configuración."}</p>`
    : "";

  confirmationContainer.innerHTML = `
    <article class="mx-auto max-w-[720px] overflow-hidden rounded-2xl border border-outline-variant bg-white soft-shadow">
      <div class="bg-primary px-8 py-7 text-white">
        <p class="font-label-caps text-label-caps text-white/80">Clínica Veterinaria Vetusta</p>
        <h3 class="mt-2 font-h2 text-[32px] leading-tight">Gracias, ${escapeHtml(reservation?.nombre || "cliente")}, tu reserva está solicitada</h3>
      </div>
      <div class="grid gap-5 p-8">
        <div class="rounded-xl bg-primary-fixed/60 p-4">
          <p class="text-sm font-label-caps text-primary">Código de reserva</p>
          <p class="font-h3 text-[28px] text-primary">${escapeHtml(code)}</p>
        </div>
        <dl class="grid gap-3 text-on-surface-variant sm:grid-cols-2">
          <div><dt class="font-label-caps text-primary">Fecha y hora</dt><dd>${escapeHtml(formatSelectedDateTime(reservation?.datetime))}</dd></div>
          <div><dt class="font-label-caps text-primary">Mascota</dt><dd>${escapeHtml(formatPetType(reservation?.mascota))}</dd></div>
          <div><dt class="font-label-caps text-primary">Servicio</dt><dd>${escapeHtml(formatService(reservation?.servicio))}</dd></div>
          <div><dt class="font-label-caps text-primary">Teléfono clínica</dt><dd>985 20 65 58</dd></div>
        </dl>
        <p class="text-on-surface-variant">Te contactaremos lo antes posible para confirmar definitivamente la cita.</p>
        ${emailMessage}
        <div class="flex flex-col gap-3 sm:flex-row">
          <a class="button-like flex-1 rounded-lg bg-primary px-6 py-4 text-center font-label-caps text-white" href="#inicio" data-confirmation-home>Volver a la web</a>
          <button class="flex-1 rounded-lg border border-primary bg-white px-6 py-4 font-label-caps text-primary" type="button" data-new-booking>Nueva reserva</button>
        </div>
      </div>
    </article>
  `;
  confirmationContainer.classList.remove("hidden");
  bookingForm.classList.add("hidden");
  setStatus("");
  confirmationContainer.scrollIntoView({ behavior: "smooth", block: "start" });
}

function handleConfirmationAction(event) {
  if (event.target.closest("[data-new-booking]")) {
    confirmationContainer.classList.add("hidden");
    confirmationContainer.replaceChildren();
    bookingForm.classList.remove("hidden");
    bookingState.selectedDay = null;
    bookingState.selectedSlot = null;
    hiddenDateInput.value = "";
    renderCalendar();
    renderSlots();
    bookingForm.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function changeMonth(offset) {
  bookingState.visibleMonth = new Date(
    bookingState.visibleMonth.getFullYear(),
    bookingState.visibleMonth.getMonth() + offset,
    1,
  );
  loadAvailability();
}

function renderWeekdays() {
  const weekdayLabels = translate("booking.weekdays");
  calendarWeekdays.replaceChildren(...weekdayLabels.map((label) => {
    const item = document.createElement("div");
    item.className = "rounded-lg bg-surface-container-low py-2";
    item.textContent = label;
    return item;
  }));
}

function renderBookingTexts() {
  if (!bookingState.availability) {
    return;
  }

  renderCalendar();
  renderSlots();
}

function setStatus(message) {
  bookingStatus.textContent = message;
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function toMonthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function toDateKey(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function parseDateKey(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function formatSelectedDateTime(datetime) {
  if (!datetime) {
    return "Sin fecha";
  }

  const [dateKey, time] = datetime.split("T");
  const date = parseDateKey(dateKey);
  const dateLabel = new Intl.DateTimeFormat(currentLocale(), {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);

  return `${capitalize(dateLabel)} · ${time}`;
}

function formatPetType(value) {
  const labels = {
    perro: "Perro",
    gato: "Gato",
    otro: "Otro",
  };

  return labels[value] || value || "Sin indicar";
}

function formatService(value) {
  const labels = {
    consulta: "Consulta general",
    vacunacion: "Vacunación",
    cirugia: "Cirugía",
    peluqueria: "Peluquería",
    urgencia: "Urgencia",
  };

  return labels[value] || value || "Sin indicar";
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
