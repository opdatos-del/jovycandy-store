import { createHash } from "node:crypto"

import {
  createInventoryItemsWorkflow,
  createInventoryLevelsWorkflow,
  createLinksWorkflow,
  createProductCategoriesWorkflow,
  createProductsWorkflow,
  createShippingOptionsWorkflow,
  createStockLocationsWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
  updateStockLocationsWorkflow,
} from "@medusajs/medusa/core-flows"
import type { ExecArgs } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
  ProductStatus,
} from "@medusajs/framework/utils"

import manifest from "@jovy/scripts/migrations/jovycandy-legacy/manifest.json"
import { JOVY_SEED_CATEGORIES } from "@jovy/lib/jovy/catalog-seed"
import { paginateAll } from "@jovy/lib/jovy/paginate-all"
import {
  buildLegacyProductPlans,
  legacyCatalogSchema,
  validateLegacyCatalog,
  type LegacyCatalogManifest,
  type LegacyProductPlan,
} from "@jovy/lib/jovy/legacy-catalog"
import {
  buildLegacyProductMetadata,
  findLegacyIdentityConflict,
} from "@jovy/lib/jovy/legacy-import"
import {
  classifyStoredLegacyMedia,
  localMediaFileExists,
  staticMediaPath,
  type LegacyMediaState,
} from "@jovy/lib/jovy/legacy-import-media"
import { JOVY_CATALOGUE_MODULE } from "@jovy/modules/jovy-catalogue"
import { JOVY_PRODUCT_EDITORIAL_MODULE } from "@jovy/modules/jovy-product-editorial"
import { saveCatalogueCategoryWorkflow } from "@jovy/workflows/jovy-catalogue/category"
import { saveProductFamilyWorkflow } from "@jovy/workflows/jovy-catalogue/family"
import { seedCatalogueCategoriesWorkflow } from "@jovy/workflows/jovy-catalogue/seed"
import { saveProductEditorialWorkflow } from "@jovy/workflows/jovy-product-editorial/editorial"
import {
  createJovyLabFulfillmentSetWorkflow,
  markJovyLabFulfillmentSetWorkflow,
} from "@jovy/workflows/jovy-lab-commerce/fulfillment-set"

type QueryGraph = {
  graph: (input: {
    entity: string
    fields: string[]
    filters?: Record<string, unknown>
    pagination?: { take: number; skip: number; order?: Record<string, "ASC" | "DESC"> }
  }) => Promise<{ data: Array<Record<string, any>> }>
}

type CatalogueService = {
  listCatalogueCategories: (
    filters?: unknown,
    config?: unknown,
  ) => Promise<Array<{ id: string; key: string }>>
  listProductFamilies: (
    filters?: unknown,
    config?: unknown,
  ) => Promise<Array<{ id: string; slug: string; card_preset?: string | null }>>
}

type EditorialService = {
  listProductEditorials: (
    filters?: unknown,
    config?: unknown,
  ) => Promise<Array<{ id: string; product_id: string }>>
}

type FulfillmentService = {
  listFulfillmentSets: (
    filters?: unknown,
    config?: unknown,
  ) => Promise<Array<{ id: string; name: string; metadata?: Record<string, unknown> | null }>>
  listShippingOptions: (
    filters?: unknown,
    config?: unknown,
  ) => Promise<Array<{ id: string; name: string; type?: { code?: string } | null }>>
}

type LockingService = {
  execute: <T>(
    keys: string | string[],
    job: (signal?: AbortSignal) => Promise<T>,
    args?: { timeout?: number; expire?: number },
  ) => Promise<T>
}

type FileUploader = {
  getUploadStream: (data: {
    filename: string
    mimeType: string
    access?: "public" | "private"
  }) => Promise<{
    writeStream: { end: (buffer: Buffer) => void }
    promise: Promise<{ url?: string; fileKey?: string }>
    url: string
  }>
}

type ProductRow = {
  id: string
  external_id?: string | null
  handle?: string | null
  title?: string | null
  description?: string | null
  status?: string | null
  thumbnail?: string | null
  weight?: number | null
  images?: Array<{ url?: string | null }> | null
  metadata?: Record<string, unknown> | null
  categories?: Array<{ id?: string } | null> | null
  sales_channels?: Array<{ id?: string } | null> | null
  shipping_profile?: { id?: string | null } | null
  options?: Array<{
    id: string
    title: string
    values?: Array<{ id: string; value: string }> | null
  }> | null
  variants?: Array<{
    id: string
    sku?: string | null
    title?: string | null
    weight?: number | null
    price_set_id?: string | null
    manage_inventory?: boolean
    allow_backorder?: boolean
    metadata?: Record<string, unknown> | null
    prices?: Array<{
      id?: string
      currency_code?: string | null
      amount?: number | null
    }> | null
    inventory_items?: Array<{ inventory_item_id?: string | null }> | null
  }> | null
}

type InventoryItemRow = {
  id: string
  sku?: string | null
  location_levels?: Array<{
    location_id?: string | null
    stocked_quantity?: number
    reserved_quantity?: number
  }> | null
}

