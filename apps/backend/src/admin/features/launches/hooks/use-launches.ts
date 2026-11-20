import { useCallback, useEffect, useState } from "react"
import { errorMessage } from "@admin/shared/lib/admin-api"
import { fetchLaunchesAndSettings, fetchProductNames } from "../api"
import {
  DEFAULT_LAUNCH_COLOR,
  type Launch,
  type LaunchSettings,
  type ProductOption,
} from "../types"

/**
 * Consulta de Nuevos Lanzamientos. `load` es la única fuente de verdad:
 * refresca lanzamientos, ajustes globales y nombres de los productos asociados
 * cada vez que una mutación termina.
 */
export function useLaunches() {
  const [launches, setLaunches] = useState<Launch[]>([])
  const [settings, setSettings] = useState<LaunchSettings | null>(null)
  const [productNames, setProductNames] = useState<Record<string, ProductOption>>({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  // Borrador editable del color global; cada carga lo alinea con el persistido.
  const [colorDraft, setColorDraft] = useState(DEFAULT_LAUNCH_COLOR)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { launches: items, settings: current } = await fetchLaunchesAndSettings()
      setLaunches(items)
      setSettings(current)
      setColorDraft(current.background_color)
      setLoadError(null)
      setProductNames(await fetchProductNames(items))
    } catch (error) {
      setLoadError(errorMessage(error, "No se pudieron cargar los lanzamientos."))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  /** Aplica los ajustes recién persistidos sin recargar toda la pantalla. */
  const applySettings = useCallback((next: LaunchSettings) => {
    setSettings(next)
    setColorDraft(next.background_color)
  }, [])

  return {
    launches,
    settings,
    productNames,
    loading,
    loadError,
    colorDraft,
    setColorDraft,
    applySettings,
    load,
  }
}
