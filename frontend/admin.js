import { formatDate, formToObject, friendlyError, logDocumentUpload, removePetDocumentFile, requireAdmin, setStatus, signedPetDocumentUrl, signedPetImageUrl, signOut, uploadPetDocumentFile, uploadPetImage, validateUploadFile } from "./supabase-client.js";

const statusEl = document.querySelector("[data-status]");
const clientsListEl = document.querySelector("[data-clients-list]");
const petsListEl = document.querySelector("[data-pets-list]");
const reservationsCalendarEl = document.querySelector("[data-reservations-calendar]");
const reservationDetailEl = document.querySelector("[data-reservation-detail]");
const calendarRangeEl = document.querySelector("[data-calendar-range]");
const calendarPrevButton = document.querySelector("[data-calendar-prev]");
const calendarNextButton = document.querySelector("[data-calendar-next]");
const clientDetailEl = document.querySelector("[data-client-detail]");
const recordsTitleEl = document.querySelector("[data-records-title]");
const recordsTableEl = document.querySelector("[data-records-table]");
const petForm = document.querySelector("[data-pet-form]");
const recordForm = document.querySelector("[data-record-form]");
const documentForm = document.querySelector("[data-document-form]");
const documentsTitleEl = document.querySelector("[data-documents-title]");
const documentsListEl = document.querySelector("[data-documents-list]");
const clearPetButton = document.querySelector("[data-clear-pet]");
const clearRecordButton = document.querySelector("[data-clear-record]");
const logoutButton = document.querySelector("[data-logout]");

let supabase = null;
let clients = [];
let pets = [];
let reservations = [];
let records = [];
let documents = [];
let selectedClientId = null;
let selectedPetId = null;
let selectedReservationId = null;
let visibleWeekStart = startOfWeek(new Date());

// Estado de paginación de clientes
let clientsPage = 1;
let clientsTotalPages = 1;
let clientsTotal = 0;
const CLIENTS_LIMIT = 20;

logoutButton.addEventListener("click", signOut);
calendarPrevButton.addEventListener("click", () => changeCalendarWeek(-1));
calendarNextButton.addEventListener("click", () => changeCalendarWeek(1));
clearPetButton.addEventListener("click", () => resetPetForm());
clearRecordButton.addEventListener("click", () => resetRecordForm());
petForm.addEventListener("submit", savePet);
recordForm.addEventListener("submit", saveRecord);
documentForm.addEventListener("submit", saveDocument);

initAdmin();

async function initAdmin() {
  try {
    const auth = await requireAdmin();

    if (!auth) {
      return;
    }

    supabase = auth.supabase;

    await loadAll();
    setStatus(statusEl, "");
  } catch (error) {
    setStatus(statusEl, error.message || "No se pudo cargar el panel admin.", true);
  }
}

async function loadAll() {
  setStatus(statusEl, "Cargando datos...");

  await loadClients(clientsPage);

  const [petsResult, reservationsResult, recordsResult, documentsResult] = await Promise.all([
    supabase.from("pets").select("id,owner_id,name,species,breed,birth_date,image_url,created_at").order("name", { ascending: true }),
    loadReservations(),
    supabase.from("pet_records").select("id,pet_id,title,record_type,record_date,notes,next_due_date,created_at").order("record_date", { ascending: false }),
    supabase.from("pet_documents").select("id,pet_id,uploaded_by,title,description,file_url,file_name,file_type,source,created_at").order("created_at", { ascending: false }),
  ]);

  [petsResult, reservationsResult, recordsResult, documentsResult].forEach((result) => {
    if (result.error) {
      throw result.error;
    }
  });

  pets = petsResult.data || [];
  reservations = reservationsResult.data || [];
  records = recordsResult.data || [];
  documents = documentsResult.data || [];
  selectedClientId = clients.some((client) => client.id === selectedClientId) ? selectedClientId : null;
  selectedPetId = pets.some((pet) => pet.id === selectedPetId && pet.owner_id === selectedClientId)
    ? selectedPetId
    : pets.find((pet) => pet.owner_id === selectedClientId)?.id || null;
  await render();
}

