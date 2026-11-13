# Seguridad administrativa y modelo de permisos

> Documento verificado el 2026-11-12 contra la instalación local de `apps/backend`
> (Medusa `2.22.6`) y actualizado el 2026-11-13 para reflejar la paginación/filtros
> de contactos y el ciclo GET/PUT/DELETE de tipos de evento. Toda afirmación sobre
> capacidades se contrastó con el código instalado en `apps/backend/node_modules` y
> con `pnpm-lock.yaml`; la API de activación de RBAC se confirmó además con la
> documentación oficial de Medusa v2 (`packages/modules/rbac/README.md` y
> `AGENTS.md`, versión 2.22.3).

## 1. Resumen ejecutivo

- La instalación **autentica** correctamente a los actores administrativos, pero
  **no autoriza por rol**: no hay RBAC activo.
- Medusa 2.22.6 **sí incluye RBAC nativo** (`@medusajs/rbac@2.22.6`, middleware
  `authorize`, rutas `/rbac/*`, pantallas de roles en el dashboard), pero el
  módulo **no está registrado** en `medusa-config.ts`. Mientras no se registre,
  `authorize` es un no-op y `hasPermission` devuelve `true`.
- Consecuencia práctica: **cualquier actor autenticado como `user`** (sesión,
  bearer JWT o API key secreta) es **admin pleno** sobre contenido, marketing,
  eventos, galerías, consultas de contacto (incluida PII) y configuración
  sensible. No existe hoy ningún rol que limite nada.
- El gap es de **producción**; en laboratorio con un solo operador es aceptable,
  siempre que no haya PII real ni credenciales compartidas.

## 2. Cómo se autentica hoy (evidencia)

| Capa | Dónde | Efecto real |
| --- | --- | --- |
| Autenticación global de `/admin` | `@medusajs/framework/dist/http/router.js:93-97` | `authenticate("user", ["bearer","session","api-key"])` para todo `/admin*` |
| Middleware propio duplicado | `apps/backend/src/api/middlewares.ts:13-16` | Repite `authenticate("user", ["session","bearer","api-key"])` sobre `/admin/jovy/*`; no añade autorización |
| Opt-out de autenticación | `@medusajs/framework/dist/http/routes-loader.js:19-22,49` y `router.js:292-295` | Un `route.ts` puede exportar la bandera `AUTHENTICATE`; **ninguna ruta del proyecto la usa** (verificado en `src/`) |
| Autenticación de `/rbac` | `router.js:104-111` | `bearer`/`session`; tipos de actor desde `http.rbacActorTypes` (por defecto `["user"]`). No acepta API keys secretas |
| Autenticación de `/store` | `router.js:118-120` | `authenticate("customer", ["bearer","session"], { allowUnauthenticated: true })` |
| API keys secretas | `@medusajs/framework/dist/http/middlewares/authenticate-middleware.js:21-38`; `set-secret-api-key-context.js:5-28` | Solo se aceptan en Basic auth cuando el actor permitido es exactamente `["user"]`; el `auth_context` queda con `actor_type: "api-key"` y el usuario creador en `req.secret_key_context.created_by` |

Conclusión: la protección declarada en `src/api/middlewares.ts` es redundante
(defensa en profundidad) pero **no aporta autorización**. Retirarla no cambia el
resultado, porque el loader ya autentica `/admin`. Lo que falta es la capa de
permisos.

## 3. RBAC nativo en 2.22.6: existe, está apagado

### 3.1 Evidencia de que el paquete lo soporta

- El módulo se publica como `@medusajs/rbac@2.22.6`, dependencia transitiva de
  `@medusajs/medusa` (`pnpm-lock.yaml:1797` y `pnpm-lock.yaml:10010`), presente
  en el store de pnpm (`node_modules/.pnpm/@medusajs+rbac@2.22.6_*`).
- `@medusajs/medusa` lo expone como submódulo:
  `node_modules/@medusajs/medusa/dist/modules/rbac.js:21-24`
  (`require("@medusajs/rbac")`, `discoveryPath`).
- La API de roles/políticas existe:
  `node_modules/@medusajs/medusa/dist/api/rbac/**`
  (`/rbac/roles`, `/rbac/policies`, `/rbac/me/permissions`).
