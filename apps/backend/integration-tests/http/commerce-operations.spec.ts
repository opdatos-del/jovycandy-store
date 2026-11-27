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
import seedCommerceCampaign from "@jovy/scripts/seed-commerce-campaign"

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

    /** La Store API solo resuelve precios si la publishable key tiene canal. */
    const linkPublishableKeyToSalesChannel = async () => {
      const keys = await api.get("/admin/api-keys", {
        ...adminConfig(),
        params: { type: "publishable", limit: 100 },
      })
      const key = (keys.data.api_keys as Array<{ id: string; token?: string }>).find(
        (candidate) => candidate.token === publishableApiKey,
      )
      expect(key).toBeTruthy()
      const linked = await api.post(
        `/admin/api-keys/${key!.id}/sales-channels`,
        { add: [salesChannelId] },
        adminConfig(),
      )
      expect([200, 201]).toContain(linked.status)
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
        handle,
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

    const createSalePriceList = async (
      product: { variantId: string },
      amount: number,
      { startsAt, endsAt }: { startsAt: Date; endsAt: Date },
    ) => {
      const response = await api.post(
        "/admin/price-lists",
        {
          title: unique("DEMO Sale"),
          description: "Lista de precios de laboratorio.",
          type: "sale",
          status: "active",
          starts_at: startsAt.toISOString(),
          ends_at: endsAt.toISOString(),
          prices: [
            {
              variant_id: product.variantId,
              currency_code: currencyCode,
              amount,
            },
          ],
        },
        adminConfig(),
      )
      expect(response.status).toBe(200)
      return response.data.price_list as { id: string }
    }

    const calculatedPriceFor = async (handle: string, variantId: string) => {
      const response = await api.get(
        `/store/products?handle=${encodeURIComponent(handle)}&region_id=${regionId}&fields=*variants.calculated_price`,
        storeConfig(),
      )
      expect(response.status).toBe(200)
      const variant = (
        response.data.products?.[0]?.variants as Array<{
          id: string
          calculated_price?: {
            calculated_amount?: number
            original_amount?: number
            calculated_price?: { price_list_type?: string | null }
          }
        }>
      )?.find((candidate) => candidate.id === variantId)
      expect(variant?.calculated_price).toBeTruthy()
      return variant!.calculated_price!
    }

    const setCartShippingAddress = async (cartId: string) => {
      const address = {
        first_name: "Demo",
        last_name: "Buyer",
        address_1: "Av. Laboratorio 1",
        city: "Ciudad de Mexico",
        country_code: "mx",
        postal_code: "01000",
        phone: "5555555555",
      }
      const response = await api.post(
        `/store/carts/${cartId}`,
        {
          email: `${unique("promo")}@example.test`,
          shipping_address: address,
          billing_address: address,
        },
        storeConfig(),
      )
      expect(response.status).toBe(200)
    }

    beforeAll(async () => {
      publishableApiKey = await createPublishableApiKey(getContainer())
      adminToken = await createAdminSession(getContainer(), api)
      const region = await ensureRegion()
      regionId = region.id
      currencyCode = region.currency_code
      salesChannelId = await ensureSalesChannel()
      await linkPublishableKeyToSalesChannel()
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

      it("aplica un precio de Price List sale y lo revierte al expirar", async () => {
        const product = await createProduct({ amount: 10_000 })
        const now = Date.now()
        const priceList = await createSalePriceList(product, 8_000, {
          startsAt: new Date(now - 60_000),
          endsAt: new Date(now + 60 * 60_000),
        })

        const active = await calculatedPriceFor(product.handle, product.variantId)
        expect(active.calculated_amount).toBe(8_000)
        expect(active.original_amount).toBe(10_000)
        expect(active.calculated_price?.price_list_type).toBe("sale")

        const expired = await api.post(
          `/admin/price-lists/${priceList.id}`,
          { ends_at: new Date(now - 30_000).toISOString() },
          adminConfig(),
        )
        expect(expired.status).toBe(200)

        const base = await calculatedPriceFor(product.handle, product.variantId)
        expect(base.calculated_amount).toBe(10_000)
        expect(base.calculated_price?.price_list_type).not.toBe("sale")
      })

      it("descuenta un importe fijo sobre el precio de oferta vigente", async () => {
        const product = await createProduct({ amount: 10_000 })
        const now = Date.now()
        await createSalePriceList(product, 8_000, {
          startsAt: new Date(now - 60_000),
          endsAt: new Date(now + 60 * 60_000),
        })

        const cartId = await createCart()
        expect((await addLineItem(cartId, product.variantId, 1)).status).toBe(200)

        const code = unique("FIJO").toUpperCase()
        await createPromotion({
          code,
          type: "standard",
          application_method: {
            type: "fixed",
            target_type: "items",
            allocation: "each",
            max_quantity: 100,
            value: 500,
            currency_code: currencyCode,
          },
        })

        const applied = await api.post(
          `/store/carts/${cartId}/promotions`,
          { promo_codes: [code] },
          storeConfig(),
        )
        expect(applied.status).toBe(200)
        expect(applied.data.cart.discount_total).toBe(500)
        expect(applied.data.cart.total).toBe(7_500)
      })

      it("aplica una promoción automática sin código", async () => {
        const product = await createProduct({ amount: 10_000 })

        const promotion = await createPromotion({
          code: unique("AUTO").toUpperCase(),
          type: "standard",
          is_automatic: true,
          application_method: {
            type: "percentage",
            target_type: "items",
            allocation: "each",
            max_quantity: 100,
            value: 15,
            currency_code: currencyCode,
          },
        })

        try {
          // El carrito se crea con la promoción ya activa: Medusa calcula los
          // ajustes al agregar la línea, no al consultar un carrito previo.
          const cartId = await createCart()
          expect((await addLineItem(cartId, product.variantId, 1)).status).toBe(200)
          const cart = await store(`/store/carts/${cartId}`)
          expect(cart.status).toBe(200)
          expect(cart.data.cart.discount_total).toBe(1_500)
        } finally {
          // La promoción automática aplica a cualquier carrito de la base; se
          // desactiva para no contaminar el resto de las pruebas.
          await api.post(
            `/admin/promotions/${promotion.id}`,
            { status: "inactive" },
            adminConfig(),
          )
        }
      })

      it("deja el envío en cero con una promoción nativa de envío gratis", async () => {
        const product = await createProduct({ amount: 10_000 })
        const cartId = await createCart()
        expect((await addLineItem(cartId, product.variantId, 1)).status).toBe(200)
        await setCartShippingAddress(cartId)

        const shipping = await api.post(
          `/store/carts/${cartId}/shipping-methods`,
          { option_id: shippingOptionId },
          storeConfig(),
        )
        expect(shipping.status).toBe(200)
        expect(shipping.data.cart.shipping_total).toBe(99)

        const code = unique("ENVIO").toUpperCase()
        await createPromotion({
          code,
          type: "standard",
          application_method: {
            type: "percentage",
            target_type: "shipping_methods",
            allocation: "across",
            value: 100,
            currency_code: currencyCode,
          },
        })

        const applied = await api.post(
          `/store/carts/${cartId}/promotions`,
          { promo_codes: [code] },
          storeConfig(),
        )
        expect(applied.status).toBe(200)
        expect(applied.data.cart.shipping_total).toBe(0)
      })

      it("respeta el límite de uso de una promoción al completar pedidos", async () => {
        const product = await createProduct({ amount: 10_000 })
        const code = unique("LIMITE").toUpperCase()
        await createPromotion({
          code,
          type: "standard",
          limit: 1,
          application_method: {
            type: "percentage",
            target_type: "items",
            allocation: "each",
            max_quantity: 100,
            value: 10,
            currency_code: currencyCode,
          },
        })

        const prepareCart = async () => {
          const cartId = await createCart()
          expect((await addLineItem(cartId, product.variantId, 1)).status).toBe(200)
          await setCartShippingAddress(cartId)
          expect(
            (
              await api.post(
                `/store/carts/${cartId}/shipping-methods`,
                { option_id: shippingOptionId },
                storeConfig(),
              )
            ).status,
          ).toBe(200)
          return cartId
        }

        const complete = async (cartId: string) => {
          const collection = await api.post(
            "/store/payment-collections",
            { cart_id: cartId },
            storeConfig(),
          )
          expect(collection.status).toBe(200)
          expect(
            (
              await api.post(
                `/store/payment-collections/${collection.data.payment_collection.id}/payment-sessions`,
                { provider_id: "pp_system_default" },
                storeConfig(),
              )
            ).status,
          ).toBe(200)
          return api.post(`/store/carts/${cartId}/complete`, {}, storeConfig())
        }

        const firstCart = await prepareCart()
        const firstApply = await api.post(
          `/store/carts/${firstCart}/promotions`,
          { promo_codes: [code] },
          storeConfig(),
        )
        expect(firstApply.status).toBe(200)
        expect(firstApply.data.cart.discount_total).toBe(1_000)
        expect((await complete(firstCart)).status).toBe(200)

        // El límite 1 ya se consumió: Medusa acepta el código pero no concede
        // el descuento en un segundo carrito.
        const secondCart = await prepareCart()
        const secondApply = await api.post(
          `/store/carts/${secondCart}/promotions`,
          { promo_codes: [code] },
          storeConfig(),
        )
        expect(secondApply.status).toBe(200)
        expect(secondApply.data.cart.discount_total).toBe(0)
        expect(secondApply.data.cart.promotions ?? []).toHaveLength(0)
      })

      it("no aplica un cupón de una campaña vencida", async () => {
        const product = await createProduct({ amount: 5_000 })
        const cartId = await createCart()
        await addLineItem(cartId, product.variantId, 1)

        const now = Date.now()
        const campaign = await api.post(
          "/admin/campaigns",
          {
            name: unique("DEMO vencida"),
            campaign_identifier: unique("vencida"),
            starts_at: new Date(now - 120_000).toISOString(),
            ends_at: new Date(now - 60_000).toISOString(),
          },
          adminConfig(),
        )
        expect(campaign.status).toBe(200)

        const code = unique("VENCIDO").toUpperCase()
        await createPromotion({
          code,
          type: "standard",
          campaign_id: campaign.data.campaign.id,
          application_method: {
            type: "percentage",
            target_type: "items",
            allocation: "each",
            max_quantity: 100,
            value: 30,
            currency_code: currencyCode,
          },
        })

        const applied = await api.post(
          `/store/carts/${cartId}/promotions`,
          { promo_codes: [code] },
          storeConfig(),
        )
        if (applied.status === 200) {
          expect(applied.data.cart.discount_total).toBe(0)
        } else {
          expect([400, 422]).toContain(applied.status)
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

    describe("Catálogo gobernado por Medusa", () => {
      it("publica en el storefront un producto creado en Admin sin ficha editorial", async () => {
        const handle = unique("demo-admin-only")
        const created = await api.post(
          "/admin/products",
          {
            title: `DEMO Admin ${handle}`,
            handle,
            status: "published",
            shipping_profile_id: shippingProfileId,
            options: [{ title: "Presentación", values: ["Única"] }],
            variants: [
              {
                title: "Única",
                sku: `${handle}-UNICA`,
                options: { Presentación: "Única" },
                prices: [{ currency_code: currencyCode, amount: 4_500 }],
              },
            ],
            sales_channels: [{ id: salesChannelId }],
          },
          adminConfig(),
        )
        expect(created.status).toBe(200)

        const response = await api.get("/store/jovy/products", storeConfig())
        expect(response.status).toBe(200)

        const item = (
          response.data.products as Array<{
            product: { handle: string }
            commercial_mode: string
            product_status: string
          }>
        ).find((candidate) => candidate.product.handle === handle)

        expect(item).toBeTruthy()
        expect(item?.product_status).toBe("published")
        expect(item?.commercial_mode).toBe("SELLABLE")
      })

      it("asocia categoría y colección nativas y refleja sus cambios", async () => {
        const key = unique("demo-nativas")
        const category = await api.post(
          "/admin/product-categories",
          { name: `Categoría ${key}`, handle: `${key}-cat`, is_active: true },
          adminConfig(),
        )
        expect(category.status).toBe(200)

        const collection = await api.post(
          "/admin/collections",
          { title: `Colección ${key}`, handle: `${key}-col` },
          adminConfig(),
        )
        expect(collection.status).toBe(200)

        const product = await api.post(
          "/admin/products",
          {
            title: `DEMO Nativas ${key}`,
            handle: key,
            status: "published",
            shipping_profile_id: shippingProfileId,
            categories: [{ id: category.data.product_category.id }],
            collection_id: collection.data.collection.id,
            options: [{ title: "Presentación", values: ["Única"] }],
            variants: [
              {
                title: "Única",
                sku: `${key}-UNICA`,
                options: { Presentación: "Única" },
                prices: [{ currency_code: currencyCode, amount: 3_000 }],
              },
            ],
            sales_channels: [{ id: salesChannelId }],
          },
          adminConfig(),
        )
        expect(product.status).toBe(200)

        const storeProduct = await api.get(
          `/store/products?handle=${key}&fields=*categories,*collection`,
          storeConfig(),
        )
        expect(storeProduct.status).toBe(200)
        expect(storeProduct.data.products[0].categories.map((item: { id: string }) => item.id)).toContain(
          category.data.product_category.id,
        )
        expect(storeProduct.data.products[0].collection.handle).toBe(`${key}-col`)

        const renamed = await api.post(
          `/admin/product-categories/${category.data.product_category.id}`,
          { name: `Categoría editada ${key}` },
          adminConfig(),
        )
        expect(renamed.status).toBe(200)
        const retitled = await api.post(
          `/admin/collections/${collection.data.collection.id}`,
          { title: `Colección editada ${key}` },
          adminConfig(),
        )
        expect(retitled.status).toBe(200)

        const categories = await api.get(
          `/store/product-categories?handle=${key}-cat`,
          storeConfig(),
        )
        expect(categories.status).toBe(200)
        expect(categories.data.product_categories[0].name).toBe(`Categoría editada ${key}`)

        const collections = await api.get(
          `/store/collections?handle=${key}-col`,
          storeConfig(),
        )
        expect(collections.status).toBe(200)
        expect(collections.data.collections[0].title).toBe(`Colección editada ${key}`)
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

    // El servicio PostgreSQL CI usa el puerto protegido 5432 y no es un
    // cluster efímero verificable. Las guardas del seed se prueban en unitarias
    // y el flujo real se ejecuta en el E2E aislado local.
    const campaignSeedDescribe =
      process.env.JOVY_CI_POSTGRES_SERVICE === "1" ? describe.skip : describe

    campaignSeedDescribe("Campaña de laboratorio", () => {
      it("crea la campaña una vez y reutiliza sus promociones", async () => {
        // El runner restaura la base por prueba, así que la campaña necesita
        // al menos una variante publicada con precio MXN en este escenario.
        await createProduct({ amount: 10_000 })

        const execArgs = { container: getContainer(), args: [] } as never
        await seedCommerceCampaign(execArgs)
        await seedCommerceCampaign(execArgs)

        const query = getContainer().resolve(ContainerRegistrationKeys.QUERY)
        const { data: campaigns } = await query.graph({
          entity: "campaign",
          fields: ["id", "campaign_identifier"],
          filters: { campaign_identifier: "buen-fin-laboratorio" },
        })
        expect(campaigns).toHaveLength(1)

        const { data: priceLists } = await query.graph({
          entity: "price_list",
          fields: ["id", "title", "status", "type"],
          filters: { title: "Buen Fin Laboratorio - Precios" },
        })
        expect(priceLists).toHaveLength(1)
        expect(priceLists[0]).toMatchObject({ status: "active", type: "sale" })

        const { data: promotions } = await query.graph({
          entity: "promotion",
          fields: ["id", "code"],
          filters: {
            code: ["BUENFIN10", "BUENFIN50", "AUTO15", "ENVIOGRATIS"],
          },
        })
        expect(promotions).toHaveLength(4)
      })

      it("aborta sin escrituras si la configuración es inválida", async () => {
        const execArgs = { container: getContainer(), args: [] } as never
        const query = getContainer().resolve(ContainerRegistrationKeys.QUERY)

        const countCampaigns = async () =>
          (
            await query.graph({
              entity: "campaign",
              fields: ["id"],
              filters: { campaign_identifier: "buen-fin-laboratorio" },
            })
          ).data.length

        expect(await countCampaigns()).toBe(0)

        const previousPercent = process.env.JOVY_CAMPAIGN_SALE_PERCENT
        process.env.JOVY_CAMPAIGN_SALE_PERCENT = "0"
        try {
          await expect(seedCommerceCampaign(execArgs)).rejects.toMatchObject({
            code: "invalid_range",
          })
        } finally {
          if (previousPercent === undefined) delete process.env.JOVY_CAMPAIGN_SALE_PERCENT
          else process.env.JOVY_CAMPAIGN_SALE_PERCENT = previousPercent
        }
        expect(await countCampaigns()).toBe(0)

        const previousNodeEnv = process.env.NODE_ENV
        process.env.NODE_ENV = "production"
        try {
          await expect(seedCommerceCampaign(execArgs)).rejects.toMatchObject({
            code: "forbidden_environment",
          })
        } finally {
          if (previousNodeEnv === undefined) delete process.env.NODE_ENV
          else process.env.NODE_ENV = previousNodeEnv
        }
        expect(await countCampaigns()).toBe(0)
      })

      it("aborta sin escrituras si un SKU solicitado no existe", async () => {
        await createProduct({ amount: 10_000 })
        const execArgs = { container: getContainer(), args: [] } as never
        const query = getContainer().resolve(ContainerRegistrationKeys.QUERY)

        const previousSkus = process.env.JOVY_CAMPAIGN_SKUS
        process.env.JOVY_CAMPAIGN_SKUS = "SKU-QUE-NO-EXISTE"
        try {
          await expect(seedCommerceCampaign(execArgs)).rejects.toMatchObject({
            code: "missing_skus",
          })
        } finally {
          if (previousSkus === undefined) delete process.env.JOVY_CAMPAIGN_SKUS
          else process.env.JOVY_CAMPAIGN_SKUS = previousSkus
        }

        const { data: campaigns } = await query.graph({
          entity: "campaign",
          fields: ["id"],
          filters: { campaign_identifier: "buen-fin-laboratorio" },
        })
        expect(campaigns).toHaveLength(0)

        const { data: priceLists } = await query.graph({
          entity: "price_list",
          fields: ["id"],
          filters: { title: "Buen Fin Laboratorio - Precios" },
        })
        expect(priceLists).toHaveLength(0)
      })
    })
  },
})
