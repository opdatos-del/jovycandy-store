"use client"

import Link from "next/link"
import { useMemo, useRef, useState } from "react"

import type { CmsCategory, CmsProduct } from "@/lib/cms/client"
import type { Dictionary, Locale } from "@/lib/i18n"
import type { CardHoverConfig } from "@/lib/medusa/store"
import { CatalogCard, type ViewableProduct } from "./product-card"

type CatalogPageProps = {
  locale: Locale
  dictionary: Dictionary
  products: CmsProduct[]
  categories: CmsCategory[]
  categoryCounts: Record<string, number>
  totalProducts: number
  prices: Record<string, { amount: number; currencyCode: string } | null>
  hoverConfigs: Record<string, CardHoverConfig>
  selectedCategoryKey?: string
  selectedCategoryName?: string | null
  selectedCategoryDescription?: string | null
}

type ModeFilter = "ALL" | CmsProduct["commercialMode"]
type SortOption = "featured" | "name-asc" | "name-desc" | "newest"

type Filters = {
  query: string
  family: string
  gramaje: string
  certification: string
  mode: ModeFilter
  onlyNew: boolean
  sort: SortOption
}

const initialFilters: Filters = {
  query: "",
  family: "",
  gramaje: "",
  certification: "",
  mode: "ALL",
  onlyNew: false,
  sort: "featured",
}

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()

const unique = (values: Array<string | null | undefined>) =>
  [...new Set(values.filter((value): value is string => Boolean(value)))].sort((a, b) =>
    a.localeCompare(b, "es"),
  )

