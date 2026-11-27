# Cierre de campañas comerciales y validación E2E

**Corte:** 2026-11-26
**Rama:** `feat/campaign-2-stabilization`
**Estado:** IMPLEMENTADO Y VALIDADO EN LABORATORIO.
**Alcance:** PostgreSQL efímero, backend y storefront temporales. Sin cobros,
envíos ni campañas productivas.

## 1. Protección de `seed:campaign`

El seed dejó de ser un script que confía en `NODE_ENV`. Antes de cualquier
escritura valida:

1. Que `DATABASE_URL` exista, sea válida y apunte a loopback.
2. Que el entorno no sea `production` ni `staging`.
3. Que el puerto no sea `5432` ni `55432`; se prohíben siempre.
4. Que la base sea:
   - un PostgreSQL efímero con marcador `run.json` verificable, o
   - una base local declarada en una allowlist fuera del repositorio.
5. Que la identidad real del servidor coincida con la esperada: base, usuario,
   puerto, `data_directory`, `cluster_name` y conexión por loopback.
6. Fechas: formato válido, fin posterior al inicio, fin futuro y vigencia
   máxima de 366 días.
7. Porcentajes: descuento de Price List, cupón y automática entre 1 y 90.
8. Límites: variantes entre 1 y 50; importe fijo entre 1 y 1,000,000.
9. Códigos: formato seguro, únicos entre sí.
10. SKU solicitados: todos deben existir con precio MXN; si falta uno, aborta.
11. Variantes: selección determinista por SKU y luego por id.
12. Promoción automática: regla `items.product.id in [productos seleccionados]`.

Toda la validación y la selección ocurren antes de crear campaña, Price List o
promociones. Las pruebas negativas confirman que una configuración inválida deja
la base sin campañas ni Price Lists.

### Identidad real del servidor

Antes de escribir, el seed abre una conexión y consulta:

```sql
SELECT current_database(), current_user, inet_server_port(),
       inet_server_addr(), current_setting('data_directory'),
       current_setting('cluster_name'), current_setting('listen_addresses'),
       version()
```

La respuesta se compara con `DATABASE_URL`, el marcador efímero o la allowlist.
La huella de `DATABASE_URL` ya no es suficiente por sí sola.

### Autorización manual de una base local

La allowlist vive fuera del repositorio, por defecto en
`%LOCALAPPDATA%\JovyCandy\lab-databases.json`:

```json
{
  "version": 1,
  "databases": [
    {
      "fingerprint": "<huella>",
      "host": "127.0.0.1",
      "port": 5533,
      "database": "jovy_lab",
      "user": "jovy",
      "data_directory": "C:/ruta/al/cluster/data",
      "cluster_name": "jovy_manual_lab"
    }
  ]
}
```

```powershell
$env:JOVY_LAB_DATABASE_CONFIRM="authorized"
pnpm --dir apps/backend seed:campaign
```

La allowlist no puede estar dentro del repositorio y no habilita los puertos
`5432` ni `55432`. El servidor debe coincidir con `data_directory`,
`cluster_name`, base, usuario y puerto.

## 2. Campaña real en laboratorio aislado

El E2E crea la campaña por **API Admin**, no por el seed:

- Price List `sale` con activación y expiración controladas.
- Cupón porcentual.
- Cupón de importe fijo.
- Promoción automática limitada a la variante de laboratorio.
- Promoción de envío gratis.
- Campaña vencida y cupón no elegible para casos negativos.
- Colección nativa creada desde Admin.

`seed:campaign` sigue disponible como herramienta manual de preparación, pero
no es requisito para administrar ofertas futuras.

## 3. E2E aislado con promoción válida

Comando:

```powershell
pnpm --dir apps/storefront test:e2e:campaign
```

El runner:

1. Crea un PostgreSQL efímero con el launcher validado.
2. Crea una base nueva y ejecuta migraciones.
3. Siembra infraestructura comercial, catálogo Jovy, administrador y
   publishable key.
