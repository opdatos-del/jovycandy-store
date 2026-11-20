# Convenciones del frontend Medusa Admin

**Corte:** 2026-11-20
**Aplica a:** `apps/backend/src/admin/**`.

## 1. Regla de oro

`page.tsx` registra; la feature implementa. Ninguna pantalla registrada debe contener fetching, formularios extensos ni reglas de negocio.

## 2. Estructura de una feature

```text
features/<dominio>/
├── api.ts                 # HTTP tipado del dominio
├── types.ts               # Tipos de UI/API (no DML)
├── hooks/                 # Estado de servidor y flujos
├── components/            # Presentación y composición
└── lib/                   # Helpers puros del dominio
```

No se crean carpetas vacías ni una estructura idéntica para todos los dominios. Se organiza según complejidad real.

## 3. Rutas

```tsx
import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Images } from "@medusajs/icons"
import { NoveltiesPage } from "@admin/features/novelties/components/novelties-page"

const Page = () => <NoveltiesPage />

export const config = defineRouteConfig({ label: "Novedades", icon: Images, rank: 7 })
export default Page
```

- No se mueve `page.tsx` fuera de `src/admin/routes`.
- No se cambia el `label`, `icon`, `rank` ni la ruta pública sin autorización.
- Los widgets permanecen en `src/admin/widgets`.

## 4. Cliente HTTP

Usar siempre:

```ts
import { adminRequest, errorMessage, saveBlob } from "@admin/shared/lib/admin-api"
```

- `adminRequest<T>` conserva cookies, añade JSON y normaliza errores con `AdminApiError` y `status`.
- `errorMessage(error, fallback)` produce el texto visible.
- `downloadAdminFile` + `saveBlob` manejan CSV/XLSX y cabeceras de descarga.
- No se crea un `fetch` propio por pantalla.
- No se importan servicios Node ni módulos de backend en el Admin.

## 5. Medios

```ts
import {
  MARKETING_IMAGE_ACCEPT,
  MARKETING_IMAGE_MAX_BYTES,
  uploadMarketingImage,
  validateImageFile,
} from "@admin/shared/lib/media"
```

- El carril general acepta PNG/JPEG/WebP hasta 5 MB.
- Logos usa su propio endpoint y límite de 20 MB (PNG/JPEG/WebP/GIF).
- El servidor vuelve a validar firma y MIME; la validación de cliente solo mejora el mensaje.
- No se duplican constantes de tipos/tamaño.

## 6. Hooks

Extraer un hook cuando existe:

- fetching con loading/error;
- polling o refresco;
- mutaciones con invalidación;
- filtros/paginación con estado de servidor;
- formularios con estado complejo;
- carga de archivos.

Ejemplo: `features/contacts/hooks/use-contact-query.ts` encapsula lista, contadores, polling y detección de nuevas solicitudes. La UI conserva filtros y render.

No se crea un hook para una operación trivial de una línea.

## 7. Componentes

- **Presentacionales:** reciben datos y callbacks; no hacen `fetch`.
- **Contenedores:** orquestan hook + componentes.
- **Compartidos:** solo con dos o más consumidores reales.
- Props explícitas; evitar componentes con decenas de props.
- No mover un componente a `shared` solo porque “podría” reutilizarse.

Candidatos ya compartidos:

- `AdminDialog` (foco, Escape, scroll, restauración).
- `PageHeader` (título, descripción, acciones).
- `AdminApiError`, `adminRequest`, `downloadAdminFile`, `saveBlob`.
- `validateImageFile`, `uploadMarketingImage`, `uploadImageTo`.
- `isValidHexColor`, `expandHexColor`.

## 8. Formularios y modales

- Conservar labels, `name`, `id`, `aria-label`, `data-testid` y mensajes existentes.
- Los formularios largos se dividen en secciones o componentes de campo solo si hay un límite claro.
- Los modales usan `AdminDialog`; no se duplica foco/Escape/portal.
- La confirmación de Medusa (`usePrompt`) se mantiene por encima del modal.
- El botón de guardado puede vivir en el footer del diálogo usando `form="<id>"` y `type="submit"`.

## 9. Estilos y accesibilidad

- Usar tokens `ui-*` y `jovy-*`; no colores fijos salvo casos intencionales (por ejemplo, fondo de vídeo).
- Conservar `data-jovy-quality` en pantallas y modales.
- Mantener foco visible, `aria-*`, navegación por teclado y `prefers-reduced-motion`.
- No rediseñar durante una refactorización estructural.
- Verificar claro/oscuro y 375/1440.

## 10. Imports y dependencias

- Alias `@admin/*` para `src/admin/*`.
- No usar `@jovy/*` en el Admin (Vite no lo resuelve).
- No cadenas `../../..`; si aparecen, usar el alias.
- No dependencias circulares entre features.
- Una feature no importa componentes privados de otra.

## 11. Contratos

- No cambiar rutas, envelopes, nombres de campos, estados HTTP, cabeceras ni errores.
- Los tipos de UI viven en la feature; no se importan modelos DML.
- Si un contrato debe cambiar, documentar impacto y solicitar autorización.

## 12. Pruebas

Antes de cerrar una feature:

```powershell
pnpm --dir apps/backend typecheck
pnpm --dir apps/backend lint
pnpm --dir apps/backend test:unit
pnpm --dir apps/backend test:e2e -- <spec-del-dominio>
```

Al cerrar una ola: suite E2E completa, integración y build.

Checklist:

- [ ] Ruta sigue registrada.
- [ ] Testids y labels intactos.
- [ ] Sin duplicación de cliente HTTP.
- [ ] Sin `fetch` en componentes presentacionales.
- [ ] Sin imports cruzados privados.
- [ ] Modo claro/oscuro y responsive verificados.
- [ ] Unit/E2E verdes.
