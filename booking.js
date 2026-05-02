const weekdayLabels = ["L", "M", "X", "J", "V", "S", "D"];
const monthFormatter = new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" });
const dateFormatter = new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long" });

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
  calendarWeekdays.replaceChildren(...weekdayLabels.map((label) => {
    const item = document.createElement("div");
    item.className = "bg-surface-container-low py-2";
    item.textContent = label;
    return item;
  }));

  previousButton.addEventListener("click", () => changeMonth(-1));
  nextButton.addEventListener("click", () => changeMonth(1));
  bookingForm.addEventListener("submit", submitBooking);
  loadAvailability();
}

async function loadAvailability() {
  setStatus("Cargando disponibilidad...");
  const monthKey = toMonthKey(bookingState.visibleMonth);

  try {
    const response = await fetch(`/api/availability?month=${monthKey}`);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Error ${response.status}`);
    }

    bookingState.availability = await response.json();
  } catch (error) {
    console.error("Availability load error:", error);
    setStatus(`No se pudo cargar la disponibilidad: ${error.message}`);
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
  const year = bookingState.visibleMonth.getFullYear();
  const month = bookingState.visibleMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const mondayOffset = (firstDay.getDay() + 6) % 7;
  const cells = [];

  calendarTitle.textContent = capitalize(monthFormatter.format(bookingState.visibleMonth));

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
  label.textContent = day.isPast ? "Pasado" : day.fullyBooked ? "Completo" : day.isOpen ? "Libre" : "Cerrado";

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
    selectedDateTitle.textContent = "Elige un día";
    timeSlots.append(createMessage("Selecciona un día disponible en el calendario."));
    return;
  }

  selectedDateTitle.textContent = capitalize(dateFormatter.format(parseDateKey(bookingState.selectedDay.date)));

  if (bookingState.selectedDay.slots.length === 0) {
    timeSlots.append(createMessage("La clínica está cerrada este día."));
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
    button.textContent = slot.reserved ? `${slot.time} reservado` : slot.time;

    button.addEventListener("click", () => {
      bookingState.selectedSlot = slot;
      hiddenDateInput.value = slot.datetime;
      renderSlots();
      setStatus(`Hora seleccionada: ${slot.time}.`);
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
    setStatus("Elige un día y una hora disponibles.");
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

  setStatus("Guardando reserva...");
  const response = await fetch("/api/reservations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (response.status === 409) {
    setStatus("Ese hueco acaba de reservarse. Elige otro.");
    await loadAvailability();
    return;
  }

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    setStatus(data.error || "No se pudo guardar la reserva.");
    return;
  }

  setStatus("Reserva guardada. Te confirmaremos la cita lo antes posible.");
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
