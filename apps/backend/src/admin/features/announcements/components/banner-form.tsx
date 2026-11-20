import { ExclamationCircle, Photo } from "@medusajs/icons"
import { Button, Container, Heading, Input, Switch, Text, Textarea } from "@medusajs/ui"
import { useEffect, useState } from "react"
import { errorMessage } from "@admin/shared/lib/admin-api"
import { MARKETING_IMAGE_ACCEPT } from "@admin/shared/lib/media"
import { fetchBannerMediaUrl, uploadBannerImage, validateBannerImage } from "../api"
import {
  ALT_MAX,
  CTA_LABEL_MAX,
  CTA_URL_MAX,
  DESCRIPTION_MAX,
  FIELD_ID,
  FIELD_ORDER,
  PRIORITY_MAX,
  ROTATION_PRESETS,
  TITLE_MAX,
  draftFromBanner,
  emptyBanner,
  labelClass,
  selectClass,
  toDateTimeLocal,
  toIso,
  validateDraft,
  vigenciaLabel,
  type Banner,
  type BannerDraft,
  type Frequency,
  type LocalizedBannerContent,
  type Slot,
  type Status,
} from "../types"

export type BannerFormProps = {
  initial: Banner | null
  defaultSlot: Slot
  saving: boolean
  error: string | null
  onCancel: () => void
  onSubmit: (draft: BannerDraft) => void
}

