import { Container, Heading, Text, toast } from "@medusajs/ui"
import { useCorporateMessage } from "../hooks/use-corporate-message"
import { CorporateMessageForm } from "./corporate-message-form"

/**
 * Mensaje corporativo ES/EN que se muestra bajo la animación del Hero. Se
 * administra en Marketing porque pertenece al Hero, no a los anuncios de
 * portada; el backend lo sigue persistiendo en `/admin/jovy/announcements/settings`
 * para no duplicar el contrato ni el modelo de datos.
 */
export const CorporateMessagePanel = () => {
  const message = useCorporateMessage()

  const save = async () => {
    const error = await message.save()
    if (error) {
      toast.error(error)
      return
    }
    toast.success("Mensaje corporativo guardado.")
  }

  return (
    <Container className="p-6" data-testid="marketing-corporate-block">
      <Heading level="h2">Mensaje corporativo</Heading>
      <Text size="small" className="text-ui-fg-subtle mt-1">
        Texto breve bajo la animación de portada, en español e inglés.
      </Text>

      {message.loadError && (
        <p role="alert" className="text-ui-fg-error mt-3 text-sm">
          {message.loadError}
        </p>
      )}
      {message.loadWarning && (
        <p role="status" className="text-ui-fg-subtle mt-3 text-sm">
          {message.loadWarning}
        </p>
      )}

      <div className="mt-4">
        {message.loading && !message.settings ? (
          <Text className="text-ui-fg-subtle" role="status">
            Cargando mensaje corporativo…
          </Text>
        ) : (
          <CorporateMessageForm
            es={message.es}
            en={message.en}
            saving={message.saving}
            error={message.saveError}
            invalid={message.invalid}
            onChangeEs={message.setEs}
            onChangeEn={message.setEn}
            onSave={() => void save()}
          />
        )}
      </div>
    </Container>
  )
}
