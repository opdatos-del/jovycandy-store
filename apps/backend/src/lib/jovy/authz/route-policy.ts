import type { MedusaRequest } from "@medusajs/framework/http"
import {
  CONTACT_TYPE_RESOURCE,
  CONTACT_TYPES,
  type ContactType,
} from "./catalog"
import { contactResource, isContactType, type AuthzSnapshot } from "./permissions"

export type PermissionRequirement = {
  type: "permission"
  resource: string
  operation: string
  /** PUT/POST que publica o archiva exige la operación adicional. */
  publicationFromBody?: boolean
}

export type AuthzAccess =
  | PermissionRequirement
  | { type: "authenticated" }
  | { type: "contacts-query"; operation: "read" | "export" }
  | { type: "contacts-counts" }
  | { type: "contacts-id"; operation: "read" | "update" | "delete" | "restore" }
  | { type: "contacts-multi-export" }

export type JovyEndpointRule = {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
  path: string
  access: AuthzAccess
}

/**
 * Inventario declarativo de todos los endpoints administrativos Jovy. Un
 * endpoint que no aparezca aquí se deniega. La prueba de arquitectura compara
 * esta tabla con los archivos `route.ts` reales para impedir rutas sin
 * clasificar.
 */
export const JOVY_ENDPOINT_INVENTORY: readonly JovyEndpointRule[] = [
  { method: "GET", path: "/admin/jovy/announcements/settings", access: { type: "permission", resource: "jovy_announcements", operation: "read" } },
  { method: "PUT", path: "/admin/jovy/announcements/settings", access: { type: "permission", resource: "jovy_announcements", operation: "manage_settings" } },

  { method: "GET", path: "/admin/jovy/brand/gallery", access: { type: "permission", resource: "jovy_gallery", operation: "read" } },
  { method: "POST", path: "/admin/jovy/brand/gallery", access: { type: "permission", resource: "jovy_gallery", operation: "create", publicationFromBody: true } },
  { method: "POST", path: "/admin/jovy/brand/gallery/reorder", access: { type: "permission", resource: "jovy_gallery", operation: "update" } },
  { method: "GET", path: "/admin/jovy/brand/gallery/:id", access: { type: "permission", resource: "jovy_gallery", operation: "read" } },
  { method: "PUT", path: "/admin/jovy/brand/gallery/:id", access: { type: "permission", resource: "jovy_gallery", operation: "update", publicationFromBody: true } },
  { method: "DELETE", path: "/admin/jovy/brand/gallery/:id", access: { type: "permission", resource: "jovy_gallery", operation: "delete" } },
  { method: "GET", path: "/admin/jovy/brand/gallery/:id/audit", access: { type: "permission", resource: "jovy_gallery", operation: "read" } },

  { method: "GET", path: "/admin/jovy/brand/logos", access: { type: "permission", resource: "jovy_logos", operation: "read" } },
  { method: "POST", path: "/admin/jovy/brand/logos", access: { type: "permission", resource: "jovy_logos", operation: "create" } },
  { method: "POST", path: "/admin/jovy/brand/logos/reorder", access: { type: "permission", resource: "jovy_logos", operation: "update" } },
  { method: "POST", path: "/admin/jovy/brand/logos/media", access: { type: "permission", resource: "jovy_logos", operation: "update" } },
  { method: "GET", path: "/admin/jovy/brand/logos/:id", access: { type: "permission", resource: "jovy_logos", operation: "read" } },
  { method: "PUT", path: "/admin/jovy/brand/logos/:id", access: { type: "permission", resource: "jovy_logos", operation: "update" } },
  { method: "DELETE", path: "/admin/jovy/brand/logos/:id", access: { type: "permission", resource: "jovy_logos", operation: "delete" } },
  { method: "GET", path: "/admin/jovy/brand/logos/:id/audit", access: { type: "permission", resource: "jovy_logos", operation: "read" } },

  { method: "GET", path: "/admin/jovy/catalogue/categories", access: { type: "permission", resource: "jovy_catalogue", operation: "read" } },
  { method: "POST", path: "/admin/jovy/catalogue/categories/reorder", access: { type: "permission", resource: "jovy_catalogue", operation: "update" } },
  { method: "POST", path: "/admin/jovy/catalogue/categories/seed", access: { type: "permission", resource: "jovy_catalogue", operation: "create" } },
  { method: "GET", path: "/admin/jovy/catalogue/categories/:id", access: { type: "permission", resource: "jovy_catalogue", operation: "read" } },
  { method: "PUT", path: "/admin/jovy/catalogue/categories/:id", access: { type: "permission", resource: "jovy_catalogue", operation: "update" } },
  { method: "GET", path: "/admin/jovy/catalogue/families", access: { type: "permission", resource: "jovy_catalogue", operation: "read" } },
  { method: "POST", path: "/admin/jovy/catalogue/families", access: { type: "permission", resource: "jovy_catalogue", operation: "create" } },
  { method: "POST", path: "/admin/jovy/catalogue/families/reorder", access: { type: "permission", resource: "jovy_catalogue", operation: "update" } },
  { method: "GET", path: "/admin/jovy/catalogue/families/:id", access: { type: "permission", resource: "jovy_catalogue", operation: "read" } },
  { method: "PUT", path: "/admin/jovy/catalogue/families/:id", access: { type: "permission", resource: "jovy_catalogue", operation: "update" } },
  { method: "DELETE", path: "/admin/jovy/catalogue/families/:id", access: { type: "permission", resource: "jovy_catalogue", operation: "delete" } },
  { method: "GET", path: "/admin/jovy/catalogue/official-preview", access: { type: "permission", resource: "jovy_catalogue", operation: "read" } },
  { method: "POST", path: "/admin/jovy/catalogue/official-preview", access: { type: "permission", resource: "jovy_catalogue", operation: "update" } },
  { method: "POST", path: "/admin/jovy/product-card-visual/media", access: { type: "permission", resource: "jovy_catalogue", operation: "update" } },

  { method: "GET", path: "/admin/jovy/contacts", access: { type: "contacts-query", operation: "read" } },
  { method: "GET", path: "/admin/jovy/contacts/counts", access: { type: "contacts-counts" } },
  { method: "GET", path: "/admin/jovy/contacts/export", access: { type: "contacts-query", operation: "export" } },
  { method: "GET", path: "/admin/jovy/contacts/export-all", access: { type: "contacts-multi-export" } },
  { method: "GET", path: "/admin/jovy/contacts/:id", access: { type: "contacts-id", operation: "read" } },
  { method: "PUT", path: "/admin/jovy/contacts/:id", access: { type: "contacts-id", operation: "update" } },
  { method: "DELETE", path: "/admin/jovy/contacts/:id", access: { type: "contacts-id", operation: "delete" } },
  { method: "GET", path: "/admin/jovy/contacts/:id/audit", access: { type: "contacts-id", operation: "read" } },
  { method: "POST", path: "/admin/jovy/contacts/:id/restore", access: { type: "contacts-id", operation: "restore" } },

  { method: "GET", path: "/admin/jovy/content/pages", access: { type: "permission", resource: "jovy_content", operation: "read" } },
  { method: "POST", path: "/admin/jovy/content/pages", access: { type: "permission", resource: "jovy_content", operation: "create", publicationFromBody: true } },
  { method: "GET", path: "/admin/jovy/content/pages/:id", access: { type: "permission", resource: "jovy_content", operation: "read" } },
  { method: "PUT", path: "/admin/jovy/content/pages/:id", access: { type: "permission", resource: "jovy_content", operation: "update", publicationFromBody: true } },
  { method: "DELETE", path: "/admin/jovy/content/pages/:id", access: { type: "permission", resource: "jovy_content", operation: "delete" } },
  { method: "GET", path: "/admin/jovy/content/pages/:id/audit", access: { type: "permission", resource: "jovy_content", operation: "read" } },

  { method: "GET", path: "/admin/jovy/dashboard", access: { type: "permission", resource: "jovy_dashboard", operation: "read" } },

  { method: "GET", path: "/admin/jovy/events", access: { type: "permission", resource: "jovy_events", operation: "read" } },
  { method: "POST", path: "/admin/jovy/events", access: { type: "permission", resource: "jovy_events", operation: "create", publicationFromBody: true } },
  { method: "POST", path: "/admin/jovy/events/reorder", access: { type: "permission", resource: "jovy_events", operation: "update" } },
  { method: "POST", path: "/admin/jovy/events/media/video", access: { type: "permission", resource: "jovy_events", operation: "update" } },
  { method: "GET", path: "/admin/jovy/events/:id", access: { type: "permission", resource: "jovy_events", operation: "read" } },
  { method: "PUT", path: "/admin/jovy/events/:id", access: { type: "permission", resource: "jovy_events", operation: "update", publicationFromBody: true } },
  { method: "DELETE", path: "/admin/jovy/events/:id", access: { type: "permission", resource: "jovy_events", operation: "delete" } },
  { method: "GET", path: "/admin/jovy/events/:id/audit", access: { type: "permission", resource: "jovy_events", operation: "read" } },
  { method: "GET", path: "/admin/jovy/events/types", access: { type: "permission", resource: "jovy_events", operation: "read" } },
  { method: "POST", path: "/admin/jovy/events/types", access: { type: "permission", resource: "jovy_events", operation: "create" } },
  { method: "GET", path: "/admin/jovy/events/types/:id", access: { type: "permission", resource: "jovy_events", operation: "read" } },
  { method: "PUT", path: "/admin/jovy/events/types/:id", access: { type: "permission", resource: "jovy_events", operation: "update" } },
  { method: "DELETE", path: "/admin/jovy/events/types/:id", access: { type: "permission", resource: "jovy_events", operation: "delete" } },

  { method: "GET", path: "/admin/jovy/launches", access: { type: "permission", resource: "jovy_launches", operation: "read" } },
  { method: "POST", path: "/admin/jovy/launches", access: { type: "permission", resource: "jovy_launches", operation: "create" } },
  { method: "POST", path: "/admin/jovy/launches/reorder", access: { type: "permission", resource: "jovy_launches", operation: "update" } },
  { method: "GET", path: "/admin/jovy/launches/settings", access: { type: "permission", resource: "jovy_launches", operation: "read" } },
  { method: "PUT", path: "/admin/jovy/launches/settings", access: { type: "permission", resource: "jovy_launches", operation: "manage_settings" } },
  { method: "GET", path: "/admin/jovy/launches/:id", access: { type: "permission", resource: "jovy_launches", operation: "read" } },
  { method: "PUT", path: "/admin/jovy/launches/:id", access: { type: "permission", resource: "jovy_launches", operation: "update" } },
  { method: "DELETE", path: "/admin/jovy/launches/:id", access: { type: "permission", resource: "jovy_launches", operation: "delete" } },

  { method: "GET", path: "/admin/jovy/marketing/hero", access: { type: "permission", resource: "jovy_marketing", operation: "read" } },
  { method: "POST", path: "/admin/jovy/marketing/hero", access: { type: "permission", resource: "jovy_marketing", operation: "create", publicationFromBody: true } },
  { method: "POST", path: "/admin/jovy/marketing/hero/reorder", access: { type: "permission", resource: "jovy_marketing", operation: "update" } },
  { method: "GET", path: "/admin/jovy/marketing/hero/settings", access: { type: "permission", resource: "jovy_marketing", operation: "read" } },
  { method: "PUT", path: "/admin/jovy/marketing/hero/settings", access: { type: "permission", resource: "jovy_marketing", operation: "manage_settings" } },
  { method: "GET", path: "/admin/jovy/marketing/hero/:id", access: { type: "permission", resource: "jovy_marketing", operation: "read" } },
  { method: "PUT", path: "/admin/jovy/marketing/hero/:id", access: { type: "permission", resource: "jovy_marketing", operation: "update", publicationFromBody: true } },
  { method: "DELETE", path: "/admin/jovy/marketing/hero/:id", access: { type: "permission", resource: "jovy_marketing", operation: "delete" } },
  { method: "GET", path: "/admin/jovy/marketing/hero/:id/product", access: { type: "permission", resource: "jovy_marketing", operation: "read" } },
  { method: "PUT", path: "/admin/jovy/marketing/hero/:id/product", access: { type: "permission", resource: "jovy_marketing", operation: "update" } },
  { method: "GET", path: "/admin/jovy/marketing/banners", access: { type: "permission", resource: "jovy_announcements", operation: "read" } },
  { method: "POST", path: "/admin/jovy/marketing/banners", access: { type: "permission", resource: "jovy_announcements", operation: "create", publicationFromBody: true } },
  { method: "POST", path: "/admin/jovy/marketing/banners/reorder", access: { type: "permission", resource: "jovy_announcements", operation: "update" } },
  { method: "GET", path: "/admin/jovy/marketing/banners/:id", access: { type: "permission", resource: "jovy_announcements", operation: "read" } },
  { method: "PUT", path: "/admin/jovy/marketing/banners/:id", access: { type: "permission", resource: "jovy_announcements", operation: "update", publicationFromBody: true } },
  { method: "DELETE", path: "/admin/jovy/marketing/banners/:id", access: { type: "permission", resource: "jovy_announcements", operation: "delete" } },
  { method: "GET", path: "/admin/jovy/marketing/media/:id", access: { type: "permission", resource: "jovy_marketing", operation: "read" } },
  { method: "POST", path: "/admin/jovy/marketing/media", access: { type: "permission", resource: "jovy_marketing", operation: "update" } },
  { method: "GET", path: "/admin/jovy/marketing/products", access: { type: "permission", resource: "jovy_marketing", operation: "read" } },

  { method: "GET", path: "/admin/jovy/products/editorial", access: { type: "permission", resource: "jovy_product_editorial", operation: "read" } },
  { method: "GET", path: "/admin/jovy/products/:id/editorial", access: { type: "permission", resource: "jovy_product_editorial", operation: "read" } },
  { method: "PUT", path: "/admin/jovy/products/:id/editorial", access: { type: "permission", resource: "jovy_product_editorial", operation: "update", publicationFromBody: true } },
  { method: "DELETE", path: "/admin/jovy/products/:id/editorial", access: { type: "permission", resource: "jovy_product_editorial", operation: "delete" } },
  { method: "POST", path: "/admin/jovy/products/:id/editorial/restore", access: { type: "permission", resource: "jovy_product_editorial", operation: "restore" } },

  { method: "GET", path: "/admin/jovy/authz/me", access: { type: "authenticated" } },
  { method: "GET", path: "/admin/jovy/authz/navigation", access: { type: "authenticated" } },
  { method: "GET", path: "/admin/jovy/authz/catalog", access: { type: "permission", resource: "jovy_access", operation: "read" } },
  { method: "GET", path: "/admin/jovy/authz/audit", access: { type: "permission", resource: "jovy_access", operation: "read" } },
  { method: "GET", path: "/admin/jovy/authz/roles", access: { type: "permission", resource: "jovy_access", operation: "read" } },
  { method: "POST", path: "/admin/jovy/authz/roles", access: { type: "permission", resource: "jovy_access", operation: "manage_settings" } },
  { method: "GET", path: "/admin/jovy/authz/roles/:id", access: { type: "permission", resource: "jovy_access", operation: "read" } },
  { method: "PUT", path: "/admin/jovy/authz/roles/:id", access: { type: "permission", resource: "jovy_access", operation: "manage_settings" } },
  { method: "DELETE", path: "/admin/jovy/authz/roles/:id", access: { type: "permission", resource: "jovy_access", operation: "manage_settings" } },
  { method: "PUT", path: "/admin/jovy/authz/roles/:id/policies", access: { type: "permission", resource: "jovy_access", operation: "manage_settings" } },
  { method: "GET", path: "/admin/jovy/authz/users", access: { type: "permission", resource: "jovy_access", operation: "read" } },
  { method: "GET", path: "/admin/jovy/authz/users/:id", access: { type: "permission", resource: "jovy_access", operation: "read" } },
  { method: "PUT", path: "/admin/jovy/authz/users/:id", access: { type: "permission", resource: "jovy_access", operation: "manage_settings" } },
]