const OPENING_QUANTITY = 50
const BATCH_SIZE = 10
const STOCK_LOCATION_NAME = "Jovy México Laboratorio"
const FULFILLMENT_SET_NAME = "Jovy México Laboratorio"
const SHIPPING_OPTION_NAME = "Envío local"
const SHIPPING_OPTION_CODE = "jovy-mx-local-lab"
const LAB_LOCATION_METADATA_KEY = "jovy_lab_stock_location"
const LAB_FULFILLMENT_METADATA_KEY = "jovy_lab_fulfillment_set"
const MEDIA_CONCURRENCY = 4

type Infrastructure = {
  salesChannelId: string
  shippingProfileId: string
  stockLocationId: string | null
  categoryIdByKey: Map<string, string>
  familyIdBySource: Map<string, string>
}

type InventoryPlan = {
  itemIdBySku: Map<string, string>
  itemsToCreate: number
  levelsToCreate: number
}

type MediaPlan = {
  urlByHash: Map<string, string>
  localUrlByHash: Map<string, string>
  assetsToUpload: number
  stateByHash: Map<string, LegacyMediaState>
}

type Preview = {
  mode: "preview" | "apply"
  source: LegacyCatalogManifest["summary"]
  productsExisting: number
  productsToCreate: number
  variantsToCreate: number
  pricesToCreate: number
  inventoryItemsToCreate: number
  inventoryLevelsToCreate: number
  familiesToCreate: number
  mediaToUpload: number
  localMediaMissing: number
  mediaFallbacks: number
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)]
}

async function mapLimited<T, R>(
  values: T[],
  limit: number,
  mapper: (value: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length)
  let cursor = 0

  async function worker() {
    while (cursor < values.length) {
      const index = cursor
      cursor += 1
      results[index] = await mapper(values[index])
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, worker))
  return results
}

