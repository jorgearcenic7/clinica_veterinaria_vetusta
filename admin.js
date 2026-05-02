import { formatDate, formToObject, friendlyError, logDocumentUpload, removePetDocumentFile, requireAdmin, setStatus, signedPetDocumentUrl, signedPetImageUrl, signOut, uploadPetDocumentFile, uploadPetImage, validateUploadFile } from "./supabase-client.js";

const statusEl = document.querySelector("[data-status]");
const clientsListEl = document.querySelector("[data-clients-list]");
const petsListEl = document.querySelector("[data-pets-list]");
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
let records = [];
let documents = [];
let selectedClientId = null;
let selectedPetId = null;

logoutButton.addEventListener("click", signOut);
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

  const [clientsResult, petsResult, recordsResult, documentsResult] = await Promise.all([
    supabase.from("profiles").select("id,full_name,phone,role,created_at").eq("role", "client").order("created_at", { ascending: false }),
    supabase.from("pets").select("id,owner_id,name,species,breed,birth_date,image_url,created_at").order("name", { ascending: true }),
    supabase.from("pet_records").select("id,pet_id,title,record_type,record_date,notes,next_due_date,created_at").order("record_date", { ascending: false }),
    supabase.from("pet_documents").select("id,pet_id,uploaded_by,title,description,file_url,file_name,file_type,source,created_at").order("created_at", { ascending: false }),
  ]);

  [clientsResult, petsResult, recordsResult, documentsResult].forEach((result) => {
    if (result.error) {
      throw result.error;
    }
  });

  clients = clientsResult.data || [];
  pets = petsResult.data || [];
  records = recordsResult.data || [];
  documents = documentsResult.data || [];
  selectedClientId = clients.some((client) => client.id === selectedClientId) ? selectedClientId : clients[0]?.id || null;
  selectedPetId = pets.some((pet) => pet.id === selectedPetId && pet.owner_id === selectedClientId)
    ? selectedPetId
    : pets.find((pet) => pet.owner_id === selectedClientId)?.id || null;
  await render();
}

async function render() {
  renderClients();
  await renderPets();
  renderRecords();
  await renderDocuments();
}

function renderClients() {
  clientsListEl.replaceChildren();

  if (clients.length === 0) {
    clientsListEl.append(emptyMessage("No hay clientes registrados."));
    return;
  }

  clients.forEach((client) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `list-item ${client.id === selectedClientId ? "active" : ""}`;
    button.innerHTML = `
      <strong>${escapeHtml(client.full_name || "Sin nombre")}</strong>
      <div class="small muted">${escapeHtml(client.phone || "Sin telefono")}</div>
      <div class="small muted">${escapeHtml(client.role)}</div>
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

async function renderPets() {
  petsListEl.replaceChildren();
  const clientPets = pets.filter((pet) => pet.owner_id === selectedClientId);

  if (!selectedClientId) {
    petsListEl.append(emptyMessage("Selecciona un cliente."));
    return;
  }

  if (clientPets.length === 0) {
    petsListEl.append(emptyMessage("Este cliente aun no tiene mascotas."));
    return;
  }

  const petsWithImages = await Promise.all(clientPets.map(async (pet) => ({
    ...pet,
    signedImageUrl: await signedPetImageUrl(supabase, pet.image_url),
  })));

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
  const imageFile = petForm.image_file.files?.[0];
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
      const imageUrl = await uploadPetImage(supabase, petId, imageFile);
      const { error: imageError } = await supabase.rpc("set_pet_image", {
        pet_id: petId,
        image_url: imageUrl,
      });

      if (imageError) {
        throw imageError;
      }
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
  petForm.id.value = pet.id;
  petForm.name.value = pet.name || "";
  petForm.species.value = pet.species || "";
  petForm.breed.value = pet.breed || "";
  petForm.birth_date.value = pet.birth_date || "";
  render();
}

function fillRecordForm(id) {
  const record = records.find((item) => item.id === id);

  if (!record) {
    return;
  }

  recordForm.id.value = record.id;
  recordForm.title.value = record.title || "";
  recordForm.record_type.value = record.record_type || "Consulta";
  recordForm.record_date.value = record.record_date || "";
  recordForm.next_due_date.value = record.next_due_date || "";
  recordForm.notes.value = record.notes || "";
}

function resetPetForm() {
  petForm.reset();
  petForm.id.value = "";
}

function resetRecordForm() {
  recordForm.reset();
  recordForm.id.value = "";
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

function tableMessage(text) {
  const row = document.createElement("tr");
  const cell = document.createElement("td");
  cell.colSpan = 6;
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
