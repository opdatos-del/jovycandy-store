import { expect, test } from "@playwright/test"
import { mkdirSync, readFileSync } from "node:fs"
import path from "node:path"

function values(file: string) {
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

const auditDir = path.join(__dirname, "..", ".test-results", "audit-visual", "dashboard")
const number = new Intl.NumberFormat("es-MX")

type DashboardSnapshot = {
  core: { products: { count: number }; categories: { count: number } }
  content: { pages: { total: number } }
  marketing: { hero: { published: number }; banners: { published: number } }
  events: { active: number }
  brand: { gallery: { published: number }; logos: { active: number } }
  contacts: { total: { pending: number } }
}

test("JovyCandy CMS: dashboard real, rangos honestos y navegación por tarjetas", async ({
  page,
  request,
}) => {
  mkdirSync(auditDir, { recursive: true })
  const admin = values(".admin.local.env")
  const pageErrors: Error[] = []
  page.on("pageerror", (error) => pageErrors.push(error))

  expect((await request.get("/admin/jovy/dashboard")).status()).toBe(401)

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
  const token = (await auth.json()).token
  const headers = { Authorization: `Bearer ${token}` }
  const response = await request.get("/admin/jovy/dashboard", { headers })
  expect(response.status()).toBe(200)
  const dashboard = (await response.json()) as DashboardSnapshot
  expect(JSON.stringify(dashboard)).not.toContain("\"email\"")

  const sidebarLink = page.getByRole("link", { name: "JovyCandy CMS", exact: true })
  await expect(sidebarLink).toBeVisible()
  await sidebarLink.click()

  await expect(page).toHaveURL(/\/app\/jovy$/)
  await expect(page.getByRole("heading", { name: "Dashboard", level: 1 })).toBeVisible()
  await expect(page.getByTestId("jovy-stat-products")).toBeVisible({ timeout: 15_000 })

  const expectedStats = [
    ["jovy-stat-products", dashboard.core.products.count],
    ["jovy-stat-categories", dashboard.core.categories.count],
    ["jovy-stat-content", dashboard.content.pages.total],
    ["jovy-stat-hero", dashboard.marketing.hero.published],
    ["jovy-stat-banners", dashboard.marketing.banners.published],
    ["jovy-stat-events", dashboard.events.active],
    ["jovy-stat-gallery", dashboard.brand.gallery.published],
    ["jovy-stat-logos", dashboard.brand.logos.active],
    ["jovy-stat-contacts", dashboard.contacts.total.pending],
  ] as const

  for (const [testId, value] of expectedStats) {
    await expect(page.getByTestId(testId)).toHaveText(number.format(value))
  }

  await expect(page.getByTestId("jovy-dashboard-updated")).toContainText("Actualizado")
  await expect(page.getByRole("heading", { name: "Solicitudes por tipo" })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Contenido pendiente de publicación" })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Configuración CMS nueva" })).toBeVisible()

  // Rangos visibles e interactivos, sin cifras analíticas inventadas.
  for (const label of ["7 días", "30 días", "90 días", "Personalizado"]) {
    await expect(page.getByRole("radio", { name: label })).toBeVisible()
  }

  const visits = page.getByTestId("jovy-analytics-visits")
  await expect(visits).toContainText("No disponible: falta fuente analítica.")
  await expect(visits).not.toContainText(/\d/)
  await expect(page.getByTestId("jovy-analytics-top-products")).toContainText(
    "No disponible: falta fuente analítica.",
  )
  await expect(page.getByTestId("jovy-analytics-top-categories")).toContainText(
    "No disponible: falta fuente analítica.",
  )
  await expect(page.getByTestId("jovy-analytics-top-products")).not.toContainText(/\d/)
  await expect(page.getByTestId("jovy-analytics-top-categories")).not.toContainText(/\d/)

  await page.getByRole("radio", { name: "7 días" }).check({ force: true })
  await expect(page.getByTestId("jovy-analytics-period")).toContainText("Últimos 7 días")

  await page.getByRole("radio", { name: "90 días" }).check({ force: true })
  await expect(page.getByTestId("jovy-analytics-period")).toContainText("Últimos 90 días")

  await page.getByRole("radio", { name: "Personalizado" }).check({ force: true })
  await expect(page.getByLabel("Desde")).toBeVisible()
  await expect(page.getByLabel("Hasta")).toBeVisible()
  await expect(page.getByTestId("jovy-analytics-period")).toContainText("Rango personalizado")

  await page.getByRole("radio", { name: "30 días" }).check({ force: true })
  await expect(page.getByTestId("jovy-analytics-period")).toContainText("Últimos 30 días")

  // Refresco manual: vuelve a pedir el snapshot real y conserva los conteos.
  const refreshed = page.waitForResponse(
    (result) =>
      result.url().includes("/admin/jovy/dashboard") && result.request().method() === "GET",
  )
  await page.getByTestId("jovy-dashboard-refresh").click()
  expect((await refreshed).status()).toBe(200)
  await expect(page.getByTestId("jovy-dashboard-updated")).toContainText("Actualizado")
  await expect(page.getByTestId("jovy-stat-products")).toHaveText(
    number.format(dashboard.core.products.count),
  )

  // Responsive: una columna a 375 y tres columnas desde sm (1440).
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.getByTestId("jovy-card-products").scrollIntoViewIfNeeded()
  const desktopProduct = await page.getByTestId("jovy-card-products").boundingBox()
  const desktopCategory = await page.getByTestId("jovy-card-categories").boundingBox()
  expect(desktopProduct).not.toBeNull()
  expect(desktopCategory).not.toBeNull()
  expect(Math.abs((desktopProduct?.y ?? 0) - (desktopCategory?.y ?? 0))).toBeLessThan(4)
  expect((desktopProduct?.x ?? 0) < (desktopCategory?.x ?? 0)).toBe(true)
  await page.screenshot({ path: path.join(auditDir, "dashboard-1440.png"), fullPage: true })

  await page.getByTestId("jovy-analytics").scrollIntoViewIfNeeded()
  await page.screenshot({ path: path.join(auditDir, "dashboard-1440-analytics.png"), fullPage: true })

  await page.setViewportSize({ width: 375, height: 900 })
  await page.getByTestId("jovy-card-products").scrollIntoViewIfNeeded()
  const mobileProduct = await page.getByTestId("jovy-card-products").boundingBox()
  const mobileCategory = await page.getByTestId("jovy-card-categories").boundingBox()
  expect(mobileProduct).not.toBeNull()
  expect(mobileCategory).not.toBeNull()
  expect((mobileCategory?.y ?? 0) > (mobileProduct?.y ?? 0)).toBe(true)
  expect(Math.abs((mobileProduct?.x ?? 0) - (mobileCategory?.x ?? 0))).toBeLessThan(4)
  await page.screenshot({ path: path.join(auditDir, "dashboard-375.png"), fullPage: true })

  await page.getByTestId("jovy-analytics").scrollIntoViewIfNeeded()
  await page.screenshot({ path: path.join(auditDir, "dashboard-375-analytics.png"), fullPage: true })
  await page.setViewportSize({ width: 1440, height: 900 })

  const destinations = [
    { link: "Abrir productos", url: /\/app\/products$/ },
    { link: "Abrir categorías", url: /\/app\/categories$/ },
    { link: "Abrir contenido", url: /\/app\/jovy-herramientas\/content$/ },
    { link: "Abrir hero", url: /\/app\/jovy-herramientas\/marketing$/ },
    { link: "Abrir anuncios", url: /\/app\/jovy\/announcements$/ },
    { link: "Abrir eventos", url: /\/app\/jovy-herramientas\/events$/ },
    { link: "Abrir galería", url: /\/app\/jovy\/brand$/ },
    { link: "Abrir logos", url: /\/app\/jovy\/brand$/ },
    { link: "Abrir contactos", url: /\/app\/jovy-herramientas\/contacts$/ },
  ]

  for (const destination of destinations) {
    await page.getByRole("link", { name: destination.link, exact: true }).click()
    await expect(page).toHaveURL(destination.url)
    await page.goto("/app/jovy")
    await expect(page.getByRole("heading", { name: "Dashboard", level: 1 })).toBeVisible()
    await expect(page.getByTestId("jovy-stat-products")).toBeVisible({ timeout: 15_000 })
  }

  // Estructura del sidebar: 11 entradas canónicas del CMS corporativo, sin
  // duplicados comerciales. Productos y Usuarios viven en la experiencia nativa.
  const sidebar = page.getByRole("navigation").first()
  await expect(sidebar.getByRole("link", { name: "Dashboard", exact: true })).toBeVisible()
  const cmsLinks = sidebar.locator('a[href^="/app/jovy/"]')
  const cmsLabels = (await cmsLinks.allTextContents()).map((label) => label.trim())
  expect(cmsLabels.slice(0, 11)).toEqual([
    "Dashboard",
    "Categorías",
    "Nuevos Lanzamientos",
    "Casa Jovy Galería",
    "Logos",
    "Anuncios de portada",
    "Novedades",
    "Ventas Nacionales",
    "Ventas Internacionales",
    "Atención al Cliente",
    "Catálogo — Solicitudes",
  ])
  expect(cmsLabels).toHaveLength(11)
  expect(cmsLabels).not.toContain("Productos")
  expect(cmsLabels).not.toContain("Usuarios")

  // La gestión comercial y la alta de usuarios siguen accesibles en el Admin nativo.
  const nativeProducts = sidebar.getByRole("link", { name: "Products", exact: true })
  await expect(nativeProducts).toBeVisible()
  await expect(nativeProducts).toHaveAttribute("href", "/app/products")
  // Settings está al pie del sidebar, fuera del <nav> (es hermano, no hijo) y
  // del viewport: se valida presencia del enlace nativo, no visibilidad.
  // Products sí se comprueba visible y su href dentro del <nav>.
  await expect(page.getByRole("complementary").locator('a[href="/app/settings"]')).toHaveCount(1)

  const toolLabels = ["Contenido Jovy", "Eventos Jovy", "Marketing Jovy", "Contactos Jovy"]
  for (const label of toolLabels) expect(cmsLabels).not.toContain(label)

  await sidebar.getByRole("link", { name: "JovyCandy · Herramientas", exact: true }).click()
  await expect(sidebar.getByRole("link", { name: "Marketing Jovy", exact: true })).toBeVisible()
  const herramientasLinks = sidebar.locator('a[href^="/app/jovy-herramientas/"]')
  const herramientasLabels = (await herramientasLinks.allTextContents()).map((label) => label.trim())
  expect(herramientasLabels.slice(0, 4)).toEqual(toolLabels)

  expect(pageErrors).toEqual([])
})