async function resolveInfrastructure(
  container: ExecArgs["container"],
  catalog: LegacyCatalogManifest,
  apply: boolean,
): Promise<Infrastructure> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY) as QueryGraph
  const catalogue = container.resolve(JOVY_CATALOGUE_MODULE) as CatalogueService
  const fulfillment = container.resolve(Modules.FULFILLMENT) as unknown as FulfillmentService

  const { data: stores } = await query.graph({
    entity: "store",
    fields: ["id", "default_sales_channel_id", "supported_currencies.currency_code"],
  })
  const store = stores[0]
  const currencies = (store?.supported_currencies ?? [])
    .map((currency) => String(currency?.currency_code ?? "").toLowerCase())
    .filter(Boolean)
  if (!currencies.includes("mxn")) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "La tienda no incluye MXN. Ejecuta seed:commerce antes de importar el catálogo histórico.",
    )
  }

  const { data: regions } = await query.graph({
    entity: "region",
    fields: ["id", "name", "currency_code", "countries.iso_2", "payment_providers.id"],
  })
  const region = regions.find(
    (row) =>
      String(row.currency_code).toLowerCase() === "mxn" &&
      (row.countries ?? []).some(
        (country) => String(country?.iso_2 ?? "").toUpperCase() === "MX",
      ) &&
      (row.payment_providers ?? []).some((provider) => provider?.id === "pp_system_default"),
  )
  if (!region?.id) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Falta una región México/MXN con pp_system_default. Ejecuta seed:commerce.",
    )
  }

  const { data: salesChannels } = await query.graph({
    entity: "sales_channel",
    fields: ["id", "name"],
  })
  const configuredChannelId = process.env.JOVY_SALES_CHANNEL_ID
  const salesChannel = configuredChannelId
    ? salesChannels.find((channel) => channel.id === configuredChannelId)
    : salesChannels.find((channel) => channel.id === store?.default_sales_channel_id) ??
      salesChannels[0]
  if (!salesChannel?.id) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "No hay sales channel disponible")
  }

  const { data: shippingProfiles } = await query.graph({
    entity: "shipping_profile",
    fields: ["id", "name"],
  })
  const configuredProfileId = process.env.JOVY_SHIPPING_PROFILE_ID
  const shippingProfile = configuredProfileId
    ? shippingProfiles.find((profile) => profile.id === configuredProfileId)
    : shippingProfiles.find((profile) => profile.name === "Default Shipping Profile") ??
      shippingProfiles[0]
  if (!shippingProfile?.id) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "No hay shipping profile disponible")
  }

  const categoryRows = await paginateAll(async (take, skip) => (await query.graph({
    entity: "product_category",
    fields: ["id", "handle"],
    pagination: { take, skip, order: { id: "ASC" } },
  })).data)
  const categoryIdByHandle = new Map(
    categoryRows
      .filter((row) => row.handle && row.id)
      .map((row) => [String(row.handle), String(row.id)]),
  )
  const missingCategories = JOVY_SEED_CATEGORIES.filter(
    (category) => !categoryIdByHandle.has(category.handle),
  )

  if (apply && missingCategories.length) {
    const { result } = (await createProductCategoriesWorkflow(container).run({
      input: {
        product_categories: missingCategories.map((category) => ({
          name: category.name,
          handle: category.handle,
          description: `Categoría Jovy: ${category.name}.`,
          is_active: true,
          rank: category.sortOrder,
        })),
      },
    })) as unknown as { result: Array<{ id: string; handle: string }> }

    for (const category of result) {
      categoryIdByHandle.set(category.handle, category.id)
    }
  }

  const categoryIdByKey = new Map<string, string>()
  for (const category of JOVY_SEED_CATEGORIES) {
    const id = categoryIdByHandle.get(category.handle)
    if (!id && apply) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `No se pudo resolver la categoría ${category.handle}`,
      )
    }
    if (id) categoryIdByKey.set(category.key, id)
  }

  if (apply) {
    const catalogueRows = await paginateAll((take, skip) =>
      catalogue.listCatalogueCategories({}, { take, skip, order: { id: "ASC" } }),
    )
    const existingKeys = new Set(catalogueRows.map((row) => row.key))
    const missingKeys = new Set(
      catalog.categories
        .map((category) => category.category_key)
        .filter((key) => !existingKeys.has(key)),
    )
    if (missingKeys.size) {
      await seedCatalogueCategoriesWorkflow(container).run({ input: {} })
    }
    const refreshedRows = await paginateAll((take, skip) =>
      catalogue.listCatalogueCategories({}, { take, skip, order: { id: "ASC" } }),
    )
    const catalogueIdByKey = new Map(refreshedRows.map((row) => [row.key, row.id]))

    for (const sourceCategory of catalog.categories) {
      if (!missingKeys.has(sourceCategory.category_key)) continue
      const id = catalogueIdByKey.get(sourceCategory.category_key)
      const medusaCategoryId = categoryIdByKey.get(sourceCategory.category_key)
      if (!id || !medusaCategoryId) continue

      const comingSoon = Boolean(sourceCategory.coming_soon)
      await saveCatalogueCategoryWorkflow(container).run({
        input: {
          id,
          name: sourceCategory.name.trim(),
          medusa_category_id: medusaCategoryId,
          active: !comingSoon,
          coming_soon: comingSoon,
          interaction_locked: comingSoon,
          sort_order: sourceCategory.sort_order,
        },
      })
    }
  }

  const existingFamilies = await paginateAll((take, skip) =>
    catalogue.listProductFamilies({}, { take, skip, order: { id: "ASC" } }),
  )
  const familyBySlug = new Map(existingFamilies.map((family) => [family.slug, family]))
  const familyIdBySource = new Map<string, string>()
  let familiesCreated = 0

  for (const [index, family] of catalog.families.entries()) {
    const slug = `mx-${family.slug}`
    const existing = familyBySlug.get(slug)
    const categoryId = categoryIdByKey.get(family.category_key)
    if (!categoryId) continue

    if (apply && !existing) {
      const { result } = (await saveProductFamilyWorkflow(container).run({
        input: {
          name: family.name,
          slug,
          description: `Familia importada ${family.name}.`,
          medusa_category_id: categoryId,
          card_preset: (family.slug === "rings" ? "jovy-gummies" : null) as never,
          sort_order: index,
          active: true,
        },
      })) as unknown as { result: { id: string } }
      familyIdBySource.set(family.source_id, result.id)
      familiesCreated += 1
    } else if (existing) {
      familyIdBySource.set(family.source_id, existing.id)
    }
  }

  const stockLocations = await paginateAll(async (take, skip) => (await query.graph({
    entity: "stock_location",
    fields: [
      "id",
      "name",
      "metadata",
      "sales_channels.id",
      "fulfillment_providers.id",
      "fulfillment_sets.id",
    ],
    pagination: { take, skip, order: { id: "ASC" } },
  })).data)
  let stockLocation = stockLocations.find(
    (row) =>
      row.metadata?.[LAB_LOCATION_METADATA_KEY] === true ||
      row.name === STOCK_LOCATION_NAME,
  )
  let stockLocationId = stockLocation?.id ? String(stockLocation.id) : null

  if (apply && stockLocation && stockLocation.metadata?.[LAB_LOCATION_METADATA_KEY] !== true) {
    await updateStockLocationsWorkflow(container).run({
      input: {
        selector: { id: String(stockLocation.id) },
        update: {
          metadata: {
            ...(stockLocation.metadata ?? {}),
            [LAB_LOCATION_METADATA_KEY]: true,
            jovy_lab: true,
            country_code: "mx",
          },
        },
      },
    })
  }

  if (apply && !stockLocationId) {
    const { result } = (await createStockLocationsWorkflow(container).run({
      input: {
        locations: [
          {
            name: STOCK_LOCATION_NAME,
            metadata: {
              [LAB_LOCATION_METADATA_KEY]: true,
              jovy_lab: true,
              country_code: "mx",
            },
          },
        ],
      },
    })) as unknown as { result: Array<{ id: string }> }
    stockLocationId = result[0].id
  }

  if (apply && stockLocationId) {
    const linkedChannels = (stockLocation?.sales_channels ?? [])
      .map((channel) => channel?.id)
      .filter(Boolean)
    if (!linkedChannels.includes(salesChannel.id)) {
      await linkSalesChannelsToStockLocationWorkflow(container).run({
        input: { id: stockLocationId, add: [String(salesChannel.id)] },
      })
    }

    const linkedProviders = (stockLocation?.fulfillment_providers ?? [])
      .map((provider) => provider?.id)
      .filter(Boolean)
    if (!linkedProviders.includes("manual_manual")) {
      await createLinksWorkflow(container).run({
        input: [
          {
            [Modules.STOCK_LOCATION]: { stock_location_id: stockLocationId },
            [Modules.FULFILLMENT]: { fulfillment_provider_id: "manual_manual" },
          },
        ],
      })
    }

    const fulfillmentSets = await paginateAll((take, skip) =>
      fulfillment.listFulfillmentSets({}, { take, skip, order: { id: "ASC" } }),
    )
    let fulfillmentSet = fulfillmentSets.find(
      (set) =>
        set.metadata?.[LAB_FULFILLMENT_METADATA_KEY] === true ||
        set.name === FULFILLMENT_SET_NAME,
    )
    if (!fulfillmentSet) {
      const { result } = (await createJovyLabFulfillmentSetWorkflow(container).run({
        input: {
          name: FULFILLMENT_SET_NAME,
          type: "shipping",
          service_zones: [
            {
              name: "México laboratorio",
              geo_zones: [{ country_code: "mx", type: "country" }],
            },
          ],
        },
      })) as unknown as { result: Array<{ id: string; name: string }> }
      fulfillmentSet = result[0]
    }

    if (fulfillmentSet.metadata?.[LAB_FULFILLMENT_METADATA_KEY] !== true) {
      await markJovyLabFulfillmentSetWorkflow(container).run({
        input: {
          id: fulfillmentSet.id,
          metadata: {
            ...(fulfillmentSet.metadata ?? {}),
            [LAB_FULFILLMENT_METADATA_KEY]: true,
            country_code: "mx",
          },
        },
      })
    }

    if (
      !(stockLocation?.fulfillment_sets ?? []).some(
        (set) => set?.id === fulfillmentSet.id,
      )
    ) {
      await createLinksWorkflow(container).run({
        input: [
          {
            [Modules.STOCK_LOCATION]: { stock_location_id: stockLocationId },
            [Modules.FULFILLMENT]: { fulfillment_set_id: fulfillmentSet.id },
          },
        ],
      })
    }

    const { data: fulfillmentRows } = await query.graph({
      entity: "fulfillment_set",
      fields: ["id", "service_zones.id"],
      filters: { id: fulfillmentSet.id },
    })
    const serviceZoneId = fulfillmentRows[0]?.service_zones?.[0]?.id
    if (!serviceZoneId) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        "El fulfillment set de laboratorio no tiene service zone",
      )
    }

    const shippingOptions = await fulfillment.listShippingOptions({
      service_zone_id: serviceZoneId,
    })
    if (
      !shippingOptions.some(
        (option) =>
          option.type?.code === SHIPPING_OPTION_CODE ||
          option.name === SHIPPING_OPTION_NAME,
      )
    ) {
      await createShippingOptionsWorkflow(container).run({
        input: [
          {
            name: SHIPPING_OPTION_NAME,
            price_type: "flat",
            provider_id: "manual_manual",
            service_zone_id: String(serviceZoneId),
            shipping_profile_id: String(shippingProfile.id),
            type: {
              label: SHIPPING_OPTION_NAME,
              description: "Envío de laboratorio para pruebas locales.",
              code: SHIPPING_OPTION_CODE,
            },
            prices: [{ currency_code: "mxn", amount: 99 }],
            rules: [
              { attribute: "enabled_in_store", value: "true", operator: "eq" },
              { attribute: "is_return", value: "false", operator: "eq" },
            ],
          },
        ],
      })
    }
  }

  return {
    salesChannelId: String(salesChannel.id),
    shippingProfileId: String(shippingProfile.id),
    stockLocationId,
    categoryIdByKey,
    familyIdBySource,
  }
}