function normalizePathname(value: string) {
  const withoutQuery = value.split("?")[0]
  if (withoutQuery.length > 1 && withoutQuery.endsWith("/")) return withoutQuery.slice(0, -1)
  return withoutQuery
}

/**
 * Una ruta con segmentos `.`/`..`, barras invertidas o separadores codificados
 * puede autorizarse con un prefijo distinto al que finalmente resuelve el
 * router. Se rechaza en lugar de normalizarla por cuenta propia.
 */
export function isAmbiguousPath(pathname: string) {
  const path = pathname.split("?")[0]
  return (
    path.includes("\\") ||
    /(^|\/)\.\.?(\/|$)/.test(path) ||
    /%(?:2e|2f|5c)/i.test(path)
  )
}

function compileRule(rule: JovyEndpointRule) {
  const segments = rule.path.split("/").filter(Boolean)
  return {
    rule,
    segments,
    regex: new RegExp(
      `^/${segments.map((segment) => (segment.startsWith(":") ? "[^/]+" : segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))).join("/")}$`,
    ),
  }
}

const COMPILED_RULES = JOVY_ENDPOINT_INVENTORY.map(compileRule).sort((a, b) => {
  // Las rutas con más segmentos y menos comodines ganan: /contacts/counts debe
  // resolverse antes que /contacts/:id.
  const dynamicA = a.segments.filter((segment) => segment.startsWith(":")).length
  const dynamicB = b.segments.filter((segment) => segment.startsWith(":")).length
  if (a.segments.length !== b.segments.length) return b.segments.length - a.segments.length
  return dynamicA - dynamicB
})

