import { canMoveEventWithinPriority } from "@admin/routes/jovy-herramientas/events/ordering"
import { NoveltyCard } from "./novelty-card"
import { NoveltyForm } from "./novelty-form"
import { NoveltiesEmptyState } from "./novelties-empty-state"
import { NoveltiesFilters } from "./novelties-filters"
import { NoveltiesHeader } from "./novelties-header"
import { useNovelties } from "../hooks/use-novelties"
import { noveltyStoreState } from "../model"

/**
 * Administración del carrusel horizontal de Novedades. A diferencia de un CRUD
 * genérico, la pantalla se organiza como tablero multimedia: cada tarjeta es la
 * novedad real que consume Store, con su estado editorial y su visibilidad
 * efectiva separados para no etiquetar como publicada una novedad oculta.
 */
export const NoveltiesPage = () => {
  const novelties = useNovelties()

  return (
    <div className="flex flex-col gap-y-4" data-jovy-quality data-testid="jovy-novelties-page">
      <NoveltiesHeader
        eventsCount={novelties.events.length}
        storeVisibleCount={novelties.storeVisibleCount}
        loading={novelties.loading}
        loadError={novelties.loadError}
        sideWarning={novelties.sideWarning}
        actionError={novelties.actionError}
        onCreate={novelties.openCreate}
        onReload={() => void novelties.load()}
      />

      {novelties.editorOpen && novelties.draft && (
        <NoveltyForm
          draft={novelties.draft}
          editing={novelties.editingEvent}
          eventTypes={novelties.eventTypes}
          uploading={novelties.uploading}
          saving={novelties.saving}
          error={novelties.formError}
          onChange={novelties.changeDraft}
          onUpload={(file) => void novelties.uploadEditorMedia(file)}
          onRemoveMedia={() => void novelties.removeEditorMedia()}
          onSave={() => void novelties.save()}
          onCancel={novelties.closeEditor}
        />
      )}

      <NoveltiesFilters
        filters={novelties.filters}
        filtersActive={novelties.filtersActive}
        filteredCount={novelties.filtered.length}
        eventsCount={novelties.events.length}
        onChange={novelties.updateFilters}
        onClear={novelties.clearFilters}
      />

      {novelties.events.length > 0 && novelties.filtered.length > 0 ? (
        <section
          aria-label="Novedades del carrusel"
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          {/* Encabezado real de la sección: evita saltar de h1 a los h3 de cada
              tarjeta sin añadir ruido visual. */}
          <h2 className="sr-only">Novedades del carrusel</h2>
          {novelties.filtered.map((event) => (
            <NoveltyCard
              key={event.id}
              event={event}
              position={novelties.events.findIndex((item) => item.id === event.id) + 1}
              store={noveltyStoreState(event)}
              filtersActive={novelties.filtersActive}
              canMoveUp={
                !novelties.filtersActive &&
                !novelties.reordering &&
                canMoveEventWithinPriority(novelties.events, event.id, -1)
              }
              canMoveDown={
                !novelties.filtersActive &&
                !novelties.reordering &&
                canMoveEventWithinPriority(novelties.events, event.id, 1)
              }
              busy={novelties.busyId === event.id}
              highlighted={novelties.highlightedId === event.id || novelties.editingId === event.id}
              onEdit={() => novelties.openEditor(event)}
              onMove={(direction) => void novelties.move(event, direction)}
              onSaveOrder={(order) => void novelties.saveOrder(event, order)}
              onToggleEnabled={() => void novelties.toggleEnabled(event)}
              onPublish={() => void novelties.publish(event)}
              onArchive={() => void novelties.archive(event)}
              onDelete={() => void novelties.deleteEvent(event)}
              onReplaceMedia={(file) => void novelties.replaceCardMedia(event, file)}
              onRemoveMedia={() => void novelties.removeMedia(event)}
            />
          ))}
        </section>
      ) : (
        <NoveltiesEmptyState
          loading={novelties.loading}
          eventsCount={novelties.events.length}
          onCreate={novelties.openCreate}
          onClearFilters={novelties.clearFilters}
        />
      )}
    </div>
  )
}