- El dashboard incluye las pantallas de roles:
  `.medusa/server/public/admin/assets/role-list-*.js`,
  `role-create-*.js`, `role-detail-*.js`, `role-edit-*.js`,
  `role-permissions-*.js`, `role-add-users-*.js`.
- El middleware de autorización está exportado:
  `@medusajs/framework/dist/http/middlewares/authorize.d.ts` y
  `dist/policies/has-permission.d.ts`.

### 3.2 Evidencia de que está desactivado en esta instalación

| Hecho | Evidencia |
| --- | --- |
| El módulo no está registrado | `apps/backend/medusa-config.ts:16-59` declara solo los módulos `jovy-*`, `locking` y `file`; no hay `{ resolve: "@medusajs/medusa/rbac" }` |
| No hay tipos generados de RBAC | `.medusa/types` contiene solo `augmentation-refs.d.ts`, `index.d.ts`, `modules-bindings.d.ts`, `query-entry-points.d.ts`; ninguna entidad `rbac_*` |
| Las rutas `/rbac/*` se auto-desactivan | `node_modules/@medusajs/medusa/dist/api/rbac/roles/route.js:48-50` (`defineFileConfig({ isDisabled: () => !isInstalled(RBAC) })`) |
| `authorize` no hace nada | `node_modules/@medusajs/framework/dist/http/middlewares/authorize.js:43-45`: si el módulo RBAC no está instalado, `return next()` |
| `hasPermission` devuelve `true` | `dist/policies/has-permission.js:73-75` |
| No hay roles asignados ni consultables | No existe el módulo, por lo que no hay tablas ni servicio RBAC en runtime |

Regla de activación (confirmada con la documentación oficial): añadir
`{ resolve: "@medusajs/medusa/rbac" }` a `modules` y ejecutar
`medusa db:migrate`. No requiere instalar un paquete aparte.

### 3.3 Qué haría RBAC si se activara

- Sembraría el rol **Super Admin** con política `*:*`
  (`@medusajs/rbac/dist/loaders/initial-data.js:10-18`) y sincronizaría las
  políticas core en cada arranque (`loaders/core-policies.js`).
- Guardaría las rutas core que ya declaran `authorize(...)`. Ejemplo:
  `@medusajs/medusa/dist/api/admin/products/middlewares.js:85-90` y siguientes
  (product, product_variant, inventory_item, etc.).
- Rechazaría con `403` cuando falte actor (`authorize.js:56-58`), cuando el
  actor no tenga ningún rol (`authorize.js:65-67`) o cuando no cubra la política
  exigida (`authorize.js:74-82`).
- Resolvería el actor desde `rbac_role_assignment` con configuración por tipo de
  actor (`rbac-module-service.js:28-45,78-80`): `user` se resuelve por su propio
  `id`; `api-key` se resuelve por el `created_by` de la clave, es decir, **la API
  key hereda los roles del usuario que la creó**.
- Impediría escalada al asignar roles: las rutas pasan
  `granting_actor_id`/`granting_actor` a `assignRolesWorkflow`
  (`dist/api/admin/users/[id]/roles/route.js:55-70`).
- Cachea roles y permisos 60 s (`RBAC_CACHE_TTL` en
  `dist/policies/has-permission.js`), por lo que un cambio de rol puede tardar
  hasta un minuto en aplicar.

## 4. Capacidades administrativas

