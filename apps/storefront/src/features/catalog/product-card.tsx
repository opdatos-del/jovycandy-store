import Link from "next/link"

import { formatMoney } from "@/lib/commerce/format"
import { weightLabel } from "@/lib/commerce/weight"
import type { CmsProduct } from "@/lib/cms/client"
import { responsiveSrcSet } from "@/lib/images"
import type { Dictionary, Locale } from "@/lib/i18n"
import type { CardHoverConfig } from "@/lib/medusa/store"

import { ProductCardMedia } from "./product-card-media"

export type ViewableProduct = CmsProduct & { handle: string }

export function CatalogCard({
  product,
  locale,
  dictionary,
  fallbackFamily,
  price,
  hover,
  priority = false,
}: {
  product: ViewableProduct
  locale: Locale
  dictionary: Dictionary
  fallbackFamily?: string | null
  price?: { amount: number; currencyCode: string } | null
  hover?: CardHoverConfig | null
  priority?: boolean
}) {
  const endpoint = `/${locale}/productos/${product.handle}`
  const image =
    product.thumbnail && product.thumbnail.startsWith("/assets/catalog/products/")
      ? product.thumbnail.replace(/\.webp$/, "-640.webp")
      : product.thumbnail
  const srcSet =
    product.thumbnail && product.thumbnail.startsWith("/assets/catalog/products/")
      ? responsiveSrcSet(product.thumbnail, [400, 640])
      : undefined

  return (
    <article className="catalog-card">
      <Link
        className="catalog-card__image"
        href={endpoint}
        aria-label={`${dictionary.catalog.viewProduct}: ${product.title}`}
      >
        <div className="catalog-badges" role="group" aria-label={dictionary.catalog.productBadges}>
          {product.isNew ? (
            <span className="catalog-badge catalog-badge--new">{dictionary.catalog.newBadge}</span>
          ) : null}
          {product.commercialMode === "CATALOG_ONLY" ? (
            <span className="catalog-badge catalog-badge--catalog">{dictionary.catalog.modeCatalogOnly}</span>
          ) : null}
        </div>
        <ProductCardMedia
          title={product.title}
          image={image}
          imageSrcSet={srcSet}
          hover={hover}
          priority={priority}
          noImageLabel={dictionary.catalog.noImage}
        />
      </Link>
      <div className="catalog-card__body">
        <p className="catalog-card__family">{product.family?.name ?? fallbackFamily ?? ""}</p>
        <h2>
          <Link href={endpoint}>{product.title}</Link>
        </h2>
        {product.gramaje ? <p className="catalog-card__size">{weightLabel(product.gramaje)}</p> : null}
        {price ? (
          <p className="catalog-card__price">
            {formatMoney(price.amount, price.currencyCode, locale)}
          </p>
        ) : null}
        <p className="catalog-card__meta">
          {product.certifications.length
            ? product.certifications.map((certification) => (
                <span key={certification}>{certification}</span>
              ))
            : null}
        </p>
        <Link className="catalog-card__action" href={endpoint}>
          {dictionary.catalog.viewProduct}
        </Link>
      </div>
    </article>
  )
}
