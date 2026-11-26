import { notFound } from "next/navigation"

import { CatalogPage, type CatalogCategory } from "@/features/catalog/catalog-page"
import { CatalogError } from "@/features/catalog/catalog-error"
import type { CatalogProduct, ViewableProduct } from "@/features/catalog/product-card"
import { getHomeContent } from "@/lib/cms/client"
import { getDictionary, isLocale } from "@/lib/i18n"
import {
  getMexicoRegion,
  listCommerceCategories,
  listCommerceProducts,
} from "@/lib/medusa/store"

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

  const region = await getMexicoRegion().catch(() => null)
  const [commerceProducts, nativeCategories] = await Promise.all([
    region ? listCommerceProducts(region.id).catch(() => []) : Promise.resolve([]),
    listCommerceCategories().catch(() => []),
  ])
  const commerceByHandle = new Map(commerceProducts.map((product) => [product.handle, product]))

  // Todos los productos publicados del canal son parte del mismo catálogo.
  const collection: ViewableProduct[] = content.products.filter(
    (product): product is ViewableProduct => Boolean(product.handle),
  )
  const catalogProducts: CatalogProduct[] = collection.map((product) => ({
    ...product,
    commerce: commerceByHandle.get(product.handle) ?? null,
  }))

  const presentedCategories = content.categories
    .filter((category) => category.active)
    .map<CatalogCategory>((category) => ({
      key: category.key,
      name: category.name,
      description: category.description,
      medusaCategoryId: category.medusaCategoryId ?? null,
    }))

  const mappedCategoryIds = new Set(
    presentedCategories
      .map((category) => category.medusaCategoryId)
      .filter((id): id is string => Boolean(id)),
  )
  const additionalCategories: CatalogCategory[] = nativeCategories
    .filter((category) => !mappedCategoryIds.has(category.id))
    .map((category) => ({
      key: `medusa:${category.handle}`,
      name: category.name,
      description: null,
      medusaCategoryId: category.id,
    }))

  const categories = [...presentedCategories, ...additionalCategories]
  const selected = categories.find((category) => category.key === categoria)
  if (categoria && !selected) notFound()

  const belongsToCategory = (product: CatalogProduct, category: CatalogCategory) => {
    if (category.medusaCategoryId) {
      return Boolean(
        product.commerce?.categories.some(
          (item) => item.id === category.medusaCategoryId,
        ),
      )
    }
    return product.categoryKeys.includes(category.key)
  }

  const products = selected
    ? catalogProducts.filter((product) => belongsToCategory(product, selected))
    : catalogProducts
  const categoryCounts = Object.fromEntries(
    categories.map((category) => [
      category.key,
      catalogProducts.filter((product) => belongsToCategory(product, category)).length,
    ]),
  )

  return (
    <CatalogPage
      locale={locale}
      dictionary={dictionary}
      products={products}
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