function localMediaRegistryFromProducts(products: ProductRow[]): Map<string, string> {
  const registry = new Map<string, string>()

  for (const product of products) {
    const explicit = product.metadata?.jovy_media_local_registry
    if (explicit && typeof explicit === "object" && !Array.isArray(explicit)) {
      for (const [hash, url] of Object.entries(explicit)) {
        if (typeof url === "string" && /^[a-f0-9]{64}$/.test(hash)) {
          registry.set(hash, url)
        }
      }
    }

    const legacy = product.metadata?.jovy_media_registry
    if (!legacy || typeof legacy !== "object" || Array.isArray(legacy)) continue
    for (const [hash, url] of Object.entries(legacy)) {
      if (
        typeof url === "string" &&
        /^[a-f0-9]{64}$/.test(hash) &&
        /\/static\//.test(url)
      ) {
        registry.set(hash, url)
      }
    }
  }

  return registry
}

async function isReachable(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: "HEAD",
      signal: AbortSignal.timeout(5_000),
    })
    return response.ok
  } catch {
    return false
  }
}

async function isStoredMediaAvailable(url: string): Promise<boolean> {
  if (staticMediaPath(url)) return localMediaFileExists(url)
  return isReachable(url)
}

async function uploadMedia(
  fileService: FileUploader,
  url: string,
  hash: string,
  mime: string | null,
): Promise<string> {
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) })
  if (!response.ok) throw new Error(`GET ${url} respondió ${response.status}`)

  const bytes = Buffer.from(await response.arrayBuffer())
  const actualHash = createHash("sha256").update(bytes).digest("hex")
  if (actualHash !== hash) {
    throw new Error(`El medio cambió respecto del manifiesto: ${url}`)
  }
  const extension = mime?.includes("png")
    ? "png"
    : mime?.includes("jpeg")
      ? "jpg"
      : "webp"
  const filename = `jovy-mx-${hash.slice(0, 24)}.${extension}`
  const stream = await fileService.getUploadStream({
    filename,
    mimeType: mime ?? "image/webp",
    access: "public",
  })
  stream.writeStream.end(bytes)
  const uploaded = await stream.promise
  const uploadedUrl = uploaded.url ?? stream.url
  if (!uploadedUrl) throw new Error(`El File Module no devolvió URL para ${filename}`)
  return uploadedUrl
}

