import { requireAdmin, setStatus, signOut } from "./supabase-client.js";
import { state, cb, statusEl, calendarPrevButton, calendarNextButton, clearPetButton, clearRecordButton, petForm, recordForm, documentForm, logoutButton } from "./modules/admin/state.js";
import { startOfWeek } from "./modules/admin/utils.js";
import { loadClients, renderClients, renderClientDetailVisibility } from "./modules/admin/clients.js";
import { loadReservations, renderReservations, changeCalendarWeek } from "./modules/admin/reservations.js";
import { renderPets, savePet, resetPetForm } from "./modules/admin/pets.js";
import { renderRecords, saveRecord, resetRecordForm } from "./modules/admin/records.js";
import { renderDocuments, saveDocument } from "./modules/admin/documents.js";

state.visibleWeekStart = startOfWeek(new Date());

cb.render = render;
cb.loadAll = loadAll;

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

    state.supabase = auth.supabase;

    await loadAll();
    setStatus(statusEl, "");
  } catch (error) {
    setStatus(statusEl, error.message || "No se pudo cargar el panel admin.", true);
  }
}

async function loadAll() {
  setStatus(statusEl, "Cargando datos...");

  await loadClients(state.clientsPage);

  const [petsResult, reservationsResult, recordsResult, documentsResult] = await Promise.all([
    state.supabase.from("pets").select("id,owner_id,name,species,breed,birth_date,image_url,created_at").order("name", { ascending: true }),
    loadReservations(),
    state.supabase.from("pet_records").select("id,pet_id,title,record_type,record_date,notes,next_due_date,created_at").order("record_date", { ascending: false }),
    state.supabase.from("pet_documents").select("id,pet_id,uploaded_by,title,description,file_url,file_name,file_type,source,created_at").order("created_at", { ascending: false }),
  ]);

  [petsResult, reservationsResult, recordsResult, documentsResult].forEach((result) => {
    if (result.error) {
      throw result.error;
    }
  });

  state.pets = petsResult.data || [];
  state.reservations = reservationsResult.data || [];
  state.records = recordsResult.data || [];
  state.documents = documentsResult.data || [];
  state.selectedClientId = state.clients.some((client) => client.id === state.selectedClientId) ? state.selectedClientId : null;
  state.selectedPetId = state.pets.some((pet) => pet.id === state.selectedPetId && pet.owner_id === state.selectedClientId)
    ? state.selectedPetId
    : state.pets.find((pet) => pet.owner_id === state.selectedClientId)?.id || null;
  await render();
}

async function render() {
  renderReservations();
  renderClients();
  renderClientDetailVisibility();

  if (!state.selectedClientId) {
    return;
  }

  await renderPets();
  renderRecords();
  await renderDocuments();
}
