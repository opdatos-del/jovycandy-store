import { expect, test } from "@playwright/test"
import { readFileSync } from "node:fs"

function values(file: string) {
  return Object.fromEntries(readFileSync(file, "utf8").trim().split("\n").map((line) => {
    const index = line.indexOf("=")
    return [line.slice(0, index), line.slice(index + 1)]
  }))
}

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLfkQAAAABJRU5ErkJggg==",
  "base64",
)

async function login(page: import("@playwright/test").Page, request: import("@playwright/test").APIRequestContext) {
  const admin = values(".admin.local.env")
  await page.goto("/app/login")
  await page.getByPlaceholder("Email").fill(admin.MEDUSA_ADMIN_EMAIL)
  await page.getByPlaceholder("Password").fill(admin.MEDUSA_ADMIN_PASSWORD)
  await Promise.all([
    page.waitForURL(/\/app(?!\/login)/),
    page.getByRole("button", { name: "Continue with Email" }).click(),
  ])
  const auth = await request.post("/auth/user/emailpass", {
    data: { email: admin.MEDUSA_ADMIN_EMAIL, password: admin.MEDUSA_ADMIN_PASSWORD },
  })
  expect(auth.status()).toBe(200)
  return { Authorization: `Bearer ${(await auth.json()).token}` }
}

test("administra una Galería Casa Jovy publicada con imagen real", async ({ page, request }) => {
  const store = values(".store.local.env")
  const runId = `e2e-brand-gallery-${Date.now()}`
  let headers: Record<string, string> | undefined
  let galleryId = ""

  try {
    headers = await login(page, request)
    expect((await request.get("/admin/jovy/brand/gallery")).status()).toBe(401)

    await page.goto("/app/jovy/brand")
    await expect(page.getByRole("heading", { name: "Elementos de galería" })).toBeVisible()
    await page.getByLabel("Título galería").fill(`Galería DEMO ${runId}`)
    await page.getByLabel("Descripción galería").fill("Elemento temporal validado desde Medusa Admin.")
    await page.getByLabel("Imagen de galería").setInputFiles({ name: "brand-demo.png", mimeType: "image/png", buffer: png })
    await expect(page.getByAltText("Vista previa de galería")).toBeVisible()
    await page.getByLabel("Estado galería").selectOption("published")
    await page.getByRole("button", { name: "Crear elemento" }).click()
    await expect(page.getByText(`Galería DEMO ${runId}`)).toBeVisible()

    const listed = await request.get("/admin/jovy/brand/gallery", { headers })
    const created = (await listed.json()).items.find((item: { title: string }) => item.title === `Galería DEMO ${runId}`)
    expect(created).toBeTruthy()
    galleryId = created.id
    expect(created.media_url).toBeTruthy()

    await expect.poll(async () => {
      const response = await request.get("/store/jovy/brand/gallery", {
        headers: { "x-publishable-api-key": store.MEDUSA_PUBLISHABLE_API_KEY },
      })
      return (await response.json()).items.some((item: { id: string }) => item.id === galleryId)
    }).toBe(true)

    const row = page.locator("li").filter({ hasText: `Galería DEMO ${runId}` })
    await row.getByRole("button", { name: "Editar" }).click()
    await page.getByLabel("Título galería").fill(`Galería editada ${runId}`)
    await page.getByRole("button", { name: "Guardar cambios" }).click()
    await expect(page.getByText(`Galería editada ${runId}`)).toBeVisible()
    await page.screenshot({ path: ".test-results/jovy-brand-gallery.png", fullPage: true })

    const editedRow = page.locator("li").filter({ hasText: `Galería editada ${runId}` })
    await editedRow.getByRole("button", { name: "Archivar" }).click()
    await expect.poll(async () => {
      const response = await request.get("/store/jovy/brand/gallery", {
        headers: { "x-publishable-api-key": store.MEDUSA_PUBLISHABLE_API_KEY },
      })
      return (await response.json()).items.some((item: { id: string }) => item.id === galleryId)
    }).toBe(false)
  } finally {
    if (galleryId && headers) {
      const response = await request.delete(`/admin/jovy/brand/gallery/${galleryId}`, { headers })
      if (![204, 404].includes(response.status())) console.error(`No se pudo limpiar Galería DEMO: HTTP ${response.status()}`)
    }
  }
})

test("administra logo, familia editorial y recorte no destructivo", async ({ page, request }) => {
  const store = values(".store.local.env")
  const runId = `e2e-brand-logo-${Date.now()}`
  let headers: Record<string, string> | undefined
  let logoId = ""

  try {
    headers = await login(page, request)
    await page.goto("/app/jovy/brand")
    await page.getByRole("button", { name: "Logos" }).click()
    await expect(page.getByRole("heading", { name: "Logos" })).toBeVisible()
    await page.getByLabel("Slug logo").fill(runId)
    await page.getByLabel("Nombre logo").fill(`Logo DEMO ${runId}`)
    await page.getByLabel("Texto alternativo logo").fill("Logo de prueba")
    await page.getByLabel("Familias logo").fill("corporativa, demo")
    await page.getByLabel("Archivo de logo").setInputFiles({ name: "logo-demo.png", mimeType: "image/png", buffer: png })
    await expect(page.getByAltText("Vista previa de recorte de logo")).toBeVisible()
    await page.getByRole("button", { name: "Crear logo" }).click()
    await expect(page.getByText(`Logo DEMO ${runId}`)).toBeVisible()

    const listed = await request.get("/admin/jovy/brand/logos", { headers })
    const created = (await listed.json()).logos.find((logo: { slug: string }) => logo.slug === runId)
    expect(created).toBeTruthy()
    logoId = created.id
    expect(created.families).toEqual(["corporativa", "demo"])

    const row = page.locator("li").filter({ hasText: `Logo DEMO ${runId}` })
    await row.getByRole("button", { name: "Editar" }).click()
    await page.getByLabel("Zoom logo").fill("1.25")
    await page.getByLabel("Desplazamiento X logo").fill("12")
    await page.getByRole("button", { name: "Guardar cambios" }).click()
    await expect(page.getByText(`Logo DEMO ${runId}`)).toBeVisible()
    const saved = await request.get(`/admin/jovy/brand/logos/${logoId}`, { headers })
    expect((await saved.json()).logo.crop).toEqual({ zoom: 1.25, offset_x: 12, offset_y: 0 })
    await page.screenshot({ path: ".test-results/jovy-brand-logo.png", fullPage: true })

    const editedRow = page.locator("li").filter({ hasText: `Logo DEMO ${runId}` })
    await editedRow.getByRole("button", { name: "Desactivar" }).click()
    // El clic sólo despacha la mutación; se consulta la Store API hasta que el logo deja de exponerse.
    await expect.poll(async () => {
      const response = await request.get("/store/jovy/brand/logos?family=demo", {
        headers: { "x-publishable-api-key": store.MEDUSA_PUBLISHABLE_API_KEY },
      })
      expect(response.status()).toBe(200)
      return (await response.json()).logos.some((logo: { id: string }) => logo.id === logoId)
    }).toBe(false)
  } finally {
    if (logoId && headers) {
      const response = await request.delete(`/admin/jovy/brand/logos/${logoId}`, { headers })
      if (![204, 404].includes(response.status())) console.error(`No se pudo limpiar Logo DEMO: HTTP ${response.status()}`)
    }
  }
})