async function prepareMedia(
  container: ExecArgs["container"],
  plans: LegacyProductPlan[],
  existingProducts: ProductRow[],
  apply: boolean,
): Promise<MediaPlan> {
  const assetByKey = new Map<string, LegacyProductPlan["media"][number]>()
  for (const plan of plans) {
    for (const asset of plan.media) {
      const used =
        asset.role === "packshot" ||
        (asset.role === "bowl" && plan.variants.length === 1)
      if (!used) continue
      assetByKey.set(asset.sha256 ?? asset.url, asset)
    }
  }
  const assets = [...assetByKey.values()]
  const registry = localMediaRegistryFromProducts(existingProducts)
  const urlByHash = new Map<string, string>()
  const localUrlByHash = new Map<string, string>()
  const stateByHash = new Map<string, LegacyMediaState>()
  let assetsToUpload = 0
  const manifestOnly = process.env.LEGACY_IMPORT_MEDIA_MODE === "manifest"

  const inspected = manifestOnly
    ? assets.map((asset) => ({
        asset,
        existing: registry.get(asset.sha256!),
        available: false,
        state: "source-fallback" as LegacyMediaState,
      }))
    : await mapLimited(assets, MEDIA_CONCURRENCY, async (asset) => {
        const existing = registry.get(asset.sha256!)
        const available = existing ? await isStoredMediaAvailable(existing) : false
        return {
          asset,
          existing,
          available,
          state: classifyStoredLegacyMedia(existing, available),
        }
      })

  for (const { asset, existing, available, state } of inspected) {
    if (!asset.sha256) continue
    urlByHash.set(asset.sha256, asset.url)
    stateByHash.set(asset.sha256, state)
    if (manifestOnly) continue
    if (existing && available) {
      urlByHash.set(asset.sha256, existing)
      localUrlByHash.set(asset.sha256, existing)
    } else {
      assetsToUpload += 1
    }
  }

  if (!apply || manifestOnly) {
    return { urlByHash, localUrlByHash, assetsToUpload, stateByHash }
  }

  const fileService = container.resolve(Modules.FILE) as unknown as FileUploader
  const missing = assets.filter(
    (asset) =>
      asset.sha256 &&
      (!registry.has(asset.sha256) || !localUrlByHash.has(asset.sha256)),
  )

  const uploaded = await mapLimited(missing, MEDIA_CONCURRENCY, async (asset) => {
    if (!asset.sha256) return null
    try {
      const url = await uploadMedia(
        fileService,
        asset.url,
        asset.sha256,
        asset.mime,
      )
      return [asset.sha256, url] as const
    } catch (error) {
      const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
      logger.warn(
        `[legacy-import] no se pudo registrar ${asset.source_path} en File Module; se usa la URL de origen verificada (${error instanceof Error ? error.name : "error"})`,
      )
      stateByHash.set(asset.sha256, "source-fallback")
      return null
    }
  })

  for (const entry of uploaded) {
    if (!entry) continue
    localUrlByHash.set(entry[0], entry[1])
    urlByHash.set(entry[0], entry[1])
    stateByHash.set(entry[0], "local-valid")
  }

  return { urlByHash, localUrlByHash, assetsToUpload, stateByHash }
}

async function prepareInventory(
  container: ExecArgs["container"],
  plans: LegacyProductPlan[],
  stockLocationId: string | null,
  apply: boolean,
): Promise<InventoryPlan> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY) as QueryGraph
  const data = await paginateAll(async (take, skip) => (await query.graph({
    entity: "inventory_item",
    fields: ["id", "sku", "location_levels.location_id", "location_levels.stocked_quantity"],
    pagination: { take, skip, order: { id: "ASC" } },
  })).data)
  const rows = data as unknown as InventoryItemRow[]
  const itemBySku = new Map(
    rows.filter((row) => row.sku).map((row) => [String(row.sku), row]),
  )
  const itemIdBySku = new Map<string, string>()
  const variants = plans.flatMap((plan) => plan.variants)
  const missing = variants.filter((variant) => !itemBySku.has(variant.sku))

  if (apply && !stockLocationId) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "No se resolvió el stock location de laboratorio",
    )
  }

  if (apply && stockLocationId && missing.length) {
    const { result } = (await createInventoryItemsWorkflow(container).run({
      input: {
        items: missing.map((variant) => ({
          sku: variant.sku,
          metadata: {
            jovy_legacy_source_id: variant.sourceId,
            opening_quantity: OPENING_QUANTITY,
          },
          location_levels: [
            {
              location_id: stockLocationId,
              stocked_quantity: OPENING_QUANTITY,
            },
          ],
        })),
      },
    })) as unknown as { result: Array<{ id: string; sku: string }> }

    for (const item of result) {
      itemBySku.set(item.sku, {
        id: item.id,
        sku: item.sku,
        location_levels: [
          {
            location_id: stockLocationId,
            stocked_quantity: OPENING_QUANTITY,
          },
        ],
      })
    }
  }

  const levelsToCreate: Array<{
    inventory_item_id: string
    location_id: string
    stocked_quantity: number
  }> = []

  for (const variant of variants) {
    const item = itemBySku.get(variant.sku)
    if (!item) continue
    itemIdBySku.set(variant.sku, item.id)

    if (
      stockLocationId &&
      !(item.location_levels ?? []).some(
        (level) => level.location_id === stockLocationId,
      )
    ) {
      levelsToCreate.push({
        inventory_item_id: item.id,
        location_id: stockLocationId,
        stocked_quantity: OPENING_QUANTITY,
      })
    }
  }

  if (apply && levelsToCreate.length) {
    await createInventoryLevelsWorkflow(container).run({
      input: { inventory_levels: levelsToCreate },
    })
  }

  return {
    itemIdBySku,
    itemsToCreate: missing.length,
    levelsToCreate: stockLocationId ? levelsToCreate.length : variants.length,
  }
}

