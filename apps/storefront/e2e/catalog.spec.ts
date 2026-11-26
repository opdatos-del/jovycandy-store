import { expect, test, type Page } from "@playwright/test"

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }))
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1)
}

test.describe("catálogo Medusa", () => {
  test("catálogo, búsqueda, limpieza y móvil", async ({ page }) => {
    await page.goto("/es/catalogo")

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
    await expect(page.getByRole("complementary", { name: "Filtrar por" })).toBeVisible()
    await expect(page.getByLabel("Buscar productos")).toBeVisible()

    const cards = page.locator(".catalog-card")
    await expect(cards).toHaveCount(12)
    const countText = await page.locator(".catalog-count").textContent()
    const totalProducts = Number.parseInt(countText ?? "", 10)
    expect(totalProducts).toBeGreaterThanOrEqual(35)
    await expect(page.locator(".catalog-count")).toHaveText(`${totalProducts} productos`)
    await expect(page.locator(".catalog-card__link")).toHaveCount(12)
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
    await expect(cards).toHaveCount(12)
    await page.getByRole("button", { name: "Página 3" }).click()
    const thirdPageCount = await cards.count()
    expect(thirdPageCount).toBeGreaterThan(0)
    expect(thirdPageCount).toBeLessThanOrEqual(12)
    await expect(page.locator(".catalog-count")).toHaveText(`${totalProducts} productos`)

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

    await page.setViewportSize({ width: 768, height: 1024 })
    await page.reload()
    await expect(cards).toHaveCount(12)
    await expectNoHorizontalOverflow(page)
    const tabletColumns = await page.locator(".catalog-grid").evaluate((grid) =>
      getComputedStyle(grid).gridTemplateColumns.split(" ").length,
    )
    expect(tabletColumns).toBe(3)
    await expect(page.getByRole("button", { name: /^Filtros/ })).toBeVisible()

    await page.setViewportSize({ width: 375, height: 812 })
    await page.reload()
    await expectNoHorizontalOverflow(page)
    await expect(page.getByRole("button", { name: /^Filtros/ })).toBeVisible()
    await page.getByRole("button", { name: /^Filtros/ }).click()
    await expect(page.getByRole("dialog", { name: "Filtrar por" })).toBeVisible()
    await page.getByRole("button", { name: "Cerrar filtros" }).click()
  })

  test("facetas, paginación y enlace de salto", async ({ page }) => {
    await page.goto("/es/catalogo")
    await page.keyboard.press("Tab")
    const skip = page.getByRole("link", { name: "Saltar al contenido" })
    await expect(skip).toBeFocused()
    await page.keyboard.press("Enter")
    await expect(page.getByRole("main")).toBeFocused()

    await page.getByLabel("Buscar productos").fill("Piñateros")
    const pinaterosCount = Number.parseInt(
      (await page.locator(".catalog-count").textContent()) ?? "",
      10,
    )
    expect(pinaterosCount).toBeGreaterThanOrEqual(5)
    await expect(page.locator(".catalog-card")).toHaveCount(pinaterosCount)
    await expect(page.getByText("Ositos Surtidos 12 Sabores")).toHaveCount(0)

    await page.getByRole("button", { name: "Limpiar" }).first().click()
    await page
      .getByRole("complementary", { name: "Filtrar por" })
      .getByLabel("Gramaje")
      .selectOption("100 g")
    await expect(
      page.locator(".catalog-card").filter({ hasText: "GUMMI BEARS" }).first().locator(".catalog-card__link"),
    ).toHaveAttribute("href", /jovy-mx-/)
  })

  test("hover de tarjeta conserva la capa layered de Rings", async ({ page }) => {
    await page.goto("/es/catalogo")
    await expect(page.locator(".catalog-card")).toHaveCount(12)
    await page.getByLabel("Ordenar por").selectOption("name-asc")
    await page.getByLabel("Buscar productos").fill("Rings Manzana")
    const ringCard = page.locator(".catalog-card").filter({ hasText: "Rings Manzana" })
    await expect(ringCard).toHaveCount(1)

    const layer = ringCard.locator(".catalog-card__layer--decor")
    await expect(layer).toHaveCount(1)
    await expect(layer).toHaveAttribute("src", /\/static\/.*gomitas-explosion\.webp$/)
    await expect(layer).toHaveAttribute("aria-hidden", "true")
    const opacityBefore = await layer.evaluate((node) => getComputedStyle(node).opacity)
    expect(opacityBefore).toBe("0")

    const base = ringCard.locator(".catalog-card__layer--base")
    await expect(base).toHaveAttribute("src", /\/static\/.*jovy-mx-.*\.webp$/)
    const boxBefore = await base.boundingBox()

    await ringCard.hover()
    await expect
      .poll(async () => layer.evaluate((node) => getComputedStyle(node).opacity))
      .toBe("1")
    const boxHover = await base.boundingBox()
    expect(boxHover?.width).toBeCloseTo(boxBefore?.width ?? 0, 1)
    expect(boxHover?.height).toBeCloseTo(boxBefore?.height ?? 0, 1)

    await page.mouse.move(5, 5)
    await expect
      .poll(async () => layer.evaluate((node) => getComputedStyle(node).opacity))
      .toBe("0")

    await ringCard.locator(".catalog-card__link").focus()
    await expect
      .poll(async () => layer.evaluate((node) => getComputedStyle(node).opacity))
      .toBe("1")
    await ringCard.locator(".catalog-card__link").blur()

    await layer.evaluate((node) => node.dispatchEvent(new Event("error")))
    await expect(layer).toHaveCount(0)
  })

  test("hover respeta movimiento reducido", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" })
    await page.goto("/es/catalogo")
    await expect(page.locator(".catalog-card")).toHaveCount(12)
    await page.getByLabel("Ordenar por").selectOption("name-asc")
    await page.getByLabel("Buscar productos").fill("Rings Manzana")
    const layer = page.locator(".catalog-card__layer--decor").first()
    await expect(layer).toHaveCount(1)
    const duration = await layer.evaluate((node) => getComputedStyle(node).transitionDuration)
    expect(parseFloat(duration)).toBeLessThan(0.05)
  })

  test("mantiene la versión en inglés", async ({ page }) => {
    await page.goto("/en/catalogo")
    await expect(page.getByRole("heading", { level: 1, name: "Gummies for every craving" })).toBeVisible()
    await expect(page.getByLabel("Search products")).toBeVisible()
    await expectNoHorizontalOverflow(page)
  })

  test("el detalle conserva la identidad y vuelve al catálogo", async ({ page }) => {
    await page.goto("/es/catalogo")
    const href = await page.locator(".catalog-card__link").first().getAttribute("href")
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

  test("compra invitado completa un pedido de laboratorio en Medusa", async ({ page }) => {
    await page.goto("/es/productos/jovy-mx-gummi-bears-gummi-bears")
    await expect(page.getByRole("heading", { level: 1, name: "GUMMI BEARS" })).toBeVisible()
    await expect(page.locator(".product-buy__price")).toContainText("$15.00")

    await page.locator(".product-variants__options label", { hasText: "100 g" }).click()
    await expect(page.locator(".product-buy__amount")).toHaveText("$25.00")

    await page.getByRole("button", { name: "Añadir al carrito" }).click()
    await expect(page.getByRole("status").filter({ hasText: "Agregado al carrito" })).toBeVisible()
    await page.locator('button[aria-label^="Abrir carrito"]:visible').first().click()
    await expect(page.getByRole("dialog", { name: /Carrito/ })).toBeVisible()
    await page.getByRole("link", { name: "Finalizar compra" }).click()

    await expect(page.getByRole("heading", { level: 1, name: "Checkout" })).toBeVisible()
    const checkout = page.locator("main")
    await checkout.getByLabel("Correo electrónico").fill("lab@jovy.test")
    await checkout.getByLabel("Teléfono").fill("3312345678")
    await checkout.getByLabel("Nombre", { exact: true }).fill("Laboratorio")
    await checkout.getByLabel("Apellidos").fill("Jovy")
    await checkout.getByLabel("Calle y número").fill("Av. Prueba 123")
    await checkout.getByLabel("Ciudad").fill("Guadalajara")
    await checkout.getByLabel("Estado").fill("Jalisco")
    await checkout.getByLabel("Código postal").fill("44100")
    await checkout.getByRole("button", { name: "Continuar al envío" }).click()

    await expect(checkout.getByRole("heading", { name: "Método de envío" })).toBeVisible()
    await checkout.getByRole("radio").first().check()
    await checkout.getByRole("button", { name: "Continuar al pago" }).click()

    await expect(checkout.getByText("Pago manual", { exact: true }).first()).toBeVisible()
    await checkout.getByRole("button", { name: "Revisar pedido" }).click()
    await checkout.getByRole("button", { name: "Confirmar pedido" }).click()

    await page.waitForURL(/\/es\/checkout\/confirmacion$/)
    await expect(page.getByRole("heading", { level: 1, name: "Pedido confirmado" })).toBeVisible()
    await expect(page.getByText("Pedido de prueba").first()).toBeVisible()
    await expect(
      page.getByRole("main").getByText("1 × GUMMI BEARS").first(),
    ).toBeVisible()
  })

  test("ficha muestra descripción, relacionados y límite de stock", async ({ page }) => {
    await page.goto("/es/productos/jovy-mx-gummi-bears-gummi-bears")
    await expect(page.locator(".product-lead")).not.toHaveText(
      "Producto Jovy disponible para compra.",
    )
    await expect(page.locator(".product-specs")).toContainText("Peso")
    await expect(page.locator(".product-related .catalog-card")).toHaveCount(4)
    await expect(
      page.locator(".product-related .catalog-card__price--unavailable"),
    ).toHaveCount(0)

    const increase = page.getByRole("button", { name: "Aumentar cantidad" })
    for (let index = 0; index < 49; index += 1) await increase.click()
    await expect(page.locator(".product-quantity output")).toHaveText("50")
    await expect(increase).toBeDisabled()
    await expect(page.getByText("Máximo 50 disponibles")).toBeVisible()
  })

  test("ficha muestra galería, zoom y presentaciones en gramos", async ({ page }) => {
    await page.goto("/es/productos/jovy-aros-manzana-verde")
    const gallery = page.locator(".product-gallery")
    const thumbs = gallery.locator(".product-gallery__thumbs button")
    expect(await thumbs.count()).toBeGreaterThanOrEqual(5)

    const mainImage = gallery.locator(".product-gallery__image")
    const firstSrc = await mainImage.getAttribute("src")
    await gallery.locator(".product-gallery__thumbs button").nth(1).click()
    await expect(mainImage).not.toHaveAttribute("src", firstSrc ?? "")

    await gallery.locator(".product-gallery__zoom").click()
    await expect(page.locator(".product-lightbox[open]")).toBeVisible()
    await page.locator(".product-lightbox__close").click()

    await expect(page.getByRole("radio")).toHaveCount(3)
    await expect(page.getByRole("radio", { name: /170 g/ })).toBeChecked()
  })

  test("carrito persiste tras recargar, permite editar y eliminar", async ({ page }) => {
    await page.goto("/es/productos/jovy-ositos-surtidos")
    await page.getByRole("button", { name: "Añadir al carrito" }).click()
    await expect(page.getByRole("status").filter({ hasText: "Agregado al carrito" })).toBeVisible()
    await page.locator('button[aria-label^="Abrir carrito"]:visible').first().click()
    await expect(page.getByRole("dialog", { name: "Carrito" })).toBeVisible()
    await Promise.all([
      page.waitForURL(/\/es\/carrito$/),
      page.getByRole("link", { name: "Ver carrito" }).click(),
    ])
    await expect(page.getByRole("heading", { level: 1, name: "Carrito" })).toBeVisible()

    await page.reload()
    const cart = page.getByRole("main")
    await expect(cart.getByText("Ositos Surtidos 12 Sabores").first()).toBeVisible()
    await expect(cart.getByText("$45.00").first()).toBeVisible()

    await cart.getByRole("button", { name: "Aumentar cantidad" }).click()
    await expect(cart.getByText("$90.00").first()).toBeVisible()

    await cart.getByRole("button", { name: "Eliminar" }).click()
    await expect(
      page.getByRole("heading", { level: 1, name: "Tu carrito está vacío" }),
    ).toBeVisible()
  })

  test("CATALOG_ONLY no ofrece compra y muestra contacto", async ({ page }) => {
    await page.goto("/es/productos/jovy-mini-gummy-mix")
    await expect(page.getByRole("heading", { level: 1, name: "Mini Gummy Mix" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Añadir al carrito" })).toHaveCount(0)
    await expect(page.getByRole("button", { name: "Contactar para comprar" })).toBeVisible()
  })

  test("cuenta B2C permite registro, perfil y logout", async ({ page }) => {
    const email = `e2e+${Date.now()}@jovy.test`
    await page.goto("/es/cuenta")
    await page.getByRole("button", { name: /Crear cuenta/ }).click()
    const account = page.locator("main")
    await account.getByLabel("Nombre", { exact: true }).fill("Cliente")
    await account.getByLabel("Apellidos").fill("E2E")
    await account.getByLabel("Correo electrónico").fill(email)
    await account.getByLabel("Contraseña").fill("JovyLab123!")
    await account.getByRole("button", { name: "Crear cuenta", exact: true }).click()
    await expect(account.getByRole("heading", { level: 1, name: "Mi cuenta" })).toBeVisible()
    await expect(account.getByText(email)).toBeVisible()
    await account.getByRole("button", { name: "Cerrar sesión" }).click()
    await expect(account.getByRole("heading", { name: "Bienvenido de nuevo" })).toBeVisible()
  })

  test("compra móvil abre drawer y checkout sin overflow", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto("/es/productos/jovy-mx-gummi-bears-gummi-bears")
    await page.getByRole("button", { name: "Añadir al carrito" }).click()
    await expect(page.getByRole("status").filter({ hasText: "Agregado al carrito" })).toBeVisible()
    await page.locator('button[aria-label^="Abrir carrito"]:visible').first().click()
    await expect(page.getByRole("dialog", { name: "Carrito" })).toBeVisible()
    await page.getByRole("link", { name: "Finalizar compra" }).click()
    await expect(page.getByRole("heading", { level: 1, name: "Checkout" })).toBeVisible()
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
