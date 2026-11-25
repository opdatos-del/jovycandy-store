"use client"

import { useParams } from "next/navigation"

import { Skeleton } from "@/components/ui/skeleton"
import { getDictionary, isLocale, type Locale } from "@/lib/i18n"

export function CatalogLoading({ product = false }: { product?: boolean }) {
  const params = useParams<{ locale?: string }>()
  const locale: Locale = isLocale(params.locale ?? "") ? params.locale as Locale : "es"
  const dictionary = getDictionary(locale)

  return (
    <main
      id="contenido"
      tabIndex={-1}
      className="mx-auto max-w-[1600px] px-4 pb-20 pt-28 sm:px-6 sm:pt-32 lg:px-8"
    >
      <progress
        className="catalog-loading__progress"
        aria-label={dictionary.catalog.loadingCatalog}
      />
      <Skeleton width={220} height={14} />
      <Skeleton className="mt-4" width="min(420px, 70%)" height={44} />
      {product ? (
        <div className="mt-8 grid gap-8 lg:grid-cols-2">
          <Skeleton className="aspect-square" />
          <div className="grid gap-3">
            <Skeleton width="70%" height={32} />
            <Skeleton width="45%" height={20} />
            <Skeleton height={120} />
            <Skeleton height={48} />
          </div>
        </div>
      ) : (
        <div className="mt-8 grid gap-8 lg:grid-cols-[248px_minmax(0,1fr)]">
          <aside className="hidden lg:block">
            <Skeleton height={420} />
          </aside>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
            {Array.from({ length: 10 }).map((_, index) => (
              <div key={index} className="grid gap-3">
                <Skeleton className="aspect-square" />
                <Skeleton width="80%" height={12} />
                <Skeleton width="40%" height={12} />
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  )
}
