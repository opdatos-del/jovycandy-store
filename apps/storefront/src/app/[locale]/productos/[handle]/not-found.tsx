"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { getDictionary, isLocale, type Locale } from "@/lib/i18n"

import "@/styles/catalog/catalog.css"

export default function ProductNotFound() {
  const pathname = usePathname()
  const segment = pathname.split("/")[1]
  const locale: Locale = isLocale(segment) ? segment : "es"
  const dictionary = getDictionary(locale)

  return (
    <main className="catalog jovy-catalog jovy-notfound pt-28 pb-20 sm:pt-32">
      <section className="catalog-notfound" aria-labelledby="not-found-title">
        <nav aria-label="Breadcrumb" className="catalog-breadcrumb">
          <Link href={`/${locale}`}>{dictionary.nav.home}</Link>
          <span>/</span>
          <Link href={`/${locale}/catalogo`}>{dictionary.catalog.catalogBreadcrumb}</Link>
          <span>/</span>
          <span>{dictionary.catalog.productNotFoundBreadcrumb}</span>
        </nav>

        <div className="catalog-notfound__inner">
          <p className="catalog-notfound__code" aria-hidden="true">
            404
          </p>
          <p className="catalog-eyebrow">{dictionary.catalog.catalogEyebrow}</p>
          <h1 id="not-found-title">{dictionary.catalog.productNotFoundTitle}</h1>
          <p>{dictionary.catalog.productNotFoundLead}</p>
          <div className="catalog-notfound__actions">
            <Link className="catalog-primary-button" href={`/${locale}/catalogo`}>
              {dictionary.catalog.productNotFoundAction}
            </Link>
            <Link className="catalog-secondary-button" href={`/${locale}`}>
              {dictionary.catalog.productNotFoundHome}
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