| Capacidad | Endpoint(s) | Protección actual (código) | Rol requerido hoy | ¿RBAC nativo? |
| --- | --- | --- | --- | --- |
| Listar/ver contenido editorial | `GET /admin/jovy/content/pages`, `GET /admin/jovy/content/pages/:id` | `authenticate` global + `src/api/middlewares.ts:13-16` | Cualquier `user` autenticado | **Gap**: sin `authorize` de dominio |
| Crear/editar/publicar/archivar/eliminar páginas | `POST /admin/jovy/content/pages`, `PUT/DELETE /admin/jovy/content/pages/:id` | Ídem + Zod (`src/lib/jovy/editorial-page.ts`) + workflow | Cualquier `user` | **Gap** |
| Ver auditoría editorial | `GET /admin/jovy/content/pages/:id/audit` | Ídem | Cualquier `user` | **Gap** |
| Administrar hero | `GET/POST /admin/jovy/marketing/hero`, `PUT/DELETE .../hero/:id`, `POST .../hero/reorder`, `PUT .../hero/:id/product` | Ídem + Zod (`src/lib/jovy/marketing.ts`) | Cualquier `user` | **Gap** |
| Administrar banners | `GET/POST /admin/jovy/marketing/banners`, `PUT/DELETE .../:id`, `POST .../reorder` | Ídem | Cualquier `user` | **Gap** |
| **Configuración sensible**: color de fondo del hero | `GET/PUT /admin/jovy/marketing/hero/settings` | Ídem + `heroSettingsSchema`; escribe `marketing_audit_log` (`src/workflows/jovy-marketing/hero-settings.ts:6-16`) | Cualquier `user` | **Gap** |
| Subir imágenes de marketing | `POST /admin/jovy/marketing/media` | Ídem + límite 1 archivo/5 MB (`src/api/middlewares.ts:4-7,17-24`) + magic bytes + `sharp` + nombre UUID (`src/api/admin/jovy/marketing/media/route.ts:10-45`) | Cualquier `user` | **Gap** (`jovy_media:create` propuesto) |
| Leer metadatos de archivo | `GET /admin/jovy/marketing/media/:id` | Ídem; devuelve solo `{id, url}` (`.../media/[id]/route.ts:4-14`) | Cualquier `user` | **Gap** |
| Administrar eventos | `GET/POST /admin/jovy/events`, `PUT/DELETE .../:id`, `POST .../reorder` | Ídem | Cualquier `user` | **Gap** |
| Administrar tipos de evento (catálogo) | `GET/POST /admin/jovy/events/types`, `GET/PUT/DELETE /admin/jovy/events/types/:id` | Ídem (`src/api/admin/jovy/events/types/route.ts`, `src/api/admin/jovy/events/types/[id]/route.ts`) | Cualquier `user` | **Gap** |
| Administrar galería de marca | `GET/POST /admin/jovy/brand/gallery`, `PUT/DELETE .../:id`, `POST .../reorder`, `GET .../:id/audit` | Ídem + Zod (`src/lib/jovy/brand.ts:20-48`) | Cualquier `user` | **Gap** |
| Administrar logos de marca | `GET/POST /admin/jovy/brand/logos`, `PUT/DELETE .../:id`, `POST .../reorder`, `GET .../:id/audit` | Ídem | Cualquier `user` | **Gap** |
| **Listar solicitudes de contacto (PII)** | `GET /admin/jovy/contacts` | Ídem + paginación `limit`/`offset` (máximo 100) + filtros `status`, `contact_type`, `q` en SQL + envelope `{contacts,count,limit,offset}` (`src/api/admin/jovy/contacts/route.ts`; `src/lib/jovy/contacts.ts`); devuelve nombre, email, teléfono, país, ciudad, mensaje y `admin_notes` | Cualquier `user` | **Gap**; no hay filtrado de campos por rol ni `jovy_contact:read` |
| Ver/actualizar/eliminar contactos | `GET/PUT/DELETE /admin/jovy/contacts/:id` | Ídem + `updateContactSchema` (`src/lib/jovy/contacts.ts:19-22`) | Cualquier `user` | **Gap** |
| Ver auditoría de contactos | `GET /admin/jovy/contacts/:id/audit` | Ídem | Cualquier `user` | **Gap** |
| Catálogo, pedidos, clientes, precios (core) | `/admin/products`, `/admin/orders`, `/admin/customers`, `/admin/price-lists`, etc. | `authenticate` global + `authorize(...)` en el paquete, **inactivo** | Cualquier `user` (RBAC apagado) | Nativo disponible, **inactivo** |
| Usuarios, invitaciones, API keys | `/admin/users`, `/admin/invites`, `/admin/api-keys` | Ídem; `authorize` inactivo | Cualquier `user` | Nativo disponible, **inactivo** |
| Roles y políticas | `/rbac/roles`, `/rbac/policies`, `/rbac/me/permissions` | Rutas desactivadas por `isDisabled` | Nadie (no existen) | **No disponible** |
| Formulario público de contacto | `POST /store/jovy/contacts` | Público + `publicContactSchema.strict()` + rate limit 5/10 min por IP + honeypot (`src/api/store/jovy/contacts/route.ts:7-19`) | Público | No aplica |
| Lectura pública del CMS | `/store/jovy/**` | Público; filtra por `status`/ventana temporal antes de responder | Público | No aplica |

