import { Badge, Button, Heading, Text } from "@medusajs/ui"
import { STATUS_BADGE, STATUS_LABELS } from "../model"
import type { EditorialDraft, ProductEditorial } from "../types"

type EditorialPublicationSectionProps = {
  editorial: ProductEditorial | null
  draft: EditorialDraft
  publishIssues: string[]
  saving: boolean
  onPublish: () => void
  onArchive: () => void
  onRestoreArchived: () => void
  onRemove: () => void
  onReload: () => void
  canUpdate: boolean
  canPublish: boolean
  canArchive: boolean
  canRestore: boolean
  canDelete: boolean
}

/**
 * Ciclo de publicación editorial. Publicar o archivar pide confirmación y
 * nunca cambia el producto comercial.
 */
export const EditorialPublicationSection = ({
  editorial,
  draft,
  publishIssues,
  saving,
  onPublish,
  onArchive,
  onRestoreArchived,
  onRemove,
  onReload,
  canUpdate,
  canPublish,
  canArchive,
  canRestore,
  canDelete,
}: EditorialPublicationSectionProps) => (
  <section aria-labelledby="editorial-publication-heading" className="border-ui-border-base rounded-lg border p-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <Heading id="editorial-publication-heading" level="h3">
        Publicación
      </Heading>
      {editorial ? (
        <Badge color={STATUS_BADGE[editorial.editorial_status]}>
          {STATUS_LABELS[editorial.editorial_status]}
        </Badge>
      ) : (
        <Badge color="grey">Sin ficha</Badge>
      )}
    </div>

    <div className="mt-2" aria-live="polite">
      {publishIssues.length > 0 ? (
        <div className="text-ui-fg-error flex flex-wrap items-center gap-1.5 text-xs">
          <Text size="xsmall" weight="plus">
            Falta:
          </Text>
          {publishIssues.map((issue) => (
            <Badge key={issue} size="2xsmall" color="red">
              {issue}
            </Badge>
          ))}
        </div>
      ) : (
        <Text size="xsmall" className="text-ui-fg-subtle">
          Requisitos editoriales completos. Store exige además el producto comercial publicado.
        </Text>
      )}
    </div>

    <div className="mt-3 flex flex-wrap gap-1.5">
      {canUpdate && (
        <Button type="submit" size="small" isLoading={saving}>
          Guardar cambios
        </Button>
      )}
      {canPublish && (
        <Button
          type="button"
          size="small"
          variant="secondary"
          disabled={saving || draft.editorial_status === "published"}
          onClick={onPublish}
        >
          Publicar en Store
        </Button>
      )}
      {canArchive && (
        <Button
          type="button"
          size="small"
          variant="secondary"
          disabled={saving || draft.editorial_status === "archived"}
          onClick={onArchive}
        >
          Archivar ficha
        </Button>
      )}
      {canRestore && draft.editorial_status === "archived" && (
        <Button type="button" size="small" variant="secondary" disabled={saving} onClick={onRestoreArchived}>
          Restaurar a borrador
        </Button>
      )}
      <Button type="button" size="small" variant="transparent" disabled={saving} onClick={onReload}>
        Actualizar
      </Button>
    </div>

    {canDelete && editorial ? (
      <details className="mt-2">
        <summary className="text-ui-fg-subtle cursor-pointer text-xs">Opciones de eliminación</summary>
        <Button
          type="button"
          size="small"
          variant="danger"
          className="mt-2"
          disabled={saving}
          onClick={onRemove}
        >
          Eliminar ficha
        </Button>
      </details>
    ) : null}
  </section>
)
