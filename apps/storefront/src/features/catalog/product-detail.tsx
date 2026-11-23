import Link from "next/link"

import { ContactTrigger } from "@/components/contact-trigger"
import { responsiveSrcSet } from "@/lib/images"
import type { Dictionary, Locale } from "@/lib/i18n"
import { CatalogCard, type ViewableProduct } from "./product-card"

type ProductDetailProps = {
  locale: Locale
  dictionary: Dictionary
  product: ViewableProduct
  related: ViewableProduct[]
  categoryName?: string | null
}

export function ProductDetail({
  locale,
  dictionary,
  product,
  related,
  categoryName,
}: ProductDetailProps) {
  const image =
    product.thumbnail && product.thumbnail.startsWith("/assets/catalog/products/")
      ? product.thumbnail.replace(/\.webp$/, "-640.webp")
      : product.thumbnail
  const srcSet =
    product.thumbnail && product.thumbnail.startsWith("/assets/catalog/products/")
      ? responsiveSrcSet(product.thumbnail, [400, 640])
      : undefined
  const isSellable = product.commercialMode === "SELLABLE"
  const lead = isSellable ? dictionary.catalog.sellableLead : dictionary.catalog.catalogOnlyLead

  return (
    <main className="catalog jovy-catalog jovy-product pt-28 pb-16 sm:pt-32">
      <nav aria-label="Breadcrumb" className="catalog-breadcrumb product-breadcrumb">
        <Link href={`/${locale}`}>{dictionary.nav.home}</Link>
        <span>/</span>
        <Link href={`/${locale}/catalogo`}>{dictionary.catalog.catalogBreadcrumb}</Link>
        <span>/</span>
        <span>{product.title}</span>
      </nav>

      <section className="product-hero">
        <div className="product-gallery">
          <div className="product-gallery__frame">
            <div className="catalog-badges" role="group" aria-label={dictionary.catalog.productBadges}>
              {product.isNew ? (
                <span className="catalog-badge catalog-badge--new">{dictionary.catalog.newBadge}</span>
              ) : null}
              <span className={`catalog-badge ${isSellable ? "catalog-badge--sellable" : "catalog-badge--catalog"}`}>
                {isSellable ? dictionary.catalog.modeSellable : dictionary.catalog.modeCatalogOnly}
              </span>
            </div>
            {image ? (
              <img
                src={image}
                srcSet={srcSet}
                sizes="(max-width: 900px) 92vw, 55vw"
                alt={product.title}
                width={640}
                height={640}
                fetchPriority="high"
              />
            ) : (
              <span className="catalog-card__placeholder">{dictionary.catalog.noImage}</span>
            )}
          </div>
        </div>

        <div className="product-info">
          <p className="catalog-eyebrow">{product.family?.name ?? categoryName ?? dictionary.catalog.catalogEyebrow}</p>
          <h1>{product.title}</h1>

          <div className="product-badges">
            {product.gramaje ? <span className="product-chip">{product.gramaje}</span> : null}
            {product.certifications.map((certification) => (
              <span key={certification} className="product-chip product-chip--soft">
                {certification}
              </span>
            ))}
          </div>

          <p className="product-lead">{lead}</p>

          <dl className="product-specs" aria-label={dictionary.catalog.productInfoTitle}>
            <div>
              <dt>{dictionary.catalog.family}</dt>
              <dd>{product.family?.name ?? categoryName ?? "—"}</dd>
            </div>
            <div>
              <dt>{dictionary.catalog.weight}</dt>
              <dd>{product.gramaje ?? "—"}</dd>
            </div>
            <div>
              <dt>{dictionary.catalog.certification}</dt>
              <dd>{product.certifications.length ? product.certifications.join(" · ") : "—"}</dd>
            </div>
            <div>
              <dt>{dictionary.catalog.commercialMode}</dt>
              <dd>{isSellable ? dictionary.catalog.modeSellable : dictionary.catalog.modeCatalogOnly}</dd>
            </div>
          </dl>

          <div className="product-buy">
            {isSellable ? (
              <button
                type="button"
                className="catalog-primary-button product-buy__primary"
                disabled
                aria-describedby="product-buy-note"
              >
                {dictionary.catalog.addToCart}
              </button>
            ) : (
              <ContactTrigger className="catalog-primary-button product-buy__primary">
                {dictionary.catalog.contactToBuy}
              </ContactTrigger>
            )}
            <ContactTrigger className="catalog-secondary-button product-buy__secondary">
              {dictionary.catalog.askQuestion}
            </ContactTrigger>
            <p id="product-buy-note" className="product-buy__note">
              {isSellable ? dictionary.catalog.cartPending : dictionary.catalog.catalogOnlyNote}
            </p>
          </div>

          <Link className="product-back" href={`/${locale}/catalogo`}>
            {dictionary.catalog.backToCatalog}
          </Link>
        </div>
      </section>

      {related.length ? (
        <section className="product-related" aria-labelledby="related-title">
          <div className="product-related__heading">
            <p className="catalog-eyebrow">{dictionary.catalog.relatedEyebrow}</p>
            <h2 id="related-title">{dictionary.catalog.relatedTitle}</h2>
          </div>
          <div className="product-related__grid">
            {related.map((item) => (
              <CatalogCard
                key={item.id}
                product={item}
                locale={locale}
                dictionary={dictionary}
                fallbackFamily={categoryName}
              />
            ))}
          </div>
        </section>
      ) : null}
    </main>
  )
}
