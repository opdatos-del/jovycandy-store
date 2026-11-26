import { z } from "@medusajs/framework/zod"

import { CATALOGUE_CATEGORY_KEYS, familySlugFrom } from "./catalogue"

const mediaAssetSchema = z.looseObject({
  url: z.url(),
  source_path: z.string().min(1),
  role: z.enum(["packshot", "bowl", "logo", "logo_original"]),
  status: z.enum(["verified", "unavailable"]),
  mime: z.string().nullable(),
  bytes: z.number().int().nonnegative().nullable(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
})

const legacyProductSchema = z.looseObject({
  source_id: z.number().int().positive(),
  source_slug: z.string().min(1),
  source_updated_at: z.string().nullable(),
  public_url: z.url(),
  public_url_note: z.string().min(1),
  group_key: z.string().min(1),
  family_id: z.string().min(1),
  family_name: z.string().min(1),
  name: z.string().min(1),
  category_key: z.enum(CATALOGUE_CATEGORY_KEYS),
  category_name: z.string().min(1),
  description: z.string().nullable(),
  gramaje: z.string().min(1),
  weight_grams: z.number().int().positive(),
  specs: z.array(z.object({ label: z.string(), value: z.string() })),
  certifications: z.array(z.string()),
  is_new: z.boolean(),
  status: z.literal("published"),
  commercial_mode: z.literal("sellable"),
  commercial_mode_source: z.literal("local_sandbox"),
  sort_order: z.number().int().nonnegative(),
  sku: z.null(),
  ean: z.null(),
  media: z.array(mediaAssetSchema),
  review: z.object({
    missing_fields: z.array(z.string()),
    notes: z.array(z.string()),
  }),
})

export const legacyCatalogSchema = z.looseObject({
  schema_version: z.literal(1),
  source: z.object({
    site_url: z.url(),
    products_api_url: z.url(),
    categories_api_url: z.url(),
    logos_api_url: z.url(),
    fetched_at: z.string().datetime(),
    extraction: z.string().min(1),
    public_url_note: z.string().min(1),
  }),
  summary: z.object({
    published_products: z.number().int().nonnegative(),
    medusa_products: z.number().int().nonnegative(),
    variants: z.number().int().nonnegative(),
    families: z.number().int().nonnegative(),
    categories_with_products: z.number().int().nonnegative(),
    categories_coming_soon: z.array(z.string()),
    media_verified: z.number().int().nonnegative(),
    media_unavailable: z.number().int().nonnegative(),
  }),
  categories: z.array(
    z.looseObject({
      id: z.number().int().positive(),
      category_key: z.enum(CATALOGUE_CATEGORY_KEYS),
      name: z.string().min(1),
      slug: z.string().min(1),
      description: z.string().nullable(),
      active: z.union([z.number().int(), z.boolean()]),
      coming_soon: z.union([z.number().int(), z.boolean()]),
      sort_order: z.number().int().nonnegative(),
    }),
  ),
  families: z.array(
    z.looseObject({
      source_id: z.string().min(1),
      name: z.string().min(1),
      slug: z.string().min(1),
      category_key: z.enum(CATALOGUE_CATEGORY_KEYS),
      product_count: z.number().int().nonnegative(),
      variant_count: z.number().int().nonnegative(),
      logo: z.looseObject({
        id: z.number().int().positive(),
        slug: z.string(),
        name: z.string(),
        src: z.string().nullable(),
        original_src: z.string().nullable(),
        alt: z.string().nullable(),
        families: z.array(z.string()).nullable(),
        active: z.boolean(),
        position: z.number().int().nonnegative(),
      }).nullable(),
    }),
  ),
  products: z.array(legacyProductSchema),
  media: z.array(mediaAssetSchema),
})

export type LegacyCatalogManifest = z.infer<typeof legacyCatalogSchema>
export type LegacyCatalogProduct = z.infer<typeof legacyProductSchema>

export type LegacyVariantPlan = {
  sourceId: number
  sourceSlug: string
  title: string
  grams: number
  sku: string
  priceMxn: number
  specs: Array<{ label: string; value: string }>
  media: LegacyCatalogProduct["media"]
}

export type LegacyProductPlan = {
  externalId: string
  handle: string
  title: string
  description: string | null
  categoryKey: LegacyCatalogProduct["category_key"]
  familyId: string
  familyName: string
  sortOrder: number
  isNew: boolean
  sourceUpdatedAt: string | null
  specs: Array<{ label: string; value: string }>
  certifications: string[]
  variants: LegacyVariantPlan[]
  media: LegacyCatalogProduct["media"]
}

/** Tarifa sintética por 100 g. No representa precios comerciales autorizados. */
export const SYNTHETIC_PRICE_MXN_PER_100G: Record<
  LegacyCatalogProduct["category_key"],
  number
> = {
  sazonador: 22,
  chamoy: 30,
  gomitas_almidon: 28,
  dulces_paletas: 24,
  pinatero: 18,
  gomitas_grenetina: 25,
}

/** Ajustes opcionales por familia; tienen prioridad sobre la categoría. */
export const SYNTHETIC_FAMILY_PRICE_MXN_PER_100G: Record<string, number> = {
  "premium-pi-atero": 14,
  "tropi-mix": 20,
}

/**
 * Precio local por gramaje con descuento moderado por volumen y redondeo a $5.
 * El storefront siempre recibe el precio persistido por Medusa; esta función
 * solo se usa al crear una variante que aún no tiene precio.
 */
export function calculateSyntheticPriceMxn(
  categoryKey: LegacyCatalogProduct["category_key"],
  grams: number,
  familyId?: string,
): number {
  if (!Number.isFinite(grams) || grams <= 0) {
    throw new Error("El gramaje debe ser positivo para calcular un precio sintético")
  }

  const rate =
    (familyId ? SYNTHETIC_FAMILY_PRICE_MXN_PER_100G[familyId] : undefined) ??
    SYNTHETIC_PRICE_MXN_PER_100G[categoryKey]

  if (!rate || rate <= 0) {
    throw new Error(`No hay tarifa sintética configurada para ${categoryKey}`)
  }

  const volumeFactor = grams >= 1000 ? 0.85 : grams >= 500 ? 0.92 : 1
  const raw = (grams / 100) * rate * volumeFactor
  return Math.max(15, Math.round(raw / 5) * 5)
}

function aggregateSpecs(
  rows: LegacyCatalogProduct[],
): Array<{ label: string; value: string }> {
  const byLabel = new Map<string, Map<string, string[]>>()
  for (const row of rows) {
    for (const spec of row.specs) {
      const values = byLabel.get(spec.label) ?? new Map<string, string[]>()
      const presentations = values.get(spec.value) ?? []
      presentations.push(row.gramaje)
      values.set(spec.value, presentations)
      byLabel.set(spec.label, values)
    }
  }

  return [...byLabel.entries()].flatMap(([label, values]) =>
    [...values.entries()].map(([value, presentations]) => ({
      label: values.size > 1 ? `${label} · ${presentations.join(" / ")}` : label,
      value,
    })),
  )
}

/** Agrupa presentaciones del mismo nombre/familia sin agrupar sabores distintos. */
export function buildLegacyProductPlans(
  manifest: LegacyCatalogManifest,
): LegacyProductPlan[] {
  const groups = new Map<string, LegacyCatalogProduct[]>()

  for (const product of manifest.products) {
    const rows = groups.get(product.group_key) ?? []
    rows.push(product)
    groups.set(product.group_key, rows)
  }

  return [...groups.entries()]
    .map(([groupKey, rows]) => {
      const sorted = [...rows].sort((a, b) => a.weight_grams - b.weight_grams)
      const first = sorted[0]
      const handle = `jovy-mx-${familySlugFrom(groupKey.replace(":", "-"))}`

      return {
        externalId: `jovy-mx:${groupKey}`,
        handle,
        title: first.name,
        description: first.description,
        categoryKey: first.category_key,
        familyId: first.family_id,
        familyName: first.family_name,
        sortOrder: Math.min(...rows.map((row) => row.sort_order)),
        isNew: rows.some((row) => row.is_new),
        sourceUpdatedAt: rows
          .map((row) => row.source_updated_at)
          .filter((value): value is string => Boolean(value))
          .sort()
          .slice(-1)[0] ?? null,
        specs: aggregateSpecs(rows),
        certifications: [...new Set(rows.flatMap((row) => row.certifications))],
        variants: sorted.map((row) => ({
          sourceId: row.source_id,
          sourceSlug: row.source_slug,
          title: row.gramaje,
          grams: row.weight_grams,
          sku: `JOVY-MX-${row.source_id}`,
          priceMxn: calculateSyntheticPriceMxn(
            row.category_key,
            row.weight_grams,
            row.family_id,
          ),
          specs: row.specs,
          media: row.media,
        })),
        media: sorted.flatMap((row) => row.media),
      }
    })
    .sort((a, b) => a.sortOrder - b.sortOrder || a.handle.localeCompare(b.handle))
}

/** Validación de integridad adicional al esquema. */
export function validateLegacyCatalog(
  manifest: LegacyCatalogManifest,
): void {
  const sourceIds = new Set<number>()
  const sourceSlugs = new Set<string>()
  const variantKeys = new Set<string>()

  for (const product of manifest.products) {
    if (sourceIds.has(product.source_id)) {
      throw new Error(`ID histórico duplicado: ${product.source_id}`)
    }
    sourceIds.add(product.source_id)

    if (sourceSlugs.has(product.source_slug)) {
      throw new Error(`Slug histórico duplicado: ${product.source_slug}`)
    }
    sourceSlugs.add(product.source_slug)

    const variantKey = `${product.group_key}:${product.weight_grams}`
    if (variantKeys.has(variantKey)) {
      throw new Error(`Presentación duplicada: ${variantKey}`)
    }
    variantKeys.add(variantKey)

    if (!product.media.some((asset) => asset.role === "packshot" && asset.status === "verified")) {
      throw new Error(`Producto ${product.source_id} sin packshot verificado`)
    }
  }

  const familyIds = new Set(manifest.families.map((family) => family.source_id))
  const categoryKeys = new Set(manifest.categories.map((category) => category.category_key))

  for (const product of manifest.products) {
    if (!familyIds.has(product.family_id)) {
      throw new Error(`Producto ${product.source_id} referencia una familia inexistente`)
    }
    if (!categoryKeys.has(product.category_key)) {
      throw new Error(`Producto ${product.source_id} referencia una categoría inexistente`)
    }
    const expectedGroupKey = `${product.family_id}:${familySlugFrom(product.name)}`
    if (product.group_key !== expectedGroupKey) {
      throw new Error(`group_key inválido para ${product.source_id}: ${product.group_key}`)
    }
  }

  for (const family of manifest.families) {
    const rows = manifest.products.filter((product) => product.family_id === family.source_id)
    if (
      new Set(rows.map((product) => product.group_key)).size !==
      family.product_count
    ) {
      throw new Error(`Conteo de productos inconsistente para ${family.source_id}`)
    }
    if (rows.length !== family.variant_count) {
      throw new Error(`Conteo de variantes inconsistente para ${family.source_id}`)
    }
  }

  const plans = buildLegacyProductPlans(manifest)
  if (manifest.products.length !== manifest.summary.published_products) {
    throw new Error("El resumen del manifiesto no coincide con los productos publicados")
  }
  if (plans.length !== manifest.summary.medusa_products) {
    throw new Error("El resumen del manifiesto no coincide con los productos agrupados")
  }
  if (manifest.products.length !== manifest.summary.variants) {
    throw new Error("El resumen del manifiesto no coincide con las variantes")
  }
  if (manifest.families.length !== manifest.summary.families) {
    throw new Error("El resumen del manifiesto no coincide con las familias")
  }

  const categoriesWithProducts = new Set(
    manifest.products.map((product) => product.category_key),
  )
  if (categoriesWithProducts.size !== manifest.summary.categories_with_products) {
    throw new Error("El resumen del manifiesto no coincide con las categorías con productos")
  }

  const comingSoon = manifest.categories
    .filter((category) => Boolean(category.coming_soon))
    .map((category) => category.category_key)
    .sort()
  if (
    JSON.stringify(comingSoon) !==
    JSON.stringify([...manifest.summary.categories_coming_soon].sort())
  ) {
    throw new Error("El resumen del manifiesto no coincide con las categorías próximas")
  }

  const verifiedMedia = manifest.media.filter((asset) => asset.status === "verified").length
  const unavailableMedia = manifest.media.filter((asset) => asset.status === "unavailable").length
  if (verifiedMedia !== manifest.summary.media_verified) {
    throw new Error("El resumen del manifiesto no coincide con los medios verificados")
  }
  if (unavailableMedia !== manifest.summary.media_unavailable) {
    throw new Error("El resumen del manifiesto no coincide con los medios no disponibles")
  }

  const handles = new Set<string>()
  const externalIds = new Set<string>()
  for (const plan of plans) {
    if (handles.has(plan.handle)) throw new Error(`Handle duplicado: ${plan.handle}`)
    if (externalIds.has(plan.externalId)) {
      throw new Error(`external_id duplicado: ${plan.externalId}`)
    }
    handles.add(plan.handle)
    externalIds.add(plan.externalId)
  }
}
