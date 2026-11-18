import { Badge, Heading, Text } from "@medusajs/ui"
import { toStorefrontCategories, type CatalogueCategory } from "./catalogue-types"

/**
 * El Admin no llama a la Store: replica la regla del endpoint público con los
 * datos ya cargados para que la vista previa no dependa de una API key.
 */
export const CatalogueStorefrontPreview = ({ categories }: { categories: CatalogueCategory[] }) => {
  const visible = toStorefrontCategories(categories)
  const hidden = categories.length - visible.length

  return (
    <div data-testid="catalogue-storefront-preview" className="flex flex-col gap-y-3">
      <div>
        <Heading level="h2">Vista previa del storefront</Heading>
        <Text size="small" className="text-ui-fg-subtle mt-1">
          Estado que devolverá <code className="font-mono">GET /store/jovy/catalogue/categories</code>. Solo se
          publican tarjetas activas y la bandera editorial <code className="font-mono">active</code> nunca viaja al
          navegador.
        </Text>
      </div>

      {visible.length === 0 ? (
        <Text size="small" role="status" className="text-ui-fg-subtle">
          Ninguna tarjeta se publicará: todas están ocultas o todavía no existen.
        </Text>
      ) : (
        <ul className="flex flex-col gap-y-2" aria-label="Tarjetas visibles en el storefront">
          {visible.map((category, index) => (
            <li
              key={category.id}
              className="border-ui-border-base flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span className="text-ui-fg-muted text-xs tabular-nums">{index + 1}</span>
                <span className="text-sm font-medium">{category.name}</span>
                <span className="text-ui-fg-subtle font-mono text-xs">{category.key}</span>
              </div>
              <div className="flex flex-wrap items-center gap-1">
                {category.coming_soon && <Badge color="orange">Próximamente</Badge>}
                {category.interaction_locked && <Badge color="red">Bloqueada</Badge>}
                {!category.medusa_category_id && <Badge color="grey">Sin categoría comercial</Badge>}
              </div>
            </li>
          ))}
        </ul>
      )}

      <Text size="xsmall" className="text-ui-fg-subtle">
        {hidden === 0
          ? "Las seis tarjetas se publican actualmente."
          : `${hidden} ${hidden === 1 ? "tarjeta oculta" : "tarjetas ocultas"} por la bandera «Activa».`}
      </Text>

      <details className="border-ui-border-base rounded-md border">
        <summary className="cursor-pointer px-3 py-2 text-sm font-medium">Ver JSON exacto de la respuesta</summary>
        <pre
          className="jovy-scroll border-ui-border-base max-h-80 overflow-auto border-t p-3 font-mono text-xs"
          role="region"
          tabIndex={0}
          aria-label="Respuesta JSON del catálogo, desplazable horizontalmente"
        >
          {JSON.stringify({ categories: visible }, null, 2)}
        </pre>
      </details>
    </div>
  )
}
