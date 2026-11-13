import { existsSync } from "node:fs"
import path from "node:path"
import { defineConfig } from "@playwright/test"
import { MedusaError } from "@medusajs/framework/utils"

/**
 * Brave es el navegador soportado para las pruebas E2E locales. La variable de entorno
 * PLAYWRIGHT_BROWSER_EXECUTABLE tiene prioridad; si no está definida se usan las rutas de
 * instalación por defecto de Brave, sin exigir configuración adicional en la máquina.
 */
const BRAVE_EXECUTABLE_CANDIDATES = [
  "C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe",
  "C:\\Program Files (x86)\\BraveSoftware\\Brave-Browser\\Application\\brave.exe",
  process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, "BraveSoftware", "Brave-Browser", "Application", "brave.exe") : "",
].filter(Boolean)

function resolveBrowserExecutable(): string {
  const fromEnvironment = process.env.PLAYWRIGHT_BROWSER_EXECUTABLE

  if (fromEnvironment) {
    if (existsSync(fromEnvironment)) {
      return fromEnvironment
    }

    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `PLAYWRIGHT_BROWSER_EXECUTABLE apunta a "${fromEnvironment}", que no existe en este equipo`,
    )
  }

  const brave = BRAVE_EXECUTABLE_CANDIDATES.find((candidate) => existsSync(candidate))

  if (brave) {
    return brave
  }

  throw new MedusaError(
    MedusaError.Types.INVALID_DATA,
    "No se encontró Brave en las rutas por defecto. Instala Brave o define PLAYWRIGHT_BROWSER_EXECUTABLE con la ruta a un navegador Chromium local",
  )
}

const executablePath = resolveBrowserExecutable()

/**
 * `medusa develop` reinicia el servidor de desarrollo cuando detecta cualquier archivo creado,
 * modificado o eliminado dentro de `apps/backend` (watcher chokidar de
 * `@medusajs/medusa/dist/commands/develop.js`). Su lista de exclusiones es fija y solo cubre
 * dotfiles, `node_modules`, `dist`, `static`, `private`, `src/admin` y `.medusa`.
 *
 * Por eso los artefactos de Playwright viven en directorios con punto: si las capturas, trazas y
 * reportes se escriben en `test-results/` o `playwright-report/`, el watcher mata el servidor en
 * cada escritura y las specs siguientes fallan con ECONNREFUSED.
 */
const artifactsDir = path.join(__dirname, ".test-results")

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  retries: 0,
  workers: 1,
  outputDir: path.join(artifactsDir, "playwright"),
  reporter: [["list"], ["html", { outputFolder: path.join(__dirname, ".playwright-report"), open: "never" }]],
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
