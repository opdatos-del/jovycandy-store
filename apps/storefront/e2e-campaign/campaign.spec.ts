import { expect, test, type APIRequestContext, type Page } from "@playwright/test"

const BACKEND = process.env.E2E_BACKEND_URL ?? ""
const PRODUCT_HANDLE = process.env.E2E_PRODUCT_HANDLE ?? ""
const PRODUCT_TITLE = process.env.E2E_PRODUCT_TITLE ?? ""
const VARIANT_ID = process.env.E2E_PRODUCT_VARIANT_ID ?? ""
const BASE_AMOUNT = Number(process.env.E2E_PRODUCT_BASE_AMOUNT ?? "45")
const SALE_AMOUNT = Math.max(1, Math.round(BASE_AMOUNT * 0.8))
const FIXED_AMOUNT = 5
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? ""
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? ""

let adminHeaders: Record<string, string> = {}
let productId = ""
let priceListId = ""
let automaticPromotionId = ""

const money = (amount: number) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)

async function adminFetch(
  request: APIRequestContext,
  method: "GET" | "POST",
  path: string,
  data?: unknown,
) {
  const response = await request.fetch(`${BACKEND}/admin${path}`, {
    method,
    headers: { ...adminHeaders, "content-type": "application/json" },
    data,
  })
  expect(response.ok(), `${method} ${path}: ${await response.text()}`).toBeTruthy()
  return response.json()
}

async function createPromotion(
  request: APIRequestContext,
  payload: Record<string, unknown>,
) {
  return adminFetch(request, "POST", "/promotions", {
    status: "active",
    ...payload,
  })
}

async function addProduct(page: Page) {
  const cartReady = page
    .waitForResponse(
      (response) =>
        response.url().includes("/api/cart") && response.request().method() === "GET",
      { timeout: 30_000 },
    )
    .catch(() => undefined)

  await page.goto(`/es/productos/${PRODUCT_HANDLE}`)
  // Evita hacer clic antes de que el provider de carrito termine de hidratar.
  await cartReady
  await page.getByRole("button", { name: "Añadir al carrito" }).click()
  await expect(
    page.getByRole("status").filter({ hasText: "Agregado al carrito" }),
  ).toBeVisible()
}

function cartSummary(page: Page) {
  return page.locator("main aside")
}

async function waitForHydratedButton(page: Page, label: string) {
  await page.waitForFunction(
    (text) => {
      const button = [...document.querySelectorAll("button")].find((candidate) =>
        candidate.textContent?.trim().includes(text),
      )
      return Boolean(
        button &&
          Object.keys(button).some((key) => key.startsWith("__reactProps")),
      )
    },
    label,
    { timeout: 30_000 },
  )
}

async function applyCoupon(page: Page, code: string) {
  const main = page.locator("main")
  await main.getByLabel("Cupón").fill(code)
  await main.getByRole("button", { name: "Aplicar" }).click()
}

