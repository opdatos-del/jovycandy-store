/**
 * Tipos, etiquetas, límites y helpers puros de los anuncios de portada.
 * `promo` es el modal de entrada y `hint` el banner fijo bajo el logo.
 */

export type Status = "draft" | "published" | "archived"
export type Slot = "promo" | "hint"
export type Frequency = "every" | "session" | "daily" | "once"

export type LocalizedBannerContent = {
  title: string
  description?: string
  cta_label?: string
  alt: string
}

export type Banner = {
  id: string
  slot: Slot
  status: Status
  enabled: boolean
  auto_open: boolean
  frequency: Frequency
  rotation_seconds: number
  priority: number
  sort_order: number
  media_file_id: string | null
  cta_url: string | null
  starts_at: string | null
  ends_at: string | null
  translations: {
    es: LocalizedBannerContent
    en: LocalizedBannerContent
  }
}

export type BannerDraft = Omit<Banner, "id">

export type SlotFilter = "all" | Slot
export type StatusFilter = "all" | Status

export type WindowState = "active" | "scheduled" | "expired" | "inactive"

export const SLOT_LABEL: Record<Slot, string> = {
  promo: "Modal de entrada",
  hint: "Bajo el logo",
}

export const STATUS_LABEL: Record<Status, string> = {
  draft: "Borrador",
  published: "Publicado",
  archived: "Archivado",
}

export const STATUS_COLOR: Record<Status, "green" | "orange" | "grey"> = {
  draft: "orange",
  published: "green",
  archived: "grey",
}

export const FREQUENCY_LABEL: Record<Frequency, string> = {
  every: "Cada recarga completa",
  session: "Una vez por sesión",
  daily: "Una vez al día",
  once: "Una vez por navegador",
}

export const WINDOW_LABEL: Record<WindowState, string> = {
  active: "Activo ahora",
  scheduled: "Programado",
  expired: "Vencido",
  inactive: "Inactivo",
}

export const WINDOW_COLOR: Record<WindowState, "green" | "blue" | "orange" | "grey"> = {
  active: "green",
  scheduled: "blue",
  expired: "orange",
  inactive: "grey",
}

export const TITLE_MAX = 180
export const DESCRIPTION_MAX = 2_000
export const CTA_LABEL_MAX = 80
export const ALT_MAX = 255
export const CTA_URL_MAX = 500
export const PRIORITY_MAX = 1_000

// Duración en pantalla de cada anuncio cuando el lugar tiene más de uno.
export const ROTATION_MIN = 3
export const ROTATION_MAX = 60
export const ROTATION_DEFAULT = 8
export const ROTATION_PRESETS = [5, 8, 10, 15, 30]

// Clases compartidas por los filtros del gestor y el formulario.
export const labelClass = "text-ui-fg-subtle text-xs font-medium"
export const selectClass =
  "border-ui-border-base bg-ui-bg-base h-8 rounded-md px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-border-interactive"

export const emptyBanner = (slot: Slot = "promo"): BannerDraft => ({
  slot,
  status: "draft",
  enabled: true,
  // La auto-apertura es opt-in: el backend la guarda en `false` por defecto y
  // el modal debe abrirse solo cuando la persona administradora lo decide.
  auto_open: false,
  frequency: "every",
  rotation_seconds: ROTATION_DEFAULT,
  priority: 0,
  sort_order: 0,
  media_file_id: null,
  cta_url: null,
  starts_at: null,
  ends_at: null,
  translations: {
    es: { title: "", description: "", cta_label: "", alt: "" },
    en: { title: "", description: "", cta_label: "", alt: "" },
  },
})

const dateFormatter = new Intl.DateTimeFormat("es-MX", {
  dateStyle: "short",
  timeStyle: "short",
})

export function formatDate(value: string | null) {
  if (!value) return "Sin límite"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "Fecha inválida" : dateFormatter.format(date)
}

/**
 * Vigencia en una línea: sin fechas el anuncio permanece hasta desactivarlo.
 * `formatDate` puede cerrar ya con punto por el sufijo «a.m.»/«p.m.» de `es-MX`,
 * así que la etiqueta garantiza un único punto final y quien la use no añade otro.
 */
export function vigenciaLabel(banner: Pick<Banner, "starts_at" | "ends_at">) {
  const label =
    !banner.starts_at && !banner.ends_at
      ? "Permanente"
      : !banner.ends_at
        ? `Desde ${formatDate(banner.starts_at)}`
        : !banner.starts_at
          ? `Hasta ${formatDate(banner.ends_at)}`
          : `Del ${formatDate(banner.starts_at)} al ${formatDate(banner.ends_at)}`

  return label.endsWith(".") ? label : `${label}.`
}

/**
 * Estado real del banner frente a la ventana de publicación. Un borrador con
 * fecha futura no está "programado": solo se programa lo publicado y habilitado.
 */
export function windowState(
  banner: Pick<Banner, "status" | "enabled" | "starts_at" | "ends_at">,
  now = Date.now(),
): WindowState {
  if (banner.status !== "published" || !banner.enabled) return "inactive"
  const start = banner.starts_at ? new Date(banner.starts_at).getTime() : null
  const end = banner.ends_at ? new Date(banner.ends_at).getTime() : null
  if (start !== null && Number.isFinite(start) && now < start) return "scheduled"
  if (end !== null && Number.isFinite(end) && now > end) return "expired"
  return "active"
}

