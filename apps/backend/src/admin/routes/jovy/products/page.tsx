import { defineRouteConfig } from "@medusajs/admin-sdk"
import { ShoppingBag } from "@medusajs/icons"
import { Badge, Button, Container, Heading, Input, Text } from "@medusajs/ui"
import { useCallback, useEffect, useMemo, useState } from "react"
import { adminRequest, errorMessage } from "../components/admin-api"

/**
 * Inventario visual de fichas editoriales. Product Module sigue siendo dueño de
 * precio, SKU, variantes, inventario e imágenes comerciales; esta ruta solo
 * presenta y enlaza los atributos que el catálogo editorial añade.
 */
type EditorialProduct = {
  id: string
  product_id: string
  gramaje: string | null
  certifications: string[]
  sort_order: number
  is_new: boolean
  editorial_status: "draft" | "published" | "archived"
  product: { id: string; title: string; handle: string | null; thumbnail: string | null } | null
  product_missing: boolean
  family: { id: string; slug: string; name: string } | null
  category_keys: string[]
  publish_issues: string[]
}

type Category = { key: string; name: string }
type Family = { id: string; slug: string; name: string }

const STATUS_LABELS: Record<EditorialProduct["editorial_status"], string> = {
  draft: "Borrador",
  published: "Publicado",
  archived: "Archivado",
}

const STATUS_BADGE: Record<EditorialProduct["editorial_status"], "grey" | "green" | "orange"> = {
  draft: "grey",
  published: "green",
  archived: "orange",
}

const controlClass =
  "border-ui-border-base bg-ui-bg-field text-ui-fg-base focus-visible:ring-ui-border-interactive w-full rounded-md border px-2 py-1.5 text-sm outline-none focus-visible:ring-2"

