# Configuración local

## Requisitos comprobados

| Herramienta | Versión observada | Requisito del proyecto |
| --- | --- | --- |
| Node.js | `24.16.0` | `>=22.23.4 <25` |
| pnpm | `11.17.0` | `>=11.17.0 <12` |
| Git | `2.53.0.windows.1` | Repositorio local |
| PostgreSQL | servidor 18 en `127.0.0.1:5432` | PostgreSQL local |

El binario `psql` está instalado en `C:\Program Files\PostgreSQL\18\bin\psql.exe`, pero no está en `PATH`. El puerto `5555` pertenece a otro proceso; no debe usarse para esta plataforma.

## Variables de entorno

- `apps/backend/.env.example`: plantilla Medusa. Copiar a `.env` y reemplazar todos los marcadores con secretos locales únicos.
- `apps/storefront/.env.example`: URL pública local del storefront y URL local de Medusa. La integración Store API no está activa todavía.
- Los archivos `.env` están excluidos por `.gitignore`. No use ni copie archivos de entorno de los proyectos originales.

En PowerShell, para crear una plantilla nueva sin sobrescribir un `.env` existente:

```powershell
Copy-Item apps/backend/.env.example apps/backend/.env
Copy-Item apps/storefront/.env.example apps/storefront/.env.local
```

## PostgreSQL aislado

La base requerida es `jovycandy_prototipo_medusa`. Antes de crearla, confirme su ausencia mediante una sesión autorizada con privilegios locales:

```powershell
& 'C:\Program Files\PostgreSQL\18\bin\psql.exe' -h 127.0.0.1 -p 5432 -U postgres -d postgres -tAc "SELECT datname FROM pg_database WHERE datname = 'jovycandy_prototipo_medusa';"
```

Solo si no devuelve una fila, créela:

```powershell
& 'C:\Program Files\PostgreSQL\18\bin\psql.exe' -h 127.0.0.1 -p 5432 -U postgres -d postgres -c "CREATE DATABASE jovycandy_prototipo_medusa;"
```

Después, configure `DATABASE_URL` con una contraseña local autorizada en `apps/backend/.env` y ejecute:

```powershell
pnpm --dir apps/backend exec medusa db:migrate
pnpm --dir apps/backend exec medusa user --email admin@local.test --password REPLACE_WITH_A_LOCAL_PASSWORD
```

No use nombres históricos (`jovycandy_medusa_proto`, `jovycandy_ecommerce_proto`), bases remotas, credenciales productivas ni una contraseña documentada en este repositorio.

## Comandos del workspace

```powershell
pnpm install
pnpm dev:storefront
pnpm dev:backend
pnpm dev
pnpm lint
pnpm typecheck
pnpm build
pnpm test
```

Para validaciones puntuales:

```powershell
pnpm --filter storefront lint
pnpm --filter storefront typecheck
pnpm --filter storefront build
pnpm --filter @dtc/backend typecheck
pnpm --filter @dtc/backend build
```

Los puertos esperados son `http://localhost:3000` para el storefront y, después de migrar la base, `http://localhost:9000/health` y `http://localhost:9000/app` para Medusa/Admin.

## Nota sobre pnpm

pnpm 11 bloquea scripts de instalación no aprobados. El workspace usa el campo actual `allowBuilds`, no la opción retirada `onlyBuiltDependencies`. No cambie esta política a una aprobación global ni use `--force` para ocultar incompatibilidades.
