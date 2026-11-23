import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { ProductDetail } from "@/features/catalog/product-detail"
import type { ViewableProduct } from "@/features/catalog/product-card"
import { getHomeContent } from "@/lib/cms/client"
import { getDictionary, isLocale } from "@/lib/i18n"

import "@/styles/catalog/catalog.css"

type ProductPageProps = {
  params: Promise<{ locale: string; handle: string }>
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { locale, handle } = await params
  if (!isLocale(locale)) return { title: "Jovy Candy" }
  const dictionary = getDictionary(locale)
  const content = await getHomeContent(locale)
  const product = content.products.find((item) => item.handle === handle)
  if (!product) {
    return {
      title: dictionary.catalog.productNotFoundTitle,
      robots: { index: false, follow: false },
    }
  }
  const details = [product.family?.name, product.gramaje].filter(Boolean).join(" · ")
  return {
    title: `${product.title} | Jovy Candy`,
    description: details ? `${product.title} · ${details}` : product.title,
    alternates: { canonical: `/${locale}/productos/${handle}` },
  }
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { locale, handle } = await params
  if (!isLocale(locale)) notFound()
  const dictionary = getDictionary(locale)
  const content = await getHomeContent(locale)
  const viewableProducts: ViewableProduct[] = content.products.filter(
    (item): item is ViewableProduct => Boolean(item.handle),
  )
  const product = viewableProducts.find((item) => item.handle === handle)
  if (!product) notFound()

  const categoryName =
    content.categories.find(
      (category) => category.active && product.categoryKeys.includes(category.key),
    )?.name ?? null
  const relatedByFamily = viewableProducts.filter(
    (item) =>
      item.id !== product.id &&
      (item.family?.id === product.family?.id ||
        item.categoryKeys.some((key) => product.categoryKeys.includes(key))),
  )
  const related = (relatedByFamily.length
    ? relatedByFamily
    : viewableProducts.filter((item) => item.id !== product.id)
  ).slice(0, 4)

  return (
    <ProductDetail
      locale={locale}
      dictionary={dictionary}
      product={product}
      related={related}
      categoryName={categoryName}
    />
  )
}

export const instant = false
