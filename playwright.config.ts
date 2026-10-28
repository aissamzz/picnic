import { defineConfig, devices } from "@playwright/test";

/**
 * E2E against the running app + Supabase stack.
 * Local: `pnpm stack:start`, then `pnpm test:e2e` (starts `next dev` if needed).
 * Needs a super admin: E2E_ADMIN_PHONE / E2E_ADMIN_PASSWORD (see scripts/create-admin.mjs).
 */
export default defineConfig({
  testDir: "e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "mobile", use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: "pnpm dev --port 3000", url: "http://localhost:3000/connexion", reuseExistingServer: true, timeout: 120_000 },
});
