import type { AuthzSnapshot } from "./permissions"

export type NavPermission = { resource: string; operation: string }

export type NavItem = {
  id: string
  label: string
  path: string
  permissions: NavPermission[]
  children?: NavItem[]
}

export type NavGroup = {
  id: string
  label: string
  kind: "native" | "jovy" | "settings"
  items: NavItem[]
}

/**
 * Catálogo de navegación administrativa. Las rutas son las registradas por
 * Medusa o por las extensiones; este catálogo no crea rutas ejecutables. Las
 * asignaciones y políticas viven en `jovy-authz`.
 */
export const NAVIGATION_CATALOG: readonly NavGroup[] = [
  {
    id: "medusa",
    label: "Medusa",
    kind: "native",
    items: [
      { id: "orders", label: "Pedidos", path: "/app/orders", permissions: [{ resource: "medusa_orders", operation: "read" }] },
      {
        id: "products",
        label: "Productos",
        path: "/app/products",
        permissions: [{ resource: "medusa_products", operation: "read" }],
        children: [
          { id: "collections", label: "Colecciones", path: "/app/collections", permissions: [{ resource: "medusa_products", operation: "read" }] },
          { id: "categories", label: "Categorías", path: "/app/categories", permissions: [{ resource: "medusa_products", operation: "read" }] },
          { id: "product-options", label: "Opciones", path: "/app/product-options", permissions: [{ resource: "medusa_products", operation: "read" }] },
        ],
      },
      {
        id: "inventory",
        label: "Inventario",
        path: "/app/inventory",
        permissions: [{ resource: "medusa_inventory", operation: "read" }],
        children: [
          { id: "reservations", label: "Reservas", path: "/app/reservations", permissions: [{ resource: "medusa_inventory", operation: "read" }] },
        ],
      },
      {
        id: "customers",
        label: "Clientes",
        path: "/app/customers",
        permissions: [{ resource: "medusa_customers", operation: "read" }],
        children: [
          { id: "customer-groups", label: "Grupos", path: "/app/customer-groups", permissions: [{ resource: "medusa_customers", operation: "read" }] },
        ],
      },
      {
        id: "promotions",
        label: "Promociones",
        path: "/app/promotions",
        permissions: [{ resource: "medusa_promotions", operation: "read" }],
        children: [
          { id: "campaigns", label: "Campañas", path: "/app/campaigns", permissions: [{ resource: "medusa_promotions", operation: "read" }] },
        ],
      },
      { id: "price-lists", label: "Listas de precios", path: "/app/price-lists", permissions: [{ resource: "medusa_prices", operation: "read" }] },
    ],
  },
  {
    id: "jovy",
    label: "JovyCandy CMS",
    kind: "jovy",
    items: [
      { id: "dashboard", label: "Dashboard", path: "/app/jovy/dashboard", permissions: [{ resource: "jovy_dashboard", operation: "read" }] },
      { id: "catalogue", label: "Categorías", path: "/app/jovy/catalogue", permissions: [{ resource: "jovy_catalogue", operation: "read" }] },
      { id: "launches", label: "Nuevos Lanzamientos", path: "/app/jovy/launches", permissions: [{ resource: "jovy_launches", operation: "read" }] },
      { id: "gallery", label: "Casa Jovy Galería", path: "/app/jovy/brand", permissions: [{ resource: "jovy_gallery", operation: "read" }] },
      { id: "logos", label: "Logos", path: "/app/jovy/logos", permissions: [{ resource: "jovy_logos", operation: "read" }] },
      { id: "announcements", label: "Anuncios de portada", path: "/app/jovy/announcements", permissions: [{ resource: "jovy_announcements", operation: "read" }] },
      { id: "novelties", label: "Novedades", path: "/app/jovy/novelties", permissions: [{ resource: "jovy_events", operation: "read" }] },
      { id: "contacts-national", label: "Ventas Nacionales", path: "/app/jovy/contacts-national-sales", permissions: [{ resource: "jovy_contacts_national", operation: "read" }] },
      { id: "contacts-international", label: "Ventas Internacionales", path: "/app/jovy/contacts-international-sales", permissions: [{ resource: "jovy_contacts_international", operation: "read" }] },
      { id: "contacts-customer", label: "Atención al Cliente", path: "/app/jovy/contacts-customer-service", permissions: [{ resource: "jovy_contacts_customer_service", operation: "read" }] },
      { id: "contacts-catalogue", label: "Catálogo — Solicitudes", path: "/app/jovy/contacts-catalogue", permissions: [{ resource: "jovy_contacts_catalogue", operation: "read" }] },
    ],
  },
  {
    id: "jovy-tools",
    label: "JovyCandy · Herramientas",
    kind: "jovy",
    items: [
      { id: "content", label: "Contenido Jovy", path: "/app/jovy-herramientas/content", permissions: [{ resource: "jovy_content", operation: "read" }] },
      { id: "events", label: "Eventos Jovy", path: "/app/jovy-herramientas/events", permissions: [{ resource: "jovy_events", operation: "read" }] },
      { id: "marketing", label: "Marketing Jovy", path: "/app/jovy-herramientas/marketing", permissions: [{ resource: "jovy_marketing", operation: "read" }] },
      {
        id: "contacts",
        label: "Contactos Jovy",
        path: "/app/jovy-herramientas/contacts",
        permissions: [
          { resource: "jovy_contacts_national", operation: "read" },
          { resource: "jovy_contacts_international", operation: "read" },
          { resource: "jovy_contacts_customer_service", operation: "read" },
          { resource: "jovy_contacts_catalogue", operation: "read" },
        ],
      },
    ],
  },
  {
    id: "settings",
    label: "Configuración",
    kind: "settings",
    items: [
      { id: "users", label: "Usuarios", path: "/app/settings/users", permissions: [{ resource: "medusa_users", operation: "read" }] },
      { id: "access", label: "Accesos y permisos", path: "/app/settings/access", permissions: [{ resource: "jovy_access", operation: "read" }] },
      { id: "store", label: "Tienda", path: "/app/settings/store", permissions: [{ resource: "medusa_settings", operation: "read" }] },
      { id: "regions", label: "Regiones", path: "/app/settings/regions", permissions: [{ resource: "medusa_settings", operation: "read" }] },
      { id: "currencies", label: "Monedas", path: "/app/settings/currencies", permissions: [{ resource: "medusa_settings", operation: "read" }] },
      { id: "taxes", label: "Impuestos", path: "/app/settings/taxes", permissions: [{ resource: "medusa_settings", operation: "read" }] },
      { id: "shipping", label: "Envíos", path: "/app/settings/shipping", permissions: [{ resource: "medusa_settings", operation: "read" }] },
      { id: "payments", label: "Pagos", path: "/app/settings/payments", permissions: [{ resource: "medusa_settings", operation: "read" }] },
      { id: "api-keys", label: "API keys", path: "/app/settings/api-keys", permissions: [{ resource: "medusa_api_keys", operation: "manage_settings" }] },
    ],
  },
]

function permits(snapshot: AuthzSnapshot, permissions: NavPermission[]) {
  return permissions.every((permission) => snapshot.can(permission.resource, permission.operation))
}

/**
 * Filtra el catálogo con los permisos efectivos. Un grupo se conserva solo si
 * al menos un hijo es visible; un padre con hijos visibles también se conserva.
 * La navegación se deriva de la autorización, no al revés.
 */
export function visibleNavigation(snapshot: AuthzSnapshot): NavGroup[] {
  return NAVIGATION_CATALOG.map((group) => {
    const items: NavItem[] = group.items.flatMap((item): NavItem[] => {
      const children = item.children?.filter((child) => permits(snapshot, child.permissions))
      const own = permits(snapshot, item.permissions)
      if (!own && !children?.length) return []
      return [{ ...item, children }]
    })
    return { ...group, items }
  }).filter((group) => group.items.length > 0)
}
