# Catálogo oficial de México

**Estado:** IMPLEMENTADO Y VALIDADO EN PostgreSQL efímero local.
**Corte:** 2026-11-26.
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

El seed crea título, descripción, imágenes, categoría, peso, estado, variantes
y especificaciones en la primera carga. En ejecuciones posteriores conserva
esas ediciones administrativas, incluso si cambia `source_updated_at`; actualiza
solo metadata técnica no conflictiva, medios registrados, enlaces ausentes y
precios MXN faltantes. Los precios MXN existentes, stock, reservas y metadata
manual se preservan. Categorías, familias y perfiles de envío ya vinculados no
se sobrescriben: el seed solo crea o completa lo que falta.

El marcador de catálogo completo incluye la huella SHA-256 del manifiesto y una
huella de integridad de las invariantes gestionadas (35 productos oficiales,
61 variantes con inventario, precio MXN y configuración oficial). Antes de la
primera escritura funcional de un manifiesto distinto, el seed invalida el
marcador anterior. Si una reconciliación posterior falla, ningún producto
conserva un marcador del manifiesto previo.

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

Una referencia registrada bajo `/static/` solo se reutiliza si el archivo existe
dentro de `apps/backend/static`; una ruta ausente, una URL remota caída o una
ruta con traversal dejan de considerarse válidas. El preview distingue medios
locales válidos, archivos locales faltantes y recursos que usarán la URL oficial
de respaldo. `OFFICIAL_SEED_MEDIA_MODE=manifest` permite cargar las 35 fichas de
forma determinista sin descargar medios; la disponibilidad remota y sus hashes se
comprueban aparte con:

```powershell
pnpm --dir apps/backend catalog:verify-media
```

Para conservar el efecto `layered` de Rings Manzana, el seed hereda las claves
`card_hover_*` del producto histórico `jovy-aros-manzana-verde` en
`jovy-mx-rings-rings-manzana`. No propaga la capa a otros sabores ni reemplaza un
ajuste manual posterior. En una base nueva sin ese producto histórico, la capa
no existe y el resolver visual degrada a `zoom`; antes de una demostación se
debe ejecutar el seed histórico y `seed:card-hover`.

## 7. Revisión administrativa

La pantalla **Categorías** del Admin incluye una revisión de fuente oficial. El
endpoint `GET /admin/jovy/catalogue/official-preview` compara el manifiesto con
los productos Medusa y expone diferencias de título, descripción, peso, variantes
y precio MXN, además de diagnósticos de estado, categoría, familia,
especificaciones y fecha de fuente. El endpoint `POST` aplica únicamente los campos comerciales
seleccionados (`title`, `description`, `weight`) mediante el workflow nativo de
productos; nunca cambia inventario, precios, variantes, medios ni metadata. Los
campos no seleccionados conservan su edición administrativa y los productos
faltantes solo se listan: su creación sigue reservada al seed controlado.

La escritura requiere `jovy_catalogue:update`; la consulta requiere
`jovy_catalogue:read`. La forma usa etiquetas visibles, agrupación semántica y
mensajes de estado accesibles.

## 8. Storefront

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

## 9. Pruebas

- Unitarias del manifiesto, agrupación, precios, identidades, metadata, huellas
  de integridad, resolución segura de medios y diferencias de preview.
- Integración HTTP con fixture reducido:
  `integration-tests/http/official-catalog-seed.spec.ts`. Valida primera carga,
  segunda ejecución, 50 unidades, reservas, identidades, duplicados,
  presentaciones, precio MXN, enlaces ausentes, conservación de ediciones
  administrativas e invalidación del marcador tras cambiar el manifiesto y
  fallar una reconciliación posterior.
- Integración HTTP determinista con el manifiesto completo:
  `integration-tests/http/official-catalog-full-manifest.spec.ts`. Carga 35
  productos y 61 variantes sin descargas remotas y comprueba persistencia,
  categoría/canal/perfil, precios MXN, inventario de 50, huellas del marcador e
  idempotencia.
- La suite completa no depende de conectividad. `catalog:verify-media` es la
  comprobación separada de 173 referencias verificadas (144 recursos únicos por
  SHA-256) contra su URL remota y hash.
- Escenarios cubiertos: apertura 50, idempotencia, dos seeds concurrentes,
  precio/edit manual, familia editada, reserva y reposición, presentación nueva,
  renombre oficial, reparación de enlaces de inventario/canal/perfil y MXN sobre
  un price set existente.
- E2E de catálogo/ficha: 35 productos, paginación, filtros, skip link, Rings,
  descripción, relacionados, límite de stock, compra y ES/EN.
- Las pruebas existentes de reservas, cancelación, `CATALOG_ONLY` y checkout se
  mantienen en sus suites originales.

### Evidencia 2026-11-26

`official-catalog-seed.spec.ts` pasó sobre el clúster efímero de la ejecución
`4a68d466-19cc-4e21-bff3-ddc9b5550db7` (puerto `62512`): 3 pruebas, salida `0`,
sin bases residuales y con el directorio de ejecución eliminado.

`official-catalog-full-manifest.spec.ts` pasó en la ejecución
`4930d385-8acc-4a34-b94f-e0dcc2a66db6` (puerto `62785`): 1 prueba, 35 productos,
61 variantes, precios MXN, inventario de 50 y segunda ejecución sin duplicados.
La suite de módulos `catalogue.integration.test.ts` pasó en la ejecución
`03eafef1-f237-4164-a0eb-193ad86992a9` (puerto `59918`): 6 pruebas.

La suite reducida confirma que una segunda ejecución conserva título y perfil de
envío editados en Admin, repara enlaces ausentes, no duplica identidades/precios
e invalida el marcador previo cuando cambia el manifiesto y una reconciliación
posterior deja escrituras parciales. `catalog:verify-media` verificó
`144` recursos únicos con conectividad. No se accedió a PostgreSQL `5432` ni
`55432`.

## 10. Límites

- Precios, pago, envío y stock son de laboratorio.
- No hay certificaciones, SKU, EAN ni precios publicados por la fuente oficial.
- No se ejecutan pagos, fulfillment, devoluciones ni reembolsos reales.
- Redis, S3, staging y producción siguen sin infraestructura autorizada.