export function matchJovyRule(method: string, pathname: string) {
  if (isAmbiguousPath(pathname)) return null
  const path = normalizePathname(pathname)
  return (
    COMPILED_RULES.find((entry) => entry.rule.method === method && entry.regex.test(path))?.rule ??
    null
  )
}

function contactTypesFromQuery(req: MedusaRequest, names: string[]): ContactType[] | null {
  const query = req.query as Record<string, unknown>
  for (const name of names) {
    const raw = query[name]
    if (raw === undefined || raw === null || raw === "") continue
    const values = (Array.isArray(raw) ? raw : String(raw).split(","))
      .map((value) => String(value).trim())
      .filter(Boolean)
    if (!values.length) continue
    if (!values.every(isContactType)) return null
    return [...new Set(values)] as ContactType[]
  }
  return []
}

function canAllContacts(authz: AuthzSnapshot, operation: "read" | "export") {
  return CONTACT_TYPES.every((type) => authz.can(contactResource(type), operation))
}

/**
 * Evalúa una regla Jovy. Los endpoints por ID de contacto se derivan al
 * handler, que conoce el `contact_type` real del registro.
 */
export function evaluateJovyAccess(
  req: MedusaRequest,
  authz: AuthzSnapshot,
  rule: JovyEndpointRule,
): { allowed: true } | { allowed: false; reason: "forbidden" } {
  const access = rule.access
  if (access.type === "authenticated") return { allowed: true }
  if (access.type === "contacts-id") return { allowed: true }

  if (access.type === "contacts-counts") {
    return canAllContacts(authz, "read") ? { allowed: true } : { allowed: false, reason: "forbidden" }
  }

  if (access.type === "contacts-query") {
    const types = contactTypesFromQuery(req, ["contact_type", "contact_types"])
    // Un tipo desconocido se deja al esquema del handler para conservar el 400
    // de contrato; no se consulta ningún dato antes de validarlo.
    if (types === null) return { allowed: true }
    if (!types.length) {
      return canAllContacts(authz, access.operation)
        ? { allowed: true }
        : { allowed: false, reason: "forbidden" }
    }
    return types.every((type) => authz.can(contactResource(type), access.operation))
      ? { allowed: true }
      : { allowed: false, reason: "forbidden" }
  }

  if (access.type === "contacts-multi-export") {
    const types = contactTypesFromQuery(req, ["contact_types"])
    if (types === null) return { allowed: true }
    const selected = types.length ? types : CONTACT_TYPES
    return selected.every((type) => authz.can(contactResource(type), "export"))
      ? { allowed: true }
      : { allowed: false, reason: "forbidden" }
  }

  if (!authz.can(access.resource, access.operation)) {
    return { allowed: false, reason: "forbidden" }
  }

  if (access.publicationFromBody) {
    const body = req.body as Record<string, unknown> | undefined
    const status = body?.status ?? body?.editorial_status
    if (status === "published" && !authz.can(access.resource, "publish")) {
      return { allowed: false, reason: "forbidden" }
    }
    if (status === "archived" && !authz.can(access.resource, "archive")) {
      return { allowed: false, reason: "forbidden" }
    }
  }

  return { allowed: true }
}

