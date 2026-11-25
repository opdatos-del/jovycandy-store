import Link from "next/link"

import { ProductGallery } from "@/features/commerce/product-gallery"
import { ProductPurchase } from "@/features/commerce/product-purchase"
import { summarizePresentations } from "@/lib/commerce/product-presentations"
import type { Dictionary, Locale } from "@/lib/i18n"
import { CatalogCard, type CatalogProduct } from "./product-card"

type ProductDetailProps = {
  locale: Locale
  dictionary: Dictionary
  product: CatalogProduct
  related: CatalogProduct[]
  categoryName?: string | null
}

export function ProductDetail({
  locale,
  dictionary,
  product,
  related,
  categoryName,
}: ProductDetailProps) {
  const commerce = product.commerce
  const galleryImages = commerce?.images?.length ? commerce.images : product.thumbnail ? [product.thumbnail] : []
  const isSellable = product.commercialMode === "SELLABLE"
  const lead = isSellable ? dictionary.catalog.sellableLead : dictionary.catalog.catalogOnlyLead
  const weight = summarizePresentations(commerce, product.gramaje)

  return (
    <main id="contenido" tabIndex={-1} className="catalog jovy-catalog jovy-product pt-28 pb-16 sm:pt-32">
      <nav aria-label="Breadcrumb" className="catalog-breadcrumb product-breadcrumb">
        <Link href={`/${locale}`}>{dictionary.nav.home}</Link>
        <span>/</span>
        <Link href={`/${locale}/catalogo`}>{dictionary.catalog.catalogBreadcrumb}</Link>
        <span>/</span>
        <span>{product.title}</span>
      </nav>

      <section className="product-hero">
        <ProductGallery
          images={galleryImages}
          alt={product.title}
          labels={{
            gallery: dictionary.commerce.gallery,
            viewImage: dictionary.commerce.viewImage,
            closeImage: dictionary.commerce.closeImage,
            noImage: dictionary.catalog.noImage,
          }}
          badges={
            <div className="catalog-badges" role="group" aria-label={dictionary.catalog.productBadges}>
              {product.isNew ? (
                <span className="catalog-badge catalog-badge--new">{dictionary.catalog.newBadge}</span>
              ) : null}
              <span
                className={`catalog-badge ${isSellable ? "catalog-badge--sellable" : "catalog-badge--catalog"}`}
              >
                {isSellable ? dictionary.catalog.modeSellable : dictionary.catalog.modeCatalogOnly}
              </span>
            </div>
          }
        />

        <div className="product-info">
          <p className="catalog-eyebrow">{product.family?.name ?? categoryName ?? dictionary.catalog.catalogEyebrow}</p>
          <h1>{product.title}</h1>

          <div className="product-badges">
            {weight ? <span className="product-chip">{weight}</span> : null}
            {product.certifications.map((certification) => (
              <span key={certification} className="product-chip product-chip--soft">
                {certification}
              </span>
            ))}
          </div>

          <p className="product-lead">{commerce?.description ?? lead}</p>

          <dl className="product-specs" aria-label={dictionary.catalog.productInfoTitle}>
            <div>
              <dt>{dictionary.catalog.family}</dt>
              <dd>{product.family?.name ?? categoryName ?? "—"}</dd>
            </div>
            <div>
              <dt>{dictionary.catalog.weight}</dt>
              <dd>{weight ?? "—"}</dd>
            </div>
            <div>
              <dt>{dictionary.catalog.certification}</dt>
              <dd>{product.certifications.length ? product.certifications.join(" · ") : "—"}</dd>
            </div>
            <div>
              <dt>{dictionary.catalog.commercialMode}</dt>
              <dd>{isSellable ? dictionary.catalog.modeSellable : dictionary.catalog.modeCatalogOnly}</dd>
            </div>
            {(commerce?.specs ?? []).map((spec) => (
              <div key={`${spec.label}:${spec.value}`}>
                <dt>{spec.label}</dt>
                <dd>{spec.value}</dd>
              </div>
            ))}
          </dl>

          <ProductPurchase
            locale={locale}
            dictionary={dictionary}
            commerce={commerce}
            catalogOnly={!isSellable}
            productTitle={product.title}
            fallbackWeight={weight}
          />

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
