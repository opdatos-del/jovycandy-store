# Extensiones Medusa Admin

## Implementado

Las UI routes viven en `apps/backend/src/admin/routes/jovy/**` y se registran con
`defineRouteConfig`. La ruta raíz `/app/jovy` es **JovyCandy CMS**, un tablero operativo que
consume `GET /admin/jovy/dashboard` en una sola petición: conteos reales de Medusa y de los
módulos Jovy, borradores recientes y estado de los módulos CMS opcionales. Cada tarjeta enlaza a
su pantalla, incluidas las nativas `/app/products` y `/app/categories`, y las tres pantallas de
presentación (`/jovy/catalogue`, `/jovy/launches`, `/jovy/announcements`) tienen tarjeta propia en
el bloque «Portada y catálogo».

Las rutas declaran icono y `rank` para ordenar el sidebar:

| Ruta | Etiqueta | Rank |
| --- | --- | ---: |
| `/jovy` | JovyCandy CMS | 0 |
| `/jovy/content` | Contenido Jovy | 5 |
| `/jovy/contacts-national-sales` | Ventas nacionales | 10 |
| `/jovy/contacts-international-sales` | Ventas internacionales | 11 |
| `/jovy/contacts-customer-service` | Atención al cliente | 12 |
| `/jovy/contacts-catalogue` | Catálogo | 13 |
| `/jovy/marketing` | Marketing Jovy | 20 |
| `/jovy/events` | Eventos Jovy | 30 |
| `/jovy/brand` | Marca Jovy | 40 |
| `/jovy/contacts` | Contactos Jovy | 50 |
| `/jovy/catalogue` | Categorías del catálogo | 60 |
| `/jovy/launches` | Nuevos lanzamientos | 70 |
| `/jovy/announcements` | Anuncios de portada | 80 |
| `/jovy/novelties` | Novedades | 90 |
| `/jovy/products` | Productos editoriales | 100 |

Las cuatro bandejas de contactos viven en rutas planas (`/jovy/contacts-national-sales`,
`/jovy/contacts-international-sales`, `/jovy/contacts-customer-service` y
`/jovy/contacts-catalogue`) porque el sidebar de Medusa 2.22.6 solo pinta un nivel de rutas
propias. Cada entrada renderiza `<ContactInbox contactType=…>` de forma directa: no hay stubs de
redirección ni entradas duplicadas. `/jovy/contacts` sigue siendo la vista consolidada y
`features/contacts/components/**` el componente compartido. `contacts-catalogue` evita chocar
con `/jovy/catalogue`, que pertenece al bloque de catálogo.

### Agrupación en el sidebar

`defineRouteConfig` acepta `nested`, pero en Medusa 2.22.6 su tipo
`NestedRoutePosition` solo admite las rutas core `/orders`, `/products`, `/inventory`,
`/customers`, `/promotions` y `/price-lists`. No es posible declarar un grupo propio para
`/jovy` mediante `nested`; el dashboard anida los hijos de `/jovy` al detectar el elemento padre
en el menú. Por eso las rutas Jovy quedan planas en la configuración y agrupadas por el propio
Admin, sin parches de sidebar.

### Enlaces del tablero y dependencia del router

El tablero usa anclas nativas (`<a href={adminHref(path)}>` con prefijo `/app`) y **no** `Link` de
`react-router-dom`, a propósito. `apps/backend/package.json` declara `react-router-dom` en
`7.18.5` (dependencia directa), mientras `@medusajs/dashboard` 2.22.6 resuelve su propia copia
`7.18.2` según `pnpm-lock.yaml`: son dos copias del paquete. Con dos contextos de router, `Link` y
los hooks de navegación se renderizan sin contexto y rompen la vista; el `<a href>` evita el
problema y conserva la navegación completa del Admin. Si en el futuro se unifica la versión, el
cambio debe verificarse en el Admin compilado antes de sustituir las anclas.

## Implementado: extensiones sobre entidades nativas

- **Widget «Ficha editorial Jovy»** en `product.details`
  (`src/admin/widgets/product-editorial.tsx`, `defineWidgetConfig({ zone: "product.details", id:
  "jovy:product-editorial" })`). Edita gramaje, certificaciones SGS/OU Kosher/Halal, `is_new`,
  `sort_order`, estado editorial y publicar/archivar/restaurar la ficha. No duplica SKU, precio,
  stock ni variantes. Cubierto por `jovy-product-editorial.spec.ts`.
- **Lista «Productos editoriales»** en `/jovy/products` (rank 100) con filtro por estado y familia,
  publicación/archivo y restauración de ficha.
- **Enlaces del tablero** a `/jovy/catalogue`, `/jovy/launches` y `/jovy/announcements`, más los
  accesos a las pantallas nativas y al resto de módulos CMS. Verificados por
  `jovy-cms-navigation.spec.ts`.

## Pendientes reales

- No hay E2E del Admin nativo (`Products`, `Categories`, `Orders`, `Customers`, `Settings`); su
  paridad se acepta como capacidad nativa de Medusa.
- La asignación manual producto ↔ familia no tiene formulario: la lista solo muestra la familia
  derivada.
- Los reordenamientos de Galería y Logos existen en modelo, API y UI, pero no tienen E2E propio.