async function loadClients(page = 1) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;

  if (!token) {
    return;
  }

  const response = await fetch(
    `/api/admin/clients?page=${page}&limit=${CLIENTS_LIMIT}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || "No se pudieron cargar los clientes.");
  }

  clients = result.data || [];
  clientsPage = result.page || 1;
  clientsTotalPages = result.totalPages || 1;
  clientsTotal = result.total || 0;
}

async function render() {
  renderReservations();
  renderClients();
  renderClientDetailVisibility();

  if (!selectedClientId) {
    return;
  }

  await renderPets();
  renderRecords();
  await renderDocuments();
}

function renderClientDetailVisibility() {
  if (selectedClientId) {
    clientDetailEl.classList.remove("hidden");
    return;
  }

  clientDetailEl.classList.add("hidden");
  petsListEl.replaceChildren();
  recordsTableEl.replaceChildren();
  documentsListEl.replaceChildren();
}

function loadReservations() {
  const weekStart = toDateKey(visibleWeekStart);
  const weekEnd = toDateKey(addDays(visibleWeekStart, 7));
  return supabase
    .from("reservations")
    .select("*")
    .gte("datetime", weekStart)
    .lt("datetime", weekEnd)
    .order("datetime", { ascending: true });
}

function renderReservations() {
  reservationsCalendarEl.replaceChildren();
  calendarRangeEl.textContent = formatWeekRange(visibleWeekStart);

  const weekDays = Array.from({ length: 7 }, (_, index) => addDays(visibleWeekStart, index));
  const weekReservations = reservations.filter((reservation) => {
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

function createCalendarDay(day, weekReservations) {
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

function createCalendarEvent(reservation) {
  const status = reservation.status || "confirmed";
  const button = document.createElement("button");
  button.type = "button";
  button.className = `calendar-event calendar-event-${status} ${reservation.id === selectedReservationId ? "active" : ""}`;
  button.innerHTML = `
    <strong>${escapeHtml(formatReservationTitle(reservation))}</strong>
    <span>${escapeHtml(formatReservationService(reservation.servicio))}</span>
    <time>${escapeHtml(formatReservationTimeRange(reservation))}</time>
  `;
  button.addEventListener("click", () => {
    selectedReservationId = reservation.id;
    renderReservations();
  });

  return button;
}

function renderReservationDetail() {
  const reservation = reservations.find((item) => item.id === selectedReservationId);
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

function renderClients() {
  clientsListEl.replaceChildren();

  if (clients.length === 0) {
    clientsListEl.append(emptyMessage("No hay clientes registrados."));
  } else {
    clients.forEach((client) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `client-card ${client.id === selectedClientId ? "active" : ""}`;
      button.innerHTML = `
        <strong>${escapeHtml(client.full_name || "Sin nombre")}</strong>
        <span>${escapeHtml(client.phone || "Sin teléfono")}</span>
      `;
      button.addEventListener("click", () => {
        selectedClientId = client.id;
        selectedPetId = pets.find((pet) => pet.owner_id === selectedClientId)?.id || null;
        resetPetForm();
        resetRecordForm();
        resetDocumentForm();
        render();
      });
      clientsListEl.append(button);
    });
  }

  if (clientsTotalPages > 1) {
    clientsListEl.append(createClientsPagination());
  }
}

function createClientsPagination() {
  const nav = document.createElement("nav");
  nav.className = "pagination";
  nav.setAttribute("aria-label", "Paginación de clientes");

  const prevBtn = document.createElement("button");
  prevBtn.type = "button";
  prevBtn.className = "secondary";
  prevBtn.textContent = "Anterior";
  prevBtn.disabled = clientsPage <= 1;
  prevBtn.addEventListener("click", () => goToClientsPage(clientsPage - 1));

  const info = document.createElement("span");
  info.className = "pagination-info muted";
  info.textContent = `Página ${clientsPage} de ${clientsTotalPages} (${clientsTotal} clientes)`;

  const nextBtn = document.createElement("button");
  nextBtn.type = "button";
  nextBtn.className = "secondary";
  nextBtn.textContent = "Siguiente";
  nextBtn.disabled = clientsPage >= clientsTotalPages;
  nextBtn.addEventListener("click", () => goToClientsPage(clientsPage + 1));

  nav.append(prevBtn, info, nextBtn);
  return nav;
}

async function goToClientsPage(page) {
  try {
    setStatus(statusEl, "Cargando clientes...");
    await loadClients(page);
    setStatus(statusEl, "");
    renderClients();
  } catch (error) {
    setStatus(statusEl, "No se pudieron cargar los clientes.", true);
  }
}

async function renderPets() {
  petsListEl.replaceChildren();
  const clientPets = pets.filter((pet) => pet.owner_id === selectedClientId);

  if (!selectedClientId) {
    petsListEl.append(emptyMessage("Selecciona un cliente."));
    return;
  }

  if (clientPets.length === 0) {
    petsListEl.append(emptyMessage("Este cliente aún no tiene mascotas."));
    return;
  }

  let imageLoadError = false;
  const petsWithImages = await Promise.all(clientPets.map(async (pet) => {
    try {
      const signedImageUrl = await signedPetImageUrl(supabase, pet.image_url);
      imageLoadError = imageLoadError || Boolean(pet.image_url && !signedImageUrl);

      return {
        ...pet,
        signedImageUrl,
      };
    } catch (error) {
      console.warn("Pet image signed URL error:", error.message);
      imageLoadError = true;
      return { ...pet, signedImageUrl: "" };
    }
  }));

  petsWithImages.forEach((pet) => {
    const item = document.createElement("article");
    item.className = `list-item ${pet.id === selectedPetId ? "active" : ""}`;
    item.innerHTML = `
      <div class="row">
        <div>
          ${pet.signedImageUrl ? `<img class="pet-photo" src="${escapeHtml(pet.signedImageUrl)}" alt="Foto de ${escapeHtml(pet.name)}">` : ""}
          <strong>${escapeHtml(pet.name)}</strong>
          <div class="small muted">${escapeHtml([pet.species, pet.breed].filter(Boolean).join(" · ") || "Sin detalles")}</div>
          <div class="small muted">Nacimiento: ${formatDate(pet.birth_date)}</div>
        </div>
        <div class="nav-actions">
          <button class="secondary" type="button" data-select-pet="${pet.id}">Ver</button>
          <button class="secondary" type="button" data-edit-pet="${pet.id}">Editar</button>
          <button class="danger" type="button" data-delete-pet="${pet.id}">Eliminar</button>
        </div>
      </div>
    `;
    petsListEl.append(item);
  });

  if (imageLoadError) {
    setStatus(statusEl, "No se pudo cargar alguna imagen guardada. Vuelve a subir la foto para regenerarla.", true);
  }

  petsListEl.querySelectorAll("[data-select-pet]").forEach((button) => {
    button.addEventListener("click", () => {
      selectedPetId = button.dataset.selectPet;
      resetRecordForm();
      resetDocumentForm();
      render();
    });
  });

  petsListEl.querySelectorAll("[data-edit-pet]").forEach((button) => {
    button.addEventListener("click", () => fillPetForm(button.dataset.editPet));
  });

  petsListEl.querySelectorAll("[data-delete-pet]").forEach((button) => {
    button.addEventListener("click", () => deletePet(button.dataset.deletePet));
  });
}

function renderRecords() {
  recordsTableEl.replaceChildren();
  const pet = pets.find((item) => item.id === selectedPetId);

  recordsTitleEl.textContent = pet ? `Historial de ${pet.name}` : "Historial";

  if (!pet) {
    recordsTableEl.append(tableMessage("Selecciona una mascota."));
    return;
  }

  const petRecords = records.filter((record) => record.pet_id === pet.id);

  if (petRecords.length === 0) {
    recordsTableEl.append(tableMessage("No hay registros."));
    return;
  }

  petRecords.forEach((record) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${escapeHtml(record.title)}</td>
      <td>${escapeHtml(record.record_type || "General")}</td>
      <td>${formatDate(record.record_date)}</td>
      <td>${formatDate(record.next_due_date)}</td>
      <td>${escapeHtml(record.notes || "")}</td>
      <td>
        <div class="nav-actions">
          <button class="secondary" type="button" data-edit-record="${record.id}">Editar</button>
          <button class="danger" type="button" data-delete-record="${record.id}">Eliminar</button>
        </div>
      </td>
    `;
    recordsTableEl.append(row);
  });

  recordsTableEl.querySelectorAll("[data-edit-record]").forEach((button) => {
    button.addEventListener("click", () => fillRecordForm(button.dataset.editRecord));
  });

  recordsTableEl.querySelectorAll("[data-delete-record]").forEach((button) => {
    button.addEventListener("click", () => deleteRecord(button.dataset.deleteRecord));
  });
}

