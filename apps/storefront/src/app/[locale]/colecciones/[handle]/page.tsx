import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { CatalogPage } from "@/features/catalog/catalog-page"
import type { CatalogProduct, ViewableProduct } from "@/features/catalog/product-card"
import { getHomeContent } from "@/lib/cms/client"
import { getDictionary, isLocale } from "@/lib/i18n"
import {
  getMexicoRegion,
  listCommerceCollections,
  listCommerceProducts,
} from "@/lib/medusa/store"

import "@/styles/catalog/catalog.css"

type CollectionPageProps = {
  params: Promise<{ locale: string; handle: string }>
}

export async function generateMetadata({
  params,
}: CollectionPageProps): Promise<Metadata> {
  const { locale, handle } = await params
  if (!isLocale(locale)) return { title: "Jovy Candy" }
  const collections = await listCommerceCollections().catch(() => [])
  const collection = collections.find((item) => item.handle === handle)
  if (!collection) return { title: "Jovy Candy" }
  return {
    title: `${collection.title} | Jovy Candy`,
    alternates: { canonical: `/${locale}/colecciones/${handle}` },
  }
}

export default async function CollectionPage({ params }: CollectionPageProps) {
  const { locale, handle } = await params
  if (!isLocale(locale)) notFound()
  const dictionary = getDictionary(locale)
  const content = await getHomeContent(locale)

  const region = await getMexicoRegion().catch(() => null)
  const [commerceProducts, collections] = await Promise.all([
    region ? listCommerceProducts(region.id).catch(() => []) : Promise.resolve([]),
    listCommerceCollections().catch(() => []),
  ])
  const collection = collections.find((item) => item.handle === handle)
  if (!collection) notFound()

  const commerceByHandle = new Map(
    commerceProducts
      .filter((product) => product.collection?.handle === handle)
      .map((product) => [product.handle, product]),
  )
  const viewable: ViewableProduct[] = content.products.filter(
    (product): product is ViewableProduct =>
      typeof product.handle === "string" && commerceByHandle.has(product.handle),
  )
  const products: CatalogProduct[] = viewable.map((product) => ({
    ...product,
    commerce: commerceByHandle.get(product.handle) ?? null,
  }))

  return (
    <CatalogPage
      locale={locale}
      dictionary={dictionary}
      products={products}
      categories={[]}
      categoryCounts={{}}
      totalProducts={products.length}
      selectedCategoryName={collection.title}
      selectedCategoryDescription={dictionary.catalog.collectionsLead}
    />
  )
}

export const instant = false
