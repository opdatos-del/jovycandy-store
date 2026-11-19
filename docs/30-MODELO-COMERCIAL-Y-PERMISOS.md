# Modelo comercial y permisos

**Corte documental:** 2026-11-17. **Alcance:** separación CMS/Commerce, modalidades de
producto y estado real del modelo de permisos. Prosa en español; identificadores, campos,
rutas y operaciones en inglés.

**Estado:** las decisiones de seguridad comercial (secciones 2 y 3) están implementadas y
verificadas en local. El modelo de permisos de la sección 5 es **solo DISEÑO, NO
IMPLEMENTADO**. RBAC Enterprise no está disponible ni activo (sección 4).

Relación con otros documentos: `docs/21` (estado de implementación), `docs/28` (matriz por
pantalla), `docs/29` (paridad visual; conserva sus conteos de regresión), `docs/19`
(seguridad administrativa) y `docs/25` (contratos Store).

## 1. CMS vs Commerce

El grupo **«JovyCandy CMS»** del Admin tiene **11 entradas**, en este orden:

| # | Entrada | Ruta |
| ---: | --- | --- |
| 1 | Dashboard | `/app/jovy/dashboard` |
| 2 | Categorías | `/app/jovy/catalogue` |
| 3 | Nuevos Lanzamientos | `/app/jovy/launches` |
| 4 | Casa Jovy Galería | `/app/jovy/brand` |
| 5 | Logos | `/app/jovy/logos` |
| 6 | Anuncios de portada | `/app/jovy/announcements` |
| 7 | Novedades | `/app/jovy/novelties` |
| 8 | Ventas Nacionales | `/app/jovy/contacts-national-sales` |
| 9 | Ventas Internacionales | `/app/jovy/contacts-international-sales` |
| 10 | Atención al Cliente | `/app/jovy/contacts-customer-service` |
| 11 | Catálogo — Solicitudes | `/app/jovy/contacts-catalogue` |

- Se eliminaron las entradas duplicadas **Productos** y **Usuarios**:
  `/app/jovy/products` y `/app/jovy/users` **ya no existen** bajo
  `apps/backend/src/admin/routes/jovy/`.
- Productos se gestiona en el módulo nativo `Products` (`/app/products`); Usuarios en
  `Settings → Users` (`/app/settings/users`). **No se creó identidad paralela.**
- `jovy_product_editorial` sigue siendo **extensión del producto comercial**: widget
  `product.details`, sin segundo catálogo ni duplicado de título, SKU, precio, stock,
  variantes o imágenes. Los datos comerciales permanecen en el Product Module.
- Las funciones aditivas (Contenido, Eventos, Marketing y Contactos consolidados) viven en
  el grupo hermano **«JovyCandy · Herramientas»** (`/app/jovy-herramientas/*`), fuera del
  grupo de negocio.
- La fase anterior del sidebar reproducía 13 entradas; ese registro se conserva como
  **histórico** en `docs/29` §«Tercera ola». El estado vigente es el de esta sección.

## 2. Modalidades de producto

| Modalidad | Significado | Comportamiento |
| --- | --- | --- |
| `CATALOG_ONLY` | Ficha informativa de catálogo corporativo. | Conserva relaciones con categoría/familia, logos y lanzamientos; no requiere precios ni stock; **no se puede añadir al carrito ni comprar**; puede convertirse a vendible con autorización. |
| `SELLABLE` | Producto autorizado para la venta. | Comparte la identidad del producto comercial; requiere variantes, precios válidos, política de inventario explícita y canales/cumplimiento cuando aplique; **solo se compra si pasa las validaciones comerciales del servidor**. |

- Campo persistido `commercial_mode` en `jovy_product_editorial`:
  `catalog_only` / `sellable` / `null`. `resolveCommercialMode` devuelve `SELLABLE` solo
  para `sellable`; **null = producto histórico no clasificado ⇒ `CATALOG_ONLY`**, nunca se
  reclasifica automáticamente.
- Migración `Migration20261117120000`: **aditiva, sin backfill**, aplicada en local el
  2026-11-17. `up()` añade la columna con check de enum; `down()` retira solo la columna.
- `sellableRequirements` (`variants`, `prices`, `sales_channel`, `inventory_policy`) es
  **informativo, NO habilita la venta**. Es un cálculo derivado de los campos que ya lee
  el graph; la autorización depende de `commercial_mode` y de los hooks del carrito.
