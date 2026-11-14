import { expect, test, type APIRequestContext, type Page } from "@playwright/test"
import { mkdirSync, readFileSync } from "node:fs"
import path from "node:path"
import sharp from "sharp"
import { collectPageProblems, signIn } from "./jovy-block2-helpers"

// El servidor de desarrollo se reinicia durante la compilación del Admin; se
// permite un reintento para no confundir ese reinicio con un fallo de la UI.
test.describe.configure({ timeout: 120_000, retries: 1 })

function values(file: string) { return Object.fromEntries(readFileSync(file, "utf8").trim().split("\n").map((line) => { const index = line.indexOf("="); return [line.slice(0, index), line.slice(index + 1)] })) }

const admin = values(".admin.local.env")
const store = values(".store.local.env")
const storeHeaders = { "x-publishable-api-key": store.MEDUSA_PUBLISHABLE_API_KEY }
const unique = (prefix: string) => `${prefix}-${Date.now()}`

const auditDir = path.join(__dirname, "..", ".test-results", "audit-visual", "announcements")

function screenshotPath(name: string) {
  mkdirSync(auditDir, { recursive: true })
  return path.join(auditDir, name)
}

async function apiHeaders(request: APIRequestContext) {
  const auth = await request.post("/auth/user/emailpass", { data: { email: admin.MEDUSA_ADMIN_EMAIL, password: admin.MEDUSA_ADMIN_PASSWORD } })
  expect(auth.status()).toBe(200)
  return { Authorization: `Bearer ${(await auth.json()).token}` }
}

function bannerInput(title: string, extra: Record<string, unknown> = {}) {
  return {
    slot: "promo",
    translations: { es: { title, alt: `Alt ${title}` }, en: { title: `EN ${title}`, alt: `EN alt ${title}` } },
    status: "published",
    enabled: true,
    auto_open: false,
    frequency: "every",
    priority: 0,
    sort_order: 0,
    cta_url: null,
    starts_at: null,
    ends_at: null,
    ...extra,
  }
}

async function createBanner(request: APIRequestContext, headers: Record<string, string>, input: Record<string, unknown>) {
  const response = await request.post("/admin/jovy/marketing/banners", { headers, data: input })
  expect(response.status()).toBe(201)
  return (await response.json()).banner
}

async function adminBanners(request: APIRequestContext, headers: Record<string, string>) {
  const response = await request.get("/admin/jovy/marketing/banners", { headers })
  expect(response.status()).toBe(200)
  return (await response.json()).banners as Array<{
    id: string
    status: string
    media_file_id: string | null
    auto_open: boolean
    frequency: string
    priority: number
    cta_url: string | null
    starts_at: string | null
    ends_at: string | null
    translations: { es: { title: string } }
  }>
}

async function cleanupBanners(request: APIRequestContext, headers: Record<string, string>, prefix = "e2e-banner") {
  for (const banner of await adminBanners(request, headers).catch(() => [])) {
    if (banner.translations.es.title.startsWith(prefix)) {
      await request.delete(`/admin/jovy/marketing/banners/${banner.id}`, { headers })
    }
  }
}

const storeBanners = async (request: APIRequestContext, slot: string) =>
  (await (await request.get(`/store/jovy/marketing/banners/${slot}`, { headers: storeHeaders })).json()).banners as Array<Record<string, unknown> & { id: string; translations: { es: { title: string } } }>

async function image(width = 64, height = 40) {
  return sharp({ create: { width, height, channels: 4, background: { r: 0, g: 175, b: 170, alpha: 1 } } }).png().toBuffer()
}

