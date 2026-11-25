import { mkdtemp, readFile, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils"
import {
  createReservationsWorkflow,
  createShippingOptionsWorkflow,
  createShippingProfilesWorkflow,
} from "@medusajs/medusa/core-flows"
import ensureStagingPublishableKey from "@jovy/scripts/ensure-staging-publishable-key"

import {
  adminHeaders,
  createAdminSession,
  createPublishableApiKey,
  storeHeaders,
} from "./utils"

jest.setTimeout(180_000)

/**
 * Comportamiento de laboratorio para Promotion e Inventory.
 *
 * La base la crea y descarta `medusaIntegrationTestRunner`; no se toca la base
 * de desarrollo ni se completa ningún pago. Los productos, stock locations y
 * niveles son fixtures aislados de esta suite.
 */
medusaIntegrationTestRunner({
  cwd: path.join(__dirname, "..", ".."),
  dbName: "medusa-jovy-http-commerce-operations",
  testSuite: ({ api, getContainer }) => {
    let adminToken: string
    let publishableApiKey: string
    let regionId: string
    let currencyCode: string
    let salesChannelId: string
    let stockLocationId: string
    let shippingOptionId: string
    let shippingProfileId: string
    let stamp = 0

        const adminConfig = () => ({
      headers: adminHeaders(adminToken),
      validateStatus: () => true,
    })
    const storeConfig = () => ({
      headers: storeHeaders(publishableApiKey),
      validateStatus: () => true,
    })
    const store = (url: string, payload?: unknown) =>
      payload === undefined
        ? api.get(url, { ...storeConfig(), params: { fields: "*" } })
        : api.post(url, payload, storeConfig())

    const unique = (prefix: string) => {
      stamp += 1
      return `${prefix}-${stamp}`
    }

    const ensureRegion = async () => {
      const listed = await api.get("/admin/regions", {
        ...adminConfig(),
        params: { limit: 1 },
      })
      const existing = listed.data.regions?.[0]
      if (existing) {
        const providers = (existing.payment_providers ?? []) as Array<{
          id?: string
        }>
        if (!providers.some((provider) => provider.id === "pp_system_default")) {
          await api.post(
            `/admin/regions/${existing.id}`,
            {
              payment_providers: [
                ...providers.map((provider) => provider.id).filter(Boolean),
                "pp_system_default",
              ],
            },
            adminConfig(),
          )
        }
        return {
          id: existing.id as string,
          currency_code: existing.currency_code as string,
        }
      }

      const created = await api.post(
        "/admin/regions",
        {
          name: "DEMO Commerce Operations",
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

    const ensureSalesChannel = async () => {
      const listed = await api.get("/admin/sales-channels", {
        ...adminConfig(),
        params: { limit: 1 },
      })
      const existing = listed.data.sales_channels?.[0]
      if (existing) return existing.id as string

      const created = await api.post(
        "/admin/sales-channels",
        { name: "DEMO Commerce Operations" },
        adminConfig(),
      )
      expect([200, 201]).toContain(created.status)
      return created.data.sales_channel.id as string
    }

    const ensureStockLocation = async () => {
      const listed = await api.get("/admin/stock-locations", {
        ...adminConfig(),
        params: { limit: 1 },
      })
      const existing = listed.data.stock_locations?.[0]
      if (existing) return existing.id as string

      const created = await api.post(
        "/admin/stock-locations",
        { name: "DEMO Commerce Operations" },
        adminConfig(),
      )
      expect([200, 201]).toContain(created.status)
      return created.data.stock_location.id as string
    }

    const linkStockLocationToSalesChannel = async () => {
      const response = await api.post(
        `/admin/stock-locations/${stockLocationId}/sales-channels`,
        { add: [salesChannelId] },
        adminConfig(),
      )
      expect([200, 201]).toContain(response.status)
    }

    /**
     * Envío manual de laboratorio para poder completar un pedido. No representa
     * una tarifa comercial ni usa un proveedor logístico real.
     */
    const ensureShippingOption = async () => {
      const container = getContainer()
      const query = container.resolve(ContainerRegistrationKeys.QUERY)
      const link = container.resolve(ContainerRegistrationKeys.LINK) as {
        create: (payload: Record<string, unknown>) => Promise<unknown>
      }
      const fulfillment = container.resolve(Modules.FULFILLMENT)

      const providerLink = await api.post(
        `/admin/stock-locations/${stockLocationId}/fulfillment-providers`,
        { add: ["manual_manual"] },
        adminConfig(),
      )
      expect([200, 201]).toContain(providerLink.status)

      const fulfillmentSet = await fulfillment.createFulfillmentSets({
        name: unique("DEMO Shipping"),
        type: "shipping",
        service_zones: [
          {
            name: "DEMO Mexico",
            geo_zones: [{ country_code: "mx", type: "country" }],
          },
        ],
      })
      await link.create({
        [Modules.STOCK_LOCATION]: { stock_location_id: stockLocationId },
        [Modules.FULFILLMENT]: {
          fulfillment_set_id: fulfillmentSet.id,
        },
      })

      const { data: sets } = await query.graph({
        entity: "fulfillment_set",
        fields: ["id", "service_zones.id"],
        filters: { id: fulfillmentSet.id },
      })
      const serviceZoneId = (
        sets[0] as { service_zones?: Array<{ id: string }> }
      ).service_zones?.[0]?.id
      expect(serviceZoneId).toBeTruthy()
      if (!serviceZoneId) {
        throw new Error("El fulfillment set DEMO no tiene service zone")
      }

      const { data: profiles } = await query.graph({
        entity: "shipping_profile",
        fields: ["id"],
        pagination: { take: 1, skip: 0 },
      })
      shippingProfileId = (profiles[0] as { id?: string } | undefined)?.id ?? ""
      if (!shippingProfileId) {
        const { result: createdProfiles } =
          await createShippingProfilesWorkflow(container).run({
            input: {
              data: [{ name: "DEMO Shipping", type: "default" }],
            },
          })
        shippingProfileId = createdProfiles[0].id
      }

      const { result } = await createShippingOptionsWorkflow(container).run({
        input: [
          {
            name: "DEMO envío operaciones",
            price_type: "flat",
            provider_id: "manual_manual",
            service_zone_id: serviceZoneId,
            shipping_profile_id: shippingProfileId,
            type: {
              label: "DEMO envío operaciones",
              description: "Fixture de pruebas; no es una tarifa comercial.",
              code: unique("demo-shipping"),
            },
            prices: [{ currency_code: currencyCode, amount: 99 }],
            rules: [
              { attribute: "enabled_in_store", value: "true", operator: "eq" },
              { attribute: "is_return", value: "false", operator: "eq" },
            ],
          },
        ],
      })
      return result[0].id as string
    }

    const createProduct = async ({
      manageInventory = false,
      allowBackorder = true,
      amount = 10_000,
    }: {
      manageInventory?: boolean
      allowBackorder?: boolean
      amount?: number
    } = {}) => {
      const handle = unique("demo-ops")
      const created = await api.post(
        "/admin/products",
        {
          title: `DEMO ${handle}`,
          handle,
          status: "published",
          thumbnail: `https://example.test/${handle}.png`,
          shipping_profile_id: shippingProfileId,
          options: [{ title: "Presentación", values: ["Única"] }],
          variants: [
            {
              title: "Única",
              sku: `${handle}-UNICA`,
              options: { Presentación: "Única" },
              manage_inventory: manageInventory,
              allow_backorder: allowBackorder,
              prices: [{ currency_code: currencyCode, amount }],
            },
          ],
          sales_channels: [{ id: salesChannelId }],
        },
        adminConfig(),
      )
      expect(created.status).toBe(200)

      const product = created.data.product
      // La validación comercial del storefront exige modalidad SELLABLE; sin
      // ficha editorial el producto se trata como CATALOG_ONLY.
      const editorial = await api.put(
        `/admin/jovy/products/${product.id}/editorial`,
        { commercial_mode: "sellable" },
        adminConfig(),
      )
      expect(editorial.status).toBe(200)

      return {
        productId: product.id as string,
        variantId: product.variants?.[0]?.id as string,
      }
    }

    const createInventoryForVariant = async (
      productId: string,
      variantId: string,
      stockedQuantity: number,
    ) => {
      // Medusa crea un inventory item automático al habilitar
      // `manage_inventory`; enlazar un segundo item duplicaría el requisito de
      // stock. Se reutiliza el item real de la variante.
      const product = await api.get(`/admin/products/${productId}`, {
        ...adminConfig(),
        params: { fields: "variants.id,variants.inventory_items.inventory_item_id" },
      })
      expect(product.status).toBe(200)
      const variant = (product.data.product.variants as Array<{
        id: string
        inventory_items?: Array<{ inventory_item_id: string }>
      }>).find((candidate) => candidate.id === variantId)
      let inventoryItemId = variant?.inventory_items?.[0]?.inventory_item_id

      if (!inventoryItemId) {
        const inventoryItem = await api.post(
          "/admin/inventory-items",
          { sku: unique("sku-ops") },
          adminConfig(),
        )
        expect(inventoryItem.status).toBe(200)
        inventoryItemId = inventoryItem.data.inventory_item.id as string

        const link = await api.post(
          `/admin/products/${productId}/variants/${variantId}/inventory-items`,
          { inventory_item_id: inventoryItemId, required_quantity: 1 },
          adminConfig(),
        )
        expect(link.status).toBe(200)
      }

      const level = await api.post(
        `/admin/inventory-items/${inventoryItemId}/location-levels`,
        { location_id: stockLocationId, stocked_quantity: stockedQuantity },
        adminConfig(),
      )
      expect(level.status).toBe(200)

      return inventoryItemId
    }

    const createCart = async () => {
      const response = await api.post(
        "/store/carts",
        {
          region_id: regionId,
          sales_channel_id: salesChannelId,
          email: `${unique("buyer")}@example.test`,
        },
        storeConfig(),
      )
      expect(response.status).toBe(200)
      return response.data.cart.id as string
    }

    const addLineItem = (cartId: string, variantId: string, quantity: number) =>
      api.post(
        `/store/carts/${cartId}/line-items`,
        { variant_id: variantId, quantity },
        storeConfig(),
      )

    const createPromotion = async (payload: Record<string, unknown>) => {
      const response = await api.post(
        "/admin/promotions",
        {
          status: "active",
          ...payload,
        },
        adminConfig(),
      )
      expect(response.status).toBe(200)
      return response.data.promotion as { id: string; code: string }
    }

    beforeAll(async () => {
      publishableApiKey = await createPublishableApiKey(getContainer())
      adminToken = await createAdminSession(getContainer(), api)
      const region = await ensureRegion()
      regionId = region.id
      currencyCode = region.currency_code
      salesChannelId = await ensureSalesChannel()
      stockLocationId = await ensureStockLocation()
      await linkStockLocationToSalesChannel()
      shippingOptionId = await ensureShippingOption()
    })

    describe("Promotion Module", () => {
      it("aplica y retira un cupón porcentual con totales de Medusa", async () => {
        const product = await createProduct({ amount: 10_000 })
        const cartId = await createCart()
        expect((await addLineItem(cartId, product.variantId, 2)).status).toBe(200)

        const code = unique("DEMO10").toUpperCase()
        await createPromotion({
          code,
          type: "standard",
          application_method: {
            type: "percentage",
            target_type: "items",
            allocation: "each",
            max_quantity: 100,
            value: 10,
            currency_code: currencyCode,
          },
        })

        const applied = await api.post(
          `/store/carts/${cartId}/promotions`,
          { promo_codes: [code] },
          storeConfig(),
        )
        expect(applied.status).toBe(200)
        expect(applied.data.cart.discount_total).toBe(2_000)

        const removed = await api.delete(
          `/store/carts/${cartId}/promotions`,
          { ...storeConfig(), data: { promo_codes: [code] } },
        )
        expect(removed.status).toBe(200)
        expect(removed.data.cart.discount_total).toBe(0)
      })

      it("rechaza un código inválido sin alterar el carrito", async () => {
        const product = await createProduct()
        const cartId = await createCart()
        await addLineItem(cartId, product.variantId, 1)

        const rejected = await api.post(
          `/store/carts/${cartId}/promotions`,
          { promo_codes: ["NO-EXISTE-DEMO"] },
          storeConfig(),
        )
        expect([400, 422]).toContain(rejected.status)

        const cart = await store(`/store/carts/${cartId}`)
        expect(cart.status).toBe(200)
        expect(cart.data.cart.discount_total).toBe(0)
      })

      it("no aplica un cupón inactivo", async () => {
        const product = await createProduct()
        const cartId = await createCart()
        await addLineItem(cartId, product.variantId, 1)

        const code = unique("INACTIVO").toUpperCase()
        const promotion = await createPromotion({
          code,
          type: "standard",
          application_method: {
            type: "percentage",
            target_type: "items",
            allocation: "each",
            max_quantity: 100,
            value: 15,
            currency_code: currencyCode,
          },
        })

        const disabled = await api.post(
          `/admin/promotions/${promotion.id}`,
          { status: "inactive" },
          adminConfig(),
        )
        expect(disabled.status).toBe(200)

        const rejected = await api.post(
          `/store/carts/${cartId}/promotions`,
          { promo_codes: [code] },
          storeConfig(),
        )
        if (rejected.status === 200) {
          // Medusa acepta el código pero no concede descuento si la promoción
          // ya no está activa; el contrato comercial es el total, no el código.
          expect(rejected.data.cart.discount_total).toBe(0)
        } else {
          expect([400, 422]).toContain(rejected.status)
        }
      })

      it("respeta la elegibilidad por producto", async () => {
        const eligible = await createProduct({ amount: 8_000 })
        const other = await createProduct({ amount: 8_000 })
        const code = unique("PRODUCTO").toUpperCase()

        await createPromotion({
          code,
          type: "standard",
          application_method: {
            type: "percentage",
            target_type: "items",
            allocation: "each",
            max_quantity: 100,
            value: 20,
            currency_code: currencyCode,
            target_rules: [
              {
                attribute: "items.product.id",
                operator: "in",
                values: [eligible.productId],
              },
            ],
          },
        })

        const eligibleCart = await createCart()
        await addLineItem(eligibleCart, eligible.variantId, 1)
        const applied = await api.post(
          `/store/carts/${eligibleCart}/promotions`,
          { promo_codes: [code] },
          storeConfig(),
        )
        expect(applied.status).toBe(200)
        expect(applied.data.cart.discount_total).toBe(1_600)

        const otherCart = await createCart()
        await addLineItem(otherCart, other.variantId, 1)
        const notEligible = await api.post(
          `/store/carts/${otherCart}/promotions`,
          { promo_codes: [code] },
          storeConfig(),
        )
        if (notEligible.status === 200) {
          expect(notEligible.data.cart.discount_total).toBe(0)
        } else {
          expect([400, 422]).toContain(notEligible.status)
        }
      })
    })

    describe("Inventory Module", () => {
      it("impide superar el stock y libera la reserva al concurrir", async () => {
        const product = await createProduct({
          manageInventory: true,
          allowBackorder: false,
          amount: 5_000,
        })
        await createInventoryForVariant(product.productId, product.variantId, 1)

        const overstockCart = await createCart()
        const rejected = await addLineItem(
          overstockCart,
          product.variantId,
          2,
        )
        expect([400, 409, 422]).toContain(rejected.status)

        // Fixture independiente: el intento fallido anterior no debe contaminar
        // el stock disponible de la prueba de concurrencia.
        const concurrentProduct = await createProduct({
          manageInventory: true,
          allowBackorder: false,
          amount: 5_000,
        })
        const concurrentInventoryItemId = await createInventoryForVariant(
          concurrentProduct.productId,
          concurrentProduct.variantId,
          2,
        )

        // La reserva es la operación que compromete stock. Dos carritos pueden
        // ver disponibilidad al agregar; la sobreventa se decide al reservar.
        // El workflow oficial aplica locking por inventory item; la llamada
        // directa al servicio no lo hace y permitiría sobrevender.
        const inventory = getContainer().resolve(Modules.INVENTORY)
        const reserve = (lineItemId: string) =>
          createReservationsWorkflow(getContainer()).run({
            input: {
              reservations: [
                {
                  inventory_item_id: concurrentInventoryItemId,
                  location_id: stockLocationId,
                  quantity: 1,
                  line_item_id: lineItemId,
                },
              ],
            },
          })

        const results = await Promise.allSettled([
          reserve("line-demo-a"),
          reserve("line-demo-b"),
          reserve("line-demo-c"),
        ])

        expect(
          results.filter((result) => result.status === "fulfilled"),
        ).toHaveLength(2)
        expect(
          results.filter((result) => result.status === "rejected"),
        ).toHaveLength(1)

        const [level] = await inventory.listInventoryLevels({
          inventory_item_id: concurrentInventoryItemId,
          location_id: stockLocationId,
        })
        expect(Number(level.reserved_quantity)).toBe(2)
        expect(Number(level.available_quantity)).toBe(0)
      })

      it("permite backorder cuando la variante lo autoriza", async () => {
        const product = await createProduct({
          manageInventory: true,
          allowBackorder: true,
          amount: 3_000,
        })
        await createInventoryForVariant(product.productId, product.variantId, 0)

        const cartId = await createCart()
        const accepted = await addLineItem(cartId, product.variantId, 3)

        expect(accepted.status).toBe(200)
        expect(accepted.data.cart.items?.[0]?.quantity).toBe(3)
      })
    })

    describe("Health checks", () => {
      it("readiness confirma PostgreSQL sin autenticación", async () => {
        const response = await api.get("/health/ready")

        expect(response.status).toBe(200)
        expect(response.data).toMatchObject({
          status: "ready",
          checks: { database: "ok" },
        })
      })
    })

    describe("Staging bootstrap", () => {
      it("rota la key inicial y valida el token en un segundo deploy", async () => {
        const directory = await mkdtemp(path.join(os.tmpdir(), "jovy-key-"))
        const tokenFile = path.join(directory, "publishable-key.txt")
        const previousFile = process.env.STAGING_PUBLISHABLE_KEY_FILE
        const previousRotate = process.env.STAGING_ROTATE_DEFAULT_PUBLISHABLE_KEY
        const previousConfigured = process.env.STAGING_CONFIGURED_PUBLISHABLE_KEY

        process.env.STAGING_PUBLISHABLE_KEY_FILE = tokenFile
        process.env.STAGING_ROTATE_DEFAULT_PUBLISHABLE_KEY = "true"
        delete process.env.STAGING_CONFIGURED_PUBLISHABLE_KEY

        try {
          const execArgs = {
            container: getContainer(),
            args: [],
          } as never
          await ensureStagingPublishableKey(execArgs)
          const firstToken = (await readFile(tokenFile, "utf8")).trim()
          expect(firstToken).toMatch(/^pk_/)

          await ensureStagingPublishableKey(execArgs)
          expect((await readFile(tokenFile, "utf8")).trim()).toBe(firstToken)

          await rm(tokenFile)
          process.env.STAGING_CONFIGURED_PUBLISHABLE_KEY = firstToken
          await ensureStagingPublishableKey(execArgs)
          expect((await readFile(tokenFile, "utf8")).trim()).toBe(firstToken)
        } finally {
          if (previousFile === undefined) {
            delete process.env.STAGING_PUBLISHABLE_KEY_FILE
          } else {
            process.env.STAGING_PUBLISHABLE_KEY_FILE = previousFile
          }
          if (previousRotate === undefined) {
            delete process.env.STAGING_ROTATE_DEFAULT_PUBLISHABLE_KEY
          } else {
            process.env.STAGING_ROTATE_DEFAULT_PUBLISHABLE_KEY = previousRotate
          }
          if (previousConfigured === undefined) {
            delete process.env.STAGING_CONFIGURED_PUBLISHABLE_KEY
          } else {
            process.env.STAGING_CONFIGURED_PUBLISHABLE_KEY = previousConfigured
          }
          await rm(directory, { recursive: true, force: true })
        }
      })
    })

    describe("Order lifecycle", () => {
      it("completa un pedido DEMO y lo cancela con estado consistente", async () => {
        const product = await createProduct({ amount: 7_000 })
        const cartId = await createCart()
        expect(
          (await addLineItem(cartId, product.variantId, 1)).status,
        ).toBe(200)

        const address = {
          first_name: "Demo",
          last_name: "Buyer",
          address_1: "Av. Laboratorio 1",
          city: "Ciudad de Mexico",
          country_code: "mx",
          postal_code: "01000",
          phone: "5555555555",
        }
        const withAddress = await api.post(
          `/store/carts/${cartId}`,
          {
            email: `${unique("order")}@example.test`,
            shipping_address: address,
            billing_address: address,
          },
          storeConfig(),
        )
        expect(withAddress.status).toBe(200)

        const options = await api.get(
          `/store/shipping-options?cart_id=${cartId}`,
          storeConfig(),
        )
        expect(options.status).toBe(200)
        const option = (
          options.data.shipping_options as Array<{ id: string }>
        ).find((candidate) => candidate.id === shippingOptionId)
        expect(option).toBeTruthy()

        const shipping = await api.post(
          `/store/carts/${cartId}/shipping-methods`,
          { option_id: shippingOptionId },
          storeConfig(),
        )
        expect(shipping.status).toBe(200)

        const collection = await api.post(
          "/store/payment-collections",
          { cart_id: cartId },
          storeConfig(),
        )
        expect(collection.status).toBe(200)

        const session = await api.post(
          `/store/payment-collections/${collection.data.payment_collection.id}/payment-sessions`,
          { provider_id: "pp_system_default" },
          storeConfig(),
        )
        expect(session.status).toBe(200)

        const completed = await api.post(
          `/store/carts/${cartId}/complete`,
          {},
          storeConfig(),
        )
        expect(completed.status).toBe(200)
        expect(completed.data.type).toBe("order")
        const orderId = completed.data.order.id as string

        const canceled = await api.post(
          `/admin/orders/${orderId}/cancel`,
          {},
          adminConfig(),
        )
        expect(canceled.status).toBe(200)

        const order = await api.get(`/admin/orders/${orderId}`, adminConfig())
        expect(order.status).toBe(200)
        expect(order.data.order.status).toBe("canceled")
      })
    })
  },
})