4. Inicia backend y storefront en puertos aleatorios.
5. Ejecuta Playwright contra el storefront temporal.
6. Detiene procesos, PostgreSQL y elimina el directorio efímero.

No usa `5432`, `55432` ni la base de desarrollo. Usa un `distDir` exclusivo por
ejecución y restaura `tsconfig.json` al terminar. La restauración elimina solo
las entradas del `distDir` de campaña, conserva cambios de otros procesos y
tiene pruebas unitarias propias (`pnpm --dir apps/storefront test:scripts`).

El resultado de Playwright y el de limpieza se registran por separado. La
ejecución solo se considera correcta si ambos pasan. Se verifica el cierre de
backend, storefront y PostgreSQL; si `stopCluster` falla, el resultado global es
fallido y el directorio se conserva para inspección. Un lock fuera del
repositorio evita ejecuciones concurrentes que compartan `tsconfig.json` o el
`distDir`.

### Casos cubiertos

| Caso | Resultado |
|---|---|
| Precio normal antes de activar la Price List | PASS |
| Activación de Price List y precio anterior visible | PASS |
| Cupón porcentual aplicado y retirado | PASS |
| Cupón de importe fijo con total exacto | PASS |
| Promoción automática solo sobre producto de laboratorio | PASS |
| Cupón vencido rechazado sin alterar totales | PASS |
| Cupón no elegible rechazado sin alterar totales | PASS |
| Envío gratis con opción de envío válida | PASS |
| Pedido de laboratorio con cupón | PASS |
| Colección nativa creada desde Admin | PASS |
| Precio base al expirar la Price List | PASS |

Evidencia:

```text
run id: b55cb690-86e2-4d58-81bc-d57816712312
suite:  e2e-campaign
10/10 PASS
playwright: passed
cleanup:    passed
overall:    passed
rootRemoved: true
```

## 4. Categorías, colecciones y paginación

- Las categorías y colecciones se leen de Medusa.
- Las tarjetas Jovy siguen siendo presentación editorial.
- No hay filtro por procedencia del producto.
- `listCommerceCategories` y `listCommerceCollections` recorren todas las
  páginas; ya no dependen de un límite fijo de 100.

## 5. Corrección de dirección de carrito

En Medusa 2.22.6 la primera actualización de dirección de un carrito recién
creado puede persistir solo `country_code`. El BFF relee el carrito y, si la
dirección quedó incompleta, repite la escritura completa. Esto es necesario para
que las opciones de envío se calculen con una dirección válida.

La zona geográfica del fulfillment set de laboratorio usa ISO-2 en minúsculas
(`mx`) para coincidir con la dirección del carrito.

## 6. Validación de cierre

| Prueba | Resultado |
|---|---|
| Unitarias backend | 53 suites / 473 pruebas |
| `commerce-operations.spec.ts` | 20/20 PASS (run `7c1e6785-4b6f-42e6-a99e-029375b2b197`) |
| `product-editorial.spec.ts` | 11/11 PASS |
| Importación histórica | 2/2 PASS |
| Manifiesto completo | 1/1 PASS |
| Pruebas de scripts E2E | 7/7 PASS |
| Storefront E2E | 31/31 PASS |
| Campaña E2E aislada | 10/10 PASS |
| Typecheck backend/storefront | PASS |
| Lint | 0 errores |
| Build backend/storefront | PASS |
| `git diff --check` | PASS |

**CI:** el workflow se revisó y admite `workflow_dispatch` además de PR/push a
`main`. Incluye build, typecheck, lint, unitarias, pruebas de scripts e
integraciones HTTP/módulos. El E2E de campañas requiere PostgreSQL efímero local
en Windows y no se ejecuta en GitHub Actions. En CI, los tres casos de
`seed:campaign` se omiten porque el servicio PostgreSQL usa `5432`; su guarda se
cubre con unitarias y el flujo real con el E2E aislado local.

