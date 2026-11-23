import { existsSync } from "node:fs"
import path from "node:path"
import { defineConfig } from "@playwright/test"

const braveCandidates = [
  process.env.PLAYWRIGHT_BROWSER_EXECUTABLE,
  "C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe",
  "C:\\Program Files (x86)\\BraveSoftware\\Brave-Browser\\Application\\brave.exe",
  process.env.LOCALAPPDATA
    ? path.join(process.env.LOCALAPPDATA, "BraveSoftware", "Brave-Browser", "Application", "brave.exe")
    : undefined,
].filter((candidate): candidate is string => Boolean(candidate))

const executablePath = braveCandidates.find((candidate) => existsSync(candidate))
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000"

export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  expect: { timeout: 10_000 },
  retries: 0,
  workers: 1,
  outputDir: ".test-results/catalog",
  reporter: [["list"], ["html", { outputFolder: ".playwright-report/catalog", open: "never" }]],
  use: {
    baseURL,
    browserName: "chromium",
    launchOptions: executablePath ? { executablePath } : undefined,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "pnpm --dir apps/backend dev",
      url: "http://localhost:9000/health",
      timeout: 180_000,
      reuseExistingServer: true,
    },
    {
      command: "pnpm --dir apps/storefront dev",
      url: baseURL,
      timeout: 120_000,
      reuseExistingServer: true,
    },
  ],
})
