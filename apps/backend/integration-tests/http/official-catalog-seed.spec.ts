import path from "node:path"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import type { ExecArgs } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  Modules,
  ProductStatus,
} from "@medusajs/framework/utils"
import {
  createProductsWorkflow,
  createReservationsWorkflow,
  createShippingProfilesWorkflow,
  createLinksWorkflow,
  deleteReservationsWorkflow,
  dismissLinksWorkflow,
  updateProductsWorkflow,
  upsertVariantPricesWorkflow,
} from "@medusajs/medusa/core-flows"

import manifest from "@jovy/data/catalog/official-mx.json"
import { JOVY_CATALOGUE_MODULE } from "@jovy/modules/jovy-catalogue"
import seedCommerceLab from "@jovy/scripts/seed-commerce-lab"
import seedOfficialCatalog from "@jovy/scripts/seed-official-catalog"
import restoreOfficialInventory from "@jovy/scripts/restore-official-inventory"

jest.mock("@jovy/data/catalog/official-mx.json", () =>
  require("./fixtures/official-catalog-manifest").default,
)

jest.setTimeout(240_000)

medusaIntegrationTestRunner({
  cwd: path.join(__dirname, "..", ".."),
  dbName: "medusa-jovy-http-official-catalog-seed",
  testSuite: ({ getContainer }) => {
    const originalFetch = global.fetch
    const originalMode = process.env.OFFICIAL_SEED_MODE
    const originalConfirmation = process.env.CONFIRM_RESTORE_LAB_STOCK
    let fetchSpy: jest.SpiedFunction<typeof fetch>

    const query = () =>
      getContainer().resolve(ContainerRegistrationKeys.QUERY) as {
        graph: (input: {
          entity: string
          fields: string[]
          filters?: Record<string, unknown>
          pagination?: { take: number; skip: number }
        }) => Promise<{ data: Array<Record<string, any>> }>
      }

    const runSeed = () =>
      seedOfficialCatalog({
        container: getContainer(),
        args: [],
      } as ExecArgs)

    const officialProduct = async () => {
      const { data } = await query().graph({
        entity: "product",
        fields: [
          "id",
          "external_id",
          "handle",
          "title",
          "metadata",
          "sales_channels.id",
          "shipping_profile.id",
          "options.id",
          "options.title",
          "options.values.value",
          "variants.id",
          "variants.sku",
          "variants.title",
          "variants.manage_inventory",
          "variants.allow_backorder",
          "variants.prices.id",
          "variants.prices.currency_code",
          "variants.prices.amount",
          "variants.inventory_items.inventory_item_id",
        ],
        filters: { external_id: "jovy-mx:test-family:test-product" },
      })
      return data[0]
    }

    beforeAll(() => {
      process.env.OFFICIAL_SEED_MODE = "apply"
      fetchSpy = jest
        .spyOn(globalThis, "fetch")
        .mockImplementation(async (input, init) => {
          if (String(input).startsWith("https://official.test/")) {
            return new Response("fake", {
              status: 200,
              headers: { "content-type": "image/webp" },
            })
          }
          return originalFetch(input, init)
        })
    })

    afterAll(() => {
      fetchSpy.mockRestore()
      if (originalMode === undefined) delete process.env.OFFICIAL_SEED_MODE
      else process.env.OFFICIAL_SEED_MODE = originalMode
      if (originalConfirmation === undefined) {
        delete process.env.CONFIRM_RESTORE_LAB_STOCK
      } else {
        process.env.CONFIRM_RESTORE_LAB_STOCK = originalConfirmation
      }
    })

    it("abre 50 unidades, preserva ajustes y serializa ejecuciones concurrentes", async () => {
      const container = getContainer()
      await seedCommerceLab({ container, args: [] } as ExecArgs)

      const { data: profiles } = await query().graph({
        entity: "shipping_profile",
        fields: ["id"],
        pagination: { take: 1, skip: 0 },
      })
      await createProductsWorkflow(container).run({
        input: {
          products: [
            {
              title: "Producto histórico preservado",
              handle: "historical-preserved",
              status: ProductStatus.PUBLISHED,
              shipping_profile_id: String(profiles[0].id),
              options: [{ title: "Presentación", values: ["Única"] }],
              variants: [
                {
                  title: "Única",
                  sku: "HISTORICAL-PRESERVED",
                  options: { Presentación: "Única" },
                  prices: [],
                },
              ],
            },
          ],
        },
      })

      await runSeed()
      const created = await officialProduct()
      expect(created.id).toBeTruthy()
      expect(created.metadata.jovy_official_catalog_complete).toBe(true)
      expect(created.metadata.jovy_official_catalog_size).toBe(1)
      expect(created.variants).toHaveLength(2)
      expect(
        created.variants.every(
          (variant: any) =>
            variant.manage_inventory && !variant.allow_backorder,
        ),
      ).toBe(true)

      const { data: levels } = await query().graph({
        entity: "inventory_level",
        fields: [
          "inventory_item_id",
          "location_id",
          "stocked_quantity",
          "reserved_quantity",
          "inventory_item.sku",
        ],
        pagination: { take: 1000, skip: 0 },
      })
      const officialLevels = levels.filter((level) =>
        String(level.inventory_item?.sku ?? "").startsWith("JOVY-MX-"),
      )
      expect(officialLevels).toHaveLength(2)
      expect(
        officialLevels.every((level) => Number(level.stocked_quantity) === 50),
      ).toBe(true)
      const locationId = String(officialLevels[0].location_id)

      const variant = created.variants[0]
      const inventoryItemId = variant.inventory_items[0].inventory_item_id
      const salesChannelId = created.sales_channels[0].id
      const shippingProfileId = created.shipping_profile.id
      await dismissLinksWorkflow(container).run({
        input: [
          {
            [Modules.PRODUCT]: { variant_id: variant.id },
            [Modules.INVENTORY]: { inventory_item_id: inventoryItemId },
          },
          {
            [Modules.PRODUCT]: { product_id: created.id },
            [Modules.SALES_CHANNEL]: { sales_channel_id: salesChannelId },
          },
          {
            [Modules.PRODUCT]: { product_id: created.id },
            [Modules.FULFILLMENT]: { shipping_profile_id: shippingProfileId },
          },
        ],
      })
      await runSeed()
      const repaired = await officialProduct()
      expect(repaired.variants[0].inventory_items).toEqual([
        expect.objectContaining({ inventory_item_id: inventoryItemId }),
      ])
      expect(repaired.sales_channels).toEqual([
        expect.objectContaining({ id: salesChannelId }),
      ])
      expect(repaired.shipping_profile).toEqual(
        expect.objectContaining({ id: shippingProfileId }),
      )

      const { result: wrongProfiles } =
        await createShippingProfilesWorkflow(container).run({
          input: {
            data: [{ name: "Wrong shipping profile", type: "default" }],
          },
        })
      const wrongProfileId = wrongProfiles[0].id
      await dismissLinksWorkflow(container).run({
        input: [
          {
            [Modules.PRODUCT]: { product_id: created.id },
            [Modules.FULFILLMENT]: { shipping_profile_id: shippingProfileId },
          },
        ],
      })
      await createLinksWorkflow(container).run({
        input: [
          {
            [Modules.PRODUCT]: { product_id: created.id },
            [Modules.FULFILLMENT]: { shipping_profile_id: wrongProfileId },
          },
        ],
      })
      await runSeed()
      const corrected = await officialProduct()
      expect(corrected.shipping_profile).toEqual(
        expect.objectContaining({ id: shippingProfileId }),
      )
      const { data: profileLinks } = await query().graph({
        entity: "product_shipping_profile",
        fields: ["product_id", "shipping_profile_id"],
        filters: { product_id: created.id },
      })
      expect(profileLinks).toEqual([
        expect.objectContaining({ shipping_profile_id: shippingProfileId }),
      ])

      await upsertVariantPricesWorkflow(container).run({
        input: {
          variantPrices: [
            {
              variant_id: variant.id,
              product_id: created.id,
              prices: [{ amount: 999, currency_code: "mxn" }],
            },
          ],
          previousVariantIds: [variant.id],
        },
      })
      await updateProductsWorkflow(container).run({
        input: {
          products: [
            {
              id: created.id,
              title: "Título manual",
              metadata: {
                ...created.metadata,
                card_hover_mode: "none",
                manual_note: "conservar",
              },
            },
          ],
        },
      })

      const catalogue = container.resolve(JOVY_CATALOGUE_MODULE) as any
      const [family] = await catalogue.listProductFamilies({
        slug: "mx-test-family",
      })
      await catalogue.updateProductFamilies({
        id: family.id,
        name: "Familia manual",
      })

      const { result: reservations } = await createReservationsWorkflow(
        container,
      ).run({
        input: {
          reservations: [
            {
              inventory_item_id: variant.inventory_items[0].inventory_item_id,
              location_id: locationId,
              quantity: 2,
              line_item_id: "official-seed-integration",
            },
          ],
        },
      })

      await runSeed()
      const repeated = await officialProduct()
      expect(repeated.id).toBe(created.id)
      expect(repeated.title).toBe("Título manual")
      expect(repeated.metadata.manual_note).toBe("conservar")
      expect(repeated.metadata.card_hover_mode).toBe("none")
      expect(
        repeated.variants.find((item: any) => item.id === variant.id).prices,
      ).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ currency_code: "mxn", amount: 999 }),
        ]),
      )
      const [manualFamily] = await catalogue.listProductFamilies({
        id: family.id,
      })
      expect(manualFamily.name).toBe("Familia manual")

      const { data: historical } = await query().graph({
        entity: "product",
        fields: ["id"],
        filters: { handle: "historical-preserved" },
      })
      expect(historical).toHaveLength(1)

      const { data: reservedLevel } = await query().graph({
        entity: "inventory_level",
        fields: ["stocked_quantity", "reserved_quantity"],
        filters: {
          inventory_item_id: variant.inventory_items[0].inventory_item_id,
          location_id: locationId,
        },
      })
      expect(Number(reservedLevel[0].stocked_quantity)).toBe(50)
      expect(Number(reservedLevel[0].reserved_quantity)).toBe(2)

      await Promise.all([runSeed(), runSeed()])
      const { data: officialProducts } = await query().graph({
        entity: "product",
        fields: ["id"],
        filters: { external_id: { $like: "jovy-mx:%" } },
      })
      expect(officialProducts).toHaveLength(1)

      process.env.CONFIRM_RESTORE_LAB_STOCK = "restore-lab-stock"
      await restoreOfficialInventory({ container, args: [] } as ExecArgs)
      const { data: restoredLevel } = await query().graph({
        entity: "inventory_level",
        fields: ["stocked_quantity", "reserved_quantity"],
        filters: {
          inventory_item_id: variant.inventory_items[0].inventory_item_id,
          location_id: locationId,
        },
      })
      expect(Number(restoredLevel[0].stocked_quantity)).toBe(52)
      expect(Number(restoredLevel[0].reserved_quantity)).toBe(2)

      await deleteReservationsWorkflow(container).run({
        input: { ids: reservations.map((reservation) => reservation.id) },
      })

      const [restoreResult, reservationResult] = await Promise.allSettled([
        restoreOfficialInventory({ container, args: [] } as ExecArgs),
        createReservationsWorkflow(container).run({
          input: {
            reservations: [
              {
                inventory_item_id: variant.inventory_items[0].inventory_item_id,
                location_id: locationId,
                quantity: 2,
                line_item_id: "official-seed-restore-race",
              },
            ],
          },
        }),
      ])
      expect(restoreResult.status).toBe("fulfilled")
      expect(reservationResult.status).toBe("fulfilled")
      const racedReservations =
        reservationResult.status === "fulfilled" ? reservationResult.value.result : []
      const { data: racedLevel } = await query().graph({
        entity: "inventory_level",
        fields: ["stocked_quantity", "reserved_quantity"],
        filters: {
          inventory_item_id: variant.inventory_items[0].inventory_item_id,
          location_id: locationId,
        },
      })
      expect(Number(racedLevel[0].reserved_quantity)).toBe(2)
      expect(
        Number(racedLevel[0].stocked_quantity) -
          Number(racedLevel[0].reserved_quantity),
      ).toBeGreaterThanOrEqual(48)
      await deleteReservationsWorkflow(container).run({
        input: { ids: racedReservations.map((reservation) => reservation.id) },
      })
    })

    it("añade presentaciones, conserva identidad ante renombres y agrega MXN sin duplicar price set", async () => {
      const container = getContainer()
      await seedCommerceLab({ container, args: [] } as ExecArgs)
      const fixture = manifest as any
      const base = fixture.products[0]
      fixture.products.push({
        ...structuredClone(base),
        source_id: 9003,
        source_slug: "test-product-500",
        gramaje: "500 g",
        weight_grams: 500,
      })
      fixture.summary.published_products = 3
      fixture.summary.variants = 3
      fixture.families[0].variant_count = 3

      await runSeed()
      const withNewVariant = await officialProduct()
      expect(withNewVariant.variants).toHaveLength(3)
      expect(
        withNewVariant.options[0].values.map((value: any) => value.value),
      ).toContain("500 g")

      const previousId = withNewVariant.id
      const previousHandle = withNewVariant.handle
      for (const product of fixture.products) {
        product.name = "Producto oficial renombrado"
        product.group_key = "test-family:producto-oficial-renombrado"
        product.source_updated_at = "2026-11-26T00:00:00.000Z"
      }
      await runSeed()
      const renamed = await officialProduct()
      expect(renamed.id).toBe(previousId)
      expect(renamed.handle).toBe(previousHandle)
      expect(renamed.title).toBe("Producto oficial renombrado")
      expect(renamed.variants).toHaveLength(3)

      const usdVariant = renamed.variants.find(
        (item: any) => item.sku === "JOVY-MX-9002",
      )
      const pricing = container.resolve(Modules.PRICING) as any
      const { data: priceLinks } = await query().graph({
        entity: "product_variant_price_set",
        fields: ["variant_id", "price_set_id"],
        filters: { variant_id: usdVariant.id },
      })
      const priceSetId = String(priceLinks[0].price_set_id)
      const mxnPrice = usdVariant.prices.find(
        (price: any) => price.currency_code === "mxn",
      )
      await pricing.removePrices([mxnPrice.id])
      await pricing.addPrices([
        {
          priceSetId: priceSetId,
          prices: [{ currency_code: "usd", amount: 123 }],
        },
      ])

      await runSeed()
      const repriced = await officialProduct()
      const updated = repriced.variants.find(
        (item: any) => item.sku === "JOVY-MX-9002",
      )
      expect(updated.prices.map((price: any) => price.currency_code).sort()).toEqual([
        "mxn",
        "usd",
      ])
      const { data: updatedLinks } = await query().graph({
        entity: "product_variant_price_set",
        fields: ["variant_id", "price_set_id"],
        filters: { variant_id: usdVariant.id },
      })
      expect(updatedLinks).toHaveLength(1)
      expect(String(updatedLinks[0].price_set_id)).toBe(priceSetId)
    })
  },
})
