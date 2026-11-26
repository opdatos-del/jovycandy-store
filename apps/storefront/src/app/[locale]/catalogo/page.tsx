import { notFound } from "next/navigation"

import { CatalogPage } from "@/features/catalog/catalog-page"
import { CatalogError } from "@/features/catalog/catalog-error"
import type { CatalogProduct, ViewableProduct } from "@/features/catalog/product-card"
import { getHomeContent } from "@/lib/cms/client"
import { getDictionary, isLocale } from "@/lib/i18n"
import { getMexicoRegion, listCommerceProducts } from "@/lib/medusa/store"

import "@/styles/catalog/catalog.css"

type CataloguePageProps = {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ categoria?: string }>
}

export default async function CataloguePage({ params, searchParams }: CataloguePageProps) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const { categoria } = await searchParams
  const dictionary = getDictionary(locale)
  const content = await getHomeContent(locale)
  if (!content.productsAvailable) return <CatalogError />

  const categories = content.categories.filter((category) => category.active)
  const selected = categories.find((category) => category.key === categoria)
  if (categoria && !selected) notFound()

  // Todos los productos publicados del canal son parte del mismo catálogo.
  const collection: ViewableProduct[] = content.products.filter(
    (product): product is ViewableProduct => Boolean(product.handle),
  )
  const products = selected
    ? collection.filter((product) => product.categoryKeys.includes(selected.key))
    : collection
  const categoryCounts = Object.fromEntries(
    categories.map((category) => [
      category.key,
      collection.filter((product) => product.categoryKeys.includes(category.key)).length,
    ]),
  )

  const region = await getMexicoRegion().catch(() => null)
  const commerceProducts = region ? await listCommerceProducts(region.id).catch(() => []) : []
  const commerceByHandle = new Map(commerceProducts.map((product) => [product.handle, product]))
  const catalogProducts: CatalogProduct[] = products.map((product) => ({
    ...product,
    commerce: commerceByHandle.get(product.handle) ?? null,
  }))

  return (
    <CatalogPage
      locale={locale}
      dictionary={dictionary}
      products={catalogProducts}
      categories={categories}
      categoryCounts={categoryCounts}
      totalProducts={collection.length}
      selectedCategoryKey={selected?.key}
      selectedCategoryName={selected?.name}
      selectedCategoryDescription={selected?.description}
    />
  )
}

export const instant = false
