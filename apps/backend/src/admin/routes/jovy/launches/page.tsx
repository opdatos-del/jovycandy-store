import { defineRouteConfig } from "@medusajs/admin-sdk"
import { RocketLaunch } from "@medusajs/icons"
import { Badge, Button, Container, Heading, Input, Text, toast, usePrompt } from "@medusajs/ui"
import { useCallback, useEffect, useState } from "react"
import {
  adminRequest,
  errorMessage,
  expandHexColor,
  isValidHexColor,
  uploadJovyImage,
} from "../components/admin-api"
import { LaunchForm } from "./components/launch-form"
import type { Launch, LaunchDraft, LaunchSettings, ProductOption } from "./components/launch-types"

/** Paleta conservada del administrador histórico de Nuevos Lanzamientos. */
const HERO_COLOR_PRESETS = [
  "#00AFAA",
  "#00A3E0",
  "#FF5A5F",
  "#FF7A00",
  "#FFC400",
  "#5A9E3A",
  "#7B61FF",
  "#111827",
]

const LaunchesPage = () => {
  const prompt = usePrompt()
  const [launches, setLaunches] = useState<Launch[]>([])
  const [settings, setSettings] = useState<LaunchSettings | null>(null)
  const [productNames, setProductNames] = useState<Record<string, ProductOption>>({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [editing, setEditing] = useState<Launch | null>(null)
  const [view, setView] = useState<"list" | "form">("list")
  const [formVersion, setFormVersion] = useState(0)
  const [saving, setSaving] = useState(false)
  const [reordering, setReordering] = useState(false)
  const [colorDraft, setColorDraft] = useState("#00afaa")
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [settingsError, setSettingsError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [changingId, setChangingId] = useState<string | null>(null)

  const loadProductNames = async (items: Launch[]) => {
    const ids = [...new Set(items.map((item) => item.product_id).filter((id): id is string => Boolean(id)))]
    if (ids.length === 0) {
      setProductNames({})
      return
    }

    try {
      const params = new URLSearchParams({ limit: String(ids.length) })
      ids.forEach((id) => params.append("id[]", id))
      const result = await adminRequest<{
        products: Array<{ id: string; title: string; thumbnail?: string | null }>
      }>(`/admin/products?${params.toString()}`)
      setProductNames(
        Object.fromEntries(
          result.products.map((product) => [
            product.id,
            { id: product.id, title: product.title, thumbnail: product.thumbnail ?? null },
          ]),
        ),
      )
    } catch {
      setProductNames({})
    }
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [launchResult, settingsResult] = await Promise.all([
        adminRequest<{ launches: Launch[] }>("/admin/jovy/launches"),
        adminRequest<{ launch_settings: LaunchSettings }>("/admin/jovy/launches/settings"),
      ])
      setLaunches(launchResult.launches)
      setSettings(settingsResult.launch_settings)
      setColorDraft(settingsResult.launch_settings.background_color)
      setLoadError(null)
      await loadProductNames(launchResult.launches)
    } catch (error) {
      setLoadError(errorMessage(error, "No se pudieron cargar los lanzamientos."))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const searchProducts = useCallback(async (query: string) => {
    const params = new URLSearchParams({ q: query, limit: "12", fields: "id,title,thumbnail,status" })
    const result = await adminRequest<{
      products: Array<{ id: string; title: string; thumbnail?: string | null; status?: string }>
    }>(`/admin/products?${params.toString()}`)
    return result.products
      .filter((product) => product.status === "published")
      .slice(0, 6)
      .map((product) => ({
        id: product.id,
        title: product.title,
        thumbnail: product.thumbnail ?? null,
      }))
  }, [])

  const upload = async (file: File) => {
    const uploaded = await uploadJovyImage(file)
    return { id: uploaded.id, url: uploaded.url }
  }

  const startNew = () => {
    setEditing(null)
    setFormVersion((version) => version + 1)
    setFormError(null)
    setView("form")
  }

  const startEditing = (launch: Launch) => {
    setEditing(launch)
    setFormVersion((version) => version + 1)
    setFormError(null)
    setView("form")
  }

  const returnToList = () => {
    setEditing(null)
    setFormError(null)
    setFormVersion((version) => version + 1)
    setView("list")
  }

  const saveLaunch = async (draft: LaunchDraft) => {
    setSaving(true)
    setFormError(null)
    try {
      const payload = {
        title: draft.title.trim(),
        description: draft.description.trim() || null,
        product_id: draft.product?.id ?? null,
        image_file_id: draft.image_file_id,
        image_url: draft.image_url.trim() || null,
        active: draft.active,
        sort_order: editing ? editing.sort_order : launches.length,
      }
      await adminRequest(editing ? `/admin/jovy/launches/${editing.id}` : "/admin/jovy/launches", {
        method: editing ? "PUT" : "POST",
        body: JSON.stringify(payload),
      })
      toast.success(editing ? "Lanzamiento actualizado." : "Lanzamiento creado.")
      returnToList()
      await load()
    } catch (error) {
      setFormError(errorMessage(error, "No se pudo guardar el lanzamiento."))
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (launch: Launch) => {
    setChangingId(launch.id)
    try {
      await adminRequest(`/admin/jovy/launches/${launch.id}`, {
        method: "PUT",
        body: JSON.stringify({ active: !launch.active }),
      })
      toast.success(launch.active ? "Lanzamiento desactivado." : "Lanzamiento activado.")
      await load()
    } catch (error) {
      toast.error(errorMessage(error, "No se pudo cambiar la visibilidad."))
    } finally {
      setChangingId(null)
    }
  }

  const remove = async (launch: Launch) => {
    const confirmed = await prompt({
      title: "Eliminar lanzamiento",
      description: `Eliminarás «${launch.title}». Esta acción no elimina el archivo compartido de la imagen.`,
      confirmText: "Eliminar lanzamiento",
      cancelText: "Cancelar",
    })
    if (!confirmed) return

    setDeletingId(launch.id)
    try {
      await adminRequest(`/admin/jovy/launches/${launch.id}`, { method: "DELETE" })
      if (editing?.id === launch.id) {
        setEditing(null)
        setFormVersion((version) => version + 1)
      }
      toast.success("Lanzamiento eliminado.")
      await load()
    } catch (error) {
      toast.error(errorMessage(error, "No se pudo eliminar el lanzamiento."))
    } finally {
      setDeletingId(null)
    }
  }

  const move = async (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= launches.length) return

    const ids = launches.map((launch) => launch.id)
    ;[ids[index], ids[target]] = [ids[target], ids[index]]

    setReordering(true)
    try {
      await adminRequest("/admin/jovy/launches/reorder", {
        method: "POST",
        body: JSON.stringify({ ids }),
      })
      toast.success("Orden de lanzamientos actualizado.")
      await load()
    } catch (error) {
      toast.error(errorMessage(error, "No se pudo reordenar los lanzamientos."))
    } finally {
      setReordering(false)
    }
  }

  const saveSettings = async () => {
    if (!isValidHexColor(colorDraft)) {
      setSettingsError("Usa un color hexadecimal #RGB o #RRGGBB.")
      return
    }

    const normalizedColor = colorDraft.trim()
    const confirmed = await prompt({
      title: "Guardar color global",
      description: `El fondo de Nuevos Lanzamientos cambiará a ${normalizedColor} en Store.`,
      confirmText: "Guardar color",
      cancelText: "Seguir editando",
    })
    if (!confirmed) return

    setSettingsSaving(true)
    setSettingsError(null)
    try {
      await adminRequest("/admin/jovy/launches/settings", {
        method: "PUT",
        body: JSON.stringify({ background_color: normalizedColor }),
      })
      const persisted = await adminRequest<{ launch_settings: LaunchSettings }>(
        "/admin/jovy/launches/settings",
      )
      setSettings(persisted.launch_settings)
      setColorDraft(persisted.launch_settings.background_color)
      toast.success(`Color de fondo guardado: ${persisted.launch_settings.background_color}`)
    } catch (error) {
      const message = errorMessage(error, "No se pudo guardar el color de fondo.")
      setSettingsError(message)
      toast.error(message)
    } finally {
      setSettingsSaving(false)
    }
  }

  const colorValid = isValidHexColor(colorDraft)
  const editingProduct =
    editing?.product_id
      ? productNames[editing.product_id] ?? { id: editing.product_id, title: editing.product_id }
      : null

  if (view === "form") {
    return (
      <LaunchForm
        key={`${editing?.id ?? "new"}-${formVersion}`}
        editing={editing}
        initialProduct={editingProduct}
        saving={saving}
        error={formError}
        onCancel={returnToList}
        onSubmit={(draft) => void saveLaunch(draft)}
        onUpload={upload}
        searchProducts={searchProducts}
      />
    )
  }

  return (
    <div className="flex flex-col gap-y-4" data-testid="jovy-launches-page">
      <Container className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Heading level="h1">Nuevos lanzamientos</Heading>
            <Text size="small" className="text-ui-fg-subtle mt-1">
              Configura tarjetas de la sección de portada. Cada lanzamiento usa un producto publicado, una imagen propia
              o ambas cosas; el orden es global.
            </Text>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="small" variant="secondary" onClick={() => void load()} isLoading={loading}>
              Actualizar
            </Button>
            <Button size="small" onClick={startNew}>
              Nuevo lanzamiento
            </Button>
          </div>
        </div>
        {loadError && (
          <p role="alert" className="text-ui-fg-error mt-3 text-sm">
            {loadError}
          </p>
        )}
      </Container>

      <Container className="p-4 sm:p-6">
        <section aria-labelledby="launch-color-heading" className="rounded-lg border border-ui-border-base bg-ui-bg-base p-4 sm:p-5">
          <Heading id="launch-color-heading" level="h2">Color de fondo global</Heading>
          <Text size="small" className="text-ui-fg-subtle mt-1">
            Fondo de la sección de lanzamientos en Store. Elige uno de los colores históricos o usa un hexadecimal.
          </Text>
          <div className="mt-4 flex max-w-3xl flex-col gap-y-4">
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Colores predefinidos">
              {HERO_COLOR_PRESETS.map((color) => {
                const selected = colorDraft.toLowerCase() === color.toLowerCase()
                return (
                  <button
                    key={color}
                    type="button"
                    aria-label={`Usar color ${color}`}
                    aria-pressed={selected}
                    title={color}
                    className={`h-8 w-8 rounded-md border-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-border-interactive ${selected ? "border-ui-fg-interactive" : "border-ui-border-base"}`}
                    style={{ backgroundColor: color }}
                    onClick={() => {
                      setColorDraft(color)
                      setSettingsError(null)
                    }}
                  />
                )
              })}
            </div>
            <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-y-1">
              <label htmlFor="launch-color-picker" className="text-ui-fg-subtle text-xs font-medium">
                Selector de color
              </label>
              <Input
                id="launch-color-picker"
                type="color"
                className="h-9 w-16 p-1"
                value={expandHexColor(colorDraft)}
                onChange={(event) => {
                  setColorDraft(event.target.value.toUpperCase())
                  setSettingsError(null)
                }}
              />
            </div>
            <div className="flex min-w-48 flex-1 flex-col gap-y-1">
              <label htmlFor="launch-color-hex" className="text-ui-fg-subtle text-xs font-medium">
                Color hexadecimal
              </label>
              <Input
                id="launch-color-hex"
                value={colorDraft}
                maxLength={7}
                placeholder="#00AFAA"
                onChange={(event) => {
                  setColorDraft(event.target.value)
                  setSettingsError(null)
                }}
                aria-invalid={!colorValid}
              />
            </div>
            <Button
              size="small"
              onClick={() => void saveSettings()}
              isLoading={settingsSaving}
              disabled={!colorValid}
            >
              Guardar color
            </Button>
            </div>
            {!colorValid && (
              <Text size="small" role="alert" className="text-ui-fg-error">
                Usa un color hexadecimal #RGB o #RRGGBB.
              </Text>
            )}
            {settingsError && (
              <Text size="small" role="alert" className="text-ui-fg-error">
                {settingsError}
              </Text>
            )}
            <div className="flex items-center gap-2">
              <span
                aria-hidden
                className="border-ui-border-base inline-block h-6 w-6 rounded border"
                style={{ backgroundColor: colorValid ? colorDraft : "#00afaa" }}
              />
              <Text size="small" className="text-ui-fg-subtle">
                Valor persistido:{" "}
                <span className="font-mono">{settings?.background_color ?? "sin configurar"}</span>
              </Text>
            </div>
          </div>
        </section>
      </Container>

      <Container className="p-4 sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <Heading level="h2">Lanzamientos</Heading>
          {!loading && <Text size="small" className="text-ui-fg-subtle">{launches.length} en orden global</Text>}
        </div>
        {loading && launches.length === 0 ? (
          <Text className="text-ui-fg-subtle mt-4" role="status">
            Cargando lanzamientos…
          </Text>
        ) : launches.length === 0 ? (
          <div className="mt-4 rounded-lg border border-dashed border-ui-border-base p-8 text-center">
            <Text size="small" className="text-ui-fg-subtle">
              Aún no hay lanzamientos. Crea el primero para que aparezca en la portada.
            </Text>
            <Button className="mt-4" size="small" onClick={startNew}>Crear primer lanzamiento</Button>
          </div>
        ) : (
          <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Lanzamientos">
            {launches.map((launch, index) => {
              const product = launch.product_id ? productNames[launch.product_id] : undefined
              const previewUrl = launch.image_resolved_url ?? product?.thumbnail ?? null
              return (
                <li
                  key={launch.id}
                  data-testid={`launch-item-${launch.id}`}
                  className="border-ui-border-base bg-ui-bg-base flex min-w-0 flex-col overflow-hidden rounded-lg border"
                >
                  <div className="bg-ui-bg-subtle aspect-[4/3] overflow-hidden">
                    {previewUrl ? (
                      <img
                        src={previewUrl}
                        alt={`Imagen de ${launch.title}`}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center p-4 text-center">
                        <Text size="small" className="text-ui-fg-subtle">Sin imagen</Text>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col gap-y-3 p-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Text weight="plus" className="line-clamp-2">
                          {launch.title}
                        </Text>
                        <Badge color={launch.active ? "green" : "grey"}>
                          {launch.active ? "Activo" : "Inactivo"}
                        </Badge>
                      </div>
                      {launch.description && (
                        <Text size="small" className="text-ui-fg-subtle mt-2 line-clamp-2">
                          {launch.description}
                        </Text>
                      )}
                      <Text size="xsmall" className="text-ui-fg-subtle mt-2 line-clamp-1">
                        {product ? `Producto: ${product.title}` : launch.product_id ? `Producto: ${launch.product_id}` : "Imagen propia"}
                      </Text>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <Text size="xsmall" className="text-ui-fg-subtle">Orden {index + 1}</Text>
                      <div className="flex items-center gap-1">
                    <Button
                      size="small"
                      variant="secondary"
                      aria-label={`Subir ${launch.title}`}
                      disabled={index === 0 || reordering}
                      onClick={() => void move(index, -1)}
                    >
                      Subir
                    </Button>
                    <Button
                      size="small"
                      variant="secondary"
                      aria-label={`Bajar ${launch.title}`}
                      disabled={index === launches.length - 1 || reordering}
                      onClick={() => void move(index, 1)}
                    >
                      Bajar
                    </Button>
                      </div>
                    </div>
                    <div className="mt-auto flex flex-wrap gap-2">
                    <Button
                      size="small"
                      variant="secondary"
                      isLoading={changingId === launch.id}
                      disabled={deletingId === launch.id || reordering}
                      onClick={() => void toggleActive(launch)}
                    >
                      {launch.active ? "Desactivar" : "Activar"}
                    </Button>
                    <Button
                      size="small"
                      variant="secondary"
                      aria-label={`Editar ${launch.title}`}
                      onClick={() => startEditing(launch)}
                    >
                      Editar
                    </Button>
                    <Button size="small" variant="danger" isLoading={deletingId === launch.id} disabled={changingId === launch.id || reordering} onClick={() => void remove(launch)}>
                      Eliminar
                    </Button>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Container>

    </div>
  )
}

export const config = defineRouteConfig({
  label: "Nuevos lanzamientos",
  icon: RocketLaunch,
  rank: 70,
})

export default LaunchesPage