- El widget del producto (`product.details`) muestra la modalidad, los requisitos
  pendientes y **exige confirmación** para pasar a `sellable`; no inventa precios ni stock
  y no modifica el producto comercial nativo.
- Store API `/store/jovy/products` expone `commercial_mode` **derivado**, sin precios ni
  inventario. Esos datos se siguen leyendo en `/store/products`.

## 3. Seguridad comercial

- `manage_inventory=false` **no es un marcador informativo**: Medusa lo considera
  disponible sin seguimiento. **Ocultar el botón «Comprar» no es seguridad.**
- Validación **server-side** en `src/workflows/hooks/jovy-commercial-mode.ts`: hooks
  `validate` de `addToCartWorkflow`, `updateLineItemInCartWorkflow` y
  `completeCartWorkflow`. Medusa importa los hooks al cargar los workflows; no se registra
  nada en `medusa-config.ts`.
- `assertVariantsSellable` (`src/lib/jovy/commercial-mode.ts`):
  - extrae los `variant_id` del `input` y del `cart` del servidor, **nunca de `metadata`
    ni de un `product_id` enviado por el cliente**;
  - resuelve `variant_id → product_id` con `query.graph` sobre `product_variant`, agrupando
    los ids en una sola consulta;
  - rechaza con `MedusaError(NOT_ALLOWED)` si la modalidad resuelta es `CATALOG_ONLY` o no
    existe ficha. **Producto sin ficha ⇒ rechazo deliberado**;
  - si la tabla editorial aún no está migrada, emite **un aviso único por proceso** y la
    omisión queda acotada (`isEditorialTableMissing`), para no romper el arranque ni
    `db:migrate`.
- `completeCart` **solo acepta o rechaza, nunca muta el carrito**.
- No se modificaron el checkout ni el storefront. **No se generaron ventas reales** ni se
  alteraron precios o stock.

## 4. RBAC Enterprise — verificación real

- `@medusajs/rbac@2.22.6` existe **solo como dependencia transitiva**; su `LICENSE` es
  *Medusa Enterprise Edition License* y requiere acuerdo comercial.
- Las variables `MEDUSA_LICENSE_KEY` / `MEDUSA_LICENSE_PUBLIC_KEY` están **ausentes** y el
  módulo **no está registrado** en `medusa-config.ts`.
- Consecuencias verificadas: `authorize` → `next()`, `hasPermission` → `true`, rutas
  `/rbac/*` desactivadas. **RBAC NO está disponible ni activo.** Registrar el módulo sin
  licencia sería un incumplimiento.
- La documentación oficial (v2.22.3+) permite Policies para módulos personalizados,
  múltiples roles por usuario y operaciones propias augmentadas
  (`publish`, `archive`, `restore`, `export`); eso **no cambia la ausencia de licencia**.
  La corrección del afirmado «`publish` no se puede modelar» está registrada en `docs/19`.

## 5. Modelo de permisos DISEÑADO (NO IMPLEMENTADO)

### 5.1 Recursos

| Recurso | Superficie que representa |
| --- | --- |
| `jovy_dashboard` | Tablero y KPIs del CMS. |
| `jovy_catalogue` | Categorías del catálogo y presentación de familia. |
| `jovy_launches` | Nuevos lanzamientos y su configuración global. |
| `jovy_gallery` | Galería Casa Jovy. |
| `jovy_logos` | Logos y sus familias. |
| `jovy_announcements` | Mensaje corporativo y banner `promo` de portada. |
| `jovy_novelties` | Bandeja multimedia sobre `jovy_events`. |
| `jovy_contacts_national` | Bandeja de Ventas Nacionales. |
| `jovy_contacts_international` | Bandeja de Ventas Internacionales. |
| `jovy_contacts_customer_service` | Bandeja de Atención al Cliente. |
| `jovy_contacts_catalogue` | Bandeja de solicitudes de catálogo. |

### 5.2 Operaciones

`read`, `create`, `update`, `delete`, `publish`, `archive`, `restore`, `export`.

- Las operaciones propias (`publish`, `archive`, `restore`, `export`) se modelan mediante
  augmentación del registro de operaciones, según la documentación oficial; no son una
  limitación del diseño.
