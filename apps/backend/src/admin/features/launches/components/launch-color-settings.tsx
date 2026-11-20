import { Button, Container, Heading, Input, Text } from "@medusajs/ui"
import { expandHexColor } from "@admin/shared/lib/color"
import { DEFAULT_LAUNCH_COLOR, HERO_COLOR_PRESETS, type LaunchSettings } from "../types"

type Props = {
  settings: LaunchSettings | null
  colorDraft: string
  colorValid: boolean
  saving: boolean
  error: string | null
  onChange: (color: string) => void
  onSave: () => void
}

/**
 * Color de fondo de la sección de lanzamientos en Store. Los presets son la
 * paleta histórica y el hexadecimal libre permite cualquier color válido.
 */
export const LaunchColorSettings = ({
  settings,
  colorDraft,
  colorValid,
  saving,
  error,
  onChange,
  onSave,
}: Props) => (
  <Container className="p-4 sm:p-6">
    <section aria-labelledby="launch-color-heading" className="jovy-card rounded-lg border border-ui-border-base bg-ui-bg-base p-4 sm:p-5">
      <Heading id="launch-color-heading" level="h2" className="jovy-subtitle">Color de fondo global</Heading>
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
                onClick={() => onChange(color)}
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
              onChange={(event) => onChange(event.target.value.toUpperCase())}
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
              onChange={(event) => onChange(event.target.value)}
              aria-invalid={!colorValid}
            />
          </div>
          <Button
            size="small"
            onClick={onSave}
            isLoading={saving}
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
        {error && (
          <Text size="small" role="alert" className="text-ui-fg-error">
            {error}
          </Text>
        )}
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="border-ui-border-base inline-block h-6 w-6 rounded border"
            style={{ backgroundColor: colorValid ? colorDraft : DEFAULT_LAUNCH_COLOR }}
          />
          <Text size="small" className="text-ui-fg-subtle">
            Valor persistido:{" "}
            <span className="font-mono">{settings?.background_color ?? "sin configurar"}</span>
          </Text>
        </div>
      </div>
    </section>
  </Container>
)