function matchesFilters(
  product: CmsProduct,
  filters: Filters,
  skip?: "family" | "gramaje" | "certification" | "mode",
  categoryName?: string | null,
) {
  if (filters.query) {
    const haystack = normalize(
      [
        product.title,
        product.family?.name,
        product.gramaje,
        ...product.certifications,
        ...product.categoryKeys,
        categoryName,
      ]
        .filter(Boolean)
        .join(" "),
    )
    if (!haystack.includes(normalize(filters.query))) return false
  }
  if (skip !== "family" && filters.family && product.family?.name !== filters.family) return false
  if (skip !== "gramaje" && filters.gramaje && product.gramaje !== filters.gramaje) return false
  if (
    skip !== "certification" &&
    filters.certification &&
    !product.certifications.includes(filters.certification)
  ) {
    return false
  }
  if (skip !== "mode" && filters.mode !== "ALL" && product.commercialMode !== filters.mode) {
    return false
  }
  if (filters.onlyNew && !product.isNew) return false
  return true
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
      <path d="m16.5 16.5 4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export function CatalogPage({
  locale,
  dictionary,
  products,
  categories,
  categoryCounts,
  totalProducts,
  prices,
  hoverConfigs,
  selectedCategoryKey,
  selectedCategoryName,
  selectedCategoryDescription,
}: CatalogPageProps) {
  const [filters, setFilters] = useState<Filters>(initialFilters)
  const [filtersVisible, setFiltersVisible] = useState(true)
  const filterDialogRef = useRef<HTMLDialogElement>(null)

  const heading = selectedCategoryName ?? dictionary.catalog.catalogHeadline
  const lead = selectedCategoryDescription ?? dictionary.catalog.catalogLead
  const categoryName = selectedCategoryName ?? null

  const filtered = useMemo(
    () =>
      products
        .filter((product): product is ViewableProduct => Boolean(product.handle))
        .filter((product) => matchesFilters(product, filters, undefined, categoryName)),
    [products, filters, categoryName],
  )

  const visibleProducts = useMemo(() => {
    const items = [...filtered]
    if (filters.sort === "name-asc") {
      items.sort((a, b) => a.title.localeCompare(b.title, locale))
    } else if (filters.sort === "name-desc") {
      items.sort((a, b) => b.title.localeCompare(a.title, locale))
    } else if (filters.sort === "newest") {
      items.sort((a, b) => Number(b.isNew) - Number(a.isNew))
    }
    return items
  }, [filtered, filters.sort, locale])

  const familyOptions = useMemo(
    () =>
      unique(products.map((product) => product.family?.name)).map((family) => ({
        value: family,
        label: family,
        count: products.filter(
          (product) => matchesFilters(product, filters, "family", categoryName) && product.family?.name === family,
        ).length,
      })),
    [products, filters, categoryName],
  )

  const gramajeOptions = useMemo(
    () =>
      unique(products.map((product) => product.gramaje)).map((gramaje) => ({
        value: gramaje,
        label: gramaje,
        count: products.filter(
          (product) => matchesFilters(product, filters, "gramaje", categoryName) && product.gramaje === gramaje,
        ).length,
      })),
    [products, filters, categoryName],
  )

  const certificationOptions = useMemo(
    () =>
      unique(products.flatMap((product) => product.certifications)).map((certification) => ({
        value: certification,
        label: certification,
        count: products.filter(
          (product) =>
            matchesFilters(product, filters, "certification", categoryName) &&
            product.certifications.includes(certification),
        ).length,
      })),
    [products, filters, categoryName],
  )

  const modeCounts = useMemo(
    () => ({
      SELLABLE: products.filter(
        (product) =>
          matchesFilters(product, filters, "mode", categoryName) && product.commercialMode === "SELLABLE",
      ).length,
      CATALOG_ONLY: products.filter(
        (product) =>
          matchesFilters(product, filters, "mode", categoryName) &&
          product.commercialMode === "CATALOG_ONLY",
      ).length,
    }),
    [products, filters, categoryName],
  )

  const activeFilters = [
    filters.query,
    filters.family,
    filters.gramaje,
    filters.certification,
    filters.mode === "ALL" ? "" : filters.mode,
    filters.onlyNew ? "new" : "",
  ].filter(Boolean)

  const hasActiveFilters = activeFilters.length > 0

  const updateFilter = <Key extends keyof Filters>(key: Key, value: Filters[Key]) => {
    setFilters((current) => ({ ...current, [key]: value }))
  }

  const resetFilters = () => setFilters(initialFilters)

  const productLabel =
    visibleProducts.length === 1
      ? locale === "es"
        ? "1 producto"
        : "1 product"
      : locale === "es"
        ? `${visibleProducts.length} productos`
        : `${visibleProducts.length} products`

  const renderField = (
    key: "family" | "gramaje" | "certification",
    label: string,
    options: Array<{ value: string; label: string; count: number }>,
  ) => (
    <label className="catalog-field">
      <span>{label}</span>
      <select
        value={filters[key]}
        onChange={(event) => updateFilter(key, event.target.value)}
      >
        <option value="">{dictionary.catalog.all}</option>
        {options.map((option) => (
          <option
            key={option.value}
            value={option.value}
            disabled={option.count === 0 && filters[key] !== option.value}
          >
            {option.label} ({option.count})
          </option>
        ))}
      </select>
    </label>
  )

  const renderFilters = () => (
    <div className="catalog-filter-fields catalog-filter-fields--compact">
      <p className="catalog-filter-fields__hint">{dictionary.catalog.filterHint}</p>
      <div className="catalog-category-filter">
        <p className="catalog-category-filter__label">{dictionary.catalog.category}</p>
        <ul className="catalog-category-list">
          <li>
            <Link
              href={`/${locale}/catalogo`}
              aria-current={!selectedCategoryKey ? "page" : undefined}
            >
              <span>{dictionary.catalog.allCategories}</span>
              <span>{totalProducts}</span>
            </Link>
          </li>
          {categories.map((category) => (
            <li key={category.key}>
              <Link
                href={`/${locale}/catalogo?categoria=${encodeURIComponent(category.key)}`}
                aria-current={selectedCategoryKey === category.key ? "page" : undefined}
              >
                <span>{category.name}</span>
                <span>{categoryCounts[category.key] ?? 0}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
      {renderField("family", dictionary.catalog.family, familyOptions)}
      {renderField("gramaje", dictionary.catalog.weight, gramajeOptions)}
      {renderField("certification", dictionary.catalog.certification, certificationOptions)}
      <label className="catalog-field">
        <span>{dictionary.catalog.commercialMode}</span>
        <select
          value={filters.mode}
          onChange={(event) => updateFilter("mode", event.target.value as ModeFilter)}
        >
          <option value="ALL">{dictionary.catalog.all}</option>
          <option value="SELLABLE">{dictionary.catalog.modeSellable} ({modeCounts.SELLABLE})</option>
          <option value="CATALOG_ONLY">
            {dictionary.catalog.modeCatalogOnly} ({modeCounts.CATALOG_ONLY})
          </option>
        </select>
      </label>
      <label className="catalog-check">
        <input
          type="checkbox"
          checked={filters.onlyNew}
          onChange={(event) => updateFilter("onlyNew", event.target.checked)}
        />
        <span>{dictionary.catalog.onlyNew}</span>
      </label>
    </div>
  )

  return (
    <main className="catalog jovy-catalog pt-28 pb-16 sm:pt-32">
      <header className="catalog-heading">
        <nav aria-label="Breadcrumb" className="catalog-breadcrumb">
          <Link href={`/${locale}`}>{dictionary.nav.home}</Link>
          <span>/</span>
          <Link href={`/${locale}/catalogo`}>{dictionary.catalog.catalogBreadcrumb}</Link>
          {categoryName ? (
            <>
              <span>/</span>
              <span>{categoryName}</span>
            </>
          ) : null}
        </nav>
        <p className="catalog-eyebrow">{dictionary.catalog.catalogEyebrow}</p>
        <h1>{heading}</h1>
        <p>{lead}</p>
      </header>

      <section className="catalog-shop" aria-label={dictionary.catalog.title}>
        <div className="catalog-toolbar">
          <button
            type="button"
            className="catalog-filter-toggle"
            aria-label={
              filtersVisible ? dictionary.catalog.hideFilters : dictionary.catalog.showFilters
            }
            aria-expanded={filtersVisible}
            aria-controls="catalog-filter-sidebar"
            onClick={() => setFiltersVisible((visible) => !visible)}
          >
            {filtersVisible ? dictionary.catalog.hideFilters : dictionary.catalog.showFilters}
          </button>
          <button
            type="button"
            className="catalog-filter-mobile"
            aria-label={`${dictionary.catalog.filtersButton}${activeFilters.length ? ` (${activeFilters.length})` : ""}`}
            onClick={() => filterDialogRef.current?.showModal()}
          >
            {dictionary.catalog.filtersButton}
            {activeFilters.length ? ` (${activeFilters.length})` : ""}
          </button>
          <p className="catalog-count" aria-live="polite">
            {productLabel}
          </p>
          <label className="catalog-search">
            <span className="sr-only">{dictionary.catalog.searchPlaceholder}</span>
            <SearchIcon />
            <input
              type="search"
              value={filters.query}
              onChange={(event) => updateFilter("query", event.target.value)}
              placeholder={dictionary.catalog.searchPlaceholder}
            />
          </label>
          <label className="catalog-sort">
            <span>{dictionary.catalog.sortBy}</span>
            <select
              value={filters.sort}
              onChange={(event) => updateFilter("sort", event.target.value as SortOption)}
            >
              <option value="featured">{dictionary.catalog.sortFeatured}</option>
              <option value="name-asc">{dictionary.catalog.sortNameAsc}</option>
              <option value="name-desc">{dictionary.catalog.sortNameDesc}</option>
              <option value="newest">{dictionary.catalog.sortNewest}</option>
            </select>
          </label>
        </div>

        {hasActiveFilters ? (
          <div className="catalog-active-filters">
            <span className="catalog-active-filters__label">{dictionary.catalog.activeFilters}</span>
            <ul>
              {filters.query ? (
                <li>
                  <button
                    type="button"
                    aria-label={`${dictionary.catalog.clearFilters}: ${filters.query}`}
                    onClick={() => updateFilter("query", "")}
                  >
                    “{filters.query}”<span aria-hidden="true">×</span>
                  </button>
                </li>
              ) : null}
              {filters.family ? (
                <li>
                  <button type="button" onClick={() => updateFilter("family", "")}>
                    {filters.family}
                    <span aria-hidden="true">×</span>
                  </button>
                </li>
              ) : null}
              {filters.gramaje ? (
                <li>
                  <button type="button" onClick={() => updateFilter("gramaje", "")}>
                    {filters.gramaje}
                    <span aria-hidden="true">×</span>
                  </button>
                </li>
              ) : null}
              {filters.certification ? (
                <li>
                  <button type="button" onClick={() => updateFilter("certification", "")}>
                    {filters.certification}
                    <span aria-hidden="true">×</span>
                  </button>
                </li>
              ) : null}
              {filters.mode !== "ALL" ? (
                <li>
                  <button type="button" onClick={() => updateFilter("mode", "ALL")}>
                    {filters.mode === "SELLABLE"
                      ? dictionary.catalog.modeSellable
                      : dictionary.catalog.modeCatalogOnly}
                    <span aria-hidden="true">×</span>
                  </button>
                </li>
              ) : null}
              {filters.onlyNew ? (
                <li>
                  <button type="button" onClick={() => updateFilter("onlyNew", false)}>
                    {dictionary.catalog.onlyNew}
                    <span aria-hidden="true">×</span>
                  </button>
                </li>
              ) : null}
            </ul>
            <button type="button" className="catalog-active-filters__reset" onClick={resetFilters}>
              {dictionary.catalog.clearFilters}
            </button>
          </div>
        ) : null}

        <div className={`catalog-layout ${filtersVisible ? "" : "catalog-layout--wide"}`}>
          <aside
            id="catalog-filter-sidebar"
            className="catalog-sidebar"
            aria-labelledby="catalog-filter-title"
            hidden={!filtersVisible}
          >
            <div className="catalog-sidebar__heading">
              <h2 id="catalog-filter-title">{dictionary.catalog.filters}</h2>
              {hasActiveFilters ? (
                <button type="button" onClick={resetFilters}>
                  {dictionary.catalog.clearFilters}
                </button>
              ) : null}
            </div>
            {renderFilters()}
          </aside>

          <div className="catalog-results">
            {visibleProducts.length ? (
              <div className="catalog-grid">
                {visibleProducts.map((product, index) => (
                  <CatalogCard
                    key={product.id}
                    product={product}
                    locale={locale}
                    dictionary={dictionary}
                    fallbackFamily={categoryName}
                    price={prices[product.handle] ?? null}
                    hover={hoverConfigs[product.handle] ?? null}
                    priority={index < 5}
                  />
                ))}
              </div>
            ) : (
              <div className="catalog-empty">
                <h2>{dictionary.catalog.noResultsTitle}</h2>
                <p>{dictionary.catalog.noResults}</p>
                <Link
                  className="catalog-primary-button"
                  href={`/${locale}/catalogo`}
                  onClick={resetFilters}
                >
                  {dictionary.catalog.clearAll}
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>

      <dialog
        ref={filterDialogRef}
        className="catalog-filter-dialog"
        aria-labelledby="catalog-filter-dialog-title"
        closedby="any"
      >
        <form method="dialog" className="catalog-filter-dialog__heading">
          <h2 id="catalog-filter-dialog-title">{dictionary.catalog.filters}</h2>
          <button type="submit" aria-label={dictionary.catalog.closeFilters}>
            ×
          </button>
        </form>
        {renderFilters()}
        <div className="catalog-filter-dialog__actions">
          <button type="button" className="catalog-text-button" onClick={resetFilters}>
            {dictionary.catalog.clearFilters}
          </button>
          <form method="dialog">
            <button type="submit" className="catalog-primary-button">
              {dictionary.catalog.showResults} {visibleProducts.length}{" "}
              {locale === "es"
                ? visibleProducts.length === 1
                  ? "producto"
                  : "productos"
                : visibleProducts.length === 1
                  ? "product"
                  : "products"}
            </button>
          </form>
        </div>
      </dialog>
    </main>
  )
}
