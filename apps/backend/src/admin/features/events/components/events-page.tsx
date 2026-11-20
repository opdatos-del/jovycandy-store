import { Badge, Button, Container, Heading } from "@medusajs/ui"
import { canMoveEventWithinPriority } from "@admin/shared/lib/event-ordering"
import { EventFormPanel } from "./event-form"
import { EventTypeSection } from "./event-type-form"
import { useEvents } from "../hooks/use-events"

/**
 * Agenda corporativa: tipos de evento, listado con ciclo editorial y orden
 * dentro de la misma prioridad, y editor del evento. El reordenamiento se
 * delega en `@admin/shared/lib/event-ordering` para no duplicar la regla.
 */
export const EventsPage = () => {
  const events = useEvents()

  return (
    <div className="flex flex-col gap-y-4">
      <Container className="p-6">
        <div className="flex flex-wrap justify-between gap-3">
          <div>
            <Heading level="h1">Eventos</Heading>
            <p className="text-ui-fg-subtle text-sm">Agenda corporativa con ciclo editorial, vigencia y prioridad.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="secondary"><a href="/app/jovy/novelties">Gestionar multimedia en Novedades</a></Button>
            <Button variant="secondary" onClick={events.reset}>Nuevo evento</Button>
          </div>
        </div>
        {events.message && <p role="alert" className="mt-3 text-ui-fg-error">{events.message}</p>}
      </Container>

      <EventTypeSection
        types={events.types}
        form={events.typeForm}
        saving={events.saving}
        deletingTypeId={events.deletingTypeId}
        onChange={events.setTypeForm}
        onSubmit={(event) => void events.saveType(event)}
        onEdit={(type) => events.setTypeForm({ id: type.id, code: type.code, name: type.name, description: type.description ?? "" })}
        onDelete={(type) => void events.removeType(type)}
        onReset={events.resetType}
      />

      <Container className="p-6">
        <Heading level="h2" id="events-list-heading" tabIndex={-1}>Eventos</Heading>
        {events.events.length === 0 ? (
          <p className="mt-4 text-ui-fg-subtle">Aún no hay eventos.</p>
        ) : (
          <ul className="mt-4 divide-y">
            {events.events.map((event) => (
              <li key={event.id} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-medium">{event.title}</p>
                  <p className="text-ui-fg-subtle text-sm">/{event.slug} · prioridad {event.priority} · orden {event.sort_order}{event.title_en ? "" : " · falta título EN"}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge color={event.status === "published" ? "green" : event.status === "cancelled" ? "red" : "orange"}>{event.status}</Badge>
                  <Button asChild size="small" variant="secondary"><a href={`/app/jovy/novelties?event=${encodeURIComponent(event.id)}`}>Multimedia en Novedades</a></Button>
                  <Button size="small" variant="secondary" onClick={() => void events.move(event.id, -1)} disabled={!canMoveEventWithinPriority(events.events, event.id, -1)}>Subir</Button>
                  <Button size="small" variant="secondary" onClick={() => void events.move(event.id, 1)} disabled={!canMoveEventWithinPriority(events.events, event.id, 1)}>Bajar</Button>
                  {event.status !== "published" && <Button size="small" variant="secondary" onClick={() => void events.patch(event, "published")}>Publicar</Button>}
                  {event.status !== "archived" && <Button size="small" variant="secondary" onClick={() => void events.patch(event, "archived")}>Archivar</Button>}
                  <Button size="small" variant="secondary" onClick={() => void events.edit(event)}>Editar</Button>
                  <Button size="small" variant="danger" isLoading={events.deletingId === event.id} onClick={() => void events.remove(event)}>Eliminar</Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Container>

      <EventFormPanel
        form={events.form}
        types={events.types}
        editing={events.editing}
        previewUrl={events.previewUrl}
        saving={events.saving}
        onChange={events.setForm}
        onUpload={(file) => void events.upload(file)}
        onRemoveMedia={events.removeMedia}
        onSubmit={(event) => void events.save(event)}
      />
    </div>
  )
}
