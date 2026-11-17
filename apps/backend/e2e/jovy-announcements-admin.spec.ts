import { expect, test, type APIRequestContext, type Page } from "@playwright/test"
import { mkdirSync } from "node:fs"
import path from "node:path"
import sharp from "sharp"
import {
  collectPageProblems,
  demoValue,
  readEnvFile,
  signIn,
} from "./jovy-block2-helpers"

// El entorno local comparte el servidor de desarrollo con otras sesiones del
// repo; se amplía el tiempo y se permite un reintento para absorber reinicios.
test.describe.configure({ timeout: 120_000, retries: 1 })

type AnnouncementSettings = {
  corporate_message_es: string | null
  corporate_message_en: string | null
}

type Banner = {
  id: string
  slot: "promo" | "hint"
  status: "draft" | "published" | "archived"
  enabled: boolean
  priority: number
  media_file_id: string | null
  starts_at: string | null
  ends_at: string | null
  translations: { es: { title: string; alt: string }; en: { title: string; alt: string } }
}

const auditDir = path.join(__dirname, "..", ".test-results", "audit-visual", "announcements")

function screenshotPath(name: string) {
  mkdirSync(auditDir, { recursive: true })
  return path.join(auditDir, name)
}

const storeHeaders = () => ({
  "x-publishable-api-key": readEnvFile(".store.local.env").MEDUSA_PUBLISHABLE_API_KEY,
})

const unique = (prefix: string) => `${prefix}-${Date.now()}`

async function announcementSettings(request: APIRequestContext, headers: Record<string, string>) {
  const response = await request.get("/admin/jovy/announcements/settings", { headers })
  expect(response.status()).toBe(200)
  return (await response.json()).announcement_settings as AnnouncementSettings
}

async function listBanners(request: APIRequestContext, headers: Record<string, string>) {
  const response = await request.get("/admin/jovy/marketing/banners", { headers })
  expect(response.status()).toBe(200)
  return (await response.json()).banners as Banner[]
}

function bannerInput(title: string, extra: Record<string, unknown> = {}) {
  return {
    slot: "promo",
    translations: {
      es: { title, alt: `Alt ${title}` },
      en: { title: `EN ${title}`, alt: `EN alt ${title}` },
    },
    status: "published",
    enabled: true,
    auto_open: true,
    frequency: "daily",
    priority: 0,
    sort_order: 0,
    cta_url: null,
    starts_at: null,
    ends_at: null,
    ...extra,
  }
}

async function createBanner(
  request: APIRequestContext,
  headers: Record<string, string>,
  input: Record<string, unknown>,
) {
  const response = await request.post("/admin/jovy/marketing/banners", { headers, data: input })
  expect(response.status()).toBe(201)
  return (await response.json()).banner as Banner
}

async function uploadImage(request: APIRequestContext, headers: Record<string, string>) {
  const buffer = await sharp({ create: { width: 64, height: 40, channels: 4, background: { r: 0, g: 175, b: 170, alpha: 1 } } })
    .png()
    .toBuffer()
  const response = await request.post("/admin/jovy/marketing/media", {
    headers,
    multipart: { files: { name: "announcement.png", mimeType: "image/png", buffer } },
  })
  expect(response.status()).toBe(201)
  return (await response.json()).file as { id: string; url: string }
}

async function cleanupBanners(
  request: APIRequestContext,
  headers: Record<string, string>,
  prefix: string,
) {
  for (const banner of await listBanners(request, headers).catch(() => [] as Banner[])) {
    if (banner.translations.es.title.startsWith(prefix)) {
      await request.delete(`/admin/jovy/marketing/banners/${banner.id}`, { headers })
    }
  }
}

function summarize(banners: Banner[], now: number) {
  const promo = banners.filter((banner) => banner.slot === "promo")
  return promo.reduce(
    (summary, banner) => {
      summary.total += 1
      if (banner.status === "published") summary.published += 1
      if (banner.enabled) summary.enabled += 1
      if (banner.status === "published" && banner.enabled) {
        const start = banner.starts_at ? new Date(banner.starts_at).getTime() : null
        const end = banner.ends_at ? new Date(banner.ends_at).getTime() : null
        if (start !== null && now < start) summary.scheduled += 1
        else if (end !== null && now > end) summary.expired += 1
        else summary.active += 1
      }
      return summary
    },
    { total: 0, published: 0, enabled: 0, active: 0, scheduled: 0, expired: 0 },
  )
}

