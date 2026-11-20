import { Badge, Button } from "@medusajs/ui"
import { cropForPreview } from "@admin/features/logos/lib/crop"
import { DEFAULT_CROP, type Logo } from "@admin/features/logos/types"

/** Tarjeta del listado: vista previa con recorte, badges y acciones de orden. */
export function LogoCard({ logo, index, total, isBusy, isReordering, onEdit, onDelete, onToggle, onMove, canUpdate, canDelete }: {
  logo: Logo
  index: number
  total: number
  isBusy: boolean
  isReordering: boolean
  onEdit: () => void
  onDelete: () => void
  onToggle: () => void
  onMove: (direction: -1 | 1) => void
  canUpdate: boolean
  canDelete: boolean
}) {
  return <article className="jovy-container flex min-w-0 flex-col rounded-md border border-ui-border-base bg-ui-bg-base p-3 shadow-elevation-card-rest">
    <div className="relative mb-3 aspect-[16/9] overflow-hidden rounded bg-ui-bg-subtle">
      {logo.media_url ? <img src={logo.media_url} alt={logo.alt || logo.name} className="h-full w-full object-contain" loading="lazy" style={cropForPreview(logo.crop || DEFAULT_CROP)} /> : <span className="flex h-full items-center justify-center text-ui-fg-muted text-xs">Sin recurso</span>}
    </div>
    <div className="flex min-w-0 flex-1 flex-col gap-y-2">
      <div className="min-w-0"><h3 className="truncate font-medium">{logo.name}</h3><p className="line-clamp-2 text-ui-fg-subtle text-xs">{logo.family_labels.map((family) => family.name).join(", ") || "Sin familias canónicas"}</p></div>
      {logo.unmapped_families.length > 0 && <p className="rounded bg-ui-bg-component px-2 py-1 text-ui-fg-subtle text-xs">Legado sin equivalente: {logo.unmapped_families.join(", ")}</p>}
      <div className="flex flex-wrap gap-1"><Badge color={logo.enabled ? "green" : "grey"}>{logo.enabled ? "Activo" : "Inactivo"}</Badge><Badge color="blue">Orden global {index + 1}</Badge></div>
      <div className="jovy-actions jovy-actions--end-danger mt-auto flex flex-wrap gap-2 border-t border-ui-border-base pt-3">
        {canUpdate && (
          <>
            <Button size="small" variant="secondary" onClick={onEdit} disabled={isBusy || isReordering}>Editar</Button>
            <Button size="small" variant="secondary" onClick={onToggle} isLoading={isBusy}>{logo.enabled ? "Desactivar" : "Activar"}</Button>
            <Button size="small" variant="secondary" aria-label={`Subir ${logo.name}`} onClick={() => onMove(-1)} disabled={isBusy || isReordering || index === 0}>Subir</Button>
            <Button size="small" variant="secondary" aria-label={`Bajar ${logo.name}`} onClick={() => onMove(1)} disabled={isBusy || isReordering || index === total - 1}>Bajar</Button>
          </>
        )}
        {canDelete && (
          <Button size="small" variant="danger" onClick={onDelete} disabled={isBusy || isReordering}>Eliminar</Button>
        )}
      </div>
    </div>
  </article>
}
