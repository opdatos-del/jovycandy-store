"use client"

import Link from "next/link"
import { useMemo, useState } from "react"

import type { CmsCategory, CmsProduct } from "@/lib/cms/client"
import { responsiveSrcSet } from "@/lib/images"
import type { Dictionary, Locale } from "@/lib/i18n"

type CategoryExplorerProps = {
  locale: Locale
  dictionary: Dictionary
  categories: CmsCategory[]
  products: CmsProduct[]
  fallbackProducts: CmsProduct[]
}

const TITLE_OVERRIDES: Record<string, string> = {
  sazonador: "Sazonadores",
  chamoy: "Grenetina Chamoy",
  gomitas_almidon: "Almidón Chamoy",
  dulces_paletas: "Caramelos y Paletas",
  pinatero: "Piñateros",
  gomitas_grenetina: "Gomitas Grenetina",
}

export function CategoryExplorer({ locale, dictionary, categories, products, fallbackProducts }: CategoryExplorerProps) {
  const available = categories.filter((category) => category.active)
  const [selected, setSelected] = useState<string | null>(null)

  const activeCategory = selected ? available.find((category) => category.key === selected) ?? null : null
  const activeProducts = useMemo(() => {
    if (!selected) return []
    const byCategory = products.filter((product) => product.categoryKeys.includes(selected))
    if (byCategory.length) return byCategory
    const fallbackByCategory = fallbackProducts.filter((product) => product.categoryKeys.includes(selected))
    return fallbackByCategory.length ? fallbackByCategory : fallbackProducts
  }, [products, fallbackProducts, selected])

  const top = available.slice(0, 3)
  const bottom = available.slice(3, 6)

  const card = (category: CmsCategory) => {
    const disabled = category.comingSoon || category.interactionLocked
    const isActive = selected === category.key
    return (
      <button
        key={category.key}
        type="button"
        data-category-id={category.key}
        aria-pressed={isActive}
        disabled={disabled}
        onClick={() => setSelected((current) => (current === category.key ? null : category.key))}
        className={`category-card group relative w-full overflow-hidden transition-all ${
          disabled ? "cursor-default opacity-900" : "cursor-pointer"
        } ${isActive ? "ring-2 ring-[#0d3b6e]/60 ring-inset" : ""}`}
        style={{ backgroundColor: category.accent }}
      >
        {category.hoverImage ? (
          <img src={category.hoverImage} alt="" aria-hidden="true" className="absolute inset-0 z-0 h-full w-full object-cover" width={719} height={480} loading="lazy" fetchPriority="low" />
        ) : null}
        <div className="pointer-events-none absolute inset-0 z-10" style={{ backgroundColor: category.accent, opacity: 0.42 }} />
        <div className="pointer-events-none absolute inset-0 z-20 bg-gradient-to-t from-black/25 to-transparent" />
        <div className="category-card-content relative z-30 flex h-full flex-col items-center justify-center">
          {category.image ? <img src={category.image} alt="" aria-hidden="true" className="max-h-[45%] w-auto object-contain drop-shadow-[0_12px_22px_rgba(0,0,0,0.18)]" width={400} height={400} loading="lazy" fetchPriority="low" /> : null}
          <h3 className="category-card-title text-center font-semibold text-white">{TITLE_OVERRIDES[category.key] ?? category.name}</h3>
          {disabled ? (
            <span className="mt-3 rounded-full border border-white/25 bg-black/15 px-4 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-white/90 backdrop-blur-sm">
              {dictionary.catalog.comingSoon}
            </span>
          ) : null}
        </div>
      </button>
    )
  }

  return (
    <section id="tienda" className="category-grid-section relative z-10 flex flex-col bg-white pb-0 text-stone-900">
      <div className="flex w-full flex-grow flex-col">
        <div className="category-grid-heading flex justify-center">
          <h2 className="category-grid-title font-mono text-xs uppercase text-stone-600 sm:text-sm lg:text-base xl:text-lg">
            {dictionary.catalog.title}
          </h2>
        </div>

        <div className="category-grid-shell bg-stone-200/90">
          <div className="grid grid-cols-2 gap-px bg-stone-200 sm:grid-cols-3">
            {top.map(card)}
          </div>

          {activeCategory ? (
            <div className="catalog-carousel-shell border-y border-stone-200 bg-[#fffaf0]">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[0.65rem] font-bold uppercase tracking-[0.24em] text-stone-500">{TITLE_OVERRIDES[activeCategory.key] ?? activeCategory.name}</p>
                  <h3 className="catalog-carousel-title text-2xl font-semibold text-stone-900">{dictionary.catalog.title}</h3>
                </div>
                <Link href={`/${locale}/catalogo?categoria=${activeCategory.key}`} className="rounded-full border border-[#0d3b6e]/20 px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-[#0d3b6e] transition hover:bg-white">
                  {dictionary.catalog.viewDetails}
                </Link>
              </div>

              <div className="mobile-scroll mt-5 grid gap-3 overflow-x-auto pb-2 sm:grid-cols-2 lg:grid-cols-4">
                {activeProducts.slice(0, 8).map((product) => (
                  <article key={product.id} className="catalog-carousel-item min-w-[13rem] rounded-xl border border-stone-200 bg-white p-3 shadow-sm sm:min-w-0">
                    <div className="relative aspect-square overflow-hidden rounded-lg bg-[#fff5d4]">
                      {product.thumbnail ? <img src={product.thumbnail.startsWith("/assets/catalog/products/") ? product.thumbnail.replace(/\.webp$/, "-640.webp") : product.thumbnail} srcSet={product.thumbnail.startsWith("/assets/catalog/products/") ? responsiveSrcSet(product.thumbnail, [400, 640]) : undefined} sizes="(max-width: 640px) 40vw, 200px" alt={product.title} className="h-full w-full object-contain p-2" width={640} height={640} loading="lazy" /> : null}
                      {product.isNew ? <span className="absolute left-2 top-2 rounded-full bg-[#b4234a] px-2.5 py-1 text-[0.55rem] font-bold uppercase tracking-[0.16em] text-white">Nuevo</span> : null}
                    </div>
                    <h4 className="catalog-carousel-name mt-3 line-clamp-2 text-sm font-bold text-stone-900">{product.title}</h4>
                    <p className="catalog-carousel-spec mt-1 text-xs text-stone-500">{product.gramaje ?? product.family?.name ?? ""}</p>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[0.55rem] font-bold uppercase tracking-[0.12em] ${product.commercialMode === "SELLABLE" ? "bg-[#00afaa]/15 text-[#007d79]" : "bg-stone-100 text-stone-500"}`}>
                        {product.commercialMode === "SELLABLE" ? "Compra" : "CatÃ¡logo"}
                      </span>
                      {product.handle ? (
                        <Link href={`/${locale}/productos/${product.handle}`} className="text-[0.65rem] font-bold uppercase tracking-[0.12em] text-[#0d3b6e] underline-offset-2 hover:underline">
                          {dictionary.catalog.viewDetails}
                        </Link>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-px bg-stone-200 sm:grid-cols-3">
            {bottom.map(card)}
          </div>
        </div>
      </div>
    </section>
  )
}