async function renderDocuments() {
  documentsListEl.replaceChildren();
  const pet = pets.find((item) => item.id === selectedPetId);
  documentsTitleEl.textContent = pet ? `Documentos de ${pet.name}` : "Documentos";

  if (!pet) {
    documentsListEl.append(emptyMessage("Selecciona una mascota."));
    return;
  }

  const petDocuments = documents.filter((documentItem) => documentItem.pet_id === pet.id);

  if (petDocuments.length === 0) {
    documentsListEl.append(emptyMessage("No hay documentos asociados."));
    return;
  }

  const documentsWithUrls = await Promise.all(petDocuments.map(async (documentItem) => ({
    ...documentItem,
    signedUrl: await signedPetDocumentUrl(supabase, documentItem.file_url),
  })));

  documentsWithUrls.forEach((documentItem) => {
    const item = document.createElement("article");
    item.className = "list-item";
    item.innerHTML = `
      <div class="row">
        <div>
          <strong>${escapeHtml(documentItem.title)}</strong>
          <div class="small muted">${escapeHtml(documentItem.file_name || "Documento")}</div>
        </div>
        <span class="badge">${documentItem.source === "clinic" ? "Clínica" : "Cliente"}</span>
      </div>
      ${documentItem.description ? `<p>${escapeHtml(documentItem.description)}</p>` : ""}
      <div class="row">
        <a class="button secondary" href="${escapeHtml(documentItem.signedUrl)}" target="_blank" rel="noopener">Ver documento</a>
        <button class="danger" type="button" data-delete-document="${documentItem.id}">Eliminar</button>
      </div>
    `;
    documentsListEl.append(item);
  });

  documentsListEl.querySelectorAll("[data-delete-document]").forEach((button) => {
    button.addEventListener("click", () => deleteDocument(button.dataset.deleteDocument));
  });
}

