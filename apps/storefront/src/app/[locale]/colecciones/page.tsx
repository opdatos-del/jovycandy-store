import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { getDictionary, isLocale } from "@/lib/i18n"
import { listCommerceCollections } from "@/lib/medusa/store"

import "@/styles/catalog/catalog.css"

type CollectionsPageProps = {
  params: Promise<{ locale: string }>
}

export const metadata: Metadata = {
  title: "Colecciones | JovyCandy",
  alternates: { canonical: "/es/colecciones" },
}

export default async function CollectionsPage({ params }: CollectionsPageProps) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const dictionary = getDictionary(locale)
  const collections = await listCommerceCollections().catch(() => [])

  return (
    <main id="contenido" tabIndex={-1} className="catalog jovy-catalog pt-28 pb-16 sm:pt-32">
      <header className="catalog-heading">
        <nav aria-label="Breadcrumb" className="catalog-breadcrumb">
          <Link href={`/${locale}`}>{dictionary.nav.home}</Link>
          <span>/</span>
          <Link href={`/${locale}/catalogo`}>{dictionary.catalog.catalogBreadcrumb}</Link>
          <span>/</span>
          <span>{dictionary.catalog.collections}</span>
        </nav>
        <p className="catalog-eyebrow">{dictionary.catalog.catalogEyebrow}</p>
        <h1>{dictionary.catalog.collections}</h1>
        <p>{dictionary.catalog.collectionsLead}</p>
      </header>

      {collections.length ? (
        <ul className="catalog-grid">
          {collections.map((collection) => (
            <li key={collection.id}>
              <Link
                className="catalog-primary-button"
                href={`/${locale}/colecciones/${collection.handle}`}
              >
                {collection.title}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="catalog-empty">{dictionary.catalog.noCollections}</p>
      )}
    </main>
  )
}

export const instant = false
