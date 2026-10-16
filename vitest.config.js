import { defineConfig } from "vitest/config";

// Vitest solo ejecuta los tests unitarios; los de navegador (e2e/) van con Playwright.
export default defineConfig({
  test: {
    include: ["tests/**/*.test.js"],
  },
});