async function savePet(event) {
  event.preventDefault();

  const selectedClient = getSelectedClient();

  if (!selectedClient) {
    setStatus(statusEl, "Selecciona un cliente antes de guardar una mascota.", true);
    return;
  }

  const values = normalizeEmptyDates(formToObject(petForm));
  const imageFile = petForm.elements.image_file.files?.[0] || null;
  const payload = {
    owner_id: selectedClient.id,
    name: values.name,
    species: values.species || null,
    breed: values.breed || null,
    birth_date: values.birth_date || null,
  };

  try {
    setStatus(statusEl, "Guardando mascota...");
    const query = values.id
      ? supabase.from("pets").update(payload).eq("id", values.id).select("id").single()
      : supabase.from("pets").insert(payload).select("id").single();
    const { data, error } = await query;

    if (error) {
      throw error;
    }

    if (imageFile) {
      validateUploadFile(imageFile, "image");
      const petId = values.id || data.id;
      const imagePath = await uploadPetImage(supabase, selectedClient.id, petId, imageFile);
      const { error: imageError } = await supabase
        .from("pets")
        .update({ image_url: imagePath })
        .eq("id", petId);

      if (imageError) {
        console.error("update image_url error", imageError);
        throw imageError;
      }

      console.log("saved image_url", imagePath);
      selectedPetId = petId;
    }

    resetPetForm();
    await loadAll();
    setStatus(statusEl, "Mascota guardada.");
  } catch (error) {
    setStatus(statusEl, friendlyError(error) || "No se pudo guardar la mascota.", true);
  }
}

async function saveRecord(event) {
  event.preventDefault();

  if (!selectedPetId) {
    setStatus(statusEl, "Selecciona una mascota antes de guardar un registro.", true);
    return;
  }

  const values = normalizeEmptyDates(formToObject(recordForm));
  const payload = {
    pet_id: selectedPetId,
    title: values.title,
    record_type: values.record_type || null,
    record_date: values.record_date || null,
    notes: values.notes || null,
    next_due_date: values.next_due_date || null,
  };

  try {
    setStatus(statusEl, "Guardando registro...");
    const query = values.id
      ? supabase.from("pet_records").update(payload).eq("id", values.id)
      : supabase.from("pet_records").insert(payload);
    const { error } = await query;

    if (error) {
      throw error;
    }

    resetRecordForm();
    await loadAll();
    setStatus(statusEl, "Registro guardado.");
  } catch (error) {
    setStatus(statusEl, friendlyError(error) || "No se pudo guardar el registro.", true);
  }
}

