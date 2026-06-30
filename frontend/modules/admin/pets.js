import { state, cb, statusEl, petsListEl, petForm, getSelectedClient } from "./state.js";
import { escapeHtml, emptyMessage, normalizeEmptyDates } from "./utils.js";
import { setStatus, friendlyError, formToObject, formatDate, signedPetImageUrl, uploadPetImage, validateUploadFile } from "../../supabase-client.js";
import { resetRecordForm } from "./records.js";
import { resetDocumentForm } from "./documents.js";

export async function renderPets() {
  petsListEl.replaceChildren();
  const clientPets = state.pets.filter((pet) => pet.owner_id === state.selectedClientId);

  if (!state.selectedClientId) {
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
      const signedImageUrl = await signedPetImageUrl(state.supabase, pet.image_url);
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
    item.className = `list-item ${pet.id === state.selectedPetId ? "active" : ""}`;
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
      state.selectedPetId = button.dataset.selectPet;
      resetRecordForm();
      resetDocumentForm();
      cb.render();
    });
  });

  petsListEl.querySelectorAll("[data-edit-pet]").forEach((button) => {
    button.addEventListener("click", () => fillPetForm(button.dataset.editPet));
  });

  petsListEl.querySelectorAll("[data-delete-pet]").forEach((button) => {
    button.addEventListener("click", () => deletePet(button.dataset.deletePet));
  });
}

export async function savePet(event) {
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
      ? state.supabase.from("pets").update(payload).eq("id", values.id).select("id").single()
      : state.supabase.from("pets").insert(payload).select("id").single();
    const { data, error } = await query;

    if (error) {
      throw error;
    }

    if (imageFile) {
      validateUploadFile(imageFile, "image");
      const petId = values.id || data.id;
      const imagePath = await uploadPetImage(state.supabase, selectedClient.id, petId, imageFile);
      const { error: imageError } = await state.supabase
        .from("pets")
        .update({ image_url: imagePath })
        .eq("id", petId);

      if (imageError) {
        console.error("update image_url error", imageError);
        throw imageError;
      }

      console.log("saved image_url", imagePath);
      state.selectedPetId = petId;
    }

    resetPetForm();
    await cb.loadAll();
    setStatus(statusEl, "Mascota guardada.");
  } catch (error) {
    setStatus(statusEl, friendlyError(error) || "No se pudo guardar la mascota.", true);
  }
}

export async function deletePet(id) {
  if (!confirm("Se eliminara la mascota y todo su historial. Continuar?")) {
    return;
  }

  try {
    setStatus(statusEl, "Eliminando mascota...");
    const { error } = await state.supabase.from("pets").delete().eq("id", id);

    if (error) {
      throw error;
    }

    state.selectedPetId = null;
    await cb.loadAll();
    setStatus(statusEl, "Mascota eliminada.");
  } catch (error) {
    setStatus(statusEl, friendlyError(error) || "No se pudo eliminar la mascota.", true);
  }
}

export function fillPetForm(id) {
  const pet = state.pets.find((item) => item.id === id);

  if (!pet) {
    return;
  }

  state.selectedPetId = pet.id;
  petForm.elements.id.value = pet.id;
  petForm.elements.name.value = pet.name || "";
  petForm.elements.species.value = pet.species || "";
  petForm.elements.breed.value = pet.breed || "";
  petForm.elements.birth_date.value = pet.birth_date || "";
  cb.render();
}

export function resetPetForm() {
  petForm.reset();
  petForm.elements.id.value = "";
}
