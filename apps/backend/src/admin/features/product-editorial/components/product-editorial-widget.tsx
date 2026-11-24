import { Badge, Container, Heading, Text } from "@medusajs/ui"
import { useJovyPermissions } from "@admin/shared/hooks/use-jovy-permissions"
import { useEffect } from "react"

import {
  registerWorkspaceBlock,
  setWorkspaceMeta,
  unregisterWorkspaceBlock,
} from "@admin/features/product-workspace/store"
import { useProductEditorial } from "../hooks/use-product-editorial"
import { STATUS_BADGE, STATUS_LABELS } from "../model"
import type { ProductEditorialWidgetProps } from "../types"
import { EditorialForm } from "./editorial-form"
import { EditorialDeletedState, EditorialLoadError, EditorialLoading } from "./editorial-status"

/**
 * Panel editorial dentro del detalle nativo del producto. Solo presenta la
 * ficha editorial y su ciclo de publicación; el producto comercial, sus
 * precios, inventario, variantes e imágenes siguen en Medusa.
 */
const ProductEditorialWidget = ({ data }: ProductEditorialWidgetProps) => {
  const permissions = useJovyPermissions()
  const canUpdate = permissions.can("jovy_product_editorial", "update")
  const canPublish = permissions.can("jovy_product_editorial", "publish")
  const canArchive = permissions.can("jovy_product_editorial", "archive")
  const canRestore = permissions.can("jovy_product_editorial", "restore")
  const canDelete = permissions.can("jovy_product_editorial", "delete")
  const {
    editorial,
    deleted,
    draft,
    loading,
    loadError,
    formError,
    saving,
    dirty,
    reload,
    update,
    toggleCertification,
    changeCommercialMode,
    save,
    publish,
    archive,
    restoreArchived,
    remove,
    restoreDeleted,
  } = useProductEditorial(data.id)

  useEffect(() => {
    setWorkspaceMeta("editorialStatus", draft.editorial_status ?? null)
  }, [draft.editorial_status])

  useEffect(() => {
    registerWorkspaceBlock({
      id: "editorial",
      label: "Ficha editorial",
      dirty,
      saving,
      save: async () => {
        await save()
      },
    })
    return () => unregisterWorkspaceBlock("editorial")
  }, [dirty, saving, save])

  return (
    <Container
      id="jovy-product-editorial"
      className="scroll-mt-24 p-4 pb-24 sm:p-6 sm:pb-24"
      data-testid="product-editorial-widget"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-3xl">
          <Heading level="h2">Editor editorial Jovy</Heading>
          <Text size="xsmall" className="text-ui-fg-subtle mt-0.5">
            Ficha editorial y estado de publicación. SKU, precio, stock, variantes e imágenes se mantienen en el
            detalle nativo de Medusa.
          </Text>
        </div>
        {editorial && <Badge color={STATUS_BADGE[editorial.editorial_status]} data-testid="editorial-status-badge">{STATUS_LABELS[editorial.editorial_status]}</Badge>}
      </div>

      <EditorialLoading loading={loading} />
      <EditorialLoadError error={loadError} />

      {!loading && !loadError && deleted && (
        <EditorialDeletedState
          saving={saving}
          onRestore={() => void restoreDeleted()}
          onReload={() => void reload()}
          canRestore={canRestore}
        />
      )}

      {!loading && !loadError && !deleted && (
        <EditorialForm
          editorial={editorial}
          draft={draft}
          saving={saving}
          formError={formError}
          onUpdate={update}
          onToggleCertification={toggleCertification}
          onChangeCommercialMode={changeCommercialMode}
          onSave={save}
          onPublish={publish}
          onArchive={archive}
          onRestoreArchived={restoreArchived}
          onRemove={remove}
          onReload={reload}
          canUpdate={canUpdate}
          canPublish={canPublish}
          canArchive={canArchive}
          canRestore={canRestore}
          canDelete={canDelete}
        />
      )}
    </Container>
  )
}

export default ProductEditorialWidget
