# Hover de producto Jovy Rings (imágenes servidas por Medusa)

> Este documento describe el caso Rings. A partir de `docs/74-PRODUCT-CARD-VISUAL-MANAGER.md` forma parte del motor global `ProductCardVisual`; el comportamiento y las claves se conservan.

**Estado:** IMPLEMENTADO Y VALIDADO EN LABORATORIO.  
**Producto de referencia:** `jovy-aros-manzana-verde` (Jovy Rings Green Apple Flavor).  
**Alcance:** tarjetas del catálogo; no modifica el diseño del empaque ni la ficha de producto.

## 1. Esquema de datos

Todas las URLs de medios viven en Medusa. El storefront solo proyecta las claves públicas `card_hover_*` de `product.metadata`:

```json
{
  "card_hover_enabled": true,
  "card_hover_mode": "layered",
  "card_hover_base_url": "https://<medusa>/static/...-jovy-rings-01-bolsa-original.webp",
  "card_hover_overlay_url": "https://<medusa>/static/...-jovy-rings-03-gomitas-explosion.webp",
  "card_hover_full_url": "https://<medusa>/static/...-jovy-rings-02-hover-completo.webp",
  "card_gummy_url": "https://<medusa>/static/...-jovy-rings-04-gomita-individual.webp",
  "card_hover_background": "#EAF7E8"
}
```

- `card_hover_enabled`: obligatorio; si falta o es `false`, la tarjeta usa solo el thumbnail.
- `card_hover_mode`: `layered` (preferido) o `swap`.
- `card_hover_overlay_url`: capa decorativa de gomitas, sin bolsa. Requerida para `layered`.
- `card_hover_full_url`: composición bolsa + explosión. Requerida para `swap`.
- `card_gummy_url`: recurso opcional de una gomita, no usado en la tarjeta hoy.
- `card_hover_background`: color hex opcional para el fondo de la tarjeta.

El thumbnail del producto se asigna al recurso 01. El storefront no conoce rutas fijas ni índices de galería: lee exclusivamente las claves anteriores.

### Verificación de la Store API

En Medusa 2.22.6 `product.metadata` no viene por defecto en las respuestas con `fields` explícitos. Se solicita con la sintaxis de campos de la Store API:

```text
GET /store/products?handle=jovy-aros-manzana-verde&fields=id,handle,thumbnail,images.url,metadata,+metadata
```

`metadata` o `+metadata` devuelven el objeto. Antes de exponerlo, `parseCardHover()` valida:

- `card_hover_enabled` estrictamente `true`/`"true"`;
- URLs `http(s)` o rutas locales que empiezan por `/`;
- rechazo de marcadores (`URL_REAL`, `REPLACE_ME`, `TODO`, `<`, `>`);
- color con formato `#RGB` o `#RRGGBB`.

El resto de `metadata` (por ejemplo `jovy_seed`, `jovy_category`) no se envía al componente de tarjeta.

## 2. Carga de recursos en Medusa

Script idempotente incluido:

```powershell
pnpm --dir apps/backend seed:card-hover
```

Variables opcionales:

```powershell
$env:CARD_HOVER_SOURCE = "C:\ruta\a\jovy-rings-assets-medusa-storefront"
$env:CARD_HOVER_HANDLE = "jovy-aros-manzana-verde"
```

Qué hace:

1. Lee los cuatro `.webp` desde la carpeta indicada (por defecto `~/Downloads/jovy-rings-assets-medusa-storefront`).
2. Los sube con el File Module existente (`file-local`), sin copiarlos al repositorio del storefront.
3. Asigna el recurso 01 como `thumbnail` y agrega los demás a `product.images`.
4. Escribe las URLs reales en `product.metadata`.
5. Si las URLs existentes responden `200`, no vuelve a subir archivos.

No se implementó un sistema de subida nuevo: se reutiliza el almacenamiento de Medusa.

## 3. Comportamiento de la tarjeta

Componente: `apps/storefront/src/features/catalog/product-card-media.tsx`.

### Modo `layered` (preferido)

- La capa de gomitas (03) se renderiza primero, absoluta, `inset: 0`, `object-fit: contain`, `z-index: 1`.
- La bolsa original (01) va encima, `z-index: 2`, con `alt` descriptivo.
- Estado normal: gomitas `opacity: 0`, `translateY(12px) scale(0.9)`.
- Hover o foco de teclado: gomitas `opacity: 1`, `translateY(0) scale(1)`, 420 ms.
- La bolsa no cambia de tamaño, encuadre ni posición.
- Fondo opcional con `card_hover_background`.

### Modo `swap` (fallback)

Si no hay 03 pero sí 02, la composición completa se superpone con crossfade de 420 ms. Ambos recursos deben compartir lienzo y `object-fit`.

### Fallbacks

- Sin metadata válida: solo thumbnail, sin capa ni fondo.
- URL inválida o marcador: se descarta la configuración.
- Error de carga (`onError`): la capa se desmonta y queda la bolsa base.
- Sin JavaScript no hay capa decorativa; la tarjeta y el enlace siguen funcionando.

## 4. Accesibilidad y movimiento

- La capa decorativa usa `alt=""` y `aria-hidden="true"`.
- La bolsa conserva el `alt` del producto.
- El enlace de la tarjeta mantiene una única acción; no se anidan controles.
- Teclado: se activa con `:has(.catalog-card__image:focus-visible)`.
- Touch: `@media (hover: hover)` evita exigir doble tap; se navega normal.
- `prefers-reduced-motion: reduce`: sin transición ni desplazamiento; el cambio de capa es inmediato.

## 5. Rendimiento

- Bolsa base `loading="lazy"` salvo las cinco primeras tarjetas (`eager` + `fetchPriority="high"`).
- Capas decorativas `loading="lazy"`, `decoding="async"`, `fetchPriority="low"`.
- Marco con `aspect-ratio: 1` y posiciones absolutas: sin layout shift.
- Peso de referencia de los assets: 137 KB (01), 366 KB (02), 235 KB (03), 100 KB (04).
- El proyecto usa `<img>` con URLs absolutas de Medusa, por lo que no requiere `remotePatterns` de `next/image`.

## 6. Otros sabores o productos

1. Generar los recursos 01–04 con el mismo lienzo 1600 × 1600 y la bolsa alineada.
2. Subirlos con el File Module (Admin de Medusa o script equivalente).
3. Asignar 01 como `thumbnail`.
4. Copiar en `product.metadata` las claves `card_hover_*` con las URLs reales.
5. No se requiere cambiar código: el catálogo detecta la configuración al leer `metadata`.

## 7. Evidencia

- `GET /store/products` con `metadata` devuelve las claves y URLs reales del producto.
- Las cuatro URLs responden `200 image/webp` (incluida la transparencia).
- E2E: capa de gomitas con `src` de Medusa, `opacity 0 → 1` al hover, misma caja de la bolsa, retorno a `0` al salir, fallback por `error` y respeto a `prefers-reduced-motion`.
- Productos sin configuración no renderizan capa decorativa.

## 8. Limitaciones

- Los recursos de laboratorio viven en `apps/backend/static/` (runtime, ignorado por Git). En producción deberán servirse desde el almacenamiento/CDN definitivo.
- El script reutiliza URLs si responden; si el almacenamiento cambia de host, hay que volver a ejecutarlo o actualizar metadata.
- La validación de URLs es sintáctica; no verifica dimensiones ni alineación del lienzo.
- No se midieron LCP/CLS con usuarios reales.
