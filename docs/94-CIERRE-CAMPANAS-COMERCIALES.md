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
3. Que la base sea:
   - un PostgreSQL efímero con marcador `run.json` verificable, o
   - una base local autorizada por huella SHA-256 y confirmación explícita.
4. Fechas: formato válido, fin posterior al inicio, fin futuro y vigencia
   máxima de 366 días.
5. Porcentajes: descuento de Price List, cupón y automática entre 1 y 90.
6. Límites: variantes entre 1 y 50; importe fijo entre 1 y 1,000,000.
7. Códigos: formato seguro, únicos entre sí.
8. SKU solicitados: todos deben existir con precio MXN; si falta uno, aborta.
9. Variantes: selección determinista por SKU y luego por id.
10. Promoción automática: regla `items.product.id in [productos seleccionados]`.

Toda la validación y la selección ocurren antes de crear campaña, Price List o
promociones. Las pruebas negativas confirman que una configuración inválida deja
la base sin campañas ni Price Lists.

### Autorización manual de una base local

```powershell
# El propio error de seed:campaign imprime la huella actual.
pnpm --dir apps/backend seed:campaign
```

Para autorizar una base local concreta:

```powershell
$env:JOVY_LAB_DATABASE_SHA256="<huella impresa>"
$env:JOVY_LAB_DATABASE_CONFIRM="authorized"
pnpm --dir apps/backend seed:campaign
```

No se debe usar esta autorización en producción ni staging. El guard rechaza
esos entornos antes de evaluar la huella.

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

No usa `5432`, `55432` ni la base de desarrollo. Usa un `distDir` temporal y
restaura `tsconfig.json` al terminar.

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
run id: 7b4d7a09-86e3-473f-a941-e22a91503d08
suite:  e2e-campaign
10/10 PASS
cleanup: stopped-and-removed
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
| Unitarias backend | 52 suites / 471 pruebas |
| `commerce-operations.spec.ts` | 20/20 PASS (run `4d8be8a8-0932-4a5d-a5da-177e30b998da`) |
| `product-editorial.spec.ts` | 11/11 PASS (run `e03e584c-543f-4c7d-aef9-c85208efbf06`) |
| Importación histórica | 2/2 PASS (run `6ff9fd9f-7716-4c1c-8980-6e56871c2135`) |
| Manifiesto completo | 1/1 PASS (run `ab83b92b-56a0-4c8c-b0f6-91499fd07d71`) |
| Storefront E2E | 31/31 PASS |
| Campaña E2E aislada | 10/10 PASS |
| Typecheck backend/storefront | PASS |
| Lint | 0 errores |
| Build backend/storefront | PASS |
| `git diff --check` | PASS |

**CI:** no se ejecutó GitHub Actions ni se abrió Pull Request. La rama queda
preparada para revisión; no se creó commit de este incremento sin autorización.

## 7. Decisiones pendientes para producción

No se amplían más las capacidades de promociones. Para pasar a operación real
faltan decisiones de negocio:

1. **Pagos:** proveedor, credenciales sandbox, webhooks, captura y reembolsos.
2. **Envíos:** transportista, tarifas, cobertura, tracking y devoluciones.
3. **Inventario:** autoridad única (Medusa, ERP o WMS), backorder y reconciliación.
4. **Impuestos:** tratamiento de IVA, CFDI, PAC y cancelaciones.
5. **Operación:** responsables de campañas, límites de gasto y aprobación antes
   de publicar promociones.
