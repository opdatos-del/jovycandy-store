import { expect, test, type APIRequestContext, type Page } from "@playwright/test"
import { readFileSync } from "node:fs"
import sharp from "sharp"

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

async function image(format: "png" | "jpeg" | "webp", width = 24, height = 16) {
  const pipeline = sharp({ create: { width, height, channels: 3, background: { r: 0, g: 175, b: 170 } } })
  return format === "png" ? pipeline.png().toBuffer() : format === "jpeg" ? pipeline.jpeg().toBuffer() : pipeline.webp().toBuffer()
}

const uploadImage = (request: APIRequestContext, headers: Record<string, string>, buffer: Buffer, mimeType: string, fileName = "hero") =>
  request.post("/admin/jovy/marketing/media", { headers, multipart: { files: { name: fileName, mimeType, buffer } } })

async function createHero(request: APIRequestContext, headers: Record<string, string>, title: string, extra: Record<string, unknown> = {}) {
  const response = await request.post("/admin/jovy/marketing/hero", {
    headers,
    data: {
      translations: { es: { title }, en: { title: `EN ${title}` } },
      status: "draft",
      enabled: true,
      sort_order: 0,
      ...extra,
    },
  })
  expect(response.status()).toBe(201)
  return (await response.json()).hero_item
}

async function cleanupHeroes(request: APIRequestContext, headers: Record<string, string>, prefix: string) {
  const list = await request.get("/admin/jovy/marketing/hero", { headers })
  if (!list.ok()) return
  const fixtures = (await list.json()).hero_items.filter((item: { id: string; translations: { es: { title: string } } }) => item.translations.es.title.startsWith(prefix))
  for (const fixture of fixtures) await request.delete(`/admin/jovy/marketing/hero/${fixture.id}`, { headers })
}

test("valida contratos HTTP y multimedia real del Hero", async ({ request }) => {
  const headers = await apiHeaders(request)
  try {
    expect((await request.get("/admin/jovy/marketing/hero")).status()).toBe(401)

    const base = { translations: { es: { title: "Hero DEMO" }, en: { title: "DEMO hero" } } }
    const invalidPayloads = [
      {},
      { ...base, translations: { es: { title: "Hero DEMO" } } },
      { ...base, cta_url: "javascript:alert(1)" },
      { ...base, cta_url: "data:text/html,hola" },
      { ...base, starts_at: "2026-12-02T00:00:00.000Z", ends_at: "2026-12-01T00:00:00.000Z" },
      { ...base, status: "pending" },
      { ...base, background_color: "teal" },
    ]
    for (const payload of invalidPayloads) {
      expect((await request.post("/admin/jovy/marketing/hero", { headers, data: payload })).status()).toBe(400)
    }

    const png = await image("png")
    const jpeg = await image("jpeg")
    const webp = await image("webp")
    for (const [buffer, mimeType] of [[png, "image/png"], [jpeg, "image/jpeg"], [webp, "image/webp"]] as const) {
      const uploaded = await uploadImage(request, headers, buffer, mimeType)
      expect(uploaded.status(), `subida ${mimeType}`).toBe(201)
      const file = (await uploaded.json()).file
      expect(file.id).toContain("jovy-marketing-")
      expect(file.url).toContain("/static/")
    }

    const oversized = Buffer.concat([png, Buffer.alloc(5 * 1024 * 1024)])
    expect((await uploadImage(request, headers, oversized, "image/png")).status()).toBeGreaterThanOrEqual(400)

    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>')
    expect((await uploadImage(request, headers, svg, "image/svg+xml", "hero.svg")).status()).toBe(400)

    const gif = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00])
    expect((await uploadImage(request, headers, gif, "image/png", "fake.png")).status()).toBe(400)
    expect((await uploadImage(request, headers, png, "image/jpeg", "mismatch.jpg")).status()).toBe(400)

    const corrupted = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from("not-a-real-png")])
    expect((await uploadImage(request, headers, corrupted, "image/png", "corrupted.png")).status()).toBe(400)

    expect((await request.post("/admin/jovy/marketing/media", { headers })).status()).toBe(400)
  } finally {
    await cleanupHeroes(request, headers, "e2e-hero-media")
  }
})

