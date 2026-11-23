import { expect, test, type Page } from "@playwright/test"

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }))
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1)
}

test.describe("catálogo oficial", () => {
  test("catálogo, búsqueda, limpieza y móvil", async ({ page }) => {
    await page.goto("/es/catalogo")

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
    await expect(page.getByRole("complementary", { name: "Filtrar por" })).toBeVisible()
    await expect(page.getByLabel("Buscar productos")).toBeVisible()

    const cards = page.locator(".catalog-card")
    const initialCount = await cards.count()
    expect(initialCount).toBeGreaterThan(0)
    await expect(page.getByRole("link", { name: "Ver producto", exact: true })).toHaveCount(initialCount)
    await expect(page.getByRole("button", { name: "Solicitar información" })).toHaveCount(0)
    await expectNoHorizontalOverflow(page)

    await page.getByLabel("Buscar productos").fill("texto sin coincidencias")
    await expect(page.getByRole("heading", { name: "No encontramos productos" })).toBeVisible()
    const emptyBox = await page.locator(".catalog-empty").boundingBox()
    const sidebarBox = await page.locator(".catalog-sidebar").boundingBox()
    expect(emptyBox).not.toBeNull()
    expect(sidebarBox).not.toBeNull()
    expect(Math.abs(emptyBox!.y - sidebarBox!.y)).toBeLessThan(40)
    await page.getByRole("link", { name: "Ver todos los productos" }).click()
    await expect(cards).toHaveCount(initialCount)

    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.reload()
    const columns = await page.locator(".catalog-grid").evaluate((grid) =>
      getComputedStyle(grid).gridTemplateColumns.split(" ").length,
    )
    expect(columns).toBe(6)
    const sidebarPosition = await page
      .locator(".catalog-sidebar")
      .evaluate((sidebar) => getComputedStyle(sidebar).position)
    expect(sidebarPosition).toBe("sticky")

    await page.setViewportSize({ width: 375, height: 812 })
    await page.reload()
    await expectNoHorizontalOverflow(page)
    await expect(page.getByRole("button", { name: /^Filtros/ })).toBeVisible()
    await page.getByRole("button", { name: /^Filtros/ }).click()
    await expect(page.getByRole("dialog", { name: "Filtrar por" })).toBeVisible()
    await page.getByRole("button", { name: "Cerrar filtros" }).click()
  })

  test("mantiene la versión en inglés", async ({ page }) => {
    await page.goto("/en/catalogo")
    await expect(page.getByRole("heading", { level: 1, name: "Gummies for every craving" })).toBeVisible()
    await expect(page.getByLabel("Search products")).toBeVisible()
    await expectNoHorizontalOverflow(page)
  })

  test("el detalle conserva la identidad y vuelve al catálogo", async ({ page }) => {
    await page.goto("/es/catalogo")
    const href = await page.locator(".catalog-card__action").first().getAttribute("href")
    expect(href).toBeTruthy()

    await page.goto(href as string)
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
    await expect(
      page.getByRole("navigation", { name: "Breadcrumb" }),
    ).toContainText("Catálogo")
    await expect(page.locator(".product-specs")).toBeVisible()
    await expect(page.getByRole("link", { name: "Volver al catálogo" })).toBeVisible()
    await expectNoHorizontalOverflow(page)

    await page.setViewportSize({ width: 375, height: 812 })
    await page.reload()
    await expectNoHorizontalOverflow(page)
  })

  test("producto no encontrado responde 404 y se mantiene alineado", async ({ page }) => {
    const response = await page.goto("/es/productos/producto-inexistente")
    expect(response?.status()).toBe(404)
    await expect(
      page.getByRole("heading", { level: 1, name: "Producto no encontrado" }),
    ).toBeVisible()
    await expect(page.getByRole("link", { name: "Ver catálogo" })).toBeVisible()
    await expect(page.getByRole("main").getByRole("link", { name: "Ir al inicio" })).toBeVisible()
    await expectNoHorizontalOverflow(page)

    await page.setViewportSize({ width: 375, height: 812 })
    await page.reload()
    await expectNoHorizontalOverflow(page)
  })
})