## 5. Matriz usuario/rol × capacidad (estado real hoy)

Medusa 2.22.6 solo ofrece hoy **un nivel efectivo**: admin pleno.

| Actor | Contenido | Marketing/eventos/marca | Contactos (PII) | Configuración sensible | Roles/usuarios |
| --- | --- | --- | --- | --- | --- |
| `user` con sesión o JWT | Total | Total | Leer, anotar, cambiar estado, eliminar | Total | Total (incluye crear API keys e invitar usuarios) |
| API key secreta (`sk_`) | Total | Total | Total | Total | Total |
| `user` autenticado sin rol | No aplica: RBAC apagado, el rol no existe | Ídem | Ídem | Ídem | Ídem |
| Cliente de tienda (`customer`) | Solo lectura pública | Solo lectura pública | Solo `POST` público | Sin acceso | Sin acceso |
| Anónimo | Solo lectura pública | Solo lectura pública | Solo `POST` limitado + honeypot | Sin acceso | Sin acceso |

No hay una matriz rol × capacidad que aplicar: no existe hoy ningún rol
persistido ni verificación de permisos. Cualquier afirmación de "editor" o
"marketing" en la operación es organizativa, no técnica.

## 6. Diseño recomendado de permisos (compatible con Medusa, mínimo)

### 6.1 Orden de activación (evita bloqueos)

1. Registrar el módulo en `medusa-config.ts`:
   `modules: [{ resolve: "@medusajs/medusa/rbac" }]`.
2. Ejecutar `pnpm --dir apps/backend exec medusa db:migrate`. Ese comando
   ejecuta también los *migration scripts*: `create-super-admin-role`
   (`dist/migration-scripts/create-super-admin-role.js:39-100,123-131`) asigna
   el rol Super Admin a **todos** los usuarios existentes. Hacerlo en ventana de
   mantenimiento y revisar después la lista de usuarios.
3. Verificar `GET /rbac/me/permissions` con un admin: debe responder `200` con
   los permisos expandidos, no `404`.
4. Crear los roles de dominio y reasignar usuarios; retirar Super Admin a quien
   no lo necesite.
5. Añadir `authorize` a las rutas `jovy` (paso 6.3). **No** añadirlo antes de
   que existan roles: sin rol, `authorize` responde `403`
   (`authorize.js:65-67`).

### 6.2 Recursos y operaciones

Las políticas core no cubren recursos propios
(`CORE_POLICY_RESOURCES` en `@medusajs/types/dist/rbac/common.d.ts` no incluye
`jovy_*`). Hay que declararlos y crearlos. Operaciones: usar las existentes
`read`, `create`, `update`, `delete`; no inventar `publish` (publicar es
`update` sobre `jovy_content`/`jovy_marketing`).

```ts
// apps/backend/src/types/rbac.d.ts
export {}

declare module "@medusajs/types" {
  interface PolicyResourceRegistry {
    jovy_content: "jovy_content"
    jovy_marketing: "jovy_marketing"
    jovy_events: "jovy_events"
    jovy_brand: "jovy_brand"
    jovy_contact: "jovy_contact"
    jovy_media: "jovy_media"
  }
}
```

Las políticas de dominio se crean con `createRbacPoliciesWorkflow` +
`buildPolicies` desde un *migration script* desactivado cuando RBAC no está
instalado (patrón oficial de Medusa). La API también acepta `resource` y
`operation` arbitrarios al crear políticas
(`dist/api/rbac/policies/validators.js:34-45`), pero el script versionado es
preferible: es reproducible y no depende de que alguien recuerde crearlas.

### 6.3 Guardas por ruta

Añadir en `src/api/middlewares.ts`, por método y matcher:

