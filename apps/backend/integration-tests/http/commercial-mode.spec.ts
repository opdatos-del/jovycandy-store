import path from "node:path"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { Modules } from "@medusajs/framework/utils"

import {
  adminHeaders,
  createAdminSession,
  createPublishableApiKey,
  storeHeaders,
} from "./utils"

jest.setTimeout(120_000)

/**
 * Prueba de integración HTTP de la validación SERVER-SIDE de modalidad comercial.
 *
 * Los fixtures son SOLO productos DEMO nuevos, creados en la base descartable que
 * `medusaIntegrationTestRunner` construye por suite (nunca en la base de desarrollo).
 * No se completa ninguna compra ni se autoriza ningún pago real.
 */
type DemoProduct = {
  productId: string
  variantId: string
  handle: string
}

type CartResponse = {
  cart: {
    id: string
    items: Array<{ id: string; variant_id: string; product_id?: string }>
  }
}

const CATALOG_MESSAGE = "Uno de los productos del carrito no está disponible para compra."

medusaIntegrationTestRunner({
  cwd: path.join(__dirname, "..", ".."),
  dbName: "medusa-jovy-http-commercial-mode",
  testSuite: ({ api, getContainer }) => {
    let adminToken: string
    let publishableApiKey: string
    let regionId: string
    let regionCurrencyCode: string
    let salesChannelId: string
    let stamp = 0

    const createdProductIds: string[] = []
    const createdEditorialProductIds: string[] = []
    const createdCartIds: string[] = []

    let catalogOnly: DemoProduct
    let sellable: DemoProduct
    let withoutEditorial: DemoProduct

    const adminConfig = () => ({ headers: adminHeaders(adminToken), validateStatus: () => true })
    const storeConfig = () => ({ headers: storeHeaders(publishableApiKey), validateStatus: () => true })

    const unique = (prefix: string) => {
      stamp += 1
      return `${prefix}-${stamp}`
    }

    /** Reutiliza la región sembrada por Medusa; sólo crea una si no existe. */
    const ensureRegion = async () => {
      const listed = await api.get("/admin/regions", { ...adminConfig(), params: { limit: 1 } })
      expect(listed.status).toBe(200)
      const existing = listed.data.regions?.[0]
      if (existing) {
        return { id: existing.id as string, currency_code: existing.currency_code as string }
      }

      const created = await api.post(
        "/admin/regions",
        {
          name: "DEMO Modalidad Comercial",
          currency_code: "mxn",
          countries: ["MX"],
          payment_providers: ["pp_system_default"],
        },
        adminConfig(),
      )
      expect([200, 201]).toContain(created.status)
      return {
        id: created.data.region.id as string,
        currency_code: created.data.region.currency_code as string,
      }
    }

    /** Reutiliza el sales channel sembrado por Medusa; sólo crea uno si no existe. */
    const ensureSalesChannel = async () => {
      const listed = await api.get("/admin/sales-channels", { ...adminConfig(), params: { limit: 1 } })
      expect(listed.status).toBe(200)
      const existing = listed.data.sales_channels?.[0]
      if (existing) return existing.id as string

      const created = await api.post(
        "/admin/sales-channels",
        { name: "DEMO Modalidad Comercial" },
        adminConfig(),
      )
      expect([200, 201]).toContain(created.status)
      return created.data.sales_channel.id as string
    }

    /**
     * Producto DEMO publicado, con variante, precio en la moneda de la región y
     * sales channel asignado. `manage_inventory: false` evita tocar stocks.
     */
    const createDemoProduct = async (commercialMode?: "catalog_only" | "sellable"): Promise<DemoProduct> => {
      const handle = unique("demo-modalidad")
      const created = await api.post(
        "/admin/products",
        {
          title: `DEMO ${handle}`,
          handle,
          status: "published",
          thumbnail: `https://example.test/${handle}.png`,
          options: [{ title: "Presentación", values: ["Única"] }],
          variants: [
            {
              title: "Única",
              sku: `${handle}-UNICA`,
              options: { Presentación: "Única" },
              manage_inventory: false,
              allow_backorder: true,
              prices: [{ currency_code: regionCurrencyCode, amount: 12345 }],
            },
          ],
          sales_channels: [{ id: salesChannelId }],
        },
        adminConfig(),
      )
      expect(created.status).toBe(200)

      const product = created.data.product
      const variantId = product.variants?.[0]?.id as string | undefined
      expect(variantId).toBeTruthy()
      createdProductIds.push(product.id)

      if (commercialMode) {
        await setCommercialMode(product.id, commercialMode)
      }

      return { productId: product.id, variantId: variantId!, handle }
    }

    /**
     * Producto DEMO sin variantes ni precios. La ruta Admin exige `prices` al
     * crear variantes, así que se siembra directamente con el Product Module:
     * el diagnóstico Admin debe reportar `prices` entre los códigos pendientes.
     */
    const createDemoProductWithoutPrices = async (): Promise<string> => {
      const handle = unique("demo-sin-precios")
      const productService = getContainer().resolve(Modules.PRODUCT)
      const product = await productService.createProducts({
        title: `DEMO ${handle}`,
        handle,
        status: "published",
        thumbnail: `https://example.test/${handle}.png`,
      })
      createdProductIds.push(product.id)
      return product.id
    }

    const setCommercialMode = async (productId: string, mode: "catalog_only" | "sellable") => {
      const response = await api.put(
        `/admin/jovy/products/${productId}/editorial`,
        { commercial_mode: mode },
        adminConfig(),
      )
      expect(response.status).toBe(200)
      expect(response.data.editorial.commercial_mode).toBe(mode)
      if (!createdEditorialProductIds.includes(productId)) createdEditorialProductIds.push(productId)
      return response
    }

    const createCart = async (email: string) => {
      const response = await api.post(
        "/store/carts",
        { region_id: regionId, sales_channel_id: salesChannelId, email },
        storeConfig(),
      )
      expect(response.status).toBe(200)
      const cartId = response.data.cart.id as string
      createdCartIds.push(cartId)
      return cartId
    }

    const addLine = (cartId: string, body: Record<string, unknown>) =>
      api.post(`/store/carts/${cartId}/line-items`, body, storeConfig())

    const getCart = async (cartId: string) => {
      const response = await api.get(`/store/carts/${cartId}`, storeConfig())
      expect(response.status).toBe(200)
      return response.data.cart as CartResponse["cart"]
    }

    const expectCatalogRejection = (response: { status: number; data: { type?: string; message?: string } }) => {
      expect(response.status).toBe(400)
      expect(response.data.type).toBe("not_allowed")
      expect(response.data.message).toBe(CATALOG_MESSAGE)
    }

    beforeAll(async () => {
      publishableApiKey = await createPublishableApiKey(getContainer())
      adminToken = await createAdminSession(getContainer(), api)

      const region = await ensureRegion()
      regionId = region.id
      regionCurrencyCode = region.currency_code
      salesChannelId = await ensureSalesChannel()

      catalogOnly = await createDemoProduct("catalog_only")
      sellable = await createDemoProduct("sellable")
      // Publicado y vendible a nivel Medusa, pero sin ficha editorial: la
      // validación debe resolverlo como CATALOG_ONLY.
      withoutEditorial = await createDemoProduct()
    })

    afterAll(async () => {
      // La base de cada suite es descartable y el runner la elimina al terminar;
      // este borrado explícito es best-effort y nunca debe fallar la suite.
      for (const productId of createdEditorialProductIds) {
        try {
          await api.delete(`/admin/jovy/products/${productId}/editorial`, adminConfig())
        } catch {
          // La base ya puede estar cerrada por el runner.
        }
      }
      for (const productId of createdProductIds) {
        try {
          await api.delete(`/admin/products/${productId}`, adminConfig())
        } catch {
          // La base ya puede estar cerrada por el runner.
        }
      }
    })

    it("rechaza añadir al carrito una variante CATALOG_ONLY y deja el carrito sin líneas", async () => {
      const cartId = await createCart("catalogo@demo-modalidad.test")

      const response = await addLine(cartId, { variant_id: catalogOnly.variantId, quantity: 1 })
      expectCatalogRejection(response)

      const cart = await getCart(cartId)
      expect(cart.items).toEqual([])
    })

    it("acepta añadir al carrito una variante SELLABLE (sin completar la compra)", async () => {
      const cartId = await createCart("venta@demo-modalidad.test")

      const response = await addLine(cartId, { variant_id: sellable.variantId, quantity: 1 })
      expect(response.status).toBe(200)

      const body = response.data as CartResponse
      expect(body.cart.items).toHaveLength(1)
      expect(body.cart.items[0]).toMatchObject({ variant_id: sellable.variantId })
      // No se completa el carrito: no hay orden ni pago.
      expect(body.cart).not.toHaveProperty("order")
    })

    it("expone sellable_requirements en las rutas Admin y detecta la falta de precios", async () => {
      const complete = await createDemoProduct("sellable")
      const completeDetail = await api.get(
        `/admin/jovy/products/${complete.productId}/editorial`,
        adminConfig(),
      )
      expect(completeDetail.status).toBe(200)
      expect(completeDetail.data.editorial.commercial_mode).toBe("sellable")
      expect(completeDetail.data.editorial.sellable_requirements).toEqual([])

      const completeList = await api.get("/admin/jovy/products/editorial", {
        ...adminConfig(),
        params: { product_id: complete.productId },
      })
      expect(completeList.status).toBe(200)
      expect(completeList.data.products[0].sellable_requirements).toEqual([])

      const noPricesId = await createDemoProductWithoutPrices()
      await setCommercialMode(noPricesId, "sellable")

      const noPricesDetail = await api.get(
        `/admin/jovy/products/${noPricesId}/editorial`,
        adminConfig(),
      )
      expect(noPricesDetail.status).toBe(200)
      expect(noPricesDetail.data.editorial.sellable_requirements).toContain("prices")

      const noPricesList = await api.get("/admin/jovy/products/editorial", {
        ...adminConfig(),
        params: { product_id: noPricesId },
      })
      expect(noPricesList.status).toBe(200)
      expect(noPricesList.data.products[0].sellable_requirements).toContain("prices")
    })

    it("rechaza añadir al carrito una variante sin ficha editorial", async () => {
      const cartId = await createCart("sin-ficha@demo-modalidad.test")

      const response = await addLine(cartId, { variant_id: withoutEditorial.variantId, quantity: 1 })
      expectCatalogRejection(response)

      const cart = await getCart(cartId)
      expect(cart.items).toEqual([])
    })

    it("rechaza completar el carrito si la modalidad cambió a CATALOG_ONLY y no crea orden", async () => {
      const orderService = getContainer().resolve(Modules.ORDER) as {
        listAndCountOrders: () => Promise<[unknown[], number]>
      }
      const [, ordersBefore] = await orderService.listAndCountOrders()

      const cartId = await createCart("completar@demo-modalidad.test")
      const added = await addLine(cartId, { variant_id: sellable.variantId, quantity: 1 })
      expect(added.status).toBe(200)

      try {
        // La línea se creó cuando la ficha era SELLABLE; ahora cambia la
        // modalidad en servidor, sin tocar el carrito.
        await setCommercialMode(sellable.productId, "catalog_only")

        // Sesión de pago del proveedor de sistema: nunca se autoriza ni se
        // captura. Sólo existe para que el workflow alcance su hook `validate`.
        const collection = await api.post(
          "/store/payment-collections",
          { cart_id: cartId },
          storeConfig(),
        )
        expect(collection.status).toBe(200)
        const paymentCollectionId = collection.data.payment_collection.id as string

        const session = await api.post(
          `/store/payment-collections/${paymentCollectionId}/payment-sessions`,
          { provider_id: "pp_system_default" },
          storeConfig(),
        )
        expect(session.status).toBe(200)

        const completed = await api.post(`/store/carts/${cartId}/complete`, {}, storeConfig())
        expectCatalogRejection(completed)
        expect(completed.data).not.toHaveProperty("order")

        const [, ordersAfter] = await orderService.listAndCountOrders()
        expect(ordersAfter).toBe(ordersBefore)
      } finally {
        // Restaura la modalidad aunque falle una aserción, para no contaminar
        // el resto de la suite.
        await setCommercialMode(sellable.productId, "sellable")
      }
    })

    it("ignora product_id y metadata.product_id enviados por el cliente", async () => {
      // `metadata` sí entra en el contrato Store, pero el hook no lo lee: la
      // modalidad se resuelve por la variante real y su ficha editorial.
      const rejectedCartId = await createCart("senal-falsa@demo-modalidad.test")
      expectCatalogRejection(
        await addLine(rejectedCartId, {
          variant_id: catalogOnly.variantId,
          quantity: 1,
          metadata: { product_id: sellable.productId, commercial_mode: "sellable" },
        }),
      )
      expect((await getCart(rejectedCartId)).items).toEqual([])

      const acceptedCartId = await createCart("senal-falsa-ok@demo-modalidad.test")
      const accepted = await addLine(acceptedCartId, {
        variant_id: sellable.variantId,
        quantity: 1,
        metadata: { product_id: catalogOnly.productId, commercial_mode: "catalog_only" },
      })
      expect(accepted.status).toBe(200)
      const items = (accepted.data as CartResponse).cart.items
      expect(items).toHaveLength(1)
      expect(items[0].variant_id).toBe(sellable.variantId)
      expect(items[0].product_id).toBe(sellable.productId)

      // Un `product_id` de primer nivel no pertenece al contrato de la ruta:
      // el servidor lo rechaza sin usarlo para decidir la modalidad.
      const forgedCartId = await createCart("product-id-falso@demo-modalidad.test")
      const forged = await addLine(forgedCartId, {
        variant_id: catalogOnly.variantId,
        quantity: 1,
        product_id: sellable.productId,
      })
      expect(forged.status).toBe(400)
      expect(JSON.stringify(forged.data)).toContain("Unrecognized fields")
      expect(JSON.stringify(forged.data)).not.toContain(sellable.productId)
      expect((await getCart(forgedCartId)).items).toEqual([])
    })
  },
})
