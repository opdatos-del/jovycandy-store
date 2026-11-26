import { Button, Container, Heading, Text } from "@medusajs/ui"
import { useEffect, useState, type FormEvent } from "react"

import { useJovyPermissions } from "@admin/shared/hooks/use-jovy-permissions"
import { errorMessage } from "@admin/shared/lib/admin-api"

import {
  approveOfficialCatalogChanges,
  fetchOfficialCatalogPreview,
  type OfficialPreviewEntry,
  type OfficialPreviewField,
} from "../official-preview-api"

const FIELD_LABEL: Record<OfficialPreviewField, string> = {
  title: "Título",
  description: "Descripción",
  weight: "Peso (g)",
}

const DIAGNOSTIC_LABEL: Record<
  OfficialPreviewEntry["diagnostics"][number]["field"],
  string
> = {
  status: "Estado",
  category: "Categoría",
  family: "Familia",
  specs: "Especificaciones",
  source_updated_at: "Fecha de fuente",
}

function printable(value: string | number | null) {
  return value === null || value === "" ? "Sin valor" : String(value)
}

/**
 * Revisión opt-in de fuente oficial. Nunca ejecuta el seed y sólo permite
 * sobrescribir campos seleccionados de forma explícita.
 */
export function OfficialCatalogPreview() {
  const permissions = useJovyPermissions()
  const canUpdate = permissions.can("jovy_catalogue", "update")
  const [entries, setEntries] = useState<OfficialPreviewEntry[]>([])
  const [selected, setSelected] = useState<Record<string, OfficialPreviewField[]>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const result = await fetchOfficialCatalogPreview()
      setEntries(result.preview)
      setSelected({})
      setError(null)
    } catch (reason) {
      setError(errorMessage(reason, "No fue posible comparar el catálogo oficial."))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const toggle = (externalId: string, field: OfficialPreviewField, checked: boolean) => {
    setSelected((current) => {
      const fields = new Set(current[externalId] ?? [])
      if (checked) fields.add(field)
      else fields.delete(field)
      return { ...current, [externalId]: [...fields] }
    })
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const updates = Object.entries(selected)
      .map(([external_id, fields]) => ({ external_id, fields }))
      .filter((update) => update.fields.length > 0)
    if (!updates.length) {
      setError("Selecciona al menos un campo oficial antes de aplicar.")
      return
    }
    setSaving(true)
    try {
      const result = await approveOfficialCatalogChanges(updates)
      setEntries(result.preview)
      setSelected({})
      setError(null)
      setStatus(`${result.updated} producto(s) actualizado(s) con aprobación explícita.`)
    } catch (reason) {
      setError(errorMessage(reason, "No fue posible aplicar los cambios seleccionados."))
    } finally {
      setSaving(false)
    }
  }

  const differences = entries.filter((entry) => entry.state !== "equal")

  return (
    <Container className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Heading level="h2" className="jovy-subtitle">Revisión de fuente oficial</Heading>
          <Text size="small" className="text-ui-fg-subtle mt-1">
            Compara Medusa con el manifiesto. Nada cambia hasta aprobar campos concretos.
          </Text>
        </div>
        <Button type="button" size="small" variant="secondary" onClick={() => void load()} isLoading={loading}>
          Actualizar diferencias
        </Button>
      </div>

      {error && <Text role="alert" size="small" className="text-ui-fg-error mt-3">{error}</Text>}
      {status && <Text role="status" size="small" className="mt-3">{status}</Text>}
      {loading ? (
        <Text role="status" size="small" className="text-ui-fg-subtle mt-4">Comparando catálogo oficial…</Text>
      ) : differences.length === 0 ? (
        <Text size="small" className="text-ui-fg-subtle mt-4">No hay diferencias comerciales pendientes.</Text>
      ) : (
        <form className="mt-4 flex flex-col gap-4" aria-labelledby="official-catalog-preview-heading" onSubmit={(event) => void submit(event)}>
          <Heading id="official-catalog-preview-heading" level="h3" className="sr-only">
            Diferencias del catálogo oficial
          </Heading>
          {differences.map((entry) => (
            <article key={entry.externalId} className="border-ui-border-base rounded-lg border p-4">
              <h4 className="text-ui-fg-base text-sm font-semibold">
                {entry.handle}
              </h4>
              {entry.state === "missing" ? (
                <Text size="small" className="text-ui-fg-subtle mt-2">
                  Producto ausente. La creación sigue requiriendo seed controlado; esta pantalla no crea productos.
                </Text>
              ) : (
                <fieldset className="mt-3 flex flex-col gap-3" disabled={!canUpdate || saving}>
                  <legend className="text-ui-fg-subtle text-xs">
                    Campos comerciales disponibles para aprobación
                  </legend>
                  {entry.changes.map((change, index) => {
                    const id = `official-preview-${entry.productId}-${change.field}-${index}`
                    return (
                      <label key={change.field} htmlFor={id} className="border-ui-border-base flex cursor-pointer items-start gap-3 rounded-md border p-3">
                        <input
                          id={id}
                          name={`${entry.externalId}:${change.field}`}
                          type="checkbox"
                          checked={(selected[entry.externalId] ?? []).includes(change.field)}
                          onChange={(event) => toggle(entry.externalId, change.field, event.target.checked)}
                          className="mt-1 h-4 w-4"
                        />
                        <span className="min-w-0 text-sm">
                          <span className="text-ui-fg-base block font-medium">{FIELD_LABEL[change.field]}</span>
                          <span className="text-ui-fg-subtle block">Medusa: {printable(change.current)}</span>
                          <span className="text-ui-fg-base block">Oficial: {printable(change.official)}</span>
                        </span>
                      </label>
                    )
                  })}
                  {entry.diagnostics.length > 0 && (
                    <div className="text-ui-fg-subtle text-xs">
                      <p className="font-medium">Otros cambios de fuente (sólo seed)</p>
                      <ul className="mt-1 flex list-disc flex-col gap-1 pl-4">
                        {entry.diagnostics.map((diagnostic) => (
                          <li key={diagnostic.field}>
                            {DIAGNOSTIC_LABEL[diagnostic.field]}: Medusa {diagnostic.current} · Oficial {diagnostic.official}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {entry.variants.some((variant) => variant.state !== "equal") && (
                    <Text size="small" className="text-ui-fg-subtle">
                      Variantes con diferencia: {entry.variants.filter((variant) => variant.state !== "equal").map((variant) => variant.sku).join(", ")}. Se muestran para diagnóstico; se reconcilian sólo con el seed.
                    </Text>
                  )}
                </fieldset>
              )}
            </article>
          ))}
          {canUpdate && (
            <div>
              <Button type="submit" size="small" isLoading={saving}>
                Aplicar campos seleccionados
              </Button>
            </div>
          )}
        </form>
      )}
    </Container>
  )
}