export const BannerForm = ({
  initial,
  defaultSlot,
  saving,
  error,
  onCancel,
  onSubmit,
}: BannerFormProps) => {
  const [draft, setDraft] = useState<BannerDraft>(() =>
    initial ? draftFromBanner(initial) : emptyBanner(defaultSlot),
  )
  const [attempted, setAttempted] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)

  const [mediaReady, setMediaReady] = useState(false)

  useEffect(() => {
    let active = true
    const mediaId = initial?.media_file_id
    if (!mediaId) return () => { active = false }

    setMediaReady(false)
    fetchBannerMediaUrl(mediaId)
      .then((url) => {
        if (!active) return
        setPreviewUrl(url)
        setPreviewError(null)
      })
      .catch(() => {
        if (!active) return
        setPreviewError("No fue posible recuperar la vista previa del archivo asociado.")
      })
      .finally(() => {
        if (active) setMediaReady(true)
      })

    return () => {
      active = false
    }
  }, [initial?.media_file_id])

  const errors = validateDraft(draft)
  const errorCount = Object.keys(errors).length
  const visibleErrors = attempted ? errors : {}

  const update = (patch: Partial<BannerDraft>) => setDraft((current) => ({ ...current, ...patch }))
  const updateTranslation = (language: "es" | "en", patch: Partial<LocalizedBannerContent>) =>
    setDraft((current) => ({
      ...current,
      translations: {
        ...current.translations,
        [language]: { ...current.translations[language], ...patch },
      },
    }))

  const upload = async (file?: File) => {
    if (!file) return
    setUploadError(null)

    const validationError = validateBannerImage(file)
    if (validationError) {
      setUploadError(validationError)
      return
    }

    setUploading(true)
    try {
      const result = await uploadBannerImage(file)
      update({ media_file_id: result.id })
      setPreviewUrl(result.url)
      setPreviewError(null)
    } catch (reason) {
      setUploadError(errorMessage(reason, "No se pudo cargar la imagen."))
    } finally {
      setUploading(false)
    }
  }

  const setSlot = (slot: Slot) => {
    // `auto_open` y `frequency` solo tienen sentido en el modal.
    setDraft((current) => ({
      ...current,
      slot,
      auto_open: slot === "promo" ? current.auto_open : false,
      frequency: slot === "promo" ? current.frequency : "every",
    }))
  }

  /**
   * Presets de vigencia. Escriben las mismas fechas locales que edita el
   * usuario (minuto exacto, como los inputs `datetime-local`).
   */
  const applyDatePreset = (days: number) => {
    const start = new Date()
    const end = new Date(start.getTime() + days * 24 * 60 * 60 * 1000)
    update({
      starts_at: toIso(toDateTimeLocal(start.toISOString())),
      ends_at: toIso(toDateTimeLocal(end.toISOString())),
    })
  }

  const submit = () => {
    if (uploading) return
    setAttempted(true)
    const currentErrors = validateDraft(draft)
    const firstError = FIELD_ORDER.find((field) => currentErrors[field])
    if (firstError) {
      document.getElementById(FIELD_ID[firstError])?.focus()
      return
    }
    onSubmit(draft)
  }

  const title = initial ? "Editar banner" : "Nuevo banner"

  return (
    <Container className="p-4 sm:p-6" data-testid="banner-form-panel">
      <div className="border-ui-border-base mb-6 flex flex-wrap items-start gap-3 border-b pb-4">
        <Button type="button" variant="transparent" size="small" onClick={onCancel} disabled={saving}>
          ← Volver a banners
        </Button>
        <div>
          <Heading level="h1">{title}</Heading>
          <Text size="small" className="text-ui-fg-subtle mt-1">
            Contenido bilingüe, multimedia, CTA, programación y prioridad. Publica cuando la ventana
            y los textos estén listos.
          </Text>
        </div>
      </div>

      <form
        id="banner-form"
        data-testid="banner-form"
        className="flex max-w-5xl flex-col gap-y-4"
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
      >
        {(error || (attempted && errorCount > 0)) && (
          <p role="alert" className="text-ui-fg-error text-sm">
            {error ??
              `Revisa ${errorCount === 1 ? "el campo marcado" : `los ${errorCount} campos marcados`} antes de guardar.`}
          </p>
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <section
            aria-labelledby="banner-media-heading"
            className="border-ui-border-base bg-ui-bg-base flex flex-col gap-y-3 rounded-lg border p-4 sm:p-5"
          >
            <div>
              <Heading level="h2" id="banner-media-heading" className="text-base">
                Multimedia y vista previa
              </Heading>
              <Text size="xsmall" className="text-ui-fg-subtle mt-1">
                PNG, JPEG o WebP de hasta 5 MB. La imagen se muestra tal cual en el modal: no se
                recorta.
              </Text>
            </div>

            <div className="flex flex-col gap-y-1">
              <label htmlFor="banner-media" className={labelClass}>
                Imagen del banner
              </label>
              <Input
                id="banner-media"
                type="file"
                accept={MARKETING_IMAGE_ACCEPT}
                disabled={uploading || saving}
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  void upload(file)
                  event.target.value = ""
                }}
              />
              {uploading && (
                <Text size="xsmall" className="text-ui-fg-subtle" role="status">
                  Subiendo imagen…
                </Text>
              )}
              {uploadError && (
                <Text size="small" role="alert" className="text-ui-fg-error">
                  {uploadError}
                </Text>
              )}
              {previewError && (
                <Text size="small" role="alert" className="text-ui-fg-error">
                  {previewError}
                </Text>
              )}
            </div>

            <div className="bg-ui-bg-subtle border-ui-border-base flex aspect-[16/10] items-center justify-center overflow-hidden rounded-md border">
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Vista previa del banner"
                  className="h-full w-full object-contain"
                />
              ) : (
                <div className="flex flex-col items-center gap-1 p-4 text-center">
                  <Photo aria-hidden className="text-ui-fg-muted h-7 w-7" />
                  <Text size="xsmall" className="text-ui-fg-subtle">
                    {draft.media_file_id
                      ? mediaReady
                        ? "Sin vista previa disponible"
                        : "Cargando vista previa…"
                      : "Sin imagen asociada"}
                  </Text>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {draft.media_file_id && (
                <Button
                  type="button"
                  size="small"
                  variant="secondary"
                  onClick={() => {
                    update({ media_file_id: null })
                    setPreviewUrl(null)
                    setPreviewError(null)
                  }}
                  disabled={uploading || saving}
                >
                  Quitar imagen del banner
                </Button>
              )}
              <Text size="xsmall" className="text-ui-fg-subtle">
                El archivo anterior no se borra del File Module.
              </Text>
            </div>

            <Text size="xsmall" className="text-ui-fg-subtle border-ui-border-base border-t pt-3">
              Diferencia pendiente con el administrador histórico: el recorte y zoom del banner
              (<code className="font-mono">crop_zoom</code>, offsets y{" "}
              <code className="font-mono">original_src</code>) no existen en este backend. Sube la
              imagen ya recortada; no se simula persistencia del ajuste.
            </Text>
          </section>

          <section
            aria-labelledby="banner-distribution-heading"
            className="border-ui-border-base bg-ui-bg-base flex flex-col gap-y-4 rounded-lg border p-4 sm:p-5"
          >
            <div>
              <Heading level="h2" id="banner-distribution-heading" className="text-base">
                Distribución y activación
              </Heading>
              <Text size="xsmall" className="text-ui-fg-subtle mt-1">
                La ubicación decide dónde aparece; la prioridad domina el orden de presentación.
              </Text>
            </div>

            <div className="flex flex-col gap-y-1">
              <label htmlFor="banner-slot" className={labelClass}>
                ¿Dónde aparece?
              </label>
              <select
                id="banner-slot"
                aria-label="¿Dónde aparece?"
                className={selectClass}
                value={draft.slot}
                onChange={(event) => setSlot(event.target.value as Slot)}
              >
                <option value="hint">Bajo el logo (fijo)</option>
                <option value="promo">Modal de entrada</option>
              </select>
              <Text size="xsmall" className="text-ui-fg-subtle">
                {draft.slot === "promo"
                  ? "El modal se abre solo si está publicado, habilitado, dentro de sus fechas y con apertura automática."
                  : "El banner bajo el logo siempre está visible en la portada mientras esté publicado y habilitado."}
              </Text>
            </div>

            <div className="flex flex-col gap-y-1">
              <label htmlFor="banner-rotation-seconds" className={labelClass}>
                Duración en pantalla
              </label>
              <select
                id="banner-rotation-seconds"
                aria-label="Duración en pantalla"
                className={selectClass}
                aria-invalid={Boolean(visibleErrors.rotationSeconds)}
                aria-describedby={
                  visibleErrors.rotationSeconds ? "banner-rotation-seconds-error" : undefined
                }
                value={String(draft.rotation_seconds)}
                onChange={(event) => update({ rotation_seconds: Number(event.target.value) })}
              >
                {/* Si el valor persistido no es un preset, se conserva como opción para no perderlo. */}
                {Array.from(new Set([...ROTATION_PRESETS, draft.rotation_seconds]))
                  .sort((a, b) => a - b)
                  .map((seconds) => (
                    <option key={seconds} value={String(seconds)}>
                      {seconds} s
                    </option>
                  ))}
              </select>
              {visibleErrors.rotationSeconds ? (
                <Text
                  id="banner-rotation-seconds-error"
                  role="alert"
                  size="xsmall"
                  className="text-ui-fg-error"
                >
                  {visibleErrors.rotationSeconds}
                </Text>
              ) : (
                <Text size="xsmall" className="text-ui-fg-subtle">
                  Se usa cuando hay más de un anuncio en este lugar; con uno solo no rota.
                </Text>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-y-1">
                <label htmlFor="banner-priority" className={labelClass}>
                  Prioridad Banner
                </label>
                <Input
                  id="banner-priority"
                  type="number"
                  min={0}
                  max={PRIORITY_MAX}
                  step={1}
                  aria-label="Prioridad Banner"
                  aria-invalid={Boolean(visibleErrors.priority)}
                  aria-describedby={visibleErrors.priority ? "banner-priority-error" : undefined}
                  value={draft.priority}
                  onChange={(event) => update({ priority: Number(event.target.value) })}
                />
                {visibleErrors.priority ? (
                  <Text id="banner-priority-error" role="alert" size="xsmall" className="text-ui-fg-error">
                    {visibleErrors.priority}
                  </Text>
                ) : (
                  <Text size="xsmall" className="text-ui-fg-subtle">
                    De 0 a {PRIORITY_MAX}. Mayor gana.
                  </Text>
                )}
              </div>

              <div className="flex flex-col gap-y-1">
                <label htmlFor="banner-sort-order" className={labelClass}>
                  Orden Banner
                </label>
                <Input
                  id="banner-sort-order"
                  type="number"
                  min={0}
                  step={1}
                  aria-label="Orden Banner"
                  aria-invalid={Boolean(visibleErrors.sortOrder)}
                  aria-describedby={visibleErrors.sortOrder ? "banner-sort-order-error" : undefined}
                  value={draft.sort_order}
                  onChange={(event) => update({ sort_order: Number(event.target.value) })}
                />
                {visibleErrors.sortOrder && (
                  <Text id="banner-sort-order-error" role="alert" size="xsmall" className="text-ui-fg-error">
                    {visibleErrors.sortOrder}
                  </Text>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-y-1">
              <label htmlFor="banner-status" className={labelClass}>
                Estado Banner
              </label>
              <select
                id="banner-status"
                aria-label="Estado Banner"
                className={selectClass}
                value={draft.status}
                onChange={(event) => update({ status: event.target.value as Status })}
              >
                <option value="draft">Borrador</option>
                <option value="published">Publicado</option>
                <option value="archived">Archivado</option>
              </select>
            </div>

            <div className="border-ui-border-base flex items-center justify-between gap-3 rounded-md border px-3 py-3">
              <div>
                <span className="text-sm font-medium">Activo Banner</span>
                <Text size="xsmall" className="text-ui-fg-subtle">
                  Si está deshabilitado, no se muestra aunque esté publicado.
                </Text>
              </div>
              <Switch
                id="banner-enabled"
                aria-label="Activo Banner"
                checked={draft.enabled}
                onCheckedChange={(checked) => update({ enabled: checked })}
              />
            </div>

            {draft.slot === "promo" && (
              <div className="border-ui-border-base flex flex-col gap-y-3 rounded-md border px-3 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <span className="text-sm font-medium">Apertura automática</span>
                    <Text size="xsmall" className="text-ui-fg-subtle">
                      Solo para el modal. El storefront lo abre a los ~700 ms.
                    </Text>
                  </div>
                  <Switch
                    id="banner-auto-open"
                    aria-label="Apertura automática"
                    checked={draft.auto_open}
                    onCheckedChange={(checked) => update({ auto_open: checked })}
                  />
                </div>

                <div className="flex flex-col gap-y-1">
                  <label htmlFor="banner-frequency" className={labelClass}>
                    Frecuencia Banner
                  </label>
                  <select
                    id="banner-frequency"
                    aria-label="Frecuencia Banner"
                    className={selectClass}
                    value={draft.frequency}
                    onChange={(event) => update({ frequency: event.target.value as Frequency })}
                  >
                    <option value="every">Cada recarga completa</option>
                    <option value="session">Una vez por sesión</option>
                    <option value="daily">Una vez al día</option>
                    <option value="once">Una vez por navegador</option>
                  </select>
                  <Text size="xsmall" className="text-ui-fg-subtle">
                    La frecuencia controla cuándo se vuelve a abrir el modal, no si está publicado.
                  </Text>
                </div>
              </div>
            )}
          </section>
        </div>

        <section
          aria-labelledby="banner-content-heading"
          className="border-ui-border-base bg-ui-bg-base flex flex-col gap-y-4 rounded-lg border p-4 sm:p-5"
        >
          <div>
            <Heading level="h2" id="banner-content-heading" className="text-base">
              Contenido bilingüe
            </Heading>
            <Text size="xsmall" className="text-ui-fg-subtle mt-1">
              Título, descripción y texto alternativo en español e inglés. Ambos idiomas son
              obligatorios para el título y el alt.
            </Text>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {(["es", "en"] as const).map((language) => {
              const content = draft.translations[language]
              const titleKey = language === "es" ? "esTitle" : "enTitle"
              const altKey = language === "es" ? "esAlt" : "enAlt"
              const descriptionKey = language === "es" ? "esDescription" : "enDescription"
              const ctaLabelKey = language === "es" ? "esCtaLabel" : "enCtaLabel"

              return (
                <fieldset key={language} className="border-ui-border-base flex flex-col gap-y-3 rounded-md border p-3">
                  <legend className="px-1 text-sm font-medium">
                    {language === "es" ? "Español" : "English"}
                  </legend>

                  <div className="flex flex-col gap-y-1">
                    <label htmlFor={FIELD_ID[titleKey]} className={labelClass}>
                      {language === "es" ? "Banner título es" : "Banner título en"}
                    </label>
                    <Input
                      id={FIELD_ID[titleKey]}
                      value={content.title}
                      maxLength={TITLE_MAX}
                      aria-invalid={Boolean(visibleErrors[titleKey])}
                      aria-describedby={visibleErrors[titleKey] ? `${FIELD_ID[titleKey]}-error` : undefined}
                      onChange={(event) => updateTranslation(language, { title: event.target.value })}
                    />
                    <div className="flex items-center justify-between gap-2">
                      {visibleErrors[titleKey] ? (
                        <Text
                          id={`${FIELD_ID[titleKey]}-error`}
                          role="alert"
                          size="xsmall"
                          className="text-ui-fg-error"
                        >
                          {visibleErrors[titleKey]}
                        </Text>
                      ) : (
                        <span />
                      )}
                      <Text size="xsmall" className="text-ui-fg-subtle tabular-nums">
                        {content.title.trim().length}/{TITLE_MAX}
                      </Text>
                    </div>
                  </div>

                  <div className="flex flex-col gap-y-1">
                    <label htmlFor={FIELD_ID[altKey]} className={labelClass}>
                      {language === "es" ? "Texto alternativo Banner es" : "Texto alternativo Banner en"}
                    </label>
                    <Input
                      id={FIELD_ID[altKey]}
                      value={content.alt}
                      maxLength={ALT_MAX}
                      aria-invalid={Boolean(visibleErrors[altKey])}
                      aria-describedby={visibleErrors[altKey] ? `${FIELD_ID[altKey]}-error` : undefined}
                      onChange={(event) => updateTranslation(language, { alt: event.target.value })}
                    />
                    {visibleErrors[altKey] && (
                      <Text
                        id={`${FIELD_ID[altKey]}-error`}
                        role="alert"
                        size="xsmall"
                        className="text-ui-fg-error"
                      >
                        {visibleErrors[altKey]}
                      </Text>
                    )}
                  </div>

                  <div className="flex flex-col gap-y-1">
                    <label htmlFor={FIELD_ID[descriptionKey]} className={labelClass}>
                      {language === "es" ? "Banner descripción es" : "Banner descripción en"}
                    </label>
                    <Textarea
                      id={FIELD_ID[descriptionKey]}
                      value={content.description ?? ""}
                      maxLength={DESCRIPTION_MAX}
                      aria-invalid={Boolean(visibleErrors[descriptionKey])}
                      aria-describedby={
                        visibleErrors[descriptionKey] ? `${FIELD_ID[descriptionKey]}-error` : undefined
                      }
                      onChange={(event) => updateTranslation(language, { description: event.target.value })}
                    />
                    <div className="flex items-center justify-between gap-2">
                      {visibleErrors[descriptionKey] ? (
                        <Text
                          id={`${FIELD_ID[descriptionKey]}-error`}
                          role="alert"
                          size="xsmall"
                          className="text-ui-fg-error"
                        >
                          {visibleErrors[descriptionKey]}
                        </Text>
                      ) : (
                        <span />
                      )}
                      <Text size="xsmall" className="text-ui-fg-subtle tabular-nums">
                        {(content.description ?? "").length}/{DESCRIPTION_MAX}
                      </Text>
                    </div>
                  </div>

                  <div className="flex flex-col gap-y-1">
                    <label htmlFor={FIELD_ID[ctaLabelKey]} className={labelClass}>
                      {language === "es" ? "Etiqueta CTA es" : "Etiqueta CTA en"}
                    </label>
                    <Input
                      id={FIELD_ID[ctaLabelKey]}
                      value={content.cta_label ?? ""}
                      maxLength={CTA_LABEL_MAX}
                      aria-invalid={Boolean(visibleErrors[ctaLabelKey])}
                      aria-describedby={visibleErrors[ctaLabelKey] ? `${FIELD_ID[ctaLabelKey]}-error` : undefined}
                      onChange={(event) => updateTranslation(language, { cta_label: event.target.value })}
                    />
                    {visibleErrors[ctaLabelKey] && (
                      <Text
                        id={`${FIELD_ID[ctaLabelKey]}-error`}
                        role="alert"
                        size="xsmall"
                        className="text-ui-fg-error"
                      >
                        {visibleErrors[ctaLabelKey]}
                      </Text>
                    )}
                  </div>
                </fieldset>
              )
            })}
          </div>
        </section>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <section
            aria-labelledby="banner-cta-heading"
            className="border-ui-border-base bg-ui-bg-base flex flex-col gap-y-3 rounded-lg border p-4 sm:p-5"
          >
            <div>
              <Heading level="h2" id="banner-cta-heading" className="text-base">
                CTA
              </Heading>
              <Text size="xsmall" className="text-ui-fg-subtle mt-1">
                Destino del botón. Acepta rutas relativas (<code className="font-mono">/tienda</code>)
                o HTTPS.
              </Text>
            </div>
            <div className="flex flex-col gap-y-1">
              <label htmlFor="banner-cta-url" className={labelClass}>
                CTA Banner
              </label>
              <Input
                id="banner-cta-url"
                value={draft.cta_url ?? ""}
                placeholder="/tienda o https://…"
                maxLength={CTA_URL_MAX}
                aria-label="CTA Banner"
                aria-invalid={Boolean(visibleErrors.ctaUrl)}
                aria-describedby={visibleErrors.ctaUrl ? "banner-cta-url-error" : undefined}
                onChange={(event) => update({ cta_url: event.target.value || null })}
              />
              {visibleErrors.ctaUrl && (
                <Text id="banner-cta-url-error" role="alert" size="xsmall" className="text-ui-fg-error">
                  {visibleErrors.ctaUrl}
                </Text>
              )}
            </div>
          </section>

          <section
            aria-labelledby="banner-schedule-heading"
            className="border-ui-border-base bg-ui-bg-base flex flex-col gap-y-3 rounded-lg border p-4 sm:p-5"
          >
            <div>
              <Heading level="h2" id="banner-schedule-heading" className="text-base">
                Programación
              </Heading>
              <Text size="xsmall" className="text-ui-fg-subtle mt-1">
                Opcional. Se guarda en UTC; el formulario usa tu hora local. Sin fechas, permanece
                hasta que lo desactives.
              </Text>
            </div>

            <div className="flex flex-wrap gap-2" role="group" aria-label="Presets de vigencia">
              <Button
                type="button"
                size="small"
                variant="secondary"
                onClick={() => update({ starts_at: null, ends_at: null })}
              >
                Permanente
              </Button>
              <Button
                type="button"
                size="small"
                variant="secondary"
                onClick={() => applyDatePreset(7)}
              >
                1 semana
              </Button>
              <Button
                type="button"
                size="small"
                variant="secondary"
                onClick={() => applyDatePreset(14)}
              >
                2 semanas
              </Button>
              <Button
                type="button"
                size="small"
                variant="secondary"
                onClick={() => document.getElementById("banner-starts-at")?.focus()}
              >
                Personalizado
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-y-1">
                <label htmlFor="banner-starts-at" className={labelClass}>
                  Inicio Banner
                </label>
                <Input
                  id="banner-starts-at"
                  type="datetime-local"
                  aria-label="Inicio Banner"
                  aria-invalid={Boolean(visibleErrors.startsAt)}
                  value={toDateTimeLocal(draft.starts_at)}
                  onChange={(event) => update({ starts_at: toIso(event.target.value) })}
                />
                {visibleErrors.startsAt && (
                  <Text role="alert" size="xsmall" className="text-ui-fg-error">
                    {visibleErrors.startsAt}
                  </Text>
                )}
              </div>

              <div className="flex flex-col gap-y-1">
                <label htmlFor="banner-ends-at" className={labelClass}>
                  Fin Banner
                </label>
                <Input
                  id="banner-ends-at"
                  type="datetime-local"
                  aria-label="Fin Banner"
                  aria-invalid={Boolean(visibleErrors.endsAt)}
                  aria-describedby={visibleErrors.endsAt ? "banner-ends-at-error" : undefined}
                  value={toDateTimeLocal(draft.ends_at)}
                  onChange={(event) => update({ ends_at: toIso(event.target.value) })}
                />
                {visibleErrors.endsAt && (
                  <Text id="banner-ends-at-error" role="alert" size="xsmall" className="text-ui-fg-error">
                    {visibleErrors.endsAt}
                  </Text>
                )}
              </div>
            </div>

            <Text size="xsmall" className="text-ui-fg-subtle">
              Vigencia: {vigenciaLabel(draft)}
            </Text>
          </section>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" isLoading={saving} disabled={uploading}>
            {initial ? "Guardar cambios" : "Crear Banner"}
          </Button>
          <Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>
            Cancelar
          </Button>
          {errorCount > 0 && attempted && (
            <Text size="small" className="text-ui-fg-subtle">
              <ExclamationCircle aria-hidden className="mr-1 inline h-4 w-4" />
              Hay campos por corregir.
            </Text>
          )}
        </div>
      </form>
    </Container>
  )
}