- **`export` se mapea explícitamente**: `GET /admin/jovy/contacts/export` ⇒
  `jovy_contact:export`, **no** `read`. Un rol con `read` no hereda exportación.
- Productos nativos quedan bajo las políticas oficiales cuando existan; la ficha editorial
  no sustituye esas políticas.

### 5.3 Roles propuestos (matriz resumida)

| Rol | Ámbito | Operaciones (resumen) |
| --- | --- | --- |
| Superadministrador | Todos los recursos | `*:*` |
| Administrador CMS | Recursos `jovy_*` de CMS | `read`, `create`, `update`, `delete`, `publish`, `archive`, `restore`, `export` |
| Consulta CMS | Recursos `jovy_*` de CMS | solo `read` |
| Gestor de productos | `jovy_catalogue`, `jovy_launches` | `read`, `create`, `update`, `publish`, `archive`, `restore` |
| Consulta de productos | `jovy_catalogue`, `jovy_launches` | solo `read` |
| Ventas nacionales | `jovy_contacts_national` | `read`, `create`, `update`, `delete`, `export` **solo en su bandeja** |
| Ventas internacionales | `jovy_contacts_international` | equivalente, **solo en su bandeja** |
| Atención al cliente | `jovy_contacts_customer_service` | equivalente, **solo en su bandeja** |
| Gestión de catálogo | `jovy_contacts_catalogue`, `jovy_catalogue` | equivalente sobre su bandeja + `read` de catálogo |

Reglas de la matriz:

- **Múltiples roles por usuario = unión de permisos**; **denegación por defecto**.
- Contactos: un rol de una bandeja **no puede listar, detallar, filtrar, exportar,
  modificar, restaurar ni borrar otra bandeja**. La negación debe probarse por **llamada
  directa a API**, no por ausencia de botones en la UI.
- `export` es una operación separada, nunca implicada por `read`.
- Nada de lo anterior está implementado: no hay guardas `authorize`, ni UI de roles, ni
  asignación persistida.

### 5.4 Alternativa integrada sin licencia (solo DISEÑO)

Si no se licencia RBAC, el diseño alternativo propuesto reutiliza la identidad nativa:

- `authenticate("user")` y `req.auth_context` como única fuente de identidad; **sin nuevos
  login, contraseñas, sesiones ni API keys**.
- Store delgado: `authz_role`, `authz_policy`, `authz_role_policy` y
  `authz_role_assignment` (`reference="user"`, `reference_id=<user.id>`).
- Middleware global `"/admin/*"` tras la autenticación, con tabla declarativa
  ruta → política y **deny por defecto**.
- Anti-escalada: ningún actor puede asignarse roles a sí mismo.

Riesgos declarados de esta alternativa: mantenimiento del mapa ruta→política ante
actualizaciones de Medusa, cobertura de las guardas nativas y tratamiento de las API keys
como credenciales de máquina. **No importar `@medusajs/rbac` sin licencia.**

### 5.5 Bloqueos declarados

- No hay UI de roles; no hay asignación desde `Users`/`Invites`; no hay filtrado automático
  de campos.
- Hoy **cualquier admin autenticado es admin pleno** sobre la PII de contactos y los
  módulos comerciales.
- Mitigación temporal mientras no haya licencia ni autorización: mínimos administradores,
  rotar API keys, **sin PII real** en el entorno y no compartir sesiones.

## Estado de verificación (2026-11-17)

Regresión final consolidada: `lint` 0, `typecheck` 0, `test:unit` 32 suites / 328 pruebas,
`test:integration:modules` 6 suites / 37 pruebas, `test:integration:http` 11 suites / 76 pruebas
(incluye el spec nuevo `commercial-mode.spec.ts` con 6 escenarios, entre ellos el rechazo en
`completeCart` sin creación de orden), `build` OK y `test:e2e` 29/29 en 4,1 min, ejecutado
agrupado y secuencialmente, sin flaky. La migración `Migration20261117120000` quedó aplicada en
el PostgreSQL local.

El campo `sellable_requirements` se produce en las respuestas Admin (detalle y listado de
producto editorial) y se comprueba en pruebas unitarias y de integración HTTP; las respuestas
Store no lo exponen.

**RBAC sigue SIN implementar**: solo existe el diseño de la sección 5; no hay guardas
`authorize`, UI de roles ni asignación persistida, y `@medusajs/rbac` no está registrado ni
licenciado (secciones 4 y 5).
