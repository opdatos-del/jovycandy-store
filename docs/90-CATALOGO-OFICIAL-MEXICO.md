# Catálogo oficial de México

**Estado:** IMPLEMENTADO Y VALIDADO EN LABORATORIO LOCAL.
**Corte:** 2026-11-25.
**Alcance:** snapshot verificable del sitio público mexicano, catálogo Medusa,
precios sintéticos de laboratorio, inventario inicial y experiencia de compra.
No representa una lista comercial autorizada ni inventario productivo.

## 1. Fuente y snapshot

El extractor usa los endpoints públicos que consume la SPA oficial:

- `https://admin.jovycandy.com.mx/api/products/published`
- `https://admin.jovycandy.com.mx/api/products/categories`
- `https://admin.jovycandy.com.mx/api/logos?active=true`

El sitio oficial no publica URLs dedicadas por producto. El manifiesto conserva
la homepage como referencia y explica que la selección ocurre dentro de la SPA.

Snapshot versionado: `apps/backend/src/data/catalog/official-mx.json`.

| Dato | Total |
|---|---:|
| Presentaciones publicadas | 61 |
| Productos Medusa agrupados | 35 |
| Variantes | 61 |
| Familias | 24 |
| Categorías con productos | 4 |
| Categorías próximas | 2 |
| Medios verificados | 173 |
| Medios no disponibles | 0 |

Las presentaciones se agrupan solo cuando coinciden `family_id` y nombre
normalizado. Sabores distintos siguen siendo productos distintos.

## 2. Identidades y reconciliación

- Producto nuevo: `external_id = jovy-mx:<family_id>:<nombre-normalizado>`.
- Variante: `sku = JOVY-MX-<source_id>`.
- Handle inicial: `jovy-mx-<family_id>-<nombre-normalizado>`.

El seed resuelve primero por `external_id` y después por SKU. Si cambia el
nombre oficial, reutiliza el producto y el handle existentes; no crea un
producto huérfano ni cambia una URL persistida. Un conflicto entre dos productos
para los mismos SKU falla de forma explícita.

Campos propiedad de la fuente: título, descripción, imágenes, categoría, peso,
estado, variantes y especificaciones. Se sincronizan cuando cambia
`source_updated_at`. Los precios MXN existentes, el stock, las reservas y la
metadata manual se preservan. Categorías y familias existentes no se
sobrescriben: el seed solo crea las que faltan.

## 3. Ejecución

```powershell
# Regenerar el snapshot desde las fuentes públicas
pnpm --dir apps/backend catalog:extract

# Preview sin escrituras
$env:OFFICIAL_SEED_MODE="preview"
pnpm --dir apps/backend seed:official

# Aplicación explícita y serializada
$env:OFFICIAL_SEED_MODE="apply"
pnpm --dir apps/backend seed:official

# Reposición manual de laboratorio
$env:CONFIRM_RESTORE_LAB_STOCK="restore-lab-stock"
pnpm --dir apps/backend inventory:restore
```

`seed:official` exige una región México/MXN con `pp_system_default`. Si hay
varios canales o perfiles de envío, se puede fijar la selección con
`JOVY_SALES_CHANNEL_ID` y `JOVY_SHIPPING_PROFILE_ID`; por defecto usa el canal
predeterminado de la tienda y el perfil de envío predeterminado.

La aplicación toma un lock global con el Locking Module. En local usa
`locking-postgres`; con Redis usa el provider configurado. Dos ejecuciones
simultáneas esperan y no duplican catálogo.

## 4. Precios

Los precios son **sintéticos**, no comerciales:

- tarifa MXN por 100 g según categoría/familia;
- descuento moderado por volumen;
- redondeo a $5 y mínimo de $15.

El storefront siempre muestra el precio persistido por Medusa. El seed crea
MXN únicamente si falta. Si una variante ya tiene otro precio set, añade MXN sin
duplicar el vínculo ni borrar la moneda existente. Una ejecución posterior no
reemplaza un precio editado manualmente.

## 5. Inventario

- Ubicación: `Jovy México Laboratorio`.
- Identidad estable: `metadata.jovy_lab_stock_location = true`.
- Apertura: 50 unidades por variante oficial, una sola vez.
- `manage_inventory = true`, `allow_backorder = false`.
- Inventario, reservas y carrito: módulos nativos de Medusa.
- La ubicación se enlaza al canal de venta, a `manual_manual` y a un fulfillment
  set con zona México.

El seed no repone niveles existentes. `inventory:restore` es una operación
manual protegida que deja 50 unidades disponibles por variante; bloquea la
ubicación y cada `inventory_item_id` con el mismo Locking Module que usan las
reservas. Una reserva activa se conserva y la reposición se calcula dentro de la
sección crítica.

## 6. Medios y Rings

Los medios se deduplican por SHA-256. El seed descarga, vuelve a calcular el
hash y solo entonces sube al File Module. Un fallo de subida usa la URL oficial
verificada y se reintenta en la siguiente ejecución; no lo marca como local.

Para conservar el efecto `layered` de Rings Manzana, el seed hereda las claves
`card_hover_*` del producto histórico `jovy-aros-manzana-verde` en
`jovy-mx-rings-rings-manzana`. No propaga la capa a otros sabores ni reemplaza un
ajuste manual posterior. En una base nueva sin ese producto histórico, la capa
no existe y el resolver visual degrada a `zoom`; antes de una demostación se
debe ejecutar el seed histórico y `seed:card-hover`.

## 7. Storefront

- Prioriza los 35 productos oficiales cuando existe el marcador de catálogo
  completo (`jovy_official_catalog_complete` y tamaño 35); un seed parcial no
  oculta los históricos. Las fichas directas históricas siguen funcionando.
- `/store/jovy/products` añade `official_catalog_complete` y
  `official_catalog_size` a la referencia comercial; son campos aditivos y no
  exponen precios ni inventario.
- Paginación de 12 productos con conteo total y anuncio accesible.
- Búsqueda incluye nombres de categoría; filtros de gramaje usan todas las
  variantes del producto.
- Precio mínimo con “Desde” cuando hay varias presentaciones con precio.
- Ficha muestra descripción, especificaciones, rango de presentaciones y
  relacionados con precio/visual.
- Cantidad limitada por stock disponible; variantes sin precio o sin stock se
  muestran deshabilitadas.
- Backorder e inventario no gestionado tienen copy específico.
- Enlace de salto, carga accesible, error de CMS recuperable y foco visible.

## 8. Pruebas

- Unitarias del manifiesto, agrupación, precios, identidades y metadata.
- Integración HTTP contra PostgreSQL descartable:
  `integration-tests/http/official-catalog-seed.spec.ts`.
- Escenarios cubiertos: apertura 50, idempotencia, dos seeds concurrentes,
  precio/edit manual, familia editada, reserva y reposición, presentación nueva,
  renombre oficial, reparación de enlaces de inventario/canal/perfil y MXN sobre
  un price set existente.
- E2E de catálogo/ficha: 35 productos, paginación, filtros, skip link, Rings,
  descripción, relacionados, límite de stock, compra y ES/EN.
- Las pruebas existentes de reservas, cancelación, `CATALOG_ONLY` y checkout se
  mantienen en sus suites originales.

## 9. Límites

- Precios, pago, envío y stock son de laboratorio.
- No hay certificaciones, SKU, EAN ni precios publicados por la fuente oficial.
- No se ejecutan pagos, fulfillment, devoluciones ni reembolsos reales.
- Redis, S3, staging y producción siguen sin infraestructura autorizada.
