# Revalidación CMS Medusa → Next.js

**Corte:** 2026-11-24
**Estado:** IMPLEMENTADO Y VALIDADO LOCALMENTE.
**Alcance:** invalidación de la caché editorial `jovy-content` sin esperar el TTL.

## Arquitectura

```text
Admin Medusa
   │  mutación confirmada (2xx/3xx)
   ▼
middleware /admin/* (después de jovy-authz)
   │  evento jovy-content.changed
   ▼
subscriber jovy-content.changed
   │  POST firmado HMAC
   ▼
Next.js /api/revalidate
   │  revalidateTag("jovy-content", { expire: 0 })
   ▼
Storefront actualizado en la siguiente petición
```

El observer no emite en lecturas (`GET`), respuestas fallidas ni rutas de
autorización/contactos. Solo cubre prefijos de contenido:

- `/admin/jovy/marketing/`, `catalogue/`, `content/`, `events/`, `brand/`,
  `launches/`, `products/`, `product-card-visual/`, `announcements/`;
- `/admin/products`, `/admin/product-categories`, `/admin/product-tags`,
  `/admin/uploads`, `/admin/price-lists`, `/admin/sales-channels`,
  `/admin/collections`.

## Seguridad

El endpoint del storefront no es público:

- `JOVY_REVALIDATION_SECRET` de al menos 32 caracteres, solo en servidor;
- firma HMAC SHA-256 sobre `timestamp.cuerpo`;
- ventana de reloj de 300 segundos;
- cuerpo máximo de 4 KB;
- `content-type: application/json`;
- lista blanca de etiquetas: únicamente `jovy-content`;
- comparación en tiempo constante;
- sin `NEXT_PUBLIC_` para el secreto;
- sin registro del secreto ni del cuerpo en logs.

Si el secreto no está configurado, el endpoint responde `503`. Si la firma es
inválida o el timestamp está fuera de ventana, responde `401`.

El endpoint no permite revalidar rutas ni etiquetas arbitrarias. Una repetición
dentro de la ventana solo vuelve a invalidar la misma etiqueta, que es
idempotente.

## Entrega y fallos

Variables del backend:

```dotenv
STOREFRONT_REVALIDATION_URL=https://shop.example/api/revalidate
STOREFRONT_REVALIDATION_SECRET=<secreto-compartido>
STOREFRONT_REVALIDATION_TIMEOUT_MS=3000
```

Comportamiento:

- Si faltan URL y secreto, el subscriber no hace nada. Desarrollo y CI no
  dependen de que Next.js esté levantado.
- Si la configuración es parcial o insegura, registra la variable afectada y no
  envía nada.
- Reintenta una vez a los 250 ms y otra a los 1000 ms.
- Un `4xx` no se reintenta; un `5xx`, timeout o error de red sí.
- Un fallo final se registra y **no** se propaga. La publicación editorial no se
  bloquea; el TTL de `getHomeContent` sigue siendo la recuperación.

## Next.js 16

`getHomeContent` ya usa `use cache`, `cacheLife("minutes")` y
`cacheTag("jovy-content")`. La invalidación externa usa la firma documentada:

```ts
revalidateTag("jovy-content", { expire: 0 })
```

No se usa la forma de un argumento, deprecada en Next.js 16. No se usan
`revalidatePath` ni `unstable_cache`.

## Evidencia

| Prueba | Resultado |
|---|---|
| 9 unitarias de firma, configuración, reintentos y filtros | PASS |
| Build de Next.js con la ruta `/api/revalidate` | PASS |
| POST firmado contra `next start` | `202 {"revalidated":["jovy-content"]}` |
| POST con firma inválida | `401` |
| Backend typecheck | PASS |

## Operación

Activación:

1. Generar un secreto aleatorio de al menos 32 caracteres.
2. Cargarlo como `JOVY_REVALIDATION_SECRET` en el storefront y como
   `STOREFRONT_REVALIDATION_SECRET` en Medusa.
3. Configurar `STOREFRONT_REVALIDATION_URL` con la URL HTTPS exacta del
   endpoint.
4. Publicar un cambio controlado en Admin y verificar la respuesta del
   storefront.

Rollback:

- Quitar `STOREFRONT_REVALIDATION_URL` y el secreto del backend desactiva el
  envío sin tocar la publicación.
- El storefront conserva su TTL; no se pierde contenido.
- No se requiere migración de datos.

## Limitación

Solo se invalida la etiqueta `jovy-content`. Si en el futuro se agregan cachés
por producto, categoría o página, se debe ampliar la lista blanca y el contrato
de eventos; no se debe aceptar una etiqueta enviada por el cliente sin
validación.