function productMetadata(
  plan: LegacyProductPlan,
  media: MediaPlan,
): Record<string, unknown> {
  const registry: Record<string, string> = {}
  for (const asset of plan.media) {
    if (!asset.sha256) continue
    const url = media.urlByHash.get(asset.sha256) ?? asset.url
    registry[asset.sha256] = url
  }

  const localRegistry = Object.fromEntries(
    [...media.localUrlByHash].filter(([hash]) => Boolean(registry[hash])),
  )

  return buildLegacyProductMetadata(plan, registry, localRegistry)
}

function planMediaUrls(plan: LegacyProductPlan, media: MediaPlan): string[] {
  return unique(
    plan.media
      .filter(
        (asset) =>
          asset.role === "packshot" ||
          (asset.role === "bowl" && plan.variants.length === 1),
      )
      .map((asset) =>
        asset.sha256
          ? media.urlByHash.get(asset.sha256) ?? asset.url
          : asset.url,
      ),
  )
}

async function loadProducts(container: ExecArgs["container"]): Promise<ProductRow[]> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY) as QueryGraph
  const [data, priceLinks] = await Promise.all([
    paginateAll(async (take, skip) => (await query.graph({
      entity: "product",
      fields: [
        "id",
        "external_id",
        "handle",
        "title",
        "description",
        "status",
        "thumbnail",
        "weight",
        "images.url",
        "metadata",
        "categories.id",
        "sales_channels.id",
        "shipping_profile.id",
        "options.id",
        "options.title",
        "options.values.id",
        "options.values.value",
        "variants.id",
        "variants.sku",
        "variants.title",
        "variants.weight",
        "variants.manage_inventory",
        "variants.allow_backorder",
        "variants.metadata",
        "variants.prices.id",
        "variants.prices.currency_code",
        "variants.prices.amount",
        "variants.inventory_items.inventory_item_id",
      ],
      pagination: { take, skip, order: { id: "ASC" } },
    })).data),
    paginateAll(async (take, skip) => (await query.graph({
      entity: "product_variant_price_set",
      fields: ["variant_id", "price_set_id"],
      pagination: { take, skip, order: { variant_id: "ASC", price_set_id: "ASC" } },
    })).data),
  ])
  const priceSetByVariant = new Map(
    priceLinks.map((link) => [String(link.variant_id), String(link.price_set_id)]),
  )
  const products = data as unknown as ProductRow[]
  for (const product of products) {
    for (const variant of product.variants ?? []) {
      variant.price_set_id = priceSetByVariant.get(variant.id) ?? null
    }
  }
  return products
}

/**
 * Mantiene la identidad creada aunque cambie el nombre en el manifiesto. Las
 * nuevas presentaciones se resuelven por SKU estable antes de crear otro producto.
 */
function resolveLegacyProductIdentities(
  plans: LegacyProductPlan[],
  products: ProductRow[],
): LegacyProductPlan[] {
  const byExternalId = new Map(
    products
      .filter((product) => product.external_id)
      .map((product) => [String(product.external_id), product]),
  )
  const resolved = plans.map((plan) => {
    const direct = byExternalId.get(plan.externalId)
    const skus = new Set(plan.variants.map((variant) => variant.sku))
    const bySku = products.filter((product) =>
      (product.variants ?? []).some(
        (variant) => variant.sku && skus.has(String(variant.sku)),
      ),
    )
    const candidates = [...new Set([direct, ...bySku].filter(Boolean))] as ProductRow[]
    if (candidates.length > 1) {
      throw new MedusaError(
        MedusaError.Types.CONFLICT,
        `Varios productos corresponden a ${plan.externalId}`,
      )
    }

    const existing = candidates[0]
    if (!existing) return plan
    if (!existing.external_id || !existing.handle) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `El producto migrado con SKU del manifiesto carece de identidad estable: ${existing.id}`,
      )
    }
    if (
      !String(existing.external_id).startsWith("jovy-mx:") &&
      existing.metadata?.jovy_legacy_managed !== true &&
      existing.metadata?.jovy_legacy_managed !== true
    ) {
      throw new MedusaError(
        MedusaError.Types.CONFLICT,
        `Un producto histórico ocupa un SKU del manifiesto: ${existing.handle}`,
      )
    }
    return {
      ...plan,
      externalId: String(existing.external_id),
      handle: String(existing.handle),
    }
  })

  const externalIds = new Set<string>()
  const handles = new Set<string>()
  for (const plan of resolved) {
    if (externalIds.has(plan.externalId) || handles.has(plan.handle)) {
      throw new MedusaError(
        MedusaError.Types.CONFLICT,
        `Identidad de importación duplicada tras resolver: ${plan.externalId}`,
      )
    }
    externalIds.add(plan.externalId)
    handles.add(plan.handle)
  }
  return resolved
}

