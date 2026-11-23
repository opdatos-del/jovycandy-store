import { notFound } from "next/navigation"

import { CatalogPage } from "@/features/catalog/catalog-page"
import { getHomeContent, type CmsProduct } from "@/lib/cms/client"
import { getDictionary, isLocale } from "@/lib/i18n"

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

  const categories = content.categories.filter((category) => category.active)
  const selected = categories.find((category) => category.key === categoria)
  // El catálogo comercial solo lista productos con ficha pública. Los datos de
  // respaldo del CMS no tienen `handle` y no deben ofrecer una acción engañosa.
  const viewableProducts: CmsProduct[] = content.products.filter((product) => Boolean(product.handle))
  const products = selected
    ? viewableProducts.filter((product) => product.categoryKeys.includes(selected.key))
    : viewableProducts
  const categoryCounts = Object.fromEntries(
    categories.map((category) => [
      category.key,
      viewableProducts.filter((product) => product.categoryKeys.includes(category.key)).length,
    ]),
  )

  return (
    <CatalogPage
      locale={locale}
      dictionary={dictionary}
      products={products}
      categories={categories}
      categoryCounts={categoryCounts}
      totalProducts={viewableProducts.length}
      selectedCategoryKey={selected?.key}
      selectedCategoryName={selected?.name}
      selectedCategoryDescription={selected?.description}
    />
  )
}

export const instant = false
