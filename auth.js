import { formToObject, getSupabase, setStatus } from "./supabase-client.js";

const statusEl = document.querySelector("[data-auth-status]");
const tabButtons = [...document.querySelectorAll("[data-tab]")];
const panels = [...document.querySelectorAll("[data-auth-panel]")];
const loginForm = document.querySelector("[data-login-form]");
const registerForm = document.querySelector("[data-register-form]");
const resetForm = document.querySelector("[data-reset-form]");
const updatePasswordForm = document.querySelector("[data-update-password-form]");
const redirectTo = new URLSearchParams(window.location.search).get("redirect") || "/dashboard";

initAuth();

async function initAuth() {
  try {
    const supabase = await getSupabase();
    const { data } = await supabase.auth.getSession();

    if (data.session && window.location.hash.includes("type=recovery")) {
      showPasswordUpdate();
      return;
    }

    if (data.session) {
      window.location.replace(redirectTo);
      return;
    }
  } catch (error) {
    setStatus(statusEl, error.message, true);
  }
}

tabButtons.forEach((button) => {
  button.addEventListener("click", () => showPanel(button.dataset.tab));
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus(statusEl, "Entrando...");

  try {
    const supabase = await getSupabase();
    const values = formToObject(loginForm);
    const { error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    });

    if (error) {
      throw error;
    }

    window.location.replace(redirectTo);
  } catch (error) {
    setStatus(statusEl, friendlyAuthError(error), true);
  }
});

registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus(statusEl, "Creando cuenta...");

  try {
    const supabase = await getSupabase();
    const values = formToObject(registerForm);
    const { error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        data: {
          full_name: values.full_name,
          phone: values.phone,
        },
        emailRedirectTo: `${window.location.origin}/dashboard`,
      },
    });

    if (error) {
      throw error;
    }

    registerForm.reset();
    setStatus(statusEl, "Cuenta creada. Si Supabase pide confirmacion, revisa tu email antes de entrar.");
  } catch (error) {
    setStatus(statusEl, friendlyAuthError(error), true);
  }
});

resetForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus(statusEl, "Enviando enlace...");

  try {
    const supabase = await getSupabase();
    const values = formToObject(resetForm);
    const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
      redirectTo: `${window.location.origin}/auth`,
    });

    if (error) {
      throw error;
    }

    resetForm.reset();
    setStatus(statusEl, "Te hemos enviado un enlace para recuperar la contrasena.");
  } catch (error) {
    setStatus(statusEl, friendlyAuthError(error), true);
  }
});

updatePasswordForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus(statusEl, "Guardando contrasena...");

  try {
    const supabase = await getSupabase();
    const values = formToObject(updatePasswordForm);
    const { error } = await supabase.auth.updateUser({ password: values.password });

    if (error) {
      throw error;
    }

    setStatus(statusEl, "Contrasena actualizada. Ya puedes entrar.");
    window.location.replace("/dashboard");
  } catch (error) {
    setStatus(statusEl, friendlyAuthError(error), true);
  }
});

function showPanel(name) {
  tabButtons.forEach((button) => {
    button.setAttribute("aria-selected", String(button.dataset.tab === name));
  });

  panels.forEach((panel) => {
    panel.classList.toggle("hidden", panel.dataset.authPanel !== name);
  });

  updatePasswordForm.classList.add("hidden");
  setStatus(statusEl, "");
}

function showPasswordUpdate() {
  tabButtons.forEach((button) => button.setAttribute("aria-selected", "false"));
  panels.forEach((panel) => panel.classList.add("hidden"));
  updatePasswordForm.classList.remove("hidden");
}

function friendlyAuthError(error) {
  const message = error?.message || "No se pudo completar la operacion.";

  if (message.includes("Invalid login credentials")) {
    return "Email o contrasena incorrectos.";
  }

  return message;
}
