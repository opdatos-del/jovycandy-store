# Migración histórica del catálogo JovyCandy

**Estado:** migración manual reproducible. No es un subsistema permanente.
**Fuente temporal:** sitio público anterior de JovyCandy.
**Fuente de verdad actual:** Medusa v2.

## 1. Decisión de arquitectura

El sitio anterior se usó una sola vez para extraer productos, presentaciones,
familias, categorías y medios. Después de importar, **Medusa es la única fuente de
verdad**. No existe sincronización automática, cron, webhook, subscriber ni
importación al iniciar el backend.

Un producto importado es un producto normal de Medusa:

- título, descripción, imágenes, variantes, precios, inventario y categorías se
  administran desde Medusa Admin;
- puede editarse, republicarse o despublicarse sin consultar el manifiesto;
- un producto nuevo creado directamente en Medusa funciona igual que uno
  migrado;
- ningún campo de procedencia altera la visibilidad, el precio o el stock.

## 2. Manifiesto y herramientas

```text
apps/backend/src/scripts/migrations/jovycandy-legacy/
  manifest.json
  import-products.ts
  extract-manifest.ts
  verify-media.ts
```

- `manifest.json` es el snapshot histórico versionado.
- `extract-manifest.ts` regenera el snapshot desde el sitio anterior. Es una
  herramienta manual, no un proceso de ejecución.
- `verify-media.ts` comprueba disponibilidad y SHA-256 de los medios remotos.
- `import-products.ts` transforma el manifiesto y crea productos con workflows
  nativos de Medusa.

## 3. Importación manual

```powershell
# Validación sin escrituras
pnpm --dir apps/backend run import:legacy:preview

# Importación autorizada explícitamente
pnpm --dir apps/backend run import:legacy:apply
```

Comportamiento:

- **Preview:** valida el manifiesto, cuenta productos/variantes ausentes y no
  escribe productos, precios ni inventario.
- **Apply:** crea únicamente los productos que no existen.
- La identidad estable es `external_id = jovy-mx:<familia>:<producto>` y el SKU
  de cada presentación es `JOVY-MX-<source_id>`.
- Una segunda ejecución no duplica productos ni variantes.
- Un producto existente **no se actualiza**: conserva título, descripción,
  imágenes, variantes, precios, inventario y vínculos administrados en Medusa.
- Un producto nuevo creado desde Admin no forma parte del manifiesto y no se
  toca al reimportar.
- La importación toma un lock global y no se ejecuta automáticamente.

El importador crea categorías y familias propias de JovyCandy cuando faltan,
asocia el producto al canal/perfil de envío y crea la ficha editorial inicial.
No elimina productos históricos.

## 4. Datos de laboratorio

Los precios sintéticos y las 50 unidades iniciales por variante son datos de
laboratorio para desarrollar la tienda. No son reglas permanentes:

- el importador no repone inventario ya consumido;
- una reimportación no recalcula precios existentes;
- no se alteran reservas;
- los precios e inventarios definitivos se configurarán desde Medusa.

## 5. Medios, pesos y Rings

- Las imágenes se registran en el File Module de Medusa; el storefront no
  depende de rutas públicas del sitio anterior.
- Cada variante recibe su propio `weight` en gramos. Medusa no hereda atributos
  físicos del producto a las variantes.
- Los efectos de tarjeta (`zoom`, `swap`, `layered`, `none`) siguen usando la
  metadata visual existente.
- El paquete de Rings vive en `apps/backend/src/data/card-visuals/rings/` con
  SHA-256 y procedencia. `seed:card-hover` lo sube a Medusa y respeta
  configuraciones manuales; no requiere el producto histórico ni Downloads.

## 6. Storefront

El storefront consume los productos publicados del canal de Medusa. No existe:

- prioridad de 35 productos;
- filtro por `jovy-mx-`;
- marcador `official_catalog_complete`;
- respaldo oculto que sustituya productos reales por un conjunto histórico.

La paginación, búsqueda, filtros, fichas, precios, carrito y checkout siguen
funcionando con cualquier cantidad de productos. Un producto número 36 o un
catálogo de 100 productos aparece normalmente.

## 7. Metadata histórica

Los productos ya migrados pueden conservar en la base campos técnicos como
`jovy_official_catalog_*` o `jovy_official_*`. Se consideran **datos históricos**:
el código actual no los consulta para decidir visibilidad, orden, precios,
inventario ni sincronización. La única lectura temporal de compatibilidad es
`jovy_official_specs` para seguir mostrando especificaciones de fichas ya
importadas; no condiciona la pertenencia al catálogo ni el comercio.

Las nuevas importaciones usan `jovy_legacy_*` para procedencia y auditoría. Esa
referencia tampoco condiciona el comportamiento comercial.

## 8. Pruebas

- **Unitarias:** schema y transformación del manifiesto, totales 35/61,
  identidades, precios sintéticos, metadata de procedencia, medios y pesos.
- **Importación HTTP con PostgreSQL efímero:**
  `integration-tests/http/legacy-import.spec.ts`. Preview sin escrituras, primera
  carga, segunda ejecución sin duplicados, conservación de ediciones y producto
  nuevo independiente.
- **Manifiesto completo:**
  `integration-tests/http/legacy-import-full-manifest.spec.ts`. 35 productos,
  61 variantes, precios MXN, inventario de 50, pesos y producto 36.
- **Storefront:** catálogo, búsqueda, filtros, ficha, carrito, checkout,
  responsive y efectos visuales.
- **Medios remotos:** `legacy:verify-media`, separado de la importación
  determinista.

### Evidencia histórica

La migración inicial se validó con PostgreSQL efímero y sin tocar `5432` ni
`55432`:

```text
importación reducida: 15c3aab9-46a6-4fed-b96d-ec15b0cc4196 (puerto 55198)
manifiesto completo:  3ca985a4-884d-4999-9d28-09d26a667de0 (puerto 55541)
módulo catálogo:      0d3143f8-db18-4d1a-bc3a-51020be36db2 (puerto 56085)
```

Las ejecuciones anteriores sobre el mismo manifiesto conservaron evidencia de
35 productos, 61 variantes y 173 referencias de medios (144 recursos únicos).

## 9. Límites

- No hay sincronización con el sitio anterior.
- No hay ETL universal ni reconciliación automática.
- No se ejecutan pagos, fulfillment ni devoluciones reales.
- Redis, S3, staging y producción siguen fuera de esta etapa.