```ts
import { authorize, authenticate, defineMiddlewares } from "@medusajs/framework/http"

export default defineMiddlewares({
  routes: [
    { matcher: "/admin/jovy/content/pages", method: ["GET"], middlewares: [authorize({ resource: "jovy_content", operation: "read" })] },
    { matcher: "/admin/jovy/content/pages", method: ["POST"], middlewares: [authorize({ resource: "jovy_content", operation: "create" })] },
    { matcher: "/admin/jovy/content/pages/:id", method: ["GET"], middlewares: [authorize({ resource: "jovy_content", operation: "read" })] },
    { matcher: "/admin/jovy/content/pages/:id", method: ["PUT", "DELETE"], middlewares: [authorize({ resource: "jovy_content", operation: "update" })] },
    { matcher: "/admin/jovy/content/pages/:id/audit", method: ["GET"], middlewares: [authorize({ resource: "jovy_content", operation: "read" })] },
    { matcher: "/admin/jovy/contacts", method: ["GET"], middlewares: [authorize({ resource: "jovy_contact", operation: "read" })] },
    { matcher: "/admin/jovy/contacts/:id", method: ["PUT"], middlewares: [authorize({ resource: "jovy_contact", operation: "update" })] },
    { matcher: "/admin/jovy/contacts/:id", method: ["DELETE"], middlewares: [authorize({ resource: "jovy_contact", operation: "delete" })] },
    { matcher: "/admin/jovy/marketing/*", method: ["GET"], middlewares: [authorize({ resource: "jovy_marketing", operation: "read" })] },
    { matcher: "/admin/jovy/marketing/*", method: ["POST", "PUT"], middlewares: [authorize({ resource: "jovy_marketing", operation: "update" })] }
    // Repetir el patrón para events y brand.
  ]
})
```

Reglas de aplicación:

- Toda ruta con `GET` exige `read`; toda mutación exige `create`, `update` o
  `delete` según corresponda. La auditoría (`/audit`) es `read`.
- El matcher debe cubrir el método real: `authorize` en un matcher sin `method`
  aplica a todos los métodos que caigan en él.
- Mantener `authenticate` o confiar en el loader: ambas opciones son válidas,
  pero no mezclar criterios por ruta. Si se conserva, documentarlo como
  defensa en profundidad.

### 6.4 Roles propuestos (mínimo viable)

| Rol | Políticas | Nota |
| --- | --- | --- |
| Super Admin | `*:*` (sembrado por Medusa) | Solo operación técnica; no para editores |
| Editor de contenido | `jovy_content:*`, `jovy_media:read` | Publica y archiva páginas |
| Marketing | `jovy_marketing:*`, `jovy_media:*`, `product:read` | Necesita `product:read` para asociar producto al hero |
| Eventos | `jovy_events:*`, `jovy_media:read` | Sin nota adicional |
| Marca | `jovy_brand:*`, `jovy_media:*` | Galerías y logos |
| Atención a clientes | `jovy_contact:read`, `jovy_contact:update` | **Sin** `delete`, sin acceso a contenido/marketing |
| Solo lectura | `jovy_content:read`, `jovy_marketing:read`, `jovy_events:read`, `jovy_brand:read`, `jovy_media:read` | **Sin** `jovy_contact:read` (PII) |

`jovy_contact:delete` queda reservado a Super Admin: el borrado es lógico
(soft delete en `src/workflows/jovy-contacts/contact.ts`), deja de listarse y
conserva la fila y su auditoría para la política de retención de
`docs/26-RETENCION-CONTACTOS.md`.

### 6.5 Qué NO implementar

- Tablas o columnas propias de rol/permiso (`jovy_user_role`,
  `metadata.role`, flags por email). Duplicaría RBAC y crearía una segunda
  fuente de verdad.
- Autorización solo en el dashboard (`src/admin/**`) u ocultar botones. La UI
  no es un control de seguridad; las rutas seguirían abiertas.
- Listas de emails o IDs de usuario embebidas en código como "permiso".
- Un endpoint para que un usuario se asigne roles a sí mismo.
- Un `authenticate` propio o un fork del middleware.
- Roles dentro del JWT o de la sesión: el rol debe resolverse en servidor en
  cada petición (RBAC ya lo hace con caché de 60 s).
- Field filtering manual como sustituto de políticas. No protege la operación,
  solo la respuesta.

### 6.6 Límites conocidos de RBAC nativo

- Es **opt-in**: si el módulo no está instalado, todo `authorize` es no-op.
  Cualquier test de seguridad debe comprobar primero que
  `/rbac/me/permissions` responde y que una política ausente devuelve `403`.
