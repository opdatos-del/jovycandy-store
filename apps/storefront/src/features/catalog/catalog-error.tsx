"use client"

import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useTransition } from "react"

import { revalidateCatalogContent } from "@/app/actions/revalidate-catalog"

import { getDictionary, isLocale, type Locale } from "@/lib/i18n"

export function CatalogError() {
  const params = useParams<{ locale?: string }>()
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const locale: Locale = isLocale(params.locale ?? "") ? params.locale as Locale : "es"
  const dictionary = getDictionary(locale)

  return (
    <main
      id="contenido"
      tabIndex={-1}
      className="catalog jovy-catalog pt-28 pb-16 sm:pt-32"
    >
      <section className="catalog-empty" role="alert">
        <h1>{dictionary.catalog.catalogErrorTitle}</h1>
        <p>{dictionary.catalog.catalogErrorLead}</p>
        <div className="catalog-empty__actions">
          <button
            type="button"
            className="catalog-primary-button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await revalidateCatalogContent()
                router.refresh()
              })
            }
          >
            {pending ? dictionary.commerce.loading : dictionary.commerce.retry}
          </button>
          <Link className="catalog-secondary-button" href={`/${locale}`}>
            {dictionary.nav.home}
          </Link>
        </div>
      </section>
    </main>
  )
}
