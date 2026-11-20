import { Badge, Button, Container, Heading } from "@medusajs/ui"
import type { Hero } from "../types"

type Props = {
  items: Hero[]
  loading: boolean
  deletingId: string | null
  onMove: (id: string, direction: -1 | 1) => void
  onEdit: (item: Hero) => void
  onStatus: (item: Hero, status: Hero["status"]) => void
  onRemove: (item: Hero) => void
}

const statusColor = (status: Hero["status"]) =>
  status === "published" ? "green" : status === "archived" ? "grey" : "orange"

/** Listado ordenable de Hero; conserva los roles y etiquetas del Admin. */
export const HeroList = ({
  items,
  loading,
  deletingId,
  onMove,
  onEdit,
  onStatus,
  onRemove,
}: Props) => (
  <Container className="p-6">
    <Heading level="h2" id="hero-list-heading" tabIndex={-1}>
      Elementos
    </Heading>
    {loading ? (
      <p className="mt-4">Cargando…</p>
    ) : items.length === 0 ? (
      <p className="mt-4 text-ui-fg-subtle">Aún no hay elementos Hero.</p>
    ) : (
      <ul className="mt-4 divide-y">
        {items.map((item, index) => (
          <li key={item.id} className="flex items-center justify-between gap-3 py-3">
            <div>
              <p className="font-medium">{item.translations.es.title}</p>
              <p className="text-ui-fg-subtle text-sm">
                Orden {item.sort_order} · {item.enabled ? "Activo" : "Inactivo"}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Badge color={statusColor(item.status)}>{item.status}</Badge>
              <Button
                size="small"
                variant="secondary"
                onClick={() => void onMove(item.id, -1)}
                disabled={index === 0}
              >
                Subir
              </Button>
              <Button
                size="small"
                variant="secondary"
                onClick={() => void onMove(item.id, 1)}
                disabled={index === items.length - 1}
              >
                Bajar
              </Button>
              {item.status !== "published" && (
                <Button size="small" variant="secondary" onClick={() => void onStatus(item, "published")}>
                  Publicar
                </Button>
              )}
              {item.status === "published" && (
                <Button size="small" variant="secondary" onClick={() => void onStatus(item, "draft")}>
                  Despublicar
                </Button>
              )}
              {item.status !== "archived" && (
                <Button size="small" variant="secondary" onClick={() => void onStatus(item, "archived")}>
                  Archivar
                </Button>
              )}
              <Button size="small" variant="secondary" onClick={() => void onEdit(item)}>
                Editar
              </Button>
              <Button
                size="small"
                variant="danger"
                isLoading={deletingId === item.id}
                onClick={() => void onRemove(item)}
              >
                Eliminar
              </Button>
            </div>
          </li>
        ))}
      </ul>
    )}
  </Container>
)
