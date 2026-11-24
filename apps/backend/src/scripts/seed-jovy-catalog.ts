/**
 * Seed del catálogo Jovy.
 *
 *   pnpm --dir apps/backend exec medusa exec ./src/scripts/seed-jovy-catalog.ts
 *
 * Crea/actualiza de forma idempotente:
 * - categorías comerciales de Medusa para las seis tarjetas del catálogo;
 * - familias editoriales y su mapeo a las categorías;
 * - productos publicados con una variante y precio de seed;
 * - fichas editoriales publicadas, vínculos producto-familia y orden de catálogo.
 *
 * No borra productos ni categorías. Re-ejecutarlo reconoce los handles ya
 * existentes y solo completa lo que falte.
 *
 * Las imágenes apuntan al CDN público de Jovy USA. Los precios, textos y
 * certificaciones son datos de desarrollo y deben revisarse en el Admin antes
 * de usarse comercialmente.
 */
import {
  createProductCategoriesWorkflow,
  createProductsWorkflow,
  upsertVariantPricesWorkflow,
} from "@medusajs/medusa/core-flows"
import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError, Modules, ProductStatus } from "@medusajs/framework/utils"
import { randomUUID } from "node:crypto"

import {
  JOVY_SEED_CATEGORIES,
  JOVY_SEED_PRODUCTS,
  jovySeedImage,
} from "@jovy/lib/jovy/catalog-seed"
import {
  buildPresentations,
  formatGrams,
  parseWeightGrams,
} from "@jovy/lib/jovy/catalog-presentations"
import { JOVY_CATALOGUE_MODULE } from "@jovy/modules/jovy-catalogue"
import { JOVY_PRODUCT_EDITORIAL_MODULE } from "@jovy/modules/jovy-product-editorial"
import { saveProductFamilyWorkflow } from "@jovy/workflows/jovy-catalogue/family"
import { seedCatalogueCategoriesWorkflow } from "@jovy/workflows/jovy-catalogue/seed"
import { saveProductEditorialWorkflow } from "@jovy/workflows/jovy-product-editorial/editorial"

type QueryGraph = {
  graph: (input: {
    entity: string
    fields: string[]
    filters?: Record<string, unknown>
    pagination?: { take: number; skip: number }
  }) => Promise<{ data: unknown[] }>
}

type CatalogueService = {
  listCatalogueCategories: (
    filters?: unknown,
    config?: unknown,
  ) => Promise<Array<{ id: string; key: string; medusa_category_id?: string | null }>>
  updateCatalogueCategories: (data: Record<string, unknown>) => Promise<unknown>
  listProductFamilies: (
    filters?: unknown,
    config?: unknown,
  ) => Promise<Array<{ id: string; slug: string; name: string; medusa_category_id?: string | null }>>
}

type EditorialService = {
  listProductEditorials: (
    filters?: unknown,
    config?: unknown,
  ) => Promise<Array<{ id: string; product_id: string; deleted_at?: Date | string | null }>>
}

type LinkService = {
  create: (payload: Record<string, Record<string, string>>) => Promise<unknown>
}

type WorkflowResult<T> = { result: T }

const BATCH_SIZE = 10
const DEMO_HANDLES = ["t-shirt", "sweatpants"]

const productFamilyKey = (familyId: string, productId: string) => `${familyId}:${productId}`

