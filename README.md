# JovyCandy 3.0 — prototipo

Monorepo local para la nueva plataforma JovyCandy: un storefront Next.js y Medusa v2 con su Admin nativo. Este repositorio es independiente de los proyectos históricos, que se usan solo como referencias de lectura.

## Estado

La infraestructura base está validada: PostgreSQL local conectado, migraciones
oficiales aplicadas, Medusa Health/Admin/login comprobados y el CMS Jovy
migrado. La segunda campaña agregó Search MXN, pruebas de inventario,
promociones y pedidos, revalidación CMS y readiness. El despliegue de staging con
GitHub Actions, GHCR, Redis y worker está preparado; Redis/S3 reales, staging y
producción siguen pendientes de infraestructura o decisión comercial.

Consulte [`docs/86-REPORTE-CIERRE-SEGUNDA-CAMPANA.md`](docs/86-REPORTE-CIERRE-SEGUNDA-CAMPANA.md)
para el estado verificable y [`docs/03-VALIDACION-ENTORNO.md`](docs/03-VALIDACION-ENTORNO.md)
para la base local.

## Aplicaciones

| Aplicación | Ruta | Puerto esperado |
| --- | --- | --- |
| Storefront Next.js | `apps/storefront` | `3000` |
| Medusa + Admin | `apps/backend` | `9000` |

## Inicio local

```powershell
pnpm install
pnpm dev:storefront
# En otra terminal, después de configurar PostgreSQL y apps/backend/.env:
pnpm dev:backend
```

No copie ni reutilice secretos, datos, catálogos o configuraciones de los proyectos originales. Use las plantillas `.env.example`, mantenga los secretos locales fuera de Git y no use Docker, despliegues ni servicios de producción.

## Documentación

- [`docs/00-PLAN-MAESTRO.md`](docs/00-PLAN-MAESTRO.md)
- [`docs/01-ARQUITECTURA-INICIAL.md`](docs/01-ARQUITECTURA-INICIAL.md)
- [`docs/02-CONFIGURACION-LOCAL.md`](docs/02-CONFIGURACION-LOCAL.md)
- [`docs/03-VALIDACION-ENTORNO.md`](docs/03-VALIDACION-ENTORNO.md)
- [`docs/04-DEPENDENCIAS-ACTUALIZADAS.md`](docs/04-DEPENDENCIAS-ACTUALIZADAS.md)
- [`docs/12-ESTADO-DESARROLLO.md`](docs/12-ESTADO-DESARROLLO.md)
- [`docs/13-AUDITORIA-ADMIN-ORIGINAL.md`](docs/13-AUDITORIA-ADMIN-ORIGINAL.md)
- [`docs/15-ARQUITECTURA-CMS.md`](docs/15-ARQUITECTURA-CMS.md)
- [`docs/21-ESTADO-REESCRITURA-ADMIN.md`](docs/21-ESTADO-REESCRITURA-ADMIN.md)
- [`docs/22-CONVENCIONES-CODIGO.md`](docs/22-CONVENCIONES-CODIGO.md)
- [`docs/60-CATALOGO-PRODUCTOS.md`](docs/60-CATALOGO-PRODUCTOS.md)
- [`docs/65-ARQUITECTURA-ECOMMERCE-B2C.md`](docs/65-ARQUITECTURA-ECOMMERCE-B2C.md)
- [`docs/73-REPORTE-IMPLEMENTACION-ECOMMERCE.md`](docs/73-REPORTE-IMPLEMENTACION-ECOMMERCE.md)
- [`docs/76-AUDITORIA-CONFIGURACION-MEDUSA.md`](docs/76-AUDITORIA-CONFIGURACION-MEDUSA.md)
- [`docs/77-SEARCH-MXN-Y-SINCRONIZACION.md`](docs/77-SEARCH-MXN-Y-SINCRONIZACION.md)
- [`docs/78-INVENTORY-RESERVAS-Y-CONCURRENCIA.md`](docs/78-INVENTORY-RESERVAS-Y-CONCURRENCIA.md)
- [`docs/79-PROMOCIONES-Y-OPERACION-PEDIDOS.md`](docs/79-PROMOCIONES-Y-OPERACION-PEDIDOS.md)
- [`docs/80-REVALIDACION-CMS-NEXTJS.md`](docs/80-REVALIDACION-CMS-NEXTJS.md)
- [`docs/81-REDIS-SERVER-WORKER.md`](docs/81-REDIS-SERVER-WORKER.md)
- [`docs/82-FILE-MODULE-STORAGE.md`](docs/82-FILE-MODULE-STORAGE.md)
- [`docs/83-OBSERVABILIDAD-MEDUSA.md`](docs/83-OBSERVABILIDAD-MEDUSA.md)
- [`docs/84-STAGING-Y-CI-CD.md`](docs/84-STAGING-Y-CI-CD.md)
- [`docs/85-MATRIZ-PRUEBAS-SEGUNDA-CAMPANA.md`](docs/85-MATRIZ-PRUEBAS-SEGUNDA-CAMPANA.md)
- [`docs/86-REPORTE-CIERRE-SEGUNDA-CAMPANA.md`](docs/86-REPORTE-CIERRE-SEGUNDA-CAMPANA.md)
- [`docs/89-DESPLIEGUE-STAGING-GHCR.md`](docs/89-DESPLIEGUE-STAGING-GHCR.md)
