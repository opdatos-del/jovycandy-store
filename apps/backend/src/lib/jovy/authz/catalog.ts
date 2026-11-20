/**
 * Catálogo canónico de recursos y operaciones de JovyCandy.
 *
 * Es la fuente para el backend, la semilla de roles y la UI de accesos. Un
 * recurso solo declara operaciones que un endpoint real utiliza; no se crean
 * permisos decorativos.
 */

export const AUTHZ_OPERATIONS = [
  { key: "read", label: "Consultar" },
  { key: "create", label: "Crear" },
  { key: "update", label: "Modificar" },
  { key: "delete", label: "Eliminar" },
  { key: "publish", label: "Publicar" },
  { key: "archive", label: "Archivar" },
  { key: "restore", label: "Restaurar" },
  { key: "export", label: "Exportar" },
  { key: "manage_settings", label: "Configuración sensible" },
] as const

export type AuthzOperation = (typeof AUTHZ_OPERATIONS)[number]["key"]

export type AuthzResource = {
  key: string
  label: string
  description: string
  operations: readonly AuthzOperation[]
}

const CONTENT_OPERATIONS = [
  "read",
  "create",
  "update",
  "delete",
  "publish",
  "archive",
] as const

const CONTACT_OPERATIONS = ["read", "update", "delete", "restore", "export"] as const

export const AUTHZ_RESOURCES: readonly AuthzResource[] = [
  {
    key: "jovy_dashboard",
    label: "Dashboard CMS",
    description: "KPIs agregados del CMS y de contactos.",
    operations: ["read"],
  },
  {
    key: "jovy_catalogue",
    label: "Catálogo",
    description: "Categorías y familias del catálogo corporativo.",
    operations: ["read", "create", "update", "delete", "manage_settings"],
  },
  {
    key: "jovy_launches",
    label: "Nuevos Lanzamientos",
    description: "Tarjetas de lanzamiento y su color global.",
    operations: ["read", "create", "update", "delete", "manage_settings"],
  },
  {
    key: "jovy_gallery",
    label: "Galería Casa Jovy",
    description: "Elementos, ventanas y publicación de la galería.",
    operations: CONTENT_OPERATIONS,
  },
  {
    key: "jovy_logos",
    label: "Logos",
    description: "Logos de marca, familias y orden.",
    operations: ["read", "create", "update", "delete"],
  },
  {
    key: "jovy_announcements",
    label: "Anuncios de portada",
    description: "Banners, rotación y mensaje corporativo.",
    operations: [...CONTENT_OPERATIONS, "manage_settings"],
  },
  {
    key: "jovy_events",
    label: "Eventos y Novedades",
    description: "Eventos, tipos y multimedia; Novedades es una vista de eventos.",
    operations: CONTENT_OPERATIONS,
  },
  {
    key: "jovy_marketing",
    label: "Marketing y Hero",
    description: "Hero corporativo, color global y vinculación de producto.",
    operations: [...CONTENT_OPERATIONS, "manage_settings"],
  },
  {
    key: "jovy_content",
    label: "Contenido Jovy",
    description: "Páginas editoriales bilingües y su auditoría.",
    operations: CONTENT_OPERATIONS,
  },
  {
    key: "jovy_product_editorial",
    label: "Ficha editorial de producto",
    description: "Datos editoriales que no modifican el Product Module.",
    operations: ["read", "update", "delete", "restore", "publish", "archive"],
  },
  {
    key: "jovy_contacts_national",
    label: "Ventas Nacionales",
    description: "Solicitudes de la bandeja nacional.",
    operations: CONTACT_OPERATIONS,
  },
  {
    key: "jovy_contacts_international",
    label: "Ventas Internacionales",
    description: "Solicitudes de la bandeja internacional.",
    operations: CONTACT_OPERATIONS,
  },
  {
    key: "jovy_contacts_customer_service",
    label: "Atención al Cliente",
    description: "Solicitudes de la bandeja de atención.",
    operations: CONTACT_OPERATIONS,
  },
  {
    key: "jovy_contacts_catalogue",
    label: "Solicitudes de Catálogo",
    description: "Solicitudes de la bandeja de catálogo.",
    operations: CONTACT_OPERATIONS,
  },
  {
    key: "jovy_access",
    label: "Accesos y permisos",
    description: "Roles, políticas y asignaciones de usuarios.",
    operations: ["read", "manage_settings"],
  },
  {
    key: "medusa_products",
    label: "Productos nativos",
    description: "Product Module, variantes, categorías, tags y colecciones.",
    operations: ["read", "create", "update", "delete"],
  },
  {
    key: "medusa_orders",
    label: "Pedidos nativos",
    description: "Pedidos, borradores, devoluciones, reclamos y cumplimiento.",
    operations: ["read", "create", "update", "delete"],
  },
  {
    key: "medusa_customers",
    label: "Clientes nativos",
    description: "Clientes y grupos de clientes.",
    operations: ["read", "create", "update", "delete"],
  },
  {
    key: "medusa_inventory",
    label: "Inventario nativo",
    description: "Artículos de inventario, ubicaciones y reservas.",
    operations: ["read", "create", "update", "delete"],
  },
  {
    key: "medusa_prices",
    label: "Precios nativos",
    description: "Listas de precios, precios y preferencias.",
    operations: ["read", "create", "update", "delete"],
  },
  {
    key: "medusa_promotions",
    label: "Promociones nativas",
    description: "Promociones y campañas.",
    operations: ["read", "create", "update", "delete"],
  },
  {
    key: "medusa_sales_channels",
    label: "Canales de venta",
    description: "Canales de venta usados por productos y pedidos.",
    operations: ["read", "create", "update", "delete"],
  },
  {
    key: "medusa_users",
    label: "Usuarios nativos",
    description: "Usuarios, invitaciones y su administración.",
    operations: ["read", "manage_settings"],
  },
  {
    key: "medusa_api_keys",
    label: "API keys",
    description: "Credenciales de máquina del Admin.",
    operations: ["manage_settings"],
  },
  {
    key: "medusa_settings",
    label: "Configuración Medusa",
    description: "Tiendas, regiones, monedas, envíos, impuestos y canales.",
    operations: ["read", "manage_settings"],
  },
] as const

