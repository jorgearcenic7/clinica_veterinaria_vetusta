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

if (bookingForm) {
  initBookingCalendar();
}

function initBookingCalendar() {
  previousButton.addEventListener("click", () => changeMonth(-1));
  nextButton.addEventListener("click", () => changeMonth(1));
  bookingForm.addEventListener("submit", submitBooking);
  document.addEventListener("vetusta:languagechange", renderBookingTexts);
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
  item.className = "min-h-16 bg-surface-container-lowest";
  return item;
}

function createDayButton(day) {
  const button = document.createElement("button");
  const isDisabled = day.isPast || !day.isOpen;
  const isSelected = bookingState.selectedDay?.date === day.date;

  button.type = "button";
  button.disabled = isDisabled;
  button.className = [
    "min-h-16 p-2 bg-surface-container-lowest text-left transition-colors flex flex-col justify-between",
    isSelected ? "ring-2 ring-primary bg-primary-fixed" : "",
    isDisabled ? "text-outline cursor-not-allowed bg-surface-container" : "hover:bg-primary-fixed text-on-background",
    day.fullyBooked && !isDisabled ? "bg-error-container text-on-error-container" : "",
  ].join(" ");

  const number = document.createElement("span");
  number.className = "font-bold";
  number.textContent = day.day;

  const label = document.createElement("span");
  label.className = "text-[11px]";
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
      "rounded-lg border px-3 py-3 text-sm font-label-caps transition-colors",
      slot.reserved ? "bg-error-container border-error text-on-error-container cursor-not-allowed" : "bg-white border-outline-variant text-primary hover:bg-primary-fixed",
      isSelected ? "ring-2 ring-primary bg-primary-fixed" : "",
    ].join(" ");
    button.textContent = slot.reserved ? `${slot.time} ${translate("booking.reserved")}` : slot.time;

    button.addEventListener("click", () => {
      bookingState.selectedSlot = slot;
      hiddenDateInput.value = slot.datetime;
      renderSlots();
      setStatus(`${translate("booking.selectedTime")} ${slot.time}.`);
    });

    timeSlots.append(button);
  });
}

function createMessage(text) {
  const message = document.createElement("p");
  message.className = "col-span-full text-sm text-on-surface-variant";
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

  setStatus(translate("booking.saved"));
  bookingForm.reset();
  await loadAvailability();
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
    item.className = "bg-surface-container-low py-2";
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

function parseDateKey(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
