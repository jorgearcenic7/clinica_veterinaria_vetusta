import { calculateAge, escapeHtml, formatDate, friendlyError, requireSession, setStatus, signedPetDocumentUrl, signedPetImageUrl, signOut, todayKey, uploadPetImage, validateUploadFile } from "./supabase-client.js";

const statusEl = document.querySelector("[data-status]");
const petCardEl = document.querySelector("[data-pet-card]");
const upcomingListEl = document.querySelector("[data-upcoming-list]");
const recordsListEl = document.querySelector("[data-records-list]");
const documentsListEl = document.querySelector("[data-documents-list]");
const logoutButton = document.querySelector("[data-logout]");
const petId = window.location.pathname.split("/").filter(Boolean).pop();

let supabase = null;
let session = null;
let pet = null;
let records = [];
let documents = [];

logoutButton.addEventListener("click", signOut);
initPetDetail();

async function initPetDetail() {
  try {
    const auth = await requireSession();

    if (!auth) {
      return;
    }

    supabase = auth.supabase;
    session = auth.session;
    await loadPetData();
    setStatus(statusEl, "");
  } catch (error) {
    setStatus(statusEl, error.message || "No se pudo cargar la ficha.", true);
  }
}

async function loadPetData() {
  setStatus(statusEl, "Cargando ficha...");
  const [petResult, recordsResult, documentsResult] = await Promise.all([
    supabase.from("pets").select("id,owner_id,name,species,breed,birth_date,image_url,created_at").eq("id", petId).single(),
    supabase.from("pet_records").select("id,pet_id,title,record_type,record_date,notes,next_due_date,created_at").eq("pet_id", petId).order("record_date", { ascending: false }),
    supabase.from("pet_documents").select("id,pet_id,uploaded_by,title,description,file_url,file_name,file_type,source,created_at").eq("pet_id", petId).order("created_at", { ascending: false }),
  ]);

  if (petResult.error) {
    throw petResult.error;
  }

  if (recordsResult.error) {
    throw recordsResult.error;
  }

  if (documentsResult.error) {
    throw documentsResult.error;
  }

  pet = petResult.data;
  records = recordsResult.data || [];
  documents = documentsResult.data || [];
  await render();
}

async function render() {
  await renderPet();
  renderRecords();
  await renderDocuments();
}

async function renderPet() {
  let imageUrl = "";

  try {
    imageUrl = await signedPetImageUrl(supabase, pet.image_url);
  } catch (error) {
    console.error("signed url error", error);
    setStatus(statusEl, "No se pudo cargar la imagen. Vuelve a subir la foto.", true);
  }

  petCardEl.innerHTML = `
    ${imageUrl ? `<img class="pet-photo" src="${escapeHtml(imageUrl)}" alt="Foto de ${escapeHtml(pet.name)}">` : `<div class="pet-photo placeholder" aria-hidden="true">${escapeHtml(pet.name.slice(0, 1).toUpperCase())}</div>`}
    <div class="row">
      <label class="button secondary">
        Cambiar foto
        <input class="hidden" type="file" accept="image/jpeg,image/png,image/webp" data-image-input="${pet.id}" data-owner-id="${pet.owner_id}">
      </label>
    </div>
    <h1 class="page-title">${escapeHtml(pet.name)}</h1>
    <p class="muted">${escapeHtml([pet.species, pet.breed].filter(Boolean).join(" · ") || "Sin detalles")}</p>
    <p><strong>Fecha de nacimiento:</strong> ${formatDate(pet.birth_date)}</p>
    <p><strong>Edad:</strong> ${calculateAge(pet.birth_date)}</p>
  `;

  petCardEl.querySelector("[data-image-input]").addEventListener("change", changeImage);
}

async function changeImage(event) {
  const input = event.target;
  const file = input.files?.[0];

  if (!file) {
    return;
  }

  try {
    validateUploadFile(file, "image");
    setStatus(statusEl, "Subiendo imagen...");
    const imagePath = await uploadPetImage(supabase, session.user.id, pet.id, file);
    const { error } = await supabase
      .from("pets")
      .update({ image_url: imagePath })
      .eq("id", pet.id)
      .eq("owner_id", session.user.id);

    if (error) {
      console.error("update image_url error", error);
      throw error;
    }

    console.log("saved image_url", imagePath);
    await loadPetData();
    setStatus(statusEl, "Imagen actualizada.");
  } catch (error) {
    setStatus(statusEl, friendlyError(error) || "No se pudo subir la imagen.", true);
  } finally {
    input.value = "";
  }
}

function renderRecords() {
  recordsListEl.replaceChildren();
  upcomingListEl.replaceChildren();

  const upcoming = records
    .filter((record) => record.next_due_date && record.next_due_date >= todayKey())
    .sort((a, b) => a.next_due_date.localeCompare(b.next_due_date));

  if (upcoming.length === 0) {
    upcomingListEl.append(emptyMessage("No hay proximas fechas registradas."));
  } else {
    upcoming.forEach((record) => upcomingListEl.append(recordCard(record, true)));
  }

  if (records.length === 0) {
    recordsListEl.append(emptyMessage("No hay historial oficial registrado."));
  } else {
    records.forEach((record) => recordsListEl.append(recordCard(record, false)));
  }
}

async function renderDocuments() {
  documentsListEl.replaceChildren();

  if (documents.length === 0) {
    documentsListEl.append(emptyMessage("No hay documentos asociados a esta mascota."));
    return;
  }

  const documentsWithUrls = await Promise.all(documents.map(async (documentItem) => ({
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
        <span class="badge">${documentItem.source === "clinic" ? "Clinica" : "Cliente"}</span>
      </div>
      ${documentItem.description ? `<p>${escapeHtml(documentItem.description)}</p>` : ""}
      <div class="row">
        <a class="button secondary" href="${escapeHtml(documentItem.signedUrl)}" target="_blank" rel="noopener">Ver documento</a>
      </div>
    `;
    documentsListEl.append(item);
  });
}

function recordCard(record, showDueDate) {
  const item = document.createElement("article");
  item.className = "list-item";
  item.innerHTML = `
    <div class="row">
      <strong>${escapeHtml(record.title)}</strong>
      <span class="small muted">${escapeHtml(record.record_type || "General")}</span>
    </div>
    <div class="small muted">Fecha: ${formatDate(record.record_date)}</div>
    ${showDueDate ? `<div class="small"><strong>Proxima fecha:</strong> ${formatDate(record.next_due_date)}</div>` : ""}
    ${record.notes ? `<p>${escapeHtml(record.notes)}</p>` : ""}
  `;
  return item;
}

function emptyMessage(text) {
  const item = document.createElement("p");
  item.className = "muted";
  item.textContent = text;
  return item;
}
