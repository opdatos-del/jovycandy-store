import { expect, test, type APIRequestContext, type Page } from "@playwright/test"
import { readFileSync } from "node:fs"

function values(file: string) { return Object.fromEntries(readFileSync(file, "utf8").trim().split("\n").map((line) => { const index = line.indexOf("="); return [line.slice(0, index), line.slice(index + 1)] })) }
const admin = values(".admin.local.env")
const store = values(".store.local.env")
const storeHeaders = { "x-publishable-api-key": store.MEDUSA_PUBLISHABLE_API_KEY }
const unique = (prefix: string) => `${prefix}-${Date.now()}`

async function apiHeaders(request: APIRequestContext) {
  const auth = await request.post("/auth/user/emailpass", { data: { email: admin.MEDUSA_ADMIN_EMAIL, password: admin.MEDUSA_ADMIN_PASSWORD } })
  expect(auth.status()).toBe(200)
  return { Authorization: `Bearer ${(await auth.json()).token}` }
}

async function signIn(page: Page, request: APIRequestContext) {
  await page.goto("/app/login")
  await page.getByPlaceholder("Email").fill(admin.MEDUSA_ADMIN_EMAIL)
  await page.getByPlaceholder("Password").fill(admin.MEDUSA_ADMIN_PASSWORD)
  await Promise.all([page.waitForURL(/\/app(?!\/login)/), page.getByRole("button", { name: "Continue with Email" }).click()])
  return apiHeaders(request)
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

async function cleanupBanners(request: APIRequestContext, headers: Record<string, string>, prefix = "e2e-banner") {
  const response = await request.get("/admin/jovy/marketing/banners", { headers })
  if (!response.ok()) return
  const fixtures = (await response.json()).banners.filter((banner: { id: string; translations: { es: { title: string } } }) => banner.translations.es.title.startsWith(prefix))
  for (const fixture of fixtures) await request.delete(`/admin/jovy/marketing/banners/${fixture.id}`, { headers })
}

const storeBanners = async (request: APIRequestContext, slot: string) =>
  (await (await request.get(`/store/jovy/marketing/banners/${slot}`, { headers: storeHeaders })).json()).banners as Array<Record<string, unknown> & { id: string; translations: { es: { title: string } } }>

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

test("administra Banners desde la UI con slots, edición, archivo y reordenamiento visible en Store", async ({ page, request }) => {
  const titleA = unique("e2e-banner-ui-a")
  const titleB = unique("e2e-banner-ui-b")
  const titleC = unique("e2e-banner-ui-c")
  const headers = await signIn(page, request)

  try {
    await cleanupBanners(request, headers)
    await page.goto("/app/jovy/marketing")
    await page.getByRole("button", { name: "Banners" }).click()
    await expect(page.getByRole("heading", { name: "Banners y promociones" })).toBeVisible()

    await page.getByLabel("Banner título es").fill(titleA)
    await page.getByLabel("Banner título en").fill(`EN ${titleA}`)
    await page.getByLabel("Texto alternativo Banner es").fill("Alt promocional A")
    await page.getByLabel("Texto alternativo Banner en").fill("Promo alt A")
    await page.getByLabel("CTA Banner").fill("/promo")
    await page.getByLabel("Frecuencia Banner").selectOption("session")
    await page.getByLabel("Apertura automática").check()
    await page.getByLabel("Prioridad Banner").fill("995")
    await page.getByLabel("Estado Banner").selectOption("published")
    await page.getByRole("button", { name: "Crear Banner" }).click()
    await expect(page.getByText(titleA)).toBeVisible()

    const firstBanner = (await storeBanners(request, "promo")).find((banner) => banner.translations.es.title === titleA)
    expect(firstBanner).toMatchObject({ auto_open: true, frequency: "session", cta_url: "/promo", priority: 995, sort_order: 0 })

    await page.getByLabel("Banner título es").fill(titleB)
    await page.getByLabel("Banner título en").fill(`EN ${titleB}`)
    await page.getByLabel("Texto alternativo Banner es").fill("Alt promocional B")
    await page.getByLabel("Texto alternativo Banner en").fill("Promo alt B")
    await page.getByLabel("Prioridad Banner").fill("995")
    await page.getByLabel("Estado Banner").selectOption("published")
    await page.getByRole("button", { name: "Crear Banner" }).click()
    await expect(page.getByText(titleB)).toBeVisible()

    await page.getByLabel("Banner título es").fill(titleC)
    await page.getByLabel("Banner título en").fill(`EN ${titleC}`)
    await page.getByLabel("Texto alternativo Banner es").fill("Alt promocional C")
    await page.getByLabel("Texto alternativo Banner en").fill("Promo alt C")
    await page.getByLabel("Prioridad Banner").fill("1000")
    await page.getByLabel("Estado Banner").selectOption("published")
    await page.getByRole("button", { name: "Crear Banner" }).click()
    await expect(page.getByText(titleC)).toBeVisible()

    // Only this run's fixtures are compared: other banners may already exist in
    // the shared development database without affecting the assertions.
    const ownTitles = [titleA, titleB, titleC]
    const ownOrder = async () => (await storeBanners(request, "promo"))
      .map((banner) => banner.translations.es.title)
      .filter((title) => ownTitles.includes(title))

    expect(await ownOrder()).toEqual([titleC, titleA, titleB])

    await page.locator("li").filter({ hasText: titleB }).getByRole("button", { name: "Subir" }).click()
    await expect.poll(ownOrder).toEqual([titleC, titleB, titleA])

    // C keeps its explicit higher priority even when it is moved down, because
    // reorder only rewrites sort_order.
    await page.locator("li").filter({ hasText: titleC }).getByRole("button", { name: "Bajar" }).click()
    await expect.poll(ownOrder).toEqual([titleC, titleB, titleA])

    await page.reload()
    await page.getByRole("button", { name: "Banners" }).click()
    await page.locator("li").filter({ hasText: titleA }).getByRole("button", { name: "Editar" }).click()
    const editedTitle = `${titleA} editado`
    await page.getByLabel("Banner título es").fill(editedTitle)
    await page.getByRole("button", { name: "Guardar cambios" }).click()
    await expect(page.getByText(editedTitle)).toBeVisible()
    expect((await storeBanners(request, "promo")).map((banner) => banner.translations.es.title)).toContain(editedTitle)

    await page.locator("li").filter({ hasText: titleB }).getByRole("button", { name: "Archivar" }).click()
    await expect.poll(async () => {
      const titles = (await storeBanners(request, "promo")).map((banner) => banner.translations.es.title)
      return titles.includes(titleB)
    }).toBe(false)
    await page.screenshot({ path: ".test-results/jovy-banners-marketing.png", fullPage: true })
  } finally {
    await cleanupBanners(request, headers)
  }
})
