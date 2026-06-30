import { state, cb, statusEl, recordForm, recordsTitleEl, recordsTableEl } from "./state.js";
import { escapeHtml, tableMessage, normalizeEmptyDates } from "./utils.js";
import { setStatus, friendlyError, formToObject, formatDate } from "../../supabase-client.js";

export function renderRecords() {
  recordsTableEl.replaceChildren();
  const pet = state.pets.find((item) => item.id === state.selectedPetId);

  recordsTitleEl.textContent = pet ? `Historial de ${pet.name}` : "Historial";

  if (!pet) {
    recordsTableEl.append(tableMessage("Selecciona una mascota."));
    return;
  }

  const petRecords = state.records.filter((record) => record.pet_id === pet.id);

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

export async function saveRecord(event) {
  event.preventDefault();

  if (!state.selectedPetId) {
    setStatus(statusEl, "Selecciona una mascota antes de guardar un registro.", true);
    return;
  }

  const values = normalizeEmptyDates(formToObject(recordForm));
  const payload = {
    pet_id: state.selectedPetId,
    title: values.title,
    record_type: values.record_type || null,
    record_date: values.record_date || null,
    notes: values.notes || null,
    next_due_date: values.next_due_date || null,
  };

  try {
    setStatus(statusEl, "Guardando registro...");
    const query = values.id
      ? state.supabase.from("pet_records").update(payload).eq("id", values.id)
      : state.supabase.from("pet_records").insert(payload);
    const { error } = await query;

    if (error) {
      throw error;
    }

    resetRecordForm();
    await cb.loadAll();
    setStatus(statusEl, "Registro guardado.");
  } catch (error) {
    setStatus(statusEl, friendlyError(error) || "No se pudo guardar el registro.", true);
  }
}

export async function deleteRecord(id) {
  if (!confirm("Se eliminara este registro. Continuar?")) {
    return;
  }

  try {
    setStatus(statusEl, "Eliminando registro...");
    const { error } = await state.supabase.from("pet_records").delete().eq("id", id);

    if (error) {
      throw error;
    }

    await cb.loadAll();
    setStatus(statusEl, "Registro eliminado.");
  } catch (error) {
    setStatus(statusEl, friendlyError(error) || "No se pudo eliminar el registro.", true);
  }
}

export function fillRecordForm(id) {
  const record = state.records.find((item) => item.id === id);

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

export function resetRecordForm() {
  recordForm.reset();
  recordForm.elements.id.value = "";
}