type NativeArea = {
  prefix: string
  resource: string
  postOperation?: "create" | "update"
  /** POST/PUT/PATCH/DELETE de configuración sensible. */
  settings?: boolean
}

const NATIVE_AREAS: readonly NativeArea[] = [
  { prefix: "/admin/products", resource: "medusa_products" },
  { prefix: "/admin/collections", resource: "medusa_products" },
  { prefix: "/admin/product-categories", resource: "medusa_products" },
  { prefix: "/admin/product-options", resource: "medusa_products" },
  { prefix: "/admin/product-tags", resource: "medusa_products" },
  { prefix: "/admin/product-types", resource: "medusa_products" },
  { prefix: "/admin/product-collections", resource: "medusa_products" },
  { prefix: "/admin/product-variants", resource: "medusa_products" },
  { prefix: "/admin/uploads", resource: "medusa_products", postOperation: "create" },
  { prefix: "/admin/sales-channels", resource: "medusa_sales_channels" },
  { prefix: "/admin/price-lists", resource: "medusa_prices" },
  { prefix: "/admin/prices", resource: "medusa_prices" },
  { prefix: "/admin/price-preferences", resource: "medusa_prices" },
  { prefix: "/admin/inventory-items", resource: "medusa_inventory" },
  { prefix: "/admin/stock-locations", resource: "medusa_inventory" },
  { prefix: "/admin/reservations", resource: "medusa_inventory" },
  { prefix: "/admin/orders", resource: "medusa_orders", postOperation: "update" },
  { prefix: "/admin/order-changes", resource: "medusa_orders", postOperation: "update" },
  { prefix: "/admin/order-edits", resource: "medusa_orders", postOperation: "update" },
  { prefix: "/admin/payment-collections", resource: "medusa_orders", postOperation: "update" },
  { prefix: "/admin/draft-orders", resource: "medusa_orders" },
  { prefix: "/admin/returns", resource: "medusa_orders", postOperation: "update" },
  { prefix: "/admin/claims", resource: "medusa_orders", postOperation: "update" },
  { prefix: "/admin/exchanges", resource: "medusa_orders", postOperation: "update" },
  { prefix: "/admin/fulfillments", resource: "medusa_orders", postOperation: "update" },
  { prefix: "/admin/fulfillment-sets", resource: "medusa_orders" },
  { prefix: "/admin/refunds", resource: "medusa_orders", postOperation: "update" },
  { prefix: "/admin/payments", resource: "medusa_orders", postOperation: "update" },
  { prefix: "/admin/customers", resource: "medusa_customers" },
  { prefix: "/admin/customer-groups", resource: "medusa_customers" },
  { prefix: "/admin/promotions", resource: "medusa_promotions" },
  { prefix: "/admin/campaigns", resource: "medusa_promotions" },
  { prefix: "/admin/users", resource: "medusa_users", settings: true },
  { prefix: "/admin/invites", resource: "medusa_users", settings: true },
  { prefix: "/admin/api-keys", resource: "medusa_api_keys", settings: true },
  { prefix: "/admin/stores", resource: "medusa_settings", settings: true },
  { prefix: "/admin/currencies", resource: "medusa_settings", settings: true },
  { prefix: "/admin/regions", resource: "medusa_settings", settings: true },
  { prefix: "/admin/tax-rates", resource: "medusa_settings", settings: true },
  { prefix: "/admin/tax-regions", resource: "medusa_settings", settings: true },
  { prefix: "/admin/shipping-profiles", resource: "medusa_settings", settings: true },
  { prefix: "/admin/shipping-options", resource: "medusa_settings", settings: true },
  { prefix: "/admin/payment-providers", resource: "medusa_settings", settings: true },
  { prefix: "/admin/fulfillment-providers", resource: "medusa_settings", settings: true },
  { prefix: "/admin/notification-providers", resource: "medusa_settings", settings: true },
  { prefix: "/admin/return-reasons", resource: "medusa_settings", settings: true },
  { prefix: "/admin/refund-reasons", resource: "medusa_settings", settings: true },
  { prefix: "/admin/property-labels", resource: "medusa_settings", settings: true },
  { prefix: "/admin/shipping-option-types", resource: "medusa_settings", settings: true },
  { prefix: "/admin/tax-providers", resource: "medusa_settings", settings: true },
  { prefix: "/admin/locales", resource: "medusa_settings", settings: true },
  { prefix: "/admin/views", resource: "medusa_settings", settings: true },
  { prefix: "/admin/workflows-executions", resource: "medusa_settings", settings: true },
  { prefix: "/admin/search-indexes", resource: "medusa_settings", settings: true },
  { prefix: "/admin/search", resource: "medusa_settings", settings: true },
  { prefix: "/admin/plugins", resource: "medusa_settings", settings: true },
]

