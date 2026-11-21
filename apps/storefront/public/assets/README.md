# Guia de assets

Todos archivos nuevos deben vivir dentro de `public/assets`.

## Regla de nombres

Usar siempre:

- minusculas
- guiones medios `-`
- sin espacios
- sin acentos
- sin caracteres especiales

Ejemplos correctos:

- `frutastika-blues.webp`
- `jovy-logo.png`
- `ficha-pegbag-rings-sand-100g-12-bolsas.webp`

Ejemplos incorrectos:

- `FRUTASTIKA BLUES.webp`
- `FICHA TECNICA 100g.webp`
- `logo final.png`

## Estructura de carpetas

### Catalogo

- `catalog/products/sweet/...`
- `catalog/products/spicy/...`
- `catalog/logos/sweet/...`
- `catalog/logos/spicy/...`
- `catalog/backgrounds/category-cards/<categoria>/primary.webp`
- `catalog/backgrounds/category-cards/<categoria>/hover.webp`
- `catalog/carousels/<peso>/...`
- `catalog/technical-sheets/<peso>/...`
- `catalog/bowls/...`

### Marca

- `brand/logo/...`
- `brand/isotypes/...`
- `brand/marks/...`

### Marketing

- `marketing/hero/...`
- `marketing/events/...`
- `marketing/frames/logo/...`
- `marketing/about/...`

### Social y certificaciones

- `social/instagram/...`
- `certifications/...`

## Como agregar imagen nueva

1. Guardar imagen dentro carpeta correcta en `public/assets`.
2. Renombrarla siguiendo regla de nombres.
3. Si imagen se usa desde codigo, agrega o reutiliza ruta desde `src/shared/assets/publicAssets.ts`.
4. Usar helper o constante en lugar de escribir ruta manualmente.
5. Corre `pnpm build`.
6. Si fue una limpieza o migracion, ejecuta `pnpm run validate-catalog`.

## Regla importante

No agregar imagenes nuevas fuera de `public/assets`.
