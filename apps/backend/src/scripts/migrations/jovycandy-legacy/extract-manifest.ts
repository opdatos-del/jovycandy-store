import { createHash } from "node:crypto"
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"

const SITE_URL = "https://www.jovycandy.com.mx/"
const API_ORIGIN = "https://admin.jovycandy.com.mx"
const PRODUCTS_URL = `${API_ORIGIN}/api/products/published`
const CATEGORIES_URL = `${API_ORIGIN}/api/products/categories`
const LOGOS_URL = `${API_ORIGIN}/api/logos?active=true`

type SourceProduct = {
  id: number
  category_id: number
  family_id: string
  product_family: string
  name: string
  slug: string
  description: string | null
  image: string | null
  bowl_image: string | null
  certifications: unknown
  specs: unknown
  gramaje: string | null
  is_new: boolean
  status: string
  sort_order: number
  updated_at: string | null
  category_key: string
  category_name: string
  category_slug: string
  category_active: number
  category_coming_soon: number
  category_sort_order: number
}

type SourceCategory = {
  id: number
  category_key: string
  name: string
  slug: string
  description: string | null
  active: number
  coming_soon: number
  sort_order: number
}

type SourceLogo = {
  id: number
  slug: string
  name: string
  src: string | null
  original_src: string | null
  alt: string | null
  families: string[] | null
  active: boolean
  position: number
}

type MediaAsset = {
  url: string
  source_path: string
  role: "packshot" | "bowl" | "logo" | "logo_original"
  status: "verified" | "unavailable"
  mime: string | null
  bytes: number | null
  sha256: string | null
}

type ManifestProduct = {
  source_id: number
  source_slug: string
  source_updated_at: string | null
  public_url: string
  public_url_note: string
  group_key: string
  family_id: string
  family_name: string
  name: string
  category_key: string
  category_name: string
  description: string | null
  gramaje: string
  weight_grams: number
  specs: Array<{ label: string; value: string }>
  certifications: string[]
  is_new: boolean
  status: "published"
  commercial_mode: "sellable"
  commercial_mode_source: "local_sandbox"
  sort_order: number
  sku: null
  ean: null
  media: MediaAsset[]
  review: {
    missing_fields: string[]
    notes: string[]
  }
}

type Manifest = {
  schema_version: 1
  source: {
    site_url: string
    products_api_url: string
    categories_api_url: string
    logos_api_url: string
    fetched_at: string
    extraction: "public JSON endpoints used by the official SPA"
    public_url_note: string
  }
  summary: {
    published_products: number
    medusa_products: number
    variants: number
    families: number
    categories_with_products: number
    categories_coming_soon: string[]
    media_verified: number
    media_unavailable: number
  }
  categories: SourceCategory[]
  families: Array<{
    source_id: string
    name: string
    slug: string
    category_key: string
    product_count: number
    variant_count: number
    logo: SourceLogo | null
  }>
  products: ManifestProduct[]
  media: MediaAsset[]
}

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function parseDecimal(value: string): number {
  if (value.includes(",") && value.includes(".")) {
    const decimalSeparator = value.lastIndexOf(",") > value.lastIndexOf(".") ? "," : "."
    const parts = value.split(decimalSeparator)
    const integer = parts[0].replace(/[.,]/g, "")
    return Number(`${integer}.${parts.slice(1).join("")}`)
  }
  if (/^\d{1,3}(,\d{3})+$/.test(value)) return Number(value.replace(/,/g, ""))
  if (/^\d{1,3}(\.\d{3})+$/.test(value)) return Number(value.replace(/\./g, ""))
  return Number(value.replace(",", "."))
}

function parseWeightGrams(value: string): number | null {
  const match = value.trim().toLowerCase().match(/^([\d.,]+)\s*(oz|g|kg|lb)$/)
  if (!match) return null

  const amount = parseDecimal(match[1])
  if (!Number.isFinite(amount) || amount <= 0) return null

  switch (match[2]) {
    case "oz":
      return Math.round(amount * 28.3495)
    case "kg":
      return Math.round(amount * 1000)
    case "lb":
      return Math.round(amount * 453.592)
    default:
      return Math.round(amount)
  }
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(30_000),
  })
  if (!response.ok) throw new Error(`GET ${url} respondió ${response.status}`)
  return (await response.json()) as T
}