/**
 * Lecturas del shell que el dashboard consulta antes de tener una sesión útil.
 * Solo `/admin/feature-flags` cae aquí: no devuelve datos de negocio.
 */
const SHELL_PUBLIC_READS = [/^\/admin\/feature-flags$/]

/**
 * Lecturas mínimas para pintar el shell nativo. Exigen sesión administrativa
 * válida y usuario existente; se evalúan después de resolver la identidad.
 * Se limitan a la ruta exacta que necesita el dashboard: `/admin/stores` se
 * reduce a su listado y detalle (configuración de tienda), nunca a mutaciones.
 */
const SHELL_AUTHENTICATED_READS = [
  /^\/admin\/users\/me$/,
  /^\/admin\/notifications(?:\/.*)?$/,
  /^\/admin\/layouts(?:\/.*)?$/,
  /^\/admin\/modules(?:\/.*)?$/,
  /^\/admin\/translations(?:\/.*)?$/,
  /^\/admin\/stores$/,
  /^\/admin\/stores\/[^/]+$/,
]

function nativeOperation(method: string, area: NativeArea): string | null {
  if (method === "GET" || method === "HEAD") return "read"
  if (method === "POST") return area.settings ? "manage_settings" : (area.postOperation ?? "create")
  if (method === "PUT" || method === "PATCH") {
    return area.settings ? "manage_settings" : "update"
  }
  if (method === "DELETE") return area.settings ? "manage_settings" : "delete"
  return null
}

