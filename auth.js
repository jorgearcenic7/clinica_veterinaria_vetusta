import { formToObject, friendlyError, getSupabase, setStatus, validateStrongPassword } from "./supabase-client.js";

const statusEl = document.querySelector("[data-auth-status]");
const tabButtons = [...document.querySelectorAll("[data-tab]")];
const panels = [...document.querySelectorAll("[data-auth-panel]")];
const loginForm = document.querySelector("[data-login-form]");
const registerForm = document.querySelector("[data-register-form]");
const resetForm = document.querySelector("[data-reset-form]");
const updatePasswordForm = document.querySelector("[data-update-password-form]");
const redirectParam = new URLSearchParams(window.location.search).get("redirect");
const redirectTo = redirectParam ? getSafeRedirectUrl(redirectParam) : "/dashboard";

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
      safeRedirect(await dashboardPathForSession(supabase, data.session));
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

    const { data } = await supabase.auth.getSession();
    safeRedirect(await dashboardPathForSession(supabase, data.session));
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
    const passwordError = validateStrongPassword(values.password);

    if (passwordError) {
      throw new Error(passwordError);
    }

    if (values.password !== values.password_confirm) {
      throw new Error("Las contraseñas no coinciden.");
    }

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
    setStatus(statusEl, "Cuenta creada. Si Supabase pide confirmación, revisa tu email antes de entrar.");
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
    setStatus(statusEl, "Te hemos enviado un enlace para recuperar la contraseña.");
  } catch (error) {
    setStatus(statusEl, friendlyAuthError(error), true);
  }
});

updatePasswordForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus(statusEl, "Guardando contraseña...");

  try {
    const supabase = await getSupabase();
    const values = formToObject(updatePasswordForm);
    const passwordError = validateStrongPassword(values.password);

    if (passwordError) {
      throw new Error(passwordError);
    }

    const { error } = await supabase.auth.updateUser({ password: values.password });

    if (error) {
      throw error;
    }

    const { data } = await supabase.auth.getSession();
    setStatus(statusEl, "Contraseña actualizada. Ya puedes entrar.");
    safeRedirect(data.session ? await dashboardPathForSession(supabase, data.session) : "/dashboard");
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

async function dashboardPathForSession(supabase, session) {
  if (!session?.user?.id) {
    return getSafeRedirectUrl(redirectTo);
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", session.user.id)
    .single();

  if (error) {
    console.error("profile redirect error", error);
    return getSafeRedirectUrl(redirectTo);
  }

  return data?.role === "admin" ? "/admin" : getSafeRedirectUrl(redirectTo);
}

function safeRedirect(url) {
  window.location.replace(getSafeRedirectUrl(url));
}

export function getSafeRedirectUrl(value) {
  try {
    const text = String(value || "").trim();

    if (!text || text.startsWith("//") || hasControlCharacter(text)) {
      return "/";
    }

    const url = new URL(text, window.location.origin);

    if (url.origin !== window.location.origin || !url.pathname.startsWith("/")) {
      return "/";
    }

    return `${url.pathname}${url.search}${url.hash}`;
  } catch (_error) {
    return "/";
  }
}

function friendlyAuthError(error) {
  const message = error?.message || "No se pudo completar la operación.";

  if (message.includes("Invalid login credentials")) {
    return "Email o contraseña incorrectos.";
  }

  if (message.includes("email rate limit exceeded")) {
    return "Se han enviado demasiados emails en poco tiempo. Espera unos minutos antes de intentarlo de nuevo.";
  }

  return friendlyError(error);
}

function hasControlCharacter(value) {
  return [...value].some((char) => {
    const code = char.charCodeAt(0);
    return code <= 31 || code === 127;
  });
}
