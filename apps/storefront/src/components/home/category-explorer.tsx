"use client"

import Link from "next/link"
import { Fragment, useMemo, useRef, useState } from "react"

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

const DISPLAY_ORDER = [
  "sazonador",
  "chamoy",
  "gomitas_almidon",
  "dulces_paletas",
  "pinatero",
  "gomitas_grenetina",
] as const

const TITLE_OVERRIDES: Record<string, string> = {
  sazonador: "Sazonadores",
  chamoy: "Grenetina Chamoy",
  gomitas_almidon: "Almidón Chamoy",
  dulces_paletas: "Caramelos y Paletas",
  pinatero: "Piñateros",
  gomitas_grenetina: "Gomitas Grenetina",
}

const PRODUCT_IMAGE_PREFIX = "/assets/catalog/products/"

function productImage(image: string | null) {
  if (!image) return null
  if (!image.startsWith(PRODUCT_IMAGE_PREFIX)) return image
  return image.replace(/\.webp$/, "-640.webp")
}

function displayTitle(category: CmsCategory) {
  return TITLE_OVERRIDES[category.key] ?? category.name
}

function parseGrams(label: string) {
  const match = label.match(/(\d+(?:[.,]\d+)?)\s*(kg|g)?/i)
  if (!match) return 0
  const value = Number.parseFloat(match[1].replace(",", "."))
  return match[2]?.toLowerCase() === "kg" ? value * 1000 : value
}

type CategoryCardProps = {
  category: CmsCategory
  title: string
  active: boolean
  comingSoonLabel: string
  onSelect: () => void
}

