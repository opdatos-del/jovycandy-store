/**
 * Contrato de lectura del tablero JovyCandy y utilidades de presentación.
 * Los tipos replican exactamente `GET /admin/jovy/dashboard`; no se calculan
 * métricas nuevas a partir de otros datos del CMS.
 */

export type StatusCounts = { draft: number; published: number; archived: number; total: number }
export type EventCounts = StatusCounts & { cancelled: number; active: number }

export const CONTACT_TYPES = [
  "national-sales",
  "international-sales",
  "customer-service",
  "catalogue",
] as const

export type ContactType = (typeof CONTACT_TYPES)[number]
export type ContactTotals = { pending: number; handled: number; total: number }

export type JovyDashboard = {
  generated_at: string
  core: { products: { count: number }; categories: { count: number } }
  content: { pages: StatusCounts }
  marketing: { hero: StatusCounts; banners: StatusCounts }
  events: EventCounts
  brand: {
    gallery: { published: number; limit: number; exceeds_limit: boolean }
    logos: { active: number }
  }
  contacts: { total: ContactTotals; by_type: Record<ContactType, ContactTotals> }
  pending: {
    content: Array<{ id: string; title: string }>
    marketing: Array<{ id: string; title: string; kind: "hero" | "banner" }>
    events: Array<{ id: string; title: string }>
  }
  optional_modules: Array<{
    key: string
    label: string
    installed: boolean
    counts: Array<{ key: string; label: string; count: number }>
  }>
}

export const CONTACT_LABELS: Record<ContactType, string> = {
  "national-sales": "Ventas nacionales",
  "international-sales": "Ventas internacionales",
  "customer-service": "Atención a clientes",
  catalogue: "Catálogo",
}

export const number = new Intl.NumberFormat("es-MX")

/**
 * El Admin se sirve bajo `/app`. Se usan anclas nativas en lugar de `Link` de
 * `react-router-dom` porque la app y `@medusajs/dashboard` empaquetan copias
 * distintas de React Router: `Link` se renderiza sin contexto y rompe la vista.
 */
export const adminHref = (path: string) => `/app${path}`

export const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })

export const AUTO_REFRESH_SECONDS = 60

export const ANALYTICS_RANGES = [
  { value: "7", label: "7 días" },
  { value: "30", label: "30 días" },
  { value: "90", label: "90 días" },
  { value: "custom", label: "Personalizado" },
] as const

export type AnalyticsRange = (typeof ANALYTICS_RANGES)[number]["value"]

export const ANALYTICS_UNAVAILABLE = "No disponible: falta fuente analítica."

export const ANALYTICS_REQUIREMENTS = [
  "Instrumentación propia de page views y aperturas de producto o categoría, con identificadores anónimos de sesión.",
  "Un endpoint Admin de solo lectura con agregados por rango de fechas y una política de retención definida.",
  "Aprobación explícita de finalidad, acceso y retención antes de publicar cualquier cifra.",
]

const formatInputDate = (value: string) => {
  if (!value) return ""
  const [year, month, day] = value.split("-")
  if (!year || !month || !day) return value
  return `${day}/${month}/${year}`
}

export const selectedRangeLabel = (range: AnalyticsRange, start: string, end: string) => {
  if (range !== "custom") {
    const option = ANALYTICS_RANGES.find((item) => item.value === range)
    return option ? `Últimos ${option.label.replace(" días", "")} días` : "Rango seleccionado"
  }
  if (start && end) return `${formatInputDate(start)} - ${formatInputDate(end)}`
  if (start) return `Desde ${formatInputDate(start)}`
  if (end) return `Hasta ${formatInputDate(end)}`
  return "Rango personalizado"
}
