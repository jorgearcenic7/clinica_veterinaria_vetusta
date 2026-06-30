import { state, cb, statusEl, clientsListEl, clientDetailEl, petsListEl, recordsTableEl, documentsListEl, CLIENTS_LIMIT } from "./state.js";
import { escapeHtml, emptyMessage } from "./utils.js";
import { setStatus } from "../../supabase-client.js";
import { resetPetForm } from "./pets.js";
import { resetRecordForm } from "./records.js";
import { resetDocumentForm } from "./documents.js";

export async function loadClients(page = 1) {
  const { data: sessionData } = await state.supabase.auth.getSession();
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

  state.clients = result.data || [];
  state.clientsPage = result.page || 1;
  state.clientsTotalPages = result.totalPages || 1;
  state.clientsTotal = result.total || 0;
}

export function renderClients() {
  clientsListEl.replaceChildren();

  if (state.clients.length === 0) {
    clientsListEl.append(emptyMessage("No hay clientes registrados."));
  } else {
    state.clients.forEach((client) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `client-card ${client.id === state.selectedClientId ? "active" : ""}`;
      button.innerHTML = `
        <strong>${escapeHtml(client.full_name || "Sin nombre")}</strong>
        <span>${escapeHtml(client.phone || "Sin teléfono")}</span>
      `;
      button.addEventListener("click", () => {
        state.selectedClientId = client.id;
        state.selectedPetId = state.pets.find((pet) => pet.owner_id === state.selectedClientId)?.id || null;
        resetPetForm();
        resetRecordForm();
        resetDocumentForm();
        cb.render();
      });
      clientsListEl.append(button);
    });
  }

  if (state.clientsTotalPages > 1) {
    clientsListEl.append(createClientsPagination());
  }
}

export function createClientsPagination() {
  const nav = document.createElement("nav");
  nav.className = "pagination";
  nav.setAttribute("aria-label", "Paginación de clientes");

  const prevBtn = document.createElement("button");
  prevBtn.type = "button";
  prevBtn.className = "secondary";
  prevBtn.textContent = "Anterior";
  prevBtn.disabled = state.clientsPage <= 1;
  prevBtn.addEventListener("click", () => goToClientsPage(state.clientsPage - 1));

  const info = document.createElement("span");
  info.className = "pagination-info muted";
  info.textContent = `Página ${state.clientsPage} de ${state.clientsTotalPages} (${state.clientsTotal} clientes)`;

  const nextBtn = document.createElement("button");
  nextBtn.type = "button";
  nextBtn.className = "secondary";
  nextBtn.textContent = "Siguiente";
  nextBtn.disabled = state.clientsPage >= state.clientsTotalPages;
  nextBtn.addEventListener("click", () => goToClientsPage(state.clientsPage + 1));

  nav.append(prevBtn, info, nextBtn);
  return nav;
}

export async function goToClientsPage(page) {
  try {
    setStatus(statusEl, "Cargando clientes...");
    await loadClients(page);
    setStatus(statusEl, "");
    renderClients();
  } catch (error) {
    setStatus(statusEl, "No se pudieron cargar los clientes.", true);
  }
}

export function renderClientDetailVisibility() {
  if (state.selectedClientId) {
    clientDetailEl.classList.remove("hidden");
    return;
  }

  clientDetailEl.classList.add("hidden");
  petsListEl.replaceChildren();
  recordsTableEl.replaceChildren();
  documentsListEl.replaceChildren();
}
