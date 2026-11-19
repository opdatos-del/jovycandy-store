import { Container, Heading, Text, toast } from "@medusajs/ui"
import { useCallback, useEffect, useState } from "react"
// eslint-disable-next-line no-restricted-imports -- el Vite del Admin no resuelve el alias @jovy; la ruta relativa cruzando grupos es necesaria
import { adminRequest, errorMessage } from "../../../jovy/components/admin-api"
import { CorporateMessageForm } from "./corporate-message-form"

/**
 * Mensaje corporativo ES/EN que se muestra bajo la animación del Hero. Se
 * administra en Marketing porque pertenece al Hero, no a los anuncios de
 * portada; el backend lo sigue persistiendo en `/admin/jovy/announcements/settings`
 * para no duplicar el contrato ni el modelo de datos.
 */

type AnnouncementSettings = {
  corporate_message_es: string | null
  corporate_message_en: string | null
}

export const CorporateMessagePanel = () => {
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
      const result = await adminRequest<{ announcement_settings?: AnnouncementSettings }>(
        "/admin/jovy/announcements/settings",
      )
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
      await adminRequest("/admin/jovy/announcements/settings", {
        method: "PUT",
        body: JSON.stringify({
          corporate_message_es: es.trim() || null,
          corporate_message_en: en.trim() || null,
        }),
      })
      const persisted = await adminRequest<{ announcement_settings: AnnouncementSettings }>(
        "/admin/jovy/announcements/settings",
      )
      applySettings(persisted.announcement_settings)
      toast.success("Mensaje corporativo guardado.")
    } catch (error) {
      const message = errorMessage(error, "No se pudo guardar el mensaje corporativo.")
      setSaveError(message)
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Container className="p-6" data-testid="marketing-corporate-block">
      <Heading level="h2">Mensaje corporativo</Heading>
      <Text size="small" className="text-ui-fg-subtle mt-1">
        Texto breve bajo la animación de portada, en español e inglés.
      </Text>

      {loadError && (
        <p role="alert" className="text-ui-fg-error mt-3 text-sm">
          {loadError}
        </p>
      )}
      {loadWarning && (
        <p role="status" className="text-ui-fg-subtle mt-3 text-sm">
          {loadWarning}
        </p>
      )}

      <div className="mt-4">
        {loading && !settings ? (
          <Text className="text-ui-fg-subtle" role="status">
            Cargando mensaje corporativo…
          </Text>
        ) : (
          <CorporateMessageForm
            es={es}
            en={en}
            saving={saving}
            error={saveError}
            invalid={invalid}
            onChangeEs={setEs}
            onChangeEn={setEn}
            onSave={() => void save()}
          />
        )}
      </div>
    </Container>
  )
}