function buildPreview(
  plans: LegacyProductPlan[],
  products: ProductRow[],
  inventory: InventoryPlan,
  media: MediaPlan,
  familiesCreated: number,
): Preview {
  const existingIds = new Set(
    products.map((product) => String(product.external_id ?? "")).filter(Boolean),
  )
  const missing = plans.filter((plan) => !existingIds.has(plan.externalId))
  const variantsToCreate = missing.reduce(
    (total, plan) => total + plan.variants.length,
    0,
  )
  const mediaStates = [...media.stateByHash.values()]

  return {
    mode: "preview",
    source: legacyCatalogSchema.parse(manifest).summary,
    productsExisting: plans.length - missing.length,
    productsToCreate: missing.length,
    variantsToCreate,
    pricesToCreate: variantsToCreate,
    inventoryItemsToCreate: inventory.itemsToCreate,
    inventoryLevelsToCreate: inventory.levelsToCreate,
    familiesToCreate: familiesCreated,
    mediaToUpload: media.assetsToUpload,
    localMediaMissing: mediaStates.filter((state) => state === "local-missing").length,
    mediaFallbacks: mediaStates.filter((state) => state === "source-fallback").length,
  }
}
async function createMissingProducts(
  container: ExecArgs["container"],
  plans: LegacyProductPlan[],
  products: ProductRow[],
  infrastructure: Infrastructure,
  inventory: InventoryPlan,
  media: MediaPlan,
): Promise<Map<string, string>> {
  const byExternalId = new Map(
    products
      .filter((product) => product.external_id)
      .map((product) => [String(product.external_id), product]),
  )
  const productIdByExternalId = new Map<string, string>()
  const missing = plans.filter((plan) => !byExternalId.has(plan.externalId))

  for (let start = 0; start < missing.length; start += BATCH_SIZE) {
    const batch = missing.slice(start, start + BATCH_SIZE)
    const payload = batch.map((plan) => {
      const categoryId = infrastructure.categoryIdByKey.get(plan.categoryKey)
      if (!categoryId) {
        throw new MedusaError(
          MedusaError.Types.NOT_FOUND,
          `Categoría no resuelta para ${plan.handle}`,
        )
      }
      const imageUrls = planMediaUrls(plan, media)
      return {
        title: plan.title,
        description: plan.description,
        external_id: plan.externalId,
        handle: plan.handle,
        status: ProductStatus.PUBLISHED,
        thumbnail: imageUrls[0] ?? null,
        images: imageUrls.map((url) => ({ url })),
        weight: plan.variants[0]?.grams ?? null,
        shipping_profile_id: infrastructure.shippingProfileId,
        category_ids: [categoryId],
        sales_channels: [{ id: infrastructure.salesChannelId }],
        options: [
          {
            title: "Presentación",
            values: plan.variants.map((variant) => variant.title),
          },
        ],
        variants: plan.variants.map((variant) => ({
          title: variant.title,
          sku: variant.sku,
          weight: variant.grams,
          options: { Presentación: variant.title },
          prices: [{ amount: variant.priceMxn, currency_code: "mxn" }],
          manage_inventory: true,
          allow_backorder: false,
          inventory_items: inventory.itemIdBySku.has(variant.sku)
            ? [
                {
                  inventory_item_id: inventory.itemIdBySku.get(variant.sku),
                  required_quantity: 1,
                },
              ]
            : [],
          metadata: {
            jovy_legacy_managed: true,
            jovy_legacy_source_id: variant.sourceId,
            jovy_legacy_grams: variant.grams,
          },
        })),
        metadata: productMetadata(plan, media),
      }
    })

    const { result } = (await createProductsWorkflow(container).run({
      input: { products: payload as never },
    })) as unknown as { result: Array<{ id: string; external_id?: string | null }> }

    for (const product of result) {
      if (product.external_id) {
        productIdByExternalId.set(product.external_id, product.id)
      }
    }
  }

  return productIdByExternalId
}

