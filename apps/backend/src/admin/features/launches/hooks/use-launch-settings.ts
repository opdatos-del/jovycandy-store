import { toast, usePrompt } from "@medusajs/ui"
import { useState } from "react"
import { errorMessage } from "@admin/shared/lib/admin-api"
import { isValidHexColor } from "@admin/shared/lib/color"
import { fetchLaunchSettings, saveLaunchSettings } from "../api"
import type { LaunchSettings } from "../types"

type Options = {
  colorDraft: string
  setColorDraft: (color: string) => void
  applySettings: (settings: LaunchSettings) => void
}

/**
 * Color de fondo global de la sección en Store. Guarda contra el valor
 * confirmado y relee lo persistido: la confirmación no basta para publicar un
 * color que el servidor normaliza.
 */
export function useLaunchSettings({ colorDraft, setColorDraft, applySettings }: Options) {
  const prompt = usePrompt()
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [settingsError, setSettingsError] = useState<string | null>(null)

  const colorValid = isValidHexColor(colorDraft)

  /** Editar el borrador descarta el error anterior del guardado. */
  const changeColor = (color: string) => {
    setColorDraft(color)
    setSettingsError(null)
  }

  const saveSettings = async () => {
    if (!colorValid) {
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
      await saveLaunchSettings(normalizedColor)
      const persisted = await fetchLaunchSettings()
      applySettings(persisted)
      toast.success(`Color de fondo guardado: ${persisted.background_color}`)
    } catch (error) {
      const message = errorMessage(error, "No se pudo guardar el color de fondo.")
      setSettingsError(message)
      toast.error(message)
    } finally {
      setSettingsSaving(false)
    }
  }

  return { colorValid, settingsSaving, settingsError, changeColor, saveSettings }
}