test("administra Hero desde la UI, persiste media/ajustes y reordena hacia la Store API", async ({ page, request }) => {
  const titleA = unique("e2e-hero-ui-a")
  const titleB = unique("e2e-hero-ui-b")
  const headers = await signIn(page, request)
  let heroA = ""
  let heroB = ""
  let originalColor = "#00AFAA"

  try {
    await cleanupHeroes(request, headers, "e2e-hero")
    const settings = await request.get("/admin/jovy/marketing/hero/settings", { headers })
    originalColor = (await settings.json()).hero_settings.background_color ?? originalColor

    await page.goto("/app/jovy/marketing")
    await expect(page.getByRole("heading", { name: "Hero corporativo" })).toBeVisible()
    await page.getByLabel("Hero título es").fill(titleA)
    await page.getByLabel("Hero título en").fill(`EN ${titleA}`)
    await page.getByLabel("CTA Hero").fill("/tienda")
    await page.locator("#hero-media").setInputFiles({ name: "hero.png", mimeType: "image/png", buffer: await image("png", 48, 32) })
    await expect(page.getByAltText("Vista previa Hero")).toBeVisible()
    await page.getByRole("button", { name: "Crear Hero" }).click()
    await expect(page.getByText(titleA)).toBeVisible()

    const listed = await (await request.get("/admin/jovy/marketing/hero", { headers })).json()
    const createdA = listed.hero_items.find((item: { translations: { es: { title: string } } }) => item.translations.es.title === titleA)
    heroA = createdA.id
    expect(createdA.media_file_id).toContain("jovy-marketing-")

    const rowA = page.locator("li").filter({ hasText: titleA })
    await rowA.getByRole("button", { name: "Publicar" }).click()
    await expect(rowA.getByText("published")).toBeVisible()

    await page.getByLabel("Color global Hero").fill("#112233")
    await page.getByRole("button", { name: "Guardar", exact: true }).click()
    await expect(page.getByText("Color global guardado.")).toBeVisible()

    await page.reload()
    await expect(page.getByLabel("Color global Hero")).toHaveValue("#112233")
    await page.locator("li").filter({ hasText: titleA }).getByRole("button", { name: "Editar" }).click()
    await expect(page.getByAltText("Vista previa Hero")).toBeVisible()
    await expect(page.getByAltText("Vista previa Hero")).toHaveAttribute("src", /\/static\//)

    const heroBItem = await createHero(request, headers, titleB, { status: "published", media_file_id: createdA.media_file_id, cta_url: "https://example.com/hero-b" })
    heroB = heroBItem.id

    await page.reload()
    await page.locator("li").filter({ hasText: titleB }).getByRole("button", { name: "Subir" }).click()
    await expect.poll(async () => {
      const items = (await (await request.get("/admin/jovy/marketing/hero", { headers })).json()).hero_items
      return items.findIndex((item: { id: string }) => item.id === heroB) < items.findIndex((item: { id: string }) => item.id === heroA)
    }).toBe(true)

    const storeItems = await (await request.get("/store/jovy/marketing/hero", { headers: storeHeaders })).json()
    const orderA = storeItems.hero_items.findIndex((item: { id: string }) => item.id === heroA)
    const orderB = storeItems.hero_items.findIndex((item: { id: string }) => item.id === heroB)
    expect(orderB).toBeGreaterThanOrEqual(0)
    expect(orderA).toBeGreaterThanOrEqual(0)
    expect(orderB).toBeLessThan(orderA)
    expect(storeItems.hero_items[orderB].media_url).toContain("/static/")

    await page.screenshot({ path: ".test-results/jovy-hero-marketing.png", fullPage: true })

    await page.locator("li").filter({ hasText: titleA }).getByRole("button", { name: "Archivar" }).click()
    await expect.poll(async () => {
      const response = await request.get("/store/jovy/marketing/hero", { headers: storeHeaders })
      return (await response.json()).hero_items.some((item: { id: string }) => item.id === heroA)
    }).toBe(false)
  } finally {
    await request.put("/admin/jovy/marketing/hero/settings", { headers, data: { background_color: originalColor } })
    if (heroA) await request.delete(`/admin/jovy/marketing/hero/${heroA}`, { headers })
    if (heroB) await request.delete(`/admin/jovy/marketing/hero/${heroB}`, { headers })
  }
})

test("asigna producto A→B→null, es idempotente y conserva el vínculo ante error", async ({ request }) => {
  const prefix = unique("e2e-hero-product")
  const headers = await apiHeaders(request)
  let heroId = ""

  try {
    const products = (await (await request.get("/admin/products?limit=2", { headers })).json()).products
    expect(products.length).toBeGreaterThanOrEqual(2)
    const [productA, productB] = products

    const hero = await createHero(request, headers, prefix, { status: "published" })
    heroId = hero.id

    expect((await (await request.get(`/admin/jovy/marketing/hero/${heroId}/product`, { headers })).json()).product).toBeNull()

    const linkedA = await request.put(`/admin/jovy/marketing/hero/${heroId}/product`, { headers, data: { product_id: productA.id } })
    expect(linkedA.status()).toBe(200)
    expect((await linkedA.json()).changed).toBe(true)
    expect((await (await request.get(`/admin/jovy/marketing/hero/${heroId}/product`, { headers })).json()).product.id).toBe(productA.id)

    const idempotent = await request.put(`/admin/jovy/marketing/hero/${heroId}/product`, { headers, data: { product_id: productA.id } })
    expect(idempotent.status()).toBe(200)
    expect((await idempotent.json()).changed).toBe(false)

    const linkedB = await request.put(`/admin/jovy/marketing/hero/${heroId}/product`, { headers, data: { product_id: productB.id } })
    expect((await linkedB.json()).changed).toBe(true)
    expect((await (await request.get(`/admin/jovy/marketing/hero/${heroId}/product`, { headers })).json()).product.id).toBe(productB.id)

    expect((await request.put(`/admin/jovy/marketing/hero/${heroId}/product`, { headers, data: { product_id: "prod_missing_e2e" } })).status()).toBe(404)
    expect((await (await request.get(`/admin/jovy/marketing/hero/${heroId}/product`, { headers })).json()).product.id).toBe(productB.id)

    const unlinked = await request.put(`/admin/jovy/marketing/hero/${heroId}/product`, { headers, data: { product_id: null } })
    expect((await unlinked.json()).changed).toBe(true)
    expect((await (await request.get(`/admin/jovy/marketing/hero/${heroId}/product`, { headers })).json()).product).toBeNull()
  } finally {
    if (heroId) {
      await request.put(`/admin/jovy/marketing/hero/${heroId}/product`, { headers, data: { product_id: null } })
      await request.delete(`/admin/jovy/marketing/hero/${heroId}`, { headers })
    }
  }
})