- El filtrado de campos (`RBACFieldFilter`) se aplica a rutas que usan
  `queryConfig`/`query.graph`. Las rutas `jovy` resuelven el servicio del módulo
  directamente, así que **no hay filtrado automático**: `admin_notes` y demás
  campos vuelven completos si el endpoint los devuelve. Hay que decidirlo en el
  endpoint o con la política.
- Las API keys secretas heredan los roles del usuario creador. No son un actor
  independiente con permisos propios.
- En peticiones con API key, `getAdminActorId`
  (`src/lib/jovy/audit.ts:5-8`) registra el **id de la clave**, no el usuario.
  La trazabilidad queda a medias.
- `/rbac/*` no acepta API keys (solo bearer/session), así que la gestión de
  roles no puede automatizarse con una API key.

## 7. Hallazgos

| Sev. | Hallazgo | Precondición / ataque | Impacto | Código afectado | Remediación |
| --- | --- | --- | --- | --- | --- |
| **Alta** | Sin autorización por rol: todo actor `user` o API key es admin pleno | Cualquier sesión admin válida, JWT o API key filtrada; un invitado con rol "editor" tendría acceso total | Lectura masiva de PII de contactos, cambio de contenido público y de configuración; sin separación de funciones | `apps/backend/medusa-config.ts:16-59` (módulo ausente); `src/api/middlewares.ts:13-16`; `authorize.js:43-45` | Activar RBAC y políticas de dominio (sección 6). Mientras tanto: mínimo número de admins, rotación de API keys, no compartir sesiones |
| Media | Listado de contactos con PII sin control por rol | Cualquier admin autenticado hace una sola petición | Cada página expone nombre, email, teléfono, mensaje y notas; al no haber RBAC, cualquier actor `user` o API key puede recorrer el dataset completo | `src/api/admin/jovy/contacts/route.ts`; `src/lib/jovy/contacts.ts` | Activar RBAC con `jovy_contact:read`, limitar campos por rol y separar `admin_notes`; la paginación y los filtros en SQL ya están implementados |
| Media | API keys con privilegio pleno y atribución incompleta | Fuga de una clave `sk_` (script, CI, `.env` mal protegido) | Acceso persistente a todo el admin; auditoría registra el id de la clave, no la persona | `authenticate-middleware.js:21-38`; `src/lib/jovy/audit.ts:5-8` | Activar RBAC (hereda roles del creador), rotar claves, no usar claves para personas, registrar `secret_key_context.created_by` |
| Media | Rate limit de contactos en memoria por proceso | Varias instancias/reinicios, o tráfico distribuido | Bypass del límite; spam, crecimiento de BD y posible abuso del buzón comercial | `src/lib/jovy/contact-rate-limit.ts:1-9`; `src/api/store/jovy/contacts/route.ts:8-11` | Limitador compartido (Redis/Postgres) o en el borde; conservar honeypot |
| Baja | `media_file_id` sin validación homogénea contra archivos existentes | Un admin envía cualquier id en marketing o eventos | Referencias huérfanas o a archivos de otro contexto (todos públicos hoy) | `src/lib/jovy/marketing.ts`; `src/lib/jovy/events.ts`; validación existente en `src/lib/jovy/brand-persistence.ts` (`NOT_FOUND`) | Extender a marketing y eventos la validación de existencia y tipo que ya aplica Brand |
| Baja | `authenticate` duplicado y acoplado a `/admin/jovy/*` | Deriva si se añaden rutas fuera del matcher | Falsa sensación de control; el loader sigue protegiendo, pero el código miente | `src/api/middlewares.ts:13-16` | Comentar como defensa en profundidad o retirarlo y documentar que el loader autentica `/admin` |
| Info | Auditoría sin instantánea de rol ni id de petición | Investigación posterior | No se puede probar qué rol tenía el actor al ejecutar la acción | `src/lib/jovy/audit.ts:10-25`; `src/workflows/jovy-marketing/hero-settings.ts:12` | Añadir rol efectivo y `request_id` (opcional) |

### 7.1 Correcciones requeridas para producción

1. **Activar RBAC y declarar políticas de dominio** (hallazgo Alta). Sin esto,
   no hay separación entre contenido, marketing, contactos y configuración.
