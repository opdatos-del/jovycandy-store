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
  <section aria-labelledby="editorial-publication-heading" className="border-ui-border-base rounded-lg border p-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <Heading id="editorial-publication-heading" level="h3">Publicación editorial</Heading>
        <Text size="small" className="text-ui-fg-subtle mt-1">Estado actual: {STATUS_LABELS[editorial?.editorial_status ?? "draft"]}. Publicar o archivar pide confirmación y nunca cambia el producto comercial.</Text>
      </div>
      {editorial && <Badge color={STATUS_BADGE[editorial.editorial_status]}>{STATUS_LABELS[editorial.editorial_status]}</Badge>}
    </div>
    <div className="mt-3" aria-live="polite">
      {publishIssues.length > 0 ? (
        <div className="text-ui-fg-error text-sm"><Text size="small" weight="plus">Antes de publicar</Text><ul className="mt-1 list-disc pl-5">{publishIssues.map((issue) => <li key={issue}>{issue}</li>)}</ul></div>
      ) : <Text size="small" className="text-ui-fg-subtle">La ficha cumple los requisitos editoriales conocidos. Store también exige que el producto comercial esté publicado.</Text>}
    </div>
    <div className="mt-4 flex flex-wrap gap-2">
      {canUpdate && <Button type="submit" size="small" isLoading={saving}>Guardar cambios</Button>}
      {canPublish && <Button type="button" size="small" variant="secondary" disabled={saving || draft.editorial_status === "published"} onClick={onPublish}>Publicar en Store</Button>}
      {canArchive && <Button type="button" size="small" variant="secondary" disabled={saving || draft.editorial_status === "archived"} onClick={onArchive}>Archivar ficha</Button>}
      {canRestore && draft.editorial_status === "archived" && <Button type="button" size="small" variant="secondary" disabled={saving} onClick={onRestoreArchived}>Restaurar a borrador</Button>}
      {canDelete && editorial && <Button type="button" size="small" variant="danger" disabled={saving} onClick={onRemove}>Eliminar ficha</Button>}
      <Button type="button" size="small" variant="secondary" disabled={saving} onClick={onReload}>Actualizar</Button>
    </div>
  </section>
)