function validateProducts(products: SourceProduct[]): void {
  const ids = new Set<number>()
  const slugs = new Set<string>()

  for (const product of products) {
    if (!Number.isInteger(product.id) || ids.has(product.id)) {
      throw new Error(`ID de producto duplicado o inválido: ${String(product.id)}`)
    }
    ids.add(product.id)

    if (!product.slug || slugs.has(product.slug)) {
      throw new Error(`Slug de producto duplicado o vacío: ${String(product.slug)}`)
    }
    slugs.add(product.slug)

    for (const field of ["family_id", "name", "gramaje", "category_key"] as const) {
      if (typeof product[field] !== "string" || !product[field].trim()) {
        throw new Error(`Producto ${product.id}: campo obligatorio vacío (${field})`)
      }
    }

    if (product.status !== "published") {
      throw new Error(`Producto ${product.id}: estado no publicado en endpoint publicado`)
    }

    if (!product.gramaje || !parseWeightGrams(product.gramaje)) {
      throw new Error(`Producto ${product.id}: gramaje no convertible (${product.gramaje})`)
    }
  }
}

async function mapLimited<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let cursor = 0

  async function worker() {
    while (cursor < items.length) {
      const index = cursor
      cursor += 1
      results[index] = await mapper(items[index])
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

async function inspectMedia(
  sourcePath: string | null,
  role: MediaAsset["role"],
): Promise<MediaAsset | null> {
  if (!sourcePath) return null

  const url = new URL(sourcePath, API_ORIGIN).toString()
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(30_000) })
    if (!response.ok) {
      return { url, source_path: sourcePath, role, status: "unavailable", mime: null, bytes: null, sha256: null }
    }

    const bytes = Buffer.from(await response.arrayBuffer())
    return {
      url,
      source_path: sourcePath,
      role,
      status: "verified",
      mime: response.headers.get("content-type"),
      bytes: bytes.byteLength,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    }
  } catch {
    return { url, source_path: sourcePath, role, status: "unavailable", mime: null, bytes: null, sha256: null }
  }
}

