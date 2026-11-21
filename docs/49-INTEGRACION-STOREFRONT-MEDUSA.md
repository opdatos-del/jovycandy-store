# Integración del storefront con Medusa

**Corte:** 2026-11-21
**Consumidor:** `apps/storefront` (Next.js 16, App Router)
**Backend:** Medusa v2 `2.22.6` · `/store/**` únicamente

## 1. Inventario de APIs públicas usadas

| Recurso | Endpoint | Consumidor | Estado |
|---|---|---|---|
| Hero | `GET /store/jovy/marketing/hero` | Home | Conectado; fallback si vacío |
| Banners promo | `GET /store/jovy/marketing/banners/promo` | Home / pendiente promo banner | Cliente implementado; UI pendiente |
| Anuncios corporativos | `GET /store/jovy/announcements/settings` | Home | Datos cargados; render pendiente |
| Categorías | `GET /store/jovy/catalogue/categories` | Home / catálogo | Conectado |
| Familias | `GET /store/jovy/catalogue/families` | Catálogo | Contrato disponible; UI pendiente |
| Productos editoriales | `GET /store/jovy/products` | Home / catálogo / ficha | Conectado |
| Eventos | `GET /store/jovy/events` | Novedades | Conectado; fallback si vacío |
| Galería Casa Jovy | `GET /store/jovy/brand/gallery` | Casa Jovy | Conectado; filtro de demo + fallback |
| Logos | `GET /store/jovy/brand/logos` | Catálogo | Contrato disponible; UI pendiente |
| Lanzamientos | `GET /store/jovy/launches` | Home | Contrato disponible; UI pendiente |
| Páginas corporativas | `GET /store/jovy/content/pages/:slug` | Contenido | Contrato disponible; página pendiente |
| Contacto | `POST /store/jovy/contacts` | Modal de contacto | Proxy `/api/contact` implementado |

Reglas:

- Solo rutas `/store/**`; nunca `/admin/**`.
- La publishable key se usa en servidor y en el proxy; no se expone como control de acceso.
- Los fetch tienen timeout y fallback; un backend caído no bloquea el build.
- Los envelopes se respetan (`hero_items`, `banners`, `categories`, `products`, `events`, `items`, `settings`, `accepted`).

## 2. Flujo de datos

```text
Medusa Store API
      │  (server fetch + publishable key)
      ▼
src/lib/cms/client.ts  ──►  Home / Catálogo / Ficha
      │
      └─► fallback editorial (assets oficiales) si el CMS está vacío
```

`getHomeContent(locale)` usa `"use cache"`, `cacheLife("minutes")` y el tag `jovy-content`. La revalidación por publicación/archivo desde Admin queda **PENDIENTE**; hoy el TTL es de minutos y el contenido local es demo.

## 3. Contacto

```text
ContactDialog (cliente)
   → POST /api/contact (Route Handler)
      → POST Medusa /store/jovy/contacts
         → createContactWorkflow
```

- Honeypot `website`.
- Cuatro bandejas: `national-sales`, `international-sales`, `customer-service`, `catalogue`.
- El backend aplica validación Zod, rate limit y respuesta 202.
- La UI muestra confirmación y error sin PII.
- Probado con solicitud inválida → 400; falta E2E con solicitud sintética y limpieza controlada.

## 4. Brechas

| Brecha | Estado |
|---|---|
| Revalidación en vivo tras publicar/archivar | PENDIENTE |
| Carrito/checkout | PENDIENTE |
| Ficha de producto para fallbacks sin `handle` | PENDIENTE |
| Filtros por familia y categoría combinados | PENDIENTE |
| Búsqueda | PENDIENTE |
| Páginas corporativas `/contenido/[slug]` | PENDIENTE |
| PWA / offline | PENDIENTE |
| SEO por producto | PENDIENTE |
| Sitemap/redirects | PENDIENTE |

## 5. Estado

La Home, el catálogo informativo, la ficha de producto CMS y el formulario de contacto están conectados a Medusa. El ecommerce transaccional no se declara implementado.
