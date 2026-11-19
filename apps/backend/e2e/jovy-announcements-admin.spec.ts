import { expect, test, type APIRequestContext, type Page } from "@playwright/test"
import { mkdirSync } from "node:fs"
import path from "node:path"
import sharp from "sharp"
import { collectPageProblems, signIn } from "./jovy-block2-helpers"

// El entorno local comparte el servidor de desarrollo con otras sesiones del
// repo; se amplía el tiempo y se permite un reintento para absorber reinicios.
test.describe.configure({ timeout: 120_000, retries: 1 })

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

const unique = (prefix: string) => `${prefix}-${Date.now()}`

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

test("administra el modal promo desde el sidebar", async ({ page, request }) => {
  const problems = collectPageProblems(page)
  const headers = await signIn(page, request)
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

    await openAnnouncements(page)

    await expect(page.getByRole("heading", { name: "Banners y anuncios" })).toBeVisible()

    // El gestor embebido conserva buscador, filtro de ubicación y acciones, sin
    // repetir el título del gestor ni sus insignias de conteo.
    await expect(page.getByTestId("banner-manager")).toBeVisible()
    await expect(page.getByLabel("¿Dónde aparece?")).toBeVisible()
    await expect(page.getByLabel("¿Dónde aparece?").locator('option[value="all"]')).toHaveText("Todos")
    await expect(page.getByLabel("¿Dónde aparece?")).toHaveValue("all")
    await expect(page.getByRole("button", { name: "Limpiar filtros" })).toHaveCount(0)
    await expect(page.getByRole("link", { name: /Abrir Banners/ })).toHaveCount(0)

    // El banner activo tiene media real del File Module y se ve en su tarjeta,
    // junto al estado de ventana que calcula el gestor.
    const activeCard = page.getByTestId(`banner-card-${active.id}`)
    const activeImage = activeCard.getByAltText(`Vista previa de ${active.translations.es.title}`)
    await expect(activeImage).toBeVisible()
    await expect(activeImage).toHaveAttribute("src", /\/static\//)
    await expect(activeCard.getByText("Activo ahora", { exact: true })).toBeVisible()
    // Sin filtros activos el listado muestra los dos tipos: el programado sigue
    // visible aunque todavía no esté en ventana.
    await expect(page.getByTestId(`banner-card-${scheduled.id}`)).toBeVisible()

    // El único CRUD de los dos tipos está montado aquí: no hay formulario ni
    // endpoints duplicados.
    await page.getByTestId("banner-manager").getByRole("button", { name: "Nuevo banner" }).click()
    await expect(page.getByTestId("banner-form-panel")).toBeVisible()
    // El nuevo anuncio puede elegir su ubicación desde el mismo formulario.
    await expect(page.getByLabel("¿Dónde aparece?")).toBeVisible()
    await expect(page.getByLabel("Duración en pantalla")).toHaveValue("8")
    await page.getByTestId("banner-form-panel").getByRole("button", { name: "Cancelar" }).click()
    await expect(page.getByTestId("banner-manager")).toBeVisible()
    await expect(page.getByTestId(`banner-card-${active.id}`)).toBeVisible()

    await page.setViewportSize({ width: 1440, height: 900 })
    await page.screenshot({ path: screenshotPath("01-announcements-1440.png"), fullPage: true })

    // 375: las tarjetas se apilan y no hay desbordamiento horizontal.
    await page.setViewportSize({ width: 375, height: 812 })
    await expect(page.getByRole("heading", { name: "Banners y anuncios" })).toBeVisible()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow).toBeLessThanOrEqual(1)
    await page.screenshot({ path: screenshotPath("04-announcements-375.png"), fullPage: true })

    expect(problems).toEqual([])
  } finally {
    for (const id of created) await request.delete(`/admin/jovy/marketing/banners/${id}`, { headers })
    await cleanupBanners(request, headers, "e2e-announce-promo")
  }
})
