import { calculateAge, escapeHtml, friendlyError, getProfile, requireSession, setStatus, signedPetImageUrl, signOut, uploadPetImage, validateUploadFile } from "./supabase-client.js";

const statusEl = document.querySelector("[data-status]");
const welcomeEl = document.querySelector("[data-welcome]");
const petsListEl = document.querySelector("[data-pets-list]");
const adminLink = document.querySelector("[data-admin-link]");
const logoutButton = document.querySelector("[data-logout]");

let supabase = null;
let session = null;
let pets = [];

logoutButton.addEventListener("click", signOut);
initDashboard();

async function initDashboard() {
  try {
    const auth = await requireSession();

    if (!auth) {
      return;
    }

    supabase = auth.supabase;
    session = auth.session;
    const profile = await getProfile(supabase, auth.session.user.id);
    welcomeEl.textContent = `Hola${profile.full_name ? `, ${profile.full_name}` : ""}. Estas son las mascotas registradas por la clinica.`;
    adminLink.classList.toggle("hidden", profile.role !== "admin");
    await loadPets();
    setStatus(statusEl, "");
  } catch (error) {
    setStatus(statusEl, error.message || "No se pudo cargar el panel.", true);
  }
}

async function loadPets() {
  setStatus(statusEl, "Cargando mascotas...");
  const { data, error } = await supabase
    .from("pets")
    .select("id,owner_id,name,species,breed,birth_date,image_url,created_at")
    .order("name", { ascending: true });

  if (error) {
    throw error;
  }

  pets = data || [];
  await renderPets();
}

async function renderPets() {
  petsListEl.replaceChildren();

  if (pets.length === 0) {
    petsListEl.append(emptyMessage("Todavia no hay mascotas asociadas a tu cuenta."));
    return;
  }

  let imageLoadError = false;
  const petsWithImages = await Promise.all(pets.map(async (pet) => {
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
    const card = document.createElement("article");
    card.className = "card pet-card";
    card.innerHTML = `
      ${pet.signedImageUrl ? `<img class="pet-photo" src="${escapeHtml(pet.signedImageUrl)}" alt="Foto de ${escapeHtml(pet.name)}">` : `<div class="pet-photo placeholder" aria-hidden="true">${escapeHtml(pet.name.slice(0, 1).toUpperCase())}</div>`}
      <div>
        <h3 class="section-title">${escapeHtml(pet.name)}</h3>
        <p class="muted">${escapeHtml([pet.species, pet.breed].filter(Boolean).join(" · ") || "Sin detalles")}</p>
        <p class="small muted">Edad: ${calculateAge(pet.birth_date)}</p>
      </div>
      <div class="row">
        <label class="button secondary">
          Cambiar foto
          <input class="hidden" type="file" accept="image/jpeg,image/png,image/webp" data-image-input="${pet.id}" data-owner-id="${pet.owner_id}">
        </label>
        <a class="button" href="/dashboard/pets/${pet.id}">Ver historial</a>
      </div>
    `;
    petsListEl.append(card);
  });

  if (imageLoadError) {
    setStatus(statusEl, "No se pudo cargar alguna imagen guardada. Vuelve a subir la foto para regenerarla.", true);
  }

  petsListEl.querySelectorAll("[data-image-input]").forEach((input) => {
    input.addEventListener("change", () => changeImage(input));
  });
}

async function changeImage(input) {
  const file = input.files?.[0];

  if (!file) {
    return;
  }

  try {
    validateUploadFile(file, "image");
    setStatus(statusEl, "Subiendo imagen...");
    const petId = input.dataset.imageInput;
    const ownerId = input.dataset.ownerId || session?.user?.id;
    const imagePath = await uploadPetImage(supabase, ownerId, petId, file);
    const { error } = await supabase
      .from("pets")
      .update({ image_url: imagePath })
      .eq("id", petId);

    if (error) {
      console.error("update pet image error", error);
      throw error;
    }

    console.log("saved image_url", imagePath);
    await loadPets();
    setStatus(statusEl, "Imagen actualizada.");
  } catch (error) {
    setStatus(statusEl, friendlyError(error) || "No se pudo subir la imagen.", true);
  } finally {
    input.value = "";
  }
}

function emptyMessage(text) {
  const item = document.createElement("p");
  item.className = "muted";
  item.textContent = text;
  return item;
}
