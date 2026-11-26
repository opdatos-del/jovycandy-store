# Capacidades comerciales nativas de Medusa

**Corte:** 2026-11-26
**Rama:** `feat/campaign-2-stabilization`
**Versión:** Medusa `2.22.6`

## Decisión de arquitectura

Medusa es la única fuente de verdad comercial. El storefront consume Product,
Pricing, Promotion, Inventory, Cart, Order, Payment, Fulfillment y Tax desde la
Store API. No se crean módulos paralelos para categorías, colecciones,
promociones, precios, inventario ni pedidos.

Los módulos Jovy se conservan solo para lo que Medusa no cubre:

| Módulo | Función | Relación con Medusa |
|---|---|---|
| `jovy-content` | Hero, banners, galería, anuncios | Contenido editorial, sin datos comerciales |
| `jovy-marketing` | Banners promocionales y contenido | No calcula descuentos ni precios |
| `jovy-events` | Eventos y lanzamientos | Sin inventario ni pedidos |
| `jovy-brand` | Logos, identidad y assets | Sin catálogo comercial |
| `jovy-contacts` | Formularios y contacto | Sin clientes ni pedidos |
| `jovy-catalogue` | Tarjetas de presentación del catálogo | `medusa_category_id` enlaza a la categoría nativa |
| `jovy-product-editorial` | Gramaje, certificaciones, orden, novedad, modalidad | Solo presentación; no decide la pertenencia al catálogo |
| `jovy-launches` | Lanzamientos editoriales | Sin stock ni precios |
| `jovy-authz` | Autorización del Admin | No duplica RBAC de Medusa |

Reglas aplicadas:

- Una tarjeta de catálogo Jovy no es una categoría comercial: es presentación y
  puede apuntar a una Product Category nativa.
- Una familia Jovy es una agrupación editorial; no sustituye categorías ni
  colecciones.
- Un producto puede tener varias categorías nativas y una colección nativa.
- Un producto publicado en Medusa aparece en el storefront aunque no tenga ficha
  editorial. La ficha editorial solo enriquece la presentación.
- No se reintroducen filtros por procedencia histórica ni marcadores de
  «catálogo oficial».

## Matriz de capacidades

Leyenda: **Sí** = disponible y conectado; **Parcial** = disponible en Medusa pero
con alcance de laboratorio; **No** = no implementado o bloqueado por decisión.

| Dominio | Capacidad | Admin nativo | Backend configurado | Storefront | Pruebas | Falta |
|---|---|---|---|---|---|---|
| Product | Productos, opciones, variantes, imágenes | Sí | Sí | Sí | Unitarias, E2E, integración | Nada funcional |
| Product | Categorías múltiples | Sí | Sí | Sí, filtro y navegación | Integración, E2E | Nada funcional |
| Product | Colección nativa | Sí | Sí | Sí, `/colecciones` y ficha | Build, E2E de catálogo | Nada funcional |
| Product | Etiquetas y tipos | Sí | Sí | No visibles | — | Decidir si se usan como filtros |
| Product | Publicación y canal de venta | Sí | Sí | Sí | Integración | Nada funcional |
| Pricing | Precio base MXN por variante | Sí | Sí | Sí | E2E | Aprobación de precios reales |
| Pricing | Price List `sale` con vigencia | Sí | Sí | Sí, precio y original | Integración | Nada funcional |
| Pricing | Price List `override` | Sí | Sí | Precio calculado sin tachado | — | Decidir segmentos |
| Promotion | Descuento porcentual | Sí | Sí | Sí, cupón | Integración | Nada funcional |
| Promotion | Descuento de importe fijo | Sí | Sí | Sí, cupón | Integración | Nada funcional |
| Promotion | Cupón manual | Sí | Sí | Sí, carrito y checkout | Integración, E2E inválido | E2E válido depende de campaña de laboratorio |
| Promotion | Promoción automática | Sí | Sí | Sí | Integración | Nada funcional |
| Promotion | Envío gratis | Sí | Sí | Sí | Integración | Depende de opción de envío válida |
| Promotion | Reglas por producto y carrito | Sí | Sí | Indirecto | Integración | Nada funcional |
| Promotion | Límite de uso | Sí | Sí | Indirecto | Integración con pedido | Nada funcional |
| Promotion | Campaña, inicio y expiración | Sí | Sí | Indirecto | Integración de campaña vencida | Nada funcional |
| Inventory | Niveles por ubicación | Sí | Sí, laboratorio | Sí, disponibilidad | Integración | Autoridad comercial pendiente |
| Inventory | Reservas concurrentes | Sí | Sí | Indirecto | Integración | Nada funcional |
| Inventory | Backorder | Sí | Sí | Sí | Integración | Política comercial pendiente |
| Cart | Líneas, totales y descuentos | No aplica | Sí | Sí | E2E, integración | Nada funcional |
| Cart | Cupones aplicados y retirados | No aplica | Sí | Sí | Integración | E2E válido opcional |
| Order | Pedido confirmado | Sí | Sí | Sí, confirmación | E2E, integración | Nada funcional |
| Order | Cancelación | Sí | Sí | No expuesta | Integración | Decidir autoservicio |
| Payment | Pago de laboratorio | Sí | `pp_system_default` | Sí | E2E, integración | Proveedor real |
| Fulfillment | Envío manual | Sí | Sí | Sí, opciones | E2E, integración | Transportista real |
| Tax | Región fiscal MX | Sí | `tp_system` | Indirecto | — | Política fiscal y CFDI |
| Customer | Cuentas B2C | Sí | Sí | Sí | E2E | Nada funcional |
| Customer | Grupos de clientes | Sí | Sí | No usado | — | Segmentación futura |
| Sales Channel | Canal y publishable key | Sí | Sí | Sí | Integración | Nada funcional |

## Flujo de compra validado

```text
Producto publicado en Medusa
  → categoría y colección nativas
  → variante y precio calculado (Price List incluida)
  → carrito con cupón o promoción automática
  → disponibilidad y reserva
  → envío manual de laboratorio
  → pago pp_system_default
  → pedido confirmado
  → cancelación desde Admin
```

La confirmación del pedido muestra subtotal, descuento, envío y total calculados
por Medusa. El storefront no recalcula descuentos ni impuestos.

## Pruebas de referencia

| Suite | Resultado |
|---|---|
| `commerce-operations.spec.ts` | 18/18 PASS en PostgreSQL efímero |
| Storefront E2E | 31/31 PASS |
| Typecheck backend/storefront | PASS |
| Build backend/storefront | PASS |

Evidencia efímera:

```text
run id: f98754e2-f8a6-4468-a7c7-cee2328d793e
puerto: 52793
suite:  integration-tests/http/commerce-operations.spec.ts
jest:   passed
salida: 0
limpieza: stopped-and-removed
```

## Límites actuales

- Pagos, fulfillment real, impuestos comerciales y correo siguen bloqueados por
  decisión de negocio. Se usa pago y envío manual de laboratorio.
- Las campañas se crean solo en bases de laboratorio. No hay promociones
  productivas publicadas.
- Las variantes históricas pueden conservar `manage_inventory = false`; activar
  inventario comercial requiere la decisión de autoridad de stock.
- El E2E del cupón válido requiere una campaña de laboratorio creada con
  `seed:campaign`; el flujo real se valida en la suite de integración.