async function openAnnouncements(page: Page) {
  await page.goto("/app/jovy")
  await expect(page.getByRole("heading", { name: "Dashboard", level: 1 })).toBeVisible()
  await page
    .getByRole("navigation")
    .first()
    .getByRole("link", { name: "Anuncios de portada", exact: true })
    .click()
  await expect(page).toHaveURL(/\/app\/jovy\/announcements$/)
  await expect(page.getByRole("heading", { name: "Anuncios de portada", level: 1 })).toBeVisible()
}

test("resume el modal promo desde el sidebar, enlaza al gestor y persiste el mensaje corporativo ES/EN", async ({
  page,
  request,
}) => {
  const problems = collectPageProblems(page)
  const headers = await signIn(page, request)
  const original = await announcementSettings(request, headers)
  const prefix = unique("e2e-announce-promo")
  const created: string[] = []

  try {
    await cleanupBanners(request, headers, "e2e-announce-promo")

    const now = Date.now()
    const media = await uploadImage(request, headers)
    const active = await createBanner(
      request,
      headers,
      bannerInput(`${prefix}-activo`, {
        priority: 900,
        media_file_id: media.id,
        starts_at: new Date(now - 3_600_000).toISOString(),
        ends_at: new Date(now + 7_200_000).toISOString(),
      }),
    )
    const scheduled = await createBanner(
      request,
      headers,
      bannerInput(`${prefix}-programado`, {
        priority: 800,
        starts_at: new Date(now + 86_400_000).toISOString(),
      }),
    )
    created.push(active.id, scheduled.id)

    const expected = summarize(await listBanners(request, headers), now)

    await openAnnouncements(page)

    await expect(page.getByRole("heading", { name: "A. Modal de portada" })).toBeVisible()
    await expect(page.getByRole("heading", { name: "B. Mensaje corporativo" })).toBeVisible()
    await expect(page.getByRole("heading", { name: "Gestión del modal (slot promo)" })).toBeVisible()
    await expect(page.getByTestId("banner-manager")).toBeVisible()
    await expect(page.getByLabel("Filtro por slot")).toHaveValue("promo")

    await expect(page.getByTestId("promo-total")).toHaveText(String(expected.total))
    await expect(page.getByTestId("promo-published")).toHaveText(String(expected.published))
    await expect(page.getByTestId("promo-enabled")).toHaveText(String(expected.enabled))
    await expect(page.getByTestId("promo-active")).toHaveText(String(expected.active))
    await expect(page.getByTestId("promo-scheduled")).toHaveText(String(expected.scheduled))
    await expect(page.getByTestId("promo-expired")).toHaveText(String(expected.expired))

    // El banner activo tiene media real del File Module y es el primero por prioridad.
    const previewList = page.getByRole("list", { name: "Vistas previas de banners promo" })
    const preview = previewList.getByAltText(`Vista previa de ${active.translations.es.title}`)
    await expect(preview).toBeVisible()
    await expect(preview).toHaveAttribute("src", /\/static\//)
    await expect(page.getByText("Activo ahora").first()).toBeVisible()

    // El gestor compartido está montado en la sección A: permite el CRUD directo
    // sin salir de Anuncios y sin duplicar formulario ni endpoints.
    await expect(page.getByTestId(`banner-card-${active.id}`)).toBeVisible()
    await page.getByTestId("banner-manager").getByRole("button", { name: "Nuevo banner" }).click()
    await expect(page.getByTestId("banner-form-panel")).toBeVisible()
    await page.getByTestId("banner-form-panel").getByRole("button", { name: "Cancelar" }).click()
    await expect(page.getByTestId("banner-manager")).toBeVisible()
    await expect(page.getByTestId(`banner-card-${active.id}`)).toBeVisible()

    await page.setViewportSize({ width: 1440, height: 900 })
    await page.screenshot({ path: screenshotPath("01-announcements-1440.png"), fullPage: true })

    // Acceso directo al gestor: la pestaña Banners abre filtrada al slot promo.
    const promoLink = page.getByRole("link", { name: "Abrir Banners (slot promo)" })
    await expect(promoLink).toHaveAttribute("href", "/app/jovy-herramientas/marketing?tab=banners&slot=promo")
    await promoLink.click()
    await expect(page).toHaveURL(/\/app\/jovy-herramientas\/marketing\?tab=banners&slot=promo$/)
    await expect(page.getByRole("heading", { name: "Banners y promociones" })).toBeVisible()
    await expect(page.getByLabel("Filtro por slot")).toHaveValue("promo")
    await expect(page.getByTestId(`banner-card-${active.id}`)).toBeVisible()
    await expect(page.getByTestId(`banner-card-${scheduled.id}`)).toBeVisible()
    await page.screenshot({ path: screenshotPath("02-marketing-promo.png"), fullPage: true })

    // Bloque B: reemplazo completo ES/EN, sin tocar el banner promo.
    await page.goto("/app/jovy/announcements")
    await expect(page.getByRole("heading", { name: "Anuncios de portada", level: 1 })).toBeVisible()

    const demoEs = demoValue("Mensaje corporativo ES")
    const demoEn = demoValue("Corporate message EN")

    await page.getByLabel("Mensaje corporativo ES").fill(demoEs)
    await page.getByLabel("Mensaje corporativo EN").fill(demoEn)
    await page.getByRole("button", { name: "Guardar mensaje corporativo" }).click()

    await expect
      .poll(async () => (await announcementSettings(request, headers)).corporate_message_es)
      .toBe(demoEs)
    await expect
      .poll(async () => (await announcementSettings(request, headers)).corporate_message_en)
      .toBe(demoEn)

    await page.reload()
    await expect(page.getByLabel("Mensaje corporativo ES")).toHaveValue(demoEs)
    await expect(page.getByLabel("Mensaje corporativo EN")).toHaveValue(demoEn)
    await expect(page.getByTestId("announcement-persisted-es")).toHaveText(demoEs)
    await expect(page.getByTestId("announcement-persisted-en")).toHaveText(demoEn)
    // El layout del Admin desplaza su propio contenedor; hay que llevar el
    // bloque B al viewport antes de capturarlo (fullPage no lo incluye).
    await page.getByRole("heading", { name: "B. Mensaje corporativo" }).scrollIntoViewIfNeeded()
    await page.screenshot({ path: screenshotPath("03-announcements-corporate.png"), fullPage: true })

    const storeResponse = await request.get("/store/jovy/announcements/settings", { headers: storeHeaders() })
    expect(storeResponse.status()).toBe(200)
    expect((await storeResponse.json()).settings).toMatchObject({
      corporate_message_es: demoEs,
      corporate_message_en: demoEn,
    })

    // Vaciar un idioma lo oculta (null) sin afectar al otro.
    await page.getByLabel("Mensaje corporativo EN").fill("")
    await page.getByRole("button", { name: "Guardar mensaje corporativo" }).click()
    await expect
      .poll(async () => (await announcementSettings(request, headers)).corporate_message_en)
      .toBeNull()
    await page.reload()
    await expect(page.getByLabel("Mensaje corporativo ES")).toHaveValue(demoEs)
    await expect(page.getByTestId("announcement-persisted-en")).toHaveText("Sin mensaje (oculto)")

    // 375: los bloques se apilan y no hay desbordamiento horizontal.
    await page.setViewportSize({ width: 375, height: 812 })
    await expect(page.getByRole("heading", { name: "A. Modal de portada" })).toBeVisible()
    await expect(page.getByRole("heading", { name: "B. Mensaje corporativo" })).toBeVisible()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow).toBeLessThanOrEqual(1)
    await page.screenshot({ path: screenshotPath("04-announcements-375.png"), fullPage: true })

    expect(problems).toEqual([])
  } finally {
    await request.put("/admin/jovy/announcements/settings", {
      headers,
      data: {
        corporate_message_es: original.corporate_message_es,
        corporate_message_en: original.corporate_message_en,
      },
    })
    for (const id of created) await request.delete(`/admin/jovy/marketing/banners/${id}`, { headers })
    await cleanupBanners(request, headers, "e2e-announce-promo")
  }
})