2. **Proteger el listado de contactos con RBAC y filtrado de campos**
   (Media). La paginación, el orden estable y los filtros en SQL ya están
   implementados; el riesgo residual es que cualquier rol con acceso al listado
   recibe la PII completa de cada página.
3. **Tratar las API keys como credenciales de máquina**: rotación, mínimo
   privilegio del usuario creador y atribución en auditoría (Media).
4. **Rate limit compartido** si el backend corre con más de un proceso o si el
   formulario queda expuesto a Internet (Media).

### 7.2 Endurecimiento opcional

- Extender a marketing y eventos la validación de `media_file_id` contra el File Module que ya aplica Brand.
- Añadir rol efectivo y `request_id` a los registros de auditoría.
- Reducir el `RBAC_CACHE_TTL` si se exige revocación inmediata de roles.
- Añadir pruebas de autorización negativas (ver sección 9).

## 8. Límites de laboratorio vs. producción

| Tema | Aceptable en laboratorio | Bloqueo para producción |
| --- | --- | --- |
| RBAC ausente | Sí, con un único operador y sin PII real | **Sí**: no hay separación de funciones ni mínimo privilegio |
| Contactos con PII | Solo con datos ficticios y sin exposición de red | **Sí**: PII real legible por cualquier admin |
| API keys compartidas | No recomendable, pero sin impacto externo | **Sí**: credencial de larga vida con acceso total |
| Rate limit en memoria | Aceptable con una instancia local | **Sí** si hay más de una instancia o exposición pública |
| Dashboard como control | No usar como control en ningún entorno | **Sí**: ocultar botones no autoriza |
| CORS/secretos/JWT | `.env` local, no versionado | Deben configurarse por entorno y rotarse; no evaluado aquí |

El repositorio es de laboratorio local (sin Docker ni despliegue). Estas
condiciones son requisitos de salida, no una afirmación de que el sistema esté
listo para producción.

## 9. Verificación recomendada

Con RBAC activo:

1. `GET /rbac/me/permissions` responde `200`; un usuario sin rol recibe `403`
   en `/admin/jovy/content/pages`.
2. Un usuario con solo `jovy_content:*` obtiene `403` en
   `GET /admin/jovy/contacts` y en `PUT /admin/jovy/marketing/hero/settings`.
3. Un usuario con `jovy_contact:read/update` no puede `DELETE` contactos ni
   escribir contenido.
4. Una API key creada por un usuario con rol limitado no puede superar ese rol.
5. Tras retirar un rol, la denegación aplica en un máximo de 60 s.

Sin RBAC (estado actual), la comprobación es la inversa: todas esas peticiones
responden `2xx` con cualquier sesión admin válida. Eso es el gap, no un fallo de
configuración puntual.

## 10. Evidencia de la instalación

