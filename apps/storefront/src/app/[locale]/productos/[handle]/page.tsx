import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { ProductDetail } from "@/features/catalog/product-detail"
import { CatalogError } from "@/features/catalog/catalog-error"
import type { CatalogProduct, ViewableProduct } from "@/features/catalog/product-card"
import { getHomeContent } from "@/lib/cms/client"
import {
  getCommerceProduct,
  getMexicoRegion,
  listCommerceProducts,
} from "@/lib/medusa/store"
import { getDictionary, isLocale } from "@/lib/i18n"

import "@/styles/catalog/catalog.css"

type ProductPageProps = {
  params: Promise<{ locale: string; handle: string }>
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { locale, handle } = await params
  if (!isLocale(locale)) return { title: "Jovy Candy" }
  const content = await getHomeContent(locale)
  if (!content.productsAvailable) return { title: "Jovy Candy" }
  const product = content.products.find((item) => item.handle === handle)
  if (!product) notFound()
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
  if (!content.productsAvailable) return <CatalogError />
  const viewableProducts: ViewableProduct[] = content.products.filter(
    (item): item is ViewableProduct => Boolean(item.handle),
  )
  const product = viewableProducts.find((item) => item.handle === handle)
  if (!product) notFound()

  const collection = viewableProducts

  const categoryName =
    content.categories.find(
      (category) => category.active && product.categoryKeys.includes(category.key),
    )?.name ?? null
  const relatedByFamily = collection.filter(
    (item) =>
      item.id !== product.id &&
      (item.family?.id === product.family?.id ||
        item.categoryKeys.some((key) => product.categoryKeys.includes(key))),
  )
  const relatedProducts = (relatedByFamily.length
    ? relatedByFamily
    : collection.filter((item) => item.id !== product.id)
  ).slice(0, 4)

  const region = await getMexicoRegion().catch(() => null)
  const [commerce, commerceProducts] = await Promise.all([
    region
      ? getCommerceProduct(product.handle, region.id).catch(() => null)
      : Promise.resolve(null),
    region ? listCommerceProducts(region.id).catch(() => []) : Promise.resolve([]),
  ])
  const commerceByHandle = new Map(
    commerceProducts.map((item) => [item.handle, item]),
  )
  const related: CatalogProduct[] = relatedProducts.map((item) => ({
    ...item,
    commerce: commerceByHandle.get(item.handle) ?? null,
  }))
  const catalogProduct: CatalogProduct = {
    ...product,
    commerce,
  }

  return (
    <ProductDetail
      locale={locale}
      dictionary={dictionary}
      product={catalogProduct}
      related={related}
      categoryName={categoryName}
    />
  )
}

export const instant = false
