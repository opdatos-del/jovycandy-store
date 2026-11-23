# Validación end-to-end

**Estado:** EJECUTADA EN LABORATORIO.

## Comandos

```powershell
pnpm --dir apps/storefront test:e2e
pnpm --dir apps/backend typecheck
pnpm --dir apps/backend exec cross-env TEST_TYPE=unit NODE_OPTIONS=--experimental-vm-modules jest src/lib/jovy/__tests__/commercial-mode.test.ts --silent --runInBand --forceExit
pnpm --filter storefront build
```

## Resultados

| Suite | Resultado |
|---|---|
| Storefront E2E | 10/10 |
| Modalidad comercial unitaria | 23/23 |
| Seed de catálogo | 3/3 |
| Backend typecheck | PASS |
| Storefront typecheck | PASS |
| Storefront build | PASS |
| Lint backend | 0 errores |
| Lint storefront | 0 errores; warnings históricos/`img` |
| Validación visual | sin overflow horizontal en 375/768/1280/1440/1920 |

## Escenarios E2E cubiertos

1. Catálogo, búsqueda, limpieza, 6 columnas y sidebar sticky.
2. Versión EN.
3. Ficha con identidad, precio y vuelta al catálogo.
4. Compra invitado completa: producto → presentación 250 g → carrito → dirección → envío de laboratorio → pago manual → pedido → confirmación.
5. Galería con cuatro imágenes, cambio de vista, ampliación y tres presentaciones en gramos.
6. Carrito persistente: recarga, cambio de cantidad y eliminación contra Medusa.
7. `CATALOG_ONLY` sin compra y con contacto.
8. Cuenta B2C: registro, perfil y logout.
9. Compra móvil: drawer, checkout y sin overflow.
10. 404 de producto con estado 404.

## Evidencia Medusa

Se verificaron órdenes reales con:

- estado `pending`;
- moneda `mxn`;
- total calculado (producto + envío de laboratorio);
- `customer_id` cuando el comprador estaba autenticado;
- pedidos visibles en Admin.

## Pendiente

- Ejecutar la suite completa de integración backend y CI remoto.
- Añadir E2E de doble clic, pago fallido y stock insuficiente.
- Pruebas de aislamiento entre dos clientes con pedidos reales.
- Auditoría con lector de pantalla, zoom 200 % y Core Web Vitals.
