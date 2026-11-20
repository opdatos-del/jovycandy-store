# Segunda ola de refactorización — JovyCandy 3.0

**Corte:** 2026-11-20  
**Base:** `785015f1573f7dfec05f403ff175e8c91197f399`  
**Alcance:** Admin Medusa y configuración del backend. Storefront fuera de alcance.

## 1. Línea base

Antes de tocar código se verificó la rama y la regresión publicada:

| Check | Resultado |
|---|---|
| HEAD | `785015f` |
| typecheck | 0 |
| lint | 0 errores; 2 warnings preexistentes |
| unit | 32 suites / 332 pruebas |
| integración módulos | 6 suites / 37 pruebas |
| integración HTTP | 11 suites / 76 pruebas |
| E2E | 31/31 |
| build | OK |

## 2. Problemas encontrados

1. `cookieOptions.secure` estaba fijado en `false`, correcto para HTTP local pero inseguro como valor único.
2. `adminRequest` expandía `init.headers` como objeto: perdía `Headers`/pares y añadía JSON a todo cuerpo que no fuera `FormData`.
3. Novedades importaba `routes/jovy-herramientas/events/ordering.ts`, una ruta privada de otra pantalla.
4. El foco de `AdminDialog` no filtraba elementos ocultos y los modales apilados podían consumir Escape dos veces.
5. Contactos concentraba exportaciones, detalle, auditoría y mutaciones en un componente de 669 líneas.
6. Quedaban rutas con fetching/estado: Lanzamientos, Catálogo, Contenido, Eventos, Dashboard y Marketing.
7. El widget editorial y Marketing conservaban clientes/alias HTTP locales.
8. Faltaban reglas automáticas para dependencias shared/features/backend, `fetch`, ciclos y rutas ligeras.

## 3. Decisiones arquitectónicas

- **Cookies por entorno:** Secure por defecto cuando `NODE_ENV=production`; `ADMIN_ALLOW_HTTP=true` desactiva Secure solo de forma explícita para el build local HTTP. Sin el flag, producción exige HTTPS.
- **Headers estándar:** `new Headers(init.headers)`; Content-Type JSON solo para cuerpos que lo son; `credentials` explícitas del llamador siempre ganan.
- **Ordenamiento de eventos:** `@admin/shared/lib/event-ordering`, usado por Eventos y Novedades.
- **Diálogo:** se conserva el componente propio porque Medusa UI no ofrece en esta versión una primitiva que cubra portal, prompt apilado, foco y footer sin cambiar el DOM. Se refuerza el foco visible y la pila de Escape.
- **Contactos:** separación por responsabilidad (`query`, `detail`, `mutations`, `audit`, `export`) en lugar de un hook monolítico.
- **Anuncios:** el formulario conserva sus secciones internas (multimedia, distribución, contenido, CTA, vigencia) y el estado único del borrador. No se extrajo cada sección: el prop drilling superaba el beneficio y el formulario ya está cohesionado por bloques.
- **Reglas:** ESLint para límites de bundle/shared; prueba de arquitectura para features, páginas, ciclos y `fetch`. Sin dependencias nuevas.
- **Migraciones:** patrón `route -> feature -> shared` en todos los dominios restantes.

## 4. Archivos refactorizados

Fundamentos y correcciones:

- `apps/backend/medusa-config.ts`, `.env.example`, `.env` (local).
- `src/admin/shared/lib/admin-api.ts` y `src/admin/shared/lib/__tests__/admin-api.test.ts`.
- `src/admin/shared/components/admin-dialog.tsx`.
- `src/admin/shared/lib/event-ordering.ts` y su prueba.
- `eslint.config.ts`, `src/admin/__tests__/architecture.test.ts`.

Features completadas o migradas:

| Dominio | Ubicación | Ruta resultante |
|---|---|---|
| Contactos | `features/contacts` | wrapper existente |
| Anuncios | `features/announcements` | wrapper existente |
| Logos | `features/logos` | wrapper existente |
| Novedades | `features/novelties` | wrapper existente |
| Galería | `features/gallery` | `routes/jovy/brand/page.tsx` |
| Lanzamientos | `features/launches` | `routes/jovy/launches/page.tsx` |
| Catálogo | `features/catalogue` | `routes/jovy/catalogue/page.tsx` |
| Dashboard | `features/dashboard` | `routes/jovy/page.tsx` y `dashboard/page.tsx` |
| Marketing | `features/marketing` | `routes/jovy-herramientas/marketing/page.tsx` |
| Contenido | `features/content` | `routes/jovy-herramientas/content/page.tsx` |
| Eventos | `features/events` | `routes/jovy-herramientas/events/page.tsx` |
| Ficha editorial | `features/product-editorial` | `widgets/product-editorial.tsx` |

Se eliminaron los componentes privados de las rutas de Galería, Lanzamientos, Catálogo y Marketing, y el shim `routes/jovy/components/admin-api.ts`.

## 5. Componentes extraídos

- Galería: página, manager, formulario, tarjeta, carga, lightbox y agenda.
- Lanzamientos: página, tarjeta, formulario, ajustes de color y selector de producto.
- Catálogo: página, tarjeta, formulario y preview de storefront.
- Dashboard: página, cabecera, KPIs, operaciones y analítica.
- Marketing: página, Hero (manager, listado, formulario) y mensaje corporativo (panel y formulario).
- Contenido y Eventos: página y formularios por responsabilidad.
- Ficha editorial: widget, formulario y secciones comercial, contenido, catálogo y publicación.
- Contactos: tabla, filtros, diálogos de detalle, edición y auditoría.

## 6. Hooks extraídos