| Afirmación | Archivo / línea |
| --- | --- |
| Versiones exactas instaladas | `apps/backend/package.json` (`@medusajs/medusa`, `framework`, `admin-sdk`, `dashboard` = `2.22.6`); `apps/backend/node_modules/@medusajs/*/package.json` |
| `@medusajs/rbac` existe como dependencia transitiva | `pnpm-lock.yaml:1797`, `pnpm-lock.yaml:10010`; `node_modules/.pnpm/@medusajs+rbac@2.22.6_*` |
| Módulo exportado por medusa | `node_modules/@medusajs/medusa/dist/modules/rbac.js:21-24` |
| Módulo no registrado en el proyecto | `apps/backend/medusa-config.ts:16-59` |
| Sin tipos RBAC generados | `.medusa/types/*` (sin entidades `rbac_*`) |
| Rutas `/rbac` desactivadas | `node_modules/@medusajs/medusa/dist/api/rbac/roles/route.js:48-50` |
| `authorize` no-op sin módulo | `node_modules/@medusajs/framework/dist/http/middlewares/authorize.js:43-45` |
| `hasPermission` devuelve `true` sin módulo | `node_modules/@medusajs/framework/dist/policies/has-permission.js:73-75` |
| Autenticación global de `/admin` | `node_modules/@medusajs/framework/dist/http/router.js:93-97` |
| Autenticación de `/rbac` | `node_modules/@medusajs/framework/dist/http/router.js:104-111` |
| Autenticación de `/store` | `node_modules/@medusajs/framework/dist/http/router.js:118-120` |
| Semántica de 403 en `authorize` | `authorize.js:56-58`, `:65-67`, `:74-82` |
| Roles por tipo de actor (`user`, `api-key`) | `@medusajs/rbac/dist/services/rbac-module-service.js:28-45`, `:78-80` |
| Siembra de Super Admin `*:*` | `@medusajs/rbac/dist/loaders/initial-data.js:10-18` |
| Asignación de Super Admin a todos los usuarios | `@medusajs/medusa/dist/migration-scripts/create-super-admin-role.js:39-100`, `:123-131` |
| `db:migrate` ejecuta migration scripts | `@medusajs/medusa/dist/commands/db/migrate.js` (llama a `db:migrate:scripts`) |
| Guardas core ya instrumentadas | `@medusajs/medusa/dist/api/admin/products/middlewares.js:85-90` y siguientes |
| Anti-escalada al asignar roles | `@medusajs/medusa/dist/api/admin/users/[id]/roles/route.js:55-70` |
| Recursos core sin `jovy_*` | `@medusajs/types/dist/rbac/common.d.ts` (`CORE_POLICY_RESOURCES`) |
| Reglas de operaciones | `@medusajs/types/dist/rbac/common.d.ts` (`PolicyOperationRegistry`) |
| Pantallas de roles en dashboard | `.medusa/server/public/admin/assets/role-*.js` |
| API key: contexto y creador | `@medusajs/framework/dist/http/middlewares/authenticate-middleware.js:21-38`; `set-secret-api-key-context.js:5-28` |
| Protección propia de rutas jovy | `apps/backend/src/api/middlewares.ts:13-16` |
| Actor de auditoría | `apps/backend/src/lib/jovy/audit.ts:5-8` |
| Contacto público: validación, rate limit, honeypot | `apps/backend/src/api/store/jovy/contacts/route.ts:7-19`; `src/lib/jovy/contact-rate-limit.ts:1-9` |
| Listado de contactos | `apps/backend/src/api/admin/jovy/contacts/route.ts`; `src/lib/jovy/contacts.ts` |
| Configuración del hero | `apps/backend/src/api/admin/jovy/marketing/hero/settings/route.ts:6-19` |
| Subida de imágenes | `apps/backend/src/api/admin/jovy/marketing/media/route.ts:10-45` |
| Tipos de evento | `apps/backend/src/api/admin/jovy/events/types/route.ts`; `src/api/admin/jovy/events/types/[id]/route.ts` |
| Esquemas Zod de dominio | `src/lib/jovy/editorial-page.ts`, `marketing.ts`, `brand.ts`, `events.ts`, `contacts.ts` |
| `cta_url` restringido a relativo o `https://` | `src/lib/jovy/marketing.ts:8-14` |

## 11. Controles que sí están implementados

- Validación Zod estricta por dominio, antes de cualquier escritura.
- Rutas públicas filtran por `status`, `enabled` y ventana temporal en servidor
  (`isPublicBrandItem`, `isMarketingVisible`), sin exponer borradores.
- Formulario público con límite de tamaño, rate limit básico y honeypot; las
  respuestas del honeypot no persisten. El `429` envía `Retry-After` con los
  segundos restantes; la cuota no se consume en errores de validación `400`.
- Listado administrativo de contactos paginado (`limit` 1–100, `offset`,
  orden `created_at DESC, id DESC`) con filtros `status`, `contact_type` y `q`
  resueltos en SQL; `%` y `_` se escapan para que la búsqueda sea literal.
- Auditoría de contactos con whitelist: solo `status` y `contact_type`, sin
  mensaje, email ni teléfonos.
- Subida de imágenes con verificación de bytes mágicos, decodificación con
  `sharp`, límite de 5 MB, un solo archivo y nombre UUID.
- URLs de CTA limitadas a rutas relativas o `https://` (evita `javascript:`).
- Auditoría de mutaciones con `actor_id` en contenido, marketing, eventos, marca
  y contactos.
- Secretos locales fuera de Git (`.env` ignorado); no se leyeron credenciales
  históricas.
- Búsqueda de tienda restringida al índice `product`
  (`src/api/middlewares.ts:25-35`).

Estos controles reducen el impacto de errores de entrada, pero **no sustituyen**
la autorización por rol.