async function saveDocument(event) {
  event.preventDefault();

  if (!selectedPetId) {
    setStatus(statusEl, "Selecciona una mascota antes de subir un documento.", true);
    return;
  }

  const values = formToObject(documentForm);
  const file = documentForm.file.files?.[0];

  if (!file) {
    setStatus(statusEl, "Selecciona un archivo.", true);
    return;
  }

  try {
    validateUploadFile(file, "document");
    setStatus(statusEl, "Subiendo documento oficial...");
    const uploaded = await uploadPetDocumentFile(supabase, selectedPetId, file);
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError) {
      throw userError;
    }

    const { data, error } = await supabase.from("pet_documents").insert({
      pet_id: selectedPetId,
      uploaded_by: userData.user.id,
      title: values.title,
      description: values.description || null,
      file_url: uploaded.fileUrl,
      file_name: file.name,
      file_type: file.type || null,
      source: "clinic",
    }).select("id,pet_id,uploaded_by,source").single();

    if (error) {
      throw error;
    }

    await logDocumentUpload(supabase, data, file);

    resetDocumentForm();
    await loadAll();
    setStatus(statusEl, "Documento oficial subido.");
  } catch (error) {
    setStatus(statusEl, friendlyError(error) || "No se pudo subir el documento.", true);
  }
}

