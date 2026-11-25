import Link from "next/link"

import { resolveCardVisual } from "@/lib/commerce/card-visual"
import { formatMoney } from "@/lib/commerce/format"
import {
  getProductPresentations,
  lowestVariantPrice,
  summarizePresentations,
} from "@/lib/commerce/product-presentations"
import type { CommerceProduct } from "@/lib/medusa/store"
import type { CmsProduct } from "@/lib/cms/client"
import { responsiveSrcSet } from "@/lib/images"
import type { Dictionary, Locale } from "@/lib/i18n"

import { ProductCardVisual } from "./product-card-visual"

export type ViewableProduct = CmsProduct & { handle: string }
export type CatalogProduct = ViewableProduct & {
  commerce: CommerceProduct | null
}

export function CatalogCard({
  product,
  locale,
  dictionary,
  fallbackFamily,
  priority = false,
}: {
  product: CatalogProduct
  locale: Locale
  dictionary: Dictionary
  fallbackFamily?: string | null
  priority?: boolean
}) {
  const endpoint = `/${locale}/productos/${product.handle}`
  const image =
    product.commerce?.thumbnail &&
    product.commerce.thumbnail.startsWith("/assets/catalog/products/")
      ? product.commerce.thumbnail.replace(/\.webp$/, "-640.webp")
      : product.commerce?.thumbnail ?? product.thumbnail
  const srcSet =
    product.commerce?.thumbnail?.startsWith("/assets/catalog/products/")
      ? responsiveSrcSet(product.commerce.thumbnail, [400, 640])
      : undefined
  const visual = resolveCardVisual(product.commerce?.cardVisual ?? null, {
    familyPreset: product.family?.cardPreset ?? null,
  })
  const presentations = getProductPresentations(product.commerce)
  const size = summarizePresentations(product.commerce, product.gramaje)
  const price = lowestVariantPrice(product.commerce)

  return (
    <article className="catalog-card" data-card-visual={visual.mode}>
      <Link className="catalog-card__link" href={endpoint}>
        <span className="catalog-card__image">
          <span className="catalog-badges" role="group" aria-label={dictionary.catalog.productBadges}>
            {product.isNew ? (
              <span className="catalog-badge catalog-badge--new">{dictionary.catalog.newBadge}</span>
            ) : null}
            {product.commercialMode === "CATALOG_ONLY" ? (
              <span className="catalog-badge catalog-badge--catalog">{dictionary.catalog.modeCatalogOnly}</span>
            ) : null}
          </span>
          <ProductCardVisual
            title={product.title}
            image={image}
            imageSrcSet={srcSet}
            visual={visual}
            priority={priority}
            noImageLabel={dictionary.catalog.noImage}
          />
        </span>
        <div className="catalog-card__body">
          <p className="catalog-card__family">{product.family?.name ?? fallbackFamily ?? ""}</p>
          <h2 className="catalog-card__title">{product.title}</h2>
          {size ? <span className="catalog-card__size">{size}</span> : null}
          {presentations.length > 1 ? (
            <span className="catalog-card__presentations">
              {dictionary.catalog.presentationCount.replace(
                "{{count}}",
                String(presentations.length),
              )}
            </span>
          ) : null}
          {price ? (
            <span className="catalog-card__price">
              {price.count > 1 ? `${dictionary.catalog.fromPrice} ` : ""}
              {formatMoney(price.amount, price.currencyCode, locale)}
            </span>
          ) : (
            <span className="catalog-card__price catalog-card__price--unavailable">
              {dictionary.commerce.priceUnavailable}
            </span>
          )}
          <span className="catalog-card__meta">
            {product.certifications.map((certification) => (
              <span key={certification}>{certification}</span>
            ))}
          </span>
          <span className="catalog-card__action" aria-hidden="true">
            {dictionary.catalog.viewProduct}
          </span>
        </div>
      </Link>
    </article>
  )
}
