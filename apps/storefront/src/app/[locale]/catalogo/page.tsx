import Link from "next/link"
import { notFound } from "next/navigation"

import { ArrowRightIcon, DownloadIcon } from "@/components/icons"
import { getHomeContent, FALLBACK_PRODUCTS } from "@/lib/cms/client"
import { responsiveSrcSet } from "@/lib/images"
import { getDictionary, isLocale } from "@/lib/i18n"

type CataloguePageProps = {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ categoria?: string }>
}

export default async function CataloguePage({ params, searchParams }: CataloguePageProps) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const { categoria } = await searchParams
  const dictionary = getDictionary(locale)
  const content = await getHomeContent(locale)

  const categories = content.categories.filter((category) => category.active)
  const selected = categories.find((category) => category.key === categoria)
  const cmsProducts = selected
    ? content.products.filter((product) => product.categoryKeys.includes(selected.key))
    : content.products
  const products = cmsProducts.length
    ? cmsProducts
    : selected
      ? FALLBACK_PRODUCTS.filter((product) => product.categoryKeys.includes(selected.key))
      : content.products.length
        ? content.products
        : FALLBACK_PRODUCTS

  return (
    <main className="bg-[#fffaf0] pb-20 pt-28 sm:pt-32">
      <div className="page-shell-wide">
        <p className="text-[0.65rem] font-bold uppercase tracking-[0.3em] text-[#b4234a]">{dictionary.catalog.title}</p>
        <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-4xl font-black uppercase tracking-[0.01em] text-[#0d3b6e] sm:text-6xl">
              {selected?.name ?? dictionary.nav.store}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-stone-600">
              {selected?.description ?? dictionary.catalog.selectProduct}
            </p>
          </div>
          <a href="/catalogo.pdf" target="_blank" rel="noreferrer" className="inline-flex w-fit items-center gap-2 rounded-full border border-[#0d3b6e]/20 bg-white px-5 py-3 text-xs font-bold uppercase tracking-[0.14em] text-[#0d3b6e]">
            <DownloadIcon className="h-4 w-4" />
            {dictionary.catalog.downloadSpecs}
          </a>
        </div>

        <div className="mobile-scroll mt-8 flex gap-2 overflow-x-auto pb-2">
          <Link href={`/${locale}/catalogo`} className={`shrink-0 rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] ${!selected ? "border-[#0d3b6e] bg-[#0d3b6e] text-white" : "border-stone-300 bg-white text-stone-700"}`}>
            {dictionary.catalog.all}
          </Link>
          {categories.map((category) => (
            <Link
              key={category.key}
              href={`/${locale}/catalogo?categoria=${category.key}`}
              className={`shrink-0 rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] ${selected?.key === category.key ? "border-[#0d3b6e] bg-[#0d3b6e] text-white" : "border-stone-300 bg-white text-stone-700"}`}
            >
              {category.name}
            </Link>
          ))}
        </div>

        {products.length ? (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {products.map((product) => (
              <article key={product.id} className="group flex flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-[0_12px_30px_rgba(67,54,40,0.08)]">
                <div className="relative aspect-square overflow-hidden bg-[#fff5d4]">
                  {product.thumbnail ? (
                    <img
                      src={product.thumbnail.startsWith("/assets/catalog/products/") ? product.thumbnail.replace(/\.webp$/, "-640.webp") : product.thumbnail}
                      srcSet={product.thumbnail.startsWith("/assets/catalog/products/") ? responsiveSrcSet(product.thumbnail, [400, 640]) : undefined}
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                      alt={product.title}
                      className="h-full w-full object-contain p-4 transition duration-500 group-hover:scale-105"
                      width={640}
                      height={640}
                      loading="lazy"
                    />
                  ) : null}
                  <span className={`absolute left-3 top-3 rounded-full px-3 py-1 text-[0.55rem] font-bold uppercase tracking-[0.14em] text-white ${product.commercialMode === "SELLABLE" ? "bg-[#00afaa]" : "bg-stone-500"}`}>
                    {product.commercialMode === "SELLABLE" ? "SELLABLE" : "CATALOG_ONLY"}
                  </span>
                </div>
                <div className="flex flex-1 flex-col p-4">
                  <h2 className="text-lg font-bold text-stone-900">{product.title}</h2>
                  <p className="mt-1 text-xs text-stone-500">{product.family?.name ?? selected?.name ?? ""}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {product.gramaje ? <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[0.6rem] font-semibold text-stone-600">{product.gramaje}</span> : null}
                    {product.certifications.map((certification) => (
                      <span key={certification} className="rounded-full bg-[#00afaa]/10 px-2.5 py-1 text-[0.6rem] font-semibold text-[#007d79]">{certification}</span>
                    ))}
                  </div>
                  <div className="mt-auto pt-4">
                    {product.handle ? (
                      <Link href={`/${locale}/productos/${product.handle}`} className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-[#0d3b6e]">
                        {dictionary.catalog.viewDetails}
                        <ArrowRightIcon className="h-4 w-4" />
                      </Link>
                    ) : (
                      <button
                        type="button"
                        disabled
                        className="text-xs font-bold uppercase tracking-[0.14em] text-stone-400"
                      >
                        {dictionary.catalog.general}
                      </button>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-12 rounded-2xl border border-stone-200 bg-white p-8 text-center text-stone-600">{dictionary.catalog.noResults}</p>
        )}
      </div>
    </main>
  )
}

export const instant = false


