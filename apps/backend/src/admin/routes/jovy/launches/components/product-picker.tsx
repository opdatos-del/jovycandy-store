import { Button, Input, Text } from "@medusajs/ui"
import { useEffect, useState } from "react"
import type { ProductOption } from "./launch-types"
import { useDebouncedValue } from "./use-debounced-value"

type Props = {
  selected: ProductOption | null
  onSelect: (product: ProductOption | null) => void
  search: (query: string) => Promise<ProductOption[]>
}

/**
 * Buscador de productos publicados del catálogo comercial de Medusa. Solo guarda el id del producto:
 * SKU, precio, stock y variantes siguen siendo propiedad del Product Module.
 */
export const ProductPicker = ({ selected, onSelect, search }: Props) => {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<ProductOption[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const debouncedQuery = useDebouncedValue(query, 300)

  useEffect(() => {
    const term = debouncedQuery.trim()
    if (term.length < 2) {
      setResults([])
      setSearching(false)
      setSearchError(null)
      return
    }

    let active = true
    setSearching(true)
    search(term)
      .then((products) => {
        if (!active) return
        setResults(products)
        setSearchError(null)
      })
      .catch((error: unknown) => {
        if (!active) return
        setResults([])
        setSearchError(error instanceof Error ? error.message : "No se pudo buscar productos.")
      })
      .finally(() => {
        if (active) setSearching(false)
      })

    return () => {
      active = false
    }
  }, [debouncedQuery, search])

  return (
    <div className="flex flex-col gap-y-2">
      <label htmlFor="launch-product-search" className="text-ui-fg-subtle text-xs font-medium">
          Producto publicado de Medusa (buscador)
      </label>

      {selected ? (
        <div className="border-ui-border-base flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2">
          <div className="flex min-w-0 items-center gap-2">
            {selected.thumbnail ? (
              <img src={selected.thumbnail} alt="" className="h-8 w-8 rounded object-cover" />
            ) : null}
            <div className="min-w-0">
              <Text size="small" weight="plus" className="truncate">
                {selected.title}
              </Text>
              <Text size="xsmall" className="text-ui-fg-subtle font-mono">
                {selected.id}
              </Text>
            </div>
          </div>
          <Button type="button" size="small" variant="secondary" onClick={() => onSelect(null)}>
            Quitar producto
          </Button>
        </div>
      ) : (
        <Text size="small" className="text-ui-fg-subtle" role="status">
          Sin producto asociado.
        </Text>
      )}

      <Input
        id="launch-product-search"
        value={query}
        placeholder="Escribe al menos 2 caracteres del título"
        autoComplete="off"
        onChange={(event) => setQuery(event.target.value)}
      />

      {query.trim().length < 2 ? (
        <Text size="xsmall" className="text-ui-fg-subtle">
          Busca entre productos publicados. El lanzamiento necesita un producto o una imagen propia.
        </Text>
      ) : searching ? (
        <Text size="small" className="text-ui-fg-subtle" role="status">
          Buscando productos…
        </Text>
      ) : searchError ? (
        <Text size="small" role="alert" className="text-ui-fg-error">
          {searchError}
        </Text>
      ) : results.length === 0 ? (
        <Text size="small" className="text-ui-fg-subtle" role="status">
          Sin coincidencias para «{query.trim()}».
        </Text>
      ) : (
        <ul className="border-ui-border-base divide-ui-border-base max-h-56 divide-y overflow-auto rounded-md border">
          {results.map((product) => (
            <li key={product.id} className="flex items-center justify-between gap-2 px-3 py-2">
              <div className="flex min-w-0 items-center gap-2">
                {product.thumbnail ? (
                  <img src={product.thumbnail} alt="" className="h-8 w-8 rounded object-cover" />
                ) : null}
                <div className="min-w-0">
                  <Text size="small" className="truncate">
                    {product.title}
                  </Text>
                  <Text size="xsmall" className="text-ui-fg-subtle font-mono">
                    {product.id}
                  </Text>
                </div>
              </div>
              <Button
                type="button"
                size="small"
                variant="secondary"
                aria-label={`Seleccionar ${product.title}`}
                onClick={() => onSelect(product)}
              >
                Seleccionar
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
