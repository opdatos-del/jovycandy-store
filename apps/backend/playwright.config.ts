import { defineConfig } from "@playwright/test"
import { MedusaError } from "@medusajs/framework/utils"

const executablePath = process.env.PLAYWRIGHT_BROWSER_EXECUTABLE

if (!executablePath) {
  throw new MedusaError(MedusaError.Types.INVALID_DATA, "PLAYWRIGHT_BROWSER_EXECUTABLE debe apuntar a un navegador Chromium local")
}

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  retries: 0,
  workers: 1,
  outputDir: "test-results/playwright",
  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:9001",
    browserName: "chromium",
    launchOptions: { executablePath },
    screenshot: "on",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "pnpm exec cross-env PORT=9001 pnpm dev",
    cwd: __dirname,
    url: "http://127.0.0.1:9001/health",
    timeout: 120_000,
    reuseExistingServer: false,
  },
})
