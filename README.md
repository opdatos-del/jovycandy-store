# JovyCandy 3.0 — prototipo

Monorepo local para la nueva plataforma JovyCandy: un storefront Next.js y Medusa v2 con su Admin nativo. Este repositorio es independiente de los proyectos históricos, que se usan solo como referencias de lectura.

## Estado

La infraestructura base está validada: PostgreSQL local conectado, migraciones oficiales aplicadas, Medusa Health/Admin/login comprobados y el primer módulo CMS (`jovy_content`) migrado. Consulte [`docs/03-VALIDACION-ENTORNO.md`](docs/03-VALIDACION-ENTORNO.md) y [`docs/21-ESTADO-REESCRITURA-ADMIN.md`](docs/21-ESTADO-REESCRITURA-ADMIN.md) para evidencia y pendientes.

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