test.describe.serial("campaña comercial en laboratorio aislado", () => {
  test.beforeAll(async ({ request }) => {
    expect(BACKEND).toBeTruthy()
    expect(PRODUCT_HANDLE).toBeTruthy()
    expect(VARIANT_ID).toBeTruthy()

    const login = await request.post(`${BACKEND}/auth/user/emailpass`, {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    })
    expect(login.ok()).toBeTruthy()
    const token = (await login.json()).token as string
    adminHeaders = { authorization: `Bearer ${token}` }

    const product = await adminFetch(
      request,
      "GET",
      `/products?handle=${encodeURIComponent(PRODUCT_HANDLE)}&limit=1`,
    )
    productId = product.products[0].id as string
    expect(productId).toBeTruthy()

    // El producto de seed no gestiona inventario por defecto. Para que Medusa
    // resuelva opciones de envío, la variante necesita un inventory item con
    // nivel en la ubicación de laboratorio.
    const locations = await adminFetch(request, "GET", "/stock-locations?limit=20")
    const labLocation = (locations.stock_locations as Array<{ id: string; name: string }>).find(
      (location) => location.name === "Jovy México Laboratorio",
    )
    expect(labLocation).toBeTruthy()
    const inventoryItem = await adminFetch(request, "POST", "/inventory-items", {
      sku: `E2E-${productId}`,
    })
    await adminFetch(
      request,
      "POST",
      `/products/${productId}/variants/${VARIANT_ID}/inventory-items`,
      { inventory_item_id: inventoryItem.inventory_item.id, required_quantity: 1 },
    )
    await adminFetch(
      request,
      "POST",
      `/inventory-items/${inventoryItem.inventory_item.id}/location-levels`,
      { location_id: labLocation!.id, stocked_quantity: 50 },
    )
    await adminFetch(request, "POST", `/products/${productId}/variants/batch`, {
      update: [
        {
          id: VARIANT_ID,
          manage_inventory: true,
          allow_backorder: true,
        },
      ],
    })

    const collection = await adminFetch(request, "POST", "/collections", {
      title: "Buen Fin Laboratorio",
      handle: "buen-fin-laboratorio-e2e",
    })
    await adminFetch(request, "POST", `/products/${productId}`, {
      collection_id: collection.collection.id,
    })

    const future = new Date(Date.now() + 60 * 60 * 1_000)
    const later = new Date(Date.now() + 2 * 60 * 60 * 1_000)
    const priceList = await adminFetch(request, "POST", "/price-lists", {
      title: "E2E Oferta Laboratorio",
      description: "Precio de oferta de prueba aislada.",
      type: "sale",
      status: "active",
      starts_at: future.toISOString(),
      ends_at: later.toISOString(),
      prices: [
        {
          variant_id: VARIANT_ID,
          currency_code: "mxn",
          amount: SALE_AMOUNT,
        },
      ],
    })
    priceListId = priceList.price_list.id as string

    const targetRules = [
      {
        attribute: "items.product.id",
        operator: "in",
        values: [productId],
      },
    ]

    await createPromotion(request, {
      code: "E2E10",
      type: "standard",
      application_method: {
        type: "percentage",
        target_type: "items",
        allocation: "each",
        max_quantity: 100,
        value: 10,
        currency_code: "mxn",
        target_rules: targetRules,
      },
    })

    await createPromotion(request, {
      code: "E2EFIJO",
      type: "standard",
      application_method: {
        type: "fixed",
        target_type: "items",
        allocation: "each",
        max_quantity: 100,
        value: FIXED_AMOUNT,
        currency_code: "mxn",
        target_rules: targetRules,
      },
    })

    await createPromotion(request, {
      code: "E2EENVIO",
      type: "standard",
      application_method: {
        type: "percentage",
        target_type: "shipping_methods",
        allocation: "across",
        value: 100,
        currency_code: "mxn",
      },
    })

    const expiredCampaign = await adminFetch(request, "POST", "/campaigns", {
      name: "E2E Campaña Vencida",
      campaign_identifier: "e2e-campana-vencida",
      starts_at: new Date(Date.now() - 2 * 60 * 60 * 1_000).toISOString(),
      ends_at: new Date(Date.now() - 60 * 60 * 1_000).toISOString(),
    })
    await createPromotion(request, {
      code: "E2EEXPIRADO",
      type: "standard",
      campaign_id: expiredCampaign.campaign.id,
      application_method: {
        type: "percentage",
        target_type: "items",
        allocation: "each",
        max_quantity: 100,
        value: 50,
        currency_code: "mxn",
      },
    })

    const otherProducts = await adminFetch(
      request,
      "GET",
      "/products?limit=10&fields=id,handle",
    )
    const other = (otherProducts.products as Array<{ id: string }>).find(
      (candidate) => candidate.id !== productId,
    )
    expect(other).toBeTruthy()
    await createPromotion(request, {
      code: "E2ENOELIGIBLE",
      type: "standard",
      application_method: {
        type: "percentage",
        target_type: "items",
        allocation: "each",
        max_quantity: 100,
        value: 50,
        currency_code: "mxn",
        target_rules: [
          {
            attribute: "items.product.id",
            operator: "in",
            values: [other!.id],
          },
        ],
      },
    })
  })

  test("muestra el precio normal antes de activar la Price List", async ({ page }) => {
    await page.goto(`/es/productos/${PRODUCT_HANDLE}`)
    await expect(page.locator(".product-buy__amount")).toContainText(money(BASE_AMOUNT))
    await expect(page.locator(".product-buy__sale")).toHaveCount(0)
    await expect(page.locator(".product-buy__original")).toHaveCount(0)
  })

  test("activa la Price List y muestra oferta y precio anterior", async ({ page, request }) => {
    const now = Date.now()
    await adminFetch(request, "POST", `/price-lists/${priceListId}`, {
      starts_at: new Date(now - 60_000).toISOString(),
      ends_at: new Date(now + 60 * 60_000).toISOString(),
    })

    await page.goto(`/es/productos/${PRODUCT_HANDLE}`)
    await expect(page.locator(".product-buy__amount")).toContainText(money(SALE_AMOUNT))
    await expect(page.locator(".product-buy__original")).toContainText(money(BASE_AMOUNT))
    await expect(page.locator(".product-buy__sale")).toHaveText("Oferta")
  })

  test("aplica un cupón porcentual y lo retira", async ({ page }) => {
    await addProduct(page)
    await page.goto("/es/carrito")
    await expect(cartSummary(page)).toContainText(money(SALE_AMOUNT))

    await applyCoupon(page, "E2E10")
    await expect(cartSummary(page).locator("dt").filter({ hasText: "Descuento" })).toBeVisible()
    const discounted = await cartSummary(page).locator("dd").last().textContent()
    expect(discounted).not.toContain(money(SALE_AMOUNT))

    await page.locator("main").getByRole("button", { name: "Quitar cupón" }).click()
    await expect(cartSummary(page).locator("dd").last()).toContainText(money(SALE_AMOUNT))
  })

  test("aplica un cupón de importe fijo con total exacto de Medusa", async ({ page }) => {
    await addProduct(page)
    await page.goto("/es/carrito")

    await applyCoupon(page, "E2EFIJO")
    await expect(cartSummary(page)).toContainText(`-${money(FIXED_AMOUNT)}`)
    await expect(cartSummary(page).locator("dd").last()).toContainText(
      money(SALE_AMOUNT - FIXED_AMOUNT),
    )
  })

  test("aplica una promoción automática solo al producto de laboratorio", async ({
    page,
    request,
  }) => {
    const promotion = await createPromotion(request, {
      code: "E2EAUTO",
      type: "standard",
      is_automatic: true,
      application_method: {
        type: "percentage",
        target_type: "items",
        allocation: "each",
        max_quantity: 100,
        value: 10,
        currency_code: "mxn",
        target_rules: [
          {
            attribute: "items.product.id",
            operator: "in",
            values: [productId],
          },
        ],
      },
    })
    automaticPromotionId = promotion.promotion.id as string

    try {
      await addProduct(page)
      await page.goto("/es/carrito")
      await expect(cartSummary(page).locator("dt").filter({ hasText: "Descuento" })).toBeVisible()
      await expect(cartSummary(page).getByText("E2EAUTO")).toBeVisible()
      const total = await cartSummary(page).locator("dd").last().textContent()
      expect(total).not.toContain(money(SALE_AMOUNT))
    } finally {
      await adminFetch(request, "POST", `/promotions/${automaticPromotionId}`, {
        status: "inactive",
      })
    }
  })

  test("rechaza cupón vencido y cupón no elegible sin alterar totales", async ({ page }) => {
    await addProduct(page)
    await page.goto("/es/carrito")
    const before = await cartSummary(page).locator("dd").last().textContent()

    for (const code of ["E2EEXPIRADO", "E2ENOELIGIBLE"]) {
      await applyCoupon(page, code)
      await expect(
        page.getByRole("alert").filter({ hasText: "No pudimos aplicar el cupón" }),
      ).toBeVisible()
      await expect(cartSummary(page).locator("dd").last()).toHaveText(before ?? "")
    }
  })

  test("envío gratis con una opción de envío válida", async ({ page }) => {
    await addProduct(page)
    await page.goto("/es/checkout")
    const main = page.locator("main")
    await expect(page.getByRole("button", { name: /Abrir carrito \(1\)/ })).toBeVisible()

    await main.getByLabel("Correo electrónico").fill("campaign-e2e@example.test")
    await main.getByLabel("Teléfono").fill("3312345678")
    await main.getByLabel("Nombre", { exact: true }).fill("Cliente")
    await main.getByLabel("Apellidos").fill("Campaña")
    await main.getByLabel("Calle y número").fill("Av. Laboratorio 1")
    await main.getByLabel("Ciudad").fill("Ciudad de México")
    await main.getByLabel("Estado").fill("CDMX")
    await main.getByLabel("Código postal").fill("01000")
    await waitForHydratedButton(page, "Continuar al envío")
    const addressSaved = page.waitForResponse(
      (response) =>
        response.url().includes("/api/checkout/address") &&
        response.request().method() === "POST",
      { timeout: 30_000 },
    )
    await main.getByRole("button", { name: "Continuar al envío" }).click()
    await addressSaved

    await expect(main.getByText("Envío estándar").first()).toBeVisible()
    await page.reload()
    await expect(main.getByLabel("Correo electrónico")).toHaveValue("campaign-e2e@example.test")
    await expect(main.getByLabel("Calle y número")).toHaveValue("Av. Laboratorio 1")
    await waitForHydratedButton(page, "Continuar al envío")
    await main.getByRole("button", { name: "Continuar al envío" }).click()
    await main.getByRole("radio").first().check()
    await main.getByRole("button", { name: "Continuar al pago" }).click()

    await applyCoupon(page, "E2EENVIO")
    await expect(cartSummary(page).locator("dd").last()).toContainText(money(SALE_AMOUNT))
  })

  test("completa un pedido de laboratorio con cupón", async ({ page }) => {
    await addProduct(page)
    await page.goto("/es/carrito")
    await applyCoupon(page, "E2EFIJO")
    await page.goto("/es/checkout")
    const main = page.locator("main")
    await expect(page.getByRole("button", { name: /Abrir carrito \(1\)/ })).toBeVisible()

    await main.getByLabel("Correo electrónico").fill("campaign-order@example.test")
    await main.getByLabel("Teléfono").fill("3312345678")
    await main.getByLabel("Nombre", { exact: true }).fill("Cliente")
    await main.getByLabel("Apellidos").fill("Pedido")
    await main.getByLabel("Calle y número").fill("Av. Laboratorio 2")
    await main.getByLabel("Ciudad").fill("Ciudad de México")
    await main.getByLabel("Estado").fill("CDMX")
    await main.getByLabel("Código postal").fill("01000")
    await waitForHydratedButton(page, "Continuar al envío")
    const addressSaved = page.waitForResponse(
      (response) =>
        response.url().includes("/api/checkout/address") &&
        response.request().method() === "POST",
      { timeout: 30_000 },
    )
    await main.getByRole("button", { name: "Continuar al envío" }).click()
    await addressSaved
    await main.getByRole("radio").first().check()
    await main.getByRole("button", { name: "Continuar al pago" }).click()
    await main.getByRole("button", { name: "Revisar pedido" }).click()

    const expectedTotal = SALE_AMOUNT - FIXED_AMOUNT + 99
    await expect(cartSummary(page).locator("dd").last()).toContainText(money(expectedTotal))
    await main.getByRole("button", { name: "Confirmar pedido" }).click()

    await expect(page.getByRole("heading", { name: "Pedido confirmado" })).toBeVisible()
    await expect(page.getByRole("main")).toContainText(money(expectedTotal))
  })

  test("muestra la colección nativa creada desde Admin", async ({ page }) => {
    await page.goto("/es/colecciones")
    await expect(page.getByRole("heading", { name: "Colecciones" })).toBeVisible()
    await page.getByRole("link", { name: "Buen Fin Laboratorio" }).click()
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Buen Fin Laboratorio")
    await expect(page.getByText(PRODUCT_TITLE).first()).toBeVisible()
  })

  test("un retorno de pago sin carrito no confirma un pedido", async ({ page }) => {
    const initial = await page.request.get("/es/checkout/retorno?redirect_status=succeeded", { maxRedirects: 0 })
    expect(initial.headers()["referrer-policy"]).toBe("no-referrer")
    await page.goto("/es/checkout/retorno?redirect_status=succeeded&payment_intent=ignored")
    await expect(page).toHaveURL(/\/es\/checkout\/retorno$/)
    await waitForHydratedButton(page, "Consultar pedido")
    await page.getByRole("button", { name: "Consultar pedido" }).click()
    await expect(page.getByText("Aún no pudimos confirmar un pedido", { exact: false })).toBeVisible()
    await page.goto("/es/checkout/confirmacion?order_id=ignored")
    await expect(page.getByRole("heading", { name: "No hay un pedido confirmado" })).toBeVisible()
  })

  test("cuenta móvil usa su dirección y pedido; otro cliente no puede leerlos", async ({ page, browser }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await addProduct(page)
    const account = {
      first_name: "Cliente", last_name: "Privado",
      email: "campaign-account@example.test", password: "Campaign-account-93!",
    }
    expect((await page.request.post("/api/account/register", { data: account })).ok()).toBeTruthy()
    const listEndpoint = "/api/account/lists"
    const createdList = await page.request.post(listEndpoint, { data: { action: "create", name: "Para la fiesta" } })
    expect(createdList.ok()).toBeTruthy()
    const listId = (await createdList.json()).id
    const cartResponse = await page.request.get("/api/cart")
    const variantId = (await cartResponse.json()).cart.items[0].variantId
    for (const target of ["favorites", listId]) {
      for (let attempt = 0; attempt < 2; attempt++) {
        expect((await page.request.post(listEndpoint, {
          data: { action: "add", list_id: target, variant_id: variantId },
        })).ok()).toBeTruthy()
      }
    }
    const listResponse = await page.request.get(listEndpoint)
    expect(listResponse.ok()).toBeTruthy()
    const { lists } = await listResponse.json()
    const favorites = lists.find((list: { id: string }) => list.id === "favorites")
    const custom = lists.find((list: { id: string }) => list.id === listId)
    expect(favorites.items).toHaveLength(1)
    expect(custom.items).toHaveLength(1)
    expect(custom.items[0].variant.product.title).toBe(PRODUCT_TITLE)
    const address = await page.request.post("/api/account/addresses", { data: {
      first_name: "Cliente", last_name: "Privado", address_1: "Av. Privada 25",
      city: "Ciudad de México", province: "CDMX", postal_code: "01000", phone: "3312345678",
    } })
    expect(address.ok()).toBeTruthy()
    const addressId = (await address.json()).address.id
    expect((await page.request.patch(`/api/account/addresses/${addressId}`, {
      data: { is_default_shipping: true },
    })).ok()).toBeTruthy()

    await page.goto("/es/checkout")
    const main = page.getByRole("main")
    await expect(main.getByLabel("Correo electrónico")).toHaveValue(account.email)
    await expect(main.getByLabel("Calle y número")).toHaveValue("Av. Privada 25")
    await waitForHydratedButton(page, "Continuar al envío")
    await main.getByRole("button", { name: "Continuar al envío" }).click()
    await main.getByRole("radio").first().check()
    await main.getByRole("button", { name: "Continuar al pago" }).click()
    await main.getByRole("button", { name: "Revisar pedido" }).click()
    const result = page.waitForResponse((response) => response.url().endsWith("/api/checkout/complete"))
    await main.getByRole("button", { name: "Confirmar pedido" }).click()
    const completed = await result
    expect(completed.ok()).toBeTruthy()
    const orderId = (await completed.json()).order.id
    await expect(page.getByRole("heading", { name: "Pedido confirmado" })).toBeVisible()

    await page.goto("/es/cuenta")
    await expect(page.getByText("Hola, Cliente")).toBeVisible()
    await expect(page.getByText("Envío predeterminado")).toBeVisible()
    await page.getByText("Ver detalle", { exact: true }).click()
    await expect(page.getByText(PRODUCT_TITLE, { exact: false }).first()).toBeVisible()
    await page.getByRole("button", { name: "Volver a comprar" }).click()
    await expect(page.getByText("Unidades agregadas: 1")).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(391)

    const notices = "/api/account/notices"
    await expect.poll(async () => (await (await page.request.get(notices)).json()).notices?.length).toBe(1)
    const feed = await (await page.request.get(notices)).json()
    expect(feed.notices[0]).toMatchObject({ kind: "order_placed", read_at: null })
    expect(feed.marketingEmail).toBe(false)
    const noticeId = feed.notices[0].id
    expect((await page.request.post(notices, { data: { id: noticeId } })).ok()).toBeTruthy()
    expect((await (await page.request.get(notices)).json()).notices[0].read_at).not.toBeNull()
    expect((await page.request.post(notices, { data: { action: "set_marketing_email", enabled: true } })).ok()).toBeTruthy()
    expect((await (await page.request.get(notices)).json()).marketingEmail).toBe(true)

    const other = await browser.newContext({ baseURL: new URL(page.url()).origin })
    try {
      expect((await other.request.get(`/api/account/orders/${orderId}`)).status()).toBe(401)
      expect((await other.request.post("/api/account/register", {
        data: { ...account, email: "campaign-other@example.test" },
      })).ok()).toBeTruthy()
      expect((await other.request.get(`/api/account/orders/${orderId}`)).status()).toBe(404)
      expect((await other.request.post(`/api/account/orders/${orderId}`)).status()).toBe(404)
      expect((await other.request.delete(`/api/account/addresses/${addressId}`)).status()).toBe(404)
      expect((await other.request.post(listEndpoint, { data: { action: "rename", list_id: listId, name: "Ajena" } })).status()).toBe(404)
      expect((await other.request.post(listEndpoint, { data: { action: "move", list_id: listId, item_id: custom.items[0].id } })).status()).toBe(404)
      expect((await other.request.post(notices, { data: { id: noticeId } })).status()).toBe(404)
      expect((await (await other.request.get(notices)).json()).notices).toEqual([])
    } finally {
      await other.close()
    }
    expect((await page.request.post(listEndpoint, {
      data: { action: "move", list_id: listId, item_id: custom.items[0].id },
    })).ok()).toBeTruthy()
    expect((await page.request.post(listEndpoint, { data: { action: "delete", list_id: listId } })).ok()).toBeTruthy()
    expect((await page.request.delete("/api/account")).ok()).toBeTruthy()
    expect((await page.request.get(`/api/account/orders/${orderId}`)).status()).toBe(401)
  })

  test("carrito de total cero completa sin proveedor de pago", async ({ page, request }) => {
    await createPromotion(request, {
      code: "E2EZERO",
      type: "standard",
      application_method: {
        type: "percentage", target_type: "items", allocation: "each",
        max_quantity: 100, value: 100, currency_code: "mxn",
      },
    })
    await addProduct(page)
    const address = await page.request.post("/api/checkout/address", { data: {
      email: "campaign-zero@example.test", first_name: "Cliente", last_name: "Cero",
      address_1: "Av. Laboratorio 3", city: "Ciudad de México", province: "CDMX", postal_code: "01000",
    } })
    expect(address.ok()).toBeTruthy()
    const { options } = await (await page.request.get("/api/checkout/shipping-options")).json()
    expect((await page.request.post("/api/checkout/shipping-method", { data: { option_id: options[0].id } })).ok()).toBeTruthy()
    for (const code of ["E2EZERO", "E2EENVIO"]) {
      const response = await page.request.post("/api/cart/promotions", { data: { code } })
      expect(response.ok()).toBeTruthy()
    }
    const { cart } = await (await page.request.get("/api/cart")).json()
    expect(cart.total).toBe(0)
    const payment = await page.request.post("/api/checkout/payment", { data: {} })
    expect(await payment.json()).toEqual({ payment: { kind: "free" } })
    const completed = await page.request.post("/api/checkout/complete", { data: {} })
    expect(completed.ok()).toBeTruthy()
    expect((await completed.json()).order.total).toBe(0)
  })

  test("vuelve al precio base cuando expira la Price List", async ({ page, request }) => {
    await adminFetch(request, "POST", `/price-lists/${priceListId}`, {
      ends_at: new Date(Date.now() - 60_000).toISOString(),
    })

    await page.goto(`/es/productos/${PRODUCT_HANDLE}`)
    await expect(page.locator(".product-buy__amount")).toContainText(money(BASE_AMOUNT))
    await expect(page.locator(".product-buy__sale")).toHaveCount(0)
    await expect(page.locator(".product-buy__original")).toHaveCount(0)
  })
})