export const AUTHZ_RESOURCE_KEYS = AUTHZ_RESOURCES.map((resource) => resource.key)

export const CONTACT_TYPE_RESOURCE = {
  "national-sales": "jovy_contacts_national",
  "international-sales": "jovy_contacts_international",
  "customer-service": "jovy_contacts_customer_service",
  catalogue: "jovy_contacts_catalogue",
} as const

export type ContactType = keyof typeof CONTACT_TYPE_RESOURCE

export const CONTACT_TYPES = Object.keys(CONTACT_TYPE_RESOURCE) as ContactType[]

export type RoleTemplate = {
  code: string
  name: string
  description: string
  is_system: boolean
  policies: Array<{ resource: string; operation: string }>
}

function grants(
  resources: readonly string[],
  operations: readonly AuthzOperation[],
): Array<{ resource: string; operation: string }> {
  return resources.flatMap((resource) => {
    const declared = AUTHZ_RESOURCES.find((item) => item.key === resource)?.operations ?? []
    return operations
      .filter((operation) => declared.includes(operation))
      .map((operation) => ({ resource, operation }))
  })
}

const CMS_RESOURCES = [
  "jovy_dashboard",
  "jovy_catalogue",
  "jovy_launches",
  "jovy_gallery",
  "jovy_logos",
  "jovy_announcements",
  "jovy_events",
  "jovy_marketing",
  "jovy_content",
  "jovy_product_editorial",
] as const

const CONTACTS_RESOURCES = [
  "jovy_contacts_national",
  "jovy_contacts_international",
  "jovy_contacts_customer_service",
  "jovy_contacts_catalogue",
] as const

/**
 * Roles semilla. `ensureSystemRoles` solo crea los ausentes: nunca sobrescribe
 * políticas ya ajustadas por el negocio.
 */
export const SYSTEM_ROLE_TEMPLATES: readonly RoleTemplate[] = [
  {
    code: "superadmin",
    name: "Superadministrador",
    description: "Administración integral, incluidos accesos y superficies nativas.",
    is_system: true,
    policies: [{ resource: "*", operation: "*" }],
  },
  {
    code: "cms_admin",
    name: "Administrador CMS",
    description: "Gestiona todo el contenido corporativo, sin PII de contactos.",
    is_system: true,
    policies: grants(CMS_RESOURCES, [
      "read",
      "create",
      "update",
      "delete",
      "publish",
      "archive",
      "manage_settings",
    ]),
  },
  {
    code: "cms_editor",
    name: "Editor CMS",
    description: "Crea y edita contenido autorizado; no elimina ni cambia configuración.",
    is_system: true,
    policies: grants(CMS_RESOURCES, ["read", "create", "update", "publish", "archive"]),
  },
  {
    code: "cms_viewer",
    name: "Consulta CMS",
    description: "Solo lectura del contenido corporativo.",
    is_system: true,
    policies: grants(CMS_RESOURCES, ["read"]),
  },
  {
    code: "product_manager",
    name: "Gestor de Productos",
    description: "Productos, precios e inventario nativos; sin usuarios ni accesos.",
    is_system: true,
    policies: [
      ...grants(["medusa_products", "medusa_prices", "medusa_inventory"], [
        "read",
        "create",
        "update",
        "delete",
      ]),
      ...grants(["medusa_sales_channels"], ["read"]),
      ...grants(["jovy_catalogue", "jovy_launches", "jovy_product_editorial"], [
        "read",
        "update",
      ]),
    ],
  },
  {
    code: "product_viewer",
    name: "Consulta de Productos",
    description: "Lectura de productos, precios e inventario; sin escritura.",
    is_system: true,
    policies: [
      ...grants(["medusa_products", "medusa_prices", "medusa_inventory"], ["read"]),
      ...grants(["medusa_sales_channels"], ["read"]),
      ...grants(["jovy_product_editorial", "jovy_catalogue", "jovy_launches"], ["read"]),
    ],
  },
  ...CONTACTS_RESOURCES.map((resource, index) => {
    const contactType = CONTACT_TYPES[index]
    const label = AUTHZ_RESOURCES.find((item) => item.key === resource)?.label ?? resource
    return {
      code: `sales_${contactType.replace(/-/g, "_")}`,
      name: label,
      description: `Consulta, atiende y exporta únicamente la bandeja ${label}.`,
      is_system: true,
      policies: grants([resource], ["read", "update", "export"]),
    }
  }),
]
