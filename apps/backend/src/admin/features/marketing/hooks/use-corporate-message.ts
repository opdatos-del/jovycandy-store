import { useCallback, useEffect, useState } from "react"
import { errorMessage } from "@admin/shared/lib/admin-api"
import { marketingApi } from "../api"
import type { AnnouncementSettings } from "../types"

/**
 * Mensaje corporativo bilingüe bajo la animación del Hero. Vive en Marketing
 * pero se persiste en la configuración de anuncios para no duplicar contrato.
 */
export function useCorporateMessage() {
  const [settings, setSettings] = useState<AnnouncementSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loadWarning, setLoadWarning] = useState<string | null>(null)
  const [es, setEs] = useState("")
  const [en, setEn] = useState("")
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const applySettings = (value: AnnouncementSettings) => {
    setSettings(value)
    setEs(value.corporate_message_es ?? "")
    setEn(value.corporate_message_en ?? "")
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await marketingApi.getCorporateMessage()
      if (result.announcement_settings) {
        applySettings(result.announcement_settings)
        setLoadWarning(null)
      } else {
        // Respuesta sin cuerpo útil: el formulario queda vacío en lugar de fallar.
        applySettings({ corporate_message_es: null, corporate_message_en: null })
        setLoadWarning("La configuración llegó vacía; los campos se muestran en blanco.")
      }
      setLoadError(null)
    } catch (error) {
      setLoadError(errorMessage(error, "No se pudo cargar la configuración de anuncios."))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const isValidMessage = (value: string) => {
    const length = value.trim().length
    return length === 0 || length >= 2
  }
  const invalid = !isValidMessage(es) || !isValidMessage(en)

  const save = async () => {
    if (invalid) return

    setSaving(true)
    setSaveError(null)
    try {
      await marketingApi.saveCorporateMessage({
        corporate_message_es: es.trim() || null,
        corporate_message_en: en.trim() || null,
      })
      const persisted = await marketingApi.getCorporateMessage()
      if (persisted.announcement_settings) applySettings(persisted.announcement_settings)
      return null
    } catch (error) {
      const message = errorMessage(error, "No se pudo guardar el mensaje corporativo.")
      setSaveError(message)
      return message
    } finally {
      setSaving(false)
    }
  }

  return {
    settings,
    loading,
    loadError,
    loadWarning,
    es,
    en,
    setEs,
    setEn,
    saving,
    saveError,
    invalid,
    save,
  }
}
