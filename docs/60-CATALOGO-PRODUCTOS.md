# Catálogo y compra JovyCandy

**Estado:** IMPLEMENTADO · catálogo Medusa, precios de laboratorio, carrito, checkout de laboratorio y cuentas B2C.
**Rutas:** `/{locale}/catalogo`, `/{locale}/productos/[handle]`, `/{locale}/carrito`, `/{locale}/checkout`, `/{locale}/checkout/confirmacion`, `/{locale}/cuenta`.  
**Alcance:** laboratorio local; sin cobros reales, envíos productivos ni despliegue.

## 1. Experiencia

El catálogo usa una composición de alta densidad:

- cabecera compacta con breadcrumb, título y descripción;
- catálogo a ancho completo con filtros laterales persistentes;
- sidebar sticky con scroll propio cuando excede el viewport;
- tarjetas con packshot, familia, gramaje, precio, certificaciones y CTA;
- grid de máximo 6 columnas en escritorio amplio y paginación de 12 productos;
- ficha con galería, variantes, cantidad limitada por stock, precio, disponibilidad y relacionados;
- carrito lateral, página de carrito y checkout de cuatro pasos;
- 404 de producto alineado a la misma identidad.

## 2. Rutas

| Pantalla | Ruta |
|---|---|
| Catálogo ES/EN | `/es/catalogo` · `/en/catalogo` |
| Ficha | `/es/productos/[handle]` |
| Carrito | `/es/carrito` |
| Checkout | `/es/checkout` |
| Confirmación | `/es/checkout/confirmacion` |
| Cuenta | `/es/cuenta` |
| Categoría | `/es/catalogo?categoria=chamoy` |

Carrito, checkout, confirmación y cuenta no se indexan. La confirmación usa una cookie HttpOnly firmada, no un identificador adivinable en la URL.

## 3. Ejecución

```powershell
pnpm dev
# o por separado:
pnpm --dir apps/backend dev
pnpm --dir apps/storefront dev

pnpm --filter storefront typecheck
pnpm --filter storefront lint
pnpm --filter storefront build
pnpm --dir apps/storefront test:e2e
```

Los E2E levantan backend y storefront si no están activos. Requieren
`seed:commerce` y `import:legacy` aplicados previamente sobre la base local de
laboratorio; no reinician ni borran esa base.

## 4. Implementación

```text
src/app/[locale]/catalogo/             catálogo
src/app/[locale]/productos/[handle]/   ficha y 404
src/app/[locale]/carrito/              carrito
src/app/[locale]/checkout/             checkout y confirmación
src/app/[locale]/cuenta/               cuenta B2C
src/app/api/                           BFF de carrito, checkout y cuenta
src/features/catalog/                  catálogo, tarjeta y ficha
src/features/commerce/                 provider, drawer, carrito, checkout y cuenta
src/lib/medusa/                        Store API, sesión, validación y cliente
src/lib/commerce/                      formato monetario
src/styles/catalog/catalog.css         sistema visual
e2e/catalog.spec.ts                    catálogo, compra, cuenta, móvil y 404
```

## 5. Datos comerciales

- Producto y variantes: Medusa Product Module.
- Precio: Medusa Pricing, región México/MXN.
- Disponibilidad: `manage_inventory`, `allow_backorder` e inventario.
- Modalidad: Jovy Product Editorial (`SELLABLE` / `CATALOG_ONLY`).
- Familia, gramaje, certificaciones y novedad: CMS Jovy.

El storefront combina editorial + Medusa en servidor y nunca confía en precios enviados por el cliente. Las mutaciones comerciales pasan por el BFF.

## 6. Seeds

```powershell
pnpm --dir apps/backend seed:commerce   # región MX, MXN, envío y pago de laboratorio
$env:LEGACY_IMPORT_MODE="preview"
pnpm --dir apps/backend run import:legacy   # 35 productos / 61 variantes verificadas
$env:LEGACY_IMPORT_MODE="apply"
pnpm --dir apps/backend run import:legacy
```

`seed:catalog` queda como semilla histórica de laboratorio. El catálogo público
muestra todos los productos publicados del canal de Medusa, sin distinguir si
fueron importados o creados desde Admin. Detalle y runbook:
`docs/90-MIGRACION-CATALOGO-LEGACY.md`.

## 7. Funcionalidad

- búsqueda, filtros, conteos y ordenamiento;
- precios MXN calculados por Medusa;
- presentaciones en gramos con precio por presentación y filtros multivariante;
- galería con miniaturas, ampliación y recuperación de packshots locales;
- hover configurable desde `product.metadata` de Medusa: zoom, swap, capa de gomitas o sin animación (`docs/74-PRODUCT-CARD-VISUAL-MANAGER.md`);
- selector de variante y cantidad con precio;
- barra de compra fija en móvil;
- carrito persistente con drawer y página;
- notificaciones de confirmación y error, skeletons de navegación y movimiento reducido;
- checkout con dirección MX, envío de laboratorio y pago manual;
- pedido real en Medusa y confirmación firmada;
- cuentas B2C: registro, login, logout, direcciones e historial;
- transferencia del carrito invitado al iniciar sesión;
- `CATALOG_ONLY` bloqueado en UI y en hooks de servidor;
- ES/EN, responsive, estados vacío/error/carga y 404.

## 8. Límites

- El pago es `pp_system_default`; no hay cobro real.
- El envío es manual y de laboratorio; no hay paquetería.
- No hay recuperación de contraseña con correo real.
- El historial solo incluye pedidos asociados al cliente autenticado.
- Los precios, imágenes remotas y certificaciones del seed requieren revisión antes de producción.
- Los filtros se resuelven en cliente y se paginan localmente; un catálogo grande requerirá búsqueda/paginación en servidor.
- No hubo prueba con usuarios ni medición de Core Web Vitals.

## 9. Documentos relacionados

- Sistema visual: `docs/62-DESIGN-SYSTEM-CATALOGO.md`.
- Arquitectura comercial: `docs/65-ARQUITECTURA-ECOMMERCE-B2C.md`.
- Carrito: `docs/67-CARRITO-MEDUSA.md`.
- Checkout: `docs/68-CHECKOUT-Y-PAGOS-DEMO.md`.
- Cuentas: `docs/69-CUENTAS-CLIENTE-B2C.md`.
- Validación: `docs/72-VALIDACION-END-TO-END.md`.
