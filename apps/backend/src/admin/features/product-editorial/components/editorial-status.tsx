import { Button, Text } from "@medusajs/ui"

type EditorialLoadingProps = { loading: boolean }

/** Carga inicial de la ficha; mantiene el rol de estado para lectores de pantalla. */
export const EditorialLoading = ({ loading }: EditorialLoadingProps) =>
  loading ? (
    <Text size="small" className="text-ui-fg-subtle mt-4" role="status">
      Cargando ficha editorial…
    </Text>
  ) : null

type EditorialLoadErrorProps = { error: string | null }

export const EditorialLoadError = ({ error }: EditorialLoadErrorProps) =>
  error ? (
    <p role="alert" className="text-ui-fg-error mt-4 text-sm">
      {error}
    </p>
  ) : null

type EditorialDeletedStateProps = {
  saving: boolean
  onRestore: () => void
  onReload: () => void
  canRestore: boolean
}

/** La ficha está eliminada, pero el producto comercial sigue activo en Medusa. */
export const EditorialDeletedState = ({ saving, onRestore, onReload, canRestore }: EditorialDeletedStateProps) => (
  <div className="mt-4 flex flex-col gap-y-3">
    <Text size="small" role="status">
      La ficha editorial está eliminada. El producto comercial sigue activo.
    </Text>
    <div className="flex flex-wrap gap-2">
      {canRestore && (
        <Button size="small" onClick={onRestore} isLoading={saving}>
          Restaurar ficha
        </Button>
      )}
      <Button type="button" size="small" variant="secondary" onClick={onReload} disabled={saving}>
        Actualizar
      </Button>
    </div>
  </div>
)