const EditorialProductsPage = () => {
  const [products, setProducts] = useState<EditorialProduct[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [families, setFamilies] = useState<Family[]>([])
  const [query, setQuery] = useState("")
  const [categoryKey, setCategoryKey] = useState("")
  const [familyId, setFamilyId] = useState("")
  const [status, setStatus] = useState("")
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [filterError, setFilterError] = useState<string | null>(null)
  const [catalogueWarning, setCatalogueWarning] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setFilterError(null)

    const params = new URLSearchParams()
    if (categoryKey) params.set("category_key", categoryKey)
    if (familyId) params.set("family_id", familyId)
    if (status) params.set("status", status)

    try {
      const result = await adminRequest<{ products: EditorialProduct[] }>(
        `/admin/jovy/products/editorial${params.size ? `?${params.toString()}` : ""}`,
      )
      setProducts(result.products)
      setLoadError(null)
    } catch (error) {
      // Un filtro que quedó obsoleto no borra la última cuadrícula útil.
      setFilterError(errorMessage(error, "El filtro no es válido."))
    } finally {
      setLoading(false)
    }
  }, [categoryKey, familyId, status])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    void (async () => {
      const [categoryResult, familyResult] = await Promise.allSettled([
        adminRequest<{ categories: Category[] }>("/admin/jovy/catalogue/categories"),
        adminRequest<{ families: Family[] }>("/admin/jovy/catalogue/families"),
      ])

      if (categoryResult.status === "fulfilled") setCategories(categoryResult.value.categories)
      if (familyResult.status === "fulfilled") setFamilies(familyResult.value.families)
      if (categoryResult.status === "rejected" || familyResult.status === "rejected") {
        setCatalogueWarning("Algunas opciones de filtro no se pudieron cargar; puedes seguir buscando las fichas disponibles.")
      }
    })()
  }, [])

  const visibleProducts = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("es-MX")
    if (!normalized) return products
    return products.filter((item) => {
      const searchable = [
        item.product?.title,
        item.product?.handle,
        item.family?.name,
        item.gramaje,
        ...item.category_keys,
        ...item.certifications,
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("es-MX")
      return searchable.includes(normalized)
    })
  }, [products, query])

  const categoryName = (key: string) => categories.find((category) => category.key === key)?.name ?? key

  return (
    <div className="flex flex-col gap-y-4" data-testid="jovy-editorial-products-page">
      <Container className="p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-3xl">
            <Heading level="h1">Productos editoriales</Heading>
            <Text size="small" className="text-ui-fg-subtle mt-1">
              Catálogo visual para gramaje, certificaciones, orden, novedad y publicación. SKU, precio, inventario,
              variantes e imágenes comerciales siguen en el producto nativo de Medusa.
            </Text>
          </div>
          <Button size="small" variant="secondary" onClick={() => void load()} isLoading={loading}>
            Actualizar
          </Button>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-y-1 sm:col-span-2 lg:col-span-1">
            <label htmlFor="editorial-search" className="text-ui-fg-subtle text-xs font-medium">
              Buscar en fichas cargadas
            </label>
            <Input
              id="editorial-search"
              type="search"
              value={query}
              placeholder="Nombre, familia o certificación"
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-y-1">
            <label htmlFor="editorial-filter-category" className="text-ui-fg-subtle text-xs font-medium">
              Categoría de presentación
            </label>
            <select id="editorial-filter-category" className={controlClass} value={categoryKey} onChange={(event) => setCategoryKey(event.target.value)}>
              <option value="">Todas</option>
              {categories.map((category) => <option key={category.key} value={category.key}>{category.name}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-y-1">
            <label htmlFor="editorial-filter-family" className="text-ui-fg-subtle text-xs font-medium">
              Familia
            </label>
            <select id="editorial-filter-family" className={controlClass} value={familyId} onChange={(event) => setFamilyId(event.target.value)}>
              <option value="">Todas</option>
              {families.map((family) => <option key={family.id} value={family.id}>{family.name}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-y-1">
            <label htmlFor="editorial-filter-status" className="text-ui-fg-subtle text-xs font-medium">
              Estado editorial
            </label>
            <select id="editorial-filter-status" className={controlClass} value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">Todos</option>
              <option value="draft">Borrador</option>
              <option value="published">Publicado</option>
              <option value="archived">Archivado</option>
            </select>
          </div>
        </div>
        <Text size="xsmall" className="text-ui-fg-subtle mt-3" role="status">
          Carga completa: esta API devuelve todas las fichas que coinciden con los filtros del servidor, ordenadas por
          orden editorial. La búsqueda refina esas fichas en este navegador; no hay páginas ocultas.
        </Text>
        {loadError && <p role="alert" className="text-ui-fg-error mt-3 text-sm">{loadError}</p>}
        {filterError && <p role="alert" className="text-ui-fg-error mt-3 text-sm">{filterError}</p>}
        {catalogueWarning && <Text size="small" role="status" className="text-ui-fg-subtle mt-3">{catalogueWarning}</Text>}
      </Container>

      <Container className="p-4 sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <Heading level="h2">Fichas registradas</Heading>
          {!loading && <Text size="small" className="text-ui-fg-subtle">{visibleProducts.length} de {products.length}</Text>}
        </div>

        {loading && products.length === 0 ? (
          <Text className="text-ui-fg-subtle mt-4" role="status">Cargando productos editoriales…</Text>
        ) : visibleProducts.length === 0 ? (
          <div className="mt-4 flex flex-col gap-y-2">
            <Text size="small" className="text-ui-fg-subtle">
              {query.trim()
                ? "Ninguna ficha cargada coincide con la búsqueda."
                : categoryKey || familyId || status
                  ? "Ninguna ficha editorial coincide con los filtros seleccionados."
                  : "Todavía no hay fichas editoriales. Abre un producto comercial y guarda su ficha desde el detalle nativo."}
            </Text>
            <a href="/app/products" className="text-ui-fg-interactive w-fit text-sm underline">Ver productos comerciales</a>
          </div>
        ) : (
          <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5" aria-label="Fichas editoriales">
            {visibleProducts.map((item) => {
              const title = item.product?.title ?? item.product_id
              const editorialHref = `/app/products/${item.product_id}`
              return (
                <li key={item.id} data-testid={`editorial-product-${item.product_id}`} className="border-ui-border-base bg-ui-bg-base flex min-w-0 flex-col overflow-hidden rounded-lg border">
                  <div className="bg-ui-bg-subtle aspect-[4/3] overflow-hidden">
                    {item.product?.thumbnail ? (
                      <img src={item.product.thumbnail} alt={`Imagen de ${title}`} className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <div className="flex h-full items-center justify-center px-4 text-center"><Text size="xsmall" className="text-ui-fg-subtle">Sin imagen comercial</Text></div>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col gap-y-3 p-3">
                    <div className="min-w-0">
                      <Text weight="plus" className="line-clamp-2">{title}</Text>
                      <Text size="xsmall" className="text-ui-fg-subtle mt-1 line-clamp-1">{item.family?.name ?? "Sin familia"}</Text>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge color={STATUS_BADGE[item.editorial_status]}>{STATUS_LABELS[item.editorial_status]}</Badge>
                      {item.is_new && <Badge color="blue">Novedad</Badge>}
                      {item.product_missing && <Badge color="red">Comercial ausente</Badge>}
                    </div>
                    <div className="text-ui-fg-subtle flex flex-col gap-y-1 text-xs">
                      <span>Orden {item.sort_order} · {item.gramaje ?? "Sin gramaje"}</span>
                      <span className="line-clamp-2">{item.certifications.length ? item.certifications.join(" · ") : "Sin certificaciones"}</span>
                      <span className="line-clamp-2">{item.category_keys.length ? item.category_keys.map(categoryName).join(" · ") : "Sin categoría"}</span>
                    </div>
                    {item.publish_issues.length > 0 && <Text size="xsmall" className="text-ui-fg-error line-clamp-2">Para publicar: {item.publish_issues.join(", ")}.</Text>}
                    {item.product_missing ? (
                      <Text size="xsmall" className="text-ui-fg-error">No hay enlace porque el producto comercial ya no existe.</Text>
                    ) : (
                      <div className="mt-auto flex flex-wrap gap-x-3 gap-y-2 text-sm">
                        <a href={editorialHref} className="text-ui-fg-interactive font-medium underline" aria-label={`Editar ficha editorial de ${title}`}>Editar ficha</a>
                        <a href={editorialHref} className="text-ui-fg-interactive underline" aria-label={`Abrir producto comercial ${title}`}>Producto comercial</a>
                      </div>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Container>
    </div>
  )
}

export const config = defineRouteConfig({
  label: "Productos editoriales",
  icon: ShoppingBag,
  rank: 100,
})

export default EditorialProductsPage
