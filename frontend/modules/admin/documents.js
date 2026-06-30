import { state, cb, statusEl, documentForm, documentsTitleEl, documentsListEl } from "./state.js";
import { escapeHtml, emptyMessage } from "./utils.js";
import { setStatus, friendlyError, formToObject, uploadPetDocumentFile, validateUploadFile, signedPetDocumentUrl, logDocumentUpload, removePetDocumentFile } from "../../supabase-client.js";

export async function renderDocuments() {
  documentsListEl.replaceChildren();
  const pet = state.pets.find((item) => item.id === state.selectedPetId);
  documentsTitleEl.textContent = pet ? `Documentos de ${pet.name}` : "Documentos";

  if (!pet) {
    documentsListEl.append(emptyMessage("Selecciona una mascota."));
    return;
  }

  const petDocuments = state.documents.filter((documentItem) => documentItem.pet_id === pet.id);

  if (petDocuments.length === 0) {
    documentsListEl.append(emptyMessage("No hay documentos asociados."));
    return;
  }

  const documentsWithUrls = await Promise.all(petDocuments.map(async (documentItem) => ({
    ...documentItem,
    signedUrl: await signedPetDocumentUrl(state.supabase, documentItem.file_url),
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

export async function saveDocument(event) {
  event.preventDefault();

  if (!state.selectedPetId) {
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
    const uploaded = await uploadPetDocumentFile(state.supabase, state.selectedPetId, file);
    const { data: userData, error: userError } = await state.supabase.auth.getUser();

    if (userError) {
      throw userError;
    }

    const { data, error } = await state.supabase.from("pet_documents").insert({
      pet_id: state.selectedPetId,
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

    await logDocumentUpload(state.supabase, data, file);

    resetDocumentForm();
    await cb.loadAll();
    setStatus(statusEl, "Documento oficial subido.");
  } catch (error) {
    setStatus(statusEl, friendlyError(error) || "No se pudo subir el documento.", true);
  }
}

export async function deleteDocument(id) {
  if (!confirm("Se eliminara este documento. Continuar?")) {
    return;
  }

  try {
    setStatus(statusEl, "Eliminando documento...");
    const documentItem = state.documents.find((item) => item.id === id);
    const { error } = await state.supabase.from("pet_documents").delete().eq("id", id);

    if (error) {
      throw error;
    }

    await removePetDocumentFile(state.supabase, documentItem?.file_url);

    await cb.loadAll();
    setStatus(statusEl, "Documento eliminado.");
  } catch (error) {
    setStatus(statusEl, friendlyError(error) || "No se pudo eliminar el documento.", true);
  }
}

export function resetDocumentForm() {
  documentForm.reset();
}
