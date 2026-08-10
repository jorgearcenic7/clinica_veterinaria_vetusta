import { calculateAge, escapeHtml, friendlyError, getProfile, requireSession, setStatus, signedPetImageUrl, signOut, uploadPetImage, validateUploadFile } from "./supabase-client.js";

const statusEl = document.querySelector("[data-status]");
const welcomeEl = document.querySelector("[data-welcome]");
const petsListEl = document.querySelector("[data-pets-list]");
const reservationsListEl = document.querySelector("[data-reservations-list]");
const logoutButton = document.querySelector("[data-logout]");

let supabase = null;
let session = null;
let pets = [];
let reservations = [];

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

    if (profile.role === "admin") {
      window.location.replace("/admin");
      return;
    }

    welcomeEl.textContent = `Hola${profile.full_name ? `, ${profile.full_name}` : ""}. Estas son sus mascotas registradas en la clínica.`;
    await loadDashboardData();
    setStatus(statusEl, "");
  } catch (error) {
    setStatus(statusEl, error.message || "No se pudo cargar el panel.", true);
  }
}

async function loadDashboardData() {
  setStatus(statusEl, "Cargando datos...");
  const [petsResult, reservationsResult] = await Promise.all([
    supabase
      .from("pets")
      .select("id,owner_id,name,species,breed,birth_date,image_url,created_at")
      .order("name", { ascending: true }),
    supabase
      .from("reservations")
      .select("id,nombre,telefono,email,mascota,servicio,datetime,status,created_at")
      .eq("client_id", session.user.id)
      .order("datetime", { ascending: true }),
  ]);

  if (petsResult.error) {
    throw petsResult.error;
  }

  if (reservationsResult.error) {
    throw reservationsResult.error;
  }

  pets = petsResult.data || [];
  reservations = reservationsResult.data || [];
  renderReservations();
  await renderPets();
}

async function loadPets() {
  await loadDashboardData();
}

function renderReservations() {
  reservationsListEl.replaceChildren();

  if (reservations.length === 0) {
    reservationsListEl.append(emptyMessage("Todavía no hay citas asociadas a tu cuenta."));
    return;
  }

  reservations.forEach((reservation) => {
    const item = document.createElement("article");
    const status = reservation.status || "confirmed";
    item.className = "reservation-card";
    item.innerHTML = `
      <div>
        <strong>${escapeHtml(formatReservationService(reservation.servicio))}</strong>
        <p class="muted">${escapeHtml(formatReservationDateTime(reservation.datetime))}</p>
        <p class="small muted">${escapeHtml(formatPetType(reservation.mascota))}</p>
      </div>
      <span class="badge badge-${escapeHtml(status)}">${escapeHtml(formatReservationStatus(status))}</span>
    `;
    reservationsListEl.append(item);
  });
}

async function renderPets() {
  petsListEl.replaceChildren();

  if (pets.length === 0) {
    petsListEl.append(emptyMessage("Todavía no hay mascotas asociadas a tu cuenta."));
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
          <input class="hidden" type="file" accept="image/jpeg,image/png,image/webp" data-image-input="${pet.id}">
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
    const imagePath = await uploadPetImage(supabase, session.user.id, petId, file);
    const { error } = await supabase
      .from("pets")
      .update({ image_url: imagePath })
      .eq("id", petId)
      .eq("owner_id", session.user.id);

    if (error) {
      console.error("update image_url error", error);
      throw error;
    }

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

function formatReservationDateTime(datetime) {
  if (!datetime) {
    return "Sin fecha";
  }

  const [dateKey, time = ""] = String(datetime).split("T");
  const date = parseDateKey(dateKey);
  const dateLabel = new Intl.DateTimeFormat("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);

  return `${capitalize(dateLabel)} · ${time}`;
}

function formatReservationService(value) {
  const labels = {
    consulta: "Consulta general",
    vacunacion: "Vacunación",
    cirugia: "Cirugía",
    peluqueria: "Peluquería",
    urgencia: "Urgencia",
  };

  return labels[value] || value || "Cita veterinaria";
}

function formatPetType(value) {
  const labels = {
    perro: "Perro",
    gato: "Gato",
    otro: "Otro",
  };

  return labels[value] || value || "Mascota sin indicar";
}

function formatReservationStatus(status) {
  const labels = {
    pending: "Pendiente",
    confirmed: "Confirmada",
    cancelled: "Cancelada",
  };

  return labels[status] || status;
}

function parseDateKey(dateKey) {
  const [year, month, day] = String(dateKey || "").split("-").map(Number);
  return new Date(year || 1970, (month || 1) - 1, day || 1);
}

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