export default async function seedJovyCatalog({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY) as QueryGraph
  const link = container.resolve(ContainerRegistrationKeys.LINK) as LinkService
  const catalogue = container.resolve(JOVY_CATALOGUE_MODULE) as CatalogueService
  const editorialService = container.resolve(JOVY_PRODUCT_EDITORIAL_MODULE) as EditorialService

  const { data: salesChannels } = await query.graph({
    entity: "sales_channel",
    fields: ["id", "name"],
  })
  const { data: shippingProfiles } = await query.graph({
    entity: "shipping_profile",
    fields: ["id"],
  })
  const { data: stores } = await query.graph({
    entity: "store",
    fields: ["id", "supported_currencies.currency_code"],
  })

  const salesChannel = salesChannels[0] as { id: string; name: string } | undefined
  const shippingProfile = shippingProfiles[0] as { id: string } | undefined
  if (!salesChannel || !shippingProfile) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "No hay sales channel o shipping profile. Ejecuta el seed inicial de Medusa primero.",
    )
  }

  const currencyCodes = (
    (stores[0] as { supported_currencies?: Array<{ currency_code?: string | null }> } | undefined)
      ?.supported_currencies ?? []
  )
    .map((currency) => currency.currency_code?.toLowerCase())
    .filter((code): code is string => Boolean(code))

  if (!currencyCodes.length) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "La tienda no tiene monedas configuradas.")
  }

  const currencyCode = currencyCodes.includes("mxn") ? "mxn" : currencyCodes[0]
  logger.info(
    `[jovy-seed] canal "${salesChannel.name}", moneda de precios: ${currencyCode}, productos: ${JOVY_SEED_PRODUCTS.length}`,
  )

  // ---- Categorías comerciales de Medusa -----------------------------------

  const { data: existingCategoryRows } = await query.graph({
    entity: "product_category",
    fields: ["id", "handle"],
    pagination: { take: 1000, skip: 0 },
  })
  const categoryIdByHandle = new Map(
    (existingCategoryRows as Array<{ id: string; handle?: string | null }>)
      .filter((category) => category.handle)
      .map((category) => [category.handle as string, category.id]),
  )

  const missingCategories = JOVY_SEED_CATEGORIES.filter(
    (category) => !categoryIdByHandle.has(category.handle),
  )

  if (missingCategories.length) {
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
    })) as WorkflowResult<Array<{ id: string; handle?: string | null }>>

    for (const category of result) {
      if (category.handle) categoryIdByHandle.set(category.handle, category.id)
    }
    logger.info(`[jovy-seed] categorías comerciales creadas: ${result.length}`)
  }

  for (const category of JOVY_SEED_CATEGORIES) {
    if (!categoryIdByHandle.has(category.handle)) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `No se pudo resolver la categoría comercial ${category.handle}.`,
      )
    }
  }

  // ---- Tarjetas de presentación y familias --------------------------------

  await seedCatalogueCategoriesWorkflow(container).run({ input: {} })
  const catalogueRows = await catalogue.listCatalogueCategories({})
  const catalogueByKey = new Map(catalogueRows.map((row) => [row.key, row]))

  for (const category of JOVY_SEED_CATEGORIES) {
    const row = catalogueByKey.get(category.key)
    if (!row) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `No se pudo resolver la tarjeta de catálogo ${category.key}.`,
      )
    }
    const medusaCategoryId = categoryIdByHandle.get(category.handle) as string
    await catalogue.updateCatalogueCategories({
      id: row.id,
      medusa_category_id: medusaCategoryId,
      active: true,
      coming_soon: false,
      interaction_locked: false,
    })
  }
  logger.info("[jovy-seed] tarjetas de catálogo mapeadas a categorías comerciales")

  const existingFamilies = await catalogue.listProductFamilies({})
  const familyBySlug = new Map(existingFamilies.map((family) => [family.slug, family]))

  for (const category of JOVY_SEED_CATEGORIES) {
    const input = {
      name: category.name,
      slug: category.familySlug,
      description: `Familia Jovy: ${category.name}.`,
      medusa_category_id: categoryIdByHandle.get(category.handle) as string,
      sort_order: category.sortOrder,
      active: true,
    }
    const existing = familyBySlug.get(category.familySlug)
    const { result } = (await saveProductFamilyWorkflow(container).run({
      input: existing ? { id: existing.id, ...input } : input,
    })) as WorkflowResult<{ id: string; slug: string; name: string }>
    familyBySlug.set(category.familySlug, result)
  }
  logger.info(`[jovy-seed] familias aseguradas: ${JOVY_SEED_CATEGORIES.length}`)

  // ---- Productos ----------------------------------------------------------

  const { data: existingProductRows } = await query.graph({
    entity: "product",
    fields: ["id", "handle"],
    pagination: { take: 1000, skip: 0 },
  })
  const productIdByHandle = new Map(
    (existingProductRows as Array<{ id: string; handle?: string | null }>)
      .filter((product) => product.handle)
      .map((product) => [product.handle as string, product.id]),
  )

  const missingProducts = JOVY_SEED_PRODUCTS.filter(
    (product) => !productIdByHandle.has(product.handle),
  )

  for (let start = 0; start < missingProducts.length; start += BATCH_SIZE) {
    const batch = missingProducts.slice(start, start + BATCH_SIZE)
    const payload = batch.map((product) => {
      const category = JOVY_SEED_CATEGORIES.find((item) => item.key === product.categoryKey)
      if (!category) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Categoría de seed desconocida: ${product.categoryKey}`,
        )
      }
      const thumbnail = jovySeedImage(product.imageFile)
      return {
        title: product.title,
        handle: product.handle,
        description: `${product.title}. Producto Jovy de la familia ${category.name}.`,
        status: ProductStatus.PUBLISHED,
        thumbnail,
        images: [{ url: thumbnail }],
        weight: 400,
        shipping_profile_id: shippingProfile.id,
        category_ids: [categoryIdByHandle.get(category.handle) as string],
        sales_channels: [{ id: salesChannel.id }],
        options: [{ title: "Presentación", values: [product.gramaje] }],
        variants: [
          {
            title: product.gramaje,
            sku: `JOVY-${product.handle.toUpperCase()}`,
            options: { "Presentación": product.gramaje },
            prices: [{ amount: product.priceMxn, currency_code: currencyCode }],
            manage_inventory: false,
            allow_backorder: true,
          },
        ],
        metadata: { jovy_seed: "true", jovy_category: product.categoryKey },
      }
    })

    const { result } = (await createProductsWorkflow(container).run({
      input: { products: payload as never },
    })) as WorkflowResult<Array<{ id: string; handle?: string | null }>>

    for (const product of result) {
      if (product.handle) productIdByHandle.set(product.handle, product.id)
    }
    logger.info(
      `[jovy-seed] productos creados: ${Math.min(start + batch.length, missingProducts.length)}/${missingProducts.length}`,
    )
  }

  // Releer para cubrir cualquier resultado que no devolviera el handle.
  const { data: refreshedProducts } = await query.graph({
    entity: "product",
    fields: ["id", "handle"],
    pagination: { take: 1000, skip: 0 },
  })
  for (const product of refreshedProducts as Array<{ id: string; handle?: string | null }>) {
    if (product.handle && JOVY_SEED_PRODUCTS.some((seed) => seed.handle === product.handle)) {
      productIdByHandle.set(product.handle, product.id)
    }
  }

  for (const product of JOVY_SEED_PRODUCTS) {
    if (!productIdByHandle.has(product.handle)) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `No se pudo resolver el producto ${product.handle}.`,
      )
    }
  }

  // ---- Presentaciones comerciales ----------------------------------------

  type SeedProductRow = {
    id: string
    handle?: string | null
    options?: Array<{ id: string; title: string; values?: Array<{ id: string; value: string }> | null }> | null
    variants?: Array<{
      id: string
      title?: string | null
      sku?: string | null
      price_set_id?: string | null
      metadata?: Record<string, unknown> | null
    }> | null
  }

  type SeedProductService = {
    listProducts: (filters: unknown, config: unknown) => Promise<SeedProductRow[]>
    updateProductOptionValuesOnProduct: (data: Record<string, unknown>) => Promise<void>
    createProductVariants: (
      data: Record<string, unknown>[],
    ) => Promise<Array<{ id: string }>>
    updateProductVariants: (id: string, data: Record<string, unknown>) => Promise<unknown>
  }

  const productService = container.resolve(Modules.PRODUCT) as unknown as SeedProductService
  const pgConnection = container.resolve(ContainerRegistrationKeys.PG_CONNECTION) as {
    raw: (sql: string, bindings?: unknown[]) => Promise<unknown>
  }

  const seedProductIds = JOVY_SEED_PRODUCTS.map((product) => productIdByHandle.get(product.handle) as string)
  const seedProducts = await productService.listProducts(
    { id: seedProductIds },
    { relations: ["options", "options.values", "variants"], take: seedProductIds.length },
  )

  let variantsCreated = 0
  let variantsRenamed = 0

  for (const seed of JOVY_SEED_PRODUCTS) {
    const productId = productIdByHandle.get(seed.handle) as string
    const product = seedProducts.find((item) => item.id === productId)
    if (!product) continue

    const presentations = buildPresentations(seed.gramaje, seed.priceMxn)
    if (presentations.length < 2) continue

    const option = product.options?.find((item) => item.title === "Presentación") ?? product.options?.[0]
    if (!option) {
      logger.warn(`[jovy-seed] ${seed.handle} no tiene opción de presentación; se omite`)
      continue
    }

    // Medusa crea los valores globales en la primera llamada y los vincula al
    // producto en una segunda pasada con sus ids ya materializados. Se repite en
    // cada ejecución para reparar vínculos faltantes y mantener idempotencia.
    const labels = presentations.map((item) => item.label)

    await productService.updateProductOptionValuesOnProduct({
      product_option_id: option.id,
      product_id: product.id,
      add: labels.map((value) => ({ value })),
    })

    const { data: refreshedRows } = await query.graph({
      entity: "product",
      fields: ["id", "options.id", "options.values.id", "options.values.value"],
      filters: { id: product.id },
    })
    const refreshedOptions =
      (refreshedRows[0] as {
        options?: Array<{ id: string; values?: Array<{ id: string; value: string }> | null }>
      } | undefined)?.options ?? []
    const refreshedOption = refreshedOptions.find((item) => item.id === option.id)
    const idByValue = new Map(
      (refreshedOption?.values ?? []).map((value) => [value.value, value.id]),
    )
    const valueIds = labels
      .map((label) => idByValue.get(label))
      .filter((id): id is string => Boolean(id))

    if (valueIds.length !== labels.length) {
      logger.warn(`[jovy-seed] ${seed.handle}: no se materializaron todos los valores de presentación`)
    } else {
      // Medusa 2.22 crea los valores pero no siempre materializa el vínculo
      // producto� valor. Se asegura el link interno de forma idempotente para que
      // `createProductVariants` acepte las presentaciones nuevas.
      const linkResult = (await pgConnection.raw(
        `select id from product_product_option
          where product_id = ? and product_option_id = ? and deleted_at is null
          limit 1`,
        [product.id, option.id],
      )) as { rows?: Array<{ id?: string }> }
      const productOptionLinkId = linkResult.rows?.[0]?.id
      if (productOptionLinkId) {
        for (const valueId of valueIds) {
          await pgConnection.raw(
            `insert into product_product_option_value
               (id, product_product_option_id, product_option_value_id, created_at, updated_at)
             select ?, ?, ?, now(), now()
              where not exists (
                select 1 from product_product_option_value
                 where product_product_option_id = ? and product_option_value_id = ?
              )`,
            [
              `ppov_${randomUUID().replace(/-/g, "").slice(0, 24)}`,
              productOptionLinkId,
              valueId,
              productOptionLinkId,
              valueId,
            ],
          )
        }
      } else {
        logger.warn(`[jovy-seed] ${seed.handle}: no se encontró el vínculo producto-opción`)
      }
    }

    const variantsByTitle = new Map(
      (product.variants ?? []).map((variant) => [variant.title ?? "", variant]),
    )
    const baseLabel = presentations[0].label

    const baseVariant =
      variantsByTitle.get(baseLabel) ??
      (product.variants ?? []).find(
        (variant) =>
          parseWeightGrams(variant.title) === presentations[0].grams ||
          Number(variant.metadata?.jovy_grams) === presentations[0].grams,
      )

    if (baseVariant && baseVariant.title !== baseLabel) {
      await productService.updateProductVariants(baseVariant.id, {
        title: baseLabel,
        sku: `JOVY-${seed.handle.toUpperCase()}-${presentations[0].grams}G`,
        options: { [option.title]: baseLabel },
        metadata: { ...(baseVariant.metadata ?? {}), jovy_grams: presentations[0].grams },
      })
      variantsByTitle.delete(baseVariant.title ?? "")
      baseVariant.title = baseLabel
      variantsByTitle.set(baseLabel, baseVariant)
      variantsRenamed += 1
    }

    const pricedVariants: Array<{ id: string; amount: number }> = []

    for (const presentation of presentations) {
      const existing = variantsByTitle.get(presentation.label)
      const metadata = { ...(existing?.metadata ?? {}), jovy_grams: presentation.grams }

      if (!existing) {
        const [created] = await productService.createProductVariants([
          {
            product_id: product.id,
            title: presentation.label,
            sku: `JOVY-${seed.handle.toUpperCase()}-${presentation.grams}G`,
            options: { [option.title]: presentation.label },
            manage_inventory: false,
            allow_backorder: true,
            metadata: { jovy_grams: presentation.grams, jovy_seed: "true" },
          },
        ])
        if (created?.id) {
          pricedVariants.push({ id: created.id, amount: presentation.priceMxn })
        }
        variantsCreated += 1
        continue
      }

      if (Number(existing.metadata?.jovy_grams) !== presentation.grams) {
        await productService.updateProductVariants(existing.id, { metadata })
      }
      pricedVariants.push({ id: existing.id, amount: presentation.priceMxn })
    }

    // `upsertVariantPricesWorkflow` crea el price set y el vínculo cuando la
    // variante nació desde el módulo. Solo se invoca para variantes sin vínculo
    // de precio para no duplicar links ya existentes.
    if (pricedVariants.length) {
      const placeholders = pricedVariants.map(() => "?").join(", ")
      const linkResult = (await pgConnection.raw(
        `select variant_id from product_variant_price_set
          where deleted_at is null and variant_id in (${placeholders})`,
        pricedVariants.map((variant) => variant.id),
      )) as { rows?: Array<{ variant_id?: string }> }
      const linked = new Set((linkResult.rows ?? []).map((row) => row.variant_id))
      const unpriced = pricedVariants.filter((variant) => !linked.has(variant.id))

      if (unpriced.length) {
        await upsertVariantPricesWorkflow(container).run({
          input: {
            variantPrices: unpriced.map((variant) => ({
              variant_id: variant.id,
              product_id: product.id,
              prices: [{ amount: variant.amount, currency_code: currencyCode }],
            })),
            previousVariantIds: [],
          },
        })
      }
    }

    // Retira valores heredados ("6 oz") que ya no tienen variante: la UI del
    // Admin debe mostrar una sola presentación por producto.
    const staleValues = (option.values ?? []).filter((value) => !labels.includes(value.value))
    if (staleValues.length) {
      try {
        await productService.updateProductOptionValuesOnProduct({
          product_option_id: option.id,
          product_id: product.id,
          remove: staleValues.map((value) => value.id),
        })
        logger.info(
          `[jovy-seed] ${seed.handle}: valores heredados retirados (${staleValues.map((value) => value.value).join(", ")})`,
        )
      } catch (error) {
        logger.warn(
          `[jovy-seed] ${seed.handle}: no se pudieron retirar valores heredados: ${
            error instanceof Error ? error.message : String(error)
          }`,
        )
      }
    }
  }

  logger.info(
    `[jovy-seed] presentaciones: ${variantsCreated} variantes creadas, ${variantsRenamed} renombradas a gramos`,
  )

  // ---- Vínculos producto-familia -----------------------------------------

  const { data: linkedFamilyRows } = await query.graph({
    entity: "jovy_product_family",
    fields: ["id", "products.id"],
    pagination: { take: 1000, skip: 0 },
  })
  const existingLinks = new Set<string>()
  const productLinkCount = new Map<string, number>()
  for (const family of linkedFamilyRows as Array<{ id: string; products?: Array<{ id: string }> | null }>) {
    for (const product of family.products ?? []) {
      existingLinks.add(productFamilyKey(family.id, product.id))
      productLinkCount.set(product.id, (productLinkCount.get(product.id) ?? 0) + 1)
    }
  }

  let linksCreated = 0
  for (const product of JOVY_SEED_PRODUCTS) {
    const family = familyBySlug.get(
      JOVY_SEED_CATEGORIES.find((category) => category.key === product.categoryKey)
        ?.familySlug as string,
    )
    if (!family) continue
    const productId = productIdByHandle.get(product.handle) as string
    if (existingLinks.has(productFamilyKey(family.id, productId))) continue
    if ((productLinkCount.get(productId) ?? 0) > 0) {
      logger.warn(`[jovy-seed] ${product.handle} ya tiene otra familia; no se reemplaza`)
      continue
    }
    await link.create({
      [JOVY_CATALOGUE_MODULE]: { jovy_product_family_id: family.id },
      [Modules.PRODUCT]: { product_id: productId },
    })
    existingLinks.add(productFamilyKey(family.id, productId))
    productLinkCount.set(productId, 1)
    linksCreated += 1
  }
  logger.info(`[jovy-seed] vínculos producto-familia creados: ${linksCreated}`)

  // ---- Fichas editoriales -------------------------------------------------

  let published = 0
  for (const [index, product] of JOVY_SEED_PRODUCTS.entries()) {
    const productId = productIdByHandle.get(product.handle) as string
    try {
      await saveProductEditorialWorkflow(container).run({
        input: {
          product_id: productId,
          gramaje: formatGrams(parseWeightGrams(product.gramaje) ?? 0) || product.gramaje,
          certifications: product.certifications as never,
          sort_order: index,
          is_new: Boolean(product.isNew),
          commercial_mode: product.commercialMode,
          editorial_status: "published",
        },
      })
      published += 1
    } catch (error) {
      logger.warn(
        `[jovy-seed] no se pudo publicar ${product.handle}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
    }
  }
  logger.info(`[jovy-seed] fichas editoriales publicadas: ${published}/${JOVY_SEED_PRODUCTS.length}`)

  // ---- Ocultar productos demo de Medusa ----------------------------------

  const { data: demoProducts } = await query.graph({
    entity: "product",
    fields: ["id", "handle"],
    filters: { handle: DEMO_HANDLES },
  })
  for (const demo of demoProducts as Array<{ id: string; handle?: string | null }>) {
    const [editorial] = await editorialService.listProductEditorials({ product_id: demo.id })
    if (!editorial) continue
    await saveProductEditorialWorkflow(container).run({
      input: { product_id: demo.id, editorial_status: "draft" },
    })
    logger.info(`[jovy-seed] producto demo oculto del catálogo: ${demo.handle ?? demo.id}`)
  }

  // ---- Índice de búsqueda -------------------------------------------------

  const search = container.resolve(Modules.SEARCH) as { ingest: (input: unknown) => Promise<unknown> }
  const seededIds = JOVY_SEED_PRODUCTS.map((product) => ({
    id: productIdByHandle.get(product.handle),
  })).filter((item): item is { id: string } => Boolean(item.id))

  try {
    for (let start = 0; start < seededIds.length; start += 25) {
      await search.ingest({
        name: "product.created",
        data: seededIds.slice(start, start + 25),
      } as never)
    }
    logger.info(`[jovy-seed] índice de búsqueda actualizado para ${seededIds.length} producto(s)`)
  } catch (error) {
    logger.warn(
      `[jovy-seed] no se pudo actualizar el índice de búsqueda: ${
        error instanceof Error ? error.message : String(error)
      }`,
    )
  }

  logger.info(
    `[jovy-seed] listo: ${JOVY_SEED_PRODUCTS.length} productos Jovy, ${JOVY_SEED_CATEGORIES.length} familias y ${published} fichas publicadas.`,
  )
}