async function updateReservationStatus(id, status) {
  try {
    setStatus(statusEl, "Actualizando reserva...");
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !sessionData.session?.access_token) {
      throw sessionError || new Error("Sesión no válida.");
    }

    const response = await fetch(`/api/admin/reservations/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${sessionData.session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || "No se pudo actualizar la reserva.");
    }

    await loadAll();
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

function formatReservationDateTime(value) {
  if (!value) {
    return "Sin fecha";
  }

  const [dateKey, time = ""] = String(value).split("T");
  const formattedDate = formatDate(dateKey);
  return time ? `${formattedDate} ${time}` : formattedDate;
}

function formatReservationService(value) {
  const labels = {
    consulta: "Consulta general",
    vacunacion: "Vacunación",
    cirugia: "Cirugía",
    peluqueria: "Peluquería",
    urgencia: "Urgencia",
  };

  return labels[value] || value || "Sin indicar";
}

function statusLabel(status) {
  const labels = {
    pending: "Pendiente",
    confirmed: "Confirmada",
    cancelled: "Cancelada",
  };

  return labels[status] || status;
}

function statusClass(status) {
  return `badge-${status || "confirmed"}`;
}

function syncStatusMarkup(reservation) {
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

async function changeCalendarWeek(offset) {
  try {
    visibleWeekStart = addDays(visibleWeekStart, offset * 7);
    setStatus(statusEl, "Cargando citas...");
    const reservationsResult = await loadReservations();

    if (reservationsResult.error) {
      throw reservationsResult.error;
    }

    reservations = reservationsResult.data || [];
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

function formatReservationTitle(reservation) {
  const petName = reservation.mascota || "Mascota";
  const clientName = reservation.nombre || "Cliente";
  return `${petName} (${clientName})`;
}

function formatReservationTimeRange(reservation) {
  const start = reservationStartTime(reservation);
  const end = reservationEndTime(reservation);
  return `${start} - ${end}`;
}

function formatWeekRange(startDate) {
  const endDate = addDays(startDate, 6);
  return `${formatDate(toDateKey(startDate))} - ${formatDate(toDateKey(endDate))}`;
}

function formatWeekday(date) {
  return new Intl.DateTimeFormat("es-ES", { weekday: "short" }).format(date);
}

function reservationDateKey(reservation) {
  return String(reservation.datetime || madridDateTimeParts(reservation.start_at).date || "").slice(0, 10);
}

function reservationStartTime(reservation) {
  if (reservation.datetime) {
    return String(reservation.datetime).slice(11, 16) || "00:00";
  }

  return madridDateTimeParts(reservation.start_at).time || "00:00";
}

function reservationEndTime(reservation) {
  if (reservation.datetime) {
    return addMinutesToTime(reservationStartTime(reservation), 30);
  }

  return madridDateTimeParts(reservation.end_at).time || addMinutesToTime(reservationStartTime(reservation), 30);
}

function reservationStartMinutes(reservation) {
  const [hours, minutes] = reservationStartTime(reservation).split(":").map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

function madridDateTimeParts(value) {
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

function addMinutesToTime(time, minutesToAdd) {
  const [hours, minutes] = time.split(":").map(Number);
  const total = (hours || 0) * 60 + (minutes || 0) + minutesToAdd;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function startOfWeek(date) {
  const weekStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const mondayOffset = (weekStart.getDay() + 6) % 7;
  weekStart.setDate(weekStart.getDate() - mondayOffset);
  return weekStart;
}

function addDays(date, days) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function toDateKey(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

async function deletePet(id) {
  if (!confirm("Se eliminara la mascota y todo su historial. Continuar?")) {
    return;
  }

  try {
    setStatus(statusEl, "Eliminando mascota...");
    const { error } = await supabase.from("pets").delete().eq("id", id);

    if (error) {
      throw error;
    }

    selectedPetId = null;
    await loadAll();
    setStatus(statusEl, "Mascota eliminada.");
  } catch (error) {
    setStatus(statusEl, friendlyError(error) || "No se pudo eliminar la mascota.", true);
  }
}

async function deleteRecord(id) {
  if (!confirm("Se eliminara este registro. Continuar?")) {
    return;
  }

  try {
    setStatus(statusEl, "Eliminando registro...");
    const { error } = await supabase.from("pet_records").delete().eq("id", id);

    if (error) {
      throw error;
    }

    await loadAll();
    setStatus(statusEl, "Registro eliminado.");
  } catch (error) {
    setStatus(statusEl, friendlyError(error) || "No se pudo eliminar el registro.", true);
  }
}

async function deleteDocument(id) {
  if (!confirm("Se eliminara este documento. Continuar?")) {
    return;
  }

  try {
    setStatus(statusEl, "Eliminando documento...");
    const documentItem = documents.find((item) => item.id === id);
    const { error } = await supabase.from("pet_documents").delete().eq("id", id);

    if (error) {
      throw error;
    }

    await removePetDocumentFile(supabase, documentItem?.file_url);

    await loadAll();
    setStatus(statusEl, "Documento eliminado.");
  } catch (error) {
    setStatus(statusEl, friendlyError(error) || "No se pudo eliminar el documento.", true);
  }
}

function getSelectedClient() {
  return clients.find((client) => client.id === selectedClientId && client.role === "client") || null;
}

function fillPetForm(id) {
  const pet = pets.find((item) => item.id === id);

  if (!pet) {
    return;
  }

  selectedPetId = pet.id;
  petForm.elements.id.value = pet.id;
  petForm.elements.name.value = pet.name || "";
  petForm.elements.species.value = pet.species || "";
  petForm.elements.breed.value = pet.breed || "";
  petForm.elements.birth_date.value = pet.birth_date || "";
  render();
}

function fillRecordForm(id) {
  const record = records.find((item) => item.id === id);

  if (!record) {
    return;
  }

  recordForm.elements.id.value = record.id;
  recordForm.elements.title.value = record.title || "";
  recordForm.elements.record_type.value = record.record_type || "Consulta";
  recordForm.elements.record_date.value = record.record_date || "";
  recordForm.elements.next_due_date.value = record.next_due_date || "";
  recordForm.elements.notes.value = record.notes || "";
}

function resetPetForm() {
  petForm.reset();
  petForm.elements.id.value = "";
}

function resetRecordForm() {
  recordForm.reset();
  recordForm.elements.id.value = "";
}

function resetDocumentForm() {
  documentForm.reset();
}

function normalizeEmptyDates(values) {
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value === "" ? null : value]));
}

function emptyMessage(text) {
  const item = document.createElement("p");
  item.className = "muted";
  item.textContent = text;
  return item;
}

function tableMessage(text, colSpan = 6) {
  const row = document.createElement("tr");
  const cell = document.createElement("td");
  cell.colSpan = colSpan;
  cell.className = "muted";
  cell.textContent = text;
  row.append(cell);
  return row;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