export function draftFromBanner(banner: Banner): BannerDraft {
  return {
    slot: banner.slot,
    status: banner.status,
    enabled: banner.enabled,
    auto_open: banner.auto_open,
    frequency: banner.frequency,
    rotation_seconds: banner.rotation_seconds ?? ROTATION_DEFAULT,
    priority: banner.priority,
    sort_order: banner.sort_order,
    media_file_id: banner.media_file_id,
    cta_url: banner.cta_url,
    starts_at: banner.starts_at,
    ends_at: banner.ends_at,
    translations: {
      es: { ...banner.translations.es },
      en: { ...banner.translations.en },
    },
  }
}

export function priorityLabel(priority: number) {
  if (priority >= 2) return "Alta"
  if (priority === 1) return "Media"
  return "Baja"
}

/** El Admin es una SPA: el parámetro `slot` de la URL abre el gestor filtrado. */
export function initialSlotFilter(): SlotFilter {
  if (typeof window === "undefined") return "all"
  const slot = new URLSearchParams(window.location.search).get("slot")
  return slot === "promo" || slot === "hint" ? slot : "all"
}

/** `datetime-local` trabaja en hora local; el contrato HTTP usa ISO en UTC. */
export const toDateTimeLocal = (value: string | null) => {
  if (!value) return ""
  const date = new Date(value)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

export const toIso = (value: string) => (value ? new Date(value).toISOString() : null)

export type FieldErrors = Partial<
  Record<
    | "esTitle"
    | "enTitle"
    | "esAlt"
    | "enAlt"
    | "esDescription"
    | "enDescription"
    | "esCtaLabel"
    | "enCtaLabel"
    | "ctaUrl"
    | "startsAt"
    | "endsAt"
    | "rotationSeconds"
    | "priority"
    | "sortOrder",
    string
  >
>

export const FIELD_ORDER: Array<keyof FieldErrors> = [
  "esTitle",
  "enTitle",
  "esAlt",
  "enAlt",
  "esDescription",
  "enDescription",
  "esCtaLabel",
  "enCtaLabel",
  "ctaUrl",
  "startsAt",
  "endsAt",
  "rotationSeconds",
  "priority",
  "sortOrder",
]

export const FIELD_ID: Record<keyof FieldErrors, string> = {
  esTitle: "banner-title-es",
  enTitle: "banner-title-en",
  esAlt: "banner-alt-es",
  enAlt: "banner-alt-en",
  esDescription: "banner-description-es",
  enDescription: "banner-description-en",
  esCtaLabel: "banner-cta-label-es",
  enCtaLabel: "banner-cta-label-en",
  ctaUrl: "banner-cta-url",
  startsAt: "banner-starts-at",
  endsAt: "banner-ends-at",
  rotationSeconds: "banner-rotation-seconds",
  priority: "banner-priority",
  sortOrder: "banner-sort-order",
}

export function validateDraft(draft: BannerDraft): FieldErrors {
  const errors: FieldErrors = {}
  const es = draft.translations.es
  const en = draft.translations.en

  const validateContent = (value: LocalizedBannerContent, language: "es" | "en") => {
    const title = value.title.trim()
    const alt = value.alt.trim()
    if (title.length < 2) {
      errors[language === "es" ? "esTitle" : "enTitle"] =
        `El título en ${language === "es" ? "español" : "inglés"} debe tener al menos 2 caracteres.`
    } else if (title.length > TITLE_MAX) {
      errors[language === "es" ? "esTitle" : "enTitle"] = `El título no puede superar ${TITLE_MAX} caracteres.`
    }
    if (alt.length < 1) {
      errors[language === "es" ? "esAlt" : "enAlt"] =
        "El texto alternativo es obligatorio para accesibilidad."
    } else if (alt.length > ALT_MAX) {
      errors[language === "es" ? "esAlt" : "enAlt"] = `El texto alternativo no puede superar ${ALT_MAX} caracteres.`
    }
    if ((value.description ?? "").length > DESCRIPTION_MAX) {
      errors[language === "es" ? "esDescription" : "enDescription"] =
        `La descripción no puede superar ${DESCRIPTION_MAX} caracteres.`
    }
    if ((value.cta_label ?? "").length > CTA_LABEL_MAX) {
      errors[language === "es" ? "esCtaLabel" : "enCtaLabel"] =
        `La etiqueta del CTA no puede superar ${CTA_LABEL_MAX} caracteres.`
    }
  }

  validateContent(es, "es")
  validateContent(en, "en")

  const cta = draft.cta_url?.trim() ?? ""
  if (cta.length > CTA_URL_MAX) {
    errors.ctaUrl = `La URL del CTA no puede superar ${CTA_URL_MAX} caracteres.`
  } else if (cta && !cta.startsWith("/") && !cta.startsWith("https://")) {
    errors.ctaUrl = "Usa una ruta relativa que empiece con / o una URL que empiece con https://."
  }

  if (draft.starts_at && draft.ends_at) {
    const start = new Date(draft.starts_at).getTime()
    const end = new Date(draft.ends_at).getTime()
    if (Number.isFinite(start) && Number.isFinite(end) && end <= start) {
      errors.endsAt = "La fecha de fin debe ser posterior a la fecha de inicio."
    }
  }

  if (!Number.isInteger(draft.priority) || draft.priority < 0 || draft.priority > PRIORITY_MAX) {
    errors.priority = `La prioridad debe ser un entero entre 0 y ${PRIORITY_MAX}.`
  }
  if (
    !Number.isInteger(draft.rotation_seconds) ||
    draft.rotation_seconds < ROTATION_MIN ||
    draft.rotation_seconds > ROTATION_MAX
  ) {
    errors.rotationSeconds = `La duración en pantalla debe ser un entero entre ${ROTATION_MIN} y ${ROTATION_MAX} segundos.`
  }
  if (!Number.isInteger(draft.sort_order) || draft.sort_order < 0) {
    errors.sortOrder = "El orden debe ser un entero mayor o igual a 0."
  }

  return errors
}