async function linkFamiliesAndEditorials(
  container: ExecArgs["container"],
  plans: LegacyProductPlan[],
  products: ProductRow[],
  infrastructure: Infrastructure,
): Promise<{ links: number; editorials: number }> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY) as QueryGraph
  const editorialService = container.resolve(JOVY_PRODUCT_EDITORIAL_MODULE) as EditorialService
  const byExternalId = new Map(
    products
      .filter((product) => product.external_id)
      .map((product) => [String(product.external_id), product]),
  )
  const families = await paginateAll(async (take, skip) => (await query.graph({
    entity: "jovy_product_family",
    fields: ["id", "products.id"],
    pagination: { take, skip, order: { id: "ASC" } },
  })).data)
  const linked = new Set<string>()
  for (const family of families) {
    for (const product of family.products ?? []) {
      linked.add(`${family.id}:${product.id}`)
    }
  }

  let links = 0
  let editorials = 0
  for (const plan of plans) {
    const product = byExternalId.get(plan.externalId)
    const familyId = infrastructure.familyIdBySource.get(plan.familyId)
    if (!product || !familyId) continue

    if (!linked.has(`${familyId}:${product.id}`)) {
      await createLinksWorkflow(container).run({
        input: [
          {
            [JOVY_CATALOGUE_MODULE]: { jovy_product_family_id: familyId },
            [Modules.PRODUCT]: { product_id: product.id },
          },
        ],
      })
      links += 1
    }

    const existing = await editorialService.listProductEditorials({
      product_id: product.id,
    })
    if (existing.length) continue

    await saveProductEditorialWorkflow(container).run({
      input: {
        product_id: product.id,
        gramaje: plan.variants.length === 1 ? plan.variants[0].title : null,
        certifications: plan.certifications as never,
        sort_order: plan.sortOrder,
        is_new: plan.isNew,
        commercial_mode: "sellable",
        editorial_status: "published",
      },
    })
    editorials += 1
  }

  return { links, editorials }
}

/**
 * Importador manual del catálogo histórico de JovyCandy.
 *
 *   Preview (sin escrituras):
 *   $env:LEGACY_IMPORT_MODE="preview"
 *   pnpm --dir apps/backend run import:legacy
 *
 *   Aplicación explícita:
 *   $env:LEGACY_IMPORT_MODE="apply"
 *   pnpm --dir apps/backend run import:legacy
 *
 * Sólo crea productos ausentes. No actualiza productos existentes, no repone
 * inventario consumido, no recalcula precios y no se ejecuta al iniciar Medusa.
 */
export default async function importLegacyProducts({ container, args }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const catalog = legacyCatalogSchema.parse(manifest)
  validateLegacyCatalog(catalog)
  const sourcePlans = buildLegacyProductPlans(catalog)
  const mode = process.env.LEGACY_IMPORT_MODE
  const apply = mode === "apply" || Boolean(args?.includes("--apply"))

  const run = async () => {
    const locking = container.resolve(Modules.LOCKING) as LockingService
    const products = await loadProducts(container)
    const conflict = findLegacyIdentityConflict(sourcePlans, products)
    if (conflict) {
      throw new MedusaError(MedusaError.Types.CONFLICT, conflict)
    }
    const plans = resolveLegacyProductIdentities(sourcePlans, products)
    const existingIds = new Set(
      products.map((product) => String(product.external_id ?? "")).filter(Boolean),
    )
    const missingPlans = plans.filter((plan) => !existingIds.has(plan.externalId))

    const infrastructure = apply
      ? await locking.execute(
          "jovy:legacy-import:commerce-infrastructure",
          () => resolveInfrastructure(container, catalog, apply),
          { timeout: 300, expire: 600 },
        )
      : await resolveInfrastructure(container, catalog, apply)
    const media = await prepareMedia(container, missingPlans, products, apply)
    const inventory = await prepareInventory(
      container,
      missingPlans,
      infrastructure.stockLocationId,
      apply,
    )
    const preview = buildPreview(
      plans,
      products,
      inventory,
      media,
      Math.max(0, catalog.families.length - infrastructure.familyIdBySource.size),
    )

    if (!apply) {
      logger.info(`[legacy-import] preview\n${JSON.stringify(preview, null, 2)}`)
      return
    }

    const created = await createMissingProducts(
      container,
      missingPlans,
      products,
      infrastructure,
      inventory,
      media,
    )
    const refreshedProducts = await loadProducts(container)
    const relationships = await linkFamiliesAndEditorials(
      container,
      missingPlans,
      refreshedProducts,
      infrastructure,
    )

    const createdIds = [...created.values()].map((id) => ({ id }))
    const search = container.resolve(Modules.SEARCH) as {
      ingest: (input: unknown) => Promise<unknown>
    }
    try {
      for (let start = 0; start < createdIds.length; start += 25) {
        await search.ingest({
          name: "product.created",
          data: createdIds.slice(start, start + 25),
        } as never)
      }
    } catch (error) {
      logger.warn(
        `[legacy-import] catálogo creado; Search quedó pendiente de reindexar (${error instanceof Error ? error.name : "error"})`,
      )
    }

    logger.info(
      `[legacy-import] listo: ${missingPlans.length} productos creados, ${missingPlans.flatMap((plan) => plan.variants).length} variantes, ${relationships.editorials} fichas nuevas, ${inventory.itemsToCreate} inventory items, ${inventory.levelsToCreate} niveles nuevos.`,
    )
  }

  if (apply) {
    const locking = container.resolve(Modules.LOCKING) as LockingService
    await locking.execute("jovy:legacy-import", run, {
      timeout: 900,
      expire: 1800,
    })
    return
  }

  await run()
}