- `useContactQuery`: lista, contadores, polling y detección de nuevas solicitudes.
- `useContactDetail`: apertura, notas, auditoría y sincronización del detalle.
- `useContactMutations`: estado, papelera, restauración y edición.
- `useContactAudit`: historial desde la tabla con invalidación de peticiones.
- `useContactExport`: CSV/XLSX por bandeja y consolidado.
- `useHero`, `useCorporateMessage`.
- `useCatalogue`, `useContent`, `useEvents`, `useDashboard`, `useProductEditorial`.
- `useLaunches`, `useLaunchForm`, `useLaunchList`, `useLaunchSettings`.

## 7. Clientes API consolidados

- `@admin/shared/lib/admin-api` es el único módulo que ejecuta `fetch`.
- Cada feature expone su API tipada sobre `adminRequest`: `contacts-api`, `announcements`, `logos`, `novelties`, `gallery`, `launches`, `catalogue`, `content`, `events`, `marketing`, `dashboard`, `product-editorial`.
- `shared/lib/media` centraliza validación y carga general; Logos conserva su carril de 20 MB.
- `@admin/shared/lib/event-ordering` concentra el orden por prioridad.

## 8. Reglas automáticas

ESLint (`eslint.config.ts`):

- `fetch` prohibido en `src/admin/**` fuera de `shared/lib/admin-api.ts`.
- Admin no importa `@jovy/modules/*`, `@jovy/workflows/*` ni `@jovy/api/*`.
- `shared` no importa `@admin/features/*` ni `@admin/routes/*`.
- Imports relativos de dos o más niveles prohibidos; se usa `@admin/*`.

Prueba `src/admin/__tests__/architecture.test.ts`:

1. `shared` no depende de `features` ni de `routes`.
2. Una feature no importa archivos privados de otra.
3. Una feature no importa rutas administrativas.
4. El Admin no importa `src/modules`, `src/workflows` ni `src/api`.
5. Solo el cliente común usa `fetch`.
6. Los `page.tsx` no contienen `fetch`, `adminRequest`, `useState` ni `useEffect`.
7. No existen ciclos de imports.

## 9. Excepciones justificadas

- **`AdminDialog`:** no se sustituyó por Medusa UI para no alterar portal, foco, footer ni el Prompt apilado.
- **Formulario de banners:** 737 líneas con secciones internas; se conserva porque comparte un único borrador y validación. Extraer cada sección exigiría props cruzadas sin mejorar la cohesión.
- **Anuncios/Marketing:** el mensaje corporativo se persiste en `/admin/jovy/announcements/settings` para no duplicar contrato.
- **Galería sin hook de servidor:** el manager conserva estado de vista y servidor; separarlo habría creado un hook gigante. La cohesión se logró con API, formulario y tarjeta.
- **Shim de Marketing eliminado:** `toDateTimeLocal`/`toIso` viven en `features/marketing/lib/datetime.ts`.

## 10. Contratos preservados

- Rutas y envelopes de API sin cambios.
- Testids, labels, aria y textos conservados.
- Ninguna migración ni modelo modificado.
- Product Module, precios, inventario, variantes y compra intactos.
- CSV/XLSX, restore, locking, ventanas, lightbox y confirmaciones sin cambios.
- RBAC sigue pendiente y no se simula.

## 11. Riesgos

- El alias `@admin` depende de la configuración Vite de Medusa.
- El junction `static` es operativo local y debe recrearse tras un build.
- El formulario de banners sigue siendo el archivo más grande del Admin.
- Las reglas de arquitectura pueden necesitar ajustes si Medusa cambia la resolución de rutas.
- Las cookies requieren que `ADMIN_ALLOW_HTTP` se elimine en cualquier despliegue HTTPS.

## 12. Pruebas ejecutadas

| Check | Resultado |
|---|---|
| typecheck | 0 errores |
| lint | 0 errores; 2 warnings preexistentes (`.test-results/audit-headings/audit.cjs`) |
| unit | 34 suites / 346 pruebas |
| arquitectura | 7 reglas aprobadas |
| integración módulos | 6 suites / 37 pruebas |
| integración HTTP | 11 suites / 76 pruebas |
| build | backend y Admin correctos |
| E2E | 31/31 |

La primera corrida E2E tuvo un fallo aislado de navegación en Dashboard; la misma spec pasó
inmediatamente al repetirla y la corrida completa posterior terminó 31/31, sin cambios de código
entre ambas. Se atribuye al recargado del servidor de desarrollo de Vite, no al bundle de
producción, que ya había compilado correctamente.

## 13. Validación visual

Revisión con Browse sobre el build de producción en `localhost:9000`:

- 1440 × 1000, tema claro: Dashboard, Categorías, Lanzamientos, Galería, Anuncios,
  Contactos, Marketing, Contenido, Eventos y Novedades.
- 375 × 812, tema claro: Lanzamientos, Galería, Contactos y Marketing.
- Tema oscuro: Dashboard, Lanzamientos y Marketing.

Resultados: `document.scrollWidth === innerWidth` en todas las pantallas (sin overflow de página),
consola sin errores y mismos títulos, tarjetas, formularios y acciones que antes de la migración.
Las capturas quedaron en el directorio temporal de la sesión, fuera del repositorio.

## 14. Estado final

`VALIDADO` en local: typecheck, lint, unitarias, arquitectura, integración, E2E y build aprobados.
Sin commit ni push por instrucción expresa de esta fase.

## 15. Pendientes reales

- RBAC y autorización por rol.
- Pruebas de interacción DOM de `AdminDialog` (requieren jsdom y Testing Library; no se añadieron dependencias en esta ola).
- Reducir el formulario de banners si en el futuro cambia su modelo de estado.
- Validación HTTPS real en el entorno de despliegue.
- Commit y publicación de la segunda ola cuando se autorice.