async function main() {
  const outputIndex = process.argv.indexOf("--output")
  const output =
    outputIndex >= 0
      ? path.resolve(process.argv[outputIndex + 1] ?? "")
      : path.join(path.dirname(process.argv[1]), "manifest.json")

  const [products, categories, logos] = await Promise.all([
    fetchJson<SourceProduct[]>(PRODUCTS_URL),
    fetchJson<SourceCategory[]>(CATEGORIES_URL),
    fetchJson<SourceLogo[]>(LOGOS_URL),
  ])

  validateProducts(products)

  const mediaJobs: Array<{ sourcePath: string; role: MediaAsset["role"] }> = []
  for (const product of products) {
    if (product.image) mediaJobs.push({ sourcePath: product.image, role: "packshot" })
    if (product.bowl_image) mediaJobs.push({ sourcePath: product.bowl_image, role: "bowl" })
  }
  for (const logo of logos) {
    if (logo.src) mediaJobs.push({ sourcePath: logo.src, role: "logo" })
    if (logo.original_src) mediaJobs.push({ sourcePath: logo.original_src, role: "logo_original" })
  }

  const uniqueMediaJobs = [
    ...new Map(mediaJobs.map((job) => [`${job.role}:${job.sourcePath}`, job])).values(),
  ]
  const inspectedMedia = await mapLimited(uniqueMediaJobs, 6, (job) =>
    inspectMedia(job.sourcePath, job.role),
  )
  const mediaByKey = new Map(
    inspectedMedia
      .filter((asset): asset is MediaAsset => Boolean(asset))
      .map((asset) => [`${asset.role}:${asset.source_path}`, asset]),
  )

  const manifestProducts: ManifestProduct[] = products.map((product) => {
    const missingFields: string[] = []
    if (!product.description) missingFields.push("description")
    if (!product.image) missingFields.push("image")
    if (!Array.isArray(product.certifications) || product.certifications.length === 0) {
      missingFields.push("certifications")
    }

    const media = [
      mediaByKey.get(`packshot:${product.image}`),
      mediaByKey.get(`bowl:${product.bowl_image}`),
    ].filter((asset): asset is MediaAsset => Boolean(asset))

    return {
      source_id: product.id,
      source_slug: product.slug,
      source_updated_at: product.updated_at,
      public_url: SITE_URL,
      public_url_note:
        "El sitio oficial es una SPA sin URL dedicada por producto; la selección se realiza por estado interno de categoría/familia/producto.",
      group_key: `${product.family_id}:${slugify(product.name)}`,
      family_id: product.family_id,
      family_name: product.product_family,
      name: product.name,
      category_key: product.category_key,
      category_name: product.category_name.trim(),
      description: product.description,
      gramaje: product.gramaje!,
      weight_grams: parseWeightGrams(product.gramaje!)!,
      specs: Array.isArray(product.specs)
        ? product.specs.filter(
            (spec): spec is { label: string; value: string } =>
              Boolean(spec) && typeof spec === "object" && typeof (spec as { label?: unknown }).label === "string" && typeof (spec as { value?: unknown }).value === "string",
          )
        : [],
      certifications: Array.isArray(product.certifications)
        ? product.certifications.filter((value): value is string => typeof value === "string")
        : [],
      is_new: Boolean(product.is_new),
      status: "published",
      commercial_mode: "sellable",
      commercial_mode_source: "local_sandbox",
      sort_order: product.sort_order,
      sku: null,
      ean: null,
      media,
      review: {
        missing_fields: missingFields,
        notes: [
          "Precio no publicado; se calcula con la política sintética local.",
          "SKU/EAN no publicados por la fuente.",
        ],
      },
    }
  })

  const groups = new Map<string, ManifestProduct[]>()
  for (const product of manifestProducts) {
    const rows = groups.get(product.group_key) ?? []
    rows.push(product)
    groups.set(product.group_key, rows)
  }

  const families = [...new Set(products.map((product) => product.family_id))].map((familyId) => {
    const rows = products.filter((product) => product.family_id === familyId)
    return {
      source_id: familyId,
      name: rows[0].product_family,
      slug: familyId,
      category_key: rows[0].category_key,
      product_count: new Set(rows.map((row) => `${familyId}:${slugify(row.name)}`)).size,
      variant_count: rows.length,
      logo: logos.find((logo) => logo.families?.includes(familyId)) ?? null,
    }
  })

  const allMedia = inspectedMedia.filter((asset): asset is MediaAsset => Boolean(asset))
  const manifest: Manifest = {
    schema_version: 1,
    source: {
      site_url: SITE_URL,
      products_api_url: PRODUCTS_URL,
      categories_api_url: CATEGORIES_URL,
      logos_api_url: LOGOS_URL,
      fetched_at: new Date().toISOString(),
      extraction: "public JSON endpoints used by the official SPA",
      public_url_note:
        "El sitio oficial es una SPA sin URL dedicada por producto; la selección se realiza por estado interno de categoría/familia/producto.",
    },
    summary: {
      published_products: products.length,
      medusa_products: groups.size,
      variants: products.length,
      families: families.length,
      categories_with_products: new Set(products.map((product) => product.category_key)).size,
      categories_coming_soon: categories
        .filter((category) => category.coming_soon === 1)
        .map((category) => category.category_key),
      media_verified: allMedia.filter((asset) => asset.status === "verified").length,
      media_unavailable: allMedia.filter((asset) => asset.status === "unavailable").length,
    },
    categories,
    families,
    products: manifestProducts,
    media: allMedia,
  }

  await mkdir(path.dirname(output), { recursive: true })
  await writeFile(output, `${JSON.stringify(manifest, null, 2)}\n`, "utf8")
  console.log(JSON.stringify(manifest.summary, null, 2))
  console.log(`Manifiesto escrito en ${output}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
