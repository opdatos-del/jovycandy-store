import { Button, Text, Textarea } from "@medusajs/ui"

type Props = {
  es: string
  en: string
  saving: boolean
  error: string | null
  invalid: boolean
  onChangeEs: (value: string) => void
  onChangeEn: (value: string) => void
  onSave: () => void
}

const labelClass = "text-ui-fg-subtle text-xs font-medium"

export const CorporateMessageForm = ({
  es,
  en,
  saving,
  error,
  invalid,
  onChangeEs,
  onChangeEn,
  onSave,
}: Props) => (
  <form
    className="flex max-w-3xl flex-col gap-y-4"
    onSubmit={(event) => {
      event.preventDefault()
      onSave()
    }}
  >
    {error && (
      <p role="alert" className="text-ui-fg-error text-sm">
        {error}
      </p>
    )}

    <div className="flex flex-col gap-y-1">
      <label htmlFor="corporate-message-es" className={labelClass}>
        Mensaje corporativo ES
      </label>
      <Textarea
        id="corporate-message-es"
        maxLength={600}
        value={es}
        placeholder="Texto que aparece bajo la animación de portada en español"
        onChange={(event) => onChangeEs(event.target.value)}
      />
      <Text size="xsmall" className="text-ui-fg-subtle tabular-nums">
        {es.trim().length}/600 · vacío oculta el mensaje en ese idioma
      </Text>
    </div>

    <div className="flex flex-col gap-y-1">
      <label htmlFor="corporate-message-en" className={labelClass}>
        Mensaje corporativo EN
      </label>
      <Textarea
        id="corporate-message-en"
        maxLength={600}
        value={en}
        placeholder="Message shown under the cover animation in English"
        onChange={(event) => onChangeEn(event.target.value)}
      />
      <Text size="xsmall" className="text-ui-fg-subtle tabular-nums">
        {en.trim().length}/600 · vacío oculta el mensaje en ese idioma
      </Text>
    </div>

    {invalid && (
      <Text size="small" role="alert" className="text-ui-fg-error">
        Cada idioma debe tener al menos 2 caracteres o quedar vacío para ocultarlo.
      </Text>
    )}

    <div>
      <Button type="submit" isLoading={saving} disabled={invalid}>
        Guardar mensaje corporativo
      </Button>
    </div>
  </form>
)
