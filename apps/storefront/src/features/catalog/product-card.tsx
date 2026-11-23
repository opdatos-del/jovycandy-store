import Link from "next/link"

import { formatMoney } from "@/lib/commerce/format"
import type { CmsProduct } from "@/lib/cms/client"
import { responsiveSrcSet } from "@/lib/images"
import type { Dictionary, Locale } from "@/lib/i18n"

export type ViewableProduct = CmsProduct & { handle: string }

export function CatalogCard({
  product,
  locale,
  dictionary,
  fallbackFamily,
  price,
}: {
  product: ViewableProduct
  locale: Locale
  dictionary: Dictionary
  fallbackFamily?: string | null
  price?: { amount: number; currencyCode: string } | null
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
        <CardMedia product={product} image={image} srcSet={srcSet} dictionary={dictionary} />
      </Link>
      <div className="catalog-card__body">
        <p className="catalog-card__family">{product.family?.name ?? fallbackFamily ?? ""}</p>
        <h2>
          <Link href={endpoint}>{product.title}</Link>
        </h2>
        {product.gramaje ? <p className="catalog-card__size">{product.gramaje}</p> : null}
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

function CardMedia({
  product,
  image,
  srcSet,
  dictionary,
}: {
  product: CmsProduct
  image: string | null
  srcSet?: string
  dictionary: Dictionary
}) {
  return (
    <>
      <div className="catalog-badges" role="group" aria-label={dictionary.catalog.productBadges}>
        {product.isNew ? (
          <span className="catalog-badge catalog-badge--new">{dictionary.catalog.newBadge}</span>
        ) : null}
        {product.commercialMode === "CATALOG_ONLY" ? (
          <span className="catalog-badge catalog-badge--catalog">{dictionary.catalog.modeCatalogOnly}</span>
        ) : null}
      </div>
      {image ? (
        <img
          src={image}
          srcSet={srcSet}
          sizes="(max-width: 480px) 45vw, (max-width: 900px) 30vw, 240px"
          alt={product.title}
          width={640}
          height={640}
          loading="lazy"
        />
      ) : (
        <span className="catalog-card__placeholder">{dictionary.catalog.noImage}</span>
      )}
    </>
  )
}
