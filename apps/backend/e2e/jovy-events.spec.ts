import { expect, test } from "@playwright/test"
import { readFileSync } from "node:fs"

function values(file: string) {
  return Object.fromEntries(readFileSync(file, "utf8").trim().split("\n").map((line) => {
    const index = line.indexOf("=")
    return [line.slice(0, index), line.slice(index + 1)]
  }))
}

test("administra el ciclo editorial de un evento DEMO", async ({ page, request }) => {
  const admin = values(".admin.local.env")
  const store = values(".store.local.env")
  const runId = `e2e-event-demo-${Date.now()}`
  let token = ""
  let eventId = ""

  try {
    await page.goto("/app/login")
    await page.getByPlaceholder("Email").fill(admin.MEDUSA_ADMIN_EMAIL)
    await page.getByPlaceholder("Password").fill(admin.MEDUSA_ADMIN_PASSWORD)
    await Promise.all([page.waitForURL(/\/app(?!\/login)/), page.getByRole("button", { name: "Continue with Email" }).click()])

    const auth = await request.post("/auth/user/emailpass", { data: { email: admin.MEDUSA_ADMIN_EMAIL, password: admin.MEDUSA_ADMIN_PASSWORD } })
    expect(auth.status()).toBe(200)
    token = (await auth.json()).token
    const headers = { Authorization: `Bearer ${token}` }
    expect((await request.get("/admin/jovy/events")).status()).toBe(401)

    await page.goto("/app/jovy/events")
    await expect(page.getByRole("heading", { name: "Eventos" }).first()).toBeVisible()
    await page.getByLabel("Título evento").fill(`Evento DEMO ${runId}`)
    await page.getByLabel("Slug evento").fill(runId)
    await page.getByLabel("Descripción evento").fill("Evento creado desde Medusa Admin para validar el módulo.")
    await page.getByRole("button", { name: "Crear evento" }).click()
    await expect(page.getByText(`Evento DEMO ${runId}`)).toBeVisible()

    const listed = await request.get("/admin/jovy/events", { headers })
    const created = (await listed.json()).events.find((event: { slug: string }) => event.slug === runId)
    expect(created).toBeTruthy()
    eventId = created.id

    expect((await request.get("/store/jovy/events", { headers: { "x-publishable-api-key": store.MEDUSA_PUBLISHABLE_API_KEY } })).status()).toBe(200)
    const row = page.locator("li").filter({ hasText: `Evento DEMO ${runId}` })
    await row.getByRole("button", { name: "Publicar" }).click()
    await expect.poll(async () => {
      const response = await request.get("/store/jovy/events", { headers: { "x-publishable-api-key": store.MEDUSA_PUBLISHABLE_API_KEY } })
      return (await response.json()).events.some((event: { id: string }) => event.id === eventId)
    }).toBe(true)

    await row.getByRole("button", { name: "Archivar" }).click()
    await expect.poll(async () => {
      const response = await request.get("/store/jovy/events", { headers: { "x-publishable-api-key": store.MEDUSA_PUBLISHABLE_API_KEY } })
      return (await response.json()).events.some((event: { id: string }) => event.id === eventId)
    }).toBe(false)
    await page.screenshot({ path: "test-results/jovy-events-lifecycle.png", fullPage: true })
  } finally {
    if (!token) return
    try {
      const headers = { Authorization: `Bearer ${token}` }
      const listed = await request.get("/admin/jovy/events", { headers })
      if (!listed.ok()) {
        console.error(`No se pudo listar fixtures E2E de Eventos: HTTP ${listed.status()}`)
        return
      }
      const fixtures = (await listed.json()).events.filter((event: { id: string; slug: string }) => event.id === eventId || event.slug.startsWith("e2e-event-demo-"))
      for (const fixture of fixtures) {
        const response = await request.delete(`/admin/jovy/events/${fixture.id}`, { headers })
        if (![204, 404].includes(response.status())) console.error(`No se pudo limpiar el fixture E2E ${fixture.id}: HTTP ${response.status()}`)
      }
    } catch (error) {
      console.error(`No se pudo limpiar fixtures E2E de Eventos: ${error instanceof Error ? error.message : "error desconocido"}`)
    }
  }
})
