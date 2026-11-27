import { existsSync } from "node:fs"
import path from "node:path"
import { defineConfig } from "@playwright/test"

/**
 * E2E de campañas contra un backend y PostgreSQL efímeros levantados por
 * `scripts/run-campaign-e2e.cjs`. No inicia servidores por sí mismo para no
 * reutilizar la base de desarrollo.
 */

const braveCandidates = [
  process.env.PLAYWRIGHT_BROWSER_EXECUTABLE,
  "C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe",
  "C:\\Program Files (x86)\\BraveSoftware\\Brave-Browser\\Application\\brave.exe",
  process.env.LOCALAPPDATA
    ? path.join(process.env.LOCALAPPDATA, "BraveSoftware", "Brave-Browser", "Application", "brave.exe")
    : undefined,
].filter((candidate): candidate is string => Boolean(candidate))

const executablePath = braveCandidates.find((candidate) => existsSync(candidate))
const baseURL = process.env.PLAYWRIGHT_BASE_URL

if (!baseURL) {
  throw new Error("PLAYWRIGHT_BASE_URL es obligatorio para el E2E de campañas.")
}

export default defineConfig({
  testDir: "./e2e-campaign",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  retries: 0,
  workers: 1,
  fullyParallel: false,
  outputDir: ".test-results/campaign-e2e",
  reporter: [["list"], ["html", { outputFolder: ".playwright-report/campaign-e2e", open: "never" }]],
  use: {
    baseURL,
    browserName: "chromium",
    launchOptions: executablePath ? { executablePath } : undefined,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
})