/** Valor para `input[type=datetime-local]` en la zona horaria del navegador. */
function localInput(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

async function openBanners(page: Page) {
  await page.goto("/app/jovy/marketing?tab=banners&slot=promo")
  await expect(page.getByRole("heading", { name: "Banners y promociones" })).toBeVisible()
}

test("publica Banners por slot con prioridad, frecuencia, CTA y ventana UTC deterministas", async ({ request }) => {
  const headers = await apiHeaders(request)
  const prefix = unique("e2e-banner-api")
  const created: string[] = []
  try {
    expect((await request.get("/admin/jovy/marketing/banners")).status()).toBe(401)
    expect((await request.get("/store/jovy/marketing/banners/modal", { headers: storeHeaders })).status()).toBe(404)

    const valid = bannerInput(`${prefix}-base`)
    const invalidPayloads = [
      {},
      { ...valid, slot: "modal" },
      { ...valid, translations: { es: { title: "Promo" }, en: valid.translations.en } },
      { ...valid, cta_url: "javascript:alert(1)" },
      { ...valid, cta_url: "data:text/html,hola" },
      { ...valid, starts_at: "2026-12-02T00:00:00.000Z", ends_at: "2026-12-01T00:00:00.000Z" },
      { ...valid, priority: 1_001 },
      { ...valid, frequency: "weekly" },
    ]
    for (const payload of invalidPayloads) {
      expect((await request.post("/admin/jovy/marketing/banners", { headers, data: payload })).status()).toBe(400)
    }

    const now = Date.now()
    const promoP1 = await createBanner(request, headers, bannerInput(`${prefix}-p1`, { priority: 5, sort_order: 5, auto_open: true, frequency: "daily", cta_url: "https://example.com/promo", starts_at: new Date(now - 60_000).toISOString(), ends_at: new Date(now + 3_600_000).toISOString() }))
    const promoP2 = await createBanner(request, headers, bannerInput(`${prefix}-p2`, { priority: 10, sort_order: 9 }))
    const promoP3 = await createBanner(request, headers, bannerInput(`${prefix}-p3`, { priority: 5, sort_order: 1 }))
    const draft = await createBanner(request, headers, bannerInput(`${prefix}-draft`, { status: "draft", priority: 100 }))
    const archived = await createBanner(request, headers, bannerInput(`${prefix}-archived`, { status: "archived", priority: 100 }))
    const future = await createBanner(request, headers, bannerInput(`${prefix}-future`, { priority: 100, starts_at: new Date(now + 3_600_000).toISOString() }))
    const expired = await createBanner(request, headers, bannerInput(`${prefix}-expired`, { priority: 100, ends_at: new Date(now - 3_600_000).toISOString() }))
    const hint = await createBanner(request, headers, bannerInput(`${prefix}-hint`, { slot: "hint", priority: 100 }))
    created.push(promoP1.id, promoP2.id, promoP3.id, draft.id, archived.id, future.id, expired.id, hint.id)

    const promo = await storeBanners(request, "promo")
    const ownPromoIds = new Set([promoP1.id, promoP2.id, promoP3.id])
    expect(promo.filter((banner) => ownPromoIds.has(banner.id)).map((banner) => banner.id))
      .toEqual([promoP2.id, promoP3.id, promoP1.id])
    expect(promo.map((banner) => banner.id)).not.toContain(draft.id)
    expect(promo.map((banner) => banner.id)).not.toContain(archived.id)
    expect(promo.map((banner) => banner.id)).not.toContain(future.id)
    expect(promo.map((banner) => banner.id)).not.toContain(expired.id)
    expect(promo.map((banner) => banner.id)).not.toContain(hint.id)

    const publicP1 = promo.find((banner) => banner.id === promoP1.id)!
    expect(publicP1).toMatchObject({ auto_open: true, frequency: "daily", priority: 5, sort_order: 5, cta_url: "https://example.com/promo" })
    expect(publicP1).not.toHaveProperty("status")
    expect(publicP1).not.toHaveProperty("slot")
    expect(publicP1).not.toHaveProperty("starts_at")

    expect((await storeBanners(request, "hint")).map((banner) => banner.id)).toContain(hint.id)

    expect((await request.put(`/admin/jovy/marketing/banners/${future.id}`, { headers, data: { starts_at: new Date(now - 60_000).toISOString(), ends_at: new Date(now + 3_600_000).toISOString() } })).status()).toBe(200)
    expect((await storeBanners(request, "promo")).map((banner) => banner.id)).toContain(future.id)

    expect((await request.put(`/admin/jovy/marketing/banners/${promoP1.id}`, { headers, data: { status: "draft" } })).status()).toBe(200)
    expect((await storeBanners(request, "promo")).map((banner) => banner.id)).not.toContain(promoP1.id)

    expect((await request.post("/admin/jovy/marketing/banners/reorder", { headers, data: { ids: [promoP3.id, promoP3.id] } })).status()).toBe(400)
  } finally {
    for (const id of created) await request.delete(`/admin/jovy/marketing/banners/${id}`, { headers })
  }
})

test("administra banners promo desde el sidebar con preview, fechas, frecuencia, filtros y confirmaciones", async ({
  page,
  request,
}) => {
  const problems = collectPageProblems(page)
  const headers = await signIn(page, request)
  const prefix = unique("e2e-banner-ui")
  const titleA = `${prefix}-a`
  const titleB = `${prefix}-b`
  const editedTitle = `${titleA} editada`
  const createdIds: string[] = []

  try {
    await cleanupBanners(request, headers, "e2e-banner-ui")

    await page.goto("/app/jovy")
    await expect(page.getByRole("heading", { name: "Dashboard", level: 1 })).toBeVisible()
    await page
      .getByRole("navigation")
      .first()
      .getByRole("link", { name: "Marketing Jovy", exact: true })
      .click()
    await expect(page.getByRole("heading", { name: "Hero corporativo" })).toBeVisible()
    await page.getByRole("button", { name: "Banners", exact: true }).click()
    await expect(page.getByRole("heading", { name: "Banners y promociones" })).toBeVisible()

    await page.getByRole("button", { name: "Nuevo banner" }).click()
    await expect(page.getByRole("heading", { name: "Nuevo banner" })).toBeVisible()

    // La frecuencia y la auto-apertura existen solo para el slot promo.
    await expect(page.getByLabel("Frecuencia Banner")).toBeVisible()
    await expect(page.getByLabel("Apertura automática")).toBeVisible()
    await page.getByLabel("Slot Banner").selectOption("hint")
    await expect(page.getByLabel("Frecuencia Banner")).toBeHidden()
    await expect(page.getByLabel("Apertura automática")).toBeHidden()
    await page.getByLabel("Slot Banner").selectOption("promo")
    await expect(page.getByLabel("Frecuencia Banner")).toBeVisible()
    await expect(page.getByLabel("Apertura automática")).toBeVisible()

    await page.getByLabel("Banner título es").fill(titleA)
    await page.getByLabel("Banner título en").fill(`EN ${titleA}`)
    await page.getByLabel("Texto alternativo Banner es").fill("Alt promocional A")
    await page.getByLabel("Texto alternativo Banner en").fill("Promo alt A")
    await page.getByLabel("Banner descripción es").fill("Descripción del banner A")
    await page.getByLabel("CTA Banner").fill("/promo")
    await page.getByLabel("Frecuencia Banner").selectOption("session")
    await page.getByLabel("Apertura automática").click()
    await expect(page.getByLabel("Apertura automática")).toHaveAttribute("aria-checked", "true")
    await page.getByLabel("Prioridad Banner").fill("990")

    const now = new Date()
    const start = new Date(now.getTime() - 3_600_000)
    const end = new Date(now.getTime() + 7_200_000)
    await page.getByLabel("Inicio Banner").fill(localInput(start))

    // Validación local visible: fin anterior al inicio bloquea el guardado.
    await page.getByLabel("Fin Banner").fill(localInput(new Date(now.getTime() - 7_200_000)))
    await page.getByLabel("CTA Banner").fill("javascript:alert(1)")
    await page.getByRole("button", { name: "Crear Banner" }).click()
    await expect(page.getByText("La fecha de fin debe ser posterior a la fecha de inicio.")).toBeVisible()
    await expect(page.getByText(/Usa una ruta relativa que empiece con \/ o una URL que empiece con https:\/\//)).toBeVisible()
    // El foco se mueve al primer campo inválido (el CTA precede a las fechas).
    await expect(page.getByLabel("CTA Banner")).toBeFocused()
    expect((await adminBanners(request, headers)).some((banner) => banner.translations.es.title === titleA)).toBe(false)

    await page.getByLabel("CTA Banner").fill("/promo")
    await page.getByLabel("Fin Banner").fill(localInput(end))
    await page.locator("#banner-media").setInputFiles({
      name: "banner.png",
      mimeType: "image/png",
      buffer: await image(),
    })
    await expect(page.getByAltText("Vista previa del banner")).toBeVisible()
    await expect(page.getByAltText("Vista previa del banner")).toHaveAttribute("src", /\/static\//)

    await page.getByRole("button", { name: "Crear Banner" }).click()
    await expect(page.getByRole("heading", { name: "Banners y promociones" })).toBeVisible()

    const createdA = (await adminBanners(request, headers)).find((banner) => banner.translations.es.title === titleA)
    expect(createdA).toBeTruthy()
    createdIds.push(createdA!.id)
    expect(createdA).toMatchObject({ status: "draft", auto_open: true, frequency: "session", priority: 990, cta_url: "/promo" })
    expect(createdA!.media_file_id).toContain("jovy-marketing-")
    expect(new Date(createdA!.starts_at!).getTime()).toBe(Math.floor(start.getTime() / 60_000) * 60_000)
    expect(new Date(createdA!.ends_at!).getTime()).toBe(Math.floor(end.getTime() / 60_000) * 60_000)

    const cardA = page.getByTestId(`banner-card-${createdA!.id}`)
    await expect(cardA).toBeVisible()
    await expect(cardA.getByAltText(`Vista previa de ${titleA}`)).toBeVisible()
    await expect(cardA.getByText("Borrador", { exact: true })).toBeVisible()
    await expect(cardA.getByText("Inactivo", { exact: true })).toBeVisible()

    // Publicar exige confirmación y la ventana ya vigente lo vuelve "Activo ahora".
    await page.getByRole("button", { name: `Publicar ${titleA}` }).click()
    const publishDialog = page.getByRole("alertdialog")
    await expect(publishDialog).toBeVisible()
    await expect(publishDialog.getByText("Publicar banner", { exact: true }).first()).toBeVisible()
    await publishDialog.getByRole("button", { name: "Publicar banner" }).click()
    await expect(page.getByTestId(`banner-window-${createdA!.id}`)).toHaveText("Activo ahora")
    await expect(page.getByTestId(`banner-card-${createdA!.id}`).getByText("Publicado", { exact: true })).toBeVisible()

    await expect.poll(async () => (await storeBanners(request, "promo")).some((banner) => banner.id === createdA!.id)).toBe(true)

    // Editar fechas, frecuencia y título; el storefront recibe el cambio.
    await page.getByRole("button", { name: `Editar ${titleA}` }).click()
    await expect(page.getByRole("heading", { name: "Editar banner" })).toBeVisible()
    await expect(page.getByAltText("Vista previa del banner")).toBeVisible()
    await page.getByRole("heading", { name: "Editar banner" }).scrollIntoViewIfNeeded()
    await page.screenshot({ path: screenshotPath("06-banner-form-1440.png"), fullPage: true })
    await page.getByLabel("Banner título es").fill(editedTitle)
    await page.getByLabel("Frecuencia Banner").selectOption("daily")
    await page.getByLabel("Fin Banner").fill(localInput(new Date(now.getTime() + 10_800_000)))
    await page.getByRole("button", { name: "Guardar cambios" }).click()
    await expect(page.getByRole("heading", { name: "Banners y promociones" })).toBeVisible()
    await expect(page.getByTestId(`banner-card-${createdA!.id}`).getByText(editedTitle)).toBeVisible()
    await expect
      .poll(async () => (await storeBanners(request, "promo")).find((banner) => banner.id === createdA!.id)?.translations.es.title)
      .toBe(editedTitle)

    // Filtros: búsqueda por título y estado/slot.
    const bannerB = await createBanner(request, headers, bannerInput(titleB, { priority: 990 }))
    createdIds.push(bannerB.id)
    await openBanners(page)
    await expect(page.getByTestId(`banner-card-${bannerB.id}`)).toBeVisible()

    await page.getByLabel("Buscar banners").fill(editedTitle)
    await expect(page.getByTestId(`banner-card-${createdA!.id}`)).toBeVisible()
    await expect(page.getByTestId(`banner-card-${bannerB.id}`)).toBeHidden()

    await page.getByRole("button", { name: "Limpiar filtros" }).first().click()
    await page.getByLabel("Filtro por estado").selectOption("archived")
    await expect(page.getByTestId(`banner-card-${createdA!.id}`)).toBeHidden()
    await page.getByRole("button", { name: "Limpiar filtros" }).first().click()
    await page.getByLabel("Filtro por slot").selectOption("hint")
    await expect(page.getByTestId(`banner-card-${createdA!.id}`)).toBeHidden()
    await page.getByRole("button", { name: "Limpiar filtros" }).first().click()
    await expect(page.getByTestId(`banner-card-${createdA!.id}`)).toBeVisible()

    // Reordenar dentro de la misma prioridad (sort_order), visible en el Admin.
    const ownOrder = async () => {
      const banners = await adminBanners(request, headers)
      return banners.filter((banner) => banner.id === createdA!.id || banner.id === bannerB.id).map((banner) => banner.id)
    }
    expect(await ownOrder()).toEqual([createdA!.id, bannerB.id])
    await page.getByRole("button", { name: `Subir ${titleB}` }).click()
    await expect.poll(ownOrder).toEqual([bannerB.id, createdA!.id])

    // Cancelar una confirmación no persiste ningún cambio.
    await page.getByRole("button", { name: `Archivar ${editedTitle}` }).click()
    await expect(page.getByRole("alertdialog")).toBeVisible()
    await page.getByRole("alertdialog").getByRole("button", { name: "Cancelar" }).click()
    expect((await adminBanners(request, headers)).find((banner) => banner.id === createdA!.id)?.status).toBe("published")
    expect((await storeBanners(request, "promo")).some((banner) => banner.id === createdA!.id)).toBe(true)

    await page.getByRole("button", { name: `Eliminar ${editedTitle}` }).click()
    await expect(page.getByRole("alertdialog")).toBeVisible()
    // Escape cancela el diálogo sin ejecutar la acción (foco atrapado por Medusa).
    await page.getByRole("alertdialog").press("Escape")
    await expect(page.getByRole("alertdialog")).toBeHidden()
    expect((await adminBanners(request, headers)).some((banner) => banner.id === createdA!.id)).toBe(true)

    await cardA.screenshot({ path: screenshotPath("08-banner-card.png") })

    await page.setViewportSize({ width: 1440, height: 900 })
    await page.getByRole("heading", { name: "Banners y promociones" }).scrollIntoViewIfNeeded()
    await page.screenshot({ path: screenshotPath("04-banners-1440.png"), fullPage: true })

    // Archivar con confirmación y comprobar que Store deja de servirlo.
    await page.getByRole("button", { name: `Archivar ${editedTitle}` }).click()
    await page.getByRole("alertdialog").getByRole("button", { name: "Archivar banner" }).click()
    await expect(page.getByTestId(`banner-window-${createdA!.id}`)).toHaveText("Inactivo")
    await expect
      .poll(async () => (await adminBanners(request, headers)).find((banner) => banner.id === createdA!.id)?.status)
      .toBe("archived")
    await expect.poll(async () => (await storeBanners(request, "promo")).some((banner) => banner.id === createdA!.id)).toBe(false)

    await page.setViewportSize({ width: 375, height: 812 })
    await page.getByRole("heading", { name: "Banners y promociones" }).scrollIntoViewIfNeeded()
    await expect(page.getByRole("heading", { name: "Banners y promociones" })).toBeVisible()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow).toBeLessThanOrEqual(1)
    await page.screenshot({ path: screenshotPath("05-banners-375.png"), fullPage: true })

    // Eliminar con confirmación y cleanup de las fixtures restantes.
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.getByRole("button", { name: `Eliminar ${editedTitle}` }).click()
    await page.getByRole("alertdialog").getByRole("button", { name: "Eliminar banner" }).click()
    await expect(page.getByTestId(`banner-card-${createdA!.id}`)).toHaveCount(0)
    expect((await adminBanners(request, headers)).some((banner) => banner.id === createdA!.id)).toBe(false)

    // Formulario a 375: agrupaciones apiladas y sin desbordamiento horizontal.
    await page.getByRole("button", { name: "Nuevo banner" }).click()
    await page.setViewportSize({ width: 375, height: 812 })
    await page.getByRole("heading", { name: "Nuevo banner" }).scrollIntoViewIfNeeded()
    const formOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(formOverflow).toBeLessThanOrEqual(1)
    await page.screenshot({ path: screenshotPath("07-banner-form-375.png"), fullPage: true })
    await page.getByRole("button", { name: "Cancelar" }).click()

    expect(problems).toEqual([])
  } finally {
    for (const id of createdIds) await request.delete(`/admin/jovy/marketing/banners/${id}`, { headers })
    await cleanupBanners(request, headers, "e2e-banner-ui")
  }
})