function CategoryCard({ category, title, active, comingSoonLabel, onSelect }: CategoryCardProps) {
  const [hovered, setHovered] = useState(false)
  const disabled = category.comingSoon || category.interactionLocked

  return (
    <button
      type="button"
      data-category-id={category.key}
      aria-pressed={active}
      disabled={disabled}
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`category-card group relative w-full overflow-hidden text-left transition-all ${
        disabled ? "cursor-default opacity-80" : "cursor-pointer"
      } ${active ? "ring-2 ring-inset ring-white/65" : ""}`}
      style={{ backgroundColor: category.accent }}
    >
      <span className="absolute inset-0 z-0 block" aria-hidden="true">
        {category.image ? (
          <img
            src={category.image}
            alt=""
            className={`absolute inset-0 h-full w-full scale-[0.84] object-contain transition-opacity duration-500 ${hovered ? "opacity-0" : "opacity-100"}`}
            width={400}
            height={400}
            loading="lazy"
            decoding="async"
            draggable={false}
          />
        ) : null}
        {category.hoverImage ? (
          <img
            src={category.hoverImage}
            alt=""
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${hovered ? "opacity-100" : "opacity-0"}`}
            width={719}
            height={480}
            loading="lazy"
            decoding="async"
            draggable={false}
          />
        ) : null}
      </span>

      <span className="pointer-events-none absolute inset-0 z-10" style={{ backgroundColor: category.accent, opacity: 0.42 }} />
      <span className="pointer-events-none absolute inset-0 z-20 bg-gradient-to-t from-black/22 to-transparent" />

      <span className="category-card-content relative z-30 flex h-full flex-col items-center justify-center">
        <span className="category-card-title text-center font-semibold text-white">{title}</span>
        {disabled ? (
          <span className="mt-3 rounded-full border border-white/25 bg-black/15 px-4 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-white/90 backdrop-blur-sm">
            {comingSoonLabel}
          </span>
        ) : null}
      </span>
    </button>
  )
}

type ProductPanelProps = {
  category: CmsCategory
  title: string
  products: CmsProduct[]
  locale: Locale
}

function ProductPanel({ category, title, products, locale }: ProductPanelProps) {
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const [gramaje, setGramaje] = useState<string | null>(null)

  const gramajes = useMemo(() => {
    const unique = new Map<string, string>()
    products.forEach((product) => {
      const label = product.gramaje?.trim()
      if (!label || unique.has(label.toLowerCase())) return
      unique.set(label.toLowerCase(), label)
    })
    return Array.from(unique.values()).sort((left, right) => parseGrams(right) - parseGrams(left))
  }, [products])

  const filtered = useMemo(
    () => (gramaje ? products.filter((product) => product.gramaje?.trim().toLowerCase() === gramaje) : products),
    [products, gramaje],
  )

  const scrollByPage = (direction: number) => {
    const scroller = scrollerRef.current
    if (!scroller) return
    scroller.scrollBy({ left: direction * scroller.clientWidth * 0.8, behavior: "smooth" })
  }

  return (
    <div className="catalog-carousel-shell relative text-white" style={{ backgroundColor: category.accent }}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_42%,rgba(255,255,255,0.12),transparent_40%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/35" />

      <div className="relative">
        <h3 className="catalog-carousel-title text-sm font-semibold uppercase text-white/90 sm:text-base">{title}</h3>

        <div className="catalog-carousel-layout grid grid-cols-1 items-center gap-0 md:grid-cols-[auto_1fr] md:gap-6">
          <div className="catalog-carousel-logo-column flex items-center justify-center pb-4 md:pb-0">
            {category.image ? (
              <div className="catalog-carousel-logo-frame catalog-carousel-logo-frame--desktop">
                <div className="catalog-carousel-logo-slot catalog-carousel-logo-slot--desktop">
                  <img
                    src={category.image}
                    alt=""
                    className="catalog-carousel-logo catalog-carousel-logo--desktop object-contain"
                    width={400}
                    height={400}
                    loading="lazy"
                    decoding="async"
                    draggable={false}
                  />
                </div>
              </div>
            ) : null}
          </div>

          <div className="flex min-w-0 flex-col gap-4 overflow-hidden">
            {gramajes.length > 0 ? (
              <div className="catalog-carousel-filters flex flex-col">
                <div className="flex flex-col gap-2">
                  <span className="catalog-carousel-filter-label text-xs font-semibold uppercase tracking-wider text-white/80">Gramaje</span>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setGramaje(null)}
                      className={`catalog-carousel-filter-chip rounded-full text-xs font-semibold tracking-wider transition-all ${
                        gramaje === null ? "bg-white text-black" : "bg-white/15 text-white/90 hover:bg-white/25"
                      }`}
                    >
                      Todos
                    </button>
                    {gramajes.map((label) => (
                      <button
                        key={label}
                        type="button"
                        onClick={() => setGramaje(label.toLowerCase())}
                        className={`catalog-carousel-filter-chip rounded-full text-xs font-semibold tracking-wider transition-all ${
                          gramaje === label.toLowerCase() ? "bg-white text-black" : "bg-white/15 text-white/90 hover:bg-white/25"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

            <div className="relative">
              <button
                type="button"
                onClick={() => scrollByPage(-1)}
                aria-label="Producto anterior"
                className="catalog-carousel-nav-button absolute left-0 top-1/2 z-10 flex -translate-y-1/2 items-center justify-center rounded-full bg-gradient-to-r from-white/50 to-white/30 p-3 text-white shadow-md backdrop-blur-md transition-all hover:left-1 hover:from-white/65 hover:to-white/40 sm:p-4"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true" className="h-5 w-5 sm:h-6 sm:w-6">
                  <path d="m15 5-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              <div ref={scrollerRef} className="catalog-carousel-scroller flex cursor-grab overflow-x-auto overflow-y-visible pb-2 pt-6">
                {filtered.length > 0 ? (
                  filtered.map((product) => {
                    const image = productImage(product.thumbnail)
                    const href = product.handle ? `/${locale}/productos/${product.handle}` : `/${locale}/catalogo?categoria=${category.key}`
                    return (
                      <Link
                        key={product.id}
                        href={href}
                        className="catalog-carousel-item flex shrink-0 flex-col items-center text-center transition-transform duration-200 hover:-translate-y-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                      >
                        <span className="relative block w-full">
                          {product.isNew ? (
                            <span className="absolute left-0 top-0 z-10 rounded-full bg-white px-2.5 py-1 text-[0.55rem] font-black uppercase tracking-[0.16em] text-[#b4234a] shadow-sm">
                              Nuevo
                            </span>
                          ) : null}
                          {image ? (
                            <img
                              src={image}
                              srcSet={product.thumbnail?.startsWith(PRODUCT_IMAGE_PREFIX) ? responsiveSrcSet(product.thumbnail, [400, 640]) : undefined}
                              sizes="(max-width: 640px) 58vw, (max-width: 1024px) 32vw, 220px"
                              alt={product.title}
                              className="catalog-carousel-image w-full object-contain"
                              width={640}
                              height={640}
                              loading="lazy"
                              decoding="async"
                              draggable={false}
                            />
                          ) : null}
                        </span>
                        <span className="catalog-carousel-name mt-2 font-semibold uppercase">{product.title}</span>
                        {product.gramaje ? (
                          <span className="catalog-carousel-spec mt-1 text-xs font-semibold tracking-[0.22em] text-white/72">{product.gramaje}</span>
                        ) : null}
                      </Link>
                    )
                  })
                ) : (
                  <p className="flex w-full items-center justify-center py-8 text-white/70">No hay productos disponibles.</p>
                )}
              </div>

              <button
                type="button"
                onClick={() => scrollByPage(1)}
                aria-label="Producto siguiente"
                className="catalog-carousel-nav-button absolute right-0 top-1/2 z-10 flex -translate-y-1/2 items-center justify-center rounded-full bg-gradient-to-l from-white/50 to-white/30 p-3 text-white shadow-md backdrop-blur-md transition-all hover:right-1 hover:from-white/65 hover:to-white/40 sm:p-4"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true" className="h-5 w-5 sm:h-6 sm:w-6">
                  <path d="m9 5 7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function CategoryExplorer({ locale, dictionary, categories, products, fallbackProducts }: CategoryExplorerProps) {
  const available = useMemo(() => {
    const active = categories.filter((category) => category.active)
    return [...active].sort((left, right) => {
      const leftIndex = DISPLAY_ORDER.indexOf(left.key as (typeof DISPLAY_ORDER)[number])
      const rightIndex = DISPLAY_ORDER.indexOf(right.key as (typeof DISPLAY_ORDER)[number])
      return (leftIndex < 0 ? 99 : leftIndex) - (rightIndex < 0 ? 99 : rightIndex)
    })
  }, [categories])

  const [selected, setSelected] = useState<string | null>(null)
  const activeCategory = selected ? available.find((category) => category.key === selected) ?? null : null

  const productsFor = (key: string) => {
    const fromCms = products.filter((product) => product.categoryKeys.includes(key))
    if (fromCms.length) return fromCms
    return fallbackProducts.filter((product) => product.categoryKeys.includes(key))
  }

  const activeProducts = activeCategory ? productsFor(activeCategory.key) : []

  const renderCard = (category: CmsCategory) => (
    <CategoryCard
      key={category.key}
      category={category}
      title={displayTitle(category)}
      active={selected === category.key}
      comingSoonLabel={dictionary.catalog.comingSoon}
      onSelect={() => setSelected((current) => (current === category.key ? null : category.key))}
    />
  )

  const panel = activeCategory ? (
    <ProductPanel
      key={activeCategory.key}
      category={activeCategory}
      title={displayTitle(activeCategory)}
      products={activeProducts}
      locale={locale}
    />
  ) : null

  return (
    <section id="tienda" className="category-grid-section relative z-10 flex flex-col bg-white pb-0 text-stone-900">
      <div className="flex w-full flex-grow flex-col">
        <div className="category-grid-heading flex justify-center">
          <h2 className="category-grid-title font-mono text-xs uppercase text-stone-400 opacity-90 sm:text-sm lg:text-base xl:text-lg 2xl:text-xl">
            {dictionary.catalog.title}
          </h2>
        </div>

        <div className="category-grid-shell bg-stone-200/90">
          {/* Móvil y tablet: una sola retícula; el panel abre debajo de la tarjeta elegida. */}
          <div className="category-grid-row grid gap-px bg-stone-200 md:hidden">
            {available.map((category) => (
              <Fragment key={category.key}>
                {renderCard(category)}
                {selected === category.key ? <div className="col-span-full">{panel}</div> : null}
              </Fragment>
            ))}
          </div>

          {/* Escritorio: fila superior, panel y fila inferior, como el sitio original. */}
          <div className="hidden md:block">
            <div className="category-grid-row grid gap-px bg-stone-200">{available.slice(0, 3).map(renderCard)}</div>
            {panel}
            <div className="category-grid-row grid gap-px bg-stone-200">{available.slice(3, 6).map(renderCard)}</div>
          </div>
        </div>
      </div>
    </section>
  )
}
