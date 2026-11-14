import { expect, type APIRequestContext, type Page } from "@playwright/test"
import { MedusaError } from "@medusajs/framework/utils"
import { mkdirSync, readFileSync } from "node:fs"
import path from "node:path"

/**
 * Utilidades compartidas por las specs de las pantallas de presentaciÃ³n.
 * Los datos de prueba usan el prefijo "DEMO" para poder aislarlos y limpiarlos.
 */
export const DEMO_PREFIX = "DEMO"

export const auditDir = path.join(__dirname, "..", ".test-results", "audit-block2")

export function screenshotPath(name: string) {
  mkdirSync(auditDir, { recursive: true })
  return path.join(auditDir, name)
}

export function readEnvFile(file: string) {
  return Object.fromEntries(
    readFileSync(file, "utf8")
      .trim()
      .split("\n")
      .map((line) => {
        const index = line.indexOf("=")
        return [line.slice(0, index), line.slice(index + 1)]
      }),
  )
}

export function demoValue(suffix: string) {
  return `${DEMO_PREFIX} ${suffix} ${Date.now()}`
}

export async function apiHeaders(request: APIRequestContext, file = ".admin.local.env") {
  const admin = readEnvFile(file)
  const auth = await request.post("/auth/user/emailpass", {
    data: { email: admin.MEDUSA_ADMIN_EMAIL, password: admin.MEDUSA_ADMIN_PASSWORD },
  })
  expect(auth.status()).toBe(200)
  return { Authorization: `Bearer ${(await auth.json()).token}` }
}

/**
 * El servidor de desarrollo se reinicia cuando otro proceso modifica `src/`.
 * Antes de navegar se espera a que `/health` responda para no fallar con
 * `ERR_CONNECTION_REFUSED` durante la ventana de reinicio.
 */
export async function waitForServer(request: APIRequestContext, timeout = 90_000) {
  const startedAt = Date.now()
  let lastError: unknown = null

  while (Date.now() - startedAt < timeout) {
    try {
      const response = await request.get("/health")
      if (response.ok()) return
      lastError = new Error(`/health respondiÃ³ ${response.status()}`)
    } catch (error) {
      lastError = error
    }
    await new Promise((resolve) => setTimeout(resolve, 2_000))
  }

  throw new MedusaError(
    MedusaError.Types.UNEXPECTED_STATE,
    `El servidor de desarrollo no respondiÃ³ en ${timeout} ms${
      lastError instanceof Error ? `: ${lastError.message}` : ""
    }`,
  )
}

export async function signIn(page: Page, request: APIRequestContext) {
  const admin = readEnvFile(".admin.local.env")
  await waitForServer(request)
  await page.goto("/app/login")
  const email = page.getByPlaceholder("Email")

  // El primer render del Admin en modo desarrollo puede fallar mientras Vite
  // compila dependencias; un reload resuelve el chunk dinÃ¡mico pendiente.
  try {
    await expect(email).toBeVisible({ timeout: 15_000 })
  } catch {
    await page.reload()
    await expect(email).toBeVisible({ timeout: 30_000 })
  }

  await email.fill(admin.MEDUSA_ADMIN_EMAIL)
  await page.getByPlaceholder("Password").fill(admin.MEDUSA_ADMIN_PASSWORD)
  await Promise.all([
    page.waitForURL(/\/app(?!\/login)/),
    page.getByRole("button", { name: "Continue with Email" }).click(),
  ])
  return apiHeaders(request)
}

/**
 * Abre una secciÃ³n Jovy desde el sidebar. Las rutas hijas aparecen cuando la
 * ruta activa estÃ¡ dentro de `/jovy`, por eso se parte del tablero.
 */
export async function openJovySection(
  page: Page,
  request: APIRequestContext,
  options: { label: string; url: RegExp; heading: string },
) {
  const headers = await signIn(page, request)
  await page.goto("/app/jovy")
  await expect(page.getByRole("heading", { name: "Dashboard", level: 1 })).toBeVisible()
  await page
    .getByRole("navigation")
    .first()
    .getByRole("link", { name: options.label, exact: true })
    .click()
  await expect(page).toHaveURL(options.url)
  await expect(page.getByRole("heading", { name: options.heading, level: 1 })).toBeVisible()
  return headers
}

/**
 * Recoge errores de página y de consola sin filtrarlos: cualquier error real,
 * incluido un fallo de red como `ERR_CONNECTION_REFUSED`, debe hacer fallar la
 * spec. La estabilidad se resuelve esperando al servidor antes de navegar y con
 * las aserciones de Playwright, no descartando mensajes.
 */
export function collectPageProblems(page: Page) {
  const problems: string[] = []

  page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`))
  page.on("console", (message) => {
    if (message.type() !== "error") return
    const text = message.text()
    const url = message.location().url ?? ""
    problems.push(`console.error: ${text}${url ? ` (${url})` : ""}`)
  })

  return problems
}

/** PNG 1x1 válido para probar la subida real al File Module. */
export const demoPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
)