/**
 * Cobertura coercitiva de las superficies nativas. No es el RBAC oficial de
 * Medusa: es un mapa por prefijo que deniega todo lo no clasificado y exige
 * permisos `medusa_*` explícitos. Se documenta como cobertura limitada y debe
 * revisarse al actualizar Medusa.
 */
export function evaluateNativeAccess(
  method: string,
  pathname: string,
  authz: AuthzSnapshot,
): { allowed: true } | { allowed: false; reason: "forbidden" } {
  if (isAmbiguousPath(pathname)) return { allowed: false, reason: "forbidden" }
  const path = normalizePathname(pathname)
  if (isShellRead(method, path)) {
    return { allowed: true }
  }

  const area = NATIVE_AREAS.filter((item) => path === item.prefix || path.startsWith(`${item.prefix}/`))
    .sort((a, b) => b.prefix.length - a.prefix.length)[0]
  if (!area) {
    return authz.wildcard ? { allowed: true } : { allowed: false, reason: "forbidden" }
  }
  const operation = nativeOperation(method, area)
  if (!operation) return { allowed: false, reason: "forbidden" }
  return authz.can(area.resource, operation)
    ? { allowed: true }
    : { allowed: false, reason: "forbidden" }
}

function isShellMethod(method: string) {
  return method === "GET" || method === "HEAD"
}

export function isPublicShellRead(method: string, pathname: string) {
  if (!isShellMethod(method) || isAmbiguousPath(pathname)) return false
  const path = normalizePathname(pathname)
  return SHELL_PUBLIC_READS.some((pattern) => pattern.test(path))
}

export function isAuthenticatedShellRead(method: string, pathname: string) {
  if (!isShellMethod(method) || isAmbiguousPath(pathname)) return false
  const path = normalizePathname(pathname)
  return SHELL_AUTHENTICATED_READS.some((pattern) => pattern.test(path))
}

export function isShellRead(method: string, pathname: string) {
  return isPublicShellRead(method, pathname) || isAuthenticatedShellRead(method, pathname)
}

export const NATIVE_AREA_INVENTORY = NATIVE_AREAS
export const SHELL_READ_PATTERNS = [...SHELL_PUBLIC_READS, ...SHELL_AUTHENTICATED_READS]
export const CONTACT_RESOURCE_MAP = CONTACT_TYPE_RESOURCE