**Repositorio:** HEAD local y `origin/feat/campaign-2-stabilization` estaban
sincronizados en `3ed93a0` al iniciar este cierre. Los cambios de este
incremento están sin commit. No se abrió Pull Request.

## 7. Resumen para Pull Request

**Rama:** `feat/campaign-2-stabilization`
**Base de comparación:** `main`
**Commits de referencia:** `63c6ca9`, `99cc2cc`, `3ed93a0` y el cierre actual
sin commit.

### Alcance

- Retiro del subsistema de catálogo oficial y Medusa como fuente comercial.
- Catálogo con categorías y colecciones nativas, sin filtro de procedencia.
- Price Lists, cupones, automáticas y envío gratis con totales de Medusa.
- Carrito y checkout con cupón, descuento y confirmación.
- Corrección de dirección de carrito y cálculo de envío en Medusa 2.22.6.
- `seed:campaign` con identidad real del servidor, puertos protegidos y allowlist.
- E2E aislado de campañas con PostgreSQL efímero y Admin API.
- Paginación completa de categorías y colecciones.
- Documentación de cierre y plan de preproducción.

### Fuera de alcance

- Pagos reales, captura, reembolsos y conciliación.
- Transportistas, guías, tracking y devoluciones reales.
- Inventario productivo, ERP/WMS y sincronización.
- CFDI, PAC, IVA comercial y cancelaciones fiscales.
- Correo transaccional, staging desplegado y aprobaciones operativas.

### Riesgos y notas para revisión

- El E2E de campañas requiere Windows y PostgreSQL 18 local; no corre en GitHub
  Actions.
- Resultado de Playwright y limpieza se evalúan por separado. Un fallo al
  detener PostgreSQL, backend o storefront deja la ejecución fallida y conserva
  el directorio; hay una prueba simulada de `stopCluster()` fallando.
- El E2E usa un lock local y un `distDir` exclusivo por ejecución para evitar
  conflictos con `tsconfig.json`.
- En CI se omiten los tres casos de `seed:campaign` porque el servicio
  PostgreSQL usa `5432`; las guardas se cubren con unitarias y el flujo real con
  el E2E aislado.
- La allowlist manual debe vivir fuera del repositorio y no habilita `5432` ni
  `55432`.
- La primera escritura de dirección de carrito en Medusa 2.22.6 requirió una
  relectura y reintento; revisar el comentario en `store.ts`.
- Las opciones de envío dependen de inventario/ubicación y de la zona `mx`.
- No hay migraciones nuevas de base en este cierre.

### Evidencia

473 unitarias, 20/20 comercio, 11/11 editorial, 2/2 y 1/1 importación, 31/31
storefront, 10/10 campaña aislada, 7/7 scripts, 12/12 launcher, typecheck, lint
sin errores y build backend/storefront.

### Cómo revisar

1. Leer `docs/94-CIERRE-CAMPANAS-COMERCIALES.md`.
2. Verificar `apps/backend/src/lib/jovy/lab-campaign.ts` y su suite.
3. Ejecutar `pnpm --dir apps/storefront test:scripts`.
4. Ejecutar `pnpm --dir apps/storefront test:e2e:campaign` en Windows.
5. Revisar `docs/95-PLAN-PREPRODUCCION-ECOMMERCE.md`.

### Rollback

Revertir la rama o el PR. No hay migraciones nuevas ni cambios destructivos de
catálogo, precios, stock o pedidos en este cierre.

**Siguiente paso:** revisar `docs/95-PLAN-PREPRODUCCION-ECOMMERCE.md` y
`docs/96-PAGOS-SANDBOX-REQUISITOS-Y-CONTRATO.md`, aprobar las decisiones de
negocio y elegir un proveedor antes de instalar cualquier SDK.
