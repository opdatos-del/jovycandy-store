import { Photo } from "@medusajs/icons"
import { Badge, Button, Heading, Text } from "@medusajs/ui"
import type { CatalogueCategory, CatalogueFamily, MedusaCategory } from "./catalogue-types"

type Props = {
  category: CatalogueCategory
  position: number
  total: number
  families: CatalogueFamily[]
  medusaCategories: MedusaCategory[]
  reordering: boolean
  onEdit: () => void
  onMove: (direction: -1 | 1) => void
}

type Accent = { card: string; marker: string; badge: "orange" | "red" | "blue" | "green" | "grey" }

const accentByKey: Record<string, Accent> = {
  sazonador: {
    card: "border-orange-200 bg-gradient-to-b from-orange-50 to-ui-bg-base",
    marker: "bg-orange-500",
    badge: "orange",
  },
  chamoy: {
    card: "border-rose-200 bg-gradient-to-b from-rose-50 to-ui-bg-base",
    marker: "bg-rose-500",
    badge: "red",
  },
  gomitas_almidon: {
    card: "border-yellow-200 bg-gradient-to-b from-yellow-50 to-ui-bg-base",
    marker: "bg-yellow-500",
    badge: "orange",
  },
  dulces_paletas: {
    card: "border-pink-200 bg-gradient-to-b from-pink-50 to-ui-bg-base",
    marker: "bg-pink-500",
    badge: "red",
  },
  pinatero: {
    card: "border-blue-200 bg-gradient-to-b from-blue-50 to-ui-bg-base",
    marker: "bg-blue-500",
    badge: "blue",
  },
  gomitas_grenetina: {
    card: "border-emerald-200 bg-gradient-to-b from-emerald-50 to-ui-bg-base",
    marker: "bg-emerald-500",
    badge: "green",
  },
}

const fallbackAccent: Accent = {
  card: "border-ui-border-base bg-ui-bg-base",
  marker: "bg-ui-tag-neutral-icon",
  badge: "grey",
}

const countLabel = (count: number) => `${count} ${count === 1 ? "producto" : "productos"}`

const CategoryStatus = ({ category }: { category: CatalogueCategory }) => {
  if (category.coming_soon) return <Badge color="orange">Próximamente</Badge>
  if (!category.active) return <Badge color="grey">Inactiva</Badge>
  return <Badge color="green">Activa</Badge>
}

export const CatalogueCategoryCard = ({
  category,
  position,
  total,
  families,
  medusaCategories,
  reordering,
  onEdit,
  onMove,
}: Props) => {
  const titleId = `catalogue-title-${category.key}`
  const accent = accentByKey[category.key] ?? fallbackAccent
  const linkedCategory = medusaCategories.find((item) => item.id === category.medusa_category_id)
  const productCount = families.reduce((count, family) => count + family.product_ids.length, 0)
  const access = category.coming_soon || category.interaction_locked ? "Bloqueado" : "Disponible"

  return (
    <article
      data-testid={`catalogue-card-${category.key}`}
      aria-labelledby={titleId}
      className={`flex min-w-0 flex-col overflow-hidden rounded-lg border shadow-elevation-card-rest ${accent.card}`}
    >
      <div className={`h-1.5 w-full ${accent.marker}`} aria-hidden />
      {category.image_resolved_url ? (
        <img src={category.image_resolved_url} alt={`Imagen de ${category.name}`} className="h-32 w-full object-cover" />
      ) : (
        <div className="bg-ui-bg-subtle text-ui-fg-muted flex h-32 items-center justify-center" aria-hidden>
          <Photo />
        </div>
      )}

      <div className="flex flex-1 flex-col gap-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-1 flex flex-wrap items-center gap-1">
              <Badge color={accent.badge}>{`#${position + 1}`}</Badge>
              <CategoryStatus category={category} />
            </div>
            <Heading level="h2" id={titleId} className="text-base">
              {category.name}
            </Heading>
          </div>
          <Button size="small" variant="secondary" aria-label={`Editar ${category.name}`} onClick={onEdit}>
            Editar
          </Button>
        </div>

        <Text size="small" leading="compact" className="text-ui-fg-subtle min-h-10">
          {category.description || "Sin descripción."}
        </Text>

        <div className="border-ui-border-base bg-ui-bg-base/75 grid grid-cols-2 gap-3 rounded-md border p-3">
          <div className="min-w-0">
            <Text size="xsmall" className="text-ui-fg-subtle uppercase">
              Clave
            </Text>
            <Text size="small" weight="plus" className="truncate font-mono">
              {category.key}
            </Text>
          </div>
          <div className="min-w-0 text-right">
            <Text size="xsmall" className="text-ui-fg-subtle uppercase">
              Acceso Store
            </Text>
            <Text size="small" weight="plus">
              {access}
            </Text>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <Text size="xsmall" className="text-ui-fg-subtle">
              Categoría comercial
            </Text>
            <Text size="small" className="truncate">
              {linkedCategory?.name ?? "Sin vincular"}
            </Text>
          </div>
          <div className="text-right">
            <Text size="xsmall" className="text-ui-fg-subtle">
              Familias / productos
            </Text>
            <Text size="small">
              {families.length} / {countLabel(productCount)}
            </Text>
          </div>
        </div>

        <div className="mt-auto flex flex-wrap gap-2 border-t border-ui-border-base pt-3">
          <Button
            size="small"
            variant="secondary"
            aria-label={`Subir ${category.name}`}
            disabled={position === 0 || reordering}
            onClick={() => onMove(-1)}
          >
            Subir
          </Button>
          <Button
            size="small"
            variant="secondary"
            aria-label={`Bajar ${category.name}`}
            disabled={position === total - 1 || reordering}
            onClick={() => onMove(1)}
          >
            Bajar
          </Button>
        </div>
      </div>
    </article>
  )
}
