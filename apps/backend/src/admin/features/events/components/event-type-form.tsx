import { Button, Container, Heading, Input, Textarea } from "@medusajs/ui"
import type { EventType, TypeForm } from "../types"

type EventTypeSectionProps = {
  types: EventType[]
  form: TypeForm
  saving: boolean
  deletingTypeId: string | null
  onChange: (form: TypeForm) => void
  onSubmit: (event: React.FormEvent) => void
  onEdit: (type: EventType) => void
  onDelete: (type: EventType) => void
  onReset: () => void
}

/**
 * Catálogo de tipos de evento. Eliminar un tipo en uso falla en el servidor y
 * el tipo se conserva; la sección sólo refleja ese contrato.
 */
export const EventTypeSection = ({
  types,
  form,
  saving,
  deletingTypeId,
  onChange,
  onSubmit,
  onEdit,
  onDelete,
  onReset,
}: EventTypeSectionProps) => (
  <Container className="p-6">
    <Heading level="h2" id="event-types-heading" tabIndex={-1}>Tipos de evento</Heading>
    {types.length === 0 ? (
      <p className="mt-4 text-ui-fg-subtle">Aún no hay tipos de evento.</p>
    ) : (
      <ul className="mt-4 divide-y">
        {types.map((type) => (
          <li key={type.id} className="flex items-center justify-between gap-3 py-3">
            <div>
              <p className="font-medium">{type.name}</p>
              <p className="text-ui-fg-subtle text-sm">{type.code}{type.description ? ` · ${type.description}` : ""}</p>
            </div>
            <div className="flex gap-2">
              <Button size="small" variant="secondary" onClick={() => onEdit(type)}>Editar tipo</Button>
              <Button size="small" variant="danger" isLoading={deletingTypeId === type.id} onClick={() => onDelete(type)}>Eliminar tipo</Button>
            </div>
          </li>
        ))}
      </ul>
    )}
    <form className="mt-4 flex max-w-2xl flex-col gap-3" onSubmit={onSubmit}>
      <Input required aria-label="Código tipo evento" value={form.code} onChange={(event) => onChange({ ...form, code: event.target.value })} placeholder="feria" />
      <Input required aria-label="Nombre tipo evento" value={form.name} onChange={(event) => onChange({ ...form, name: event.target.value })} placeholder="Feria" />
      <Textarea aria-label="Descripción tipo evento" value={form.description} onChange={(event) => onChange({ ...form, description: event.target.value })} placeholder="Descripción" />
      <div className="flex gap-2">
        <Button type="submit" isLoading={saving}>{form.id ? "Guardar tipo" : "Crear tipo"}</Button>
        {form.id && <Button type="button" variant="secondary" onClick={onReset}>Cancelar tipo</Button>}
      </div>
    </form>
  </Container>
)
