# Campaña comercial de laboratorio (Buen Fin)

**Corte:** 2026-11-26
**Estado:** IMPLEMENTADO Y VALIDADO EN LABORATORIO.
**Alcance:** base local o descartable. No publica campañas productivas.

## Objetivo

Preparar una oferta temporal desde Medusa Admin, sin modificar código por
campaña, y consumirla en el storefront con precios y descuentos calculados por
Medusa.

El script está protegido por identidad real del servidor: solo acepta un
PostgreSQL efímero verificable o una base local declarada en una allowlist
fuera del repositorio. Rechaza producción, staging,
hosts no loopback, los puertos `5432`/`55432` y configuraciones inválidas antes
de escribir. Ver `docs/94-CIERRE-CAMPANAS-COMERCIALES.md`.

La campaña combina dos mecanismos independientes:

1. **Precios especiales:** Price List nativa de tipo `sale` con vigencia.
2. **Promociones:** cupones y descuentos automáticos nativos agrupados en una
   Campaign.

## Preparación manual

La infraestructura comercial (región, envío manual, pago de laboratorio) se crea
con:

```powershell
pnpm --dir apps/backend seed:commerce
```

La campaña de laboratorio se crea con:

```powershell
pnpm --dir apps/backend seed:campaign
```

El script es idempotente por `campaign_identifier`, título de Price List y código
de promoción. No modifica precios base, inventario ni productos existentes.

Variables opcionales:

| Variable | Valor por defecto | Uso |
|---|---|---|
| `JOVY_CAMPAIGN_IDENTIFIER` | `buen-fin-laboratorio` | Identificador estable |
| `JOVY_CAMPAIGN_NAME` | `Buen Fin Laboratorio` | Nombre visible en Admin |
| `JOVY_CAMPAIGN_START` | ahora | Inicio de vigencia |
| `JOVY_CAMPAIGN_END` | inicio + 14 días | Fin de vigencia |
| `JOVY_CAMPAIGN_SALE_PERCENT` | `20` | Descuento de la Price List |
| `JOVY_CAMPAIGN_VARIANT_LIMIT` | `5` | Variantes con precio de oferta |
| `JOVY_CAMPAIGN_SKUS` | vacío | Lista de SKU separada por comas |
| `JOVY_CAMPAIGN_CODE_PERCENT` | `BUENFIN10` | Cupón porcentual |
| `JOVY_CAMPAIGN_CODE_FIXED` | `BUENFIN50` | Cupón de importe fijo |
| `JOVY_CAMPAIGN_CODE_AUTO` | `AUTO15` | Promoción automática |
| `JOVY_CAMPAIGN_CODE_SHIPPING` | `ENVIOGRATIS` | Envío gratis |

Ejemplo con vigencia y alcance acotado:

```powershell
$env:JOVY_CAMPAIGN_START="2026-11-26T00:00:00-06:00"
$env:JOVY_CAMPAIGN_END="2026-12-01T23:59:59-06:00"
$env:JOVY_CAMPAIGN_SKUS="JOVY-MX-1,JOVY-MX-2"
pnpm --dir apps/backend seed:campaign
```

## Configuración equivalente en Medusa Admin

### A. Precios especiales

1. Abrir **Price Lists** y crear una lista tipo **Sale**.
2. Agregar precios por variante en MXN.
3. Definir fecha de inicio y fin.
4. Guardar y activar.

El storefront recibe `calculated_price.calculated_amount` y
`calculated_price.original_amount`. Muestra el precio vigente, el original
tachado y la etiqueta **Oferta** solo cuando
`calculated_price.calculated_price.price_list_type = "sale"` y el importe
original es mayor. Al expirar, Medusa devuelve el precio base sin cambios de
código.

### B. Promociones

1. Abrir **Promotions** y crear una campaña.
2. Configurar método: cupón o automática.
3. Elegir porcentaje, importe fijo o envío gratis.
4. Definir reglas por producto o carrito, límite de uso y vigencia.
5. Activar solo en la base de laboratorio.

El campo de cupón está disponible en carrito, drawer y checkout. El cliente
puede aplicar y retirar códigos; el total se vuelve a leer de Medusa. Las
promociones automáticas se muestran como descuento aplicado sin botón de retiro.

## Interacción entre Price List y promociones

Medusa calcula primero el precio vigente de la variante y después aplica las
promociones elegibles sobre ese precio. El storefront no suma descuentos por su
cuenta.

Reglas recomendadas:

- No duplicar una misma oferta con Price List y promoción porcentual sobre el
  mismo producto salvo que sea intencional.
- Validar el total final en el carrito antes de comunicar la campaña.
- Usar límites de uso en cupones compartidos.
- Mantener el envío gratis sujeto a una opción de envío válida.

## Pruebas

Suite `commerce-operations.spec.ts` (PostgreSQL efímero):

- Price List `sale` activa devuelve importe rebajado y original.
- Price List expirada devuelve el precio base.
- Cupón de importe fijo descuenta sobre el precio de oferta.
- Promoción automática aplica sin código.
- Envío gratis deja `shipping_total = 0`.
- Cupón de campaña vencida no concede descuento.
- Límite de uso 1 impide reutilizar el cupón en un segundo pedido.
- Producto creado en Admin sin ficha editorial aparece en el storefront.

Evidencia:

```text
run id: f98754e2-f8a6-4468-a7c7-cee2328d793e
puerto: 52793
18/18 PASS
limpieza: stopped-and-removed
```

La suite no toca la base de desarrollo ni ejecuta pagos reales. El E2E del
storefront (31/31) cubre catálogo, compra, carrito y el rechazo de un cupón
inválido sin alterar totales.

El flujo completo con cupón válido, envío gratis y pedido se valida en un
entorno aislado:

```powershell
pnpm --dir apps/storefront test:e2e:campaign
```

Ese runner crea un PostgreSQL efímero, migra una base nueva, configura la
campaña por API Admin y ejecuta 10/10 casos en navegador. Ver
`docs/94-CIERRE-CAMPANAS-COMERCIALES.md`.

## Operación segura

- No ejecutar `seed:campaign` contra una base con datos productivos.
- No publicar promociones ni precios sin aprobación comercial.
- Para terminar una campaña, desactivar la Price List y las promociones desde
  Admin; no borrar productos ni precios base.
- Revisar el total del carrito y del pedido antes de comunicar la oferta.
