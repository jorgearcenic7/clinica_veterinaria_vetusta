// @ts-check
import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;

// Tests de navegador (e2e). La API que habla con Supabase se intercepta en cada
// test, así que el servidor arranca con credenciales de relleno y nunca toca
// una base de datos real.
export default defineConfig({
  testDir: "./e2e",
  // Un navegador cada vez: con varios Chromium en paralelo en Windows las páginas
  // tardaban a veces más de 30 s en cargar (el servidor no era el cuello de botella).
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: "node backend/server.js",
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: false,
    env: {
      PORT: String(PORT),
      SUPABASE_URL: "http://127.0.0.1:54321",
      SUPABASE_ANON_KEY: "e2e-placeholder",
      SUPABASE_SERVICE_ROLE_KEY: "e2e-placeholder",
      GOOGLE_ENABLE_LIVE_REVIEWS: "false",
    },
  },
});
