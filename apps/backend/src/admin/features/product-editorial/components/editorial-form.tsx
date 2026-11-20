import { Text } from "@medusajs/ui"
import type { EditorialDraft, ProductEditorial } from "../types"
import { EditorialCatalogueSection } from "./editorial-catalogue-section"
import { EditorialCommercialSection } from "./editorial-commercial-section"
import { EditorialContentSection } from "./editorial-content-section"
import { EditorialPublicationSection } from "./editorial-publication-section"

type EditorialFormProps = {
  editorial: ProductEditorial | null
  draft: EditorialDraft
  saving: boolean
  formError: string | null
  onUpdate: (patch: Partial<EditorialDraft>) => void
  onToggleCertification: (certification: string, checked: boolean) => void
  onChangeCommercialMode: (mode: EditorialDraft["commercial_mode"]) => void | Promise<void>
  onSave: () => void | Promise<void>
  onPublish: () => void | Promise<void>
  onArchive: () => void | Promise<void>
  onRestoreArchived: () => void | Promise<void>
  onRemove: () => void | Promise<void>
  onReload: () => void | Promise<void>
  canUpdate: boolean
  canPublish: boolean
  canArchive: boolean
  canRestore: boolean
  canDelete: boolean
}

/**
 * Formulario completo de la ficha. Guardar crea el registro editorial cuando
 * aún no existe, sin crear ni duplicar un producto comercial.
 */
export const EditorialForm = ({
  editorial,
  draft,
  saving,
  formError,
  onUpdate,
  onToggleCertification,
  onChangeCommercialMode,
  onSave,
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
}: EditorialFormProps) => {
  const publishIssues = editorial
    ? editorial.publish_issues
    : ["guardar una ficha para que el servidor pueda comprobar los requisitos de publicación"]

  return (
    <form className="mt-5 flex max-w-4xl flex-col gap-y-5" onSubmit={(event) => { event.preventDefault(); void onSave() }}>
      {editorial?.product_missing && <p role="alert" className="text-ui-fg-error text-sm">El producto comercial de esta ficha ya no existe en Medusa. Restaura o depura el registro antes de publicarlo.</p>}
      {!editorial && <Text size="small" className="text-ui-fg-subtle">Aún no hay ficha editorial. Guardar crea un borrador sin crear ni duplicar un producto comercial.</Text>}
      {formError && <p role="alert" className="text-ui-fg-error text-sm">{formError}</p>}

      <EditorialCommercialSection
        editorial={editorial}
        draft={draft}
        saving={saving}
        onChangeMode={onChangeCommercialMode}
      />

      <EditorialContentSection
        draft={draft}
        onUpdate={onUpdate}
        onToggleCertification={onToggleCertification}
      />

      <EditorialCatalogueSection editorial={editorial} />

      <EditorialPublicationSection
        editorial={editorial}
        draft={draft}
        publishIssues={publishIssues}
        saving={saving}
        onPublish={() => void onPublish()}
        onArchive={() => void onArchive()}
        onRestoreArchived={() => void onRestoreArchived()}
        onRemove={() => void onRemove()}
        onReload={() => void onReload()}
        canUpdate={canUpdate}
        canPublish={canPublish}
        canArchive={canArchive}
        canRestore={canRestore}
        canDelete={canDelete}
      />
    </form>
  )
}
